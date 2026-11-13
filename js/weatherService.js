// weatherService.js - all API communication + caching + error mapping
class WeatherService {
  constructor() {
    this.baseUrl = CONFIG.BASE_URL;
    this.geoUrl = CONFIG.GEO_URL;
  }

  get apiKey() {
    return Storage.getApiKey();
  }

  // Generic fetch with timeout + friendly errors
  async request(url, cacheKey = null) {
    if (cacheKey) {
      const cached = Storage.getCache(cacheKey);
      if (cached) return cached;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw this.mapError(response.status);
      const data = await response.json();
      if (cacheKey) Storage.setCache(cacheKey, data);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
      if (err instanceof TypeError) throw new Error('Network error. Check your internet connection.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  mapError(status) {
    const messages = {
      400: 'Bad request. Please check the city name.',
      401: 'Invalid API key. New keys can take up to 2 hours to activate.',
      404: 'City not found. Try another spelling.',
      429: 'Too many requests. Please wait a minute.',
      500: 'Weather server error. Try again later.'
    };
    const err = new Error(messages[status] || `API Error: ${status}`);
    err.status = status;
    return err;
  }

  async getCurrentWeather(city) {
    const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${this.apiKey}`;
    return this.request(url, `current_${city.toLowerCase()}`);
  }

  async getForecast(city) {
    const url = `${this.baseUrl}/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${this.apiKey}`;
    return this.request(url, `forecast_${city.toLowerCase()}`);
  }

  async getCurrentByCoords(lat, lon) {
    const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`;
    return this.request(url);
  }

  async getForecastByCoords(lat, lon) {
    const url = `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`;
    return this.request(url);
  }

  // City autocomplete via Geocoding API
  async searchCities(query) {
    if (!query || query.length < 2) return [];
    const url = `${this.geoUrl}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${this.apiKey}`;
    const list = await this.request(url, `geo_${query.toLowerCase()}`);
    return list.map(c => ({
      name: c.name,
      state: c.state || '',
      country: c.country,
      label: [c.name, c.state, c.country].filter(Boolean).join(', ')
    }));
  }

  clearCache() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(k => localStorage.removeItem(k));
  }
}
