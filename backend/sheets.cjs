'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'sheets-config.json');
const FIREBASE_CONFIG_FILE = path.join(__dirname, '..', 'firebase-applet-config.json');
const SPREADSHEET_TITLE = 'UNRC - Establecimiento Pozo del Carril - Base de Datos ERP';

function ensureDataDir() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getOAuthClientId() {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID) return process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf8'));
      if (cfg.oAuthClientId) return cfg.oAuthClientId;
    } catch {
      // ignore
    }
  }
  return '177492426308-mq3mnbtt5b7b5u134fjmsr8om1cn56ca.apps.googleusercontent.com';
}

function loadConfig() {
  ensureDataDir();
  let fileConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      fileConfig = {};
    }
  }
  const sheetId = process.env.GOOGLE_SHEET_ID || fileConfig.sheetId || '';
  const sheetUrl = fileConfig.sheetUrl || (sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : '');

  return {
    sheetId,
    sheetUrl,
    title: fileConfig.title || SPREADSHEET_TITLE,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || fileConfig.serviceAccountEmail || '',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || fileConfig.privateKey || '',
    lastSync: fileConfig.lastSync || null,
    lastStatus: fileConfig.lastStatus || null,
    lastError: fileConfig.lastError || null,
    tablesCount: fileConfig.tablesCount || 0,
    totalRows: fileConfig.totalRows || 0
  };
}

function saveConfig(updates) {
  ensureDataDir();
  const current = loadConfig();
  const merged = { ...current, ...updates };
  if (merged.sheetId && !merged.sheetUrl) {
    merged.sheetUrl = `https://docs.google.com/spreadsheets/d/${merged.sheetId}/edit`;
  }
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return merged;
}

function getStatus() {
  const cfg = loadConfig();
  const hasSheetId = Boolean(cfg.sheetId && cfg.sheetId.trim());
  const hasAuth = Boolean(cfg.serviceAccountEmail && cfg.privateKey);
  const oAuthClientId = getOAuthClientId();

  return {
    configured: hasSheetId,
    hasSheetId,
    hasAuth,
    sheetId: cfg.sheetId,
    sheetUrl: cfg.sheetUrl,
    title: cfg.title,
    serviceAccountEmail: cfg.serviceAccountEmail || '',
    oAuthClientId,
    lastSync: cfg.lastSync,
    lastStatus: cfg.lastStatus || (hasSheetId ? 'Planilla vinculada · Lista para sincronizar' : 'Pendiente de sincronización inicial con Google Drive'),
    lastError: cfg.lastError,
    tablesCount: cfg.tablesCount || 0,
    totalRows: cfg.totalRows || 0
  };
}

