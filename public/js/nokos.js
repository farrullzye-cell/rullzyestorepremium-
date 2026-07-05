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

let services = [];
let prices = {};
let activeActivations = [];
let selectedService = null;
let depositCheckTimer = null;
let activationTimers = {};

function getServiceIcon(svc) {
  const code = (svc.code || svc.id || '').toLowerCase();
  for (const [key, val] of Object.entries(SERVICE_ICONS)) {
    if (code.includes(key)) return val;
  }
  if ((svc.name || '').toLowerCase().includes('whatsapp')) return SERVICE_ICONS.wa;
  if ((svc.name || '').toLowerCase().includes('telegram')) return SERVICE_ICONS.tg;
  return DEFAULT_ICON;
}

function getCategoryForService(svc) {
  const n = (svc.name || '').toLowerCase();
  const c = (svc.code || svc.id || '').toLowerCase();
  if (n.includes('whatsapp') || c.includes('wa')) return 'whatsapp';
  if (n.includes('telegram') || c.includes('tg')) return 'telegram';
  if (n.includes('facebook') || c.includes('fb') || n.includes('instagram') || c.includes('ig') || n.includes('tiktok') || n.includes('twitter')) return 'sosmed';
  if (n.includes('shopee') || c.includes('shop') || n.includes('tokopedia') || c.includes('tokped') || n.includes('lazada') || n.includes('bukalapak')) return 'ecommerce';
  return 'otolain';
}

