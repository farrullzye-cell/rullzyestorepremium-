const axios = require('axios');

const BASE_URL = 'https://nokos.co.id/api/';

const SERVICE_ICONS = {
  wa: { icon: 'fa-brands fa-whatsapp', color: '#25D366', label: 'WhatsApp' },
  tg: { icon: 'fa-brands fa-telegram', color: '#26A5E4', label: 'Telegram' },
  oi: { icon: 'fa-brands fa-fire', color: '#FF6B6B', label: 'Tinder' },
  go: { icon: 'fa-solid fa-motorcycle', color: '#00AA13', label: 'Gojek' },
  gr: { icon: 'fa-solid fa-car', color: '#00B14F', label: 'Grab' },
  fb: { icon: 'fa-brands fa-facebook', color: '#1877F2', label: 'Facebook' },
  ig: { icon: 'fa-brands fa-instagram', color: '#E4405F', label: 'Instagram' },
  shop: { icon: 'fa-solid fa-bag-shopping', color: '#EE4D2D', label: 'Shopee' },
  tokped: { icon: 'fa-solid fa-store', color: '#42B549', label: 'Tokopedia' },
  tw: { icon: 'fa-brands fa-twitter', color: '#1DA1F2', label: 'Twitter' },
  dc: { icon: 'fa-brands fa-discord', color: '#5865F2', label: 'Discord' },
  ln: { icon: 'fa-brands fa-linkedin', color: '#0A66C2', label: 'LinkedIn' },
  gp: { icon: 'fa-brands fa-google-play', color: '#3DDC84', label: 'Google Play' },
  ap: { icon: 'fa-brands fa-apple', color: '#A2AAAD', label: 'Apple' },
  tkt: { icon: 'fa-solid fa-ticket', color: '#FF2D55', label: 'Tiket.com' },
  bb: { icon: 'fa-solid fa-cart-shopping', color: '#F48024', label: 'Bukalapak' },
  lzd: { icon: 'fa-solid fa-shopping-bag', color: '#F36F36', label: 'Lazada' },
  pn: { icon: 'fa-solid fa-plane', color: '#0066FF', label: 'Traveloka' },
  bca: { icon: 'fa-solid fa-building-columns', color: '#004080', label: 'BCA Mobile' },
  dana: { icon: 'fa-solid fa-wallet', color: '#0088FF', label: 'DANA' },
  ovo: { icon: 'fa-solid fa-circle', color: '#4A21EF', label: 'OVO' },
  gopay: { icon: 'fa-solid fa-credit-card', color: '#00AA13', label: 'GoPay' },
  default: { icon: 'fa-solid fa-mobile-screen-button', color: '#64748b', label: 'Lainnya' }
};

class NokosAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = { 'X-API-Key': apiKey };
  }

  async request(action, params = {}, method = 'GET') {
    try {
      const url = BASE_URL + '?action=' + action;
      const config = { headers: this.headers, timeout: 15000 };
      let res;
      if (method === 'POST') {
        res = await axios.post(url, new URLSearchParams(params).toString(), {
          ...config,
          headers: { ...config.headers, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
      } else {
        const query = new URLSearchParams(params).toString();
        res = await axios.get(url + (query ? '&' + query : ''), config);
      }
      return res.data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getBalance() {
    return this.request('getBalance');
  }

  async getServices() {
    return this.request('getServices');
  }

  async getCountries() {
    return this.request('getCountries');
  }

  async getPrices(service = '', country = 6, server = 's2') {
    return this.request('getPrices', { service, country, server });
  }

  async getAvailability(service, country = 6, server = 's2') {
    return this.request('getAvailability', { service, country, server });
  }

  async getNumber(service, country = 6, operator = 'any', server = 's2') {
    return this.request('getNumber', { service, country, operator, server }, 'POST');
  }

  async getStatus(activationId) {
    return this.request('getStatus', { id: activationId });
  }

  async setStatus(activationId, status) {
    return this.request('setStatus', { id: activationId, status }, 'POST');
  }

  async cancelActivation(activationId) {
    return this.request('cancelActivation', { id: activationId }, 'POST');
  }

  async getHistory(limit = 20, offset = 0) {
    return this.request('getHistory', { limit, offset });
  }

  async createDeposit(amount) {
    return this.request('createDeposit', { amount }, 'POST');
  }

  async checkDeposit(transactionId) {
    return this.request('checkDeposit', { transaction_id: transactionId });
  }

  static getServiceIcon(code, name) {
    const c = (code || '').toLowerCase();
    const n = (name || '').toLowerCase();
    for (const [key, val] of Object.entries(SERVICE_ICONS)) {
      if (c.includes(key)) return val;
    }
    if (n.includes('whatsapp')) return SERVICE_ICONS.wa;
    if (n.includes('telegram')) return SERVICE_ICONS.tg;
    if (n.includes('facebook') || n.includes('instagram') || n.includes('twitter') || n.includes('tiktok') || n.includes('threads')) return { icon: 'fa-brands fa-facebook', color: '#1877F2', label: 'Sosmed' };
    if (n.includes('shopee') || n.includes('tokopedia') || n.includes('lazada') || n.includes('bukalapak')) return { icon: 'fa-solid fa-bag-shopping', color: '#EE4D2D', label: 'E-commerce' };
    if (n.includes('gojek') || c.includes('go')) return SERVICE_ICONS.go;
    if (n.includes('grab') || c.includes('gr')) return SERVICE_ICONS.gr;
    if (n.includes('discord')) return SERVICE_ICONS.dc;
    if (n.includes('apple')) return SERVICE_ICONS.ap;
    if (n.includes('google') || n.includes('gmail') || n.includes('youtube')) return SERVICE_ICONS.gp;
    return SERVICE_ICONS.default;
  }

  static getServiceIconHtml(code, name) {
    const info = NokosAPI.getServiceIcon(code, name);
    return `<div class="nokos-icon" style="background:${info.color}20;border:2px solid ${info.color}40;border-radius:14px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px;color:${info.color}"><i class="${info.icon}"></i></div>`;
  }
}

module.exports = NokosAPI;
