'use strict';

const fs = require('node:fs');
const path = require('node:path');
const UNRC = require('../domain.js');
const Plan = require('../assets/account-plan.js');
const Audit = require('../audit.js');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'database.json');
const IDEMPOTENCY_FILE = process.env.IDEMPOTENCY_FILE || path.join(__dirname, '..', 'data', 'idempotency.json');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

let inMemoryDb = null;
let idempotencyMap = new Map();
let queuePromise = Promise.resolve();

function ensureDataDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureBackupDir() {
  ensureDataDir();
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function loadIdempotency() {
  ensureDataDir();
  if (fs.existsSync(IDEMPOTENCY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(IDEMPOTENCY_FILE, 'utf8'));
      idempotencyMap = new Map(Object.entries(data));
    } catch {
      idempotencyMap = new Map();
    }
  }
}

function saveIdempotency() {
  ensureDataDir();
  // Keep only the most recent 1000 operation entries
  if (idempotencyMap.size > 1000) {
    const entries = [...idempotencyMap.entries()].slice(-1000);
    idempotencyMap = new Map(entries);
  }
  const obj = Object.fromEntries(idempotencyMap);
  const tmp = IDEMPOTENCY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, IDEMPOTENCY_FILE);
}

function getDatabase() {
  if (inMemoryDb) return inMemoryDb;
  ensureDataDir();
  loadIdempotency();

  if (!fs.existsSync(DB_FILE)) {
    const fresh = UNRC.initial();
    fresh.accounts = fresh.accounts || [];
    const upgraded = Plan.upgrade(UNRC.upgradeWorkflow(fresh));
    upgraded.revision = 1;
    upgraded.lastSavedBy = 'sistema';
    upgraded.auditLog = [
      Audit.event({ username: 'sistema', role: 'admin' }, 'inicio', 'system', '', 'Inicialización del sistema de gestión centralizado', null, null)
    ];
    saveToDisk(upgraded);
    inMemoryDb = upgraded;
    return inMemoryDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const upgraded = Plan.upgrade(UNRC.upgradeWorkflow(parsed));
    if (!upgraded.revision) upgraded.revision = 1;
    if (!upgraded.auditLog) upgraded.auditLog = [];
    inMemoryDb = upgraded;
    return inMemoryDb;
  } catch (err) {
    console.error('Error loading database from disk, creating fresh state:', err);
    const fallback = Plan.upgrade(UNRC.upgradeWorkflow(UNRC.initial()));
    fallback.revision = 1;
    fallback.lastSavedBy = 'sistema';
    fallback.auditLog = [];
    inMemoryDb = fallback;
    return inMemoryDb;
  }
}

