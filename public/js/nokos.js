const PAGE_SIZE = 24;
const SERVICE_ICONS = {
  wa: { icon: 'fa-brands fa-whatsapp', color: '#25D366' },
  tg: { icon: 'fa-brands fa-telegram', color: '#26A5E4' },
  oi: { icon: 'fa-solid fa-fire', color: '#FF6B6B' },
  go: { icon: 'fa-solid fa-motorcycle', color: '#00AA13' },
  gr: { icon: 'fa-solid fa-car', color: '#00B14F' },
  fb: { icon: 'fa-brands fa-facebook', color: '#1877F2' },
  ig: { icon: 'fa-brands fa-instagram', color: '#E4405F' },
  shop: { icon: 'fa-solid fa-bag-shopping', color: '#EE4D2D' },
  tokped: { icon: 'fa-solid fa-store', color: '#42B549' },
  dc: { icon: 'fa-brands fa-discord', color: '#5865F2' },
  tw: { icon: 'fa-brands fa-twitter', color: '#1DA1F2' },
  ln: { icon: 'fa-brands fa-linkedin', color: '#0A66C2' },
};
const DEFAULT_ICON = { icon: 'fa-solid fa-mobile-screen-button', color: '#64748b' };
const CATEGORIES = [
  { key: 'all', label: 'Semua' },
  { key: 'populer', label: 'Populer' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'sosmed', label: 'Sosmed' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'otolain', label: 'Lainnya' },
];
const OPERATORS_BY_COUNTRY = {
  ID: ['telkomsel', 'indosat', 'xl', 'tri', 'smartfren', 'axis'],
  MY: ['maxis', 'celcom', 'digi', 'umobile'],
  SG: ['singtel', 'starhub', 'm1'],
  TH: ['ais', 'dtac', 'true'],
  PH: ['globe', 'smart', 'sun'],
  VN: ['viettel', 'mobifone', 'vinaphone'],
  IN: ['airtel', 'jio', 'vi'],
  CN: ['china mobile', 'china unicom', 'china telecom'],
  US: ['t-mobile', 'att', 'verizon'],
  GB: ['vodafone', 'o2', 'ee', 'three'],
  default: ['any'],
};

let services = [], prices = {}, activeActivations = [], selectedService = null;
let currentCategory = 'all', currentPage = 1, filteredServices = [];
let countries = [], currentCountry = null;
let depositCheckTimer = null, activationTimers = {}, googleAuth = null;
let currentOtpActivation = null, otpPollTimer = null, otpCountdownTimer = null;

function getServiceIcon(svc) {
  const code = (svc.code || svc.id || '').toLowerCase();
  for (const [k, v] of Object.entries(SERVICE_ICONS)) { if (code.includes(k)) return v; }
  const n = (svc.name || '').toLowerCase();
  if (n.includes('whatsapp')) return SERVICE_ICONS.wa;
  if (n.includes('telegram')) return SERVICE_ICONS.tg;
  if (n.includes('google') || n.includes('gmail') || n.includes('youtube')) return { icon: 'fa-brands fa-google', color: '#4285F4' };
  return DEFAULT_ICON;
}
function getCategoryForService(svc) {
  const n = (svc.name || '').toLowerCase(), c = (svc.code || svc.id || '').toLowerCase();
  if (n.includes('whatsapp') || c === 'wa') return 'whatsapp';
  if (n.includes('telegram') || c === 'tg') return 'telegram';
  if (n.includes('facebook') || c === 'fb' || n.includes('instagram') || c === 'ig' || n.includes('tiktok') || n.includes('twitter') || n.includes('threads')) return 'sosmed';
  if (n.includes('shopee') || c.includes('shop') || n.includes('tokopedia') || n.includes('lazada') || n.includes('bukalapak')) return 'ecommerce';
  return 'otolain';
}
function getWebUser() { try { const r = localStorage.getItem('rullzye_web_user'); return r ? JSON.parse(r) : null; } catch { return null; } }
function getRandomId() { const u = getWebUser(); return u && u.randomId ? u.randomId : null; }
async function api(url, opts = {}) {
  try { const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts }); return await r.json(); } catch { return {}; }
}
function qs(id) { return document.getElementById(id); }
function show(id) { const e = qs(id); if (e) e.classList.remove('hidden'); }
function hide(id) { const e = qs(id); if (e) e.classList.add('hidden'); }

function switchPage(page) {
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
  const el = qs('page-' + page);
  if (el) el.classList.add('active');
}

