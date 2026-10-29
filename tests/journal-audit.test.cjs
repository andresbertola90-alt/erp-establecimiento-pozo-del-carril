const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../domain.js'),J=require('../journal.js'),A=require('../audit.js');
const actor={id:'u1',username:'andres',name:'Andres'};
test('journal balances in cents and retains area and period',()=>{
  assert.deepEqual(J.totals([{debit:.1,credit:0},{debit:.2,credit:0},{debit:0,credit:.3}]),{debit:.3,credit:.3,difference:0});
  const db=D.commit(D.initial(),'entries',{date:'2026-09-01',area:'agricultura',reference:'Manual',lines:[{accountId:'1.1.01',debit:100.25,credit:0},{accountId:'3.1.01',debit:0,credit:100.25}]});
  const q=J.query(db,'2026-09-01','2026-09-30');assert.equal(q.entries[0].area,'agricultura');assert.equal(q.debit,100.25);assert.equal(q.difference,0);
  assert.equal(J.query(db,'2026-09-02','2026-09-30').entries.length,0);
});
test('journal rejects fractional cents, wrong accounts and two-sided amounts',()=>{
  const row={date:'2026-09-01',area:'cerdos',reference:'R',lines:[{accountId:'1.1.01',debit:100.001,credit:0},{accountId:'3.1.01',debit:0,credit:100.001}]};
  assert.throws(()=>D.commit(D.initial(),'entries',row),/decimales/);
  row.lines=[{accountId:'1.1.01',debit:100,credit:100},{accountId:'3.1.01',debit:50,credit:50}];assert.throws(()=>D.commit(D.initial(),'entries',row),/ambos/);
  assert.equal(J.manualAccount({id:'1.3.03.01'}),false);assert.equal(J.manualAccount({id:'1.1.01'}),true);
});
test('audit records before/after, acting user, validation and annulment',()=>{
  const before=D.initial(),after=structuredClone(before);after.parties.push({id:'p1',name:'Cliente',kind:'cliente'});
  const created=A.changes(before,after,actor);assert.equal(created.length,1);assert.equal(created[0].action,'crear');assert.equal(created[0].username,'andres');
  const edited=structuredClone(after);edited.parties[0].name='Cliente nuevo';edited.parties[0].updatedBy='No es el actor';
  const event=A.changes(after,edited,actor)[0];assert.equal(event.action,'editar');assert.equal(event.before.name,'Cliente');assert.equal(event.after.name,'Cliente nuevo');assert.equal(event.username,'andres');
  edited.parties[0].name='Otra cosa';assert.equal(event.after.name,'Cliente nuevo');
  const canceled=structuredClone(after);canceled.parties[0].voided=true;assert.equal(A.changes(after,canceled,actor)[0].action,'anular');
  const draft=structuredClone(after);draft.parties[0].review=true;assert.equal(A.changes(draft,after,actor)[0].action,'validar');
});
test('audit preserves identity and ignores only housekeeping fields',()=>{
  const before=D.initial(),after=structuredClone(before);after.settings.manager='Nuevo';
  assert.equal(A.changes(before,after,actor)[0].table,'settings');
  assert.equal(A.equal({b:2,a:1},{a:1,b:2}),true);
  const row={id:'x',lines:[{debit:1}],history:[{old:'private'}],createdBy:'other'};
  const event=A.event(actor,'crear','entries','x','R',null,row);row.lines[0].debit=2;
  assert.equal(event.after.lines[0].debit,1);assert.equal('history' in event.after,false);assert.equal('createdBy' in event.after,false);
});
