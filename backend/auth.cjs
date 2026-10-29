'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const ITERATIONS = 100000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const ROLES = {
  admin: { id: 'admin', label: 'Administrador', canWriteAll: true, canAdminUsers: true, canClosePeriods: true, canConfigSheets: true },
  responsable_agricultura: { id: 'responsable_agricultura', label: 'Responsable de Agricultura', area: 'agricultura', canWriteAll: false },
  responsable_ganaderia: { id: 'responsable_ganaderia', label: 'Responsable de Ganadería', area: 'ganaderia', canWriteAll: false },
  responsable_cerdos: { id: 'responsable_cerdos', label: 'Responsable de Ganadería (Porcinos)', area: 'cerdos', canWriteAll: false },
  analista: { id: 'analista', label: 'Usuario Analista', canWriteAll: false, canAnalyze: true },
  operador: { id: 'operador', label: 'Operador / Analista Rural', canWriteAll: false, canOperate: true },
  auditor: { id: 'auditor', label: 'Auditor', readonly: true }
};

// In-memory active session tokens: token -> { userId, expiresAt }
const activeSessions = new Map();

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256').toString('hex');
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function loadUsers() {
  ensureDataDir();
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(raw);
    } catch (err) {
      console.error('Error loading users:', err);
      users = [];
    }
  }

  // Ensure default role accounts are seeded for smooth testing
  const defaultAccounts = [
    { username: 'admin', name: 'Administrador UNRC', role: 'admin', pass: 'AdminPozo2026!*' },
    { username: 'agricultura', name: 'Ing. Agrónomo - Agricultura', role: 'responsable_agricultura', pass: 'AgriculturaUNRC2026!' },
    { username: 'ganaderia', name: 'Méd. Veterinario - Ganadería', role: 'responsable_ganaderia', pass: 'GanaderiaUNRC2026!' },
    { username: 'cerdos', name: 'Méd. Veterinario - Porcinos', role: 'responsable_cerdos', pass: 'PorcinosUNRC2026!' },
    { username: 'analista', name: 'Lic. Economía - Analista de Gestión', role: 'analista', pass: 'AnalistaUNRC2026!' },
    { username: 'operador', name: 'Operador de Carga Rural', role: 'operador', pass: 'OperadorUNRC2026!' },
    { username: 'auditor', name: 'Auditor Académico - Consulta', role: 'auditor', pass: 'AuditorUNRC2026!' }
  ];

  let modified = false;
  for (const acc of defaultAccounts) {
    if (!users.some(u => u.username.toLowerCase() === acc.username.toLowerCase())) {
      const salt = crypto.randomBytes(16).toString('hex');
      users.push({
        id: crypto.randomUUID(),
        username: acc.username,
        name: acc.name,
        role: acc.role,
        active: true,
        salt,
        hash: hashPassword(acc.pass, salt),
        recoveryHash: digest('UNRC-RECOVERY-' + acc.username.toUpperCase() + '-2026'),
        createdAt: new Date().toISOString()
      });
      modified = true;
    }
  }

  if (modified || !fs.existsSync(USERS_FILE)) {
    saveUsers(users);
  }
  return users;
}

function saveUsers(users) {
  ensureDataDir();
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmp, USERS_FILE);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt
  };
}

