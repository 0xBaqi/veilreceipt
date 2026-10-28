const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;

export function validateDemoInvoice(amountZec, description) {
  const amount = String(amountZec).trim();
  const title = String(description).trim();
  if (!amountPattern.test(amount) || Number(amount) <= 0) {
    throw new Error('Enter an amount greater than zero with up to 8 decimal places.');
  }
  if (!title || title.length > 500) {
    throw new Error('Add a description of 1 to 500 characters.');
  }
  return { amountZec: Number(amount).toFixed(8), description: title };
}

export function createDemoInvoice(amountZec, description, { id = crypto.randomUUID(), now = new Date() } = {}) {
  const valid = validateDemoInvoice(amountZec, description);
  return {
    id,
    ...valid,
    createdAt: now.toISOString(),
    status: 'demo_awaiting_payment',
    simulatedAddress: `DEMO ONLY - NOT A VALID ZCASH ADDRESS - ${id.toUpperCase()}`
  };
}
