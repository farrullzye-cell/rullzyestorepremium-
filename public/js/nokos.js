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
const FALLBACK_SERVICES = [
  { id: 'wa', code: 'wa', name: 'WhatsApp', popular: true },
  { id: 'tg', code: 'tg', name: 'Telegram', popular: true },
  { id: 'fb', code: 'fb', name: 'Facebook', popular: true },
  { id: 'ig', code: 'ig', name: 'Instagram', popular: true },
  { id: 'shop', code: 'shop', name: 'Shopee', popular: true },
  { id: 'tokped', code: 'tokped', name: 'Tokopedia', popular: true },
  { id: 'oi', code: 'oi', name: 'Tinder', popular: true },
  { id: 'go', code: 'go', name: 'Gojek', popular: false },
  { id: 'gr', code: 'gr', name: 'Grab', popular: false },
];

let services = [], prices = {}, activeActivations = [], selectedService = null;
let currentCategory = 'all', currentPage = 1, filteredServices = [];
let depositCheckTimer = null, activationTimers = {}, googleAuth = null;

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
  const n = (svc.name || '').toLowerCase(), c = (svc.code || '').toLowerCase();
  if (n.includes('whatsapp') || c === 'wa') return 'whatsapp';
  if (n.includes('telegram') || c === 'tg') return 'telegram';
  if (n.includes('facebook') || c === 'fb' || n.includes('instagram') || c === 'ig' || n.includes('tiktok') || n.includes('twitter') || n.includes('threads')) return 'sosmed';
  if (n.includes('shopee') || c.includes('shop') || n.includes('tokopedia') || c === 'xd' || n.includes('lazada') || n.includes('bukalapak')) return 'ecommerce';
  return 'otolain';
}
function getWebUser() { try { const r = localStorage.getItem('rullzye_web_user'); return r ? JSON.parse(r) : null; } catch { return null; } }
function getRandomId() { const u = getWebUser(); return u && u.randomId ? u.randomId : null; }
async function api(url, opts = {}) {
  try { const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts }); return await r.json(); } catch { return {}; }
}
function qs(id) { return document.getElementById(id); }
function show(id) { const e=qs(id); if(e) e.classList.remove('hidden'); }
function hide(id) { const e=qs(id); if(e) e.classList.add('hidden'); }

async function loadServices() {
  qs('services-grid').innerHTML = renderSkeletons(8);
  const data = await api('/api/nokos/services', { method: 'POST', body: JSON.stringify({}) });
  services = data.success && data.services ? data.services : FALLBACK_SERVICES;
  await loadPrices();
  renderCategories();
  applyFilter();
}
async function loadPrices() {
  const data = await api('/api/nokos/prices', { method: 'POST', body: JSON.stringify({}) });
  if (data.success && data.prices) prices = data.prices;
}
function getPrice(code) {
  const c = (code || '').toLowerCase();
  const p = prices[c];
  if (p && typeof p === 'number') return p;
  const s = services.find(x => (x.code||'').toLowerCase() === c || (x.id||'').toLowerCase() === c);
  return s && s.price ? s.price : 2500;
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
}
function renderServices() {
  const grid = qs('services-grid'), info = qs('service-count');
  const start = (currentPage - 1) * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, filteredServices.length);
  const page = filteredServices.slice(start, end);
  if (info) info.textContent = filteredServices.length ? `Menampilkan ${start+1}-${end} dari ${filteredServices.length} layanan` : '';
  if (!page.length) {
    grid.innerHTML = `<div class="col-span-full text-center py-16"><i class="fa-solid fa-search text-4xl text-slate-600 mb-4"></i><p class="text-sm text-slate-500">Tidak ada layanan ditemukan</p><p class="text-xs text-slate-600 mt-1">Coba ubah kata kunci atau kategori</p></div>`;
    return;
  }
  grid.innerHTML = page.map(s => {
    const ic = getServiceIcon(s), price = getPrice(s.code || s.id);
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
  }).join('');
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

async function openOrderModal(serviceId) {
  const s = services.find(x => x.id === serviceId || x.code === serviceId);
  if (!s) return; selectedService = s;
  const ic = getServiceIcon(s), price = getPrice(s.code || s.id);
  qs('modal-service-icon').innerHTML = `<i class="${ic.icon}" style="color:${ic.color};font-size:1.2rem"></i>`;
  qs('modal-service-name').textContent = s.name;
  qs('modal-service-code').textContent = (s.code||'').toUpperCase();
  qs('modal-service-price').textContent = `Rp ${Number(price).toLocaleString('id-ID')}`;
  qs('order-modal').style.display = 'flex';
}
function closeOrderModal() { qs('order-modal').style.display = 'none'; selectedService = null; }

