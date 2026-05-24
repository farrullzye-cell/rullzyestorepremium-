// anti_fraud.js — Sistem Anti Fraud & Keamanan Affiliate
const crypto = require('crypto');

// ================= IN-MEMORY STORAGE =================
const tokens = new Map();       // token -> { randomId, ip, ua, createdAt }
const rateLimitStore = new Map(); // ip:endpoint -> { count, resetAt }
const ipUserMap = new Map();    // ip -> Set<randomId>
const dailyWdCount = new Map(); // randomId:YYYY-MM-DD -> count

// Konfigurasi
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;
const WD_COOLDOWN_HOURS = 24;
const MAX_COMMISSION_PER_TX = 50000;
const MIN_ORDER_FOR_COMMISSION = 10000;
const NEW_AFFILIATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ================= TOKEN MANAGEMENT =================
function generateToken(randomId, ip, ua) {
    const token = crypto.randomBytes(32).toString('hex');
    tokens.set(token, { randomId, ip, ua, createdAt: Date.now() });
    // Bersihkan token expired
    cleanupTokens();
    return token;
}

function verifyToken(token, ip) {
    if (!token || !tokens.has(token)) return null;
    const data = tokens.get(token);
    if (Date.now() - data.createdAt > TOKEN_EXPIRY_MS) {
        tokens.delete(token);
        return null;
    }
    // Optional: verify IP (tidak strict karena IP bisa berubah)
    return data;
}

function revokeToken(token) {
    tokens.delete(token);
}

function revokeUserTokens(randomId) {
    for (const [token, data] of tokens) {
        if (data.randomId === randomId) tokens.delete(token);
    }
}

function cleanupTokens() {
    const now = Date.now();
    for (const [token, data] of tokens) {
        if (now - data.createdAt > TOKEN_EXPIRY_MS) tokens.delete(token);
    }
}

// ================= RATE LIMITER =================
function checkRateLimit(key) {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ================= IP TRACKING =================
function trackUserIP(ip, randomId) {
    if (!ipUserMap.has(ip)) {
        ipUserMap.set(ip, new Set());
    }
    ipUserMap.get(ip).add(randomId);
}

function getAccountsOnIP(ip) {
    return ipUserMap.get(ip) ? Array.from(ipUserMap.get(ip)) : [];
}

function getIPForUser(randomId) {
    for (const [ip, users] of ipUserMap) {
        if (users.has(randomId)) return ip;
    }
    return null;
}

// ================= FRAUD DETECTION =================
function detectFraud(users, buyerRandomId, uplineRandomId, buyerIP) {
    const issues = [];

    // Self-referral
    if (buyerRandomId === uplineRandomId) {
        issues.push('SELF_REFERRAL');
    }

    // Circular referral: cek apakah upline juga direfer oleh buyer
    const buyer = users.find(u => u.randomId === buyerRandomId);
    const upline = users.find(u => u.randomId === uplineRandomId);
    if (buyer && upline) {
        if (buyer.referredBy && upline.randomId === buyer.referredBy) {
            // Ini normal (upline merefer buyer), tapi cek reverse
            if (upline.referredBy === buyerRandomId) {
                issues.push('CIRCULAR_REFERRAL');
            }
        }
    }

    // Multiple accounts on same IP
    if (buyerIP) {
        const accountsOnIP = getAccountsOnIP(buyerIP);
        if (accountsOnIP.length >= 3) {
            issues.push('MULTI_ACCOUNT_IP');
        }
    }

    return issues;
}

function checkWDCooldown(randomId) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${randomId}:${today}`;
    const count = dailyWdCount.get(key) || 0;
    return count;
}

function incrementWDCount(randomId) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${randomId}:${today}`;
    dailyWdCount.set(key, (dailyWdCount.get(key) || 0) + 1);
}

function checkNewAffiliateCooldown(user) {
    if (!user.affiliateApprovedAt) return false;
    const approved = new Date(user.affiliateApprovedAt).getTime();
    return (Date.now() - approved) < NEW_AFFILIATE_COOLDOWN_MS;
}

// ================= COMMISSION SAFEGUARDS =================
function calculateCommission(profit, commissionPct, user) {
    let raw = Math.floor((parseInt(profit) * parseInt(commissionPct)) / 100);
    // Cap max komisi per transaksi
    if (raw > MAX_COMMISSION_PER_TX) raw = MAX_COMMISSION_PER_TX;
    // Minimum komisi
    if (raw < 100) raw = 0;
    return raw;
}

function isOrderEligibleForCommission(order) {
    const price = parseInt(order.displayPrice || order.resellerProfit || 0);
    return price >= MIN_ORDER_FOR_COMMISSION;
}

// ================= AUDIT LOG =================
async function addAuditLog(action, data, saveFn) {
    try {
        const log = {
            id: 'AUDIT-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
            action,
            data,
            ip: data.ip || '',
            timestamp: new Date().toISOString()
        };
        await saveFn(log);
        return log;
    } catch(e) {
        console.error('[AUDIT] Error:', e.message);
    }
}

// ================= MIDDLEWARE =================
function authMiddleware(req, res, next) {
    const token = req.headers['x-auth-token'];
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const session = verifyToken(token, ip);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid. Silakan login ulang.', code: 'TOKEN_INVALID' });
    }
    req.userSession = session;
    next();
}

function rateLimitMiddleware(keyPrefix) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
        const key = `${ip}:${keyPrefix || req.path}`;
        const result = checkRateLimit(key);
        if (!result.allowed) {
            return res.status(429).json({
                success: false,
                message: `Terlalu banyak permintaan. Coba lagi dalam ${result.resetIn} detik.`,
                code: 'RATE_LIMITED'
            });
        }
        next();
    };
}

// ================= CLEANUP =================
function cleanupRateLimitStore() {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}

// ================= EXPORTS =================
module.exports = {
    generateToken,
    verifyToken,
    revokeToken,
    revokeUserTokens,
    checkRateLimit,
    rateLimitMiddleware,
    authMiddleware,
    trackUserIP,
    getAccountsOnIP,
    getIPForUser,
    detectFraud,
    checkWDCooldown,
    incrementWDCount,
    checkNewAffiliateCooldown,
    calculateCommission,
    isOrderEligibleForCommission,
    addAuditLog,
    cleanupRateLimitStore,
    rateLimitStore,
    MAX_COMMISSION_PER_TX,
    MIN_ORDER_FOR_COMMISSION,
    NEW_AFFILIATE_COOLDOWN_MS,
    WD_COOLDOWN_HOURS
};