function getWebUser() {
  try {
    const raw = localStorage.getItem('rullzye_web_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getRandomId() {
  const u = getWebUser();
  return u && u.randomId ? u.randomId : null;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function loadServices() {
  try {
    const data = await apiPost('/api/nokos/services', {});
    if (data.success && data.services) {
      services = data.services;
    } else {
      services = getDefaultServices();
    }
  } catch {
    services = getDefaultServices();
  }
  await loadPrices();
  renderCategories();
  renderServices();
}

function getDefaultServices() {
  return [
    { id: 'wa', code: 'wa', name: 'WhatsApp', category: 'whatsapp', popular: true },
    { id: 'tg', code: 'tg', name: 'Telegram', category: 'telegram', popular: true },
    { id: 'fb', code: 'fb', name: 'Facebook', category: 'sosmed', popular: true },
    { id: 'ig', code: 'ig', name: 'Instagram', category: 'sosmed', popular: true },
    { id: 'shop', code: 'shop', name: 'Shopee', category: 'ecommerce', popular: true },
    { id: 'tokped', code: 'tokped', name: 'Tokopedia', category: 'ecommerce', popular: true },
    { id: 'oi', code: 'oi', name: 'Gojek', category: 'sosmed', popular: true },
    { id: 'go', code: 'go', name: 'Grab', category: 'sosmed', popular: false },
    { id: 'gr', code: 'gr', name: 'Gmail', category: 'otolain', popular: false },
  ];
}

async function loadPrices() {
  try {
    const data = await apiPost('/api/nokos/prices', {});
    if (data.success && data.prices) {
      prices = data.prices;
    }
  } catch {}
}

function getPrice(serviceCode) {
  const p = prices[serviceCode] || prices[serviceCode.toLowerCase()];
  if (p) return p;
  const svc = services.find(s => s.code === serviceCode || s.id === serviceCode);
  return svc && svc.price ? svc.price : 2500;
}

function renderCategories() {
  const container = document.getElementById('category-tabs');
  container.innerHTML = CATEGORIES.map(c =>
    `<button class="category-chip ${c.key === 'all' ? 'active' : ''}" data-cat="${c.key}" onclick="setCategory('${c.key}', this)">${c.label}</button>`
  ).join('');
}

let currentCategory = 'all';

function setCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderServices();
}

function renderServices() {
  const grid = document.getElementById('services-grid');
  const q = (document.getElementById('search-service').value || '').toLowerCase();
  let filtered = services.filter(s => {
    if (currentCategory !== 'all' && currentCategory === 'populer' && !s.popular) return false;
    if (currentCategory !== 'all' && currentCategory !== 'populer' && getCategoryForService(s) !== currentCategory) return false;
    if (q && !s.name.toLowerCase().includes(q) && !(s.code || '').toLowerCase().includes(q)) return false;
    return true;
  });
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500"><i class="fa-solid fa-search text-3xl mb-3"></i><p class="text-sm">Tidak ada layanan ditemukan</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => {
    const iconInfo = getServiceIcon(s);
    const price = getPrice(s.code || s.id);
    return `
      <div class="card-nokos p-4" onclick="openOrderModal('${s.id || s.code}')">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-base" style="background:${iconInfo.color}20;color:${iconInfo.color}">
            <i class="${iconInfo.icon}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white text-sm truncate">${s.name}</p>
            <p class="text-[10px] text-slate-500">${(s.code || s.id || '').toUpperCase()}</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-black text-violet-400">Rp ${Number(price).toLocaleString('id-ID')}</span>
          <span class="text-[10px] text-violet-300 bg-violet-500/10 px-2 py-1 rounded-full font-bold">Pilih</span>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('search-service').addEventListener('input', renderServices);

function openOrderModal(serviceId) {
  const svc = services.find(s => s.id === serviceId || s.code === serviceId);
  if (!svc) return;
  selectedService = svc;
  const iconInfo = getServiceIcon(svc);
  const price = getPrice(svc.code || svc.id);

  document.getElementById('modal-service-icon').innerHTML = `<i class="${iconInfo.icon}" style="color:${iconInfo.color};font-size:1.1rem"></i>`;
  document.getElementById('modal-service-name').textContent = svc.name;
  document.getElementById('modal-service-price').textContent = `Rp ${Number(price).toLocaleString('id-ID')}`;
  document.getElementById('order-modal').style.display = 'flex';
}

function closeOrderModal() {
  document.getElementById('order-modal').style.display = 'none';
  selectedService = null;
}

async function orderNumber() {
  const randomId = getRandomId();
  if (!randomId) {
    Swal.fire('Login Dulu', 'Buat ID Web terlebih dahulu melalui halaman utama.', 'warning');
    return;
  }
  const country = document.getElementById('modal-country').value;
  const operator = document.getElementById('modal-operator').value;
  const server = document.getElementById('modal-server').value;
  const btn = document.getElementById('btn-order-number');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const check = await apiPost('/api/nokos/availability', {
      service: selectedService.code || selectedService.id,
      country,
      operator
    });
    if (!check.success || check.stock <= 0) {
      Swal.fire('Stok Habis', 'Nomor untuk layanan ini sedang tidak tersedia.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Beli Nomor';
      return;
    }
    const data = await apiPost('/api/nokos/get-number', {
      randomId,
      service: selectedService.code || selectedService.id,
      country,
      operator,
      server
    });
    if (data.success) {
      Swal.fire('Berhasil!', `Nomor: ${data.phoneNumber}`, 'success');
      closeOrderModal();
      loadActiveActivations();
      updateSaldo();
    } else {
      Swal.fire('Gagal', data.message || 'Tidak dapat memesan nomor.', 'error');
    }
  } catch (e) {
    Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Beli Nomor';
}

async function loadActiveActivations() {
  const randomId = getRandomId();
  if (!randomId) return;
  try {
    const data = await apiGet(`/api/nokos/history?randomId=${randomId}`);
    if (data.success && data.activations) {
      activeActivations = data.activations.filter(a => a.status === 'active' || a.status === 'pending');
      renderActiveActivations();
    }
  } catch {}
}

function renderActiveActivations() {
  const section = document.getElementById('active-activations-section');
  const container = document.getElementById('active-activations');
  const count = document.getElementById('active-count');

  if (activeActivations.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  count.textContent = `${activeActivations.length} aktif`;

  container.innerHTML = activeActivations.map(a => {
    const svc = services.find(s => s.code === a.service || s.id === a.service);
    const iconInfo = svc ? getServiceIcon(svc) : DEFAULT_ICON;
    const otp = a.otp || a.otpCode || '';
    return `
      <div class="card-premium p-4" data-activation-id="${a.id || a._id}">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background:${iconInfo.color}20;color:${iconInfo.color}">
              <i class="${iconInfo.icon}"></i>
            </div>
            <span class="text-xs font-bold text-white">${svc ? svc.name : (a.service || '').toUpperCase()}</span>
          </div>
          <span class="status-badge ${a.status === 'active' ? 'active' : 'pending'}">
            <span class="live-dot" style="width:6px;height:6px"></span> ${a.status === 'active' ? 'Aktif' : 'Menunggu'}
          </span>
        </div>
        <div class="bg-white/5 rounded-xl p-3 mb-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] text-slate-500">Nomor</p>
              <p class="text-sm font-bold text-white font-mono">${a.phoneNumber || a.phone || '-'}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-slate-500">Timer</p>
              <p class="text-xs font-bold font-mono timer-running" id="timer-${a.id || a._id}">${a.expiresIn ? formatTimer(a.expiresIn) : '--:--'}</p>
            </div>
          </div>
        </div>
        <div class="bg-white/5 rounded-xl p-3 mb-3">
          <div class="flex items-center justify-between">
            <p class="text-[10px] text-slate-500">Kode OTP</p>
            ${otp ? `
              <span class="text-xs font-bold text-emerald-400 cursor-pointer otp-blurred" id="otp-${a.id || a._id}" onclick="revealOtp('${a.id || a._id}')">${otp}</span>
            ` : `
              <span class="text-[10px] text-slate-500">Menunggu OTP...</span>
            `}
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="finishActivation('${a.id || a._id}')" class="flex-1 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition">
            <i class="fa-solid fa-check"></i> Sudah Dipakai
          </button>
          <button onclick="cancelActivation('${a.id || a._id}')" class="flex-1 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition">
            <i class="fa-solid fa-xmark"></i> Batalkan
          </button>
        </div>
      </div>
    `;
  }).join('');

  activeActivations.forEach(a => {
    const id = a.id || a._id;
    if (a.expiresIn && !activationTimers[id]) {
      let remaining = a.expiresIn;
      activationTimers[id] = setInterval(() => {
        remaining--;
        const el = document.getElementById(`timer-${id}`);
        if (el) {
          if (remaining <= 0) {
            el.textContent = '00:00';
            el.className = 'text-xs font-bold font-mono timer-expired';
            clearInterval(activationTimers[id]);
            delete activationTimers[id];
          } else {
            el.textContent = formatTimer(remaining);
          }
        }
      }, 1000);
    }
  });
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function revealOtp(id) {
  const el = document.getElementById(`otp-${id}`);
  if (el) {
    el.classList.toggle('revealed');
    el.classList.toggle('otp-blurred');
  }
}

async function finishActivation(id) {
  const randomId = getRandomId();
  if (!randomId) return;
  try {
    const data = await apiPost('/api/nokos/set-status', { randomId, activationId: id, status: 'done' });
    if (data.success) {
      Swal.fire('Sukses', 'Status aktivasi diperbarui.', 'success');
      loadActiveActivations();
      loadHistory();
    } else {
      Swal.fire('Gagal', data.message || 'Tidak dapat memperbarui status.', 'error');
    }
  } catch {
    Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
  }
}

async function cancelActivation(id) {
  const randomId = getRandomId();
  if (!randomId) return;
  const confirm = await Swal.fire({
    title: 'Batalkan?',
    text: 'Aktivasi nomor ini akan dibatalkan.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Batalkan'
  });
  if (!confirm.isConfirmed) return;
  try {
    const data = await apiPost('/api/nokos/set-status', { randomId, activationId: id, status: 'cancelled' });
    if (data.success) {
      Swal.fire('Dibatalkan', 'Aktivasi nomor berhasil dibatalkan.', 'success');
      loadActiveActivations();
      loadHistory();
    } else {
      Swal.fire('Gagal', data.message || 'Tidak dapat membatalkan.', 'error');
    }
  } catch {
    Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
  }
}

async function loadHistory() {
  const randomId = getRandomId();
  if (!randomId) return;
  try {
    const data = await apiGet(`/api/nokos/history?randomId=${randomId}`);
    const tbody = document.getElementById('history-body');
    const empty = document.getElementById('history-empty');
    if (data.success && data.activations && data.activations.length > 0) {
      empty.classList.add('hidden');
      tbody.innerHTML = data.activations.map(a => {
        const svc = services.find(s => s.code === a.service || s.id === a.service);
        const iconInfo = svc ? getServiceIcon(svc) : DEFAULT_ICON;
        return `
          <tr class="border-b border-white/5 hover:bg-white/[0.02]">
            <td class="py-3 px-2">
              <div class="flex items-center gap-2">
                <i class="${iconInfo.icon} text-xs" style="color:${iconInfo.color}"></i>
                <span class="text-xs text-white font-medium">${svc ? svc.name : (a.service || '').toUpperCase()}</span>
              </div>
            </td>
            <td class="py-3 px-2 text-xs text-slate-400 font-mono">${a.phoneNumber || a.phone || '-'}</td>
            <td class="py-3 px-2"><span class="status-badge ${a.status}">${a.status}</span></td>
            <td class="py-3 px-2 text-xs text-slate-500">${a.createdAt ? new Date(a.createdAt).toLocaleDateString('id-ID') : '-'}</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
    }
  } catch {}
}

