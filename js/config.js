// config.js - API configuration
// NOTE: Never commit a real key. Either leave it empty and paste the key in the
// app's setup box (saved in localStorage), or set it locally below.
const CONFIG = {
  API_KEY: '', // <- optional: put your OpenWeatherMap key here for local use
  BASE_URL: 'https://api.openweathermap.org/data/2.5',
  GEO_URL: 'https://api.openweathermap.org/geo/1.0',
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  DEFAULT_CITY: 'Delhi',
  MAX_FAVORITES: 8
};
