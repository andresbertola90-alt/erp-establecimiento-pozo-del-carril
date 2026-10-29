'use strict';

const fs = require('node:fs');
const path = require('node:path');
const UNRC = require('../domain.js');

const THRESHOLDS_FILE = path.join(__dirname, '..', 'data', 'alert-thresholds.json');

const DEFAULT_THRESHOLDS = {
  weighingDaysThreshold: 20,
  priceQuoteDaysThreshold: 30,
  lowStockThresholdKg: 500,
  icaWarningThreshold: 3.20,
  sanitaryWarningActive: true
};

function ensureDataDir() {
  const dir = path.dirname(THRESHOLDS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadThresholds() {
  ensureDataDir();
  if (fs.existsSync(THRESHOLDS_FILE)) {
    try {
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(fs.readFileSync(THRESHOLDS_FILE, 'utf8')) };
    } catch {
      return { ...DEFAULT_THRESHOLDS };
    }
  }
  return { ...DEFAULT_THRESHOLDS };
}

function saveThresholds(updates) {
  ensureDataDir();
  const current = loadThresholds();
  const merged = { ...current, ...updates };
  const tmp = THRESHOLDS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, THRESHOLDS_FILE);
  return merged;
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function computeAlerts(db) {
  const thresholds = loadThresholds();
  const alerts = [];
  const today = new Date().toISOString().slice(0, 10);

  // 1. Sanitary withdrawal periods (Carencia sanitaria)
  const activeTreatments = (db.movements || []).filter(m =>
    !m.voided &&
    m.type === 'tratamiento' &&
    m.withdrawalEndDate &&
    m.withdrawalEndDate >= today
  );

  for (const t of activeTreatments) {
    const lot = (db.lots || []).find(l => l.id === t.lotId);
    const lotName = lot ? lot.name : t.lotId;
    const remainingDays = daysBetween(today, t.withdrawalEndDate);
    alerts.push({
      id: `carencia_${t.id}`,
      type: 'sanitary',
      level: 'danger',
      title: 'Período de carencia sanitaria activo',
      message: `Lote "${lotName}" tratado con ${t.medication || 'medicamento'} (${t.activeIngredient || 'sin principio activo especificado'}). Carencia hasta el ${t.withdrawalEndDate} (${remainingDays} días restantes). Venta a faena bloqueada.`,
      targetTable: 'lots',
      targetId: t.lotId,
      date: t.date,
      endDate: t.withdrawalEndDate
    });
  }

  // 2. Lack of weighing in growing/finishing lots
  const activeLots = (db.lots || []).filter(l => !l.voided);
  for (const lot of activeLots) {
    const weighings = (db.movements || []).filter(m => !m.voided && m.lotId === lot.id && (m.type === 'pesaje' || (m.type === 'traslado' && m.weight)));
    const lastWeighingDate = weighings.length
      ? weighings.map(w => w.date).sort().at(-1)
      : lot.date;

    if (lastWeighingDate) {
      const daysSinceWeight = daysBetween(lastWeighingDate, today);
      if (daysSinceWeight > thresholds.weighingDaysThreshold) {
        alerts.push({
          id: `pesaje_${lot.id}`,
          type: 'production',
          level: 'warning',
          title: 'Pesaje pendiente',
          message: `Lote "${lot.name}" (${lot.phase || lot.bioStage}) lleva ${daysSinceWeight} días sin pesaje registrado (último: ${lastWeighingDate}).`,
          targetTable: 'lots',
          targetId: lot.id,
          date: lastWeighingDate
        });
      }
    }
  }

  // 3. Stale prices / market quotes
  const latestPrice = (db.prices || []).filter(p => !p.voided).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestPrice) {
    const daysSincePrice = daysBetween(latestPrice.date, today);
    if (daysSincePrice > thresholds.priceQuoteDaysThreshold) {
      alerts.push({
        id: `precio_${latestPrice.id}`,
        type: 'market',
        level: 'warning',
        title: 'Cotización orientativa desactualizada',
        message: `La cotización de referencia (${latestPrice.product} - ${latestPrice.source}) tiene ${daysSincePrice} días de antigüedad (${latestPrice.date}).`,
        targetTable: 'prices',
        targetId: latestPrice.id,
        date: latestPrice.date
      });
    }
  }

  // 4. Low feed stock
  const state = UNRC.replay(db, today);
  if (state && state.stock) {
    for (const [prodId, data] of Object.entries(state.stock)) {
      const prod = (db.products || []).find(p => p.id === prodId && !p.voided);
      if (prod && ['grano', 'alimento'].includes(prod.kind) && data.quantity < thresholds.lowStockThresholdKg) {
        alerts.push({
          id: `stock_${prodId}`,
          type: 'inventory',
          level: data.quantity <= 0 ? 'danger' : 'warning',
          title: data.quantity <= 0 ? 'Existencia agotada' : 'Existencia baja de insumo',
          message: `El insumo "${prod.name}" tiene ${Math.round(data.quantity)} ${prod.unit} en existencias (por debajo del umbral de ${thresholds.lowStockThresholdKg} ${prod.unit}).`,
          targetTable: 'products',
          targetId: prodId,
          quantity: data.quantity
        });
      }
    }
  }

  // 5. Productive deviations: ICA (Feed conversion ratio)
  if (state && state.indicators && state.indicators.ica) {
    const ica = state.indicators.ica;
    if (Number.isFinite(ica) && ica > thresholds.icaWarningThreshold) {
      alerts.push({
        id: 'ica_global',
        type: 'production',
        level: 'warning',
        title: 'Índice de Conversión Alimenticia (ICA) elevado',
        message: `El ICA global actual es de ${ica.toFixed(2)} kg alimento / kg ganado, superior al umbral esperado de ${thresholds.icaWarningThreshold.toFixed(2)}.`,
        targetTable: 'lots',
        targetId: ''
      });
    }
  }

  return alerts;
}

module.exports = {
  loadThresholds,
  saveThresholds,
  computeAlerts
};
