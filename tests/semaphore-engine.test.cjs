const test = require('node:test');
const assert = require('node:assert/strict');
const UNRC = require('../domain.js');
const UNRCSemaphore = require('../semaphore-engine.js');
const UNRCDemo = require('../demo-data.js');

test('Semaphore Engine: 4 Estados de Evaluación (Verde, Amarillo, Rojo, Gris)', () => {
  const ruleHigher = {
    id: 'test_yield',
    name: 'Rendimiento',
    unit: 'kg/ha',
    direction: 'higher_is_better',
    target: 8000,
    warningThreshold: 6800,
    criticalThreshold: 5500
  };

  // Verde: >= target
  const resGreen = UNRCSemaphore.evaluateIndicator(8500, ruleHigher);
  assert.equal(resGreen.state, 'green');
  assert.equal(resGreen.badgeLabel, 'NORMAL');
  assert.ok(resGreen.isNormal);

  // Amarillo: >= warningThreshold y < target
  const resYellow = UNRCSemaphore.evaluateIndicator(7200, ruleHigher);
  assert.equal(resYellow.state, 'yellow');
  assert.equal(resYellow.badgeLabel, 'ATENCIÓN');
  assert.ok(resYellow.isWarning);

  // Rojo: < warningThreshold
  const resRed = UNRCSemaphore.evaluateIndicator(5000, ruleHigher);
  assert.equal(resRed.state, 'red');
  assert.equal(resRed.badgeLabel, 'CRÍTICO');
  assert.ok(resRed.isCritical);

  // Gris: Sin datos (null, undefined o NaN)
  const resGray = UNRCSemaphore.evaluateIndicator(null, ruleHigher, 'Faltan registros de cosecha en el lote');
  assert.equal(resGray.state, 'gray');
  assert.equal(resGray.badgeLabel, 'SIN DATOS');
  assert.ok(resGray.explanation.includes('Faltan registros'));
});

test('Semaphore Engine: Evaluación lower_is_better (Costos y Desvíos)', () => {
  const ruleLower = {
    id: 'test_cost',
    name: 'Costo por ha',
    unit: 'ARS/ha',
    direction: 'lower_is_better',
    target: 500000,
    warningThreshold: 550000, // +10%
    criticalThreshold: 600000  // +20%
  };

  // Verde: <= target
  const g = UNRCSemaphore.evaluateIndicator(480000, ruleLower);
  assert.equal(g.state, 'green');

  // Amarillo: > target y <= warningThreshold
  const y = UNRCSemaphore.evaluateIndicator(530000, ruleLower);
  assert.equal(y.state, 'yellow');

  // Rojo: > warningThreshold
  const r = UNRCSemaphore.evaluateIndicator(580000, ruleLower);
  assert.equal(r.state, 'red');
});

test('Semaphore Engine: Evaluación optimal_range (Rango Óptimo Comercial)', () => {
  const ruleRange = {
    id: 'test_weight',
    name: 'Peso Capón',
    unit: 'kg/cab',
    direction: 'optimal_range',
    target: 100,
    minTarget: 90,
    maxTarget: 110,
    warningThreshold: 85, // tolerancias
    criticalThreshold: 115
  };

  // Verde: dentro del rango 90 - 110 kg
  const g = UNRCSemaphore.evaluateIndicator(98, ruleRange);
  assert.equal(g.state, 'green');

  // Amarillo: moderado (ej. 88 kg o 112 kg)
  const y = UNRCSemaphore.evaluateIndicator(88, ruleRange);
  assert.equal(y.state, 'yellow');

  // Rojo: fuera de tolerancia (ej. 75 kg o 125 kg)
  const r = UNRCSemaphore.evaluateIndicator(75, ruleRange);
  assert.equal(r.state, 'red');
});

test('Semaphore Engine: Personalización persistente en db.settings.semaphoreRules', () => {
  const dbMock = {
    settings: {
      semaphoreRules: {
        agri_yield_corn: {
          target: 9500,
          warningThreshold: 8200,
          criticalThreshold: 7000,
          effectiveDate: '2026-03-01'
        }
      }
    }
  };

  const rule = UNRCSemaphore.getRule(dbMock, 'agri_yield_corn');
  assert.equal(rule.target, 9500);
  assert.equal(rule.warningThreshold, 8200);
  assert.equal(rule.effectiveDate, '2026-03-01');

  // Evaluar con nueva meta: 8600 antes era verde (>=8500), ahora es amarillo (<9500)
  const res = UNRCSemaphore.evaluateIndicator(8600, rule);
  assert.equal(res.state, 'yellow');
});

