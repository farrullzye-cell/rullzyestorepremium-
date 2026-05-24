const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require("cors");
const crypto = require('crypto');

const security = require('./anti_fraud.js');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const getAdminPin = () => { const cfg = getConfig(); return cfg.adminPin || '858486'; };

// Admin auth middleware
const adminAuth = (req, res, next) => {
    const pin = req.headers['x-admin-pin'];
    const validPin = getAdminPin();
    if (pin !== validPin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    next();
};

const PORT = process.env.PORT || 3000;

// ================= 1. DATABASE LOKAL & FIREBASE =================
const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

const getConfig = () => {
    try { return JSON.parse(fs.readFileSync('./config.json')); }
    catch(e) { return { apiKey: '', celestialApiKey: '', celestialSecret: '', smmApiKey: '', smmSecretKey: '', profit: 2000, botUsername: '', telegramToken: '', storeName: 'Rullzye Store', productSettings: {}, flowixApiKey: '', flowixMerchantId: '' }; }
};
const saveConfig = async (configData) => {
    fs.writeFileSync('./config.json', JSON.stringify(configData, null, 2));
    try { await axios.put(`${FIREBASE_URL}/system_config.json`, configData); console.log('✅ Config disimpan ke Firebase'); } catch(e) { console.error('❌ Gagal simpan config ke Firebase:', e.message); }
};

const getOrders = async () => { try { const res = await axios.get(`${FIREBASE_URL}/orders.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveOrders = async (orders) => { try { await axios.put(`${FIREBASE_URL}/orders.json`, orders); } catch (e) { } };
const getUsers = async () => { try { const res = await axios.get(`${FIREBASE_URL}/users.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveUsers = async (users) => { try { await axios.put(`${FIREBASE_URL}/users.json`, users); } catch (e) { } };
const getWithdraws = async () => { try { const res = await axios.get(`${FIREBASE_URL}/withdraws.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveWithdraws = async (wds) => { try { await axios.put(`${FIREBASE_URL}/withdraws.json`, wds); } catch (e) { } };

const getWebUsers = async () => { try { const res = await axios.get(`${FIREBASE_URL}/webUsers.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveWebUsers = async (users) => { try { await axios.put(`${FIREBASE_URL}/webUsers.json`, users); } catch (e) { } };

const getPanelProducts = async () => { try { const r = await axios.get(`${FIREBASE_URL}/panel_products.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const savePanelProducts = async (data) => { try { await axios.put(`${FIREBASE_URL}/panel_products.json`, data); } catch(e) {} };
const getPanelOrders = async () => { try { const r = await axios.get(`${FIREBASE_URL}/panel_orders.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const savePanelOrders = async (data) => { try { await axios.put(`${FIREBASE_URL}/panel_orders.json`, data); } catch(e) {} };

const config = getConfig();
let isProcessing = false;

const getCelestialSignature = (apiKey, secret) => crypto.createHash('md5').update(apiKey + secret).digest('hex');

// ================= 2. LOAD MODULE FLOWIX =================
const ppob = require('./ppob.js');

// ================= 3. BOT SYSTEM VARS (dideklarasikan dulu, di-load setelah config) =================
let bot, sendBroadcast, notifyAffiliateApproved, notifyAffiliateRejected, notifyWithdrawSuccess, notifyWithdrawRejected, notifyGroupAffiliateNew, notifyGroupOrderNew, notifyGroupOrderSuccess, notifyGroupWithdrawNew, notifyGroupWithdrawProcessed, notifyGroupError, notifyGroupCommission, notifyGroupStockUpdate, notifyGroupAdmin;

// ================= ADMIN: AUTH ENDPOINT =================
app.post('/api/admin/auth', (req, res) => {
    const { pin } = req.body;
    if (pin === getAdminPin()) return res.json({ success: true });
    res.json({ success: false, message: 'PIN salah!' });
});

// Apply admin auth to all /api/admin routes below
app.use('/api/admin', (req, res, next) => {
    if (req.path === '/auth') return next();
    adminAuth(req, res, next);
});

// ================= 4. API ADMIN DASHBOARD =================
app.get('/api/admin/users', async (req, res) => { res.json(await getUsers()); });
app.post('/api/admin/users/toggle', async (req, res) => {
    const { randomId, isReseller } = req.body;
    let users = await getUsers();
    let index = users.findIndex(u => u.randomId === randomId);
    if(index !== -1) { users[index].isReseller = isReseller; await saveUsers(users); }
    res.json({success: true});
});
app.get('/api/admin/withdraws', async (req, res) => { res.json(await getWithdraws()); });
app.post('/api/admin/withdraws/acc', async (req, res) => {
    const { id } = req.body;
    let wds = await getWithdraws();
    let index = wds.findIndex(w => w.id === id);
    if(index !== -1) { wds[index].status = 'SUKSES'; await saveWithdraws(wds); }
    res.json({success: true});
});
// Broadcast handler di baris 329

app.post('/api/web-user/register', async (req, res) => {
    try {
        const { name, telegramUsername } = req.body;
        if (!name || !name.trim()) return res.json({ success: false, message: 'Nama harus diisi.' });

        const users = await getWebUsers();
        let randomId;
        do {
            randomId = `WEB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        } while (users.some(u => u.randomId === randomId));

        users.push({
            name: name.trim(),
            telegramUsername: telegramUsername ? telegramUsername.trim() : '',
            randomId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            connectedToTelegram: false
        });
        await saveWebUsers(users);
        res.json({ success: true, randomId, message: 'ID Web berhasil dibuat. Simpan ID kamu untuk pembayaran dan struk.' });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/web-user/verify', async (req, res) => {
    try {
        const { randomId } = req.body;
        const users = await getWebUsers();
        const user = users.find(u => u.randomId === randomId);
        if (!user) return res.json({ success: false, message: 'ID tidak ditemukan.' });
        res.json({ success: true, user });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    const orders = await getOrders();
    res.json(orders);
});

app.post('/api/admin/config', async (req, res) => {
    try {
        const currentConfig = getConfig();
        const updatedConfig = { ...currentConfig, ...req.body };
        await saveConfig(updatedConfig);
        res.json({ success: true, message: 'Konfigurasi disimpan.' });
    } catch (e) {
        console.error('Gagal menyimpan config:', e);
        res.json({ success: false, message: 'Gagal menyimpan.' });
    }
});

app.post('/api/admin/affiliate/approve', async (req, res) => {
    let users = await getUsers();
    const idx = users.findIndex(u => u.randomId === req.body.randomId);
    if (idx !== -1) {
        users[idx].isAffiliate = true;
        users[idx].affiliatePending = false;
        users[idx].affiliateApprovedAt = new Date().toISOString();
        await saveUsers(users);
        if (bot && notifyAffiliateApproved) {
            notifyAffiliateApproved(users[idx].chatId, users[idx].randomId).catch(() => {});
        }
        notifyGroupAffiliateNew(users[idx]).catch(() => {});
    }
    res.json({ success: true });
});

app.post('/api/admin/affiliate/reject', async (req, res) => {
    const { randomId, reason } = req.body;
    let users = await getUsers();
    const idx = users.findIndex(u => u.randomId === randomId);
    if (idx !== -1) {
        users[idx].affiliatePending = false;
        users[idx].affiliateRejectedAt = new Date().toISOString();
        await saveUsers(users);
        if (bot && notifyAffiliateRejected) {
            notifyAffiliateRejected(users[idx].chatId, reason || '').catch(() => {});
        }
    }
    res.json({ success: true });
});

app.post('/api/admin/affiliate/toggle-ppob', async (req, res) => {
    let users = await getUsers();
    const idx = users.findIndex(u => u.randomId === req.body.randomId);
    if (idx !== -1) {
        users[idx].upgradePPOB = !users[idx].upgradePPOB;
        await saveUsers(users);
        if (bot && users[idx].chatId) {
            const status = users[idx].upgradePPOB ? '✅ diaktifkan' : '❌ dinonaktifkan';
            bot.sendMessage(users[idx].chatId, `🔄 *Upgrade PPOB ${status} oleh Admin.*`, { parse_mode: 'Markdown' }).catch(() => {});
        }
    }
    res.json({ success: true });
});

// ================= ADMIN: AFFILIATE DETAIL UPDATE =================
app.post('/api/admin/affiliate/update', async (req, res) => {
    const { randomId, commissionPercent, maxMarkup, isBanned, bannedReason } = req.body;
    let users = await getUsers();
    const idx = users.findIndex(u => u.randomId === randomId);
    if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
    if (commissionPercent !== undefined) users[idx].customCommission = parseInt(commissionPercent);
    if (maxMarkup !== undefined) users[idx].maxMarkup = parseInt(maxMarkup);
    if (isBanned !== undefined) { users[idx].isBanned = isBanned; users[idx].bannedReason = bannedReason || ''; }
    await saveUsers(users);
    res.json({ success: true });
});

// ================= ADMIN: GLOBAL AFFILIATE CONFIG =================
app.get('/api/admin/affiliate-config', (req, res) => {
    const cfg = getConfig();
    res.json({
        affiliateCommissionPercent: cfg.affiliateCommissionPercent || 20,
        affiliateMinWithdraw: cfg.affiliateMinWithdraw || 10000,
        affiliateAutoApprove: cfg.affiliateAutoApprove || false,
        affiliateMaxMarkup: cfg.affiliateMaxMarkup || 100,
        affiliateEnabled: cfg.affiliateEnabled !== false,
        affiliateWelcomeMsg: cfg.affiliateWelcomeMsg || '',
    });
});
app.post('/api/admin/affiliate-config', async (req, res) => {
    try {
        const cfg = getConfig();
        const fields = ['affiliateCommissionPercent','affiliateMinWithdraw','affiliateAutoApprove','affiliateMaxMarkup','affiliateEnabled','affiliateWelcomeMsg'];
        fields.forEach(f => { if (req.body[f] !== undefined) cfg[f] = req.body[f]; });
        await saveConfig(cfg);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: AUDIT LOGS =================
app.get('/api/admin/audit-logs', async (req, res) => {
    try {
        const r = await axios.get(`${FIREBASE_URL}/audit_logs.json`);
        const logs = r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : [];
        res.json({ success: true, logs: logs.reverse().slice(0, 200) });
    } catch(e) { res.json({ success: false, logs: [] }); }
});

// Bersihkan rate limiter setiap 10 menit
setInterval(() => security.cleanupRateLimitStore(), 600000);

// ================= ADMIN: DATABASE STATS =================
app.get('/api/admin/database/stats', async (req, res) => {
    try {
        const [users, orders, wds] = await Promise.all([getUsers(), getOrders(), getWithdraws()]);
        const now = new Date();
        const today = now.toISOString().slice(0,10);
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const todayOrders = orders.filter(o => (o.createdAt||'').startsWith(today));
        const monthOrders = orders.filter(o => (o.createdAt||'').startsWith(thisMonth));
        const sukses = orders.filter(o => o.status === 'SUKSES');
        const gagal = orders.filter(o => o.status === 'GAGAL');
        const pending = orders.filter(o => o.status === 'MENUNGGU_BAYAR' || o.status === 'PROSES_PUSAT');
        const totalRevenue = sukses.reduce((s,o) => s + (o.displayPrice || 0), 0);
        const monthRevenue = sukses.filter(o => (o.completedAt||o.createdAt||'').startsWith(thisMonth)).reduce((s,o) => s + (o.displayPrice || 0), 0);
        const affiliates = users.filter(u => u.isAffiliate);
        const pendingAff = users.filter(u => u.affiliatePending && !u.isAffiliate);
        const totalCommission = sukses.reduce((s,o) => s + (o.affiliateCommission || 0), 0);
        const pendingWd = wds.filter(w => w.status === 'PENDING');

        res.json({ success: true,
            users: { total: users.length, reseller: users.filter(u=>u.isReseller).length, affiliate: affiliates.length, pendingAffiliate: pendingAff.length },
            orders: { total: orders.length, today: todayOrders.length, thisMonth: monthOrders.length, sukses: sukses.length, gagal: gagal.length, pending: pending.length },
            revenue: { total: totalRevenue, thisMonth: monthRevenue },
            affiliate: { totalCommission, pendingWithdraw: pendingWd.length, pendingWdAmount: pendingWd.reduce((s,w) => s + (w.amount||0), 0) },
            withdraws: { total: wds.length, sukses: wds.filter(w=>w.status==='SUKSES').length, pending: pendingWd.length },
            database: { firebase: FIREBASE_URL.replace(/\/[^/]+$/, '/***'), usersSize: JSON.stringify(users).length, ordersSize: JSON.stringify(orders).length }
        });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
// ================= ADMIN: CHECK OUTBOUND IP =================
app.get('/api/admin/check-ip', async (req, res) => {
    try {
        const ipRes = await axios.get('https://api.ipify.org?format=json');
        res.json({ success: true, ip: ipRes.data.ip, message: 'Ini adalah IP server Anda yang sebenarnya. Masukkan IP ini ke Whitelist API.' });
    } catch(e) {
        res.json({ success: false, message: 'Gagal mengecek IP server.' });
    }
});

// ================= ADMIN: SYSTEM CONFIGURATION =================
app.get('/api/admin/config', (req, res) => {
    res.json(getConfig());
});

// ================= ADMIN: EXPORT DATABASE =================
app.get('/api/admin/database/export/:type', async (req, res) => {
    try {
        const { type } = req.params;
        let data;
        if (type === 'users') data = await getUsers();
        else if (type === 'orders') data = await getOrders();
        else if (type === 'withdraws') data = await getWithdraws();
        else if (type === 'config') data = getConfig();
        else if (type === 'all') data = { users: await getUsers(), orders: await getOrders(), withdraws: await getWithdraws(), config: getConfig() };
        else return res.json({ success: false, message: 'Tipe tidak valid.' });
        res.setHeader('Content-Type','application/json');
        res.setHeader('Content-Disposition',`attachment; filename=rullzye_${type}_${new Date().toISOString().slice(0,10)}.json`);
        res.send(JSON.stringify(data, null, 2));
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: DELETE USER =================
app.post('/api/admin/users/delete', async (req, res) => {
    let users = await getUsers();
    users = users.filter(u => u.randomId !== req.body.randomId);
    await saveUsers(users);
    res.json({ success: true });
});

// ================= ADMIN: SYSTEM STATUS =================
app.get('/api/admin/system', (req, res) => {
    const cfg = getConfig();
    res.json({
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion: process.version,
        platform: process.platform,
        port: PORT,
        botActive: !!bot,
        premkuKey: !!cfg.apiKey,
        celestialKey: !!cfg.celestialApiKey,
        flowixKey: !!cfg.flowixApiKey,
        smmKey: !!cfg.smmApiKey,
        telegramToken: !!cfg.telegramToken,
    });
});

// ================= ADMIN: BROADCAST =================
app.post('/api/admin/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.json({ success: false, message: 'Pesan kosong.' });
        if (!bot) return res.json({ success: false, message: 'Bot tidak aktif.' });
        await sendBroadcast(message);
        res.json({ success: true, message: 'Broadcast berhasil dikirim ke semua user.' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: WITHDRAW =================
app.get('/api/admin/withdraws', async (req, res) => {
    try {
        const wds = await getWithdraws();
        res.json(wds.sort((a,b)=>new Date(b.date)-new Date(a.date)));
    } catch(e) { res.json([]); }
});
app.post('/api/admin/withdraw/process', async (req, res) => {
    try {
        const { id, status } = req.body;
        let wds = await getWithdraws();
        const idx = wds.findIndex(w => w.id === id);
        if (idx === -1) return res.json({ success: false, message: 'Withdraw tidak ditemukan.' });
        if (wds[idx].status !== 'PENDING') return res.json({ success: false, message: 'Withdraw sudah diproses.' });
        
        wds[idx].status = status;
        
        if (status === 'DITOLAK') {
            let users = await getUsers();
            const uIdx = users.findIndex(u => u.randomId === wds[idx].randomId);
            if (uIdx !== -1) {
                users[uIdx].affiliateBalance = (users[uIdx].affiliateBalance || 0) + wds[idx].amount;
                await saveUsers(users);
                if (bot && users[uIdx].chatId) notifyWithdrawRejected(users[uIdx].chatId, wds[idx], '');
            }
            notifyGroupWithdrawProcessed(wds[idx], 'DITOLAK').catch(() => {});
        } else if (status === 'SUKSES') {
            let users = await getUsers();
            const uIdx = users.findIndex(u => u.randomId === wds[idx].randomId);
            if (uIdx !== -1 && bot && users[uIdx].chatId) {
                notifyWithdrawSuccess(users[uIdx].chatId, wds[idx]);
            }
            notifyGroupWithdrawProcessed(wds[idx], 'SUKSES').catch(() => {});
        }
        await saveWithdraws(wds);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= MIXED PRODUCTS =================
app.get('/api/mixed-products', async (req, res) => {
    try {
        const cfg = getConfig();
        const [premkuRes, ppobRes, topupRes] = await Promise.all([
            axios.post('https://premku.com/api/products', { api_key: cfg.apiKey }).catch(() => ({ data: { products: [] } })),
            ppob.getProducts(cfg.flowixApiKey, cfg.flowixMerchantId, 'prepaid').catch(() => ({ data: [] })),
            axios.post('https://celestialtopup.com/api/v1/produk', {
                api_key: cfg.celestialApiKey,
                signature: getCelestialSignature(cfg.celestialApiKey, cfg.celestialSecret)
            }).catch(() => ({ data: { data: [] } }))
        ]);

        const profit = parseInt(cfg.profit || 2000);
        const allProducts = [];

        if (premkuRes.data?.products) {
            premkuRes.data.products.forEach(x => {
                const s = (cfg.productSettings && cfg.productSettings[x.id]) || {};
                const p = (s.profit !== null && s.profit !== undefined) ? s.profit : profit;
                allProducts.push({
                    id: 'PREMKU-' + x.id,
                    source: 'premku',
                    name: x.name,
                    price: parseInt(x.price) + p,
                    stock: s.isOutOfStock ? 0 : x.stock,
                    badge: s.badge || null,
                    category: 'akun'
                });
            });
        }

        if (ppobRes.data) {
            ppobRes.data.filter(p => p.status && p.status.toLowerCase() === 'aktif').forEach(p => {
                allProducts.push({
                    id: 'PPOB-' + p.code,
                    source: 'ppob',
                    name: p.name,
                    price: parseInt(p.price) + profit,
                    stock: 9999,
                    badge: null,
                    category: 'ppob',
                    brand: p.brand || ''
                });
            });
        }

        if (topupRes.data?.success && topupRes.data?.data) {
            topupRes.data.data.filter(x => (x.status || '').toLowerCase() === 'tersedia').forEach(x => {
                allProducts.push({
                    id: 'TOPUP-' + x.sku,
                    source: 'topup',
                    name: `${x.brand} - ${x.nama_produk}`,
                    price: parseInt(x.harga) + profit,
                    stock: 999,
                    badge: null,
                    category: 'game'
                });
            });
        }

        res.json({ success: true, products: allProducts });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// ================= BADGE SETTINGS =================
app.get('/api/admin/badge-settings', async (req, res) => {
    try {
        const r = await axios.get(`${FIREBASE_URL}/badgeSettings.json`);
        res.json({ success: true, data: r.data || {} });
    } catch (e) { res.json({ success: false, data: {} }); }
});

app.post('/api/admin/badge-settings', async (req, res) => {
    try {
        await axios.put(`${FIREBASE_URL}/badgeSettings.json`, req.body);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// ================= 5. ADMIN API: FLOWIX CONFIG =================
app.get('/api/admin/flowix-config', (req, res) => {
    const cfg = getConfig();
    res.json({ apiKey: cfg.flowixApiKey || '', merchantId: cfg.flowixMerchantId || '' });
});
app.post('/api/admin/flowix-config', async (req, res) => {
    try {
        const cfg = getConfig();
        cfg.flowixApiKey = req.body.apiKey || '';
        cfg.flowixMerchantId = req.body.merchantId || '';
        await saveConfig(cfg);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// ================= BANNER API =================
app.get('/api/banners', async (req, res) => {
    try {
        const r = await axios.get(`${FIREBASE_URL}/banners.json`);
        const banners = r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : [];
        res.json({ success: true, banners });
    } catch (e) {
        res.json({ success: false, banners: [] });
    }
});

app.post('/api/admin/banners', async (req, res) => {
    try {
        const { banners } = req.body; // array of {image, link}
        await axios.put(`${FIREBASE_URL}/banners.json`, banners);
        res.json({ success: true, message: 'Banner disimpan.' });
    } catch (e) {
        res.json({ success: false, message: 'Gagal menyimpan banner.' });
    }
});


// ================= 6. ADMIN API: TEST FLOWIX HEALTH =================
app.get('/api/flowix-test-server', async (req, res) => {
    const cfg = getConfig();
    if (!cfg.flowixApiKey || !cfg.flowixMerchantId) {
        return res.json({ success: false, message: 'Flowix API Key atau Merchant ID belum diisi' });
    }
    try {
        const result = await ppob.healthCheck(cfg.flowixApiKey, cfg.flowixMerchantId);
        res.json({
            success: result.success,
            message: result.message || 'Tidak ada pesan',
            flowix_response: result,
            detected_ip: result.data?.ip_address || 'Tidak terdeteksi',
            config_status: {
                apiKey_set: !!cfg.flowixApiKey,
                merchantId_set: !!cfg.flowixMerchantId
            }
        });
    } catch (error) {
        res.json({ success: false, message: 'Gagal menghubungi Flowix: ' + error.message });
    }
});

app.get('/api/server-ip', async (req, res) => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        res.json({ success: true, ip: response.data.ip });
    } catch (error) {
        res.json({ success: false, message: 'Gagal mengambil IP server' });
    }
});

// ================= 7. ROUTE API LAINNYA =================
app.get("/status", (req, res) => res.status(200).json({ status: "online" }));


app.get('/api/store-info', (req, res) => {
    const cfg = getConfig();
    res.json({ storeName: cfg.storeName || 'Rullzye Store' });
});

app.post('/api/cek-nickname', async (req, res) => {
    const { service, target, targetZone } = req.body;
    const cfg = getConfig();
    const merchantId = cfg.apigamesMerchantId || ""; const secretKey = cfg.apigamesSecretKey || "";
    if (!merchantId || !secretKey) return res.json({ success: false, message: "Cek nickname tidak tersedia." });
    try {
        let gameSlug = ""; let sku = service.toLowerCase();
        if (sku.includes('ml') || sku.includes('mobile')) gameSlug = "mobilelegend";
        else if (sku.includes('ff') || sku.includes('freefire')) gameSlug = "freefire";
        else if (sku.includes('pubg')) gameSlug = "pubgmobile";
        else if (sku.includes('valo')) gameSlug = "valorant";
        else if (sku.includes('cod')) gameSlug = "callofduty";
        else if (sku.includes('genshin')) gameSlug = "genshinimpact";
        else return res.json({ success: false, message: "Gagal cek, langsung bayar." });
        const signature = crypto.createHash('md5').update(merchantId + secretKey).digest('hex');
        let urlApiGames = `https://v1.apigames.id/merchant/${merchantId}/cek-username/${gameSlug}?user_id=${target}&signature=${signature}`;
        if (targetZone) urlApiGames += `&zone_id=${targetZone}`;
        const apiRes = await axios.get(urlApiGames);
        if (apiRes.data && apiRes.data.status === 1) res.json({ success: true, nickname: apiRes.data.data.username || apiRes.data.data, label: 'PLAYER NAME' });
        else res.json({ success: false, message: apiRes.data.error_msg || 'ID Salah.' });
    } catch (e) { res.json({ success: false, message: 'Gagal terhubung ke pusat.' }); }
});

app.get('/api/products', async (req, res) => {
    try {
        const cfg = getConfig();
        const resP = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey });
        const p = resP.data.products.map(x => {
            const s = (cfg.productSettings && cfg.productSettings[x.id]) || {};
            const profit = (s.profit !== null && s.profit !== undefined) ? s.profit : parseInt(cfg.profit || 2000);
            return { 
                id: x.id, 
                name: x.name, 
                price: parseInt(x.price) + profit, 
                stock: s.isOutOfStock ? 0 : x.stock,
                badge: s.badge || null   // ✅ tambahkan ini
            };
        });
        res.json({ success: true, products: p });
    } catch (e) { res.json({ success: false }); }
});

app.get('/api/topup-products', async (req, res) => {
    const cfg = getConfig();
    try {
        const signature = getCelestialSignature(cfg.celestialApiKey, cfg.celestialSecret);
        const resP = await axios.post('https://celestialtopup.com/api/v1/produk', { api_key: cfg.celestialApiKey, signature: signature });
        if (resP.data && resP.data.success) {
            const p = resP.data.data.map(x => ({ id: x.sku, name: `${x.brand} - ${x.nama_produk}`, price: parseInt(x.harga) + parseInt(cfg.profit || 2000), stock: (x.status.toLowerCase() === 'tersedia') ? 999 : 0, isZoneRequired: x.butuh_zone_id }));
            res.json({ success: true, products: p });
        } else res.json({ success: false, message: resP.data?.message });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/smm-products', async (req, res) => {
    const cfg = getConfig();
    try {
        const params = new URLSearchParams();
        params.append('api_key', cfg.smmApiKey); params.append('secret_key', cfg.smmSecretKey); params.append('action', 'services');
        const smmRes = await axios.post('https://pusatpanelsmm.com/api/json.php', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
        let services = smmRes.data?.data || (Array.isArray(smmRes.data) ? smmRes.data : []);
        if (services.length > 0) res.json({ success: true, data: services.map(x => ({ id: x.id, category: x.category, name: x.name, price: parseInt(x.price), min: parseInt(x.min), max: parseInt(x.max) })) });
        else res.json({ success: false, message: "Gagal memuat layanan SMM" });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// Landing page toko affiliate (serve static HTML)
app.get('/toko/:refCode', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'public', 'toko.html'));
});

// API: Data toko affiliate
app.get('/api/toko/:refCode', async (req, res) => {
    try {
        const { refCode } = req.params;
        const users = await getUsers();
        const affiliate = users.find(u => u.randomId === refCode.toUpperCase());
        const cfg = getConfig();
        if (!affiliate || !affiliate.isAffiliate) return res.json({ success: false, message: 'Toko tidak ditemukan.' });

        // Ambil produk
        let products = [];
        try {
            const mixedRes = await axios.get(`http://localhost:${PORT}/api/mixed-products`);
            if (mixedRes.data?.success) products = mixedRes.data.products;
        } catch(e) {}

        // Filter produk jika affiliate punya selectedProducts
        if (affiliate.selectedProducts && affiliate.selectedProducts.length > 0) {
            products = products.filter(p => affiliate.selectedProducts.includes(p.id));
        }

        // Apply markup
        const markup = affiliate.markupPercent || 0;
        if (markup > 0) {
            products = products.map(p => ({ ...p, price: Math.round(p.price * (1 + markup / 100)) }));
        }

        const downlines = users.filter(u => u.referredBy === affiliate.randomId).length;

        res.json({
            success: true,
            profile: {
                name: affiliate.affiliateName || affiliate.firstName || 'Toko',
                bio: affiliate.affiliateBio || '',
                avatar: affiliate.avatarUrl || '',
                themeColor: affiliate.themeColor || '#7c3aed',
                socialLinks: affiliate.socialLinks || {},
                refCode: affiliate.randomId,
                botUsername: cfg.botUsername || 'RullzyeBot',
                downlines,
                storeName: cfg.storeName || 'RullzyeStore'
            },
            products
        });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// ================= 8. PELANGGAN: PRODUK FLOWIX (DENGAN CACHE) =================
let cachedPPOB = { data: null, time: 0, ttl: 2 * 60 * 1000 };

app.get('/api/ppob-products', async (req, res) => {
    const cfg = getConfig();
    if (!cfg.flowixApiKey || !cfg.flowixMerchantId) {
        return res.json({ success: false, message: 'Flowix belum dikonfigurasi.' });
    }

    if (cachedPPOB.data && Date.now() - cachedPPOB.time < cachedPPOB.ttl) {
        return res.json({ success: true, products: cachedPPOB.data });
    }

    try {
        const result = await ppob.getProducts(cfg.flowixApiKey, cfg.flowixMerchantId, 'prepaid');
        if (!result.success) return res.json({ success: false, message: result.message });

        const profit = parseInt(cfg.profit || 2000);
        const products = result.data
            .filter(p => p.status && p.status.toLowerCase() === 'aktif')
            .map(p => ({
                id: p.code,
                name: p.name,
                price: parseInt(p.price) + profit,
                basePrice: parseInt(p.price),
                stock: 9999,
                brand: p.brand || '',
                category: p.brand || 'Umum'
            }));

        cachedPPOB = { data: products, time: Date.now(), ttl: 2 * 60 * 1000 };
        res.json({ success: true, products });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.get('/api/ppob-products-debug', async (req, res) => {
    const cfg = getConfig();
    if (!cfg.flowixApiKey || !cfg.flowixMerchantId) return res.json({ success: false, message: 'Konfig Flowix belum diisi' });
    try {
        const result = await ppob.getProducts(cfg.flowixApiKey, cfg.flowixMerchantId, 'prepaid');
        res.json(result);
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// ================= 9. PELANGGAN: ORDER FLOWIX =================
const checkRandomId = async (randomId) => { if (!randomId) return null; const users = await getUsers(); return users.find(u => u.randomId === randomId); };

app.post('/api/ppob-order', async (req, res) => {
    const { productId, target, productName, displayPrice, randomId } = req.body;
    console.log(`[ORDER] productId=${productId}, target=${target}, randomId=${randomId}`);
    const cfg = getConfig();
    const user = await checkRandomId(randomId);
    if (!user) return res.json({ status: false, message: '❌ Random ID Tidak Valid! Daftar di Bot.' });
    if (!cfg.flowixApiKey || !cfg.flowixMerchantId) {
        return res.json({ status: false, message: '❌ Layanan Flowix belum diatur oleh Admin.' });
    }

    try {
        const productInfo = cachedPPOB.data ? cachedPPOB.data.find(p => p.id === productId) : null;
        if (!productInfo) {
            return res.json({ status: false, message: '❌ Produk sedang gangguan atau sudah tidak tersedia.' });
        }

        const finalAmount = parseInt(displayPrice);
        console.log(`[ORDER] Final amount: ${finalAmount}`);

        const deposit = await ppob.createDeposit(cfg.flowixApiKey, cfg.flowixMerchantId, finalAmount, 'QRIS', true);
        console.log('[DEPOSIT] Response:', JSON.stringify(deposit).substring(0, 300));
        if (!deposit.success) {
            return res.json({ status: false, message: deposit.message || 'Gagal membuat deposit' });
        }

        const flowixReffId = deposit.data?.reff_id;
        if (!flowixReffId) {
            return res.json({ status: false, message: 'Deposit berhasil tetapi tidak ada reff_id.' });
        }

        console.log(`[DEPOSIT] reff_id: ${flowixReffId}`);

        let orders = await getOrders();
        orders.push({
            idDeposit: flowixReffId,
            idOrder: null,
            productId,
            productName,
            targetPhone: target,
            status: 'MENUNGGU_BAYAR',
            accountDetails: '-',
            telegramChatId: user.chatId,
            type: 'FLOWIX',
            resellerProfit: 0,
            displayPrice: displayPrice,
            productStatus: 'Aktif'
        });
        await saveOrders(orders);
        notifyGroupOrderNew(orders[orders.length - 1]).catch(() => {});

        const invoiceAmount = deposit.data.amount_total || finalAmount;
        const qrUrl = deposit.data.qr_image || deposit.data.pay_url || '';

        if (bot && user.chatId && qrUrl) {
            bot.sendPhoto(user.chatId, qrUrl, {
                caption: `📱 *ORDER PPOB BARU*\n\n📦 ${productName}\n🎯 Target: \`${target}\`\n💰 Total: *Rp ${invoiceAmount.toLocaleString('id-ID')}*\n🔖 Order ID: \`${flowixReffId}\`\n\nSilakan scan QRIS di atas. Setelah dibayar, saldo admin akan otomatis memproses pesananmu.`,
                parse_mode: 'Markdown'
            }).catch(e => console.error('[QR] gagal kirim:', e.message));
        }

        res.json({
            status: true,
            invoice: {
                orderId: flowixReffId,
                amount: invoiceAmount,
                qr_url: qrUrl,
                botLink: `https://t.me/${cfg.botUsername}?start=${flowixReffId}`
            }
        });
    } catch (e) {
        console.error('[ORDER] Error:', e);
        res.json({ status: false, message: e.message });
    }
});

// ================= 10. RETRY ORDER (LANGSUNG TRANSAKSI) =================
app.post('/api/ppob-retry', async (req, res) => {
    const { productId, target, productName, displayPrice, randomId } = req.body;
    console.log('[RETRY]', { productId, target, productName, displayPrice, randomId });
    const cfg = getConfig();
    const user = await checkRandomId(randomId);
    if (!user) return res.json({ status: false, message: '❌ Random ID tidak valid.' });
    if (!cfg.flowixApiKey || !cfg.flowixMerchantId) return res.json({ status: false, message: '❌ PPOB belum dikonfigurasi.' });

    try {
        const productInfo = cachedPPOB.data ? cachedPPOB.data.find(p => p.id === productId) : null;
        if (!productInfo) return res.json({ status: false, message: '❌ Produk sedang gangguan.' });

        const buyRes = await ppob.createTransaction(cfg.flowixApiKey, cfg.flowixMerchantId, productId, target);
        console.log('[RETRY] transaksi:', JSON.stringify(buyRes).substring(0, 400));

        if (buyRes.success && buyRes.data?.reff_id) {
            let orders = await getOrders();
            orders.push({
                idDeposit: 'RETRY-' + Date.now(),
                idOrder: buyRes.data.reff_id,
                productId,
                productName,
                targetPhone: target,
                status: 'PROSES_PUSAT',
                accountDetails: '-',
                telegramChatId: user.chatId,
                type: 'FLOWIX',
                resellerProfit: 0,
                displayPrice: displayPrice,
                productStatus: 'Aktif'
            });
            await saveOrders(orders);

            if (bot && user.chatId) {
                bot.sendMessage(user.chatId, `🔄 *RETRY BERHASIL*\n📦 ${productName}\n🎯 \`${target}\`\n🔖 ${buyRes.data.reff_id}\nStatus: *${buyRes.data.status || 'processing'}*`, { parse_mode: 'Markdown' }).catch(() => {});
            }
            res.json({ status: true, message: 'Transaksi retry dibuat', reff_id: buyRes.data.reff_id });
        } else {
            res.json({ status: false, message: buyRes.message || 'Gagal membuat transaksi retry' });
        }
    } catch (e) {
        console.error('[RETRY] error:', e);
        res.json({ status: false, message: e.message });
    }
});

// ================= 11. ROUTE ORDER HYBRID LAMA =================
app.post('/api/order', async (req, res) => {
    const { service, target, productName, displayPrice, randomId } = req.body;
    const cfg = getConfig(); const user = await checkRandomId(randomId);
    if (!user) return res.json({ status: false, message: '❌ Random ID Tidak Valid! Daftar di Bot.' });
    try {
        const finalTagihan = parseInt(displayPrice); 
        const resPay = await axios.post('https://premku.com/api/pay', { api_key: cfg.apiKey, amount: finalTagihan });
        if (resPay.data && resPay.data.success) {
            let orders = await getOrders();
            orders.push({ idDeposit: resPay.data.data.invoice, idOrder: null, productId: service, productName, targetPhone: target, status: 'MENUNGGU_BAYAR', accountDetails: '-', telegramChatId: user.chatId, type: 'PREMKU', resellerProfit: parseInt(cfg.profit||2000) });
            await saveOrders(orders);
            res.json({ status: true, invoice: { orderId: resPay.data.data.invoice, amount: resPay.data.data.total_bayar, qr_url: resPay.data.data.qr_image, botLink: `https://t.me/${cfg.botUsername}?start=${resPay.data.data.invoice}` } });
        } else res.json({ status: false, message: 'Gagal membuat QRIS Premku' });
    } catch (e) { res.json({ status: false, message: e.message }); }
});

app.post('/api/topup-order', async (req, res) => {
    const { service, target, targetZone, productName, displayPrice, randomId, nickname } = req.body;
    const cfg = getConfig(); const user = await checkRandomId(randomId);
    if (!user) return res.json({ status: false, message: '❌ Random ID Tidak Valid! Daftar di Bot.' });
    try {
        const finalTagihan = parseInt(displayPrice);
        const resDep = await axios.post('https://celestialtopup.com/api/v1/deposit', { api_key: cfg.celestialApiKey, signature: getCelestialSignature(cfg.celestialApiKey, cfg.celestialSecret), jumlah: finalTagihan });
        if (resDep.data && resDep.data.success) {
            let orders = await getOrders();
            orders.push({ idDeposit: resDep.data.data.deposit_id, idOrder: null, productId: service, productName, targetPhone: target, zoneId: targetZone || "", status: 'MENUNGGU_BAYAR', accountDetails: '-', telegramChatId: user.chatId, type: 'CELESTIAL', resellerProfit: parseInt(cfg.profit||2000), nickname: nickname || target });
            await saveOrders(orders);
            res.json({ status: true, invoice: { orderId: resDep.data.data.deposit_id, amount: resDep.data.data.jumlah, qr_url: resDep.data.data.qr_image, botLink: `https://t.me/${cfg.botUsername}?start=${resDep.data.data.deposit_id}` } });
        } else res.json({ status: false, message: 'Deposit Celestial Gagal' });
    } catch (e) { res.json({ status: false, message: e.message }); }
});

app.post('/api/smm-order', async (req, res) => {
    const { service, target, qty, productName, displayPrice, randomId } = req.body;
    const cfg = getConfig(); const user = await checkRandomId(randomId);
    if (!user) return res.json({ status: false, message: '❌ Random ID Tidak Valid! Daftar di Bot.' });
    try {
        const finalTagihan = parseInt(displayPrice);
        const resPay = await axios.post('https://premku.com/api/pay', { api_key: cfg.apiKey, amount: finalTagihan });
        if (resPay.data && resPay.data.success) {
            let orders = await getOrders();
            orders.push({ idDeposit: resPay.data.data.invoice, idOrder: null, productId: service, productName, targetPhone: target, qty: qty, status: 'MENUNGGU_BAYAR', accountDetails: '-', telegramChatId: user.chatId, type: 'SMM', resellerProfit: parseInt(cfg.profit||2000) });
            await saveOrders(orders);
            res.json({ status: true, invoice: { orderId: resPay.data.data.invoice, amount: resPay.data.data.total_bayar, qr_url: resPay.data.data.qr_image, botLink: `https://t.me/${cfg.botUsername}?start=${resPay.data.data.invoice}` } });
        } else res.json({ status: false, message: 'Gagal membuat QRIS SMM' });
    } catch (e) { res.json({ status: false, message: e.message }); }
});

// ================= 12. AUTO-PILOT HYBRID =================
async function autoProc() {
    if (isProcessing) return;
    isProcessing = true;
    try {
        let orders = await getOrders(); let changed = false; const cfg = getConfig(); let users = null;
        for (let i = 0; i < orders.length; i++) {
            let o = orders[i];
            if (!o.type || o.type === 'PREMKU') {
                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const resCek = await axios.post('https://premku.com/api/pay_status', { api_key: cfg.apiKey, invoice: o.idDeposit });
                        if (resCek.data?.data?.status === 'success' || resCek.data?.status === 'success') {
                            const resBuy = await axios.post('https://premku.com/api/order', { api_key: cfg.apiKey, product_id: parseInt(o.productId), qty: 1, ref_id: o.idDeposit });
                            if (resBuy.data && resBuy.data.success) {
                                orders[i].status = 'PROSES_PUSAT'; orders[i].idOrder = resBuy.data.invoice; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, '✅ *PEMBAYARAN DITERIMA*\nMemproses Akun...', { parse_mode: "Markdown" }).catch(()=>{});
                            }
                        }
                    } catch (e) {}
                }
                if (o.status === 'PROSES_PUSAT' && o.idOrder) {
                    try {
                        const resStatus = await axios.post('https://premku.com/api/status', { api_key: cfg.apiKey, invoice: o.idOrder });
                        if (resStatus.data?.status === 'success' || resStatus.data?.status === 'completed') {
                            let acc = Array.isArray(resStatus.data.accounts) ? resStatus.data.accounts.map(a => `📧 \`${a.username || a.email}\` | 🔑 \`${a.password}\``).join('\n') : (resStatus.data.accounts || "Selesai");
                            orders[i].status = 'SUKSES'; orders[i].accountDetails = acc; changed = true;
                            if (app.processAffiliateCommission) app.processAffiliateCommission(orders[i]).catch(()=>{});
                            if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `🎉 **PESANAN SELESAI!**\n📦 *${o.productName}*\n\n${acc}`, { parse_mode: "Markdown" }).catch(()=>{});
                        }
                    } catch (e) {}
                }
            } else if (o.type === 'CELESTIAL') {
                const sig = getCelestialSignature(cfg.celestialApiKey, cfg.celestialSecret);
                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const resCek = await axios.post('https://celestialtopup.com/api/v1/deposit/status', { api_key: cfg.celestialApiKey, signature: sig, deposit_id: o.idDeposit });
                        if (resCek.data && resCek.data.success && (resCek.data.data.status === 'paid' || resCek.data.data.status === 'success')) {
                            const buyRes = await axios.post('https://celestialtopup.com/api/v1/order', { api_key: cfg.celestialApiKey, signature: sig, ref_id: o.idDeposit, sku: o.productId, target: o.targetPhone, zone_id: o.zoneId || "" });
                            if (buyRes.data && buyRes.data.success) {
                                orders[i].status = 'PROSES_PUSAT'; orders[i].idOrder = buyRes.data.data?.trx_id || buyRes.data.trx_id; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, '✅ *PEMBAYARAN DITERIMA*\nMemproses Top Up Game...', { parse_mode: "Markdown" }).catch(()=>{});
                            }
                        }
                    } catch (e) {}
                }
                if (o.status === 'PROSES_PUSAT' && o.idOrder) {
                    try {
                        const trxRes = await axios.post('https://celestialtopup.com/api/v1/status', { api_key: cfg.celestialApiKey, signature: sig, trx_id: o.idOrder });
                        if (trxRes.data && trxRes.data.success) {
                            if (trxRes.data.data.status === 'success') {
                                let msg = `✅ *TOP UP BERHASIL*\n🎯 ${o.nickname || o.targetPhone}\n🧾 SN: \`${trxRes.data.data.sn || '-'}\``;
                                orders[i].status = 'SUKSES'; orders[i].accountDetails = msg; changed = true;
                                if (app.processAffiliateCommission) app.processAffiliateCommission(orders[i]).catch(()=>{});
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, msg, { parse_mode: "Markdown" }).catch(()=>{});
                            } else if (trxRes.data.data.status === 'error' || trxRes.data.data.status === 'failed') {
                                orders[i].status = 'GAGAL'; orders[i].accountDetails = 'Gagal Pusat'; changed = true;
                            }
                        }
                    } catch (e) {}
                }
            } else if (o.type === 'SMM') {
                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const resCek = await axios.post('https://premku.com/api/pay_status', { api_key: cfg.apiKey, invoice: o.idDeposit });
                        if (resCek.data?.data?.status === 'success' || resCek.data?.status === 'success') {
                            const params = new URLSearchParams(); params.append('api_key', cfg.smmApiKey); params.append('secret_key', cfg.smmSecretKey); params.append('action', 'order'); params.append('service', o.productId); params.append('target', o.targetPhone); params.append('quantity', o.qty);
                            const smmBuy = await axios.post('https://pusatpanelsmm.com/api/json.php', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
                            if (smmBuy.data && smmBuy.data.status) {
                                orders[i].status = 'SUKSES'; orders[i].idOrder = smmBuy.data.data ? smmBuy.data.data.id : '-'; orders[i].accountDetails = `SMM Diproses (ID: ${orders[i].idOrder})`; changed = true;
                                if (app.processAffiliateCommission) app.processAffiliateCommission(orders[i]).catch(()=>{});
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, '✅ *PESANAN SMM BERHASIL*\nSedang dikerjakan oleh server!', { parse_mode: "Markdown" }).catch(()=>{}); 
                            } else { orders[i].status = 'GAGAL'; changed = true; }
                        }
                    } catch (e) {}
                }
            } else if (o.type === 'FLOWIX') {
                const cfgFlowix = getConfig();
                if (!cfgFlowix.flowixApiKey || !cfgFlowix.flowixMerchantId) continue;
                console.log(`[AUTO] FLOWIX: ${o.idDeposit} status=${o.status}`);

                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const cek = await ppob.checkDeposit(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.idDeposit);
                        console.log(`[AUTO] Deposit ${o.idDeposit}:`, cek.data?.status);
                        if (cek.success && cek.data) {
                            const ds = cek.data.status;
                            if (ds === 'success' || ds === 'paid') {
                                const productInfo = cachedPPOB.data ? cachedPPOB.data.find(p => p.id === o.productId) : null;
                                if (!productInfo) {
                                    orders[i].status = 'GAGAL';
                                    orders[i].accountDetails = 'Produk sudah tidak tersedia / gangguan.';
                                    changed = true;
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *PRODUK GANGGUAN*...`).catch(()=>{});
                                    continue;
                                }
                                const buy = await ppob.createTransaction(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.productId, o.targetPhone);
                                if (buy.success && buy.data?.reff_id) {
                                    orders[i].status = 'PROSES_PUSAT';
                                    orders[i].idOrder = buy.data.reff_id;
                                    orders[i].accountDetails = `Status: ${buy.data.status || 'processing'}`;
                                    changed = true;
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `✅ *PEMBAYARAN DITERIMA*...`).catch(()=>{});
                                } else {
                                    const errorMsg = buy.message || 'Gagal membuat transaksi';
                                    orders[i].status = 'GAGAL'; orders[i].accountDetails = errorMsg; changed = true;
                                    if (errorMsg.includes('tidak ditemukan') || errorMsg.includes('not found')) {
                                        if (cachedPPOB.data) {
                                            const idx = cachedPPOB.data.findIndex(p => p.id === o.productId);
                                            if (idx !== -1) { cachedPPOB.data.splice(idx, 1); console.log(`[AUTO] Produk ${o.productId} dihapus dari cache.`); }
                                        }
                                    }
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *TRANSAKSI GAGAL*...`).catch(()=>{});
                                }
                            } else if (['failed','expired','canceled'].includes(ds)) {
                                orders[i].status = 'GAGAL'; orders[i].accountDetails = `Deposit ${ds}`; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *DEPOSIT ${ds.toUpperCase()}*...`).catch(()=>{});
                            }
                        }
                    } catch (e) {}
                }

                if (o.status === 'PROSES_PUSAT' && o.idOrder) {
                    try {
                        const ts = await ppob.checkTransaction(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.idOrder);
                        if (ts.success && ts.data) {
                            const trx = ts.data.status;
                            if (trx === 'success') {
                                orders[i].status = 'SUKSES';
                                orders[i].accountDetails = `SN: ${ts.data.sn || '-'} | ${ts.data.note || 'Berhasil'}`;
                                changed = true;
                                if (app.processAffiliateCommission) app.processAffiliateCommission(orders[i]).catch(()=>{});
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `🎉 *TRANSAKSI BERHASIL*...`).catch(()=>{});
                            } else if (trx === 'failed' || trx === 'error') {
                                orders[i].status = 'GAGAL';
                                orders[i].accountDetails = ts.data.note || ts.data.message || 'Transaksi gagal';
                                changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *TRANSAKSI GAGAL*...`).catch(()=>{});
                            } else if (trx === 'processing') {
                                if (bot && o.telegramChatId && o.accountDetails !== 'Status: processing') {
                                    orders[i].accountDetails = 'Status: processing';
                                    changed = true;
                                    bot.sendMessage(o.telegramChatId, `⏳ *MASIH DIPROSES*...`).catch(()=>{});
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
        if (changed) await saveOrders(orders);
        await autoProcPanel();
    } finally { isProcessing = false; }
}
setInterval(autoProc, 10000);

// ================= RESELLER API ENDPOINTS =================
app.post('/api/reseller/dashboard', async (req, res) => {
    try {
        const { randomId } = req.body;
        if (!randomId) return res.json({ success: false, message: 'Random ID diperlukan.' });
        const users = await getUsers();
        const user = users.find(u => u.randomId === randomId && u.isReseller);
        if (!user) return res.json({ success: false, message: 'Reseller tidak ditemukan.' });
        const orders = (await getOrders()).filter(o => o.buyerRandomId === randomId);
        const totalSales = orders.filter(o => o.status === 'SUKSES').length;
        const totalRevenue = orders.filter(o => o.status === 'SUKSES').reduce((s, o) => s + (o.displayPrice || 0), 0);
        res.json({
            success: true,
            profile: { name: user.firstName || 'Reseller', balance: user.balance || 0, randomId: user.randomId },
            stats: { totalOrders: orders.length, totalSales, totalRevenue, markup: user.markup || 0 },
            recentOrders: orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20)
        });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/reseller/withdraw', async (req, res) => {
    try {
        const { randomId, amount, bankDetails } = req.body;
        if (!randomId || !amount || !bankDetails) return res.json({ success: false, message: 'Data tidak lengkap.' });
        let users = await getUsers();
        const idx = users.findIndex(u => u.randomId === randomId && u.isReseller);
        if (idx === -1) return res.json({ success: false, message: 'Reseller tidak ditemukan.' });
        if ((users[idx].balance || 0) < amount) return res.json({ success: false, message: 'Saldo tidak mencukupi.' });
        users[idx].balance -= amount;
        await saveUsers(users);
        let wds = await getWithdraws();
        wds.push({ id: 'WD-R-' + Date.now(), randomId, amount: parseInt(amount), bankDetails, status: 'PENDING', date: new Date().toISOString(), type: 'RESELLER' });
        await saveWithdraws(wds);
        res.json({ success: true, message: 'Permintaan withdraw diajukan. Tunggu konfirmasi admin.' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/reseller/set-markup', async (req, res) => {
    try {
        const { randomId, markup } = req.body;
        if (!randomId || markup === undefined) return res.json({ success: false, message: 'Data tidak lengkap.' });
        let users = await getUsers();
        const idx = users.findIndex(u => u.randomId === randomId && u.isReseller);
        if (idx === -1) return res.json({ success: false, message: 'Reseller tidak ditemukan.' });
        users[idx].markup = parseInt(markup) || 0;
        await saveUsers(users);
        res.json({ success: true, message: 'Markup berhasil diperbarui.' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// ================= STOCK UPDATE NOTIFICATION =================
app.post('/api/admin/notify-stock', async (req, res) => {
    try {
        const mixedRes = await axios.get(`http://localhost:${PORT}/api/mixed-products`);
        if (mixedRes.data?.success) {
            const products = mixedRes.data.products;
            const lowStock = products.filter(p => p.stock !== undefined && p.stock < 10);
            const outOfStock = products.filter(p => p.stock === 0);
            const msg = `📊 *LAPORAN STOK PRODUK*\n\n✅ Total Produk: ${products.length}\n⚠️ Stok Menipis (<10): ${lowStock.length}\n❌ Habis: ${outOfStock.length}`;
            await notifyGroupStockUpdate(products).catch(() => {});
            res.json({ success: true, message: msg });
        } else {
            res.json({ success: false, message: 'Gagal mengambil produk.' });
        }
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: NEW ENDPOINTS =================
app.post('/api/admin/users/edit', async (req, res) => {
    try {
        const { randomId, name, balance, affiliateBalance } = req.body;
        let users = await getUsers();
        const idx = users.findIndex(u => u.randomId === randomId);
        if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
        if (name !== undefined) users[idx].firstName = name;
        if (balance !== undefined) users[idx].balance = parseInt(balance);
        if (affiliateBalance !== undefined) users[idx].affiliateBalance = parseInt(affiliateBalance);
        await saveUsers(users);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/order/force-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        let orders = await getOrders();
        const idx = orders.findIndex(o => o.idDeposit === id || o.idOrder === id);
        if (idx === -1) return res.json({ success: false, message: 'Order tidak ditemukan.' });
        orders[idx].status = status;
        orders[idx].accountDetails = orders[idx].accountDetails || `Manual: ${status}`;
        await saveOrders(orders);
        if (status === 'SUKSES' && app.processAffiliateCommission) {
            app.processAffiliateCommission(orders[idx]).catch(()=>{});
        }
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/affiliate/add-balance', async (req, res) => {
    try {
        const { randomId, amount } = req.body;
        let users = await getUsers();
        const idx = users.findIndex(u => u.randomId === randomId && u.isAffiliate);
        if (idx === -1) return res.json({ success: false, message: 'Affiliate tidak ditemukan.' });
        users[idx].affiliateBalance = (users[idx].affiliateBalance || 0) + parseInt(amount);
        await saveUsers(users);
        res.json({ success: true, message: `Saldo komisi ditambahkan Rp ${parseInt(amount).toLocaleString('id-ID')}` });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/change-pin', async (req, res) => {
    try {
        const { oldPin, newPin } = req.body;
        if (oldPin !== getAdminPin()) return res.json({ success: false, message: 'PIN lama salah.' });
        if (!newPin || newPin.length < 4) return res.json({ success: false, message: 'PIN baru minimal 4 karakter.' });
        const cfg = getConfig();
        cfg.adminPin = newPin;
        await saveConfig(cfg);
        res.json({ success: true, message: 'PIN berhasil diganti!' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/save-groups', async (req, res) => {
    try {
        const { groupIds } = req.body;
        const cfg = getConfig();
        cfg.groupIds = groupIds;
        await saveConfig(cfg);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/test-group', async (req, res) => {
    try {
        const { groupId } = req.body;
        if (!bot) return res.json({ success: false, message: 'Bot tidak aktif.' });
        await bot.sendMessage(groupId, '🧪 *Test Notifikasi*\n\nPesan ini adalah test. Jika kamu melihat ini, grup berhasil terhubung! ✅', { parse_mode: 'Markdown' });
        res.json({ success: true, message: 'Pesan test terkirim!' });
    } catch(e) { res.json({ success: false, message: 'Gagal: ' + e.message }); }
});

app.post('/api/admin/database/reset', async (req, res) => {
    try {
        await saveUsers([]);
        await saveOrders([]);
        const wds = await getWithdraws();
        const processed = wds.filter(w => w.status !== 'PENDING');
        await saveWithdraws(processed);
        res.json({ success: true, message: 'Database direset. Data pending withdrawal dipertahankan.' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= 13. PANEL PTERODACTYL =================
// Public: get active panel products
app.get('/api/panel/products', async (req, res) => {
    const products = await getPanelProducts();
    res.json({ success: true, products });
});

// Admin: CRUD panel products
app.get('/api/admin/panel/products', async (req, res) => {
    res.json({ success: true, products: await getPanelProducts() });
});

app.post('/api/admin/panel/products', async (req, res) => {
    try {
        const products = await getPanelProducts();
        const { name, description, shortDesc, price, stock, ram, cpu, storage, bandwidth, databases, backups, servers, features, category, image } = req.body;
        const id = 'PANEL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
        products.push({
            id, name, description: description||'', shortDesc: shortDesc||'',
            price: parseInt(price)||0, stock: parseInt(stock)||0,
            ram: parseInt(ram)||0, cpu: parseInt(cpu)||0, storage: parseInt(storage)||0,
            bandwidth: parseInt(bandwidth)||0, databases: parseInt(databases)||0,
            backups: parseInt(backups)||0, servers: parseInt(servers)||1,
            features: features||[], category: category||'Umum', image: image||'',
            active: true, createdAt: new Date().toISOString()
        });
        await savePanelProducts(products);
        res.json({ success: true, id, message: 'Produk panel berhasil ditambahkan' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.put('/api/admin/panel/products/:id', async (req, res) => {
    try {
        let products = await getPanelProducts();
        const idx = products.findIndex(p => p.id === req.params.id);
        if (idx === -1) return res.json({ success: false, message: 'Produk tidak ditemukan' });
        Object.keys(req.body).forEach(k => { if (k !== 'id') products[idx][k] = req.body[k]; });
        await savePanelProducts(products);
        res.json({ success: true, message: 'Produk diupdate' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/admin/panel/products/:id', async (req, res) => {
    try {
        let products = await getPanelProducts();
        products = products.filter(p => p.id !== req.params.id);
        await savePanelProducts(products);
        res.json({ success: true, message: 'Produk dihapus' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// Panel order: create via Premku QRIS
app.post('/api/panel/order', async (req, res) => {
    try {
        const { productId, buyerId, domain } = req.body;
        if (!productId || !buyerId) return res.json({ success: false, message: 'Product ID dan Buyer ID wajib diisi' });
        const products = await getPanelProducts();
        const product = products.find(p => p.id === productId && p.active !== false);
        if (!product) return res.json({ success: false, message: 'Produk tidak ditemukan' });
        if (product.stock <= 0) return res.json({ success: false, message: 'Stok habis' });
        
        const cfg = getConfig();
        const amount = parseInt(product.price);
        const payRes = await axios.post('https://premku.com/api/pay', { api_key: cfg.apiKey, amount });
        if (!payRes.data || !payRes.data.success) return res.json({ success: false, message: 'Gagal membuat QRIS' });
        
        const invoice = payRes.data.data.invoice;
        let orders = await getPanelOrders();
        orders.push({
            id: invoice,
            productId, productName: product.name, price: amount,
            buyerId, domain: domain||'', status: 'MENUNGGU_BAYAR',
            qrUrl: payRes.data.data.qr_image || '',
            invoice, createdAt: new Date().toISOString()
        });
        await savePanelOrders(orders);
        
        // Kurangi stok
        products.find(p => p.id === productId).stock--;
        await savePanelProducts(products);
        
        res.json({ success: true, invoice, amount, qrUrl: payRes.data.data.qr_image });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// Check panel order status
app.get('/api/panel/order/:invoice', async (req, res) => {
    try {
        const orders = await getPanelOrders();
        const order = orders.find(o => o.invoice === req.params.invoice);
        if (!order) return res.json({ status: 'NOT_FOUND' });
        res.json({ status: order.status, delivery: order.deliveryDetails || null });
    } catch(e) { res.json({ status: 'ERROR' }); }
});

// Admin: list panel orders
app.get('/api/admin/panel/orders', async (req, res) => {
    const orders = await getPanelOrders();
    res.json({ success: true, orders: orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// Admin: deliver panel (send credentials to buyer)
app.post('/api/admin/panel/deliver/:id', async (req, res) => {
    try {
        const { url, email, password } = req.body;
        if (!url || !email || !password) return res.json({ success: false, message: 'URL, Email, dan Password wajib diisi' });
        let orders = await getPanelOrders();
        const idx = orders.findIndex(o => o.id === req.params.id);
        if (idx === -1) return res.json({ success: false, message: 'Order tidak ditemukan' });
        orders[idx].status = 'DELIVERED';
        orders[idx].deliveryDetails = { url, email, password };
        orders[idx].deliveredAt = new Date().toISOString();
        await savePanelOrders(orders);
        // Kirim ke Telegram
        const users = await getUsers();
        const buyer = users.find(u => u.randomId === orders[idx].buyerId || String(u.chatId) === orders[idx].buyerId);
        if (bot && (buyer?.chatId || /^\d+$/.test(orders[idx].buyerId))) {
            const chatId = buyer?.chatId || orders[idx].buyerId;
            const msg = `🎉 *PESANAN PANEL SELESAI!* 🎉\n\n` +
                `📦 *Produk:* ${orders[idx].productName}\n` +
                `🔗 *URL Panel:* ${url}\n` +
                `📧 *Email:* \`${email}\`\n` +
                `🔑 *Password:* \`${password}\`\n\n` +
                `Simpan baik-baik ya! Jangan bagikan ke siapa pun.`;
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(()=>{});
        }
        res.json({ success: true, message: 'Panel berhasil dikirim ke pembeli' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// Auto-process: check panel payments
async function autoProcPanel() {
    const cfg = getConfig();
    if (!cfg.apiKey) return;
    let orders = await getPanelOrders();
    let changed = false;
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].status === 'MENUNGGU_BAYAR') {
            try {
                const cek = await axios.post('https://premku.com/api/pay_status', { api_key: cfg.apiKey, invoice: orders[i].invoice });
                if (cek.data?.data?.status === 'success' || cek.data?.status === 'success') {
                    orders[i].status = 'MENUNGGU_PENGIRIMAN';
                    orders[i].paidAt = new Date().toISOString();
                    changed = true;
                    // Notifikasi admin group
                    notifyGroupAdmin(`💳 *Pembayaran Panel*\n\n📦 *${orders[i].productName}*\n👤 *Buyer:* \`${orders[i].buyerId}\`\n💰 *Rp ${(orders[i].price||0).toLocaleString('id-ID')}*\n🔖 *Invoice:* \`${orders[i].invoice}\`\n\nSegera kirim panel!`).catch(()=>{});
                }
            } catch(e) {}
        }
    }
    if (changed) await savePanelOrders(orders);
}

// ================= 13. DOWNLOAD SKU =================
app.get('/api/reseller/download-sku', async (req, res) => {
    const cfg = getConfig();
    if (!cfg.apiKey) return res.status(500).send("API Key Kosong.");
    try {
        const resP = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey });
        let csvContent = "SKU,Nama Layanan,Harga Modal\n";
        resP.data.products.forEach(p => { csvContent += `${p.id},${p.name.replace(/,/g, '.')},${p.price}\n`; });
        res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename=Daftar_SKU.csv');
        res.status(200).send(csvContent);
    } catch (e) { res.status(500).send("Gagal mengambil data dari pusat."); }
});

// DEBUG: Lihat respons asli Celestial
app.get('/api/topup-products-debug', async (req, res) => {
    const cfg = getConfig();
    if (!cfg.celestialApiKey || !cfg.celestialSecret) {
        return res.json({ success: false, message: 'Celestial API Key/Secret belum diisi' });
    }
    try {
        const signature = getCelestialSignature(cfg.celestialApiKey, cfg.celestialSecret);
        const resP = await axios.post('https://celestialtopup.com/api/v1/produk', {
            api_key: cfg.celestialApiKey,
            signature: signature
        });
        res.json(resP.data); // kirimkan mentah
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

process.on('uncaughtException', (err) => {
    console.error('Error:', err);
    if (notifyGroupError) notifyGroupError(`Uncaught Exception: ${err.message}`).catch(() => {});
});

async function initConfigFromFirebase() {
    try {
        const res = await axios.get(`${FIREBASE_URL}/system_config.json`);
        if (res.data && Object.keys(res.data).length > 0) {
            fs.writeFileSync('./config.json', JSON.stringify(res.data, null, 2));
            console.log('✅ Konfigurasi dimuat dari Firebase');
            return true;
        } else {
            console.log('📁 Firebase config kosong, menggunakan config lokal');
        }
    } catch(e) {
        console.log('📁 Gagal muat dari Firebase:', e.message);
    }
    return false;
}

(async () => {
    await initConfigFromFirebase();

    // Load bot (membaca config.json yang sudah diperbarui dari Firebase)
    const botModule = require('./bot.js');
    bot = botModule.bot;
    sendBroadcast = botModule.sendBroadcast;
    notifyAffiliateApproved = botModule.notifyAffiliateApproved;
    notifyAffiliateRejected = botModule.notifyAffiliateRejected;
    notifyWithdrawSuccess = botModule.notifyWithdrawSuccess;
    notifyWithdrawRejected = botModule.notifyWithdrawRejected;
    notifyGroupAffiliateNew = botModule.notifyGroupAffiliateNew;
    notifyGroupOrderNew = botModule.notifyGroupOrderNew;
    notifyGroupOrderSuccess = botModule.notifyGroupOrderSuccess;
    notifyGroupWithdrawNew = botModule.notifyGroupWithdrawNew;
    notifyGroupWithdrawProcessed = botModule.notifyGroupWithdrawProcessed;
    notifyGroupError = botModule.notifyGroupError;
    notifyGroupCommission = botModule.notifyGroupCommission;
    notifyGroupStockUpdate = botModule.notifyGroupStockUpdate;
    notifyGroupAdmin = botModule.notifyGroupAdmin;

    // Load affiliate API routes
    require('./affiliate_api.js')(app, getUsers, saveUsers, getOrders, saveOrders, FIREBASE_URL);

    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server berjalan di port ${PORT}`));
})();
