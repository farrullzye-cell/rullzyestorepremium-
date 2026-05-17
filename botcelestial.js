const axios = require('axios');
const crypto = require('crypto');

const getSignature = (cfg) => {
    return crypto.createHash('md5').update(cfg.celestialApiKey + cfg.celestialSecret).digest('hex');
};

async function checkNickname(cfg, service, target, targetZone) {
    try {
        const res = await axios.post('https://celestialtopup.com/api/v1/cek-nickname', {
            api_key: cfg.celestialApiKey,
            signature: getSignature(cfg),
            sku: service,
            target: target,
            zone_id: targetZone || ""
        });
        
        // Logika pembeda: Jika produk mengandung kata 'PLN' atau 'Listrik'
        const isPLN = service.toLowerCase().includes('pln');

        if (res.data && res.data.success) {
            let name = res.data.data.nickname || res.data.data;
            return { 
                success: true, 
                nickname: name,
                type: isPLN ? 'PELANGGAN PLN' : 'PLAYER NAME' 
            };
        }
        return { success: false, message: res.data.message || "Data tidak ditemukan" };
    } catch (e) {
        return { success: false, message: "Gagal cek ke pusat" };
    }
}

// Fungsi Order tetap sama, tapi dipanggil setelah bayar di Premku sukses
async function placeOrder(cfg, order) {
    try {
        const res = await axios.post('https://celestialtopup.com/api/v1/order', {
            api_key: cfg.celestialApiKey,
            signature: getSignature(cfg),
            ref_id: order.idDeposit, // Kita pakai Invoice Premku sebagai Ref ID
            sku: order.productId,
            target: order.targetPhone,
            zone_id: order.zoneId || ""
        });
        return res.data;
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function checkTrxStatus(cfg, trxId) {
    try {
        const res = await axios.post('https://celestialtopup.com/api/v1/status', {
            api_key: cfg.celestialApiKey,
            signature: getSignature(cfg),
            trx_id: trxId
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

module.exports = { checkNickname, placeOrder, checkTrxStatus };
            
