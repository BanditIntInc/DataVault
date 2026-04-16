# Security

## SSRF Protection (Server-Side Request Forgery)

The most critical security concern for a service that makes outbound HTTP requests on behalf of callers is SSRF — an attacker registering a definition with a URL pointing to an internal network address.

### What is blocked

All definition URLs (whether in `definitions.json` or via `POST /api/definitions`) are validated before registration.

**Blocked protocols:** anything other than `http`, `https`, `ws`, `wss`

**Blocked hostnames:**

| Range | Description |
|---|---|
| `localhost` | Loopback |
| `127.0.0.0/8` | Loopback subnet |
| `10.0.0.0/8` | Private network (RFC 1918) |
| `172.16.0.0/12` | Private network (RFC 1918) |
| `192.168.0.0/16` | Private network (RFC 1918) |
| `169.254.0.0/16` | Link-local / AWS EC2 metadata endpoint |
| `0.0.0.0` | Unspecified address |
| `::1` / `[::1]` | IPv6 loopback |
| `fc00::/7` | IPv6 unique local (ULA) |

```typescript
// Rejected:
{ "url": "http://169.254.169.254/latest/meta-data/" }  // AWS metadata
{ "url": "http://localhost:5432/query" }                // local DB
{ "url": "http://10.0.0.1/admin" }                     // internal service
{ "url": "file:///etc/passwd" }                         // file protocol

// Accepted:
{ "url": "https://api.example.com/data" }
{ "url": "wss://stream.example.com/feed" }
```

### Where validation runs

- `server/validateDefinition.ts` — `validateDefinition()` and `validateDefinitionUrl()`
- `server/config.ts` — every entry in `definitions.json` is validated at startup
- `server/HttpAdapter.ts` — `POST /api/definitions` validates before registering

---

## Request Timeouts

All outbound HTTP requests (REST and poll) have a hard 10-second timeout enforced via `AbortController`. A stalled upstream API cannot hold connections open indefinitely.

```typescript
const FETCH_TIMEOUT_MS = 10_000;
```

If the timeout fires, an `AbortError` is caught and rethrown as a descriptive `Error`:

```
Fetch timed out for key "weather" after 10000ms
```

---

## WebSocket Rate Limiting

Each connected WebSocket client is limited to **30 messages per second**. The limit resets on a 1-second sliding window per client.

```typescript
const RATE_LIMIT    = 30;        // messages per window
const RATE_WINDOW_MS = 1_000;   // window in ms
```

Clients that exceed the rate receive:
```json
{ "type": "error", "message": "Rate limit exceeded. Slow down." }
```

Rate limit state is stored per-socket in a `Map` and cleaned up when the socket closes.

---

## WebSocket Key Validation

Keys received from WebSocket clients are validated before any processing occurs.

| Rule | Value |
|---|---|
| Required | Must be a non-empty string |
| Max length | 128 characters |
| Allowed characters | `a-z A-Z 0-9 . - _ :` |

This prevents overly long strings, path traversal attempts, and injection into any key-based lookup.

---

## Error Message Sanitization

Raw error messages are never forwarded to WebSocket clients. The `sanitizeError()` function strips URL patterns and file path patterns before sending:

```typescript
err.message
  .replace(/https?:\/\/[^\s]*/g, '[url]')
  .replace(/wss?:\/\/[^\s]*/g, '[url]')
  .replace(/\/[a-zA-Z0-9/_\-.]+/g, '[path]')
```

This prevents internal URLs, service addresses, and file paths from leaking to external clients.

---

## Input Validation on Definition Registration

Beyond URL safety, `validateDefinition()` enforces:

| Field | Validation |
|---|---|
| `key` | Required, must be a string |
| `url` | Required, valid URL, safe host |
| `type` | Required, must be `rest`, `websocket`, or `poll` |
| `pollInterval` | If present, must be ≥ 1000ms |
| `cacheTTL` | If present, must be a non-negative number |

A `pollInterval` of `0` would create an effectively unbounded tight loop. The minimum of 1000ms is enforced both in the validator and in the `Fetcher` itself as a second line of defence.

---

## Recommendations for production

| Concern | Recommendation |
|---|---|
| Authentication | Add an Express middleware before `createHttpRouter()` to verify tokens |
| HTTPS/WSS | Terminate TLS in front of the server (nginx, cloud load balancer) |
| SSRF hardening | Supplement the built-in checks with an egress firewall if running in a VPC |
| Definition management | Avoid exposing `POST /api/definitions` publicly — gate it behind auth or remove it |
| Storage in browser | Prefer `indexeddb` or `memory` over `localStorage` for sensitive data |
| Secrets in definitions | Never put API keys in the URL string — put them in `headers` and ensure the definitions file is not publicly accessible |
