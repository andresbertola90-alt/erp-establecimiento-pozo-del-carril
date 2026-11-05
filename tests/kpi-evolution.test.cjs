'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../domain.js');
const S = require('../semaphore-engine.js');
const Demo = require('../demo-data.js');
const KpiEvolution = require('../kpi-evolution.js');

let db;
try {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'database.json'), 'utf8');
  db = JSON.parse(raw);
} catch {
  db = Demo.loadDemoData(D.initial());
}

test('KPI Evolution: Detección precisa de años con operaciones disponibles', () => {
  const years = KpiEvolution.getAvailableYears(db);
  assert.ok(Array.isArray(years), 'Debe devolver un arreglo de años');
  assert.ok(years.includes(2026), 'Debe contener el año 2026');
  assert.ok(years.includes(2025), 'Debe contener el año 2025');
  assert.ok(years.includes(2024), 'Debe contener el año 2024');
  assert.equal(years[0], 2026, 'El año más reciente debe figurar primero');
});

test('KPI Evolution: Resolución semántica de descriptores de KPI', () => {
  const mockCard = {
    getAttribute: (attr) => {
      if (attr === 'data-kpi-key') return 'ingresos_ventas';
      return null;
    },
    querySelector: () => ({ textContent: 'Ingresos Ventas' })
  };

  const desc = KpiEvolution.resolveKpiDescriptor(mockCard);
  assert.equal(desc.id, 'ingresos_ventas');
  assert.equal(desc.type, 'executive');

  const mockSemaphoreCard = {
    getAttribute: (attr) => {
      if (attr === 'data-kpi-id') return 'agri_yield_corn';
      return null;
    },
    querySelector: () => ({ textContent: 'Rendimiento Maíz' })
  };

  const descSem = KpiEvolution.resolveKpiDescriptor(mockSemaphoreCard);
  assert.equal(descSem.id, 'agri_yield_corn');
  assert.equal(descSem.type, 'semaphore');
});

test('KPI Evolution: Extracción de 12 meses y tratamiento de períodos futuros', () => {
  const desc = { id: 'ingresos_ventas', type: 'executive', name: 'Ingresos por Ventas', unit: '$' };
  const series2026 = KpiEvolution.extractMonthlySeries(db, desc, 2026);

  assert.equal(series2026.year, 2026);
  assert.equal(series2026.months.length, 12, 'Debe contener los 12 meses del año');
  assert.equal(series2026.months[0].label, 'Ene');
  assert.equal(series2026.months[11].label, 'Dic');

  // En 2026 (hasta Noviembre), Diciembre debe figurar como futuro sin inventar datos en cero
  const dec = series2026.months[11];
  assert.equal(dec.hasData, false, 'Diciembre 2026 no debe tener datos ficticios');
  assert.equal(dec.isFuture, true, 'Diciembre 2026 debe estar marcado como futuro');
  assert.equal(dec.value, null, 'El valor de Diciembre debe ser null');

  // En 2025 (año completo), debe contener datos históricos reales
  const series2025 = KpiEvolution.extractMonthlySeries(db, desc, 2025);
  assert.equal(series2025.year, 2025);
  const activeMonths = series2025.months.filter(m => m.hasData);
  assert.ok(activeMonths.length > 0, '2025 debe registrar meses con actividad');
});

test('KPI Evolution: Generación de SVG con 12 meses y puntos interactivos', () => {
  const desc = { id: 'ingresos_ventas', type: 'executive', name: 'Ingresos por Ventas', unit: '$' };
  const series = KpiEvolution.extractMonthlySeries(db, desc, 2026);
  const svgHtml = KpiEvolution.renderChartSvg(series);

  assert.ok(svgHtml.includes('<svg'), 'Debe generar un elemento SVG');
  assert.ok(svgHtml.includes('Ene'), 'Debe incluir etiqueta de Enero');
  assert.ok(svgHtml.includes('Dic'), 'Debe incluir etiqueta de Diciembre');
  assert.ok(svgHtml.includes('kpi-chart-point'), 'Debe contener puntos interactivos');
  assert.ok(svgHtml.includes('kpi-interactive-tooltip'), 'Debe incluir contenedor de tooltip');
});

test('KPI Evolution: Generación de Drawer con selector de año condicional', () => {
  const desc = { id: 'ingresos_ventas', type: 'executive', name: 'Ingresos por Ventas', unit: '$' };
  const series = KpiEvolution.extractMonthlySeries(db, desc, 2026);
  const drawerHtml = KpiEvolution.renderDrawerHtml(series);

  assert.ok(drawerHtml.includes('kpi-chart-drawer'), 'Debe tener la clase del drawer');
  assert.ok(drawerHtml.includes('kpi-year-select'), 'Debe contener el selector desplegable');
  assert.ok(drawerHtml.includes('value="2026" selected'), '2026 debe estar seleccionado por defecto');
  assert.ok(drawerHtml.includes('value="2025"'), 'Debe contener opción 2025');
  assert.ok(drawerHtml.includes('value="2024"'), 'Debe contener opción 2024');
  assert.ok(drawerHtml.includes('kpi-close-drawer-btn'), 'Debe tener botón de cierre');
});

test('KPI Evolution: Cobertura integral de todos los módulos y tarjetas del ERP', () => {
  const sampleLabels = [
    { label: 'Margen Consolidado', expectedId: 'margen_consolidado' },
    { label: 'Ingresos Ventas', expectedId: 'ingresos_ventas' },
    { label: 'Ganadería · Margen Gestión', expectedId: 'margen_ganadero' },
    { label: 'Agricultura · Margen Gestión', expectedId: 'margen_agricola' },
    { label: 'Bovinos Totales', expectedId: 'bov_stock' },
    { label: 'Ovinos Totales', expectedId: 'ovi_stock' },
    { label: 'Hacienda Total', expectedId: 'hacienda_total' },
    { label: 'Destetados · camadas cerradas', expectedId: 'pigs_weaned' },
    { label: 'Superficie Maíz', expectedId: 'superficie_maiz' },
    { label: 'Superficie Soja', expectedId: 'superficie_soja' },
    { label: 'Rinde Promedio', expectedId: 'rinde_promedio' },
    { label: 'Alimento Consumido', expectedId: 'alimento_consumido' },
    { label: 'Tratamientos registrados', expectedId: 'tratamientos_count' },
    { label: 'Inversión en sanidad', expectedId: 'inversion_sanidad' },
    { label: 'Lluvias Últimos 7 Días', expectedId: 'rainfall_month' },
    { label: 'Campaña Agrícola (2025/2026)', expectedId: 'rainfall_month' }
  ];

  for (const item of sampleLabels) {
    const mockCard = {
      getAttribute: (attr) => attr === 'data-kpi-label' ? item.label : null,
      querySelector: () => ({ textContent: item.label })
    };
    const desc = KpiEvolution.resolveKpiDescriptor(mockCard);
    assert.equal(desc.id, item.expectedId, `Descriptor de ${item.label} debe ser ${item.expectedId}`);

    const series = KpiEvolution.extractMonthlySeries(db, desc, 2026);
    const activeMonths = series.months.filter(m => m.hasData && m.value != null);
    assert.ok(activeMonths.length >= 10, `${item.label} debe tener al menos 10 meses activos en 2026`);

    const svg = KpiEvolution.renderChartSvg(series);
    assert.ok(svg.includes('<svg'), `Debe renderizar SVG válido para ${item.label}`);
    assert.ok(!svg.includes('No se registran datos disponibles'), `No debe mostrar mensaje vacío para ${item.label}`);
  }
});
