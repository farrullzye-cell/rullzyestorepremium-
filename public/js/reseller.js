// ===== Reseller Center - RullzyeStore =====
let googleAuth = null;
let userData = null;
let resellerData = null;

const api = async (url, opts = {}) => {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
    return await res.json();
  } catch(e) { return { success: false, message: e.message }; }
};

// ===== FIREBASE INIT =====
async function fetchFirebaseConfig() {
  try { const r = await fetch('/api/firebase-config'); const d = await r.json(); if (d.apiKey) return d; } catch(e) {}
  try { const r = await fetch('https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99/system_config.json'); const d = await r.json(); if (d?.firebaseConfig?.apiKey) return d.firebaseConfig; } catch(e) {}
  return null;
}

async function initGoogleLogin() {
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

async function loginGoogle() {
  if (!googleAuth) { await initGoogleLogin(); if (!googleAuth) { Swal.fire({ icon: 'error', title: 'Gagal', text: 'Konfigurasi Firebase tidak ditemukan' }); return; } }
  try {
    const result = await firebase.auth().signInWithPopup(googleAuth);
    const idToken = await result.user.getIdToken();
    const data = await api('/api/auth/google-login', { method: 'POST', body: JSON.stringify({ idToken }) });
    if (!data.success) { Swal.fire({ icon: 'error', title: 'Gagal Login', text: data.message }); return; }

    userData = { ...data.user, randomId: data.randomId };
    localStorage.setItem('rullzye_web_user', JSON.stringify(userData));

    // Register or get reseller profile
    const sponsorCode = new URLSearchParams(window.location.search).get('ref');
    const regData = await api('/api/reseller/register', {
      method: 'POST',
      body: JSON.stringify({
        randomId: data.randomId,
        displayName: data.user?.name || result.user.displayName,
        googleEmail: data.user?.googleEmail || result.user.email,
        photoURL: result.user.photoURL || '',
        sponsorRefCode: sponsorCode || null
      })
    });
    if (!regData.success) { Swal.fire({ icon: 'error', title: 'Gagal Daftar', text: regData.message }); return; }

    resellerData = regData.reseller;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('dashboardMain').style.display = 'block';
    loadDashboard();
    checkNotifCount();

    if (sponsorCode) {
      Swal.fire({ icon: 'success', title: 'Selamat Datang!', text: `Anda direkomendasikan oleh referral ${sponsorCode}`, timer: 2500, showConfirmButton: false });
    }
  } catch(e) { Swal.fire({ icon: 'error', title: 'Login Gagal', text: e.message }); }
}

// ===== CHECK EXISTING LOGIN =====
async function checkLogin() {
  const stored = localStorage.getItem('rullzye_web_user');
  if (stored) {
    userData = JSON.parse(stored);
    if (userData?.randomId) {
      // Try to get reseller profile
      const r = await api(`/api/reseller/profile?randomId=${userData.randomId}`);
      if (r.success && r.reseller) {
        resellerData = r.reseller;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('dashboardMain').style.display = 'block';
        loadDashboard();
        checkNotifCount();
        return;
      }
    }
  }
  // Show login
  initGoogleLogin();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  if (!resellerData) return;

  // Profile
  document.getElementById('profileName').textContent = resellerData.displayName || '-';
  document.getElementById('profileEmail').textContent = resellerData.googleEmail || '-';
  document.getElementById('profileUid').textContent = resellerData.randomId || '-';
  document.getElementById('profileLevel').textContent = capitalize(resellerData.level || 'starter');
  document.getElementById('headerLevel').textContent = capitalize(resellerData.level || 'starter');
  document.getElementById('refCodeDisplay').textContent = resellerData.referralCode || '-';
  document.getElementById('tabRefCode').textContent = resellerData.referralCode || '-';

  const photo = resellerData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(resellerData.displayName || 'U') + '&background=7c3aed&color=fff&size=128';
  document.getElementById('profilePhoto').src = photo;
  document.getElementById('previewPhoto').src = photo;

  // Stats
  document.getElementById('statSales').textContent = 'Rp' + formatNumber(resellerData.totalSales || 0);
  document.getElementById('statOrders').textContent = formatNumber(resellerData.totalOrders || 0);
  document.getElementById('statDeposit').textContent = 'Rp' + formatNumber(resellerData.depositBalance || 0);
  document.getElementById('statCommission').textContent = 'Rp' + formatNumber(resellerData.commissionBalance || 0);
  document.getElementById('statReferrals').textContent = formatNumber(resellerData.totalReferrals || 0);
  document.getElementById('statWithdrawn').textContent = 'Rp' + formatNumber(resellerData.totalWithdrawn || 0);
  document.getElementById('wdBalance').textContent = 'Rp' + formatNumber(resellerData.commissionBalance || 0);

  // Status
  const statusEl = document.getElementById('profileStatus');
  if (resellerData.status === 'active') {
    statusEl.textContent = 'Aktif';
    statusEl.style.cssText = 'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3)';
  } else {
    statusEl.textContent = 'Suspend';
    statusEl.style.cssText = 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)';
  }

  // Level Progress
  await loadLevelProgress();
  await loadReferralStats();
  loadWithdrawHistory();
  loadNotifHistory();
  loadStoreSettings();
  loadBankSettings();
  loadBanks();
  updateStorePreview();
}

