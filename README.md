# VeilReceipt

VeilReceipt helps a merchant request ZEC without publishing a reusable transparent payment address for every customer. Each invoice gets a fresh Orchard receiving address, so the merchant can share a shielded destination for that request and keep invoice details alongside it.

This milestone implements merchant-side invoice creation, listing and detail views; exact decimal amount validation; durable SQLite storage; and offline testnet Orchard address allocation through Zingo CLI. It provides payment instructions and a copyable address for manual follow-up. It does **not** detect payments, synchronize with the blockchain, reconcile transactions automatically, or verify payment status. It does not send funds or handle wallet keys.

The app is independent and uses Node.js 24, TypeScript's built-in type stripping, built-in `node:sqlite`, and a plain responsive browser UI. It has no third-party runtime dependencies.

## Setup

From this directory:

```sh
node --version # 24.21.0 or newer
ZINGO_CLI="/absolute/path/to/zingo-cli" \
ZINGO_DATA_DIR="/absolute/path/to/wallet-directory" npm start
```

Set `ZINGO_CLI` and an absolute `ZINGO_DATA_DIR` for a dedicated testnet wallet before startup. `PORT` and `VEILRECEIPT_DB` are optional; the SQLite database defaults to `data/veilreceipt.sqlite`. Open <http://127.0.0.1:4173>. The server binds to localhost. Address generation runs in offline mode using:

```sh
zingo-cli --chain testnet --offline --data-dir "$ZINGO_DATA_DIR" new_address o
```

The address allocator is serialized in-process. Before invoking Zingo, the app durably records an invoice and allocation reservation in SQLite. Zingo's `new_address` command returns a JSON object; VeilReceipt requires `has_orchard: true` and stores its `encoded_address` field. If allocation fails or its result cannot be saved, the invoice is left unresolved and is never retried automatically. Its reservation is retained so the potentially consumed address is not reassigned. Internal CLI diagnostics are not returned in API errors. An unresolved allocation requires operator review against wallet state before any manual action.

## Architecture

- `src/server.ts`: built-in HTTP server, static files, JSON API.
- `src/invoices.ts`: SQLite schema, exact decimal string validation, serialized wallet mutations, Zingo subprocess integration.
- `public/`: merchant interface and payment instructions.
- `public/favicon.svg`: compact green diamond mark used by the browser tab and matching the dashboard emblem.
- `test/`: Node built-in test runner coverage with injected address allocation.
- `docs/demo-script.md`: two-minute walkthrough and recording safety checklist.

SQLite stores invoice IDs, decimal ZEC amount strings, descriptions, ISO timestamps, status, receiving address, and allocation reservations. Invoice statuses are `allocation_pending`, `awaiting_payment`, `allocation_uncertain`, and a reserved `paid` value. There is no UI action or API route that marks an invoice paid.

## Security boundaries

- VeilReceipt passes the configured wallet directory to Zingo for local, offline address generation. The app does not read, store, transmit or display seed phrases, viewing keys or wallet files.
- The merchant API returns invoice receiving addresses because they are needed to fulfill requests. It does not return Zingo configuration paths.
- The server binds to `127.0.0.1` and has no merchant authentication. Keep it local; it is not suitable for network exposure or production use.
- SQLite files, wallet files, credentials, logs and generated artifacts are ignored by Git. Back up invoice data separately and securely if needed.

## API

- `POST /api/invoices` with `{"amountZec":"0.125","description":"Consulting"}` creates an invoice and allocates an Orchard address.
- `GET /api/invoices` lists invoices.
- `GET /api/invoices/:id` retrieves one invoice.

## Tests

```sh
npm test
```

Tests use temporary SQLite databases and a fake address allocator. They do not access or mutate the configured Zingo wallet. No live payment verification is claimed or implemented.

## Hosted judge demo

The live hosted demo is [veilreceipt.baronal.xyz](https://veilreceipt.baronal.xyz/). The two-minute [demo video](https://youtu.be/HnFQurDfm7c) shows the product workflow. The GitHub source repository is [0xBaqi/veilreceipt](https://github.com/0xBaqi/veilreceipt).

`public/demo.html` is a separate static demo that reuses the dashboard styling and creates fictional invoices in the visitor's browser storage. Its conspicuously marked address labels are not valid Zcash addresses. The hosted demo has no Zingo, wallet, SQLite, server API, or blockchain connection; it cannot receive funds or detect or verify a payment. Its invoice status is explicitly simulated and never indicates a confirmed payment. The local Node application and its real Zingo-backed testnet address allocation remain separate and unchanged.

`vercel.json` configures the static output as `public/` and sends `/` to the demo page. The hosted demo does not use wallet or database environment variables. Only the static `public/` output is served; the Node source and local data are outside that output. The demo's saved invoices remain in each visitor's browser and are not shared or synchronized. Payment detection and blockchain confirmation are not implemented in either milestone.

## Current limitations and risks

- Testnet address generation only; no mainnet, payment detection, chain indexing, webhook, expiry, refunds, or automatic reconciliation.
- Payment status is unverified. The reserved `paid` status is not set by the app. Do not claim a request was paid based on a receipt or screenshot.
- The in-process queue prevents concurrent allocation races in one server instance. Do not run multiple VeilReceipt processes against the same wallet; cross-process wallet locking is not implemented.
- The durable reservation protects against app-level retries after ambiguous CLI/database outcomes. If the SQLite storage itself becomes unavailable before the reservation is committed, the app does not invoke Zingo.
- Operator access control is not implemented. Keep the server local and do not expose it to a network.
- Use a dedicated test wallet for demos. Do not copy wallet data into this project or commit wallet files.
