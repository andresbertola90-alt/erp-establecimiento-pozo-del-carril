const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../domain.js');
const Csv = require('../csv-engine.js');

function setupBaseDb() {
  const d = D.initial();
  d.parties.push({ id: 'p1', name: 'Cooperativa Agropecuaria Río Cuarto', taxId: '30-54123456-9', kind: 'ambos' });
  d.products.push({ id: 'pr1', name: 'Maíz', kind: 'grano', unit: 'kg' });
  d.campaigns.push({ id: 'c1', name: 'Lote 1 - La Aguada (Maíz)', crop: 'Maíz', hectares: 45.5, date: '2026-01-01' });
  d.lots.push({ id: 'l1', name: 'Lote Porcino Engorde - Terminación', species: 'porcinos', phase: 'engorde_terminacion', bioStage: 'engorde', animals: 50, weight: 85, openingValue: 4000000, date: '2026-01-01' });
  return d;
}

test('CSV Engine: detección de delimitador (punto y coma vs coma)', () => {
  assert.equal(Csv.detectDelimiter('Nombre;Cultivo;Superficie;Fecha'), ';');
  assert.equal(Csv.detectDelimiter('Nombre,Cultivo,Superficie,Fecha'), ',');
  assert.equal(Csv.detectDelimiter(''), ';'); // Por defecto punto y coma
});

test('CSV Engine: parseo de números con formato argentino (coma decimal, punto de miles, signo $)', () => {
  assert.equal(Csv.parseArgentineNumber('1.234,56'), 1234.56);
  assert.equal(Csv.parseArgentineNumber('1234,56'), 1234.56);
  assert.equal(Csv.parseArgentineNumber('$ 1.250,00'), 1250.0);
  assert.equal(Csv.parseArgentineNumber('ARS 450.000,50'), 450000.5);
  assert.equal(Csv.parseArgentineNumber('-500,25'), -500.25);
  assert.equal(Csv.parseArgentineNumber('(1.200,50)'), -1200.5);
  assert.equal(Csv.parseArgentineNumber('1250.50'), 1250.5); // Fallback estándar
  assert.ok(isNaN(Csv.parseArgentineNumber('no_es_numero')));
});

test('CSV Engine: parseo de fechas en formato argentino (DD/MM/AAAA) y formato ISO', () => {
  assert.equal(Csv.parseArgentineDate('15/03/2026'), '2026-03-15');
  assert.equal(Csv.parseArgentineDate('01/01/2026'), '2026-01-01');
  assert.equal(Csv.parseArgentineDate('2026-05-20'), '2026-05-20');
  assert.equal(Csv.parseArgentineDate('31/02/2026'), null); // Fecha inexistente rechazada
  assert.equal(Csv.parseArgentineDate('fecha_invalida'), null);
});

test('CSV Engine: generación de plantillas CSV para todas las entidades soportadas', () => {
  const supported = ['campaigns', 'lots', 'parties', 'costs', 'sales', 'stock', 'movements', 'payments'];
  for (const ent of supported) {
    const csv = Csv.generateTemplateCsv(ent, ';');
    assert.ok(csv.startsWith('\uFEFF'), `Plantilla ${ent} debe incluir BOM UTF-8`);
    assert.ok(csv.includes(';'), `Plantilla ${ent} debe usar delimitador ;`);
    assert.ok(csv.length > 50, `Plantilla ${ent} debe contener encabezados y ejemplos`);
  }
});

