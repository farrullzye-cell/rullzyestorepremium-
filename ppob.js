// ppob.js
const axios = require('axios');
const BASE_URL = 'https://flowix.web.id/api/v1';

function getHeaders(apiKey, merchantId) {
    return {
        'Content-Type': 'application/json',
        'api_key': apiKey,
        'merchant_id': merchantId
    };
}

async function healthCheck(apiKey, merchantId) {
    try {
        const res = await axios.get(`${BASE_URL}/health`, { headers: getHeaders(apiKey, merchantId) });
        return res.data;
    } catch (err) { return { success: false, message: err.message }; }
}

async function getProducts(apiKey, merchantId, category = 'prepaid') {
    try {
        const res = await axios.get(`${BASE_URL}/product?category=${category}`, { headers: getHeaders(apiKey, merchantId) });
        return res.data;
    } catch (err) { return { success: false, message: err.message }; }
}

/**
 * Membuat tiket deposit (QRIS).
 * fee_by_customer = true → biaya admin ditanggung pembeli (amount_total = amount + fee).
 */
async function createDeposit(apiKey, merchantId, amount, method_code = 'QRIS', fee_by_customer = true) {
    try {
        const payload = { amount, method_code, fee_by_customer };
        console.log('[PPOB] createDeposit request:', JSON.stringify(payload));
        const res = await axios.post(`${BASE_URL}/deposit`, payload, { headers: getHeaders(apiKey, merchantId) });
        console.log('[PPOB] createDeposit response:', JSON.stringify(res.data).substring(0, 400));
        return res.data;
    } catch (err) {
        const data = err.response?.data;
        console.error('[PPOB] createDeposit error:', data || err.message);
        return { success: false, message: data?.message || err.message };
    }
}

/** Cek status deposit (pakai reff_id dari Flowix) */
async function checkDeposit(apiKey, merchantId, reff_id) {
    try {
        console.log('[PPOB] checkDeposit:', reff_id);
        const res = await axios.get(`${BASE_URL}/deposit/${reff_id}`, { headers: getHeaders(apiKey, merchantId) });
        console.log('[PPOB] checkDeposit response:', JSON.stringify(res.data).substring(0, 400));
        return res.data;
    } catch (err) {
        const data = err.response?.data;
        console.error('[PPOB] checkDeposit error:', data || err.message);
        return { success: false, message: data?.message || err.message };
    }
}

async function cancelDeposit(apiKey, merchantId, reff_id) {
    try {
        const res = await axios.post(`${BASE_URL}/deposit/${reff_id}/cancel`, {}, { headers: getHeaders(apiKey, merchantId) });
        return res.data;
    } catch (err) { return { success: false, message: err.message }; }
}

/**
 * Membeli produk langsung (pakai saldo admin).
 * Parameter: service_code (kode produk), target (nomor tujuan).
 * Response sukses: { data: { reff_id, status, sn, price, balance_left } }
 */
async function createTransaction(apiKey, merchantId, service_code, target, options = {}) {
    try {
        const payload = { service_code, target, ...options };
        console.log('[PPOB] createTransaction request:', JSON.stringify(payload));
        const res = await axios.post(`${BASE_URL}/product`, payload, { headers: getHeaders(apiKey, merchantId) });
        console.log('[PPOB] createTransaction response:', JSON.stringify(res.data).substring(0, 400));
        return res.data;
    } catch (err) {
        const data = err.response?.data;
        console.error('[PPOB] createTransaction error:', data || err.message);
        return { success: false, message: data?.message || err.message };
    }
}

/** Cek status transaksi (pakai reff_id dari createTransaction) */
async function checkTransaction(apiKey, merchantId, reff_id) {
    try {
        console.log('[PPOB] checkTransaction:', reff_id);
        const res = await axios.get(`${BASE_URL}/product/${reff_id}`, { headers: getHeaders(apiKey, merchantId) });
        console.log('[PPOB] checkTransaction response:', JSON.stringify(res.data).substring(0, 400));
        return res.data;
    } catch (err) {
        return { success: false, message: err.message };
    }
}

module.exports = { healthCheck, getProducts, createDeposit, checkDeposit, cancelDeposit, createTransaction, checkTransaction };
