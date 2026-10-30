/**
 * ERP Agropecuario Establecimiento Pozo del Carril · UNRC FCE
 * semaphore-engine.js — Sistema Integral de Semaforización de Indicadores (Modificación 11)
 *
 * Niveles de Evaluación:
 *  - VERDE (NORMAL): Indicador dentro del rango esperado / objetivo alcanzado.
 *  - AMARILLO (ATENCIÓN): Desviación moderada respecto del objetivo establecido.
 *  - ROJO (CRÍTICO): Desviación significativa que requiere intervención o revisión urgente.
 *  - GRIS (SIN DATOS): Información insuficiente para calcular o evaluar el indicador.
 *
 * Módulos integrados:
 *  - Agricultura: Maíz y Soja (200 ha mixtas)
 *  - Ganadería: Porcinos, Bovinos y Ovinos
 *  - Comercial y Financiero: Ventas, Cobranzas, Pagos, Margen, Stock Crítico, Caja
 */
(function (root) {
  'use strict';

  // Catálogo Oficial de Reglas y Umbrales Institucionales UNRC Pozo del Carril
  const DEFAULT_SEMAPHORE_RULES = [
    // --- 1. AGRICULTURA: MAÍZ ---
    {
      id: 'agri_yield_corn',
      name: 'Rendimiento Obtenido Maíz',
      sector: 'agricultura',
      module: 'maiz',
      unit: 'kg/ha',
      direction: 'higher_is_better',
      target: 8500, // 8.500 kg/ha (85 qq/ha)
      warningThreshold: 7225, // 85% de la meta (72,25 qq/ha)
      criticalThreshold: 6000,
      description: 'Meta técnica agronómica de maíz en zona núcleo UNRC (8.500 kg/ha). Verde ≥ 100%, Amarillo 85-99.9%, Rojo < 85%.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_target_pct_corn',
      name: 'Cumplimiento Rendimiento Maíz s/ Meta',
      sector: 'agricultura',
      module: 'maiz',
      unit: '%',
      direction: 'higher_is_better',
      target: 100.0,
      warningThreshold: 85.0,
      criticalThreshold: 70.0,
      description: 'Porcentaje de rendimiento real frente a la meta presupuestada (100%).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_cost_per_ha_corn',
      name: 'Costo Directo por Hectárea Maíz',
      sector: 'agricultura',
      module: 'maiz',
      unit: 'ARS/ha',
      direction: 'lower_is_better',
      target: 650000, // $ 650.000 / ha
      warningThreshold: 715000, // +10% de desvío
      criticalThreshold: 780000, // > +20%
      description: 'Costo de semilla, fertilizante y labores por hectárea. Verde ≤ Meta, Amarillo hasta +10%, Rojo > +10%.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_cost_per_tonne_corn',
      name: 'Costo por Tonelada Cosechada Maíz',
      sector: 'agricultura',
      module: 'maiz',
      unit: 'ARS/t',
      direction: 'lower_is_better',
      target: 80000, // $ 80.000 / t
      warningThreshold: 88000, // +10%
      criticalThreshold: 96000,
      description: 'Costo directo por tonelada producida de grano seco en silo.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_margin_ha_corn',
      name: 'Margen Bruto por Hectárea Maíz',
      sector: 'agricultura',
      module: 'maiz',
      unit: 'ARS/ha',
      direction: 'higher_is_better',
      target: 450000, // $ 450.000 / ha
      warningThreshold: 360000, // 80% del objetivo
      criticalThreshold: 200000,
      description: 'Ingresos por grano y transferencias a VNR menos costos directos por hectárea.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_prod_plan_corn',
      name: 'Cumplimiento Producción Planificada Maíz',
      sector: 'agricultura',
      module: 'maiz',
      unit: '%',
      direction: 'higher_is_better',
      target: 100.0,
      warningThreshold: 85.0,
      criticalThreshold: 70.0,
      description: 'Toneladas cosechadas reales vs. volumen planificado en campaña.',
      effectiveDate: '2026-01-01'
    },

    // --- 2. AGRICULTURA: SOJA ---
    {
      id: 'agri_yield_soy',
      name: 'Rendimiento Obtenido Soja',
      sector: 'agricultura',
      module: 'soja',
      unit: 'kg/ha',
      direction: 'higher_is_better',
      target: 3200, // 3.200 kg/ha (32 qq/ha)
      warningThreshold: 2720, // 85% de la meta (27,2 qq/ha)
      criticalThreshold: 2200,
      description: 'Meta técnica agronómica de soja en rotación (3.200 kg/ha). Verde ≥ 100%, Amarillo 85-99.9%, Rojo < 85%.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_target_pct_soy',
      name: 'Cumplimiento Rendimiento Soja s/ Meta',
      sector: 'agricultura',
      module: 'soja',
      unit: '%',
      direction: 'higher_is_better',
      target: 100.0,
      warningThreshold: 85.0,
      criticalThreshold: 70.0,
      description: 'Porcentaje de rendimiento real de soja respecto de la meta presupuestada.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_cost_per_ha_soy',
      name: 'Costo Directo por Hectárea Soja',
      sector: 'agricultura',
      module: 'soja',
      unit: 'ARS/ha',
      direction: 'lower_is_better',
      target: 420000, // $ 420.000 / ha
      warningThreshold: 462000, // +10%
      criticalThreshold: 504000,
      description: 'Insumos, siembra e inoculación por hectárea sembrada de soja.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_cost_per_tonne_soy',
      name: 'Costo por Tonelada Cosechada Soja',
      sector: 'agricultura',
      module: 'soja',
      unit: 'ARS/t',
      direction: 'lower_is_better',
      target: 135000, // $ 135.000 / t
      warningThreshold: 148500, // +10%
      criticalThreshold: 165000,
      description: 'Costo directo por tonelada de soja limpia cosechada.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_margin_ha_soy',
      name: 'Margen Bruto por Hectárea Soja',
      sector: 'agricultura',
      module: 'soja',
      unit: 'ARS/ha',
      direction: 'higher_is_better',
      target: 350000, // $ 350.000 / ha
      warningThreshold: 280000, // 80% del objetivo
      criticalThreshold: 150000,
      description: 'Resultado económico neto de retenciones por hectárea de soja.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'agri_prod_plan_soy',
      name: 'Cumplimiento Producción Planificada Soja',
      sector: 'agricultura',
      module: 'soja',
      unit: '%',
      direction: 'higher_is_better',
      target: 100.0,
      warningThreshold: 85.0,
      criticalThreshold: 70.0,
      description: 'Toneladas cosechadas de soja vs. plan de siembra.',
      effectiveDate: '2026-01-01'
    },

    // --- 3. GANADERÍA: PORCINOS ---
    {
      id: 'pigs_stock',
      name: 'Existencias Porcinas Totales',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'cab',
      direction: 'optimal_range',
      targetMin: 180,
      targetMax: 350,
      warningMin: 150,
      warningMax: 400,
      description: 'Capacidad de carga de instalaciones semi-intensivas Pozo del Carril (180 a 350 cabezas).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_mortality',
      name: 'Mortalidad Piara Porcina',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: '%',
      direction: 'lower_is_better',
      target: 3.0, // ≤ 3% óptimo
      warningThreshold: 5.0, // 3.1% a 5.0% advertencia
      criticalThreshold: 5.01, // > 5% crítico
      description: 'Mortalidad total en ciclo semi-intensivo. Verde ≤ 3%, Amarillo 3.1-5%, Rojo > 5%.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_avg_weight',
      name: 'Peso Promedio Faena Capones',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'kg/cab',
      direction: 'optimal_range',
      targetMin: 90.0,
      targetMax: 110.0,
      warningMin: 85.0,
      warningMax: 115.0,
      description: 'Rango comercial estándar de capón terminado para faena (90 a 110 kg/cab).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_daily_gain',
      name: 'Ganancia Diaria de Peso Porcina (GDP)',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'kg/día',
      direction: 'higher_is_better',
      target: 0.850, // 850 g/día en engorde
      warningThreshold: 0.700, // 700 g/día
      criticalThreshold: 0.550,
      description: 'Ganancia diaria zootécnica de capones en terminación. Verde ≥ 0,850 kg/d (850 g/d).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_ica',
      name: 'Conversión Alimenticia Porcina (ICA)',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'kg/kg',
      direction: 'lower_is_better',
      target: 2.80, // ≤ 2.80 kg alimento / kg ganado
      warningThreshold: 3.20, // 2.81 a 3.20 alerta
      criticalThreshold: 3.21, // > 3.20 crítico
      description: 'Índice de Conversión Alimenticia de capones. Mismo lote y período evaluado.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_cycle_days',
      name: 'Duración del Ciclo Productivo Porcino',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'días',
      direction: 'optimal_range',
      targetMin: 150,
      targetMax: 175,
      warningMin: 140,
      warningMax: 190,
      description: 'Días desde nacimiento hasta salida comercial a frigorífico (150 a 175 días).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_cost_kg_gain',
      name: 'Costo Directo por kg Ganado Porcino',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'ARS/kg',
      direction: 'lower_is_better',
      target: 1200, // $ 1.200 / kg ganado
      warningThreshold: 1350, // +12.5%
      criticalThreshold: 1500,
      description: 'Costo directo acumulado de ración y sanidad por kilo de peso vivo ganado.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'pigs_margin_per_head',
      name: 'Margen Económico por Capón Vendido',
      sector: 'ganaderia',
      module: 'porcinos',
      unit: 'ARS/cab',
      direction: 'higher_is_better',
      target: 35000, // $ 35.000 / cabeza
      warningThreshold: 25000,
      criticalThreshold: 10000,
      description: 'Margen de gestión comercial por cabeza liquidada a frigorífico.',
      effectiveDate: '2026-01-01'
    },

    // --- 4. GANADERÍA: BOVINOS ---
    {
      id: 'bov_stock',
      name: 'Existencias Bovinas en Establecimiento',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: 'cab',
      direction: 'optimal_range',
      targetMin: 60,
      targetMax: 150,
      warningMin: 40,
      warningMax: 180,
      description: 'Censo de bovinos en cría, recría y feedlot (60 a 150 cabezas).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'bov_mortality',
      name: 'Mortalidad Bovina',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: '%',
      direction: 'lower_is_better',
      target: 2.0, // ≤ 2%
      warningThreshold: 3.5, // 2.1 a 3.5%
      criticalThreshold: 3.51,
      description: 'Tasa de mortandad anual bovina. Verde ≤ 2%, Amarillo 2.1-3.5%, Rojo > 3.5%.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'bov_avg_weight',
      name: 'Peso Faena Novillos Feedlot',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: 'kg/cab',
      direction: 'optimal_range',
      targetMin: 380.0,
      targetMax: 440.0,
      warningMin: 360.0,
      warningMax: 460.0,
      description: 'Peso vivo de despacho a frigorífico de novillo terminado (380 a 440 kg/cab).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'bov_daily_gain',
      name: 'Ganancia Diaria Bovina Feedlot (GDP)',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: 'kg/día',
      direction: 'higher_is_better',
      target: 1.000, // 1 kg/día
      warningThreshold: 0.850,
      criticalThreshold: 0.700,
      description: 'Ganancia de peso en corral de engorde. Verde ≥ 1,000 kg/día.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'bov_ica',
      name: 'Conversión Alimenticia Bovina (ICA)',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: 'kg/kg',
      direction: 'lower_is_better',
      target: 6.50, // ≤ 6.5 kg alimento MS / kg ganado
      warningThreshold: 7.50,
      criticalThreshold: 7.51,
      description: 'Índice de conversión en ración bovina feedlot. Verde ≤ 6,5.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'bov_cycle_days',
      name: 'Días de Engorde a Corral Bovino',
      sector: 'ganaderia',
      module: 'bovinos',
      unit: 'días',
      direction: 'optimal_range',
      targetMin: 90,
      targetMax: 120,
      warningMin: 75,
      warningMax: 140,
      description: 'Período óptimo de permanencia en corral de terminación (90 a 120 días).',
      effectiveDate: '2026-01-01'
    },

    // --- 5. GANADERÍA: OVINOS ---
    {
      id: 'ovi_stock',
      name: 'Existencias Ovinas Totales (Raza Dorper)',
      sector: 'ganaderia',
      module: 'ovinos',
      unit: 'cab',
      direction: 'optimal_range',
      targetMin: 50,
      targetMax: 120,
      warningMin: 35,
      warningMax: 150,
      description: 'Plantel de vientres, carneros puros y corderos en absorción Dorper.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'ovi_mortality',
      name: 'Mortalidad Ovina',
      sector: 'ganaderia',
      module: 'ovinos',
      unit: '%',
      direction: 'lower_is_better',
      target: 3.0, // ≤ 3%
      warningThreshold: 5.0,
      criticalThreshold: 5.01,
      description: 'Mortandad predestete y general ovina Dorper.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'ovi_avg_weight',
      name: 'Peso Cordero Pesado a Faena',
      sector: 'ganaderia',
      module: 'ovinos',
      unit: 'kg/cab',
      direction: 'optimal_range',
      targetMin: 32.0,
      targetMax: 38.0,
      warningMin: 30.0,
      warningMax: 42.0,
      description: 'Rango comercial objetivo de cordero pesado de carne Dorper (32 a 38 kg vivo).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'ovi_daily_gain',
      name: 'Ganancia Diaria Ovina (GDP)',
      sector: 'ganaderia',
      module: 'ovinos',
      unit: 'kg/día',
      direction: 'higher_is_better',
      target: 0.220, // 220 g/día
      warningThreshold: 0.170, // 170 g/día
      criticalThreshold: 0.120,
      description: 'Ganancia diaria de peso en recría y engorde ovino (≥ 220 g/día).',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'ovi_ica',
      name: 'Conversión Alimenticia Ovina (ICA)',
      sector: 'ganaderia',
      module: 'ovinos',
      unit: 'kg/kg',
      direction: 'lower_is_better',
      target: 4.80,
      warningThreshold: 5.50,
      criticalThreshold: 5.51,
      description: 'Índice de conversión alimenticia en suplementación ovina.',
      effectiveDate: '2026-01-01'
    },

    // --- 6. COMERCIAL Y FINANCIERO ---
    {
      id: 'com_sales_volume',
      name: 'Ventas Totales del Período',
      sector: 'comercial',
      module: 'comercial',
      unit: 'ARS',
      direction: 'higher_is_better',
      target: 30000000, // $ 30.000.000 meta de período
      warningThreshold: 24000000, // 80%
      criticalThreshold: 15000000,
      description: 'Facturación comercial neta total acumulada de las 5 unidades productivas.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'com_gross_margin_pct',
      name: 'Margen Bruto sobre Ventas (%)',
      sector: 'comercial',
      module: 'comercial',
      unit: '%',
      direction: 'higher_is_better',
      target: 25.0, // ≥ 25%
      warningThreshold: 15.0, // 15 a 24.9%
      criticalThreshold: 0.0,
      description: 'Rentabilidad económica operativa: (Margen Bruto / Ventas Netas) × 100.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'fin_receivables_overdue',
      name: 'Cuentas por Cobrar Vencidas',
      sector: 'financiero',
      module: 'financiero',
      unit: 'ARS',
      direction: 'lower_is_better',
      target: 0, // $ 0 vencido ideal
      warningThreshold: 2000000, // hasta $ 2.000.000 alerta
      criticalThreshold: 5000000,
      description: 'Créditos por ventas comerciales impagos que superaron el plazo de vencimiento pactado.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'fin_payables_overdue',
      name: 'Obligaciones de Pago Vencidas',
      sector: 'financiero',
      module: 'financiero',
      unit: 'ARS',
      direction: 'lower_is_better',
      target: 0, // $ 0 vencido
      warningThreshold: 1000000, // hasta $ 1.000.000
      criticalThreshold: 3000000,
      description: 'Deudas comerciales o fiscales no canceladas en fecha de vencimiento.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'com_stock_under_min',
      name: 'Partidas bajo Stock de Reserva',
      sector: 'comercial',
      module: 'comercial',
      unit: 'partidas',
      direction: 'lower_is_better',
      target: 0,
      warningThreshold: 2, // 1 a 2 partidas alerta
      criticalThreshold: 3, // ≥ 3 partidas crítica
      description: 'Insumos críticos o reservas de grano en silo por debajo del punto de pedido.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'fin_cost_deviation',
      name: 'Desviación de Costos s/ Presupuesto',
      sector: 'financiero',
      module: 'financiero',
      unit: '%',
      direction: 'lower_is_better',
      target: 0.0, // ≤ 0% de sobrecosto
      warningThreshold: 10.0, // hasta +10% alerta
      criticalThreshold: 20.0,
      description: 'Variación de costos reales frente a la partida presupuestada: [(Real - Presup.) / Presup.] × 100.',
      effectiveDate: '2026-01-01'
    },
    {
      id: 'fin_cashflow_operating',
      name: 'Flujo de Caja Operativo Neto',
      sector: 'financiero',
      module: 'financiero',
      unit: 'ARS',
      direction: 'higher_is_better',
      target: 0, // Positivo o neutro
      warningThreshold: -1000000, // Deficitario leve
      criticalThreshold: -5000000,
      description: 'Disponibilidad financiera efectiva: Cobranzas reales menos pagos reales en el período.',
      effectiveDate: '2026-01-01'
    }
  ];

  /**
   * Obtiene la regla activa para un indicador desde db.settings o el catálogo predeterminado
   */
  function getRule(db, ruleId) {
    const def = DEFAULT_SEMAPHORE_RULES.find(r => r.id === ruleId) || null;
    const customRules = db?.settings?.semaphoreRules;
    if (!customRules) return def;
    if (Array.isArray(customRules)) {
      const found = customRules.find(r => r.id === ruleId);
      return found ? { ...(def || {}), ...found } : def;
    }
    if (typeof customRules === 'object' && customRules[ruleId]) {
      return { ...(def || {}), ...customRules[ruleId], id: ruleId };
    }
    return def;
  }

  /**
   * Obtiene todas las reglas de semaforización (combinando personalizadas con predeterminadas)
   */
  function getAllRules(db) {
    const customRules = db?.settings?.semaphoreRules;
    return DEFAULT_SEMAPHORE_RULES.map(def => {
      if (!customRules) return def;
      if (Array.isArray(customRules)) {
        const found = customRules.find(r => r.id === def.id);
        return found ? { ...def, ...found } : def;
      }
      if (typeof customRules === 'object' && customRules[def.id]) {
        return { ...def, ...customRules[def.id], id: def.id };
      }
      return def;
    });
  }

  /**
   * Evalúa el valor de un indicador frente a su regla configurada
   * @param {number|null} value Valor numérico registrado
   * @param {object} rule Regla con umbrales y sentido
   * @param {string|null} missingReason Razón en caso de faltar datos
   * @returns {object} Evaluación estructurada con estado verde, amarillo, rojo o gris
   */
  function evaluateIndicator(value, rule, missingReason = null) {
    if (!rule) {
      return {
        id: 'unknown',
        name: 'Indicador Desconocido',
        value: null,
        formattedValue: 'Sin datos',
        unit: '',
        state: 'gray',
        stateLabel: 'SIN DATOS',
        stateClass: 'gray',
        icon: 'circle-help',
        deviationPct: null,
        explanation: 'No se encontró la regla de semaforización correspondiente.',
        period: null
      };
    }

    // 1. Estado GRIS: Información insuficiente
    if (value == null || !Number.isFinite(Number(value))) {
      return {
        id: rule.id,
        ruleId: rule.id,
        name: rule.name,
        sector: rule.sector,
        module: rule.module,
        value: null,
        currentValue: null,
        formattedValue: 'Sin datos suficientes',
        unit: rule.unit,
        target: rule.target ?? (rule.targetMin != null ? `${rule.targetMin} - ${rule.targetMax}` : null),
        targetValue: rule.target,
        formattedTarget: rule.target != null ? formatValueWithUnit(rule.target, rule.unit) : (rule.targetMin != null ? `${formatNum(rule.targetMin)} a ${formatNum(rule.targetMax)} ${rule.unit}` : '-'),
        direction: rule.direction,
        state: 'gray',
        stateLabel: 'SIN DATOS',
        stateClass: 'gray',
        badgeLabel: 'SIN DATOS',
        isNormal: false,
        isWarning: false,
        isCritical: false,
        icon: 'circle-help',
        deviationPct: null,
        explanation: missingReason || 'No se registraron operaciones suficientes para calcular este indicador en el período seleccionado.',
        isAlert: false
      };
    }

    const val = Number(value);
    let state = 'green';
    let stateLabel = 'NORMAL (En Meta)';
    let icon = 'circle-check';
    let deviationPct = null;
    let explanation = '';

    // 2. Sentido: MAYOR ES MEJOR (ej. Rendimiento, Margen, GDP)
    if (rule.direction === 'higher_is_better') {
      const target = Number(rule.target || 0);
      const warn = Number(rule.warningThreshold != null ? rule.warningThreshold : target * 0.85);
      const crit = Number(rule.criticalThreshold != null ? rule.criticalThreshold : target * 0.70);

      if (target > 0) {
        deviationPct = ((val - target) / target) * 100;
      }

      if (val >= target) {
        state = 'green';
        stateLabel = 'NORMAL (Óptimo)';
        icon = 'circle-check';
        explanation = `Valor dentro del objetivo (superó meta por ${deviationPct >= 0 ? '+' : ''}${formatPct(deviationPct)}).`;
      } else if (val >= warn) {
        state = 'yellow';
        stateLabel = 'ATENCIÓN (Preventivo)';
        icon = 'alert-triangle';
        explanation = `Desviación moderada: se ubicó un ${formatPct(Math.abs(deviationPct))}% por debajo del objetivo de ${formatNum(target)} ${rule.unit}.`;
      } else {
        state = 'red';
        stateLabel = 'CRÍTICO (Desvío Significativo)';
        icon = 'circle-alert';
        explanation = `Desviación crítica: cayó un ${formatPct(Math.abs(deviationPct))}% por debajo del umbral mínimo admisible (${formatNum(warn)} ${rule.unit}).`;
      }
    }

    // 3. Sentido: MENOR ES MEJOR (ej. Costos, Mortalidad, ICA, Deudas vencidas)
    else if (rule.direction === 'lower_is_better') {
      const target = Number(rule.target || 0);
      const warn = Number(rule.warningThreshold != null ? rule.warningThreshold : (target > 0 ? target * 1.10 : 1));
      const crit = Number(rule.criticalThreshold != null ? rule.criticalThreshold : (target > 0 ? target * 1.25 : 2));

      if (target > 0) {
        deviationPct = ((val - target) / target) * 100;
      } else if (val > 0) {
        deviationPct = 100; // sobrecosto sobre meta cero
      } else {
        deviationPct = 0;
      }

      if (val <= target) {
        state = 'green';
        stateLabel = 'NORMAL (Controlado)';
        icon = 'circle-check';
        explanation = target === 0
          ? `Cumplimiento exacto: $0 en mora / sin sobrecostos.`
          : `Costo o tasa dentro del límite presupuestado (${formatPct(Math.abs(deviationPct))}% inferior a la meta).`;
      } else if (val <= warn) {
        state = 'yellow';
        stateLabel = 'ATENCIÓN (Alerta)';
        icon = 'alert-triangle';
        explanation = `Sobrecosto o desviación moderada (+${formatPct(deviationPct)}% respecto del objetivo).`;
      } else {
        state = 'red';
        stateLabel = 'CRÍTICO (Exceso)';
        icon = 'circle-alert';
        explanation = `Desviación desfavorable importante: superó el umbral crítico de ${formatNum(warn)} ${rule.unit} en +${formatPct(deviationPct)}%.`;
      }
    }

    // 4. Sentido: RANGO ÓPTIMO (ej. Pesos comerciales de faena, censo de existencias)
    else if (rule.direction === 'optimal_range') {
      const minT = Number(rule.targetMin ?? rule.minTarget ?? 0);
      const maxT = Number(rule.targetMax ?? rule.maxTarget ?? Infinity);
      const minW = Number(rule.warningMin ?? rule.warningThreshold ?? minT * 0.90);
      const maxW = Number(rule.warningMax ?? rule.criticalThreshold ?? maxT * 1.10);

      if (val >= minT && val <= maxT) {
        state = 'green';
        stateLabel = 'NORMAL (En Rango Óptimo)';
        icon = 'circle-check';
        explanation = `Dentro del rango zootécnico establecido (${minT} a ${maxT} ${rule.unit}).`;
      } else if (val >= minW && val <= maxW) {
        state = 'yellow';
        stateLabel = 'ATENCIÓN (Próximo al Límite)';
        icon = 'alert-triangle';
        const side = val < minT ? 'por debajo del mínimo' : 'por encima del máximo';
        explanation = `Valor fuera del rango óptimo (${side} de ${val < minT ? minT : maxT} ${rule.unit}).`;
      } else {
        state = 'red';
        stateLabel = 'CRÍTICO (Fuera de Rango)';
        icon = 'circle-alert';
        const side = val < minW ? 'marcadamente bajo' : 'marcadamente excesivo';
        explanation = `Desvío crítico ${side}: registrado ${formatNum(val)} ${rule.unit} vs rango admisible (${minT}-${maxT} ${rule.unit}).`;
      }
    }

    return {
      id: rule.id,
      ruleId: rule.id,
      name: rule.name,
      sector: rule.sector,
      module: rule.module,
      value: val,
      currentValue: val,
      formattedValue: formatValueWithUnit(val, rule.unit),
      unit: rule.unit,
      target: rule.target ?? (rule.targetMin != null ? `${rule.targetMin} - ${rule.targetMax}` : null),
      targetValue: rule.target,
      formattedTarget: rule.target != null ? formatValueWithUnit(rule.target, rule.unit) : (rule.targetMin != null ? `${formatNum(rule.targetMin)} a ${formatNum(rule.targetMax)} ${rule.unit}` : '-'),
      direction: rule.direction,
      state,
      stateLabel,
      stateClass: state,
      badgeLabel: state === 'green' ? 'NORMAL' : state === 'yellow' ? 'ATENCIÓN' : 'CRÍTICO',
      isNormal: state === 'green',
      isWarning: state === 'yellow',
      isCritical: state === 'red',
      icon,
      deviationPct: deviationPct != null ? Math.round(deviationPct * 10) / 10 : null,
      explanation,
      isAlert: state === 'yellow' || state === 'red'
    };
  }

  /**
   * Helper para formateo con separadores de miles argentinos
   */
  function formatNum(v, maxDec = 2) {
    if (v == null || !Number.isFinite(Number(v))) return 'Sin datos';
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: maxDec }).format(Number(v));
  }

  function formatPct(v) {
    if (v == null || !Number.isFinite(Number(v))) return '0%';
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(Number(v)) + '%';
  }

  function formatValueWithUnit(v, unit) {
    if (v == null || !Number.isFinite(Number(v))) return 'Sin datos';
    const n = Number(v);
    if (unit === 'ARS' || unit === '$') {
      return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
    }
    if (unit === 'ARS/ha' || unit === '$/ha') {
      return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n) + ' / ha';
    }
    if (unit === 'ARS/t' || unit === '$/t') {
      return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n) + ' / t';
    }
    if (unit === 'ARS/kg' || unit === '$/kg') {
      return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n) + ' / kg';
    }
    if (unit === 'ARS/cab' || unit === '$/cab') {
      return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n) + ' / cab';
    }
    if (unit === '%') {
      return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n) + ' %';
    }
    if (unit === 'kg/día') {
      return (n >= 0 ? '+' : '') + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n) + ' kg/día';
    }
    if (unit === 'kg/ha') {
      return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n) + ' kg/ha';
    }
    if (unit === 'kg/kg') {
      return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' kg/kg';
    }
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n) + ' ' + unit;
  }

  const _semaphoreCache = new WeakMap();

  /**
   * Calcula y evalúa todos los indicadores de gestión del sistema para un período dado
   */
  function computeAllIndicators(db, from, to) {
    if (db && typeof db === 'object') {
      const key = (from || '') + '|' + (to || '');
      let entry = _semaphoreCache.get(db);
      if (entry && entry.cache && entry.cache[key]) {
        return entry.cache[key];
      }
      const out = _computeAllIndicators(db, from, to);
      if (!entry) {
        entry = { cache: {} };
        _semaphoreCache.set(db, entry);
      }
      entry.cache[key] = out;
      return out;
    }
    return _computeAllIndicators(db, from, to);
  }

  function _computeAllIndicators(db, from, to) {
    const D = (typeof UNRC !== 'undefined' ? UNRC : root.UNRC) || (typeof require !== 'undefined' ? require('./domain.js') : null);
    if (!D || !db) return [];

    const state = D.replay(db, to);
    const res = D.results(db, from, to);
    const ind = D.indicators(db, from, to);

    const inPeriod = r => (!r.date || r.date >= from) && (!r.date || r.date <= to);
    const visible = t => (db[t] || []).filter(r => !r.voided);

    const list = [];
    const evaluate = (ruleId, val, missingReason = null) => {
      const rule = getRule(db, ruleId);
      const evalRes = evaluateIndicator(val, rule, missingReason);
      evalRes.period = { from, to };
      list.push(evalRes);
      return evalRes;
    };

    // ==========================================
    // 1. INDICADORES AGRÍCOLAS: MAÍZ
    // ==========================================
    const cornCampaigns = visible('campaigns').filter(c => (c.crop?.toLowerCase().includes('maíz') || c.crop?.toLowerCase().includes('maiz') || c.area === 'maiz') && (!c.date || c.date <= to));
    const cornCosts = visible('costs').filter(inPeriod).filter(c => c.area === 'maiz' || (c.area === 'agricultura' && (c.crop === 'maiz' || c.concept?.toLowerCase().includes('maiz') || c.concept?.toLowerCase().includes('maíz'))));
    const cornSurface = D.sum(cornCampaigns, c => Number(c.surface || c.hectares || 0));
    const cornTons = D.sum(cornCampaigns, c => Number(c.harvestTons || c.production || 0));
    const cornCostTotal = D.sum(cornCosts, c => Number(c.amount || 0));
    const cornRev = res.areas.maiz?.revenue || 0;
    const cornMargin = cornRev - cornCostTotal;

    const cornYieldKgHa = cornSurface > 0 && cornTons > 0 ? (cornTons * 1000 / cornSurface) : null;
    evaluate('agri_yield_corn', cornYieldKgHa, cornSurface === 0 ? 'Sin superficie de maíz cargada en el período' : cornTons === 0 ? 'Sin cosechas registradas de maíz' : null);

    const cornTargetRule = getRule(db, 'agri_yield_corn');
    const cornYieldPct = cornYieldKgHa != null && cornTargetRule?.target ? (cornYieldKgHa / cornTargetRule.target * 100) : null;
    evaluate('agri_target_pct_corn', cornYieldPct, cornYieldKgHa == null ? 'Requiere rendimiento obtenido de maíz' : null);

    const cornCostHa = cornSurface > 0 && cornCostTotal > 0 ? (cornCostTotal / cornSurface) : (cornSurface > 0 ? 0 : null);
    evaluate('agri_cost_per_ha_corn', cornCostHa, cornSurface === 0 ? 'Sin hectáreas sembradas registradas' : null);

    const cornCostTonne = cornTons > 0 && cornCostTotal > 0 ? (cornCostTotal / cornTons) : null;
    evaluate('agri_cost_per_tonne_corn', cornCostTonne, cornTons === 0 ? 'Requiere cosecha de grano para calcular costo por tonelada' : null);

    const cornMarginHa = cornSurface > 0 ? (cornMargin / cornSurface) : null;
    evaluate('agri_margin_ha_corn', cornMarginHa, cornSurface === 0 ? 'Sin superficie de maíz registrada' : null);

    const cornPlanTons = cornSurface * 8.5; // meta presupuestada
    const cornPlanPct = cornPlanTons > 0 && cornTons > 0 ? (cornTons / cornPlanTons * 100) : null;
    evaluate('agri_prod_plan_corn', cornPlanPct, cornTons === 0 ? 'Sin cosecha acumulada' : null);

    // ==========================================
    // 2. INDICADORES AGRÍCOLAS: SOJA
    // ==========================================
    const soyCampaigns = visible('campaigns').filter(c => (c.crop?.toLowerCase().includes('soja') || c.area === 'soja') && (!c.date || c.date <= to));
    const soyCosts = visible('costs').filter(inPeriod).filter(c => c.area === 'soja');
    const soySurface = D.sum(soyCampaigns, c => Number(c.surface || c.hectares || 0));
    const soyTons = D.sum(soyCampaigns, c => Number(c.harvestTons || c.production || 0));
    const soyCostTotal = D.sum(soyCosts, c => Number(c.amount || 0));
    const soyRev = res.areas.soja?.revenue || 0;
    const soyMargin = soyRev - soyCostTotal;

    const soyYieldKgHa = soySurface > 0 && soyTons > 0 ? (soyTons * 1000 / soySurface) : null;
    evaluate('agri_yield_soy', soyYieldKgHa, soySurface === 0 ? 'Sin superficie de soja cargada' : soyTons === 0 ? 'Sin cosechas registradas de soja' : null);

    const soyTargetRule = getRule(db, 'agri_yield_soy');
    const soyYieldPct = soyYieldKgHa != null && soyTargetRule?.target ? (soyYieldKgHa / soyTargetRule.target * 100) : null;
    evaluate('agri_target_pct_soy', soyYieldPct, soyYieldKgHa == null ? 'Requiere rendimiento obtenido de soja' : null);

    const soyCostHa = soySurface > 0 && soyCostTotal > 0 ? (soyCostTotal / soySurface) : (soySurface > 0 ? 0 : null);
    evaluate('agri_cost_per_ha_soy', soyCostHa, soySurface === 0 ? 'Sin hectáreas de soja sembradas' : null);

    const soyCostTonne = soyTons > 0 && soyCostTotal > 0 ? (soyCostTotal / soyTons) : null;
    evaluate('agri_cost_per_tonne_soy', soyCostTonne, soyTons === 0 ? 'Requiere cosecha de grano para calcular costo por tonelada' : null);

    const soyMarginHa = soySurface > 0 ? (soyMargin / soySurface) : null;
    evaluate('agri_margin_ha_soy', soyMarginHa, soySurface === 0 ? 'Sin superficie de soja registrada' : null);

    const soyPlanTons = soySurface * 3.2; // meta presupuestada
    const soyPlanPct = soyPlanTons > 0 && soyTons > 0 ? (soyTons / soyPlanTons * 100) : null;
    evaluate('agri_prod_plan_soy', soyPlanPct, soyTons === 0 ? 'Sin cosecha acumulada' : null);

    // ==========================================
    // 3. INDICADORES GANADEROS: PORCINOS
    // ==========================================
    const pigLots = visible('lots').filter(l => !l.species || l.species === 'porcino');
    const pigHeads = D.sum(pigLots, l => state.lots[l.id]?.quantity != null ? state.lots[l.id].quantity : (l.animals || 0));
    evaluate('pigs_stock', pigHeads);

    const pigMortality = ind.mortality != null ? ind.mortality : null;
    evaluate('pigs_mortality', pigMortality, ind.alive === 0 ? 'Sin partos ni camadas cerradas en el período' : null);

    const pigSales = visible('sales').filter(inPeriod).filter(s => s.area === 'cerdos' || s.area === 'porcinos');
    const totalCaponHeads = D.sum(pigSales, s => Number(s.animals || s.quantity || 0));
    const totalCaponKg = D.sum(pigSales, s => Number(s.animals || 1) * Number(s.weight || 0));
    const avgCaponWeight = totalCaponHeads > 0 ? (totalCaponKg / totalCaponHeads) : null;
    evaluate('pigs_avg_weight', avgCaponWeight, totalCaponHeads === 0 ? 'Sin liquidaciones de capones vendidas en el período' : null);

    const pigIndRows = ind.rows.filter(r => !r.lot?.species || r.lot?.species === 'porcino');
    const pigValidGdp = pigIndRows.filter(r => r.daily != null && r.daily > 0);
    const pigAvgGdp = pigValidGdp.length ? (D.sum(pigValidGdp, r => r.daily) / pigValidGdp.length) : null;
    evaluate('pigs_daily_gain', pigAvgGdp, pigValidGdp.length === 0 ? 'Se requieren al menos 2 pesajes completos en el mismo lote' : null);

    const pigValidIca = pigIndRows.filter(r => r.ica != null);
    const pigTotalGain = D.sum(pigValidIca, r => r.gain);
    const pigTotalFeed = D.sum(pigValidIca, r => r.consumed);
    const pigIca = pigTotalGain > 0 && pigTotalFeed > 0 ? (pigTotalFeed / pigTotalGain) : null;
    evaluate('pigs_ica', pigIca, pigValidIca.length === 0 ? 'Requiere consumo de alimento y ganancia de peso coincidentes en el mismo lote y período' : null);

    // Duración de ciclo (165 días promedio estándar)
    evaluate('pigs_cycle_days', 165);

    const pigFeedCost = D.sum(pigValidIca, r => r.cost);
    const pigCostKgGain = pigTotalGain > 0 && pigFeedCost > 0 ? (pigFeedCost / pigTotalGain) : null;
    evaluate('pigs_cost_kg_gain', pigCostKgGain, pigTotalGain === 0 ? 'Requiere pesajes de ganancia y consumos imputados' : null);

    const pigRev = res.areas.cerdos?.revenue || res.areas.porcinos?.revenue || 0;
    const pigExp = res.areas.cerdos?.expense || res.areas.porcinos?.expense || 0;
    const pigMarginPerHead = totalCaponHeads > 0 ? ((pigRev - pigExp) / totalCaponHeads) : null;
    evaluate('pigs_margin_per_head', pigMarginPerHead, totalCaponHeads === 0 ? 'Sin animales faenados y liquidados' : null);

    // ==========================================
    // 4. INDICADORES GANADEROS: BOVINOS
    // ==========================================
    const bovLots = visible('lots').filter(l => l.species === 'bovino');
    const bovHeads = D.sum(bovLots, l => state.lots[l.id]?.quantity != null ? state.lots[l.id].quantity : (l.animals || 0));
    evaluate('bov_stock', bovHeads);

    const bovMovements = visible('movements').filter(inPeriod).filter(m => bovLots.some(l => l.id === m.lotId) || m.species === 'bovino');
    const bovDeaths = D.sum(bovMovements.filter(m => m.type === 'baja'), m => Number(m.quantity || 0));
    const bovMortality = bovHeads > 0 ? (bovDeaths / (bovHeads + bovDeaths) * 100) : (bovDeaths > 0 ? 100 : 0);
    evaluate('bov_mortality', bovMortality);

    const bovSales = visible('sales').filter(inPeriod).filter(s => s.area === 'bovinos' || bovLots.some(l => l.id === s.lotId));
    const bovSoldHeads = D.sum(bovSales, s => Number(s.animals || s.quantity || 0));
    const bovSoldKg = D.sum(bovSales, s => Number(s.animals || 1) * Number(s.weight || 0));
    const bovAvgWeight = bovSoldHeads > 0 ? (bovSoldKg / bovSoldHeads) : null;
    evaluate('bov_avg_weight', bovAvgWeight, bovSoldHeads === 0 ? 'Sin novillos comercializados a faena' : null);

    const bovIndRows = ind.rows.filter(r => r.lot?.species === 'bovino');
    const bovValidGdp = bovIndRows.filter(r => r.daily != null && r.daily > 0);
    const bovAvgGdp = bovValidGdp.length ? (D.sum(bovValidGdp, r => r.daily) / bovValidGdp.length) : null;
    evaluate('bov_daily_gain', bovAvgGdp, bovValidGdp.length === 0 ? 'Requiere dos pesajes de control en lote bovino' : null);

    const bovValidIca = bovIndRows.filter(r => r.ica != null);
    const bovTotalGain = D.sum(bovValidIca, r => r.gain);
    const bovTotalFeed = D.sum(bovValidIca, r => r.consumed);
    const bovIca = bovTotalGain > 0 && bovTotalFeed > 0 ? (bovTotalFeed / bovTotalGain) : null;
    evaluate('bov_ica', bovIca, bovValidIca.length === 0 ? 'Requiere pesajes y raciones computadas en el mismo lote feedlot' : null);

    evaluate('bov_cycle_days', 105);

    // ==========================================
    // 5. INDICADORES GANADEROS: OVINOS
    // ==========================================
    const oviLots = visible('lots').filter(l => l.species === 'ovino');
    const oviHeads = D.sum(oviLots, l => state.lots[l.id]?.quantity != null ? state.lots[l.id].quantity : (l.animals || 0));
    evaluate('ovi_stock', oviHeads);

    const oviMovements = visible('movements').filter(inPeriod).filter(m => oviLots.some(l => l.id === m.lotId) || m.species === 'ovino');
    const oviDeaths = D.sum(oviMovements.filter(m => m.type === 'baja'), m => Number(m.quantity || 0));
    const oviMortality = oviHeads > 0 ? (oviDeaths / (oviHeads + oviDeaths) * 100) : 0;
    evaluate('ovi_mortality', oviMortality);

    const oviSales = visible('sales').filter(inPeriod).filter(s => s.area === 'ovinos' || oviLots.some(l => l.id === s.lotId));
    const oviSoldHeads = D.sum(oviSales, s => Number(s.animals || s.quantity || 0));
    const oviSoldKg = D.sum(oviSales, s => Number(s.animals || 1) * Number(s.weight || 0));
    const oviAvgWeight = oviSoldHeads > 0 ? (oviSoldKg / oviSoldHeads) : null;
    evaluate('ovi_avg_weight', oviAvgWeight, oviSoldHeads === 0 ? 'Sin liquidaciones de corderos faena' : null);

    const oviIndRows = ind.rows.filter(r => r.lot?.species === 'ovino');
    const oviValidGdp = oviIndRows.filter(r => r.daily != null && r.daily > 0);
    const oviAvgGdp = oviValidGdp.length ? (D.sum(oviValidGdp, r => r.daily) / oviValidGdp.length) : null;
    evaluate('ovi_daily_gain', oviAvgGdp, oviValidGdp.length === 0 ? 'Requiere pesajes sucesivos en lote ovino' : null);

    const oviValidIca = oviIndRows.filter(r => r.ica != null);
    const oviTotalGain = D.sum(oviValidIca, r => r.gain);
    const oviTotalFeed = D.sum(oviValidIca, r => r.consumed);
    const oviIca = oviTotalGain > 0 && oviTotalFeed > 0 ? (oviTotalFeed / oviTotalGain) : null;
    evaluate('ovi_ica', oviIca, oviValidIca.length === 0 ? 'Requiere pesajes y consumos registrados en lote de corderos' : null);

    // ==========================================
    // 6. INDICADORES COMERCIALES Y FINANCIEROS
    // ==========================================
    const allSales = visible('sales').filter(inPeriod);
    const totalSalesRev = D.sum(allSales, s => D.saleValue(s).gross);
    evaluate('com_sales_volume', totalSalesRev);

    const totalExp = (res.groups?.ganaderia?.expense || 0) + (res.groups?.agricultura?.expense || 0);
    const grossMargin = totalSalesRev - totalExp;
    const grossMarginPct = totalSalesRev > 0 ? (grossMargin / totalSalesRev * 100) : null;
    evaluate('com_gross_margin_pct', grossMarginPct, totalSalesRev === 0 ? 'Sin ventas comerciales en el período' : null);

    // Cuentas por cobrar vencidas y obligaciones vencidas
    const todayStr = new Date().toISOString().slice(0, 10);
    let overdueReceivables = 0;
    let overduePayables = 0;
    for (const doc of Object.values(state.documents || {})) {
      const balance = Number(doc.amount || 0) - Number(doc.paid || 0);
      if (balance > 0.01) {
        const dueDate = doc.dueDate || doc.date;
        if (dueDate && dueDate < todayStr) {
          if (doc.type === 'venta' || doc.area === 'ventas') overdueReceivables += balance;
          if (doc.type === 'costo' || doc.type === 'compra') overduePayables += balance;
        }
      }
    }
    evaluate('fin_receivables_overdue', overdueReceivables);
    evaluate('fin_payables_overdue', overduePayables);

    // Stock de partidas bajo punto de pedido
    const lowStockItems = Object.values(state.stock || {}).filter(item => {
      const prod = db.products?.find(p => p.id === item.productId);
      const minStock = Number(prod?.minStock || 100);
      return Number(item.quantity || 0) < minStock;
    });
    evaluate('com_stock_under_min', lowStockItems.length);

    // Desviación de costos sobre presupuesto (comparando contra meta estándar)
    const budgetedCosts = 25000000;
    const costDevPct = budgetedCosts > 0 ? ((totalExp - budgetedCosts) / budgetedCosts * 100) : 0;
    evaluate('fin_cost_deviation', costDevPct);

    // Flujo de caja operativo neto (Diferenciación conceptual: Caja vs Devengado)
    const netCashflow = (res.groups?.ganaderia?.cash || 0) + (res.groups?.agricultura?.cash || 0);
    evaluate('fin_cashflow_operating', netCashflow);

    return list;
  }

  /**
   * Genera la lista de alertas activas (indicadores en amarillo o rojo)
   */
  function getSemaphoreAlerts(db, from, to) {
    const list = computeAllIndicators(db, from, to);
    return list.filter(item => item.isAlert).map(item => {
      const isRed = item.state === 'red';
      return {
        id: item.id,
        ruleId: item.id,
        indicatorId: item.id,
        semaphore: item.state,
        semaphoreLabel: isRed ? '🔴 SEMÁFORO ROJO (Crítico)' : '🟡 SEMÁFORO AMARILLO (Advertencia)',
        level: isRed ? 'danger' : 'warning',
        title: item.name,
        currentValue: item.value,
        targetValue: item.target,
        formattedValue: item.formattedValue,
        formattedTarget: item.formattedTarget,
        text: `Valor registrado: ${item.formattedValue} (Meta: ${item.formattedTarget}). ${item.explanation}`,
        icon: isRed ? 'circle-alert' : 'alert-triangle',
        module: item.module,
        sector: item.sector,
        period: typeof item.period === 'object' && item.period ? `${item.period.from} al ${item.period.to}` : (item.period || `${from} al ${to}`),
        view: item.module === 'maiz' ? 'maiz' : item.module === 'soja' ? 'soja' : item.module === 'porcinos' ? 'cerdos' : item.module === 'bovinos' ? 'bovinos' : item.module === 'ovinos' ? 'ovinos' : item.module === 'comercial' ? 'ventas' : 'general'
      };
    });
  }

  /**
   * Renderiza el componente HTML visual del badge de semáforo
   */
  function renderSemaphoreBadge(evalRes, compact = false) {
    if (!evalRes) return '';
    const st = evalRes.state || 'gray';
    const label = evalRes.stateLabel || 'SIN DATOS';
    const dot = `<span class="semaphore-dot ${st}"></span>`;

    if (compact) {
      return `<span class="semaphore-badge ${st}" title="${escapeHtml(evalRes.name)}: ${escapeHtml(label)} - ${escapeHtml(evalRes.explanation || '')}">${dot} ${st === 'green' ? 'ÓPTIMO' : st === 'yellow' ? 'ALERTA' : st === 'red' ? 'CRÍTICO' : 'S/D'}</span>`;
    }

    return `
      <span class="semaphore-badge ${st}" title="${escapeHtml(evalRes.explanation || '')}">
        ${dot}
        <strong>${st === 'green' ? 'NORMAL' : st === 'yellow' ? 'ATENCIÓN' : st === 'red' ? 'CRÍTICO' : 'SIN DATOS'}</strong>
      </span>
    `;
  }

  /**
   * Renderiza una tarjeta compacta completa de indicador semaforizado
   */
  function renderSemaphoreCard(evalRes) {
    if (!evalRes) return '';
    const st = evalRes.state || 'gray';
    const borderColor = st === 'green' ? '#22c55e' : st === 'yellow' ? '#eab308' : st === 'red' ? '#ef4444' : '#94a3b8';
    const bgColor = st === 'green' ? '#f0fdf4' : st === 'yellow' ? '#fefce8' : st === 'red' ? '#fef2f2' : '#f8fafc';

    return `
      <article class="metric" style="border-top: 4px solid ${borderColor}; background: ${bgColor}; padding: 14px 16px; border-radius: 8px; position: relative">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px">
          <p style="margin:0; font-size:0.83rem; font-weight:700; color:#1e293b">${escapeHtml(evalRes.name)}</p>
          ${renderSemaphoreBadge(evalRes, true)}
        </div>
        <strong style="font-size:1.45rem; line-height:1.2; color:${st === 'red' ? '#991b1b' : '#0f172a'}">
          ${escapeHtml(evalRes.formattedValue)}
        </strong>
        <div style="margin-top:6px; font-size:0.78rem; color:#64748b; display:flex; justify-content:space-between; align-items:center">
          <span>Meta: <strong>${escapeHtml(evalRes.formattedTarget)}</strong></span>
          ${evalRes.deviationPct != null ? `<span style="font-weight:700; color:${evalRes.deviationPct >= 0 ? '#166534' : '#991b1b'}">${evalRes.deviationPct >= 0 ? '+' : ''}${evalRes.deviationPct}%</span>` : ''}
        </div>
        <small style="display:block; margin-top:8px; font-size:0.75rem; color:#475569; line-height:1.4">
          ${escapeHtml(evalRes.explanation)}
        </small>
      </article>
    `;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  const api = {
    DEFAULT_SEMAPHORE_RULES,
    getRule,
    getAllRules,
    evaluateIndicator,
    computeAllIndicators,
    getSemaphoreAlerts,
    renderSemaphoreBadge,
    renderSemaphoreCard,
    formatNum,
    formatPct,
    formatValueWithUnit
  };

  root.UNRCSemaphore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
