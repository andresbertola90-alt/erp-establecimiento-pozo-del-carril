const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../domain.js');
const Demo = require('../demo-data.js');

test('UNRC Demo Data 2026: loads complete 5-activity scenario without errors', () => {
  const initialDb = D.initial();
  assert.equal(Demo.hasDemoData(initialDb), false);

  const populated = Demo.loadDemoData(initialDb);
  assert.equal(Demo.hasDemoData(populated), true);

  // Replay entire 2026 dataset up to end of 2026
  const replayState = D.replay(populated, '2026-12-31');
  assert.ok(replayState, 'Replay state should exist');
  assert.equal(Array.isArray(replayState.errors) ? replayState.errors.length : 0, 0, 'Replay should produce zero errors');

  // Verify non-zero operational indicators across all 5 business activities
  const results = D.results(populated, '2026-01-01', '2026-12-31');
  assert.ok(results, 'Economic results should exist');

  // Revenues must be positive across all 5 specific production units
  assert.ok(results.areas.cerdos.revenue > 0, 'Porcinos revenue should be > 0');
  assert.ok(results.areas.bovinos.revenue > 0, 'Bovinos revenue should be > 0');
  assert.ok(results.areas.ovinos.revenue > 0, 'Ovinos revenue should be > 0');
  assert.ok(results.areas.maiz.revenue > 0, 'Maíz revenue should be > 0');
  assert.ok(results.areas.soja.revenue > 0, 'Soja revenue should be > 0');
  assert.ok(results.groups.agricultura.revenue > 0, 'Agricultura group revenue should be > 0');
  assert.ok(results.groups.ganaderia.revenue > 0, 'Ganadería group revenue should be > 0');

  // Verify stock exists in silos for both grains
  assert.ok(replayState.stock['demo-prod-maiz|maiz|demo-camp-maiz'].quantity >= 120000, 'Corn silo balance should be >= 120,000 kg');
  assert.ok(replayState.stock['demo-prod-soja|soja|demo-camp-soja'].quantity >= 35000, 'Soy silo balance should be >= 35,000 kg');

  // Verify active animal heads exist
  const activeLots = Object.values(replayState.lots);
  assert.ok(activeLots.length >= 7, 'Should have at least 7 active livestock lots');
  const totalHeads = activeLots.reduce((acc, l) => acc + (l.quantity || 0), 0);
  assert.ok(totalHeads > 250, 'Total animal heads should be > 250');
});

test('UNRC Demo Data: idempotency and safe non-destructive cleanup', () => {
  const initialDb = D.initial();
  initialDb.parties.push({ id: 'user-party-1', name: 'Cliente Real Pozo del Carril', kind: 'cliente' });

  // Load once
  const loaded1 = Demo.loadDemoData(initialDb);
  const salesCount1 = loaded1.sales.length;
  const partiesCount1 = loaded1.parties.length;

  // Load twice (idempotency test)
  const loaded2 = Demo.loadDemoData(loaded1);
  assert.equal(loaded2.sales.length, salesCount1, 'Second load must not duplicate sales');
  assert.equal(loaded2.parties.length, partiesCount1, 'Second load must not duplicate parties');

  // Clean demo data
  const cleaned = Demo.cleanDemoData(loaded2);
  assert.equal(Demo.hasDemoData(cleaned), false, 'Cleaned database should have zero demo data');
  assert.equal(cleaned.parties.some(p => p.id === 'user-party-1'), true, 'User record must be preserved');
  assert.equal(cleaned.sales.length, 0, 'All demo sales should be removed');
});
