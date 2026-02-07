# ShipLint Analytics

Pieter Levels-style analytics for ShipLint. Simple, public, no BS.

## What it tracks (anonymous)

- CLI version
- Number of findings (total, errors, warnings)
- Which rule IDs triggered
- Timestamp

**NOT tracked:** Project names, file paths, user info, anything identifiable.

## Public endpoints

- `GET /stats` — Public stats page
- `GET /api/stats` — Stats JSON
- `POST /api/ping` — CLI telemetry receiver

## Setup (Kaz's TODO)

### 1. Create D1 database

```bash
cd analytics
wrangler d1 create shiplint-analytics
```

Copy the database ID and update `wrangler.toml`.

### 2. Create the table

```bash
wrangler d1 execute shiplint-analytics --file=schema.sql
```

### 3. Deploy the worker

```bash
wrangler deploy
```

### 4. Add routes in Cloudflare dashboard

Route the worker to:
- `shiplint.app/api/ping`
- `shiplint.app/api/stats`
- `shiplint.app/stats`

Or use a subdomain: `analytics.shiplint.app/*`

## Opt-out

Users can opt out of telemetry:

```bash
SHIPLINT_NO_TELEMETRY=1 npx shiplint scan .
```

## Local testing

```bash
wrangler dev
# Then POST to http://localhost:8787/api/ping
```

## Cost

D1 free tier: 5M reads/day, 100K writes/day — way more than we need.
Worker free tier: 100K requests/day — also plenty.

Total cost: **$0** until we're massive.
