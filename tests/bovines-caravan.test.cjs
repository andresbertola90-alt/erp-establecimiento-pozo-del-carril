'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const UNRC = require('../domain.js');
const Bovines = require('../bovines-engine.js');
const dbMod = require('../backend/database.cjs');

test('Bovines Caravan Module: seeds realistic default herd if empty', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);
  assert.ok(Array.isArray(db.bovines));
  assert.ok(db.bovines.length >= 10, 'Debe sembrar al menos 10 animales');

  // Verificar presencia de toros, vacas, terneros y novillos
  assert.ok(db.bovines.some(b => b.caravana === 'TORO-01' && b.categoria === 'Toro'));
  assert.ok(db.bovines.some(b => b.caravana === 'AR-0101' && b.categoria === 'Vaca de Cría'));
  assert.ok(db.bovines.some(b => b.caravana === 'TR-2025-01' && b.categoria === 'Ternero'));
  assert.ok(db.bovines.some(b => b.caravana === 'ENG-401' && b.categoria === 'Novillo'));
});

test('Bovines Caravan Module: validates required and unique caravana', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);

  // 1. Caravana vacía debe fallar
  assert.throws(() => {
    UNRC.validate(db, 'bovines', { id: 'test-1', caravana: '', categoria: 'Vaca de Cría' });
  }, /Completá el número de caravana/);

  // 2. Caravana duplicada activa debe fallar
  assert.throws(() => {
    UNRC.validate(db, 'bovines', { id: 'test-2', caravana: 'TORO-01', categoria: 'Toro' });
  }, /Ya existe un bovino activo registrado con la caravana "TORO-01"/);

  // 3. Caravana nueva válida debe pasar
  assert.doesNotThrow(() => {
    UNRC.validate(db, 'bovines', { id: 'test-3', caravana: 'AR-9999', categoria: 'Vaquillona' });
  });
});

test('Bovines Caravan Module: getBovineByCaravana is case-insensitive', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);

  const foundUpper = Bovines.getBovineByCaravana('TORO-01', db);
  const foundLower = Bovines.getBovineByCaravana('toro-01', db);
  assert.ok(foundUpper);
  assert.equal(foundUpper.id, 'bov-001');
  assert.equal(foundUpper.caravana, foundLower?.caravana);
});

test('Bovines Caravan Module: computeBovineKpis calculates accurate herd metrics', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);

  const kpis = Bovines.computeBovineKpis(db);
  assert.ok(kpis);
  assert.ok(kpis.totalHeads >= 10);
  assert.ok(kpis.avgWeight > 300 && kpis.avgWeight < 700);
  assert.ok(kpis.vientresCount >= 3);
  assert.ok(kpis.preñezPct >= 70 && kpis.preñezPct <= 100);
  assert.ok(kpis.byCategory['Toro'] >= 2);
  assert.ok(kpis.byCategory['Vaca de Cría'] >= 3);
});

test('Bovines Caravan Module: individual histories contain audit events', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);

  const cow = Bovines.getBovineByCaravana('AR-0101', db);
  assert.ok(cow);

  // Pesajes con GDPV
  assert.ok(Array.isArray(cow.historialPesajes) && cow.historialPesajes.length >= 2);
  assert.ok(cow.historialPesajes.some(p => p.weight > 0));

  // Sanidad con vacunas SENASA
  assert.ok(Array.isArray(cow.historialSanidad) && cow.historialSanidad.length >= 2);
  assert.ok(cow.historialSanidad.some(s => s.product.includes('Antiaftosa')));

  // Reproducción con tacto rectal
  assert.ok(Array.isArray(cow.historialReproduccion) && cow.historialReproduccion.length >= 2);
  assert.ok(cow.historialReproduccion.some(r => r.result.includes('Preñada')));

  // Movimientos
  assert.ok(Array.isArray(cow.historialMovimientos));
});

test('Bovines Caravan Module: renderWeightCurveSvg generates valid SVG', () => {
  const db = UNRC.initial();
  Bovines.seedDefaultBovinesIfEmpty(db);

  const cow = Bovines.getBovineByCaravana('AR-0101', db);
  const svg = Bovines.renderWeightCurveSvg(cow.historialPesajes);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('kg'));
});

test('Bovines Caravan Module: policy allows bovines-engine.js asset', () => {
  const { assetPath, ORIGIN } = require('../desktop/policy.cjs');
  const path = assetPath(`${ORIGIN}/bovines-engine.js`);
  assert.equal(path, 'bovines-engine.js');
});