async function loadLevelProgress() {
  const r = await api(`/api/reseller/level-progress?randomId=${userData.randomId}`);
  if (!r.success) return;
  document.getElementById('currentLevelLabel').textContent = capitalize(r.currentLevel);
  document.getElementById('nextLevelLabel').textContent = r.nextLevel ? capitalize(r.nextLevel) : 'MAX';
  document.getElementById('levelProgressText').textContent = r.nextLevel ? `Rp${formatNumber(r.totalSales)} / Rp${formatNumber(r.nextSales)}` : 'Level Tertinggi!';
  document.getElementById('levelProgressBar').style.width = `${r.progress}%`;
  const cp = r.commissionPercent || 1;
  document.getElementById('refCommissionPercent').textContent = cp + '%';
  document.getElementById('bannerCommissionPercent').textContent = cp + '%';
}

async function loadReferralStats() {
  const r = await api(`/api/reseller/referral/stats?randomId=${userData.randomId}`);
  if (!r.success) return;
  document.getElementById('refTotalCount').textContent = r.totalCount || 0;
  document.getElementById('refTotalEarnings').textContent = 'Rp' + formatNumber(r.totalEarnings || 0);
  document.getElementById('refSponsor').textContent = r.sponsor ? `${r.sponsor.displayName} (${r.sponsor.referralCode})` : 'Tidak ada sponsor';
  document.getElementById('storeUrlText').textContent = `https://rullzyestorepremium.my.id/store/${resellerData.storeUsername || 'belum diatur'}`;

  const list = document.getElementById('refList');
  if (r.referrals?.length) {
    list.innerHTML = r.referrals.map(ref => `
      <div class="bg-white/[0.03] rounded-xl p-3 flex items-center justify-between">
        <div>
          <span class="text-xs text-white">${ref.displayName}</span>
          <span class="text-[10px] text-slate-600 block">${new Date(ref.joinedAt).toLocaleDateString('id-ID')}</span>
        </div>
        <span class="text-xs font-bold text-emerald-400">${ref.totalOrders} order</span>
      </div>
    `).join('');
  } else list.innerHTML = '<div class="text-xs text-slate-600 text-center py-4">Belum ada referral. Bagikan kode kamu!</div>';
}

// ===== WITHDRAW =====
async function loadBanks() {
  const r = await api('/api/admin/reseller/banks');
  if (!r.success) return;
  const sel1 = document.getElementById('wdBank');
  const sel2 = document.getElementById('bankName');
  const opts = r.banks.map(b => `<option value="${b.code}">${b.name}</option>`).join('');
  sel1.innerHTML = '<option value="">Pilih Bank</option>' + opts;
  sel2.innerHTML = '<option value="">Pilih Bank</option>' + opts;
}

function updateBankFields() {
  const bank = document.getElementById('wdBank').value;
  if (bank && resellerData.bankName === bank) {
    document.getElementById('wdAccount').value = resellerData.bankAccount || '';
    document.getElementById('wdHolder').value = resellerData.bankHolder || '';
  }
}