// Generates normalized tabular data for each Google Sheet without sensitive auth data
function normalizeTables(db) {
  const nowStr = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' });

  // 1. Executive Summary tab
  const totalLots = (db.lots || []).filter(l => !l.voided).length;
  const totalAnimals = (db.lots || []).filter(l => !l.voided).reduce((acc, l) => acc + (Number(l.animals) || 0), 0);
  const totalCampaigns = (db.campaigns || []).filter(c => !c.voided).length;
  const totalAgriHa = (db.campaigns || []).filter(c => !c.voided).reduce((acc, c) => acc + (Number(c.hectares) || 0), 0);
  const totalCosts = (db.costs || []).filter(c => !c.voided).length;
  const totalSales = (db.sales || []).filter(s => !s.voided).length;
  const totalEntries = (db.entries || []).filter(e => !e.voided).length;
  const totalAccounts = (db.accounts || []).filter(a => !a.voided).length;
  const totalAudit = (db.auditLog || []).length;

  const executiveRows = [
    ['Establecimiento', 'Establecimiento Pozo del Carril', '200 ha mixtas', 'Universidad Nacional de Río Cuarto (UNRC) · FCE'],
    ['Asignatura / Carrera', 'Taller de Práctica II', 'Contador Público Nacional', 'Ciclo Lectivo 2026'],
    ['Planilla de Base de Datos', SPREADSHEET_TITLE, 'Google Sheets v4', 'Sincronización Unidireccional ERP -> Google Sheets'],
    ['Fecha de Sincronización', nowStr, 'Hora Oficial Argentina', 'Fuente de Verdad: ERP Establecimiento Pozo del Carril'],
    ['Superficie Agrícola', `${totalAgriHa} ha`, '50 ha Maíz + 50 ha Soja', 'Rotación Agrícola y Grano para Consumo Interno'],
    ['Campañas Agrícolas Registradas', totalCampaigns, 'campañas', 'Costos directos, labores, fertilización y rinde'],
    ['Lotes Ganaderos Activos', totalLots, 'lotes', 'Porcinos (Semi-Intensivo), Bovinos Feedlot, Ovinos Dorper'],
    ['Existencias Ganaderas', totalAnimals, 'cabezas vivas', 'Trazabilidad individual, pesajes y biomasa'],
    ['Plan de Cuentas Bimonetario', totalAccounts, 'cuentas contables', 'Plan Oficial UNRC FCE'],
    ['Comprobantes de Costos y Compras', totalCosts, 'comprobantes', 'Alimentación, sanidad veterinaria, labores e insumos'],
    ['Operaciones de Venta', totalSales, 'liquidaciones', 'Capones terminados, novillos, corderos, maíz y soja'],
    ['Asientos de Libro Diario', totalEntries, 'asientos formales', 'Partida doble balanceada en Pesos Argentinos (ARS)'],
    ['Eventos de Auditoría', totalAudit, 'registros inmutables', 'Trazabilidad de operaciones sin exponer claves']
  ];

  // 2. Accounts
  const accounts = (db.accounts || []).map(a => [
    a.id, a.code, a.name, a.kind, a.parent || '', a.heading ? 'SI' : 'NO', a.managed ? 'SI' : 'NO', a.cash ? 'SI' : 'NO', a.source || '', a.planVersion || 0, a.voided ? 'SI' : 'NO'
  ]);

  // 3. Products
  const products = (db.products || []).map(p => [
    p.id, p.code || '', p.name, p.kind || '', p.unit || 'kg', p.inventoryAccountId || '', p.bagKg || '', p.voided ? 'SI' : 'NO'
  ]);

  // 4. Livestock Lots (all species)
  const lots = (db.lots || []).map(l => [
    l.id, l.code || '', l.name, l.species || (l.phase && l.phase.startsWith('fase') ? 'porcino' : 'porcino'),
    l.phase || '', l.bioStage || '', l.date || '', l.animals || 0, l.weight || 0, l.openingValue || 0, l.voided ? 'SI' : 'NO'
  ]);

  // 5. Agricultural Campaigns
  const campaigns = (db.campaigns || []).map(c => [
    c.id, c.code || '', c.name, c.crop || '', c.hectares || 0, c.year || '', c.cost || 0, c.harvestKg || '', c.voided ? 'SI' : 'NO'
  ]);

  // 6. Third Parties
  const parties = (db.parties || []).map(p => [
    p.id, p.kind || '', p.name, p.taxId || '', p.phone || '', p.email || '', p.address || '', p.voided ? 'SI' : 'NO'
  ]);

  // 7. Livestock Movements
  const movements = (db.movements || []).map(m => [
    m.id, m.date, m.type, m.lotId || '', m.toLotId || '', m.quantity || 0, m.weight || 0, m.unitCost || 0, m.note || '',
    m.medication || '', m.activeIngredient || '', m.responsible || '', m.dose || '', m.headsAffected || '', m.docRef || '',
    m.withdrawalDays || 0, m.withdrawalEndDate || '', m.cost || 0, m.voided ? 'SI' : 'NO', m.createdBy || '', m.createdAt || ''
  ]);

  // 8. Feed Consumptions
  const stockFeed = (db.stock || []).filter(s => s.type === 'consumo').map(s => [
    s.id, s.date, s.area || '', s.lotId || '', s.productId || '', s.quantity || 0, s.inputUnit || 'kg', s.bagKg || '', s.unitCost || 0, s.tax || 0, s.note || '', s.voided ? 'SI' : 'NO', s.createdBy || ''
  ]);

  // 9. Purchases and inputs
  const stockPurchases = (db.stock || []).filter(s => s.type !== 'consumo').map(s => [
    s.id, s.date, s.type, s.area || '', s.productId || '', s.campaignId || '', s.partyId || '', s.quantity || 0, s.unitCost || 0, s.tax || 0, s.note || '', s.voided ? 'SI' : 'NO', s.createdBy || ''
  ]);

  // 10. Grain Transfers
  const transfers = (db.transfers || []).map(t => [
    t.id, t.date, t.productId || '', t.campaignId || '', t.quantity || 0, t.opportunityPrice || 0, t.priceDate || '', t.source || '', t.note || '', t.voided ? 'SI' : 'NO', t.createdBy || ''
  ]);

  // 11. Sales
  const sales = (db.sales || []).map(s => [
    s.id, s.date, s.area, s.partyId, s.reference, s.lotId || s.productId || '', s.animals || s.quantity || 0, s.weight || 0, s.price || 0,
    s.tax || 0, s.fees || 0, s.retentions || 0, s.perceptions || 0, s.destiny || '', s.voided ? 'SI' : 'NO', s.createdBy || ''
  ]);

  // 12. Collections and payments
  const payments = (db.payments || []).map(p => [
    p.id, p.date, p.sourceId, p.amount || 0, p.method || 'efectivo', p.note || '', p.voided ? 'SI' : 'NO', p.createdBy || ''
  ]);

  // 13. Costs and expenses
  const costs = (db.costs || []).map(c => [
    c.id, c.date, c.area, c.accountId, c.partyId || '', c.reference || '', c.net || 0, c.tax || 0, c.nonTaxable || 0, c.retentions || 0, c.perceptions || 0, c.total || 0, c.note || '', c.voided ? 'SI' : 'NO', c.createdBy || ''
  ]);

  // 14. Normalized journal entries & rows
  const journalRows = [];
  const entries = db.entries || [];
  for (const e of entries) {
    if (e.lines && Array.isArray(e.lines)) {
      e.lines.forEach((l, idx) => {
        const acc = (db.accounts || []).find(a => a.id === l.accountId);
        journalRows.push([
          e.id, `${e.id}_${idx + 1}`, e.date, e.area, e.description, e.reference || '', l.accountId, acc?.code || '', acc?.name || '', l.debit || 0, l.credit || 0, e.automatic ? 'SI' : 'NO', e.voided ? 'SI' : 'NO'
        ]);
      });
    }
  }

  // 15. Audit Log (strictly sanitizing passwords, recovery codes, tokens)
  const auditLog = (db.auditLog || []).map(a => {
    let cleanBefore = '';
    let cleanAfter = '';
    try {
      if (a.before) {
        const b = { ...a.before };
        delete b.password; delete b.passwordHash; delete b.recoveryCode; delete b.token;
        cleanBefore = JSON.stringify(b);
      }
      if (a.after) {
        const af = { ...a.after };
        delete af.password; delete af.passwordHash; delete af.recoveryCode; delete af.token;
        cleanAfter = JSON.stringify(af);
      }
    } catch {
      cleanBefore = '';
      cleanAfter = '';
    }

    return [
      a.id, a.timestamp, a.actor?.username || '', a.actor?.role || '', a.action, a.table, a.recordId || '', a.summary || '',
      cleanBefore, cleanAfter, a.revision || 0
    ];
  });

  return {
    ResumenEjecutivo: {
      headers: ['Concepto', 'Valor', 'Unidad / Especificación', 'Detalle Institucional'],
      rows: executiveRows
    },
    CampanasAgricolas: {
      headers: ['ID', 'Código', 'Nombre', 'Cultivo', 'Hectáreas', 'Año/Campaña', 'Costo Inversión', 'Rinde Kg', 'Anulado'],
      rows: campaigns
    },
    TransferenciasCereal: {
      headers: ['ID', 'Fecha', 'Producto Grano ID', 'Campaña Origen ID', 'Cantidad Kg', 'Precio Oportunidad Kg', 'Fecha Cotización', 'Fuente Cotización', 'Nota', 'Anulado', 'Creado Por'],
      rows: transfers
    },
    LotesGanado: {
      headers: ['ID', 'Código', 'Nombre', 'Especie', 'Fase Productiva', 'Etapa Biológica', 'Fecha Apertura', 'Cabezas', 'Peso Promedio Kg', 'Valor Apertura', 'Anulado'],
      rows: lots
    },
    MovimientosGanado: {
      headers: ['ID', 'Fecha', 'Tipo', 'Lote ID', 'Lote Destino ID', 'Cabezas', 'Peso Kg', 'Costo Unitario', 'Motivo/Nota', 'Medicamento', 'Principio Activo', 'Responsable', 'Dosis', 'Cabezas Afectadas', 'Doc Respaldo', 'Días Carencia', 'Fecha Fin Carencia', 'Costo Sanidad', 'Anulado', 'Creado Por', 'Fecha Creación'],
      rows: movements
    },
    Productos: {
      headers: ['ID', 'Código', 'Nombre', 'Categoría', 'Unidad', 'Cuenta Existencias ID', 'Kg por Bolsa', 'Anulado'],
      rows: products
    },
    ConsumosAlimento: {
      headers: ['ID', 'Fecha', 'Actividad', 'Lote ID', 'Producto ID', 'Cantidad Kg', 'Unidad Entrada', 'Factor Bolsa', 'Costo Unitario', 'Impuestos', 'Nota', 'Anulado', 'Creado Por'],
      rows: stockFeed
    },
    ComprasEInsumos: {
      headers: ['ID', 'Fecha', 'Tipo', 'Actividad', 'Producto ID', 'Campaña ID', 'Proveedor ID', 'Cantidad', 'Costo Unitario', 'Impuestos', 'Nota', 'Anulado', 'Creado Por'],
      rows: stockPurchases
    },
    Ventas: {
      headers: ['ID', 'Fecha', 'Actividad', 'Comprador ID', 'Comprobante', 'Lote/Producto ID', 'Cabezas/Kg', 'Peso Promedio', 'Precio Unitario', 'IVA Débito', 'Gastos Comerciales', 'Retenciones', 'Percepciones', 'Destino Faena', 'Anulado', 'Creado Por'],
      rows: sales
    },
    CostosYGastos: {
      headers: ['ID', 'Fecha', 'Actividad', 'Cuenta Imputación ID', 'Proveedor ID', 'Comprobante', 'Neto Gravado', 'IVA Crédito', 'No Gravado', 'Retenciones Sufridas', 'Percepciones', 'Total Comprobante', 'Nota', 'Anulado', 'Creado Por'],
      rows: costs
    },
    CobrosYPagos: {
      headers: ['ID', 'Fecha', 'Documento Origen ID', 'Importe', 'Medio Pago', 'Nota', 'Anulado', 'Creado Por'],
      rows: payments
    },
    Cuentas: {
      headers: ['ID', 'Código', 'Nombre', 'Clasificación', 'Cuenta Padre', 'Es Grupo', 'Bienes Gestionados', 'Es Caja', 'Origen', 'Versión Plan', 'Anulado'],
      rows: accounts
    },
    RenglonesDiario: {
      headers: ['Asiento ID', 'Renglón ID', 'Fecha', 'Actividad', 'Concepto', 'Comprobante', 'Cuenta ID', 'Cuenta Código', 'Cuenta Nombre', 'Debe', 'Haber', 'Es Automático', 'Anulado'],
      rows: journalRows
    },
    ProveedoresClientes: {
      headers: ['ID', 'Tipo', 'Razón Social', 'CUIT/Doc', 'Teléfono', 'Email', 'Dirección', 'Anulado'],
      rows: parties
    },
    Auditoria: {
      headers: ['ID', 'Marca Temporal', 'Usuario', 'Rol', 'Acción', 'Tabla', 'Registro ID', 'Descripción', 'Datos Anteriores', 'Datos Nuevos', 'Revisión'],
      rows: auditLog
    }
  };
}

