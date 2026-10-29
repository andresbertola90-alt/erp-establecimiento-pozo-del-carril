(function(root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./domain.js') : root.UNRC;
  const ignored = new Set(['history','updatedBy','createdBy','updatedAt','createdAt']);
  const snapshot = row => row == null ? null : structuredClone(Object.fromEntries(Object.entries(row).filter(([key]) => !ignored.has(key))));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
  const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  function event(actor, action, table, recordId, reference, before, after) {
    return { id:D.uid(), at:new Date().toISOString(), userId:actor.id, username:actor.username, userName:actor.name, action, table, recordId, reference:String(reference||recordId||''), before:snapshot(before), after:snapshot(after) };
  }
  function changes(before, after, actor) {
    const events = [];
    for (const table of D.TABLES) {
      const previous = new Map((before[table]||[]).map(row => [row.id,row]));
      for (const next of after[table]||[]) {
        const old = previous.get(next.id); previous.delete(next.id);
        if (equal(snapshot(old),snapshot(next))) continue;
        const action = !old ? 'crear' : !old.voided && next.voided ? 'anular' : old.voided && !next.voided ? 'reabrir' : old.review && !next.review ? 'validar' : 'editar';
        events.push(event(actor,action,table,next.id,next.reference||next.name||next.source||next.note,old,next));
      }
      for (const old of previous.values()) events.push(event(actor,'eliminar',table,old.id,old.reference||old.name,old,null));
    }
    if (!equal(before.settings,after.settings)) events.push(event(actor,'editar','settings','settings','Criterios del establecimiento',before.settings,after.settings));
    return events;
  }
  const api = { event, changes, equal, snapshot };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UNRCAudit = api;
})(typeof window === 'undefined' ? globalThis : window);
