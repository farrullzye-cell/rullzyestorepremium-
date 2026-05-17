const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

const getConfig = () => { try { return JSON.parse(fs.readFileSync('./config.json')); } catch(e) { return {}; } };
const cfg = getConfig();
let bot = null;

if (cfg.telegramToken) {
    bot = new TelegramBot(cfg.telegramToken, { polling: false });
    bot.deleteWebHook()
        .then(() => { bot.startPolling({ restart: true }); console.log("✅ BOT AKTIF (Affiliate Mode)"); })
        .catch(err => console.error("❌ Bot:", err.message));
} else { console.log("❌ Token bot tidak ada."); }

const getUsers = async () => { try { const r = await axios.get(`${FIREBASE_URL}/users.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const saveUsers = async (u) => { try { await axios.put(`${FIREBASE_URL}/users.json`, u); } catch(e) {} };

const mainKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🛒 Buka Website Belanja", url: "https://rullzyestorepremium.my.id" }],
            [{ text: "👤 Profil & Saldo", callback_data: "menu_profil" }, { text: "🔑 Cek Random ID", callback_data: "menu_id" }],
            [{ text: "🤝 Affiliate System", callback_data: "menu_affiliate" }, { text: "💸 Withdraw", callback_data: "menu_withdraw_affiliate" }],
            [{ text: "🚀 Daftar Affiliate", callback_data: "menu_apply_affiliate" }],
            [{ text: "🔄 Ulangi Transaksi Gagal", callback_data: "menu_retry" }, { text: "💬 Chat CS", callback_data: "menu_cs" }]
        ]
    }
};

// ==================== DAFTAR BANK LENGKAP ====================
const BANK_LIST = [
    "Bank Aladin Syariah", "Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BCA", "Bank CIMB Niaga",
    "Bank Danamon", "Bank Permata", "Bank Panin", "Bank OCBC NISP", "Bank Maybank Indonesia",
    "Bank Mega", "Bank BTN", "Bank BTPN", "Bank BJB", "Bank Jatim", "Bank Jateng", "Bank DIY",
    "Bank Sumut", "Bank Nagari", "Bank Riau Kepri", "Bank Lampung", "Bank Kalsel", "Bank Kalteng",
    "Bank Kaltim", "Bank Sulselbar", "Bank Sulut", "Bank NTB", "Bank NTT", "Bank Maluku",
    "Bank Papua", "Bank Sinarmas", "Bank Artos", "Bank BNP Paribas", "Bank Capital",
    "Bank DBS Indonesia", "Bank HSBC Indonesia", "Bank ICBC Indonesia", "Bank Mayapada",
    "Bank MNC Internasional", "Bank UOB Indonesia", "Bank Victoria", "Bank Woori Saudara",
    "Bank Seabank", "Bank Jago", "Bank Neo Commerce", "DANA", "OVO", "GoPay", "ShopeePay", "LinkAja"
];

// Keyboard bank (inline, 2 kolom)
const bankKeyboard = (page = 0) => {
    const perPage = 10;
    const totalPages = Math.ceil(BANK_LIST.length / perPage);
    const start = page * perPage;
    const banks = BANK_LIST.slice(start, start + perPage);
    const rows = [];
    for (let i = 0; i < banks.length; i += 2) {
        const row = banks.slice(i, i + 2).map(b => ({ text: b, callback_data: `wd_bank_${b}` }));
        rows.push(row);
    }
    // Navigasi halaman
    const nav = [];
    if (page > 0) nav.push({ text: "⬅️ Sebelumnya", callback_data: `wd_bank_page_${page - 1}` });
    if (page < totalPages - 1) nav.push({ text: "Selanjutnya ➡️", callback_data: `wd_bank_page_${page + 1}` });
    if (nav.length) rows.push(nav);
    return { reply_markup: { inline_keyboard: rows } };
};

// ==================== FUNGSI NOTIFIKASI ====================
async function notifyAffiliateApproved(chatId, randomId) {
    if (!bot) return;
    bot.sendMessage(chatId, 
        `🎉 *SELAMAT! AKUN AFFILIATE DISETUJUI* 🎉\n\n` +
        `Permohonan Anda untuk bergabung menjadi Affiliate telah disetujui.\n\n` +
        `Sekarang Anda sudah bisa membagikan link toko Anda dan mendapatkan komisi! 👇`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🛠️ Edit Tampilan Toko", url: "https://rullzyestorepremium.my.id/affiliate.html" }],
                    [{ text: "🌐 Lihat Toko Saya", url: `https://rullzyestorepremium.my.id/toko/${randomId}` }]
                ]
            }
        }
    ).catch(() => {});
}
async function notifyAffiliateRejected(chatId, reason = '') {
    if (!bot) return;
    bot.sendMessage(chatId, 
        `❌ *PENGAJUAN DITOLAK*\n\nMaaf, permohonan Affiliate Anda belum disetujui oleh admin.${reason ? `\n📝 *Alasan:* _${reason}_` : ''}\n\nSilakan hubungi admin untuk informasi lebih lanjut.`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyAffiliateNewOrder(uplineChatId, order) {
    if (!bot) return;
    bot.sendMessage(uplineChatId,
        `💰 *YEY! ADA KOMISI BARU MASUK!* 💰\n\n` +
        `👤 *Downline:* ${order.buyerName || 'Someone'}\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `💸 *Komisi Diterima:* *+Rp ${(order.commission || 0).toLocaleString('id-ID')}*\n` +
        `💳 *Total Saldo:* Rp ${(order.newBalance || 0).toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderSuccess(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *TRANSAKSI BERHASIL* ✅\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n` +
        `📝 *Status/SN:* \`${order.accountDetails || 'Berhasil'}\`\n\n` +
        `Terima kasih telah berbelanja di *${cfg.storeName || 'Rullzye Store'}*! 🙏`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderFailed(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `❌ *TRANSAKSI GAGAL* ❌\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n` +
        `📝 *Alasan:* _${order.accountDetails || 'Gagal diproses dari server pusat'}_\n\n` +
        `💡 _Tips: Gunakan tombol *Ulangi Transaksi Gagal* di menu utama untuk mencoba lagi._`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderProcessing(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `⏳ *PESANAN SEDANG DIPROSES* ⏳\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `Tunggu sebentar ya! Sistem kami sedang memproses pesanan Anda ke server pusat. Notifikasi akan dikirim jika sudah selesai.`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyPaymentReceived(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *PEMBAYARAN BERHASIL DITERIMA* ✅\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `Pesanan Anda sedang dalam antrean proses... ⏳`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawPending(chatId, wd) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `📩 *PENGAJUAN WITHDRAW BARU*\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Bank/E-Wallet:* ${wd.bankDetails}\n` +
        `⏳ *Status:* _Menunggu Review Admin_\n\n` +
        `Permintaan penarikan dana Anda sedang ditinjau. Harap tunggu ya!`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawSuccess(chatId, wd) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *WITHDRAW BERHASIL DICAIRKAN* ✅\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Bank/E-Wallet:* ${wd.bankDetails}\n` +
        `✨ *Status:* SUKSES\n\n` +
        `Dana telah ditransfer ke rekening Anda. Cek mutasi bank/e-wallet Anda sekarang!`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawRejected(chatId, wd, reason = '') {
    if (!bot) return;
    bot.sendMessage(chatId,
        `❌ *WITHDRAW DITOLAK* ❌\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Bank/E-Wallet:* ${wd.bankDetails}\n` +
        `${reason ? `📝 *Alasan:* _${reason}_\n\n` : '\n'}` +
        `Dana telah dikembalikan ke Saldo Komisi Anda. Silakan periksa kembali detail rekening dan ajukan ulang.`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyProfileUpdated(chatId) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *PROFIL TOKO DIPERBARUI*\n\nData toko, bio, warna tema, atau markup Anda telah berhasil disimpan! 🎨`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyDownlineJoined(uplineChatId, downlineName) {
    if (!bot) return;
    bot.sendMessage(uplineChatId,
        `🎉 *DOWNLINE BARU BERGABUNG!* 🎉\n\n` +
        `Kak *${downlineName}* baru saja bergabung menggunakan Link Affiliate Anda.\n\n` +
        `Jika dia melakukan transaksi sukses, Anda akan langsung mendapatkan komisi! Terus semangat promosinya! 🔥`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

// ==================== BOT LOGIC ====================
if (bot) {
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const refCode = match[1] ? match[1].trim().toUpperCase() : null;
        let users = await getUsers();
        let user = users.find(u => u.chatId === chatId);

        if (!user) {
            const randomId = 'ID-' + crypto.randomBytes(3).toString('hex').toUpperCase();
            user = {
                chatId,
                username: msg.from.username || 'n/a',
                firstName: msg.from.first_name,
                randomId,
                registeredAt: new Date().toISOString(),
                isReseller: false,
                isAffiliate: false,
                affiliatePending: false,
                affiliateBalance: 0,
                balance: 0,
                referredBy: refCode || null,
                downlineCount: 0
            };
            users.push(user);
            await saveUsers(users);

            if (refCode) {
                const uplineIdx = users.findIndex(u => u.randomId === refCode);
                if (uplineIdx !== -1) {
                    users[uplineIdx].downlineCount = (users[uplineIdx].downlineCount || 0) + 1;
                    await saveUsers(users);
                    await notifyD            let welcomeMsg = `🎉 *PENDAFTARAN BERHASIL!*\n\nSelamat datang di *${cfg.storeName || 'Rullzye Store'}*, kak *${user.firstName}*! 🥳\n\n` +
                             `🔑 *Random ID Anda:* \`${randomId}\`\n\n` +
                             `*Random ID* ini digunakan untuk mengidentifikasi akun Anda saat melakukan pesanan di website kami. Simpan baik-baik ya!\n\n` +
                             `💡 *Ingin dapat penghasilan tambahan?*\nDaftar menjadi *Affiliate* dan dapatkan komisi dari setiap transaksi teman yang Anda ajak.\n\n👇 Pilih menu di bawah ini untuk memulai:`;
            bot.sendMessage(chatId, welcomeMsg, { parse_mode: "Markdown", ...mainKeyboard });
        } else {
            bot.sendMessage(chatId, `👋 Halo *${user.firstName}*!\n\nAda yang bisa kami bantu hari ini? Silakan pilih menu di bawah:`, { parse_mode: "Markdown", ...mainKeyboard });
        }
    });

    bot.onText(/\/id/, async (msg) => {
        const users = await getUsers();
        const user = users.find(u => u.chatId === msg.chat.id);
        if (user) {
            bot.sendMessage(msg.chat.id,
                `🔑 *INFORMASI AKUN*\n\n` +
                `👤 Nama: *${user.firstName}*\n` +
                `🆔 Random ID: \`${user.randomId}\`\n` +
                `💎 Status: *${user.isAffiliate ? 'Affiliate' : 'Member'}*\n\n` +
                `Gunakan *Random ID* di atas saat memesan di website ya!`,
                { parse_mode: "Markdown" }
            );
        } else bot.sendMessage(msg.chat.id, "Ketik /start dulu.");
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const users = await getUsers();
        const user = users.find(u => u.chatId === chatId);
        if (!user) return bot.sendMessage(chatId, "Ketik /start dulu.");

        // State untuk withdraw
        if (data.startsWith('wd_bank_page_')) {
            const page = parseInt(data.replace('wd_bank_page_', ''));
            bot.editMessageReplyMarkup(bankKeyboard(page).reply_markup, { chat_id: chatId, message_id: query.message.message_id });
            bot.answerCallbackQuery(query.id);
            return;
        }
        if (data.startsWith('wd_bank_')) {
            const bank = data.replace('wd_bank_', '');
            bot.sendMessage(chatId, `🏦 Anda memilih: *${bank}*\n\nSilakan balas pesan ini dengan *Nominal* dan *Nomor Rekening/E-Wallet* Anda.\n\n*Contoh Format:*\n\`50000\`\n\`08123456789 a.n Budi\`\n\n_(Ketik nominal angka saja di baris pertama, lalu nomor & nama di baris kedua)_`, { parse_mode: 'Markdown' });
            // Simpan state sementara
            user._wdState = { step: 'amount', bank: bank };
            await saveUsers(users);
            bot.answerCallbackQuery(query.id);
            return;
        }

        if (data === 'wd_cancel') {
            user._wdState = null;
            await saveUsers(users);
            bot.sendMessage(chatId, "❌ *Withdraw dibatalkan.*");
            bot.answerCallbackQuery(query.id);
            return;
        }

        switch (data) {
            case "menu_profil": {
                const downlineCount = users.filter(u => u.referredBy === user.randomId).length;
                bot.sendMessage(chatId,
                    `👤 *PROFIL & SALDO*\n\n` +
                    `📝 *Nama:* ${user.firstName}\n` +
                    `🆔 *Random ID:* \`${user.randomId}\`\n` +
                    `💎 *Status Akun:* ${user.isAffiliate ? '✅ Affiliate Aktif' : '👤 Member Reguler'}\n\n` +
                    `👥 *Total Downline:* ${downlineCount} Orang\n` +
                    `💰 *Saldo Komisi:* Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}\n` +
                    `💳 *Total Pendapatan:* Rp ${(user.totalEarned || 0).toLocaleString('id-ID')}\n\n` +
                    `${user.isAffiliate ? `Cek Dashboard: https://rullzyestorepremium.my.id/affiliate.html` : `Mau penghasilan tambahan? Klik tombol *Daftar Affiliate*!`}`,
                    { parse_mode: "Markdown" }
                );
                break;
            }
            case "menu_id":
                bot.sendMessage(chatId,
                    `🔑 *INFORMASI AKUN*\n\n` +
                    `👤 Nama: *${user.firstName}*\n` +
                    `🆔 Random ID: \`${user.randomId}\`\n\n` +
                    `Gunakan Random ID ini setiap kali Anda checkout di website kami.`,
                    { parse_mode: "Markdown" }
                );
                break;

            case "menu_apply_affiliate": {
                if (user.isAffiliate) return bot.sendMessage(chatId, "✅ *Anda sudah menjadi Affiliate Aktif.*");
                if (user.affiliatePending) return bot.sendMessage(chatId, "⏳ *Permintaan Anda sedang ditinjau.* Mohon tunggu persetujuan dari admin.");
                const idx = users.findIndex(u => u.chatId === chatId);
                if (idx !== -1) {
                    const cfgData = getConfig();
                    if (cfgData.affiliateEnabled === false) return bot.sendMessage(chatId, "❌ Pendaftaran Affiliate saat ini sedang ditutup.");
                    
                    if (cfgData.affiliateAutoApprove) {
                        users[idx].isAffiliate = true;
                        users[idx].affiliatePending = false;
                        await saveUsers(users);
                        notifyAffiliateApproved(chatId, users[idx].randomId);
                    } else {
                        users[idx].affiliatePending = true;
                        await saveUsers(users);
                        bot.sendMessage(chatId, "📩 *Permintaan Berhasil Dikirim!*\n\nAdmin akan meninjau akun Anda dalam waktu 1x24 jam. Kami akan mengirimkan notifikasi setelah disetujui.");
                    }
                }
                break;
            }

            case "menu_affiliate": {
                if (!user.isAffiliate) return bot.sendMessage(chatId, "❌ *Akses Ditolak*\n\nAnda belum menjadi Affiliate. Silakan klik tombol *Daftar Affiliate* terlebih dahulu.", { parse_mode: "Markdown" });
                const dCount = users.filter(u => u.referredBy === user.randomId).length;
                const linkT = `https://t.me/${cfg.botUsername}?start=${user.randomId}`;
                const linkW = `https://rullzyestorepremium.my.id/toko/${user.randomId}`;
                bot.sendMessage(chatId,
                    `🤝 *AFFILIATE SYSTEM*\n\n` +
                    `Bagikan link di bawah ini ke teman atau sosial media Anda. Jika ada yang mendaftar atau membeli melalui link tersebut, Anda akan mendapatkan komisi otomatis!\n\n` +
                    `🔗 *Link Bot Telegram (Pendaftaran):*\n\`${linkT}\`\n\n` +
                    `🌐 *Link Toko Anda (Website):*\n${linkW}\n\n` +
                    `👥 *Statistik Anda:*\n` +
                    `- Downline Aktif: *${dCount} Orang*\n` +
                    `- Saldo Komisi: *Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}*\n` +
                    `- Komisi per trx: *${user.customCommission || cfg.affiliateCommissionPercent || 20}%* dari profit\n\n` +
                    `🛠️ Edit tampilan toko Anda di: [Dashboard Affiliate](https://rullzyestorepremium.my.id/affiliate.html)`,
                    { parse_mode: "Markdown", disable_web_page_preview: true }
                );
                break;


            case "menu_withdraw_affiliate": {
                if (!user.isAffiliate) return bot.sendMessage(chatId, "❌ Anda belum menjadi Affiliate.");
                if ((user.affiliateBalance || 0) < 10000) return bot.sendMessage(chatId, `❌ Saldo minimal untuk withdraw adalah Rp 10.000. Saldo Anda: Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}`);
                bot.sendMessage(chatId, "🏦 *Pilih Bank / E-Wallet tujuan:*", { ...bankKeyboard(0), parse_mode: 'Markdown' });
                break;
            }

            case "menu_retry": {
                if (!cfg.flowixApiKey || !cfg.flowixMerchantId) return bot.sendMessage(chatId, "❌ PPOB belum dikonfigurasi admin.");
                try {
                    const ordersRes = await axios.get(`${FIREBASE_URL}/orders.json`);
                    const all = ordersRes.data ? Object.entries(ordersRes.data).map(([k, v]) => ({ ...v, _id: k })) : [];
                    const myFlowix = all.filter(o => o.telegramChatId === chatId && o.type === 'FLOWIX').sort((a, b) => (a.idDeposit < b.idDeposit ? 1 : -1));
                    const pending = myFlowix.find(o => o.status === 'MENUNGGU_BAYAR');
                    const failed = myFlowix.find(o => o.status === 'GAGAL');
                    const processing = myFlowix.find(o => o.status === 'PROSES_PUSAT');
                    
                    if (pending) {
                        bot.sendMessage(chatId, `⏳ *MENUNGGU PEMBAYARAN*\n\n🔖 *ID Order:* \`${pending.idDeposit}\`\n📦 *Produk:* ${pending.productName}\n\nMohon selesaikan pembayaran agar pesanan diproses.`, { parse_mode: "Markdown" });
                    } else if (processing) {
                        bot.sendMessage(chatId, `⏳ *SEDANG DIPROSES*\n\n🔖 *ID Order:* \`${processing.idOrder}\`\n📦 *Produk:* ${processing.productName}\n\nTransaksi Anda sedang berjalan di server pusat. Harap tunggu notifikasi selanjutnya.`, { parse_mode: "Markdown" });
                    } else if (failed) {
                        bot.sendMessage(chatId, `🔄 *MENGULANG TRANSAKSI GAGAL*\n\n📦 *Produk:* ${failed.productName}\n🎯 *Target:* \`${failed.targetPhone}\`\n\nMembuat pesanan baru...`, { parse_mode: "Markdown" });
                        const PORT = process.env.PORT || 3000;
                        const resp = await axios.post(`http://localhost:${PORT}/api/ppob-retry`, {
                            productId: failed.productId,
                            target: failed.targetPhone,
                            productName: failed.productName,
                            displayPrice: failed.displayPrice || 0,
                            randomId: user.randomId
                        });
                        if (resp.data.status) {
                            bot.sendMessage(chatId, `✅ *BERHASIL MENGULANG TRANSAKSI*\n\n🔖 *ID Referensi Baru:* \`${resp.data.reff_id}\`\nSilakan cek notifikasi proses selanjutnya.`, { parse_mode: "Markdown" });
                        } else {
                            bot.sendMessage(chatId, `❌ *GAGAL MENGULANG*\n\nAlasan: ${resp.data.message}`, { parse_mode: "Markdown" });
                        }
                    } else {
                        const success = myFlowix.find(o => o.status === 'SUKSES');
                        if (success) bot.sendMessage(chatId, "✅ *Semua transaksi terakhir Anda berstatus SUKSES.*", { parse_mode: "Markdown" });
                        else bot.sendMessage(chatId, "📭 *Belum ada riwayat transaksi.*", { parse_mode: "Markdown" });
                    }
                } catch (e) { bot.sendMessage(chatId, "❌ Gagal mengambil data transaksi."); }
                break;
            }

            case "menu_cs":
                bot.sendMessage(chatId, "👨‍💻 *HUBUNGI CUSTOMER SERVICE*\n\nJika Anda memiliki kendala, silakan chat CS kami:\n📞 *WhatsApp:* 085848651208\n💬 *Telegram:* @arulfaathir", { parse_mode: "Markdown" });
                break;
        }
    });

    // Tangkap pesan teks untuk input withdraw
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;
        const chatId = msg.chat.id;
        const users = await getUsers();
        const user = users.find(u => u.chatId === chatId);
        if (!user || !user._wdState) return;

        const state = user._wdState;
        if (state.step === 'amount') {
            const parts = msg.text.split('\n');
            const amount = parseInt(parts[0].replace(/\D/g, ''));
            const account = parts[1]?.trim() || '';
            if (!amount || amount < 10000) {
                return bot.sendMessage(chatId, "❌ Minimal withdraw Rp 10.000. Masukkan ulang nominal:");
            }
            if (!account) {
                return bot.sendMessage(chatId, "❌ Masukkan nomor rekening dan nama pemilik.\nContoh: `1234567890 a.n. Budi`");
            }
            state.amount = amount;
            state.account = account;
            state.step = 'confirm';
            await saveUsers(users);
            bot.sendMessage(chatId,
                `📋 *KONFIRMASI WITHDRAW*\n\n` +
                `Bank: *${state.bank}*\n` +
                `Jumlah: *Rp ${amount.toLocaleString('id-ID')}*\n` +
                `Rekening: \`${account}\`\n\n` +
                `Ketik *YA* untuk konfirmasi, atau *BATAL* untuk membatalkan.`,
                { parse_mode: 'Markdown' }
            );
        } else if (state.step === 'confirm') {
            if (msg.text.toUpperCase() === 'YA') {
                const wdRes = await axios.post(`http://localhost:${process.env.PORT || 3000}/api/affiliate/withdraw`, {
                    randomId: user.randomId,
                    amount: state.amount,
                    bankDetails: `${state.bank} - ${state.account}`
                });
                if (wdRes.data.success) {
                    await notifyWithdrawPending(chatId, { amount: state.amount, bankDetails: `${state.bank} - ${state.account}` });
                    bot.sendMessage(chatId, "✅ Permintaan withdraw berhasil diajukan! Admin akan meninjau permintaan Anda.");
                } else {
                    bot.sendMessage(chatId, `❌ Gagal: ${wdRes.data.message}`);
                }
            } else {
                bot.sendMessage(chatId, "Withdraw dibatalkan.");
            }
            user._wdState = null;
            await saveUsers(users);
        }
    });
}

// ==================== FUNGSI NOTIFIKASI EKSTERNAL ====================
async function sendBroadcast(text) {
    if (!bot) return;
    const users = await getUsers();
    for (const u of users) {
        await bot.sendMessage(u.chatId, `📢 *INFO PENTING*\n\n${text}`, { parse_mode: "Markdown" }).catch(() => {});
    }
}

module.exports = {
    bot,
    sendBroadcast,
    notifyAffiliateApproved,
    notifyAffiliateRejected,
    notifyAffiliateNewOrder,
    notifyOrderSuccess,
    notifyOrderFailed,
    notifyOrderProcessing,
    notifyPaymentReceived,
    notifyWithdrawPending,
    notifyWithdrawSuccess,
    notifyWithdrawRejected,
    notifyProfileUpdated,
    notifyDownlineJoined
};
