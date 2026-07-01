let currentAuth='';
let adminRole='';
let adminPermissions=[];
let adminUsername='';
const formatRp=n=>'Rp '+parseInt(n||0).toLocaleString('id-ID');
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open')}

async function checkPin(){
    const p=document.getElementById('pinInput').value;
    const u=document.getElementById('adminUsername').value.trim();
    document.getElementById('loginError').classList.add('hidden');
    try {
        const res=await fetch('/api/admin/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,pin:p})});
        const data=await res.json();
        if(data.success){
            currentAuth=u+':'+p;
            adminRole=data.role;
            adminUsername=data.username||u||'Super Admin';
            adminPermissions=data.permissions||[];
            localStorage.setItem('adminAuth',currentAuth);
            localStorage.setItem('adminRole',adminRole);
            localStorage.setItem('adminUsername',adminUsername);
            localStorage.setItem('adminPermissions',JSON.stringify(adminPermissions));
            document.getElementById('pinOverlay').style.display='none';
            document.getElementById('sidebar').style.display='flex';
            document.getElementById('mainContent').style.display='block';
            document.getElementById('adminRoleBadge').innerText=adminRole==='super_admin'?'👑 Super Admin':'🔑 Admin — '+adminUsername;
            document.querySelectorAll('.admin-only').forEach(el=>el.style.display=adminRole==='super_admin'?'':'none');
            loadTab('dashboard');
        } else {
            document.getElementById('loginError').innerText='❌ '+data.message;
            document.getElementById('loginError').classList.remove('hidden');
        }
    } catch(e){ document.getElementById('loginError').innerText='❌ Gagal terhubung ke server.'; document.getElementById('loginError').classList.remove('hidden'); }
}
// Auto-restore session from localStorage
(function(){
    const savedAuth=localStorage.getItem('adminAuth');
    if(savedAuth){
        currentAuth=savedAuth;
        adminRole=localStorage.getItem('adminRole')||'';
        adminUsername=localStorage.getItem('adminUsername')||'';
        adminPermissions=localStorage.getItem('adminPermissions')?JSON.parse(localStorage.getItem('adminPermissions')):[];
        document.getElementById('pinOverlay').style.display='none';
        document.getElementById('sidebar').style.display='flex';
        document.getElementById('mainContent').style.display='block';
        document.getElementById('adminRoleBadge').innerText=adminRole==='super_admin'?'👑 Super Admin':'🔑 Admin — '+adminUsername;
        document.querySelectorAll('.admin-only').forEach(el=>el.style.display=adminRole==='super_admin'?'':'none');
        loadTab('dashboard');
    }
})();

// ================= ADMIN MANAGEMENT =================
async function addAdmin(){
    const username=document.getElementById('adm-username').value.trim();
    const pin=document.getElementById('adm-pin').value.trim();
    const perms=document.getElementById('adm-perms').value.trim().split(',').map(s=>s.trim()).filter(Boolean);
    if(!username||!pin) return showToast('Username dan PIN wajib diisi!','error');
    const r=await api('/api/admin/admins/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,pin,permissions:perms})});
    const d=await r.json();
    if(d.success){showToast('Admin ditambahkan!');loadTab('admins');} else showToast(d.message||'Gagal','error');
}
async function editAdmin(id){
    const r=await api('/api/admin/admins').then(r=>r.json());
    const a=(r.admins||[]).find(x=>x.id===id);
    if(!a) return showToast('Admin tidak ditemukan.','error');
    const np=prompt('PIN baru (kosongkan jika tidak diubah):',a.pin);
    if(np===null) return;
    const nu=prompt('Username baru:',a.username)||a.username;
    const nperms=prompt('Izin (pisahkan koma):',(a.permissions||[]).join(','));
    if(nperms===null) return;
    const perms=nperms.split(',').map(s=>s.trim()).filter(Boolean);
    const res=await api('/api/admin/admins/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,username:nu,pin:np,permissions:perms})});
    const d=await res.json();
    if(d.success){showToast('Admin diperbarui!');loadTab('admins');} else showToast(d.message||'Gagal','error');
}
async function deleteAdmin(id){
    if(!confirm('Hapus admin ini?')) return;
    const r=await api('/api/admin/admins/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    const d=await r.json();
    if(d.success){showToast('Admin dihapus!');loadTab('admins');} else showToast(d.message||'Gagal','error');
}

function api(path, options={}) {
    if (!options.headers) options.headers={};
    options.headers['x-admin-auth']=currentAuth;
    return fetch(path, options);
}

document.querySelectorAll('.menu-item').forEach(m=>{
    m.addEventListener('click',e=>{
        document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        loadTab(e.currentTarget.dataset.tab);
        if(window.innerWidth<768) toggleSidebar();
    });
});

function truncate(txt,len=200){return txt?.length>len?txt.substring(0,len)+'...':txt||'-'}

// ==================== TOAST SYSTEM ====================
function showToast(message, type='success'){
    const colors={success:'bg-emerald-600',error:'bg-red-600',warning:'bg-amber-600',info:'bg-violet-600'};
    const icons={success:'fa-check-circle',error:'fa-times-circle',warning:'fa-exclamation-triangle',info:'fa-info-circle'};
    const t=document.createElement('div');
    t.className=`fixed top-5 right-5 z-[9999] ${colors[type]||colors.success} text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold transition-all duration-300`;
    t.style.transform='translateX(120%)';t.style.opacity='0';
    t.innerHTML=`<i class="fa-solid ${icons[type]||icons.success}"></i> ${message}`;
    document.body.appendChild(t);
    requestAnimationFrame(()=>{t.style.transform='translateX(0)';t.style.opacity='1';});
    setTimeout(()=>{t.style.transform='translateX(120%)';t.style.opacity='0';setTimeout(()=>t.remove(),300);},3500);
}
// ==================== PAGINATION STATE ====================
const pagState={users:{page:1,perPage:50},orders:{page:1,perPage:50}};

// ==================== LOGOUT ====================
window.logout=function(){
    if(!confirm('Yakin ingin logout?')) return;
    currentAuth='';adminRole='';adminPermissions=[];adminUsername='';
    localStorage.removeItem('adminAuth');localStorage.removeItem('adminRole');localStorage.removeItem('adminUsername');localStorage.removeItem('adminPermissions');
    document.getElementById('pinOverlay').style.display='flex';
    document.getElementById('sidebar').style.display='none';
    document.getElementById('mainContent').style.display='none';
    document.getElementById('pinInput').value='';
    document.getElementById('adminUsername').value='';
    showToast('Berhasil logout');
};

async function loadTab(tab){
    const c=document.getElementById('tab-content');
    c.innerHTML='<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-3xl text-violet-500"></i><p class="mt-2 text-slate-400 text-sm">Memuat data...</p></div>';
    // Permission map: tab name → required permission
    const permMap={orders:'orders',withdraw:'withdraws',withdraws:'withdraws',users:'users',affiliate:'users',affconfig:'config',products:'products',config:'config',broadcast:'broadcast',security:'settings',groups:'settings',botstatus:'settings',admins:'admins',database:'settings',system:'settings',checkip:'settings',resellers:'users'};
    const reqPerm=permMap[tab];
    if(reqPerm && adminRole!=='super_admin' && !adminPermissions.includes(reqPerm)){
        c.innerHTML=`<div class="text-center py-20"><i class="fa-solid fa-lock text-4xl text-slate-600 mb-4"></i><p class="text-slate-500 text-sm">Akses ditolak. Tidak ada izin untuk menu ini.</p></div>`;
        // Reset active tab to previous
        document.querySelectorAll('.menu-item').forEach(m=>{if(m.dataset.tab===tab) m.classList.remove('active');});
        return;
    }
    try{
        // =============== 1. DASHBOARD (with chart) ===============
        if(tab==='dashboard'){
            const [users,orders,statsRes,wdRes]=await Promise.all([
                api('/api/admin/users').then(r=>r.json()),
                api('/api/admin/orders').then(r=>r.json()),
                api('/api/admin/database/stats').then(r=>r.json()).catch(()=>({})),
                api('/api/admin/withdraws').then(r=>r.json())
            ]);
            const sukses=orders.filter(x=>x.status==='SUKSES');
            const rev=sukses.reduce((s,x)=>s+(x.displayPrice||0),0);
            const pendingWd=wdRes.filter(w=>w.status==='PENDING');
            const today=orders.filter(o=>(o.createdAt||'').startsWith(new Date().toISOString().slice(0,10)));
            const aff=users.filter(u=>u.isAffiliate);
            const revMonth=statsRes.revenue?.thisMonth||0;
            const commTotal=statsRes.affiliate?.totalCommission||0;
            // Revenue by month for chart
            const byMonth={};
            const monthNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            sukses.forEach(o=>{
                const m=(o.completedAt||o.createdAt||'').substring(0,7);
                if(m){byMonth[m]=(byMonth[m]||0)+(o.displayPrice||0);}
            });
            const sortedMonths=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b));
            const maxRev=Math.max(...sortedMonths.map(([,v])=>v),1);
            const chartBars=sortedMonths.map(([m,v])=>{
                const pct=(v/maxRev*100).toFixed(1);
                const shortM=monthNames[parseInt(m.substring(5,7))-1]||m;
                return `<div class="flex flex-col items-center gap-1" style="flex:1">
                    <span class="text-[8px] text-slate-400 font-bold">${formatRp(v).replace('Rp ','')}</span>
                    <div class="w-full bg-white/5 rounded-full relative" style="height:60px">
                        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-violet-600 to-purple-500 rounded-full transition-all duration-500" style="height:${pct}%"></div>
                    </div>
                    <span class="text-[9px] text-slate-500">${shortM}</span>
                </div>`;
            }).join('');
            c.innerHTML=`<h2 class="text-2xl font-black mb-6">Dashboard Utama</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Total User</p><h3 class="text-2xl font-black mt-1 text-white">${users.length}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Order</p><h3 class="text-2xl font-black mt-1 text-white">${orders.length}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Order Hari Ini</p><h3 class="text-2xl font-black mt-1 text-sky-400">${today.length}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Order Sukses</p><h3 class="text-2xl font-black mt-1 text-emerald-400">${sukses.length}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Pendapatan Kotor</p><h3 class="text-xl font-black mt-1 text-violet-400">${formatRp(rev)}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Omzet Bulan Ini</p><h3 class="text-xl font-black mt-1 text-amber-400">${formatRp(revMonth)}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Affiliate Aktif</p><h3 class="text-2xl font-black mt-1 text-indigo-400">${aff.length}</h3></div>
                <div class="card stat-card"><p class="text-[10px] text-slate-400 uppercase font-bold">Komisi Teralokasi</p><h3 class="text-xl font-black mt-1 text-rose-400">${formatRp(commTotal)}</h3></div>
            </div>
            ${sortedMonths.length>1?`<div class="card p-4 mb-6"><h3 class="font-bold text-sm text-white mb-4"><i class="fa-solid fa-chart-bar text-violet-400 mr-2"></i>Revenue Per Bulan</h3>
                <div class="flex items-end gap-1 px-2 pt-4 pb-2">${chartBars}</div>
            </div>`:''}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="card p-4"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-clock text-amber-400 mr-2"></i>Withdraw Pending</h3>
                    ${pendingWd.length?pendingWd.slice(0,5).map(w=>`<div class="flex justify-between items-center py-1.5 border-b border-white/5 text-xs"><span class="text-slate-400">${w.bankDetails}</span><span class="font-bold text-amber-400">${formatRp(w.amount)}</span></div>`).join(''):'<p class="text-xs text-slate-500">Tidak ada withdraw pending.</p>'}
                    ${pendingWd.length>5?`<a href="#" onclick="loadTab('withdraw');return false" class="text-[10px] text-violet-400 mt-2 block">+${pendingWd.length-5} lagi</a>`:''}
                </div>
                <div class="card p-4"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-trophy text-emerald-400 mr-2"></i>Top Affiliate</h3>
                    ${aff.sort((a,b)=>(b.totalEarned||0)-(a.totalEarned||0)).slice(0,5).map(a=>`<div class="flex justify-between items-center py-1.5 border-b border-white/5 text-xs"><span class="text-white">${a.affiliateName||a.firstName}</span><span class="font-bold text-emerald-400">${formatRp(a.totalEarned||0)}</span></div>`).join('')}
                    ${aff.length===0?'<p class="text-xs text-slate-500">Belum ada affiliate.</p>':''}
                </div>
            </div>`;
        }
        // =============== 2. USERS (with pagination) ===============
        else if(tab==='users'){
            const u=await api('/api/admin/users').then(r=>r.json());
            const total=u.length;
            const ps=pagState.users;
            const totalPages=Math.ceil(total/ps.perPage)||1;
            if(ps.page>totalPages) ps.page=totalPages;
            const start=(ps.page-1)*ps.perPage;
            const pageUsers=u.slice(start,start+ps.perPage);
            let h=`<div class="flex flex-wrap items-center gap-2 mb-4"><h2 class="text-xl font-black">Manajemen Pengguna (${total})</h2>
                <div class="flex gap-2 ml-auto">
                    <button onclick="showCreateUserModal()" class="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i>Buat User</button>
                    <button onclick="showUserSearchModal()" class="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg"><i class="fa-solid fa-search mr-1"></i>Cari</button>
                </div>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">Nama</th><th class="p-2.5 text-[10px]">ID</th><th class="p-2.5 text-[10px]">ChatID</th><th class="p-2.5 text-[10px] text-center">Role</th><th class="p-2.5 text-[10px] text-right">Saldo</th><th class="p-2.5 text-[10px] text-right">Komisi</th><th class="p-2.5 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            pageUsers.forEach(x=>{
                h+=`<tr class="border-b border-white/5"><td class="p-2.5 font-bold text-xs">${x.firstName||'-'}</td>
                <td class="p-2.5"><code class="text-[10px] text-violet-300">${x.randomId||'-'}</code></td>
                <td class="p-2.5 font-mono text-[10px] text-slate-400">${x.chatId||'-'}</td>
                <td class="p-2.5 text-center">${x.isAffiliate?'<span class="badge-ok">AFF</span>':x.isReseller?'<span class="badge-ok">RSL</span>':'<span class="badge-warn">MBR</span>'}</td>
                <td class="p-2.5 text-right font-bold text-emerald-400 text-xs">${formatRp(x.balance)}</td>
                <td class="p-2.5 text-right font-bold text-violet-400 text-xs">${formatRp(x.affiliateBalance)}</td>
                <td class="p-2.5 text-center">
                    <button onclick="showEditUserModal('${x.randomId}')" class="text-[10px] bg-sky-600/20 text-sky-400 px-2 py-1 rounded hover:bg-sky-600 hover:text-white mr-1"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteUser('${x.randomId}')" class="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500 hover:text-white"><i class="fa-solid fa-trash"></i></button>
                </td></tr>`;
            });
            h+=`</tbody></table></div>
            <div class="flex justify-between items-center mt-3 text-xs text-slate-400">
                <span>Halaman ${ps.page} dari ${totalPages} (${total} total)</span>
                <div class="flex gap-1">
                    <button onclick="paginateUsers(${ps.page-1})" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 ${ps.page<=1?'opacity-30 pointer-events-none':''}"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="paginateUsers(${ps.page+1})" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 ${ps.page>=totalPages?'opacity-30 pointer-events-none':''}"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>`;
            c.innerHTML=h;
        }
        // =============== 3. ORDERS (with pagination) ===============
        else if(tab==='orders'){
            const o=await api('/api/admin/orders').then(r=>r.json());
            o.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
            const f=document.getElementById('orderFilter')?.value||'all';
            const filtered=f==='all'?o:o.filter(x=>x.status===f);
            const total=filtered.length;
            const ps=pagState.orders;
            const totalPages=Math.ceil(total/ps.perPage)||1;
            if(ps.page>totalPages) ps.page=totalPages;
            const start=(ps.page-1)*ps.perPage;
            const pageOrders=filtered.slice(start,start+ps.perPage);
            let h=`<div class="flex flex-wrap items-center gap-2 mb-4"><h2 class="text-xl font-black">Pesanan (${o.length})</h2>
                <select id="orderFilter" onchange="pagState.orders.page=1;loadTab('orders')" class="input-dark text-xs py-1.5 w-auto">
                    <option value="all" ${f==='all'?'selected':''}>Semua</option><option value="SUKSES" ${f==='SUKSES'?'selected':''}>Sukses</option><option value="PROSES_PUSAT" ${f==='PROSES_PUSAT'?'selected':''}>Proses</option><option value="MENUNGGU_BAYAR" ${f==='MENUNGGU_BAYAR'?'selected':''}>Pending</option><option value="GAGAL" ${f==='GAGAL'?'selected':''}>Gagal</option>
                </select>
                <span class="text-xs text-slate-500 ml-auto">${filtered.length} dari ${o.length} pesanan</span>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">Waktu</th><th class="p-2.5 text-[10px]">Produk</th><th class="p-2.5 text-[10px]">Target</th><th class="p-2.5 text-[10px] text-right">Harga</th><th class="p-2.5 text-[10px] text-center">Status</th><th class="p-2.5 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            pageOrders.forEach(x=>{
                let st='badge-warn';if(x.status==='SUKSES')st='badge-ok';if(x.status==='GAGAL'||x.status==='DIBATALKAN')st='badge-err';
                h+=`<tr class="border-b border-white/5"><td class="p-2.5 text-[10px] text-slate-400">${x.createdAt?.substring(0,16).replace('T',' ')||'-'}</td>
                <td class="p-2.5 font-bold text-xs max-w-[140px] truncate">${x.productName||'-'}</td>
                <td class="p-2.5 text-[10px]">${x.targetPhone||x.target||'-'}</td>
                <td class="p-2.5 text-right font-bold text-xs">${formatRp(x.displayPrice)}</td>
                <td class="p-2.5 text-center"><span class="${st}">${x.status}</span></td>
                <td class="p-2.5 text-center">
                    ${x.status==='PROSES_PUSAT'?`<button onclick="forceOrderStatus('${x.idDeposit||x.idOrder}','SUKSES')" class="text-[10px] bg-emerald-600 px-2 py-0.5 rounded hover:bg-emerald-500 mr-1">S</button>`:''}
                    ${x.status==='MENUNGGU_BAYAR'||x.status==='PROSES_PUSAT'?`<button onclick="forceOrderStatus('${x.idDeposit||x.idOrder}','GAGAL')" class="text-[10px] bg-red-600 px-2 py-0.5 rounded hover:bg-red-500">X</button>`:''}
                </td></tr>`;
            });
            h+=`</tbody></table></div>
            <div class="flex justify-between items-center mt-3 text-xs text-slate-400">
                <span>Halaman ${ps.page} dari ${totalPages} (${total} ditampilkan)</span>
                <div class="flex gap-1">
                    <button onclick="paginateOrders(${ps.page-1})" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 ${ps.page<=1?'opacity-30 pointer-events-none':''}"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="paginateOrders(${ps.page+1})" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 ${ps.page>=totalPages?'opacity-30 pointer-events-none':''}"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>`;
            c.innerHTML=h;
        }
        // =============== 4. FINANCIAL REPORTS (with chart) ===============
        else if(tab==='reports'){
            const [orders,wdRes]=await Promise.all([api('/api/admin/orders').then(r=>r.json()),api('/api/admin/withdraws').then(r=>r.json())]);
            const sukses=orders.filter(x=>x.status==='SUKSES');
            const totalRev=sukses.reduce((s,x)=>s+(x.displayPrice||0),0);
            const totalComm=sukses.reduce((s,x)=>s+(x.affiliateCommission||0),0);
            const totalWdPaid=wdRes.filter(w=>w.status==='SUKSES').reduce((s,w)=>s+(w.amount||0),0);
            const netProfit=totalRev-totalComm-totalWdPaid;
            const byMonth={};
            const monthNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            sukses.forEach(o=>{
                const m=(o.completedAt||o.createdAt||'').substring(0,7);
                if(m){byMonth[m]=(byMonth[m]||0)+(o.displayPrice||0);}
            });
            const sortedMonths=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b));
            const maxRev=Math.max(...sortedMonths.map(([,v])=>v),1);
            const chartBars=sortedMonths.map(([m,v])=>{
                const pct=(v/maxRev*100).toFixed(1);
                const label=monthNames[parseInt(m.substring(5,7))-1]+' '+m.substring(0,4);
                return `<div class="flex flex-col items-center gap-1" style="flex:1">
                    <span class="text-[8px] text-slate-400 font-bold">${formatRp(v).replace('Rp ','')}</span>
                    <div class="w-full bg-white/5 rounded-full relative" style="height:60px">
                        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-violet-600 to-purple-500 rounded-full transition-all duration-500" style="height:${pct}%"></div>
                    </div>
                    <span class="text-[9px] text-slate-500">${label}</span>
                </div>`;
            }).join('');
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Laporan Keuangan</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Revenue</p><h3 class="text-lg font-black mt-1 text-emerald-400">${formatRp(totalRev)}</h3></div>
                <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Komisi</p><h3 class="text-lg font-black mt-1 text-amber-400">${formatRp(totalComm)}</h3></div>
                <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Total WD Terbayar</p><h3 class="text-lg font-black mt-1 text-red-400">${formatRp(totalWdPaid)}</h3></div>
                <div class="card p-4 text-center"><p class="text-[10px] text-slate-400 uppercase font-bold">Estimasi Laba</p><h3 class="text-lg font-black mt-1 text-violet-400">${formatRp(netProfit)}</h3></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="card p-4"><h3 class="font-bold text-sm text-white mb-4"><i class="fa-solid fa-chart-bar text-violet-400 mr-2"></i>Revenue Per Bulan</h3>
                    ${sortedMonths.length>0?`<div class="flex items-end gap-1 px-2 pt-4 pb-2">${chartBars}</div>`:'<p class="text-xs text-slate-500">Belum ada data.</p>'}
                </div>
                <div class="card p-4"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-list text-slate-400 mr-2"></i>Rincian Bulanan</h3>
                    <div class="space-y-1 max-h-64 overflow-y-auto">${sortedMonths.reverse().map(([m,v])=>{
                        const label=monthNames[parseInt(m.substring(5,7))-1]+' '+m.substring(0,4);
                        return `<div class="flex justify-between items-center py-1.5 border-b border-white/5 text-xs"><span class="text-white">${label}</span><span class="font-bold text-emerald-400">${formatRp(v)}</span></div>`;
                    }).join('')}</div>
                </div>
            </div>`;
        }
        // =============== 5. PRODUCTS (Mixed) ===============
        else if(tab==='products'){
            const r=await fetch('/api/mixed-products').then(r=>r.json());
            const p=r.products||[];
            let h=`<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Semua Produk (${p.length})</h2>
                <button onclick="refreshProducts()" class="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg"><i class="fa-solid fa-rotate mr-1"></i>Refresh</button>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">ID</th><th class="p-2.5 text-[10px]">Nama</th><th class="p-2.5 text-[10px] text-right">Harga</th><th class="p-2.5 text-[10px] text-center">Stok</th><th class="p-2.5 text-[10px] text-center">Source</th></tr></thead><tbody>`;
            p.slice(0,300).forEach(x=>{
                h+=`<tr class="border-b border-white/5"><td class="p-2.5 text-[10px] font-mono text-slate-400">${x.id}</td>
                <td class="p-2.5 font-bold text-xs max-w-[200px] truncate">${x.name||'-'}</td>
                <td class="p-2.5 text-right font-bold text-xs">${formatRp(x.price)}</td>
                <td class="p-2.5 text-center"><span class="${x.stock>0?'badge-ok':'badge-err'}">${x.stock}</span></td>
                <td class="p-2.5 text-center text-[10px]">${x.source||'-'}</td></tr>`;
            });
            h+=`</tbody></table></div>`;
            c.innerHTML=h;
        }
        // =============== 6. BADGE SETTINGS ===============
        else if(tab==='badge'){
            const r=await api('/api/admin/badge-settings').then(r=>r.json());
            const bd=r.data||{};
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Pengaturan Badge Produk</h2>
            <div class="card p-6 max-w-2xl">
                <p class="text-xs text-slate-400 mb-4">Atur badge khusus untuk produk tertentu (format: JSON dengan key = ID produk, value = teks badge).</p>
                <textarea id="badgeData" rows="12" class="input-dark font-mono text-xs mb-4">${JSON.stringify(bd,null,2)}</textarea>
                <button onclick="saveBadges()" class="btn-primary w-full">Simpan Badge</button>
            </div>`;
        }
        // =============== 7. PROMO ===============
        else if(tab==='promo'){
            const [promos, productsRes] = await Promise.all([
                api('/api/admin/promos').then(r=>r.json()),
                fetch('/api/products').then(r=>r.json()).catch(()=>({products:[]}))
            ]);
            const list = promos.promos||[];
            const premkuProds = (productsRes.products||[]).filter(p => !p.id.toString().startsWith('PPOB'));
            let h=`<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Promo & Diskon</h2>
                <button onclick="showPromoForm(null)" class="btn-primary text-xs"><i class="fa-solid fa-plus"></i> Promo Baru</button></div>`;
            if (list.length===0) h+=`<div class="card p-6 text-center"><i class="fa-solid fa-tags text-3xl text-slate-600 mb-3"></i><p class="text-slate-500 text-sm">Belum ada promo. Klik "Promo Baru" untuk membuat.</p></div>`;
            else {
                h+=`<div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                    <tr><th class="p-2 text-[10px]">Nama</th><th class="p-2 text-[10px]">Tipe</th><th class="p-2 text-[10px]">Target</th><th class="p-2 text-[10px]">Masa</th><th class="p-2 text-[10px] text-center">Pemakaian</th><th class="p-2 text-[10px] text-center">Aktif</th><th class="p-2 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
                list.forEach(p=>{
                    const tipeMap={qty_discount:'Qty Diskon',bogo_same:'BOGO Sama',bogo_diff:'BOGO Beda'};
                    const tCount = p.targetProductIds?.length||0;
                    const usedPct = p.maxUses ? Math.round((p.usedCount||0)/p.maxUses*100) : 0;
                    h+=`<tr class="border-b border-white/5">
                        <td class="p-2 text-xs font-bold">${p.name}</td>
                        <td class="p-2 text-[10px]">${tipeMap[p.type]||p.type}</td>
                        <td class="p-2 text-[10px]">${tCount ? tCount+' produk' : 'Semua'}</td>
                        <td class="p-2 text-[10px]">${(p.startDate||'').substring(0,10)} — ${(p.endDate||'').substring(0,10)}</td>
                        <td class="p-2 text-center text-[10px]">${p.usedCount||0}/${p.maxUses||'∞'} <span class="text-[8px] text-slate-500">(${usedPct}%)</span></td>
                        <td class="p-2 text-center">${p.active?'<span class="badge-ok">Aktif</span>':'<span class="badge-err">Nonaktif</span>'}</td>
                        <td class="p-2 text-center">
                            <button onclick="showPromoForm('${p.id}')" class="text-[10px] bg-sky-600 px-2 py-0.5 rounded mr-1">Edit</button>
                            <button onclick="deletePromo('${p.id}')" class="text-[10px] bg-red-600 px-2 py-0.5 rounded">Hapus</button>
                            <button onclick="togglePromo('${p.id}')" class="text-[10px] ${p.active?'bg-amber-600':'bg-emerald-600'} px-2 py-0.5 rounded">${p.active?'Nonaktifkan':'Aktifkan'}</button>
                        </td></tr>`;
                });
                h+=`</tbody></table></div>`;
            }
            c.innerHTML=h;
            window._premkuProds = premkuProds;
        }
        // =============== 8. PPOB PRODUCTS ===============
        else if(tab==='ppob'){
            const r=await fetch('/api/ppob-products-debug').then(r=>r.json());
            const pp=r.data||r.products||[];
            let h=`<h2 class="text-xl font-black mb-4">Produk PPOB/Flowix</h2>
            <div class="card p-4 mb-4 text-xs"><span class="text-slate-400">Status: </span>${r.success?'<span class="badge-ok">Terhubung</span>':'<span class="badge-err">Gagal</span>'} ${r.message||''}
                <button onclick="loadTab('ppob')" class="ml-3 text-violet-400"><i class="fa-solid fa-rotate"></i></button>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2 text-[10px]">Code</th><th class="p-2 text-[10px]">Nama</th><th class="p-2 text-[10px] text-right">Harga</th><th class="p-2 text-[10px] text-center">Brand</th></tr></thead><tbody>`;
            (Array.isArray(pp)?pp:[]).slice(0,200).forEach(x=>{h+=`<tr class="border-b border-white/5"><td class="p-2 text-[10px] font-mono">${x.code||x.id||'-'}</td><td class="p-2 text-xs font-bold max-w-[160px] truncate">${x.name||'-'}</td><td class="p-2 text-right text-xs">${formatRp(x.price)}</td><td class="p-2 text-center text-[10px]">${x.brand||'-'}</td></tr>`;});
            h+=`</tbody></table></div>`;
            c.innerHTML=h;
        }
        // =============== 8. PANEL PRODUK ===============
        else if(tab==='panel'){
            const [prodRes, orderRes] = await Promise.all([
                api('/api/admin/panel/products').then(r=>r.json()),
                api('/api/admin/panel/orders').then(r=>r.json())
            ]);
            const products = prodRes.products||[];
            const orders = orderRes.orders||[];
            let phtml = `<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Panel Produk</h2><button onclick="loadTab('panel')" class="text-violet-400"><i class="fa-solid fa-rotate"></i></button></div>`;
            phtml += `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="card stat-card p-3"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Produk</p><h3 class="text-2xl font-black mt-1 text-white">${products.length}</h3></div>
                <div class="card stat-card p-3"><p class="text-[10px] text-slate-400 uppercase font-bold">Total Order</p><h3 class="text-2xl font-black mt-1 text-white">${orders.length}</h3></div>
                <div class="card stat-card p-3"><p class="text-[10px] text-slate-400 uppercase font-bold">Menunggu Kirim</p><h3 class="text-2xl font-black mt-1 text-amber-400">${orders.filter(o=>o.status==='MENUNGGU_PENGIRIMAN').length}</h3></div>
                <div class="card stat-card p-3"><p class="text-[10px] text-slate-400 uppercase font-bold">Terkirim</p><h3 class="text-2xl font-black mt-1 text-emerald-400">${orders.filter(o=>o.status==='DELIVERED').length}</h3></div>
            </div>`;
            phtml += `<div class="card p-4 mb-4"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-box mr-2"></i>Daftar Produk</h3>
            <div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2 text-[10px]">Nama</th><th class="p-2 text-[10px] text-right">Harga</th><th class="p-2 text-[10px] text-right">Stok</th><th class="p-2 text-[10px] text-center">RAM</th><th class="p-2 text-[10px] text-center">CPU</th><th class="p-2 text-[10px] text-center">Disk</th><th class="p-2 text-[10px] text-center">Aktif</th><th class="p-2 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            products.forEach(p=>{
                phtml += `<tr class="border-b border-white/5"><td class="p-2 text-xs font-bold">${p.name||'-'}</td>
                <td class="p-2 text-right text-xs">${formatRp(p.price)}</td>
                <td class="p-2 text-right text-xs">${p.stock}</td>
                <td class="p-2 text-center text-xs">${p.ram||0} GB</td>
                <td class="p-2 text-center text-xs">${p.cpu||0}%</td>
                <td class="p-2 text-center text-xs">${p.storage||0} GB</td>
                <td class="p-2 text-center">${p.active!==false?'<span class="badge-ok">Ya</span>':'<span class="badge-err">Tidak</span>'}</td>
                <td class="p-2 text-center"><button onclick="editPanelProduct('${p.id}')" class="text-[10px] bg-sky-600 px-2 py-0.5 rounded mr-1">Edit</button><button onclick="deletePanelProduct('${p.id}')" class="text-[10px] bg-red-600 px-2 py-0.5 rounded">Hapus</button></td></tr>`;
            });
            phtml += `</tbody></table></div>
            <button onclick="showAddPanelProduct()" class="btn-primary mt-3 text-xs"><i class="fa-solid fa-plus"></i> Tambah Produk Panel</button></div>`;
            // Order list with delivery
            phtml += `<div class="card p-4"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-list-check mr-2"></i>Order Panel</h3>
            <div class="overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2 text-[10px]">Invoice</th><th class="p-2 text-[10px]">Produk</th><th class="p-2 text-[10px] text-right">Total</th><th class="p-2 text-[10px]">Buyer</th><th class="p-2 text-[10px]">Status</th><th class="p-2 text-[10px] text-center">Kirim</th></tr></thead><tbody>`;
            orders.forEach(o=>{
                const st = o.status;
                let badge = st==='DELIVERED'?'<span class="badge-ok">Terkirim</span>':st==='MENUNGGU_PENGIRIMAN'?'<span class="badge-warn">Lunas, Kirim!</span>':st==='MENUNGGU_BAYAR'?'<span class="badge-err">Belum Bayar</span>':'<span class="badge-warn">'+st+'</span>';
                const canDeliver = st==='MENUNGGU_PENGIRIMAN';
                phtml += `<tr class="border-b border-white/5"><td class="p-2 text-[10px] font-mono">${o.invoice||o.id}</td>
                <td class="p-2 text-xs font-bold">${o.productName||'-'}</td>
                <td class="p-2 text-right text-xs">${formatRp(o.price)}</td>
                <td class="p-2 text-[10px]">${o.buyerId||'-'}</td>
                <td class="p-2">${badge}</td>
                <td class="p-2 text-center">${canDeliver?`<button onclick="deliverPanel('${o.id}')" class="text-[10px] bg-emerald-600 px-2 py-0.5 rounded">Kirim</button>`:'-'}</td></tr>`;
            });
            phtml += `</tbody></table></div></div>`;
            // Hidden form tambah produk
            phtml += `<div id="addPanelForm" class="card p-4 mt-4" style="display:none"><h3 class="font-bold text-sm text-white mb-3">Tambah Produk Panel</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div><label class="text-[10px] text-slate-400 block">Nama Produk</label><input id="ap-name" class="input-dark" placeholder="Panel Gaming 4GB"></div>
                <div><label class="text-[10px] text-slate-400 block">Harga</label><input id="ap-price" class="input-dark" type="number" placeholder="15000"></div>
                <div><label class="text-[10px] text-slate-400 block">Stok</label><input id="ap-stock" class="input-dark" type="number" placeholder="10"></div>
                <div><label class="text-[10px] text-slate-400 block">Kategori</label><input id="ap-category" class="input-dark" placeholder="Minecraft"></div>
            </div>
            <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                <div><label class="text-[10px] text-slate-400 block">RAM (GB)</label><input id="ap-ram" class="input-dark" type="number" placeholder="4"></div>
                <div><label class="text-[10px] text-slate-400 block">CPU (%)</label><input id="ap-cpu" class="input-dark" type="number" placeholder="100"></div>
                <div><label class="text-[10px] text-slate-400 block">Storage (GB)</label><input id="ap-storage" class="input-dark" type="number" placeholder="20"></div>
                <div><label class="text-[10px] text-slate-400 block">Bandwidth (GB)</label><input id="ap-bandwidth" class="input-dark" type="number" placeholder="0"></div>
                <div><label class="text-[10px] text-slate-400 block">Databases</label><input id="ap-databases" class="input-dark" type="number" placeholder="1"></div>
                <div><label class="text-[10px] text-slate-400 block">Backups</label><input id="ap-backups" class="input-dark" type="number" placeholder="1"></div>
            </div>
            <div class="mb-3"><label class="text-[10px] text-slate-400 block">Deskripsi Singkat</label><input id="ap-short-desc" class="input-dark" placeholder="Server gaming 4GB RAM dengan performa tinggi"></div>
            <div class="mb-3"><label class="text-[10px] text-slate-400 block">Deskripsi Lengkap</label><textarea id="ap-desc" class="input-dark" rows="2" placeholder="Detail spesifikasi server..."></textarea></div>
            <div class="flex gap-2"><button onclick="savePanelProduct()" class="btn-primary text-xs"><i class="fa-solid fa-save"></i> Simpan</button><button onclick="document.getElementById('addPanelForm').style.display='none'" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs">Batal</button></div></div>`;
            // Hidden form kirim panel
            phtml += `<div id="deliverPanelForm" class="card p-4 mt-4" style="display:none"><h3 class="font-bold text-sm text-white mb-3">Kirim Panel ke Pembeli</h3>
            <div class="space-y-3">
                <div><label class="text-[10px] text-slate-400 block">URL Panel</label><input id="dp-url" class="input-dark" placeholder="https://panel.domain.com"></div>
                <div><label class="text-[10px] text-slate-400 block">Email/Username</label><input id="dp-email" class="input-dark" placeholder="admin@domain.com"></div>
                <div><label class="text-[10px] text-slate-400 block">Password</label><input id="dp-pass" class="input-dark" type="text" placeholder="password123"></div>
                <div class="flex gap-2"><button onclick="confirmDeliverPanel()" class="btn-primary text-xs"><i class="fa-solid fa-paper-plane"></i> Kirim</button><button onclick="document.getElementById('deliverPanelForm').style.display='none'" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs">Batal</button></div>
            </div></div>`;
            c.innerHTML = phtml;
        }
        // =============== 10. AFFILIATE ===============
        else if(tab==='affiliate'){
            const [users,stats]=await Promise.all([api('/api/admin/users').then(r=>r.json()),api('/api/affiliate/stats').then(r=>r.json())]);
            const aff=users.filter(u=>u.isAffiliate||u.affiliatePending);
            let ah=`<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Affiliate (${stats.totalAffiliate||0})</h2>
                <button onclick="showCreateAffiliateModal()" class="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i>Buat Affiliate</button></div>`;
            if(stats.success){
                ah+=`<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                    <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Aktif</p><h3 class="text-xl font-black mt-1 text-indigo-400">${stats.totalAffiliate}</h3></div>
                    <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Pending</p><h3 class="text-xl font-black mt-1 text-amber-400">${stats.pendingAffiliate}</h3></div>
                    <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Komisi Terbayar</p><h3 class="text-sm font-black mt-1 text-emerald-400">${formatRp(stats.totalCommissionPaid)}</h3></div>
                    <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Generated</p><h3 class="text-sm font-black mt-1 text-violet-400">${formatRp(stats.totalCommissionGenerated)}</h3></div>
                    <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Menunggu Cair</p><h3 class="text-sm font-black mt-1 text-rose-400">${formatRp(stats.totalCommissionGenerated-stats.totalCommissionPaid)}</h3></div>
                </div>`;
            }
            ah+=`<div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2 text-[10px]">Nama</th><th class="p-2 text-[10px] text-center">Status</th><th class="p-2 text-[10px] text-right">Saldo</th><th class="p-2 text-[10px] text-right">Earned</th><th class="p-2 text-[10px] text-center">PPOB</th><th class="p-2 text-[10px]">Tgl Daftar</th><th class="p-2 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            aff.forEach(a=>{
                ah+=`<tr class="border-b border-white/5"><td class="p-2 font-bold text-xs">${a.affiliateName||a.firstName||'-'}<br><code class="text-[10px] text-slate-400 font-normal">${a.randomId}</code><br><span class="text-[9px] text-sky-400">${a.chatId?'📱 '+a.chatId:'—'}</span></td>
                <td class="p-2 text-center">${a.isAffiliate?'<span class="badge-ok">Aktif</span>':a.affiliatePending?'<span class="badge-warn">Pending</span>':'<span class="badge-err">Ditolak</span>'}</td>
                <td class="p-2 text-right font-bold text-emerald-400 text-xs">${formatRp(a.affiliateBalance)}</td>
                <td class="p-2 text-right font-bold text-violet-400 text-xs">${formatRp(a.totalEarned)}</td>
                <td class="p-2 text-center">${a.upgradePPOB?'<span class="badge-ok">Ya</span>':'<span class="badge-err">Tdk</span>'}</td>
                <td class="p-2 text-[9px] text-slate-400">${a.affiliateAppliedAt?new Date(a.affiliateAppliedAt).toLocaleDateString('id-ID'):'-'}</td>
                <td class="p-2 text-center">
                    ${a.affiliatePending&&!a.isAffiliate?`<button onclick="approveAffiliate('${a.randomId}')" class="text-[10px] bg-emerald-600 px-2 py-0.5 rounded mr-1">Terima</button><button onclick="rejectAffiliate('${a.randomId}')" class="text-[10px] bg-red-600 px-2 py-0.5 rounded">Tolak</button>`:''}
                    ${a.isAffiliate?`<button onclick="editAffiliate('${a.randomId}',${a.customCommission||0},${a.maxMarkup||0},${a.isBanned||false})" class="text-[10px] bg-sky-600 px-2 py-0.5 rounded mr-1">Edit</button><button onclick="togglePPOB('${a.randomId}')" class="text-[10px] ${a.upgradePPOB?'bg-red-600':'bg-indigo-600'} px-2 py-0.5 rounded mr-1">${a.upgradePPOB?'PPOB Off':'PPOB On'}</button>
                    <button onclick="setAffiliateBalance('${a.randomId}')" class="text-[10px] bg-amber-600 px-2 py-0.5 rounded">Edit Saldo</button>`:''}
                </td></tr>`;
            });
            ah+=`</tbody></table></div>`;
            c.innerHTML=ah;
        }
        // =============== 11. AFFILIATE CONFIG ===============
        else if(tab==='affconfig'){
            const cfg=await api('/api/admin/affiliate-config').then(r=>r.json());
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Pengaturan Global Affiliate</h2>
            <div class="card p-6 max-w-2xl space-y-4">
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Status Affiliate System</label>
                    <select id="ac-enabled" class="input-dark"><option value="true" ${cfg.affiliateEnabled?'selected':''}>Aktif</option><option value="false" ${!cfg.affiliateEnabled?'selected':''}>Nonaktif</option></select></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Auto Approve</label>
                    <select id="ac-auto" class="input-dark"><option value="true" ${cfg.affiliateAutoApprove?'selected':''}>Ya (Otomatis)</option><option value="false" ${!cfg.affiliateAutoApprove?'selected':''}>Manual</option></select></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Komisi Default (%)</label><input type="number" id="ac-comm" class="input-dark" value="${cfg.affiliateCommissionPercent||20}"></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Maks Markup (%)</label><input type="number" id="ac-markup" class="input-dark" value="${cfg.affiliateMaxMarkup||100}"></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Minimal Withdraw (Rp)</label><input type="number" id="ac-minwd" class="input-dark" value="${cfg.affiliateMinWithdraw||10000}"></div>
                <div><label class="text-xs font-bold text-slate-400 uppercase block mb-1">Teks Berjalan (Marquee)</label><textarea id="ac-welcome" class="input-dark" rows="3">${cfg.affiliateWelcomeMsg||''}</textarea></div>
                <button onclick="saveAffConfig()" class="btn-primary w-full">Simpan Pengaturan</button>
            </div>`;
        }
        // =============== 12. WITHDRAW ===============
        else if(tab==='withdraw'){
            const w=await api('/api/admin/withdraws').then(r=>r.json());
            const pending=w.filter(x=>x.status==='PENDING');
            let h=`<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Withdraw (${w.length})</h2>
                <span class="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-bold">${pending.length} Pending</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Pending</p><h3 class="text-xl font-black mt-1 text-amber-400">${pending.length}</h3></div>
                <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Sukses</p><h3 class="text-xl font-black mt-1 text-emerald-400">${w.filter(x=>x.status==='SUKSES').length}</h3></div>
                <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Ditolak</p><h3 class="text-xl font-black mt-1 text-red-400">${w.filter(x=>x.status==='DITOLAK').length}</h3></div>
                <div class="card p-3 text-center"><p class="text-[9px] text-slate-400 uppercase font-bold">Total Dicairkan</p><h3 class="text-sm font-black mt-1 text-emerald-400">${formatRp(w.filter(x=>x.status==='SUKSES').reduce((s,x)=>s+(x.amount||0),0))}</h3></div>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">Tanggal</th><th class="p-2.5 text-[10px]">User</th><th class="p-2.5 text-[10px]">Tujuan</th><th class="p-2.5 text-[10px] text-right">Jumlah</th><th class="p-2.5 text-[10px] text-center">Status</th><th class="p-2.5 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            w.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(x=>{
                let st='badge-warn';if(x.status==='SUKSES')st='badge-ok';if(x.status==='DITOLAK')st='badge-err';
                h+=`<tr class="border-b border-white/5"><td class="p-2.5 text-[10px] text-slate-400">${x.date?.substring(0,16).replace('T',' ')||'-'}</td>
                <td class="p-2.5"><code class="text-[10px] text-violet-300">${x.randomId||'-'}</code><br><span class="text-[10px] text-slate-500">${x.affiliateName||x.name||''}</span></td>
                <td class="p-2.5 text-[10px] max-w-[120px] truncate">${x.bankDetails||'-'}</td>
                <td class="p-2.5 text-right font-bold text-xs">${formatRp(x.amount)}</td>
                <td class="p-2.5 text-center"><span class="${st}">${x.status}</span></td>
                <td class="p-2.5 text-center">
                    ${x.status==='PENDING'?`<button onclick="processWd('${x.id}','SUKSES')" class="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded mr-1">Setujui</button><button onclick="processWd('${x.id}','DITOLAK')" class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded">Tolak</button>`:'−'}
                </td></tr>`;
            });
            h+=`</tbody></table></div>`;
            c.innerHTML=h;
        }
        // =============== 13. API CONFIG ===============
        else if(tab==='config'){
            const cfg=await api('/api/admin/config').then(r=>r.json());
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Konfigurasi API & Integrasi</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-5"><h3 class="font-bold text-violet-400 mb-3 text-sm"><i class="fa-solid fa-robot mr-2"></i>Telegram Bot</h3>
                    <input type="text" id="cfg-token" class="input-dark mb-2" placeholder="Bot Token" value="${cfg.telegramToken||''}">
                    <input type="text" id="cfg-bot" class="input-dark" placeholder="Bot Username (tanpa @)" value="${cfg.botUsername||''}">
                    <input type="text" id="cfg-owner" class="input-dark" placeholder="Owner Chat ID (untuk group)" value="${cfg.ownerChatId||''}">
                </div>
                <div class="card p-5"><h3 class="font-bold text-amber-400 mb-3 text-sm"><i class="fa-solid fa-crown mr-2"></i>Premku API</h3>
                    <input type="text" id="cfg-premku" class="input-dark mb-2" placeholder="API Key" value="${cfg.apiKey||''}">
                    <input type="number" id="cfg-profit" class="input-dark" placeholder="Profit (Rp)" value="${cfg.profit||2000}">
                </div>
                <div class="card p-5"><h3 class="font-bold text-emerald-400 mb-3 text-sm"><i class="fa-solid fa-bolt mr-2"></i>Flowix (PPOB)</h3>
                    <input type="text" id="cfg-flow-id" class="input-dark mb-2" placeholder="Merchant ID" value="${cfg.flowixMerchantId||''}">
                    <input type="text" id="cfg-flow-key" class="input-dark" placeholder="API Key" value="${cfg.flowixApiKey||''}">
                </div>

                <div class="card p-5"><h3 class="font-bold text-sky-400 mb-3 text-sm"><i class="fa-solid fa-envelope mr-2"></i>SMTP Email (Kirim Akun)</h3>
                    <input type="text" id="cfg-smtp-host" class="input-dark mb-2" placeholder="SMTP Host (ex: smtp.gmail.com)" value="${cfg.smtpHost||''}">
                    <div class="grid grid-cols-2 gap-2 mb-2"><input type="text" id="cfg-smtp-port" class="input-dark" placeholder="Port (587)" value="${cfg.smtpPort||'587'}">
                    <input type="text" id="cfg-smtp-user" class="input-dark" placeholder="Email / Username" value="${cfg.smtpUser||''}"></div>
                    <input type="password" id="cfg-smtp-pass" class="input-dark mb-2" placeholder="Password / App Password" value="${cfg.smtpPass||''}">
                    <input type="text" id="cfg-smtp-from" class="input-dark" placeholder="Nama Pengirim (optional)" value="${cfg.smtpFrom||''}">
                    <div class="flex gap-2 mt-3"><input type="email" id="cfg-test-email-to" class="input-dark flex-1" placeholder="email tujuan test">
                    <button onclick="testEmail()" class="bg-emerald-600 px-4 py-2 rounded-xl text-xs font-bold text-white hover:bg-emerald-500"><i class="fa-solid fa-paper-plane mr-1"></i>Test</button></div>
                </div>
                <div class="card p-5 md:col-span-2"><h3 class="font-bold text-rose-400 mb-3 text-sm"><i class="fa-solid fa-credit-card mr-2"></i>API Games (Cek Nickname)</h3>
                    <div class="grid grid-cols-2 gap-2"><input type="text" id="cfg-api-merchant" class="input-dark" placeholder="Merchant ID" value="${cfg.apigamesMerchantId||''}">
                    <input type="text" id="cfg-api-secret" class="input-dark" placeholder="Secret Key" value="${cfg.apigamesSecretKey||''}"></div>
                </div>
                <div class="card p-5 md:col-span-2"><h3 class="font-bold text-emerald-400 mb-3 text-sm"><i class="fa-brands fa-google mr-2"></i>Firebase Google OAuth</h3>
                    <p class="text-[10px] text-slate-500 mb-2">Isi dari Firebase Console → Project Settings → General → Your apps → Web app.</p>
                    <div class="grid grid-cols-2 gap-2 mb-2"><input type="text" id="cfg-fb-api" class="input-dark" placeholder="apiKey" value="${cfg.firebaseConfig?.apiKey||''}">
                    <input type="text" id="cfg-fb-domain" class="input-dark" placeholder="authDomain" value="${cfg.firebaseConfig?.authDomain||''}"></div>
                    <div class="grid grid-cols-2 gap-2 mb-2"><input type="text" id="cfg-fb-project" class="input-dark" placeholder="projectId" value="${cfg.firebaseConfig?.projectId||''}">
                    <input type="text" id="cfg-fb-sender" class="input-dark" placeholder="messagingSenderId" value="${cfg.firebaseConfig?.messagingSenderId||''}"></div>
                    <div class="grid grid-cols-2 gap-2"><input type="text" id="cfg-fb-app" class="input-dark" placeholder="appId" value="${cfg.firebaseConfig?.appId||''}">
                    <input type="text" id="cfg-fb-bucket" class="input-dark" placeholder="storageBucket" value="${cfg.firebaseConfig?.storageBucket||''}"></div>
                    <details class="mt-3 text-[10px] text-slate-400">
                        <summary class="cursor-pointer text-violet-400 font-bold">📖 Cara Konfigurasi Firebase Console</summary>
                        <div class="mt-2 space-y-1.5 leading-relaxed bg-white/[0.03] p-3 rounded-xl">
                            <p><strong class="text-white">1.</strong> Buka <a href="https://console.firebase.google.com" target="_blank" class="text-violet-400 underline">Firebase Console</a></p>
                            <p><strong class="text-white">2.</strong> Buat project baru atau pilih project yang sudah ada</p>
                            <p><strong class="text-white">3.</strong> Klik <span class="text-emerald-400">⚙️ Project Settings</span> (icon roda gigi) → <span class="text-emerald-400">General</span></p>
                            <p><strong class="text-white">4.</strong> Di bagian <span class="text-amber-400">"Your apps"</span>, klik <span class="text-emerald-400">Add app</span> → pilih <span class="text-emerald-400">Web</span> (icon &lt;/&gt;)</p>
                            <p><strong class="text-white">5.</strong> Daftarkan aplikasi (nama bebas, misal "RullzyeStore Affiliate")</p>
                            <p><strong class="text-white">6.</strong> Copy <span class="text-amber-400">firebaseConfig</span> yang muncul, isikan ke kolom di atas</p>
                            <p><strong class="text-white">7.</strong> Di Firebase Console kiri, buka <span class="text-emerald-400">Authentication</span> → <span class="text-emerald-400">Sign-in method</span></p>
                            <p><strong class="text-white">8.</strong> Klik <span class="text-emerald-400">Google</span>, aktifkan <span class="text-amber-400">Enable</span>, isi <span class="text-amber-400">Project support email</span> (email kamu)</p>
                            <p><strong class="text-white">9.</strong> Jika perlu, di <span class="text-emerald-400">Authorized domains</span>, tambahkan <code class="text-violet-300">rullzyestorepremium.my.id</code></p>
                            <p><strong class="text-white">10.</strong> Simpan, lalu refresh halaman affiliate. Tombol "Masuk dengan Google" siap pakai!</p>
                        </div>
                    </details>
                </div>
            </div>
            <button onclick="saveConfig()" class="btn-primary mt-4">Simpan Semua Konfigurasi</button>`;
        }
        // =============== 14. API TEST ===============
        else if(tab==='api-test'){
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Test Semua Koneksi API</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="apiTestResults">
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Flowix Health Check</h3><div id="flowix-test">Loading...</div>
                    <button onclick="testFlowix()" class="text-xs bg-emerald-600 px-3 py-1.5 rounded mt-2"><i class="fa-solid fa-play mr-1"></i>Test</button></div>
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Server Outbound IP</h3><div id="ip-test">Loading...</div>
                    <button onclick="testIP()" class="text-xs bg-sky-600 px-3 py-1.5 rounded mt-2"><i class="fa-solid fa-play mr-1"></i>Cek IP</button></div>
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Premku Products</h3><div id="premku-test">Loading...</div>
                    <button onclick="testPremku()" class="text-xs bg-amber-600 px-3 py-1.5 rounded mt-2"><i class="fa-solid fa-play mr-1"></i>Test</button></div>
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Firebase Auth</h3><div id="firebase-test-result">Loading...</div>
                    <button onclick="testFirebase()" class="text-xs bg-emerald-600 px-3 py-1.5 rounded mt-2"><i class="fa-solid fa-play mr-1"></i>Test Firebase</button></div>
            </div>`;
            testFlowix();testIP();testPremku();testFirebase();
        }
        // =============== 15. SECURITY ===============
        else if(tab==='security'){
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Pengaturan Keamanan</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-key text-amber-400 mr-2"></i>${adminRole==='super_admin'?'Ganti PIN Super Admin':'PIN Admin'}</h3>
                    ${adminRole==='super_admin'?`
                    <input type="password" id="oldPin" class="input-dark mb-2" placeholder="PIN Lama">
                    <input type="password" id="newPin" class="input-dark mb-2" placeholder="PIN Baru (min 4 karakter)">
                    <input type="password" id="confirmPin" class="input-dark mb-3" placeholder="Konfirmasi PIN Baru">
                    <button onclick="changePin()" class="btn-primary w-full">Ganti PIN Super Admin</button>
                    `:`<p class="text-xs text-slate-400">Hanya Super Admin yang bisa mengganti PIN. Hubungi Super Admin untuk perubahan.</p>`}
                </div>
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-shield text-emerald-400 mr-2"></i>Log Aktivitas</h3>
                    <p class="text-xs text-slate-400 mb-3">Lihat semua aktivitas login, withdraw, dan perubahan di sistem.</p>
                    <button onclick="loadTab('audit')" class="btn-primary w-full">Lihat Audit Log</button>
                </div>
            </div>`;
        }
        // =============== 16. AUDIT LOGS ===============
        else if(tab==='audit'){
            const r=await api('/api/admin/audit-logs').then(r=>r.json());
            const logs=r.logs||[];
            let ah=`<h2 class="text-xl font-black mb-4">Audit Log (${logs.length})</h2>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">Waktu</th><th class="p-2.5 text-[10px]">Aksi</th><th class="p-2.5 text-[10px]">User</th><th class="p-2.5 text-[10px]">IP</th><th class="p-2.5 text-[10px]">Detail</th></tr></thead><tbody>`;
            logs.forEach(l=>{
                ah+=`<tr class="border-b border-white/5 text-xs"><td class="p-2.5 text-[10px] text-slate-400">${l.timestamp?.substring(0,19).replace('T',' ')||'-'}</td>
                <td class="p-2.5 font-bold">${l.action||'-'}</td><td class="p-2.5 text-violet-300">${l.randomId||l.data?.randomId||'-'}</td>
                <td class="p-2.5 text-slate-500 font-mono text-[10px]">${l.ip||l.data?.ip||'-'}</td>
                <td class="p-2.5 text-slate-400 max-w-[200px] truncate">${JSON.stringify(l.data||l.amount||l.bankDetails||'')}</td></tr>`;
            });
            ah+=`</tbody></table></div>`;
            c.innerHTML=ah;
        }
        // =============== 17. GROUPS ===============
        else if(tab==='groups'){
            const cfg=await api('/api/admin/config').then(r=>r.json());
            const g=cfg.groupIds||{};
            const groups=[
                {id:'affiliate',label:'Group Affiliate (notif affiliate baru)',placeholder:'-100123456789'},
                {id:'report',label:'Group Laporan (report harian/bulanan)',placeholder:'-100123456789'},
                {id:'withdraw',label:'Group Withdraw (notif withdraw masuk)',placeholder:'-100123456789'},
                {id:'stock',label:'Group Stok (update stok produk)',placeholder:'-100123456789'},
                {id:'order',label:'Group Order (notif order baru)',placeholder:'-100123456789'},
                {id:'error',label:'Group Error (log error sistem)',placeholder:'-100123456789'},
                {id:'broadcast',label:'Group Broadcast (saluran broadcast)',placeholder:'-100123456789'},
                {id:'admin',label:'Group Admin (diskusi admin)',placeholder:'-100123456789'},
                {id:'commission',label:'Group Komisi (data komisi)',placeholder:'-100123456789'},
                {id:'promo',label:'Group Promo (pengumuman promo)',placeholder:'-100123456789'},
                {id:'affiliate_news',label:'Group Berita Affiliate',placeholder:'-100123456789'}
            ];
            let h=`<h2 class="text-xl font-black mb-4">Manajemen Grup Telegram</h2>
            <div class="card p-6 max-w-2xl">
                <p class="text-xs text-slate-400 mb-4">Konfigurasikan ID grup Telegram untuk notifikasi otomatis. Cara dapat ID grup: tambahkan bot ke grup, kirim <code class="bg-white/10 px-1 rounded">/mygroupid</code> di grup tersebut.</p>
                ${groups.map(gp=>`<div class="mb-3"><label class="text-xs font-bold text-slate-400 uppercase block mb-1">${gp.label}</label>
                    <div class="flex gap-2"><input type="text" id="grp-${gp.id}" class="input-dark flex-1" placeholder="${gp.placeholder}" value="${g[gp.id]||''}">
                    <button onclick="testGroup('${gp.id}')" class="text-xs bg-sky-600 px-3 py-2 rounded-lg hover:bg-sky-500"><i class="fa-solid fa-paper-plane"></i></button></div></div>`).join('')}
                <button onclick="saveGroups()" class="btn-primary w-full mt-4">Simpan Semua Grup</button>
            </div>`;
            c.innerHTML=h;
        }
        // =============== 18. FAQ MANAGEMENT ===============
        else if(tab==='faq'){
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Manajemen FAQ</h2>
            <div class="card p-6 max-w-3xl">
                <p class="text-xs text-slate-400 mb-4">Edit FAQ yang tampil di halaman FAQ website.</p>
                <p class="text-xs text-amber-400 mb-4"><i class="fa-solid fa-info-circle mr-1"></i>FAQ disimpan di file <code>public/faq.html</code>. Edit langsung file tersebut untuk perubahan konten.</p>
                <a href="/faq.html" target="_blank" class="btn-primary"><i class="fa-solid fa-eye mr-2"></i>Lihat Halaman FAQ</a>
            </div>`;
        }
        // =============== 19. SYSTEM STATUS ===============
        else if(tab==='system'){
            const s=await api('/api/admin/system').then(r=>r.json());
            const hrs=Math.floor(s.uptime/3600);const mins=Math.floor((s.uptime%3600)/60);
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Status Sistem</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-4"><i class="fa-solid fa-server text-violet-400 mr-2"></i>Server</h3>
                    <div class="space-y-2 text-sm">${[
                        ['Uptime',`${hrs}j ${mins}m`],['Memory',`${s.memory} MB`],['Node.js',s.nodeVersion],['Platform',s.platform],['Port',s.port]
                    ].map(([k,v])=>`<div class="flex justify-between py-1.5 border-b border-white/5"><span class="text-slate-400">${k}</span><strong class="text-white">${v}</strong></div>`).join('')}</div>
                </div>
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-4"><i class="fa-solid fa-plug text-emerald-400 mr-2"></i>Integrasi API</h3>
                    <div class="space-y-2 text-sm">${[
                        ['Bot Telegram',s.botActive?'<span class="badge-ok">Online</span>':'<span class="badge-err">Offline</span>'],
                        ['Premku API',s.premkuKey?'<span class="badge-ok">Key Set</span>':'<span class="badge-warn">Kosong</span>'],
                        ['Flowix (PPOB)',s.flowixKey?'<span class="badge-ok">Key Set</span>':'<span class="badge-warn">Kosong</span>'],

                        ['Telegram Token',s.telegramToken?'<span class="badge-ok">Ada</span>':'<span class="badge-err">Kosong</span>']
                    ].map(([k,v])=>`<div class="flex justify-between py-1.5 border-b border-white/5"><span class="text-slate-400">${k}</span>${v}</div>`).join('')}</div>
                </div>
            </div>`;
        }
        // =============== 20. DATABASE ===============
        else if(tab==='database'){
            const s=await api('/api/admin/database/stats').then(r=>r.json());
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Database Center</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="card p-5 border-l-4 border-violet-500">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Penyimpanan</h3>
                    <p class="text-xs mb-1 text-slate-300">Target: <code class="bg-white/10 px-2 py-0.5 rounded ml-1">${s.database?.firebase||'-'}</code></p>
                    <p class="text-xs mb-1 text-slate-300">Users: <strong class="text-white">${Math.round((s.database?.usersSize||0)/1024)} KB</strong></p>
                    <p class="text-xs text-slate-300">Orders: <strong class="text-white">${Math.round((s.database?.ordersSize||0)/1024)} KB</strong></p>
                </div>
                <div class="card p-5 border-l-4 border-emerald-500">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statistik Transaksi</h3>
                    <p class="text-xs mb-1 text-slate-300">Hari ini: <strong class="text-white">${s.orders?.today||0} pesanan</strong></p>
                    <p class="text-xs mb-1 text-slate-300">Bulan ini: <strong class="text-white">${s.orders?.thisMonth||0} pesanan</strong></p>
                    <p class="text-xs text-slate-300">Omzet Bulan ini: <strong class="text-emerald-400">${formatRp(s.revenue?.thisMonth||0)}</strong></p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Export Data</h3>
                    <div class="flex flex-wrap gap-2">
                        <a href="/api/admin/database/export/users" class="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500"><i class="fa-solid fa-download mr-1"></i>Users</a>
                        <a href="/api/admin/database/export/orders" class="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i>Orders</a>
                        <a href="/api/admin/database/export/withdraws" class="bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i>Withdraws</a>
                        <a href="/api/admin/database/export/all" class="bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-bold"><i class="fa-solid fa-download mr-1"></i>Backup All</a>
                    </div>
                </div>
                <div class="card p-5"><h3 class="font-bold text-sm text-white mb-3">Management</h3>
                    <button onclick="resetDatabase()" class="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500"><i class="fa-solid fa-trash mr-1"></i>Reset Database</button>
                    <p class="text-[10px] text-slate-500 mt-2">Hati-hati! Aksi ini menghapus semua data.</p>
                </div>
            </div>`;
        }
        // =============== 21. ADMINS (Super Admin only) ===============
        else if(tab==='admins'){
            const r=await api('/api/admin/admins').then(r=>r.json());
            const list=r.admins||[];
            let rows=list.map(a=>`<tr class="border-b border-white/[0.03] hover:bg-white/[0.01]">
                <td class="px-4 py-3 font-bold text-white">${a.username}</td>
                <td class="px-4 py-3"><code class="text-violet-300 bg-violet-500/5 px-2 py-0.5 rounded text-[10px] font-mono">${a.pin}</code></td>
                <td class="px-4 py-3 text-[10px]">${(a.permissions||[]).join(', ')||'<span class="text-slate-500">—</span>'}</td>
                <td class="px-4 py-3 text-center"><span class="${a.active===false?'text-red-400':'text-emerald-400'} text-[10px] font-bold">${a.active===false?'OFF':'ON'}</span></td>
                <td class="px-4 py-3 text-center">
                    <button onclick="editAdmin('${a.id}')" class="text-amber-400 hover:text-amber-300 text-xs mr-2"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteAdmin('${a.id}')" class="text-red-400 hover:text-red-300 text-xs"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`).join('');
            c.innerHTML=`<h2 class="text-xl font-black mb-4"><i class="fa-solid fa-user-shield text-violet-400 mr-2"></i>Manajemen Admin</h2>
            <div class="card p-5 mb-4">
                <div class="flex flex-col sm:flex-row gap-3 items-end">
                    <div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username</label><input id="adm-username" class="input-dark mt-1" placeholder="admin1"></div>
                    <div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PIN</label><input id="adm-pin" type="password" class="input-dark mt-1" placeholder="123456"></div>
                    <div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Izin (pisahkan koma)</label><input id="adm-perms" class="input-dark mt-1" placeholder="orders,withdraws,users"></div>
                    <button onclick="addAdmin()" class="btn-primary shrink-0"><i class="fa-solid fa-plus mr-1"></i>Tambah</button>
                </div>
                <p class="text-[10px] text-slate-500 mt-3">Izin tersedia: <code class="text-violet-300">dashboard, orders, withdraws, users, products, config, broadcast, settings</code></p>
            </div>
            <div class="card p-5">
                <h3 class="font-bold text-sm text-white mb-3">Daftar Admin</h3>
                ${list.length===0?'<p class="text-xs text-slate-500">Belum ada admin.</p>':
                `<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-slate-500 border-b border-white/[0.04]">
                    <th class="px-4 py-3 text-left font-bold uppercase tracking-widest text-[10px]">Username</th>
                    <th class="px-4 py-3 text-left font-bold uppercase tracking-widest text-[10px]">PIN</th>
                    <th class="px-4 py-3 text-left font-bold uppercase tracking-widest text-[10px]">Izin</th>
                    <th class="px-4 py-3 text-center font-bold uppercase tracking-widest text-[10px]">Status</th>
                    <th class="px-4 py-3 text-center font-bold uppercase tracking-widest text-[10px]">Aksi</th>
                </tr></thead><tbody>${rows}</tbody></table></div>`}
            </div>`;
        }
        // =============== 22. BROADCAST ===============
        else if(tab==='broadcast'){
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Broadcast / Kirim Pesan Massal</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-bullhorn text-amber-400 mr-2"></i>Ke Semua User Bot</h3>
                    <textarea id="bc-msg" rows="5" class="input-dark mb-4" placeholder="Ketik pesan..."></textarea>
                    <button onclick="sendBroadcast()" class="btn-primary w-full"><i class="fa-solid fa-paper-plane mr-2"></i>Kirim ke Semua User</button>
                </div>
                <div class="card p-6"><h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-users text-violet-400 mr-2"></i>Ke Grup Tertentu</h3>
                    <p class="text-xs text-slate-400 mb-3">Kirim pesan ke grup yang sudah dikonfigurasi di tab Groups.</p>
                    <button onclick="loadTab('groups')" class="btn-primary w-full">Konfigurasi Grup</button>
                </div>
            </div>`;
        }
        // =============== 22. BANNER ===============
        else if(tab==='banner'){
            const bres=await fetch('/api/banners').then(r=>r.json());
            const banners=bres.banners||[];
            let h=`<h2 class="text-xl font-black mb-4">Pengaturan Banner Slider</h2>
            <div class="card p-6">
                <p class="text-xs text-slate-400 mb-4">URL gambar dari hosting (imgur, postimg, dll). Link tujuan opsional.</p>
                <div id="banner-list" class="space-y-3 mb-4">`;
            banners.forEach((b,i)=>{
                h+=`<div class="flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/10">
                    <img src="${b.image}" class="w-20 h-10 object-cover rounded-lg bg-slate-800" onerror="this.src='https://placehold.co/400x200?text=Error'">
                    <div class="flex-grow space-y-1"><input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-img" value="${b.image}" placeholder="URL Gambar">
                    <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-link" value="${b.link||''}" placeholder="Link Tujuan"></div>
                    <button onclick="this.parentElement.remove()" class="bg-red-500/20 text-red-400 w-8 h-8 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i></button></div>`;
            });
            h+=`</div><button onclick="addBannerRow()" class="w-full bg-white/5 border border-white/10 border-dashed text-slate-400 font-bold py-2 rounded-xl text-xs hover:bg-white/10 hover:text-white transition mb-4"><i class="fa-solid fa-plus mr-1"></i> Tambah Banner</button>
            <button onclick="saveBanners()" class="btn-primary w-full">Simpan Banner</button></div>`;
            c.innerHTML=h;
        }
        // =============== 22b. TESTIMONI ===============
        else if(tab==='testimoni'){
            const r=await api('/api/admin/testimonials').then(r=>r.json());
            const testimoni=r.testimonials||[];
            let h=`<div class="flex justify-between items-center mb-4"><h2 class="text-xl font-black">Testimoni Pelanggan (${testimoni.length})</h2><button onclick="loadTab('testimoni')" class="text-violet-400"><i class="fa-solid fa-rotate"></i></button></div>
            <div class="card p-4 mb-4">
                <h3 class="font-bold text-sm text-white mb-3"><i class="fa-solid fa-plus mr-2"></i>Tambah Testimoni</h3>
                <div class="grid sm:grid-cols-3 gap-3 mb-3">
                    <div><label class="text-[10px] text-slate-400 block">Nama Pelanggan</label><input id="tm-name" class="input-dark" placeholder="Budi Santoso"></div>
                    <div><label class="text-[10px] text-slate-400 block">Layanan</label><input id="tm-service" class="input-dark" placeholder="Top Up ML"></div>
                    <div><label class="text-[10px] text-slate-400 block">Rating (1-5)</label><input id="tm-rating" class="input-dark" type="number" min="1" max="5" value="5"></div>
                </div>
                <div class="mb-3"><label class="text-[10px] text-slate-400 block">Testimoni</label><textarea id="tm-content" class="input-dark" rows="2" placeholder="Tuliskan pengalaman pelanggan..."></textarea></div>
                <button onclick="saveTestimoni()" class="btn-primary text-xs"><i class="fa-solid fa-save"></i> Simpan Testimoni</button>
            </div>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2 text-[10px]">Nama</th><th class="p-2 text-[10px]">Layanan</th><th class="p-2 text-[10px]">Rating</th><th class="p-2 text-[10px]">Testimoni</th><th class="p-2 text-[10px] text-center">Aktif</th><th class="p-2 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            testimoni.forEach(t=>{
                h+=`<tr class="border-b border-white/5"><td class="p-2 text-xs font-bold">${t.name}</td>
                <td class="p-2 text-[10px]">${t.service||'-'}</td>
                <td class="p-2">${'<i class="fa-solid fa-star text-amber-400 text-[9px]"></i>'.repeat(Math.min(t.rating||5,5))}</td>
                <td class="p-2 text-[10px] text-slate-400 max-w-[250px] truncate">"${t.content}"</td>
                <td class="p-2 text-center">${t.approved!==false?'<span class="badge-ok">Ya</span>':'<span class="badge-err">Tidak</span>'}</td>
                <td class="p-2 text-center">
                    <button onclick="toggleTestimoni('${t.id}')" class="text-[10px] ${t.approved!==false?'bg-amber-600':'bg-emerald-600'} px-2 py-0.5 rounded mr-1">${t.approved!==false?'Sembunyi':'Tampilkan'}</button>
                    <button onclick="deleteTestimoni('${t.id}')" class="text-[10px] bg-red-600 px-2 py-0.5 rounded">Hapus</button>
                </td></tr>`;
            });
            h+=`</tbody></table></div>
            <button onclick="seedTestimoni()" class="mt-3 text-[10px] bg-amber-600/30 text-amber-400 px-3 py-1.5 rounded-xl hover:bg-amber-600 hover:text-white transition"><i class="fa-solid fa-database mr-1"></i> Seed 10 Testimoni Dummy</button>`;
            c.innerHTML=h;
        }
        // =============== 23. CONTENT PAGES ===============
        else if(tab==='content'){
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Manajemen Halaman Konten</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${[
                    {name:'Halaman Utama',file:'index.html',url:'/'},
                    {name:'PPOB',file:'ppob.html',url:'/ppob.html'},
                    {name:'Akun Digital',file:'akundigital.html',url:'/akundigital.html'},
                    {name:'FAQ',file:'faq.html',url:'/faq.html'},
                    {name:'Affiliate Dashboard',file:'affiliate.html',url:'/affiliate.html'},
                    {name:'Toko Affiliate',file:'toko.html',url:'/toko/:refCode'},
                    {name:'Reseller',file:'rullzyereseler.html',url:'/rullzyereseler.html'},
                    {name:'Admin Panel',file:'admin.html',url:'/admin.html'},
                    {name:'Sitemap',file:'sitemap.xml',url:'/sitemap.xml'}
                ].map(p=>`<a href="${p.url}" target="_blank" class="card p-4 hover:border-violet-500/30 transition block">
                    <h3 class="font-bold text-sm text-white">${p.name}</h3>
                    <p class="text-[10px] text-slate-500 mt-1">${p.file}</p>
                    <p class="text-[10px] text-violet-400 mt-1">${p.url}</p>
                </a>`).join('')}
            </div>`;
        }
        // =============== 24. RESELLERS ===============
        else if(tab==='resellers'){
            const u=await api('/api/admin/users').then(r=>r.json());
            const res=u.filter(x=>x.isReseller);
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Manajemen Reseller (${res.length})</h2>
            <div class="card overflow-x-auto"><table class="w-full text-sm text-left"><thead class="bg-white/5 border-b border-white/10">
                <tr><th class="p-2.5 text-[10px]">Nama</th><th class="p-2.5 text-[10px]">ID</th><th class="p-2.5 text-[10px] text-right">Saldo</th><th class="p-2.5 text-[10px] text-right">Markup</th><th class="p-2.5 text-[10px] text-center">Aksi</th></tr></thead><tbody>`;
            res.forEach(x=>{
                h+=`<tr class="border-b border-white/5"><td class="p-2.5 font-bold text-xs">${x.firstName||'-'}<br><code class="text-[10px] text-slate-400">${x.randomId}</code></td>
                <td class="p-2.5 font-mono text-[10px]">${x.chatId||'-'}</td>
                <td class="p-2.5 text-right font-bold text-emerald-400 text-xs">${formatRp(x.balance)}</td>
                <td class="p-2.5 text-right text-xs">${x.markup||0}%</td>
                <td class="p-2.5 text-center"><button onclick="deleteUser('${x.randomId}')" class="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500 hover:text-white"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            });
            h+=`</tbody></table></div>`;
            c.innerHTML=h;
        }
        // =============== 25. CHECK IP ===============
        else if(tab==='checkip'){
            const r=await api('/api/admin/check-ip').then(r=>r.json());
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Cek IP Server</h2>
            <div class="card p-6 max-w-lg">
                ${r.success?`<div class="text-center"><p class="text-xs text-slate-400 mb-2">IP Publik Server Anda:</p><h2 class="text-3xl font-black text-white mb-4 font-mono">${r.ip}</h2>
                <p class="text-xs text-slate-400">${r.message||''}</p>
                <button onclick="navigator.clipboard.writeText('${r.ip}')" class="text-xs bg-violet-600 text-white px-4 py-2 rounded-lg mt-4"><i class="fa-solid fa-copy mr-1"></i>Salin IP</button></div>`:
                `<p class="text-red-400">${r.message||'Gagal mengambil IP'}</p>`}
            </div>`;
        }
        // =============== 26. BOT STATUS ===============
        else if(tab==='botstatus'){
            const sys=await api('/api/admin/system').then(r=>r.json());
            c.innerHTML=`<h2 class="text-xl font-black mb-4">Status Bot Telegram</h2>
            <div class="card p-6 max-w-2xl">
                <div class="flex justify-between items-center py-3 border-b border-white/5"><span class="text-slate-400 text-sm">Status Bot</span>${sys.botActive?'<span class="badge-ok">Online & Polling</span>':'<span class="badge-err">Offline</span>'}</div>
                <div class="flex justify-between items-center py-3 border-b border-white/5"><span class="text-slate-400 text-sm">Token Terpasang</span>${sys.telegramToken?'<span class="badge-ok">Ada</span>':'<span class="badge-err">Kosong</span>'}</div>
                ${['/start - Mulai & daftar','/id - Cek Random ID','/mygroupid - Dapatkan ID grup (di grup)'].map(cmd=>`<div class="flex items-center py-2 border-b border-white/5"><code class="bg-white/10 px-2 py-0.5 rounded text-xs">${cmd}</code></div>`).join('')}
                <p class="text-xs text-slate-500 mt-4"><i class="fa-solid fa-info-circle mr-1"></i>Bot aktif di Telegram. Pastikan bot sudah dijadikan admin di grup untuk fitur notifikasi grup.</p>
            </div>`;
        }
    } catch(e){ c.innerHTML=`<p class="text-red-400 text-center py-10">Error: ${e.message}</p>`; }
}

// ==================== ACTION FUNCTIONS ====================

async function saveConfig() {
    try {
        const d={
            telegramToken: document.getElementById('cfg-token').value,
            botUsername: document.getElementById('cfg-bot').value,
            ownerChatId: document.getElementById('cfg-owner')?.value||'',
            apiKey: document.getElementById('cfg-premku').value,
            profit: parseInt(document.getElementById('cfg-profit').value),
            flowixMerchantId: document.getElementById('cfg-flow-id').value,
            flowixApiKey: document.getElementById('cfg-flow-key').value,
            apigamesMerchantId: document.getElementById('cfg-api-merchant')?.value||'',
            apigamesSecretKey: document.getElementById('cfg-api-secret')?.value||'',
            smtpHost: document.getElementById('cfg-smtp-host')?.value||'',
            smtpPort: document.getElementById('cfg-smtp-port')?.value||'587',
            smtpUser: document.getElementById('cfg-smtp-user')?.value||'',
            smtpPass: document.getElementById('cfg-smtp-pass')?.value||'',
            smtpFrom: document.getElementById('cfg-smtp-from')?.value||'',
            firebaseConfig: {
                apiKey: document.getElementById('cfg-fb-api')?.value||'',
                authDomain: document.getElementById('cfg-fb-domain')?.value||'',
                projectId: document.getElementById('cfg-fb-project')?.value||'',
                storageBucket: document.getElementById('cfg-fb-bucket')?.value||'',
                messagingSenderId: document.getElementById('cfg-fb-sender')?.value||'',
                appId: document.getElementById('cfg-fb-app')?.value||'',
            },
        };
        const res=await api('/api/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
        const json=await res.json();
        showToast(json.message||'Konfigurasi disimpan!');
    } catch(e){ showToast("Gagal: "+e.message,'error'); }
}

async function saveAffConfig(){
    const d={
        affiliateEnabled: document.getElementById('ac-enabled').value==='true',
        affiliateAutoApprove: document.getElementById('ac-auto').value==='true',
        affiliateCommissionPercent: parseInt(document.getElementById('ac-comm').value),
        affiliateMaxMarkup: parseInt(document.getElementById('ac-markup').value),
        affiliateMinWithdraw: parseInt(document.getElementById('ac-minwd').value),
        affiliateWelcomeMsg: document.getElementById('ac-welcome').value.trim()
    };
    await api('/api/admin/affiliate-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    showToast('Pengaturan Affiliate disimpan!');
}

window.filterUserTable=async function(q){
    const div=document.getElementById('userSearchResults');
    if(!q.trim()){div.innerHTML='';return;}
    const users=await api('/api/admin/users').then(r=>r.json());
    const f=users.filter(u=>(u.firstName||'').toLowerCase().includes(q.toLowerCase())||(u.randomId||'').toLowerCase().includes(q.toLowerCase()));
    div.innerHTML=f.length?`<table class="w-full text-sm"><tbody>${f.slice(0,20).map(u=>`<tr class="border-b border-white/5"><td class="p-2 text-xs font-bold">${u.firstName||'-'}</td><td class="p-2"><code class="text-[10px] text-violet-300">${u.randomId||'-'}</code></td><td class="p-2 text-right text-xs">${formatRp(u.balance)}</td></tr>`).join('')}</tbody></table>`:'<p class="text-xs text-slate-500 py-4 text-center">Tidak ditemukan</p>';
};

window.deleteUser=async function(rid){
    if(!confirm('Yakin hapus user ini?')) return;
    await api('/api/admin/users/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    showToast('User berhasil dihapus!');
    loadTab('users');
};
window.showCreateUserModal=function(){
    const div=document.createElement('div');
    div.className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4';
    div.onclick=function(e){if(e.target===this)this.remove()};
    div.innerHTML=`<div class="card p-6 max-w-sm w-full"><h3 class="font-bold text-white mb-4">Buat User Baru</h3>
        <input type="text" id="cu-name" placeholder="Nama User" class="input-dark mb-2">
        <input type="number" id="cu-balance" placeholder="Saldo Awal (Rp)" class="input-dark mb-2" value="0">
        <label class="flex items-center gap-2 text-xs text-slate-300 mb-2"><input type="checkbox" id="cu-reseller"> Sebagai Reseller</label>
        <label class="flex items-center gap-2 text-xs text-slate-300 mb-4"><input type="checkbox" id="cu-affiliate"> Sebagai Affiliate</label>
        <button onclick="createUser()" class="btn-primary w-full mb-2">Buat User</button>
        <button onclick="this.closest('.fixed').remove()" class="text-xs text-slate-400 w-full">Batal</button>
    </div>`;
    document.body.appendChild(div);
    setTimeout(()=>document.getElementById('cu-name')?.focus(),100);
};
window.createUser=async function(){
    const name=document.getElementById('cu-name').value.trim();
    const balance=document.getElementById('cu-balance').value;
    const isReseller=document.getElementById('cu-reseller').checked;
    const isAffiliate=document.getElementById('cu-affiliate').checked;
    if(!name) return showToast('Nama wajib diisi!','error');
    const r=await api('/api/admin/users/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,balance,isReseller,isAffiliate})});
    const d=await r.json();
    if(d.success){showToast(d.message);document.querySelector('.fixed.inset-0')?.remove();loadTab('users');}
    else showToast(d.message||'Gagal','error');
};

window.showCreateAffiliateModal=function(){
    const div=document.createElement('div');
    div.className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4';
    div.onclick=function(e){if(e.target===this)this.remove()};
    div.innerHTML=`<div class="card p-6 max-w-sm w-full"><h3 class="font-bold text-white mb-4">Buat Affiliate Baru</h3>
        <input type="text" id="ca-name" placeholder="Nama Affiliate" class="input-dark mb-2">
        <input type="number" id="ca-balance" placeholder="Saldo Komisi Awal (Rp)" class="input-dark mb-2" value="0">
        <input type="number" id="ca-comm" placeholder="Komisi Kustom (%)" class="input-dark mb-4" value="0">
        <button onclick="createAffiliate()" class="btn-primary w-full mb-2">Buat Affiliate</button>
        <button onclick="this.closest('.fixed').remove()" class="text-xs text-slate-400 w-full">Batal</button>
    </div>`;
    document.body.appendChild(div);
    setTimeout(()=>document.getElementById('ca-name')?.focus(),100);
};
window.createAffiliate=async function(){
    const name=document.getElementById('ca-name').value.trim();
    const balance=document.getElementById('ca-balance').value;
    const commissionPercent=document.getElementById('ca-comm').value;
    if(!name) return showToast('Nama wajib diisi!','error');
    const r=await api('/api/admin/affiliate/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,balance,commissionPercent})});
    const d=await r.json();
    if(d.success){showToast(d.message);document.querySelector('.fixed.inset-0')?.remove();loadTab('affiliate');}
    else showToast(d.message||'Gagal','error');
};
window.setAffiliateBalance=async function(rid){
    const amt=prompt('Edit saldo komisi (masukkan nominal baru):');
    if(amt&&!isNaN(parseInt(amt))){
        const users=await api('/api/admin/users').then(r=>r.json());
        const u=users.find(x=>x.randomId===rid);
        const currentBalance=u?u.balance:0;
        await api('/api/admin/users/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid,balance:currentBalance,affiliateBalance:parseInt(amt)})});
        loadTab('affiliate');
    }
};
// ==================== PAGINATION FUNCTIONS ====================
window.paginateUsers=function(page){
    if(page<1) return;
    pagState.users.page=page;
    loadTab('users');
};
window.paginateOrders=function(page){
    if(page<1) return;
    pagState.orders.page=page;
    loadTab('orders');
};
// ==================== EDIT USER MODAL ====================
window.showEditUserModal=async function(rid){
    const users=await api('/api/admin/users').then(r=>r.json());
    const u=users.find(x=>x.randomId===rid);
    if(!u) return showToast('User tidak ditemukan','error');
    const div=document.createElement('div');
    div.className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4';
    div.onclick=function(e){if(e.target===this)this.remove()};
    div.innerHTML=`<div class="card p-6 max-w-sm w-full">
        <h3 class="font-bold text-white mb-1">Edit User</h3>
        <p class="text-[10px] text-slate-400 mb-4"><code class="text-violet-300">${u.randomId}</code></p>
        <input type="text" id="eu-name" class="input-dark mb-2" placeholder="Nama" value="${(u.firstName||'').replace(/"/g,'&quot;')}">
        <input type="number" id="eu-balance" class="input-dark mb-2" placeholder="Saldo" value="${u.balance||0}">
        <input type="number" id="eu-aff-balance" class="input-dark mb-4" placeholder="Saldo Komisi" value="${u.affiliateBalance||0}">
        <button onclick="saveEditUser('${rid}')" class="btn-primary w-full mb-2">Simpan</button>
        <button onclick="this.closest('.fixed').remove()" class="text-xs text-slate-400 w-full">Batal</button>
    </div>`;
    document.body.appendChild(div);
    setTimeout(()=>document.getElementById('eu-name')?.focus(),100);
};
window.saveEditUser=async function(rid){
    const name=document.getElementById('eu-name').value.trim();
    const balance=parseInt(document.getElementById('eu-balance').value)||0;
    const affBalance=parseInt(document.getElementById('eu-aff-balance').value)||0;
    const r=await api('/api/admin/users/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid,name,balance,affiliateBalance:affBalance})});
    const d=await r.json();
    if(d.success){showToast('User berhasil diperbarui!');document.querySelector('.fixed.inset-0')?.remove();loadTab('users');}
    else showToast(d.message||'Gagal','error');
};
// ==================== USER SEARCH MODAL ====================
window.showUserSearchModal=function(){
    const div=document.createElement('div');
    div.className='fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4';
    div.onclick=function(e){if(e.target===this)this.remove()};
    div.innerHTML=`<div class="card p-6 max-w-lg w-full">
        <h3 class="font-bold text-white mb-4">Cari User</h3>
        <input type="text" id="userSearchInput" placeholder="Cari nama atau ID..." class="input-dark mb-3" oninput="window.filterUserTable(this.value)">
        <div id="userSearchResults" class="max-h-60 overflow-y-auto text-sm"></div>
        <button onclick="this.closest('.fixed').remove()" class="text-xs text-slate-400 w-full mt-2">Tutup</button>
    </div>`;
    document.body.appendChild(div);
    setTimeout(()=>document.getElementById('userSearchInput')?.focus(),100);
};

window.approveAffiliate=async function(rid){
    if(!confirm('Setujui affiliate ini?')) return;
    await api('/api/admin/affiliate/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    showToast('Affiliate disetujui!');
    loadTab('affiliate');
};
window.rejectAffiliate=async function(rid){
    const r=prompt('Alasan penolakan:');
    await api('/api/admin/affiliate/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid,reason:r||''})});
    showToast('Affiliate ditolak!');
    loadTab('affiliate');
};
window.togglePPOB=async function(rid){
    await api('/api/admin/affiliate/toggle-ppob',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid})});
    showToast('Status PPOB diubah!');
    loadTab('affiliate');
};
window.addAffiliateBalance=async function(rid){
    const amt=prompt('Masukkan nominal topup saldo komisi:');
    if(amt&&parseInt(amt)>0){
        await api('/api/admin/affiliate/add-balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({randomId:rid,amount:parseInt(amt)})});
        loadTab('affiliate');
    }
};
window.processWd=async function(id,st){
    if(!confirm(`Proses withdraw menjadi ${st}?`)) return;
    await api('/api/admin/withdraw/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:st})});
    showToast(`Withdraw diubah menjadi ${st}`);
    loadTab('withdraw');
};
window.sendBroadcast=async function(){
    const m=document.getElementById('bc-msg').value.trim();
    if(!m) return showToast('Pesan kosong!','error');
    document.querySelector('#tab-content button').disabled=true;
    try {
        const r=await api('/api/admin/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})});
        const d=await r.json();
        showToast(d.message);
    } catch(e){ showToast('Gagal: '+e.message,'error'); }
    loadTab('broadcast');
};
window.editAffiliate=async function(rid,comm,markup,banned){
    const p=prompt(`Format: Komisi,MaxMarkup,IsBanned,BannedReason\nContoh: 25,150,false,\n\nSaat ini: ${comm},${markup},${banned}`);
    if(p){
        const parts=p.split(',');
        if(parts.length>=3){
            const b={randomId:rid,commissionPercent:parseInt(parts[0]),maxMarkup:parseInt(parts[1]),isBanned:parts[2].trim()==='true',bannedReason:parts[3]||''};
            await api('/api/admin/affiliate/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
            showToast('Affiliate diperbarui!');
            loadTab('affiliate');
        } else showToast('Format salah!','error');
    }
};

window.forceOrderStatus=async function(id,status){
    if(!confirm(`Ubah status order ${id} menjadi ${status}?`)) return;
    await api('/api/admin/order/force-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
    showToast(`Order ${id} diubah ke ${status}`);
    loadTab('orders');
};
window.refreshProducts=async function(){
    const btn=event.target;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await fetch('/api/mixed-products');
        showToast('Produk di-refresh!');
        loadTab('products');
    } catch(e){ showToast('Gagal refresh','error'); }
    btn.disabled=false;
};
window.saveBadges=async function(){
    try {
        const data=JSON.parse(document.getElementById('badgeData').value);
        await api('/api/admin/badge-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        showToast('Badge disimpan!');
    } catch(e){ showToast('JSON tidak valid: '+e.message,'error'); }
};

async function testEmail(){
    const to = document.getElementById('cfg-test-email-to')?.value.trim();
    if (!to) return showToast('Masukkan email tujuan test','error');
    try {
        const res = await api('/api/admin/test-email', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to})});
        const d = await res.json();
        showToast(d.message || (d.success ? 'Terkirim!' : 'Gagal'));
    } catch(e) { showToast('Gagal: '+e.message,'error'); }
}
window.changePin=async function(){
    const oldPin=document.getElementById('oldPin')?.value||currentPin;
    const newPin=document.getElementById('newPin').value;
    const confirmPin=document.getElementById('confirmPin').value;
    if(!newPin||newPin.length<4) return showToast('PIN minimal 4 karakter','error');
    if(newPin!==confirmPin) return showToast('PIN tidak cocok','error');
    const r=await api('/api/admin/change-pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oldPin,newPin})});
    const d=await r.json();
    if(d.success){showToast('PIN berhasil diganti!');currentAuth=adminUsername+':'+newPin;} else showToast(d.message||'Gagal ganti PIN','error');
};

window.saveGroups=async function(){
    const groupIds={};
    document.querySelectorAll('[id^="grp-"]').forEach(inp=>{
        const key=inp.id.replace('grp-','');
        if(inp.value.trim()) groupIds[key]=inp.value.trim();
    });
    const r=await api('/api/admin/save-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupIds})});
    const d=await r.json();
    showToast(d.success?'Grup berhasil disimpan!':(d.message||'Gagal'));
};

window.testGroup=async function(groupId){
    const inp=document.getElementById(`grp-${groupId}`);
    if(!inp.value.trim()) return showToast('Isi ID grup terlebih dahulu','error');
    const r=await api('/api/admin/test-group',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:inp.value.trim()})});
    const d=await r.json();
    showToast(d.success?'Pesan test terkirim!':(d.message||'Gagal'));
};

// API Test Functions
async function testFlowix(){
    try{const r=await api('/api/flowix-test-server').then(r=>r.json());document.getElementById('flowix-test').innerHTML=r.success?'<span class="text-emerald-400 font-bold">✅ Online</span>':'<span class="text-red-400">❌ '+r.message+'</span>';}catch(e){document.getElementById('flowix-test').innerHTML='<span class="text-red-400">Error</span>';}
}
async function testIP(){
    try{const r=await api('/api/admin/check-ip').then(r=>r.json());document.getElementById('ip-test').innerHTML=r.success?`<span class="text-emerald-400 font-mono font-bold">${r.ip}</span>`:'<span class="text-red-400">'+r.message+'</span>';}catch(e){document.getElementById('ip-test').innerHTML='<span class="text-red-400">Error</span>';}
}
async function testPremku(){
    try{const r=await fetch('/api/products').then(r=>r.json());document.getElementById('premku-test').innerHTML=r.success?`<span class="text-emerald-400 font-bold">✅ ${r.products?.length||0} produk</span>`:'<span class="text-red-400">❌ Gagal</span>';}catch(e){document.getElementById('premku-test').innerHTML='<span class="text-red-400">Error</span>';}
}
async function testFirebase(){
    try{const r=await fetch('/api/affiliate/firebase-test').then(r=>r.json());document.getElementById('firebase-test-result').innerHTML=r.success?`<span class="text-emerald-400 font-bold">✅ ${r.message}</span>`:`<span class="text-red-400">❌ ${r.message}</span>`;}catch(e){document.getElementById('firebase-test-result').innerHTML='<span class="text-red-400">Error</span>';}
}

// Testimoni functions
window.saveTestimoni=async function(){
    const name=document.getElementById('tm-name').value.trim();
    const service=document.getElementById('tm-service').value.trim();
    const rating=parseInt(document.getElementById('tm-rating').value)||5;
    const content=document.getElementById('tm-content').value.trim();
    if(!name||!content) return showToast('Nama dan testimoni wajib diisi','error');
    const r=await api('/api/admin/testimonials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,service,rating,content})});
    const d=await r.json();
    showToast(d.message);
    if(d.success){document.getElementById('tm-name').value='';document.getElementById('tm-service').value='';document.getElementById('tm-content').value='';}
    loadTab('testimoni');
};
window.toggleTestimoni=async function(id){
    const r=await api('/api/admin/testimonials').then(r=>r.json());
    const t=(r.testimonials||[]).find(x=>x.id===id);
    if(!t) return showToast('Testimoni tidak ditemukan','error');
    const newVal=t.approved!==false?false:true;
    const r2=await api('/api/admin/testimonials/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved:newVal})});
    const d=await r2.json();
    showToast(d.message);
    loadTab('testimoni');
};
window.deleteTestimoni=async function(id){
    if(!confirm('Hapus testimoni ini?')) return;
    const r=await api('/api/admin/testimonials/'+id,{method:'DELETE'});
    const d=await r.json();
    showToast(d.message);
    loadTab('testimoni');
};
window.seedTestimoni=async function(){
    if(!confirm('Tambahkan 10 testimoni dummy?')) return;
    const r=await api('/api/admin/testimonials/seed',{method:'POST'});
    const d=await r.json();
    showToast(d.message);
    loadTab('testimoni');
};
// Panel functions
let editingPanelId = null;
let deliveringPanelId = null;
window.showAddPanelProduct = function(){
    editingPanelId = null;
    document.getElementById('addPanelForm').style.display = 'block';
    document.getElementById('addPanelForm').scrollIntoView({behavior:'smooth'});
    ['ap-name','ap-price','ap-stock','ap-category','ap-ram','ap-cpu','ap-storage','ap-bandwidth','ap-databases','ap-backups','ap-short-desc','ap-desc'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
};
window.savePanelProduct = async function(){
    const data = {
        name: document.getElementById('ap-name').value.trim(),
        price: parseInt(document.getElementById('ap-price').value)||0,
        stock: parseInt(document.getElementById('ap-stock').value)||0,
        category: document.getElementById('ap-category').value.trim()||'Umum',
        ram: parseInt(document.getElementById('ap-ram').value)||0,
        cpu: parseInt(document.getElementById('ap-cpu').value)||0,
        storage: parseInt(document.getElementById('ap-storage').value)||0,
        bandwidth: parseInt(document.getElementById('ap-bandwidth').value)||0,
        databases: parseInt(document.getElementById('ap-databases').value)||0,
        backups: parseInt(document.getElementById('ap-backups').value)||0,
        shortDesc: document.getElementById('ap-short-desc').value.trim(),
        description: document.getElementById('ap-desc').value.trim()
    };
    if (!data.name) return showToast('Nama produk wajib diisi!','error');
    let url = '/api/admin/panel/products';
    if (editingPanelId) {
        const r = await api(url + '/' + editingPanelId, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const d = await r.json();
        showToast(d.message);
    } else {
        const r = await api(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const d = await r.json();
        showToast(d.message);
    }
    loadTab('panel');
};
window.editPanelProduct = async function(id){
    const r = await api('/api/admin/panel/products').then(r=>r.json());
    const p = (r.products||[]).find(x=>x.id===id);
    if (!p) return showToast('Produk tidak ditemukan','error');
    editingPanelId = id;
    document.getElementById('ap-name').value = p.name||'';
    document.getElementById('ap-price').value = p.price||0;
    document.getElementById('ap-stock').value = p.stock||0;
    document.getElementById('ap-category').value = p.category||'Umum';
    document.getElementById('ap-ram').value = p.ram||0;
    document.getElementById('ap-cpu').value = p.cpu||0;
    document.getElementById('ap-storage').value = p.storage||0;
    document.getElementById('ap-bandwidth').value = p.bandwidth||0;
    document.getElementById('ap-databases').value = p.databases||0;
    document.getElementById('ap-backups').value = p.backups||0;
    document.getElementById('ap-short-desc').value = p.shortDesc||'';
    document.getElementById('ap-desc').value = p.description||'';
    document.getElementById('addPanelForm').style.display = 'block';
    document.getElementById('addPanelForm').scrollIntoView({behavior:'smooth'});
};
window.deletePanelProduct = async function(id){
    if (!confirm('Hapus produk panel ini?')) return;
    const r = await api('/api/admin/panel/products/' + id, {method:'DELETE'});
    const d = await r.json();
    showToast(d.message);
    loadTab('panel');
};
window.deliverPanel = function(id){
    deliveringPanelId = id;
    document.getElementById('dp-url').value = '';
    document.getElementById('dp-email').value = '';
    document.getElementById('dp-pass').value = '';
    document.getElementById('deliverPanelForm').style.display = 'block';
    document.getElementById('deliverPanelForm').scrollIntoView({behavior:'smooth'});
};
window.confirmDeliverPanel = async function(){
    if (!deliveringPanelId) return;
    const url = document.getElementById('dp-url').value.trim();
    const email = document.getElementById('dp-email').value.trim();
    const password = document.getElementById('dp-pass').value.trim();
    if (!url || !email || !password) return showToast('URL, Email, dan Password wajib diisi','error');
    if (!confirm('Kirim panel ini ke pembeli?')) return;
    const r = await api('/api/admin/panel/deliver/' + deliveringPanelId, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,email,password})});
    const d = await r.json();
    showToast(d.message);
    document.getElementById('deliverPanelForm').style.display = 'none';
    loadTab('panel');
};
// Banner functions
window.addBannerRow=function(){
    const div=document.createElement('div');
    div.className='flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/10';
    div.innerHTML=`<img src="" class="w-20 h-10 object-cover rounded-lg bg-slate-800" onerror="this.src='https://placehold.co/400x200?text=No+Img'">
    <div class="flex-grow space-y-1"><input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-img" placeholder="URL Gambar" oninput="this.parentElement.previousElementSibling.src=this.value">
    <input type="text" class="input-dark text-[10px] py-1 px-2 h-7 b-link" placeholder="Link Tujuan"></div>
    <button onclick="this.parentElement.remove()" class="bg-red-500/20 text-red-400 w-8 h-8 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fa-solid fa-trash"></i></button>`;
    document.getElementById('banner-list').appendChild(div);
};
window.saveBanners=async function(){
    const rows=document.querySelectorAll('#banner-list > div');
    const banners=[];
    rows.forEach(r=>{const img=r.querySelector('.b-img').value.trim(),link=r.querySelector('.b-link').value.trim();if(img)banners.push({image:img,link:link});});
    const res=await api('/api/admin/banners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({banners})});
    const d=await res.json();
    showToast(d.success?'Banner disimpan!':'Gagal');
};
// ==================== DATABASE RESET ====================
window.resetDatabase=async function(){
    if(!confirm('⚠️ RESET DATABASE? Semua data akan hilang!')) return;
    if(!confirm('⚠️⚠️ Yakin benar? Data TIDAK bisa dikembalikan!')) return;
    const r=await fetch('/api/admin/database/reset',{method:'POST'});
    const d=await r.json();
    showToast(d.message||'Database di-reset!');
    loadTab('database');
};
// ==================== PROMO FUNCTIONS ====================
window.showPromoForm = async function(id) {
    const promos = await api('/api/admin/promos').then(r=>r.json());
    const p = id ? (promos.promos||[]).find(x => x.id === id) : null;
    const prods = window._premkuProds || [];
    const types = ['qty_discount','bogo_same','bogo_diff'];
    const tipeMap = {qty_discount:'Quantity Discount (beli 2+ dpt potongan)',bogo_same:'BOGO — Produk Sama',bogo_diff:'BOGO — Produk Beda'};
    let tiersHtml = '';
    const existingTiers = p?.tiers || [];
    if (existingTiers.length === 0) existingTiers.push({qty:2,discountRp:0});
    existingTiers.forEach((t,i) => {
        tiersHtml += `<div class="flex gap-2 items-center tier-row mb-1">
            <span class="text-[10px] text-slate-400 w-8">Beli</span>
            <input type="number" class="input-dark text-[10px] py-1 h-8 w-16 tier-qty" value="${t.qty}">
            <span class="text-[10px] text-slate-400">diskon</span>
            <input type="number" class="input-dark text-[10px] py-1 h-8 w-24 tier-diskon" value="${t.discountRp}">
            <span class="text-[10px] text-slate-400">Rp</span>
            <button onclick="this.parentElement.remove()" class="text-red-400 text-xs ml-1"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    });
    const targetIds = p?.targetProductIds || [];
    const today = new Date().toISOString().split('T')[0];
    const endDefault = p?.endDate ? p.endDate.substring(0,10) : new Date(Date.now()+30*86400000).toISOString().split('T')[0];
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.innerHTML = `<div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" style="animation:fadeUp 0.3s ease">
        <style>@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}</style>
        <div class="flex justify-between items-center mb-4"><h3 class="text-lg font-black text-white">${p?'Edit':'Tambah'} Promo</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark text-xl"></i></button></div>
        <div class="space-y-3">
            <div><label class="text-[10px] font-bold text-slate-400 uppercase">Nama Promo</label>
            <input type="text" id="pf-name" class="input-dark" value="${p?.name||''}" placeholder="Contoh: Beli 2 Hemat 5rb"></div>
            <div><label class="text-[10px] font-bold text-slate-400 uppercase">Tipe Promo</label>
            <select id="pf-type" class="input-dark" onchange="togglePromoTiers(this.value)">
                ${types.map(t => `<option value="${t}" ${p?.type===t?'selected':''}>${tipeMap[t]}</option>`).join('')}
            </select></div>
            <div id="pf-tiers-container"><label class="text-[10px] font-bold text-slate-400 uppercase">Tier Diskon</label>
                <div id="pf-tiers">${tiersHtml}</div>
                <button onclick="addTierRow()" class="text-[10px] text-violet-400 mt-1"><i class="fa-solid fa-plus"></i> Tambah Tier</button>
            </div>
            <div id="pf-free-prod-container" style="display:${p?.type==='bogo_diff'?'block':'none'}"><label class="text-[10px] font-bold text-slate-400 uppercase">Produk Gratis (BOGO Beda)</label>
                <select id="pf-free-prod" class="input-dark">
                    <option value="">Pilih produk gratis...</option>
                    ${prods.map(x => `<option value="${x.id}" ${String(p?.freeProductId)===String(x.id)?'selected':''}>${x.name} — Rp ${(x.price).toLocaleString('id-ID')}</option>`).join('')}
                </select></div>
            <div><label class="text-[10px] font-bold text-slate-400 uppercase">Target Produk</label>
                <div class="max-h-32 overflow-y-auto bg-white/5 rounded-xl p-2 space-y-1">
                    <label class="flex items-center gap-2 text-xs"><input type="checkbox" onchange="document.querySelectorAll('.pf-target').forEach(c=>c.checked=this.checked)" ${targetIds.length===0?'checked':''}> <span class="text-slate-300">Semua Produk Premku</span></label>
                    ${prods.map(x => `<label class="flex items-center gap-2 text-[10px] ml-4"><input type="checkbox" class="pf-target" value="${x.id}" ${!targetIds.length||targetIds.includes(String(x.id))?'checked':''}> ${x.name}</label>`).join('')}
                </div></div>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="text-[10px] font-bold text-slate-400 uppercase">Mulai</label>
                <input type="date" id="pf-start" class="input-dark" value="${p?.startDate?p.startDate.substring(0,10):today}"></div>
                <div><label class="text-[10px] font-bold text-slate-400 uppercase">Selesai</label>
                <input type="date" id="pf-end" class="input-dark" value="${endDefault}"></div>
            </div>
            <div><label class="text-[10px] font-bold text-slate-400 uppercase">Maks Pemakaian</label>
            <input type="number" id="pf-max" class="input-dark" value="${p?.maxUses||100}" min="1"></div>
            <div class="flex gap-2"><label class="flex items-center gap-2 text-xs"><input type="checkbox" id="pf-active" ${p?.active!==false?'checked':''}> <span class="text-slate-300">Aktif</span></label></div>
        </div>
        <div class="flex gap-2 mt-5">
            <button onclick="savePromo('${p?.id||''}')" class="btn-primary flex-1"><i class="fa-solid fa-save"></i> Simpan Promo</button>
            <button onclick="this.closest('.fixed').remove()" class="bg-white/5 text-slate-400 px-5 py-2.5 rounded-xl text-sm font-bold border border-white/10 hover:bg-white/10">Batal</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
};
window.togglePromoTiers = function(type) {
    document.getElementById('pf-tiers-container').style.display = (type==='qty_discount'||type==='bogo_same') ? 'block' : 'none';
    document.getElementById('pf-free-prod-container').style.display = type==='bogo_diff' ? 'block' : 'none';
};
window.addTierRow = function() {
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center tier-row mb-1';
    div.innerHTML = `<span class="text-[10px] text-slate-400 w-8">Beli</span>
        <input type="number" class="input-dark text-[10px] py-1 h-8 w-16 tier-qty" value="2">
        <span class="text-[10px] text-slate-400">diskon</span>
        <input type="number" class="input-dark text-[10px] py-1 h-8 w-24 tier-diskon" value="0">
        <span class="text-[10px] text-slate-400">Rp</span>
        <button onclick="this.parentElement.remove()" class="text-red-400 text-xs ml-1"><i class="fa-solid fa-xmark"></i></button>`;
    document.getElementById('pf-tiers').appendChild(div);
};
window.savePromo = async function(id) {
    const name = document.getElementById('pf-name').value.trim();
    const type = document.getElementById('pf-type').value;
    const startDate = document.getElementById('pf-start').value;
    const endDate = document.getElementById('pf-end').value;
    const maxUses = parseInt(document.getElementById('pf-max').value) || 100;
    const active = document.getElementById('pf-active').checked;
    if (!name) return showToast('Nama promo wajib diisi','error');
    if (!startDate || !endDate) return showToast('Tanggal mulai dan selesai wajib diisi','error');
    // Collect tiers
    const tiers = [];
    if (type === 'qty_discount') {
        document.querySelectorAll('.tier-row').forEach(row => {
            const qty = parseInt(row.querySelector('.tier-qty').value) || 0;
            const discountRp = parseInt(row.querySelector('.tier-diskon').value) || 0;
            if (qty > 0 && discountRp > 0) tiers.push({qty, discountRp});
        });
        if (tiers.length === 0) return showToast('Minimal 1 tier diskon','error');
    }
    // Collect target products
    const pfTargets = document.querySelectorAll('.pf-target');
    const allChecked = pfTargets.length > 0 && pfTargets.length === document.querySelectorAll('.pf-target:checked').length;
    const targetProductIds = allChecked ? [] : Array.from(document.querySelectorAll('.pf-target:checked')).map(c => c.value);
    const freeProductId = type === 'bogo_diff' ? document.getElementById('pf-free-prod').value : '';
    if (type === 'bogo_diff' && !freeProductId) return showToast('Pilih produk gratis untuk BOGO Beda','error');
    const body = { id: id || null, name, type, tiers, targetProductIds, freeProductId, startDate, endDate, maxUses, active };
    const res = await api('/api/admin/promos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d = await res.json();
    showToast(d.success ? 'Promo disimpan!' : d.message||'Gagal');
    if (d.success) { document.querySelector('.fixed').remove(); loadTab('promo'); }
};
window.deletePromo = async function(id) {
    if (!confirm('Hapus promo ini?')) return;
    const res = await api('/api/admin/promos/' + id, {method:'DELETE'});
    showToast('Promo dihapus!'); loadTab('promo');
};
window.togglePromo = async function(id) {
    const promos = await api('/api/admin/promos').then(r=>r.json());
    const p = (promos.promos||[]).find(x => x.id === id);
    if (!p) return;
    p.active = !p.active;
    await api('/api/admin/promos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
    showToast(p.active ? 'Promo diaktifkan!' : 'Promo dinonaktifkan!'); loadTab('promo');
};
