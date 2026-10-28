const list = document.querySelector('#invoice-list');
const detail = document.querySelector('#detail');
const form = document.querySelector('#create-form');
const errorBox = document.querySelector('#form-error');
const statusLabel = { awaiting_payment: 'Awaiting payment', allocation_pending: 'Address allocation pending', allocation_uncertain: 'Address unresolved', paid: 'Payment status unverified' };
let invoices = [];
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function renderList() {
  document.querySelector('#invoice-count').textContent = invoices.length;
  if (!invoices.length) { list.innerHTML = '<div class="empty"><span>◌</span><p>No invoices yet</p><small>Your payment requests will appear here.</small></div>'; return; }
  list.innerHTML = invoices.map(invoice => `<article class="invoice-row ${detail.dataset.invoice === invoice.id ? 'active' : ''}" data-id="${esc(invoice.id)}"><div><div class="row-title">${esc(invoice.description)}</div><div class="row-meta">${new Date(invoice.createdAt).toLocaleString()}</div></div><div><div class="row-amount">${esc(invoice.amountZec)} ZEC</div><div style="text-align:right;margin-top:7px"><span class="badge ${invoice.status.includes('uncertain') ? 'uncertain' : invoice.status}">${esc(statusLabel[invoice.status])}</span></div></div></article>`).join('');
  list.querySelectorAll('.invoice-row').forEach(row => row.addEventListener('click', () => showInvoice(row.dataset.id)));
}
async function load() { try { const response = await fetch('/api/invoices'); invoices = await response.json(); renderList(); } catch { list.innerHTML = '<div class="empty"><p>Could not load invoices</p></div>'; } }
function showInvoice(id) {
  const invoice = invoices.find(item => item.id === id); if (!invoice) return;
  detail.dataset.invoice = id; detail.hidden = false;
  const uncertain = invoice.status === 'allocation_uncertain' || invoice.status === 'allocation_pending';
  const addressReady = invoice.status === 'awaiting_payment' && Boolean(invoice.receivingAddress);
  detail.innerHTML = `${addressReady ? `<div class="ready-banner"><span class="ready-check">✓</span><div><strong>Payment request ready to share</strong><span>Address assigned · Awaiting payment</span></div></div>` : ''}<div class="panel-head"><div><p class="eyebrow">INVOICE DETAILS</p><h2>${esc(invoice.description)}</h2></div><span class="badge ${uncertain ? 'uncertain' : invoice.status}">${esc(statusLabel[invoice.status])}</span></div><div class="detail-grid"><div><p class="detail-key">AMOUNT DUE</p><p class="detail-value">${esc(invoice.amountZec)} ZEC</p><p class="detail-key">INVOICE ID</p><p class="detail-value" style="font:10px ui-monospace,monospace;word-break:break-all">${esc(invoice.id)}</p><p class="detail-key">CREATED</p><p class="detail-value">${new Date(invoice.createdAt).toLocaleString()}</p></div><div><p class="detail-key">ORCHARD RECEIVING ADDRESS</p>${addressReady ? `<div class="detail-address" id="address">${esc(invoice.receivingAddress)}</div><button class="copy" id="copy-address">Copy shielded address&nbsp; ↗</button><p class="instruction">Ask the customer to send exactly <strong>${esc(invoice.amountZec)} ZEC</strong> to this address using a Zcash wallet with shielded payments enabled. Include the invoice ID in your reconciliation records.</p>` : `<div class="warning">${uncertain ? 'Address allocation is unresolved. Do not share an address, retry this invoice, or assign another address. Reconcile its reserved allocation before taking further action.' : 'No address is available for this invoice. Refresh the invoice list to check its current status.'}</div>`}</div></div><div class="warning">Payment is not verified from the blockchain in this milestone. Leave this invoice as awaiting payment until independent on-chain evidence is available.</div>`;
  document.querySelector('#copy-address')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(invoice.receivingAddress); document.querySelector('#copy-address').textContent = 'Copied'; } catch { document.querySelector('#copy-address').textContent = 'Copy unavailable'; } });
  renderList();
}
form.addEventListener('submit', async event => {
  event.preventDefault(); errorBox.hidden = true;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true; submitButton.textContent = 'Creating request…';
  const values = new FormData(form);
  try {
    const response = await fetch('/api/invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(values)) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Unable to create invoice');
    form.reset(); await load(); showInvoice(result.id);
  } catch (error) { errorBox.textContent = error instanceof TypeError ? 'The request could not be confirmed. Refresh the invoice list before trying again.' : error.message; errorBox.hidden = false; await load(); }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Create payment request <span>↗</span>'; }
});
document.querySelector('#refresh').addEventListener('click', load);
load();