// Builds multi-tab Excel workbook with all normalized tables
async function generateExcelWorkbook(db) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Establecimiento Pozo del Carril - UNRC';
  workbook.created = new Date();

  const tables = normalizeTables(db);

  for (const [sheetName, { headers, rows }] of Object.entries(tables)) {
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
      properties: { tabColor: { argb: 'FF1B83B2' } }
    });

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B83B2' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach(r => sheet.addRow(r));

    // Auto fit column widths
    sheet.columns.forEach((column, i) => {
      let maxLen = headers[i] ? headers[i].length : 10;
      column.width = Math.min(Math.max(maxLen + 4, 12), 45);
    });
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Searches Google Drive for an existing spreadsheet by name or checks provided sheetId.
 */
async function resolveSpreadsheet(token, preferredSheetId) {
  const headers = { Authorization: `Bearer ${token}` };

  // 1. If a preferredSheetId is supplied, verify it exists and is accessible
  if (preferredSheetId && preferredSheetId.trim()) {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${preferredSheetId.trim()}?fields=spreadsheetId,properties.title,spreadsheetUrl`, { headers });
      if (res.ok) {
        const data = await res.json();
        return {
          id: data.spreadsheetId,
          url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
          title: data.properties?.title || SPREADSHEET_TITLE
        };
      }
    } catch {
      // ignore and fallback to search
    }
  }

  // 2. Search Drive for existing spreadsheet named SPREADSHEET_TITLE
  try {
    const query = encodeURIComponent(`name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, { headers });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        return {
          id: file.id,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
          title: file.name
        };
      }
    }
  } catch (err) {
    console.warn('[Sheets] Error searching Drive for existing file:', err.message);
  }

  // 3. Create a brand new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE }
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error al crear la planilla en Google Sheets (${createRes.status}): ${errText}`);
  }

  const created = await createRes.json();
  const newId = created.spreadsheetId;
  const newUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}/edit`;

  // 4. Set share permission: reader for anyone with link so the teaching team can view it
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${newId}/permissions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (permErr) {
    console.warn('[Sheets] Could not set public link permission (ignorable):', permErr.message);
  }

  return {
    id: newId,
    url: newUrl,
    title: SPREADSHEET_TITLE
  };
}

