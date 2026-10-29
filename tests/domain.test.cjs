const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../domain.js');
function base() {
  const d = D.initial();
  d.parties.push({id:'buyer',name:'Comprador de prueba',kind:'cliente'});
  d.products.push({id:'corn',name:'Maíz de prueba',kind:'grano',unit:'kg',kgPerBag:25});
  d.campaigns.push({id:'crop',date:'2026-01-01',name:'Campaña de prueba',crop:'Maíz',hectares:1});
  d.lots.push({id:'lot',date:'2026-01-01',name:'Fase 4 prueba',phase:'fase4',bioStage:'destete',animals:10,weight:10,openingValue:10000});
  d.lots.push({id:'destination',date:'2026-01-01',name:'Recría prueba',phase:'recria',bioStage:'engorde',animals:0,weight:0,openingValue:0});
  return d;
}
function integrated() {
  const d = base();
  d.costs.push({id:'cropcost',date:'2026-01-02',area:'agricultura',reference:'C-1',amount:180000,tax:0,accountId:'5.4.02',campaignId:'crop'});
  d.stock.push({id:'harvest',date:'2026-01-03',area:'agricultura',type:'cosecha',productId:'corn',campaignId:'crop',quantity:1000,unitCost:180});
  d.transfers.push({id:'transfer',date:'2026-01-04',productId:'corn',campaignId:'crop',quantity:1000,opportunityPrice:230,source:'Ejemplo ficticio',priceDate:'2026-01-04'});
  return d;
}
test('venta parcial descuenta cabezas y costo proporcional; anulación recupera ambos',()=>{
  let d=base(); const s={id:'sale',date:'2026-01-10',area:'cerdos',partyId:'buyer',reference:'V-1',lotId:'lot',animals:3,weight:20,price:1000,tax:0,fees:0};
  d=D.commit(d,'sales',s);let state=D.replay(d,'2026-01-31');assert.equal(state.lots.lot.quantity,7);assert.equal(state.lots.lot.value,7000);
  d=D.cancel(d,'sales','sale');assert.equal(D.replay(d,'2026-01-31').lots.lot.quantity,10);
});
test('no permite sobreventa, incluso futura',()=>assert.throws(()=>D.commit(base(),'sales',{date:'2027-01-01',area:'cerdos',partyId:'buyer',reference:'V-2',lotId:'lot',animals:11,weight:20,price:1000}),/insuficientes/));
test('traslado parcial conserva cabezas, valor y categoría de cada lote',()=>{
  const d=D.commit(base(),'movements',{date:'2026-01-05',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15});const s=D.replay(d,'2026-01-31');
  assert.equal(s.lots.lot.quantity,6);assert.equal(s.lots.destination.quantity,4);assert.equal(s.lots.lot.value+s.lots.destination.value,10000);assert.equal(s.lots.destination.phase,'recria');
});
test('rango configurado controla el peso de traslado',()=>{const d=base();d.settings.weightRanges.recria={min:20,max:50};assert.throws(()=>D.commit(d,'movements',{date:'2026-01-05',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15}),/rango/);});
test('tratamiento no altera existencias',()=>{const d=D.commit(base(),'movements',{date:'2026-01-05',type:'tratamiento',lotId:'lot',quantity:0,weight:0});assert.equal(D.replay(d,'2026-01-31').lots.lot.quantity,10);});
test('pesajes antiguos se ordenan por fecha',()=>{const d=base();d.movements.push({id:'new',date:'2026-01-10',type:'pesaje',lotId:'lot',quantity:10,weight:30},{id:'old',date:'2026-01-05',type:'pesaje',lotId:'lot',quantity:10,weight:20});assert.equal(D.replay(d,'2026-01-31').lots.lot.weight,30);});
test('no se anula un lote con referencias',()=>{const d=base();d.movements.push({id:'m',date:'2026-01-03',type:'pesaje',lotId:'lot',quantity:10,weight:10});assert.throws(()=>D.cancel(d,'lots','lot'),/vinculados/);});
test('consumo disminuye insumos y capitaliza costo en lote',()=>{let d=integrated();d=D.commit(d,'stock',{date:'2026-01-05',area:'cerdos',type:'consumo',productId:'corn',quantity:100,lotId:'lot'});const s=D.replay(d,'2026-01-31');assert.equal(s.lots.lot.value,28000);assert.equal(s.stock['corn|cerdos|'].quantity,900);assert.equal(s.lots.lot.memo,5000);});
test('transferencia interna no genera utilidad consolidada ni duplica stock',()=>{const r=D.results(integrated(),'2026-01-01','2026-01-31');assert.equal(r.consolidated,0);assert.equal(r.areas.agricultura.management,50000);assert.equal(r.adjustment,-50000);assert.equal(D.sum(Object.values(r.state.stock),s=>s.quantity),1000);});
test('ciclo completo elimina margen interno y concilia resultado externo',()=>{
  let d=integrated();d=D.commit(d,'stock',{date:'2026-01-05',area:'cerdos',type:'consumo',productId:'corn',quantity:1000,lotId:'lot'});
  d=D.commit(d,'sales',{date:'2026-01-10',area:'cerdos',partyId:'buyer',reference:'V-1',lotId:'lot',animals:10,weight:60,price:1000});const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(r.consolidated,410000);assert.equal(r.adjustment,0);assert.equal(r.areas.cerdos.management,360000);
});
test('comprobantes generan asientos balanceados e IVA separado',()=>{const d=D.commit(base(),'costs',{date:'2026-01-02',area:'cerdos',reference:'F-1',amount:100,tax:21,taxRecoverable:true,accountId:'5.3.02'});const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(r.areas.cerdos.expense,100);for(const j of r.state.journal)assert.ok(Math.abs(D.sum(j.lines,l=>l.debit-l.credit))<.01);});
test('cobros parciales cancelan crédito sin duplicar ventas',()=>{let d=base();d=D.commit(d,'sales',{id:'sale',date:'2026-01-02',area:'cerdos',partyId:'buyer',reference:'V-1',lotId:'lot',animals:1,weight:10,price:100});d=D.commit(d,'payments',{date:'2026-01-03',sourceId:'sale',amount:400});const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(r.state.documents.sale.paid,400);assert.equal(r.areas.cerdos.revenue,1000);assert.throws(()=>D.commit(d,'payments',{date:'2026-01-04',sourceId:'sale',amount:601}),/supera/);});
test('ICA calcula 300 kg de alimento / 100 kg ganados = 3',()=>{
  const d=base();d.stock.push({id:'opening',date:'2026-01-01',area:'cerdos',type:'apertura',productId:'corn',quantity:500,unitCost:10},{id:'feed',date:'2026-01-05',area:'cerdos',type:'consumo',productId:'corn',quantity:300,lotId:'lot'});
  d.movements.push({id:'w1',date:'2026-01-02',type:'pesaje',lotId:'lot',quantity:10,weight:10},{id:'w2',date:'2026-01-10',type:'pesaje',lotId:'lot',quantity:10,weight:20});const i=D.indicators(d,'2026-01-01','2026-01-31').rows[0];assert.equal(i.ica,3);assert.equal(i.feedCostKg,30);
});
test('ICA concilia un traslado parcial con su peso',()=>{
  const d=base();d.stock.push({id:'opening',date:'2026-01-01',area:'cerdos',type:'apertura',productId:'corn',quantity:500,unitCost:10},{id:'feed',date:'2026-01-05',area:'cerdos',type:'consumo',productId:'corn',quantity:240,lotId:'lot'});
  d.movements.push({id:'w1',date:'2026-01-02',type:'pesaje',lotId:'lot',quantity:10,weight:10},{id:'transfer',date:'2026-01-06',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15},{id:'w2',date:'2026-01-10',type:'pesaje',lotId:'lot',quantity:6,weight:20});const i=D.indicators(d,'2026-01-01','2026-01-31').rows[0];assert.equal(i.gain,80);assert.equal(i.ica,3);
});
test('ICA sin pesajes no se muestra como cero',()=>assert.equal(D.indicators(base(),'2026-01-01','2026-01-31').rows[0].ica,null));
test('mortandad excluye lactancia e incluye camadas cerradas con cero destetados',()=>{
  const d=base();d.births.push({id:'closed',date:'2026-01-01',weanDate:'2026-01-20',closed:true,bornAlive:10,weaned:0,losses:10},{id:'lactating',date:'2026-01-21',bornAlive:14,weaned:0,losses:0});const i=D.indicators(d,'2026-01-01','2026-01-31');assert.equal(i.alive,10);assert.equal(i.mortality,100);assert.equal(i.survival,0);
});
test('saldo insuficiente no se convierte en valor cero',()=>assert.throws(()=>D.commit(base(),'stock',{date:'2026-01-05',area:'cerdos',type:'consumo',productId:'corn',quantity:1,lotId:'lot'}),/insuficientes/));
test('bolsas guardan factor histórico',()=>{let d=base();d=D.commit(d,'stock',{date:'2026-01-02',area:'cerdos',type:'apertura',productId:'corn',quantity:4,inputUnit:'bolsas',unitCost:10});d.products[0].kgPerBag=50;assert.equal(D.replay(d,'2026-01-31').stock['corn|cerdos|'].quantity,100);});
test('precio orientativo no revaloriza una operación histórica',()=>{let d=integrated();const original=D.results(d,'2026-01-01','2026-01-31').areas.agricultura.management;d.prices.push({id:'p',date:'2026-01-20',product:'maiz',price:1000000,source:'Test',unit:'tonelada'});assert.equal(D.results(d,'2026-01-01','2026-01-31').areas.agricultura.management,original);});
test('migración conserva los datos originales y no confirma valores dudosos',()=>{const raw={costs:[{id:'c',date:'2026-01-01',quantity:2,unitCost:100,supplier:'Test'}],batches:[{id:'l',name:'Lote antiguo',animals:10,dateIn:'2026-01-01',avgWeightNow:30}]};const d=D.migrate(raw);assert.deepEqual(d.legacy,raw);assert.equal(d.costs[0].review,true);assert.equal(d.costs[0].amount,200);assert.equal(D.results(d,'2026-01-01','2026-01-31').consolidated,0);});
test('cierre bloquea edición retroactiva',()=>{const d=base();d.closings.push({id:'close',start:'2026-01-01',end:'2026-01-31'});assert.throws(()=>D.commit(d,'movements',{date:'2026-01-05',type:'tratamiento',lotId:'lot'}),/cerrado/);});
test('comparador diferencia venta y reposición con unidades coherentes',()=>{const r=D.scenario({tonnes:1,grainSell:230000,sellFreight:10000,sellFees:5000,replacement:230000,purchaseFreight:20000,pigPrice:2000,ica:3,grainShare:60,otherFeedKg:100,otherCost:50000,days:0,annualRate:0,mortality:0});assert.equal(r.valid,true);assert.equal(r.sell,215000);assert.equal(r.ownVsBuy,35000);assert.ok(Math.abs(r.feedKg-1666.6666666666667)<1e-6);assert.equal(D.scenario({tonnes:1}).valid,false);});
test('traslado imputa el costo a la cuenta de cada categoría',()=>{
  const d=D.commit(base(),'movements',{date:'2026-01-05',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15});
  const s=D.replay(d,'2026-01-31'); const balance=code=>D.sum(s.journal.flatMap(j=>j.lines).filter(l=>l.accountId===code),l=>l.debit-l.credit);
  assert.equal(balance('1.3.03.04'),6000);assert.equal(balance('1.3.03.05'),4000);
});
test('compra separa crédito fiscal y saldo a pagar del costo del insumo',()=>{
  const d=D.commit(base(),'stock',{id:'buy',date:'2026-01-03',type:'compra',area:'cerdos',productId:'corn',quantity:100,unitCost:10,tax:210,taxRecoverable:true});
  const s=D.replay(d,'2026-01-31');assert.equal(s.stock['corn|cerdos|'].value,1000);assert.equal(s.documents.buy.amount,1210);assert.equal(D.sum(s.journal.flatMap(j=>j.lines).filter(l=>l.accountId==='1.2.05.01'),l=>l.debit),210);
});
test('impuesto no recuperable integra costo del insumo',()=>{
  const d=D.commit(base(),'stock',{date:'2026-01-03',type:'compra',area:'cerdos',productId:'corn',quantity:100,unitCost:10,tax:210,taxRecoverable:false});assert.equal(D.replay(d,'2026-01-31').stock['corn|cerdos|'].value,1210);
});
test('pagos comunes respetan el reparto entre actividades',()=>{
  let d=D.commit(base(),'costs',{id:'common',date:'2026-01-03',area:'comun',reference:'C1',amount:1000,tax:0,accountId:'5.5.01',pigShare:30,criterion:'Horas medidas'});
  d=D.commit(d,'payments',{date:'2026-01-04',sourceId:'common',amount:500});const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(r.areas.cerdos.cash,-150);assert.equal(r.areas.agricultura.cash,-350);
});
test('no asume porcentaje cuando un gasto es compartido',()=>assert.throws(()=>D.commit(base(),'costs',{date:'2026-01-03',area:'comun',reference:'C1',amount:1000,accountId:'5.5.01',pigShare:'',criterion:'Horas'}),/porcentaje/));
test('consumo de cereal recién transferido funciona en el mismo día',()=>{
  const d=D.commit(integrated(),'stock',{date:'2026-01-04',area:'cerdos',type:'consumo',productId:'corn',quantity:1000,lotId:'lot'});assert.equal(D.replay(d,'2026-01-31').stock['corn|cerdos|'].quantity,0);
});
test('un producto usado no cambia de unidad ni categoría histórica',()=>{
  const d=integrated();assert.throws(()=>D.commit(d,'products',{...d.products[0],kind:'otro'}),/historia/);
});
test('cambios de criterios no invalidan traslados históricos',()=>{
  let d=base();d.settings.weightRanges.recria={min:10,max:30};d=D.commit(d,'movements',{date:'2026-01-05',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15});d.settings.weightRanges.recria={min:20,max:40};assert.deepEqual(D.replay(d,'2026-01-31').errors,[]);
});
test('correcciones guardan versión previa y no duplican importe',()=>{
  let d=D.commit(base(),'costs',{id:'cost',date:'2026-01-02',area:'cerdos',reference:'C1',amount:100,accountId:'5.3.02'});d=D.commit(d,'costs',{id:'cost',amount:150});assert.equal(d.costs[0].history[0].record.amount,100);assert.equal(D.results(d,'2026-01-01','2026-01-31').areas.cerdos.expense,150);
});
test('una fila importada no genera dos imputaciones y su anulación la reabre',()=>{
  const row={id:'cost',date:'2026-01-02',area:'cerdos',reference:'C1',amount:100,accountId:'5.3.02',sourceImportId:'csv'};let d=base();d.imports.push({id:'csv',review:true,content:'{}'});
  d=D.commit(d,'costs',row);assert.equal(d.imports[0].resolvedId,'cost');assert.throws(()=>D.commit(d,'costs',{...row,id:'second'}),/ya tiene/);d=D.cancel(d,'costs','cost');assert.equal(d.imports[0].review,undefined);assert.equal(d.imports[0].resolvedId,undefined);
});
test('se preserva una cuenta que aparece en renglones de un asiento',()=>{
  let d=base();d.accounts.push({id:'6.1',code:'6.1',name:'Prueba',kind:'expense'});d=D.commit(d,'entries',{date:'2026-01-03',area:'cerdos',reference:'AJ',lines:[{accountId:'6.1',debit:50,credit:0},{accountId:'1.1.01',debit:0,credit:50}]});assert.throws(()=>D.cancel(d,'accounts','6.1'),/vinculados/);
});
test('distribución capitaliza en la categoría correcta sin duplicar costo',()=>{
  let d=D.commit(base(),'costs',{id:'c',date:'2026-01-02',area:'cerdos',reference:'C',amount:100,accountId:'5.3.02'});d=D.commit(d,'allocations',{date:'2026-01-03',costId:'c',lotId:'lot',amount:100,criterion:'Cabezas'});const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(r.areas.cerdos.expense,0);assert.equal(r.state.lots.lot.value,10100);
});
test('prorrateo del plantel sigue destetados trasladados y excluye los vendidos',()=>{
  let d=base();d.lots.push({id:'cria',date:'2026-01-01',name:'Cría',phase:'fase1',bioStage:'cria',animals:0,weight:0,openingValue:0});
  d.sows.push({id:'mother',date:'2026-01-01',name:'Madre',sex:'madre',value:1200,residual:0,lifeMonths:12});
  d=D.commit(d,'births',{id:'birth',date:'2026-01-03',sowId:'mother',lotId:'cria',bornAlive:10,weaned:10,weanDate:'2026-01-20',weanWeight:7,toLotId:'lot',closed:true});
  d=D.commit(d,'movements',{date:'2026-01-22',type:'traslado',lotId:'lot',toLotId:'destination',quantity:10,weight:15});
  d=D.commit(d,'sales',{date:'2026-01-25',area:'cerdos',reference:'S1',partyId:'buyer',lotId:'destination',animals:5,weight:15,price:100});
  const s=D.replay(d,'2026-01-31'), dep=s.depreciation[0];assert.equal(dep.value,100);assert.equal(dep.allocated,75);assert.equal(s.lots.lot.value,5050);assert.equal(s.lots.destination.value,2525);
});
test('traslados consecutivos del mismo día respetan el orden de carga',()=>{
  let d=base();d.lots.push({id:'end',date:'2026-01-01',name:'Terminador',phase:'terminador',bioStage:'engorde',animals:0,weight:0,openingValue:0});
  d=D.commit(d,'movements',{id:'z-first',date:'2026-01-05',type:'traslado',lotId:'lot',toLotId:'destination',quantity:4,weight:15});
  d=D.commit(d,'movements',{id:'a-last',date:'2026-01-05',type:'traslado',lotId:'destination',toLotId:'end',quantity:4,weight:15});assert.equal(D.replay(d,'2026-01-31').lots.end.quantity,4);
});
test('reparto común y pagos parciales conservan hasta el último centavo',()=>{
  let d=D.commit(base(),'costs',{id:'c',date:'2026-01-02',area:'comun',reference:'C',amount:.03,tax:.03,taxRecoverable:true,accountId:'5.5.01',pigShare:50,criterion:'Partes iguales justificadas'});
  for(let i=0;i<6;i++)d=D.commit(d,'payments',{date:'2026-01-03',sourceId:'c',amount:.01});
  const r=D.results(d,'2026-01-01','2026-01-31');assert.equal(D.round(r.consolidated),-.03);
  for(const area of ['cerdos','agricultura'])assert.equal(D.round(D.sum(r.state.journal.filter(j=>j.area===area).flatMap(j=>j.lines).filter(l=>l.accountId==='2.1.01'),l=>l.debit-l.credit)),0);
});
module.exports = { base, integrated };