async function submitWithdraw() {
  const bank = document.getElementById('wdBank').value;
  const account = document.getElementById('wdAccount').value.trim();
  const holder = document.getElementById('wdHolder').value.trim();
  const nominal = parseInt(document.getElementById('wdNominal').value);

  if (!bank || !account || !holder || !nominal) return Swal.fire({ icon: 'warning', title: 'Lengkapi Data', text: 'Semua field harus diisi' });
  if (nominal < 10000) return Swal.fire({ icon: 'warning', title: 'Minimal Rp10.000', text: 'Minimal withdraw adalah Rp10.000' });
  if (nominal > (resellerData.commissionBalance || 0)) return Swal.fire({ icon: 'error', title: 'Saldo Tidak Cukup', text: `Saldo komisi Anda Rp${formatNumber(resellerData.commissionBalance || 0)}` });

  const r = await api('/api/reseller/withdraw', {
    method: 'POST',
    body: JSON.stringify({ randomId: userData.randomId, bankName: bank, bankAccount: account, bankHolder: holder, nominal })
  });
  if (r.success) {
    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan withdraw sedang diproses admin' });
    document.getElementById('wdAccount').value = '';
    document.getElementById('wdHolder').value = '';
    document.getElementById('wdNominal').value = '';
    resellerData.commissionBalance -= nominal;
    document.getElementById('statCommission').textContent = 'Rp' + formatNumber(resellerData.commissionBalance);
    document.getElementById('wdBalance').textContent = 'Rp' + formatNumber(resellerData.commissionBalance);
    loadWithdrawHistory();
    loadNotifHistory();
  } else Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
}

async function loadWithdrawHistory() {
  const r = await api(`/api/reseller/withdraw/history?randomId=${userData.randomId}`);
  if (!r.success) return;
  const cont1 = document.getElementById('wdHistory');
  const cont2 = document.getElementById('riwayatWd');
  const items = r.items?.length ? r.items.slice(0, 20) : [];
  if (items.length) {
    const html = items.map(w => {
      const statusClass = w.status === 'paid' || w.status === 'approved' ? 'badge-success' : w.status === 'rejected' ? 'badge-danger' : 'badge-warning';
      const statusText = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak', paid: 'Dibayar' }[w.status] || w.status;
      return `<div class="bg-white/[0.03] rounded-xl p-3 flex items-center justify-between">
        <div>
          <span class="text-xs text-white">Rp${formatNumber(w.nominal)}</span>
          <span class="text-[10px] text-slate-600 block">${w.bankName} | ${new Date(w.createdAt).toLocaleDateString('id-ID')}</span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${statusClass}">${statusText}</span>
      </div>`;
    }).join('');
    cont1.innerHTML = html;
    cont2.innerHTML = html;
  } else { cont1.innerHTML = '<div class="text-xs text-slate-600 text-center py-4">Belum ada withdraw</div>'; cont2.innerHTML = cont1.innerHTML; }
}

// ===== IMAGE UPLOAD =====
let uploadCallbacks = {};
async function uploadImage(input, fieldName) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return Swal.fire({ icon: 'error', title: 'Terlalu Besar', text: 'Maksimal 5MB' });
  const formData = new FormData();
  formData.append('file', file);
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: formData });
    const d = await r.json();
    if (d.success) {
      // Update the reseller profile with the new image URL
      const updateData = { randomId: userData.randomId };
      updateData[fieldName] = d.url;
      const res = await api('/api/reseller/profile', { method: 'PUT', body: JSON.stringify(updateData) });
      if (res.success) {
        resellerData = res.reseller;
        if (fieldName === 'photoURL') {
          document.getElementById('profilePhoto').src = d.url;
          document.getElementById('previewPhoto').src = d.url;
          document.getElementById('storePhotoPreview').src = d.url;
          document.getElementById('storePhotoPreview').classList.remove('hidden');
        } else if (fieldName === 'storeBanner') {
          document.getElementById('storeCoverPreview').src = d.url;
          document.getElementById('storeCoverPreview').classList.remove('hidden');
        }
        Swal.fire({ icon: 'success', title: 'Upload Berhasil', timer: 1000, showConfirmButton: false });
      }
    } else Swal.fire({ icon: 'error', title: 'Gagal Upload', text: d.message });
  } catch(e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
  input.value = '';
}

