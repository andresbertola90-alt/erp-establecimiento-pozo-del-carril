(function (root) {
  'use strict';
  const Plan=typeof module!=='undefined'&&module.exports?require('./assets/account-plan.js'):root.UNRCAccountPlan;
  const TABLES = ['accounts', 'parties', 'products', 'campaigns', 'lots', 'sows', 'births', 'movements', 'costs', 'stock', 'transfers', 'sales', 'payments', 'prices', 'allocations', 'entries', 'closings', 'scenarios', 'imports'];
  const BUSINESS_UNITS = [
    { id: 'porcinos', code: 'POR', name: 'Porcinos', group: 'ganaderia', kind: 'semi_intensivo', description: 'Ciclo cerrado semi-intensivo (Cría, Recría, Terminación)' },
    { id: 'bovinos', code: 'BOV', name: 'Bovinos', group: 'ganaderia', kind: 'bovinos', description: 'Ciclo de carne (Cría, Recría, Adaptación, Engorde)' },
    { id: 'ovinos', code: 'OVI', name: 'Ovinos', group: 'ganaderia', kind: 'ovinos', description: 'Producción ovina de carne, transición raza Dorper (Cría, Recría, Engorde)' },
    { id: 'maiz', code: 'MAIZ', name: 'Maíz', group: 'agricultura', kind: 'grano', description: 'Cultivo de 1ª y 2ª (Siembra, Labores, Cosecha, Stock y Autoconsumo)' },
    { id: 'soja', code: 'SOJA', name: 'Soja', group: 'agricultura', kind: 'grano', description: 'Producción por lotes y campañas (Siembra, Insumos, Cosecha, Ventas)' }
  ];
  const AREAS = { cerdos: 'Cerdos (Porcinos)', agricultura: 'Agricultura', porcinos: 'Porcinos', bovinos: 'Bovinos', ovinos: 'Ovinos', maiz: 'Maíz', soja: 'Soja' };
  const PHASES = {
    cria_maternidad: 'Cría - Maternidad', destete_recria: 'Destete - Recría', engorde_terminacion: 'Engorde - Terminación',
    fase1: 'Cría - Maternidad', fase2: 'Destete - Recría', fase3: 'Destete - Recría', fase4: 'Engorde - Terminación', recria: 'Destete - Recría', terminador: 'Engorde - Terminación',
    cria_bov: 'Cría Bovina', recria_bov: 'Recría Bovina', adaptacion_bov: 'Adaptación Bovina', engorde_bov: 'Engorde Bovino',
    cria_ovi: 'Cría Ovina', recria_ovi: 'Recría Ovina', engorde_ovi: 'Engorde Ovino'
  };
  const ACCOUNTS = [
    ['1.1.01', 'Caja y bancos', 'asset'], ['1.2.01', 'Clientes', 'asset'], ['1.2.05.01', 'Créditos fiscales', 'asset'],
    ['1.3.03.01', 'Hacienda · Fase 1', 'asset'], ['1.3.03.02', 'Hacienda · Fase 2', 'asset'], ['1.3.03.03', 'Hacienda · Fase 3', 'asset'], ['1.3.03.04', 'Hacienda · Fase 4', 'asset'], ['1.3.03.05', 'Hacienda · Recría', 'asset'], ['1.3.03.06', 'Hacienda · Terminador', 'asset'],
    ['1.3.04.01', 'Granos e insumos', 'asset'], ['1.4.01', 'Cultivos en producción', 'asset'],
    ['1.5.01.01', 'Plantel reproductor', 'asset'], ['1.5.01.02', 'Amortización acumulada del plantel', 'asset'],
    ['2.1.01', 'Proveedores', 'liability'], ['2.3.01', 'Obligaciones fiscales', 'liability'],
    ['3.1.01', 'Contrapartida de apertura', 'equity'],
    ['4.3.01', 'Ventas porcinas', 'income'], ['4.4.01', 'Ventas agrícolas', 'income'],
    ['5.3.01', 'Costo de hacienda vendida', 'expense'], ['5.3.02', 'Producción porcina', 'expense'],
    ['5.3.03', 'Plantel reproductor', 'expense'], ['5.4.01', 'Costo de granos vendidos', 'expense'], ['5.4.02', 'Producción agrícola', 'expense'],
    ['5.5.01', 'Costos compartidos', 'expense'], ['5.6.01', 'Estructura', 'expense'], ['5.7.01', 'Comercialización', 'expense'], ['5.3.04', 'Bajas y diferencias de inventario', 'expense']
  ];
  const num = v => v === '' || v == null ? 0 : Number(v);
  const round = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const uid = () => root.crypto?.randomUUID?.() || 'r' + Date.now() + Math.random().toString(36).slice(2);
  const active = rows => (rows || []).filter(r => !r.voided && !r.review);
  const sum = (rows, fn = x => x) => rows.reduce((n, r) => n + num(fn(r)), 0);
  const fail = message => { throw new Error(message); };
  const dateOK = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  const legacyAnimalAccount = phase => {
    const legacyKeys = ['fase1', 'fase2', 'fase3', 'fase4', 'recria', 'terminador'];
    const idx = legacyKeys.indexOf(phase);
    if (idx >= 0) return '1.3.03.' + String(idx + 1).padStart(2, '0');
    if (phase === 'cria_maternidad') return '1.3.03.01';
    if (phase === 'destete_recria') return '1.3.03.05';
    if (phase === 'engorde_terminacion') return '1.3.03.04';
    return '1.3.03.' + String(Object.keys(PHASES).indexOf(phase) + 1).padStart(2, '0');
  };
  const requireDate = d => { if (!dateOK(d)) fail('Completá una fecha válida.'); };
  const positive = (n, label, zero = false) => { if (!Number.isFinite(num(n)) || num(n) < 0 || (!zero && num(n) === 0)) fail(label + ': ingresá un número ' + (zero ? 'no negativo.' : 'mayor que cero.')); };
  function initial() {
    const db = { version: 4, workflowVersion: 1, revision: 0, settings: { farmName: 'Establecimiento Pozo del Carril', manager: '', sector: 'Pozo del Carril', phaseLimits: {}, weightRanges: {}, priceAgeDays: 14, allocationCriterion: 'Destetados del mes', currency: 'ARS', thresholds: { withdrawalDaysWarning: 5, icaWarning: 2.8, icaCritical: 3.2, mortalityWarning: 3.0, mortalityCritical: 5.0, grainStockWarning: 10000, grainStockCritical: 3000 } }, legacy: null };
    TABLES.forEach(t => db[t] = []);
    db.accounts = ACCOUNTS.map(([code, name, kind]) => ({ id: code, code, name, kind }));
    return db;
  }
  function migrate(raw) {
    const db = initial();
    if (!raw) return db;
    db.legacy = raw;
    db.settings.manager = raw.settings?.manager || '';
    const party = (name, kind) => { if (!name) return ''; let p = db.parties.find(p => p.name === name); if (!p) { p = { id: uid(), name, kind }; db.parties.push(p); } return p.id; };
    for (const l of raw.batches || []) db.lots.push({ id: l.id, name: l.name, date: l.dateIn, phase: l.stage === 'maternidad' ? 'cria' : '', animals: l.animals, weight: l.avgWeightNow, openingValue: '', review: true, note: 'Saldo heredado: confirmar fecha de apertura, fase y valor.' });
    for (const c of raw.costs || []) db.costs.push({ ...c, area: 'cerdos', partyId: party(c.supplier, 'proveedor'), amount: round(num(c.quantity) * num(c.unitCost)), tax: c.tax, reference: '', accountId: '5.3.02', review: true, note: c.detail });
    for (const s of raw.sales || []) db.sales.push({ ...s, area: 'cerdos', partyId: party(s.buyer, 'cliente'), weight: s.avgWeight, price: s.priceKg, fees: s.deductions, reference: '', review: true });
    for (const b of raw.births || []) db.births.push({ ...b, name: b.sowTag, losses: '', review: true });
    for (const i of raw.inventory || []) db.imports.push({ id: uid(), date: i.date, source: 'Stock anterior', content: JSON.stringify(i), review: true });
    for (const m of raw.growthLogs || []) db.imports.push({ id: uid(), date: m.date, source: 'Movimiento anterior', content: JSON.stringify(m), review: true });
    return db;
  }
  function ref(db, table, id, label) {
    const row = active(db[table]).find(r => r.id === id);
    if (!row) fail('Seleccioná ' + label + ' registrado en el sistema.');
    return row;
  }
  function validate(db, table, r) {
    if (r.review || r.voided || table === 'imports') return;
    if (['parties', 'products', 'campaigns', 'lots', 'sows', 'accounts'].includes(table) && !String(r.name || '').trim()) fail('Completá el nombre.');
    if (!['parties', 'products', 'accounts', 'imports'].includes(table) || r.date != null) requireDate(r.date);
    if (r.area && !AREAS[r.area] && r.area !== 'comun') fail('Seleccioná Cerdos o Agricultura.');
    if (['costs', 'stock', 'sales', 'entries'].includes(table) && !AREAS[r.area] && !(table === 'costs' && r.area === 'comun')) fail('Seleccioná la actividad.');
    if (table === 'accounts') {
      if (!r.code || !['asset', 'liability', 'equity', 'income', 'expense', 'physical'].includes(r.kind)) fail('Completá código y clasificación de la cuenta.');
      Plan.validateDefinition(r);
      if(r.parent){const parent=db.accounts.find(a=>a.id===r.parent&&!a.voided);if(!parent||parent.id===r.id)fail('Seleccioná una cuenta superior válida.');let cursor=parent,seen=new Set([r.id]);while(cursor){if(seen.has(cursor.id))fail('La jerarquía de cuentas contiene un ciclo.');seen.add(cursor.id);cursor=db.accounts.find(a=>a.id===cursor.parent);}}
    }
    if (table === 'lots') { if (!PHASES[r.phase]) fail('Seleccioná la fase del lote.'); if (!['cria','destete','engorde'].includes(r.bioStage)) fail('Seleccioná la etapa productiva.'); positive(r.animals, 'Animales', true); if (!Number.isInteger(num(r.animals))) fail('La cantidad de animales debe ser entera.'); positive(r.weight, 'Peso', !num(r.animals)); positive(r.openingValue, 'Valor inicial', true); if (!num(r.animals) && num(r.openingValue)) fail('Un lote vacío no puede tener valor de apertura.'); }
    if (table === 'campaigns') { positive(r.hectares, 'Hectáreas'); if (!['Maíz', 'Soja', 'Trigo', 'Sorgo', 'Otro'].includes(r.crop)) fail('Seleccioná el cultivo.'); }
    if (table === 'products') { if (!r.unit) fail('Completá la unidad base.'); if (['grano', 'alimento'].includes(r.kind) && r.unit !== 'kg') fail('Granos y alimento se registran en kg.'); if (r.kgPerBag !== '' && r.kgPerBag != null) positive(r.kgPerBag, 'Kg por bolsa'); }
    if (table === 'costs') {
      positive(r.amount, 'Importe'); positive(r.tax, 'Impuestos', true); if (!r.reference) fail('Completá el comprobante o referencia.');
      const account = ref(db, 'accounts', r.accountId, 'una cuenta'); if (account.kind !== 'expense'||!Plan.selectable(account)) fail('Seleccioná una cuenta imputable de costo o gasto.');
      if (/^alimento|^alimentaci/i.test(r.category || '')) fail('La compra y el consumo de alimento se cargan en Existencias y Alimentación para evitar duplicar costos.');
      if (r.partyId) ref(db, 'parties', r.partyId, 'un proveedor');
      if (r.area === 'comun') { positive(r.pigShare, 'Porcentaje Cerdos', true); if (r.pigShare === '' || r.pigShare == null || num(r.pigShare) > 100 || !r.criterion) fail('Indicá el porcentaje (0 a 100) y el criterio de distribución.'); if (r.lotId || r.campaignId) fail('Un gasto común se distribuye primero por actividad.'); }
      if (r.lotId) { ref(db, 'lots', r.lotId, 'un lote'); if (!['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(r.area)) fail('Un lote animal corresponde a Cerdos o una actividad ganadera.'); }
      if (r.campaignId) { ref(db, 'campaigns', r.campaignId, 'una campaña'); if (!['agricultura', 'maiz', 'soja'].includes(r.area)) fail('Una campaña corresponde a Agricultura (Maíz o Soja).'); }
    }
    if (table === 'sows') { positive(r.value, 'Valor del plantel', true); positive(r.residual, 'Valor residual', true); positive(r.lifeMonths, 'Vida útil en meses'); if (!Number.isInteger(num(r.lifeMonths)) || num(r.lifeMonths)>600) fail('La vida útil debe expresarse en meses enteros, hasta 600.'); positive(r.discardValue, 'Valor del descarte', true); if (num(r.residual) > num(r.value)) fail('El residual no puede superar el valor del animal.'); if (r.discardDate) { requireDate(r.discardDate); if (r.discardDate < r.date) fail('El descarte no puede ser anterior al alta.'); } }
    if (table === 'births') {
      const sow = ref(db, 'sows', r.sowId, 'una madre'); if (sow.sex !== 'madre' || r.date < sow.date || (sow.discardDate && r.date > sow.discardDate)) fail('Revisá la madre y sus fechas de actividad.'); const lot = ref(db, 'lots', r.lotId, 'un lote de cría'); if (lot.bioStage !== 'cria') fail('Los nacimientos deben ingresar a un lote de cría.');
      if (active(db.births).some(b => b.id !== r.id && b.sowId === r.sowId && b.date === r.date)) fail('Ya existe un parto de esta madre en esa fecha.');
      positive(r.birthWeight, 'Peso al nacer', true); positive(r.lossWeight, 'Peso de las bajas', true);
      ['bornAlive', 'stillborn', 'weaned', 'losses', 'adoptedIn', 'adoptedOut'].forEach(k => { positive(r[k], k, true); if (!Number.isInteger(num(r[k]))) fail('Las cabezas deben ser enteras.'); });
      if (num(r.weaned) + num(r.losses) + num(r.adoptedOut) > num(r.bornAlive) + num(r.adoptedIn)) fail('Destetados, bajas y adopciones superan los nacidos disponibles.');
      if (r.closed && num(r.weaned) + num(r.losses) + num(r.adoptedOut) !== num(r.bornAlive) + num(r.adoptedIn)) fail('Para cerrar la camada deben estar explicados todos los lechones.');
      if (num(r.adoptedIn) || num(r.adoptedOut)) fail('Registrá las adopciones como traslados entre lotes para conservar las cabezas del establecimiento.');
      if (num(r.weaned) || r.closed) { requireDate(r.weanDate); if (r.weanDate < r.date) fail('El destete no puede ser anterior al parto.'); }
      if (num(r.weaned)) { const dest = ref(db, 'lots', r.toLotId, 'un lote de destete'); if (dest.bioStage !== 'destete') fail('El destino debe ser un lote de destete.'); positive(r.weanWeight, 'Peso al destete'); }
      if (num(r.losses)) { requireDate(r.lossDate); if (r.lossDate < r.date || (r.weanDate && r.lossDate > r.weanDate)) fail('Revisá la fecha de las bajas de la camada.'); }
    }
    if (table === 'movements') {
      const lot = ref(db, 'lots', r.lotId, 'un lote');
      if (r.date < lot.date) fail('El movimiento no puede ser anterior a la apertura del lote.');
      if (!['pesaje', 'baja', 'traslado', 'ingreso', 'tratamiento', 'conteo'].includes(r.type)) fail('Seleccioná el movimiento.');
      if (r.type !== 'tratamiento') { positive(r.quantity, 'Cabezas', r.type === 'conteo'); if (!Number.isInteger(num(r.quantity))) fail('Las cabezas deben ser enteras.'); }
      if (['pesaje', 'ingreso', 'traslado', 'baja'].includes(r.type)) positive(r.weight, 'Peso promedio');
      if (r.type === 'ingreso') positive(r.unitCost, 'Valor por animal', true);
      if (r.type === 'traslado') { ref(db, 'lots', r.toLotId, 'un lote de destino'); if (r.toLotId === r.lotId) fail('Origen y destino deben ser diferentes.'); }
      if (r.type === 'conteo' && !r.note) fail('Explicá el motivo del ajuste de conteo.');
    }
    if (table === 'stock') {
      const product = ref(db, 'products', r.productId, 'un producto'); positive(r.quantity, 'Cantidad', r.type === 'ajuste');
      if (r.campaignId) ref(db, 'campaigns', r.campaignId, 'una campaña');
      if (r.partyId) ref(db, 'parties', r.partyId, 'un proveedor');
      positive(r.tax, 'Impuestos de compra', true);
      if (r.inputUnit === 'bolsas' && product.unit !== 'kg') fail('Las bolsas sólo corresponden a productos registrados en kg.');
      if (r.type === 'consumo' && ['cerdos', 'porcinos'].includes(r.area) && ['grano','alimento'].includes(product.kind) && !r.lotId) fail('Asigná el consumo de alimento a un lote para calcular su costo y conversión.');
      if (!['apertura', 'compra', 'cosecha', 'consumo', 'merma', 'ajuste'].includes(r.type)) fail('Seleccioná el movimiento de existencias.');
      if (['apertura', 'compra', 'cosecha'].includes(r.type)) positive(r.unitCost, 'Costo unitario', true);
      if (r.type === 'cosecha') { if (!['agricultura', 'maiz', 'soja'].includes(r.area)) fail('La cosecha corresponde a Agricultura.'); ref(db, 'campaigns', r.campaignId, 'una campaña'); }
      if (r.lotId) { ref(db, 'lots', r.lotId, 'un lote'); if (!['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(r.area)) fail('Seleccioná una actividad pecuaria para consumir en un lote.'); }
      if (r.type === 'ajuste' && !r.note) fail('Explicá el motivo del ajuste.');
    }
    if(table==='products'&&r.inventoryAccountId){const a=ref(db,'accounts',r.inventoryAccountId,'una cuenta de existencias');if(a.kind!=='asset'||!Plan.selectable(a)||!/^1\.3\./.test(a.code))fail('Seleccioná una cuenta monetaria de existencias.');}
    if (table === 'transfers') { const p = ref(db, 'products', r.productId, 'un producto'); if (p.kind !== 'grano') fail('La transferencia interna debe corresponder a un cereal.'); ref(db, 'campaigns', r.campaignId, 'una campaña de origen'); positive(r.quantity, 'Kg transferidos'); positive(r.opportunityPrice, 'Valor neto por kg', true); if (!r.source || !dateOK(r.priceDate) || r.priceDate > r.date) fail('Completá fuente y fecha del valor de transferencia, anterior o igual al movimiento.'); if (r.toArea && !['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(r.toArea)) fail('Seleccioná una actividad pecuaria receptora.'); if (r.lotId) ref(db, 'lots', r.lotId, 'un lote de destino'); }
    if (table === 'sales') {
      ref(db, 'parties', r.partyId, 'un comprador'); if (!r.reference) fail('Completá el número de comprobante.'); positive(r.price, 'Precio');
      const isLivestockSale = ['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(r.area) || !!r.lotId;
      if (isLivestockSale) { ref(db, 'lots', r.lotId, 'un lote'); positive(r.animals, 'Animales'); if (!Number.isInteger(num(r.animals))) fail('Las cabezas deben ser enteras.'); positive(r.weight, 'Peso promedio'); }
      else { ref(db, 'products', r.productId, 'un producto'); if (r.campaignId) ref(db, 'campaigns', r.campaignId, 'una campaña'); positive(r.quantity, 'Kg vendidos'); }
      ['tax', 'fees', 'retentions', 'perceptions'].forEach(k => positive(r[k], k, true));
      const v = saleValue(r); if (v.net < 0) fail('El neto de la liquidación no puede ser negativo.');
      if (active(db.sales).some(s => s.id !== r.id && s.partyId === r.partyId && s.reference === r.reference)) fail('Ese comprobante ya está registrado para el comprador.');
    }
    if (table === 'payments') { positive(r.amount, 'Importe'); if (!r.sourceId) fail('Seleccioná el documento que se cancela.'); }
    if (table === 'prices') { positive(r.price, 'Precio'); if (!r.source || !r.product) fail('Completá producto y fuente.'); }
    if (table === 'allocations') { ref(db, 'costs', r.costId, 'un costo de origen'); if (r.lotId) ref(db, 'lots', r.lotId, 'un lote'); if (r.campaignId) ref(db, 'campaigns', r.campaignId, 'una campaña'); if (!!r.lotId === !!r.campaignId) fail('Seleccioná un único destino.'); positive(r.amount, 'Importe a distribuir'); if (!r.criterion) fail('Completá el criterio.'); }
    if (table === 'entries') {
      if (!r.reference || !Array.isArray(r.lines) || r.lines.length < 2) fail('El asiento necesita referencia y dos renglones.');
      for(const line of r.lines)for(const side of ['debit','credit']){const amount=num(line[side]);if(!Number.isSafeInteger(Math.round(amount*100))||Math.abs(amount*100-Math.round(amount*100))>.0001)fail('Los importes del asiento deben tener como máximo dos decimales y estar dentro del rango permitido.');}
      for (const l of r.lines) { const account=ref(db, 'accounts', l.accountId, 'una cuenta');if(!Plan.selectable(account))fail('Los títulos y registros físicos no admiten importes en el libro diario.'); positive(l.debit, 'Debe', true); positive(l.credit, 'Haber', true); if ((num(l.debit) > 0) === (num(l.credit) > 0)) fail('Cada renglón debe tener Debe o Haber, no ambos.'); if (!Plan.manual(account)||!account.planVersion&&/^1\.(3|4|5)/.test(l.accountId)) fail('Los activos productivos se modifican desde sus movimientos, no desde un asiento manual.'); }
      if (Math.abs(sum(r.lines, l => l.debit) - sum(r.lines, l => l.credit)) > .005) fail('El asiento no está balanceado.');
    }
  }
  const saleValue = s => {
    const isAnimal = ['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(s.area) || !!s.lotId;
    const kg = isAnimal ? num(s.animals) * num(s.weight) : num(s.quantity);
    const gross = round(kg * num(s.price));
    return { kg, gross, net: round(gross + num(s.tax) + num(s.perceptions) - num(s.retentions) - num(s.fees)) };
  };
  function replay(db, cutoff = '9999-12-31') {
    const animalAccount=lot=>Plan.enabled(db)?Plan.lotAccount(lot):legacyAnimalAccount(lot.phase);
    const out = { lots: {}, stock: {}, campaigns: {}, journal: [], memo: [], errors: [], feed: [], weights: [], documents: {}, depreciation: [], production: [], sold: [] };
    const sequence = new Map(TABLES.flatMap(t => db[t].map(r => [r.id, num(r.sequence)])));
    const events = []; const add = (date, rank, id, run) => { if (date && date <= cutoff) events.push({ date, rank, id, sequence:sequence.get(id.split(':')[0]) || 0, run }); };
    let current;
    const origins=new Map(TABLES.flatMap(table=>db[table].map(record=>[record.id,{table,record}])));
    function post(area, description, lines) {
      const context={...origins.get(current.id.split(':')[0]),area,description};
      const rows = lines.filter(l => Math.abs(l[1]) > .000001).map(([accountId, value]) => ({ accountId:Plan.resolve(db,accountId,context), debit: value > 0 ? round(value) : 0, credit: value < 0 ? round(-value) : 0 }));
      if(Plan.enabled(db))for(const row of rows){const a=db.accounts.find(a=>a.id===row.accountId);if(!a||!Plan.selectable(a))fail('Falta una cuenta imputable del plan: '+row.accountId);}
      const difference = round(sum(rows, l => l.debit - l.credit));
      if (Math.abs(difference) > .021) fail('El movimiento no balancea: ' + description);
      if (difference && rows.length) { const last = rows[rows.length - 1]; if (last.credit) last.credit = round(last.credit + difference); else last.debit = round(last.debit - difference); }
      out.journal.push({ id: current.id + ':' + out.journal.length, sourceId: current.id.split(':')[0], date: current.date, area, description, lines: rows });
    }
    const memo = (area, amount, detail) => out.memo.push({ date: current.date, area, amount, detail });
    function animal(id) { if (!out.lots[id]) fail('Falta apertura confirmada del lote.'); return out.lots[id]; }
    const key = (productId, area, campaignId) => [productId, area, ['agricultura','maiz','soja'].includes(area) ? campaignId || '' : ''].join('|');
    function inventory(productId, area, campaignId = '') { const k = key(productId, area, campaignId); return out.stock[k] ||= { key: k, productId, area, campaignId: ['agricultura','maiz','soja'].includes(area) ? campaignId : '', quantity: 0, value: 0, memo: 0 }; }
    function remove(bucket, q, label) { if (q > bucket.quantity + .000001) fail('Existencias insuficientes: ' + label + ' (' + round(bucket.quantity) + ' disponibles).'); const f = bucket.quantity ? q / bucket.quantity : 0; const v = bucket.value * f; const m = bucket.memo * f; bucket.quantity -= q; bucket.value -= v; bucket.memo -= m; return { value: v, memo: m }; }
    function removeAnimals(id, q) { const l = animal(id); const fraction = l.quantity ? q / l.quantity : 0; const cohorts = {}; for (const [key, heads] of Object.entries(l.cohorts || {})) { cohorts[key] = heads * fraction; l.cohorts[key] -= cohorts[key]; } const taken = remove(l, q, l.name); return { ...taken, weight: l.weight, cohorts }; }
    const receiveAnimal = (id, q, value, m, weight, cohorts = {}) => { const l = animal(id); l.weightKnown=(!l.quantity || l.weightKnown!==false) && (!q || weight>0); const total = l.quantity + q; if (weight > 0) l.weight = total ? (l.weight * l.quantity + weight * q) / total : weight; l.quantity = total; l.value += value; l.memo += m; l.cohorts ||= {}; for (const [key, heads] of Object.entries(cohorts)) l.cohorts[key] = (l.cohorts[key] || 0) + heads; };
    active(db.lots).forEach(l => add(l.date, 0, l.id, () => {
      out.lots[l.id] = { ...l, quantity: num(l.animals), value: num(l.openingValue), memo: 0, weight: num(l.weight), weightKnown:!num(l.animals) || num(l.weight)>0 };
      const lotArea = (l.species === 'bovino' || l.phase?.includes('bov')) ? 'bovinos' : (l.species === 'ovino' || l.phase?.includes('ovi')) ? 'ovinos' : (l.area === 'porcinos' ? 'porcinos' : 'cerdos');
      post(lotArea, 'Apertura: ' + l.name, [[animalAccount(l), num(l.openingValue)], ['3.1.01', -num(l.openingValue)]]);
    }));
    active(db.campaigns).forEach(c => { out.campaigns[c.id] = { ...c, value: 0, harvested: 0, cost: 0 }; });
    active(db.costs).forEach(c => add(c.date, 2, c.id, () => {
      const totalCost = num(c.amount) + (c.taxRecoverable ? 0 : num(c.tax));
      const pigNet = round(num(c.amount) * num(c.pigShare) / 100), pigTax = round(num(c.tax) * num(c.pigShare) / 100);
      const shares = c.area === 'comun' ? [['cerdos', pigNet, pigTax], ['agricultura', round(num(c.amount)-pigNet), round(num(c.tax)-pigTax)]] : [[c.area, num(c.amount), num(c.tax)]];
      for (const [area, net, tax] of shares) {
        if (!net && !tax) continue; let account = c.accountId;
        if (c.lotId) { if (!animal(c.lotId).quantity) fail('No se puede imputar un costo a un lote vacío.'); animal(c.lotId).value += totalCost; account = animalAccount(animal(c.lotId)); }
        if (c.campaignId) { const cp = out.campaigns[c.campaignId]; if (!cp) fail('Campaña no disponible.'); cp.value += totalCost; cp.cost += totalCost; account = '1.4.01'; }
        post(area, c.reference + ' · ' + (c.note || 'Costo'), [[account, net + (c.taxRecoverable ? 0 : tax)], ['1.2.05.01', c.taxRecoverable ? tax : 0], ['2.1.01', -(net + tax)]]);
        if (c.lotId) out.production.push({ date:c.date, lotId:c.lotId, category:c.category || 'Otros', value:totalCost, sourceId:c.id });
      }
      out.documents[c.id] = { name: c.reference, area: c.area, pigAmount:pigNet + pigTax, pigPaid:0, kind: 'pago', amount: num(c.amount) + num(c.tax), paid: 0, date: c.date };
    }));
    active(db.sows).forEach(s => {
      add(s.date, 0, s.id, () => post('cerdos', 'Alta plantel: ' + s.name, [['1.5.01.01', num(s.value)], ['3.1.01', -num(s.value)]]));
      const start = new Date(s.date + 'T00:00:00Z');
      for (let i = 1; i <= Math.min(num(s.lifeMonths), 600); i++) {
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 0)).toISOString().slice(0, 10);
        if (end > cutoff || end > (s.discardDate || '9999-12-31')) break;
        add(end, 8, s.id + ':amort:' + i, () => {
          const value = (num(s.value) - num(s.residual)) / num(s.lifeMonths);
          post('cerdos', 'Amortización plantel: ' + s.name, [['5.3.03', value], ['1.5.01.02', -value]]);
          const detail = { date: end, sowId: s.id, value, allocated:0, weaned:0 }; out.depreciation.push(detail);
          const births = active(db.births).filter(b => b.weanDate?.slice(0, 7) === end.slice(0, 7) && num(b.weaned) > 0);
          const total = sum(births, b => b.weaned);
          detail.weaned = total;
          for (const l of Object.values(out.lots)) {
            const heads = sum(births, b => l.cohorts?.[b.id] || 0), allocated = total ? value * heads / total : 0;
            if (!allocated) continue; l.value += allocated; detail.allocated += allocated;
            post('cerdos', 'Plantel por destetado: ' + s.name, [[animalAccount(l), allocated], ['5.3.03', -allocated]]);
            out.production.push({ date:end, lotId:l.id, category:'Plantel', value:allocated, sourceId:s.id });
          }
        });
      }
      if (s.discardDate) add(s.discardDate, 9, s.id + ':descarte', () => { const depreciated = sum(out.depreciation.filter(x => x.sowId === s.id), x => x.value); const remaining = num(s.value) - depreciated; post('cerdos', 'Descarte: ' + s.name, [['1.1.01', num(s.discardValue)], ['1.5.01.02', depreciated], ['1.5.01.01', -num(s.value)], ['5.3.03', remaining - num(s.discardValue)]]); });
    });
    active(db.births).forEach(b => {
      add(b.date, 1, b.id, () => receiveAnimal(b.lotId, num(b.bornAlive), 0, 0, num(b.birthWeight)));
      if (num(b.losses)) add(b.lossDate, 3, b.id + ':baja', () => { const v = removeAnimals(b.lotId, num(b.losses)); post('cerdos', 'Bajas de camada', [['5.3.04', v.value], [animalAccount(animal(b.lotId)), -v.value]]); memo('cerdos', -v.memo, 'Baja'); });
      if (num(b.weaned)) add(b.weanDate, 4, b.id + ':destete', () => { const v = removeAnimals(b.lotId, num(b.weaned)); receiveAnimal(b.toLotId, num(b.weaned), v.value, v.memo, num(b.weanWeight), { [b.id]:num(b.weaned) }); post('cerdos', 'Cambio de categoría por destete', [[animalAccount(animal(b.toLotId)), v.value], [animalAccount(animal(b.lotId)), -v.value]]); });
    });
    active(db.movements).forEach(m => add(m.date, 5, m.id, () => {
      const l = animal(m.lotId); const q = num(m.quantity);
      const mArea = (l.species === 'bovino' || l.phase?.includes('bov')) ? 'bovinos' : (l.species === 'ovino' || l.phase?.includes('ovi')) ? 'ovinos' : (l.area === 'porcinos' ? 'porcinos' : 'cerdos');
      if (m.type === 'pesaje') { if (q !== l.quantity) fail('El pesaje completo debe coincidir con las cabezas del lote. Registrá primero ingresos o bajas.'); out.weights.push({ ...m, beforeWeight: l.weight, heads: q, phase: l.phase }); l.weight = num(m.weight); l.weightKnown=true; l.lastWeightDate = m.date; }
      if (m.type === 'ingreso') { receiveAnimal(m.lotId, q, q * num(m.unitCost), 0, num(m.weight)); post(mArea, 'Ingreso de hacienda', [[animalAccount(l), q * num(m.unitCost)], ['2.1.01', -q * num(m.unitCost)]]); out.documents[m.id] = { name: m.note || 'Ingreso de hacienda', area: mArea, kind: 'pago', amount: q * num(m.unitCost), paid: 0, date: m.date }; }
      if (m.type === 'baja') { const v = removeAnimals(m.lotId, q); post(mArea, 'Baja: ' + l.name, [['5.3.04', v.value], [animalAccount(l), -v.value]]); memo(mArea, -v.memo, 'Baja'); }
      if (m.type === 'traslado') {
        const dest = animal(m.toLotId); const range = Object.hasOwn(m,'destinationRange') ? m.destinationRange : db.settings.weightRanges?.[dest.phase];
        if (range && ((range.min != null && num(m.weight) < num(range.min)) || (range.max != null && num(m.weight) > num(range.max)))) fail('El peso no corresponde al rango configurado para la categoría de destino.');
        const v = removeAnimals(m.lotId, q); receiveAnimal(m.toLotId, q, v.value, v.memo, num(m.weight), v.cohorts); post(mArea, 'Traslado: ' + l.name + ' → ' + dest.name, [[animalAccount(dest), v.value], [animalAccount(l), -v.value]]);
      }
      if (m.type === 'conteo') { const diff = q - l.quantity; if (diff < 0) { const v = removeAnimals(m.lotId, -diff); post(mArea, 'Ajuste por conteo', [['5.3.04', v.value], [animalAccount(l), -v.value]]); memo(mArea, -v.memo, 'Ajuste'); } else if (diff > 0) { positive(m.unitCost, 'Valor de los animales incorporados'); const value = diff * num(m.unitCost); receiveAnimal(m.lotId, diff, value, 0, num(m.weight)); post(mArea, 'Ajuste por conteo', [[animalAccount(l), value], ['5.3.04', -value]]); } }
    }));
    active(db.stock).forEach(s => add(s.date, ['apertura','compra','cosecha'].includes(s.type) ? 3 : 6, s.id, () => {
      const inv = inventory(s.productId, s.area, s.campaignId); let q = num(s.quantity); const p = db.products.find(p => p.id === s.productId);
      if (s.inputUnit === 'bolsas') { const factor = s.factorAtEntry ?? p.kgPerBag; positive(factor, 'Kg por bolsa del producto'); q *= num(factor); }
      if (['apertura', 'compra', 'cosecha'].includes(s.type)) {
        const net = q * num(s.unitCost), tax = s.type === 'compra' ? num(s.tax) : 0;
        const value = net + (s.taxRecoverable ? 0 : tax); inv.quantity += q; inv.value += value;
        let contra = s.type === 'apertura' ? '3.1.01' : s.type === 'compra' ? '2.1.01' : '1.4.01';
        if (s.type === 'cosecha') { const c = out.campaigns[s.campaignId]; if (!c || value > c.value + .01) fail('El valor de cosecha supera los costos acumulados de la campaña.'); c.value -= value; c.harvested += q; }
        post(s.area, s.type + ': ' + (p?.name || 'Insumo'), [['1.3.04.01', value], ['1.2.05.01', s.taxRecoverable ? tax : 0], [contra, -(net + tax)]]);
        if (s.type === 'compra') out.documents[s.id] = { name: s.reference || p?.name || 'Compra', area: s.area, kind: 'pago', amount: net + tax, paid: 0, date: s.date };
      } else {
        let needed = s.type === 'ajuste' ? inv.quantity - q : q;
        if (needed < 0) { positive(s.unitCost, 'Costo del ingreso por ajuste'); const value = -needed * num(s.unitCost); inv.quantity -= needed; inv.value += value; post(s.area, 'Ajuste de insumos', [['1.3.04.01', value], ['5.3.04', -value]]); return; }
        const v = remove(inv, needed, p?.name || 'Insumo'); let debit = ['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(s.area) ? '5.3.02' : '5.4.02';
        if (s.type !== 'consumo') debit = '5.3.04';
        else if (s.lotId) { const l = animal(s.lotId); if (!l.quantity) fail('El lote no tiene animales para recibir el consumo.'); if (p && p.phase && p.phase !== l.phase) fail('El alimento está asignado a otra categoría. Revisá producto y lote.'); l.value += v.value; l.memo += v.memo; debit = animalAccount(l); }
        else if (['agricultura', 'maiz', 'soja'].includes(s.area) && s.campaignId) { const cp = out.campaigns[s.campaignId]; if (cp) { cp.value += v.value; cp.cost += v.value; } debit = '1.4.01'; }
        if (!s.lotId) memo(s.area, -v.memo, 'Consumo o diferencia');
        post(s.area, s.type + ': ' + (p?.name || 'Insumo'), [[debit, v.value], ['1.3.04.01', -v.value]]);
        if (s.type === 'consumo' && s.lotId) out.production.push({ date:s.date, lotId:s.lotId, category:p && ['grano','alimento'].includes(p.kind) ? 'Alimentación' : 'Otros insumos', value:v.value + v.memo, sourceId:s.id });
        if (s.type === 'consumo' && p && ['grano', 'alimento'].includes(p.kind)) out.feed.push({ ...s, quantity: needed, value: v.value + v.memo, phase: s.lotId ? animal(s.lotId).phase : '' });
      }
    }));
    active(db.transfers).forEach(t => add(t.date, 4, t.id, () => {
      const fromArea = ['maiz', 'soja'].includes(t.area) ? t.area : 'agricultura';
      let from = inventory(t.productId, fromArea, t.campaignId);
      if (from.quantity < num(t.quantity) && fromArea !== 'agricultura') {
        const fallback = inventory(t.productId, 'agricultura', t.campaignId);
        if (fallback.quantity >= num(t.quantity)) from = fallback;
      }
      let destArea = t.toArea || t.targetArea || (t.lotId ? animal(t.lotId)?.species : null) || 'cerdos';
      if (destArea === 'porcinos') destArea = 'cerdos';
      const to = inventory(t.productId, destArea);
      const v = remove(from, num(t.quantity), 'cereal agrícola');
      const difference = num(t.quantity) * num(t.opportunityPrice) - v.value;
      to.quantity += num(t.quantity); to.value += v.value; to.memo += difference;
      post('agricultura', 'Entrega interna de cereal', [['1.3.04.01', -v.value], ['5.5.01', v.value]]);
      post(destArea, 'Recepción interna de cereal', [['1.3.04.01', v.value], ['5.5.01', -v.value]]);
      memo('agricultura', difference + v.value, 'Entrega interna a valor oportunidad');
      memo(destArea, -v.value, 'Compensación recepción interna');
    }));
    active(db.allocations).forEach(a => add(a.date, 6, a.id, () => { const cost = db.costs.find(c => c.id === a.costId); if (cost.lotId || cost.campaignId || cost.area === 'comun') fail('Seleccioná un costo sin capitalizar de la actividad de destino.'); if (a.date < cost.date) fail('La distribución es anterior al costo.'); const previous = active(db.allocations).filter(x => x.costId === a.costId); if (sum(previous, x => x.amount) > num(cost.amount) + (cost.taxRecoverable ? 0 : num(cost.tax)) + .01) fail('La distribución supera el costo de origen.'); const area = a.lotId ? 'cerdos' : 'agricultura'; if (area !== cost.area) fail('La distribución debe permanecer en su actividad.'); if (a.lotId) { const l = animal(a.lotId); if (!l.quantity) fail('El lote está vacío.'); l.value += num(a.amount); } else { out.campaigns[a.campaignId].value += num(a.amount); out.campaigns[a.campaignId].cost += num(a.amount); } post(area, 'Distribución: ' + a.criterion, [[a.lotId ? animalAccount(animal(a.lotId)) : '1.4.01', num(a.amount)], [cost.accountId, -num(a.amount)]]); }));
    active(db.sales).forEach(s => add(s.date, 7, s.id, () => {
      const v = saleValue(s);
      const isLivestock = ['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(s.area) || !!s.lotId;
      let cost;
      if (isLivestock) {
        cost = removeAnimals(s.lotId, num(s.animals));
      } else {
        const invArea = ['agricultura', 'maiz', 'soja'].includes(s.area) ? s.area : 'agricultura';
        let inv = inventory(s.productId, invArea, s.campaignId);
        if (inv.quantity < num(s.quantity) && invArea !== 'agricultura') {
          const fallback = inventory(s.productId, 'agricultura', s.campaignId);
          if (fallback.quantity >= num(s.quantity)) inv = fallback;
        }
        cost = remove(inv, num(s.quantity), 'grano');
      }
      const incAccount = isLivestock ? '4.3.01' : '4.4.01';
      const costAccount = isLivestock ? '5.3.01' : '5.4.01';
      post(s.area, 'Venta ' + s.reference, [['1.2.01', v.net], ['5.7.01', num(s.fees)], ['1.2.05.01', num(s.retentions)], [incAccount, -v.gross], ['2.3.01', -num(s.tax) - (Plan.enabled(db)?0:num(s.perceptions))], ...(Plan.enabled(db)?[[Plan.id('2.3.01.90'),-num(s.perceptions)]]:[])]);
      post(s.area, 'Costo de venta ' + s.reference, [[costAccount, cost.value], [isLivestock ? animalAccount(animal(s.lotId)) : '1.3.04.01', -cost.value]]);
      memo(s.area, -cost.memo, 'Valor oportunidad realizado');
      out.sold.push({ ...s, kg:v.kg, gross:v.gross, cost:cost.value, opportunity:cost.memo, margin:v.gross - num(s.fees) - cost.value - cost.memo });
      out.documents[s.id] = { name: s.reference, area: s.area, kind: 'cobro', amount: v.net, paid: 0, date: s.date };
    }));
    active(db.payments).forEach(p => add(p.date, 10, p.id, () => { const doc = out.documents[p.sourceId]; if (!doc) fail('No existe el documento a cancelar a esa fecha.'); if (doc.paid + num(p.amount) > doc.amount + .005) fail('El pago o cobro supera el saldo pendiente.'); doc.paid += num(p.amount); const debit = doc.kind === 'cobro' ? '1.1.01' : '2.1.01'; const credit = doc.kind === 'cobro' ? '1.2.01' : '1.1.01'; const pigTotal = round(doc.paid * num(doc.pigAmount) / doc.amount), pig = pigTotal - num(doc.pigPaid); doc.pigPaid = pigTotal; const shares = doc.area === 'comun' ? [['cerdos', pig], ['agricultura', num(p.amount) - pig]] : [[doc.area, num(p.amount)]]; for (const [area, value] of shares) post(area, 'Cancelación: ' + doc.name, [[debit, value], [credit, -value]]); }));
    active(db.entries).forEach(e => add(e.date, 10, e.id, () => post(e.area, e.reference, e.lines.map(l => [l.accountId, num(l.debit) - num(l.credit)]))));
    events.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.sequence - b.sequence || a.id.localeCompare(b.id));
    for (const e of events) { current = e; try { e.run(); } catch (err) { out.errors.push({ id: e.id, date: e.date, message: err.message }); break; } }
    return out;
  }
  function results(db, from, to) {
    const state = replay(db, to);
    const areas = Object.fromEntries(Object.keys(AREAS).map(a => [a, { revenue: 0, expense: 0, book: 0, management: 0, cash: 0 }]));
    for (const j of state.journal.filter(j => j.date >= from)) {
      for (const l of j.lines) {
        let areaKey = j.area;
        if (areaKey === 'porcinos') areaKey = 'cerdos';
        const a = areas[areaKey];
        if (!a) continue;
        const account = db.accounts.find(c => c.id === l.accountId), kind = account?.kind;
        if (kind === 'income') a.revenue += l.credit - l.debit;
        if (kind === 'expense') a.expense += l.debit - l.credit;
        if (l.accountId === '1.1.01' || account?.cash) a.cash += l.debit - l.credit;
      }
    }
    for (const a of Object.values(areas)) { a.book = a.revenue - a.expense; a.management = a.book; }
    for (const m of state.memo.filter(m => m.date >= from)) {
      let areaKey = m.area;
      if (areaKey === 'porcinos') areaKey = 'cerdos';
      if (areas[areaKey]) areas[areaKey].management += m.amount;
    }
    if (areas.cerdos && areas.porcinos && areas.cerdos.book !== 0 && areas.porcinos.book === 0) {
      areas.porcinos = { ...areas.cerdos };
    } else if (areas.porcinos && areas.cerdos && areas.porcinos.book !== 0 && areas.cerdos.book === 0) {
      areas.cerdos = { ...areas.porcinos };
    }
    
    // Core consolidated areas: cerdos (porcinos), bovinos, ovinos, maiz, soja, and any direct agricultura
    const agDiff = (areas.agricultura?.book || 0) - ((areas.maiz?.book || 0) + (areas.soja?.book || 0));
    const pigBook = areas.porcinos?.book || areas.cerdos?.book || 0;
    const consolidated = pigBook + (areas.bovinos?.book || 0) + (areas.ovinos?.book || 0) + (areas.maiz?.book || 0) + (areas.soja?.book || 0) + (agDiff > 0.005 ? agDiff : (areas.agricultura && !areas.maiz?.book && !areas.soja?.book ? areas.agricultura.book : 0));
    
    const pigMgmt = areas.porcinos?.management || areas.cerdos?.management || 0;
    const agMgmtDiff = (areas.agricultura?.management || 0) - ((areas.maiz?.management || 0) + (areas.soja?.management || 0));
    const consolidatedMgmt = pigMgmt + (areas.bovinos?.management || 0) + (areas.ovinos?.management || 0) + (areas.maiz?.management || 0) + (areas.soja?.management || 0) + (agMgmtDiff > 0.005 ? agMgmtDiff : (areas.agricultura && !areas.maiz?.management && !areas.soja?.management ? areas.agricultura.management : 0));
    const adjustment = consolidated - consolidatedMgmt;

    // Groups
    const groups = {
      ganaderia: {
        revenue: (areas.cerdos?.revenue || 0) + (areas.bovinos?.revenue || 0) + (areas.ovinos?.revenue || 0),
        expense: (areas.cerdos?.expense || 0) + (areas.bovinos?.expense || 0) + (areas.ovinos?.expense || 0),
        book: (areas.cerdos?.book || 0) + (areas.bovinos?.book || 0) + (areas.ovinos?.book || 0),
        management: (areas.cerdos?.management || 0) + (areas.bovinos?.management || 0) + (areas.ovinos?.management || 0),
        cash: (areas.cerdos?.cash || 0) + (areas.bovinos?.cash || 0) + (areas.ovinos?.cash || 0)
      },
      agricultura: {
        revenue: (areas.maiz?.revenue || 0) + (areas.soja?.revenue || 0) + (areas.agricultura?.revenue || 0),
        expense: (areas.maiz?.expense || 0) + (areas.soja?.expense || 0) + (areas.agricultura?.expense || 0),
        book: (areas.maiz?.book || 0) + (areas.soja?.book || 0) + (areas.agricultura?.book || 0),
        management: (areas.maiz?.management || 0) + (areas.soja?.management || 0) + (areas.agricultura?.management || 0),
        cash: (areas.maiz?.cash || 0) + (areas.soja?.cash || 0) + (areas.agricultura?.cash || 0)
      }
    };

    return { state, areas, groups, consolidated, adjustment, pending: TABLES.reduce((n, t) => n + db[t].filter(r => r.review && !r.voided && (!r.date || r.date <= to)).length, 0) };
  }
  function indicators(db, from, to) {
    const state = replay(db, to); const closed = active(db.births).filter(b => b.closed && b.weanDate >= from && b.weanDate <= to);
    const alive = sum(closed, b => b.bornAlive); const weaned = sum(closed, b => b.weaned); const deaths = sum(closed, b => b.losses);
    const rows = active(db.lots).map(l => {
      const weights = active(db.movements).filter(m => m.lotId === l.id && m.type === 'pesaje' && m.date >= from && m.date <= to).sort((a, b) => a.date.localeCompare(b.date));
      const first = weights[0], last = weights.at(-1);
      let incoming = 0, outgoing = 0, unknown = false, boundary = false;
      const between = date => first && last && date > first.date && date < last.date;
      const boundaryDate = date => first && last && (date === first.date || date === last.date);
      for (const m of active(db.movements).filter(m => m.lotId === l.id || m.toLotId === l.id)) {
        if (!['baja','ingreso','traslado','conteo'].includes(m.type)) continue;
        if (boundaryDate(m.date)) boundary = true;
        if (!between(m.date)) continue;
        if (m.type === 'conteo' || num(m.weight) <= 0) { unknown = true; continue; }
        const kg = num(m.quantity) * num(m.weight);
        if ((m.type === 'baja' || m.type === 'traslado') && m.lotId === l.id) outgoing += kg;
        if (m.type === 'ingreso' && m.lotId === l.id || m.type === 'traslado' && m.toLotId === l.id) incoming += kg;
      }
      for (const s of active(db.sales).filter(s => s.lotId === l.id)) { if (boundaryDate(s.date)) boundary = true; if (between(s.date)) outgoing += num(s.animals) * num(s.weight); }
      for (const b of active(db.births)) {
        if (b.lotId === l.id) {
          if (boundaryDate(b.date) || boundaryDate(b.weanDate) || boundaryDate(b.lossDate)) boundary = true;
          if (between(b.date)) { if (!num(b.birthWeight)) unknown = true; incoming += num(b.bornAlive) * num(b.birthWeight); }
          if (between(b.lossDate)) { if (!num(b.lossWeight)) unknown = true; outgoing += num(b.losses) * num(b.lossWeight); }
          if (between(b.weanDate)) outgoing += num(b.weaned) * num(b.weanWeight);
        }
        if (b.toLotId === l.id) { if (boundaryDate(b.weanDate)) boundary = true; if (between(b.weanDate)) incoming += num(b.weaned) * num(b.weanWeight); }
      }
      const valid = first && last && first !== last && last.date > first.date && !unknown && !boundary;
      const gain = valid ? num(last.quantity) * num(last.weight) + outgoing - num(first.quantity) * num(first.weight) - incoming : null;
      const feed = first && last ? state.feed.filter(f => f.lotId === l.id && f.date > first.date && f.date <= last.date) : [];
      const consumed = sum(feed, f => f.quantity), cost = sum(feed, f => f.value);
      const intervalChanges = incoming !== 0 || outgoing !== 0;
      return { lot: l, from:first?.date, to:last?.date, gain, consumed, cost, incoming, outgoing, ica: gain > 0 && consumed > 0 ? consumed / gain : null, feedCostKg: gain > 0 && consumed > 0 ? cost / gain : null, daily: gain > 0 && !intervalChanges ? gain / num(last.quantity) / ((Date.parse(last.date) - Date.parse(first.date)) / 86400000) : null, reason: boundary ? 'Hay movimientos en la fecha del pesaje de inicio o cierre; separá los cortes para identificar los kilos en pie.' : unknown ? 'Falta peso de ingresos o bajas, o hay un ajuste de conteo.' : 'Se necesitan dos pesajes completos y consumos del intervalo' };
    });
    return { alive, weaned, deaths, survival: alive ? weaned / alive * 100 : null, mortality: alive ? deaths / alive * 100 : null, rows };
  }
  function scenario(s) {
    const required = ['tonnes', 'grainSell', 'sellFreight', 'sellFees', 'replacement', 'purchaseFreight', 'pigPrice', 'ica', 'grainShare', 'otherFeedKg', 'otherCost', 'days', 'annualRate', 'mortality'];
    const missing = required.filter(k => s[k] === '' || s[k] == null || !Number.isFinite(num(s[k])));
    if (missing.length) return { valid: false, missing, message: 'Completá cantidades, precios y costos para comparar.' };
    if (num(s.tonnes) <= 0 || num(s.ica) <= 0 || num(s.grainShare) <= 0 || num(s.grainShare) > 100 || num(s.mortality) < 0 || num(s.mortality) >= 100 || num(s.days) < 0 || num(s.annualRate) < 0 || required.some(k => num(s[k]) < 0)) return { valid: false, message: 'Revisá cantidades, proporciones y costos.' };
    const tonnes = num(s.tonnes), grainKg = tonnes * 1000, feedKg = grainKg / (num(s.grainShare) / 100);
    const netGrain = num(s.grainSell) - num(s.sellFreight) - num(s.sellFees);
    const buy = num(s.replacement) + num(s.purchaseFreight);
    const gain = feedKg / num(s.ica) * (1 - num(s.mortality) / 100);
    const otherFeed = (feedKg - grainKg) * num(s.otherFeedKg);
    const discount = Math.pow(1 + num(s.annualRate) / 100, num(s.days) / 365);
    const sell = tonnes * netGrain;
    const transform = gain * num(s.pigPrice) / discount - otherFeed - num(s.otherCost);
    const difference = transform - sell;
    return { valid: true, grainKg, feedKg, gain, sell, transform, difference, perTonne: difference / tonnes, ownVsBuy: tonnes * (buy - netGrain), breakEvenPig: gain ? (sell + otherFeed + num(s.otherCost)) * discount / gain : null, recommendation: difference >= 0 ? 'Transformar en cerdos' : 'Vender el cereal', note: 'Modelo marginal: kg adicionales de peso vivo. Otros costos incluyen diferencias de valor inicial de animales, elaboración, sanidad, trabajo y gastos comerciales. No incluye beneficios ajenos al escenario.' };
  }
  function commit(db, table, record) {
    const next = structuredClone(db); const existing = next[table].find(r => r.id === record.id); const r = { ...existing, ...record, id: record.id || uid() };
    delete r.review;
    if (table === 'accounts') delete r.provisional;
    if(table==='accounts'&&!existing){if(next.accounts.some(a=>!a.voided&&a.code===r.code&&(!Plan.enabled(db)||a.planVersion===Plan.VERSION)))fail('Ese código de cuenta ya existe.');if(Plan.enabled(db)){r.planVersion=Plan.VERSION;r.source='Personalizada';if(next.accounts.find(a=>a.id===r.parent)?.managed)r.managed=true;}}
    if(table==='accounts'&&Plan.isBase(r))Plan.validateDefinition(r);
    if (existing) { const previous = { ...existing }; delete previous.history; r.history = [...(existing.history || []), { at: new Date().toISOString(), record: previous }]; }
    r.updatedAt = new Date().toISOString(); r.createdAt = existing?.createdAt || r.updatedAt;
    r.sequence = existing?.sequence || TABLES.reduce((max,t)=>db[t].reduce((n,r)=>Math.max(n,num(r.sequence)),max),0) + 1;
    if (existing && table === 'accounts' && existing.code !== r.code) fail('El código de una cuenta utilizada se conserva. Creá una nueva subcuenta si necesitás otro código.');
    if (table === 'accounts' && ACCOUNTS.some(a => a[0] === r.id && a[2] !== r.kind)) fail('La clasificación de las cuentas automáticas no se puede cambiar.');
    if (existing && table === 'products' && ['unit','kind','phase','inventoryAccountId'].some(k => (existing[k] || '') !== (r[k] || '')) && ['stock','transfers','sales'].some(t => active(db[t]).some(x => x.productId === r.id))) fail('El producto tiene historia: conservá su unidad, tipo y categoría. Creá otro producto para una composición diferente.');
    if (existing && !existing.review && table === 'lots' && (existing.phase !== r.phase || existing.bioStage !== r.bioStage) && ['movements','stock','births','sales','costs','allocations'].some(t => active(db[t]).some(x => x.lotId === r.id || x.toLotId === r.id))) fail('La categoría de un lote con historia no se cambia: creá el lote de destino y registrá un traslado.');
    if (table === 'stock' && r.inputUnit === 'bolsas' && r.factorAtEntry == null) r.factorAtEntry = db.products.find(p => p.id === r.productId)?.kgPerBag;
    if (table === 'movements' && r.type === 'traslado' && (!Object.hasOwn(r,'destinationRange') || existing?.review && !r.review || existing && ['date','toLotId','weight'].some(k=>existing[k]!==r[k]))) { const phase=db.lots.find(l=>l.id===r.toLotId)?.phase; r.destinationRange=structuredClone(db.settings.weightRanges?.[phase] || null); r.rangeSource=db.settings.weightSource || ''; }
    const lastClose = active(db.closings).map(c => c.end).sort().at(-1);
    if (lastClose && ((r.date && r.date <= lastClose) || (existing?.date && existing.date <= lastClose))) fail('El período está cerrado. Reabrilo desde Contabilidad antes de modificar registros.');
    if (lastClose && ['products', 'accounts', 'lots', 'sows', 'campaigns'].includes(table) && existing && !existing.review) fail('Este catálogo interviene en períodos cerrados. Reabrí el cierre antes de editarlo.');
    validate(next, table, r);
    if (r.sourceImportId) {
      const source=next.imports.find(i=>i.id===r.sourceImportId); if (!source) fail('No se encontró la fila de origen.');
      if (TABLES.filter(t=>t!=='imports').some(t=>next[t].some(other=>!other.voided&&other.id!==r.id&&other.sourceImportId===r.sourceImportId))) fail('La fila de origen ya tiene una imputación. Editá ese registro.');
      delete source.review; if(r.voided) delete source.resolvedId; else source.resolvedId=r.id;
    }
    const i = next[table].findIndex(x => x.id === r.id); if (i >= 0) next[table][i] = r; else next[table].push(r);
    for (const t of TABLES.filter(t => !['closings','scenarios','imports'].includes(t))) for (const row of active(next[t])) validate(next, t, row);
    const lastDate = [...TABLES.flatMap(t => next[t].flatMap(x => [x.date,x.weanDate,x.lossDate,x.discardDate]).filter(Boolean)), new Date().toISOString().slice(0,10)].sort().at(-1);
    const state = replay(next, lastDate); if (state.errors.length) fail(state.errors[0].message);
    return next;
  }
  function cancel(db, table, id) {
    if(table==='accounts'&&Plan.isBase({id}))fail('Las cuentas del anexo y sus complementos no se pueden anular.');
    if (table === 'accounts' && ACCOUNTS.some(a => a[0] === id)) fail('Las cuentas base son necesarias para las operaciones automáticas.');
    const row = db[table].find(r => r.id === id); if (!row) fail('Registro inexistente.');
    if (['lots','campaigns','sows','products','parties','accounts','costs','sales','stock','movements'].includes(table)) {
      const keys = { lots:['lotId','toLotId'], campaigns:['campaignId'], sows:['sowId'], products:['productId'], parties:['partyId'], accounts:['accountId','inventoryAccountId'], costs:['costId','sourceId'], sales:['sourceId'], stock:['sourceId'], movements:['sourceId'] }[table];
      if (TABLES.some(t => db[t].some(r => !r.voided && r.id !== id && (keys.some(k => r[k] === id) || table === 'accounts' && r.lines?.some(l => l.accountId === id))))) fail('Hay registros vinculados. Revisá o anulá primero sus operaciones dependientes.');
    }
    return commit(db, table, { ...row, voided: true });
  }
  function needsWorkflowUpgrade(db) {
    return db.workflowVersion !== 1 || Object.hasOwn(db.settings,'accountPlanApproved') || db.accounts.some(a=>Object.hasOwn(a,'provisional')) || TABLES.some(t=>db[t].some(r=>Object.hasOwn(r,'review')));
  }
  function upgradeWorkflow(db) {
    if(!needsWorkflowUpgrade(db))return db;
    let next=structuredClone(db);
    const report={at:new Date().toISOString(),incorporated:[],preserved:[]};
    delete next.settings.accountPlanApproved;
    next.accounts.forEach(a=>{delete a.provisional;if(a.id==='3.1.01'&&a.name==='Contrapartida de apertura (propuesta)')a.name='Contrapartida de apertura';});
    next.imports.forEach(r=>delete r.review);
    TABLES.forEach(t=>next[t].forEach(r=>{if(!r.review||r.voided)delete r.review;}));
    let remaining=TABLES.filter(t=>t!=='imports').flatMap(table=>next[table].filter(row=>row.review).map(row=>({table,id:row.id}))),progress;
    const failures=new Map();
    // Retry dependent rows after their catalog, opening balance or purchase is incorporated.
    do {
      progress=false;
      remaining=remaining.filter(item=>{
        const row=next[item.table].find(r=>r.id===item.id);
        try {
          const explicit=item.table==='lots'?['animals','openingValue']:item.table==='sows'?['value','residual']:item.table==='stock'&&['apertura','compra'].includes(row.type)?['unitCost']:[];
          if(explicit.some(key=>row[key]===''||row[key]==null))fail('Faltan cantidades o valores de apertura; se conservó el original sin asignar importes.');
          next=commit(next,item.table,row);report.incorporated.push(item);progress=true;return false;
        }catch(error){failures.set(item.table+':'+item.id,error.message);return true;}
      });
    }while(progress&&remaining.length);
    for(const item of remaining){
      const row=next[item.table].find(r=>r.id===item.id);
      let source=next.imports.find(r=>r.id===row.sourceImportId&&!r.resolvedId&&!r.originalRecord);
      if(!source){source={id:uid(),date:dateOK(row.date)?row.date:report.at.slice(0,10),source:'Registro anterior: '+(row.reference||row.name||row.id),content:JSON.stringify(row)};next.imports.push(source);}
      source.originalTable=item.table;source.originalRecord=structuredClone(row);source.importIssue=failures.get(item.table+':'+item.id);delete source.resolvedId;
      next[item.table]=next[item.table].filter(r=>r.id!==item.id);
      report.preserved.push({...item,sourceId:source.id,reason:source.importIssue});
    }
    next.workflowVersion=1;next.workflowMigration=report;
    return next;
  }
  const api = { TABLES, AREAS, PHASES, BUSINESS_UNITS, ACCOUNTS, num, sum, round, uid, active, initial, migrate, validate, replay, results, indicators, scenario, commit, cancel, saleValue, needsWorkflowUpgrade, upgradeWorkflow };
  root.UNRC = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
