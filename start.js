const axios = require('axios');
const fs = require('fs');
const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

(async () => {
    try {
        console.log("🔄 Mengambil konfigurasi dari Database...");
        const res = await axios.get(`${FIREBASE_URL}/system_config.json`);
        if (res.data && Object.keys(res.data).length > 0) {
            fs.writeFileSync('./config.json', JSON.stringify(res.data, null, 2));
            console.log("✅ Konfigurasi berhasil dimuat dari Database.");
        } else {
            console.log("⚠️ Database kosong, menggunakan config.json lokal.");
        }
    } catch(e) {
        console.log("⚠️ Gagal mengambil config dari DB. Menggunakan config lokal.");
    }
    
    // Mulai server utama
    require('./server.js');
})();
