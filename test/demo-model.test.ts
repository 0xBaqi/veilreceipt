import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoInvoice, validateDemoInvoice } from '../public/demo-model.js';

test('creates visibly simulated invoice data and an invalid address label', () => {
  const invoice = createDemoInvoice('0.025', 'Demo order', { id: 'demo-123', now: new Date('2026-01-02T03:04:05.000Z') });
  assert.equal(invoice.amountZec, '0.02500000');
  assert.equal(invoice.description, 'Demo order');
  assert.equal(invoice.createdAt, '2026-01-02T03:04:05.000Z');
  assert.equal(invoice.status, 'demo_awaiting_payment');
  assert.match(invoice.simulatedAddress, /^DEMO ONLY - NOT A VALID ZCASH ADDRESS - /);
  assert.doesNotMatch(invoice.simulatedAddress, /^u1/);
});

test('rejects invalid demo amounts and empty descriptions', () => {
  for (const amount of ['', '0', '-1', '1e-3', '0.000000001', '01']) {
    assert.throws(() => validateDemoInvoice(amount, 'Demo'), /amount/i);
  }
  assert.throws(() => validateDemoInvoice('1', '  '), /description/i);
});
