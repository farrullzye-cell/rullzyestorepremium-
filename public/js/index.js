// public/js/index.js
let allProducts = [];
let banners = [];
let currentSlide = 0;
let slideInterval;

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
                { image: 'https://placehold.co/1200x400/7c3aed/white?text=Promo+Spesial', link: '/topup.html' },
                { image: 'https://placehold.co/1200x400/059669/white?text=Pulsa+Murah', link: '/ppob.html' },
                { image: 'https://placehold.co/1200x400/2563eb/white?text=Sosmed+Boost', link: '/smmpanel.html' }
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
            title: '⭐ Akun Aplikasi Terlaris',
            desc: 'Akun premium favorit',
            filter: p => p.source === 'premku' && (!p.badge || p.badge !== 'Hot'),
            limit: 6,
            link: '/akundigital.html'
        },
        {
            title: '🎉 Promo Akun / Hot Akun',
            desc: 'Akun premium dengan promo terbatas',
            filter: p => p.source === 'premku' && (p.badge === 'Hot' || p.badge === 'Promo'),
            limit: 6,
            link: '/akundigital.html'
        }
    ];

    container.innerHTML = badges.map(b => {
        let items = allProducts.filter(b.filter);
        if (items.length > b.limit) {
            items = getRandomItems(items, b.limit, todaySeed + badges.indexOf(b));
        }
        return `
            <section>
                <div class="flex items-center justify-between mb-4">
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
                            <h3 class="font-bold text-slate-200 text-[11px] leading-tight line-clamp-2 mb-2 relative z-10">${p.name}</h3>
                            <p class="text-xs font-black text-amber-400 relative z-10">Rp ${p.price.toLocaleString('id-ID')}</p>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
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

// ==================== ORDER (MODAL) ====================
let selectedProduct = null;

function openOrder(id, name, price, source) {
    selectedProduct = { id, name, price, source };
    const modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl modal-pop relative">
            <button onclick="document.getElementById('orderModal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="text-xl font-black text-slate-800 mb-2 text-center">Konfirmasi Pesanan</h3>
            <p class="text-sm font-bold text-indigo-600 mb-4 text-center">${name}</p>
            <div class="mb-4">
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Random ID Telegram <span class="text-red-500">*</span></label>
                <input type="text" id="modal-randomid" placeholder="ID-ABC123" class="w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm uppercase font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
            <div id="modal-target-container" class="mb-4 hidden">
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nomor Tujuan / UID <span class="text-red-500">*</span></label>
                <input type="text" id="modal-target" placeholder="08xxx / 12345678" class="w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
            <button id="btn-order" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl text-sm hover:bg-indigo-700">Lanjut Pembayaran</button>
        </div>
    `;
    document.body.appendChild(modal);

    if (source === 'ppob' || source === 'topup') {
        document.getElementById('modal-target-container').classList.remove('hidden');
    }

    document.getElementById('btn-order').onclick = async function() {
        const randomId = document.getElementById('modal-randomid').value.trim().toUpperCase();
        const target = document.getElementById('modal-target')?.value.trim();
        if (!randomId) return alert('Masukkan Random ID!');
        if ((source === 'ppob' || source === 'topup') && !target) return alert('Masukkan nomor tujuan / UID!');

        let endpoint = '/api/order';
        let body = { service: selectedProduct.id.replace(/^(PREMKU|PPOB|TOPUP)-/, ''), productName: selectedProduct.name, displayPrice: selectedProduct.price, randomId: randomId, target: target || randomId };
        if (source === 'ppob') {
            endpoint = '/api/ppob-order';
            body.productId = selectedProduct.id.replace('PPOB-', '');
            body.target = target;
        } else if (source === 'topup') {
            endpoint = '/api/topup-order';
            body.service = selectedProduct.id.replace('TOPUP-', '');
            body.target = target;
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status) {
            modal.querySelector('.modal-pop').innerHTML = `
                <h3 class="text-lg font-black mb-4">QRIS Siap</h3>
                <img src="${data.invoice.qr_url}" class="w-40 h-40 mx-auto rounded-xl mb-4">
                <p class="font-bold text-slate-800">Rp ${data.invoice.amount.toLocaleString('id-ID')}</p>
                <a href="${data.invoice.botLink}" target="_blank" class="block mt-4 bg-indigo-600 text-white py-2 rounded-xl text-sm hover:bg-indigo-700">Konfirmasi via Bot</a>
                <button onclick="document.getElementById('orderModal').remove()" class="mt-2 text-slate-400 text-xs">Tutup</button>
            `;
        } else {
            alert(data.message || 'Gagal');
            modal.remove();
        }
    };
}

// FOMO
const fomoData = [
    { u: 'Rizky***92', t: 'baru beli Netflix Premium' },
    { u: 'Siti***17', t: 'baru beli Spotify Family' },
];
let fi = 0;
function showFomo() {
    const el = document.getElementById('fomo-notif'), m = fomoData[fi % fomoData.length];
    document.getElementById('fomo-user').innerText = m.u;
    document.getElementById('fomo-text').innerText = m.t;
    fi++;
    el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    setTimeout(() => { el.style.transform = 'translateY(120px)'; el.style.opacity = '0'; }, 3000);
}
setTimeout(() => { showFomo(); setInterval(showFomo, 7000); }, 2500);
setInterval(() => { document.getElementById('live-counter').innerText = (35 + Math.floor(Math.random() * 25)) + ' online'; }, 5000);

// Init
loadBanners();
loadProducts();
