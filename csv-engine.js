(function(root) {
  'use strict';

  const D = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.UNRC;
  const Plan = typeof module !== 'undefined' && module.exports ? require('./assets/account-plan.js') : root.UNRCAccountPlan;

  // -------------------------------------------------------------
  // 1. UTILIDADES Y PARSEADORES COMPATIBLES CON EXCEL ARGENTINO
  // -------------------------------------------------------------

  function cleanBom(str) {
    if (!str) return '';
    return str.replace(/^\uFEFF/, '').trim();
  }

  function detectDelimiter(firstLine) {
    if (!firstLine) return ';';
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (semicolons > 0) return ';';
    if (tabs > semicolons && tabs > commas) return '\t';
    return commas > 0 ? ',' : ';';
  }

  function parseArgentineNumber(val, defaultVal = NaN) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') return Number.isFinite(val) ? val : defaultVal;
    let s = String(val).trim();
    // Quitar símbolo monetario, prefijo 'ARS', 'USD', espacios
    s = s.replace(/^[$\sA-Za-z]+/, '').trim();
    if (!s) return defaultVal;

    // Negativo entre paréntesis ej: (1.250,00)
    let negative = false;
    if (s.startsWith('(') && s.endsWith(')')) {
      negative = true;
      s = s.slice(1, -1).trim();
    } else if (s.startsWith('-')) {
      negative = true;
      s = s.slice(1).trim();
    }

    // Si tiene coma y punto: ej "1.234,56" o "1,234.56"
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // Estilo argentino: "1.234,56" -> quitar puntos y coma a punto
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // Estilo anglosajón: "1,234.56" -> quitar comas
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Estilo argentino solo con decimal ej "1234,56"
      s = s.replace(',', '.');
    } else if (hasDot) {
      // Si tiene solo punto ej "1.250" o "12.5"
      // Si tiene 3 decimales después del último punto y longitud mayor a 4, verificar si es miles:
      const parts = s.split('.');
      if (parts.length > 2) {
        // Múltiples puntos ej "1.000.000" -> son separadores de miles
        s = parts.join('');
      } else if (parts[1] && parts[1].length === 3 && Number(parts[0]) >= 1) {
        // Puede ser miles ej "1.500" o decimal con 3 cifras. Por seguridad en Argentina si no hay coma se toma el valor numérico estándar de JS
        // si no hay ambigüedad.
        s = s; // JS parseFloat estándar
      }
    }

    const n = parseFloat(s);
    if (!Number.isFinite(n)) return defaultVal;
    return negative ? -n : n;
  }

  function parseArgentineDate(val) {
    if (!val) return null;
    let s = String(val).trim();
    // Soportar ISO AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00Z');
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
    }
    // Soportar DD/MM/AAAA o DD-MM-AAAA o D/M/AAAA
    const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      const iso = `${year}-${month}-${day}`;
      const d = new Date(iso + 'T00:00:00Z');
      if (!isNaN(d.getTime()) && d.getUTCFullYear() === Number(year) && (d.getUTCMonth() + 1) === Number(month) && d.getUTCDate() === Number(day)) {
        return iso;
      }
    }
    return null;
  }

  function formatArgentineDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatArgentineNumber(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '';
    const num = Number(n);
    return num.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    });
  }

  function parseBoolean(val, defaultVal = false) {
    if (val === null || val === undefined || val === '') return defaultVal;
    const s = String(val).trim().toLowerCase();
    if (['si', 'sí', 'true', '1', 's', 'yes', 'y'].includes(s)) return true;
    if (['no', 'false', '0', 'n'].includes(s)) return false;
    return defaultVal;
  }

  // -------------------------------------------------------------
  // 2. DEFINICIÓN DE ENTIDADES COMPATIBLES
  // -------------------------------------------------------------

  const ENTITIES = {
    campaigns: {
      id: 'campaigns',
      name: 'Campañas y Lotes Agrícolas',
      module: 'agricultura',
      targetTable: 'campaigns',
      allowedRoles: ['admin', 'responsable_agricultura'],
      businessKey: (row, db) => `${(row.name || '').trim().toLowerCase()}|${(row.crop || '').trim().toLowerCase()}`,
      fields: [
        { key: 'name', label: 'Nombre de Campaña / Lote', required: true, type: 'string', aliases: ['nombre', 'campaña', 'campana', 'lote'] },
        { key: 'crop', label: 'Cultivo', required: true, type: 'enum', options: ['Maíz', 'Soja', 'Trigo', 'Sorgo', 'Otro'], aliases: ['cultivo', 'especie_vegetal'] },
        { key: 'hectares', label: 'Superficie (ha)', required: true, type: 'number', min: 0.01, aliases: ['hectareas', 'superficie', 'ha'] },
        { key: 'startDate', label: 'Fecha de Inicio', required: false, type: 'date', aliases: ['fecha_inicio', 'inicio', 'siembra'] },
        { key: 'endDate', label: 'Fecha de Cierre', required: false, type: 'date', aliases: ['fecha_cierre', 'cierre', 'fin'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['notas', 'observaciones', 'detalle'] }
      ],
      templates: [
        { name: 'Lote 1 - La Aguada (Maíz)', crop: 'Maíz', hectares: '45,5', startDate: '01/10/2025', endDate: '30/04/2026', note: 'Maíz tardío de primera en siembra directa' },
        { name: 'Lote 2 - El Bajo (Soja)', crop: 'Soja', hectares: '60,0', startDate: '15/11/2025', endDate: '15/05/2026', note: 'Soja de primera grupo IV' }
      ]
    },

    lots: {
      id: 'lots',
      name: 'Lotes y Categorías Ganaderas',
      module: 'ganaderia',
      targetTable: 'lots',
      allowedRoles: ['admin', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${(row.name || '').trim().toLowerCase()}|${(row.species || '').trim().toLowerCase()}`,
      fields: [
        { key: 'name', label: 'Nombre o Tropa', required: true, type: 'string', aliases: ['nombre', 'lote', 'tropa', 'caravana'] },
        { key: 'species', label: 'Especie', required: true, type: 'enum', options: ['porcinos', 'bovinos', 'ovinos'], aliases: ['especie', 'actividad'] },
        { key: 'phase', label: 'Fase / Categoría', required: true, type: 'phase', aliases: ['fase', 'categoria'] },
        { key: 'bioStage', label: 'Etapa Productiva', required: true, type: 'enum', options: ['cria', 'destete', 'engorde'], aliases: ['etapa', 'biostage'] },
        { key: 'animals', label: 'Cabezas', required: true, type: 'integer', min: 0, aliases: ['cabezas', 'animales', 'cantidad'] },
        { key: 'weight', label: 'Peso Promedio (kg)', required: true, type: 'number', min: 0, aliases: ['peso', 'peso_medio', 'peso_kg'] },
        { key: 'openingValue', label: 'Valor Inicial ($)', required: true, type: 'number', min: 0, aliases: ['valor_inicial', 'valuacion', 'importe'] },
        { key: 'date', label: 'Fecha de Apertura', required: true, type: 'date', aliases: ['fecha', 'apertura', 'fecha_alta'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['notas', 'observaciones'] }
      ],
      templates: [
        { name: 'Tropa Terneros Engorde B-1', species: 'bovinos', phase: 'engorde_bov', bioStage: 'engorde', animals: '40', weight: '320,5', openingValue: '18500000,00', date: '01/01/2026', note: 'Corral de terminación intensiva' },
        { name: 'Lote Porcino Recría C-2', species: 'porcinos', phase: 'destete_recria', bioStage: 'destete', animals: '55', weight: '28,4', openingValue: '3200000,00', date: '10/01/2026', note: 'Galpón de recría semi-intensivo' }
      ]
    },

    parties: {
      id: 'parties',
      name: 'Clientes y Proveedores',
      module: 'comercial',
      targetTable: 'parties',
      allowedRoles: ['admin', 'responsable_agricultura', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => {
        const tax = (row.taxId || '').replace(/[^0-9]/g, '');
        return tax ? `tax:${tax}` : `name:${(row.name || '').trim().toLowerCase()}`;
      },
      fields: [
        { key: 'name', label: 'Razón Social / Nombre', required: true, type: 'string', aliases: ['nombre', 'razon_social', 'tercero', 'cliente', 'proveedor'] },
        { key: 'taxId', label: 'CUIT / Identificación Fiscal', required: false, type: 'string', aliases: ['cuit', 'cuil', 'identificacion', 'dni'] },
        { key: 'kind', label: 'Tipo', required: true, type: 'enum', options: ['cliente', 'proveedor', 'ambos'], aliases: ['tipo', 'rol'] },
        { key: 'contact', label: 'Contacto', required: false, type: 'string', aliases: ['persona_contacto', 'responsable'] },
        { key: 'email', label: 'Correo Electrónico', required: false, type: 'string', aliases: ['correo', 'mail'] },
        { key: 'phone', label: 'Teléfono', required: false, type: 'string', aliases: ['telefono', 'celular', 'tel'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['notas', 'observaciones'] }
      ],
      templates: [
        { name: 'Cooperativa Agropecuaria Río Cuarto', taxId: '30-54123456-9', kind: 'ambos', contact: 'Ing. Gómez', email: 'ventas@coopriocuarto.com.ar', phone: '0358-4641122', note: 'Acopio y venta de granos e insumos' },
        { name: 'Veterinaria El Trébol SRL', taxId: '30-67891234-5', kind: 'proveedor', contact: 'Dr. Rossi', email: 'contacto@veteltrebol.com.ar', phone: '0358-4632233', note: 'Vacunas y productos biológicos' }
      ]
    },

    costs: {
      id: 'costs',
      name: 'Compras y Costos Operativos',
      module: 'comercial',
      targetTable: 'costs',
      allowedRoles: ['admin', 'responsable_agricultura', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${(row.reference || '').trim().toLowerCase()}|${row.date}|${Number(row.amount || 0).toFixed(2)}`,
      fields: [
        { key: 'date', label: 'Fecha', required: true, type: 'date', aliases: ['fecha', 'dia'] },
        { key: 'reference', label: 'Nro Comprobante / Factura', required: true, type: 'string', aliases: ['comprobante', 'factura', 'referencia', 'remito'] },
        { key: 'area', label: 'Actividad / Área', required: true, type: 'enum', options: ['maiz', 'soja', 'porcinos', 'bovinos', 'ovinos', 'agricultura', 'cerdos', 'comun'], aliases: ['area', 'actividad', 'sector'] },
        { key: 'partyName', label: 'Proveedor', required: false, type: 'lookup_party', aliases: ['proveedor', 'tercero', 'razon_social'] },
        { key: 'accountCode', label: 'Cuenta Contable', required: true, type: 'lookup_account', aliases: ['cuenta', 'codigo_cuenta', 'imputacion'] },
        { key: 'amount', label: 'Importe Neto ($)', required: true, type: 'number', min: 0.01, aliases: ['importe', 'monto', 'neto', 'subtotal'] },
        { key: 'tax', label: 'IVA / Impuestos ($)', required: false, type: 'number', min: 0, aliases: ['iva', 'impuesto', 'impuestos'] },
        { key: 'taxRecoverable', label: 'IVA Recuperable (Sí/No)', required: false, type: 'boolean', aliases: ['iva_recuperable', 'credito_fiscal'] },
        { key: 'campaignName', label: 'Campaña Agrícola', required: false, type: 'lookup_campaign', aliases: ['campaña', 'campana', 'lote_agricola'] },
        { key: 'lotName', label: 'Lote Ganadero', required: false, type: 'lookup_lot', aliases: ['lote_ganadero', 'tropa'] },
        { key: 'note', label: 'Detalle / Concepto', required: false, type: 'string', aliases: ['concepto', 'detalle', 'descripcion', 'nota'] }
      ],
      templates: [
        { date: '15/01/2026', reference: 'FC-A-0001-00045612', area: 'maiz', partyName: 'Cooperativa Agropecuaria Río Cuarto', accountCode: '5.4.02', amount: '450000,00', tax: '94500,00', taxRecoverable: 'Sí', campaignName: 'Lote 1 - La Aguada (Maíz)', lotName: '', note: 'Fertilizante nitrogenado 500 kg' },
        { date: '20/01/2026', reference: 'FC-B-0003-00012345', area: 'porcinos', partyName: 'Veterinaria El Trébol SRL', accountCode: '5.3.02', amount: '120000,00', tax: '25200,00', taxRecoverable: 'Sí', campaignName: '', lotName: 'Lote Porcino Recría C-2', note: 'Vacunas y antiparasitarios' }
      ]
    },

    sales: {
      id: 'sales',
      name: 'Ventas Comerciales (Hacienda y Granos)',
      module: 'comercial',
      targetTable: 'sales',
      allowedRoles: ['admin', 'responsable_agricultura', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${(row.reference || '').trim().toLowerCase()}|${row.date}`,
      fields: [
        { key: 'date', label: 'Fecha', required: true, type: 'date', aliases: ['fecha', 'dia'] },
        { key: 'reference', label: 'Nro Liquidación / Factura', required: true, type: 'string', aliases: ['liquidacion', 'factura', 'comprobante', 'referencia'] },
        { key: 'area', label: 'Actividad', required: true, type: 'enum', options: ['porcinos', 'bovinos', 'ovinos', 'maiz', 'soja', 'cerdos', 'agricultura'], aliases: ['area', 'actividad'] },
        { key: 'partyName', label: 'Cliente / Comprador', required: true, type: 'lookup_party', aliases: ['cliente', 'comprador', 'tercero', 'frigorifico'] },
        { key: 'price', label: 'Precio Unitario ($)', required: true, type: 'number', min: 0.01, aliases: ['precio', 'precio_kg', 'precio_unitario'] },
        { key: 'lotName', label: 'Lote de Hacienda', required: false, type: 'lookup_lot', aliases: ['lote', 'lote_ganadero', 'tropa'] },
        { key: 'animals', label: 'Cabezas', required: false, type: 'integer', min: 0, aliases: ['cabezas', 'animales'] },
        { key: 'weight', label: 'Peso Promedio (kg)', required: false, type: 'number', min: 0, aliases: ['peso', 'peso_promedio', 'kg_animal'] },
        { key: 'productName', label: 'Producto / Grano', required: false, type: 'lookup_product', aliases: ['grano', 'producto', 'cereal'] },
        { key: 'quantity', label: 'Kg Vendidos', required: false, type: 'number', min: 0, aliases: ['kg', 'kilos', 'cantidad_kg', 'toneladas'] },
        { key: 'campaignName', label: 'Campaña de Origen', required: false, type: 'lookup_campaign', aliases: ['campaña', 'campana'] },
        { key: 'tax', label: 'IVA / Débito Fiscal ($)', required: false, type: 'number', min: 0, aliases: ['iva', 'debito_fiscal'] },
        { key: 'fees', label: 'Gastos Comerciales ($)', required: false, type: 'number', min: 0, aliases: ['gastos', 'comision', 'flete'] },
        { key: 'retentions', label: 'Retenciones Fiscales ($)', required: false, type: 'number', min: 0, aliases: ['retenciones', 'percepciones'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['notas', 'observaciones'] }
      ],
      templates: [
        { date: '15/02/2026', reference: 'LQ-A-0005-00009876', area: 'porcinos', partyName: 'Frigorífico Río Cuarto SA', price: '2150,00', lotName: 'Lote Porcino Engorde - Terminación', animals: '25', weight: '110,5', productName: '', quantity: '', campaignName: '', tax: '118793,75', fees: '15000,00', retentions: '0', note: 'Venta directa a faena capones terminados' },
        { date: '28/02/2026', reference: 'LQ-C-0002-00001234', area: 'soja', partyName: 'Cooperativa Agropecuaria Río Cuarto', price: '325,50', lotName: '', animals: '', weight: '', productName: 'Soja', quantity: '30000', campaignName: 'Lote 2 - El Bajo (Soja)', tax: '1025325,00', fees: '45000,00', retentions: '15000,00', note: 'Liquidación primaria de granos fijación' }
      ]
    },

    stock: {
      id: 'stock',
      name: 'Existencias, Cosechas e Insumos',
      module: 'mixto',
      targetTable: 'stock',
      allowedRoles: ['admin', 'responsable_agricultura', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${row.date}|${row.type}|${(row.productName || '').trim().toLowerCase()}|${Number(row.quantity || 0).toFixed(2)}`,
      fields: [
        { key: 'date', label: 'Fecha', required: true, type: 'date', aliases: ['fecha', 'dia'] },
        { key: 'type', label: 'Tipo de Movimiento', required: true, type: 'enum', options: ['apertura', 'compra', 'cosecha', 'consumo', 'merma', 'ajuste'], aliases: ['tipo', 'movimiento', 'operacion'] },
        { key: 'area', label: 'Actividad / Destino', required: true, type: 'enum', options: ['maiz', 'soja', 'porcinos', 'bovinos', 'ovinos', 'agricultura', 'cerdos'], aliases: ['area', 'actividad', 'sector'] },
        { key: 'productName', label: 'Producto / Insumo', required: true, type: 'lookup_product', aliases: ['producto', 'insumo', 'grano', 'alimento'] },
        { key: 'quantity', label: 'Cantidad', required: true, type: 'number', aliases: ['cantidad', 'kilos', 'kg', 'volumen'] },
        { key: 'unitCost', label: 'Costo Unitario ($)', required: false, type: 'number', min: 0, aliases: ['costo_unitario', 'precio_unitario', 'costo'] },
        { key: 'campaignName', label: 'Campaña Agrícola', required: false, type: 'lookup_campaign', aliases: ['campaña', 'campana'] },
        { key: 'lotName', label: 'Lote Ganadero', required: false, type: 'lookup_lot', aliases: ['lote', 'lote_ganadero'] },
        { key: 'partyName', label: 'Proveedor', required: false, type: 'lookup_party', aliases: ['proveedor', 'tercero'] },
        { key: 'tax', label: 'Impuestos ($)', required: false, type: 'number', min: 0, aliases: ['iva', 'impuesto'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['observaciones', 'notas', 'detalle'] }
      ],
      templates: [
        { date: '25/04/2026', type: 'cosecha', area: 'maiz', productName: 'Maíz', quantity: '95000,00', unitCost: '195,00', campaignName: 'Lote 1 - La Aguada (Maíz)', lotName: '', partyName: '', tax: '0', note: 'Cosecha grano comercial rinde 95 qq/ha' },
        { date: '05/02/2026', type: 'consumo', area: 'porcinos', productName: 'Maíz', quantity: '4500,00', unitCost: '195,00', campaignName: '', lotName: 'Lote Porcino Engorde - Terminación', partyName: '', tax: '0', note: 'Consumo grano propio para molienda en campo' }
      ]
    },

    movements: {
      id: 'movements',
      name: 'Movimientos Ganaderos y Sanidad',
      module: 'ganaderia',
      targetTable: 'movements',
      allowedRoles: ['admin', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${row.date}|${row.type}|${(row.lotName || '').trim().toLowerCase()}|${row.quantity || 0}|${row.weight || 0}`,
      fields: [
        { key: 'date', label: 'Fecha', required: true, type: 'date', aliases: ['fecha', 'dia'] },
        { key: 'type', label: 'Tipo de Evento', required: true, type: 'enum', options: ['pesaje', 'baja', 'traslado', 'ingreso', 'tratamiento', 'conteo'], aliases: ['tipo', 'evento', 'movimiento'] },
        { key: 'lotName', label: 'Lote Origen', required: true, type: 'lookup_lot', aliases: ['lote', 'lote_origen', 'tropa'] },
        { key: 'quantity', label: 'Cabezas', required: false, type: 'integer', min: 0, aliases: ['cabezas', 'animales', 'cantidad'] },
        { key: 'weight', label: 'Peso Promedio (kg)', required: false, type: 'number', min: 0, aliases: ['peso', 'peso_promedio', 'kg'] },
        { key: 'toLotName', label: 'Lote Destino (Traslado)', required: false, type: 'lookup_lot', aliases: ['lote_destino', 'destino'] },
        { key: 'product', label: 'Producto / Medicamento', required: false, type: 'string', aliases: ['medicamento', 'vacuna', 'producto', 'droga'] },
        { key: 'withdrawalDays', label: 'Días de Carencia', required: false, type: 'integer', min: 0, aliases: ['carencia', 'dias_carencia', 'periodo_retiro'] },
        { key: 'note', label: 'Observaciones / Causa', required: false, type: 'string', aliases: ['observaciones', 'motivo', 'causa'] }
      ],
      templates: [
        { date: '15/03/2026', type: 'pesaje', lotName: 'Lote Porcino Destete - Recría', quantity: '50', weight: '35,8', toLotName: '', product: '', withdrawalDays: '0', note: 'Pesaje periódico de control' },
        { date: '18/03/2026', type: 'tratamiento', lotName: 'Lote Porcino Engorde - Terminación', quantity: '0', weight: '0', toLotName: '', product: 'Ivermectina 1%', withdrawalDays: '28', note: 'Tratamiento antiparasitario' }
      ]
    },

    payments: {
      id: 'payments',
      name: 'Cobros y Pagos Financieros',
      module: 'comercial',
      targetTable: 'payments',
      allowedRoles: ['admin', 'responsable_agricultura', 'responsable_ganaderia', 'responsable_cerdos'],
      businessKey: (row, db) => `${(row.reference || '').trim().toLowerCase()}|${row.date}|${Number(row.amount || 0).toFixed(2)}`,
      fields: [
        { key: 'date', label: 'Fecha', required: true, type: 'date', aliases: ['fecha', 'dia'] },
        { key: 'reference', label: 'Nro Recibo / Orden de Pago', required: true, type: 'string', aliases: ['comprobante', 'recibo', 'orden_pago', 'referencia'] },
        { key: 'kind', label: 'Tipo', required: true, type: 'enum', options: ['cobro', 'pago'], aliases: ['tipo', 'movimiento'] },
        { key: 'partyName', label: 'Cliente / Proveedor', required: false, type: 'lookup_party', aliases: ['tercero', 'cliente', 'proveedor'] },
        { key: 'amount', label: 'Importe ($)', required: true, type: 'number', min: 0.01, aliases: ['importe', 'monto', 'total'] },
        { key: 'accountCode', label: 'Cuenta Caja / Banco', required: false, type: 'lookup_account', aliases: ['cuenta', 'caja_banco'] },
        { key: 'method', label: 'Medio de Pago', required: false, type: 'string', aliases: ['medio', 'forma_pago'] },
        { key: 'note', label: 'Observaciones', required: false, type: 'string', aliases: ['concepto', 'detalle', 'notas'] }
      ],
      templates: [
        { date: '20/02/2026', reference: 'REC-0001-0001234', kind: 'cobro', partyName: 'Frigorífico Río Cuarto SA', amount: '2500000,00', accountCode: '1.1.01', method: 'Transferencia Bancaria BNA', note: 'Cobro parcial liquidación hacienda' },
        { date: '22/02/2026', reference: 'OP-0001-0000567', kind: 'pago', partyName: 'Cooperativa Agropecuaria Río Cuarto', amount: '544500,00', accountCode: '1.1.01', method: 'Transferencia Bancaria BNA', note: 'Cancelación factura fertilizantes' }
      ]
    }
  };

  // -------------------------------------------------------------
  // 3. GENERADOR DE PLANTILLAS CSV DESCARGABLES
  // -------------------------------------------------------------

  function generateTemplateCsv(entityId, delimiter = ';') {
    const meta = ENTITIES[entityId];
    if (!meta) throw new Error('Entidad desconocida para plantilla: ' + entityId);

    const headers = meta.fields.map(f => f.label + (f.required ? ' *' : ''));
    const rows = (meta.templates || []).map(t => {
      return meta.fields.map(f => {
        const val = t[f.key] ?? '';
        return escapeCsvCell(val, delimiter);
      }).join(delimiter);
    });

    const headerLine = headers.map(h => escapeCsvCell(h, delimiter)).join(delimiter);
    const content = [headerLine, ...rows].join('\r\n');
    return '\uFEFF' + content; // BOM UTF-8 para apertura directa en Excel
  }

  function escapeCsvCell(val, delimiter) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // -------------------------------------------------------------
  // 4. MAPEO INTELIGENTE DE COLUMNAS
  // -------------------------------------------------------------

  function matchColumns(csvHeaders, entityId) {
    const meta = ENTITIES[entityId];
    if (!meta) throw new Error('Entidad inválida: ' + entityId);

    const mapping = {}; // fieldKey -> csvHeaderIndex
    const unmappedHeaders = [];

    function normalizeStr(str) {
      return (str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s*\*$/, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }

    const normalizedCsvHeaders = csvHeaders.map(h => normalizeStr(h));

    for (const field of meta.fields) {
      let matchedIndex = -1;
      const aliases = [
        field.key.toLowerCase(),
        normalizeStr(field.label),
        ...(field.aliases || []).map(a => normalizeStr(a))
      ];

      for (let i = 0; i < normalizedCsvHeaders.length; i++) {
        const csvH = normalizedCsvHeaders[i];
        if (!csvH) continue;
        if (aliases.some(a => csvH === a || csvH.includes(a) || (a.length > 3 && a.includes(csvH)))) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) {
        mapping[field.key] = matchedIndex;
      }
    }

    csvHeaders.forEach((h, idx) => {
      const isUsed = Object.values(mapping).includes(idx);
      if (!isUsed) unmappedHeaders.push({ index: idx, name: h });
    });

    return { mapping, unmappedHeaders };
  }

  // -------------------------------------------------------------
  // 5. PARSEO Y PRE-VALIDACIÓN TRANSACCIONAL
  // -------------------------------------------------------------

  function parseAndValidate(csvText, entityId, db, columnMapping = null, options = {}) {
    const meta = ENTITIES[entityId];
    if (!meta) throw new Error('Entidad inválida: ' + entityId);

    const text = cleanBom(csvText);
    if (!text.trim()) throw new Error('El archivo CSV se encuentra vacío.');

    const firstLine = text.split(/\r?\n/)[0];
    const delimiter = options.delimiter || detectDelimiter(firstLine);

    // Parsing con PapaParse o fallback básico
    let rawData = [];
    if (typeof Papa !== 'undefined') {
      const parsed = Papa.parse(text, {
        delimiter,
        header: false,
        skipEmptyLines: 'greedy'
      });
      if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
        throw new Error('Error al interpretar estructura CSV: ' + parsed.errors[0].message);
      }
      rawData = parsed.data || [];
    } else {
      // Fallback simple por líneas si se ejecuta en Node sin Papa global
      rawData = text.split(/\r?\n/).filter(l => l.trim()).map(line => {
        return line.split(delimiter).map(c => c.replace(/^"|"$/g, '').trim());
      });
    }

    if (rawData.length < 2) {
      throw new Error('El archivo CSV debe contener al menos una fila de encabezados y una fila de datos.');
    }

    const csvHeaders = rawData[0].map(h => (h || '').trim());
    const effectiveMapping = columnMapping || matchColumns(csvHeaders, entityId).mapping;

    // Verificar campos requeridos mapeados
    const missingRequired = meta.fields.filter(f => f.required && effectiveMapping[f.key] === undefined);
    if (missingRequired.length > 0) {
      throw new Error(`Faltan columnas requeridas obligatorias por mapear: ${missingRequired.map(f => f.label).join(', ')}`);
    }

    const dataRows = rawData.slice(1);
    const validRows = [];
    const duplicateRows = [];
    const invalidRows = [];
    const existingTable = db[meta.targetTable] || [];

    // Conjunto de claves existentes en la base
    const existingKeys = new Set();
    existingTable.filter(r => !r.voided).forEach(r => {
      try {
        const k = meta.businessKey(r, db);
        if (k) existingKeys.add(k);
      } catch (_) {}
    });

    // Detectar duplicados dentro del mismo archivo
    const inBatchKeys = new Set();

    dataRows.forEach((rowCells, rowIdx) => {
      const rowNum = rowIdx + 2; // +1 base 1, +1 por encabezado
      const rowData = {};
      const rowErrors = [];

      // Extraer campos mapeados
      for (const field of meta.fields) {
        const colIdx = effectiveMapping[field.key];
        const rawVal = colIdx !== undefined ? rowCells[colIdx] : undefined;

        if (field.required && (rawVal === undefined || rawVal === null || String(rawVal).trim() === '')) {
          rowErrors.push({ field: field.key, label: field.label, error: 'Campo requerido obligatorio vacío.' });
          continue;
        }

        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
          rowData[field.key] = null;
          continue;
        }

        // Conversión por tipo
        if (field.type === 'number') {
          const num = parseArgentineNumber(rawVal);
          if (isNaN(num)) {
            rowErrors.push({ field: field.key, label: field.label, error: `Número inválido ('${rawVal}'). Usá formato '1.250,50' o '1250.50'.` });
          } else if (field.min !== undefined && num < field.min) {
            rowErrors.push({ field: field.key, label: field.label, error: `El valor (${num}) debe ser mayor o igual a ${field.min}.` });
          } else {
            rowData[field.key] = num;
          }
        } else if (field.type === 'integer') {
          const num = parseArgentineNumber(rawVal);
          if (isNaN(num) || !Number.isInteger(num)) {
            rowErrors.push({ field: field.key, label: field.label, error: `Debe ser un número entero válido ('${rawVal}').` });
          } else if (field.min !== undefined && num < field.min) {
            rowErrors.push({ field: field.key, label: field.label, error: `El valor (${num}) debe ser mayor o igual a ${field.min}.` });
          } else {
            rowData[field.key] = num;
          }
        } else if (field.type === 'date') {
          const iso = parseArgentineDate(rawVal);
          if (!iso) {
            rowErrors.push({ field: field.key, label: field.label, error: `Fecha inválida ('${rawVal}'). Formatos admitidos: DD/MM/AAAA o AAAA-MM-DD.` });
          } else {
            rowData[field.key] = iso;
          }
        } else if (field.type === 'boolean') {
          rowData[field.key] = parseBoolean(rawVal);
        } else if (field.type === 'enum') {
          const valStr = String(rawVal).trim();
          // Búsqueda insensible a mayúsculas
          const matchOpt = field.options.find(opt => opt.toLowerCase() === valStr.toLowerCase());
          if (!matchOpt) {
            rowErrors.push({ field: field.key, label: field.label, error: `Opción no permitida ('${valStr}'). Opciones válidas: ${field.options.join(', ')}.` });
          } else {
            rowData[field.key] = matchOpt;
          }
        } else if (field.type === 'phase') {
          const valStr = String(rawVal).trim().toLowerCase();
          // Mapear con D.PHASES
          const phaseKey = Object.keys(D.PHASES).find(k => k.toLowerCase() === valStr || D.PHASES[k].toLowerCase() === valStr);
          if (!phaseKey) {
            rowErrors.push({ field: field.key, label: field.label, error: `Fase ganadera no reconocida ('${rawVal}').` });
          } else {
            rowData[field.key] = phaseKey;
          }
        } else {
          // String genérico
          rowData[field.key] = String(rawVal).trim();
        }
      }

      // Validaciones contextuales de negocio y referencias
      if (rowErrors.length === 0) {
        try {
          resolveBusinessReferences(rowData, entityId, db);
        } catch (errRef) {
          rowErrors.push({ field: 'general', label: 'Referencia', error: errRef.message });
        }
      }

      // Comprobación de duplicados
      if (rowErrors.length === 0) {
        let bKey = '';
        try {
          bKey = meta.businessKey(rowData, db);
        } catch (_) {}

        if (bKey && (existingKeys.has(bKey) || inBatchKeys.has(bKey))) {
          // Buscar el registro existente
          const matched = existingTable.find(r => !r.voided && meta.businessKey(r, db) === bKey);
          duplicateRows.push({
            rowNum,
            data: rowData,
            raw: rowCells,
            matchedRecord: matched || null,
            businessKey: bKey
          });
        } else {
          if (bKey) inBatchKeys.add(bKey);
          validRows.push({
            rowNum,
            data: rowData,
            raw: rowCells,
            businessKey: bKey
          });
        }
      } else {
        invalidRows.push({
          rowNum,
          errors: rowErrors,
          raw: rowCells
        });
      }
    });

    return {
      entityId,
      entityName: meta.name,
      totalRows: dataRows.length,
      validRows,
      duplicateRows,
      invalidRows,
      delimiter,
      headers: csvHeaders
    };
  }

  // -------------------------------------------------------------
  // 6. RESOLUCIÓN DE REFERENCIAS FORÁNEAS Y ENTIDADES
  // -------------------------------------------------------------

  function resolveBusinessReferences(row, entityId, db) {
    // Resolver Proveedor / Cliente
    if (row.partyName) {
      const p = (db.parties || []).find(x => !x.voided && x.name.trim().toLowerCase() === row.partyName.trim().toLowerCase());
      if (p) {
        row.partyId = p.id;
      } else {
        // En importaciones comerciales, si no existe el tercero, se marcará para alta automática o se requiere
        row._newParty = { name: row.partyName.trim(), kind: entityId === 'sales' ? 'cliente' : 'proveedor' };
      }
    }

    // Resolver Campaña Agrícola
    if (row.campaignName) {
      const c = (db.campaigns || []).find(x => !x.voided && x.name.trim().toLowerCase() === row.campaignName.trim().toLowerCase());
      if (!c) {
        throw new Error(`La campaña agrícola '${row.campaignName}' no existe en el sistema.`);
      }
      row.campaignId = c.id;
    }

    // Resolver Lote Ganadero
    if (row.lotName) {
      const l = (db.lots || []).find(x => !x.voided && x.name.trim().toLowerCase() === row.lotName.trim().toLowerCase());
      if (!l) {
        throw new Error(`El lote ganadero '${row.lotName}' no existe en el sistema.`);
      }
      row.lotId = l.id;
    }

    // Resolver Lote Destino en traslados
    if (row.toLotName) {
      const l = (db.lots || []).find(x => !x.voided && x.name.trim().toLowerCase() === row.toLotName.trim().toLowerCase());
      if (!l) {
        throw new Error(`El lote destino '${row.toLotName}' no existe en el sistema.`);
      }
      row.toLotId = l.id;
    }

    // Resolver Cuenta Contable
    if (row.accountCode) {
      const code = String(row.accountCode).trim();
      const a = (db.accounts || []).find(x => !x.voided && (x.code === code || x.id === code));
      if (!a) {
        throw new Error(`La cuenta contable '${code}' no existe en el plan de cuentas.`);
      }
      row.accountId = a.id;
    }

    // Resolver Producto
    if (row.productName) {
      const pName = row.productName.trim().toLowerCase();
      let prod = (db.products || []).find(x => !x.voided && x.name.trim().toLowerCase() === pName);
      if (!prod) {
        // En stock/sales se puede crear producto si es cereal conocido
        if (pName === 'maíz' || pName === 'maiz') prod = (db.products || []).find(x => x.name.toLowerCase().includes('ma'));
        else if (pName === 'soja') prod = (db.products || []).find(x => x.name.toLowerCase().includes('soja'));
      }
      if (prod) {
        row.productId = prod.id;
      } else {
        row._newProduct = { name: row.productName.trim(), kind: 'insumo', unit: 'kg' };
      }
    }
  }

  // -------------------------------------------------------------
  // 7. APLICACIÓN TRANSACCIONAL DE IMPORTACIÓN
  // -------------------------------------------------------------

  function executeImport(previewResult, db, strategy = 'skip', actor = null, filename = 'importacion.csv') {
    const meta = ENTITIES[previewResult.entityId];
    if (!meta) throw new Error('Entidad inválida.');

    const next = structuredClone(db);
    const table = meta.targetTable;
    next[table] = next[table] || [];
    next.parties = next.parties || [];
    next.products = next.products || [];
    next.imports = next.imports || [];

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const username = actor?.username || 'usuario';
    const authorRole = actor?.role || 'operador';

    // 1. Procesar registros válidos (nuevos)
    for (const item of previewResult.validRows) {
      const record = transformRowForTarget(item.data, meta, next);
      record.id = D.uid();
      record.createdAt = nowIso;
      record.createdBy = username;
      record.authorRole = authorRole;
      record.updatedAt = nowIso;
      record.updatedBy = username;

      // Validar con domain antes de insertar
      D.validate(next, table, record);
      next[table].push(record);
      insertedCount++;
    }

    // 2. Procesar registros duplicados según estrategia
    if (strategy === 'update') {
      for (const item of previewResult.duplicateRows) {
        if (!item.matchedRecord) {
          skippedCount++;
          continue;
        }
        const existingIdx = next[table].findIndex(r => r.id === item.matchedRecord.id);
        if (existingIdx !== -1) {
          const updated = {
            ...next[table][existingIdx],
            ...transformRowForTarget(item.data, meta, next),
            id: item.matchedRecord.id, // Conservar ID original
            updatedAt: nowIso,
            updatedBy: username
          };
          D.validate(next, table, updated);
          next[table][existingIdx] = updated;
          updatedCount++;
        }
      }
    } else {
      // 'skip' o 'error': se omiten
      skippedCount += previewResult.duplicateRows.length;
    }

    // 3. Registrar auditoría e historial en db.imports
    const importAuditRecord = {
      id: D.uid(),
      date: todayDate,
      time: nowIso.slice(11, 19),
      source: filename,
      filename,
      module: meta.module,
      entity: meta.name,
      totalProcessed: previewResult.totalRows,
      inserted: insertedCount,
      updated: updatedCount,
      rejected: previewResult.invalidRows.length + (strategy === 'skip' ? skippedCount : 0),
      status: previewResult.invalidRows.length === 0 ? 'success' : (insertedCount + updatedCount > 0 ? 'partial' : 'failed'),
      author: username,
      authorRole,
      content: `Importación CSV: ${insertedCount} agregados, ${updatedCount} actualizados, ${previewResult.invalidRows.length} errores.`,
      errorReport: previewResult.invalidRows.map(e => ({
        row: e.rowNum,
        errors: e.errors.map(err => `${err.label}: ${err.error}`).join(' | ')
      }))
    };

    next.imports.unshift(importAuditRecord);

    return {
      success: true,
      nextDb: next,
      insertedCount,
      updatedCount,
      skippedCount,
      rejectedCount: previewResult.invalidRows.length,
      auditRecord: importAuditRecord
    };
  }

  function transformRowForTarget(data, meta, db) {
    const record = { ...data };
    const todayStr = new Date().toISOString().slice(0, 10);

    // domain.js requiere r.date en campañas y todas las entidades operativas
    if (!record.date) {
      record.date = record.startDate || todayStr;
    }

    // Si requiere crear un nuevo tercero
    if (record._newParty) {
      let p = db.parties.find(x => !x.voided && x.name.toLowerCase() === record._newParty.name.toLowerCase());
      if (!p) {
        p = {
          id: D.uid(),
          name: record._newParty.name,
          kind: record._newParty.kind,
          taxId: '',
          createdAt: new Date().toISOString()
        };
        db.parties.push(p);
      }
      record.partyId = p.id;
      delete record._newParty;
    }

    // Si requiere crear un producto
    if (record._newProduct) {
      let prod = db.products.find(x => !x.voided && x.name.toLowerCase() === record._newProduct.name.toLowerCase());
      if (!prod) {
        prod = {
          id: D.uid(),
          name: record._newProduct.name,
          kind: record._newProduct.kind,
          unit: record._newProduct.unit,
          createdAt: new Date().toISOString()
        };
        db.products.push(prod);
      }
      record.productId = prod.id;
      delete record._newProduct;
    }

    // Quitar nombres de búsqueda planos antes de persistir
    delete record.partyName;
    delete record.campaignName;
    delete record.lotName;
    delete record.toLotName;
    delete record.accountCode;
    delete record.productName;

    return record;
  }

  // -------------------------------------------------------------
  // 8. EXPORTADOR A CSV COMPATIBLE CON EXCEL ARGENTINO
  // -------------------------------------------------------------

  function exportRecordsToCsv(table, records, db, options = {}) {
    const delimiter = options.delimiter || ';';
    const rows = records.filter(r => !r.voided);
    if (!rows.length) return '';

    // Columnas descriptivas y legibles según tabla
    let columns = [];
    if (table === 'campaigns') {
      columns = [
        { label: 'Nombre de Campaña / Lote', fn: r => r.name },
        { label: 'Cultivo', fn: r => r.crop },
        { label: 'Superficie (ha)', fn: r => formatArgentineNumber(r.hectares, 1) },
        { label: 'Fecha de Inicio', fn: r => formatArgentineDate(r.startDate || r.date) },
        { label: 'Fecha de Cierre', fn: r => formatArgentineDate(r.endDate) },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else if (table === 'lots') {
      columns = [
        { label: 'Nombre o Tropa', fn: r => r.name },
        { label: 'Especie', fn: r => r.species || 'porcinos' },
        { label: 'Fase / Categoría', fn: r => D.PHASES[r.phase] || r.phase },
        { label: 'Etapa Productiva', fn: r => r.bioStage },
        { label: 'Cabezas', fn: r => r.animals },
        { label: 'Peso Promedio (kg)', fn: r => formatArgentineNumber(r.weight, 2) },
        { label: 'Valor Inicial ($)', fn: r => formatArgentineNumber(r.openingValue, 2) },
        { label: 'Fecha de Apertura', fn: r => formatArgentineDate(r.date) },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else if (table === 'parties') {
      columns = [
        { label: 'Razón Social / Nombre', fn: r => r.name },
        { label: 'CUIT / Identificación', fn: r => r.taxId || '' },
        { label: 'Tipo', fn: r => r.kind },
        { label: 'Contacto', fn: r => r.contact || '' },
        { label: 'Correo Electrónico', fn: r => r.email || '' },
        { label: 'Teléfono', fn: r => r.phone || '' },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else if (table === 'costs') {
      columns = [
        { label: 'Fecha', fn: r => formatArgentineDate(r.date) },
        { label: 'Comprobante / Factura', fn: r => r.reference },
        { label: 'Actividad', fn: r => D.AREAS[r.area] || r.area },
        { label: 'Proveedor', fn: r => (db.parties?.find(p => p.id === r.partyId)?.name) || '' },
        { label: 'Cuenta Contable', fn: r => (db.accounts?.find(a => a.id === r.accountId)?.code) || r.accountId },
        { label: 'Importe Neto ($)', fn: r => formatArgentineNumber(r.amount, 2) },
        { label: 'IVA / Impuestos ($)', fn: r => formatArgentineNumber(r.tax || 0, 2) },
        { label: 'Campaña Agrícola', fn: r => (db.campaigns?.find(c => c.id === r.campaignId)?.name) || '' },
        { label: 'Lote Ganadero', fn: r => (db.lots?.find(l => l.id === r.lotId)?.name) || '' },
        { label: 'Detalle', fn: r => r.note || '' }
      ];
    } else if (table === 'sales') {
      columns = [
        { label: 'Fecha', fn: r => formatArgentineDate(r.date) },
        { label: 'Comprobante / Factura', fn: r => r.reference },
        { label: 'Actividad', fn: r => D.AREAS[r.area] || r.area },
        { label: 'Cliente', fn: r => (db.parties?.find(p => p.id === r.partyId)?.name) || '' },
        { label: 'Precio ($)', fn: r => formatArgentineNumber(r.price, 2) },
        { label: 'Cabezas', fn: r => r.animals || '' },
        { label: 'Peso Promedio (kg)', fn: r => r.weight ? formatArgentineNumber(r.weight, 2) : '' },
        { label: 'Producto / Grano', fn: r => (db.products?.find(p => p.id === r.productId)?.name) || '' },
        { label: 'Kg Vendidos', fn: r => r.quantity ? formatArgentineNumber(r.quantity, 2) : '' },
        { label: 'IVA ($)', fn: r => formatArgentineNumber(r.tax || 0, 2) },
        { label: 'Gastos Comerciales ($)', fn: r => formatArgentineNumber(r.fees || 0, 2) },
        { label: 'Importe Total ($)', fn: r => formatArgentineNumber(r.gross || (Number(r.price || 0) * Number(r.quantity || r.animals || 1)), 2) },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else if (table === 'stock') {
      columns = [
        { label: 'Fecha', fn: r => formatArgentineDate(r.date) },
        { label: 'Tipo Movimiento', fn: r => r.type },
        { label: 'Actividad', fn: r => D.AREAS[r.area] || r.area },
        { label: 'Producto', fn: r => (db.products?.find(p => p.id === r.productId)?.name) || '' },
        { label: 'Cantidad', fn: r => formatArgentineNumber(r.quantity, 2) },
        { label: 'Costo Unitario ($)', fn: r => r.unitCost ? formatArgentineNumber(r.unitCost, 2) : '' },
        { label: 'Campaña', fn: r => (db.campaigns?.find(c => c.id === r.campaignId)?.name) || '' },
        { label: 'Lote', fn: r => (db.lots?.find(l => l.id === r.lotId)?.name) || '' },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else if (table === 'movements') {
      columns = [
        { label: 'Fecha', fn: r => formatArgentineDate(r.date) },
        { label: 'Tipo Evento', fn: r => r.type },
        { label: 'Lote Origen', fn: r => (db.lots?.find(l => l.id === r.lotId)?.name) || '' },
        { label: 'Cabezas', fn: r => r.quantity || '' },
        { label: 'Peso Promedio (kg)', fn: r => r.weight ? formatArgentineNumber(r.weight, 2) : '' },
        { label: 'Lote Destino', fn: r => (db.lots?.find(l => l.id === r.toLotId)?.name) || '' },
        { label: 'Medicamento / Tratamiento', fn: r => r.product || '' },
        { label: 'Días de Carencia', fn: r => r.withdrawalDays || '' },
        { label: 'Observaciones', fn: r => r.note || '' }
      ];
    } else {
      // Fallback genérico para cualquier otra tabla
      const keys = [...new Set(rows.flatMap(Object.keys))].filter(k => !['history', 'voided', 'isDemo'].includes(k));
      columns = keys.map(k => ({ label: k, fn: r => r[k] ?? '' }));
    }

    const headerLine = columns.map(c => escapeCsvCell(c.label, delimiter)).join(delimiter);
    const dataLines = rows.map(r => columns.map(c => escapeCsvCell(c.fn(r), delimiter)).join(delimiter));

    return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  }

  // -------------------------------------------------------------
  // 9. EXPORTACIÓN DEL MÓDULO
  // -------------------------------------------------------------

  const UNRCCsv = {
    ENTITIES,
    cleanBom,
    detectDelimiter,
    parseArgentineNumber,
    parseArgentineDate,
    formatArgentineDate,
    formatArgentineNumber,
    generateTemplateCsv,
    matchColumns,
    parseAndValidate,
    executeImport,
    exportRecordsToCsv
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UNRCCsv;
  }
  root.UNRCCsv = UNRCCsv;
})(typeof globalThis !== 'undefined' ? globalThis : this);
