'use strict';

(function (root) {
  const SESSION_KEY = 'unrc-session-token';
  let currentUser = null;

  function getToken() {
    return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  }

  function setToken(token) {
    if (token) {
      sessionStorage.setItem(SESSION_KEY, token);
      try { localStorage.setItem(SESSION_KEY, token); } catch {}
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      try { localStorage.removeItem(SESSION_KEY); } catch {}
    }
  }

  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err = new Error(data?.error || `Error ${res.status}: ${res.statusText}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function hasUsers() {
    // With real server, server initializes initial admin automatically if empty
    return true;
  }

  async function restore() {
    const token = getToken();
    if (!token) {
      currentUser = null;
      return null;
    }
    try {
      const result = await apiFetch('/api/auth/session', { method: 'GET' });
      if (result && result.authenticated && result.user) {
        currentUser = result.user;
        return currentUser;
      }
    } catch (e) {
      setToken(null);
      currentUser = null;
    }
    return null;
  }

  async function requireSession(admin = false) {
    const u = await restore();
    if (!u) throw new Error('La sesión terminó o no está iniciada. Ingresá nuevamente.');
    if (admin && u.role !== 'admin') throw new Error('Sólo un administrador puede realizar esta acción.');
    return u;
  }

  async function login(username, password) {
    const result = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (result && result.token) {
      setToken(result.token);
      currentUser = result.user;
      return currentUser;
    }
    throw new Error('No se pudo iniciar sesión.');
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      currentUser = null;
    }
  }

  async function register(input) {
    const result = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    if (result && result.token) {
      setToken(result.token);
      currentUser = result.user;
      return result;
    }
    throw new Error('No se pudo registrar la cuenta.');
  }

  async function createUser(input) {
    const actor = await requireSession(true);
    const result = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return result;
  }

  async function listUsers() {
    await requireSession(true);
    const result = await apiFetch('/api/users', { method: 'GET' });
    return result.users || [];
  }

  async function setActive(id, active) {
    await requireSession(true);
    const result = await apiFetch(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !!active })
    });
    return result.user;
  }

  async function switchableUsers() {
    try {
      const users = await listUsers();
      return users.filter(u => u.active).map(u => ({ username: u.username, name: u.name }));
    } catch {
      return [];
    }
  }

  async function changePassword(currentPassword, newPassword) {
    await requireSession();
    await apiFetch('/api/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return { success: true };
  }

  async function resetPassword(targetId, newPassword) {
    await requireSession(true);
    await apiFetch('/api/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ targetId, newPassword })
    });
    return { success: true };
  }

  async function recover(username, recoveryCode, newPassword) {
    const result = await apiFetch('/api/users/recover', {
      method: 'POST',
      body: JSON.stringify({ username, recoveryCode, newPassword })
    });
    return result;
  }

  async function listAudit() {
    return [];
  }

  root.UNRCAuth = {
    hasUsers,
    restore,
    requireSession,
    createUser,
    register,
    login,
    logout,
    listUsers,
    listAudit,
    switchableUsers,
    setActive,
    changePassword,
    resetPassword,
    recover,
    get current() {
      return currentUser;
    }
  };
})(window);
