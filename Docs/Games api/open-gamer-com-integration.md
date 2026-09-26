OpenGamer RGS Integration Guide

Operator Integration Manual

☰

× [1\. Overview](https://open-gamer.com/integration#1-overview) [2\. Authentication](https://open-gamer.com/integration#2-authentication) [3\. Getting the Game List](https://open-gamer.com/integration#3-getting-the-game-list) [4\. Getting a Game Launch URL](https://open-gamer.com/integration#4-getting-a-game-launch-url) [5\. Game Launch Process](https://open-gamer.com/integration#5-game-launch-process) [6\. Wallet API](https://open-gamer.com/integration#6-wallet-api-operator-implementation) [6.1 Get Balance](https://open-gamer.com/integration#6-1-get-balance) [6.2 Place Bet](https://open-gamer.com/integration#6-2-bet-debit) [6.3 Game Result](https://open-gamer.com/integration#6-3-game-result-credit) [6.4 Rollback](https://open-gamer.com/integration#6-4-rollback) [Free spins / buy bonus](https://open-gamer.com/integration#free-spins-and-buy-bonus-wallet-behavior) [7\. Bet Details](https://open-gamer.com/integration#7-bet-details) [8\. Error Handling](https://open-gamer.com/integration#8-error-handling) [9\. Example Implementation](https://open-gamer.com/integration#9-example-implementation) [10\. Quick Reference](https://open-gamer.com/integration#10-quick-reference) [11\. Currency Code](https://open-gamer.com/integration#11-currency-code) [12\. Language Code](https://open-gamer.com/integration#12-language-code)

[1\. Overview](https://open-gamer.com/integration#1-overview) [2\. Authentication](https://open-gamer.com/integration#2-authentication) [3\. Getting the Game List](https://open-gamer.com/integration#3-getting-the-game-list) [4\. Getting a Game Launch URL](https://open-gamer.com/integration#4-getting-a-game-launch-url) [5\. Game Launch Process](https://open-gamer.com/integration#5-game-launch-process) [6\. Wallet API](https://open-gamer.com/integration#6-wallet-api-operator-implementation) [6.1 Get Balance](https://open-gamer.com/integration#6-1-get-balance) [6.2 Place Bet](https://open-gamer.com/integration#6-2-bet-debit) [6.3 Game Result](https://open-gamer.com/integration#6-3-game-result-credit) [6.4 Rollback](https://open-gamer.com/integration#6-4-rollback) [Free spins / buy bonus](https://open-gamer.com/integration#free-spins-and-buy-bonus-wallet-behavior) [7\. Bet Details](https://open-gamer.com/integration#7-bet-details) [8\. Error Handling](https://open-gamer.com/integration#8-error-handling) [9\. Example Implementation](https://open-gamer.com/integration#9-example-implementation) [10\. Quick Reference](https://open-gamer.com/integration#10-quick-reference) [11\. Currency Code](https://open-gamer.com/integration#11-currency-code) [12\. Language Code](https://open-gamer.com/integration#12-language-code)

**1\. Overview**

This guide explains how to integrate OpenGamer slot games into your operator platform. Integration has two sides:

1. **Operator → RGS** — Authenticated API calls to list games, obtain launch URLs, and fetch bet detail links
2. **RGS → Operator** — Wallet callbacks your platform must implement for balance, bet, win, and rollback

##### Integration Flow

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Operator   │       │  OpenGamer   │       │    Player    │
│   Platform   │       │     RGS      │       │   Browser    │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │ 1. POST get-game-list|                      │
       │─────────────────────>│                      │
       │<─────────────────────│                      │
       │                      │                      │
       │ 2. POST get-game-url │                      │
       │─────────────────────>│                      │
       │<── launch URL + JWT ─│                      │
       │                      │                      │
       │ 3. Embed iframe ───────────────────────────>│
       │                      │                      │
       │                      │  4. Validate launch  │
       │                      │<─────────────────────│
       │                      │  5. accessToken      │
       │                      │─────────────────────>│
       │                      │                      │
       │  6. Wallet callbacks │  7. Game API calls   │
       │<─────────────────────│<─────────────────────│
       │─────────────────────>│─────────────────────>│
```

##### Credentials You Receive

| Credential | Used for |
| --- | --- |
| `OPERATOR_API_TOKEN` | Header `token` on Operator → RGS requests |
| `OPERATOR_API_SECRET` | HMAC body signing (`hash` field) |
| `WALLET_API_TOKEN` | Header `token` on RGS → Operator wallet requests |
| `WALLET_API_SECRET` | HMAC body signing on wallet requests |
| `provider_id` | Included in every Operator → RGS and wallet request body (format: `opengamer-{partnerId}`) |
| RGS API base URL | e.g. `https://api.example.com` |

**2\. Authentication**

All Operator → RGS endpoints use the same scheme.

##### Request requirements

- Method: `POST`
- `Content-Type: application/json`
- Header: `token: {OPERATOR_API_TOKEN}`
- Body: JSON object that includes a `hash` field

##### Hash algorithm

Same algorithm for Operator → RGS and RGS → wallet.

1. Take all body fields **except**`hash`
2. Sort keys alphabetically
3. Build a query string with `URLSearchParams` (space → `+`)

- Booleans become `true` / `false`
- Arrays become comma-joined values
- Objects are skipped

1. Compute `HMAC-SHA256(signing_string, SECRET)` (hex digest)
2. Set `hash` to that digest

##### Node.js signing example

```javascript
const crypto = require('crypto');

function sortedParams(params) {
  return Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {});
}

function signPayload(payload, secret) {
  const { hash, ...rest } = payload;
  const rawData = new URLSearchParams(sortedParams(rest)).toString();
  return {
    ...rest,
    hash: crypto.createHmac('sha256', secret).update(rawData).digest('hex'),
  };
}
```

##### Auth failure response

```json
{
  "status": false,
  "err": "Token invalid"
}
```

or `"err": "Hash invalid"`.

**3\. Getting the Game List**

##### Endpoint

```
POST {RGS_API_BASE}/api/get-game-list
```

##### Request body

| Field | Required | Description |
| --- | --- | --- |
| `provider_id` | Yes | Provider ID issued to you (e.g. `opengamer-{partnerId}`) |
| `home` | No | If `true`, only homepage carousel games |
| `hash` | Yes | Request signature |

```json
{
  "provider_id": "opengamer",
  "home": false,
  "hash": "..."
}
```

##### Success response

```json
{
  "provider_id": "opengamer",
  "status": true,
  "err": "OK",
  "logo_img": "https://cdn.example.com/logo.png",
  "language": ["de", "en", "es", "fa", "fr", "hi", "hy", "id", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"],
  "currency": ["USD", "DEMO", "EUR", "..."],
  "game_list": [\
    {\
      "game_id": 1,\
      "game_name": "Deep Dive",\
      "game_code": "deep-dive",\
      "game_img": "https://cdn.example.com/deep-dive.jpg",\
      "game_status": true,\
      "future": false,\
      "description": "...",\
      "about": "...",\
      "type": "slot",\
      "release_date": "2025-06-01",\
      "rtp": 96.12,\
      "volatility": 3.5,\
      "grid": "6x5",\
      "max_win": "x10000"\
    }\
  ]
}
```

##### Game list fields

| Field | Type | Description |
| --- | --- | --- |
| `game_id` | int | Internal game ID |
| `game_name` | string | Display title |
| `game_code` | string | Launch identifier (use with `get-game-url`) |
| `game_img` | string | Thumbnail URL |
| `game_status` | bool | `true` if the game has a launch URL |
| `future` | bool | Upcoming / not yet released |
| `rtp` | number\ | null | Return to Player |
| `volatility` | number\ | null | Volatility rating |
| `grid` | string\ | null | Grid size (e.g. `5x3`) |
| `max_win` | string\ | null | Max win multiplier label |
| `release_date` | string\ | null | Release date |

Only **active** games are returned. Use `game_code` as the identifier for launch and wallet callbacks.

**4\. Getting a Game Launch URL**

##### Endpoint

```
POST {RGS_API_BASE}/api/get-game-url
```

##### Request body

| Field | Required | Description |
| --- | --- | --- |
| `provider_id` | Yes | Provider ID issued to you (e.g. `opengamer-{partnerId}`) |
| `session_id` | Yes | Your unique operator session ID for this launch |
| `member_code` | Yes | Pseudonymous player ID |
| `game_code` | Yes | From `game_list[].game_code` |
| `language` | Yes | Supported language code (e.g. `en`) |
| `currency` | Yes | ISO currency or demo currency (`DEMO`, `FUN`, `TTC`) |
| `redirect_url` | No | Optional return URL after exit |
| `hash` | Yes | Request signature |

```json
{
  "provider_id": "opengamer",
  "session_id": "s_abc123",
  "member_code": "u_player001",
  "game_code": "deep-dive",
  "language": "en",
  "currency": "USD",
  "redirect_url": "https://operator.example.com/lobby",
  "hash": "..."
}
```

##### Demo vs real mode

Mode is derived from currency:

| Currencies | Mode |
| --- | --- |
| `DEMO`, `FUN`, `TTC` (configurable) | `demo` — no real wallet callbacks |
| Any other supported currency | `real` — wallet API required |

##### Success response

```json
{
  "provider_id": "opengamer",
  "url": "https://deep-dive.example.com/?partnerId=opengamer&userId=u_player001&currency=USD&lang=en&game=deep-dive&mode=real&token=eyJ...",
  "status": true,
  "err": "OK"
}
```

Embed `url` directly in an iframe. The RGS appends:

| Query param | Source |
| --- | --- |
| `partnerId` | Configured partner ID |
| `userId` | `member_code` |
| `currency` | Request currency |
| `lang` | Normalized language |
| `game` | Game alias |
| `mode` | `demo` or `real` |
| `token` | Short-lived RS256 JWT (default TTL 300 seconds) |

##### Launch in iframe

```html
<iframe
    src="https://deep-dive.example.com/?partnerId=...&token=..."
    frameborder="0"
    allowfullscreen
    style="width: 100%; height: 100%; border: 0;">
</iframe>
```

**5\. Game Launch Process**

##### Complete flow

```
1. Player selects a game in your lobby
2. Your backend POST /api/get-game-url (signed)
3. RGS validates credentials, builds JWT, returns launch URL
4. Your frontend loads the URL in an iframe
5. Game client calls RGS POST|GET /sessions/validate with URL params
6. RGS returns accessToken; game uses Bearer accessToken for spins
7. On each real-money spin, RGS calls your wallet API
```

**6\. Wallet API (Operator Implementation)**

In **real** mode, OpenGamer calls your wallet on every balance check, bet, win, and rollback. You host these endpoints and give OpenGamer `WALLET_BASE_URL`.

In **demo** mode, OpenGamer uses an internal demo wallet — your wallet is not called.

`session_id` on every wallet request is the **operator session ID** you supplied in `get-game-url` (not an RGS-internal id).

##### Auth on wallet requests

Same pattern as Operator → RGS:

- Header: `token: {WALLET_API_TOKEN}`
- Body field: `hash` signed with `WALLET_API_SECRET`

Verify the signature on every request before changing balances.

##### Amount units

- Wire format uses **major** units as decimal strings (e.g. `"1.50"` for USD $1.50)
- Response `balance` must also be major units
- Datetimes use `Y-m-d H:i:s` in `Asia/Shanghai`

##### Endpoints

Default paths (relative to `WALLET_BASE_URL`):

| Operation | Method | Path |
| --- | --- | --- |
| Balance | `POST` | `/api/get-balance` |
| Bet (debit) | `POST` | `/api/bet` |
| Game result (credit) | `POST` | `/api/game-result` |
| Rollback | `POST` | `/api/rollback` |

Timeout default: **10 seconds**. RGS retries transport/5xx failures (default 3 attempts).

##### 6.1 Get Balance

```
POST {WALLET_BASE_URL}/api/get-balance
```

**Request**

```json
{
  "provider_id": "opengamer",
  "session_id": "s_abc123",
  "request_datetime": "2026-07-13 16:00:00",
  "member_code": "u_player001",
  "currency": "USD",
  "hash": "..."
}
```

**Success response**

```json
{
  "provider_id": "opengamer",
  "response_datetime": "2026-07-13 16:00:00",
  "status": true,
  "err": "OK",
  "member_code": "u_player001",
  "balance": "1234.56"
}
```

##### 6.2 Bet (Debit)

```
POST {WALLET_BASE_URL}/api/bet
```

**Request**

```json
{
  "provider_id": "opengamer",
  "session_id": "s_abc123",
  "request_datetime": "2026-07-13 16:00:01",
  "transaction_datetime": "2026-07-13 16:00:01",
  "category": "1",
  "member_code": "u_player001",
  "bet_id": "bet_01HXYZ...",
  "game_code": "deep-dive",
  "bet_amount": "1.00",
  "currency": "USD",
  "hash": "..."
}
```

| Field | Notes |
| --- | --- |
| `category` | `"1"` = normal spin, `"2"` = buy-in / feature purchase |
| `bet_id` | Unique transaction ID — use for idempotency |

**Success response**

```json
{
  "provider_id": "opengamer",
  "response_datetime": "2026-07-13 16:00:01",
  "status": true,
  "err": "OK",
  "member_code": "u_player001",
  "balance": "1233.56",
  "round_id": "rnd_optional"
}
```

`round_id` is optional but recommended.

##### 6.3 Game Result (Credit)

```
POST {WALLET_BASE_URL}/api/game-result
```

**Request**

```json
{
  "provider_id": "opengamer",
  "session_id": "s_abc123",
  "request_datetime": "2026-07-13 16:00:02",
  "transaction_datetime": "2026-07-13 16:00:02",
  "member_code": "u_player001",
  "bet_id": "bet_01HXYZ...",
  "result_id": "res_01HXYZ...",
  "game_code": "deep-dive",
  "payout": "5.00",
  "currency": "USD",
  "bet_amount": "1.00",
  "bet_completed": 1,
  "result_count": 1,
  "hash": "..."
}
```

Credit `payout` against the original `bet_id`. `payout` may be `"0.00"` for a losing spin.

##### 6.4 Rollback

```
POST {WALLET_BASE_URL}/api/rollback
```

**Request**

```json
{
  "provider_id": "opengamer",
  "session_id": "s_abc123",
  "request_datetime": "2026-07-13 16:00:03",
  "transaction_datetime": "2026-07-13 16:00:03",
  "member_code": "u_player001",
  "bet_id": "bet_01HXYZ...",
  "game_code": "deep-dive",
  "bet_amount": "1.00",
  "currency": "USD",
  "hash": "..."
}
```

Refund the debit for `bet_id` if it was not already settled.

##### 6.5 Wallet response contract

Every response must include:

| Field | Requirement |
| --- | --- |
| `status` | Truthy on success |
| `balance` | Current balance in major units (required even on some idempotent errors) |
| `err` | `"OK"` on success, or a known error string |

##### Known `err` values

| `err` | Meaning | RGS behavior |
| --- | --- | --- |
| `OK` | Success | Continue |
| `Insufficient balance` | Player cannot cover bet | Player-facing `OG-402-01` |
| `Bet limit exceeded` | Stake above operator/player limit | Player-facing `OG-402-02` |
| `Duplicate Transaction` | Same bet already processed | Treated as success **if**`balance` present |
| `Bet Transaction Not Found` | Unknown `bet_id` on result/rollback | Treated as success if `balance` present |
| `Already Mark as Rollbacked` | Already rolled back | Treated as success if `balance` present |
| `Bet Already Finished` | Already completed | Treated as success if `balance` present |
| `Bet failed` | Hard failure | Player-facing `OG-500-01` |

Implement **idempotency** on `bet_id` / `result_id`. Retries are expected.

##### Spin lifecycle

**Normal paid spin**

```
1. RGS POST /api/bet          → debit stake
2. Game resolves outcome
3. RGS POST /api/game-result  → credit payout (may be 0)
   — or —
   RGS POST /api/rollback     → refund debit on failure
```

##### Free spins and buy bonus (wallet behavior)

Free-spin and buy-bonus features do **not** send a wallet credit on every spin. Wins accumulate inside the RGS; your wallet receives **one**`/api/game-result` credit for the whole feature, on the **last** spin, with the total feature payout.

##### Free spins (awarded from a paid spin)

| Step | Wallet call | Notes |
| --- | --- | --- |
| Triggering paid spin | `POST /api/bet` | Debit the normal stake (`category: "1"`) |
| Free spins in progress | _(none)_ | No debit and no credit while the feature is active |
| Last free spin | `POST /api/game-result` | **Single** credit of the **total** free-spin win against the original `bet_id` |

Intermediate free spins may still report per-spin wins in the game UI, but those amounts are **not** sent to the wallet until the feature ends.

##### Buy bonus

| Step | Wallet call | Notes |
| --- | --- | --- |
| Purchase (first request) | `POST /api/bet` | Debit the buy-bonus cost up front (`category: "2"`) |
| Bonus spins in progress | _(none)_ | No further debits or credits while the feature runs |
| Last bonus spin | `POST /api/game-result` | **Single** credit of the **total** bonus win against the buy `bet_id` |

Summary for operators:

1. **Debit first** on buy bonus (purchase cost), then play the feature.
2. **One credit only** — after the last free/bonus spin, for the full accumulated win.
3. Link credits to the open `bet_id` from the triggering paid spin or buy-bonus debit (idempotent settle of that round).

```
Buy bonus:
1. RGS POST /api/bet          → debit purchase cost (category "2")
2. Feature spins (N times)    → no wallet bet / no game-result
3. Last spin                  → RGS POST /api/game-result (total win)

Natural free spins:
1. RGS POST /api/bet          → debit base stake (category "1")
2. Free spins (N times)       → no wallet bet / no game-result
3. Last free spin             → RGS POST /api/game-result (total free-spin win)
```

**7\. Bet Details**

Return shareable replay URLs for a settled bet.

##### Endpoint

```
POST {RGS_API_BASE}/api/get-bet-details
```

##### Request body

| Field | Required | Description |
| --- | --- | --- |
| `provider_id` | Yes | Provider ID issued to you (e.g. `opengamer-{partnerId}`) |
| `member_code` | Yes | Player ID |
| `bet_id` | Yes | Wallet debit transaction ID |
| `currency` | Yes | Currency of the bet |
| `language` | No | Replay UI language (default `en`) |
| `hash` | Yes | Signature |

##### Success response

```json
{
  "provider_id": "opengamer",
  "url": [\
    "https://deep-dive.example.com/?token=...&spinId=123&lang=en"\
  ],
  "status": true,
  "err": "OK"
}
```

`url` is an **array** (multiple spins in one round may each get a link).

**8\. Error Handling**

##### Operator API errors

Returned by **RGS → operator** when your call to our Operator API fails (launch, game list, bet details, etc.):

```json
{
  "provider_id": "opengamer",
  "status": false,
  "err": "Invalid game"
}
```

| `err` | Cause |
| --- | --- |
| `Token invalid` | Wrong or missing `token` header |
| `Hash invalid` | Missing/wrong body `hash` |
| `Invalid Provider ID` | Wrong `provider_id` (must match the value issued to you) |
| `Missing required field: …` | Required launch/bet-details field absent |
| `Invalid currency` | Unsupported currency |
| `Invalid language` | Unsupported language |
| `Invalid game` | Unknown or inactive `game_code` |
| `Game not available` | Game has no launch URL |
| `Bet not found` | Unknown `bet_id` |
| `Unable to generate launch URL` | Internal launch failure |

##### Wallet API errors

Returned by **your wallet → RGS** on `/api/balance`, `/api/bet`, `/api/game-result`, `/api/rollback`. Use the exact `err` strings below (case-insensitive match). RGS maps them to the player-facing game errors shown next.

Player limits (max bet, loss limits, responsible-gaming caps, etc.) are known only on your side after the wallet call — return `Bet limit exceeded` so the game can show a clear message instead of a generic failure.

```json
{
  "status": false,
  "balance": "100.00",
  "err": "Bet limit exceeded"
}
```

Include `balance` whenever you still know it (same as other wallet responses).

| Wallet `err` | Maps to player-facing | When to return |
| --- | --- | --- |
| `OK` | _(success)_ | Request succeeded |
| `Insufficient balance` | `OG-402-01` | Player cannot cover the debit |
| `Bet limit exceeded` | `OG-402-02` | Stake / purchase exceeds an operator or player limit |
| `Duplicate Transaction` | _(treated as success if `balance` present)_ | Idempotent retry of an already-processed bet |
| `Bet Transaction Not Found` | _(treated as success if `balance` present)_ | Unknown `bet_id` on result/rollback (idempotent) |
| `Already Mark as Rollbacked` | _(treated as success if `balance` present)_ | Already rolled back |
| `Bet Already Finished` | _(treated as success if `balance` present)_ | Already completed |
| `Bet failed` | `OG-500-01` | Hard debit/credit failure |
| _(empty body / unknown `err`)_ | `OG-500-01` / `OG-503-*` | Unexpected response; avoid this — always return JSON |

Do **not** invent alternate spellings (e.g. `bet_limit_exceeded`). RGS only maps the strings in this table.

##### Player-facing game errors

Returned by **RGS → game client** (spin / buy-bonus responses). Partners do not send these codes from the wallet; they send wallet `err` strings, and RGS maps them.

```json
{
  "error": {
    "code": "OG-402-02",
    "message": "Bet limit exceeded."
  }
}
```

| Code | Message | Typical wallet `err` |
| --- | --- | --- |
| `OG-401-01` | Authorization failed. | _(session / auth — not from wallet)_ |
| `OG-402-01` | Insufficient balance. | `Insufficient balance` |
| `OG-402-02` | Bet limit exceeded. | `Bet limit exceeded` |
| `OG-422-01` | Missing required parameter. | _(client / RGS validation)_ |
| `OG-500-01` | Something went wrong… | `Bet failed` or unknown wallet error |
| `OG-503-01` | Wallet service unavailable. | Wallet HTTP 5xx / unreachable |
| `OG-503-02` | Wallet request timeout. | Wallet timeout |

**9\. Example Implementation**

##### Node.js — signed get-game-url

```javascript
const crypto = require('crypto');

function sortedParams(params) {
  return Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {});
}

function signPayload(payload, secret) {
  const { hash, ...rest } = payload;
  const rawData = new URLSearchParams(sortedParams(rest)).toString();
  return {
    ...rest,
    hash: crypto.createHmac('sha256', secret).update(rawData).digest('hex'),
  };
}

async function getGameUrl() {
  const apiBase = process.env.RGS_API_BASE || 'https://api.example.com';
  const token = process.env.OPERATOR_API_TOKEN;
  const secret = process.env.OPERATOR_API_SECRET;

  const body = signPayload({
    provider_id: 'opengamer',
    session_id: `s_${crypto.randomBytes(8).toString('hex')}`,
    member_code: 'u_player001',
    game_code: 'deep-dive',
    language: 'en',
    currency: 'USD',
  }, secret);

  const res = await fetch(`${apiBase}/api/get-game-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const launchUrl = data.url ?? null;
  // Embed launchUrl in an iframe
  return launchUrl;
}
```

##### cURL — game list

```bash
# Compute hash with your secret, then:
curl -X POST "$RGS_API_BASE/api/get-game-list" \
  -H "Content-Type: application/json" \
  -H "token: $OPERATOR_API_TOKEN" \
  -d '{
    "provider_id": "opengamer",
    "hash": "'"$HASH"'"
  }'
