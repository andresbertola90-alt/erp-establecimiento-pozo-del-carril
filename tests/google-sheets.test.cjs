'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sheetsModule = require('../backend/sheets.cjs');
const dbModule = require('../backend/database.cjs');

test('Google Sheets: Normalización completa de las 15 hojas operativas y ejecutivas', () => {
  const db = dbModule.getDatabase();
  const tables = sheetsModule.normalizeTables(db);

  const expectedSheets = [
    'ResumenEjecutivo',
    'CampanasAgricolas',
    'TransferenciasCereal',
    'LotesGanado',
    'MovimientosGanado',
    'Productos',
    'ConsumosAlimento',
    'ComprasEInsumos',
    'Ventas',
    'CostosYGastos',
    'CobrosYPagos',
    'Cuentas',
    'RenglonesDiario',
    'ProveedoresClientes',
    'Auditoria'
  ];

  for (const sheetName of expectedSheets) {
    assert.ok(tables[sheetName], `Debe existir la hoja "${sheetName}"`);
    assert.ok(Array.isArray(tables[sheetName].headers), `La hoja "${sheetName}" debe contener encabezados`);
    assert.ok(tables[sheetName].headers.length > 0, `La hoja "${sheetName}" debe tener al menos una columna`);
    assert.ok(Array.isArray(tables[sheetName].rows), `La hoja "${sheetName}" debe contener filas`);
  }

  // Verify Executive Summary contains essential ERP institutional metadata
  const execRows = tables.ResumenEjecutivo.rows;
  const labels = execRows.map(r => r[0]);
  assert.ok(labels.includes('Establecimiento'));
  assert.ok(labels.includes('Planilla de Base de Datos'));
  assert.ok(labels.includes('Fecha de Sincronización'));
});

test('Google Sheets: Exclusión estricta de datos sensibles de autenticación y claves', () => {
  const db = dbModule.getDatabase();
  const tables = sheetsModule.normalizeTables(db);

  // 1. users table must NOT be exposed as a worksheet
  assert.strictEqual(tables.users, undefined, 'No debe existir hoja de usuarios');
  assert.strictEqual(tables.Usuarios, undefined, 'No debe existir hoja de usuarios');

  // 2. Scan all string cells across all sheets to ensure no passwords or hashes leak
  for (const [sheetName, { headers, rows }] of Object.entries(tables)) {
    for (const h of headers) {
      assert.ok(!h.toLowerCase().includes('password'), `El encabezado "${h}" en "${sheetName}" no debe ser password`);
      assert.ok(!h.toLowerCase().includes('token'), `El encabezado "${h}" en "${sheetName}" no debe ser token`);
      assert.ok(!h.toLowerCase().includes('recoverycode'), `El encabezado "${h}" en "${sheetName}" no debe ser recoveryCode`);
    }

    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'string') {
          assert.ok(!cell.includes('"password"'), `No debe haber propiedades password en los datos de "${sheetName}"`);
          assert.ok(!cell.includes('"passwordHash"'), `No debe haber hashes de contraseña en "${sheetName}"`);
          assert.ok(!cell.includes('"recoveryCode"'), `No debe haber códigos de recuperación en "${sheetName}"`);
        }
      }
    }
  }
});

test('Google Sheets: Generación de libro Excel multi-pestaña (.xlsx)', async () => {
  const db = dbModule.getDatabase();
  const buffer = await sheetsModule.generateExcelWorkbook(db);

  assert.ok(buffer, 'Debe generar un buffer válido');
  assert.ok(buffer.length > 1000, 'El archivo generado debe contener bytes reales de un archivo Excel');
});

test('Google Sheets: getStatus y saveConfig preservan la URL y el ID de forma coherente', () => {
  const initial = sheetsModule.loadConfig();
  const status = sheetsModule.getStatus();
  assert.ok(typeof status.configured === 'boolean');
  assert.ok(typeof status.hasSheetId === 'boolean');
  assert.ok(status.oAuthClientId, 'Debe exponer oAuthClientId de Google Workspace');

  const testId = '1TestSpreadsheetIdPozoDelCarrilUNRC2026';
  const saved = sheetsModule.saveConfig({ sheetId: testId });
  assert.strictEqual(saved.sheetId, testId);
  assert.strictEqual(saved.sheetUrl, `https://docs.google.com/spreadsheets/d/${testId}/edit`);

  const updatedStatus = sheetsModule.getStatus();
  assert.strictEqual(updatedStatus.sheetId, testId);
  assert.strictEqual(updatedStatus.sheetUrl, `https://docs.google.com/spreadsheets/d/${testId}/edit`);

  // Restore initial clean config
  sheetsModule.saveConfig(initial);
});

test('Google Sheets: Inocuidad sobre la base de datos principal local (/data/database.json)', async () => {
  const dbBefore = dbModule.getDatabase();
  const revBefore = dbBefore.revision;

  // Attempt sync without token -> fails gracefully without crashing or mutating database
  const result = await sheetsModule.syncToGoogleSheets(dbBefore, { googleAccessToken: '' });
  assert.strictEqual(result.success, false);
  assert.ok(result.needsAuth || result.message);

  const dbAfter = dbModule.getDatabase();
  assert.strictEqual(dbAfter.revision, revBefore, 'La revisión de la base de datos debe permanecer idéntica');
  assert.strictEqual(dbAfter.accounts.length, dbBefore.accounts.length);
  assert.strictEqual(dbAfter.lots.length, dbBefore.lots.length);
});
