const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../domain.js'),T=require('../transfer.js');
const cost={id:'cost',date:'2026-08-01',area:'cerdos',reference:'GASTO',amount:100,tax:0,accountId:'5.3.02'};
const lot={id:'lot',name:'Lote',date:'2026-08-01',phase:'fase4',bioStage:'destete',animals:10,weight:25,openingValue:600};
const old=()=>{const db=D.initial();delete db.workflowVersion;db.settings.accountPlanApproved=false;db.accounts.forEach(a=>a.provisional=true);return db;};
test('new operations post immediately even when an old client supplies review=true',()=>{
  const db=D.commit(D.initial(),'costs',{...cost,review:true});
  assert.equal(db.costs[0].review,undefined);assert.equal(D.results(db,'2026-08-01','2026-08-31').consolidated,-100);
  assert.throws(()=>D.commit(db,'costs',{...cost,id:'bad',amount:0,review:true}),/Importe/);
  assert.throws(()=>D.commit(db,'entries',{date:'2026-08-01',area:'cerdos',reference:'BAD',review:true,lines:[{accountId:'1.1.01',debit:100},{accountId:'3.1.01',credit:90}]}),/balanceado/);
});
test('complete old operations are incorporated once without approval flags',()=>{
  const db=old();db.costs.push({...cost,review:true});db.lots.push({...lot,review:true});
  const result=D.upgradeWorkflow(db);
  assert.equal(db.costs[0].review,true);assert.equal(result.costs[0].review,undefined);
  assert.equal(result.workflowMigration.incorporated.length,2);assert.equal(D.results(result,'2026-08-01','2026-08-31').consolidated,-100);
  assert.equal(D.replay(result).lots.lot.quantity,10);assert.equal(result.settings.accountPlanApproved,undefined);
  assert.equal(result.accounts.some(a=>'provisional' in a),false);assert.equal(D.needsWorkflowUpgrade(result),false);assert.equal(D.upgradeWorkflow(result),result);
  assert.equal(result.costs[0].history[0].record.review,true);
});
test('missing opening values and invalid operations are preserved as original documents',()=>{
  const db=old(),incomplete={...lot,review:true,openingValue:''};db.lots.push(incomplete);db.costs.push({...cost,review:true,reference:''});
  const result=D.upgradeWorkflow(db);
  assert.equal(result.lots.length,0);assert.equal(result.costs.length,0);assert.equal(result.imports.length,2);
  const source=result.imports.find(row=>row.originalTable==='lots');assert.deepEqual(source.originalRecord,incomplete);assert.match(source.importIssue,/Faltan/);
  assert.equal(D.results(result,'2026-08-01','2026-08-31').consolidated,0);assert.equal(D.results(result,'2026-08-01','2026-08-31').pending,0);
  const posted=D.commit(result,'lots',{...source.originalRecord,openingValue:600,sourceImportId:source.id});
  assert.equal(D.replay(posted).lots.lot.quantity,10);assert.equal(posted.imports.find(row=>row.id===source.id).resolvedId,lot.id);
});
test('migration retries dependencies and does not permit negative stock',()=>{
  const db=old();db.lots.push({...lot,review:true});db.products.push({id:'feed',name:'Alimento',kind:'alimento',unit:'kg',review:true});
  db.stock.push({id:'eat',date:'2026-08-02',area:'cerdos',type:'consumo',productId:'feed',quantity:30,lotId:'lot',review:true});
  db.stock.push({id:'buy',date:'2026-08-01',area:'cerdos',type:'compra',productId:'feed',quantity:50,unitCost:10,review:true});
  db.stock.push({id:'too-much',date:'2026-08-03',area:'cerdos',type:'consumo',productId:'feed',quantity:100,lotId:'lot',review:true});
  const result=D.upgradeWorkflow(db);assert.equal(result.stock.length,2);assert.equal(D.replay(result).stock['feed|cerdos|'].quantity,20);
  assert.equal(result.workflowMigration.incorporated.length,4);assert.equal(result.imports[0].originalRecord.id,'too-much');assert.match(result.imports[0].importIssue,/insuficientes/);
});
test('migration preserves closed periods and never attributes old record creation to current user',()=>{
  const db=old();db.costs.push({...cost,review:true,createdBy:'original'});db.closings.push({id:'close',date:'2026-09-01',start:'2026-08-01',end:'2026-08-31',result:0});
  const result=D.upgradeWorkflow(db);assert.equal(result.costs.length,0);assert.match(result.imports[0].importIssue,/cerrado/);assert.equal(result.imports[0].originalRecord.createdBy,'original');assert.deepEqual(result.closings,db.closings);
});
test('legacy CSV, linked sources and voided drafts do not create approval requirements',()=>{
  const db=old();db.imports.push({id:'csv',review:true,content:'original'});db.costs.push({...cost,review:true,sourceImportId:'csv',reference:''});db.lots.push({...lot,review:true,voided:true});
  const result=D.upgradeWorkflow(db);assert.equal(result.imports.length,1);assert.equal(result.imports[0].content,'original');assert.equal(result.imports[0].originalRecord.id,'cost');assert.equal(result.lots[0].voided,true);assert.equal(result.lots[0].review,undefined);
  assert.equal(D.needsWorkflowUpgrade(result),false);
});
test('new and old transfer files remain readable, retaining source evidence',async()=>{
  const db=old();db.lots.push({...lot,openingValue:'',review:true});
  const decoded=(await T.decode(await T.encode(db))).data;const current=D.upgradeWorkflow(decoded);
  assert.deepEqual((await T.decode(await T.encode(current))).data,current);assert.equal(current.imports[0].originalRecord.openingValue,'');
});
