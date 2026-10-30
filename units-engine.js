/**
 * ERP Agropecuario — Establecimiento Pozo del Carril
 * MÓDULO DE ESTANDARIZACIÓN DE UNIDADES DE MEDIDA Y PESOS (MODIFICACIÓN 10)
 * 
 * Define criterios uniformes, factores de conversión matemáticos y validaciones
 * para agricultura (maíz y soja), ganadería (porcinos, bovinos y ovinos),
 * comercialización e inventarios.
 * 
 * Isomórfico: Funciona en Node.js (CommonJS) y en el navegador (window.UNRCUnits).
 */
(function (root) {
  'use strict';

  // Catálogo oficial de unidades estandarizadas del establecimiento
  const STANDARDS = {
    agriculture: {
      title: 'Agricultura (Maíz y Soja · 200 ha mixtas)',
      units: [
        { key: 'surface', concept: 'Superficie sembrada y cosechada', unit: 'ha', name: 'Hectáreas', symbol: 'ha', decimals: 1, base: true, example: '45,0 ha' },
        { key: 'production_kg', concept: 'Producción física de granos', unit: 'kg', name: 'Kilogramos', symbol: 'kg', decimals: 0, base: true, example: '382.500 kg' },
        { key: 'production_t', concept: 'Producción consolidada en acopio', unit: 't', name: 'Toneladas métricas', symbol: 't', decimals: 2, rule: '1 t = 1.000 kg', example: '382,50 t' },
        { key: 'yield_kgha', concept: 'Rendimiento por unidad de superficie', unit: 'kg/ha', name: 'Kilogramos por hectárea', symbol: 'kg/ha', decimals: 0, base: true, example: '8.500 kg/ha' },
        { key: 'yield_tha', concept: 'Rendimiento agronómico en toneladas', unit: 't/ha', name: 'Toneladas por hectárea', symbol: 't/ha', decimals: 2, rule: '1 t/ha = 1.000 kg/ha = 10 qq/ha', example: '8,50 t/ha' },
        { key: 'yield_qqha', concept: 'Rendimiento en quintales (referencia comercial)', unit: 'qq/ha', name: 'Quintales por hectárea', symbol: 'qq/ha', decimals: 1, rule: '1 qq = 100 kg', example: '85,0 qq/ha' },
        { key: 'seeds', concept: 'Semillas para siembra', unit: 'kg / unidades', name: 'Kilogramos o bolsas/unidades', symbol: 'kg / bolsa', decimals: 0, rule: 'Según producto (kg o semillas/bolsa)', example: '60.000 pl/ha o 20 kg/ha' },
        { key: 'fertilizers', concept: 'Fertilizantes sólidos y líquidos', unit: 'kg / L', name: 'Kilogramos o Litros', symbol: 'kg / L', decimals: 2, rule: 'Sólidos en kg, líquidos en L', example: '120 kg/ha Urea o 80 L/ha Solmix' },
        { key: 'phytosanitary', concept: 'Productos fitosanitarios y agroquímicos', unit: 'L / mL / kg', name: 'Litros, Mililitros o Kilogramos', symbol: 'L / mL / kg', decimals: 2, rule: '1 L = 1.000 mL', example: '2,5 L/ha o 350 mL/ha' }
      ]
    },
    livestock: {
      title: 'Ganadería (Porcinos, Bovinos y Ovinos)',
      units: [
        { key: 'heads', concept: 'Existencias físicas y censos de animales', unit: 'cabezas', name: 'Cabezas', symbol: 'cab', decimals: 0, base: true, example: '240 cab' },
        { key: 'avg_weight', concept: 'Peso individual por animal', unit: 'kg/cabeza', name: 'Kilogramos por cabeza', symbol: 'kg/cab', decimals: 1, base: true, example: '105,5 kg/cab' },
        { key: 'total_weight', concept: 'Peso total en pie de lote / tropa', unit: 'kg', name: 'Kilogramos vivos totales', symbol: 'kg vivos', decimals: 0, rule: 'Peso total = Cabezas × Peso individual', example: '25.320 kg vivos' },
        { key: 'adg_kg', concept: 'Ganancia Diaria de Peso (GDP / ADG)', unit: 'kg/día', name: 'Kilogramos por día', symbol: 'kg/día', decimals: 3, base: true, example: '0,880 kg/día' },
        { key: 'adg_g', concept: 'Ganancia Diaria en gramos', unit: 'g/día', name: 'Gramos por día', symbol: 'g/día', decimals: 0, rule: '1 kg/día = 1.000 g/día', example: '880 g/día' },
        { key: 'feed_kg', concept: 'Consumo de alimento, granos y ración', unit: 'kg', name: 'Kilogramos', symbol: 'kg', decimals: 0, base: true, rule: 'Bolsas convertidas por factor kgPerBag', example: '1.250 kg de maíz' },
        { key: 'ica', concept: 'Índice de Conversión Alimenticia (ICA)', unit: 'kg alim / kg ganancia', name: 'ICA (Conversión)', symbol: 'kg/kg', decimals: 2, rule: 'ICA = Alimento consumido (kg) / Ganancia de peso (kg)', example: '2,85 kg/kg' },
        { key: 'mortality_heads', concept: 'Bajas biológicas y mortandad', unit: 'cabezas', name: 'Cabezas', symbol: 'cab', decimals: 0, example: '4 cab' },
        { key: 'mortality_pct', concept: 'Tasa porcentual de mortandad', unit: '%', name: 'Porcentaje de mortandad', symbol: '%', decimals: 2, rule: 'Mortandad % = (Bajas / Total expuesto) × 100', example: '2,15 %' }
      ]
    },
    commercial: {
      title: 'Comercialización e Inventarios',
      units: [
        { key: 'grain_comm', concept: 'Cereales comercializados o transferidos', unit: 'kg / t', name: 'Kilogramos o Toneladas', symbol: 'kg / t', decimals: 2, rule: '1 t = 1.000 kg', example: '30 t = 30.000 kg' },
        { key: 'livestock_comm', concept: 'Venta de hacienda en pie', unit: 'cabezas y kg vivos', name: 'Cabezas y Kilos vivos', symbol: 'cab / kg', decimals: 1, rule: 'Liquidación por kg vivo o por cabeza', example: '110 capones · 108 kg/cab = 11.880 kg' },
        { key: 'supplies', concept: 'Insumos agropecuarios y medicamentos', unit: 'unidad / kg / L / bolsa / dosis', name: 'Unidad comercial definida', symbol: 'unid/kg/L/bolsa', decimals: 2, example: 'Bolsa 25 kg, Bidón 20 L, Frasco 100 mL' },
        { key: 'prices', concept: 'Precios de cotización y liquidación', unit: 'ARS por unidad de medida', name: 'Pesos por unidad correspondiente', symbol: '$ / unid', decimals: 2, rule: '$/kg, $/t ($/t = $/kg × 1000), $/cab, $/L, $/bolsa', example: '$ 2.250,00 / kg vivo' }
      ]
    }
  };

  // Rangos de referencia agronómicos y zootécnicos del establecimiento (Pozo del Carril)
  const REFERENCE_RANGES = {
    yield_maiz_kg: { min: 3000, max: 14000, label: 'Maíz: Rendimiento razonable 3.000 a 14.000 kg/ha (3 a 14 t/ha)' },
    yield_soja_kg: { min: 1200, max: 5500, label: 'Soja: Rendimiento razonable 1.200 a 5.500 kg/ha (1,2 a 5,5 t/ha)' },
    pig_slaughter_weight: { min: 85, max: 125, label: 'Porcinos terminados a faena: 85 a 125 kg vivo (objetivo 90-110 kg)' },
    bov_slaughter_weight: { min: 360, max: 480, label: 'Novillos terminados a faena: 360 a 480 kg vivo (objetivo 380-420 kg)' },
    ovi_slaughter_weight: { min: 28, max: 45, label: 'Corderos pesados Dorper a faena: 28 a 45 kg vivo (objetivo 32-38 kg)' },
    pig_adg_g: { min: 250, max: 1200, label: 'GDP Porcina: 250 a 1.200 g/día según fase' },
    bov_adg_g: { min: 400, max: 1700, label: 'GDP Bovina: 400 a 1.700 g/día (pastoril o feedlot)' },
    pig_ica: { min: 1.4, max: 4.2, label: 'ICA Porcino esperado: 1,4 a 4,2 kg alimento / kg ganado' }
  };

  // Ayudantes de números
  const num = v => v === '' || v == null ? 0 : Number(v);
  const round = (v, d = 2) => {
    const factor = Math.pow(10, d);
    return Math.round((Number(v) + Number.EPSILON) * factor) / factor;
  };

  /**
   * CONVERSIONES MATEMÁTICAS AUTOMÁTICAS
   */

  // 1. Kilogramos <-> Toneladas
  function kgToTonnes(kg) {
    if (kg == null || isNaN(kg)) return 0;
    return round(num(kg) / 1000, 4);
  }

  function tonnesToKg(tonnes) {
    if (tonnes == null || isNaN(tonnes)) return 0;
    return round(num(tonnes) * 1000, 2);
  }

  // 2. Rendimientos Agrícolas (kg/ha, t/ha, qq/ha)
  function calcYield({ hectares, productionKg, productionTons }) {
    const ha = num(hectares);
    if (ha <= 0) return { kgHa: 0, tonHa: 0, qqHa: 0 };

    let totalKg = 0;
    if (productionKg != null && productionKg !== '') {
      totalKg = num(productionKg);
    } else if (productionTons != null && productionTons !== '') {
      totalKg = num(productionTons) * 1000;
    }

    const kgHa = round(totalKg / ha, 1);
    const tonHa = round(kgHa / 1000, 3);
    const qqHa = round(kgHa / 100, 2); // 1 quintal = 100 kg

    return { kgHa, tonHa, qqHa, totalKg, hectares: ha };
  }

  function yieldKgHaToTonHa(kgHa) {
    return round(num(kgHa) / 1000, 3);
  }

  function yieldTonHaToKgHa(tonHa) {
    return round(num(tonHa) * 1000, 1);
  }

  function yieldKgHaToQqHa(kgHa) {
    return round(num(kgHa) / 100, 2);
  }

  function yieldQqHaToKgHa(qqHa) {
    return round(num(qqHa) * 100, 1);
  }

  // 3. Líquidos / Agroquímicos (L <-> mL)
  function litersToMl(liters) {
    return round(num(liters) * 1000, 2);
  }

  function mlToLiters(ml) {
    return round(num(ml) / 1000, 4);
  }

  // 4. Ganancia Diaria de Peso (GDP / ADG: kg/día <-> g/día)
  function kgPerDayToGPerDay(kgPerDay) {
    return round(num(kgPerDay) * 1000, 1);
  }

  function gPerDayToKgPerDay(gPerDay) {
    return round(num(gPerDay) / 1000, 4);
  }

  function calcDailyGain({ initialWeight, finalWeight, days }) {
    const d = num(days);
    if (d <= 0) return null;
    const gainKg = num(finalWeight) - num(initialWeight);
    const kgPerDay = round(gainKg / d, 4);
    const gPerDay = round(kgPerDay * 1000, 1);
    return { gainKg: round(gainKg, 2), kgPerDay, gPerDay, days: d };
  }

  // 5. Peso individual vs Peso Total en Pie
  function calcTotalWeight({ heads, avgWeightKg }) {
    const h = num(heads);
    const w = num(avgWeightKg);
    return round(h * w, 2);
  }

  function calcAvgWeight({ totalWeightKg, heads }) {
    const h = num(heads);
    if (h <= 0) return 0;
    return round(num(totalWeightKg) / h, 2);
  }

  // 6. Bolsas e Insumos <-> Kilogramos
  function bagsToKg(bags, kgPerBag) {
    const b = num(bags);
    const f = num(kgPerBag);
    if (f <= 0) return b;
    return round(b * f, 2);
  }

  function kgToBags(kg, kgPerBag) {
    const k = num(kg);
    const f = num(kgPerBag);
    if (f <= 0) return 0;
    return round(k / f, 2);
  }

  // 7. Precios de Comercialización ($/kg <-> $/t)
  function priceKgToPriceTonne(priceKg) {
    return round(num(priceKg) * 1000, 2);
  }

  function priceTonneToPriceKg(priceTonne) {
    return round(num(priceTonne) / 1000, 4);
  }

  function calcLivestockSaleValues({ heads, avgWeightKg, pricePerKg, pricePerHead }) {
    const h = num(heads);
    const w = num(avgWeightKg);
    const totalWeight = round(h * w, 2);

    let priceKg = num(pricePerKg);
    let priceHead = num(pricePerHead);

    if (priceKg > 0 && priceHead <= 0) {
      priceHead = round(priceKg * w, 2);
    } else if (priceHead > 0 && priceKg <= 0 && w > 0) {
      priceKg = round(priceHead / w, 4);
    }

    const gross = round(totalWeight > 0 && priceKg > 0 ? totalWeight * priceKg : h * priceHead, 2);

    return {
      heads: h,
      avgWeightKg: w,
      totalWeightKg: totalWeight,
      pricePerKg: priceKg,
      pricePerHead: priceHead,
      grossAmount: gross
    };
  }

  // 8. Conversión Alimenticia (ICA)
  function calcICA({ feedConsumedKg, weightGainedKg }) {
    const gain = num(weightGainedKg);
    const feed = num(feedConsumedKg);
    if (gain <= 0 || feed <= 0) return null;
    return round(feed / gain, 2);
  }

  // 9. Mortandad
  function calcMortality({ deaths, totalExposed }) {
    const d = num(deaths);
    const t = num(totalExposed);
    if (t <= 0) return { deaths: d, ratePercent: null };
    return {
      deaths: d,
      totalExposed: t,
      ratePercent: round((d / t) * 100, 2)
    };
  }

  /**
   * NORMALIZACIÓN Y RECONOCIMIENTO DE UNIDADES
   */
  function normalizeUnit(unitStr) {
    if (!unitStr) return '';
    const clean = String(unitStr).trim().toLowerCase().replace(/[\.\s]/g, '');
    const map = {
      // Peso
      kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
      t: 't', tn: 't', ton: 't', tonelada: 't', toneladas: 't',
      g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
      qq: 'qq', quintal: 'qq', quintales: 'qq',
      // Superficie
      ha: 'ha', has: 'ha', hectarea: 'ha', hectareas: 'ha',
      // Volumen
      l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L',
      ml: 'mL', cc: 'mL', cm3: 'mL', mililitro: 'mL', mililitros: 'mL',
      // Animales
      cab: 'cab', cabeza: 'cab', cabezas: 'cab', animal: 'cab', animales: 'cab',
      // Presentación comercial
      bolsa: 'bolsa', bolsas: 'bolsa',
      dosis: 'dosis',
      unid: 'unidad', unidad: 'unidad', unidades: 'unidad', u: 'unidad'
    };
    return map[clean] || unitStr.trim();
  }

  /**
   * FORMATO ARGENTINO DE TEXTO PARA PRESENTACIÓN DUAL
   */
  const fmt = (v, maxDigits = 2, minDigits = 0) => {
    if (v == null || !Number.isFinite(Number(v))) return '-';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    }).format(Number(v));
  };

  function formatGrainWeight(kg, fixedDecimals = false) {
    const k = num(kg);
    const t = round(k / 1000, 2);
    const tStr = fixedDecimals ? fmt(t, 2, 2) : fmt(t, 2);
    return `${fmt(k, 0)} kg (${tStr} t)`;
  }

  function formatYieldDual(kgHa, fixedDecimals = false) {
    const k = num(kgHa);
    const t = round(k / 1000, 2);
    const qq = round(k / 100, 1);
    const tStr = fixedDecimals ? fmt(t, 2, 2) : fmt(t, 2);
    const qqStr = fixedDecimals ? fmt(qq, 1, 1) : fmt(qq, 1);
    return `${fmt(k, 0)} kg/ha (${tStr} t/ha · ${qqStr} qq/ha)`;
  }

  function formatDailyGainDual(kgDay, fixedDecimals = false) {
    const k = num(kgDay);
    const g = round(k * 1000, 0);
    const kStr = fixedDecimals ? fmt(k, 3, 3) : fmt(k, 3);
    return `${kStr} kg/día (${fmt(g, 0)} g/día)`;
  }

  function formatLiquidDual(liters, fixedDecimals = false) {
    const l = num(liters);
    const lStr = fixedDecimals ? fmt(l, 2, 2) : fmt(l, 2);
    if (l < 1) {
      return `${fmt(l * 1000, 0)} mL (${lStr} L)`;
    }
    return `${lStr} L (${fmt(l * 1000, 0)} mL)`;
  }

  function formatLivestockBatch({ heads, avgWeightKg }, fixedDecimals = false) {
    const h = num(heads);
    const w = num(avgWeightKg);
    const total = round(h * w, 0);
    const wStr = fixedDecimals ? fmt(w, 1, 1) : fmt(w, 1);
    return `${fmt(h, 0)} cab · ${wStr} kg/cab (${fmt(total, 0)} kg en pie)`;
  }

  function formatPriceUnit(amount, unit) {
    const a = fmt(amount, 2);
    const norm = normalizeUnit(unit);
    const labels = {
      kg: '$ / kg vivo',
      t: '$ / tonelada',
      cab: '$ / cabeza',
      L: '$ / Litro',
      bolsa: '$ / bolsa',
      dosis: '$ / dosis',
      ha: '$ / ha'
    };
    return `$ ${a} ${labels[norm] || ('/ ' + (unit || 'unid'))}`;
  }

  /**
   * VERIFICACIONES Y ADVERTENCIAS DE RANGOS
   */
  function validateCropYield(crop, kgHa) {
    const val = num(kgHa);
    const c = String(crop || '').toLowerCase();
    if (val <= 0) return { ok: false, message: 'El rendimiento debe ser mayor a cero.' };

    if (c.includes('maiz') || c.includes('maíz')) {
      if (val < 2000 || val > 16000) {
        return { ok: false, warning: true, message: `Rendimiento de maíz atípico: ${fmt(val, 0)} kg/ha (${fmt(val/1000, 2)} t/ha). Rango típico: 3.000 a 14.000 kg/ha.` };
      }
    } else if (c.includes('soja')) {
      if (val < 800 || val > 6500) {
        return { ok: false, warning: true, message: `Rendimiento de soja atípico: ${fmt(val, 0)} kg/ha (${fmt(val/1000, 2)} t/ha). Rango típico: 1.200 a 5.500 kg/ha.` };
      }
    }
    return { ok: true };
  }

  function validateSlaughterWeight(species, avgWeightKg) {
    const w = num(avgWeightKg);
    const sp = String(species || '').toLowerCase();
    if (w <= 0) return { ok: false, message: 'El peso promedio debe ser mayor a cero.' };

    if (sp.includes('porc') || sp.includes('cerd')) {
      if (w < 70 || w > 140) {
        return { ok: false, warning: true, message: `Peso de capón fuera de rango comercial: ${fmt(w, 1)} kg. El rango óptimo es 90 a 110 kg vivo.` };
      }
    } else if (sp.includes('bov')) {
      if (w < 320 || w > 550) {
        return { ok: false, warning: true, message: `Peso de novillo fuera de rango de faena: ${fmt(w, 1)} kg. Rango típico de terminación: 380 a 440 kg vivo.` };
      }
    } else if (sp.includes('ovi')) {
      if (w < 25 || w > 50) {
        return { ok: false, warning: true, message: `Peso de cordero pesado fuera de rango: ${fmt(w, 1)} kg. Rango objetivo Dorper: 32 a 38 kg vivo.` };
      }
    }
    return { ok: true };
  }

  const api = {
    STANDARDS,
    REFERENCE_RANGES,
    // Conversiones numéricas
    kgToTonnes,
    tonnesToKg,
    calcYield,
    yieldKgHaToTonHa,
    yieldTonHaToKgHa,
    yieldKgHaToQqHa,
    yieldQqHaToKgHa,
    litersToMl,
    mlToLiters,
    kgPerDayToGPerDay,
    gPerDayToKgPerDay,
    calcDailyGain,
    calcTotalWeight,
    calcAvgWeight,
    bagsToKg,
    kgToBags,
    priceKgToPriceTonne,
    priceTonneToPriceKg,
    calcLivestockSaleValues,
    calcICA,
    calcMortality,
    // Formato y normalización
    normalizeUnit,
    fmt,
    formatGrainWeight,
    formatYieldDual,
    formatDailyGainDual,
    formatLiquidDual,
    formatLivestockBatch,
    formatPriceUnit,
    // Validaciones
    validateCropYield,
    validateSlaughterWeight
  };

  root.UNRCUnits = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
