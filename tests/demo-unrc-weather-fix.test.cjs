'use strict';

const test = require('node:test');
const assert = require('node:assert');
const authModule = require('../backend/auth.cjs');
const weatherModule = require('../backend/weather.cjs');
const dbModule = require('../backend/database.cjs');

test('DemoUNRC User: Seeding and Authentication', () => {
  const users = authModule.loadUsers();
  const demoUser = users.find(u => u.username.toLowerCase() === 'demounrc');
  assert.ok(demoUser, 'El usuario DemoUNRC debe existir en users.json');
  assert.strictEqual(demoUser.role, 'analista', 'El rol de DemoUNRC debe ser analista');
  assert.strictEqual(demoUser.username, 'DemoUNRC', 'El nombre de usuario debe ser DemoUNRC');

  // Verify authenticate with password DemoUNRC2026!
  const res = authModule.authenticate('DemoUNRC', 'DemoUNRC2026!');
  assert.strictEqual(res.success, true, 'La autenticación con DemoUNRC2026! debe ser exitosa');
  assert.strictEqual(res.user.role, 'analista');
  assert.ok(res.token, 'Debe emitir token de sesión');

  // Case insensitive username
  const resLower = authModule.authenticate('demounrc', 'DemoUNRC2026!');
  assert.strictEqual(resLower.success, true, 'La autenticación case-insensitive debe funcionar');

  // Bad password fails
  const resBad = authModule.authenticate('DemoUNRC', 'wrongpassword');
  assert.strictEqual(resBad.success, false, 'Contraseña errónea debe fallar');
});

test('Weather Backend Module: getForecast & getFallbackForecast', async () => {
  const fallback = weatherModule.getFallbackForecast(-33.125, -64.350);
  assert.ok(fallback.current, 'Fallback debe incluir current');
  assert.strictEqual(fallback.location.name, 'La Aguada · Pozo del Carril, Córdoba');
  assert.strictEqual(fallback.daily.length, 7, 'Debe tener 7 días de pronóstico');

  // Live or fallback forecast
  const forecast = await weatherModule.getForecast(-33.125, -64.350);
  assert.ok(forecast.current.temp != null, 'Temperatura actual debe estar presente');
  assert.ok(forecast.daily.length === 7, 'Debe tener 7 días de pronóstico');
});

test('Database: All tables including rainfalls exist in getDatabase', () => {
  const db = dbModule.getDatabase();
  assert.ok(Array.isArray(db.rainfalls), 'db.rainfalls debe ser un array');
  assert.ok(Array.isArray(db.accounts), 'db.accounts debe ser un array');
  assert.ok(db.settings.weatherLocation, 'db.settings.weatherLocation debe existir');
});
