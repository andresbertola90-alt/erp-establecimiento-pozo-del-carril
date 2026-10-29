'use strict';
let accessAudit=[],auditFilters={user:'all',from:'',to:'',page:0};
const auditTables={accounts:'Plan de cuentas',parties:'Clientes y proveedores',products:'Productos',campaigns:'Campañas',lots:'Lotes de cerdos',sows:'Reproductores',births:'Partos y destetes',movements:'Movimientos de cerdos',costs:'Compras y costos',stock:'Insumos',transfers:'Cereal propio',sales:'Ventas',payments:'Pagos y cobros',prices:'Precios',allocations:'Distribuciones',entries:'Asientos manuales',closings:'Cierres',scenarios:'Escenarios',imports:'Planillas recibidas',settings:'Criterios',users:'Usuarios',system:'Sistema'};
const auditActions={actualizar:'Actualizó el sistema',inicio:'Inicio del historial',crear:'Creó',editar:'Editó',anular:'Anuló',eliminar:'Eliminó',validar:'Validó',reabrir:'Reabrió',importar:'Importó',login:'Inició sesión',logout:'Cerró sesión',password:'Cambió la contraseña',reset:'Restableció contraseña',recover:'Recuperó el acceso',activar:'Activó usuario',desactivar:'Desactivó usuario'};
const auditFields={id:'Identificador',name:'Nombre',date:'Fecha',reference:'Referencia',note:'Observaciones',area:'Actividad',lines:'Cuentas del asiento',accountId:'Cuenta',amount:'Importe',tax:'Impuestos',price:'Precio',quantity:'Cantidad',animals:'Cabezas',weight:'Peso',openingValue:'Valor inicial',phase:'Categoría',bioStage:'Etapa productiva',lotId:'Lote',toLotId:'Lote destino',productId:'Producto',campaignId:'Campaña',partyId:'Cliente / proveedor',review:'Pendiente de validar',voided:'Anulado',type:'Tipo',role:'Permiso',active:'Activo',username:'Usuario',manager:'Responsable',accountPlanApproved:'Criterios aprobados',priceAgeDays:'Vigencia de precios (días)',weightRanges:'Rangos de peso',source:'Origen',start:'Desde',end:'Hasta',result:'Resultado',records:'Registros recibidos'};
function clearAuditState(){accessAudit=[];auditFilters={user:'all',from:'',to:'',page:0};$('#auditDialog').replaceChildren();}
function auditEvents(){return [...(db?.auditLog||[]),...accessAudit].sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));}
function auditLocalDate(at){const value=new Date(at);value.setMinutes(value.getMinutes()-value.getTimezoneOffset());return value.toISOString().slice(0,10);}
function renderAudit(){
  const all=auditEvents(),users=[...new Set(all.map(event=>event.username))].sort();
  const rows=all.filter(event=>(auditFilters.user==='all'||event.username===auditFilters.user)&&(!auditFilters.from||auditLocalDate(event.at)>=auditFilters.from)&&(!auditFilters.to||auditLocalDate(event.at)<=auditFilters.to));
  const pages=Math.max(1,Math.ceil(rows.length/50));auditFilters.page=Math.min(auditFilters.page,pages-1);
  const filters=`<div class="audit-filters"><label class="field"><span>Usuario</span><select data-audit-filter="user"><option value="all">Todos</option>${users.map(user=>`<option value="${esc(user)}" ${user===auditFilters.user?'selected':''}>${esc(user)}</option>`).join('')}</select></label><label class="field"><span>Desde</span><input type="date" data-audit-filter="from" value="${esc(auditFilters.from)}"></label><label class="field"><span>Hasta</span><input type="date" data-audit-filter="to" value="${esc(auditFilters.to)}"></label><button class="btn ghost" type="button" data-audit-action="refresh">${icon('refresh-cw')}Actualizar</button></div>`;
  const body=table('Historial por usuario',['Fecha y hora','Usuario','Acción','Sección','Registro',''],rows.slice(auditFilters.page*50,(auditFilters.page+1)*50).map(event=>[esc(new Date(event.at).toLocaleString('es-AR')),esc(event.userName+' ('+event.username+')'),esc(auditActions[event.action]||event.action),esc(auditTables[event.table]||event.table),esc(event.reference)+(event.importedAt?' '+badge('Trasladado','neutral'):''),`<button type="button" class="tool" data-audit-action="detail" data-id="${esc(event.id)}" aria-label="Ver modificación" title="Ver modificación">${icon('search')}</button>`]));
  return filters+body+`<div class="toolbar"><span>${rows.length} registros · Página ${auditFilters.page+1} de ${pages}</span><button type="button" class="tool" data-audit-action="previous" ${auditFilters.page===0?'disabled':''} title="Página anterior" aria-label="Página anterior">${icon('chevron-left')}</button><button type="button" class="tool" data-audit-action="next" ${auditFilters.page>=pages-1?'disabled':''} title="Página siguiente" aria-label="Página siguiente">${icon('chevron-right')}</button></div>`;
}
function auditValue(value,key){
  if(value==null||value==='')return 'Sin dato';if(typeof value==='boolean')return value?'Sí':'No';
  if(key==='lines'&&Array.isArray(value))return value.map(line=>(line.accountId||'Sin cuenta')+' · '+nameOf('accounts',line.accountId)+'\nDebe: '+journalMoney(line.debit||0)+' | Haber: '+journalMoney(line.credit||0)).join('\n\n');
  if(key==='area')return D.AREAS[value]||value;
  if(key==='phase')return D.PHASES[value]||value;
  const related={accountId:'accounts',lotId:'lots',toLotId:'lots',productId:'products',campaignId:'campaigns',partyId:'parties'};
  if(related[key])return nameOf(related[key],value)+' ('+value+')';
  return typeof value==='object'?JSON.stringify(value,null,2):String(value);
}
function openAuditDetail(event){
  const keys=[...new Set([...Object.keys(event.before||{}),...Object.keys(event.after||{})])].filter(key=>!UNRCAudit.equal(event.before?.[key],event.after?.[key]));
  const dialog=$('#auditDialog');dialog.innerHTML=`<div class="surface-title"><div><h3>${esc(auditActions[event.action]||event.action)} · ${esc(event.reference)}</h3><p>${esc(event.userName)} (${esc(event.username)}) · ${esc(new Date(event.at).toLocaleString('es-AR'))}</p></div><button type="button" class="tool" data-audit-action="close" title="Cerrar" aria-label="Cerrar">${icon('x')}</button></div>${keys.length?`<table class="audit-diff"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${keys.map(key=>`<tr><th>${esc(auditFields[key]||key)}</th><td>${esc(auditValue(event.before?.[key],key))}</td><td>${esc(auditValue(event.after?.[key],key))}</td></tr>`).join('')}</tbody></table>`:'<p>Evento de acceso o de inicio del historial. No contiene contraseñas ni claves de recuperación.</p>'}`;dialog.showModal();refreshIcons();
}
document.addEventListener('change',async event=>{
  const key=event.target.dataset.auditFilter;if(!key||!await ensureAccess())return;
  const old=auditFilters[key];auditFilters[key]=event.target.value;
  if(auditFilters.from&&auditFilters.to&&auditFilters.from>auditFilters.to){auditFilters[key]=old;toast('Revisá el intervalo de fechas.');}
  auditFilters.page=0;render();
});
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-audit-action]');if(!el)return;
  if(el.dataset.auditAction==='close'){$('#auditDialog').close();return;}
  if(!await ensureAccess())return;
  try{
    if(el.dataset.auditAction==='detail'){const record=auditEvents().find(record=>record.id===el.dataset.id);if(record)openAuditDetail(record);return;}
    if(el.dataset.auditAction==='refresh'){db=await UNRCStorage.load();await refreshUsers();}
    if(el.dataset.auditAction==='previous')auditFilters.page=Math.max(0,auditFilters.page-1);
    if(el.dataset.auditAction==='next')auditFilters.page++;
    render();
  }catch(error){toast(error.message);}
});
$('#auditDialog').addEventListener('close',()=>$('#auditDialog').replaceChildren());
