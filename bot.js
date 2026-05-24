const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

const getConfig = () => { try { return JSON.parse(fs.readFileSync('./config.json')); } catch(e) { return {}; } };
const cfg = getConfig();
let bot = null;

const BOT_TOKEN = process.env.TELEGRAM_TOKEN || cfg.telegramToken;

if (BOT_TOKEN) {
    bot = new TelegramBot(BOT_TOKEN, { polling: false });
    bot.deleteWebHook()
        .then(() => { bot.startPolling({ restart: true }); console.log("✅ BOT AKTIF (Menggunakan Token dari ENV)"); })
        .catch(err => console.error("❌ Bot:", err.message));
} else { console.log("❌ Token bot belum disetel di Environment (TELEGRAM_TOKEN)."); }

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
    const store = cfg.storeName || 'Rullzye Store Premium';
    bot.sendMessage(chatId, 
        `🎉 *SELAMAT! AKUN AFFILIATE DISETUJUI* 🎉\n\n` +
        `Halo kak! Permohonan Anda untuk bergabung sebagai *Affiliate ${store}* telah disetujui oleh admin ✅\n\n` +
        `Sekarang Anda sudah bisa membagikan link toko dan mulai mendapatkan komisi dari setiap transaksi! 💰\n\n` +
        `👇 *Yuk atur tampilan toko kamu:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎨 Edit Tampilan Toko", url: "https://rullzyestorepremium.my.id/affiliate.html" }],
                    [{ text: "🌐 Lihat Toko Saya", url: `https://rullzyestorepremium.my.id/toko/${randomId}` }]
                ]
            }
        }
    ).catch(() => {});
}
async function notifyAffiliateRejected(chatId, reason = '') {
    if (!bot) return;
    bot.sendMessage(chatId, 
        `❌ *PENGAJUAN AFFILIATE DITOLAK*\n\nMaaf kak, permohonan Affiliate Anda belum dapat disetujui oleh admin.${reason ? `\n📝 *Alasan:* ${reason}` : ''}\n\nSilakan hubungi Customer Service untuk informasi lebih lanjut atau ajukan ulang setelah memperbaiki data.`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyAffiliateNewOrder(uplineChatId, order) {
    if (!bot) return;
    bot.sendMessage(uplineChatId,
        `💰 *KOMISI BARU MASUK!* 💰\n\n` +
        `Horee! Downline kamu baru saja bertransaksi 🎉\n\n` +
        `👤 *Downline:* ${order.buyerName || 'Member'}\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `💸 *Komisi:* *+Rp ${(order.commission || 0).toLocaleString('id-ID')}*\n` +
        `💳 *Saldo Komisi:* Rp ${(order.newBalance || 0).toLocaleString('id-ID')}\n\n` +
        `Terus semangat promosi! 🔥`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderSuccess(chatId, order) {
    if (!bot) return;
    const store = cfg.storeName || 'Rullzye Store Premium';
    bot.sendMessage(chatId,
        `✅ *TRANSAKSI BERHASIL* ✅\n\n` +
        `Alhamdulillah, pesanan kamu berhasil diproses 🎉\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n` +
        `📝 *Detail:* \`${order.accountDetails || 'Berhasil'}\`\n\n` +
        `Terima kasih telah berbelanja di *${store}*! 🙏\n` +
        `Jangan lupa kasih review ya kak 😊`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderFailed(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `❌ *TRANSAKSI GAGAL* ❌\n\n` +
        `Maaf kak, pesanan kamu gagal diproses 😔\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n` +
        `📝 *Alasan:* ${order.accountDetails || 'Gagal diproses dari server pusat'}\n\n` +
        `💡 Gunakan tombol *🔄 Ulangi Transaksi Gagal* di menu utama untuk mencoba lagi.\n` +
        `Atau hubungi CS jika masih terkendala.`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyOrderProcessing(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `⏳ *PESANAN SEDANG DIPROSES* ⏳\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `Tunggu bentar ya kak, sistem kami sedang memproses pesanan ke server pusat... 🔄\n\n` +
        `Notifikasi akan dikirim otomatis kalau sudah selesai ✅`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyPaymentReceived(chatId, order) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *PEMBAYARAN DITERIMA* ✅\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `🎯 *Target:* \`${order.targetPhone || '-'}\`\n\n` +
        `Pembayaran berhasil diverifikasi! 🎉\n` +
        `Pesanan kamu sekarang dalam antrean proses... ⏳\n\n` +
        `Kami akan kirim notifikasi kalau sudah selesai 👍`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawPending(chatId, wd) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `📩 *WITHDRAW DIAJUKAN* 📩\n\n` +
        `Permintaan penarikan dana kamu sudah masuk ya!\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Tujuan:* ${wd.bankDetails}\n` +
        `⏳ *Status:* Menunggu Review Admin\n\n` +
        `Admin akan memproses dalam waktu 1x24 jam. Harap tunggu dan pantau terus notifikasinya ya! 😊`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawSuccess(chatId, wd) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *WITHDRAW BERHASIL DICAIRKAN* ✅\n\n` +
        `Selamat! Dana kamu sudah berhasil dicairkan 🎉💰\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Tujuan:* ${wd.bankDetails}\n` +
        `📊 *Status:* SUKSES ✅\n\n` +
        `Cek mutasi rekening/e-wallet kamu sekarang ya!\n` +
        `Terima kasih telah menjadi bagian dari *${cfg.storeName || 'Rullzye Store Premium'}* 🙏`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyWithdrawRejected(chatId, wd, reason = '') {
    if (!bot) return;
    bot.sendMessage(chatId,
        `❌ *WITHDRAW DITOLAK* ❌\n\n` +
        `Maaf kak, permintaan withdraw kamu ditolak oleh admin 😔\n\n` +
        `💰 *Jumlah:* Rp ${wd.amount.toLocaleString('id-ID')}\n` +
        `🏦 *Tujuan:* ${wd.bankDetails}\n` +
        `${reason ? `📝 *Alasan:* ${reason}\n\n` : '\n'}` +
        `💡 Dana sudah dikembalikan ke Saldo Komisi kamu. Silakan perbaiki data rekening dan ajukan ulang ya!`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyProfileUpdated(chatId) {
    if (!bot) return;
    bot.sendMessage(chatId,
        `✅ *PROFIL TOKO DIPERBARUI*\n\nData toko, bio, warna tema, atau markup kamu berhasil disimpan! 🎨\n\nCek tampilan toko kamu di:\nhttps://rullzyestorepremium.my.id/affiliate.html`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

async function notifyDownlineJoined(uplineChatId, downlineName) {
    if (!bot) return;
    bot.sendMessage(uplineChatId,
        `🎉 *DOWNLINE BARU!* 🎉\n\n` +
        `Kak *${downlineName}* baru saja mendaftar pakai Link Affiliate kamu.\n\n` +
        `Kalau dia transaksi, kamu langsung dapat komisi otomatis! 💰\n\n` +
        `Terus semangat promosi, makin banyak downline makin cuan! 🔥🚀`,
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

// ==================== GROUP SYSTEM ====================
const getGroupIds = () => {
    try {
        const cfg = JSON.parse(fs.readFileSync('./config.json'));
        return cfg.groupIds || {};
    } catch(e) { return {}; }
};

async function sendToGroup(groupKey, message, parseMode = 'Markdown') {
    if (!bot) return;
    const groups = getGroupIds();
    const chatId = groups[groupKey];
    if (!chatId) return;
    try {
        await bot.sendMessage(chatId, message, { parse_mode: parseMode, disable_web_page_preview: true });
    } catch(e) {
        console.error(`[GROUP ${groupKey}] Error:`, e.message);
    }
}

async function notifyGroupAffiliateNew(user) {
    await sendToGroup('affiliate', `🎉 *AFFILIATE BARU!*\n\n👤 *Nama:* ${user.affiliateName || user.firstName}\n🆔 *ID:* \`${user.randomId}\`\n📅 *Tanggal:* ${new Date().toLocaleDateString('id-ID')}\n📊 *Total Member:* ${/* akan diisi */ '—'}\n\nSelamat datang di tim affiliate! Semangat cuan! 🚀💰`);
}

async function notifyGroupOrderNew(order) {
    await sendToGroup('order', `🛒 *ORDER BARU MASUK!*\n\n📦 *Produk:* ${order.productName}\n🎯 *Target:* \`${order.targetPhone || '-'}\`\n💰 *Harga:* Rp ${(order.displayPrice || 0).toLocaleString('id-ID')}\n📊 *Status:* ${order.status}\n👤 *User:* \`${order.randomId || order.targetPhone || '-'}\`\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n⚠️ Segera diproses!`);
}

async function notifyGroupOrderSuccess(order) {
    await sendToGroup('order', `✅ *ORDER SUKSES!*\n\n📦 *Produk:* ${order.productName}\n🎯 *Target:* \`${order.targetPhone || '-'}\`\n💰 *Harga:* Rp ${(order.displayPrice || 0).toLocaleString('id-ID')}\n📝 *Detail:* ${(order.accountDetails || 'Selesai').substring(0, 100)}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\nAlhamdulillah, order berhasil ✅`);
}

async function notifyGroupWithdrawNew(wd) {
    await sendToGroup('withdraw', `📤 *WITHDRAW BARU!*\n\n👤 *Affiliate:* ${wd.affiliateName || wd.name || '-'}\n🆔 *ID:* \`${wd.randomId || '-'}\`\n💰 *Jumlah:* Rp ${(wd.amount || 0).toLocaleString('id-ID')}\n🏦 *Tujuan:* ${wd.bankDetails || '-'}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n⚠️ Segera diproses ya admin!`);
}

async function notifyGroupWithdrawProcessed(wd, status) {
    const emoji = status === 'SUKSES' ? '✅' : '❌';
    const label = status === 'SUKSES' ? 'DICAIRKAN' : 'DITOLAK';
    await sendToGroup('withdraw', `${emoji} *WITHDRAW ${label}!*\n\n👤 *Affiliate:* ${wd.affiliateName || wd.name || '-'}\n🆔 *ID:* \`${wd.randomId || '-'}\`\n💰 *Jumlah:* Rp ${(wd.amount || 0).toLocaleString('id-ID')}\n🏦 *Tujuan:* ${wd.bankDetails || '-'}\n📊 *Status:* ${status}\n⏰ *Diproses:* ${new Date().toLocaleString('id-ID')}`);
}

async function notifyGroupReport(message) {
    await sendToGroup('report', `📊 *LAPORAN*\n\n${message}`);
}

async function notifyGroupError(errorMsg) {
    await sendToGroup('error', `🚨 *ERROR SISTEM*\n\n${errorMsg}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n⚠️ Segera cek server!`);
}

async function notifyGroupCommission(affiliateName, amount, orderInfo) {
    await sendToGroup('commission', `💰 *KOMISI BARU!*\n\n👤 *Affiliate:* ${affiliateName}\n💵 *Jumlah:* Rp ${(amount || 0).toLocaleString('id-ID')}\n📦 *Dari:* ${orderInfo}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\nSemangat terus affiliate kita! 🔥`);
}

async function notifyGroupPromo(message) {
    await sendToGroup('promo', `🎉 *PROMO SPESIAL!*\n\n${message}\n\n⏰ *Berlaku:* ${new Date().toLocaleString('id-ID')}\n\nJangan sampai kelewatan! 🔥`);
}

async function notifyGroupStockUpdate(products) {
    const list = Array.isArray(products) ? products.slice(0, 20) : [];
    if (list.length === 0) return;
    const habis = list.filter(p => p.stock === 0).length;
    const tersedia = list.length - habis;
    await sendToGroup('stock', `📦 *UPDATE STOK PRODUK*\n\n📊 *Ringkasan:* ${tersedia} tersedia, ${habis} habis\n\n${list.map(p => `• ${p.name.substring(0, 40)} — Rp ${(p.price || 0).toLocaleString('id-ID')} ${p.stock === 0 ? '❌ HABIS' : '✅ Stok: ' + p.stock}`).join('\n')}\n\n⏰ ${new Date().toLocaleString('id-ID')}`);
}

async function notifyGroupBroadcast(message) {
    await sendToGroup('broadcast', `📢 *BROADCAST PENGUMUMAN*\n\n${message}\n\n— *${cfg.storeName || 'Rullzye Store Premium'}*`);
}

async function notifyGroupAdmin(message) {
    await sendToGroup('admin', `🔔 *NOTIFIKASI ADMIN*\n\n${message}\n⏰ ${new Date().toLocaleString('id-ID')}`);
}

async function notifyGroupAffiliateNews(message) {
    await sendToGroup('affiliate_news', `📰 *KABAR AFFILIATE*\n\n${message}\n⏰ ${new Date().toLocaleString('id-ID')}\n\nTetap semangat cuan! 💪💰`);
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
                    await notifyDownlineJoined(users[uplineIdx].chatId, user.firstName || 'Someone');
                }
            }

            let welcomeMsg = `🎉 *SELAMAT DATANG!* 🎉\n\n` +
                             `Halo *${user.firstName}*! Terima kasih sudah bergabung di *${cfg.storeName || 'Rullzye Store Premium'}* 🥳\n\n` +
                             `🔑 *Random ID kamu:* \`${randomId}\`\n\n` +
                             `Gunakan ID di atas setiap kali checkout di website ya! Simpan baik-baik 😉\n\n` +
                             `💡 *Mau cuan tambahan?*\nDaftar jadi *Affiliate* dan dapatkan komisi dari setiap transaksi teman yang kamu ajak. Gampang banget!\n\n` +
                             `👇 *Pilih menu di bawah:*`;
            bot.sendMessage(chatId, welcomeMsg, { parse_mode: "Markdown", ...mainKeyboard });
        } else {
            bot.sendMessage(chatId, `👋 Halo lagi *${user.firstName}*!\n\nAda yang bisa kami bantu hari ini? Silakan pilih menu di bawah 😊`, { parse_mode: "Markdown", ...mainKeyboard });
        }
    });

    bot.onText(/\/mygroupid/, async (msg) => {
        const chatId = msg.chat.id;
        const chatType = msg.chat.type;
        if (chatType === 'group' || chatType === 'supergroup') {
            bot.sendMessage(chatId, `📋 *INFO GRUP*\n\n🆔 *ID Grup:* \`${chatId}\`\n📛 *Nama:* ${msg.chat.title || '-'}\n👥 *Tipe:* ${chatType === 'supergroup' ? 'Supergroup' : 'Group'}\n\n📌 Salin ID di atas dan masukkan ke *Panel Admin → Grup Bot* untuk mengaktifkan notifikasi grup ini.\n\nContoh:\n\`\`\`\n"affiliate": "${chatId}"\n\`\`\``, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ Perintah ini hanya bisa digunakan di dalam grup.');
        }
    });

    bot.onText(/\/id/, async (msg) => {
        const users = await getUsers();
        const user = users.find(u => u.chatId === msg.chat.id);
        if (user) {
            bot.sendMessage(msg.chat.id,
                `🔑 *INFO AKUN* 🔑\n\n` +
                `👤 *Nama:* ${user.firstName}\n` +
                `🆔 *Random ID:* \`${user.randomId}\`\n` +
                `💎 *Status:* ${user.isAffiliate ? '✅ Affiliate Aktif' : '👤 Member'}\n` +
                `💰 *Saldo:* Rp ${(user.balance || 0).toLocaleString('id-ID')}\n` +
                `${user.isAffiliate ? `💳 *Komisi:* Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}` : ''}\n\n` +
                `🔗 *Link Toko:* https://rullzyestorepremium.my.id/toko/${user.randomId}\n\n` +
                `Gunakan *Random ID* ini setiap checkout di website kami ya!`,
                { parse_mode: "Markdown" }
            );
        } else bot.sendMessage(msg.chat.id, `Halo! Sepertinya kamu belum terdaftar. Ketik /start untuk mendaftar di *${cfg.storeName || 'Rullzye Store Premium'}* 😊`, { parse_mode: "Markdown" });
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
            bot.sendMessage(chatId, `🏦 Kamu memilih: *${bank}*\n\nSekarang kirimkan *Nominal* dan *Data Rekening* kamu.\n\n📝 *Format balasan (2 baris):*\n\`\`\`\n50000\n08123456789 a.n Budi\n\`\`\`\n\n*Baris 1:* Nominal (min Rp 10.000)\n*Baris 2:* No. Rekening a.n Nama\n\nKetik *BATAL* kapan saja untuk membatalkan.`, { parse_mode: 'Markdown' });
            // Simpan state sementara
            user._wdState = { step: 'amount', bank: bank };
            await saveUsers(users);
            bot.answerCallbackQuery(query.id);
            return;
        }

        if (data === 'wd_cancel') {
            user._wdState = null;
            await saveUsers(users);
            bot.sendMessage(chatId, "❌ *Withdraw dibatalkan.*\n\nSilakan menu lagi kapan saja kalau mau withdraw 😊");
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
                    `💎 *Status:* ${user.isAffiliate ? '✅ Affiliate Aktif' : '👤 Member'}\n` +
                    `💰 *Saldo Utama:* Rp ${(user.balance || 0).toLocaleString('id-ID')}\n` +
                    `${user.isAffiliate ? `💳 *Saldo Komisi:* Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}\n` : ''}` +
                    `👥 *Downline:* ${downlineCount} Orang\n\n` +
                    `${user.isAffiliate ?
                        `🔗 *Link Toko:* https://rullzyestorepremium.my.id/toko/${user.randomId}\n🎨 *Dashboard:* https://rullzyestorepremium.my.id/affiliate.html` :
                        `💡 Mau penghasilan tambahan? Klik *Daftar Affiliate* sekarang!`}`,
                    { parse_mode: "Markdown", disable_web_page_preview: true }
                );
                break;
            }
            case "menu_id":
                bot.sendMessage(chatId,
                    `🔑 *RANDOM ID KAMU*\n\n` +
                    `👤 *Nama:* ${user.firstName}\n` +
                    `🆔 *Random ID:* \`${user.randomId}\`\n\n` +
                    `Gunakan ID ini setiap checkout di website:\n` +
                    `🌐 https://rullzyestorepremium.my.id`,
                    { parse_mode: "Markdown" }
                );
                break;

            case "menu_apply_affiliate": {
                if (user.isAffiliate) return bot.sendMessage(chatId, "✅ *Kamu sudah menjadi Affiliate Aktif!*\n\nCek menu *🤝 Affiliate System* untuk lihat link dan stats kamu.");
                if (user.affiliatePending) return bot.sendMessage(chatId, "⏳ *Permintaan kamu sedang ditinjau admin.*\n\nMohon tunggu ya, admin akan review dalam 1x24 jam. Kami notifikasi kalau sudah disetujui ✅");
                const idx = users.findIndex(u => u.chatId === chatId);
                if (idx !== -1) {
                    const cfgData = getConfig();
                    if (cfgData.affiliateEnabled === false) return bot.sendMessage(chatId, "❌ *Pendaftaran Affiliate ditutup*\n\nMaaf, program affiliate sedang tidak aktif. Silakan hubungi CS untuk info lebih lanjut.");
                    
                    if (cfgData.affiliateAutoApprove) {
                        users[idx].isAffiliate = true;
                        users[idx].affiliatePending = false;
                        users[idx].affiliateApprovedAt = new Date().toISOString();
                        await saveUsers(users);
                        notifyAffiliateApproved(chatId, users[idx].randomId);
                        notifyGroupAffiliateNew(users[idx]);
                    } else {
                        users[idx].affiliatePending = true;
                        await saveUsers(users);
                        bot.sendMessage(chatId, `📩 *Permintaan Affiliate Dikirim!* 📩\n\nTerima kasih sudah mendaftar jadi Affiliate *${cfg.storeName || 'Rullzye Store Premium'}*!\n\nAdmin akan meninjau akun kamu dalam 1x24 jam. Kami kabari kalau sudah disetujui ya 😊👍`);
                    }
                }
                break;
            }

            case "menu_affiliate": {
                if (!user.isAffiliate) return bot.sendMessage(chatId, `❌ *Akses Ditolak*\n\nKamu belum terdaftar sebagai Affiliate.\nKlik *Daftar Affiliate* dulu yuk! 😊`, { parse_mode: "Markdown" });
                const dCount = users.filter(u => u.referredBy === user.randomId).length;
                const linkT = `https://t.me/${cfg.botUsername}?start=${user.randomId}`;
                const linkW = `https://rullzyestorepremium.my.id/toko/${user.randomId}`;
                bot.sendMessage(chatId,
                    `🤝 *AFFILIATE SYSTEM*\n\n` +
                    `Yuk bagikan link di bawah ke teman-teman kamu! 🚀\n\n` +
                    `🔗 *Link Telegram:*\n\`${linkT}\`\n\n` +
                    `🌐 *Link Toko Online:*\n${linkW}\n\n` +
                    `📊 *Statistik Kamu:*\n` +
                    `• 👥 Downline: *${dCount} Orang*\n` +
                    `• 💰 Saldo Komisi: *Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}*\n` +
                    `• 📈 Komisi: *${user.customCommission || cfg.affiliateCommissionPercent || 20}%* dari profit\n\n` +
                    `🎨 Atur tampilan toko: [Dashboard Affiliate](https://rullzyestorepremium.my.id/affiliate.html)\n` +
                    `💸 Tarik saldo: klik menu *Withdraw*`,
                    { parse_mode: "Markdown", disable_web_page_preview: true }
                );
                break;
            }

            case "menu_withdraw_affiliate": {
                if (!user.isAffiliate) return bot.sendMessage(chatId, "❌ *Akses Ditolak*\n\nKamu belum menjadi Affiliate. Daftar dulu yuk!", { parse_mode: "Markdown" });
                if ((user.affiliateBalance || 0) < 10000) return bot.sendMessage(chatId, `❌ *Saldo Kurang*\n\nMinimal withdraw Rp 10.000\n💰 Saldo kamu: Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}\n\nAjak lebih banyak downline biar saldo cepat terkumpul! 🔥`);
                bot.sendMessage(chatId, `💰 *Saldo Komisi:* Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}\n\n🏦 *Pilih Bank / E-Wallet tujuan:*`, { ...bankKeyboard(0), parse_mode: 'Markdown' });
                break;
            }

            case "menu_retry": {
                if (!cfg.flowixApiKey || !cfg.flowixMerchantId) return bot.sendMessage(chatId, "❌ *PPOB Tidak Aktif*\n\nLayanan PPOB belum dikonfigurasi oleh admin. Silakan hubungi CS.");
                try {
                    const ordersRes = await axios.get(`${FIREBASE_URL}/orders.json`);
                    const all = ordersRes.data ? Object.entries(ordersRes.data).map(([k, v]) => ({ ...v, _id: k })) : [];
                    const myFlowix = all.filter(o => o.telegramChatId === chatId && o.type === 'FLOWIX').sort((a, b) => (a.idDeposit < b.idDeposit ? 1 : -1));
                    const pending = myFlowix.find(o => o.status === 'MENUNGGU_BAYAR');
                    const failed = myFlowix.find(o => o.status === 'GAGAL');
                    const processing = myFlowix.find(o => o.status === 'PROSES_PUSAT');
                    
                    if (pending) {
                        bot.sendMessage(chatId, `⏳ *MENUNGGU PEMBAYARAN*\n\n🔖 *ID:* \`${pending.idDeposit}\`\n📦 *Produk:* ${pending.productName}\n💰 *Total:* Rp ${(pending.displayPrice || 0).toLocaleString('id-ID')}\n\nMohon selesaikan pembayaran agar pesanan segera diproses ✅`, { parse_mode: "Markdown" });
                    } else if (processing) {
                        bot.sendMessage(chatId, `⏳ *SEDANG DIPROSES*\n\n🔖 *ID:* \`${processing.idOrder || processing.idDeposit}\`\n📦 *Produk:* ${processing.productName}\n\nTransaksi kamu sedang berjalan di server pusat. Tunggu notifikasi selanjutnya ya! 🔄`, { parse_mode: "Markdown" });
                    } else if (failed) {
                        bot.sendMessage(chatId, `🔄 *MENGULANG TRANSAKSI GAGAL*\n\n📦 *Produk:* ${failed.productName}\n🎯 *Target:* \`${failed.targetPhone}\`\n💰 *Harga:* Rp ${(failed.displayPrice || 0).toLocaleString('id-ID')}\n\nMembuat ulang pesanan... ⏳`, { parse_mode: "Markdown" });
                        const PORT = process.env.PORT || 3000;
                        const resp = await axios.post(`http://localhost:${PORT}/api/ppob-retry`, {
                            productId: failed.productId,
                            target: failed.targetPhone,
                            productName: failed.productName,
                            displayPrice: failed.displayPrice || 0,
                            randomId: user.randomId
                        });
                        if (resp.data.status) {
                            bot.sendMessage(chatId, `✅ *TRANSAKSI DIULANG!*\n\n🔖 *ID Baru:* \`${resp.data.reff_id}\`\n\nPesananmu sudah masuk antrian. Pantau notifikasi untuk info selanjutnya ✅`, { parse_mode: "Markdown" });
                        } else {
                            bot.sendMessage(chatId, `❌ *GAGAL MENGULANG*\n\n${resp.data.message}\n\nHubungi CS jika masih terkendala.`, { parse_mode: "Markdown" });
                        }
                    } else {
                        const success = myFlowix.find(o => o.status === 'SUKSES');
                        if (success) bot.sendMessage(chatId, "✅ *Semua transaksi terakhirmu berhasil!*\n\nTidak ada transaksi yang perlu diulang 😊", { parse_mode: "Markdown" });
                        else bot.sendMessage(chatId, "📭 *Belum ada riwayat transaksi PPOB.*\n\nSilakan belanja di website kami dulu ya!", { parse_mode: "Markdown" });
                    }
                } catch (e) { bot.sendMessage(chatId, "❌ *Gagal memuat data transaksi.*\n\nCoba lagi nanti ya."); }
                break;
            }

            case "menu_cs":
                bot.sendMessage(chatId, `👨‍💻 *CUSTOMER SERVICE*\n\nAda kendala? Jangan ragu hubungi kami ya!\n\n📞 *WhatsApp:* 085848651208\n💬 *Telegram:* @arulfaathir\n🌐 *Website:* https://rullzyestorepremium.my.id\n\nJam operasional: 08.00 - 22.00 WIB 🕐`, { parse_mode: "Markdown" });
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
                return bot.sendMessage(chatId, "❌ *Nominal tidak valid*\n\nMinimal withdraw Rp 10.000.\nKetik ulang nominalnya ya 😊");
            }
            if (amount > (user.affiliateBalance || 0)) {
                return bot.sendMessage(chatId, `❌ *Saldo tidak cukup*\n\nSaldo komisi kamu: Rp ${(user.affiliateBalance || 0).toLocaleString('id-ID')}\nKetik ulang nominal yang lebih kecil.`);
            }
            if (!account) {
                return bot.sendMessage(chatId, "❌ *Data rekening belum diisi*\n\nContoh format:\n\`\`\`\n50000\n1234567890 a.n Budi\n\`\`\`\nBaris 1: nominal\nBaris 2: no.rek a.n nama");
            }
            state.amount = amount;
            state.account = account;
            state.step = 'confirm';
            await saveUsers(users);
            bot.sendMessage(chatId,
                `📋 *KONFIRMASI WITHDRAW*\n\n` +
                `🏦 *Bank:* ${state.bank}\n` +
                `💰 *Jumlah:* Rp ${amount.toLocaleString('id-ID')}\n` +
                `📝 *Rekening:* \`${account}\`\n\n` +
                `Ketik *YA* untuk konfirmasi, atau *BATAL* untuk membatalkan.`,
                { parse_mode: 'Markdown' }
            );
        } else if (state.step === 'confirm') {
            if (msg.text.toUpperCase() === 'YA') {
                bot.sendMessage(chatId, "⏳ *Memproses permintaan withdraw...*");
                const wdRes = await axios.post(`http://localhost:${process.env.PORT || 3000}/api/affiliate/withdraw`, {
                    randomId: user.randomId,
                    amount: state.amount,
                    bankDetails: `${state.bank} - ${state.account}`
                });
                if (wdRes.data.success) {
                    await notifyWithdrawPending(chatId, { amount: state.amount, bankDetails: `${state.bank} - ${state.account}` });
                    bot.sendMessage(chatId, `✅ *Withdraw Berhasil Diajukan!*\n\n💰 Rp ${state.amount.toLocaleString('id-ID')}\n🏦 ${state.bank} - ${state.account}\n\nAdmin akan memproses dalam 1x24 jam. Pantau terus notifikasinya ya! 😊`);
                } else {
                    bot.sendMessage(chatId, `❌ *Gagal:* ${wdRes.data.message}\n\nCoba lagi atau hubungi CS.`);
                }
            } else {
                bot.sendMessage(chatId, "❌ *Withdraw dibatalkan.*\n\nSilakan menu lagi kapan saja 😊");
            }
            user._wdState = null;
            await saveUsers(users);
        }
    });
}

// ==================== FUNGSI NOTIFIKASI EKSTERNAL ====================
async function sendBroadcast(text) {
    if (!bot) return;
    const store = cfg.storeName || 'Rullzye Store Premium';
    const users = await getUsers();
    let sent = 0;
    for (const u of users) {
        try {
            await bot.sendMessage(u.chatId, `📢 *PENGUMUMAN ${store.toUpperCase()}* 📢\n\n${text}\n\n— *${store}* 💜`, { parse_mode: "Markdown" });
            sent++;
        } catch(e) {}
    }
    console.log(`📢 Broadcast terkirim ke ${sent}/${users.length} user`);
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
    notifyDownlineJoined,
    // Group notifications
    sendToGroup,
    notifyGroupAffiliateNew,
    notifyGroupOrderNew,
    notifyGroupOrderSuccess,
    notifyGroupWithdrawNew,
    notifyGroupWithdrawProcessed,
    notifyGroupReport,
    notifyGroupError,
    notifyGroupCommission,
    notifyGroupPromo,
    notifyGroupStockUpdate,
    notifyGroupBroadcast,
    notifyGroupAdmin,
    notifyGroupAffiliateNews,
    getGroupIds
};
