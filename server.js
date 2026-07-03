const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require("cors");
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const security = require('./anti_fraud.js');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multi-admin: verifikasi username + pin
const verifyAdmin = (username, pin) => {
    const cfg = getConfig();
    // Super admin (username + pin dari objek superAdmin atau fallback)
    const sa = cfg.superAdmin || {};
    if (sa.pin && sa.username) {
        if (username === sa.username && pin === sa.pin) return { role: 'super_admin', username: sa.username, permissions: 'all' };
    } else {
        // Fallback: legacy superAdminPin
        if (pin === (cfg.superAdminPin || cfg.adminPin || '858486')) return { role: 'super_admin', username: 'Super Admin', permissions: 'all' };
    }
    // Regular admin
    if (cfg.admins && Array.isArray(cfg.admins)) {
        const admin = cfg.admins.find(a => a.username === username && a.pin === pin && a.active !== false);
        if (admin) return { role: 'admin', username: admin.username, permissions: admin.permissions || [] };
    }
    return null;
};

const hasPermission = (admin, requiredPerm) => {
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    return admin.permissions && admin.permissions.includes(requiredPerm);
};

// Parse auth header "username:pin" 
const parseAuthHeader = (header) => {
    if (!header || !header.includes(':')) return { username: '', pin: header || '' };
    const parts = header.split(':');
    return { username: parts[0], pin: parts.slice(1).join(':') };
};

// Admin auth middleware — attaches req.admin
const adminAuth = (req, res, next) => {
    const { username, pin } = parseAuthHeader(req.headers['x-admin-auth']);
    const admin = verifyAdmin(username, pin);
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.admin = admin;
    next();
};

const PORT = process.env.PORT || 3000;

// ================= 1. DATABASE LOKAL & FIREBASE =================
const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

let _cachedConfig = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5 detik
const getConfig = () => {
    const now = Date.now();
    if (_cachedConfig && (now - _configCacheTime) < CONFIG_CACHE_TTL) return _cachedConfig;
    try {
        _cachedConfig = JSON.parse(fs.readFileSync('./config.json'));
        _configCacheTime = now;
        return _cachedConfig;
    }
    catch(e) { return { apiKey: '', profit: 2000, botUsername: '', telegramToken: '', storeName: 'Rullzye Store', productSettings: {}, ppobCategoryProfits: {}, flowixApiKey: '', flowixMerchantId: '', firebaseConfig: {} }; }
};
const invalidateConfigCache = () => { _cachedConfig = null; _configCacheTime = 0; };
const saveConfig = async (configData) => {
    fs.writeFileSync('./config.json', JSON.stringify(configData, null, 2));
    invalidateConfigCache();
    try { await axios.put(`${FIREBASE_URL}/system_config.json`, configData); console.log('✅ Config disimpan ke Firebase'); } catch(e) { console.error('❌ Gagal simpan config ke Firebase:', e.message); }
};

