const axios = require('axios');
const crypto = require('crypto');

const FIREBASE_URL = "https://rullzyestorepremium-default-rtdb.asia-southeast1.firebasedatabase.app/Rullzye_Secret_DB_99";

// ============ HELPER: Firebase CRUD ============
const fbGet = async (path) => { try { const r = await axios.get(`${FIREBASE_URL}/${path}`); return r.data; } catch(e) { return null; } };
const fbPut = async (path, data) => { try { await axios.put(`${FIREBASE_URL}/${path}`, data); } catch(e) {} };

// Array helpers (Firebase stores arrays as objects with numeric keys)
const getArray = async (path) => { const d = await fbGet(path); return d ? (Array.isArray(d) ? d : Object.values(d)) : []; };
const saveArray = async (path, data) => { await fbPut(path, data); };

// ============ DATA ACCESS ============
const getResellers = () => getArray('resellers.json');
const saveResellers = (d) => saveArray('resellers.json', d);
const getLevels = async () => { const d = await fbGet('reseller_levels.json'); return d || { starter: { minSales: 0 }, silver: { minSales: 2500000 }, gold: { minSales: 10000000 }, platinum: { minSales: 30000000 }, diamond: { minSales: 75000000 } }; };
const saveLevels = (d) => fbPut('reseller_levels.json', d);
const getPrices = async () => { const d = await fbGet('reseller_prices.json'); return d || {}; };
const savePrices = (d) => fbPut('reseller_prices.json', d);
const getWithdrawals = () => getArray('withdraws.json');
const saveWithdrawals = (d) => saveArray('withdraws.json', d);
const getReferrals = async () => { const d = await fbGet('referrals.json'); return d || {}; };
const saveReferrals = (d) => fbPut('referrals.json', d);
const getBanks = async () => { const d = await fbGet('banks.json'); return d || DEFAULT_BANKS; };
const saveBanks = (d) => fbPut('banks.json', d);
const getStoreReviews = () => getArray('store_reviews.json');
const saveStoreReviews = (d) => saveArray('store_reviews.json', d);
const getNotifs = () => getArray('reseller_notifications.json');
const saveNotifs = (d) => saveArray('reseller_notifications.json', d);

const LEVEL_ORDER = ['starter', 'silver', 'gold', 'platinum', 'diamond'];