function saveToDisk(data) {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function checkPermissions(actor, table, record, action = 'commit') {
  if (!actor) throw new Error('Se requiere una sesión autenticada.');
  if (actor.role === 'admin') return true;

  if (actor.role === 'analista') {
    throw new Error('Acceso denegado: El perfil Analista funciona en modo de solo lectura y no puede crear, modificar ni anular registros.');
  }

  if (actor.role === 'auditor') {
    throw new Error('Acceso denegado: El perfil Auditor tiene acceso de solo lectura y no puede crear, modificar ni anular registros.');
  }

  // Unit responsibles
  if (actor.role === 'responsable_agricultura') {
    const forbiddenLivestockTables = ['lots', 'sows', 'births', 'treatments', 'movements'];
    if (forbiddenLivestockTables.includes(table)) {
      throw new Error('Acceso denegado: el responsable de Agricultura no puede operar registros de Ganadería.');
    }
    if (record && record.area && !['agricultura', 'maiz', 'soja', 'comun'].includes(record.area)) {
      throw new Error('Acceso denegado: solo podés operar comprobantes de Agricultura.');
    }
    if (['accounts', 'closings', 'settings', 'users', 'scenarios'].includes(table)) {
      throw new Error('Solo los administradores pueden gestionar el plan de cuentas, cierres o configuraciones.');
    }
    return true;
  }

  if (actor.role === 'responsable_ganaderia' || actor.role === 'responsable_cerdos') {
    if (table === 'campaigns') {
      throw new Error('Acceso denegado: el responsable de Ganadería no puede gestionar campañas agrícolas.');
    }
    if (table === 'transfers' && record && record.campaignId && !record.lotId) {
      throw new Error('Acceso denegado: solo el responsable agrícola puede emitir cosechas o campañas.');
    }
    if (record && record.area && ['agricultura', 'maiz', 'soja'].includes(record.area)) {
      throw new Error('Acceso denegado: solo podés operar comprobantes de Ganadería.');
    }
    if (['accounts', 'closings', 'settings', 'users', 'scenarios'].includes(table)) {
      throw new Error('Solo los administradores pueden gestionar el plan de cuentas, cierres o configuraciones.');
    }
    return true;
  }

  // Operators / legacy fallback: read only
  throw new Error(`Acceso denegado: El rol "${actor.role}" no tiene permisos de modificación en el sistema.`);
}

function checkSanitaryWithdrawal(db, sale) {
  if (!sale || !['cerdos', 'porcinos', 'bovinos', 'ovinos'].includes(sale.area) || !sale.lotId) return;
  // If explicitly for slaughter ('faena') or general sale to slaughter
  const isSlaughter = sale.destiny === 'faena' || sale.forSlaughter === true;
  if (!isSlaughter) return;

  const lotId = sale.lotId;
  const saleDate = sale.date || new Date().toISOString().slice(0, 10);

  // Check direct treatments on this lot
  const treatments = (db.movements || []).filter(m =>
    !m.voided &&
    m.type === 'tratamiento' &&
    m.lotId === lotId &&
    m.withdrawalEndDate &&
    m.withdrawalEndDate >= saleDate
  );

  // Also check treatments on source lots if animals were transferred
  const transfers = (db.movements || []).filter(m =>
    !m.voided &&
    m.type === 'traslado' &&
    m.toLotId === lotId
  );

  const sourceLotIds = new Set(transfers.map(t => t.lotId));
  const upstreamTreatments = (db.movements || []).filter(m =>
    !m.voided &&
    m.type === 'tratamiento' &&
    sourceLotIds.has(m.lotId) &&
    m.withdrawalEndDate &&
    m.withdrawalEndDate >= saleDate
  );

  const allActive = [...treatments, ...upstreamTreatments];
  if (allActive.length > 0) {
    const t = allActive[0];
    const med = t.medication || 'Medicamento veterinario';
    const ing = t.activeIngredient ? ` (${t.activeIngredient})` : '';
    throw new Error(
      `El lote ${sale.lotId} tiene animales bajo período de carencia sanitaria por ${med}${ing} hasta el ${t.withdrawalEndDate}. No se permite la venta a faena antes de su liberación.`
    );
  }
}

// Executes work sequentially to guarantee concurrency safety
function synchronized(fn) {
  const resultPromise = queuePromise.then(fn);
  queuePromise = resultPromise.catch(() => {});
  return resultPromise;
}

function commitRecord(actor, { table, record, expectedRevision, operationId }) {
  return synchronized(async () => {
    // Check idempotency first
    if (operationId && idempotencyMap.has(operationId)) {
      const prev = idempotencyMap.get(operationId);
      const db = getDatabase();
      return { success: true, idempotent: true, revision: db.revision, data: db };
    }

    const db = getDatabase();

    // Concurrency verification
    if (expectedRevision != null && Number(expectedRevision) !== Number(db.revision)) {
      const err = new Error(`Conflicto de concurrencia: otra ventana o usuario guardó cambios (revisión actual ${db.revision}, esperada ${expectedRevision}). Recargá la página antes de continuar.`);
      err.statusCode = 409;
      err.currentRevision = db.revision;
      throw err;
    }

    // Role and scope permission check
    checkPermissions(actor, table, record, 'commit');

    // Sanitary withdrawal check for pig sales to slaughter
    if (table === 'sales') {
      checkSanitaryWithdrawal(db, record);
    }

    // Execute domain commit with all business rules and balance calculations
    const previousRow = db[table]?.find(r => r.id === record.id);
    const nextDb = UNRC.commit(db, table, record);

    // Increment revision
    nextDb.revision = (db.revision || 0) + 1;
    nextDb.lastSavedBy = actor.username;
    nextDb.lastSavedAt = new Date().toISOString();

    // Audit trail
    const auditEvent = Audit.event(
      actor,
      previousRow ? 'modificar' : 'crear',
      table,
      record.id,
      record.reference || record.name || record.code || record.id,
      previousRow || null,
      record
    );
    auditEvent.revision = nextDb.revision;
    nextDb.auditLog = [...(nextDb.auditLog || []), auditEvent];

    // Persist
    saveToDisk(nextDb);
    inMemoryDb = nextDb;

    // Cache idempotency
    if (operationId) {
      idempotencyMap.set(operationId, { revision: nextDb.revision, timestamp: Date.now() });
      saveIdempotency();
    }

    return { success: true, revision: nextDb.revision, data: nextDb };
  });
}

function cancelRecord(actor, { table, id, expectedRevision, operationId }) {
  return synchronized(async () => {
    checkPermissions(actor, table, null, 'cancel');

    if (operationId && idempotencyMap.has(operationId)) {
      const db = getDatabase();
      return { success: true, idempotent: true, revision: db.revision, data: db };
    }

    const db = getDatabase();

    if (expectedRevision != null && Number(expectedRevision) !== Number(db.revision)) {
      const err = new Error(`Conflicto de concurrencia: otra ventana o usuario guardó cambios (revisión actual ${db.revision}, esperada ${expectedRevision}). Recargá la página antes de continuar.`);
      err.statusCode = 409;
      err.currentRevision = db.revision;
      throw err;
    }

    const previousRow = db[table]?.find(r => r.id === id);
    if (!previousRow) throw new Error('El registro a anular no existe.');

    checkPermissions(actor, table, previousRow, 'cancel');

    const nextDb = UNRC.cancel(db, table, id);
    nextDb.revision = (db.revision || 0) + 1;
    nextDb.lastSavedBy = actor.username;
    nextDb.lastSavedAt = new Date().toISOString();

    const auditEvent = Audit.event(
      actor,
      'anular',
      table,
      id,
      previousRow.reference || previousRow.name || previousRow.code || id,
      previousRow,
      { voided: true }
    );
    auditEvent.revision = nextDb.revision;
    nextDb.auditLog = [...(nextDb.auditLog || []), auditEvent];

    saveToDisk(nextDb);
    inMemoryDb = nextDb;

    if (operationId) {
      idempotencyMap.set(operationId, { revision: nextDb.revision, timestamp: Date.now() });
      saveIdempotency();
    }

    return { success: true, revision: nextDb.revision, data: nextDb };
  });
}

function filterDataForActor(db, actor) {
  if (!actor) return db;
  const copy = structuredClone(db);

  // Consultar auditoría: Solo Administrador y Auditor
  if (actor.role !== 'admin' && actor.role !== 'auditor') {
    copy.auditLog = [];
  }

  // Administrador, Auditor y Analista pueden consultar todas las áreas operativas
  if (actor.role === 'admin' || actor.role === 'auditor' || actor.role === 'analista') {
    return copy;
  }

  // Responsable de Agricultura: Consultar agricultura Sí, Consultar ganadería No
  if (actor.role === 'responsable_agricultura') {
    copy.lots = [];
    copy.sows = [];
    copy.births = [];
    copy.movements = [];
    copy.sales = (copy.sales || []).filter(s => ['agricultura', 'maiz', 'soja'].includes(s.area));
    copy.costs = (copy.costs || []).filter(c => ['agricultura', 'maiz', 'soja', 'comun'].includes(c.area));
    copy.stock = (copy.stock || []).filter(st => ['agricultura', 'maiz', 'soja'].includes(st.area) || !st.area);
    return copy;
  }

  // Responsable de Ganadería: Consultar ganadería Sí, Consultar agricultura No
  if (actor.role === 'responsable_ganaderia' || actor.role === 'responsable_cerdos') {
    copy.campaigns = [];
    copy.sales = (copy.sales || []).filter(s => ['cerdos', 'porcinos', 'bovinos', 'ovinos', 'ganaderia'].includes(s.area));
    copy.costs = (copy.costs || []).filter(c => ['cerdos', 'porcinos', 'bovinos', 'ovinos', 'ganaderia', 'comun'].includes(c.area));
    copy.stock = (copy.stock || []).filter(st => ['cerdos', 'porcinos', 'bovinos', 'ovinos', 'ganaderia'].includes(st.area) || !st.area);
    return copy;
  }

  return copy;
}

function listSafetyBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  return files.map(file => {
    const full = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(full);
    return {
      filename: file,
      size: stats.size,
      createdAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function rollbackSafetyBackup(actor, filename) {
  return synchronized(async () => {
    if (!actor || actor.role !== 'admin') {
      throw new Error('Solo un administrador puede revertir respaldos de seguridad.');
    }
    ensureBackupDir();
    const safeName = path.basename(filename);
    const full = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(full)) {
      throw new Error('El archivo de respaldo de seguridad especificado no existe.');
    }
    const raw = fs.readFileSync(full, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = Plan.upgrade(UNRC.upgradeWorkflow(parsed));
    const current = getDatabase();
    validated.revision = (current.revision || 0) + 1;
    validated.lastSavedBy = actor.username;
    validated.lastSavedAt = new Date().toISOString();

    const auditEvent = Audit.event(
      actor,
      'importar',
      'system',
      safeName,
      'Reversión al respaldo de seguridad automático anterior',
      null,
      { safetyFile: safeName }
    );
    auditEvent.revision = validated.revision;
    validated.auditLog = [...(validated.auditLog || []), auditEvent];

    saveToDisk(validated);
    inMemoryDb = validated;
    return { success: true, revision: validated.revision, data: validated };
  });
}

function restoreDatabase(actor, newDb) {
  return synchronized(async () => {
    if (!actor || actor.role !== 'admin') {
      throw new Error('Solo un administrador puede restaurar la base de datos.');
    }
    const validated = Plan.upgrade(UNRC.upgradeWorkflow(structuredClone(newDb)));
    const current = getDatabase();

    // Crear respaldo de seguridad automático del estado previo antes de sobrescribir
    ensureBackupDir();
    const safetySnapshotFilename = `safety-pre-restore-rev${current.revision || 0}-${Date.now()}.json`;
    const safetyPath = path.join(BACKUP_DIR, safetySnapshotFilename);
    fs.writeFileSync(safetyPath, JSON.stringify(current, null, 2), 'utf8');

    validated.revision = (current.revision || 0) + 1;
    validated.lastSavedBy = actor.username;
    validated.lastSavedAt = new Date().toISOString();

    const auditEvent = Audit.event(
      actor,
      'importar',
      'system',
      safetySnapshotFilename,
      'Restauración de base de datos desde respaldo verificado (respaldo previo resguardado)',
      null,
      {
        recordsCount: UNRC.TABLES.reduce((n, t) => n + (validated[t] || []).length, 0),
        safetySnapshot: safetySnapshotFilename
      }
    );
    auditEvent.revision = validated.revision;
    validated.auditLog = [...(validated.auditLog || []), auditEvent];

    saveToDisk(validated);
    inMemoryDb = validated;
    return { success: true, revision: validated.revision, data: validated, safetySnapshot: safetySnapshotFilename };
  });
}

function syncDatabase(actor, { data, expectedRevision, context }) {
  return synchronized(async () => {
    if (!actor) throw new Error('Se requiere una sesión autenticada.');
    if (actor.role === 'auditor') {
      throw new Error('El perfil Consulta / Auditoría tiene acceso de solo lectura y no puede modificar registros.');
    }

    const current = getDatabase();

    if (expectedRevision != null && Number(expectedRevision) !== Number(current.revision)) {
      const err = new Error(`Conflicto de concurrencia: otra ventana o usuario guardó cambios (revisión actual ${current.revision}, esperada ${expectedRevision}). Recargá la página antes de continuar.`);
      err.statusCode = 409;
      err.currentRevision = current.revision;
      throw err;
    }

    // Role-based restrictions check for modified tables
    for (const t of UNRC.TABLES) {
      const currentList = current[t] || [];
      const incomingList = data[t] || [];
      for (const inc of incomingList) {
        const prev = currentList.find(r => r.id === inc.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(inc)) {
          checkPermissions(actor, t, inc, 'commit');
          if (t === 'sales') {
            checkSanitaryWithdrawal(current, inc);
          }
        }
      }
    }

    const nextDb = Plan.upgrade(UNRC.upgradeWorkflow(structuredClone(data)));
    nextDb.revision = (current.revision || 0) + 1;
    nextDb.lastSavedBy = actor.username;
    nextDb.lastSavedAt = new Date().toISOString();

    const changes = Audit.changes(current, nextDb, actor);
    nextDb.auditLog = [...(current.auditLog || []), ...changes.map(ev => ({ ...ev, revision: nextDb.revision }))];

    saveToDisk(nextDb);
    inMemoryDb = nextDb;
    return { success: true, revision: nextDb.revision, data: nextDb };
  });
}

const Demo = require('../demo-data.js');

function loadDemo(actor) {
  return synchronized(async () => {
    if (!actor) throw new Error('Se requiere una sesión autenticada.');
    const db = getDatabase();
    const nextDb = Demo.loadDemoData(db);
    nextDb.revision = (db.revision || 0) + 1;
    nextDb.lastSavedBy = actor.username;
    nextDb.lastSavedAt = new Date().toISOString();

    const auditEvent = Audit.event(
      actor,
      'importar',
      'system',
      'demo-2026',
      'Carga de datos de demostración coherentes (5 Unidades de Negocio - Año 2026)',
      null,
      { isDemo: true, period: '2026' }
    );
    auditEvent.revision = nextDb.revision;
    nextDb.auditLog = [...(nextDb.auditLog || []), auditEvent];

    saveToDisk(nextDb);
    inMemoryDb = nextDb;
    return { success: true, revision: nextDb.revision, data: nextDb };
  });
}

function cleanDemo(actor) {
  return synchronized(async () => {
    if (!actor) throw new Error('Se requiere una sesión autenticada.');
    const db = getDatabase();
    const nextDb = Demo.cleanDemoData(db);
    nextDb.revision = (db.revision || 0) + 1;
    nextDb.lastSavedBy = actor.username;
    nextDb.lastSavedAt = new Date().toISOString();

    const auditEvent = Audit.event(
      actor,
      'anular',
      'system',
      'demo-2026',
      'Limpieza segura de datos de demostración (restauración sin afectar datos reales)',
      null,
      { isDemo: false }
    );
    auditEvent.revision = nextDb.revision;
    nextDb.auditLog = [...(nextDb.auditLog || []), auditEvent];

    saveToDisk(nextDb);
    inMemoryDb = nextDb;
    return { success: true, revision: nextDb.revision, data: nextDb };
  });
}

module.exports = {
  getDatabase,
  commitRecord,
  cancelRecord,
  filterDataForActor,
  restoreDatabase,
  syncDatabase,
  loadDemo,
  cleanDemo,
  listSafetyBackups,
  rollbackSafetyBackup
};
