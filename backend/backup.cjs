'use strict';

const crypto = require('node:crypto');
const dbManager = require('./database.cjs');
const transfer = require('../transfer.js');

function createBackup(actor, format = 'json') {
  if (!actor) throw new Error('Se requiere sesión para generar respaldos.');
  const db = dbManager.getDatabase();

  const backupData = {
    app: 'Establecimiento Pozo del Carril - UNRC',
    exportVersion: 4,
    exportedAt: new Date().toISOString(),
    exportedBy: actor.username,
    revision: db.revision,
    database: db
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');
  const ext = format === 'unrc' ? 'unrc' : 'json';

  return {
    filename: `respaldo-pozo-del-carril-rev${db.revision}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    content: jsonStr,
    checksum,
    revision: db.revision,
    exportedAt: backupData.exportedAt
  };
}

async function restoreFromBackup(actor, rawContent) {
  if (!actor || actor.role !== 'admin') {
    throw new Error('Solo un administrador puede restaurar copias de respaldo.');
  }

  let parsed;
  try {
    parsed = typeof rawContent === 'object' ? rawContent : JSON.parse(rawContent);
  } catch {
    throw new Error('El archivo de respaldo no tiene un formato JSON / UNRC válido.');
  }

  const targetDb = parsed.database || parsed;
  transfer.inspect(targetDb);

  return dbManager.restoreDatabase(actor, targetDb);
}

module.exports = {
  createBackup,
  restoreFromBackup,
  listSafetyBackups: dbManager.listSafetyBackups,
  rollbackSafetyBackup: dbManager.rollbackSafetyBackup
};