async function orderNumber() {
  const randomId = getRandomId();
  if (!randomId) { Swal.fire({icon:'warning',title:'Belum Login',text:'Login dulu dengan Google atau buat ID Web'}); return; }
  const country = qs('modal-country').value, operator = qs('modal-operator').value, server = qs('modal-server').value;
  const btn = qs('btn-order-number'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  try {
    const check = await api('/api/nokos/availability', { method:'POST', body:JSON.stringify({ service: selectedService.code||selectedService.id, country, operator }) });
    if (!check.success || check.stock <= 0) { Swal.fire({icon:'error',title:'Stok Habis',text:'Nomor untuk layanan ini sedang tidak tersedia.'}); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-cart-plus"></i> Beli Nomor'; return; }
    const data = await api('/api/nokos/get-number', { method:'POST', body:JSON.stringify({ randomId, service: selectedService.code||selectedService.id, country, operator, server }) });
    if (data.success) {
      Swal.fire({icon:'success',title:'Berhasil!',text:`Nomor: ${data.phoneNumber}`,footer:'Segera cek OTP di panel aktivasi'});
      closeOrderModal(); loadActiveActivations(); updateSaldo();
    } else { Swal.fire({icon:'error',title:'Gagal',text:data.message||'Saldo tidak cukup atau layanan error'}); }
  } catch { Swal.fire({icon:'error',title:'Koneksi Error',text:'Gagal terhubung ke server.'}); }
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-cart-plus"></i> Beli Nomor';
}

async function loadActiveActivations() {
  const rid = getRandomId(); if (!rid) return;
  const data = await api(`/api/nokos/history?randomId=${rid}`);
  if (data.success && data.activations) {
    activeActivations = data.activations.filter(a => a.status === 'active' || a.status === 'pending');
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
    return `<div class="card-premium p-4 fade-up" data-id="${a.id||a._id}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background:${ic.color}20;color:${ic.color}"><i class="${ic.icon}"></i></div><span class="text-xs font-bold text-white">${svc?svc.name:(a.service||'').toUpperCase()}</span></div>
        <span class="status-badge ${a.status==='active'?'active':'pending'}"><span class="live-dot" style="width:6px;height:6px"></span> ${a.status==='active'?'Aktif':'Menunggu'}</span>
      </div>
      <div class="bg-white/5 rounded-xl p-3 mb-3">
        <div class="flex items-center justify-between"><div><p class="text-[10px] text-slate-500">Nomor</p><p class="text-sm font-bold text-white font-mono">${a.phoneNumber||a.phone||'-'}</p></div><div class="text-right"><p class="text-[10px] text-slate-500">Sisa Waktu</p><p class="text-xs font-bold font-mono timer-running" id="timer-${a.id||a._id}">${a.expiresIn?formatTimer(a.expiresIn):'--:--'}</p></div></div>
      </div>
      <div class="bg-white/5 rounded-xl p-3 mb-3">
        <div class="flex items-center justify-between"><p class="text-[10px] text-slate-500">Kode OTP ${otp?'<span class="text-[9px] text-amber-400 ml-1">klik untuk lihat</span>':''}</p>${otp?`<span class="text-xs font-bold text-emerald-400 cursor-pointer otp-blurred" id="otp-${a.id||a._id}" onclick="revealOtp('${a.id||a._id}')">${otp}</span>`:`<span class="text-[10px] text-slate-500">Menunggu OTP... <i class="fa-solid fa-spinner fa-spin ml-1"></i></span>`}</div>
      </div>
      <div class="flex gap-2"><button onclick="finishActivation('${a.id||a._id}')" class="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition"><i class="fa-solid fa-check"></i> Sudah Dipakai</button><button onclick="cancelActivation('${a.id||a._id}')" class="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition"><i class="fa-solid fa-xmark"></i> Batalkan</button></div>
    </div>`;
  }).join('');
  activeActivations.forEach(a => {
    const id = a.id || a._id;
    if (a.expiresIn && !activationTimers[id]) {
      let r = a.expiresIn;
      activationTimers[id] = setInterval(() => { r--;
        const el = qs(`timer-${id}`);
        if (el) { if (r<=0) { el.textContent='00:00'; el.className='text-xs font-bold font-mono timer-expired'; clearInterval(activationTimers[id]); delete activationTimers[id]; } else el.textContent=formatTimer(r); }
      }, 1000);
    }
  });
}
function formatTimer(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function revealOtp(id) { const el=qs(`otp-${id}`); if(el){el.classList.toggle('revealed');el.classList.toggle('otp-blurred');} }

async function finishActivation(id) {
  const rid = getRandomId(); if(!rid)return;
  const data=await api('/api/nokos/set-status',{method:'POST',body:JSON.stringify({randomId:rid,activationId:id,status:'done'})});
  if(data.success){Swal.fire({icon:'success',title:'Selesai',text:'Status aktivasi diperbarui.'});loadActiveActivations();loadHistory();}else Swal.fire({icon:'error',title:'Gagal',text:data.message});
}
async function cancelActivation(id) {
  const rid=getRandomId();if(!rid)return;
  const c=await Swal.fire({title:'Batalkan?',text:'Aktivasi nomor ini akan dibatalkan.',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#64748b',confirmButtonText:'Ya, Batalkan'});
  if(!c.isConfirmed)return;
  const data=await api('/api/nokos/set-status',{method:'POST',body:JSON.stringify({randomId:rid,activationId:id,status:'cancelled'})});
  if(data.success){Swal.fire({icon:'success',title:'Dibatalkan'});loadActiveActivations();loadHistory();}else Swal.fire({icon:'error',title:'Gagal',text:data.message});
}

async function loadHistory() {
  const rid=getRandomId();if(!rid)return;
  const data=await api(`/api/nokos/history?randomId=${rid}`);
  const tb=qs('history-body'),em=qs('history-empty');
  if(data.success&&data.activations?.length){
    hide('history-empty');
    tb.innerHTML=data.activations.map(a=>{
      const svc=services.find(s=>s.code===a.service||s.id===a.service),ic=svc?getServiceIcon(svc):DEFAULT_ICON;
      return `<tr class="border-b border-white/5 hover:bg-white/[0.02]"><td class="py-3 px-2"><div class="flex items-center gap-2"><i class="${ic.icon} text-xs" style="color:${ic.color}"></i><span class="text-xs text-white font-medium">${svc?svc.name:(a.service||'').toUpperCase()}</span></div></td><td class="py-3 px-2 text-xs text-slate-400 font-mono">${a.phoneNumber||a.phone||'-'}</td><td class="py-3 px-2"><span class="status-badge ${a.status==='done'?'done':a.status==='cancelled'?'cancelled':'active'}">${a.status==='done'?'Selesai':a.status==='cancelled'?'Dibatalkan':a.status}</span></td><td class="py-3 px-2 text-xs text-slate-500">${a.createdAt?new Date(a.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`;
    }).join('');
  } else { tb.innerHTML=''; show('history-empty'); }
}

async function updateSaldo() {
  const rid=getRandomId(),sa=qs('saldo-amount');
  if(!rid){hide('saldo-display');return;}
  show('saldo-display');
  const data=await api(`/api/wallet/balance?randomId=${rid}`);
  if(data.success&&sa) sa.textContent=`Rp ${Number(data.balance||0).toLocaleString('id-ID')}`;
  if((data.balance||0)<2500) show('deposit-section'); else hide('deposit-section');
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
  btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-qrcode"></i> Deposit Sekarang';
}
async function checkDeposit(inv){
  if(!inv)return;
  const data=await api(`/api/deposit/check?invoice=${inv}`);
  if(data.status==='APPROVED'||data.status==='SUKSES'){
    if(depositCheckTimer)clearInterval(depositCheckTimer);
    qs('qris-timer').textContent='✅ Pembayaran berhasil! Saldo masuk.'; qs('qris-timer').className='text-xs text-emerald-400 mt-2';
    Swal.fire({icon:'success',title:'Deposit Berhasil!',text:'Saldo sudah ditambahkan ke akun kamu.'});
    setTimeout(()=>{hide('qris-display');updateSaldo();},2000);
  } else if(data.status==='expired'||data.status==='REJECTED'){
    if(depositCheckTimer)clearInterval(depositCheckTimer);
    qs('qris-timer').textContent='⏰ Pembayaran kadaluwarsa.'; qs('qris-timer').className='text-xs text-rose-400 mt-2';
  }
}
async function checkOtpStatus(){
  const rid=getRandomId();if(!rid||!activeActivations.length)return;
  for(const a of activeActivations){
    const data=await api('/api/nokos/status',{method:'POST',body:JSON.stringify({randomId:rid,activationId:a.id||a._id})});
    if(data.success&&data.otp){
      const el=qs(`otp-${a.id||a._id}`);
      if(el&&el.textContent!==data.otp){el.textContent=data.otp;el.className='text-xs font-bold text-emerald-400 cursor-pointer otp-blurred';el.onclick=()=>revealOtp(a.id||a._id);}
    }
  }
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
      Swal.fire({icon:'error',title:'Gagal Memuat Auth',text:'Konfigurasi Firebase Auth tidak ditemukan. Isi Firebase Config di menu Admin > Konfigurasi, lalu simpan.'});
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
      Swal.fire({icon:'success', title:`Halo ${data.user.name}!`, text:'Berhasil login dengan Google', timer:1500, showConfirmButton:false});
      loadActiveActivations(); loadHistory(); updateSaldo();
    } else {
      Swal.fire({icon:'error', title:'Login Gagal', text: data.message});
    }
  } catch(e) { Swal.fire({icon:'error', title:'Login Gagal', text: e.message}); }
}

qs('search-service').addEventListener('input',()=>{
  currentPage=1;applyFilter();
  const v=qs('search-service').value;
  const sc=qs('search-clear'); if(sc) sc.classList.toggle('hidden',!v.length);
});

async function init(){
  renderLoginSection();
  await loadServices();
  await loadActiveActivations();
  await loadHistory();
  if(typeof firebase!=='undefined') await initGoogleLogin();
  setInterval(updateSaldo,30000);
  setInterval(loadActiveActivations,15000);
  setInterval(checkOtpStatus,5000);
  setInterval(loadHistory,60000);
}
document.addEventListener('DOMContentLoaded',init);
