// anti_fraud.js — Rate Limiter & Keamanan
const crypto = require('crypto');

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;

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

function cleanupRateLimitStore() {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}

module.exports = {
    checkRateLimit,
    rateLimitMiddleware,
    cleanupRateLimitStore,
    rateLimitStore
};
