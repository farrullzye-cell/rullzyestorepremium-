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
const getTestimonials = async () => { try { const r = await axios.get(`${FIREBASE_URL}/testimonials.json`); return r.data ? (Array.isArray(r.data) ? r.data : Object.values(r.data)) : []; } catch(e) { return []; } };
const saveTestimonials = async (data) => { try { await axios.put(`${FIREBASE_URL}/testimonials.json`, data); } catch(e) {} };

const mainKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🛒 Buka Website Belanja", url: "https://rullzyestorepremium.my.id" }],
            [{ text: "👤 Profil & Saldo", callback_data: "menu_profil" }, { text: "🔑 Cek Random ID", callback_data: "menu_id" }],
            [{ text: "🔄 Ulangi Transaksi Gagal", callback_data: "menu_retry" }, { text: "💬 Chat CS", callback_data: "menu_cs" }]
        ]
    }
};

// ==================== FUNGSI NOTIFIKASI ====================
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

async function notifyGroupOrderNew(order) {
    await sendToGroup('order', `🛒 *ORDER BARU MASUK!*\n\n📦 *Produk:* ${order.productName}\n🎯 *Target:* \`${order.targetPhone || '-'}\`\n💰 *Harga:* Rp ${(order.displayPrice || 0).toLocaleString('id-ID')}\n📊 *Status:* ${order.status}\n👤 *User:* \`${order.randomId || order.targetPhone || '-'}\`\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n⚠️ Segera diproses!`);
}
async function notifyGroupOrderSuccess(order) {
    await sendToGroup('order', `✅ *ORDER SUKSES!*\n\n📦 *Produk:* ${order.productName}\n🎯 *Target:* \`${order.targetPhone || '-'}\`\n💰 *Harga:* Rp ${(order.displayPrice || 0).toLocaleString('id-ID')}\n📝 *Detail:* ${(order.accountDetails || 'Selesai').substring(0, 100)}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\nAlhamdulillah, order berhasil ✅`);
}
async function notifyGroupReport(message) {
    await sendToGroup('report', `📊 *LAPORAN*\n\n${message}`);
}
async function notifyGroupError(errorMsg) {
    await sendToGroup('error', `🚨 *ERROR SISTEM*\n\n${errorMsg}\n⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n⚠️ Segera cek server!`);
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

// ==================== BOT LOGIC ====================
if (bot) {
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
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
                balance: 0
            };
            users.push(user);
            await saveUsers(users);

            let welcomeMsg = `🎉 *SELAMAT DATANG!* 🎉\n\n` +
                             `Halo *${user.firstName}*! Terima kasih sudah bergabung di *${cfg.storeName || 'Rullzye Store Premium'}* 🥳\n\n` +
                             `🔑 *Random ID kamu:* \`${randomId}\`\n\n` +
                             `Gunakan ID di atas setiap kali checkout di website ya! Simpan baik-baik 😉\n\n` +
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
            bot.sendMessage(chatId, `📋 *INFO GRUP*\n\n🆔 *ID Grup:* \`${chatId}\`\n📛 *Nama:* ${msg.chat.title || '-'}\n👥 *Tipe:* ${chatType === 'supergroup' ? 'Supergroup' : 'Group'}\n\n📌 Salin ID di atas dan masukkan ke *Panel Admin → Grup Bot*.`, { parse_mode: 'Markdown' });
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
                `💰 *Saldo:* Rp ${(user.balance || 0).toLocaleString('id-ID')}\n\n` +
                `Gunakan *Random ID* ini setiap checkout di website kami ya!`,
                { parse_mode: "Markdown" }
            );
        } else bot.sendMessage(msg.chat.id, `Halo! Sepertinya kamu belum terdaftar. Ketik /start untuk mendaftar di *${cfg.storeName || 'Rullzye Store Premium'}* 😊`, { parse_mode: "Markdown" });
    });

    // Testimoni conversation state
    const testimoniState = {};
    bot.onText(/\/testimoni(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const existing = match && match[1] ? match[1].trim() : null;
        if (existing) {
            const parts = existing.split('|').map(s => s.trim());
            if (parts.length >= 4) {
                const [name, service, ratingStr, ...textParts] = parts;
                const content = textParts.join('|');
                let testimonials = await getTestimonials();
                const id = 'T-' + Date.now().toString(36).toUpperCase();
                testimonials.push({
                    id, name, service: service||'Produk Digital',
                    rating: Math.min(parseInt(ratingStr)||5,5),
                    content, approved: true,
                    screenshot: msg.photo ? (await bot.getFileLink(msg.photo[msg.photo.length-1].file_id)).catch(()=>'') : '',
                    createdAt: new Date().toISOString()
                });
                await saveTestimonials(testimonials);
                bot.sendMessage(chatId, `✅ *Testimoni berhasil ditambahkan!*\n\n👤 ${name}\n📦 ${service}\n⭐ ${'⭐'.repeat(Math.min(parseInt(ratingStr)||5,5))}\n💬 "${content}"`, { parse_mode: 'Markdown' });
                return;
            }
        }
        testimoniState[chatId] = { step: 'nama' };
        bot.sendMessage(chatId,
            `📝 *Buat Testimoni Baru*\n\nSilakan kirim *Nama* kamu:`,
            { parse_mode: 'Markdown' }
        );
        setTimeout(() => { delete testimoniState[chatId]; }, 120000);
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const users = await getUsers();
        const user = users.find(u => u.chatId === chatId);
        if (!user) return bot.sendMessage(chatId, "Ketik /start dulu.");

        switch (data) {
            case "menu_profil": {
                bot.sendMessage(chatId,
                    `👤 *PROFIL & SALDO*\n\n` +
                    `📝 *Nama:* ${user.firstName}\n` +
                    `🆔 *Random ID:* \`${user.randomId}\`\n` +
                    `💰 *Saldo:* Rp ${(user.balance || 0).toLocaleString('id-ID')}`,
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

    // Gabungan handler untuk testimoni
    bot.on('message', async (msg) => {
        if (!msg.text && !msg.photo) return;
        const chatId = msg.chat.id;

        // ===== CEK TESTIMONI STATE =====
        const tState = testimoniState[chatId];
        if (tState) {
            if (tState.step === 'nama') {
                tState.nama = msg.text.trim();
                tState.step = 'layanan';
                return bot.sendMessage(chatId, `👤 Nama: *${tState.nama}*\n\nSekarang, kirim *Layanan* yang dibeli (contoh: Top Up ML, Netflix, Panel):`, { parse_mode: 'Markdown' });
            } else if (tState.step === 'layanan') {
                tState.layanan = msg.text.trim();
                tState.step = 'rating';
                return bot.sendMessage(chatId, `📦 Layanan: *${tState.layanan}*\n\nKirim *Rating* (1-5):`, { parse_mode: 'Markdown' });
            } else if (tState.step === 'rating') {
                const rating = parseInt(msg.text);
                if (isNaN(rating) || rating < 1 || rating > 5) return bot.sendMessage(chatId, '❌ Rating harus angka 1-5. Coba lagi:');
                tState.rating = rating;
                tState.step = 'teks';
                return bot.sendMessage(chatId, `⭐ Rating: *${'⭐'.repeat(rating)}*\n\nSekarang kirim *Teks testimoni* (pengalaman kamu):`, { parse_mode: 'Markdown' });
            } else if (tState.step === 'teks') {
                tState.teks = msg.text ? msg.text.trim() : '';
                tState.step = 'foto';
                return bot.sendMessage(chatId, `💬 Teks: *${tState.teks.substring(0,50)}${tState.teks.length>50?'...':''}*\n\nTerakhir, kirim *Screenshot* (opsional) atau ketik *skip* jika tidak ada:`, { parse_mode: 'Markdown' });
            } else if (tState.step === 'foto') {
                let screenshot = '';
                if (msg.photo) {
                    try { screenshot = await bot.getFileLink(msg.photo[msg.photo.length-1].file_id); } catch(e) {}
                } else if (msg.text && msg.text.toLowerCase() === 'skip') {}
                else return bot.sendMessage(chatId, '❌ Kirim foto screenshot atau ketik *skip*:', { parse_mode: 'Markdown' });
                let testimonials = await getTestimonials();
                const id = 'T-' + Date.now().toString(36).toUpperCase();
                testimonials.push({ id, name: tState.nama, service: tState.layanan, rating: tState.rating, content: tState.teks, approved: true, screenshot, createdAt: new Date().toISOString() });
                await saveTestimonials(testimonials);
                delete testimoniState[chatId];
                return bot.sendMessage(chatId, `✅ *Testimoni berhasil ditambahkan!* Terima kasih 🎉\n\n👤 *${tState.nama}*\n📦 ${tState.layanan}\n⭐ ${'⭐'.repeat(tState.rating)}\n💬 "${tState.teks}"${screenshot ? '\n📸 + Screenshot' : ''}`, { parse_mode: 'Markdown' });
            }
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
        if (!u.chatId) continue;
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
    notifyOrderSuccess,
    notifyOrderFailed,
    notifyOrderProcessing,
    notifyPaymentReceived,
    // Group notifications
    sendToGroup,
    notifyGroupOrderNew,
    notifyGroupOrderSuccess,
    notifyGroupReport,
    notifyGroupError,
    notifyGroupPromo,
    notifyGroupStockUpdate,
    notifyGroupBroadcast,
    notifyGroupAdmin,
    getGroupIds
};