const getOrders = async () => { try { const res = await axios.get(`${FIREBASE_URL}/orders.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveOrders = async (orders) => { try { await axios.put(`${FIREBASE_URL}/orders.json`, orders); } catch (e) { } };
const getUsers = async () => { try { const res = await axios.get(`${FIREBASE_URL}/users.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveUsers = async (users) => { try { await axios.put(`${FIREBASE_URL}/users.json`, users); } catch (e) { } };


const getWebUsers = async () => { try { const res = await axios.get(`${FIREBASE_URL}/webUsers.json`); return res.data ? (Array.isArray(res.data) ? res.data : Object.values(res.data)) : []; } catch (e) { return []; } };
const saveWebUsers = async (users) => { try { await axios.put(`${FIREBASE_URL}/webUsers.json`, users); } catch (e) { } };

const getTestimonials = async () => { try { const r = await axios.get(`${FIREBASE_URL}/testimonials.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const saveTestimonials = async (data) => { try { await axios.put(`${FIREBASE_URL}/testimonials.json`, data); } catch(e) {} };

const getPanelProducts = async () => { try { const r = await axios.get(`${FIREBASE_URL}/panel_products.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const savePanelProducts = async (data) => { try { await axios.put(`${FIREBASE_URL}/panel_products.json`, data); } catch(e) {} };
const getPanelOrders = async () => { try { const r = await axios.get(`${FIREBASE_URL}/panel_orders.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const savePanelOrders = async (data) => { try { await axios.put(`${FIREBASE_URL}/panel_orders.json`, data); } catch(e) {} };

const getPromos = async () => { try { const r = await axios.get(`${FIREBASE_URL}/promos.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const savePromos = async (data) => { try { await axios.put(`${FIREBASE_URL}/promos.json`, data); } catch(e) {} };
const getDailyPromo = async () => { try { const r = await axios.get(`${FIREBASE_URL}/dailyPromo.json`); return r.data||null; } catch(e) { return null; } };
const saveDailyPromo = async (data) => { try { await axios.put(`${FIREBASE_URL}/dailyPromo.json`, data); } catch(e) {} };
const getBroadcastCount = async () => { try { const r = await axios.get(`${FIREBASE_URL}/broadcastCount.json`); return r.data||0; } catch(e) { return 0; } };
const saveBroadcastCount = async (n) => { try { await axios.put(`${FIREBASE_URL}/broadcastCount.json`, n); } catch(e) {} };
const getTestEmailHtml = () => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:auto;background:#0b0e1a;border-radius:20px;overflow:hidden;border:1px solid #1e293b;padding:32px;text-align:center">
<div style="font-size:48px;margin-bottom:12px">✅</div>
<h1 style="color:#fff;font-size:20px;font-weight:900;margin:0">Test Berhasil!</h1>
<p style="color:#94a3b8;font-size:14px;margin:12px 0 16px">Konfigurasi email kamu berfungsi dengan baik.</p>
<div style="background:#1e293b;border-radius:10px;padding:12px;margin-bottom:12px">
<p style="color:#34d399;font-size:13px;font-weight:bold;margin:0">✨ Template siap digunakan</p>
</div>
<div style="background:#7c3aed20;border:1px solid #7c3aed40;border-radius:10px;padding:10px">
<p style="color:#a78bfa;font-size:11px;margin:0">Pembeli akan menerima email seperti ini setelah pesanan selesai.</p>
</div>
</div>`;
const buildOrderEmail = (storeName, productName, qty, accountsHtml, totalPrice, promo) => {
    const items = accountsHtml ? accountsHtml.split('<br>').filter(Boolean).map((line, i) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e293b;font-size:13px;color:#e2e8f0">${i+1}</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b;font-family:monospace;font-size:13px;color:#a78bfa">${line}</td></tr>`
    ).join('') : '';
    const promoHtml = promo ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:12px">Promo</td><td style="padding:8px 0;text-align:right;color:#34d399;font-size:12px;font-weight:bold">🏷️ ${promo.promoName}</td></tr>` : '';
    return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;background:#0b0e1a;border-radius:20px;overflow:hidden;border:1px solid #1e293b">
<div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:24px 32px;text-align:center">
<div style="font-size:36px;margin-bottom:8px">🎉</div>
<h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;letter-spacing:-0.5px">Pesanan Selesai!</h1>
<p style="color:#c4b5fd;margin:4px 0 0;font-size:13px">${storeName}</p>
</div>
<div style="padding:24px 32px">
<div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px">
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:4px 0;color:#94a3b8;font-size:12px">Produk</td><td style="padding:4px 0;text-align:right;color:#fff;font-size:14px;font-weight:bold">${productName}${qty>1 ? ' ×'+qty : ''}</td></tr>
<tr><td style="padding:4px 0;color:#94a3b8;font-size:12px">Total</td><td style="padding:4px 0;text-align:right;color:#fbbf24;font-size:16px;font-weight:900">Rp ${(totalPrice||0).toLocaleString('id-ID')}</td></tr>
${promoHtml}
</table></div>
${accountsHtml ? `
<div style="background:#131826;border-radius:12px;padding:16px;margin-bottom:16px">
<h3 style="color:#a78bfa;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">📋 Detail Akun</h3>
<table style="width:100%;border-collapse:collapse">
<tr style="background:#1e293b;font-size:11px;color:#94a3b8;text-transform:uppercase">
<th style="padding:8px 12px;text-align:left">#</th><th style="padding:8px 12px;text-align:left">Akun & Password</th>
</tr>
${items}
</table>
<p style="color:#64748b;font-size:11px;margin:12px 0 0;text-align:center">Gunakan detail di atas untuk login. Jangan bagikan ke siapa pun.</p>
</div>` : ''}
<div style="background:linear-gradient(135deg,#1e293b,#131826);border-radius:12px;padding:16px;text-align:center;margin-bottom:16px">
<p style="color:#94a3b8;font-size:12px;margin:0">Butuh bantuan? Hubungi kami di Telegram</p>
<p style="margin:6px 0 0"><a href="https://t.me/RullzyeBot" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:bold">📲 Hubungi CS</a></p>
</div>
<p style="color:#475569;font-size:11px;text-align:center;margin:0">© ${new Date().getFullYear()} ${storeName} — All rights reserved</p>
</div></div>`; };
const sendEmail = async (to, subject, html) => {
    try {
        const c = getConfig();
        if (c.emailProvider === 'resend' && c.resendKey) {
            const se = c.senderEmail || 'onboarding@resend.dev';
            const resp = await axios.post('https://api.resend.com/emails', {
                from: `${c.smtpFrom||'Rullzye Store'} <${se}>`,
                to: [to], subject, html
            }, { headers: { 'Authorization': `Bearer ${c.resendKey}`, 'Content-Type': 'application/json' }, timeout: 15000 });
            return true;
        }
        if (c.emailProvider === 'brevo' && c.brevoKey) {
            const senderEmail = c.senderEmail || c.smtpUser || 'noreply@rullzyestore.com';
            const resp = await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: c.smtpFrom||'Rullzye Store', email: senderEmail },
                to: [{ email: to }], subject, htmlContent: html
            }, { headers: { 'api-key': c.brevoKey, 'Content-Type': 'application/json' }, timeout: 15000 });
            return true;
        }
        if (c.smtpHost && c.smtpUser && c.smtpPass) {
            const t = nodemailer.createTransport({ host: c.smtpHost, port: parseInt(c.smtpPort)||587, secure: parseInt(c.smtpPort)===465, auth: { user: c.smtpUser, pass: c.smtpPass }, tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
            const from = c.smtpFrom ? `"${c.smtpFrom}" <${c.smtpUser}>` : c.smtpUser;
            await t.sendMail({ from, to, subject, html });
            return true;
        }
        return false;
    } catch(e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error('Email error:', detail);
        return false;
    }
};

const getPremkuBasePrice = async (productId) => {
    try { const cfg = getConfig(); const r = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey }); const p = r.data?.products?.find(x => x.id == productId); return p ? parseInt(p.price) : null; } catch(e) { return null; }
};

const genDailyPromo = async () => {
    try {
        const cfg = getConfig(); if (!cfg.apiKey) return;
        const r = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey });
        const products = r.data?.products || []; if (!products.length) return;
        const profitDefault = cfg.profit || 2000;
        const shuffled = products.sort(() => Math.random() - 0.5);
        for (const prod of shuffled) {
            const baseCost = parseInt(prod.price);
            const sellingPrice = baseCost + (cfg.productSettings?.[prod.id]?.profit ?? profitDefault);
            const prodId = String(prod.id);
            if (sellingPrice > 30000) {
                const margin = 10000; const discount = 5000;
                const userPays = baseCost + margin - discount; // yang dibayar user untuk 1 item
                const profit = userPays - baseCost * 2; // BOGO: dapet 2, bayar 1 item
                if (profit >= 0) {
                    const promo = {
                        id: 'DAILY-' + Date.now().toString(36).toUpperCase(),
                        name: '🔥 Promo Harian — ' + prod.name,
                        type: 'bogo_same', active: true,
                        targetProductIds: ['PREMKU-' + prodId, prodId],
                        tiers: [{ qty: 2, discountRp: discount }],
                        profitPerItem: profit,
                        productName: prod.name, baseCost, sellingPrice, margin, discount,
                        startDate: new Date().toISOString(),
                        endDate: new Date(Date.now() + 86400000).toISOString(),
                        maxUses: 999, usedCount: 0,
                        createdAt: new Date().toISOString()
                    };
                    await saveDailyPromo(promo);
                    console.log('[DAILY] Promo BOGO untuk:', prod.name, '| Profit:', profit);
                    return;
                }
            } else if (sellingPrice < 20000) {
                const profit = sellingPrice - baseCost * 2;
                if (profit >= 0) {
                    const promo = {
                        id: 'DAILY-' + Date.now().toString(36).toUpperCase(),
                        name: '🎉 BOGO Spesial — ' + prod.name,
                        type: 'bogo_same', active: true,
                        targetProductIds: ['PREMKU-' + prodId, prodId],
                        tiers: [{ qty: 2, discountRp: profitDefault }],
                        profitPerItem: profit,
                        productName: prod.name, baseCost, sellingPrice,
                        startDate: new Date().toISOString(),
                        endDate: new Date(Date.now() + 86400000).toISOString(),
                        maxUses: 999, usedCount: 0,
                        createdAt: new Date().toISOString()
                    };
                    await saveDailyPromo(promo);
                    console.log('[DAILY] BOGO receh untuk:', prod.name, '| Profit:', profit);
                    return;
                }
            }
        }
        console.log('[DAILY] Tidak ada produk yang cocok untuk promo hari ini');
    } catch(e) { console.error('[DAILY] Gagal generate:', e.message); }
};
const runBroadcast = async () => {
    try {
        const cfg = getConfig(); if (!bot || !cfg.ownerChatId) return;
        const dp = await getDailyPromo(); if (!dp) return;
        const msgs = [
            `🎯 *PROMO HARI INI*\n\n${dp.productName}\n🔥 BOGO — Bayar 1 Dapat 2!\nHemat besar-besaran hanya hari ini!\n\nKlik: https://rullzyestorepremium.my.id`,
            `⚡ *FLASH SALE — ${dp.productName}*\n${dp.type==='bogo_same'?'🎁 Beli 1 Gratis 1 🎁':'Diskon spesial!'}\nBuruan sebelum habis! ⏰\n\nhttps://rullzyestorepremium.my.id`,
            `🚀 *HARI INI SAJA!*\n${dp.productName}\n${dp.type==='bogo_same'?'💥 BOGO — Bayar 1 Dapat 2!':'Diskon gila-gilaan!'}\nJangan sampai kelewatan! 🔥\n\nhttps://rullzyestorepremium.my.id`
        ];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        await bot.sendMessage(cfg.ownerChatId, msg, { parse_mode: 'Markdown' });
        console.log('[BROADCAST] Terkirim ke grup');
    } catch(e) { console.error('[BROADCAST] Gagal:', e.message); }
};
const scheduleDailyPromo = () => {
    genDailyPromo();
    const now = new Date(); const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0);
    setTimeout(() => { genDailyPromo(); setInterval(genDailyPromo, 86400000); }, night - now);
};

const config = getConfig();
let isProcessing = false;


// ================= 2. LOAD MODULE FLOWIX =================
const ppob = require('./ppob.js');

// ================= 3. BOT SYSTEM VARS (dideklarasikan dulu, di-load setelah config) =================
let bot, sendBroadcast, notifyGroupOrderNew, notifyGroupOrderSuccess, notifyGroupError, notifyGroupStockUpdate, notifyGroupAdmin;

// ================= ADMIN: AUTH ENDPOINT =================
app.post('/api/admin/auth', (req, res) => {
    const { username, pin } = req.body;
    const admin = verifyAdmin(username || '', pin);
    if (admin) return res.json({ success: true, role: admin.role, username: admin.username || 'Super Admin', permissions: admin.permissions });
    res.json({ success: false, message: 'Username atau PIN salah!' });
});

// Apply admin auth to all /api/admin routes below
app.use('/api/admin', (req, res, next) => {
    if (req.path === '/auth') return next();
    adminAuth(req, res, next);
});

// ================= 4. API ADMIN DASHBOARD =================
app.get('/api/admin/users', async (req, res) => { if (!hasPermission(req.admin, 'users')) return res.json([]); res.json(await getUsers()); });
app.post('/api/admin/users/toggle', async (req, res) => {
    if (!hasPermission(req.admin, 'users')) return res.json({ success: false, message: 'Akses ditolak.' });
    const { randomId, isReseller } = req.body;
    let users = await getUsers();
    let index = users.findIndex(u => u.randomId === randomId);
    if(index !== -1) { users[index].isReseller = isReseller; await saveUsers(users); }
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
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const currentConfig = getConfig();
        const updatedConfig = { ...currentConfig, ...req.body };
        await saveConfig(updatedConfig);
        res.json({ success: true, message: 'Konfigurasi disimpan.' });
    } catch (e) {
        console.error('Gagal menyimpan config:', e);
        res.json({ success: false, message: 'Gagal menyimpan.' });
    }
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
        const [users, orders] = await Promise.all([getUsers(), getOrders()]);
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

        res.json({ success: true,
            users: { total: users.length },
            orders: { total: orders.length, today: todayOrders.length, thisMonth: monthOrders.length, sukses: sukses.length, gagal: gagal.length, pending: pending.length },
            revenue: { total: totalRevenue, thisMonth: monthRevenue },
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
app.get('/api/firebase-config', (req, res) => {
    const cfg = getConfig();
    res.json({ success: true, config: cfg.firebaseConfig || {} });
});
app.get('/api/admin/config', (req, res) => {
    if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
    res.json(getConfig());
});
app.post('/api/admin/test-email', async (req, res) => {
    if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
    const { to, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, emailProvider, brevoKey, resendKey, senderEmail } = req.body;
    if (!to) return res.json({ success: false, message: 'Email tujuan wajib diisi.' });
    try {
        if (emailProvider === 'resend' && resendKey) {
            const se = senderEmail || 'onboarding@resend.dev';
            await axios.post('https://api.resend.com/emails', {
                from: `${smtpFrom||'Rullzye Store'} <${se}>`,
                to: [to], subject: 'Test Email — Rullzye Store', html: getTestEmailHtml()
            }, { headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, timeout: 15000 });
            return res.json({ success: true, message: 'Email test terkirim via Resend!' });
        }
        if (emailProvider === 'brevo' && brevoKey) {
            const se = senderEmail || smtpUser || 'noreply@rullzyestore.com';
            const resp = await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: smtpFrom||'Rullzye Store', email: se },
                to: [{ email: to }], subject: 'Test Email — Rullzye Store', htmlContent: getTestEmailHtml()
            }, { headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' }, timeout: 15000 });
            return res.json({ success: true, message: 'Email test terkirim via Brevo!' });
        }
        if (!smtpHost || !smtpUser || !smtpPass) return res.json({ success: false, message: 'Isi SMTP Host, Email, Password atau pake Brevo.' });
        const t = nodemailer.createTransport({ host: smtpHost, port: parseInt(smtpPort)||587, secure: parseInt(smtpPort)===465, auth: { user: smtpUser, pass: smtpPass }, tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
        const from = smtpFrom ? `"${smtpFrom}" <${smtpUser}>` : smtpUser;
        await t.sendMail({ from, to, subject: 'Test Email — Rullzye Store', html: getTestEmailHtml() });
        res.json({ success: true, message: 'Email test terkirim! Cek inbox/spam.' });
    } catch(e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error('Test email error:', detail);
        res.json({ success: false, message: 'Gagal: ' + (e.response?.data?.message || e.message) });
    }
});

// ================= ADMIN: EXPORT DATABASE =================
app.get('/api/admin/database/export/:type', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const { type } = req.params;
        let data;
        if (type === 'users') data = await getUsers();
        else if (type === 'orders') data = await getOrders();
        else if (type === 'config') data = getConfig();
        else if (type === 'all') data = { users: await getUsers(), orders: await getOrders(), config: getConfig() };
        else return res.json({ success: false, message: 'Tipe tidak valid.' });
        res.setHeader('Content-Type','application/json');
        res.setHeader('Content-Disposition',`attachment; filename=rullzye_${type}_${new Date().toISOString().slice(0,10)}.json`);
        res.send(JSON.stringify(data, null, 2));
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: DELETE USER =================
app.post('/api/admin/users/delete', async (req, res) => {
    if (!hasPermission(req.admin, 'users')) return res.json({ success: false, message: 'Akses ditolak.' });
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
        flowixKey: !!cfg.flowixApiKey,
        premkuKey: !!cfg.apiKey,
        telegramToken: !!cfg.telegramToken,
    });
});

// ================= ADMIN: BROADCAST =================
app.post('/api/admin/broadcast', async (req, res) => {
    try {
        if (!hasPermission(req.admin, 'broadcast')) return res.json({ success: false, message: 'Akses ditolak.' });
        const { message } = req.body;
        if (!message) return res.json({ success: false, message: 'Pesan kosong.' });
        if (!bot) return res.json({ success: false, message: 'Bot tidak aktif.' });
        await sendBroadcast(message);
        res.json({ success: true, message: 'Broadcast berhasil dikirim ke semua user.' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});



// ================= MIXED PRODUCTS =================
app.get('/api/mixed-products', async (req, res) => {
    try {
        const cfg = getConfig();
        const [premkuRes, ppobRes] = await Promise.all([
            axios.post('https://premku.com/api/products', { api_key: cfg.apiKey }).catch(() => ({ data: { products: [] } })),
            ppob.getProducts(cfg.flowixApiKey, cfg.flowixMerchantId, 'prepaid').catch(() => ({ data: [] }))
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
                const brand = p.brand || 'Umum';
                const catProfit = cfg.ppobCategoryProfits?.[brand];
                const pProfit = (catProfit !== null && catProfit !== undefined) ? parseInt(catProfit) : profit;
                allProducts.push({
                    id: 'PPOB-' + p.code,
                    source: 'ppob',
                    name: p.name,
                    price: parseInt(p.price) + pProfit,
                    stock: 9999,
                    badge: null,
                    category: 'ppob',
                    brand: brand
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

// ================= PRODUCT SETTINGS (per-product profit) =================
app.get('/api/admin/product-settings', (req, res) => {
    try {
        if (req.admin.role !== 'super_admin' && !req.admin.permissions?.includes('config')) return res.json({ success: false, message: 'Akses ditolak.' });
        const cfg = getConfig();
        res.json({ success: true, data: cfg.productSettings || {} });
    } catch (e) { res.json({ success: false, data: {} }); }
});

app.post('/api/admin/product-settings', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const cfg = getConfig();
        cfg.productSettings = req.body.productSettings || {};
        await saveConfig(cfg);
        res.json({ success: true, message: 'Pengaturan produk disimpan.' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// ================= PPOB CATEGORY PROFITS =================
app.get('/api/admin/ppob-category-profits', (req, res) => {
    try {
        if (req.admin.role !== 'super_admin' && !req.admin.permissions?.includes('config')) return res.json({ success: false, message: 'Akses ditolak.' });
        const cfg = getConfig();
        res.json({ success: true, data: cfg.ppobCategoryProfits || {} });
    } catch (e) { res.json({ success: false, data: {} }); }
});

app.post('/api/admin/ppob-category-profits', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const cfg = getConfig();
        cfg.ppobCategoryProfits = req.body.ppobCategoryProfits || {};
        await saveConfig(cfg);
        res.json({ success: true, message: 'Keuntungan per kategori PPOB disimpan.' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// ================= 5. ADMIN API: FLOWIX CONFIG =================
app.get('/api/admin/flowix-config', (req, res) => {
    if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
    const cfg = getConfig();
    res.json({ apiKey: cfg.flowixApiKey || '', merchantId: cfg.flowixMerchantId || '' });
});
app.post('/api/admin/flowix-config', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
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
            .map(p => {
                const brand = p.brand || 'Umum';
                const catProfit = cfg.ppobCategoryProfits?.[brand];
                const pProfit = (catProfit !== null && catProfit !== undefined) ? parseInt(catProfit) : profit;
                return {
                    id: p.code,
                    name: p.name,
                    price: parseInt(p.price) + pProfit,
                    basePrice: parseInt(p.price),
                    stock: 9999,
                    brand: brand,
                    category: brand
                };
            });

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

// ================= 11. PROMO API =================
app.get('/api/promos', async (req, res) => {
    try {
        const all = await getPromos(); const now = Date.now();
        const active = all.filter(p => p.active && new Date(p.startDate).getTime() <= now && new Date(p.endDate).getTime() >= now && p.usedCount < p.maxUses);
        res.json({ success: true, promos: active });
    } catch(e) { res.json({ success: false, promos: [] }); }
});
app.get('/api/daily-promo', async (req, res) => {
    const dp = await getDailyPromo();
    if (!dp) return res.json({ success: false, message: 'Tidak ada promo hari ini' });
    res.json({ success: true, promo: dp });
});
app.get('/api/admin/promos', async (req, res) => {
    res.json({ success: true, promos: await getPromos() });
});
app.post('/api/admin/promos', async (req, res) => {
    try {
        let promos = await getPromos(); const p = req.body;
        if (p.id) {
            const idx = promos.findIndex(x => x.id === p.id);
            if (idx !== -1) promos[idx] = { ...promos[idx], ...p };
        } else {
            p.id = 'PRM-' + Date.now().toString(36).toUpperCase();
            p.createdAt = new Date().toISOString(); p.usedCount = p.usedCount || 0;
            promos.push(p);
        }
        await savePromos(promos); res.json({ success: true, id: p.id });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
app.delete('/api/admin/promos/:id', async (req, res) => {
    try { let promos = await getPromos(); await savePromos(promos.filter(x => x.id !== req.params.id)); res.json({ success: true }); } catch(e) { res.json({ success: false }); }
});
app.post('/api/calculate-price', async (req, res) => {
    try {
        const { productId, quantity, promoId } = req.body; const qty = parseInt(quantity) || 1;
        const cfg = getConfig();
        let originalTotal = 0; let baseCost = 0; let productName = '';
        // Ambil harga produk dari data premku
        try {
            const premkuRes = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey });
            const prod = premkuRes.data?.products?.find(x => x.id == productId);
            if (!prod) return res.json({ success: false, message: 'Produk tidak ditemukan' });
            baseCost = parseInt(prod.price);
            const profit = cfg.productSettings?.[productId]?.profit ?? cfg.profit ?? 2000;
            const pricePerUnit = baseCost + parseInt(profit);
            originalTotal = pricePerUnit * qty;
            productName = prod.name;
        } catch(e) { return res.json({ success: false, message: 'Gagal ambil harga produk' }); }

        let discountRp = 0; let promoName = ''; let promoType = '';
        if (promoId) {
            const promos = await getPromos(); const promo = promos.find(p => p.id === promoId && p.active);
            if (!promo) return res.json({ success: false, message: 'Promo tidak ditemukan atau tidak aktif' });
            if (new Date(promo.startDate).getTime() > Date.now() || new Date(promo.endDate).getTime() < Date.now())
                return res.json({ success: false, message: 'Promo belum/sudah berakhir' });
            if (promo.usedCount >= promo.maxUses) return res.json({ success: false, message: 'Promo sudah habis' });
            if (promo.targetProductIds?.length && !promo.targetProductIds.includes('PREMKU-' + productId) && !promo.targetProductIds.includes(productId))
                return res.json({ success: false, message: 'Produk tidak termasuk promo' });
            promoName = promo.name; promoType = promo.type;

            if (promo.type === 'qty_discount') {
                const tier = promo.tiers?.find(t => t.qty == qty);
                if (!tier) return res.json({ success: false, message: 'Kuantitas tidak sesuai tier promo' });
                discountRp = parseInt(tier.discountRp);
                // Validasi masih untung
                if (originalTotal - discountRp - baseCost * qty < 0)
                    return res.json({ success: false, message: 'Promo menyebabkan rugi' });
            } else if (promo.type === 'bogo_same') {
                if (qty < 2) return res.json({ success: false, message: 'Minimal 2 item untuk BOGO' });
                discountRp = (baseCost + parseInt(cfg.productSettings?.[productId]?.profit ?? cfg.profit ?? 2000)); // harga 1 produk gratis
                if (originalTotal - discountRp - baseCost * qty < 0)
                    return res.json({ success: false, message: 'Promo menyebabkan rugi' });
            } else if (promo.type === 'bogo_diff') {
                if (!promo.freeProductId) return res.json({ success: false, message: 'Produk gratis belum ditentukan' });
                const freeBaseCost = await getPremkuBasePrice(promo.freeProductId.replace('PREMKU-',''));
                if (!freeBaseCost) return res.json({ success: false, message: 'Produk gratis tidak ditemukan' });
                discountRp = parseInt(cfg.productSettings?.[productId]?.profit ?? cfg.profit ?? 2000) + baseCost - freeBaseCost;
                if (discountRp < 0) discountRp = 0;
                if (qty < 1) return res.json({ success: false, message: 'Minimal 1 item' });
            }
        }
        const finalPrice = Math.max(0, originalTotal - discountRp);
        res.json({ success: true, originalTotal, discountRp, finalPrice, qty, productName, promoName, promoType });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= 12. ROUTE ORDER HYBRID LAMA =================
app.post('/api/order', async (req, res) => {
    const { service, target, productName, displayPrice, randomId, quantity, promoId, promoApplied, originalTotal, email } = req.body;
    const cfg = getConfig();
    if (!email) return res.json({ status: false, message: '❌ Email wajib diisi untuk menerima struk/akun.' });
    const user = randomId ? await checkRandomId(randomId) : null;
    try {
        let finalTagihan = parseInt(displayPrice);
        let promoData = null;
        if (promoId) {
            const promos = await getPromos(); const promo = promos.find(p => p.id === promoId && p.active);
            if (promo) {
                promo.usedCount = (promo.usedCount || 0) + 1;
                await savePromos(promos);
                promoData = { promoId: promo.id, promoName: promo.name, type: promo.type, discountRp: (parseInt(originalTotal||0) - finalTagihan), originalTotal: parseInt(originalTotal||finalTagihan), finalPrice: finalTagihan };
                if (promo.type === 'bogo_diff') promoData.freeProductId = promo.freeProductId;
            }
        }
        const qty = parseInt(quantity) || 1;
        const resPay = await axios.post('https://premku.com/api/pay', { api_key: cfg.apiKey, amount: finalTagihan });
        if (resPay.data && resPay.data.success) {
            let orders = await getOrders();
            orders.push({ idDeposit: resPay.data.data.invoice, idOrder: null, productId: service, productName, targetPhone: target||'', status: 'MENUNGGU_BAYAR', accountDetails: '-', telegramChatId: user?.chatId||null, type: 'PREMKU', resellerProfit: parseInt(cfg.profit||2000) * qty, quantity: qty, displayPrice: finalTagihan, promoApplied: promoData, deliveryEmail: email, buyerEmail: email });
            await saveOrders(orders);
            res.json({ status: true, invoice: { orderId: resPay.data.data.invoice, amount: resPay.data.data.total_bayar, qr_url: resPay.data.data.qr_image, botLink: `https://t.me/${cfg.botUsername}?start=${resPay.data.data.invoice}` } });
        } else res.json({ status: false, message: 'Gagal membuat QRIS Premku' });
    } catch (e) { res.json({ status: false, message: e.message }); }
});


app.post('/api/check-payment', async (req, res) => {
    const { idDeposit } = req.body;
    if (!idDeposit) return res.json({ status: false, message: 'ID deposit wajib.' });
    try {
        const orders = await getOrders();
        const order = orders.find(o => o.idDeposit === idDeposit);
        if (!order) return res.json({ status: false, message: 'Pesanan tidak ditemukan.', paid: false });
        const paid = order.status !== 'MENUNGGU_BAYAR';
        res.json({ status: true, paid, orderStatus: order.status, accountDetails: order.status === 'SUKSES' ? order.accountDetails : null });
    } catch(e) { res.json({ status: false, message: e.message, paid: false }); }
});

// ================= 12. AUTO-PILOT HYBRID (optimized) =================
const FINAL_STATUSES = new Set(['SUKSES','GAGAL','DIBATALKAN']);
async function autoProc() {
    if (isProcessing) return;
    isProcessing = true;
    try {
        let orders = await getOrders(); let changed = false; const cfg = getConfig();
        for (let i = 0; i < orders.length; i++) {
            let o = orders[i];
            // Skip finalized orders
            if (FINAL_STATUSES.has(o.status)) continue;

            if (!o.type || o.type === 'PREMKU') {
                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const resCek = await axios.post('https://premku.com/api/pay_status', { api_key: cfg.apiKey, invoice: o.idDeposit });
                        if (resCek.data?.data?.status === 'success' || resCek.data?.status === 'success') {
                            const qty = o.quantity || 1;
                            const resBuy = await axios.post('https://premku.com/api/order', { api_key: cfg.apiKey, product_id: parseInt(o.productId), qty: qty, ref_id: o.idDeposit });
                            if (resBuy.data && resBuy.data.success) {
                                orders[i].status = 'PROSES_PUSAT'; orders[i].idOrder = resBuy.data.invoice; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `✅ *PEMBAYARAN DITERIMA*\nMemproses ${qty}x ${o.productName}...`, { parse_mode: "Markdown" }).catch(()=>{});
                                if (o.deliveryEmail) {
                                    const storeName = cfg.storeName || 'Rullzye Store';
                                    sendEmail(o.deliveryEmail, `⏳ Diproses — ${o.productName}`, `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:auto;background:#0b0e1a;border-radius:20px;overflow:hidden;border:1px solid #1e293b;padding:32px;text-align:center">
<div style="font-size:48px;margin-bottom:12px">⏳</div>
<h1 style="color:#fff;font-size:20px;font-weight:900;margin:0">Pembayaran Diterima!</h1>
<p style="color:#94a3b8;font-size:14px;margin:8px 0 16px">Pesanan <strong style="color:#fff">${o.productName}${qty>1?' ×'+qty:''}</strong> sedang diproses.</p>
<div style="background:#1e293b;border-radius:10px;padding:12px;margin-bottom:16px">
<p style="color:#fbbf24;font-size:13px;font-weight:bold;margin:0">💰 Rp ${(o.displayPrice||0).toLocaleString('id-ID')}</p>
</div>
<div style="background:#7c3aed20;border:1px solid #7c3aed40;border-radius:10px;padding:12px">
<p style="color:#a78bfa;font-size:12px;margin:0">Detail akun akan dikirim ke email ini begitu selesai.</p>
</div>
</div>`).catch(()=>{});
                                }
                            }
                        }
                    } catch (e) {}
                } else if (o.status === 'PROSES_PUSAT' && o.idOrder) {
                    const promo = o.promoApplied;
                    // BOGO diff: order gratis setelah order utama sukses
                    if (promo?.type === 'bogo_diff' && promo.freeProductId && !o.freeOrderId) {
                        try {
                            const freeBuy = await axios.post('https://premku.com/api/order', { api_key: cfg.apiKey, product_id: parseInt(promo.freeProductId.replace('PREMKU-','')), qty: 1, ref_id: o.idDeposit + '-FREE' });
                            if (freeBuy.data?.success) { o.freeOrderId = freeBuy.data.invoice; changed = true; }
                        } catch(e) {}
                    }
                    try {
                        const resStatus = await axios.post('https://premku.com/api/status', { api_key: cfg.apiKey, invoice: o.idOrder });
                        let freeStatus = null;
                        if (o.freeOrderId) {
                            try { const fs = await axios.post('https://premku.com/api/status', { api_key: cfg.apiKey, invoice: o.freeOrderId }); freeStatus = fs.data; } catch(e) {}
                        }
                        const mainDone = resStatus.data?.status === 'success' || resStatus.data?.status === 'completed';
                        let freeDone = !o.freeOrderId || (freeStatus?.status === 'success' || freeStatus?.status === 'completed');
                        if (mainDone && freeDone) {
                            let acc = Array.isArray(resStatus.data.accounts) ? resStatus.data.accounts.map(a => `📧 \`${a.username || a.email}\` | 🔑 \`${a.password}\``).join('\n') : (resStatus.data.accounts || "Selesai");
                            if (freeStatus?.accounts) {
                                const freeAcc = Array.isArray(freeStatus.accounts) ? freeStatus.accounts.map(a => `📧 \`${a.username || a.email}\` | 🔑 \`${a.password}\``).join('\n') : (freeStatus.accounts || "Selesai");
                                acc += `\n\n🎁 *PRODUK GRATIS (BOGO):*\n${freeAcc}`;
                            }
                            orders[i].status = 'SUKSES'; orders[i].accountDetails = acc; orders[i].completedAt = new Date().toISOString(); orders[i].buyerName = orders[i].buyerName || 'Pelanggan'; changed = true;
                            try { const bc = await getBroadcastCount(); await saveBroadcastCount(bc + 1); if ((bc + 1) % 20 === 0) runBroadcast(); } catch(e) {}
                            let msg = `🎉 *PESANAN SELESAI!*\n📦 *${o.productName}*${o.quantity > 1 ? ' ×' + o.quantity : ''}\n\n${acc}`;
                            if (promo) msg += `\n🏷️ *Promo:* ${promo.promoName}`;
                            if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, msg, { parse_mode: "Markdown" }).catch(()=>{});
                            if (o.deliveryEmail) {
                                const cleanAcc = (acc||'').replace(/\*|`|_|~/g, '').replace(/\n/g, '<br>');
                                const storeName = cfg.storeName || 'Rullzye Store';
                                const orderEmailHtml = buildOrderEmail(storeName, o.productName, o.quantity, cleanAcc, o.displayPrice, promo);
                                sendEmail(o.deliveryEmail, `Pesanan Selesai — ${o.productName}`, orderEmailHtml).catch(()=>{});
                            }
                        }
                    } catch (e) {}
                }
            } else if (o.type === 'FLOWIX') {
                const cfgFlowix = getConfig();
                if (!cfgFlowix.flowixApiKey || !cfgFlowix.flowixMerchantId) continue;

                if (o.status === 'MENUNGGU_BAYAR') {
                    try {
                        const cek = await ppob.checkDeposit(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.idDeposit);
                        if (cek.success && cek.data) {
                            const ds = cek.data.status;
                            if (ds === 'success' || ds === 'paid') {
                                const productInfo = cachedPPOB.data ? cachedPPOB.data.find(p => p.id === o.productId) : null;
                                if (!productInfo) {
                                    orders[i].status = 'GAGAL'; orders[i].accountDetails = 'Produk sudah tidak tersedia / gangguan.'; changed = true;
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *PRODUK GANGGUAN*\n\nMaaf, produk ${o.productName} sudah tidak tersedia. Hubungi CS untuk bantuan.`, { parse_mode: 'Markdown' }).catch(()=>{});
                                    continue;
                                }
                                const buy = await ppob.createTransaction(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.productId, o.targetPhone);
                                if (buy.success && buy.data?.reff_id) {
                                    orders[i].status = 'PROSES_PUSAT';
                                    orders[i].idOrder = buy.data.reff_id;
                                    orders[i].accountDetails = `Status: ${buy.data.status || 'processing'}`;
                                    changed = true;
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `✅ *PEMBAYARAN DITERIMA*\nMemproses ${o.productName}...\n🎯 \`${o.targetPhone || '-'}\``, { parse_mode: 'Markdown' }).catch(()=>{});
                                } else {
                                    const errorMsg = buy.message || 'Gagal membuat transaksi';
                                    orders[i].status = 'GAGAL'; orders[i].accountDetails = errorMsg; changed = true;
                                    if (errorMsg.includes('tidak ditemukan') || errorMsg.includes('not found')) {
                                        if (cachedPPOB.data) {
                                            const idx = cachedPPOB.data.findIndex(p => p.id === o.productId);
                                            if (idx !== -1) { cachedPPOB.data.splice(idx, 1); console.log(`[AUTO] Produk ${o.productId} dihapus dari cache.`); }
                                        }
                                    }
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *TRANSAKSI GAGAL*\n${errorMsg}`, { parse_mode: 'Markdown' }).catch(()=>{});
                                }
                            } else if (['failed','expired','canceled'].includes(ds)) {
                                orders[i].status = 'GAGAL'; orders[i].accountDetails = `Deposit ${ds}`; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *DEPOSIT ${ds.toUpperCase()}*\n\nDeposit untuk ${o.productName} telah ${ds}. Silakan buat pesanan baru.`, { parse_mode: 'Markdown' }).catch(()=>{});
                            }
                        } else if (!cek.success && cek.code === 404) {
                            // Deposit tidak ditemukan di Flowix — tandai GAGAL permanen
                            orders[i].status = 'GAGAL'; orders[i].accountDetails = 'Deposit tidak ditemukan di server pusat'; changed = true;
                            if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *DEPOSIT TIDAK DITEMUKAN*\n\nDeposit untuk ${o.productName} tidak ditemukan di server. Silakan hubungi CS.`, { parse_mode: 'Markdown' }).catch(()=>{});
                        }
                    } catch (e) {
                        // Network error — skip this cycle, will retry next cycle
                    }
                } else if (o.status === 'PROSES_PUSAT' && o.idOrder) {
                    try {
                        const ts = await ppob.checkTransaction(cfgFlowix.flowixApiKey, cfgFlowix.flowixMerchantId, o.idOrder);
                        if (ts.success && ts.data) {
                            const trx = ts.data.status;
                            if (trx === 'success') {
                                orders[i].status = 'SUKSES';
                                orders[i].accountDetails = `SN: ${ts.data.sn || '-'} | ${ts.data.note || 'Berhasil'}`;
                                orders[i].completedAt = new Date().toISOString();
                                orders[i].buyerName = orders[i].buyerName || 'Pelanggan';
                                changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `🎉 *TRANSAKSI BERHASIL*\n📦 ${o.productName}\n🎯 \`${o.targetPhone || '-'}\`\n🔖 SN: \`${ts.data.sn || '-'}\`\n\nTerima kasih telah berbelanja! 🙏`, { parse_mode: 'Markdown' }).catch(()=>{});
                            } else if (trx === 'failed' || trx === 'error') {
                                orders[i].status = 'GAGAL'; orders[i].accountDetails = ts.data.note || ts.data.message || 'Transaksi gagal'; changed = true;
                                if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `❌ *TRANSAKSI GAGAL*\n${ts.data.note || ''}`, { parse_mode: 'Markdown' }).catch(()=>{});
                            } else if (trx === 'processing') {
                                if (o.accountDetails !== 'Status: processing') {
                                    orders[i].accountDetails = 'Status: processing';
                                    changed = true;
                                    if (bot && o.telegramChatId) bot.sendMessage(o.telegramChatId, `⏳ *MASIH DIPROSES*\n${o.productName}\n🎯 \`${o.targetPhone || '-'}\`\n\nMohon tunggu, transaksi sedang berjalan... 🔄`, { parse_mode: 'Markdown' }).catch(()=>{});
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
        if (changed) { await saveOrders(orders); console.log(`[AUTO] ${new Date().toLocaleTimeString('id-ID')} — ${changed ? 'Ada perubahan' : 'Tidak ada perubahan'}`); }
        await autoProcPanel();
    } finally { isProcessing = false; }
}
setInterval(autoProc, 10000);



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

// ================= ADMIN: USER & AFFILIATE CRUD =================
app.post('/api/admin/users/create', async (req, res) => {
    try {
        if (!hasPermission(req.admin, 'users')) return res.json({ success: false, message: 'Akses ditolak.' });
        const { name, balance } = req.body;
        let users = await getUsers();
        let randomId;
        do { randomId = `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; } while (users.some(u => u.randomId === randomId));
        users.push({ randomId, firstName: name || '', balance: parseInt(balance)||0, createdAt: new Date().toISOString() });
        await saveUsers(users);
        res.json({ success: true, randomId, message: `User ${randomId} berhasil dibuat.` });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/users/edit', async (req, res) => {
    try {
        if (!hasPermission(req.admin, 'users')) return res.json({ success: false, message: 'Akses ditolak.' });
        const { randomId, name, balance } = req.body;
        let users = await getUsers();
        const idx = users.findIndex(u => u.randomId === randomId);
        if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
        if (name !== undefined) users[idx].firstName = name;
        if (balance !== undefined) users[idx].balance = parseInt(balance);
        await saveUsers(users);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/order/force-status', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const { id, status } = req.body;
        let orders = await getOrders();
        const idx = orders.findIndex(o => o.idDeposit === id || o.idOrder === id);
        if (idx === -1) return res.json({ success: false, message: 'Order tidak ditemukan.' });
        orders[idx].status = status;
        orders[idx].accountDetails = orders[idx].accountDetails || `Manual: ${status}`;
        if (status === 'SUKSES') orders[idx].completedAt = new Date().toISOString();
        await saveOrders(orders);
        res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/change-pin', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Hanya Super Admin yang bisa mengganti PIN Super Admin.' });
        const { oldPin, newPin } = req.body;
        const cfg = getConfig();
        const sa = cfg.superAdmin || {};
        const currentPin = sa.pin || cfg.superAdminPin || cfg.adminPin || '';
        if (oldPin !== currentPin) return res.json({ success: false, message: 'PIN lama salah.' });
        if (!newPin || newPin.length < 4) return res.json({ success: false, message: 'PIN baru minimal 4 karakter.' });
        const superAdmin = cfg.superAdmin || {};
        superAdmin.pin = newPin;
        cfg.superAdmin = superAdmin;
        delete cfg.superAdminPin;
        delete cfg.adminPin;
        await saveConfig(cfg);
        res.json({ success: true, message: 'PIN Super Admin berhasil diganti!' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

// ================= ADMIN: ADMIN MANAGEMENT (super admin only) =================
app.get('/api/admin/admins', (req, res) => {
    if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
    const cfg = getConfig();
    res.json({ success: true, admins: cfg.admins || [] });
});

app.post('/api/admin/admins/add', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const { username, pin, permissions } = req.body;
        if (!username || !pin) return res.json({ success: false, message: 'Username dan PIN diperlukan.' });
        if (pin.length < 4) return res.json({ success: false, message: 'PIN minimal 4 karakter.' });
        const cfg = getConfig();
        if (!cfg.admins) cfg.admins = [];
        if (cfg.admins.find(a => a.username === username)) return res.json({ success: false, message: 'Username sudah ada.' });
        if (cfg.admins.find(a => a.pin === pin)) return res.json({ success: false, message: 'PIN sudah digunakan admin lain.' });
        cfg.admins.push({ id: 'ADMIN-' + Date.now().toString(36).toUpperCase(), username, pin, permissions: permissions || [], active: true, createdBy: req.admin.username || 'Super Admin', createdAt: new Date().toISOString() });
        await saveConfig(cfg);
        res.json({ success: true, message: 'Admin berhasil ditambahkan!' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/admins/edit', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const { id, username, pin, permissions, active } = req.body;
        const cfg = getConfig();
        const idx = (cfg.admins || []).findIndex(a => a.id === id);
        if (idx === -1) return res.json({ success: false, message: 'Admin tidak ditemukan.' });
        if (username) cfg.admins[idx].username = username;
        if (pin) { if (pin.length < 4) return res.json({ success: false, message: 'PIN minimal 4 karakter.' }); cfg.admins[idx].pin = pin; }
        if (permissions !== undefined) cfg.admins[idx].permissions = permissions;
        if (active !== undefined) cfg.admins[idx].active = active;
        await saveConfig(cfg);
        res.json({ success: true, message: 'Admin berhasil diperbarui!' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/admins/delete', async (req, res) => {
    try {
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        const { id } = req.body;
        const cfg = getConfig();
        cfg.admins = (cfg.admins || []).filter(a => a.id !== id);
        await saveConfig(cfg);
        res.json({ success: true, message: 'Admin berhasil dihapus!' });
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
        if (req.admin.role !== 'super_admin') return res.json({ success: false, message: 'Akses ditolak.' });
        await saveUsers([]);
        await saveOrders([]);
        res.json({ success: true, message: 'Database direset.' });
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

// Testimoni CRUD endpoints
app.get('/api/testimonials', async (req, res) => {
    try {
        const testimonials = await getTestimonials();
        const filtered = testimonials.filter(t => t.approved !== false);
        res.json({ success: true, testimonials: filtered });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
app.post('/api/testimonials/submit', async (req, res) => {
    try {
        const { name, service, rating, content } = req.body;
        if (!name || !content || content.length < 10) return res.json({ success: false, message: 'Nama wajib diisi, testimoni minimal 10 karakter' });
        let testimonials = await getTestimonials();
        const id = 'T-' + Date.now().toString(36).toUpperCase();
        testimonials.push({
            id, name: name.trim(), service: service||'Produk Digital',
            rating: Math.min(parseInt(rating)||5,5), content: content.trim(),
            approved: false, screenshot: '',
            createdAt: new Date().toISOString()
        });
        await saveTestimonials(testimonials);
        res.json({ success: true, message: 'Testimoni terkirim! Menunggu verifikasi admin.' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
app.post('/api/admin/testimonials', async (req, res) => {
    try {
        const testimonials = await getTestimonials();
        const { name, service, rating, content } = req.body;
        if (!name || !content) return res.json({ success: false, message: 'Nama dan konten wajib diisi' });
        const id = 'T-' + Date.now().toString(36).toUpperCase();
        testimonials.push({
            id, name: name.trim(), service: service||'Produk Digital',
            rating: parseInt(rating)||5, content: content.trim(),
            approved: true, createdAt: new Date().toISOString()
        });
        await saveTestimonials(testimonials);
        res.json({ success: true, id, message: 'Testimoni berhasil ditambahkan' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
app.put('/api/admin/testimonials/:id', async (req, res) => {
    try {
        let testimonials = await getTestimonials();
        const idx = testimonials.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.json({ success: false, message: 'Testimoni tidak ditemukan' });
        Object.keys(req.body).forEach(k => { if (k !== 'id') testimonials[idx][k] = req.body[k]; });
        await saveTestimonials(testimonials);
        res.json({ success: true, message: 'Testimoni diupdate' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
app.delete('/api/admin/testimonials/:id', async (req, res) => {
    try {
        let testimonials = await getTestimonials();
        testimonials = testimonials.filter(t => t.id !== req.params.id);
        await saveTestimonials(testimonials);
        res.json({ success: true, message: 'Testimoni dihapus' });
    } catch(e) { res.json({ success: false, message: e.message }); }
});
app.post('/api/admin/testimonials/seed', async (req, res) => {
    try {
        const dummies = [
            { name: 'Rizky Pratama', service: 'Top Up Mobile Legends 86 DM', rating: 5, content: 'Beli diamond ML di sini udah 3 kali. Proses cepat banget, bayar QRIS langsung masuk. Recomended banget buat yang butuh top up game murah dan cepat!', screenshot: 'https://i.imgur.com/placeholder1.jpg' },
            { name: 'Siti Nurhaliza', service: 'Netflix Premium 4K', rating: 5, content: 'Udah 2 bulan langganan Netflix dari sini. Akun masih aman, streaming lancar jaya. Admin fast respon juga pas tanya-tanya. Makasih RullzyeStore!', screenshot: '' },
            { name: 'Dimas Ardiansyah', service: 'Paket Data Telkomsel 30GB', rating: 5, content: 'Butuh kuota darurat buat meeting, langsung order di sini. 1 menit langsung masuk. Gak nyangka semudah ini. Pasti bakal order lagi!', screenshot: '' },
            { name: 'Ayu Lestari', service: 'Spotify Premium 1 Tahun', rating: 5, content: 'Dapat spotify premium setahun dengan harga murah banget. Prosesnya cepet, dikirim ke email. Udah rekomen ke temen-temen semua. Mantap!', screenshot: '' },
            { name: 'Fajar Ramadhan', service: 'Free Fire 140 Diamonds', rating: 4, content: 'Top up FF lumayan sering di sini. Harganya bersaing sama yang lain, kadang lebih murah. Proses otomatis jadi gampang. 4 bintang aja karena kadang agak lama pas jam sibuk.', screenshot: '' },
            { name: 'Dewi Sartika', service: 'Panel Pterodactyl 4GB', rating: 5, content: 'Beli panel server minecraft buat main bareng temen. Dapat akses panel lengkap, tinggal install server. Harganya juga murah meriah. Puas banget!', screenshot: '' },
            { name: 'Budi Hartono', service: 'Token Listrik PLN 200rb', rating: 5, content: 'Biasanya beli token listrik lewat sini karena prosesnya cepet dan bisa bayar QRIS. Gak perlu antri, tinggal order langsung masuk. Sangat praktis!', screenshot: '' },
            { name: 'Rina Melati', service: 'Youtube Premium 3 Bulan', rating: 5, content: 'Nonton youtube tanpa iklan jadi lebih nyaman. Harga lebih murah dari langganan resmi. Udah repeat order 2 kali, selalu puas dengan pelayanannya.', screenshot: '' },
            { name: 'Andi Saputra', service: 'Top Up PUBG UC', rating: 4, content: 'Top up UC PUBG lumayan sering. Harganya ok dan prosesnya cepat. Cuma kadang suka khawatir aja karena ini barang digital, tapi sejauh ini aman terus.', screenshot: '' },
            { name: 'Mega Wulandari', service: 'Instagram Followers', rating: 5, content: 'Beli followers instagram untuk bisnis online. Turunnya bertahap jadi kelihatan natural. Pelayanannya ramah dan harganya murah. Recommended buat yang butuh sosmed!', screenshot: '' },
        ];
        let testimonials = await getTestimonials();
        const startId = Date.now();
        dummies.forEach((d, i) => {
            const id = 'T-SEED-' + (startId + i).toString(36).toUpperCase();
            testimonials.push({ ...d, id, approved: true, createdAt: new Date(Date.now() - (dummies.length - i) * 86400000).toISOString() });
        });
        await saveTestimonials(testimonials);
        res.json({ success: true, message: `${dummies.length} testimoni dummy berhasil ditambahkan!` });
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

    // Migrasi config: legacy fields → superAdmin object
    const cfg = getConfig();
    if (!cfg.superAdmin || !cfg.superAdmin.pin) {
        const pin = cfg.superAdminPin || cfg.adminPin || '858486';
        const username = cfg.superAdmin && cfg.superAdmin.username ? cfg.superAdmin.username : 'super';
        cfg.superAdmin = { username, pin };
        delete cfg.superAdminPin;
        delete cfg.adminPin;
        if (!cfg.admins) cfg.admins = [];
        await saveConfig(cfg);
        console.log('✅ Config migrated: legacy pin fields → superAdmin object');
    }

    // Load bot
    const botModule = require('./bot.js');
    bot = botModule.bot;
    sendBroadcast = botModule.sendBroadcast;
    notifyGroupOrderNew = botModule.notifyGroupOrderNew;
    notifyGroupOrderSuccess = botModule.notifyGroupOrderSuccess;
    notifyGroupError = botModule.notifyGroupError;
    notifyGroupStockUpdate = botModule.notifyGroupStockUpdate;
    notifyGroupAdmin = botModule.notifyGroupAdmin;

    // ===== Google OAuth Login (independen dari affiliate) =====
    app.post('/api/auth/google-login', async (req, res) => {
        try {
            const { idToken } = req.body;
            if (!idToken) return res.json({ success: false, message: 'Token diperlukan.' });
            const cfg = getConfig();
            const apiKey = cfg.firebaseConfig?.apiKey;
            if (!apiKey) return res.json({ success: false, message: 'Firebase belum dikonfigurasi.' });
            const fb = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { idToken }, { timeout: 8000 });
            if (!fb.data?.users?.length) return res.json({ success: false, message: 'Token tidak valid.' });
            const u = fb.data.users[0];
            const email = (u.email || u.providerUserInfo?.[0]?.email || '').toLowerCase();
            const name = u.displayName || u.providerUserInfo?.[0]?.displayName || email.split('@')[0];
            if (!email) return res.json({ success: false, message: 'Email tidak ditemukan.' });
            let users = await getUsers();
            const existing = users.find(x => x.googleEmail === email);
            if (existing) {
                return res.json({ success: true, message: 'Selamat datang kembali!', user: { name: existing.firstName, email } });
            }
            let randomId;
            do { randomId = 'G-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (users.some(x => x.randomId === randomId));
            users.push({ randomId, firstName: name, googleEmail: email, registeredAt: new Date().toISOString(), balance: 0 });
            await saveUsers(users);
            res.json({ success: true, message: 'Akun berhasil dibuat!', user: { name, email }, randomId });
        } catch(e) {
            res.json({ success: false, message: 'Gagal verifikasi Google: ' + e.message });
        }
    });

    // ===== Firebase test endpoint =====
    app.get('/api/auth/firebase-test', async (req, res) => {
        try {
            const cfg = getConfig();
            const fc = cfg.firebaseConfig || {};
            const hasAll = fc.apiKey && fc.authDomain && fc.projectId && fc.appId;
            res.json({ success: true, configured: !!hasAll, message: hasAll ? 'Firebase siap' : 'Firebase Config belum lengkap.' });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    scheduleDailyPromo();
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server berjalan di port ${PORT}`));
})();
