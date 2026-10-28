import { createDemoInvoice } from '/demo-model.js';

const storageKey = 'veilreceipt-hosted-demo-invoices-v1';
const list = document.querySelector('#invoice-list');
const detail = document.querySelector('#detail');
const form = document.querySelector('#create-form');
const errorBox = document.querySelector('#form-error');
let invoices = readInvoices();
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateLabel = value => new Date(value).toLocaleString();

function readInvoices() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && item.status === 'demo_awaiting_payment') : [];
  } catch { return []; }
}

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(invoices)); return true; }
  catch { return false; }
}

function renderList() {
  document.querySelector('#invoice-count').textContent = String(invoices.length);
  if (!invoices.length) {
    list.innerHTML = '<div class="empty"><span>◌</span><p>No demo invoices yet</p><small>Create one to explore the invoice view.</small></div>';
    return;
  }
  list.innerHTML = invoices.map(invoice => `<article class="invoice-row ${detail.dataset.invoice === invoice.id ? 'active' : ''}" data-id="${esc(invoice.id)}" tabindex="0" role="button" aria-label="View demo invoice ${esc(invoice.description)}"><div><div class="row-title">${esc(invoice.description)}</div><div class="row-meta">${esc(dateLabel(invoice.createdAt))}</div></div><div><div class="row-amount">${esc(invoice.amountZec)} ZEC</div><div style="text-align:right;margin-top:7px"><span class="badge demo-status">Simulated · Awaiting payment</span></div></div></article>`).join('');
  list.querySelectorAll('.invoice-row').forEach(row => {
    row.addEventListener('click', () => showInvoice(row.dataset.id));
    row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showInvoice(row.dataset.id); } });
  });
}

function showInvoice(id) {
  const invoice = invoices.find(item => item.id === id);
  if (!invoice) return;
  detail.dataset.invoice = id;
  detail.hidden = false;
  detail.innerHTML = `<div class="ready-banner"><span class="ready-check">✓</span><div><strong>Simulated request created</strong><span>Demo-only status · Awaiting payment (simulated)</span></div></div><div class="panel-head"><div><p class="eyebrow">DEMO INVOICE DETAILS</p><h2>${esc(invoice.description)}</h2></div><span class="badge demo-status">Simulated · Awaiting payment</span></div><div class="detail-grid"><div><p class="detail-key">SIMULATED AMOUNT</p><p class="detail-value">${esc(invoice.amountZec)} ZEC</p><p class="detail-key">DEMO INVOICE ID</p><p class="detail-value" style="font:10px ui-monospace,monospace;word-break:break-all">${esc(invoice.id)}</p><p class="detail-key">CREATED IN THIS BROWSER</p><p class="detail-value">${esc(dateLabel(invoice.createdAt))}</p></div><div><p class="detail-key">SIMULATED ADDRESS LABEL · NOT A REAL ADDRESS</p><div class="demo-address" id="demo-address">${esc(invoice.simulatedAddress)}</div><button class="demo-copy" id="copy-address" type="button">Copy simulated address label ↗</button><p class="instruction">This placeholder demonstrates where an address would appear. It is not a valid Zcash address. Do not send funds.</p></div></div><div class="warning demo-warning">This is fictional demo data stored in this browser only. No payment was made or detected. Blockchain payment detection and verification are not implemented.</div>`;
  document.querySelector('#copy-address').addEventListener('click', async event => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(invoice.simulatedAddress); button.textContent = 'Demo label copied'; }
    catch { button.textContent = 'Clipboard unavailable'; }
  });
  renderList();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  errorBox.hidden = true;
  const values = new FormData(form);
  try {
    const invoice = createDemoInvoice(values.get('amountZec'), values.get('description'));
    invoices.unshift(invoice);
    if (!persist()) {
      invoices.shift();
      throw new Error('Browser storage is unavailable. Allow local storage and try again.');
    }
    form.reset();
    renderList();
    showInvoice(invoice.id);
  } catch (error) {
    errorBox.textContent = error.message || 'Could not create a demo invoice.';
    errorBox.hidden = false;
  }
});

document.querySelector('#refresh').addEventListener('click', () => { invoices = readInvoices(); renderList(); });
renderList();
