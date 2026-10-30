'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { assetPath, ORIGIN } = require('./desktop/policy.cjs');

const authModule = require('./backend/auth.cjs');
const dbModule = require('./backend/database.cjs');
const sheetsModule = require('./backend/sheets.cjs');
const alertsModule = require('./backend/alerts.cjs');
const ratesModule = require('./backend/rates.cjs');
const backupModule = require('./backend/backup.cjs');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(new Error('Cuerpo de solicitud demasiado grande.'));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) {
        resolve({});
        return;
      }
      try {
        const str = buffer.toString('utf8');
        resolve(JSON.parse(str));
      } catch (e) {
        reject(new Error('JSON malformado en la solicitud.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.headers['x-session-token']) {
    return String(req.headers['x-session-token']).trim();
  }
  // Cookie fallback
  const cookies = req.headers['cookie'] || '';
  const match = cookies.match(/(?:^|;\s*)unrc_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getActor(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  return authModule.validateSession(token);
}

async function handleApiRequest(req, res, pathname) {
  const actor = getActor(req);

  // 1. Authentication endpoints
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const result = authModule.authenticate(body.username, body.password);
      if (!result.success) {
        sendJson(res, 401, { error: result.error });
        return;
      }
      res.setHeader('Set-Cookie', `unrc_session=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`);
      sendJson(res, 200, { success: true, token: result.token, user: result.user });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const result = authModule.registerUser(body);
      res.setHeader('Set-Cookie', `unrc_session=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`);
      sendJson(res, 201, { success: true, token: result.token, user: result.user, recoveryCode: result.recoveryCode });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/auth/session' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { authenticated: false });
      return;
    }
    sendJson(res, 200, { authenticated: true, user: actor });
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getBearerToken(req);
    authModule.revokeSession(token);
    res.setHeader('Set-Cookie', 'unrc_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    sendJson(res, 200, { success: true });
    return;
  }

  // 2. User management (Protected)
  if (pathname === '/api/users' && req.method === 'GET') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden ver usuarios.' });
      return;
    }
    try {
      const users = authModule.listUsers(actor);
      sendJson(res, 200, { users });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/users' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden crear usuarios.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = authModule.createUser(actor, body);
      sendJson(res, 201, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname.startsWith('/api/users/') && req.method === 'PATCH') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden editar usuarios.' });
      return;
    }
    const targetId = pathname.replace('/api/users/', '');
    try {
      const body = await readBody(req);
      const updated = authModule.updateUser(actor, targetId, body);
      sendJson(res, 200, { user: updated });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/users/change-password' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Se requiere iniciar sesión para cambiar la contraseña.' });
      return;
    }
    try {
      const body = await readBody(req);
      authModule.changePassword(actor.id, body.currentPassword, body.newPassword);
      sendJson(res, 200, { success: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/users/reset-password' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden restablecer contraseñas.' });
      return;
    }
    try {
      const body = await readBody(req);
      authModule.adminResetPassword(actor, body.targetId, body.newPassword);
      sendJson(res, 200, { success: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/users/recover' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const result = authModule.recoverPassword(body.username, body.recoveryCode, body.newPassword);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 3. Centralized Database Operations (Protected)
  if (pathname === '/api/data' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    const db = dbModule.getDatabase();
    const filtered = dbModule.filterDataForActor(db, actor);
    sendJson(res, 200, { revision: db.revision, lastSavedBy: db.lastSavedBy, data: filtered });
    return;
  }

  if (pathname === '/api/data/commit' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await dbModule.commitRecord(actor, {
        table: body.table,
        record: body.record,
        expectedRevision: body.expectedRevision,
        operationId: body.operationId
      });
      sendJson(res, 200, result);
    } catch (err) {
      const status = err.statusCode || 400;
      sendJson(res, status, { error: err.message, currentRevision: err.currentRevision });
    }
    return;
  }

  if (pathname === '/api/data/cancel' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await dbModule.cancelRecord(actor, {
        table: body.table,
        id: body.id,
        expectedRevision: body.expectedRevision,
        operationId: body.operationId
      });
      sendJson(res, 200, result);
    } catch (err) {
      const status = err.statusCode || 400;
      sendJson(res, status, { error: err.message, currentRevision: err.currentRevision });
    }
    return;
  }

  if (pathname === '/api/data/sync' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await dbModule.syncDatabase(actor, {
        data: body.data,
        expectedRevision: body.expectedRevision,
        context: body.context
      });
      sendJson(res, 200, result);
    } catch (err) {
      const status = err.statusCode || 400;
      sendJson(res, status, { error: err.message, currentRevision: err.currentRevision });
    }
    return;
  }

  // 3.1 Demo Data Endpoints
  if (pathname === '/api/demo/load' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const result = await dbModule.loadDemo(actor);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/demo/clean' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const result = await dbModule.cleanDemo(actor);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/demo/status' && req.method === 'GET') {
    const db = dbModule.getDatabase();
    const Demo = require('./demo-data.js');
    sendJson(res, 200, { hasDemo: Demo.hasDemoData(db) });
    return;
  }

  // 4. Alert Center
  if (pathname === '/api/alerts' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    const db = dbModule.getDatabase();
    const alerts = alertsModule.computeAlerts(db);
    const thresholds = alertsModule.loadThresholds();
    sendJson(res, 200, { alerts, thresholds });
    return;
  }

  if (pathname === '/api/alerts/config' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Solo administradores pueden configurar umbrales de alerta.' });
      return;
    }
    try {
      const body = await readBody(req);
      const updated = alertsModule.saveThresholds(body);
      sendJson(res, 200, { thresholds: updated });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 5. Exchange Rates
  if (pathname === '/api/rates/bna-live' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      const result = await ratesModule.fetchLiveBnaRate();
      if (actor && result.sellRate && !result.offline) {
        try {
          ratesModule.recordLiveRate(actor, result);
        } catch (e) {
          console.warn('[Rates] No se pudo guardar tasa en histórico:', e.message);
        }
      }
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/rates' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    const rates = ratesModule.loadRates();
    const latest = ratesModule.getLatestRate();
    sendJson(res, 200, { rates, latest });
    return;
  }

  if (pathname === '/api/rates' && req.method === 'POST') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const body = await readBody(req);
      const added = ratesModule.addRate(actor, body);
      sendJson(res, 201, { rate: added });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 6. Google Sheets Integration
  if (pathname === '/api/sheets/status' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    const status = sheetsModule.getStatus();
    sendJson(res, 200, status);
    return;
  }

  if (pathname === '/api/sheets/configure' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Solo administradores pueden configurar Google Sheets.' });
      return;
    }
    try {
      const body = await readBody(req);
      sheetsModule.saveConfig(body);
      sendJson(res, 200, sheetsModule.getStatus());
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/sheets/sync' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: la sincronización con Google Sheets está reservada exclusivamente para el Administrador.' });
      return;
    }
    try {
      const body = await readBody(req);
      let googleAccessToken = body?.googleAccessToken || '';
      if (!googleAccessToken && req.headers['x-google-access-token']) {
        googleAccessToken = req.headers['x-google-access-token'];
      }
      if (!googleAccessToken && req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ya29.')) {
        googleAccessToken = req.headers['authorization'].slice(7);
      }

      const db = dbModule.getDatabase();
      const result = await sheetsModule.syncToGoogleSheets(db, {
        googleAccessToken,
        sheetId: body?.sheetId
      });
      sendJson(res, result.success ? 200 : 400, result);
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === '/api/sheets/export-xlsx' && req.method === 'GET') {
    if (!actor) {
      sendJson(res, 401, { error: 'Sesión no iniciada.' });
      return;
    }
    try {
      const db = dbModule.getDatabase();
      const buffer = await sheetsModule.generateExcelWorkbook(db);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="UNRC-Pozo-del-Carril-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      res.end(buffer);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 7. Remote Backup & Recovery
  // 7. Remote Backup & Recovery
  if (pathname === '/api/backup/download' && req.method === 'GET') {
    if (!actor || actor.role === 'operador') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores y auditores pueden generar copias de respaldo.' });
      return;
    }
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const format = urlObj.searchParams.get('format') || 'json';
      const backup = backupModule.createBackup(actor, format);
      res.writeHead(200, {
        'Content-Type': format === 'json' ? 'application/json; charset=utf-8' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'X-Checksum-SHA256': backup.checksum,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      res.end(backup.content);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/backup/restore' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden restaurar respaldos.' });
      return;
    }
    try {
      const body = await readBody(req);
      const rawContent = typeof body === 'string' ? body : (body.content || JSON.stringify(body));
      const result = await backupModule.restoreFromBackup(actor, rawContent);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/backup/safety-snapshots' && req.method === 'GET') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden consultar los respaldos de seguridad.' });
      return;
    }
    try {
      const snapshots = backupModule.listSafetyBackups();
      sendJson(res, 200, { snapshots });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/backup/rollback-safety' && req.method === 'POST') {
    if (!actor || actor.role !== 'admin') {
      sendJson(res, 403, { error: 'Acceso denegado: solo administradores pueden restaurar un respaldo de seguridad.' });
      return;
    }
    try {
      const body = await readBody(req);
      const result = await backupModule.rollbackSafetyBackup(actor, body.filename);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // Not found API route
  sendJson(res, 404, { error: 'Ruta API no encontrada' });
}

function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'same-origin');

    let pathname = '';
    try {
      const requested = new URL(req.url, 'http://localhost');
      pathname = requested.pathname;
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    // Handle /api/* routes
    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname);
      return;
    }

    // Static asset serving complies with desktop/policy.cjs and preview-server tests
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { 'Allow': 'GET, HEAD' });
      res.end();
      return;
    }

    const file = assetPath(ORIGIN + (pathname === '/' ? '/index.html' : pathname));
    if (!file) {
      res.writeHead(404);
      res.end('No disponible');
      return;
    }

    try {
      const bytes = await fs.readFile(path.join(__dirname, file));
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(404);
      res.end('No disponible');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalido.');
  const server = createServer();
  server.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST || '0.0.0.0', () =>
    console.log(`UNRC servidor activo: http://0.0.0.0:${port}`)
  );
}

module.exports = { createServer };