/**
 * Ensures all normalized tables exist as worksheets inside the spreadsheet.
 */
async function ensureWorksheets(token, spreadsheetId, targetSheetNames) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Fetch current sheets
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers });
  if (!metaRes.ok) {
    throw new Error(`No se pudo obtener la estructura de la planilla (${metaRes.status})`);
  }

  const metaData = await metaRes.json();
  const existingSheets = metaData.sheets || [];
  const existingTitles = new Set(existingSheets.map(s => s.properties?.title));

  const addRequests = [];
  for (const name of targetSheetNames) {
    if (!existingTitles.has(name)) {
      addRequests.push({
        addSheet: {
          properties: {
            title: name,
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      });
    }
  }

  if (addRequests.length > 0) {
    const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: addRequests })
    });
    if (!batchRes.ok) {
      const errTxt = await batchRes.text();
      console.warn('[Sheets] Warning adding sheets via batchUpdate:', errTxt);
    }
  }
}

/**
 * Synchronizes ERP database to Google Sheets unidirectionally.
 * Does NOT modify local database.json under any circumstances.
 */
async function syncToGoogleSheets(db, options = {}) {
  const cfg = loadConfig();
  const token = options.googleAccessToken || options.accessToken || process.env.GOOGLE_ACCESS_TOKEN;
  const preferredSheetId = options.sheetId || cfg.sheetId;

  if (!token) {
    // If no token is provided but service account credentials exist, indicate that OAuth GIS is preferred
    const hasAuth = Boolean(cfg.serviceAccountEmail && cfg.privateKey);
    return {
      success: false,
      configured: Boolean(cfg.sheetId),
      sheetUrl: cfg.sheetUrl,
      needsAuth: true,
      message: 'Se requiere autorización de Google Workspace para sincronizar la planilla. Hacé clic en "Sincronizar con Google Sheets" para otorgar acceso.'
    };
  }

  try {
    // Step 1: Find or Create Spreadsheet
    const sheetMeta = await resolveSpreadsheet(token, preferredSheetId);
    const spreadsheetId = sheetMeta.id;
    const spreadsheetUrl = sheetMeta.url;

    // Step 2: Normalize ERP tables
    const tables = normalizeTables(db);
    const tableNames = Object.keys(tables);

    // Step 3: Ensure worksheets exist
    await ensureWorksheets(token, spreadsheetId, tableNames);

    // Step 4: Write all normalized rows via values:batchUpdate
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const valueData = [];
    let totalRowsCount = 0;

    for (const [sheetName, { headers, rows }] of Object.entries(tables)) {
      const allRows = [headers, ...rows];
      totalRowsCount += rows.length;
      valueData.push({
        range: `'${sheetName}'!A1`,
        values: allRows
      });
    }

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Error escribiendo datos en Google Sheets (${updateRes.status}): ${errText}`);
    }

    // Step 5: Save sync results in sheets-config.json
    const now = new Date().toISOString();
    saveConfig({
      sheetId: spreadsheetId,
      sheetUrl: spreadsheetUrl,
      title: SPREADSHEET_TITLE,
      lastSync: now,
      lastStatus: 'Sincronizado con éxito',
      lastError: null,
      tablesCount: tableNames.length,
      totalRows: totalRowsCount
    });

    return {
      success: true,
      configured: true,
      sheetId: spreadsheetId,
      sheetUrl: spreadsheetUrl,
      title: SPREADSHEET_TITLE,
      syncedAt: now,
      tablesCount: tableNames.length,
      totalRows: totalRowsCount,
      tables: tableNames,
      message: 'Sincronización con Google Sheets completada exitosamente.'
    };
  } catch (err) {
    console.error('[Sheets] Synchronization error:', err);
    saveConfig({
      lastStatus: 'Error de sincronización',
      lastError: err.message
    });
    return {
      success: false,
      configured: Boolean(cfg.sheetId),
      sheetUrl: cfg.sheetUrl,
      error: err.message,
      message: `No se pudo completar la sincronización con Google Sheets: ${err.message}`
    };
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getStatus,
  normalizeTables,
  generateExcelWorkbook,
  syncToGoogleSheets,
  SPREADSHEET_TITLE
};