const DEFAULT_BANKS = [
  { code: 'BCA', name: 'Bank Central Asia' },
  { code: 'MANDIRI', name: 'Bank Mandiri' },
  { code: 'BRI', name: 'Bank Rakyat Indonesia' },
  { code: 'BNI', name: 'Bank Negara Indonesia' },
  { code: 'BTN', name: 'Bank Tabungan Negara' },
  { code: 'BSI', name: 'Bank Syariah Indonesia' },
  { code: 'SEABANK', name: 'Bank Seabank Indonesia' },
  { code: 'JAGO', name: 'Bank Jago' },
  { code: 'NEO', name: 'Bank Neo Commerce' },
  { code: 'BLU', name: 'Bank Blu' },
  { code: 'ALLO', name: 'Bank Allo' },
  { code: 'ALADIN', name: 'Bank Aladin Syariah' },
  { code: 'OCBC', name: 'Bank OCBC NISP' },
  { code: 'DBS', name: 'Bank DBS Indonesia' },
  { code: 'PERMATA', name: 'Bank Permata' },
  { code: 'DANAMON', name: 'Bank Danamon' },
  { code: 'MEGA', name: 'Bank Mega' },
  { code: 'MUAMALAT', name: 'Bank Muamalat' },
  { code: 'PANIN', name: 'Bank Panin' },
  { code: 'CIMB', name: 'Bank CIMB Niaga' },
  { code: 'MAYBANK', name: 'Bank Maybank Indonesia' },
  { code: 'HSBC', name: 'Bank HSBC Indonesia' },
  { code: 'UOB', name: 'Bank UOB Indonesia' },
  { code: 'BJB', name: 'Bank BJB' },
  { code: 'DKI', name: 'Bank DKI' },
  { code: 'JATIM', name: 'Bank Jatim' },
  { code: 'JATENG', name: 'Bank Jateng' },
  { code: 'NAGARI', name: 'Bank Nagari' },
  { code: 'ACEH', name: 'Bank Aceh' },
  { code: 'BUKOPIN', name: 'Bank Bukopin' },
  { code: 'VICTORIA', name: 'Bank Victoria' },
  { code: 'SINARMAS', name: 'Bank Sinarmas' },
  { code: 'ARTHA', name: 'Bank Artha Graha' },
  { code: 'MASPION', name: 'Bank Maspion' },
  { code: 'GANA', name: 'Bank Ganesha' },
  { code: 'NOBU', name: 'Bank National Nobu' },
  { code: 'BISNIS', name: 'Bank Bisnis Indonesia' },
  { code: 'AMAR', name: 'Bank Amar Indonesia' },
  { code: 'KESEJAHTERAAN', name: 'Bank Kesejahteraan Ekonomi' },
  { code: 'ANTARDAERAH', name: 'Bank Antardaerah' },
  { code: 'SAHABAT', name: 'Bank Sahabat Sampoerna' },
  { code: 'CNB', name: 'Bank CIMB Niaga Auto Finance' },
  { code: 'ROYAL', name: 'Bank Royal Indonesia' },
  { code: 'INDEX', name: 'Bank Index Selindo' },
  { code: 'MUTIARA', name: 'Bank Mutiara' },
  { code: 'PUNDI', name: 'Bank Pundi Indonesia' },
  { code: 'CAPITAL', name: 'Bank Capital Indonesia' },
  { code: 'HARDA', name: 'Bank Harda Internasional' },
  { code: 'ICBC', name: 'Bank ICBC Indonesia' },
  { code: 'CHINACON', name: 'Bank China Construction Bank' },
  { code: 'MIZUHO', name: 'Bank Mizuho Indonesia' },
  { code: 'MUFG', name: 'Bank MUFG Indonesia' },
  { code: 'TOKYO', name: 'Bank Tokyo Mitsubishi UFJ' },
];

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RULL';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function generateId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = prefix || '';
  for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function calculateLevel(totalSales, levels) {
  let current = 'starter';
  for (const lv of LEVEL_ORDER) {
    if (totalSales >= (levels[lv]?.minSales || 0)) current = lv;
  }
  return current;
}

function getNextLevel(currentLevel) {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  if (idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

function adminAuth(req, res, next) {
  const { username, pin } = parseAuthHeader(req.headers['x-admin-auth']);
  const admin = verifyAdmin(username, pin);
  if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });
  req.admin = admin;
  next();
}

function parseAuthHeader(header) {
  if (!header || !header.includes(':')) return { username: '', pin: header || '' };
  const parts = header.split(':');
  return { username: parts[0], pin: parts.slice(1).join(':') };
}

function verifyAdmin(username, pin) {
  try {
    const cfg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'config.json')));
    const sa = cfg.superAdmin || {};
    if (sa.pin && sa.username && username === sa.username && pin === sa.pin) return { role: 'super_admin', username: sa.username, permissions: 'all' };
    if (cfg.admins && Array.isArray(cfg.admins)) {
      const admin = cfg.admins.find(a => a.username === username && a.pin === pin && a.active !== false);
      if (admin) return { role: 'admin', username: admin.username, permissions: admin.permissions || [] };
    }
  } catch(e) {}
  return null;
}

