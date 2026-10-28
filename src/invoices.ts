import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type InvoiceStatus = 'allocation_pending' | 'awaiting_payment' | 'allocation_uncertain' | 'paid';
export type Invoice = {
  id: string;
  amountZec: string;
  description: string;
  createdAt: string;
  status: InvoiceStatus;
  receivingAddress: string | null;
};

export class InvoiceInputError extends Error {}
export class InvoiceAllocationUncertainError extends Error {}

export function validateAmount(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new InvoiceInputError('Amount must be a positive ZEC value');
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(text) || /^0(?:\.0+)?$/.test(text)) {
    throw new InvoiceInputError('Amount must be greater than zero with at most 8 decimal places');
  }
  return text;
}

export function parseZingoAddress(stdout: string): string {
  let response: unknown;
  try { response = JSON.parse(stdout); }
  catch { throw new Error('Zingo returned an invalid address response'); }
  if (!response || typeof response !== 'object') throw new Error('Zingo returned an invalid address response');
  const result = response as Record<string, unknown>;
  if (result.has_orchard !== true || typeof result.encoded_address !== 'string' || !result.encoded_address.trim()) {
    throw new Error('Zingo response did not contain an Orchard receiving address');
  }
  return result.encoded_address.trim();
}

function invoiceFrom(row: any): Invoice {
  return { id: row.id, amountZec: row.amount_zec, description: row.description, createdAt: row.created_at,
    status: row.status, receivingAddress: row.receiving_address };
}

export class InvoiceService {
  private db: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();
  private cli: string;
  private wallet: string;

  constructor(options: { databasePath: string; cliPath: string; walletDir: string; addressAllocator?: () => Promise<string> }) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    this.db = new DatabaseSync(options.databasePath);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY, amount_zec TEXT NOT NULL, description TEXT NOT NULL,
        created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('allocation_pending','awaiting_payment','allocation_uncertain','paid')),
        receiving_address TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS allocations (
        invoice_id TEXT PRIMARY KEY REFERENCES invoices(id), state TEXT NOT NULL CHECK(state IN ('reserved','assigned','uncertain')),
        created_at TEXT NOT NULL
      );`);
    this.cli = options.cliPath;
    this.wallet = options.walletDir;
    this.allocate = options.addressAllocator ?? (() => this.runZingo());
  }

  private allocate: () => Promise<string>;

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private runZingo(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cli, ['--chain', 'testnet', '--offline', '--data-dir', this.wallet, 'new_address', 'o'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30_000);
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
      // Drain stderr to avoid blocking, but never persist or return CLI diagnostics.
      child.stderr.resume();
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0 || timedOut) return reject(new Error(timedOut ? 'Zingo address allocation timed out' : `Zingo address allocation failed (${code})`));
        try { resolve(parseZingoAddress(stdout)); }
        catch (error) { reject(error); }
      });
    });
  }

  async create(input: { amountZec?: unknown; description?: unknown }): Promise<Invoice> {
    const amount = validateAmount(input.amountZec);
    if (typeof input.description !== 'string' || !input.description.trim() || input.description.length > 500) throw new InvoiceInputError('Description is required and must be 500 characters or fewer');
    return this.serialized(async () => {
      const id = randomUUID(); const createdAt = new Date().toISOString();
      // Commit the reservation before touching the wallet. Any later failure leaves a permanent no-reuse record.
      this.db.prepare(`INSERT INTO invoices(id,amount_zec,description,created_at,status) VALUES(?,?,?,?, 'allocation_pending')`)
        .run(id, amount, input.description.trim(), createdAt);
      this.db.prepare(`INSERT INTO allocations(invoice_id,state,created_at) VALUES(?,'reserved',?)`).run(id, createdAt);
      try {
        const address = await this.allocate();
        if (!address) throw new Error('Address allocator returned an empty address');
        this.db.prepare(`UPDATE invoices SET receiving_address=?,status='awaiting_payment' WHERE id=?`).run(address, id);
        this.db.prepare(`UPDATE allocations SET state='assigned' WHERE invoice_id=?`).run(id);
        return this.get(id)!;
      } catch {
        // Keep reservation. The CLI may have advanced wallet state even when its result is unavailable.
        try {
          this.db.prepare(`UPDATE invoices SET status='allocation_uncertain' WHERE id=?`).run(id);
          this.db.prepare(`UPDATE allocations SET state='uncertain' WHERE invoice_id=?`).run(id);
        } catch { /* the durable pre-call reservation remains allocation_pending */ }
        throw new InvoiceAllocationUncertainError(`Invoice ${id} was reserved but address allocation is uncertain. Do not retry this invoice or reuse its allocation. Check its status and reconcile the reserved allocation before further action.`);
      }
    });
  }

  list(): Invoice[] { return (this.db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all() as any[]).map(invoiceFrom); }
  get(id: string): Invoice | null {
    const row = this.db.prepare('SELECT * FROM invoices WHERE id=?').get(id) as any;
    return row ? invoiceFrom(row) : null;
  }
  close(): void { this.db.close(); }
}
