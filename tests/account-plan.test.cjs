const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../domain.js'),P=require('../assets/account-plan.js'),J=require('../journal.js'),T=require('../transfer.js');
function fixture(){
  let d=D.initial();
  d.parties.push({id:'buyer',name:'Comprador',kind:'cliente'});
  d.products.push({id:'feed',name:'Alimento',kind:'alimento',unit:'kg',kgPerBag:25},{id:'corn',name:'Cereal',kind:'grano',unit:'kg'});
  d.campaigns.push({id:'crop',date:'2026-01-01',name:'Cultivo',crop:'Maíz',hectares:30});
  d.lots.push({id:'lot',date:'2026-01-01',name:'Lote inicial',phase:'fase4',bioStage:'destete',animals:20,weight:25,openingValue:20000},{id:'finish',date:'2026-01-01',name:'Terminador',phase:'terminador',bioStage:'engorde',animals:0,weight:0,openingValue:0});
  d=D.commit(d,'stock',{id:'purchase',date:'2026-01-02',type:'compra',area:'cerdos',productId:'feed',quantity:1000,unitCost:10,tax:2100,taxRecoverable:true});
  d=D.commit(d,'stock',{id:'use',date:'2026-01-03',type:'consumo',area:'cerdos',productId:'feed',quantity:100,lotId:'lot'});
  d=D.commit(d,'movements',{id:'move',date:'2026-01-04',type:'traslado',lotId:'lot',toLotId:'finish',quantity:10,weight:50});
  d=D.commit(d,'sales',{id:'sale',date:'2026-01-05',area:'cerdos',reference:'Venta',partyId:'buyer',lotId:'finish',animals:2,weight:100,price:100,tax:2100,retentions:200,fees:100});
  d=D.commit(d,'payments',{id:'pay',date:'2026-01-06',sourceId:'purchase',amount:12100});
  d=D.commit(d,'payments',{id:'collect',date:'2026-01-06',sourceId:'sale',amount:21800});
  d=D.commit(d,'costs',{id:'crop-cost',date:'2026-01-02',area:'agricultura',reference:'Labores',amount:10000,accountId:'5.4.02',campaignId:'crop'});
  d=D.commit(d,'stock',{id:'harvest',date:'2026-01-03',area:'agricultura',type:'cosecha',campaignId:'crop',productId:'corn',quantity:1000,unitCost:10});
  d=D.commit(d,'transfers',{id:'internal',date:'2026-01-07',campaignId:'crop',productId:'corn',quantity:100,opportunityPrice:20,source:'Prueba',priceDate:'2026-01-01'});
  d=D.commit(d,'stock',{id:'own-use',date:'2026-01-08',area:'cerdos',type:'consumo',productId:'corn',quantity:50,lotId:'lot'});
  return d;
}
test('catalog reproduces 46 annex I rows and two annex II accounts',()=>{
  assert.equal(P.ROWS.length,46);assert.equal(new Set(P.DEFINITIONS.map(a=>a.code)).size,P.DEFINITIONS.length);
  assert.equal(P.DEFINITIONS.filter(a=>a.source==='Anexo II').length,2);
  assert.equal(P.DEFINITIONS.find(a=>a.code==='1.3.03.01').name,'Existencias - Cerdas Madres');
  assert.equal(P.DEFINITIONS.find(a=>a.code==='6.6.03').name,'Índice de Conversión Alimenticia (ICA)');
});
test('upgrade preserves every original record, account, revision and closed result and is idempotent',()=>{
  const old=fixture();old.closings.push({id:'close',date:'2026-01-31',start:'2026-01-01',end:'2026-01-31',result:D.results(old,'2026-01-01','2026-01-31').consolidated});
  const before=structuredClone(old),next=P.upgrade(old);assert.deepEqual(old,before);
  for(const table of D.TABLES)if(table!=='accounts')assert.deepEqual(next[table],old[table]);
  assert.deepEqual(next.accounts.slice(0,old.accounts.length),old.accounts);assert.equal(next.revision,old.revision);
  assert.deepEqual(P.upgrade(next),next);assert.notEqual(next.accounts.find(a=>a.id==='1.3.03.01').name,next.accounts.find(a=>a.id===P.id('1.3.03.01')).name);
});
test('mapped ledger preserves economic results, cash, stock and balanced postings',()=>{
  const old=fixture(),next=P.upgrade(old),before=D.results(old,'2026-01-01','2026-12-31'),after=D.results(next,'2026-01-01','2026-12-31');
  assert.deepEqual(after.state.errors,[]);assert.deepEqual(after.areas,before.areas);assert.equal(after.consolidated,before.consolidated);assert.deepEqual(after.state.stock,before.state.stock);assert.deepEqual(after.state.lots,before.state.lots);
  for(const entry of after.state.journal){assert.equal(D.round(D.sum(entry.lines,l=>l.debit-l.credit)),0);for(const l of entry.lines)assert.ok(P.selectable(next.accounts.find(a=>a.id===l.accountId)));}
  const balance=id=>D.round(D.sum(after.state.journal.flatMap(e=>e.lines).filter(l=>l.accountId===P.id(id)),l=>l.debit-l.credit));
  assert.equal(balance('2.1.01.08'),0);assert.equal(balance('1.2.01.03'),0);assert.equal(balance('1.2.05.02'),200);
  assert.equal(balance('1.3.03.04')+balance('1.3.03.05'),D.sum(Object.values(after.state.lots),l=>l.value));
});
test('costs and manual journal use annex accounts; physical rows and headings reject money',()=>{
  let d=P.upgrade(D.initial());d=D.commit(d,'costs',{date:'2026-01-01',area:'cerdos',reference:'Sanidad',accountId:P.id('5.3.02.01'),amount:500});
  assert.equal(D.results(d,'2026-01-01','2026-01-31').consolidated,-500);
  const entry={date:'2026-01-02',area:'cerdos',reference:'Asiento',lines:[{accountId:P.id('1.1.01.01'),debit:100,credit:0},{accountId:P.id('3.1.01'),debit:0,credit:100}]};
  d=D.commit(d,'entries',entry);assert.equal(J.query(d,'2026-01-01','2026-01-31').difference,0);
  for(const code of ['1','5','6','6.6.03','6.1.03'])assert.throws(()=>D.commit(d,'entries',{...entry,lines:[{accountId:P.id(code),debit:100,credit:0},entry.lines[1]]}),/títulos y registros físicos/);
  assert.throws(()=>D.commit(d,'costs',{date:'2026-01-01',area:'cerdos',reference:'No',accountId:P.id('5'),amount:1}),/imputable/);
});
test('managed assets cannot be posted manually, installations can',()=>{
  const d=P.upgrade(D.initial());
  const entry=code=>({date:'2026-01-01',area:'cerdos',reference:'Instalación',lines:[{accountId:P.id(code),debit:100,credit:0},{accountId:P.id('3.1.01'),debit:0,credit:100}]});
  assert.throws(()=>D.commit(d,'entries',entry('1.3.03.01')),/activos productivos/);
  assert.equal(D.commit(d,'entries',entry('1.5.02.05')).entries.length,1);
});
test('new product account is explicit and cannot silently recategorize prior stock',()=>{
  let d=P.upgrade(D.initial());d=D.commit(d,'products',{id:'corn',name:'Maíz propio',kind:'grano',unit:'kg',inventoryAccountId:P.id('1.3.04.01')});
  d=D.commit(d,'stock',{date:'2026-01-01',type:'apertura',area:'cerdos',productId:'corn',quantity:100,unitCost:5});
  assert.equal(D.replay(d).journal[0].lines[0].accountId,P.id('1.3.04.01'));
  assert.throws(()=>D.commit(d,'products',{id:'corn',inventoryAccountId:P.id('1.3.04.90')}),/tiene historia/);
  assert.equal(P.inventoryAccount({kind:'grano',name:'Maíz'},'cerdos'),P.id('1.3.04.90'));
});
test('base definitions, duplicate codes and physical classifications are protected',()=>{
  const d=P.upgrade(D.initial()),a=d.accounts.find(a=>a.id===P.id('5.3.02.01'));
  assert.throws(()=>D.commit(d,'accounts',{...a,name:'Otro nombre'}),/conservan/);
  assert.throws(()=>D.commit(d,'accounts',{...a,voided:true}),/necesaria/);
  assert.throws(()=>D.cancel(d,'accounts',a.id),/no se pueden anular/);
  assert.throws(()=>D.commit(d,'accounts',{code:a.code,name:'Duplicado',kind:'expense'}),/ya existe/);
  const custom=D.commit(d,'accounts',{code:'5.3.02.02',name:'Control sanitario adicional',kind:'expense',parent:a.id});assert.equal(custom.accounts.at(-1).source,'Personalizada');
});
test('new transfer round trip works and incomplete or future charts are rejected',async()=>{
  const d=P.upgrade(fixture());assert.deepEqual((await T.decode(await T.encode(d))).data,d);
  assert.equal(T.isEmpty(P.upgrade(D.initial())),true);assert.equal(T.isEmpty(d),false);
  const incomplete=structuredClone(d);incomplete.accounts=incomplete.accounts.filter(a=>a.id!==P.id('6.6.03'));assert.throws(()=>T.inspect(incomplete),/Falta una cuenta/);
  assert.throws(()=>P.upgrade({...d,accountPlanVersion:2}),/más nueva/);
});
test('lactation and destete remain distinct even with the same feed phase',()=>{
  let d=D.initial();
  d=D.commit(d,'lots',{id:'birth',date:'2026-01-01',name:'Lactancia',phase:'fase1',bioStage:'cria',animals:10,weight:5,openingValue:1000});
  d=D.commit(d,'lots',{id:'wean',date:'2026-01-01',name:'Destete',phase:'fase1',bioStage:'destete',animals:0,weight:0,openingValue:0});
  d=D.commit(d,'movements',{date:'2026-01-02',type:'traslado',lotId:'birth',toLotId:'wean',quantity:10,weight:10});
  const state=D.replay(P.upgrade(d));assert.deepEqual(state.errors,[]);
  const balance=code=>D.sum(state.journal.flatMap(e=>e.lines).filter(l=>l.accountId===P.id(code)),l=>l.debit-l.credit);
  assert.equal(balance('1.3.03.03'),0);assert.equal(balance('1.3.03.04'),1000);
});
test('tax perceptions and sow depreciation preserve prior economic totals',()=>{
  let d=fixture();d=D.commit(d,'sales',{id:'sale',perceptions:100});
  d=D.commit(d,'sows',{id:'sow',date:'2026-01-01',name:'Madre',sex:'madre',value:1200,residual:0,lifeMonths:12,discardDate:'2026-03-15',discardValue:200});
  const old=D.results(d,'2026-01-01','2026-12-31'),next=D.results(P.upgrade(d),'2026-01-01','2026-12-31');
  assert.deepEqual(next.state.errors,[]);assert.deepEqual(next.areas,old.areas);
  const credits=code=>D.sum(next.state.journal.flatMap(e=>e.lines).filter(l=>l.accountId===P.id(code)),l=>l.credit);
  assert.equal(credits('2.3.01.01'),2100);assert.equal(credits('2.3.01.90'),100);
});
test('missing required definitions can be restored without touching data',()=>{
  const d=P.upgrade(fixture()),old=structuredClone(d.costs);d.accounts=d.accounts.filter(a=>a.id!==P.id('6.6.03'));
  assert.equal(P.needsUpgrade(d),true);const restored=P.upgrade(d);assert.equal(P.needsUpgrade(restored),false);assert.deepEqual(restored.costs,old);assert.equal(restored.accountPlanMigration.added,1);
});