// ============ INIT: register all routes ============
function initResellerSystem(app) {

  // ========== PUBLIC: Reseller Profile ==========
  app.post('/api/reseller/register', async (req, res) => {
    try {
      const { randomId, displayName, googleEmail, photoURL, sponsorRefCode } = req.body;
      if (!randomId || !displayName) return res.json({ success: false, message: 'Data tidak lengkap' });

      let resellers = await getResellers();
      if (resellers.find(r => r.randomId === randomId)) {
        return res.json({ success: true, message: 'Reseller sudah ada', reseller: resellers.find(r => r.randomId === randomId) });
      }

      let referralCode = generateReferralCode();
      while (resellers.find(r => r.referralCode === referralCode)) referralCode = generateReferralCode();

      const levels = await getLevels();
      const reseller = {
        randomId,
        displayName: displayName || 'User',
        googleEmail: googleEmail || '',
        photoURL: photoURL || '',
        referralCode,
        sponsorRefCode: sponsorRefCode || null,
        level: 'starter',
        totalSales: 0,
        totalOrders: 0,
        depositBalance: 0,
        commissionBalance: 0,
        totalReferrals: 0,
        totalWithdrawn: 0,
        status: 'active',
        storeUsername: '',
        storeBanner: '',
        storeBio: '',
        storeLogo: photoURL || '',
        storeWhatsapp: '',
        storeInstagram: '',
        storeTelegram: '',
        storeTiktok: '',
        storeWebsite: '',
        storeTheme: 'dark',
        bankName: '',
        bankAccount: '',
        bankHolder: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      resellers.push(reseller);
      await saveResellers(resellers);

      // Track referral if sponsor code provided
      if (sponsorRefCode) {
        const refs = await getReferrals();
        if (refs[sponsorRefCode]) {
          refs[sponsorRefCode].referrals.push({
            randomId,
            displayName,
            joinedAt: new Date().toISOString(),
            totalOrders: 0,
            totalEarned: 0
          });
          refs[sponsorRefCode].count = refs[sponsorRefCode].referrals.length;
          await saveReferrals(refs);

          // Update sponsor's totalReferrals count
          const sponsorRandomId = refs[sponsorRefCode].sponsorRandomId;
          const sponsor = resellers.find(r => r.randomId === sponsorRandomId);
          if (sponsor) {
            sponsor.totalReferrals = refs[sponsorRefCode].count;
            await saveResellers(resellers);
          }
        }
      }

      res.json({ success: true, message: 'Reseller berhasil dibuat', reseller });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/profile', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, message: 'Parameter randomId diperlukan' });
      const resellers = await getResellers();
      const r = resellers.find(x => x.randomId === randomId);
      if (!r) return res.json({ success: false, message: 'Reseller tidak ditemukan' });
      res.json({ success: true, reseller: r });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.put('/api/reseller/profile', async (req, res) => {
    try {
      const { randomId, ...updates } = req.body;
      if (!randomId) return res.json({ success: false, message: 'Parameter randomId diperlukan' });

      const allowed = ['displayName', 'photoURL', 'storeUsername', 'storeBanner', 'storeBio', 'storeLogo',
        'storeWhatsapp', 'storeInstagram', 'storeTelegram', 'storeTiktok', 'storeWebsite', 'storeTheme',
        'bankName', 'bankAccount', 'bankHolder'];

      let resellers = await getResellers();
      const idx = resellers.findIndex(x => x.randomId === randomId);
      if (idx === -1) return res.json({ success: false, message: 'Reseller tidak ditemukan' });

      for (const key of allowed) {
        if (updates[key] !== undefined) resellers[idx][key] = updates[key];
      }
      resellers[idx].updatedAt = new Date().toISOString();

      // Check storeUsername uniqueness
      if (updates.storeUsername) {
        const dup = resellers.find((x, i) => i !== idx && x.storeUsername === updates.storeUsername);
        if (dup) return res.json({ success: false, message: 'Username toko sudah digunakan' });
        resellers[idx].storeUsername = updates.storeUsername;
      }

      await saveResellers(resellers);
      res.json({ success: true, message: 'Profil diperbarui', reseller: resellers[idx] });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== LEVELS ==========
  app.get('/api/reseller/levels', async (req, res) => {
    try {
      const levels = await getLevels();
      res.json({ success: true, levels });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/level-progress', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, message: 'Parameter randomId diperlukan' });
      const resellers = await getResellers();
      const r = resellers.find(x => x.randomId === randomId);
      if (!r) return res.json({ success: false, message: 'Reseller tidak ditemukan' });

      const levels = await getLevels();
      const currentLevel = r.level;
      const currentIdx = LEVEL_ORDER.indexOf(currentLevel);
      const nextLevel = getNextLevel(currentLevel);
      const nextSales = nextLevel ? (levels[nextLevel]?.minSales || 0) : r.totalSales;
      const currentMin = levels[currentLevel]?.minSales || 0;
      const progress = nextLevel ? Math.min(100, Math.round(((r.totalSales - currentMin) / (nextSales - currentMin)) * 100)) : 100;

      res.json({ success: true, currentLevel, nextLevel, totalSales: r.totalSales, nextSales, progress, levelOrder: LEVEL_ORDER });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== PRODUCT PRICING ==========
  app.get('/api/reseller/prices', async (req, res) => {
    try {
      const prices = await getPrices();
      const levels = await getLevels();
      res.json({ success: true, prices, levels, levelOrder: LEVEL_ORDER });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/product-price', async (req, res) => {
    try {
      const { productId, level } = req.query;
      if (!productId) return res.json({ success: false, message: 'Parameter productId diperlukan' });
      const prices = await getPrices();
      const lv = level || 'starter';
      const price = prices[productId]?.[lv];
      res.json({ success: true, price, level: lv });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== WITHDRAW ==========
  app.post('/api/reseller/withdraw', async (req, res) => {
    try {
      const { randomId, bankName, bankAccount, bankHolder, nominal } = req.body;
      if (!randomId || !bankName || !bankAccount || !bankHolder || !nominal) {
        return res.json({ success: false, message: 'Data tidak lengkap' });
      }
      if (nominal < 10000) return res.json({ success: false, message: 'Minimal withdraw Rp10.000' });

      let resellers = await getResellers();
      const r = resellers.find(x => x.randomId === randomId);
      if (!r) return res.json({ success: false, message: 'Reseller tidak ditemukan' });
      if (r.commissionBalance < nominal) return res.json({ success: false, message: 'Saldo komisi tidak mencukupi' });

      let withdraws = await getWithdrawals();
      const wd = {
        id: generateId('WTH-'),
        randomId,
        bankName,
        bankAccount,
        bankHolder,
        nominal,
        status: 'pending',
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      withdraws.push(wd);
      await saveWithdrawals(withdraws);

      // Freeze commission (deduct but mark as pending)
      r.commissionBalance -= nominal;
      r.updatedAt = new Date().toISOString();
      await saveResellers(resellers);

      // Add notification
      let notifs = await getNotifs();
      notifs.push({
        id: generateId('NOTIF-'),
        randomId,
        type: 'withdraw',
        title: 'Withdraw Diproses',
        message: `Permintaan withdraw Rp${nominal.toLocaleString('id-ID')} ke ${bankName} a.n. ${bankHolder} sedang diproses admin.`,
        read: false,
        createdAt: new Date().toISOString()
      });
      await saveNotifs(notifs);

      res.json({ success: true, message: 'Permintaan withdraw dikirim', withdraw: wd });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/withdraw/history', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, items: [] });
      let withdraws = await getWithdrawals();
      const items = withdraws.filter(w => w.randomId === randomId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({ success: true, items });
    } catch(e) { res.json({ success: false, items: [] }); }
  });

  // ========== REFERRAL ==========
  app.get('/api/referral/info', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) return res.json({ success: false, message: 'Kode referral diperlukan' });
      const refs = await getReferrals();
      if (!refs[code]) return res.json({ success: false, message: 'Kode referral tidak valid' });
      const resellers = await getResellers();
      const sponsor = resellers.find(r => r.randomId === refs[code].sponsorRandomId);
      res.json({ success: true, sponsor: sponsor ? { displayName: sponsor.displayName, photoURL: sponsor.photoURL, storeUsername: sponsor.storeUsername } : null, code });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/referral/stats', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, referrals: [], totalEarnings: 0, totalCount: 0 });
      const refs = await getReferrals();
      const resellers = await getResellers();
      const r = resellers.find(x => x.randomId === randomId);
      if (!r) return res.json({ success: false, message: 'Reseller tidak ditemukan' });

      const myRef = refs[r.referralCode];
      // Also find if this user was referred by someone
      const sponsorInfo = r.sponsorRefCode && refs[r.sponsorRefCode] ? refs[r.sponsorRefCode] : null;
      let sponsorData = null;
      if (sponsorInfo) {
        const sp = resellers.find(x => x.randomId === sponsorInfo.sponsorRandomId);
        if (sp) sponsorData = { displayName: sp.displayName, storeUsername: sp.storeUsername, referralCode: sp.referralCode };
      }

      res.json({
        success: true,
        myReferralCode: r.referralCode,
        totalEarnings: myRef?.earnings || 0,
        totalCount: myRef?.count || 0,
        referrals: myRef?.referrals || [],
        sponsor: sponsorData
      });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== STORE ==========
  app.get('/api/store/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const resellers = await getResellers();
      const r = resellers.find(x => x.storeUsername === username);
      if (!r) return res.status(404).json({ success: false, message: 'Toko tidak ditemukan' });

      res.json({
        success: true,
        store: {
          displayName: r.displayName,
          photoURL: r.photoURL,
          storeBanner: r.storeBanner,
          storeBio: r.storeBio,
          storeLogo: r.storeLogo,
          storeWhatsapp: r.storeWhatsapp,
          storeInstagram: r.storeInstagram,
          storeTelegram: r.storeTelegram,
          storeTiktok: r.storeTiktok,
          storeWebsite: r.storeWebsite,
          storeTheme: r.storeTheme,
          level: r.level,
          totalSales: r.totalSales,
          totalOrders: r.totalOrders,
          referralCode: r.referralCode,
          createdAt: r.createdAt,
          randomId: r.randomId
        }
      });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/store/:username/products', async (req, res) => {
    try {
      const { username } = req.params;
      const resellers = await getResellers();
      const r = resellers.find(x => x.storeUsername === username);
      if (!r) return res.status(404).json({ success: false, message: 'Toko tidak ditemukan' });

      // Fetch products from Premku API (same pattern as main /api/products)
      const cfg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'config.json')));
      const prRes = await axios.post('https://premku.com/api/products', { api_key: cfg.apiKey });
      const premkuProducts = prRes.data?.products || [];

      const prices = await getPrices();
      const level = r.level;
      const profit = parseInt(cfg.profit || 2000);
      const products = premkuProducts.map(p => {
        const productId = `PREMKU-${p.id}`;
        const levelPrice = prices[productId]?.[level];
        const basePrice = parseInt(p.price) + profit;
        return {
          id: productId,
          name: p.name || 'Produk',
          category: p.category || 'Umum',
          price: levelPrice || basePrice,
          originalPrice: basePrice,
          stock: parseInt(p.stock) || 0,
          description: p.description || '',
          image: p.image || '',
          level: level
        };
      });

      res.json({ success: true, products, storeName: r.displayName });
    } catch(e) { res.json({ success: false, products: [], message: e.message }); }
  });

  app.post('/api/store/:username/review', async (req, res) => {
    try {
      const { username } = req.params;
      const { reviewerName, rating, content } = req.body;
      if (!reviewerName || !rating || !content) return res.json({ success: false, message: 'Data tidak lengkap' });

      const resellers = await getResellers();
      const r = resellers.find(x => x.storeUsername === username);
      if (!r) return res.json({ success: false, message: 'Toko tidak ditemukan' });

      let reviews = await getStoreReviews();
      const review = {
        id: generateId('REV-'),
        storeUsername: username,
        reviewerName,
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        content,
        createdAt: new Date().toISOString()
      };
      reviews.push(review);
      await saveStoreReviews(reviews);
      res.json({ success: true, message: 'Review berhasil dikirim', review });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/store/:username/reviews', async (req, res) => {
    try {
      const { username } = req.params;
      let reviews = await getStoreReviews();
      const items = reviews.filter(r => r.storeUsername === username).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({ success: true, reviews: items });
    } catch(e) { res.json({ success: false, reviews: [] }); }
  });

  // ========== STORE REDIRECT ==========
  app.get('/store/:username', (req, res) => {
    res.redirect('/store.html?username=' + encodeURIComponent(req.params.username));
  });

  // ========== NOTIFICATIONS ==========
  app.get('/api/reseller/notifications', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, items: [] });
      let notifs = await getNotifs();
      const items = notifs.filter(n => n.randomId === randomId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
      res.json({ success: true, items });
    } catch(e) { res.json({ success: false, items: [] }); }
  });

  app.post('/api/reseller/notifications/read', async (req, res) => {
    try {
      const { randomId, notifId } = req.body;
      let notifs = await getNotifs();
      if (notifId) {
        const n = notifs.find(x => x.id === notifId && x.randomId === randomId);
        if (n) n.read = true;
      } else {
        notifs.forEach(n => { if (n.randomId === randomId) n.read = true; });
      }
      await saveNotifs(notifs);
      res.json({ success: true });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.get('/api/reseller/notifications/unread', async (req, res) => {
    try {
      const { randomId } = req.query;
      if (!randomId) return res.json({ success: false, count: 0 });
      let notifs = await getNotifs();
      const count = notifs.filter(n => n.randomId === randomId && !n.read).length;
      res.json({ success: true, count });
    } catch(e) { res.json({ success: false, count: 0 }); }
  });

  // ========== ADMIN: Resellers ==========
  app.get('/api/admin/resellers', async (req, res) => {
    try {
      const resellers = await getResellers();
      res.json({ success: true, resellers });
    } catch(e) { res.json({ success: false, resellers: [] }); }
  });

  app.get('/api/admin/reseller/:randomId', async (req, res) => {
    try {
      const resellers = await getResellers();
      const r = resellers.find(x => x.randomId === req.params.randomId);
      if (!r) return res.json({ success: false, message: 'Reseller tidak ditemukan' });
      res.json({ success: true, reseller: r });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.put('/api/admin/reseller/:randomId', async (req, res) => {
    try {
      const allowed = ['level', 'status', 'depositBalance', 'commissionBalance', 'totalSales', 'totalOrders', 'displayName', 'notes'];
      let resellers = await getResellers();
      const idx = resellers.findIndex(x => x.randomId === req.params.randomId);
      if (idx === -1) return res.json({ success: false, message: 'Reseller tidak ditemukan' });

      for (const key of allowed) {
        if (req.body[key] !== undefined) resellers[idx][key] = req.body[key];
      }
      resellers[idx].updatedAt = new Date().toISOString();
      await saveResellers(resellers);
      res.json({ success: true, message: 'Reseller diperbarui', reseller: resellers[idx] });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== ADMIN: Levels ==========
  app.get('/api/admin/reseller/levels', async (req, res) => {
    try {
      const levels = await getLevels();
      res.json({ success: true, levels, levelOrder: LEVEL_ORDER });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.put('/api/admin/reseller/levels', async (req, res) => {
    try {
      const { levels: newLevels } = req.body;
      if (!newLevels) return res.json({ success: false, message: 'Data levels diperlukan' });
      // Validate all levels exist
      for (const lv of LEVEL_ORDER) {
        if (newLevels[lv] === undefined || newLevels[lv].minSales === undefined)
          return res.json({ success: false, message: `Level ${lv} tidak lengkap` });
      }
      await saveLevels(newLevels);

      // Recalculate all reseller levels
      let resellers = await getResellers();
      for (const r of resellers) {
        const newLevel = calculateLevel(r.totalSales, newLevels);
        if (newLevel !== r.level) {
          r.level = newLevel;
          // Notification for level up
          let notifs = await getNotifs();
          notifs.push({
            id: generateId('NOTIF-'),
            randomId: r.randomId,
            type: 'level_up',
            title: 'Level Naik!',
            message: `Selamat! Level Anda naik ke ${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await saveNotifs(notifs);
        }
      }
      await saveResellers(resellers);

      res.json({ success: true, message: 'Level berhasil diperbarui' });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== ADMIN: Prices ==========
  app.get('/api/admin/reseller/prices', async (req, res) => {
    try {
      const prices = await getPrices();
      res.json({ success: true, prices });
    } catch(e) { res.json({ success: false, prices: {} }); }
  });

  app.put('/api/admin/reseller/prices', async (req, res) => {
    try {
      const { productId, prices: productPrices } = req.body;
      if (!productId || !productPrices) return res.json({ success: false, message: 'Data tidak lengkap' });

      let allPrices = await getPrices();
      allPrices[productId] = productPrices;
      await savePrices(allPrices);
      res.json({ success: true, message: 'Harga produk diperbarui', prices: allPrices[productId] });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  app.put('/api/admin/reseller/prices/bulk', async (req, res) => {
    try {
      const { prices: newPrices } = req.body;
      if (!newPrices) return res.json({ success: false, message: 'Data prices diperlukan' });
      await savePrices(newPrices);
      res.json({ success: true, message: 'Semua harga diperbarui' });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== ADMIN: Withdrawals ==========
  app.get('/api/admin/reseller/withdraws', async (req, res) => {
    try {
      const withdraws = await getWithdrawals();
      const resellers = await getResellers();
      const items = withdraws.map(w => {
        const r = resellers.find(x => x.randomId === w.randomId);
        return { ...w, resellerName: r?.displayName || 'Unknown', resellerEmail: r?.googleEmail || '' };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({ success: true, items });
    } catch(e) { res.json({ success: false, items: [] }); }
  });

  app.put('/api/admin/reseller/withdraw/:id', async (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!status || !['approved', 'rejected', 'paid'].includes(status))
        return res.json({ success: false, message: 'Status tidak valid' });

      let withdraws = await getWithdrawals();
      const idx = withdraws.findIndex(w => w.id === req.params.id);
      if (idx === -1) return res.json({ success: false, message: 'Withdraw tidak ditemukan' });

      const wd = withdraws[idx];
      const oldStatus = wd.status;
      wd.status = status;
      if (notes !== undefined) wd.notes = notes;
      wd.updatedAt = new Date().toISOString();
      await saveWithdrawals(withdraws);

      let resellers = await getResellers();
      const r = resellers.find(x => x.randomId === wd.randomId);

      // If rejected, return commission
      if (status === 'rejected' && oldStatus === 'pending' && r) {
        r.commissionBalance += wd.nominal;
        r.totalWithdrawn -= wd.nominal;
        await saveResellers(resellers);
      }

      // If paid, update total withdrawn (already deducted on creation)
      if (status === 'paid' && r) {
        r.totalWithdrawn += wd.nominal;
        await saveResellers(resellers);
      }

      // Notification
      let notifs = await getNotifs();
      const statusLabels = { approved: 'Disetujui', rejected: 'Ditolak', paid: 'Dibayar' };
      notifs.push({
        id: generateId('NOTIF-'),
        randomId: wd.randomId,
        type: 'withdraw',
        title: `Withdraw ${statusLabels[status]}`,
        message: `Permintaan withdraw Rp${wd.nominal.toLocaleString('id-ID')} telah ${statusLabels[status]}.${notes ? ' Catatan: ' + notes : ''}`,
        read: false,
        createdAt: new Date().toISOString()
      });
      await saveNotifs(notifs);

      res.json({ success: true, message: `Status withdraw: ${statusLabels[status]}`, withdraw: wd });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== ADMIN: Banks ==========
  app.get('/api/admin/reseller/banks', async (req, res) => {
    try {
      const banks = await getBanks();
      res.json({ success: true, banks });
    } catch(e) { res.json({ success: false, banks: [] }); }
  });

  app.put('/api/admin/reseller/banks', async (req, res) => {
    try {
      const { banks } = req.body;
      if (!banks || !Array.isArray(banks)) return res.json({ success: false, message: 'Data banks tidak valid' });
      await saveBanks(banks);
      res.json({ success: true, message: 'Daftar bank diperbarui' });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== ADMIN: Referral Overview ==========
  app.get('/api/admin/reseller/referrals', async (req, res) => {
    try {
      const refs = await getReferrals();
      const resellers = await getResellers();
      const items = Object.entries(refs).map(([code, data]) => {
        const r = resellers.find(x => x.randomId === data.sponsorRandomId);
        return {
          referralCode: code,
          sponsorName: r?.displayName || 'Unknown',
          sponsorEmail: r?.googleEmail || '',
          earnings: data.earnings || 0,
          count: data.count || 0,
          referrals: data.referrals || []
        };
      });
      res.json({ success: true, items });
    } catch(e) { res.json({ success: false, items: [] }); }
  });

  // ========== ADMIN: Stats Dashboard ==========
  app.get('/api/admin/reseller/stats', async (req, res) => {
    try {
      const resellers = await getResellers();
      const withdraws = await getWithdrawals();
      const refs = await getReferrals();

      const totalResellers = resellers.length;
      const activeResellers = resellers.filter(r => r.status === 'active').length;
      const totalSales = resellers.reduce((sum, r) => sum + (r.totalSales || 0), 0);
      const totalOrders = resellers.reduce((sum, r) => sum + (r.totalOrders || 0), 0);
      const totalDeposits = resellers.reduce((sum, r) => sum + (r.depositBalance || 0), 0);
      const totalCommissions = resellers.reduce((sum, r) => sum + (r.commissionBalance || 0), 0);
      const totalWithdrawn = resellers.reduce((sum, r) => sum + (r.totalWithdrawn || 0), 0);

      const pendingWithdraws = withdraws.filter(w => w.status === 'pending').length;
      const totalPendingAmount = withdraws.filter(w => w.status === 'pending').reduce((s, w) => s + (w.nominal || 0), 0);

      const totalEarnings = Object.values(refs).reduce((sum, ref) => sum + (ref.earnings || 0), 0);
      const totalReferrals = Object.values(refs).reduce((sum, ref) => sum + (ref.count || 0), 0);

      const levelDistribution = {};
      for (const r of resellers) {
        levelDistribution[r.level] = (levelDistribution[r.level] || 0) + 1;
      }

      res.json({
        success: true,
        stats: {
          totalResellers,
          activeResellers,
          totalSales,
          totalOrders,
          totalDeposits,
          totalCommissions,
          totalWithdrawn,
          pendingWithdraws,
          totalPendingAmount,
          totalEarnings,
          totalReferrals,
          levelDistribution
        }
      });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });

  // ========== INTEGRATION: Add commission on order success ==========
  // This will be called from the existing order flow when order status = SUKSES
  app.post('/api/reseller/commission/add', async (req, res) => {
    try {
      const { buyerRandomId, orderAmount } = req.body;
      if (!buyerRandomId) return res.json({ success: false, message: 'Data tidak lengkap' });

      const resellers = await getResellers();
      const buyer = resellers.find(r => r.randomId === buyerRandomId);
      if (!buyer?.sponsorRefCode) return res.json({ success: true, commissionAdded: 0, message: 'Tidak ada referral' });

      const refs = await getReferrals();
      const refData = refs[buyer.sponsorRefCode];
      if (!refData) return res.json({ success: true, commissionAdded: 0, message: 'Referral code tidak ditemukan' });

      const commissionAmount = 500;
      refData.earnings = (refData.earnings || 0) + commissionAmount;

      // Update referral's order count
      const referralEntry = refData.referrals?.find(r => r.randomId === buyerRandomId);
      if (referralEntry) {
        referralEntry.totalOrders = (referralEntry.totalOrders || 0) + 1;
        referralEntry.totalEarned = (referralEntry.totalEarned || 0) + commissionAmount;
      }

      await saveReferrals(refs);

      // Add commission to sponsor's balance
      const sponsorReseller = resellers.find(r => r.randomId === refData.sponsorRandomId);
      if (sponsorReseller) {
        sponsorReseller.commissionBalance = (sponsorReseller.commissionBalance || 0) + commissionAmount;

        // Add buyer's order count to sponsor's total sales tracking
        // (This links the buyer's order to the sponsor's referral network)
        await saveResellers(resellers);
      }

      // Notification to sponsor
      let notifs = await getNotifs();
      notifs.push({
        id: generateId('NOTIF-'),
        randomId: refData.sponsorRandomId,
        type: 'commission',
        title: 'Komisi Rp500',
        message: `Anda mendapat komisi Rp500 dari referral ${buyer.displayName || 'Member'} atas pembelian produk.`,
        read: false,
        createdAt: new Date().toISOString()
      });
      await saveNotifs(notifs);

      res.json({ success: true, commissionAdded: commissionAmount });
    } catch(e) { res.json({ success: false, message: e.message }); }
  });
}

module.exports = { initResellerSystem };
