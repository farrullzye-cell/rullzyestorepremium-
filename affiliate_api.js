// affiliate_api.js — Sistem Affiliate Matang + Anti Fraud
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

module.exports = function(app, getUsers, saveUsers, getOrders, saveOrders, FIREBASE_URL) {
    const router = express.Router();
    const security = require('./anti_fraud.js');

    const BANK_LIST = [
        "Bank Aladin Syariah","Bank BRI","Bank BNI","Bank Mandiri","Bank BCA","Bank CIMB Niaga",
        "Bank Danamon","Bank Permata","Bank Panin","Bank OCBC NISP","Bank Maybank Indonesia",
        "Bank Mega","Bank BTN","Bank BTPN","Bank BJB","Bank Jatim","Bank Jateng","Bank DIY",
        "Bank Sumut","Bank Nagari","Bank Riau Kepri","Bank Lampung","Bank Kalsel","Bank Kalteng",
        "Bank Kaltim","Bank Sulselbar","Bank Sulut","Bank NTB","Bank NTT","Bank Maluku",
        "Bank Papua","Bank Sinarmas","Bank Artos","Bank BNP Paribas","Bank Capital",
        "Bank DBS Indonesia","Bank HSBC Indonesia","Bank ICBC Indonesia","Bank Mayapada",
        "Bank MNC Internasional","Bank UOB Indonesia","Bank Victoria","Bank Woori Saudara",
        "Bank Seabank","Bank Jago","Bank Neo Commerce","DANA","OVO","GoPay","ShopeePay","LinkAja"
    ];
    // Endpoint untuk mendapatkan daftar bank
    router.get('/banks', (req, res) => { res.json({ success: true, banks: BANK_LIST }); });

    // ================= HELPERS =================
    const getWithdraws = async () => {
        try {
            const r = await axios.get(`${FIREBASE_URL}/withdraws.json`);
            return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : [];
        } catch(e) { return []; }
    };
    const saveWithdraws = async (w) => {
        try { await axios.put(`${FIREBASE_URL}/withdraws.json`, w); } catch(e) {}
    };
    const getConfig = () => {
        try { return JSON.parse(fs.readFileSync('./config.json')); } catch(e) { return {}; }
    };
    const getAuditLogs = async () => {
        try {
            const r = await axios.get(`${FIREBASE_URL}/audit_logs.json`);
            return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : [];
        } catch(e) { return []; }
    };
    const saveAuditLogs = async (logs) => {
        try { await axios.put(`${FIREBASE_URL}/audit_logs.json`, logs); } catch(e) {}
    };

    const getClientIP = (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.ip || req.connection.remoteAddress || '0.0.0.0';
    };

    // ============================================================
    // APPLY JADI AFFILIATE
    // ============================================================
    router.post('/apply', security.rateLimitMiddleware('apply'), async (req, res) => {
        try {
            const { randomId } = req.body;
            const ip = getClientIP(req);
            const cfg = getConfig();
            if (cfg.affiliateEnabled === false) return res.json({ success: false, message: 'Pendaftaran affiliate sedang ditutup.' });

            let users = await getUsers();
            const user = users.find(u => u.randomId === randomId);
            if (!user) return res.json({ success: false, message: 'User tidak ditemukan. Pastikan kamu sudah daftar di Bot Telegram.' });
            if (user.isAffiliate) return res.json({ success: false, message: 'Anda sudah menjadi Affiliate.' });
            if (user.isBanned) return res.json({ success: false, message: 'Akun Anda dibanned dari program affiliate.' });
            if (user.affiliatePending && !cfg.affiliateAutoApprove) return res.json({ success: false, message: 'Permintaan sudah terkirim, tunggu persetujuan admin.' });

            // Cek IP: max 3 akun per IP untuk daftar affiliate
            security.trackUserIP(ip, randomId);
            const accountsOnIP = security.getAccountsOnIP(ip);
            if (accountsOnIP.length > 3) {
                return res.json({ success: false, message: 'Terlalu banyak akun dari IP yang sama. Hubungi admin.' });
            }

            const idx = users.findIndex(u => u.randomId === randomId);
            if (cfg.affiliateAutoApprove) {
                users[idx].isAffiliate = true;
                users[idx].affiliatePending = false;
                users[idx].affiliateApprovedAt = new Date().toISOString();
            } else {
                users[idx].affiliatePending = true;
            }
            users[idx].affiliateAppliedAt = new Date().toISOString();
            users[idx].affiliateApplyIP = ip;
            await saveUsers(users);

            // Audit log
            const logs = await getAuditLogs();
            logs.push({
                id: 'AUDIT-' + Date.now(),
                action: 'AFFILIATE_APPLY',
                randomId,
                ip,
                autoApproved: cfg.affiliateAutoApprove,
                timestamp: new Date().toISOString()
            });
            await saveAuditLogs(logs);

            if (cfg.affiliateAutoApprove) {
                res.json({ success: true, message: 'Pendaftaran berhasil! Anda langsung menjadi affiliate.' });
            } else {
                res.json({ success: true, message: 'Permintaan dikirim! Admin akan mereview dalam 1x24 jam.' });
            }
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // LOGIN (generate token)
    // ============================================================
    router.post('/login', security.rateLimitMiddleware('login'), async (req, res) => {
        try {
            const { randomId, pin } = req.body;
            const ip = getClientIP(req);
            const ua = req.headers['user-agent'] || '';

            if (!randomId) return res.json({ success: false, message: 'Random ID diperlukan.' });

            const users = await getUsers();
            const user = users.find(u => u.randomId === randomId);
            if (!user) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!user.isAffiliate && !user.affiliatePending) {
                return res.json({ success: false, message: 'Anda belum mendaftar sebagai Affiliate.' });
            }
            if (user.affiliatePending && !user.isAffiliate) {
                return res.json({ success: false, isPending: true, message: 'Permintaan Anda sedang menunggu persetujuan admin.' });
            }
            if (user.isBanned) {
                return res.json({ success: false, message: 'Akun Anda dibanned. Alasan: ' + (user.bannedReason || 'Tidak disebutkan') });
            }

            // Verifikasi PIN (jika sudah diset)
            if (user.affiliatePin && user.affiliatePin !== pin) {
                return res.json({ success: false, pinRequired: true, message: 'PIN salah.' });
            }
            if (!user.affiliatePin && !pin) {
                // Belum set PIN — minta set PIN dulu
                return res.json({ success: false, pinRequired: true, setPin: true, message: 'Atur PIN 6 digit terlebih dahulu.' });
            }
            if (!user.affiliatePin && pin) {
                // Set PIN pertama kali
                if (!pin || pin.length < 4) return res.json({ success: false, message: 'PIN minimal 4 karakter.' });
                user.affiliatePin = pin;
                users[users.findIndex(u => u.randomId === randomId)] = user;
                await saveUsers(users);
            }

            // Track IP
            security.trackUserIP(ip, randomId);

            // Generate token, revoke old ones
            security.revokeUserTokens(randomId);
            const token = security.generateToken(randomId, ip, ua);

            // Audit log
            const logs = await getAuditLogs();
            logs.push({
                id: 'AUDIT-' + Date.now(),
                action: 'AFFILIATE_LOGIN',
                randomId,
                ip,
                ua,
                timestamp: new Date().toISOString()
            });
            await saveAuditLogs(logs);

            res.json({ success: true, token, googleLinked: !!user.googleEmail });
        } catch(e) {
            console.error('[AFFILIATE LOGIN]', e);
            res.json({ success: false, message: 'Gagal login: ' + e.message });
        }
    });

    // Set/Ubah PIN affiliate
    router.post('/change-pin', security.authMiddleware, async (req, res) => {
        try {
            const { oldPin, newPin } = req.body;
            const randomId = req.userSession.randomId;
            if (!newPin || newPin.length < 4) return res.json({ success: false, message: 'PIN baru minimal 4 karakter.' });
            const users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (users[idx].affiliatePin && users[idx].affiliatePin !== oldPin) {
                return res.json({ success: false, message: 'PIN lama salah.' });
            }
            users[idx].affiliatePin = newPin;
            await saveUsers(users);
            res.json({ success: true, message: 'PIN berhasil diubah!' });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // DASHBOARD AFFILIATE (LENGKAP) — require token
    // ============================================================
    router.post('/dashboard', security.authMiddleware, security.rateLimitMiddleware('dashboard'), async (req, res) => {
        try {
            const randomId = req.userSession.randomId;
            const users = await getUsers();
            const user = users.find(u => u.randomId === randomId);

            if (!user) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!user.isAffiliate) {
                return res.json({ success: false, message: 'Akun affiliate tidak aktif.' });
            }

            const cfg = getConfig();
            const orders = await getOrders();
            const wds = await getWithdraws();

            const myOrders = orders.filter(o => o.affiliateRef === randomId && o.status === 'SUKSES');
            const myPendingOrders = orders.filter(o => o.affiliateRef === randomId && o.status === 'MENUNGGU_BAYAR');

            const totalCommission = myOrders.reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

            const now = new Date();
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthlyOrders = myOrders.filter(o => (o.completedAt || '').startsWith(thisMonth));
            const monthlyCommission = monthlyOrders.reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

            const downlines = users.filter(u => u.referredBy === randomId);
            const activeDownlines = downlines.filter(dl =>
                orders.some(o => o.telegramChatId === dl.chatId && o.status === 'SUKSES')
            );

            const myWithdraws = wds.filter(w => w.randomId === randomId).reverse().slice(0, 10);

            const history = myOrders.slice(-50).reverse().slice(0, 20).map(o => ({
                id: o.idDeposit || o.idOrder,
                product: o.productName,
                target: o.targetPhone,
                commission: o.affiliateCommission || 0,
                date: o.completedAt || o.createdAt || new Date().toISOString(),
                buyerName: o.buyerName || 'Pelanggan'
            }));

            // Hitung sisa cooldown withdraw
            const wdToday = security.checkWDCooldown(randomId);

            res.json({
                success: true,
                data: {
                    name: user.firstName,
                    username: user.username,
                    randomId: user.randomId,
                    affiliateBalance: user.affiliateBalance || 0,
                    affiliateName: user.affiliateName || user.firstName,
                    bio: user.affiliateBio || '',
                    markupPercent: user.markupPercent || 0,
                    selectedProducts: user.selectedProducts || [],
                    upgradePPOB: user.upgradePPOB || false,
                    avatar: user.avatarUrl || '',
                    themeColor: user.themeColor || '#7c3aed',
                    socialLinks: user.socialLinks || {},
                    linkTelegram: `https://t.me/${cfg.botUsername || 'RullzyeBot'}?start=${user.randomId}`,
                    linkWebsite: `https://rullzyestorepremium.my.id/toko/${user.randomId}`,
                    totalDownline: downlines.length,
                    activeDownline: activeDownlines.length,
                    totalCommission,
                    monthlyCommission,
                    totalOrders: myOrders.length,
                    pendingOrders: myPendingOrders.length,
                    commissionPercent: cfg.affiliateCommissionPercent || 20,
                    minWithdraw: cfg.affiliateMinWithdraw || 10000,
                    joinedAt: user.registeredAt,
                    approvedAt: user.affiliateApprovedAt || null,
                    wdToday,
                    maxWdPerDay: 1,
                    wdCooldownHours: security.WD_COOLDOWN_HOURS,
                },
                history,
                withdrawHistory: myWithdraws,
                downlines: downlines.slice(0, 10).map(d => ({
                    name: d.firstName,
                    randomId: d.randomId,
                    joinedAt: d.registeredAt,
                    totalOrder: orders.filter(o => o.telegramChatId === d.chatId && o.status === 'SUKSES').length
                }))
            });
        } catch (e) {
            console.error('[AFFILIATE DASHBOARD]', e);
            res.json({ success: false, message: 'Gagal memuat dashboard: ' + e.message });
        }
    });

    // ============================================================
    // UPDATE PROFIL & PENGATURAN TOKO — require token
    // ============================================================
    router.post('/settings', security.authMiddleware, async (req, res) => {
        try {
            const randomId = req.userSession.randomId;
            const { affiliateName, bio, markupPercent, selectedProducts, avatarUrl, themeColor, socialLinks } = req.body;
            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!users[idx].isAffiliate) return res.json({ success: false, message: 'Bukan affiliate.' });

            const cfg = getConfig();
            const maxMarkup = users[idx].maxMarkup || cfg.affiliateMaxMarkup || 100;

            if (affiliateName !== undefined) users[idx].affiliateName = affiliateName.trim().substring(0, 50);
            if (bio !== undefined) users[idx].affiliateBio = bio.trim().substring(0, 200);
            if (markupPercent !== undefined) users[idx].markupPercent = Math.max(0, Math.min(maxMarkup, parseInt(markupPercent) || 0));
            if (selectedProducts !== undefined) users[idx].selectedProducts = selectedProducts;
            if (avatarUrl !== undefined) users[idx].avatarUrl = avatarUrl.trim().substring(0, 500);
            if (themeColor !== undefined) users[idx].themeColor = themeColor;
            if (socialLinks !== undefined) users[idx].socialLinks = socialLinks;

            await saveUsers(users);
            res.json({ success: true, message: 'Pengaturan toko berhasil disimpan.' });
        } catch (e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // WITHDRAW KOMISI — require token + anti-fraud
    // ============================================================
    router.post('/withdraw', security.authMiddleware, security.rateLimitMiddleware('withdraw'), async (req, res) => {
        try {
            const randomId = req.userSession.randomId;
            const ip = getClientIP(req);
            const { amount, bankDetails } = req.body;

            if (!amount || !bankDetails) {
                return res.json({ success: false, message: 'Semua kolom harus diisi.' });
            }

            const cfg = getConfig();
            const minWD = cfg.affiliateMinWithdraw || 10000;
            const amountInt = parseInt(amount);

            if (amountInt < minWD) {
                return res.json({ success: false, message: `Minimal penarikan Rp ${minWD.toLocaleString('id-ID')}` });
            }

            // Validasi format bank details
            const bankClean = bankDetails.trim();
            if (bankClean.length < 5 || bankClean.length > 200) {
                return res.json({ success: false, message: 'Format bank/e-wallet tidak valid.' });
            }

            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!users[idx].isAffiliate) return res.json({ success: false, message: 'Bukan affiliate.' });

            // Cek cooldown affiliate baru (24 jam setelah approve)
            if (security.checkNewAffiliateCooldown(users[idx])) {
                return res.json({ success: false, message: 'Akun affiliate masih baru. Tunggu 24 jam setelah approval untuk withdraw pertama.' });
            }

            // Cek daily withdraw limit
            const wdToday = security.checkWDCooldown(randomId);
            if (wdToday >= 1) {
                return res.json({ success: false, message: 'Kamu sudah melakukan withdraw hari ini. Batas withdraw 1 kali per hari.' });
            }

            if ((users[idx].affiliateBalance || 0) < amountInt) {
                return res.json({ success: false, message: `Saldo tidak mencukupi. Saldo Anda: Rp ${(users[idx].affiliateBalance || 0).toLocaleString('id-ID')}` });
            }

            // Potong saldo (cegah double withdraw)
            users[idx].affiliateBalance = (users[idx].affiliateBalance || 0) - amountInt;
            users[idx].totalWithdrawn = (users[idx].totalWithdrawn || 0) + amountInt;
            await saveUsers(users);

            // Simpan request withdraw
            let wds = await getWithdraws();
            const wdId = 'AFF-WD-' + Date.now();
            wds.push({
                id: wdId,
                randomId,
                chatId: users[idx].chatId,
                name: users[idx].firstName || 'Affiliate',
                affiliateName: users[idx].affiliateName || users[idx].firstName,
                amount: amountInt,
                bankDetails: bankClean,
                status: 'PENDING',
                type: 'AFFILIATE',
                ip,
                date: new Date().toISOString()
            });
            await saveWithdraws(wds);

            // Increment daily counter
            security.incrementWDCount(randomId);

            // Audit log
            const logs = await getAuditLogs();
            logs.push({
                id: 'AUDIT-' + Date.now(),
                action: 'AFFILIATE_WITHDRAW',
                randomId,
                amount: amountInt,
                bankDetails: bankClean,
                ip,
                wdId,
                timestamp: new Date().toISOString()
            });
            await saveAuditLogs(logs);

            res.json({
                success: true,
                message: `Request Withdraw Rp ${amountInt.toLocaleString('id-ID')} berhasil diajukan! Admin akan memproses dalam 1x24 jam.`,
                wdId
            });
        } catch (e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // LOGOUT (hapus token)
    // ============================================================
    router.post('/logout', (req, res) => {
        const token = req.headers['x-auth-token'];
        if (token) security.revokeToken(token);
        res.json({ success: true, message: 'Berhasil logout.' });
    });

    // ============================================================
    // FUNGSI INTERNAL: PROSES KOMISI AFFILIATE (dipanggil dari server.js)
    // ============================================================
    app.processAffiliateCommission = async function(order) {
        try {
            if (!order || order.status !== 'SUKSES') return;
            const cfg = getConfig();
            const users = await getUsers();

            // Cek minimum order value
            if (!security.isOrderEligibleForCommission(order)) return;

            const buyer = users.find(u => u.chatId === order.telegramChatId);
            if (!buyer || !buyer.referredBy) return;

            const uplineIdx = users.findIndex(u => u.randomId === buyer.referredBy && u.isAffiliate);
            if (uplineIdx === -1) return;

            // Fraud detection
            const fraudIssues = security.detectFraud(users, buyer.randomId, users[uplineIdx].randomId, null);
            if (fraudIssues.includes('SELF_REFERRAL') || fraudIssues.includes('CIRCULAR_REFERRAL')) {
                console.log(`[AFFILIATE] Fraud detected for order ${order.idDeposit}: ${fraudIssues.join(', ')}`);
                return;
            }

            const profit = order.resellerProfit || cfg.profit || 2000;
            const commissionPct = users[uplineIdx].customCommission || cfg.affiliateCommissionPercent || 20;
            const commission = security.calculateCommission(profit, commissionPct, users[uplineIdx]);
            if (commission <= 0 || cfg.affiliateEnabled === false) return;

            users[uplineIdx].affiliateBalance = (users[uplineIdx].affiliateBalance || 0) + commission;
            users[uplineIdx].totalEarned = (users[uplineIdx].totalEarned || 0) + commission;
            await saveUsers(users);

            const orders = await getOrders();
            const oIdx = orders.findIndex(o => (o.idDeposit === order.idDeposit || o.idOrder === order.idOrder));
            if (oIdx !== -1) {
                orders[oIdx].affiliateRef = buyer.referredBy;
                orders[oIdx].affiliateCommission = commission;
                orders[oIdx].buyerName = buyer.firstName || 'Pelanggan';
                orders[oIdx].completedAt = new Date().toISOString();
                await saveOrders(orders);
            }

            console.log(`[AFFILIATE] Komisi Rp ${commission} (capped dari ${Math.floor((profit * commissionPct) / 100)}) ke ${users[uplineIdx].randomId}`);

            // Kirim notifikasi ke upline via Telegram
            try {
                const { notifyAffiliateNewOrder } = require('./bot.js');
                await notifyAffiliateNewOrder(users[uplineIdx].chatId, {
                    buyerName: buyer.firstName || 'Pelanggan',
                    productName: order.productName || 'Produk',
                    targetPhone: order.targetPhone || '-',
                    commission,
                    newBalance: users[uplineIdx].affiliateBalance
                });
            } catch(e) { console.error('[AFFILIATE NOTIFY ERR]', e.message); }
        } catch (e) {
            console.error('[AFFILIATE COMMISSION ERROR]', e.message);
        }
    };

    // ============================================================
    // API: REJECT AFFILIATE (admin)
    // ============================================================
    router.post('/reject', async (req, res) => {
        try {
            const { randomId, reason } = req.body;
            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            users[idx].affiliatePending = false;
            users[idx].affiliateRejectedAt = new Date().toISOString();
            users[idx].affiliateRejectReason = reason || '';
            await saveUsers(users);
            res.json({ success: true });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // API: STATISTIK AFFILIATE (admin)
    // ============================================================
    router.get('/stats', async (req, res) => {
        try {
            const users = await getUsers();
            const orders = await getOrders();
            const wds = await getWithdraws();

            const affiliates = users.filter(u => u.isAffiliate);
            const pending = users.filter(u => u.affiliatePending && !u.isAffiliate);
            const totalPaid = wds.filter(w => w.status === 'SUKSES' && w.type === 'AFFILIATE')
                               .reduce((s, w) => s + w.amount, 0);
            const totalCommission = orders.filter(o => o.affiliateCommission && o.status === 'SUKSES')
                                         .reduce((s, o) => s + (o.affiliateCommission || 0), 0);

            res.json({
                success: true,
                totalAffiliate: affiliates.length,
                pendingAffiliate: pending.length,
                totalCommissionPaid: totalPaid,
                totalCommissionGenerated: totalCommission,
                topAffiliate: affiliates
                    .sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0))
                    .slice(0, 5)
                    .map(a => ({ name: a.affiliateName || a.firstName, earned: a.totalEarned || 0, balance: a.affiliateBalance || 0 }))
            });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // API: AUDIT LOGS (admin only)
    // ============================================================
    router.get('/audit-logs', async (req, res) => {
        try {
            const logs = await getAuditLogs();
            res.json({ success: true, logs: logs.reverse().slice(0, 100) });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // GOOGLE OAUTH LOGIN
    // ============================================================
    router.post('/google-login', async (req, res) => {
        try {
            const { idToken, accessToken } = req.body;
            if (!idToken) return res.json({ success: false, message: 'Token diperlukan.' });

            let payload;
            const cfg = getConfig();
            const apiKey = cfg.firebaseConfig?.apiKey;

            // Coba Firebase Identity Toolkit (cocok untuk token dari Firebase Auth)
            if (apiKey) {
                try {
                    const fb = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { idToken }, { timeout: 8000 });
                    if (fb.data?.users?.length) {
                        const u = fb.data.users[0];
                        payload = {
                            email: u.email || u.providerUserInfo?.[0]?.email || '',
                            name: u.displayName || u.providerUserInfo?.[0]?.displayName || ''
                        };
                    }
                } catch (e) { console.error('[FB lookup fail]', e.response?.data?.error?.message || e.message); }
            }

            // Fallback: access token → Google userinfo
            if ((!payload || !payload.email) && accessToken) {
                try {
                    const ui = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000
                    });
                    if (ui.data?.email) payload = { email: ui.data.email, name: ui.data.name || '' };
                } catch (e) { console.error('[userinfo fail]', e.message); }
            }

            if (!payload || !payload.email) {
                return res.json({ success: false, message: 'Gagal memverifikasi token. Pastikan Firebase Config sudah benar dan Google sign-in sudah diaktifkan di Firebase Console.' });
            }

            const googleEmail = payload.email.toLowerCase();
            const googleName = payload.name || payload.given_name || googleEmail.split('@')[0];

            // Cari user berdasarkan googleEmail
            let users = await getUsers();
            let user = users.find(u => u.googleEmail === googleEmail && u.isAffiliate);

            if (user) {
                // Login langsung
                const ip = getClientIP(req);
                const ua = req.headers['user-agent'] || '';
                security.revokeUserTokens(user.randomId);
                const token = security.generateToken(user.randomId, ip, ua);

                const logs = await getAuditLogs();
                logs.push({ id:'AUDIT-'+Date.now(), action:'GOOGLE_LOGIN', randomId:user.randomId, ip, timestamp: new Date().toISOString() });
                await saveAuditLogs(logs);

                return res.json({ success: true, token, linked: true });
            }

            // Email belum terdaftar — auto-create affiliate account
            const newRandomId = 'G-' + crypto.randomBytes(3).toString('hex').toUpperCase();
            users.push({
                chatId: 0,
                username: googleEmail.split('@')[0],
                firstName: googleName,
                randomId: newRandomId,
                googleEmail,
                googleName,
                registeredAt: new Date().toISOString(),
                isAffiliate: true,
                affiliatePending: false,
                affiliateApprovedAt: new Date().toISOString(),
                affiliateBalance: 0,
                balance: 0,
                referredBy: null,
                downlineCount: 0
            });
            await saveUsers(users);

            const ip = getClientIP(req);
            const ua = req.headers['user-agent'] || '';
            const token = security.generateToken(newRandomId, ip, ua);

            res.json({
                success: true,
                token,
                linked: true,
                isNew: true,
                randomId: newRandomId,
                message: 'Akun affiliate berhasil dibuat!'
            });
        } catch(e) {
            console.error('[GOOGLE LOGIN]', e.message);
            res.json({ success: false, message: 'Gagal verifikasi Google: ' + (e.response?.data?.error_description || e.message) });
        }
    });

    router.post('/link-telegram', security.authMiddleware, async (req, res) => {
        try {
            const randomId = req.userSession.randomId;
            const { chatId } = req.body;

            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });

            // Unlink jika chatId = 0
            if (chatId === 0) {
                users[idx].chatId = 0;
                await saveUsers(users);
                return res.json({ success: true, message: 'Telegram berhasil diputuskan.' });
            }

            if (!chatId) return res.json({ success: false, message: 'Telegram Chat ID diperlukan.' });

            // Cek apakah chatId sudah dipakai akun lain
            const existing = users.find(u => u.chatId === parseInt(chatId) && u.randomId !== randomId);
            if (existing) return res.json({ success: false, message: 'Telegram ini sudah terhubung ke akun lain.' });

            users[idx].chatId = parseInt(chatId);
            await saveUsers(users);

            res.json({ success: true, message: '✅ Telegram berhasil ditautkan! Kamu akan menerima notifikasi order.' });
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // CEK TOKEN VALIDITY
    // ============================================================
    router.post('/check-token', (req, res) => {
        const token = req.headers['x-auth-token'];
        const ip = getClientIP(req);
        const session = security.verifyToken(token, ip);
        if (session) {
            res.json({ success: true, randomId: session.randomId });
        } else {
            res.json({ success: false, message: 'Token tidak valid.' });
        }
    });

    router.get('/firebase-test', async (req, res) => {
        try {
            const cfg = getConfig();
            const fc = cfg.firebaseConfig || {};
            const hasAll = fc.apiKey && fc.authDomain && fc.projectId && fc.appId;
            if (!hasAll) return res.json({ success: false, message: 'Firebase Config belum lengkap.' });
            // Test Firebase Identity Toolkit
            try {
                const test = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fc.apiKey}`, { idToken: 'test' }, { timeout: 5000 });
                res.json({ success: true, message: `Firebase OK — ${test.data?.users?.length || 0} users` });
            } catch (e) {
                const fbErr = e.response?.data?.error?.message || e.message;
                if (fbErr.includes('INVALID_ID_TOKEN')) {
                    res.json({ success: true, message: 'Firebase terhubung! (INVALID_ID_TOKEN adalah normal untuk test token)' });
                } else {
                    res.json({ success: false, message: `Firebase API error: ${fbErr}` });
                }
            }
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    app.use('/api/affiliate', router);
};
