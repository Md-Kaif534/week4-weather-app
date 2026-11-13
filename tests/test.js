// Run with: node tests/test.js
// Lightweight unit tests for pure logic (no framework needed).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- minimal browser stubs ----
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const fakeEl = () => ({ classList: { add() {}, remove() {}, toggle() {} }, textContent: '', innerHTML: '', addEventListener() {} });
const document = {
  getElementById: () => fakeEl(),
  createElement: () => { const o = { set textContent(v) { this._t = v; }, get innerHTML() { return String(this._t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); } }; return o; },
  body: fakeEl(),
  addEventListener() {}
};

const ctx = vm.createContext({ localStorage, document, console, Date, Math, Object, JSON, Map, Promise });
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
['config.js', 'storage.js', 'weatherService.js'].forEach(load);
load('ui.js');
const WeatherUI = vm.runInContext('WeatherUI', ctx);
const StorageRef = vm.runInContext('Storage', ctx);
const WeatherServiceRef = vm.runInContext('WeatherService', ctx);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✔', name); passed++; }
  catch (e) { console.log('  ✘', name, '-', e.message); failed++; }
}
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${b}, got ${a}`); };

const ui = new WeatherUI();

console.log('\nTemperature conversion');
test('0°C -> 0 in celsius', () => { ui.currentUnit = 'celsius'; eq(ui.convertTemp(0), 0); });
test('0°C -> 32°F', () => { ui.currentUnit = 'fahrenheit'; eq(ui.convertTemp(0), 32); });
test('100°C -> 212°F', () => eq(ui.convertTemp(100), 212));
test('-40°C -> -40°F', () => eq(ui.convertTemp(-40), -40));
test('25.6°C rounds to 26 in celsius', () => { ui.currentUnit = 'celsius'; eq(ui.convertTemp(25.6), 26); });

console.log('\nWind conversion');
test('10 m/s = 36.0 km/h', () => { ui.currentUnit = 'celsius'; eq(ui.convertWind(10), '36.0 km/h'); });
test('10 m/s = 22.4 mph', () => { ui.currentUnit = 'fahrenheit'; eq(ui.convertWind(10), '22.4 mph'); });

console.log('\nIcon mapping');
test('thunderstorm id 211', () => eq(ui.iconFor(211, '11d'), '⛈️'));
test('clear day', () => eq(ui.iconFor(800, '01d'), '☀️'));
test('clear night', () => eq(ui.iconFor(800, '01n'), '🌙'));
test('rain id 501', () => eq(ui.iconFor(501, '10d'), '🌧️'));

console.log('\nForecast grouping');
test('groups 3-hour items by day', () => {
  const base = new Date('2026-01-01T00:00:00').getTime() / 1000;
  const list = [];
  for (let i = 0; i < 16; i++) {
    list.push({ dt: base + i * 3 * 3600, main: { temp_min: 10 + i, temp_max: 15 + i }, weather: [{ id: 800, icon: '01d', description: 'clear' }], pop: 0.1 });
  }
  const days = ui.groupForecastByDay(list);
  eq(days.length, 2);
  eq(days[0].min, 10);
  eq(days[0].max, 15 + 7);
});

console.log('\nHTML escaping');
test('escapes script tags', () => eq(ui.escape('<b>'), '&lt;b&gt;'));

console.log('\nStorage (favorites & cache)');
const S = StorageRef;
test('add favorite', () => { S.toggleFavorite('Delhi'); eq(S.isFavorite('delhi'), true); });
test('remove favorite', () => { S.toggleFavorite('Delhi'); eq(S.isFavorite('Delhi'), false); });
test('favorites limited to MAX', () => { for (let i = 0; i < 12; i++) S.toggleFavorite('City' + i); eq(S.getFavorites().length, 8); });
test('cache returns fresh data', () => { S.setCache('k', { a: 1 }); eq(S.getCache('k').a, 1); });
test('cache expires', () => {
  S.set('cache_old', { data: { a: 1 }, timestamp: Date.now() - 11 * 60 * 1000 });
  eq(S.getCache('old'), null);
});

console.log('\nError mapping');
const svc = new WeatherServiceRef();
test('404 -> city not found', () => eq(svc.mapError(404).message.includes('City not found'), true));
test('401 -> invalid key', () => eq(svc.mapError(401).message.includes('Invalid API key'), true));
test('429 -> rate limit', () => eq(svc.mapError(429).message.includes('Too many'), true));

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
