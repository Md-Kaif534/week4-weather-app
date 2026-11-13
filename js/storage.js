// storage.js - safe localStorage wrapper (cache, favorites, settings, API key)
const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage unavailable:', e);
    }
  },

  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },

  // ---- cache with expiry ----
  getCache(key) {
    const item = this.get('cache_' + key);
    if (item && Date.now() - item.timestamp < CONFIG.CACHE_DURATION) return item.data;
    this.remove('cache_' + key);
    return null;
  },

  setCache(key, data) {
    this.set('cache_' + key, { data, timestamp: Date.now() });
  },

  // ---- favorites ----
  getFavorites() {
    return this.get('favorites', []);
  },

  toggleFavorite(city) {
    let favs = this.getFavorites();
    const idx = favs.findIndex(c => c.toLowerCase() === city.toLowerCase());
    if (idx >= 0) favs.splice(idx, 1);
    else favs = [city, ...favs].slice(0, CONFIG.MAX_FAVORITES);
    this.set('favorites', favs);
    return favs;
  },

  isFavorite(city) {
    return this.getFavorites().some(c => c.toLowerCase() === city.toLowerCase());
  },

  // ---- settings ----
  getUnit() { return this.get('unit', 'celsius'); },
  setUnit(u) { this.set('unit', u); },
  getLastCity() { return this.get('lastCity', CONFIG.DEFAULT_CITY); },
  setLastCity(c) { this.set('lastCity', c); },

  // ---- api key ----
  getApiKey() { return CONFIG.API_KEY || this.get('apiKey', ''); },
  setApiKey(k) { this.set('apiKey', k.trim()); }
};