async function updateSaldo() {
  const randomId = getRandomId();
  const saldoDisplay = document.getElementById('saldo-display');
  const saldoAmount = document.getElementById('saldo-amount');
  const logoutBtn = document.getElementById('btn-logout');

  if (!randomId) {
    saldoDisplay.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }
  saldoDisplay.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  try {
    const data = await apiGet(`/api/wallet/balance?randomId=${randomId}`);
    if (data.success) {
      const balance = data.balance || data.saldo || 0;
      saldoAmount.textContent = `Rp ${Number(balance).toLocaleString('id-ID')}`;
      const depositSection = document.getElementById('deposit-section');
      if (balance < 2500) {
        depositSection.classList.remove('hidden');
      } else {
        depositSection.classList.add('hidden');
      }
    }
  } catch {}
}

function handleLogout() {
  Swal.fire({
    title: 'Logout?',
    text: 'Kamu akan keluar dari sesi ini.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Logout'
  }).then(res => {
    if (res.isConfirmed) {
      localStorage.removeItem('rullzye_web_user');
      location.reload();
    }
  });
}

async function createDeposit() {
  const randomId = getRandomId();
  if (!randomId) {
    Swal.fire('Login Dulu', 'Buat ID Web terlebih dahulu.', 'warning');
    return;
  }
  const amount = parseInt(document.getElementById('deposit-amount').value);
  if (!amount || amount < 10000) {
    Swal.fire('Minimal Deposit', 'Minimal deposit Rp 10.000', 'warning');
    return;
  }
  const btn = document.getElementById('btn-deposit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const data = await apiPost('/api/deposit/create', { randomId, amount });
    if (data.success) {
      const qrisDisplay = document.getElementById('qris-display');
      document.getElementById('qris-image').src = data.qrUrl || data.qr_image || '';
      document.getElementById('qris-amount').textContent = `Rp ${Number(amount).toLocaleString('id-ID')}`;
      qrisDisplay.classList.remove('hidden');
      if (depositCheckTimer) clearInterval(depositCheckTimer);
      depositCheckTimer = setInterval(() => checkDeposit(data.invoice || data.invoiceId), 3000);
    } else {
      Swal.fire('Gagal', data.message || 'Tidak dapat membuat deposit.', 'error');
    }
  } catch {
    Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> Deposit Sekarang';
}

async function checkDeposit(invoice) {
  if (!invoice) return;
  try {
    const data = await apiGet(`/api/deposit/check?invoice=${invoice}`);
    if (data.status === 'SUKSES' || data.status === 'success' || data.status === 'paid') {
      if (depositCheckTimer) clearInterval(depositCheckTimer);
      document.getElementById('qris-timer').textContent = 'Pembayaran berhasil! Saldo akan ditambahkan.';
      document.getElementById('qris-timer').className = 'text-xs text-emerald-400 mt-2';
      Swal.fire('Sukses!', 'Deposit berhasil, saldo telah ditambahkan.', 'success');
      setTimeout(() => {
        document.getElementById('qris-display').classList.add('hidden');
        updateSaldo();
      }, 2000);
    } else if (data.status === 'expired') {
      if (depositCheckTimer) clearInterval(depositCheckTimer);
      document.getElementById('qris-timer').textContent = 'Pembayaran kadaluwarsa.';
      document.getElementById('qris-timer').className = 'text-xs text-rose-400 mt-2';
    }
  } catch {}
}

async function checkOtpStatus() {
  const randomId = getRandomId();
  if (!randomId || activeActivations.length === 0) return;
  try {
    for (const a of activeActivations) {
      const data = await apiPost('/api/nokos/status', {
        randomId,
        activationId: a.id || a._id
      });
      if (data.success && data.otp) {
        const el = document.getElementById(`otp-${a.id || a._id}`);
        if (el && el.textContent !== data.otp) {
          el.textContent = data.otp;
          el.className = 'text-xs font-bold text-emerald-400 cursor-pointer otp-blurred';
          el.onclick = () => revealOtp(a.id || a._id);
        }
      }
    }
  } catch {}
}

async function init() {
  await loadServices();
  await updateSaldo();
  await loadActiveActivations();
  await loadHistory();
  setInterval(updateSaldo, 30000);
  setInterval(loadActiveActivations, 15000);
  setInterval(checkOtpStatus, 10000);
  setInterval(loadHistory, 60000);
}

init();