test('CSV Engine: importación de datos válidos con punto y coma y coma decimal', () => {
  const db = setupBaseDb();
  const csvContent = [
    'Nombre de Campaña / Lote;Cultivo;Superficie (ha);Fecha de Inicio;Fecha de Cierre;Observaciones',
    'Lote Soja Norte;Soja;55,5;10/11/2025;20/05/2026;Lote en siembra directa',
    'Lote Maiz Sur;Maíz;30,0;01/10/2025;15/04/2026;Maíz de primera'
  ].join('\r\n');

  const preview = Csv.parseAndValidate(csvContent, 'campaigns', db);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validRows.length, 2);
  assert.equal(preview.duplicateRows.length, 0);
  assert.equal(preview.invalidRows.length, 0);

  const res = Csv.executeImport(preview, db, 'skip', { username: 'admin', role: 'admin' }, 'campanas.csv');
  assert.equal(res.insertedCount, 2);
  assert.equal(res.nextDb.campaigns.length, db.campaigns.length + 2);
  assert.equal(res.nextDb.imports.length, 1);
  assert.equal(res.nextDb.imports[0].status, 'success');
});

test('CSV Engine: rechazo de datos incorrectos con identificación precisa de errores', () => {
  const db = setupBaseDb();
  const csvWithErrors = [
    'Nombre de Campaña / Lote;Cultivo;Superficie (ha);Fecha de Inicio;Fecha de Cierre;Observaciones',
    ';Soja;55,5;10/11/2025;20/05/2026;Falta nombre', // Falta nombre
    'Lote Invalido;CultivoInexistente;30,0;01/10/2025;15/04/2026;Cultivo no admitido', // Cultivo no admitido
    'Lote Superficie Negativa;Maíz;-10,5;01/10/2025;15/04/2026;Ha negativa', // Superficie negativa
    'Lote Fecha Invalida;Maíz;25,0;31/02/2026;15/04/2026;Fecha inexistente' // 31 feb
  ].join('\r\n');

  const preview = Csv.parseAndValidate(csvWithErrors, 'campaigns', db);
  assert.equal(preview.totalRows, 4);
  assert.equal(preview.validRows.length, 0);
  assert.equal(preview.invalidRows.length, 4);
  assert.ok(preview.invalidRows[0].errors.some(e => e.field === 'name'));
  assert.ok(preview.invalidRows[1].errors.some(e => e.field === 'crop'));
  assert.ok(preview.invalidRows[2].errors.some(e => e.field === 'hectares'));
  assert.ok(preview.invalidRows[3].errors.some(e => e.field === 'startDate'));
});

test('CSV Engine: detección de registros duplicados y estrategia de actualización vs omisión', () => {
  const db = setupBaseDb();
  // Lote 1 - La Aguada (Maíz) ya existe en db
  const csvContent = [
    'Nombre de Campaña / Lote;Cultivo;Superficie (ha);Fecha de Inicio;Fecha de Cierre;Observaciones',
    'Lote 1 - La Aguada (Maíz);Maíz;50,0;01/10/2025;30/04/2026;Superficie corregida', // Duplicado de c1
    'Lote Nuevo Girasol;Otro;20,0;01/11/2025;15/03/2026;Nuevo lote'
  ].join('\r\n');

  const preview = Csv.parseAndValidate(csvContent, 'campaigns', db);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validRows.length, 1);
  assert.equal(preview.duplicateRows.length, 1);
  assert.equal(preview.duplicateRows[0].matchedRecord.id, 'c1');

  // Estrategia 1: 'skip'
  const resSkip = Csv.executeImport(preview, db, 'skip', { username: 'admin' }, 'test_skip.csv');
  assert.equal(resSkip.insertedCount, 1);
  assert.equal(resSkip.updatedCount, 0);
  assert.equal(resSkip.nextDb.campaigns.find(c => c.id === 'c1').hectares, 45.5); // Sin alterar

  // Estrategia 2: 'update'
  const resUpdate = Csv.executeImport(preview, db, 'update', { username: 'admin' }, 'test_update.csv');
  assert.equal(resUpdate.insertedCount, 1);
  assert.equal(resUpdate.updatedCount, 1);
  assert.equal(resUpdate.nextDb.campaigns.find(c => c.id === 'c1').hectares, 50.0); // Actualizado
});