async function loadCountries() {
  const data = await api('/api/nokos/countries');
  countries = data.success && data.countries ? data.countries : [];
  if (!countries.length) return;
  const bar = qs('country-bar');
  bar.innerHTML = countries.map(c =>
    `<button class="country-chip" data-id="${c.id}" onclick="selectCountry(${c.id}, this)">
      <span class="flag">${c.flag || ''}</span> ${c.name}
    </button>`
  ).join('');
  selectCountry(countries[0].id, bar.firstChild);
}

async function selectCountry(id, btn) {
  if (btn) {
    document.querySelectorAll('.country-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  currentCountry = countries.find(c => c.id == id) || countries[0];
  currentPage = 1;
  qs('services-grid').innerHTML = renderSkeletons(8);
  await loadPrices();
  applyFilter();
  if (qs('order-modal').style.display === 'flex') updateOrderModalCountry();
}

async function loadServices() {
  qs('services-grid').innerHTML = renderSkeletons(8);
  const data = await api('/api/nokos/services', { method: 'POST', body: JSON.stringify({}) });
  services = data.success && data.services ? data.services : [];
  renderCategories();
  await loadCountries();
}
async function loadPrices() {
  if (!currentCountry) return;
  const data = await api('/api/nokos/prices', { method: 'POST', body: JSON.stringify({ country: currentCountry.id }) });
  if (data.success && data.prices) prices = data.prices;
}

function getPrice(code) {
  const c = (code || '').toLowerCase();
  const p = prices[c];
  if (p && typeof p === 'number') return p;
  const s = services.find(x => (x.code||'').toLowerCase() === c || (x.id||'').toLowerCase() === c);
  return s && s.price ? s.price : 0;
}

function renderCategories() {
  const c = qs('category-tabs');
  c.innerHTML = CATEGORIES.map(x =>
    `<button class="category-chip ${x.key === 'all' ? 'active' : ''}" data-cat="${x.key}" onclick="setCategory('${x.key}',this)">${x.label}</button>`
  ).join('');
}
function setCategory(cat, btn) {
  currentCategory = cat; currentPage = 1;
  document.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyFilter();
}
function applyFilter() {
  const q = (qs('search-service').value || '').toLowerCase();
  filteredServices = services.filter(s => {
    if (currentCategory !== 'all' && currentCategory === 'populer' && !s.popular) return false;
    if (currentCategory !== 'all' && currentCategory !== 'populer' && getCategoryForService(s) !== currentCategory) return false;
    return !q || s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  renderServices();
  renderPagination();
  updateCountryLabel();
}
function renderServices() {
  const grid = qs('services-grid'), info = qs('service-count');
  const start = (currentPage - 1) * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, filteredServices.length);
  const page = filteredServices.slice(start, end);
  if (info) info.textContent = filteredServices.length ? `Menampilkan ${start+1}-${end} dari ${filteredServices.length} layanan` : '';
  if (!page.length) {
    grid.innerHTML = `<div class="col-span-full text-center py-16"><i class="fa-solid fa-search text-4xl text-slate-600 mb-4"></i><p class="text-sm text-slate-500">Tidak ada layanan ditemukan</p></div>`;
    return;
  }
  grid.innerHTML = page.map(s => {
    const ic = getServiceIcon(s), price = getPrice(s.code || s.id);
    if (!price) return '';
    return `<div class="card-nokos p-3 sm:p-4 group cursor-pointer" onclick="openOrderModal('${s.id || s.code}')" style="animation:fadeUp .35s ease both;animation-delay:${(page.indexOf(s)%6)*0.06}s">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 group-hover:scale-110 transition-transform" style="background:${ic.color}20;color:${ic.color}"><i class="${ic.icon}"></i></div>
        <div class="min-w-0 flex-1"><p class="font-bold text-white text-sm truncate">${s.name}</p><p class="text-[10px] text-slate-500 mt-0.5">${(s.code||'').toUpperCase()}</p></div>
      </div>
      <div class="flex items-center justify-between bg-white/[0.03] rounded-xl p-2.5">
        <span class="text-sm font-black text-violet-400">Rp ${Number(price).toLocaleString('id-ID')}</span>
        <span class="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-3 py-1 rounded-full group-hover:bg-violet-500/30 transition">Pilih <i class="fa-solid fa-arrow-right ml-1 text-[9px]"></i></span>
      </div>
    </div>`;
  }).filter(Boolean).join('');
}
function renderPagination() {
  const total = Math.ceil(filteredServices.length / PAGE_SIZE) || 1;
  const el = qs('pagination');
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage<=1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>`;
  const range = 2; let s = Math.max(1, currentPage - range), e = Math.min(total, currentPage + range);
  if (s > 1) { html += `<button class="page-btn" onclick="goPage(1)">1</button>`; if (s > 2) html += `<span class="page-dots">...</span>`; }
  for (let i = s; i <= e; i++) html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  if (e < total) { if (e < total - 1) html += `<span class="page-dots">...</span>`; html += `<button class="page-btn" onclick="goPage(${total})">${total}</button>`; }
  html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage>=total?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button>`;
  el.innerHTML = html;
}
function goPage(p) { currentPage = p; renderServices(); renderPagination(); qs('services-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function renderSkeletons(n) {
  return Array.from({length:n}, (_,i) => `<div class="card-nokos p-4" style="animation:fadeUp .35s ease both;animation-delay:${i*0.05}s"><div class="flex items-center gap-3 mb-3"><div class="w-11 h-11 rounded-xl bg-white/5 skeleton-pulse"></div><div class="flex-1"><div class="h-4 w-28 bg-white/5 rounded skeleton-pulse mb-2"></div><div class="h-3 w-16 bg-white/5 rounded skeleton-pulse"></div></div></div><div class="h-10 bg-white/5 rounded-xl skeleton-pulse"></div></div>`
  ).join('');
}
function updateCountryLabel() {
  const el = qs('country-label');
  if (currentCountry) el.textContent = `${currentCountry.flag || ''} ${currentCountry.name}`;
  else el.textContent = '';
}
function clearSearch() {
  const inp = qs('search-service');
  inp.value = ''; inp.dispatchEvent(new Event('input'));
}

function updateOrderModalCountry() {
  const d = qs('modal-country-display');
  if (currentCountry) {
    d.value = `${currentCountry.flag || ''} ${currentCountry.name}`;
    const fc = qs('modal-country-flag');
    if (fc) fc.textContent = currentCountry.flag || '';
  }
  const ccode = currentCountry ? currentCountry.code : 'ID';
  const ops = OPERATORS_BY_COUNTRY[ccode] || OPERATORS_BY_COUNTRY['default'];
  const sel = qs('modal-operator');
  sel.innerHTML = ops.map(o => `<option value="${o}">${o === 'any' ? 'Any — Semua Operator' : o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('');
}

async function openOrderModal(serviceId) {
  const s = services.find(x => x.id === serviceId || x.code === serviceId);
  if (!s) return; selectedService = s;
  const ic = getServiceIcon(s), price = getPrice(s.code || s.id);
  if (!price) { Swal.fire({icon:'error',title:'Harga Tidak Tersedia',text:'Layanan ini tidak tersedia untuk negara yang dipilih.'}); return; }
  qs('modal-service-icon').innerHTML = `<i class="${ic.icon}" style="color:${ic.color};font-size:1.2rem"></i>`;
  qs('modal-service-name').textContent = s.name;
  qs('modal-service-code').textContent = (s.code||'').toUpperCase();
  qs('modal-service-price').textContent = `Rp ${Number(price).toLocaleString('id-ID')}`;
  updateOrderModalCountry();
  qs('order-modal').style.display = 'flex';
}
function closeOrderModal() { qs('order-modal').style.display = 'none'; selectedService = null; }

async function orderNumber() {
  const randomId = getRandomId();
  if (!randomId) { Swal.fire({icon:'warning',title:'Belum Login',text:'Login dulu dengan Google'}); return; }
  const country = currentCountry ? currentCountry.id : 6;
  const operator = qs('modal-operator').value;
  const server = qs('modal-server').value;
  const price = getPrice(selectedService.code || selectedService.id);
  if (!price) { Swal.fire({icon:'error',title:'Harga Tidak Valid'}); return; }

  const btn = qs('btn-order-number'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  try {
    const check = await api('/api/nokos/availability', { method:'POST', body:JSON.stringify({ service: selectedService.code||selectedService.id, country, operator }) });
    if (!check.success || check.stock <= 0) {
      Swal.fire({icon:'error',title:'Stok Habis',text:'Nomor untuk layanan ini sedang tidak tersedia.'});
      btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-cart-plus"></i> Beli Nomor';
      return;
    }
    const data = await api('/api/nokos/get-number', { method:'POST', body:JSON.stringify({ randomId, service: selectedService.code||selectedService.id, country, operator, server }) });
    if (data.success && data.phone) {
      closeOrderModal();
      showOtpPage(data);
      loadActiveActivations();
      updateSaldo();
    } else {
      Swal.fire({icon:'error',title:'Gagal',text:data.message||'Saldo tidak cukup atau layanan error'});
    }
  } catch { Swal.fire({icon:'error',title:'Koneksi Error',text:'Gagal terhubung ke server.'}); }
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-cart-plus"></i> Beli Nomor';
}

// ===== OTP RECEPTION PAGE =====
function showOtpPage(data) {
  currentOtpActivation = data;
  switchPage('otp');
  const s = selectedService;
  const ic = s ? getServiceIcon(s) : DEFAULT_ICON;
  qs('otp-service-icon').innerHTML = `<i class="${ic.icon}" style="color:${ic.color}"></i>`;
  qs('otp-service-name').textContent = s ? s.name : 'Layanan';
  qs('otp-phone-number').textContent = data.phone;
  qs('otp-code-display').innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menunggu OTP...';
  if (currentCountry) {
    qs('otp-country-flag').textContent = `${currentCountry.flag || ''} ${currentCountry.name}`;
  }
  const timerEl = qs('otp-timer');
  timerEl.textContent = '10:00';
  let remaining = 600;
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  otpCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) { timerEl.textContent = '00:00'; timerEl.className = 'timer-expired'; clearInterval(otpCountdownTimer); }
    else timerEl.textContent = formatTimer(remaining);
  }, 1000);
  if (otpPollTimer) clearInterval(otpPollTimer);
  otpPollTimer = setInterval(pollOtp, 5000);
}
function backToBrowse() {
  if (otpPollTimer) clearInterval(otpPollTimer);
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  currentOtpActivation = null;
  switchPage('menu');
}
async function pollOtp() {
  const rid = getRandomId();
  if (!rid || !currentOtpActivation) return;
  const aid = currentOtpActivation.activationId;
  if (!aid) return;
  const data = await api('/api/nokos/status', { method:'POST', body:JSON.stringify({ randomId: rid, activationId: aid }) });
  if (data.success && data.otp) {
    const el = qs('otp-code-display');
    el.innerHTML = `<span class="text-xl font-black text-emerald-400 cursor-pointer otp-blurred" onclick="this.classList.toggle('revealed');this.classList.toggle('otp-blurred')">${data.otp}</span>`;
    clearInterval(otpPollTimer);
  }
}
function copyOtpNumber() {
  const num = qs('otp-phone-number').textContent;
  if (!num) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(num).then(() => Swal.fire({icon:'success',title:'Tersalin!',text:'Nomor berhasil disalin',timer:1200,showConfirmButton:false}));
  }
}
async function finishCurrentOtp() {
  const rid = getRandomId(); if (!rid || !currentOtpActivation) return;
  await api('/api/nokos/set-status', { method:'POST', body:JSON.stringify({ randomId: rid, activationId: currentOtpActivation.activationId, status:'done' }) });
  Swal.fire({icon:'success',title:'Selesai',text:'Status aktivasi diperbarui.',timer:1500,showConfirmButton:false});
  backToBrowse();
  loadActiveActivations(); loadHistory();
}
async function cancelCurrentOtp() {
  const c = await Swal.fire({title:'Batalkan?',text:'Aktivasi nomor ini akan dibatalkan.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#64748b',confirmButtonText:'Ya, Batalkan'});
  if (!c.isConfirmed) return;
  const rid = getRandomId(); if (!rid || !currentOtpActivation) return;
  await api('/api/nokos/set-status', { method:'POST', body:JSON.stringify({ randomId: rid, activationId: currentOtpActivation.activationId, status:'cancelled' }) });
  Swal.fire({icon:'success',title:'Dibatalkan',timer:1500,showConfirmButton:false});
  backToBrowse();
  loadActiveActivations(); loadHistory();
}

async function loadActiveActivations() {
  const rid = getRandomId(); if (!rid) return;
  const data = await api(`/api/nokos/history?randomId=${rid}`);
  if (data.success && data.activations) {
    activeActivations = data.activations.filter(a => a.status === 'active' || a.status === 'STATUS_WAIT_CODE' || a.status === 'pending');
    renderActiveActivations();
  }
}
function renderActiveActivations() {
  const section = qs('active-activations-section'), container = qs('active-activations'), count = qs('active-count');
  if (!activeActivations.length) { hide('active-activations-section'); return; }
  show('active-activations-section'); count.textContent = `${activeActivations.length} aktif`;
  container.innerHTML = activeActivations.map(a => {
    const svc = services.find(s => s.code === a.service || s.id === a.service);
    const ic = svc ? getServiceIcon(svc) : DEFAULT_ICON;
    const otp = a.otp || a.otpCode || '';
    const id = a.activationId || a.id || a._id;
    return `<div class="card-nokos p-4" data-id="${id}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background:${ic.color}20;color:${ic.color}"><i class="${ic.icon}"></i></div><span class="text-xs font-bold text-white">${svc?svc.name:(a.service||'').toUpperCase()}</span></div>
        <span class="status-badge active"><span class="live-dot"></span> Aktif</span>
      </div>
      <div class="bg-white/5 rounded-xl p-3 mb-3">
        <div class="flex items-center justify-between"><div><p class="text-[10px] text-slate-500">Nomor</p><p class="text-sm font-bold text-white font-mono">${a.phoneNumber||a.phone||'-'}</p></div></div>
      </div>
      <div class="bg-white/5 rounded-xl p-3 mb-3">
        <div class="flex items-center justify-between"><p class="text-[10px] text-slate-500">Kode OTP ${otp?'<span class="text-[9px] text-amber-400 ml-1">klik untuk lihat</span>':''}</p>${otp?`<span class="text-xs font-bold text-emerald-400 cursor-pointer otp-blurred" id="otp-${id}" onclick="this.classList.toggle('revealed');this.classList.toggle('otp-blurred')">${otp}</span>`:`<span class="text-[10px] text-slate-500">Menunggu OTP... <i class="fa-solid fa-spinner fa-spin ml-1"></i></span>`}</div>
      </div>
      <div class="flex gap-2"><button onclick="finishActivation('${id}')" class="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition"><i class="fa-solid fa-check"></i> Selesai</button><button onclick="cancelActivation('${id}')" class="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition"><i class="fa-solid fa-xmark"></i> Batal</button></div>
    </div>`;
  }).join('');
}
function formatTimer(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

async function finishActivation(id) {
  const rid = getRandomId(); if(!rid)return;
  await api('/api/nokos/set-status',{method:'POST',body:JSON.stringify({randomId:rid,activationId:id,status:'done'})});
  Swal.fire({icon:'success',title:'Selesai',text:'Status diperbarui.',timer:1200,showConfirmButton:false});
  loadActiveActivations();loadHistory();
}
async function cancelActivation(id) {
  const rid=getRandomId();if(!rid)return;
  const c=await Swal.fire({title:'Batalkan?',text:'Aktivasi nomor ini akan dibatalkan.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#64748b',confirmButtonText:'Ya'});
  if(!c.isConfirmed)return;
  await api('/api/nokos/set-status',{method:'POST',body:JSON.stringify({randomId:rid,activationId:id,status:'cancelled'})});
  Swal.fire({icon:'success',title:'Dibatalkan',timer:1200,showConfirmButton:false});
  loadActiveActivations();loadHistory();
}

async function loadHistory() {
  const rid=getRandomId();if(!rid)return;
  const data=await api(`/api/nokos/history?randomId=${rid}`);
  const tb=qs('history-body'),em=qs('history-empty');
  if(data.success&&data.activations?.length){
    hide('history-empty');
    tb.innerHTML=data.activations.map(a=>{
      const svc=services.find(s=>s.code===a.service||s.id===a.service),ic=svc?getServiceIcon(svc):DEFAULT_ICON;
      const id = a.activationId || a.id || a._id;
      return `<tr class="border-b border-white/5 hover:bg-white/[0.02]"><td class="py-3 px-2"><div class="flex items-center gap-2"><i class="${ic.icon} text-xs" style="color:${ic.color}"></i><span class="text-xs text-white font-medium">${svc?svc.name:(a.service||'').toUpperCase()}</span></div></td><td class="py-3 px-2 text-xs text-slate-400 font-mono">${a.phoneNumber||a.phone||'-'}</td><td class="py-3 px-2"><span class="status-badge ${a.status==='done'||a.status==='STATUS_FINISH'?'done':a.status==='cancelled'||a.status==='STATUS_CANCEL'?'cancelled':'active'}">${a.status==='done'||a.status==='STATUS_FINISH'?'Selesai':a.status==='cancelled'||a.status==='STATUS_CANCEL'?'Dibatalkan':a.status}</span></td><td class="py-3 px-2 text-xs text-slate-500">${a.createdAt?new Date(a.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`;
    }).join('');
  } else { tb.innerHTML=''; show('history-empty'); }
}

async function updateSaldo() {
  const rid=getRandomId(),sa=qs('saldo-amount');
  if(!rid){hide('saldo-display');return;}
  show('saldo-display');
  const data=await api(`/api/wallet/balance?randomId=${rid}`);
  if(data.success&&sa) sa.textContent=`Rp ${Number(data.balance||0).toLocaleString('id-ID')}`;
}

function handleLogout(){
  Swal.fire({title:'Logout?',text:'Kamu akan keluar dari sesi ini.',icon:'question',showCancelButton:true,confirmButtonColor:'#ef4444',confirmButtonText:'Logout'}).then(r=>{
    if(r.isConfirmed){localStorage.removeItem('rullzye_web_user');location.reload();}
  });
}

async function createDeposit(){
  const rid=getRandomId();if(!rid){Swal.fire({icon:'warning',title:'Login Dulu'});return;}
  const amt=parseInt(qs('deposit-amount').value);
  if(!amt||amt<10000){Swal.fire({icon:'warning',title:'Minimal Rp 10.000'});return;}
  const btn=qs('btn-deposit');btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  const data=await api('/api/deposit/create',{method:'POST',body:JSON.stringify({randomId:rid,amount:amt})});
  if(data.success){
    qs('qris-image').src=data.qrUrl||'';
    qs('qris-amount').textContent=`Rp ${Number(amt).toLocaleString('id-ID')}`;
    show('qris-display');
    if(depositCheckTimer)clearInterval(depositCheckTimer);
    depositCheckTimer=setInterval(()=>checkDeposit(data.invoice),3000);
  } else { Swal.fire({icon:'error',title:'Gagal',text:data.message}); }
  btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-qrcode"></i> Deposit';
}
async function checkDeposit(inv){
  if(!inv)return;
  const data=await api(`/api/deposit/check?invoice=${inv}`);
  if(data.status==='APPROVED'||data.status==='SUKSES'){
    if(depositCheckTimer)clearInterval(depositCheckTimer);
    qs('qris-timer').textContent='✅ Pembayaran berhasil!'; qs('qris-timer').className='text-xs text-emerald-400 mt-2';
    Swal.fire({icon:'success',title:'Deposit Berhasil!',text:'Saldo sudah ditambahkan.',timer:2000,showConfirmButton:false});
    setTimeout(()=>{hide('qris-display');updateSaldo();},2000);
  } else if(data.status==='expired'||data.status==='REJECTED'){
    if(depositCheckTimer)clearInterval(depositCheckTimer);
    qs('qris-timer').textContent='⏰ Kadaluwarsa.'; qs('qris-timer').className='text-xs text-rose-400 mt-2';
  }
}

// ===== GOOGLE LOGIN =====
const FIREBASE_DB_URL = 'https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99';

async function fetchFirebaseConfig() {
  try {
    const res = await fetch('/api/firebase-config');
    const d = await res.json();
    if (d.success && d.config?.apiKey) return d.config;
  } catch {}
  try {
    const fb = await fetch(FIREBASE_DB_URL + '/system_config.json');
    const d = await fb.json();
    if (d && d.firebaseConfig?.apiKey) return d.firebaseConfig;
  } catch {}
  return null;
}

async function initGoogleLogin(){
  try {
    if (firebase.apps?.length) return;
    const config = await fetchFirebaseConfig();
    if (!config) { console.warn('Firebase config not available'); return; }
    firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain || config.projectId + '.firebaseapp.com',
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });
    googleAuth = new firebase.auth.GoogleAuthProvider();
    googleAuth.setCustomParameters({ prompt: 'select_account' });
  } catch(e) { console.warn('Firebase init:', e.message); }
}

async function loginGoogle(){
  if (!googleAuth) {
    await initGoogleLogin();
    if (!googleAuth) {
      Swal.fire({icon:'error',title:'Gagal Memuat Auth',text:'Konfigurasi Firebase Auth tidak ditemukan.'});
      return;
    }
  }
  try {
    const result = await firebase.auth().signInWithPopup(googleAuth);
    const idToken = await result.user.getIdToken();
    const data = await api('/api/auth/google-login',{method:'POST',body:JSON.stringify({idToken})});
    if (data.success) {
      localStorage.setItem('rullzye_web_user', JSON.stringify({...data.user, loginMethod:'google', randomId: data.randomId}));
      renderLoginSection();
      Swal.fire({icon:'success', title:`Halo ${data.user.name}!`, text:'Login berhasil', timer:1500, showConfirmButton:false});
      loadActiveActivations(); loadHistory(); updateSaldo();
    } else {
      Swal.fire({icon:'error', title:'Login Gagal', text: data.message});
    }
  } catch(e) { Swal.fire({icon:'error', title:'Login Gagal', text: e.message}); }
}

function renderLoginSection(){
  const user=getWebUser();
  if(user){
    hide('login-container');show('user-profile');
    const nm=qs('user-name');if(nm)nm.textContent=user.name||user.firstName||'User';
    const av=qs('user-avatar');
    if(av)av.innerHTML=user.photoURL?`<img src="${user.photoURL}" class="w-7 h-7 rounded-full object-cover" alt="">`:`<i class="fa-solid fa-user text-xs"></i>`;
    show('saldo-display');show('btn-logout');
    updateSaldo();
  } else {
    show('login-container');hide('user-profile');
    hide('saldo-display');hide('btn-logout');
  }
}

// ===== PREMIUM NUMBERS (via Nokos API - WA Indonesia) =====
async function loadPremiumNumbers() {
  show('premium-loading'); hide('premium-grid'); hide('premium-error'); hide('premium-info-bar');
  const [numsRes, histRes] = await Promise.all([
    api('/api/premium/numbers'),
    getRandomId() ? api('/api/premium/history?randomId=' + getRandomId()) : Promise.resolve({ items: [] })
  ]);
  hide('premium-loading');
  if (!numsRes.success) {
    show('premium-error'); qs('premium-error-msg').textContent = numsRes.message || 'Gagal memuat data.';
    return;
  }
  const ops = numsRes.operators || [];
  show('premium-info-bar');
  qs('premium-base-price').textContent = 'Rp ' + (numsRes.basePrice || 0).toLocaleString('id-ID');
  const grid = qs('premium-grid');
  if (!ops.length) {
    grid.innerHTML = `<div class="col-span-full text-center py-12"><i class="fa-solid fa-inbox text-4xl text-slate-600 mb-3"></i><p class="text-sm text-slate-500">Tidak ada operator tersedia</p></div>`;
    show('premium-grid'); return;
  }
  show('premium-grid');
  grid.innerHTML = ops.map(op => {
    const antiColor = op.antiBanned >= 90 ? '#10b981' : op.antiBanned >= 85 ? '#f59e0b' : '#ef4444';
    return `<div class="card-nokos p-4 group" style="animation:fadeUp .35s ease both;animation-delay:${(ops.indexOf(op)%6)*0.06}s">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform" style="color:#f59e0b"><i class="fa-brands fa-whatsapp"></i></div>
        <div class="min-w-0 flex-1">
          <p class="font-bold text-white text-sm">WhatsApp — ${op.name}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">${op.stock > 0 ? op.stock + ' tersedia' : 'Stok terbatas'}</p>
        </div>
      </div>
      <div class="bg-white/[0.03] rounded-xl p-3 mb-3 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-400">Harga Premium</span>
          <span class="text-lg font-black text-amber-400">Rp ${(op.price||0).toLocaleString('id-ID')}</span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-slate-500">Anti Banned</span>
          <span class="font-bold" style="color:${antiColor}">${op.antiBanned}% <i class="fa-solid fa-shield"></i></span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-slate-500">Garansi</span>
          <span class="font-bold text-emerald-400">Refund <i class="fa-solid fa-rotate-left"></i></span>
        </div>
      </div>
      <button onclick="buyPremium('${op.id}', ${op.price||0})" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-xs hover:shadow-lg hover:shadow-amber-500/25 transition-all">
        <i class="fa-solid fa-cart-plus mr-1"></i> Beli Sekarang
      </button>
    </div>`;
  }).join('');
  renderPremiumHistory(histRes.items || []);
}
function renderPremiumHistory(items) {
  const list = qs('premium-history-list'), empty = qs('premium-history-empty');
  if (!items.length) { list.innerHTML = ''; show('premium-history-empty'); return; }
  hide('premium-history-empty');
  list.innerHTML = items.map(a => {
    const opName = PREMIUM_OPERATORS ? (PREMIUM_OPERATORS.find(o=>o.id===a.operator)||{}).name||a.operator : a.operator;
    return `<div class="card-nokos p-3 mb-2 flex items-center justify-between">
      <div><p class="text-xs font-bold text-white font-mono">${a.phone||'-'}</p>
      <p class="text-[10px] text-slate-500">${opName} · ${a.createdAt ? new Date(a.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'}</p></div>
      <div class="text-right">
        <span class="status-badge ${a.status==='STATUS_WAIT_CODE'?'active':a.status==='STATUS_CANCEL'?'cancelled':'done'}">${a.status==='STATUS_WAIT_CODE'?'Aktif':a.status==='STATUS_CANCEL'?'Batal':'Selesai'}</span>
        ${a.status==='STATUS_WAIT_CODE'?`<button onclick="cancelPremium('${a.activationId}')" class="block text-[9px] text-rose-400 hover:text-rose-300 mt-1">Batalkan & Refund</button>`:''}
      </div>
    </div>`;
  }).join('');
}
async function buyPremium(operator, price) {
  const randomId = getRandomId();
  if (!randomId) { Swal.fire({icon:'warning',title:'Belum Login',text:'Login dulu dengan Google'}); return; }
  const c = await Swal.fire({
    title:'Beli Nomor Premium?',
    html:`<div class="text-center"><p class="text-xs text-slate-400 mb-2">WhatsApp Indonesia — ${operator.toUpperCase()}</p>
      <div class="flex justify-center gap-3 my-3"><span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full"><i class="fa-solid fa-shield mr-1"></i>Anti Banned</span><span class="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full"><i class="fa-solid fa-rotate-left mr-1"></i>Garansi Refund</span></div>
      <span class="text-2xl font-black text-amber-400">Rp ${price.toLocaleString('id-ID')}</span></div>`,
    icon:'question',showCancelButton:true,confirmButtonColor:'#f59e0b',confirmButtonText:'Ya, Beli',cancelButtonText:'Batal'
  });
  if (!c.isConfirmed) return;
  const data = await api('/api/premium/buy', { method:'POST', body:JSON.stringify({ randomId, operator }) });
  if (data.success) {
    closeOrderModal();
    selectedService = { code: 'wa', name: 'WhatsApp Premium - ' + operator.toUpperCase() };
    showOtpPage(data);
    loadPremiumNumbers(); updateSaldo();
  } else {
    Swal.fire({icon:'error',title:'Gagal',text:data.message});
  }
}
async function cancelPremium(activationId) {
  const randomId = getRandomId();
  if (!randomId) return;
  const c = await Swal.fire({title:'Batalkan Nomor Premium?',text:'Saldo akan dikembalikan ke wallet kamu.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',confirmButtonText:'Ya, Batalkan & Refund',cancelButtonText:'Batal'});
  if (!c.isConfirmed) return;
  const data = await api('/api/premium/cancel', { method:'POST', body:JSON.stringify({ randomId, activationId }) });
  if (data.success) {
    Swal.fire({icon:'success',title:'Dibatalkan',text:data.message||'Saldo sudah dikembalikan.',timer:2000,showConfirmButton:false});
    loadPremiumNumbers(); loadActiveActivations(); loadHistory(); updateSaldo();
  } else {
    Swal.fire({icon:'error',title:'Gagal',text:data.message});
  }
}
function goToPremium() { switchPage('premium'); loadPremiumNumbers(); }
function goToReguler() { switchPage('browse'); loadServices(); }
function backToMenu() {
  if (otpPollTimer) clearInterval(otpPollTimer);
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  currentOtpActivation = null;
  switchPage('menu');
}

qs('search-service').addEventListener('input',()=>{
  currentPage=1;applyFilter();
  const v=qs('search-service').value;
  const sc=qs('search-clear'); if(sc) sc.classList.toggle('hidden',!v.length);
});

async function init(){
  renderLoginSection();
  if(typeof firebase!=='undefined') await initGoogleLogin();
  updateSaldo();
  if (window.location.hash === '#reguler') { switchPage('browse'); await loadServices(); }
  else if (window.location.hash === '#premium') { switchPage('premium'); loadPremiumNumbers(); }
  else switchPage('menu');
  await loadActiveActivations();
  await loadHistory();
  setInterval(updateSaldo,30000);
  setInterval(loadActiveActivations,15000);
  setInterval(loadHistory,60000);
}
document.addEventListener('DOMContentLoaded',init);
