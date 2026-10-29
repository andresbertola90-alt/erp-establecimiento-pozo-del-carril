(function(root) {
  'use strict';

  const VERSION = 1;
  const id = code => String(code).startsWith('anexo:') ? code : 'anexo:' + code;

  const kindLabels = {
    asset: 'Activo',
    liability: 'Pasivo',
    equity: 'Patrimonio',
    income: 'Ingreso',
    expense: 'Costo / gasto',
    physical: 'No monetaria'
  };

  const ANEXO_I_ROWS = [
    // 5 Headings
    { code: '1', name: 'Activo', kind: 'asset', heading: true, parent: '' },
    { code: '2', name: 'Pasivo', kind: 'liability', heading: true, parent: '' },
    { code: '3', name: 'Patrimonio Neto', kind: 'equity', heading: true, parent: '' },
    { code: '4', name: 'Ingresos', kind: 'income', heading: true, parent: '' },
    { code: '5', name: 'Costos y Gastos', kind: 'expense', heading: true, parent: '' },

    // 7 Physical registers (Group 6)
    { code: '6', name: 'Registros de producción', kind: 'physical', parent: '' },
    { code: '6.1.01', name: 'Cabezas producidas', kind: 'physical', parent: '6' },
    { code: '6.1.02', name: 'Kilos vivos producidos', kind: 'physical', parent: '6' },
    { code: '6.1.03', name: 'Días de alimentación', kind: 'physical', parent: '6' },
    { code: '6.6.01', name: 'Ganancia diaria de peso (GDP)', kind: 'physical', parent: '6' },
    { code: '6.6.02', name: 'Consumo total de alimento', kind: 'physical', parent: '6' },
    { code: '6.6.03', name: 'Índice de Conversión Alimenticia (ICA)', kind: 'physical', parent: '6' },

    // 34 Monetary accounts in Anexo I
    { code: '1.1.01', name: 'Caja y bancos', kind: 'asset', parent: '1', cash: true },
    { code: '1.1.01.01', name: 'Caja en moneda nacional', kind: 'asset', parent: '1.1.01', cash: true },
    { code: '1.2.01', name: 'Créditos por ventas', kind: 'asset', parent: '1' },
    { code: '1.2.01.03', name: 'Clientes cerdos', kind: 'asset', parent: '1.2.01' },
    { code: '1.2.05', name: 'Otros créditos', kind: 'asset', parent: '1' },
    { code: '1.2.05.01', name: 'Créditos fiscales - IVA', kind: 'asset', parent: '1.2.05' },
    { code: '1.2.05.02', name: 'Retenciones y percepciones sufridas', kind: 'asset', parent: '1.2.05' },
    { code: '1.3.03', name: 'Hacienda porcina en producción', kind: 'asset', parent: '1' },
    { code: '1.3.03.01', name: 'Existencias - Cerdas Madres', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.03.02', name: 'Existencias - Padrillos', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.03.03', name: 'Existencias - Lechones al pie de la madre', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.03.04', name: 'Existencias - Lechones destetados y recría', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.03.05', name: 'Existencias - Capones y hembras sin servicio', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.03.06', name: 'Existencias - Reproductores de descarte', kind: 'asset', parent: '1.3.03', managed: true },
    { code: '1.3.04', name: 'Granos e insumos de alimentación', kind: 'asset', parent: '1' },
    { code: '1.3.04.01', name: 'Granos e insumos', kind: 'asset', parent: '1.3.04' },
    { code: '1.3.04.90', name: 'Granos destinados al consumo porcino', kind: 'asset', parent: '1.3.04' },
    { code: '1.5.01', name: 'Bienes de uso - Reproductores', kind: 'asset', parent: '1' },
    { code: '1.5.01.01', name: 'Plantel reproductor', kind: 'asset', parent: '1.5.01' },
    { code: '1.5.01.02', name: 'Amortización acumulada del plantel', kind: 'asset', parent: '1.5.01' },
    { code: '1.5.02', name: 'Bienes de uso - Instalaciones y mejoras', kind: 'asset', parent: '1' },
    { code: '1.5.02.05', name: 'Instalaciones porcinas', kind: 'asset', parent: '1.5.02' },
    { code: '2.1.01', name: 'Deudas comerciales', kind: 'liability', parent: '2' },
    { code: '2.1.01.08', name: 'Proveedores de explotación porcina', kind: 'liability', parent: '2.1.01' },
    { code: '2.3.01', name: 'Deudas fiscales', kind: 'liability', parent: '2' },
    { code: '2.3.01.01', name: 'IVA Débito fiscal', kind: 'liability', parent: '2.3.01' },
    { code: '2.3.01.90', name: 'Percepciones de impuestos', kind: 'liability', parent: '2.3.01' },
    { code: '3.1.01', name: 'Contrapartida de apertura', kind: 'equity', parent: '3' },
    { code: '4.3.01', name: 'Ventas porcinas', kind: 'income', parent: '4' },
    { code: '5.3.01', name: 'Costo de hacienda vendida', kind: 'expense', parent: '5' },
    { code: '5.3.02', name: 'Producción porcina', kind: 'expense', parent: '5' },
    { code: '5.3.02.01', name: 'Sanidad animal', kind: 'expense', parent: '5.3.02' },
    { code: '5.3.03', name: 'Plantel reproductor', kind: 'expense', parent: '5' },
    { code: '5.3.04', name: 'Bajas y diferencias de inventario', kind: 'expense', parent: '5' }
  ];

  const ANEXO_II_ROWS = [
    { code: '7.1.01', name: 'Registro de control de existencias', kind: 'asset', parent: '' },
    { code: '7.1.02', name: 'Contrapartida de control de existencias', kind: 'equity', parent: '' }
  ];

  const COMPLEMENTARY_ROWS = [
    { code: '1.4.01', name: 'Cultivos en producción', kind: 'asset', parent: '1' },
    { code: '4.4.01', name: 'Ventas agrícolas', kind: 'income', parent: '4' },
    { code: '5.4.01', name: 'Costo de granos vendidos', kind: 'expense', parent: '5' },
    { code: '5.4.02', name: 'Producción agrícola', kind: 'expense', parent: '5' },
    { code: '5.5.01', name: 'Costos compartidos e interunidad', kind: 'expense', parent: '5' },
    { code: '5.6.01', name: 'Gastos de estructura', kind: 'expense', parent: '5' },
    { code: '5.7.01', name: 'Gastos de comercialización', kind: 'expense', parent: '5' },
    { code: '1.3.06', name: 'Existencias de productos sanitarios', kind: 'asset', parent: '1' },
    { code: '1.3.06.01', name: 'Medicamentos y vacunas', kind: 'asset', parent: '1.3.06' },
    { code: '5.3.02.10', name: 'Alimentación porcina', kind: 'expense', parent: '5.3.02' },
    { code: '5.3.02.03', name: 'Mano de obra directa porcina', kind: 'expense', parent: '5.3.02' },
    { code: '5.3.02.04', name: 'Energía y servicios de criadero', kind: 'expense', parent: '5.3.02' },
    { code: '5.4.02.01', name: 'Semillas y labores agrícolas', kind: 'expense', parent: '5.4.02' },
    { code: '5.4.02.02', name: 'Fertilizantes y agroquímicos', kind: 'expense', parent: '5.4.02' },
    { code: '5.4.02.03', name: 'Cosecha y fletes agrícolas', kind: 'expense', parent: '5.4.02' },
    { code: '1.1.02', name: 'Bancos cuenta corriente', kind: 'asset', parent: '1.1.01', cash: true },
    { code: '1.2.01.01', name: 'Clientes agricultura', kind: 'asset', parent: '1.2.01' },
    { code: '2.1.01.01', name: 'Proveedores agrícolas', kind: 'liability', parent: '2.1.01' },
    { code: '2.1.02', name: 'Otras cuentas por pagar', kind: 'liability', parent: '2' }
  ];

  const ROWS = ANEXO_I_ROWS.map(r => ({
    id: id(r.code),
    ...r,
    parent: r.parent ? id(r.parent) : '',
    planVersion: VERSION,
    source: 'Anexo I',
    heading: Boolean(r.heading),
    managed: Boolean(r.managed),
    cash: Boolean(r.cash)
  }));

  const DEFINITIONS = [
    ...ROWS,
    ...ANEXO_II_ROWS.map(r => ({
      id: id(r.code),
      ...r,
      parent: r.parent ? id(r.parent) : '',
      planVersion: VERSION,
      source: 'Anexo II',
      heading: false,
      managed: false,
      cash: Boolean(r.cash)
    })),
    ...COMPLEMENTARY_ROWS.map(r => ({
      id: id(r.code),
      ...r,
      parent: r.parent ? id(r.parent) : '',
      planVersion: VERSION,
      source: 'Complementaria',
      heading: false,
      managed: false,
      cash: Boolean(r.cash)
    }))
  ];

  function isBase(account) {
    if (!account) return false;
    if (account.id && String(account.id).startsWith('anexo:')) return true;
    if (account.planVersion === VERSION && DEFINITIONS.some(d => d.code === account.code)) return true;
    return false;
  }

  function selectable(account) {
    if (!account) return false;
    if (account.heading) return false;
    if (account.kind === 'physical') return false;
    return true;
  }

  function manual(account) {
    if (!account) return false;
    if (account.managed) return false;
    if (account.heading) return false;
    if (account.kind === 'physical') return false;
    return true;
  }

  function enabled(db) {
    return Boolean(db && db.accountPlanVersion === VERSION);
  }

  function needsUpgrade(db) {
    if (!db || db.accountPlanVersion !== VERSION) return true;
    for (const base of DEFINITIONS) {
      if (!db.accounts || !db.accounts.some(a => a.id === base.id && !a.voided)) return true;
    }
    return false;
  }

  function validateDefinition(r) {
    if (!r) throw new Error('Definición de cuenta requerida.');
    if (!r.code || !r.kind) throw new Error('Completá código y clasificación.');
    if (!isBase(r)) return;
    const base = DEFINITIONS.find(d => d.id === r.id || d.code === r.code);
    if (base) {
      if (r.name !== base.name) throw new Error('Las cuentas del plan del anexo conservan su nombre.');
      if (r.voided) throw new Error('Esta cuenta del anexo es necesaria y no se puede anular.');
      if (r.kind !== base.kind) throw new Error('La clasificación de la cuenta no se puede modificar.');
    }
  }

  function scope(a, db) {
    if (!a.planVersion) return 'Plan anterior';
    if (a.source === 'Personalizada') return 'Personalizada';
    if (a.source === 'Anexo I') return 'Anexo I';
    if (a.source === 'Anexo II') return 'Anexo II';
    return 'Complemento operativo';
  }

  function inventoryAccount(product, area) {
    if (product && product.inventoryAccountId) return product.inventoryAccountId;
    if (area === 'cerdos' && product && product.kind === 'grano') return id('1.3.04.90');
    return id('1.3.04.01');
  }

  function lotAccount(lot) {
    if (!lot) return id('1.3.03.04');
    if (lot.phase === 'cria_maternidad' || lot.bioStage === 'cria') return id('1.3.03.03');
    if (lot.phase === 'destete_recria' || lot.bioStage === 'destete') return id('1.3.03.04');
    if (lot.phase === 'engorde_terminacion' || lot.bioStage === 'engorde' || lot.phase === 'terminador') return id('1.3.03.05');
    if (lot.phase === 'recria') return id('1.3.03.04');
    if (lot.phase === 'fase1') return lot.bioStage === 'cria' ? id('1.3.03.03') : id('1.3.03.04');
    if (['fase2', 'fase3', 'fase4'].includes(lot.phase)) return id('1.3.03.04');
    return id('1.3.03.05');
  }

  function resolve(db, accountId, context) {
    if (!enabled(db)) return accountId;
    if (String(accountId).startsWith('anexo:')) return accountId;

    if (accountId === '1.1.01') return id('1.1.01.01');
    if (accountId === '1.2.01') {
      if (context && context.area === 'agricultura') return id('1.2.01.01');
      return id('1.2.01.03');
    }
    if (accountId === '1.2.05.01') {
      if (context && context.description && context.description.startsWith('Venta')) {
        return id('1.2.05.02');
      }
      return id('1.2.05.01');
    }
    if (accountId === '2.1.01') {
      if (context && context.area === 'agricultura') return id('2.1.01.01');
      return id('2.1.01.08');
    }
    if (accountId === '2.3.01') return id('2.3.01.01');
    if (accountId === '5.3.02') return id('5.3.02.01');
    if (accountId === '1.3.04.01') {
      if (context && context.productId) {
        const prod = db.products && db.products.find(p => p.id === context.productId);
        if (prod && prod.inventoryAccountId) return prod.inventoryAccountId;
      }
      return id('1.3.04.01');
    }

    const matched = DEFINITIONS.find(d => d.code === accountId);
    if (matched) return matched.id;
    return id(accountId);
  }

  function upgrade(db) {
    if (db.accountPlanVersion && db.accountPlanVersion > VERSION) {
      throw new Error('La base requiere una versión más nueva del plan de cuentas.');
    }
    if (!needsUpgrade(db)) return db;

    const next = structuredClone(db);
    let added = 0;
    for (const def of DEFINITIONS) {
      const existing = next.accounts.find(a => a.id === def.id);
      if (!existing) {
        next.accounts.push({ ...def });
        added++;
      } else if (existing.voided) {
        existing.voided = false;
        added++;
      }
    }
    next.accountPlanVersion = VERSION;
    next.accountPlanMigration = { added, version: VERSION };
    return next;
  }

  const api = {
    VERSION,
    id,
    ROWS,
    DEFINITIONS,
    kindLabels,
    isBase,
    selectable,
    manual,
    enabled,
    needsUpgrade,
    validateDefinition,
    scope,
    inventoryAccount,
    lotAccount,
    resolve,
    upgrade
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UNRCAccountPlan = api;
})(typeof window === 'undefined' ? globalThis : window);