```

A CLI helper ships with the API project: `api/tools/get-game-url.php`.

**10\. Quick Reference**

##### Operator → RGS

| Endpoint | Purpose |
| --- | --- |
| `POST /api/get-game-list` | Catalog |
| `POST /api/get-game-url` | Launch URL + JWT |
| `POST /api/get-bet-details` | Replay URLs |

Auth: header `token` \+ body `hash` (HMAC-SHA256).

##### RGS → Operator wallet

| Endpoint | Purpose |
| --- | --- |
| `POST /api/get-balance` | Balance |
| `POST /api/bet` | Debit (normal stake or buy-bonus purchase) |
| `POST /api/game-result` | Credit (per paid spin, or **once** at free-spin / buy-bonus end) |
| `POST /api/rollback` | Refund debit |

##### Checklist

- \[ \] `OPERATOR_API_TOKEN` / `OPERATOR_API_SECRET` configured
- \[ \] `provider_id` received and configured (e.g. `opengamer-{partnerId}`)
- \[ \] Signing implementation matches URLSearchParams + HMAC-SHA256
- \[ \] Lobby uses `get-game-list` → `game_code`
- \[ \] Launch uses server-side `get-game-url` → iframe `url`
- \[ \] Real-money wallet endpoints implemented with idempotency
- \[ \] Wallet verifies inbound `token` \+ `hash`
- \[ \] Free-spin / buy-bonus handled: one credit on last spin; buy bonus debits purchase cost first
- \[ \] Demo tested with currency `DEMO` (or `FUN` / `TTC`)

See also: [Currency Code](https://open-gamer.com/integration#11-currency-code), [Language Code](https://open-gamer.com/integration#12-language-code).

**11\. Currency Code**

Demo currencies `DEMO`, `FUN`, and `TTC` launch in `demo` mode (no operator wallet callbacks).

| Currency Code | Description | Type | Precision | Minor unit |
| --- | --- | --- | --- | --- |
| `DEMO` | Demo / play-money (testing) | demo | 2 | 100 |
| `FUN` | Fun / play-money (testing) | demo | 2 | 100 |
| `TTC` | Test currency (testing) | demo | 2 | 100 |
| `AED` | UAE Dirham | fiat | 2 | 100 |
| `AFN` | Afghan Afghani | fiat | 2 | 100 |
| `ALL` | Albanian Lek | fiat | 2 | 100 |
| `AMD` | Armenian Dram | fiat | 2 | 100 |
| `ANG` | Netherlands Antillean Guilder | fiat | 2 | 100 |
| `AOA` | Angolan Kwanza | fiat | 2 | 100 |
| `ARS` | Argentine Peso | fiat | 2 | 100 |
| `AUD` | Australian Dollar | fiat | 2 | 100 |
| `AWG` | Aruban Florin | fiat | 2 | 100 |
| `AZN` | Azerbaijani Manat | fiat | 2 | 100 |
| `BAM` | Bosnia-Herzegovina Convertible Mark | fiat | 2 | 100 |
| `BBD` | Barbadian Dollar | fiat | 2 | 100 |
| `BDT` | Bangladeshi Taka | fiat | 2 | 100 |
| `BGN` | Bulgarian Lev | fiat | 2 | 100 |
| `BHD` | Bahraini Dinar | fiat | 3 | 1000 |
| `BIF` | Burundian Franc | fiat | 2 | 100 |
| `BMD` | Bermudian Dollar | fiat | 2 | 100 |
| `BND` | Brunei Dollar | fiat | 2 | 100 |
| `BOB` | Bolivian Boliviano | fiat | 2 | 1000 |
| `BRL` | Brazilian Real | fiat | 2 | 100 |
| `BSD` | Bahamian Dollar | fiat | 2 | 100 |
| `BTN` | Bhutanese Ngultrum | fiat | 2 | 100 |
| `BWP` | Botswana Pula | fiat | 2 | 100 |
| `BYN` | Belarusian Ruble | fiat | 2 | 100 |
| `BZD` | Belize Dollar | fiat | 2 | 100 |
| `CAD` | Canadian Dollar | fiat | 2 | 100 |
| `CDF` | Congolese Franc | fiat | 2 | 100 |
| `CFA` | CFA Franc | fiat | 2 | 100 |
| `CHF` | Swiss Franc | fiat | 2 | 100 |
| `CLP` | Chilean Peso | fiat | 2 | 100 |
| `CNY` | Chinese Yuan | fiat | 2 | 100 |
| `COP` | Colombian Peso | fiat | 2 | 100 |
| `CRC` | Costa Rican Colón | fiat | 2 | 100 |
| `CUP` | Cuban Peso | fiat | 2 | 100 |
| `CVE` | Cape Verdean Escudo | fiat | 2 | 100 |
| `CZK` | Czech Koruna | fiat | 2 | 100 |
| `DJF` | Djiboutian Franc | fiat | 2 | 100 |
| `DKK` | Danish Krone | fiat | 2 | 100 |
| `DOP` | Dominican Peso | fiat | 2 | 100 |
| `DZD` | Algerian Dinar | fiat | 2 | 100 |
| `EGP` | Egyptian Pound | fiat | 2 | 100 |
| `ERN` | Eritrean Nakfa | fiat | 2 | 100 |
| `ETB` | Ethiopian Birr | fiat | 2 | 100 |
| `EUR` | Euro | fiat | 2 | 100 |
| `FJD` | Fijian Dollar | fiat | 2 | 100 |
| `FKP` | Falkland Islands Pound | fiat | 2 | 100 |
| `GBP` | British Pound | fiat | 2 | 100 |
| `GEL` | Georgian Lari | fiat | 2 | 100 |
| `GHS` | Ghanaian Cedi | fiat | 2 | 100 |
| `GIP` | Gibraltar Pound | fiat | 2 | 100 |
| `GMD` | Gambian Dalasi | fiat | 2 | 100 |
| `GNF` | Guinean Franc | fiat | 2 | 100 |
| `GTQ` | Guatemalan Quetzal | fiat | 2 | 100 |
| `GYD` | Guyanese Dollar | fiat | 2 | 100 |
| `HKD` | Hong Kong Dollar | fiat | 2 | 100 |
| `HNL` | Honduran Lempira | fiat | 2 | 100 |
| `HTG` | Haitian Gourde | fiat | 2 | 100 |
| `HUF` | Hungarian Forint | fiat | 2 | 100 |
| `IDR` | Indonesian Rupiah | fiat | 0 | 1 |
| `ILS` | Israeli New Shekel | fiat | 2 | 100 |
| `INR` | Indian Rupee | fiat | 2 | 100 |
| `IQD` | Iraqi Dinar | fiat | 0 | 1 |
| `IRR` | Iranian Rial | fiat | 0 | 1 |
| `ISK` | Icelandic Króna | fiat | 2 | 100 |
| `JMD` | Jamaican Dollar | fiat | 2 | 100 |
| `JOD` | Jordanian Dinar | fiat | 2 | 100 |
| `JPY` | Japanese Yen | fiat | 2 | 100 |
| `KES` | Kenyan Shilling | fiat | 2 | 100 |
| `KGS` | Kyrgyzstani Som | fiat | 2 | 100 |
| `KHR` | Cambodian Riel | fiat | 2 | 100 |
| `KMF` | Comorian Franc | fiat | 2 | 100 |
| `KPW` | North Korean Won | fiat | 2 | 100 |
| `KRW` | South Korean Won | fiat | 2 | 100 |
| `KWD` | Kuwaiti Dinar | fiat | 3 | 1000 |
| `KYD` | Cayman Islands Dollar | fiat | 2 | 100 |
| `KZT` | Kazakhstani Tenge | fiat | 2 | 100 |
| `LAK` | Lao Kip | fiat | 0 | 1 |
| `LBP` | Lebanese Pound | fiat | 0 | 1 |
| `LKR` | Sri Lankan Rupee | fiat | 2 | 100 |
| `LRD` | Liberian Dollar | fiat | 2 | 100 |
| `LSL` | Lesotho Loti | fiat | 2 | 100 |
| `LYD` | Libyan Dinar | fiat | 2 | 100 |
| `MAD` | Moroccan Dirham | fiat | 2 | 100 |
| `MDL` | Moldovan Leu | fiat | 2 | 100 |
| `MGA` | Malagasy Ariary | fiat | 2 | 100 |
| `MKD` | Macedonian Denar | fiat | 2 | 100 |
| `MMK` | Myanmar Kyat | fiat | 2 | 100 |
| `MNT` | Mongolian Tögrög | fiat | 2 | 100 |
| `MOP` | Macanese Pataca | fiat | 2 | 100 |
| `MRU` | Mauritanian Ouguiya | fiat | 2 | 100 |
| `MUR` | Mauritian Rupee | fiat | 2 | 100 |
| `MVR` | Maldivian Rufiyaa | fiat | 2 | 100 |
| `MWK` | Malawian Kwacha | fiat | 2 | 100 |
| `MXN` | Mexican Peso | fiat | 2 | 100 |
| `MYR` | Malaysian Ringgit | fiat | 2 | 100 |
| `MZN` | Mozambican Metical | fiat | 2 | 100 |
| `NAD` | Namibian Dollar | fiat | 2 | 100 |
| `NGN` | Nigerian Naira | fiat | 2 | 100 |
| `NIO` | Nicaraguan Córdoba | fiat | 2 | 100 |
| `NOK` | Norwegian Krone | fiat | 2 | 100 |
| `NPR` | Nepalese Rupee | fiat | 2 | 100 |
| `NZD` | New Zealand Dollar | fiat | 2 | 100 |
| `OMR` | Omani Rial | fiat | 3 | 1000 |
| `PAB` | Panamanian Balboa | fiat | 2 | 100 |
| `PEN` | Peruvian Sol | fiat | 2 | 100 |
| `PGK` | Papua New Guinean Kina | fiat | 2 | 100 |
| `PHP` | Philippine Peso | fiat | 2 | 100 |
| `PKR` | Pakistani Rupee | fiat | 2 | 100 |
| `PLN` | Polish Złoty | fiat | 2 | 100 |
| `PYG` | Paraguayan Guaraní | fiat | 2 | 100 |
| `QAR` | Qatari Riyal | fiat | 2 | 100 |
| `RON` | Romanian Leu | fiat | 2 | 100 |
| `RSD` | Serbian Dinar | fiat | 2 | 100 |
| `RUB` | Russian Ruble | fiat | 2 | 100 |
| `RWF` | Rwandan Franc | fiat | 2 | 100 |
| `SAR` | Saudi Riyal | fiat | 2 | 100 |
| `SBD` | Solomon Islands Dollar | fiat | 2 | 100 |
| `SCR` | Seychellois Rupee | fiat | 2 | 100 |
| `SDG` | Sudanese Pound | fiat | 2 | 100 |
| `SEK` | Swedish Krona | fiat | 2 | 100 |
| `SGD` | Singapore Dollar | fiat | 2 | 100 |
| `SHP` | Saint Helena Pound | fiat | 2 | 100 |
| `SLE` | Sierra Leonean Leone | fiat | 2 | 100 |
| `SOS` | Somali Shilling | fiat | 2 | 100 |
| `SRD` | Surinamese Dollar | fiat | 2 | 100 |
| `SSP` | South Sudanese Pound | fiat | 2 | 100 |
| `STN` | São Tomé and Príncipe Dobra | fiat | 2 | 100 |
| `SVC` | Salvadoran Colón | fiat | 2 | 100 |
| `SYP` | Syrian Pound | fiat | 2 | 100 |
| `SZL` | Swazi Lilangeni | fiat | 2 | 100 |
| `THB` | Thai Baht | fiat | 2 | 100 |
| `TJS` | Tajikistani Somoni | fiat | 2 | 100 |
| `TMT` | Turkmenistani Manat | fiat | 2 | 100 |
| `TND` | Tunisian Dinar | fiat | 2 | 100 |
| `TOP` | Tongan Paʻanga | fiat | 2 | 100 |
| `TRY` | Turkish Lira | fiat | 2 | 100 |
| `TTD` | Trinidad and Tobago Dollar | fiat | 2 | 100 |
| `TWD` | New Taiwan Dollar | fiat | 2 | 100 |
| `TZS` | Tanzanian Shilling | fiat | 2 | 100 |
| `UAH` | Ukrainian Hryvnia | fiat | 2 | 100 |
| `UGX` | Ugandan Shilling | fiat | 2 | 100 |
| `USD` | US Dollar | fiat | 2 | 100 |
| `UYU` | Uruguayan Peso | fiat | 2 | 100 |
| `UZS` | Uzbekistani Som | fiat | 0 | 1 |
| `VES` | Venezuelan Bolívar Soberano | fiat | 2 | 100 |
| `VND` | Vietnamese Dong | fiat | 0 | 1 |
| `VUV` | Vanuatu Vatu | fiat | 2 | 100 |
| `WST` | Samoan Tala | fiat | 2 | 100 |
| `XAF` | Central African CFA Franc | fiat | 2 | 100 |
| `XOF` | West African CFA Franc | fiat | 2 | 100 |
| `YER` | Yemeni Rial | fiat | 2 | 100 |
| `ZAR` | South African Rand | fiat | 2 | 100 |
| `ZMW` | Zambian Kwacha | fiat | 2 | 100 |
| `ZWG` | Zimbabwe Gold | fiat | 2 | 100 |
| `BCH` | Bitcoin Cash | crypto | 8 | 100000000 |
| `BNB` | BNB | crypto | 6 | 1000000000000000000 |
| `BTC` | Bitcoin | crypto | 8 | 100000000 |
| `DAI` | Dai | crypto | 6 | 1000000000000000000 |
| `DAS` | Dash (DAS) | crypto | 8 | 100000000 |
| `DMC` | DeLorean | crypto | 2 | 100 |
| `DOGE` | Dogecoin | crypto | 8 | 100000000 |
| `DSH` | Dash (DSH) | crypto | 8 | 100000000 |
| `ETC` | Ethereum Classic | crypto | 6 | 1000000000000000000 |
| `ETH` | Ethereum | crypto | 6 | 1000000000000000000 |
| `GC` | GCoin | crypto | 2 | 100 |
| `GRAM` | Gram (TON) | crypto | 2 | 100 |
| `LTC` | Litecoin | crypto | 8 | 100000000 |
| `mBTC` | Milli-Bitcoin | crypto | 8 | 100000 |
| `SC` | Siacoin | crypto | 2 | 100 |
| `SOL` | Solana | crypto | 6 | 1000000000 |
| `TRX` | TRON | crypto | 8 | 1000000 |
| `USDT` | Tether | crypto | 6 | 1000000 |
| `XMR` | Monero | crypto | 8 | 1000000000000 |
| `XRP` | XRP | crypto | 8 | 1000000 |
| `ZEC` | Zcash | crypto | 8 | 100000000 |

**12\. Language Code**

| Language Code | Language |
| --- | --- |
| `de` | German |
| `en` | English |
| `es` | Spanish |
| `fa` | Persian (Farsi) |
| `fr` | French |
| `hi` | Hindi |
| `hy` | Armenian |
| `id` | Indonesian |
| `ja` | Japanese |
| `ko` | Korean |
| `pl` | Polish |
| `pt` | Portuguese |
| `ru` | Russian |
| `tr` | Turkish |
| `vi` | Vietnamese |
| `zh` | Chinese |

Aliases accepted on launch: `pt-br` → `pt`, `zh-tw` → `zh`.

**End of Documentation**