test('CSV Engine: validación de referencias foráneas cruzadas (campaña o lote inexistente)', () => {
  const db = setupBaseDb();
  const costsCsv = [
    'Fecha;Comprobante / Factura;Actividad / Área;Proveedor;Cuenta Contable;Importe Neto ($);IVA / Impuestos ($);IVA Recuperable (Sí/No);Campaña Agrícola;Lote Ganadero;Detalle / Concepto',
    '15/01/2026;FC-0001;maiz;Cooperativa Agropecuaria Río Cuarto;5.4.02;100000,00;21000,00;Sí;Campaña Fantasma;;Compra fertilizante'
  ].join('\r\n');

  const preview = Csv.parseAndValidate(costsCsv, 'costs', db);
  assert.equal(preview.invalidRows.length, 1);
  assert.ok(preview.invalidRows[0].errors[0].error.includes('no existe'));
});

test('CSV Engine: exportación de registros a CSV y verificación de compatibilidad con Excel', () => {
  const db = setupBaseDb();
  const csv = Csv.exportRecordsToCsv('campaigns', db.campaigns, db);
  assert.ok(csv.startsWith('\uFEFF'), 'Debe incluir BOM UTF-8');
  assert.ok(csv.includes('Lote 1 - La Aguada (Maíz)'));
  assert.ok(csv.includes('45,5')); // Formato numérico con coma
  assert.ok(csv.includes('01/01/2026')); // Formato fecha DD/MM/AAAA
});

test('CSV Engine: ciclo de ida y vuelta (round-trip) no genera duplicaciones ni altera registros', () => {
  const db = setupBaseDb();
  const initialCount = db.campaigns.length;

  // 1. Exportar campañas existentes
  const exportedCsv = Csv.exportRecordsToCsv('campaigns', db.campaigns, db);

  // 2. Parsear el archivo exportado
  const preview = Csv.parseAndValidate(exportedCsv, 'campaigns', db);
  assert.equal(preview.totalRows, initialCount);
  assert.equal(preview.validRows.length, 0); // No hay nuevos
  assert.equal(preview.duplicateRows.length, initialCount); // Todos detectados como existentes
  assert.equal(preview.invalidRows.length, 0);

  // 3. Ejecutar con estrategia 'skip'
  const res = Csv.executeImport(preview, db, 'skip', { username: 'admin' }, 'roundtrip.csv');
  assert.equal(res.insertedCount, 0, 'No debe insertar filas duplicadas');
  assert.equal(res.nextDb.campaigns.length, initialCount, 'La cantidad de registros debe ser idéntica');
});

test('CSV Engine: control de permisos por rol (preparación Modificación 13)', () => {
  const allowedAdminAgri = Csv.ENTITIES.campaigns.allowedRoles.includes('admin');
  const allowedAgriAgri = Csv.ENTITIES.campaigns.allowedRoles.includes('responsable_agricultura');
  const allowedLivestockAgri = Csv.ENTITIES.campaigns.allowedRoles.includes('responsable_ganaderia');
  const allowedAnalistaAgri = Csv.ENTITIES.campaigns.allowedRoles.includes('analista');
  const allowedAuditorAgri = Csv.ENTITIES.campaigns.allowedRoles.includes('auditor');

  assert.ok(allowedAdminAgri, 'Admin puede importar agricultura');
  assert.ok(allowedAgriAgri, 'Responsable agricultura puede importar agricultura');
  assert.ok(!allowedLivestockAgri, 'Responsable ganadería NO puede importar agricultura');
  assert.ok(!allowedAnalistaAgri, 'Analista NO puede importar (solo consulta/exportación)');
  assert.ok(!allowedAuditorAgri, 'Auditor NO puede importar (solo consulta/exportación)');

  const allowedLivestockGan = Csv.ENTITIES.lots.allowedRoles.includes('responsable_ganaderia');
  const allowedAgriGan = Csv.ENTITIES.lots.allowedRoles.includes('responsable_agricultura');
  assert.ok(allowedLivestockGan, 'Responsable ganadería puede importar ganadería');
  assert.ok(!allowedAgriGan, 'Responsable agricultura NO puede importar ganadería');
});

