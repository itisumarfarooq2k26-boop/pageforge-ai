# PageForge AI ✳

**The open-source, image-first content studio. Your content. Your API key. Your bill.**

PageForge AI is a local-first creative workspace for people who manage multiple content pages. Create separate brand profiles, write art-directed image prompts, generate images and captions with an **API key supplied by the person running the app**, plan content, and export assets.

> **Zero subscription charged by this repository.** OpenAI API requests may cost money and are charged to the person who provides the API key. The repository author does not supply keys or cover provider usage.

## Features

- **35 starter photo niches** including cars, nature, pets, fashion, food, travel, product photography, architecture and more.
- **Multi-brand page profiles** with category and visual-identity notes.
- **AI Image Studio:** prompt builder, style controls, one-click OpenAI image generation using your own key.
- **Captions:** optional OpenAI caption drafts using your own key.
- **1080 × 1350 PNG output:** center crop and resize to Facebook-friendly 4:5 images.
- **Manual import:** upload JPG, PNG or WebP images instead of using an API.
- **Content Library:** saved images, captions, search, download, delete.
- **Content Planner:** add planning dates (no automatic Facebook publishing).
- **ZIP export:** all saved images, captions and workspace metadata, with no third-party ZIP dependency.
- **Local-first storage:** page metadata in browser localStorage; image files in IndexedDB.
- **No API key persistence:** the user enters their API key in their browser tab; it is sent via their local Next-less Node HTTP server only when generating; the app never saves the key.
- **No npm dependencies:** plain JavaScript, HTML, CSS and Node's built-in HTTP server.

## Screens

1. **Overview** — stats and quick actions.
2. **My Pages** — brand and niche management.
3. **AI Image Studio** — prompts, image generation, upload and review.
4. **Content Library** — saved content and export.
5. **Content Planner** — organizational post reminders.
6. **API & Settings** — BYOK connection and workspace controls.

## Run locally — no paid service required

**Requirements:** Node.js 20+.

```bash
git clone https://github.com/YOUR-USERNAME/pageforge-ai.git
cd pageforge-ai
npm start
```

Open **http://127.0.0.1:3000**. `npm install` is not necessary because this project has no external runtime dependencies.

To run on another port:

```bash
PORT=4000 npm start
```

On Windows PowerShell:

```powershell
$env:PORT=4000
npm start
```

### Docker option

```bash
docker compose up --build
```

Open **http://127.0.0.1:3000**.

## Who pays for APIs?

This project uses the **Bring Your Own Key (BYOK)** model:

1. The person who downloads the code creates their own OpenAI API account/key.
2. They launch their own app instance and open **API & Settings**.
3. They enter the key in the browser to use it for **that tab session only**.
4. Image or caption requests go **browser → their own Node server → OpenAI**.
5. OpenAI charges **their** account based on their own usage and applicable pricing.

The repository does not contain API keys, free credits, or a central paid backend. Users may also upload images manually and use most of the workspace without a key.

**Provider:** OpenAI. Models listed in the UI may change; available models depend on the user's provider account. The default model is `gpt-image-1.5`. The server uses `POST /v1/images/generations` for images and `POST /v1/chat/completions` for captions. These requests were implemented against public API documentation but **not live-tested with a paid API key**.

## What is NOT included in version 1.0?

- Facebook OAuth and Facebook Page auto-posting.
- Facebook scheduled publishing or performance insights.
- Direct Muse AI integration (no verified Muse API adapter included).
- Team accounts, multi-tenant authentication, remote storage or a public SaaS backend.
- Running heavy image models on your own GPU.
- Guaranteed image ownership, copyright, commercial use rights or monetization.

**Planner records are only reminders**, not scheduled publications. Any social publishing must use official provider APIs and required permissions in a future version.

## Storage and security

- Profile and content metadata persist in browser `localStorage`.
- Generated/uploaded images persist in browser `IndexedDB`.
- API keys live only in JavaScript memory for the current tab and are **not persisted** in files, localStorage or IndexedDB.
- API keys are sent over HTTP to the same-origin app server and forwarded to the provider. **Only enter keys on a trusted instance.** For an internet-exposed deployment, use HTTPS and add authentication and abuse protection.
- The built-in server intentionally binds to `127.0.0.1` by default and has no accounts/user separation.
- Clearing site storage or switching browsers will remove saved content; export ZIP for backups.
- Do not upload sensitive or confidential user material without permission.
- `.gitignore` excludes environment files and other secrets; **always review a commit before pushing**.

## How to publish this on GitHub

If you received a ZIP:

1. Extract `pageforge-ai.zip`.
2. Create a new **public** GitHub repository named `pageforge-ai`.
3. Open a terminal inside the extracted folder and run:

```bash
git init
git add .
git commit -m "Initial release: PageForge AI BYOK content studio"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pageforge-ai.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. GitHub may ask you to authenticate.

## Development & tests

```bash
npm run check
npm run dev
```

The project currently includes dependency-free `node:test` tests for the niche catalog and prompt/caption builders, plus a GitHub Actions workflow. Real image generation requires an API key and must be tested separately by the adopter.

## Tech stack

- HTML5, modern CSS, JavaScript modules
- Node.js built-in HTTP server + `fetch`
- IndexedDB / localStorage
- OpenAI Images and Chat Completions API (user credentials only)
- MIT License

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Responsible use

Users should follow image model/provider terms, local laws, copyright and privacy laws, social-platform content policies, and disclosure requirements for synthetic media. Do not imply that fictional AI imagery depicts a real event.

## License

MIT — see [LICENSE](LICENSE).
