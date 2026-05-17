let currentPin='';
const formatRp=n=>'Rp '+parseInt(n||0).toLocaleString('id-ID');
function checkPin(){
    const p=document.getElementById('pinInput').value;
    if(p==='858486'){
        currentPin=p;
        document.getElementById('pinOverlay').style.display='none';
        document.getElementById('sidebar').style.display='flex';
        document.getElementById('mainContent').style.display='block';
        loadTab('dashboard');
    } else alert('PIN Salah!');
}

document.querySelectorAll('.menu-item').forEach(m=>{
    m.addEventListener('click',e=>{
        document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        loadTab(e.currentTarget.dataset.tab);
    });
});

async function loadTab(tab){
    const container=document.getElementById('tab-content');
    container.innerHTML='<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-3xl text-violet-500"></i><p class="mt-2 text-slate-400 text-sm">Memuat data...</p></div>';
    
    try{
        if(tab==='dashboard'){
            const [u,o]=await Promise.all([fetch('/api/admin/users').then(r=>r.json()),fetch('/api/admin/orders').then(r=>r.json())]);
            const rev=o.filter(x=>x.status==='SUKSES').reduce((s,x)=>s+(x.displayPrice||0),0);
            container.innerHTML=`<h2 class="text-2xl font-black mb-6">Dashboard Utama</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="card stat-card p-5"><p class="text-xs text-slate-400 uppercase font-bold">Total User</p><h3 class="text-3xl font-black mt-1 text-white">${u.length}</h3></div>
                    <div class="card stat-card p-5"><p class="text-xs text-slate-400 uppercase font-bold">Total Order</p><h3 class="text-3xl font-black mt-1 text-white">${o.length}</h3></div>
                    <div class="card stat-card p-5"><p class="text-xs text-slate-400 uppercase font-bold">Pesanan Sukses</p><h3 class="text-3xl font-black mt-1 text-emerald-400">${o.filter(x=>x.status==='SUKSES').length}</h3></div>
                    <div class="card stat-card p-5"><p class="text-xs text-slate-400 uppercase font-bold">Pendapatan Kotor</p><h3 class="text-2xl font-black mt-1 text-violet-400">${formatRp(rev)}</h3></div>
                </div>`;
        }
        else if(tab==='users'){
            const u=await fetch('/api/admin/users').then(r=>r.json());
            let h=`<h2 class="text-xl font-black mb-4">Manajemen Pengguna</h2>
                <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10"><tr>
                <th class="p-3">Nama</th><th class="p-3">Chat ID</th><th class="p-3">Saldo</th><th class="p-3">Role</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>`;
            u.forEach(x=>{
                h+=`<tr class="border-b border-white/5"><td class="p-3 font-bold">${x.firstName} <code class="text-[10px] text-slate-400 ml-1">${x.randomId}</code></td><td class="p-3 font-mono text-xs">${x.chatId}</td>
                <td class="p-3 font-bold text-emerald-400">${formatRp(x.balance)}</td>
                <td class="p-3">${x.isAffiliate?'<span class="badge-ok">Affiliate</span>':(x.isReseller?'<span class="badge-ok">Reseller</span>':'<span class="badge-warn">Member</span>')}</td>
                <td class="p-3 text-center"><button onclick="deleteUser('${x.randomId}')" class="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i> Hapus</button></td></tr>`;
            });
            h+=`</tbody></table></div>`;
            container.innerHTML=h;
        }
        else if(tab==='orders'){
            const o=await fetch('/api/admin/orders').then(r=>r.json());
            let h=`<h2 class="text-xl font-black mb-4">Riwayat Pesanan</h2>
                <div class="card overflow-x-auto"><table class="w-full text-sm text-left whitespace-nowrap"><thead class="bg-white/5 border-b border-white/10"><tr>
                <th class="p-3">ID/Waktu</th><th class="p-3">Produk</th><th class="p-3">Pembeli</th><th class="p-3">Harga</th><th class="p-3 text-center">Status</th></tr></thead><tbody>`;
            o.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,100).forEach(x=>{
                let st='badge-warn';if(x.status==='SUKSES')st='badge-ok';if(x.status==='GAGAL'||x.status==='DIBATALKAN')st='badge-err';
                h+=`<tr class="border-b border-white/5"><td class="p-3"><p class="font-mono text-[10px] text-slate-400">${x.id||x.invoiceId}</p><p class="text-xs">${x.createdAt?.replace('T',' ').substring(0,16)||'-'}</p></td>
                <td class="p-3 font-bold text-xs"><p class="truncate max-w-[200px]">${x.productName}</p><p class="text-[10px] text-slate-400 mt-0.5">Tujuan: ${x.target||'-'}</p></td>
                <td class="p-3"><p class="text-xs">${x.buyerName||'-'}</p><p class="text-[10px] text-slate-500">ID: ${x.buyerRandomId||'-'}</p></td>
                <td class="p-3 font-bold">${formatRp(x.displayPrice)}</td><td class="p-3 text-center"><span class="${st}">${x.status}</span></td></tr>`;
            });
            h+=`</tbody></table></div>`;
            container.innerHTML=h;
        }
        else if(tab==='affiliate'){
            const [usersRes, statsRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/affiliate/stats')]);
            const users = await usersRes.json();
            const stats = await statsRes.json();
            const affiliates = users.filter(u => u.isAffiliate || u.affiliatePending);
            let h = `<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Manajemen Affiliate</h2></div>`;
            if (stats.success) {
                h += `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Affiliate</p><h3 class="text-2xl font-black mt-1 text-indigo-400">${stats.totalAffiliate}</h3></div>
                    <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Pending</p><h3 class="text-2xl font-black mt-1 text-amber-400">${stats.pendingAffiliate}</h3></div>
                    <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Komisi Terbayar</p><h3 class="text-lg font-black mt-1 text-emerald-400">${formatRp(stats.totalCommissionPaid)}</h3></div>
                    <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Generated</p><h3 class="text-lg font-black mt-1 text-violet-400">${formatRp(stats.totalCommissionGenerated)}</h3></div>
                </div>`;
            }
            h += `<div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10"><tr><th class="p-3">Nama</th><th class="p-3 text-center">Status</th><th class="p-3 text-center">PPOB</th><th class="p-3 text-right">Saldo</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>`;
            affiliates.forEach(a => {
                h += `<tr class="border-b border-white/5"><td class="p-3 font-bold">${a.firstName||'-'} <br><code class="text-[10px] text-slate-400 font-normal">${a.randomId}</code></td><td class="p-3 text-center">${a.isAffiliate?'<span class="badge-ok">Aktif</span>':(a.affiliatePending?'<span class="badge-warn">Pending</span>':'<span class="badge-err">Ditolak</span>')}</td><td class="p-3 text-center">${a.upgradePPOB?'<span class="badge-ok">Ya</span>':'<span class="badge-err">Tidak</span>'}</td><td class="p-3 text-right font-bold text-emerald-400">${formatRp(a.affiliateBalance||0)}</td><td class="p-3 text-center">
                    ${a.affiliatePending&&!a.isAffiliate?`<button onclick="approveAffiliate('${a.randomId}')" class="text-xs bg-emerald-500 text-white px-2 py-1 rounded">Terima</button> <button onclick="rejectAffiliate('${a.randomId}')" class="text-xs bg-red-500 text-white px-2 py-1 rounded">Tolak</button>`:''}
                    ${a.isAffiliate?`<button onclick="togglePPOB('${a.randomId}')" class="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded mb-1 w-full">${a.upgradePPOB?'Revoke PPOB':'Upgrade PPOB'}</button><br><button onclick="editAffiliate('${a.randomId}', ${a.customCommission||0}, ${a.maxMarkup||0}, ${a.isBanned||false}, '${a.bannedReason||''}')" class="text-[10px] bg-slate-700 text-white px-2 py-1 rounded w-full hover:bg-slate-600">Edit Detail</button>`:''}
                </td></tr>`;
            });
            h += `</tbody></table></div>`;
            container.innerHTML=h;
        }
        else if(tab==='affconfig'){
            const c=await fetch('/api/admin/affiliate-config').then(r=>r.json());
            container.innerHTML=`<h2 class="text-xl font-black mb-4">Pengaturan Global Affiliate & Toko</h2>
            <div class="card p-6 max-w-2xl space-y-4">
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Status Affiliate System</label><select id="ac-enabled" class="input-dark"><option value="true" ${c.affiliateEnabled?'selected':''}>Aktif</option><option value="false" ${!c.affiliateEnabled?'selected':''}>Nonaktif</option></select></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Auto Approve Pendaftar</label><select id="ac-auto" class="input-dark"><option value="true" ${c.affiliateAutoApprove?'selected':''}>Ya (Otomatis Aktif)</option><option value="false" ${!c.affiliateAutoApprove?'selected':''}>Tidak (Perlu Review Manual)</option></select></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Komisi Default (%)</label><input type="number" id="ac-comm" class="input-dark" value="${c.affiliateCommissionPercent}"></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Batas Maksimal Markup (%)</label><input type="number" id="ac-markup" class="input-dark" value="${c.affiliateMaxMarkup}"></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Minimal Withdraw (Rp)</label><input type="number" id="ac-minwd" class="input-dark" value="${c.affiliateMinWithdraw}"></div>
                <div class="pt-4 border-t border-white/10"><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Teks Berjalan (Marquee Promo)</label><textarea id="ac-welcome" class="input-dark" rows="3" placeholder="Contoh: Selamat datang di RullzyeStore! Promo diskon 20%...">${c.affiliateWelcomeMsg||''}</textarea></div>
                <button onclick="saveAffConfig()" class="btn-primary w-full mt-4">Simpan Pengaturan</button>
            </div>`;
        }
        else if(tab==='withdraw'){
            const w=await fetch('/api/admin/withdraws').then(r=>r.json());
            let h=`<h2 class="text-xl font-black mb-4">Permintaan Withdraw</h2>
                <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10"><tr>
                <th class="p-3">Tanggal</th><th class="p-3">User ID</th><th class="p-3">Bank/E-Wallet</th><th class="p-3">Jumlah</th><th class="p-3 text-center">Status</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>`;
            w.forEach(x=>{
                let st='badge-warn';if(x.status==='SUKSES')st='badge-ok';if(x.status==='DITOLAK')st='badge-err';
                h+=`<tr class="border-b border-white/5"><td class="p-3 text-xs text-slate-400">${x.date?.substring(0,16).replace('T',' ') || '-'}</td>
                <td class="p-3 font-mono text-xs">${x.randomId}</td><td class="p-3">${x.bankDetails}</td><td class="p-3 font-bold">${formatRp(x.amount)}</td>
                <td class="p-3 text-center"><span class="${st}">${x.status}</span></td>
                <td class="p-3 text-center">${x.status==='PENDING'?`<button onclick="processWd('${x.id}','SUKSES')" class="text-xs bg-emerald-500 text-white px-2 py-1 rounded">Sukses</button> <button onclick="processWd('${x.id}','DITOLAK')" class="text-xs bg-red-500 text-white px-2 py-1 rounded">Tolak</button>`:'-'}</td></tr>`;
            });
            h+=`</tbody></table></div>`;
            container.innerHTML=h;
        }
        else if(tab==='config'){
            const c=await fetch('/api/admin/config').then(r=>r.json());
            container.innerHTML=`<h2 class="text-xl font-black mb-4">Konfigurasi API & Integrasi</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-5"><h3 class="font-bold text-violet-400 mb-3"><i class="fa-solid fa-robot"></i> Telegram Bot</h3>
                    <input type="text" id="cfg-token" class="input-dark mb-2" placeholder="Bot Token" value="${c.telegramToken||''}">
                    <input type="text" id="cfg-bot" class="input-dark" placeholder="Bot Username (tanpa @)" value="${c.botUsername||''}">
                </div>
                <div class="card p-5"><h3 class="font-bold text-amber-400 mb-3"><i class="fa-solid fa-crown"></i> Premku API</h3>
                    <input type="text" id="cfg-premku" class="input-dark mb-2" placeholder="Premku API Key" value="${c.apiKey||''}">
                    <input type="number" id="cfg-profit" class="input-dark" placeholder="Profit Produk (Rp)" value="${c.profit||2000}">
                </div>
                <div class="card p-5"><h3 class="font-bold text-emerald-400 mb-3"><i class="fa-solid fa-bolt"></i> Flowix API (PPOB)</h3>
                    <input type="text" id="cfg-flow-id" class="input-dark mb-2" placeholder="Flowix Merchant ID" value="${c.flowixMerchantId||''}">
                    <input type="text" id="cfg-flow-key" class="input-dark" placeholder="Flowix API Key" value="${c.flowixApiKey||''}">
                </div>
                <div class="card p-5"><h3 class="font-bold text-sky-400 mb-3"><i class="fa-solid fa-gamepad"></i> Celestial API (Game)</h3>
                    <input type="text" id="cfg-cel-key" class="input-dark mb-2" placeholder="Celestial API Key" value="${c.celestialApiKey||''}">
                    <input type="text" id="cfg-cel-sec" class="input-dark" placeholder="Celestial Secret Key" value="${c.celestialSecret||''}">
                </div>
                <div class="card p-5 md:col-span-2"><h3 class="font-bold text-pink-400 mb-3"><i class="fa-solid fa-users"></i> SMM Panel</h3>
                    <div class="grid grid-cols-2 gap-2"><input type="text" id="cfg-smm-key" class="input-dark" placeholder="SMM API Key" value="${c.smmApiKey||''}">
                    <input type="text" id="cfg-smm-sec" class="input-dark" placeholder="SMM Secret Key" value="${c.smmSecretKey||''}"></div>
                </div>
            </div>
            <button onclick="saveConfig()" class="btn-primary mt-4">Simpan Konfigurasi</button>`;
        }
        else if(tab==='database'){
            const s=await fetch('/api/admin/database/stats').then(r=>r.json());
            container.innerHTML=`<h2 class="text-xl font-black mb-4">Database Center</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="card p-5 border-l-4 border-violet-500">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Penyimpanan</h3>
                    <p class="text-sm mb-1 text-slate-300">Target: <code class="bg-white/10 px-2 py-0.5 rounded ml-1">${s.database.firebase}</code></p>
                    <p class="text-sm mb-1 text-slate-300">Users Size: <strong class="text-white">${Math.round(s.database.usersSize/1024)} KB</strong></p>
                    <p class="text-sm text-slate-300">Orders Size: <strong class="text-white">${Math.round(s.database.ordersSize/1024)} KB</strong></p>
                </div>
                <div class="card p-5 border-l-4 border-emerald-500">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statistik Transaksi</h3>
                    <p class="text-sm mb-1 text-slate-300">Hari ini: <strong class="text-white">${s.orders.today} pesanan</strong></p>
                    <p class="text-sm mb-1 text-slate-300">Bulan ini: <strong class="text-white">${s.orders.thisMonth} pesanan</strong></p>
                    <p class="text-sm text-slate-300">Omzet Bulan ini: <strong class="text-emerald-400">${formatRp(s.revenue.thisMonth)}</strong></p>
                </div>
            </div>
            <h3 class="font-bold text-white mb-3">Export Data</h3>
            <div class="flex flex-wrap gap-2">
                <a href="/api/admin/database/export/users" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i> Users</a>
                <a href="/api/admin/database/export/orders" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i> Orders</a>
                <a href="/api/admin/database/export/withdraws" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i> Withdraws</a>
                <a href="/api/admin/database/export/all" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i> Backup Semua</a>
            </div>`;
        }
        else if(tab==='system'){
            const s=await fetch('/api/admin/system').then(r=>r.json());
            const hrs = Math.floor(s.uptime / 3600); const mins = Math.floor((s.uptime % 3600) / 60);
            container.innerHTML=`<h2 class="text-xl font-black mb-4">Status Sistem</h2>
            <div class="card p-6 max-w-2xl">
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Server Uptime</span><strong class="text-white">${hrs} jam ${mins} menit</strong></div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Memory Usage</span><strong class="text-white">${s.memory} MB</strong></div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Node.js Version</span><strong class="text-white">${s.nodeVersion}</strong></div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Platform</span><strong class="text-white">${s.platform}</strong></div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Server Port</span><strong class="text-white">${s.port}</strong></div>
                
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3">Integrasi API</h3>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Bot Telegram</span>${s.botActive?'<span class="badge-ok">Online</span>':'<span class="badge-err">Offline / Belum diset</span>'}</div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Premku API</span>${s.premkuKey?'<span class="badge-ok">Terhubung</span>':'<span class="badge-warn">Kosong</span>'}</div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Flowix API (PPOB)</span>${s.flowixKey?'<span class="badge-ok">Terhubung</span>':'<span class="badge-warn">Kosong</span>'}</div>
                <div class="flex justify-between items-center py-2 border-b border-white/5"><span class="text-slate-400 text-sm">Celestial API (Game)</span>${s.celestialKey?'<span class="badge-ok">Terhubung</span>':'<span class="badge-warn">Kosong</span>'}</div>
            </div>`;
        }
        else if(tab==='broadcast') {
            container.innerHTML=`<h2 class="text-xl font-black mb-4">Kirim Pesan Massal (Broadcast)</h2>
            <div class="card p-6 max-w-2xl">
                <textarea id="bc-msg" rows="5" class="input-dark mb-4" placeholder="Ketik pesan yang akan dikirim ke semua pengguna bot..."></textarea>
                <button onclick="sendBroadcast()" class="btn-primary w-full"><i class="fa-solid fa-paper-plane mr-2"></i>Kirim Broadcast Sekarang</button>
                <p class="text-[10px] text-slate-500 mt-3 text-center">Catatan: Pesan akan dikirim ke semua chat ID yang terdaftar di database.</p>
            </div>`;
        }
        else if(tab==='banner'){
            const bres=await fetch('/api/banners').then(r=>r.json());
            const banners=bres.banners||[];
            let h=`<h2 class="text-xl font-black mb-4">Pengaturan Banner (Slider)</h2>
            <div class="card p-6">
                <p class="text-xs text-slate-400 mb-4">Tambahkan URL gambar (contoh: dari imgur.com) dan link tujuan jika banner di-klik.</p>
                <div id="banner-list" class="space-y-3 mb-4">`;
            banners.forEach((b,i)=>{
                h+=`<div class="flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/10">
                    <img src="${b.image}" class="w-20 h-10 object-cover rounded-lg bg-slate-800" onerror="this.src='https://placehold.co/400x200?text=Error'">
                    <div class="flex-grow space-y-1">
                        <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-img" value="${b.image}" placeholder="URL Gambar">
                        <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-link" value="${b.link||''}" placeholder="Link Tujuan (Opsional)">
                    </div>
                    <button onclick="this.parentElement.remove()" class="bg-red-500/20 text-red-400 w-8 h-8 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            });
            h+=`</div>
                <button onclick="addBannerRow()" class="w-full bg-white/5 border border-white/10 border-dashed text-slate-400 font-bold py-2 rounded-xl text-xs hover:bg-white/10 hover:text-white transition mb-4"><i class="fa-solid fa-plus mr-1"></i> Tambah Banner</button>
                <button onclick="saveBanners()" class="btn-primary w-full">Simpan Banner</button>
            </div>
            <script>
                function addBannerRow(){
                    const div=document.createElement('div');
                    div.className='flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/10';
                    div.innerHTML=\`<img src="" class="w-20 h-10 object-cover rounded-lg bg-slate-800" onerror="this.src='https://placehold.co/400x200?text=No+Img'">
                    <div class="flex-grow space-y-1">
                        <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-img" placeholder="URL Gambar" oninput="this.parentElement.previousElementSibling.src=this.value">
                        <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-link" placeholder="Link Tujuan (Opsional)">
                    </div>
                    <button onclick="this.parentElement.remove()" class="bg-red-500/20 text-red-400 w-8 h-8 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i></button>\`;
                    document.getElementById('banner-list').appendChild(div);
                }
                async function saveBanners(){
                    const rows=document.querySelectorAll('#banner-list > div');
                    const banners=[];
                    rows.forEach(r=>{
                        const img=r.querySelector('.b-img').value.trim();
                        const link=r.querySelector('.b-link').value.trim();
                        if(img) banners.push({image:img, link:link});
                    });
                    const res=await fetch('/api/admin/banners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({banners})});
                    const d=await res.json();
                    if(d.success) alert('Banner berhasil disimpan!'); else alert('Gagal menyimpan banner.');
                }
            </script>`;
            container.innerHTML=h;
        }
    } catch(e){ container.innerHTML=`<p class="text-red-400 text-center py-10">Error memuat data: ${e.message}</p>`; }
}

async function saveConfig() {
    try {
        const d = {
            telegramToken: document.getElementById('cfg-token').value,
            botUsername: document.getElementById('cfg-bot').value,
            apiKey: document.getElementById('cfg-premku').value,
            profit: parseInt(document.getElementById('cfg-profit').value),
            flowixMerchantId: document.getElementById('cfg-flow-id').value,
            flowixApiKey: document.getElementById('cfg-flow-key').value,
            celestialApiKey: document.getElementById('cfg-cel-key').value,
            celestialSecret: document.getElementById('cfg-cel-sec').value,
            smmApiKey: document.getElementById('cfg-smm-key').value,
            smmSecretKey: document.getElementById('cfg-smm-sec').value,
        };
        const res = await fetch('/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
        const json = await res.json();
        alert(json.message || 'Konfigurasi disimpan!');
    } catch(e) {
        alert("Gagal menghubungi server. Pastikan server aktif dan coba lagi. Detail: " + e.message);
    }
}

async function saveAffConfig() {
    const d = {
        affiliateEnabled: document.getElementById('ac-enabled').value==='true',
        affiliateAutoApprove: document.getElementById('ac-auto').value==='true',
        affiliateCommissionPercent: parseInt(document.getElementById('ac-comm').value),
        affiliateMaxMarkup: parseInt(document.getElementById('ac-markup').value),
        affiliateMinWithdraw: parseInt(document.getElementById('ac-minwd').value),
        affiliateWelcomeMsg: document.getElementById('ac-welcome').value.trim()
    };
    await fetch('/api/admin/affiliate-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    alert('Pengaturan Affiliate Global & Toko disimpan!');
}

window.deleteUser = async function(rid) {
    if(!confirm('Yakin ingin menghapus user ini?')) return;
    await fetch('/api/admin/users/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    loadTab('users');
};

window.approveAffiliate = async function(rid) {
    if(!confirm('Setujui affiliate ini?')) return;
    await fetch('/api/admin/affiliate/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    loadTab('affiliate');
};
window.rejectAffiliate = async function(rid) {
    const r = prompt('Alasan penolakan:');
    await fetch('/api/admin/affiliate/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid,reason:r||''})});
    loadTab('affiliate');
};
window.togglePPOB = async function(rid) {
    await fetch('/api/admin/affiliate/toggle-ppob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    loadTab('affiliate');
};
window.processWd = async function(id, st) {
    if(!confirm(`Proses withdraw menjadi ${st}?`)) return;
    await fetch('/api/admin/withdraw/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:st})});
    loadTab('withdraw');
};
window.sendBroadcast = async function() {
    const m=document.getElementById('bc-msg').value.trim();
    if(!m) return alert('Pesan kosong!');
    document.querySelector('#tab-content button').disabled=true;
    try {
        const r=await fetch('/api/admin/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})});
        const d=await r.json();
        alert(d.message);
    } catch(e) { alert('Gagal mengirim broadcast'); }
    loadTab('dashboard');
};

window.editAffiliate = async function(rid, comm, markup, banned, reason) {
    const p = prompt(`Update Data Affiliate (Format: Komisi,MaxMarkup,IsBanned)\nContoh: 25,150,false\n\nData saat ini: ${comm},${markup},${banned}`);
    if(p) {
        const parts = p.split(',');
        if(parts.length>=3) {
            const b={randomId:rid, commissionPercent:parts[0], maxMarkup:parts[1], isBanned:(parts[2].trim()==='true')};
            await fetch('/api/admin/affiliate/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
            loadTab('affiliate');
        } else { alert('Format salah!'); }
    }
};
