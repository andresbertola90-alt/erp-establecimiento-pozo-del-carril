'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const UNRC = require('../domain.js');
const Weather = require('../weather-engine.js');
const dbMod = require('../backend/database.cjs');

test('Weather Module: getActiveLocation returns default rural coordinates', () => {
  const db = dbMod.getDatabase();
  const loc = Weather.getActiveLocation(db);
  assert.ok(loc);
  assert.equal(typeof loc.lat, 'number');
  assert.equal(typeof loc.lon, 'number');
  assert.ok(loc.name.includes('La Aguada') || loc.name.includes('Pozo del Carril'));
  assert.equal(loc.timezone, 'America/Argentina/Cordoba');
});

test('Weather Module: computeAgroAlerts detects frost and spraying risks', () => {
  const mockForecastFrost = {
    current: { temp: 2.5, windSpeed: 12, windDirection: 'S', weather: { label: 'Despejado' } },
    daily: [
      { tempMin: 1.0, tempMax: 14.0, rainProb: 0, rainSum: 0, weather: { label: 'Despejado' } }
    ]
  };
  const alerts = Weather.computeAgroAlerts(mockForecastFrost);
  assert.ok(alerts.some(a => a.id === 'helada'));

  const mockForecastWind = {
    current: { temp: 22, windSpeed: 24, windDirection: 'NO', weather: { label: 'Ventoso' } },
    daily: []
  };
  const alertsWind = Weather.computeAgroAlerts(mockForecastWind);
  assert.ok(alertsWind.some(a => a.id === 'pulverizacion'));
});

test('Weather Module: computeRainfallKpis aggregates precipitation intervals', () => {
  const db = dbMod.getDatabase();
  const kpis = Weather.computeRainfallKpis(db);
  assert.ok(kpis);
  assert.ok(Number(kpis.rainYear) > 0, 'Año 2026 debe tener acumulado pluvial');
  assert.ok(Number(kpis.rainCampaign) > 0, 'Campaña agrícola debe tener acumulado pluvial');
  assert.equal(typeof kpis.eventsCount, 'number');
});

test('Weather Module: getRainfallMonthlySeries extracts 12 months for 2024, 2025, 2026', () => {
  const db = dbMod.getDatabase();
  const series2025 = Weather.getRainfallMonthlySeries(db, 2025);
  assert.equal(series2025.months.length, 12);
  assert.ok(series2025.totalYear >= 700 && series2025.totalYear <= 900, 'Año 2025 debe rondar los 800 mm');

  const series2026 = Weather.getRainfallMonthlySeries(db, 2026);
  assert.equal(series2026.months.length, 12);
  assert.ok(series2026.totalYear > 0);
});

test('Weather Module: renderRainfallBarChartSvg generates SVG bars', () => {
  const db = dbMod.getDatabase();
  const series2026 = Weather.getRainfallMonthlySeries(db, 2026);
  const svg = Weather.renderRainfallBarChartSvg(series2026);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('rain-bar'));
});

test('Weather Module: domain validates rainfalls and rejects negative millimeters', () => {
  const db = dbMod.getDatabase();
  assert.throws(() => {
    UNRC.validate(db, 'rainfalls', { id: 'invalid', date: '2026-11-01', millimeters: -10 });
  }, /número no negativo|mayor que cero/i);

  assert.throws(() => {
    UNRC.validate(db, 'rainfalls', { id: 'invalid', date: 'invalid-date', millimeters: 20 });
  }, /fecha válida/i);
});
