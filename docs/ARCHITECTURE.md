# Architecture — PageForge AI v1

```
 Browser (local-first)
 ├─ Page profiles & asset metadata ─── localStorage
 ├─ Generated/imported PNGs ────────── IndexedDB
 ├─ API key ─────────────────────────── tab memory only
 ├─ Content calendar ───────────────── localStorage
 ├─ 4:5 crop/resize ─────────────────── browser Canvas
 └─ ZIP export ──────────────────────── browser Blob
          │
          │ same-origin POST /api/image or /api/caption
          ▼
 Node.js HTTP server (server.js)
 ├─ Serves bundled HTML/CSS/JS
 ├─ Validates input, model and request size
 └─ Forwards API request with user's transient key
          │
          ▼
 OpenAI API (billed to the key owner's account)
```

The server has no database, no background scheduler, no Facebook API integration, and no built-in user accounts. The API key is not written to disk or emitted to application logs. Responses, which may contain base64 encoded images, are sent to the requesting browser. The user can save the image locally in IndexedDB and export it as a file/ZIP.

## Endpoints

- `GET /api/health` → service status, no credentials.
- `POST /api/image` → `{ apiKey, prompt, model }`; image generation through OpenAI.
- `POST /api/caption` → `{ apiKey, prompt }`; caption through OpenAI.

## Deployment boundary

This app is for **individual local/self-hosted users**. It intentionally has no multi-user authentication, quotas or rate-limiting, and is not suitable for exposing as a shared untrusted public API without adding those protections. Users must trust the machine/server to which they send their keys.

## Provider extensibility

To add providers, create server handlers with an explicit allowlist of upstream domains. Do **not** expose a user-defined fetch URL or proxy arbitrary endpoints. Ask the user to supply their own credentials; never ship maintainer tokens. Confirm provider license, CORS and API availability before claiming support.
