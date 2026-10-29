const fs = require('node:fs');
const path = require('node:path');
const testDbPath = path.join(__dirname, 'test-temp-db-' + Date.now() + '.json');
const testIdempPath = path.join(__dirname, 'test-temp-idemp-' + Date.now() + '.json');
process.env.DB_FILE = testDbPath;
process.env.IDEMPOTENCY_FILE = testIdempPath;

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');

test('Backend: authentication, sessions, role authorization, concurrency, and sheets normalization', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  try {
    // 1. Invalid login fails
    const badLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'wrongpassword123' })
    });
    assert.equal(badLogin.status, 401);

    // 2. Initial Admin login succeeds
    const adminLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'AdministradorUNRC2026!' })
    });
    assert.equal(adminLogin.status, 200);
    const adminData = await adminLogin.json();
    assert.ok(adminData.token);
    assert.equal(adminData.user.role, 'admin');

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminData.token}`
    };

    // 3. Admin creates users for other roles
    const suffix = Date.now();
    const agriUser = `agri_${suffix}`;
    const cerdosUser = `cerdos_${suffix}`;
    const auditorUser = `auditor_${suffix}`;

    // 3a. Responsable agricultura
    const resAgri = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        username: agriUser,
        name: 'Carlos Agronomo',
        password: 'PasswordSegura2026!',
        role: 'responsable_agricultura'
      })
    });
    assert.equal(resAgri.status, 201);

    // 3b. Responsable cerdos
    const resCerdos = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        username: cerdosUser,
        name: 'Marta Porcina',
        password: 'PasswordSegura2026!',
        role: 'responsable_cerdos'
      })
    });
    assert.equal(resCerdos.status, 201);

    // 3c. Auditor
    const resAuditor = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        username: auditorUser,
        name: 'Juan Auditor',
        password: 'PasswordSegura2026!',
        role: 'auditor'
      })
    });
    assert.equal(resAuditor.status, 201);

    // 4. Log in as Responsable Agricultura
    const agriLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: agriUser, password: 'PasswordSegura2026!' })
    });
    assert.equal(agriLogin.status, 200);
    const agriToken = (await agriLogin.json()).token;
    const agriHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agriToken}` };

    // 5. Agri user attempts to create a swine lot -> MUST be rejected (400 / forbidden)
    const badAgriCommit = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: agriHeaders,
      body: JSON.stringify({
        table: 'lots',
        record: { id: 'lot_illegal', name: 'Lote no permitido', phase: 'fase1', date: '2026-09-01' }
      })
    });
    assert.equal(badAgriCommit.status, 400);
    const badAgriBody = await badAgriCommit.json();
    assert.match(badAgriBody.error, /Acceso denegado/);

    // 6. Log in as Auditor -> attempting any write is rejected
    const auditorLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: auditorUser, password: 'PasswordSegura2026!' })
    });
    const auditorToken = (await auditorLogin.json()).token;
    const auditorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditorToken}` };

    const auditorCommit = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: auditorHeaders,
      body: JSON.stringify({
        table: 'prices',
        record: { id: 'price_test', date: '2026-09-20', product: 'Maiz', source: 'Rosario', price: 180 }
      })
    });
    assert.equal(auditorCommit.status, 400);
    assert.match((await auditorCommit.json()).error, /solo lectura/);

    // 7. Concurrency conflict check with expectedRevision
    const currentDataRes = await fetch(`${base}/api/data`, { headers: adminHeaders });
    assert.equal(currentDataRes.status, 200);
    const currentData = await currentDataRes.json();
    const actualRevision = currentData.revision;

    // Send with obsolete revision (e.g., actualRevision - 1)
    const conflictRes = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'prices',
        record: { id: 'price_c1', date: '2026-09-25', product: 'Maíz', source: 'Cerealera', price: 190 },
        expectedRevision: actualRevision - 1
      })
    });
    assert.equal(conflictRes.status, 409);
    assert.match((await conflictRes.json()).error, /Conflicto de concurrencia/);

    // 8. Idempotency check: sending same operationId twice does not fail or duplicate
    const opId = 'test-op-' + Date.now();
    const commit1 = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'prices',
        record: { id: 'price_idemp', date: '2026-09-25', product: 'Maíz', source: 'Cerealera', price: 195 },
        expectedRevision: actualRevision,
        operationId: opId
      })
    });
    assert.equal(commit1.status, 200);

    const commit2 = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'prices',
        record: { id: 'price_idemp', date: '2026-09-25', product: 'Maíz', source: 'Cerealera', price: 195 },
        expectedRevision: actualRevision,
        operationId: opId
      })
    });
    assert.equal(commit2.status, 200);
    assert.equal((await commit2.json()).idempotent, true);

    // 9. Sanitary withdrawal check on sales to slaughter
    // First, create a buyer party and a swine lot
    await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'parties',
        record: { id: 'frigorifico', kind: 'buyer', name: 'Frigorífico Río Cuarto', taxId: '30-11111111-9' }
      })
    });
    await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'lots',
        record: { id: 'lote_sanidad', name: 'Lote Terminador Sanidad', phase: 'terminador', bioStage: 'engorde', date: '2026-09-01', animals: 50, weight: 95, openingValue: 500000 }
      })
    });
    // Add sanitary treatment with active withdrawal
    const futureDate = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'movements',
        record: {
          id: 'treat_1',
          date: '2026-09-20',
          type: 'tratamiento',
          lotId: 'lote_sanidad',
          medication: 'Ivermectina UNRC',
          activeIngredient: 'Ivermectina 1%',
          responsible: 'Dr. Rossi (Vet)',
          withdrawalDays: 21,
          withdrawalEndDate: futureDate
        }
      })
    });

    // Attempting sale to slaughter on 2026-09-28 (before 2026-10-11) MUST be blocked
    const slaughterAttempt = await fetch(`${base}/api/data/commit`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        table: 'sales',
        record: {
          id: 'sale_slaughter_fail',
          date: '2026-09-28',
          area: 'cerdos',
          partyId: 'frigorifico',
          reference: 'V-FAENA-01',
          lotId: 'lote_sanidad',
          animals: 10,
          weight: 105,
          price: 1500,
          destiny: 'faena'
        }
      })
    });
    assert.equal(slaughterAttempt.status, 400);
    const slaughterErr = await slaughterAttempt.json();
    assert.match(slaughterErr.error, /carencia sanitaria/);

    // 10. Alerts calculation
    const alertsRes = await fetch(`${base}/api/alerts`, { headers: adminHeaders });
    assert.equal(alertsRes.status, 200);
    const alertsData = await alertsRes.json();
    assert.ok(Array.isArray(alertsData.alerts));
    // The active sanitary treatment should appear in alerts
    assert.ok(alertsData.alerts.some(a => a.type === 'sanitary' && a.targetId === 'lote_sanidad'));

    // 11. Google Sheets Status & Export
    const sheetsStatus = await fetch(`${base}/api/sheets/status`, { headers: adminHeaders });
    assert.equal(sheetsStatus.status, 200);
    const statusData = await sheetsStatus.json();
    assert.equal(typeof statusData.configured, 'boolean');

    const xlsxRes = await fetch(`${base}/api/sheets/export-xlsx`, { headers: adminHeaders });
    assert.equal(xlsxRes.status, 200);
    const xlsxBuffer = await xlsxRes.arrayBuffer();
    assert.ok(xlsxBuffer.byteLength > 1000);

    // 12. Backup generation
    const backupRes = await fetch(`${base}/api/backup/download`, { headers: adminHeaders });
    assert.equal(backupRes.status, 200);
    const backupText = await backupRes.text();
    assert.ok(backupText.includes('Establecimiento Pozo del Carril - UNRC'));
    assert.ok(backupRes.headers.get('x-checksum-sha256'));

    // 13. Synchronizing data via /api/data/sync
    const curRes = await fetch(`${base}/api/data`, { headers: adminHeaders });
    const curPayload = await curRes.json();
    const updatedState = curPayload.data;
    updatedState.prices = [...(updatedState.prices || []), {
      id: 'price_sync_test_' + Date.now(),
      date: '2026-09-29',
      product: 'maiz',
      price: 195,
      unit: 'tonelada',
      source: 'Mercado de Rosario'
    }];
    const syncRes = await fetch(`${base}/api/data/sync`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        data: updatedState,
        expectedRevision: curPayload.revision
      })
    });
    assert.equal(syncRes.status, 200);
    const syncPayload = await syncRes.json();
    assert.equal(syncPayload.success, true);
    assert.equal(syncPayload.revision, curPayload.revision + 1);

    // Auditor cannot sync changes (read-only)
    const auditorSync = await fetch(`${base}/api/data/sync`, {
      method: 'POST',
      headers: auditorHeaders,
      body: JSON.stringify({
        data: updatedState,
        expectedRevision: syncPayload.revision
      })
    });
    assert.equal(auditorSync.status, 400);
    assert.match((await auditorSync.json()).error, /solo lectura/);

  } finally {
    await new Promise(resolve => server.close(resolve));
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.unlinkSync(testIdempPath); } catch {}
  }
});
