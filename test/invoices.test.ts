import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvoiceService, parseZingoAddress } from '../src/invoices.ts';

test('parses Zingo new_address JSON and reads its encoded Orchard receiver', () => {
  const output = `{
  "account": 0,
  "address_index": 7,
  "has_orchard": true,
  "has_sapling": false,
  "has_transparent": false,
  "encoded_address": "utest1fresh-orchard-address"
}`;
  assert.equal(parseZingoAddress(output), 'utest1fresh-orchard-address');
  assert.throws(() => parseZingoAddress('{"has_orchard":false,"encoded_address":"ztestsapling1x"}'), /Orchard/);
  assert.throws(() => parseZingoAddress('Zingo returned utest1address'), /invalid address response/);
});

function setup(addressAllocator: () => Promise<string>) {
  const dir = mkdtempSync(join(tmpdir(), 'veilreceipt-'));
  const service = new InvoiceService({ databasePath: join(dir, 'invoices.sqlite'), cliPath: '/unused', walletDir: '/unused', addressAllocator });
  return { dir, service, cleanup() { service.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('creates an invoice with a fresh address and persists it after restart', async () => {
  const address = 'utest1fresh-orchard-address';
  const first = setup(async () => address);
  const invoice = await first.service.create({ amountZec: '0.125', description: 'Consulting' });
  assert.equal(invoice.amountZec, '0.125');
  assert.equal(invoice.description, 'Consulting');
  assert.equal(invoice.status, 'awaiting_payment');
  assert.equal(invoice.receivingAddress, address);
  assert.ok(invoice.id && invoice.createdAt);
  first.service.close();
  const reopened = new InvoiceService({ databasePath: join(first.dir, 'invoices.sqlite'), cliPath: '/unused', walletDir: '/unused', addressAllocator: async () => 'unused' });
  assert.deepEqual(reopened.get(invoice.id), invoice);
  reopened.close(); rmSync(first.dir, { recursive: true, force: true });
});

test('serializes concurrent creations so they receive distinct addresses', async () => {
  let next = 0;
  const ctx = setup(async () => { await new Promise(resolve => setTimeout(resolve, 5)); next += 1; return `utest${next}`; });
  const invoices = await Promise.all(Array.from({ length: 12 }, (_, index) => ctx.service.create({ amountZec: '1', description: `Order ${index}` })));
  assert.equal(next, 12);
  assert.equal(new Set(invoices.map(item => item.receivingAddress)).size, 12);
  assert.equal(ctx.service.list().length, 12);
  ctx.cleanup();
});

test('rejects invalid or over precise amounts before allocating', async () => {
  let calls = 0;
  const ctx = setup(async () => { calls += 1; return 'utest'; });
  for (const amountZec of [0, -1, '0', '0.000000001', '1e2', '01', 'abc', null]) {
    await assert.rejects(ctx.service.create({ amountZec, description: 'Bad amount' }));
  }
  assert.equal(calls, 0);
  assert.equal(ctx.service.list().length, 0);
  ctx.cleanup();
});

test('keeps failed allocations uncertain and never retries or marks them paid', async () => {
  let calls = 0;
  const ctx = setup(async () => { calls += 1; throw new Error('simulated CLI failure with secret wallet detail'); });
  await assert.rejects(ctx.service.create({ amountZec: '2.5', description: 'Unresolved' }), error => {
    assert.match(error.message, /Do not retry this invoice/);
    assert.doesNotMatch(error.message, /secret wallet detail/);
    return true;
  });
  const [invoice] = ctx.service.list();
  assert.equal(invoice.status, 'allocation_uncertain');
  assert.equal(invoice.receivingAddress, null);
  assert.equal(calls, 1);
  assert.equal(Object.hasOwn(invoice, 'paidAt'), false);
  ctx.cleanup();
});
