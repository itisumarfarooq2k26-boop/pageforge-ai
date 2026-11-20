import { CATEGORIES, IDEAS, makePrompt, makeCaptionRequest } from '/prompts.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const state = { pages: [], assets: [], key: '', previewBlob: null, previewUrl: '', screen: 'dashboard', modalAsset: null };
let toastTimer;
let databasePromise;
let imageUrls = [];

function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4200);
}
function loadData() {
  try { state.pages = JSON.parse(localStorage.getItem('pf_pages') || 'null') || []; } catch { state.pages = []; }
  try { state.assets = JSON.parse(localStorage.getItem('pf_assets') || 'null') || []; } catch { state.assets = []; }
  if (!localStorage.getItem('pf_initialized')) {
    state.pages = [
      { id: uid(), name: 'Midnight Motors', category: 'Luxury Cars', brand: 'Midnight blue, brushed silver, dramatic editorial photography', createdAt: new Date().toISOString() },
      { id: uid(), name: 'Nature Notes', category: 'Nature Photography', brand: 'Soft daylight, lush greens, authentic landscape detail', createdAt: new Date().toISOString() },
      { id: uid(), name: 'Tiny Paws Daily', category: 'Cute Cats', brand: 'Warm pastels, charming animals, soft photographic light', createdAt: new Date().toISOString() }
    ];
    localStorage.setItem('pf_initialized', '1');
    persist();
  }
}
function persist() {
  try {
    localStorage.setItem('pf_pages', JSON.stringify(state.pages));
    localStorage.setItem('pf_assets', JSON.stringify(state.assets));
  } catch { toast('Could not save metadata. Browser storage may be full.', true); }
}
function db() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('pageforge-images', 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return databasePromise;
}
async function dbAction(type, id, file) {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('files', type === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore('files');
    const request = type === 'get' ? st.get(id) : type === 'put' ? st.put(file, id) : st.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function pageById(id) { return state.pages.find(p => p.id === id); }
function assetById(id) { return state.assets.find(a => a.id === id); }
function switchScreen(name) {
  if (!['dashboard','pages','studio','library','planner','settings'].includes(name)) return;
  state.screen = name;
  $$('.screen').forEach(el => el.classList.toggle('current', el.dataset.panel === name));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.screen === name));
  const map = { dashboard: 'Overview', pages: 'My Pages', studio: 'AI Image Studio', library: 'Content Library', planner: 'Content Planner', settings: 'API & Settings' };
  $('#topCurrent').textContent = map[name];
  window.location.hash = name;
  if (name === 'library') renderLibrary();
  if (name === 'planner') renderPlanner();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function bindNavigation() {
  $$('[data-screen]').forEach(node => node.addEventListener('click', () => switchScreen(node.dataset.screen)));
  $$('[data-jump]').forEach(node => node.addEventListener('click', () => switchScreen(node.dataset.jump)));
  $('#brandHome').addEventListener('click', e => { e.preventDefault(); switchScreen('dashboard'); });
  $('#dashboardCreate').addEventListener('click', () => switchScreen('studio'));
  $('#heroLaunch').addEventListener('click', () => switchScreen('studio'));
  $('#seePages').addEventListener('click', () => switchScreen('pages'));
}
function pageGlyph(category) {
  if (/Cat|Dog|Animal|Wildlife|Bird/i.test(category)) return '♡';
  if (/Space|Robot|Tech|Cities/i.test(category)) return '✧';
  if (/Cars|Bikes|Watches|Luxury/i.test(category)) return '◇';
  if (/Food|Coffee|Cake/i.test(category)) return '◉';
  if (/Design|Home|Architecture/i.test(category)) return '▥';
  return '✿';
}
function refresh() {
  $('#statPages').textContent = state.pages.length;
  $('#statImages').textContent = state.assets.length;
  $('#statPlanned').textContent = state.assets.filter(a => !!a.scheduledFor).length;
  $('#navPageCount').textContent = state.pages.length;
  $('#apiIndicator').classList.toggle('connected', !!state.key);
  $('#apiIndicator').innerHTML = '<span class="status-dot"></span>' + (state.key ? 'API key in session' : 'API not connected');
  renderPageOptions();
  renderPages();
  if (state.screen === 'library') renderLibrary();
  if (state.screen === 'planner') renderPlanner();
}
function renderPageOptions() {
  const studio = $('#studioPage');
  const previous = studio.value;
  studio.innerHTML = state.pages.map(p => `<option value="${safe(p.id)}">${safe(p.name)} · ${safe(p.category)}</option>`).join('') || '<option value="">Create a page first</option>';
  if (state.pages.some(p => p.id === previous)) studio.value = previous;
  const filter = $('#libraryPageFilter');
  const prevFilter = filter.value;
  filter.innerHTML = '<option value="all">All pages</option>' + state.pages.map(p => `<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('');
  if (prevFilter === 'all' || state.pages.some(p => p.id === prevFilter)) filter.value = prevFilter;
}
function renderPages() {
  const cards = state.pages.map(page => {
    const count = state.assets.filter(asset => asset.pageId === page.id).length;
    return `<article class="page-card"><div class="page-card-top"><div class="page-avatar">${pageGlyph(page.category)}</div><span class="preview-tag">ACTIVE PROFILE</span></div><h3>${safe(page.name)}</h3><p>${safe(page.category)}</p><div class="page-card-bottom"><span>${count} saved image${count === 1 ? '' : 's'}</span><button data-use-page="${safe(page.id)}">Create content →</button></div></article>`;
  }).join('');
  $('#pagesGrid').innerHTML = cards || '<div class="empty-state"><h3>No page profiles yet</h3><p>Add a niche and visual identity to start creating content.</p><button class="primary-btn" id="emptyAdd">Add first page</button></div>';
  $('#dashboardPages').innerHTML = state.pages.slice(0, 4).map(page => `<div class="mini-page"><div class="mini-page-icon">${pageGlyph(page.category)}</div><div><strong>${safe(page.name)}</strong><small>${safe(page.category)}</small></div><span class="mini-tag">CREATIVE</span></div>`).join('') || '<p class="muted">Create your first page profile to get started.</p>';
  $$('[data-use-page]').forEach(btn => btn.addEventListener('click', () => { switchScreen('studio'); $('#studioPage').value = btn.dataset.usePage; }));
  if ($('#emptyAdd')) $('#emptyAdd').addEventListener('click', openPageModal);
}
function openPageModal() { $('#pageForm').reset(); $('#pageModal').showModal(); $('#pageName').focus(); }
function initPages() {
  $('#pageCategory').innerHTML = CATEGORIES.map(x => `<option>${safe(x)}</option>`).join('');
  ['#topAddPage','#newPageBtn'].forEach(id => $(id).addEventListener('click', openPageModal));
  ['#cancelPage','#closePageModal'].forEach(id => $(id).addEventListener('click', () => $('#pageModal').close()));
  $('#pageForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = $('#pageName').value.trim();
    if (!name) return;
    const entry = { id: uid(), name, category: $('#pageCategory').value, brand: $('#pageBrand').value.trim(), createdAt: new Date().toISOString() };
    state.pages.push(entry); persist(); refresh(); $('#pageModal').close(); toast('Page profile created.');
  });
}
function makeBriefPrompt() {
  const page = pageById($('#studioPage').value);
  const prompt = makePrompt({ category: page?.category, subject: $('#studioSubject').value, style: $('#studioStyle').value, brand: page?.brand, notes: $('#studioNotes').value });
  $('#studioPrompt').value = prompt;
}
function pickIdea() {
  const page = pageById($('#studioPage').value);
  const idea = IDEAS[Math.floor(Math.random() * IDEAS.length)];
  $('#studioSubject').value = `${idea} — theme: ${page?.category || 'visual art'}.`;
  makeBriefPrompt();
}
async function postApi(route, data) {
  const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, apiKey: state.key }) });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Invalid response from the server.'); }
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}
function preview(blob) {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewBlob = blob;
  state.previewUrl = URL.createObjectURL(blob);
  $('#imagePreview').classList.add('has-image');
  $('#imagePreview').innerHTML = '';
  const image = document.createElement('img');
  image.src = state.previewUrl;
  image.alt = 'Generated or uploaded image preview';
  $('#imagePreview').appendChild(image);
  $('#saveImage').disabled = false;
}
function setBusy(button, busy, text) { button.disabled = busy; if (text) button.textContent = text; }
async function generateImage() {
  if (!state.pages.length) return toast('Add a page profile first.', true);
  if (!state.key) { toast('Open API & Settings and enter your own OpenAI API key.', true); switchScreen('settings'); return; }
  if (!$('#studioPrompt').value.trim()) makeBriefPrompt();
  const btn = $('#generateImage');
  const label = $('#generateButtonText');
  btn.disabled = true; label.textContent = 'Generating image...';
  try {
    const response = await postApi('/api/image', { model: $('#imageModel').value, prompt: $('#studioPrompt').value });
    const imageBlob = await (await fetch(response.image)).blob();
    preview(imageBlob);
    toast('Image generated! Review before saving.');
  } catch (err) { toast(err.message, true); }
  finally { btn.disabled = false; label.textContent = 'Generate image with my API key'; }
}
async function generateCaption() {
  if (!state.key) { toast('Connect your OpenAI API key first.', true); return; }
  const page = pageById($('#studioPage').value);
  if (!page) return toast('Choose a page profile first.', true);
  const btn = $('#generateCaption');
  setBusy(btn, true, 'Writing...');
  try {
    const prompt = makeCaptionRequest({ page, subject: $('#studioSubject').value || page.category, tone: $('#studioTone').value });
    const data = await postApi('/api/caption', { prompt });
    $('#studioCaption').value = data.caption;
    toast('Caption drafted. Please review factual accuracy.');
  } catch (err) { toast(err.message, true); }
  finally { setBusy(btn, false, '✦ Write with AI'); }
}
function cropToFourFive(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      try {
        const w = image.naturalWidth, h = image.naturalHeight;
        if (!w || !h) throw new Error('Invalid image dimensions.');
        const ratio = 4 / 5;
        let sw = w, sh = h;
        if (w/h > ratio) sw = h * ratio; else sh = w / ratio;
        const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, (w-sw)/2, (h-sh)/2, sw, sh, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(output => output ? resolve(output) : reject(new Error('Could not export the image.')), 'image/png');
      } catch (err) { reject(err); }
      finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image.')); };
    image.src = url;
  });
}
async function savePreview() {
  if (!state.previewBlob) return;
  const page = pageById($('#studioPage').value);
  if (!page) return toast('Choose a page profile.', true);
  const btn = $('#saveImage'); setBusy(btn, true, 'Saving...');
  try {
    const blob = await cropToFourFive(state.previewBlob);
    const asset = { id: uid(), pageId: page.id, title: ($('#studioSubject').value || `${page.category} visual`).slice(0, 140), prompt: $('#studioPrompt').value.slice(0, 3000), caption: $('#studioCaption').value.slice(0, 1500), createdAt: new Date().toISOString(), scheduledFor: null, status: 'draft' };
    await dbAction('put', asset.id, blob);
    state.assets.unshift(asset); persist(); refresh(); toast('Image saved locally at 1080 × 1350 PNG.');
  } catch (err) { toast(err.message || 'Failed to save.', true); }
  finally { setBusy(btn, false, 'Save to library →'); }
}
function initStudio() {
  $('#randomIdea').addEventListener('click', pickIdea);
  $('#composePrompt').addEventListener('click', makeBriefPrompt);
  $('#generateImage').addEventListener('click', generateImage);
  $('#generateCaption').addEventListener('click', generateCaption);
  $('#saveImage').addEventListener('click', savePreview);
  $('#uploadButton').addEventListener('click', () => $('#uploadImage').click());
  $('#uploadImage').addEventListener('change', ev => {
    const blob = ev.target.files?.[0];
    if (!blob) return;
    if (!['image/png','image/jpeg','image/webp'].includes(blob.type) || blob.size > 15_000_000) return toast('Choose a JPG, PNG or WebP image smaller than 15MB.', true);
    preview(blob); toast('Image ready for review.'); ev.target.value = '';
  });
}
function resetImageUrls() { imageUrls.forEach(url => URL.revokeObjectURL(url)); imageUrls = []; }
function formatDate(value) { try { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return 'Unknown date'; } }
async function loadCardImage(id) {
  try {
    const blob = await dbAction('get', id);
    const card = document.getElementById('image-' + id);
    if (!blob || !card) return;
    const url = URL.createObjectURL(blob);
    imageUrls.push(url);
    const img = document.createElement('img'); img.src = url; img.alt = 'Saved image';
    card.innerHTML = ''; card.appendChild(img);
  } catch { /* IndexedDB may be unavailable */ }
}
function renderLibrary() {
  const query = $('#librarySearch').value.trim().toLowerCase();
  const pageFilter = $('#libraryPageFilter').value;
  const items = state.assets.filter(a => (pageFilter === 'all' || a.pageId === pageFilter) && `${a.title} ${a.caption} ${pageById(a.pageId)?.name || ''}`.toLowerCase().includes(query));
  resetImageUrls();
  $('#libraryGrid').innerHTML = items.map(a => `<article class="library-card"><div class="library-img" id="image-${safe(a.id)}">✳</div><div class="library-card-content"><h3>${safe(a.title)}</h3><p>${safe(pageById(a.pageId)?.name || 'Deleted page')} · ${formatDate(a.createdAt)}${a.scheduledFor ? ' · Planned' : ''}</p><div class="library-card-actions"><button data-download="${safe(a.id)}">↓ Image</button><button data-copy="${safe(a.id)}">Copy caption</button><button data-plan="${safe(a.id)}">▣ Plan</button><button class="danger" data-delete="${safe(a.id)}">Delete</button></div></div></article>`).join('') || '<div class="empty-state"><h3>No images in this view</h3><p>Create an image in Studio, or upload your own, then save it to the local library.</p><button class="primary-btn" id="emptyStudio">Open Image Studio</button></div>';
  items.forEach(a => loadCardImage(a.id));
  if ($('#emptyStudio')) $('#emptyStudio').addEventListener('click', () => switchScreen('studio'));
  $$('[data-download]').forEach(btn => btn.addEventListener('click', () => downloadAsset(btn.dataset.download)));
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', () => copyCaption(btn.dataset.copy)));
  $$('[data-plan]').forEach(btn => btn.addEventListener('click', () => openSchedule(btn.dataset.plan)));
  $$('[data-delete]').forEach(btn => btn.addEventListener('click', () => removeAsset(btn.dataset.delete)));
}
function safeFilename(value) { return String(value).normalize('NFKD').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'image'; }
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
async function downloadAsset(id) {
  const asset=assetById(id); if(!asset) return;
  const file=await dbAction('get',id); if(!file) return toast('Image file missing from local storage.',true);
  downloadBlob(file,`${safeFilename(asset.title)}-${id.slice(0,6)}.png`);
}
async function copyCaption(id) {
  const asset = assetById(id); if (!asset) return;
  try { await navigator.clipboard.writeText(asset.caption || ''); toast('Caption copied.'); }
  catch { toast('Clipboard is unavailable in this browser.', true); }
}
async function removeAsset(id) {
  const asset=assetById(id); if(!asset) return;
  if (!window.confirm(`Delete "${asset.title}" from this browser?`)) return;
  await dbAction('delete', id);
  state.assets=state.assets.filter(a=>a.id!==id); persist(); refresh(); toast('Image deleted.');
}
function openSchedule(id) {
  const asset = assetById(id); if(!asset) return;
  state.modalAsset=id;
  $('#scheduleDescription').textContent = asset.title;
  const date = asset.scheduledFor ? new Date(asset.scheduledFor) : new Date(Date.now()+24*3600_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('#scheduleDate').value = local;
  $('#scheduleModal').showModal();
}
function initSchedule() {
  ['#closeScheduleModal','#cancelSchedule'].forEach(id => $(id).addEventListener('click', () => $('#scheduleModal').close()));
  $('#scheduleForm').addEventListener('submit',ev => {
    ev.preventDefault();
    const asset=assetById(state.modalAsset);
    const d=new Date($('#scheduleDate').value);
    if (!asset || !Number.isFinite(d.getTime())) return;
    asset.scheduledFor=d.toISOString(); asset.status='planned';
    persist(); refresh(); $('#scheduleModal').close(); toast('Date saved to planner (not automatically published).');
  });
}
function renderPlanner() {
  const planned=state.assets.filter(a=>a.scheduledFor).sort((a,b)=>new Date(a.scheduledFor)-new Date(b.scheduledFor));
  $('#plannerItems').innerHTML=planned.map(a=>`<article class="plan-row"><div class="plan-date"><strong>${formatDate(a.scheduledFor)}</strong><small>${safe(new Date(a.scheduledFor).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</small></div><div class="plan-info"><strong>${safe(a.title)}</strong><small>${safe(pageById(a.pageId)?.name||'Deleted page')} • Planned only, not published</small></div><button data-unplan="${safe(a.id)}">Remove plan</button></article>`).join('')||'<div class="empty-state"><h3>No posts planned</h3><p>Save images in your library, then click Plan to add a target publication date.</p><button id="plannerStudio" class="primary-btn">Open Studio</button></div>';
  if ($('#plannerStudio')) $('#plannerStudio').addEventListener('click',()=>switchScreen('studio'));
  $$('[data-unplan]').forEach(btn=>btn.addEventListener('click',()=>{ const asset=assetById(btn.dataset.unplan); if (!asset) return; asset.scheduledFor=null; asset.status='draft'; persist(); refresh(); toast('Plan removed.'); }));
}
function setKey() {
  const value=$('#apiKey').value.trim();
  if (!value.startsWith('sk-') || value.length<12) return toast('Enter your own OpenAI API key (starts with sk-).',true);
  state.key=value; $('#apiKey').value=''; $('#keyFeedback').textContent='Key loaded for this browser tab only. API calls will be billed to the key owner.'; refresh(); toast('API key ready for this session.');
}
async function resetWorkspace() {
  if(!confirm('Permanently clear all locally saved page profiles, images and captions in this browser?')) return;
  state.pages=[];state.assets=[];state.key='';
  ['pf_pages','pf_assets','pf_initialized'].forEach(k=>localStorage.removeItem(k));
  try { const conn=await db(); conn.close(); databasePromise=null; await new Promise(resolve=>{const request=indexedDB.deleteDatabase('pageforge-images'); request.onsuccess=resolve;request.onerror=resolve;request.onblocked=resolve;}); } catch { /* ignore */ }
  state.pages=[];state.assets=[];
  $('#apiKey').value=''; refresh(); switchScreen('dashboard');toast('Local workspace cleared.');
}
function initSettings() {
  $('#connectKey').addEventListener('click',setKey);
  $('#apiKey').addEventListener('keydown',ev=>{if(ev.key==='Enter')setKey();});
  $('#clearKey').addEventListener('click',()=>{state.key='';$('#apiKey').value='';$('#keyFeedback').textContent='Key cleared.';refresh();toast('API key removed from memory.');});
  $('#toggleKey').addEventListener('click',()=>{$('#apiKey').type=$('#apiKey').type==='password'?'text':'password';});
  $('#resetWorkspace').addEventListener('click',resetWorkspace);
}
// A tiny, dependency-free ZIP writer (stored/uncompressed entries, CRC-32).
function crc32(bytes) { let crc=0xffffffff;for(const value of bytes){crc^=value;for(let k=0;k<8;k++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return (crc^0xffffffff)>>>0; }
function u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function join(parts) {const length=parts.reduce((s,p)=>s+p.length,0);const buf=new Uint8Array(length);let x=0;for(const part of parts){buf.set(part,x);x+=part.length;}return buf;}
function makeZip(files) {
  const encoder=new TextEncoder();const local=[];const central=[];let offset=0;
  for(const file of files){
    const name=encoder.encode(file.name);const data=file.bytes;const checksum=crc32(data);
    const l=join([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(checksum),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    const c=join([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(checksum),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    local.push(l);central.push(c);offset+=l.length;
  }
  const mergedCentral=join(central);
  const end=join([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(mergedCentral.length),u32(offset),u16(0)]);
  return new Blob([...local,mergedCentral,end],{type:'application/zip'});
}
async function exportZip() {
  if(!state.assets.length) return toast('Save at least one image before exporting.',true);
  const btn=$('#exportAll');setBusy(btn,true,'Preparing ZIP...');
  try {
    const encoder=new TextEncoder();
    const files=[{name:'pageforge-export.json',bytes:encoder.encode(JSON.stringify({version:1,pages:state.pages,assets:state.assets},null,2))}];
    for(const asset of state.assets){
      const blob=await dbAction('get',asset.id);
      if(!blob)continue;
      const bytes=new Uint8Array(await blob.arrayBuffer());
      files.push({name:`images/${safeFilename(pageById(asset.pageId)?.name||'page')}/${safeFilename(asset.title)}-${asset.id.slice(0,8)}.png`,bytes});
      files.push({name:`captions/${safeFilename(asset.title)}-${asset.id.slice(0,8)}.txt`,bytes:encoder.encode(asset.caption||'')});
    }
    downloadBlob(makeZip(files),`pageforge-export-${new Date().toISOString().slice(0,10)}.zip`);
    toast('ZIP ready — images, captions and metadata exported.');
  } catch(err){toast(`Could not export: ${err.message}`,true);}
  finally {setBusy(btn,false,'↓ Export ZIP');}
}
function initLibrary() {
  $('#librarySearch').addEventListener('input',renderLibrary);
  $('#libraryPageFilter').addEventListener('change',renderLibrary);
  $('#exportAll').addEventListener('click',exportZip);
}
function init() {
  loadData();bindNavigation();initPages();initStudio();initLibrary();initSchedule();initSettings();
  refresh();switchScreen(location.hash.replace('#','')||'dashboard');
}
init();
