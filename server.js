import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 64_000;
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Cache-Control': 'no-store'
};
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const allowedImageModels = new Set(['gpt-image-1.5','gpt-image-2','gpt-image-2.5-flare','gpt-image-2.5-sunburst','gpt-image-2.6-flare','gpt-image-2.6-sunburst']);

function send(res, status, value) {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }); }
}
function validate(payload) {
  const apiKey = String(payload.apiKey || '');
  if (!apiKey.startsWith('sk-') || apiKey.length > 300 || apiKey.length < 12) {
    throw Object.assign(new Error('Enter a valid OpenAI API key from your own account.'), { status: 400 });
  }
  return apiKey;
}
async function proxyOpenAi(req, res, pathname) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return send(res, 415, { error: 'Content-Type must be application/json.' });
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host;
    try { if (new URL(origin).host !== host) return send(res, 403, { error: 'Origin not allowed.' }); }
    catch { return send(res, 403, { error: 'Invalid origin.' }); }
  }
  const body = await readJson(req);
  const apiKey = validate(body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pathname === '/api/image' ? 115_000 : 35_000);
  try {
    if (pathname === '/api/image') {
      const prompt = String(body.prompt || '').trim();
      const model = String(body.model || 'gpt-image-1.5');
      if (prompt.length < 12 || prompt.length > 3000) return send(res, 400, { error: 'Prompt must be 12–3000 characters.' });
      if (!allowedImageModels.has(model)) return send(res, 400, { error: 'Unsupported image model selection.' });
      const upstream = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, size: '1024x1536', n: 1 })
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return send(res, upstream.status >= 500 ? 502 : upstream.status, { error: String(data?.error?.message || 'Image provider rejected the request.').slice(0, 400) });
      const b64 = data?.data?.[0]?.b64_json;
      if (typeof b64 !== 'string') return send(res, 502, { error: 'Provider returned no image data.' });
      return send(res, 200, { image: `data:image/png;base64,${b64}` });
    }
    const prompt = String(body.prompt || '').trim();
    if (prompt.length < 10 || prompt.length > 1500) return send(res, 400, { error: 'Caption request must be 10–1500 characters.' });
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 180, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return send(res, upstream.status >= 500 ? 502 : upstream.status, { error: String(data?.error?.message || 'Caption provider rejected the request.').slice(0, 400) });
    const caption = data?.choices?.[0]?.message?.content;
    if (typeof caption !== 'string') return send(res, 502, { error: 'Provider returned no caption.' });
    return send(res, 200, { caption });
  } catch (err) {
    return send(res, 502, { error: err?.name === 'AbortError' ? 'AI request timed out. Please retry.' : 'Could not reach the AI provider.' });
  } finally { clearTimeout(timeout); }
}
async function serveStatic(res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return send(res, 400, { error: 'Malformed URL.' }); }
  if (decoded.includes('\0')) return send(res, 400, { error: 'Invalid path.' });
  const relative = normalize(decoded === '/' ? '/index.html' : decoded).replace(/^([/\\])+/, '');
  const filePath = resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(root + sep)) return send(res, 403, { error: 'Forbidden.' });
  try {
    const buf = await readFile(filePath);
    res.writeHead(200, { ...securityHeaders, 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  } catch { send(res, 404, { error: 'Not found.' }); }
}
export const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true, service: 'PageForge AI', version: '1.0.0', mode: 'BYOK' });
    if (pathname.startsWith('/api/')) {
      if (req.method !== 'POST' || !['/api/image', '/api/caption'].includes(pathname)) return send(res, 404, { error: 'Route not found.' });
      return await proxyOpenAi(req, res, pathname);
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
    return await serveStatic(res, pathname);
  } catch (err) { send(res, Number(err?.status) || 500, { error: String(err?.message || 'Unexpected error.').slice(0, 200) }); }
});
if (process.env.NODE_ENV !== 'test') server.listen(PORT, HOST, () => console.log(`PageForge AI running at http://${HOST}:${PORT}`));
