// ui.js - rendering only (no API calls here)
class WeatherUI {
  constructor() {
    this.currentWeatherEl = document.getElementById('currentWeather');
    this.forecastEl = document.getElementById('forecast');
    this.statusEl = document.getElementById('status');
    this.alertsEl = document.getElementById('alerts');
    this.favoritesEl = document.getElementById('favorites');
    this.suggestionsEl = document.getElementById('suggestions');
    this.unitToggle = document.getElementById('unitToggle');
    this.mapSection = document.getElementById('mapSection');
    this.mapFrame = document.getElementById('mapFrame');
    this.currentUnit = Storage.getUnit();
    this.updateToggleLabel();
  }

  // ---------- helpers ----------
  escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  get unitSymbol() { return this.currentUnit === 'celsius' ? 'C' : 'F'; }

  convertTemp(temp) {
    return this.currentUnit === 'celsius'
      ? Math.round(temp)
      : Math.round((temp * 9) / 5 + 32);
  }

  convertWind(ms) {
    return this.currentUnit === 'celsius'
      ? `${(ms * 3.6).toFixed(1)} km/h`
      : `${(ms * 2.237).toFixed(1)} mph`;
  }

  iconFor(id, icon) {
    const night = icon && icon.endsWith('n');
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800) return night ? '🌙' : '☀️';
    if (id === 801) return night ? '☁️' : '🌤️';
    if (id === 802) return '⛅';
    return '☁️';
  }

  updateToggleLabel() {
    this.unitToggle.textContent = `Switch to °${this.currentUnit === 'celsius' ? 'F' : 'C'}`;
  }

  // ---------- states ----------
  showLoading() {
    this.statusEl.innerHTML = '';
    this.alertsEl.innerHTML = '';
    this.currentWeatherEl.innerHTML = `
      <div class="card skeleton"><div class="spinner"></div><p>Loading weather data...</p></div>`;
    this.forecastEl.innerHTML = '';
  }

  showError(message) {
    this.currentWeatherEl.innerHTML = `
      <div class="card error" role="alert">
        <div class="big-icon">⚠️</div>
        <p>${this.escape(message)}</p>
        <button class="btn primary" id="retryBtn">Try Again</button>
      </div>`;
    this.forecastEl.innerHTML = '';
    this.mapSection.classList.add('hidden');
  }

  // ---------- current weather ----------
  displayCurrentWeather(data, isFav) {
    const w = data.weather[0];
    const unit = this.unitSymbol;
    const updated = new Date(data.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.currentWeatherEl.innerHTML = `
      <div class="card weather-card fade-in">
        <div class="card-head">
          <h2>${this.escape(data.name)}, ${this.escape(data.sys.country)}</h2>
          <div class="card-actions">
            <button class="icon-btn" id="favBtn" title="Favorite">${isFav ? '⭐' : '☆'}</button>
            <button class="icon-btn" id="shareBtn" title="Share">📤</button>
          </div>
        </div>
        <div class="weather-main">
          <div class="temperature">${this.convertTemp(data.main.temp)}°${unit}</div>
          <div class="weather-condition">
            <span class="wi-icon">${this.iconFor(w.id, w.icon)}</span>
            <span class="desc">${this.escape(w.description)}</span>
          </div>
        </div>
        <div class="weather-details">
          <div class="detail"><span>Feels like</span><strong>${this.convertTemp(data.main.feels_like)}°${unit}</strong></div>
          <div class="detail"><span>Humidity</span><strong>${data.main.humidity}%</strong></div>
          <div class="detail"><span>Wind</span><strong>${this.convertWind(data.wind.speed)}</strong></div>
          <div class="detail"><span>Pressure</span><strong>${data.main.pressure} hPa</strong></div>
        </div>
        <p class="updated">Last updated: ${updated}</p>
      </div>`;

    this.applyTheme(data);
    this.showMap(data.coord.lat, data.coord.lon);
  }

  // dark/light mode based on local time at the searched city (sunrise/sunset)
  applyTheme(data) {
    const now = data.dt;
    const isDay = now >= data.sys.sunrise && now < data.sys.sunset;
    document.body.classList.toggle('night', !isDay);
  }

  // ---------- forecast ----------
  groupForecastByDay(list) {
    const days = {};
    list.forEach(item => {
      const key = new Date(item.dt * 1000).toDateString();
      if (!days[key]) days[key] = { items: [], dt: item.dt };
      days[key].items.push(item);
    });
    return Object.values(days).map(d => {
      // prefer reading closest to midday for icon/description
      const mid = d.items.reduce((best, it) => {
        const h = new Date(it.dt * 1000).getHours();
        const bh = new Date(best.dt * 1000).getHours();
        return Math.abs(h - 12) < Math.abs(bh - 12) ? it : best;
      }, d.items[0]);
      return {
        dt: d.dt,
        weather: mid.weather[0],
        min: Math.min(...d.items.map(i => i.main.temp_min)),
        max: Math.max(...d.items.map(i => i.main.temp_max)),
        pop: Math.max(...d.items.map(i => i.pop || 0))
      };
    });
  }

  displayForecast(forecastData) {
    const days = this.groupForecastByDay(forecastData.list).slice(0, 5);
    let html = '<div class="forecast-container fade-in">';
    days.forEach(day => {
      const name = new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
      html += `
        <div class="forecast-day">
          <div class="day-name">${name}</div>
          <div class="wi-icon">${this.iconFor(day.weather.id, day.weather.icon)}</div>
          <div class="temps">
            <span class="temp-max">${this.convertTemp(day.max)}°</span>
            <span class="temp-min">${this.convertTemp(day.min)}°</span>
          </div>
          <div class="condition">${this.escape(day.weather.description)}</div>
          <div class="pop">💧 ${Math.round(day.pop * 100)}%</div>
        </div>`;
    });
    html += '</div>';
    this.forecastEl.innerHTML = html;
  }

  // ---------- alerts (derived from data; free API has no official alerts) ----------
  displayAlerts(current) {
    const alerts = [];
    const t = current.main.temp;
    if (t >= 40) alerts.push('🔥 Extreme heat warning: stay hydrated and avoid the sun.');
    if (t <= 0) alerts.push('🥶 Freezing temperature: dress warmly.');
    if (current.wind.speed >= 10) alerts.push('💨 Strong wind warning.');
    if (current.weather[0].id >= 200 && current.weather[0].id < 300) alerts.push('⛈️ Thunderstorm in the area.');
    if (current.weather[0].id >= 502 && current.weather[0].id < 600) alerts.push('🌧️ Heavy rain expected.');
    this.alertsEl.innerHTML = alerts.map(a => `<div class="alert-box">${a}</div>`).join('');
  }

  // ---------- map ----------
  showMap(lat, lon) {
    const d = 0.3;
    this.mapFrame.src =
      `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`;
    this.mapSection.classList.remove('hidden');
  }

  // ---------- favorites ----------
  renderFavorites(favs) {
    if (!favs.length) { this.favoritesEl.innerHTML = ''; return; }
    this.favoritesEl.innerHTML =
      '<span class="fav-label">⭐ Favorites:</span>' +
      favs.map(c => `<button class="chip" data-city="${this.escape(c)}">${this.escape(c)}</button>`).join('');
  }

  // ---------- autocomplete ----------
  renderSuggestions(list) {
    if (!list.length) { this.hideSuggestions(); return; }
    this.suggestionsEl.innerHTML = list
      .map(c => `<li role="option" data-city="${this.escape(c.name)}">${this.escape(c.label)}</li>`)
      .join('');
    this.suggestionsEl.classList.remove('hidden');
  }

  hideSuggestions() {
    this.suggestionsEl.classList.add('hidden');
    this.suggestionsEl.innerHTML = '';
  }

  toast(message) {
    this.statusEl.innerHTML = `<div class="toast">${this.escape(message)}</div>`;
    setTimeout(() => { this.statusEl.innerHTML = ''; }, 2500);
  }
}
