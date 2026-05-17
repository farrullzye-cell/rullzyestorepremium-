// affiliate_api.js — Sistem Affiliate Matang
const express = require('express');
const axios = require('axios');
const fs = require('fs');

module.exports = function(app, getUsers, saveUsers, getOrders, saveOrders, FIREBASE_URL) {
    const router = express.Router();

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

    // ============================================================
    // APPLY JADI AFFILIATE
    // ============================================================
    router.post('/apply', async (req, res) => {
        try {
            const { randomId } = req.body;
            const cfg = getConfig();
            if (cfg.affiliateEnabled === false) return res.json({ success: false, message: 'Pendaftaran affiliate sedang ditutup.' });

            let users = await getUsers();
            const user = users.find(u => u.randomId === randomId);
            if (!user) return res.json({ success: false, message: 'User tidak ditemukan. Pastikan kamu sudah daftar di Bot Telegram.' });
            if (user.isAffiliate) return res.json({ success: false, message: 'Anda sudah menjadi Affiliate.' });
            if (user.isBanned) return res.json({ success: false, message: 'Akun Anda dibanned dari program affiliate.' });
            if (user.affiliatePending && !cfg.affiliateAutoApprove) return res.json({ success: false, message: 'Permintaan sudah terkirim, tunggu persetujuan admin.' });

            const idx = users.findIndex(u => u.randomId === randomId);
            if (cfg.affiliateAutoApprove) {
                users[idx].isAffiliate = true;
                users[idx].affiliatePending = false;
            } else {
                users[idx].affiliatePending = true;
            }
            users[idx].affiliateAppliedAt = new Date().toISOString();
            await saveUsers(users);

            if (cfg.affiliateAutoApprove) {
                res.json({ success: true, message: '✅ Pendaftaran berhasil! Anda langsung menjadi affiliate.' });
            } else {
                res.json({ success: true, message: '✅ Permintaan dikirim! Admin akan mereview dalam 1x24 jam.' });
            }
        } catch(e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // DASHBOARD AFFILIATE (LENGKAP)
    // ============================================================
    router.post('/dashboard', async (req, res) => {
        try {
            const { randomId } = req.body;
            const users = await getUsers();
            const user = users.find(u => u.randomId === randomId);

            if (!user) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!user.isAffiliate && !user.affiliatePending) {
                return res.json({ success: false, message: 'Anda belum mendaftar sebagai Affiliate.' });
            }
            if (user.affiliatePending && !user.isAffiliate) {
                return res.json({ success: false, isPending: true, message: 'Permintaan Anda sedang menunggu persetujuan admin.' });
            }

            const cfg = getConfig();
            const orders = await getOrders();
            const wds = await getWithdraws();

            // Filter order yang berasal dari affiliate ini
            const myOrders = orders.filter(o => o.affiliateRef === randomId && o.status === 'SUKSES');
            const myPendingOrders = orders.filter(o => o.affiliateRef === randomId && o.status === 'MENUNGGU_BAYAR');

            // Hitung statistik komisi
            const totalCommission = myOrders.reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

            const now = new Date();
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthlyOrders = myOrders.filter(o => (o.completedAt || '').startsWith(thisMonth));
            const monthlyCommission = monthlyOrders.reduce((sum, o) => sum + (o.affiliateCommission || 0), 0);

            // Hitung downline aktif (yang pernah order)
            const downlines = users.filter(u => u.referredBy === randomId);
            const activeDownlines = downlines.filter(dl =>
                orders.some(o => o.telegramChatId === dl.chatId && o.status === 'SUKSES')
            );

            // Riwayat withdraw
            const myWithdraws = wds.filter(w => w.randomId === randomId).reverse().slice(0, 10);

            // Riwayat komisi (20 terakhir)
            const history = myOrders.slice(-50).reverse().slice(0, 20).map(o => ({
                id: o.idDeposit || o.idOrder,
                product: o.productName,
                target: o.targetPhone,
                commission: o.affiliateCommission || 0,
                date: o.completedAt || o.createdAt || new Date().toISOString(),
                buyerName: o.buyerName || 'Pelanggan'
            }));

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
                    // Statistik
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
    // UPDATE PROFIL & PENGATURAN TOKO
    // ============================================================
    router.post('/settings', async (req, res) => {
        try {
            const { randomId, affiliateName, bio, markupPercent, selectedProducts, avatarUrl, themeColor, socialLinks } = req.body;
            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!users[idx].isAffiliate) return res.json({ success: false, message: 'Bukan affiliate.' });

            if (affiliateName !== undefined) users[idx].affiliateName = affiliateName.trim().substring(0, 50);
            if (bio !== undefined) users[idx].affiliateBio = bio.trim().substring(0, 200);
            if (markupPercent !== undefined) users[idx].markupPercent = Math.max(0, Math.min(100, parseInt(markupPercent) || 0));
            if (selectedProducts !== undefined) users[idx].selectedProducts = selectedProducts;
            if (avatarUrl !== undefined) users[idx].avatarUrl = avatarUrl.trim().substring(0, 500);
            if (themeColor !== undefined) users[idx].themeColor = themeColor;
            if (socialLinks !== undefined) users[idx].socialLinks = socialLinks;

            await saveUsers(users);
            res.json({ success: true, message: 'Pengaturan toko berhasil disimpan.' });
        } catch (e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // WITHDRAW KOMISI
    // ============================================================
    router.post('/withdraw', async (req, res) => {
        try {
            const { randomId, amount, bankDetails } = req.body;
            if (!randomId || !amount || !bankDetails) {
                return res.json({ success: false, message: 'Semua kolom harus diisi.' });
            }
            const cfg = getConfig();
            const minWD = cfg.affiliateMinWithdraw || 10000;
            const amountInt = parseInt(amount);

            if (amountInt < minWD) {
                return res.json({ success: false, message: `Minimal penarikan Rp ${minWD.toLocaleString('id-ID')}` });
            }

            let users = await getUsers();
            const idx = users.findIndex(u => u.randomId === randomId);
            if (idx === -1) return res.json({ success: false, message: 'User tidak ditemukan.' });
            if (!users[idx].isAffiliate) return res.json({ success: false, message: 'Bukan affiliate.' });
            if ((users[idx].affiliateBalance || 0) < amountInt) {
                return res.json({ success: false, message: `Saldo tidak mencukupi. Saldo Anda: Rp ${(users[idx].affiliateBalance || 0).toLocaleString('id-ID')}` });
            }

            // Potong saldo
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
                bankDetails,
                status: 'PENDING',
                type: 'AFFILIATE',
                date: new Date().toISOString()
            });
            await saveWithdraws(wds);

            res.json({
                success: true,
                message: `✅ Request Withdraw Rp ${amountInt.toLocaleString('id-ID')} berhasil diajukan! Admin akan memproses dalam 1x24 jam.`,
                wdId
            });
        } catch (e) { res.json({ success: false, message: e.message }); }
    });

    // ============================================================
    // FUNGSI INTERNAL: PROSES KOMISI AFFILIATE (dipanggil dari server.js)
    // ============================================================
    // Ini diekspor sebagai fungsi terpisah
    app.processAffiliateCommission = async function(order) {
        try {
            if (!order || order.status !== 'SUKSES') return;
            const cfg = getConfig();
            const users = await getUsers();

            // Cari buyer berdasarkan chatId
            const buyer = users.find(u => u.chatId === order.telegramChatId);
            if (!buyer || !buyer.referredBy) return;

            // Cari upline (affiliate yang merujuk buyer)
            const uplineIdx = users.findIndex(u => u.randomId === buyer.referredBy && u.isAffiliate);
            if (uplineIdx === -1) return;

            // Hitung komisi
            const profit = order.resellerProfit || cfg.profit || 2000;
            const commissionPct = users[uplineIdx].customCommission || cfg.affiliateCommissionPercent || 20;
            const commission = Math.floor((profit * commissionPct) / 100);
            if (commission <= 0 || cfg.affiliateEnabled === false) return;

            // Update saldo affiliate
            users[uplineIdx].affiliateBalance = (users[uplineIdx].affiliateBalance || 0) + commission;
            users[uplineIdx].totalEarned = (users[uplineIdx].totalEarned || 0) + commission;
            await saveUsers(users);

            // Update order dengan info komisi
            const orders = await getOrders();
            const oIdx = orders.findIndex(o => (o.idDeposit === order.idDeposit || o.idOrder === order.idOrder));
            if (oIdx !== -1) {
                orders[oIdx].affiliateRef = buyer.referredBy;
                orders[oIdx].affiliateCommission = commission;
                orders[oIdx].buyerName = buyer.firstName || 'Pelanggan';
                orders[oIdx].completedAt = new Date().toISOString();
                await saveOrders(orders);
            }

            console.log(`[AFFILIATE] Komisi Rp ${commission} diberikan ke ${users[uplineIdx].randomId}`);
        } catch (e) {
            console.error('[AFFILIATE COMMISSION ERROR]', e.message);
        }
    };

    // ============================================================
    // API: REJECT AFFILIATE (untuk admin)
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
    // API: STATISTIK AFFILIATE (untuk admin)
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

    app.use('/api/affiliate', router);
};
