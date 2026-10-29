const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../domain.js');
const T = require('../transfer.js');
const A = require('../audit.js');

test('audit transfer retains attribution and rejects broken dates or duplicated ids', async () => {
  const data=D.initial();data.auditLog=[A.event({id:'actor',username:'operador',name:'Operador'},'editar','settings','settings','Criterios',{manager:''},{manager:'Encargado'})];
  assert.deepEqual((await T.decode(await T.encode(data))).data.auditLog,data.auditLog);
  const malformed=structuredClone(data);malformed.auditLog[0].at='not-a-date';await assert.rejects(T.decode(await T.encode(malformed)),/historial/);
  const duplicate=structuredClone(data);duplicate.auditLog.push(duplicate.auditLog[0]);await assert.rejects(T.decode(await T.encode(duplicate)),/repetidos/);
  const incomplete=structuredClone(data);delete incomplete.auditLog[0].userName;await assert.rejects(T.decode(await T.encode(incomplete)),/historial/);
});
test('round trip preserves pending data, original history and approvals', async () => {
  const data = D.initial();
  data.lots.push({ id: 'old-lot', name: 'Original', review: true, history: [{ at: '2026-01-01', record: { id: 'old-lot', name: 'Antes' } }] });
  data.legacy = { batches: [{ id: 'old-lot', note: 'Origen' }] };
  assert.deepEqual((await T.decode(await T.encode(data))).data, data);
  assert.equal(T.isEmpty(data), false);
});
test('empty means no records, no criteria changes and no modified accounts', () => {
  const data = D.initial(); assert.equal(T.isEmpty(data), true);
  data.accounts.reverse(); assert.equal(T.isEmpty(data), true);
  data.settings.manager = 'Responsable'; assert.equal(T.isEmpty(data), false);
  const other = D.initial(); other.accounts[0].name = 'Otra cuenta'; assert.equal(T.isEmpty(other), false);
});
test('reject corrupted, foreign and duplicate records', async () => {
  const data = D.initial(), file = JSON.parse(await T.encode(data));
  file.payload += ' '; await assert.rejects(T.decode(JSON.stringify(file)), /modificado/);
  await assert.rejects(T.decode('{}'), /traslado/);
  data.accounts.push(data.accounts[0]);
  await assert.rejects(T.decode(await T.encode(data)), /repetidos/);
});
test('reject invalid confirmed movements, future schema and missing tables', async () => {
  const data = D.initial(); data.lots.push({ id: 'bad', name: 'Incompleto' });
  await assert.rejects(T.decode(await T.encode(data)));
  const future = D.initial(); future.version = 5; await assert.rejects(T.decode(await T.encode(future)), /version/);
  const missing = D.initial(); delete missing.sales; await assert.rejects(T.decode(await T.encode(missing)), /sales/);
});
test('reject unsafe properties even with valid checksum', async () => {
  const data = D.initial(); data.legacy = JSON.parse('{"__proto__":{"polluted":true}}');
  await assert.rejects(T.decode(await T.encode(data)), /no permitida/);
  assert.equal({}.polluted, undefined);
});
