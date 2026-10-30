'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const authModule = require('../backend/auth.cjs');
const dbModule = require('../backend/database.cjs');

test('MODIFICACIÓN 13: 1. Declaración de los 5 roles institucionales', () => {
  const roles = authModule.ROLES;
  assert.ok(roles.admin, 'Rol admin debe existir');
  assert.ok(roles.responsable_agricultura, 'Rol responsable_agricultura debe existir');
  assert.ok(roles.responsable_ganaderia, 'Rol responsable_ganaderia debe existir');
  assert.ok(roles.analista, 'Rol analista debe existir');
  assert.ok(roles.auditor, 'Rol auditor debe existir');

  assert.equal(roles.admin.canWriteAll, true, 'Admin debe tener canWriteAll');
  assert.equal(roles.analista.readonly, true, 'Analista debe ser readonly');
  assert.equal(roles.auditor.readonly, true, 'Auditor debe ser readonly');
});

test('MODIFICACIÓN 13: 2. Autenticación de cuentas sembradas para los 5 roles', () => {
  const adminRes = authModule.authenticate('admin', 'AdminPozo2026!*');
  assert.ok(adminRes.success, 'Login admin exitoso');
  assert.equal(adminRes.user.role, 'admin');

  const agriRes = authModule.authenticate('agricultura', 'AgriculturaUNRC2026!');
  assert.ok(agriRes.success, 'Login agricultura exitoso');
  assert.equal(agriRes.user.role, 'responsable_agricultura');

  const ganRes = authModule.authenticate('ganaderia', 'GanaderiaUNRC2026!');
  assert.ok(ganRes.success, 'Login ganadería exitoso');
  assert.equal(ganRes.user.role, 'responsable_ganaderia');

  const analistaRes = authModule.authenticate('analista', 'AnalistaUNRC2026!');
  assert.ok(analistaRes.success, 'Login analista exitoso');
  assert.equal(analistaRes.user.role, 'analista');

  const auditorRes = authModule.authenticate('auditor', 'AuditorUNRC2026!');
  assert.ok(auditorRes.success, 'Login auditor exitoso');
  assert.equal(auditorRes.user.role, 'auditor');
});

test('MODIFICACIÓN 13: 3. Modo estricto de Solo Lectura para Analista y Auditor (Backend)', async () => {
  const analistaActor = { id: 'u-analista', username: 'analista', role: 'analista' };
  const auditorActor = { id: 'u-auditor', username: 'auditor', role: 'auditor' };

  // Analista no puede crear ni modificar registros
  await assert.rejects(
    async () => {
      await dbModule.commitRecord(analistaActor, {
        table: 'campaigns',
        record: { id: 'camp-test-1', name: 'Campaña Maíz Test', hectares: 20 }
      });
    },
    /Acceso denegado: El perfil Analista funciona en modo de solo lectura/
  );

  // Analista no puede anular registros
  await assert.rejects(
    async () => {
      await dbModule.cancelRecord(analistaActor, {
        table: 'campaigns',
        id: 'camp-test-1',
        reason: 'Intento de anulación por analista'
      });
    },
    /Acceso denegado: El perfil Analista funciona en modo de solo lectura/
  );

  // Auditor no puede crear ni modificar registros
  await assert.rejects(
    async () => {
      await dbModule.commitRecord(auditorActor, {
        table: 'lots',
        record: { id: 'lot-test-1', name: 'Lote Bovinos Test', animals: 15 }
      });
    },
    /Acceso denegado: El perfil Auditor tiene acceso de solo lectura/
  );

  // Auditor no puede anular registros
  await assert.rejects(
    async () => {
      await dbModule.cancelRecord(auditorActor, {
        table: 'lots',
        id: 'lot-test-1',
        reason: 'Intento de anulación por auditor'
      });
    },
    /Acceso denegado: El perfil Auditor tiene acceso de solo lectura/
  );
});

test('MODIFICACIÓN 13: 4. Delimitación de áreas para Responsable de Agricultura y Ganadería', async () => {
  const agriActor = { id: 'u-agri', username: 'agricultura', role: 'responsable_agricultura' };
  const ganActor = { id: 'u-gan', username: 'ganaderia', role: 'responsable_ganaderia' };

  // Responsable de Agricultura NO puede crear ni operar lotes ni movimientos de Ganadería
  await assert.rejects(
    async () => {
      await dbModule.commitRecord(agriActor, {
        table: 'lots',
        record: { id: 'lot-agri-err', name: 'Intento Lote', animals: 10 }
      });
    },
    /el responsable de Agricultura no puede operar registros de Ganadería/
  );

  // Responsable de Ganadería NO puede crear campañas agrícolas
  await assert.rejects(
    async () => {
      await dbModule.commitRecord(ganActor, {
        table: 'campaigns',
        record: { id: 'camp-gan-err', name: 'Intento Campaña', hectares: 50 }
      });
    },
    /el responsable de Ganadería no puede gestionar campañas agrícolas/
  );

  // Ningún responsable de área puede tocar cuentas ni configuraciones
  await assert.rejects(
    async () => {
      await dbModule.commitRecord(agriActor, {
        table: 'accounts',
        record: { id: 'acc-err', code: '9.9.99', name: 'Cuenta Ilegal' }
      });
    },
    /Solo los administradores pueden gestionar el plan de cuentas/
  );
});

