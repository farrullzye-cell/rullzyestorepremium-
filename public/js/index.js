// public/js/index.js
let allProducts = [];
let banners = [];
let currentSlide = 0;
let slideInterval;
const webUserStorageKey = 'rullzye_web_user';
const receiptCacheKey = 'rullzye_receipts';

function getStoredWebUser() {
    try {
        const raw = localStorage.getItem(webUserStorageKey);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveWebUser(user) {
    localStorage.setItem(webUserStorageKey, JSON.stringify(user));
    updateWebUserButton();
}

function getReceiptCache() {
    try {
        const raw = localStorage.getItem(receiptCacheKey);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function addReceiptToCache(invoice) {
    const receipts = getReceiptCache();
    receipts.unshift(invoice);
    localStorage.setItem(receiptCacheKey, JSON.stringify(receipts.slice(0, 20)));
}

function updateWebUserButton() {
    const user = getStoredWebUser();
    const btn = document.getElementById('btnWebUser');
    if (!btn) return;
    if (user && user.randomId) {
        btn.innerText = `ID: ${user.randomId}`;
        btn.classList.remove('text-slate-300');
        btn.classList.add('text-white');
    } else {
        btn.innerText = 'Daftar ID Web';
        btn.classList.remove('text-white');
        btn.classList.add('text-slate-300');
    }
}

function openWebUserModal() {
    const user = getStoredWebUser();
    const existing = user ? `<div class="rounded-3xl bg-slate-900 border border-white/10 p-4 mb-4">
            <p class="text-[11px] text-slate-400">ID Anda saat ini:</p>
            <p class="font-black text-white text-xl">${user.randomId}</p>
            <p class="text-xs text-slate-400 mt-2">Nama: ${user.name}</p>
            ${user.telegramUsername ? `<p class="text-xs text-slate-400">Telegram: ${user.telegramUsername}</p>` : '<p class="text-xs text-slate-400">Telegram belum dihubungkan.</p>'}
            <button onclick="localStorage.removeItem('${webUserStorageKey}'); updateWebUserButton(); document.getElementById('webUserModal')?.remove(); openWebUserModal();" class="mt-4 w-full bg-rose-600 text-white rounded-2xl py-3 text-sm font-bold">Reset ID</button>
        </div>` : '';

    const modal = document.createElement('div');
    modal.id = 'webUserModal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-950 rounded-3xl w-full max-w-lg p-6 shadow-2xl modal-pop relative border border-white/10">
            <button onclick="document.getElementById('webUserModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="text-xl font-black text-white mb-2">ID Web & Struk</h3>
            <p class="text-sm text-slate-400 mb-4">Daftar sekali, simpan struk otomatis di perangkat dan gunakan ID untuk pembayaran.</p>
            ${existing}
            <div class="space-y-4">
                <div>
                    <label class="block text-xs uppercase tracking-widest text-slate-500 mb-2">Nama</label>
                    <input id="webUserName" type="text" class="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none" placeholder="Nama lengkap" value="${user?.name || ''}">
                </div>
                <div>
                    <label class="block text-xs uppercase tracking-widest text-slate-500 mb-2">Telegram (opsional)</label>
                    <input id="webUserTelegram" type="text" class="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none" placeholder="Contoh: rullzyebot" value="${user?.telegramUsername || ''}">
                    <p class="text-[10px] text-slate-500 mt-2">Masukkan username untuk memudahkan sinkronisasi notifikasi payment.</p>
                </div>
                <button id="btnSaveWebUser" class="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl py-3 font-bold">${user ? 'Perbarui ID Web' : 'Buat ID Web'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnSaveWebUser').onclick = async () => {
        const name = document.getElementById('webUserName').value.trim();
        const telegramUsername = document.getElementById('webUserTelegram').value.trim();
        if (!name) return Swal.fire('Oops', 'Nama harus diisi.', 'warning');

        if (user && user.randomId) {
            saveWebUser({ ...user, name, telegramUsername, updatedAt: new Date().toISOString() });
            Swal.fire('Sukses', 'Data ID web berhasil diperbarui.', 'success');
            document.getElementById('webUserModal')?.remove();
            return;
        }

        try {
            const res = await fetch('/api/web-user/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name, telegramUsername })
            });
            const data = await res.json();
            if (data.success) {
                saveWebUser({ name, telegramUsername, randomId: data.randomId, createdAt: new Date().toISOString() });
                Swal.fire('Berhasil', `ID Web Anda adalah ${data.randomId}`, 'success');
                document.getElementById('webUserModal')?.remove();
            } else {
                Swal.fire('Gagal', data.message || 'Tidak dapat membuat ID.', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
        }
    };
}

function openReceiptHistory() {
    const receipts = getReceiptCache();
    const modal = document.createElement('div');
    modal.id = 'receiptHistoryModal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-950 rounded-3xl w-full max-w-2xl p-6 shadow-2xl modal-pop relative border border-white/10">
            <button onclick="document.getElementById('receiptHistoryModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="text-xl font-black text-white mb-4">Riwayat Struk</h3>
            <div class="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
                ${receipts.length === 0 ? '<p class="text-slate-400">Belum ada struk tersimpan. Lakukan pembayaran terlebih dahulu.</p>' : receipts.map(r => `
                    <div class="rounded-3xl border border-white/10 bg-slate-900 p-4">
                        <div class="flex items-start justify-between gap-4 mb-3">
                            <div>
                                <p class="text-[10px] uppercase tracking-widest text-slate-500">Order ID</p>
                                <p class="font-black text-white">${r.orderId || r.invoiceId || r.paymentId}</p>
                            </div>
                            <span class="text-amber-400 font-black">Rp ${Number(r.amount || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <p class="text-sm font-semibold text-white mb-2">${r.productName || 'Produk Web'}</p>
                        <p class="text-[10px] text-slate-400">${r.target || ''}</p>
                        <p class="text-[10px] text-slate-500 mt-3">Tanggal: ${new Date(r.createdAt || r.date || Date.now()).toLocaleString('id-ID')}</p>
                        <a href="${r.qr_url || '#'}" target="_blank" class="inline-flex items-center gap-2 mt-3 text-xs font-bold text-violet-300">Lihat QRIS <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== BANNER ====================
async function loadBanners() {
    try {
        const [res, cfgRes] = await Promise.all([fetch('/api/banners'), fetch('/api/admin/affiliate-config')]);
        const data = await res.json();
        const cfg = await cfgRes.json();
        
        if (cfg.affiliateWelcomeMsg) {
            const mq = document.getElementById('store-marquee');
            if(mq) mq.innerText = cfg.affiliateWelcomeMsg;
        }

        if (data.success && data.banners && data.banners.length > 0) {
            banners = data.banners;
        } else {
            banners = [
                { image: 'https://placehold.co/1200x400/7c3aed/white?text=Promo+Spesial', link: '/ppob.html' },
                { image: 'https://placehold.co/1200x400/2563eb/white?text=Diskon+Akun', link: '/akundigital.html' }

            ];
        }
        renderBanners();
        startAutoSlide();
    } catch (e) {
        banners = [{ image: 'https://placehold.co/1200x400/7c3aed/white?text=Welcome', link: '#' }];
        renderBanners();
        startAutoSlide();
    }
}

function renderBanners() {
    const track = document.getElementById('slider-track');
    const dots = document.getElementById('slider-dots');
    track.innerHTML = banners.map(b => `
        <a href="${b.link || '#'}" class="slider-slide">
            <img src="${b.image}" alt="Banner" class="w-full h-full object-cover">
        </a>
    `).join('');
    dots.innerHTML = banners.map((_, i) => `
        <div class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>
    `).join('');
    goToSlide(0);
}

function slideBanner(dir) {
    const newIndex = (currentSlide + dir + banners.length) % banners.length;
    goToSlide(newIndex);
}

function goToSlide(index) {
    currentSlide = index;
    document.getElementById('slider-track').style.transform = `translateX(-${index * 100}%)`;
    document.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

function startAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => slideBanner(1), 4000);
}

document.getElementById('banner-slider')?.addEventListener('mouseenter', () => clearInterval(slideInterval));
document.getElementById('banner-slider')?.addEventListener('mouseleave', startAutoSlide);

// ==================== PRODUK & BADGE ====================
function getProductIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('pulsa') || n.includes('telkomsel') || n.includes('axis')) return '<i class="fa-solid fa-bolt text-amber-500"></i>';
    if (n.includes('data') || n.includes('gb') || n.includes('kuota')) return '<i class="fa-solid fa-wifi text-sky-500"></i>';
    if (n.includes('game') || n.includes('ml') || n.includes('free fire')) return '<i class="fa-solid fa-gamepad text-emerald-500"></i>';
    if (n.includes('netflix')) return '<i class="fa-solid fa-play text-rose-500"></i>';
    if (n.includes('spotify')) return '<i class="fa-solid fa-music text-emerald-500"></i>';
    if (n.includes('youtube')) return '<i class="fa-brands fa-youtube text-red-500"></i>';
    return '<i class="fa-solid fa-gem text-violet-500"></i>';
}

function getRandomItems(arr, count, seed) {
    const shuffled = [...arr];
    let s = seed;
    function random() {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 0xFFFFFFFF;
    }
    let m = shuffled.length, t, i;
    while (m) {
        i = Math.floor(random() * m--);
        t = shuffled[m];
        shuffled[m] = shuffled[i];
        shuffled[i] = t;
    }
    return shuffled.slice(0, count);
}

async function loadProducts() {
    try {
        const res = await fetch('/api/mixed-products');
        const data = await res.json();
        if (data.success) {
            allProducts = data.products;
            renderBadgeSections();
        }
    } catch (e) {
        console.error(e);
    }
}

function getSourceLabel(source) {
    switch (source) {
        case 'ppob': return 'PPOB';
        case 'premku': return 'Akun Digital';
        default: return 'Lainnya';
    }
}

function renderBadgeSections() {
    const todaySeed = parseInt(new Date().toISOString().slice(0,10).replace(/-/g,''), 10);
    const container = document.getElementById('badge-sections');

    const badges = [
        {
            title: '🌐 Paket Data Terlaris',
            desc: 'Paket data & kuota paling laris hari ini',
            filter: p => p.source === 'ppob' && (p.name.toLowerCase().includes('data') || p.name.toLowerCase().includes('gb') || p.name.toLowerCase().includes('kuota')),
            limit: 6,
            link: '/ppob.html'
        },
        {
            title: '🔥 Produk Terlaris PPOB',
            desc: 'Pulsa & produk PPOB terpopuler',
            filter: p => p.source === 'ppob' && !p.name.toLowerCase().includes('data') && !p.name.toLowerCase().includes('gb') && !p.name.toLowerCase().includes('kuota'),
            limit: 6,
            link: '/ppob.html'
        },
        {
            title: '⭐ Akun Digital Populer',
            desc: 'Akun premium siap pakai',
            filter: p => p.source === 'premku',
            limit: 6,
            link: '/akundigital.html'
        }
    ];

    container.innerHTML = badges.map((b, index) => {
        let items = allProducts.filter(b.filter);
        if (items.length > b.limit) {
            items = getRandomItems(items, b.limit, todaySeed + index);
        }
        return `
            <section>
                <div class="flex items-center justify-between mb-4 gap-3">
                    <div>
                        <h2 class="text-lg font-black text-white">${b.title}</h2>
                        <p class="text-[10px] uppercase font-bold tracking-widest text-violet-400">${b.desc}</p>
                    </div>
                    <a href="${b.link}" class="text-xs font-bold text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition">Lihat Semua</a>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    ${items.length === 0 ? '<p class="col-span-full text-center text-slate-400 text-xs py-4">Belum ada produk.</p>' :
                    items.map(p => `
                        <div class="product-card p-3 relative group" onclick="openOrder('${p.id}','${p.name.replace(/'/g,"\\'")}',${p.price},'${p.source}')">
                            <div class="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div class="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center mb-3 text-lg shadow-inner">
                                ${getProductIcon(p.name)}
                            </div>
                            <div class="space-y-2 relative z-10">
                                <p class="text-[10px] uppercase tracking-widest text-slate-400">${getSourceLabel(p.source)}</p>
                                <h3 class="font-bold text-slate-200 text-[11px] leading-tight line-clamp-2">${p.name}</h3>
                                <p class="text-xs font-black text-amber-400">Rp ${p.price.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
}

function openOrder(id, name, price, source) {
    const labelTarget = source === 'ppob' ? 'Nomor Tujuan / HP' : 'Username / Tujuan';
    const requireTarget = source === 'ppob';
    const modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-950 rounded-3xl w-full max-w-xl p-6 shadow-2xl modal-pop relative border border-white/10">
            <button onclick="document.getElementById('orderModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                <div>
                    <h3 class="text-xl font-black text-white mb-2">Checkout Cepat</h3>
                    <p class="text-sm text-slate-400 mb-4">${name}</p>
                    <div class="rounded-3xl bg-slate-900 border border-white/10 p-4 mb-4">
                        <p class="text-[11px] uppercase tracking-widest text-slate-500">Kategori</p>
                        <p class="text-sm font-bold text-white mb-2">${getSourceLabel(source)}</p>
                        <p class="text-[11px] uppercase tracking-widest text-slate-500">Harga</p>
                        <p class="text-lg font-black text-amber-400">Rp ${price.toLocaleString('id-ID')}</p>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Random ID Telegram <span class="text-rose-500">*</span></label>
                            <input id="modal-randomid" type="text" placeholder="ID-ABC123" class="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500">
                        </div>
                        <div id="modal-target-group" class="${requireTarget ? '' : 'hidden'}">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">${labelTarget} ${requireTarget ? '<span class="text-rose-500">*</span>' : ''}</label>
                            <input id="modal-target" type="text" placeholder="${labelTarget}" class="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Email (opsional — kirim akun)</label>
                            <input id="modal-email" type="email" placeholder="email@contoh.com" class="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500">
                        </div>
                        <div class="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-2xl p-3">
                            <p class="font-bold text-white">Catatan:</p>
                            <p>Checkout akan membuat invoice QRIS di web. Gunakan Random ID yang didaftarkan di Bot Telegram.</p>
                            <p>Jika ingin proses otomatis, selesaikan pembayaran melalui QRIS di layar.</p>
                        </div>
                    </div>
                </div>
                <div class="rounded-3xl bg-slate-900 border border-white/10 p-4 flex flex-col justify-between">
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <span class="inline-flex w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-300 items-center justify-center"><i class="fa-solid fa-check"></i></span>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-500">Keuntungan</p>
                                <p class="text-sm text-white font-bold">Langsung dari web, bukan bot</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="inline-flex w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-300 items-center justify-center"><i class="fa-solid fa-clock"></i></span>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-500">Proses</p>
                                <p class="text-sm text-white font-bold">Invoice QRIS otomatis</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="inline-flex w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-300 items-center justify-center"><i class="fa-solid fa-wallet"></i></span>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-500">Bayar</p>
                                <p class="text-sm text-white font-bold">Selesaikan melalui QRIS</p>
                            </div>
                        </div>
                    </div>
                    <button id="btn-order" class="mt-4 w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-3 rounded-2xl hover:shadow-lg transition">Bayar Sekarang</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-order').onclick = async function() {
        const randomId = document.getElementById('modal-randomid').value.trim().toUpperCase();
        const target = document.getElementById('modal-target')?.value.trim();
        if (!randomId) return Swal.fire('Oops', 'Random ID wajib diisi.', 'warning');
        if (requireTarget && !target) return Swal.fire('Oops', `${labelTarget} wajib diisi.`, 'warning');

        let endpoint = '/api/order';
        const emailVal = document.getElementById('modal-email')?.value.trim();
        let body = {
            service: id.replace(/^[A-Z]+-/, ''),
            productName: name,
            displayPrice: price,
            randomId,
            target: target || randomId,
            email: emailVal || undefined
        };

        if (source === 'ppob') endpoint = '/api/ppob-order';
        else if (source === 'premku') endpoint = '/api/order';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.status) {
                const invoice = data.invoice || {};
                document.querySelector('#orderModal .modal-pop').innerHTML = `
                    <div class="text-center">
                        <h3 class="text-xl font-black text-white mb-4">Invoice Siap</h3>
                        <div class="bg-slate-900 border border-white/10 rounded-3xl p-5 mb-4 inline-block">
                            <p class="text-[11px] uppercase tracking-widest text-slate-500">Total Bayar</p>
                            <p class="text-2xl font-black text-amber-400 mb-3">Rp ${invoice.amount?.toLocaleString('id-ID') || price.toLocaleString('id-ID')}</p>
                            <img src="${invoice.qr_url || ''}" class="mx-auto mb-4 rounded-3xl max-w-full h-auto" alt="QRIS">
                            <p class="text-xs text-slate-400">Scan QRIS untuk menyelesaikan pembayaran.</p>
                        </div>
                        <a href="${invoice.botLink || '#'}" target="_blank" class="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-violet-500 transition">Buka Bot / Konfirmasi</a>
                        <button onclick="document.getElementById('orderModal').remove()" class="mt-4 text-xs text-slate-400">Tutup</button>
                    </div>
                `;
            } else {
                Swal.fire('Gagal', data.message || 'Gagal membuat pesanan.', 'error');
                modal.remove();
            }
        } catch (e) {
            Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
            modal.remove();
        }
    };
}


window.applyAffiliate = async function() {
    const { value: randomId } = await Swal.fire({
        title: '🚀 Daftar Affiliate',
        input: 'text',
        inputLabel: 'Masukkan Random ID Telegram Anda',
        inputPlaceholder: 'ID-ABC123',
        showCancelButton: true,
        confirmButtonText: 'Kirim Pendaftaran',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#f59e0b',
        background: '#0f172a',
        color: '#e2e8f0',
        inputValidator: (value) => {
            if (!value) return 'Random ID wajib diisi!';
        }
    });
    if (randomId) {
        try {
            const res = await fetch('/api/affiliate/apply', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ randomId: randomId.toUpperCase() })
            });
            const d = await res.json();
            if (d.success) {
                Swal.fire({ icon:'success', title:'Berhasil!', text:d.message, background:'#0f172a', color:'#e2e8f0', confirmButtonColor:'#7c3aed' });
            } else {
                Swal.fire({ icon:'error', title:'Gagal', text:d.message, background:'#0f172a', color:'#e2e8f0' });
            }
        } catch(e) {
            Swal.fire({ icon:'error', title:'Error', text:'Gagal terhubung ke server.', background:'#0f172a', color:'#e2e8f0' });
        }
    }
};

// ==================== FOMO ====================
const fomoData = [
    { u: 'Rizky***92', t: 'baru beli Netflix Premium' },
    { u: 'Siti***17', t: 'baru beli Spotify Family' },
    { u: 'Dewi***45', t: 'baru isi pulsa Telkomsel 50rb' },
    { u: 'Budi***33', t: 'baru beli Pulsa 50k' },
    { u: 'Nina***78', t: 'baru beli paket data 10GB' },
    { u: 'Fajar***21', t: 'baru beli akun YouTube Premium' }
];
let fi = 0;
function showFomo() {
    const el = document.getElementById('fomo-notif');
    if (!el) return;
    const m = fomoData[fi % fomoData.length];
    const userEl = document.getElementById('fomo-user');
    const textEl = document.getElementById('fomo-text');
    if (userEl) userEl.innerText = m.u;
    if (textEl) textEl.innerText = m.t;
    fi++;
    el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    setTimeout(() => { el.style.transform = 'translateY(120px)'; el.style.opacity = '0'; }, 3000);
}
setTimeout(() => { showFomo(); setInterval(showFomo, 7000); }, 2500);

// Testimoni
async function loadTestimonials() {
    try {
        const r = await fetch('/api/testimonials');
        const d = await r.json();
        const list = document.getElementById('testimoni-list');
        if (!list) return;
        if (!d.success || !d.testimonials || d.testimonials.length === 0) {
            list.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500"><i class="fa-solid fa-comment-slash text-3xl mb-2"></i><p class="text-sm">Belum ada testimoni.</p></div>';
            return;
        }
        list.innerHTML = d.testimonials.map(t => `
            <div class="card-premium p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-2 sm:mb-3">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-xs sm:text-sm flex-shrink-0">${t.name.charAt(0).toUpperCase()}</div>
                    <div class="min-w-0">
                        <p class="text-xs sm:text-sm font-bold text-white truncate">${t.name}</p>
                        <p class="text-[9px] sm:text-[10px] text-slate-500 truncate">${t.service||'Produk Digital'}</p>
                    </div>
                    <div class="ml-auto flex gap-0.5">${'<i class="fa-solid fa-star text-amber-400 text-[9px] sm:text-[10px]"></i>'.repeat(Math.min(t.rating||5,5))}</div>
                </div>
                ${t.screenshot ? `<img src="${t.screenshot}" alt="Screenshot testimoni" class="w-full rounded-xl mb-2 border border-white/10" loading="lazy" onerror="this.style.display='none'">` : ''}
                <p class="text-[11px] sm:text-xs text-slate-400 leading-relaxed">"${t.content}"</p>
            </div>
        `).join('');
    } catch(e) {
        const list = document.getElementById('testimoni-list');
        if (list) list.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500">Belum ada testimoni. <button onclick="loadTestimonials()" class="text-violet-400 underline ml-1">Muat ulang</button></div>';
        console.warn('Testimoni load error:', e.message);
    }
}

let selectedRating = 5;
window.openTestimoniForm = function() {
    document.getElementById('testimoniModal').style.display = 'flex';
    document.getElementById('tf-name').value = '';
    document.getElementById('tf-service').value = '';
    document.getElementById('tf-content').value = '';
    selectedRating = 5;
    document.querySelectorAll('.star-select').forEach((el, i) => {
        el.className = `fa-solid fa-star ${i < selectedRating ? 'text-amber-400' : 'text-slate-600'} cursor-pointer hover:text-amber-400 transition star-select`;
    });
};
window.closeTestimoniForm = function() {
    document.getElementById('testimoniModal').style.display = 'none';
};
window.submitTestimoni = async function() {
    const name = document.getElementById('tf-name').value.trim();
    const service = document.getElementById('tf-service').value.trim();
    const content = document.getElementById('tf-content').value.trim();
    if (!name) return Swal.fire('Oops', 'Nama kamu wajib diisi', 'warning');
    if (!content || content.length < 10) return Swal.fire('Oops', 'Testimoni minimal 10 karakter', 'warning');
    const btn = document.querySelector('#testimoniModal .btn-primary');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    try {
        const r = await fetch('/api/testimonials/submit', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name, service: service||'Produk Digital', rating: selectedRating, content })
        });
        const d = await r.json();
        if (d.success) {
            Swal.fire('Terima Kasih! 🎉', 'Testimoni kamu akan ditampilkan setelah diverifikasi admin.', 'success');
            closeTestimoniForm();
        } else {
            Swal.fire('Gagal', d.message||'Coba lagi nanti', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Gagal mengirim testimoni', 'error');
    }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Testimoni';
};
// Star rating listener
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('star-select')) {
        selectedRating = parseInt(e.target.dataset.val);
        document.querySelectorAll('.star-select').forEach((el, i) => {
            el.className = `fa-solid fa-star ${i < selectedRating ? 'text-amber-400' : 'text-slate-600'} cursor-pointer hover:text-amber-400 transition star-select`;
        });
    }
});

// Init
loadBanners();
loadProducts();
loadTestimonials();
updateWebUserButton();
