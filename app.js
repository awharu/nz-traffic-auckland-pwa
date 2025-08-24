// Use a CORS-safe proxy so it works on GitHub Pages
const ENDPOINT = 'https://cors.isomorphic-git.org/https://trafficnz.info/service/traffic/rest/4/cameras/all';

const AUCKLAND_BOUNDS = { minLat: -37.55, maxLat: -36.2, minLon: 174.0, maxLon: 175.8 };

const $q = document.getElementById('q');
const $grid = document.getElementById('grid');
const $status = document.getElementById('status');
const $refreshAll = document.getElementById('refreshAll');
const $motorway = document.getElementById('motorwayFilter');
const $showFavs = document.getElementById('showFavs');

let allCams = [];
let favourites = new Set(JSON.parse(localStorage.getItem('favourites')||'[]'));
let showFavouritesOnly = JSON.parse(localStorage.getItem('showFavs')||'false');

function setStatus(msg){ $status.textContent = msg || ''; }

function insideAuckland(cam){
  const r = (cam.region||cam.regionName||'').toLowerCase();
  if (r.includes('auckland')) return true;
  const lat = Number(cam.lat ?? cam.latitude ?? cam.position?.lat ?? cam.y ?? NaN);
  const lon = Number(cam.lon ?? cam.lng ?? cam.longitude ?? cam.position?.lng ?? cam.x ?? NaN);
  if (Number.isFinite(lat) && Number.isFinite(lon)){
    return lat>=AUCKLAND_BOUNDS.minLat && lat<=AUCKLAND_BOUNDS.maxLat && lon>=AUCKLAND_BOUNDS.minLon && lon<=AUCKLAND_BOUNDS.maxLon;
  }
  return false;
}

function motorwayOf(name=''){
  const m = String(name).match(/\b(SH\s?\d{1,2}[A-B]?)\b/i);
  return m ? m[1].replace(/\s+/g,'').toUpperCase() : '';
}

function norm(cam){
  const id = cam.id ?? cam.cameraId ?? cam.camera_id ?? cam.siteId ?? crypto.randomUUID();
  const name = cam.name ?? cam.displayName ?? cam.description ?? cam.location ?? `Camera ${id}`;
  const region = cam.region ?? cam.regionName ?? cam.territorialAuthority ?? '';
  const lat = cam.lat ?? cam.latitude ?? cam.position?.lat ?? cam.y;
  const lon = cam.lon ?? cam.lng ?? cam.longitude ?? cam.position?.lng ?? cam.x;
  const url = cam.imageUrl ?? cam.imageURI ?? cam.imageUri ?? cam.url ?? cam.image ?? cam.image_url;
  const mw = motorwayOf(name);
  return { id, name, region, lat, lon, url, mw };
}

async function fetchCameras(){
  setStatus('Loading cameras…');
  try{
    const r = await fetch(ENDPOINT, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.cameras||data.items||data.results||[]);
    if (!Array.isArray(list) || list.length===0) throw new Error('Unexpected API shape — no cameras array');
    const mapped = list.map(norm).filter(c=>c.url);
    allCams = mapped.filter(insideAuckland).sort((a,b)=>a.name.localeCompare(b.name));
    buildMotorwayOptions(allCams);
    syncFavToggleUI();
    render();
    setStatus(`${allCams.length} cameras · Auckland`);
  } catch(e){
    console.error(e);
    setStatus('Could not load cameras. Try again later.');
  }
}

function buildMotorwayOptions(list){
  const uniq = new Set(['']);
  for (const c of list) if (c.mw) uniq.add(c.mw);
  $motorway.innerHTML = [...uniq].sort((a,b)=>{
    if (a==='' && b!=='') return -1; if (b==='' && a!=='') return 1;
    return a.localeCompare(b, undefined, {numeric:true});
  }).map(v => v==='' ? '<option value="">All Motorways</option>' : `<option value="${v}">${v}</option>`).join('');
  $motorway.value = localStorage.getItem('mwFilter') || '';
}

function render(){
  const q = ($q.value||'').toLowerCase();
  const motorway = $motorway.value;
  let cams = allCams.filter(c => c.name.toLowerCase().includes(q));
  if (motorway) cams = cams.filter(c => c.mw === motorway);
  if (showFavouritesOnly) cams = cams.filter(c => favourites.has(c.id));

  $grid.innerHTML = '';
  for (const c of cams){
    const tpl = document.getElementById('card-tpl');
    const node = tpl.content.firstElementChild.cloneNode(true);
    const img = node.querySelector('img');
    const name = node.querySelector('.name');
    const sub = node.querySelector('.sub');
    const map = node.querySelector('.open-map');
    const fav = node.querySelector('.fav');
    name.textContent = c.name;
    sub.textContent = (c.region || 'Auckland') + (c.mw ? ` · ${c.mw}` : '');
    const src = (c.url||'').replace(/(?<=\.(jpg|jpeg|png))(\?.*)?$/i, '') + `?t=${Date.now()%1e7}`;
    img.src = src;
    img.alt = `Traffic camera — ${c.name}`;
    map.href = `https://maps.google.com/?q=${c.lat},${c.lon}`;
    node.querySelector('.refresh').addEventListener('click', ()=>{ img.src = (c.url||'') + `?t=${Date.now()}`; });
    fav.classList.toggle('active', favourites.has(c.id));
    fav.addEventListener('click', ()=>{
      if (favourites.has(c.id)) favourites.delete(c.id); else favourites.add(c.id);
      localStorage.setItem('favourites', JSON.stringify([...favourites]));
      fav.classList.toggle('active');
    });
    $grid.appendChild(node);
  }
}

function syncFavToggleUI(){
  $showFavs.classList.toggle('active', showFavouritesOnly);
  $showFavs.title = showFavouritesOnly ? 'Showing favourites — tap to show all' : 'Show favourites';
}

$q.addEventListener('input', render);
$motorway.addEventListener('change', ()=>{ localStorage.setItem('mwFilter', $motorway.value); render(); });
$refreshAll.addEventListener('click', ()=>{
  for (const img of document.querySelectorAll('.card img')){
    const base = img.src.split('?')[0];
    img.src = base + `?t=${Date.now()}`;
  }
});
$showFavs.addEventListener('click', ()=>{
  showFavouritesOnly = !showFavouritesOnly;
  localStorage.setItem('showFavs', JSON.stringify(showFavouritesOnly));
  syncFavToggleUI();
  render();
});

fetchCameras();