// ===== STORE SETTINGS =====
function loadStoreSettings() {
  if (!resellerData) return;
  document.getElementById('storeName').value = resellerData.storeName || '';
  document.getElementById('storeUsername').value = resellerData.storeUsername || '';
  document.getElementById('storeBio').value = resellerData.storeBio || '';
  document.getElementById('storeWa').value = resellerData.storeWhatsapp || '';
  document.getElementById('storeIg').value = resellerData.storeInstagram || '';
  document.getElementById('storeTg').value = resellerData.storeTelegram || '';
  document.getElementById('storeTt').value = resellerData.storeTiktok || '';
  // Theme
  const tc = resellerData.storeThemeColors || {};
  if (document.getElementById('themePrimary')) document.getElementById('themePrimary').value = tc.primary || '#7c3aed';
  if (document.getElementById('themeBg')) document.getElementById('themeBg').value = tc.bg || '#03050f';
  if (document.getElementById('themeAccent')) document.getElementById('themeAccent').value = tc.accent || '#c084fc';
  if (document.getElementById('themeFontColor')) document.getElementById('themeFontColor').value = tc.font || '#e2e8f0';
  if (document.getElementById('storeFont')) document.getElementById('storeFont').value = resellerData.storeFont || 'Plus Jakarta Sans';
  // Photo previews
  if (resellerData.photoURL) {
    document.getElementById('storePhotoPreview').src = resellerData.photoURL;
    document.getElementById('storePhotoPreview').classList.remove('hidden');
  }
  if (resellerData.storeBanner) {
    document.getElementById('storeCoverPreview').src = resellerData.storeBanner;
    document.getElementById('storeCoverPreview').classList.remove('hidden');
  }
}

async function saveStoreSettings() {
  const data = {
    randomId: userData.randomId,
    storeName: document.getElementById('storeName').value.trim(),
    storeUsername: document.getElementById('storeUsername').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    storeBio: document.getElementById('storeBio').value.trim(),
    storeWhatsapp: document.getElementById('storeWa').value.trim(),
    storeInstagram: document.getElementById('storeIg').value.trim(),
    storeTelegram: document.getElementById('storeTg').value.trim(),
    storeTiktok: document.getElementById('storeTt').value.trim(),
    storeThemeColors: {
      primary: document.getElementById('themePrimary')?.value || '#7c3aed',
      bg: document.getElementById('themeBg')?.value || '#03050f',
      accent: document.getElementById('themeAccent')?.value || '#c084fc',
      font: document.getElementById('themeFontColor')?.value || '#e2e8f0',
      card: 'rgba(15,23,42,0.7)'
    },
    storeFont: document.getElementById('storeFont')?.value || 'Plus Jakarta Sans'
  };
  if (!data.storeUsername) return Swal.fire({ icon: 'warning', title: 'Username Diperlukan', text: 'Username toko harus diisi' });

  const r = await api('/api/reseller/profile', { method: 'PUT', body: JSON.stringify(data) });
  if (r.success) {
    resellerData = r.reseller;
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Pengaturan toko berhasil disimpan', timer: 1500, showConfirmButton: false });
    updateStorePreview();
  } else Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
}

function updateStorePreview() {
  const username = document.getElementById('storeUsername').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || '-';
  const storeName = document.getElementById('storeName').value.trim() || resellerData?.displayName || '-';
  document.getElementById('storePreviewUrl').textContent = `rullzyestorepremium.my.id/store/${username}`;
  document.getElementById('storeUrlText').textContent = `https://rullzyestorepremium.my.id/store/${username}`;
  document.getElementById('previewName').textContent = storeName;
  document.getElementById('previewBio').textContent = document.getElementById('storeBio').value.trim() || 'Belum ada bio';
  if (username && username !== '-' && username !== 'belum diatur') {
    document.getElementById('storePreview').style.display = 'block';
  } else {
    document.getElementById('storePreview').style.display = 'none';
  }
}

// ===== BANK SETTINGS =====
function loadBankSettings() {
  if (!resellerData) return;
  if (resellerData.bankName) document.getElementById('bankName').value = resellerData.bankName;
  document.getElementById('bankAccount').value = resellerData.bankAccount || '';
  document.getElementById('bankHolder').value = resellerData.bankHolder || '';
}

async function saveBankSettings() {
  const data = {
    randomId: userData.randomId,
    bankName: document.getElementById('bankName').value,
    bankAccount: document.getElementById('bankAccount').value.trim(),
    bankHolder: document.getElementById('bankHolder').value.trim()
  };
  const r = await api('/api/reseller/profile', { method: 'PUT', body: JSON.stringify(data) });
  if (r.success) {
    resellerData = r.reseller;
    Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Data bank berhasil disimpan', timer: 1500, showConfirmButton: false });
  } else Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
}

