const axios = require('axios');

/**
 * Fungsi untuk mengambil daftar layanan/produk dari PusatPanelSMM
 * @param {Object} cfg - Data konfigurasi dari config.json
 */
async function getSmmProducts(cfg) {
    try {
        const params = new URLSearchParams();
        params.append('api_key', cfg.smmApiKey);
        params.append('secret_key', cfg.smmSecretKey);
        params.append('action', 'services');

        const res = await axios.post('https://pusatpanelsmm.com/api/json.php', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Pastikan mengembalikan array produk
        if (res.data && res.data.data) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        
        return [];
    } catch (e) {
        console.error("❌ Error SMM Get Products:", e.message);
        return [];
    }
}

/**
 * Fungsi untuk menembak pesanan ke API PusatPanelSMM
 * @param {Object} cfg - Data konfigurasi
 * @param {Object} order - Data orderan dari orders.json
 */
async function placeSmmOrder(cfg, order) {
    try {
        const params = new URLSearchParams();
        params.append('api_key', cfg.smmApiKey);
        params.append('secret_key', cfg.smmSecretKey);
        params.append('action', 'order');
        params.append('service', order.productId);
        params.append('target', order.targetPhone); // Link profil/postingan
        params.append('quantity', order.qty);

        const res = await axios.post('https://pusatpanelsmm.com/api/json.php', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Cek apakah response dari pusat menunjukkan sukses
        // Biasanya PusatPanelSMM mengembalikan { status: true, data: { id: '123' } }
        if (res.data && res.data.status === true) {
            return { status: true, data: res.data.data };
        } else {
            console.error("❌ SMM Center Reject:", res.data ? res.data.message : "Unknown Error");
            return { status: false, message: res.data ? res.data.message : "Gagal ke pusat" };
        }
    } catch (e) {
        console.error("❌ Error SMM Place Order:", e.message);
        return { status: false, message: e.message };
    }
}

/**
 * Fungsi untuk mengecek status pesanan SMM (Opsional)
 * @param {Object} cfg - Data konfigurasi
 * @param {String} trxId - ID Order dari pusat
 */
async function checkSmmStatus(cfg, trxId) {
    try {
        const params = new URLSearchParams();
        params.append('api_key', cfg.smmApiKey);
        params.append('secret_key', cfg.smmSecretKey);
        params.append('action', 'status');
        params.append('order', trxId);

        const res = await axios.post('https://pusatpanelsmm.com/api/json.php', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return res.data;
    } catch (e) {
        console.error("❌ Error SMM Check Status:", e.message);
        return null;
    }
}

// Export fungsi agar bisa di-import di server.js
module.exports = { getSmmProducts, placeSmmOrder, checkSmmStatus };
