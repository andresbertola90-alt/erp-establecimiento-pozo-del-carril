(function (root) {
  'use strict';
  const Plan=UNRCAccountPlan;
  let connection;
  let lastSource = 'local';
  let lastSynced = false;
  const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const finished = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('No se guardaron los cambios.')); });
  async function open() {
    if (connection) return connection;
    const r = indexedDB.open('unrc-gestion-integrada', 1);
    r.onupgradeneeded = () => { for (const t of [...UNRC.TABLES, 'meta']) r.result.createObjectStore(t, { keyPath: 'id' }); };
    connection = await request(r); return connection;
  }

  async function fetchServerData() {
    try {
      const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
      if (!token) return null;
      const res = await fetch('/api/data', { headers: { 'Authorization': 'Bearer ' + token } });
      if (res.ok) {
        const payload = await res.json();
        if (payload && payload.data) {
          return { data: payload.data, revision: payload.revision, lastSavedBy: payload.lastSavedBy };
        }
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async function load() {
    await UNRCAuth.requireSession();

    // 1. Try remote server first
    const remote = await fetchServerData();
    if (remote) {
      lastSource = 'server';
      lastSynced = true;
      const upgraded = Plan.upgrade(UNRC.upgradeWorkflow(remote.data));
      upgraded.revision = remote.revision;
      upgraded.lastSavedBy = remote.lastSavedBy;
      // Cache into indexedDB
      try {
        const db = await open();
        const tx = db.transaction([...UNRC.TABLES, 'meta'], 'readwrite');
        const done = finished(tx);
        for (const t of UNRC.TABLES) {
          const store = tx.objectStore(t);
          store.clear();
          (upgraded[t] || []).forEach(r => store.put(r));
        }
        const meta = Object.fromEntries(Object.entries(upgraded).filter(([k]) => !UNRC.TABLES.includes(k)));
        meta.id = 'state';
        meta.revision = remote.revision;
        tx.objectStore('meta').put(meta);
        await done;
      } catch (e) {
        console.warn('Cache local IndexedDB no actualizado:', e);
      }
      return upgraded;
    }

    lastSource = 'local';
    lastSynced = false;

    // 2. Local IndexedDB fallback
    const db = await open(); const tx = db.transaction([...UNRC.TABLES, 'meta'], 'readonly'); const done = finished(tx);
    const items = await Promise.all([...UNRC.TABLES, 'meta'].map(t => request(tx.objectStore(t).getAll()))); await done;
    const meta = items.at(-1).find(x => x.id === 'state');
    if (!meta) {
      let old = null; const raw = localStorage.getItem('costeo-porcino-interno-v1');
      if (raw) { try { old = JSON.parse(raw); } catch { throw new Error('La base anterior no se pudo leer. Se conservó intacta; no se reemplazó por datos de ejemplo.'); } }
      const data = Plan.upgrade(UNRC.upgradeWorkflow(UNRC.migrate(old))); if (!await save(data, true)) return load(); return data;
    }
    const data = { ...meta }; delete data.id; UNRC.TABLES.forEach((t, i) => data[t] = items[i]);
    const missing = UNRC.initial().accounts.filter(a => !data.accounts.some(saved => saved.id === a.id));
    if (missing.length) data.accounts.push(...missing);
    const upgrade=UNRC.needsWorkflowUpgrade(data),planUpgrade=Plan.needsUpgrade(data),next=Plan.upgrade(UNRC.upgradeWorkflow(data));
    if (missing.length || data.version < 4 || upgrade || planUpgrade) { next.version=4; await save(next,false,[upgrade?'workflow':'',planUpgrade?'account-plan':''].filter(Boolean).join('+')); }
    return next;
  }

  async function save(data, first = false, context = '') {
    const actor = await UNRCAuth.requireSession(context === 'import');

    // 1. Try push to server if online
    let serverSynced = false;
    try {
      const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
      if (token) {
        const res = await fetch('/api/data/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            data,
            expectedRevision: first ? null : data.revision,
            context
          })
        });
        const result = await res.json().catch(() => null);
        if (!res.ok) {
          const err = new Error(result?.error || `Error del servidor (${res.status})`);
          err.status = res.status;
          err.currentRevision = result?.currentRevision;
          throw err;
        }
        if (result && result.revision) {
          data.revision = result.revision;
          if (result.data?.auditLog) data.auditLog = result.data.auditLog;
          serverSynced = true;
        }
      }
    } catch (e) {
      if (e.status === 409 || e.status === 400 || e.status === 403 || e.message.includes('Conflicto') || e.message.includes('carencia') || e.message.includes('denegado') || e.message.includes('solo lectura')) {
        throw e;
      }
      // If network is offline, continue saving to local IndexedDB
    }

    const db = await open(); const tx = db.transaction([...UNRC.TABLES, 'meta'], 'readwrite'); const done = finished(tx);
    const metaStore = tx.objectStore('meta'); const old = await request(metaStore.get('state'));
    if (first && old && !serverSynced) { tx.abort(); await done.catch(() => {}); return false; }
    if (!first && old && old.revision !== data.revision && !serverSynced) { tx.abort(); await done.catch(() => {}); throw new Error('Otra ventana guardó cambios. Recargá la página antes de continuar.'); }
    const items = await Promise.all(UNRC.TABLES.map(t => request(tx.objectStore(t).getAll())));
    const before = { ...old }; UNRC.TABLES.forEach((t,i) => before[t]=items[i]);
    if(context==='import'&&!UNRCTransfer.isEmpty(before)&&!serverSynced){tx.abort();await done.catch(()=>{});throw new Error('El destino ya tiene datos. No se reemplazó nada.');}
    const meta = Object.fromEntries(Object.entries(data).filter(([k]) => !UNRC.TABLES.includes(k)));
    meta.id = 'state';
    meta.revision = serverSynced ? data.revision : ((old?.revision || 0) + 1);
    const migrations=[];
    if(context.includes('workflow'))migrations.push(UNRCAudit.event(actor,'actualizar','system','','Actualización automática: registro directo de operaciones',null,data.workflowMigration));
    if(context.includes('account-plan'))migrations.push(UNRCAudit.event(actor,'actualizar','accounts','','Plan de cuentas de anexos unidos.pdf; originales conservados',null,{version:data.accountPlanVersion,added:data.accountPlanMigration.added}));
    const newEvents = !old ? [UNRCAudit.event(actor,'inicio','system','','Inicio del historial; datos previos sin atribución retroactiva',null,null)] : migrations.length?migrations : context==='import' ? [UNRCAudit.event(actor,'importar','system','','Recepción de registros de otra instalación',null,{records:UNRC.TABLES.reduce((n,t)=>n+data[t].length,0),workflowMigration:data.workflowMigration||null})] : UNRCAudit.changes(before,data,actor);
    const previous = old?.auditLog || [];
    const ids = new Set(previous.map(event=>event.id));
    const imported = context==='import' ? (data.auditLog||[]).filter(event=>!ids.has(event.id)).map(event=>({...event,importedAt:new Date().toISOString()})) : [];
    if (!serverSynced) {
      meta.auditLog = [...previous,...imported,...newEvents.map(event=>({...event,revision:meta.revision}))];
    } else {
      meta.auditLog = data.auditLog || previous;
    }
    for (const t of UNRC.TABLES) { const store = tx.objectStore(t); store.clear(); data[t].forEach(r => store.put(r)); }
    metaStore.put(meta); await done;
    data.revision = meta.revision;
    data.auditLog = meta.auditLog;
    if (serverSynced) lastSynced = true;
    return { success: true, serverSynced, revision: data.revision };
  }
  async function importNew(data, expectedRevision) {
    const actor = await UNRCAuth.requireSession(true);
    const current = await load();
    if (current.revision !== expectedRevision) throw new Error('Otra ventana guardó cambios. Seleccioná nuevamente el archivo.');
    if (!UNRCTransfer.isEmpty(current)) throw new Error('El destino ya tiene datos. No se reemplazó nada.');
    UNRCTransfer.inspect(data);
    const next = Plan.upgrade(UNRC.upgradeWorkflow(structuredClone(data)));
    next.revision = current.revision; next.lastSavedBy = actor.username;
    next.transferredAt = new Date().toISOString(); next.transferredBy = actor.username;
    await save(next,false,'import'); return next;
  }
  function getStatus() {
    return { source: lastSource, serverSynced: lastSynced };
  }
  root.UNRCStorage = { load, save, importNew, getStatus };
})(window);