// ===== NOTIFICATIONS =====
async function checkNotifCount() {
  const r = await api(`/api/reseller/notifications/unread?randomId=${userData.randomId}`);
  if (r.success && r.count > 0) {
    document.getElementById('notifDot').style.display = 'block';
  } else {
    document.getElementById('notifDot').style.display = 'none';
  }
}

let notifOpen = false;
async function toggleNotif() {
  notifOpen = !notifOpen;
  document.getElementById('notifPanel').style.display = notifOpen ? 'block' : 'none';
  if (notifOpen) {
    const r = await api(`/api/reseller/notifications?randomId=${userData.randomId}`);
    const list = document.getElementById('notifList');
    if (r.items?.length) {
      list.innerHTML = r.items.slice(0, 20).map(n => `
        <div class="bg-white/[0.03] rounded-xl p-3 ${n.read ? 'opacity-60' : ''}">
          <div class="flex items-center gap-2">
            <span class="text-[10px] ${n.type === 'commission' ? 'text-emerald-400' : n.type === 'withdraw' ? 'text-amber-400' : n.type === 'level_up' ? 'text-violet-400' : 'text-slate-400'}">
              <i class="fa-solid ${n.type === 'commission' ? 'fa-coins' : n.type === 'withdraw' ? 'fa-arrow-up-from-bracket' : n.type === 'level_up' ? 'fa-arrow-up' : 'fa-bell'}"></i>
            </span>
            <div class="flex-1">
              <span class="text-xs font-bold text-white">${n.title}</span>
              <p class="text-[10px] text-slate-500">${n.message}</p>
            </div>
            <span class="text-[9px] text-slate-600">${timeAgo(n.createdAt)}</span>
          </div>
        </div>
      `).join('');
    } else list.innerHTML = '<div class="text-xs text-slate-600 text-center py-4">Belum ada notifikasi</div>';
  }
}

async function readAllNotif() {
  await api('/api/reseller/notifications/read', { method: 'POST', body: JSON.stringify({ randomId: userData.randomId }) });
  document.getElementById('notifDot').style.display = 'none';
}

async function loadNotifHistory() {
  const r = await api(`/api/reseller/notifications?randomId=${userData.randomId}`);
  const cont = document.getElementById('riwayatNotif');
  if (r.items?.length) {
    cont.innerHTML = r.items.slice(0, 30).map(n => `
      <div class="bg-white/[0.03] rounded-xl p-3 ${n.read ? 'opacity-60' : ''}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white">${n.title}</span>
          <span class="text-[9px] text-slate-600">${timeAgo(n.createdAt)}</span>
        </div>
        <p class="text-[10px] text-slate-500 mt-1">${n.message}</p>
      </div>
    `).join('');
  } else cont.innerHTML = '<div class="text-xs text-slate-600 text-center py-4">Belum ada notifikasi</div>';
}

// ===== SHARE & COPY =====
function copyRefCode() {
  const code = resellerData?.referralCode || '-';
  navigator.clipboard.writeText(code).then(() => {
    Swal.fire({ icon: 'success', title: 'Tersalin!', text: 'Kode referral disalin', timer: 1000, showConfirmButton: false });
  });
}

function copyStoreUrl() {
  const url = `https://rullzyestorepremium.my.id/store/${resellerData?.storeUsername || ''}`;
  navigator.clipboard.writeText(url).then(() => {
    Swal.fire({ icon: 'success', title: 'Tersalin!', text: 'Link toko disalin', timer: 1000, showConfirmButton: false });
  });
}

function shareRefLink() {
  const code = resellerData?.referralCode || '';
  const url = `https://rullzyestorepremium.my.id/reseller.html?ref=${code}`;
  if (navigator.share) {
    navigator.share({ title: 'Daftar Reseller RullzyeStore', text: 'Dapatkan harga khusus dengan kode referral ku!', url });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      Swal.fire({ icon: 'success', title: 'Link Disalin!', text: 'Bagikan link ini ke teman kamu', timer: 1500, showConfirmButton: false });
    });
  }
}

// ===== TAB SYSTEM =====
document.addEventListener('click', function(e) {
  const tabBtn = e.target.closest('.tab-btn');
  if (!tabBtn) return;
  const tab = tabBtn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tabBtn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
});

// ===== UTILITY =====
function formatNumber(n) {
  return (parseInt(n) || 0).toLocaleString('id-ID');
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'j';
  return Math.floor(diff / 86400) + 'h';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', checkLogin);
