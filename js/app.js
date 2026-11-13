// app.js - controller: wires service + UI + events
class WeatherApp {
  constructor() {
    this.service = new WeatherService();
    this.ui = new WeatherUI();
    this.currentData = null;
    this.forecastData = null;
    this.lastQuery = null;
    this.debounceTimer = null;

    this.bindEvents();
    this.init();
  }

  init() {
    this.ui.renderFavorites(Storage.getFavorites());
    if (!Storage.getApiKey()) {
      document.getElementById('keySetup').classList.remove('hidden');
      this.ui.showError('Add your OpenWeatherMap API key to get started.');
      return;
    }
    this.loadCity(Storage.getLastCity());
  }

  bindEvents() {
    // API key form
    document.getElementById('keyForm').addEventListener('submit', e => {
      e.preventDefault();
      const key = document.getElementById('keyInput').value.trim();
      if (!key) return;
      Storage.setApiKey(key);
      document.getElementById('keySetup').classList.add('hidden');
      this.loadCity(Storage.getLastCity());
    });

    // search
    document.getElementById('searchForm').addEventListener('submit', e => {
      e.preventDefault();
      const city = document.getElementById('searchInput').value.trim();
      if (!city) return this.ui.toast('Please enter a city name.');
      this.ui.hideSuggestions();
      this.loadCity(city);
    });

    // autocomplete (debounced)
    document.getElementById('searchInput').addEventListener('input', e => {
      clearTimeout(this.debounceTimer);
      const q = e.target.value.trim();
      if (q.length < 2 || !Storage.getApiKey()) return this.ui.hideSuggestions();
      this.debounceTimer = setTimeout(async () => {
        try {
          this.ui.renderSuggestions(await this.service.searchCities(q));
        } catch (err) {
          this.ui.hideSuggestions();
        }
      }, 350);
    });

    document.getElementById('suggestions').addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      document.getElementById('searchInput').value = li.dataset.city;
      this.ui.hideSuggestions();
      this.loadCity(li.dataset.city);
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) this.ui.hideSuggestions();
    });

    // unit toggle - re-render with stored data (no new API call)
    document.getElementById('unitToggle').addEventListener('click', () => {
      this.ui.currentUnit = this.ui.currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
      Storage.setUnit(this.ui.currentUnit);
      this.ui.updateToggleLabel();
      this.render();
    });

    // geolocation
    document.getElementById('locationBtn').addEventListener('click', () => this.useMyLocation());

    // favorites chips
    document.getElementById('favorites').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) this.loadCity(chip.dataset.city);
    });

    // delegated buttons inside weather card (re-rendered often)
    document.getElementById('currentWeather').addEventListener('click', e => {
      if (e.target.closest('#retryBtn')) return this.retry();
      if (e.target.closest('#favBtn')) return this.toggleFavorite();
      if (e.target.closest('#shareBtn')) return this.share();
    });
  }

  async loadCity(city) {
    this.lastQuery = { type: 'city', city };
    this.ui.showLoading();
    try {
      const [current, forecast] = await Promise.all([
        this.service.getCurrentWeather(city),
        this.service.getForecast(city)
      ]);
      this.currentData = current;
      this.forecastData = forecast;
      Storage.setLastCity(current.name);
      this.render();
    } catch (err) {
      this.ui.showError(err.message);
    }
  }

  useMyLocation() {
    if (!navigator.geolocation) return this.ui.toast('Geolocation is not supported.');
    if (!Storage.getApiKey()) return this.ui.toast('Add an API key first.');
    this.ui.showLoading();
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        this.lastQuery = { type: 'coords', lat, lon };
        try {
          const [current, forecast] = await Promise.all([
            this.service.getCurrentByCoords(lat, lon),
            this.service.getForecastByCoords(lat, lon)
          ]);
          this.currentData = current;
          this.forecastData = forecast;
          Storage.setLastCity(current.name);
          this.render();
        } catch (err) {
          this.ui.showError(err.message);
        }
      },
      () => this.ui.showError('Location access denied. Search a city instead.'),
      { timeout: 10000 }
    );
  }

  retry() {
    if (!this.lastQuery) return this.init();
    if (this.lastQuery.type === 'coords') return this.useMyLocation();
    this.loadCity(this.lastQuery.city);
  }

  render() {
    if (!this.currentData) return;
    this.ui.displayCurrentWeather(this.currentData, Storage.isFavorite(this.currentData.name));
    this.ui.displayAlerts(this.currentData);
    this.ui.displayForecast(this.forecastData);
  }

  toggleFavorite() {
    const favs = Storage.toggleFavorite(this.currentData.name);
    this.ui.renderFavorites(favs);
    this.render();
  }

  async share() {
    const t = this.ui.convertTemp(this.currentData.main.temp);
    const text = `Weather in ${this.currentData.name}: ${t}°${this.ui.unitSymbol}, ${this.currentData.weather[0].description}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Weather', text });
      else {
        await navigator.clipboard.writeText(text);
        this.ui.toast('Copied to clipboard!');
      }
    } catch (e) { /* user cancelled */ }
  }
}

document.addEventListener('DOMContentLoaded', () => new WeatherApp());
