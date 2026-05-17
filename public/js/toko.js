// toko.js
let allProducts = [];
let currentCategory = 'all';

async function loadProducts() {
    const res = await fetch('/api/ppob-products');
    const data = await res.json();
    if (data.success) allProducts = data.products;
    renderCategories();
    renderProducts();
}

function renderCategories() {
    const tabs = document.getElementById('categoryTabs');
    const cats = ['all', ...new Set(allProducts.map(p => p.category || p.brand))];
    tabs.innerHTML = cats.map(c => 
        `<button class="px-4 py-2 rounded-full text-xs font-bold ${c === currentCategory ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}" onclick="filterCategory('${c}')">${c === 'all' ? 'Semua' : c}</button>`
    ).join('');
}

function filterCategory(cat) {
    currentCategory = cat;
    renderCategories();
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const filtered = currentCategory === 'all' ? allProducts : allProducts.filter(p => (p.category || p.brand) === currentCategory);
    grid.innerHTML = filtered.map(p => `
        <div class="product-card bg-white rounded-2xl p-3 border border-slate-200" onclick="order('${p.id}','${p.name.replace(/'/g,"\\'")}',${p.price})">
            <div class="aspect-square bg-violet-50 rounded-xl flex items-center justify-center mb-2"><i class="fa-solid fa-bolt text-violet-600 text-xl"></i></div>
            <div class="text-center">
                <h3 class="font-bold text-slate-800 text-[11px] leading-tight line-clamp-2">${p.name}</h3>
                <p class="text-xs font-extrabold text-violet-600 mt-1">Rp ${p.price.toLocaleString('id-ID')}</p>
            </div>
        </div>
    `).join('');
}

function order(productId, productName, price) {
    const target = prompt(`Masukkan nomor tujuan untuk ${productName}:`);
    if (!target) return;
    fetch('/api/affiliate/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ refCode, productId, target, productName, price })
    })
    .then(r => r.json())
    .then(res => {
        if (res.status) {
            Swal.fire({ title: 'Scan QRIS', html: `<p class="font-bold">Total: Rp ${res.invoice.amount.toLocaleString('id-ID')}</p><img src="${res.invoice.qr_url}" class="mx-auto my-3 rounded-xl shadow" style="max-width:200px">`, confirmButtonText: 'Selesai' });
        } else {
            Swal.fire('Gagal', res.message || 'Gagal membuat pesanan.', 'error');
        }
    });
}

loadProducts();
