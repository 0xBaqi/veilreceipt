import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, isAbsolute } from 'node:path';
import { InvoiceAllocationUncertainError, InvoiceInputError, InvoiceService } from './invoices.ts';

const root = resolve(import.meta.dirname, '../public');
const cliPath = process.env.ZINGO_CLI;
const walletDir = process.env.ZINGO_DATA_DIR;
if (!cliPath || !walletDir || !isAbsolute(walletDir)) {
  throw new Error('Set ZINGO_CLI and an absolute ZINGO_DATA_DIR before starting VeilReceipt.');
}
const service = new InvoiceService({
  databasePath: process.env.VEILRECEIPT_DB ?? resolve(import.meta.dirname, '../data/veilreceipt.sqlite'),
  cliPath,
  walletDir,
});
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  try {
    if (req.method === 'GET' && url.pathname === '/api/invoices') return send(200, service.list());
    if (req.method === 'POST' && url.pathname === '/api/invoices') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 16_384) return send(413, { error: 'Request too large' }); }
      let input: unknown;
      try { input = JSON.parse(body); }
      catch { return send(400, { error: 'Request body must contain valid JSON.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return send(400, { error: 'Request body must be a JSON object.' });
      try { return send(201, await service.create(input as { amountZec?: unknown; description?: unknown })); }
      catch (error) {
        if (error instanceof InvoiceInputError) return send(400, { error: error.message });
        if (error instanceof InvoiceAllocationUncertainError) return send(409, { error: error.message });
        return send(500, { error: 'Invoice creation failed. Check server configuration and database availability.' });
      }
    }
    const match = url.pathname.match(/^\/api\/invoices\/([\w-]+)$/);
    if (req.method === 'GET' && match) { const invoice = service.get(match[1]); return invoice ? send(200, invoice) : send(404, { error: 'Invoice not found' }); }
    if (req.method === 'GET') {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (file.includes('..') || file.includes('/')) return send(404, { error: 'Not found' });
      try { const content = await readFile(resolve(root, file)); res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }); return res.end(content); }
      catch { return send(404, { error: 'Not found' }); }
    }
    send(405, { error: 'Method not allowed' });
  } catch { send(500, { error: 'Internal server error' }); }
});
const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => console.log(`VeilReceipt listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { service.close(); process.exit(0); }));
