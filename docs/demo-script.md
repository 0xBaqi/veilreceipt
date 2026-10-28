# VeilReceipt: two-minute demo

**Demo claim:** VeilReceipt creates and stores merchant payment requests with a fresh testnet Orchard address per invoice. It does not detect, synchronize, or verify payments.

## Walkthrough

**0:00–0:20 — Merchant problem**
“Merchants need a clear way to request ZEC and keep each request tied to an invoice. Reusing one public transparent address can make payment relationships easier to link. VeilReceipt gives each request its own Orchard receiving address.”

**0:20–0:45 — Create a request**
Show the merchant console. Enter a demo amount such as `0.025` and description `Demo order 104`, then choose **Create payment request**. Explain that the local Zingo CLI allocates an Orchard address in offline testnet mode.

**0:45–1:15 — Review the invoice**
Show the new invoice in the list and its details: amount, description, creation time, invoice ID, and **Awaiting payment** status. Point out the copy-address control and the instruction to send the requested ZEC using a shielded-capable wallet.

**1:15–1:35 — Show persistence**
Refresh the invoice list and reopen the same request. Explain that invoice details and the receiving address are stored in SQLite. Do not open the database or wallet directory during the recording.

**1:35–2:00 — State the boundary**
“VeilReceipt prepares payment requests; it does not watch the chain or verify incoming payments. The status remains Awaiting payment until a future version can verify independent blockchain evidence. This demo does not send a transaction or claim payment.”

## Recording checklist

- Use a dedicated testnet wallet and clearly label the demo as testnet.
- Start the app with `ZINGO_CLI` and `ZINGO_DATA_DIR` set before recording; keep the terminal and environment values out of frame.
- Use fictional merchant and order details. Do not show wallet files, seed phrases, viewing keys, credentials, or local filesystem paths.
- If you prefer not to publish a usable receiving address, blur it while showing the address panel and copy control.
- Avoid screens or narration that imply live synchronization, payment detection, automatic reconciliation, or verified/paid status.
- Do not send a test transaction just for the recording. Stop at the Awaiting payment state.
- Keep the final recording around two minutes and finish on the limitation statement above.