test('MODIFICACIÓN 13: 5. Filtro de visibilidad y protección de auditoría (filterDataForActor)', () => {
  const mockDb = {
    campaigns: [{ id: 'c1', name: 'Maíz Lote 1' }],
    lots: [{ id: 'l1', name: 'Piara Reproductores' }],
    sows: [{ id: 's1', name: 'Madre 101' }],
    births: [{ id: 'b1', sowId: 's1' }],
    movements: [{ id: 'm1', lotId: 'l1' }],
    costs: [
      { id: 'c-agri', area: 'agricultura', amount: 50000 },
      { id: 'c-gan', area: 'cerdos', amount: 80000 },
      { id: 'c-com', area: 'comun', amount: 20000 }
    ],
    sales: [
      { id: 's-agri', area: 'agricultura', price: 100 },
      { id: 's-gan', area: 'cerdos', price: 200 }
    ],
    auditLog: [{ id: 'ev1', action: 'crear', table: 'sales' }]
  };

  // 1. Admin ve todo, incluyendo auditLog
  const adminView = dbModule.filterDataForActor(mockDb, { role: 'admin' });
  assert.equal(adminView.campaigns.length, 1);
  assert.equal(adminView.lots.length, 1);
  assert.equal(adminView.auditLog.length, 1);

  // 2. Auditor ve todo, incluyendo auditLog
  const auditorView = dbModule.filterDataForActor(mockDb, { role: 'auditor' });
  assert.equal(auditorView.campaigns.length, 1);
  assert.equal(auditorView.lots.length, 1);
  assert.equal(auditorView.auditLog.length, 1, 'Auditor debe poder consultar el registro de auditoría');

  // 3. Analista ve datos operativos pero NO auditLog (Consultar auditoría: No)
  const analistaView = dbModule.filterDataForActor(mockDb, { role: 'analista' });
  assert.equal(analistaView.campaigns.length, 1);
  assert.equal(analistaView.lots.length, 1);
  assert.equal(analistaView.auditLog.length, 0, 'Analista no debe consultar auditoría');

  // 4. Responsable de Agricultura ve solo agricultura y NO ganadería ni auditoría
  const agriView = dbModule.filterDataForActor(mockDb, { role: 'responsable_agricultura' });
  assert.equal(agriView.campaigns.length, 1);
  assert.equal(agriView.lots.length, 0, 'Agricultura no ve lotes ganaderos');
  assert.equal(agriView.sows.length, 0);
  assert.equal(agriView.auditLog.length, 0, 'Agricultura no consulta auditoría');
  assert.equal(agriView.sales.length, 1);
  assert.equal(agriView.sales[0].area, 'agricultura');

  // 5. Responsable de Ganadería ve solo ganadería y NO agricultura ni auditoría
  const ganView = dbModule.filterDataForActor(mockDb, { role: 'responsable_ganaderia' });
  assert.equal(ganView.campaigns.length, 0, 'Ganadería no ve campañas agrícolas');
  assert.equal(ganView.lots.length, 1);
  assert.equal(ganView.auditLog.length, 0, 'Ganadería no consulta auditoría');
  assert.equal(ganView.sales.length, 1);
  assert.equal(ganView.sales[0].area, 'cerdos');
});

test('MODIFICACIÓN 13: 6. Gestión de usuarios, protección de rol propio y último admin', () => {
  const adminActor = { id: 'admin-id-1', username: 'admin', role: 'admin' };
  const users = authModule.loadUsers();
  const adminUser = users.find(u => u.username === 'admin');
  assert.ok(adminUser, 'Usuario admin existe');

  // Impedir que un usuario modifique su propio rol
  assert.throws(
    () => {
      authModule.updateUser({ id: adminUser.id, username: adminUser.username, role: 'admin' }, adminUser.id, {
        role: 'analista'
      });
    },
    /Un usuario no puede modificar su propio rol/
  );

  // Rol por defecto si se especifica uno inválido o vacío: 'analista' (strict read-only)
  const testUsername = 'testuser' + Date.now().toString().slice(-6);
  const created = authModule.createUser(adminActor, {
    username: testUsername,
    name: 'Usuario Prueba Default',
    password: 'PasswordSegura2026!*',
    role: 'rol_inexistente'
  });
  assert.equal(created.user.role, 'analista', 'Rol no reconocido debe asignarse a analista');

  // Administrador puede cambiar el rol de otro usuario
  const updated = authModule.updateUser(adminActor, created.user.id, {
    role: 'responsable_agricultura'
  });
  assert.equal(updated.role, 'responsable_agricultura', 'Admin pudo cambiar rol de otro usuario');
});
