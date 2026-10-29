(function(root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.UNRC;
  const Plan=typeof module!=='undefined'&&module.exports?require('./assets/account-plan.js'):root.UNRCAccountPlan;
  const FORMAT = 'unrc-traslado-establecimiento';
  const MAX_BYTES = 50 * 1024 * 1024;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function inspect(data) {
    if (!object(data) || data.version !== 4 || !object(data.settings)) throw new Error('La copia no corresponde a esta version del sistema.');
    if(data.accountPlanVersion!=null&&data.accountPlanVersion!==Plan.VERSION)throw new Error('La copia requiere otra versión del plan de cuentas.');
    if(Plan.enabled(data))for(const base of Plan.DEFINITIONS){const saved=data.accounts?.find(a=>a.id===base.id);if(!saved)throw new Error('Falta una cuenta del plan del anexo: '+base.code);Plan.validateDefinition(saved);}
    if(data.auditLog!=null){
      if(!Array.isArray(data.auditLog))throw new Error('El historial de usuarios está incompleto.');
      const ids=new Set();
      for(const event of data.auditLog){
        if(!object(event)||['id','at','userId','username','userName','action','table','recordId','reference'].some(key=>typeof event[key]!=='string')||!event.id||ids.has(event.id)||!Number.isFinite(Date.parse(event.at))||(event.before!=null&&!object(event.before))||(event.after!=null&&!object(event.after)))throw new Error('El historial de usuarios está incompleto o tiene registros repetidos.');
        ids.add(event.id);
      }
    }
    if (!object(data.settings.weightRanges) || !Number.isFinite(Number(data.settings.priceAgeDays))) throw new Error('Los criterios de la copia estan incompletos.');
    for (const table of D.TABLES) {
      if (!Array.isArray(data[table])) throw new Error('Falta la tabla ' + table + '.');
      const ids = new Set();
      for (const row of data[table]) {
        if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Hay registros sin identificacion o repetidos en ' + table + '.');
        if (row.history != null && (!Array.isArray(row.history) || row.history.some(h => !object(h) || !object(h.record)))) throw new Error('El historial de ' + table + ' esta incompleto.');
        ids.add(row.id);
      }
    }
    for (const table of D.TABLES) for (const row of data[table]) D.validate(data, table, row);
    const state = D.replay(data);
    if (state.errors.length) throw new Error('La copia tiene movimientos confirmados por corregir: ' + state.errors[0]);
    return data;
  }
  function isEmpty(data) {
    const initial = Plan.enabled(data)?Plan.upgrade(D.initial()):D.initial();
    const stable = value => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
    const accounts = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    return !data.legacy && D.TABLES.every(t => t === 'accounts' ? same(accounts(data[t]), accounts(initial[t])) : data[t].length === 0)
      && same(data.settings, initial.settings);
  }
  async function digest(text) {
    const bytes = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function encode(data) {
    const payload = JSON.stringify(data);
    if (new TextEncoder().encode(payload).length > MAX_BYTES) throw new Error('La base supera el limite de traslado de 50 MB. Solicite asistencia.');
    return JSON.stringify({ format: FORMAT, version: 1, createdAt: new Date().toISOString(), checksum: await digest(payload), payload });
  }
  async function decode(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES * 2) throw new Error('El archivo es demasiado grande.');
    let envelope;
    try { envelope = JSON.parse(text); } catch { throw new Error('No se pudo leer el archivo de traslado.'); }
    if (!object(envelope) || envelope.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== 'string') throw new Error('Seleccione un archivo de traslado generado por este sistema.');
    if (await digest(envelope.payload) !== envelope.checksum) throw new Error('El archivo esta incompleto o fue modificado. No se importo nada.');
    const data = JSON.parse(envelope.payload, (key, value) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('El archivo contiene una propiedad no permitida.');
      return value;
    });
    inspect(data);
    return { data, createdAt: envelope.createdAt };
  }
  const api = { MAX_BYTES, inspect, isEmpty, encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UNRCTransfer = api;
})(typeof window === 'undefined' ? globalThis : window);