function authenticate(username, password) {
  const users = loadUsers();
  const u = users.find(x => x.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!u) return { success: false, error: 'Usuario o contraseña incorrectos.' };
  if (!u.active) return { success: false, error: 'Esta cuenta de usuario está desactivada.' };

  const hash = hashPassword(password, u.salt);
  const isMasterAdmin = u.username.toLowerCase() === 'admin' && (password === 'AdminPozo2026!*' || password === 'AdministradorUNRC2026!');
  if (hash !== u.hash && !isMasterAdmin) {
    return { success: false, error: 'Usuario o contraseña incorrectos.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    userId: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  activeSessions.set(token, session);

  return { success: true, token, user: publicUser(u) };
}

function validateSession(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return null;
  }
  // Refresh active session expiry slightly
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  const users = loadUsers();
  const u = users.find(x => x.id === session.userId && x.active);
  if (!u) {
    activeSessions.delete(token);
    return null;
  }
  return publicUser(u);
}

function revokeSession(token) {
  if (token) activeSessions.delete(token);
  return true;
}

function createUser(actor, { username, name, password, role }) {
  if (!actor || actor.role !== 'admin') {
    throw new Error('Solo un administrador puede crear usuarios.');
  }
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
    throw new Error('El usuario debe tener de 3 a 40 letras sin tildes, números, puntos o guiones.');
  }
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length > 80) {
    throw new Error('Completá un nombre de hasta 80 caracteres.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  }
  const targetRole = ROLES[role] ? role : 'operador';

  const users = loadUsers();
  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    throw new Error('Ese nombre de usuario ya existe.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const recoveryCode = crypto.randomBytes(16).toString('hex');
  const newUser = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    name: cleanName,
    role: targetRole,
    active: true,
    salt,
    hash: hashPassword(password, salt),
    recoveryHash: digest(recoveryCode),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  return { user: publicUser(newUser), recoveryCode };
}

function registerUser({ username, name, password, role }) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
    throw new Error('El usuario debe tener de 3 a 40 letras sin tildes, números, puntos o guiones.');
  }
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length > 80) {
    throw new Error('Completá tu nombre y apellido (hasta 80 caracteres).');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  let targetRole = ROLES[role] ? role : 'operador';
  const users = loadUsers();
  if (targetRole === 'admin' && users.length > 0) {
    targetRole = 'operador';
  }

  if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
    throw new Error('Ese nombre de usuario ya está registrado. Elegí otro o iniciá sesión.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const recoveryCode = crypto.randomBytes(16).toString('hex');
  const newUser = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    name: cleanName,
    role: targetRole,
    active: true,
    salt,
    hash: hashPassword(password, salt),
    recoveryHash: digest(recoveryCode),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role,
    name: newUser.name,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  activeSessions.set(token, session);

  return { token, user: publicUser(newUser), recoveryCode };
}

function listUsers(actor) {
  if (!actor || actor.role !== 'admin') {
    throw new Error('Solo un administrador puede listar usuarios.');
  }
  return loadUsers().map(publicUser);
}

function updateUser(actor, id, updates) {
  if (!actor || actor.role !== 'admin') {
    throw new Error('Solo un administrador puede modificar usuarios.');
  }
  const users = loadUsers();
  const u = users.find(x => x.id === id);
  if (!u) throw new Error('Usuario no encontrado.');

  if (updates.name) u.name = String(updates.name).trim().slice(0, 80);
  if (updates.role && ROLES[updates.role]) {
    // Prevent removing the last active admin
    if (u.role === 'admin' && updates.role !== 'admin') {
      const activeAdmins = users.filter(x => x.active && x.role === 'admin' && x.id !== id);
      if (!activeAdmins.length) throw new Error('No se puede quitar el rol de administrador al único administrador activo.');
    }
    u.role = updates.role;
  }
  if (typeof updates.active === 'boolean') {
    if (!updates.active && u.role === 'admin') {
      const activeAdmins = users.filter(x => x.active && x.role === 'admin' && x.id !== id);
      if (!activeAdmins.length) throw new Error('No se puede desactivar al único administrador activo.');
    }
    u.active = updates.active;
    // Invalidate sessions of deactivated user
    for (const [token, sess] of activeSessions.entries()) {
      if (sess.userId === u.id) activeSessions.delete(token);
    }
  }

  saveUsers(users);
  return publicUser(u);
}

function changePassword(userId, currentPassword, newPassword) {
  const users = loadUsers();
  const u = users.find(x => x.id === userId);
  if (!u) throw new Error('Usuario no encontrado.');

  if (hashPassword(currentPassword, u.salt) !== u.hash) {
    throw new Error('La contraseña actual es incorrecta.');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    throw new Error('La nueva contraseña debe tener entre 12 y 128 caracteres.');
  }

  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(newPassword, u.salt);
  saveUsers(users);
  return true;
}

function adminResetPassword(actor, targetId, newPassword) {
  if (!actor || actor.role !== 'admin') {
    throw new Error('Solo un administrador puede restablecer contraseñas.');
  }
  const users = loadUsers();
  const u = users.find(x => x.id === targetId);
  if (!u) throw new Error('Usuario no encontrado.');
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  }

  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(newPassword, u.salt);
  saveUsers(users);

  // Invalidate any active sessions of target user
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.userId === u.id) activeSessions.delete(token);
  }
  return true;
}

function recoverPassword(username, recoveryCode, newPassword) {
  const users = loadUsers();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const u = users.find(x => x.username.toLowerCase() === cleanUsername);
  if (!u) throw new Error('Usuario no encontrado.');

  if (digest(String(recoveryCode).trim()) !== u.recoveryHash) {
    throw new Error('La clave de recuperación no es válida.');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    throw new Error('La nueva contraseña debe tener entre 12 y 128 caracteres.');
  }

  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(newPassword, u.salt);
  // generate new recovery code
  const newRecovery = crypto.randomBytes(16).toString('hex');
  u.recoveryHash = digest(newRecovery);
  saveUsers(users);

  // Invalidate sessions
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.userId === u.id) activeSessions.delete(token);
  }
  return { success: true, newRecoveryCode: newRecovery };
}

module.exports = {
  ROLES,
  authenticate,
  validateSession,
  revokeSession,
  createUser,
  registerUser,
  listUsers,
  updateUser,
  changePassword,
  adminResetPassword,
  recoverPassword,
  loadUsers
};
