'use strict';
let reportSnapshot='',reportOrientation='landscape',reportTitle='',reportBusy=false;
function buildReport() {
  if(!db||!UNRCAuth.current||$('#appShell').hidden)return '';
  const root=$('#viewRoot').cloneNode(true),original=$('#viewRoot');
  const title=original.querySelector('.page-heading h3')?.textContent||'Reporte';
  const tab=original.querySelector('[role="tab"][aria-selected="true"]')?.textContent||'';
  const originalInputs=[...original.querySelectorAll('input,select,textarea')];
  root.querySelectorAll('input,select,textarea').forEach((input,i)=>{const source=originalInputs[i],value=document.createElement('span');value.className='report-field-value';value.textContent=source.tagName==='SELECT'?source.selectedOptions[0]?.textContent:source.type==='checkbox'?(source.checked?'Sí':'No'):source.value||'Sin completar';input.replaceWith(value);});
  root.querySelectorAll('.page-heading,.toolbar,.tabs,.record-tools,.section-actions,button').forEach(el=>el.remove());
  root.querySelectorAll('table').forEach(table=>{const last=table.tHead?.rows[0]?.cells.length-1;if(last>=0&&!table.tHead.rows[0].cells[last].textContent.trim())for(const row of table.rows)row.cells[last]?.remove();});
  root.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  root.querySelectorAll('.metric strong').forEach(el=>el.style.removeProperty('font-size'));
  const state=D.results(db,ui.from,ui.to),manual=ui.view==='manual';
  const warnings=manual?'':(state.state.errors.length?notice('Hay movimientos por corregir. El reporte no es definitivo.','error'):'');
  if(ui.view==='general')root.querySelectorAll('.view-stack > .notice').forEach(el=>el.remove());
  reportTitle=[title,tab].filter(Boolean).join(' · ');
  const issued=new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
  const category=ui.view==='cerdos'&&ui.tab.cerdos!=='movimientos'&&ui.category!=='all'?' · Categoría: '+(D.PHASES[ui.category]||'Todas'):'';
  return `<article class="print-document"><header class="report-heading"><img src="./assets/logo-unrc.png" alt="UNRC"><div><p>Universidad Nacional de Río Cuarto</p><h1>Establecimiento Pozo del Carril</h1><h2>${esc(reportTitle)}</h2></div><img class="report-farm-logo" src="./assets/logo-pozo-del-carril.png" alt=""></header><div class="report-meta">${manual?'Manual de usuario':`Consulta: ${date(ui.from)} al ${date(ui.to)} · Existencias a ${date(ui.to)}${esc(category)}`}<br>Emitido: ${esc(issued)} · Usuario: ${esc(UNRCAuth.current.name)}</div>${warnings}<div class="report-body">${root.innerHTML}</div><footer class="report-footer">${esc($('.app-credit').textContent.trim())}</footer></article>`;
}
function setPrintDocument() {$('#printRoot').innerHTML=reportSnapshot||buildReport();$('#printPageStyle').textContent=`@page { size: A4 ${reportOrientation}; margin: 12mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #555; } }`;}
function openReportPreview() {
  reportSnapshot=buildReport();if(!reportSnapshot)return;reportOrientation=ui.view==='manual'?'portrait':'landscape';
  const dialog=$('#reportDialog');dialog.innerHTML=`<div class="report-preview-toolbar"><div><h3>Vista previa del reporte</h3><p>${esc(reportTitle)}</p></div><label class="field"><span>Hoja A4</span><select id="reportOrientation"><option value="landscape" ${reportOrientation==='landscape'?'selected':''}>Horizontal</option><option value="portrait" ${reportOrientation==='portrait'?'selected':''}>Vertical</option></select></label>${window.UNRCDesktop?`<button class="btn ghost" type="button" data-print-action="pdf">${icon('file-down')}Guardar PDF</button>`:''}<button class="btn primary" type="button" data-print-action="print">${icon('printer')}${window.UNRCDesktop?'Imprimir':'Imprimir / PDF'}</button><button class="tool" type="button" data-print-action="close" title="Cerrar vista previa" aria-label="Cerrar vista previa">${icon('x')}</button></div><div class="report-preview-sheet">${reportSnapshot}</div>`;
  dialog.showModal();refreshIcons();setPrintDocument();
}
document.addEventListener('change',e=>{if(e.target.id==='reportOrientation'){reportOrientation=e.target.value==='portrait'?'portrait':'landscape';setPrintDocument();}});
document.addEventListener('click',async e=>{
  const action=e.target.closest('[data-print-action]')?.dataset.printAction;
  if(!action||reportBusy)return;
  if(action==='close'){$('#reportDialog').close();return;}
  if(!['print','pdf'].includes(action))return;
  reportBusy=true;
  try {
    if(!await ensureAccess())return;
    setPrintDocument();
    if(!window.UNRCDesktop){window.print();return;}
    $('#reportDialog').querySelectorAll('button,select').forEach(el=>el.disabled=true);
    const result=await (action==='pdf'?UNRCDesktop.savePDF():UNRCDesktop.print());
    if(result.error)throw new Error(result.error);
    if(result.saved)toast('PDF guardado.');
  } catch(error){toast(error.message);}
  finally{reportBusy=false;$('#reportDialog').querySelectorAll('button,select').forEach(el=>el.disabled=false);if(window.UNRCDesktop)$('#printRoot').replaceChildren();}
});
$('#reportDialog').addEventListener('cancel',event=>{if(reportBusy)event.preventDefault();});
$('#reportDialog').addEventListener('close',()=>{reportSnapshot='';$('#printRoot').replaceChildren();$('#reportDialog').replaceChildren();});
window.addEventListener('beforeprint',()=>{if(!reportSnapshot)reportOrientation=ui.view==='manual'?'portrait':'landscape';setPrintDocument();});
window.addEventListener('afterprint',()=>$('#printRoot').replaceChildren());