test('Semaphore Engine: Cálculo Integral de Indicadores en Datos de Demostración 2026', () => {
  const db = UNRC.initial();
  const demoDb = UNRCDemo.loadDemoData(db);

  const from = '2026-01-01';
  const to = '2026-12-31';

  const indicators = UNRCSemaphore.computeAllIndicators(demoDb, from, to);
  assert.ok(Array.isArray(indicators));
  assert.ok(indicators.length >= 25, 'Debe evaluar el catálogo completo de indicadores');

  // Verificar presencia de módulos
  const modules = new Set(indicators.map(i => i.module));
  assert.ok(modules.has('maiz'), 'Módulo Maíz presente');
  assert.ok(modules.has('soja'), 'Módulo Soja presente');
  assert.ok(modules.has('porcinos'), 'Módulo Porcinos presente');
  assert.ok(modules.has('bovinos'), 'Módulo Bovinos presente');
  assert.ok(modules.has('ovinos'), 'Módulo Ovinos presente');
  assert.ok(modules.has('comercial'), 'Módulo Comercial presente');
  assert.ok(modules.has('financiero'), 'Módulo Financiero presente');

  // Rendimiento Maíz obtenido en demo
  const cornYield = indicators.find(i => i.ruleId === 'agri_yield_corn');
  assert.ok(cornYield);
  assert.ok(cornYield.currentValue > 0);
  assert.equal(cornYield.unit, 'kg/ha');

  // Existencias Ganaderas
  const pigStock = indicators.find(i => i.ruleId === 'pigs_stock');
  assert.ok(pigStock);
  assert.ok(pigStock.currentValue > 0);
  assert.equal(pigStock.unit, 'cab');

  // Ventas del Período
  const sales = indicators.find(i => i.ruleId === 'com_sales_volume');
  assert.ok(sales);
  assert.ok(sales.currentValue > 0);
  assert.equal(sales.unit, 'ARS');
});

test('Semaphore Engine: Manejo de Información Insuficiente (Estado Gris sin crash)', () => {
  const emptyDb = UNRC.initial();
  const indicators = UNRCSemaphore.computeAllIndicators(emptyDb, '2026-01-01', '2026-12-31');

  // Indicadores que dependen de cosechas o ventas deben ser grises con explicación
  const cornYield = indicators.find(i => i.ruleId === 'agri_yield_corn');
  assert.equal(cornYield.state, 'gray');
  assert.ok(cornYield.explanation.includes('Sin') || cornYield.explanation.includes('datos'));

  const ica = indicators.find(i => i.ruleId === 'pigs_ica');
  assert.equal(ica.state, 'gray');
  assert.ok(ica.explanation.length > 5);
});

test('Semaphore Engine: Generación de Alertas Centinela (Amarillas y Rojas)', () => {
  const db = UNRC.initial();
  const demoDb = UNRCDemo.loadDemoData(db);

  const alerts = UNRCSemaphore.getSemaphoreAlerts(demoDb, '2026-01-01', '2026-12-31');
  assert.ok(Array.isArray(alerts));

  // Cada alerta debe contener los requisitos de la Sección 8
  for (const a of alerts) {
    assert.ok(a.title, 'Debe identificar el indicador afectado');
    assert.ok(a.formattedValue, 'Debe mostrar el valor registrado');
    assert.ok(a.formattedTarget, 'Debe mostrar el umbral');
    assert.ok(a.period, 'Debe indicar el período de referencia');
    assert.ok(a.view, 'Debe facilitar la navegación al módulo');
    assert.ok(['yellow', 'red'].includes(a.semaphore), 'Solo niveles amarillo y rojo generan alertas');
  }
});

test('Semaphore Engine: Renderizado Visual de Badges y Tarjetas', () => {
  const evalRes = {
    ruleId: 'test_ind',
    name: 'Margen Bruto Maíz',
    state: 'green',
    currentValue: 12500000,
    formattedValue: '$ 12.500.000',
    targetValue: 10000000,
    formattedTarget: '$ 10.000.000',
    deviationPct: 25.0,
    badgeLabel: 'NORMAL',
    explanation: 'Margen 25% por encima de la meta presupuestada'
  };

  const badgeHtml = UNRCSemaphore.renderSemaphoreBadge(evalRes);
  assert.ok(badgeHtml.includes('semaphore-badge green'));
  assert.ok(badgeHtml.includes('NORMAL'));

  const cardHtml = UNRCSemaphore.renderSemaphoreCard(evalRes);
  assert.ok(cardHtml.includes('Margen Bruto Maíz'));
  assert.ok(cardHtml.includes('$ 12.500.000'));
  assert.ok(cardHtml.includes('+25%'));
});
