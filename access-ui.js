'use strict';
let userDirectory=[],accessBusy=false,recoveryData=null,recoveryNext=null;
const accessRole = role => ({
  admin: 'Administrador',
  responsable_agricultura: 'Responsable de Agricultura',
  responsable_ganaderia: 'Responsable de Ganadería General',
  responsable_cerdos: 'Responsable de Ganadería (Porcinos)',
  analista: 'Usuario Analista',
  operador: 'Operador / Analista Rural',
  auditor: 'Auditor'
}[role] || role || 'Usuario Analista');
function passwordField(id,label,autocomplete='new-password') {
  return `<div class="field"><label for="${id}">${label}</label><div class="password-control"><input id="${id}" name="${id}" type="password" required minlength="12" maxlength="128" autocomplete="${autocomplete}"><button type="button" class="tool" data-access-action="toggle-password" data-target="${id}" title="Mostrar contraseña" aria-label="Mostrar contraseña" aria-pressed="false">${icon('eye')}</button></div></div>`;
}
function accessError(form,error) {const el=form.querySelector('[role="alert"]');el.textContent=error.message||String(error);el.hidden=false;}
async function refreshSheetsStatus() {
  try {
    const res = await fetch('/api/sheets/status', {
      headers: UNRCAuth.token ? { 'Authorization': `Bearer ${UNRCAuth.token}` } : {}
    });
    if (res.ok) {
      window._unrcSheetsStatus = await res.json();
    }
  } catch (e) {
    console.warn('[Sheets] No se pudo obtener estado de Sheets:', e.message);
  }
}
async function refreshUsers() {
  userDirectory = UNRCAuth.current?.role === 'admin' ? await UNRCAuth.listUsers() : [];
  accessAudit = UNRCAuth.current ? await UNRCAuth.listAudit() : [];
  await refreshSheetsStatus();
}
function renderSession() {
  const u=UNRCAuth.current;$('#sessionBar').innerHTML=u?`<div><strong>${esc(u.name)}</strong><small>${accessRole(u.role)}</small></div><div class="session-actions"><button class="tool" type="button" data-access-action="switch" title="Cambiar usuario" aria-label="Cambiar usuario">${icon('users-round')}</button><button class="tool" type="button" data-access-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('log-out')}</button></div>`:'';
  if(typeof updateQuickActionsVisibility === 'function') updateQuickActionsVisibility();
}
async function showAccess(mode,choices=[]) {
  document.body.classList.add('auth-active');
  db=null;userDirectory=[];$('#appShell').hidden=true;$('#authRoot').hidden=false;$('#viewRoot').replaceChildren();$('#sessionBar').replaceChildren();
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  recoveryData=recoveryNext=null;ui.scenario={};$('#accessDialog').replaceChildren();$('#dialogFields').replaceChildren();$('#formError').textContent='';$('#formError').hidden=true;
  $('#printRoot').replaceChildren();$('#toast').classList.remove('show');
  clearAuditState();
  const exists=await UNRCAuth.hasUsers();
  if(!exists) mode='setup';
  else if(!['login','recover','setup'].includes(mode)) mode='login';

  const setup=mode==='setup',recover=mode==='recover',login=mode==='login';
  
  $('#authRoot').innerHTML=`<section class="access-panel">
    <header class="access-brand">
      <div class="access-brand-left">
        <img class="access-field-logo" src="./assets/logo-pozo-del-carril.svg" alt="Establecimiento Pozo del Carril">
        <div class="access-brand-copy">
          <div class="brand-title-row">
            <h1>Establecimiento Pozo del Carril</h1>
          </div>
          <span class="access-unrc-sub">Universidad Nacional de Río Cuarto · Facultad de Ciencias Económicas</span>
        </div>
      </div>
    </header>
    <div class="access-divider"></div>

    <form id="authForm" data-mode="${mode}" class="access-form">
      <h2>${setup?'Crear Administrador':recover?'Recuperar acceso':'Iniciar sesión'}</h2>
      <p class="muted">${setup?'Creá la cuenta administradora inicial para el establecimiento.':recover?'Ingresá tu clave de recuperación privada para restablecer el acceso.':'Ingresá tus credenciales autorizadas para acceder al ERP.'}</p>

      ${setup?`
      <div class="field">
        <label for="accessName">Nombre y apellido completo</label>
        <input id="accessName" name="name" required maxlength="80" autocomplete="name" placeholder="Ej: Médico Veterinario Juan Gómez">
      </div>`:''}

      <div class="field">
        <label for="accessUsername">Usuario</label>
        <input id="accessUsername" name="username" required minlength="3" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Tu nombre de usuario">
      </div>

      ${recover?'<div class="field"><label for="recoveryCode">Clave de recuperación</label><input id="recoveryCode" name="recoveryCode" required autocomplete="off" spellcheck="false" placeholder="Pegá tu clave de recuperación"></div>':''}
      
      ${passwordField('accessPassword',recover?'Contraseña nueva':'Contraseña',setup||recover?'new-password':'current-password')}
      ${setup||recover?passwordField('accessConfirm','Repetir contraseña','new-password'):''}
      
      <p class="access-error" role="alert" hidden></p>
      <button class="btn primary access-submit" type="submit">
        ${icon(setup?'user-plus':recover?'key-round':'log-in')}
        ${setup?'Crear administrador':recover?'Restablecer contraseña':'Iniciar sesión'}
      </button>

      ${login?`
      <div class="access-links">
          <p style="font-size:0.76rem; color:#64748b; margin:6px 0 0; text-align:center">Acceso institucional restringido. Nuevas cuentas se gestionan internamente en el sistema por el Administrador.</p>
          <button class="text-button" type="button" data-access-action="recover">¿Olvidaste tu contraseña? <strong>Recuperar clave</strong></button>
      </div>
      `:''}
      ${recover?`
      <div class="access-links">
          <button class="text-button" type="button" data-access-action="mode-login">← Volver al inicio de sesión</button>
      </div>
      `:''}
    </form>
    <footer class="access-institutional-footer">
      <span>Universidad Nacional de Río Cuarto · Establecimiento Pozo del Carril</span>
    </footer>
  </section>`;
  if(setup&&window.UNRCDesktop)$('#authForm .muted').textContent='Cuenta administradora de esta instalación.';
  if(mode==='login'&&choices.length)$('#accessUsername').closest('.field').insertAdjacentHTML('beforebegin',`<label class="field"><span>Elegir usuario previo</span><select id="switchUserSelect"><option value="">Seleccionar usuario</option>${choices.map(user=>`<option value="${esc(user.username)}">${esc(user.name+' ('+user.username+')')}</option>`).join('')}</select></label>`);
  refreshIcons();$('#authForm input')?.focus();
}
async function ensureAccess() {try{await UNRCAuth.requireSession();return true;}catch(e){await showAccess('login');toast(e.message);return false;}}
async function enterSystem() {
  await UNRCAuth.requireSession();db=await UNRCStorage.load();await refreshUsers();
  if (db && Array.isArray(db.rates) && db.rates.length) {
    const sorted = db.rates.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.recordedAt||'').localeCompare(a.recordedAt||''));
    const latest = sorted[0];
    if (latest && (latest.sellRate || latest.rate)) {
      ui.bnaRate = Number(latest.sellRate || latest.rate);
    }
  }
  ui.view='general';ui.tab={};ui.search='';ui.category='all';ui.scenario={};
  document.body.classList.remove('auth-active');
  $('#authRoot').replaceChildren();$('#authRoot').hidden=true;$('#appShell').hidden=false;
  const statusInfo = UNRCStorage.getStatus ? UNRCStorage.getStatus() : { serverSynced: true };
  if (statusInfo.serverSynced) {
    $('#storageStatus').textContent = 'Sincronizado con el servidor';
    const dot = document.querySelector('#syncWidget .sync-dot');
    if (dot) dot.style.background = '#10b981';
  } else {
    $('#storageStatus').textContent = 'Datos guardados localmente';
    const dot = document.querySelector('#syncWidget .sync-dot');
    if (dot) dot.style.background = '#087FBD';
  }
  renderSession();render();
  if (typeof UNRCHelpUI !== 'undefined') {
    UNRCHelpUI.checkAutoStartTour();
  }
}
function showRecovery(result,next) {
  recoveryData=result;recoveryNext=next;const dialog=$('#accessDialog');if(dialog.open)dialog.close();
  dialog.innerHTML=`<form id="recoveryNotice" class="access-form"><h3>Clave de recuperación</h3><p>Usuario: <strong>${esc(result.user.username)}</strong></p><p>Esta clave permite cambiar la contraseña si la olvidás. Guardala en un lugar privado. Se muestra una sola vez.</p><output class="recovery-code">${esc(result.recoveryCode)}</output>${button('Descargar clave','unused','','download','ghost').replace('data-action="unused"','data-access-action="download-recovery"')}<label class="check-label"><input name="acknowledged" type="checkbox" required>Ya guardé mi clave de recuperación</label><button type="submit" class="btn primary">Continuar</button></form>`;
  dialog.showModal();refreshIcons();
}
function openUserForm(mode,id) {
  const user=userDirectory.find(u=>u.id===id),dialog=$('#accessDialog');
  const create=mode==='create',self=mode==='change';
  dialog.innerHTML=`<form id="userForm" class="access-form" data-mode="${mode}" data-id="${esc(id||'')}"><div class="surface-title"><h3>${create?'Crear usuario':self?'Cambiar mi contraseña':'Restablecer contraseña'}</h3><button class="tool" type="button" data-access-action="close" title="Cerrar" aria-label="Cerrar">${icon('x')}</button></div>${create?'<div class="field"><label for="newName">Nombre y apellido</label><input id="newName" name="name" required maxlength="80" autocomplete="name"></div><div class="field"><label for="newUsername">Usuario</label><input id="newUsername" name="username" required minlength="3" maxlength="40" pattern="(?:[a-zA-Z0-9._]|-){3,40}" autocapitalize="none" autocomplete="off"></div><div class="field"><label for="newRole">Permiso / Rol</label><select id="newRole" name="role"><option value="admin">Administrador</option><option value="responsable_agricultura">Responsable de Agricultura</option><option value="responsable_ganaderia">Responsable de Ganadería General</option><option value="analista">Usuario Analista</option><option value="auditor">Auditor</option></select></div>':`<p>${esc(self?UNRCAuth.current.username:user?.username)}</p>`}${self?passwordField('currentPassword','Contraseña actual','current-password'):''}${passwordField('newPassword','Contraseña nueva')}<p class="field-hint">Entre 12 y 128 caracteres. Podés usar una frase.</p>${passwordField('newConfirm','Repetir contraseña')}<p class="access-error" role="alert" hidden></p><button type="submit" class="btn primary">${icon(create?'user-plus':'key-round')}${create?'Crear usuario':'Guardar contraseña'}</button></form>`;
  dialog.showModal();refreshIcons();dialog.querySelector('input')?.focus();
}
function renderUsers() {
  const u=UNRCAuth.current;
  const own=`<section class="panel"><div class="surface-title"><h4>Mi cuenta</h4><button type="button" class="btn ghost" data-access-action="change">${icon('key-round')}Cambiar mi contraseña</button></div>${summary('Nombre',u.name)}${summary('Usuario',u.username)}${summary('Permiso',accessRole(u.role))}</section>`;
  if(u.role!=='admin')return own;
  const create=`<button type="button" class="btn primary" data-access-action="create">${icon('user-plus')}Crear usuario</button>`;
  return table('Usuarios del establecimiento',['Nombre','Usuario','Permiso / Rol','Estado',''],userDirectory.map(person=>[
    esc(person.name),
    esc(person.username),
    person.id===u.id
      ? badge(accessRole(person.role),'neutral')+' <small class="muted">(Tu rol)</small>'
      : `<select class="user-role-select" data-access-action="change-role" data-id="${person.id}" style="padding:3px 6px; border-radius:4px; border:1px solid #cbd5e1; font-size:0.8rem; background:#f8fafc">
          <option value="admin" ${person.role === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="responsable_agricultura" ${person.role === 'responsable_agricultura' ? 'selected' : ''}>Responsable de Agricultura</option>
          <option value="responsable_ganaderia" ${person.role === 'responsable_ganaderia' ? 'selected' : ''}>Responsable de Ganadería General</option>
          <option value="analista" ${person.role === 'analista' ? 'selected' : ''}>Usuario Analista</option>
          <option value="auditor" ${person.role === 'auditor' ? 'selected' : ''}>Auditor</option>
        </select>`,
    badge(person.active?'Activo':'Inactivo',person.active?'':'neutral'),
    person.id===u.id?badge('Tu cuenta','neutral'):`<div class="record-tools"><button class="tool" data-access-action="reset" data-id="${person.id}" title="Restablecer contraseña" aria-label="Restablecer contraseña">${icon('key-round')}</button><button class="tool" data-access-action="active" data-id="${person.id}" data-active="${!person.active}" title="${person.active?'Desactivar':'Activar'} usuario" aria-label="${person.active?'Desactivar':'Activar'} usuario">${icon(person.active?'user-round-x':'user-round-check')}</button></div>`
  ]),null,null,create)+own;
}
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-access-action]');if(!el||accessBusy)return;const action=el.dataset.accessAction;
  if(action==='toggle-password'){const input=document.getElementById(el.dataset.target),show=input.type==='password';input.type=show?'text':'password';el.setAttribute('aria-pressed',String(show));el.title=el.ariaLabel=show?'Ocultar contraseña':'Mostrar contraseña';return;}
  try {accessBusy=true;
    if(action==='logout'){if(busy)return;try{await UNRCAuth.logout();}finally{await showAccess('login');}}
    if(action==='switch'){if(busy)return;const choices=await UNRCAuth.switchableUsers();try{await UNRCAuth.logout();}finally{await showAccess('login',choices);}}
    if(action==='quick-login'){
      $('#accessUsername').value=el.dataset.user;
      $('#accessPassword').value=el.dataset.pass;
      $('#authForm').requestSubmit();
      return;
    }
    if(action==='mode-login'||action==='login')await showAccess('login');
    if(action==='mode-register'||action==='register')await showAccess('register');
    if(action==='recover')await showAccess('recover');
    if(action==='close')$('#accessDialog').close();
    if(action==='create'||action==='reset'){await UNRCAuth.requireSession(true);openUserForm(action,el.dataset.id);}
    if(action==='change'){await UNRCAuth.requireSession();openUserForm(action);}
    if(action==='active'){await UNRCAuth.requireSession(true);const active=el.dataset.active==='true';if(confirm(active?'¿Activar este usuario?':'¿Desactivar este usuario? Sus registros se conservarán.')){await UNRCAuth.setActive(el.dataset.id,active);await refreshUsers();render();}}
    if(action==='download-recovery'&&recoveryData)download('UNRC-clave-'+recoveryData.user.username+'.txt','Acceso local UNRC\r\nUsuario: '+recoveryData.user.username+'\r\nClave de recuperación: '+recoveryData.recoveryCode+'\r\nConservar en un lugar privado. Reemplaza cualquier clave de recuperación anterior.','text/plain;charset=utf-8');
  }catch(error){toast(error.message);}finally{accessBusy=false;}
});
document.addEventListener('change',async event=>{
  if(event.target.id==='switchUserSelect'){$('#accessUsername').value=event.target.value;$('#accessPassword').value='';$('#accessPassword').focus();return;}
  const roleEl = event.target.closest('[data-access-action="change-role"]');
  if(roleEl && !accessBusy){
    const userId = roleEl.dataset.id;
    const newRole = roleEl.value;
    try {
      accessBusy = true;
      await UNRCAuth.updateRole(userId, newRole);
      toast(`Rol de usuario actualizado a "${accessRole(newRole)}" correctamente.`, 'info');
      await refreshUsers();
      render();
    } catch(err) {
      toast(err.message, 'error');
      await refreshUsers();
      render();
    } finally {
      accessBusy = false;
    }
  }
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!['authForm','userForm','recoveryNotice'].includes(form.id))return;e.preventDefault();if(accessBusy)return;
  if(form.id==='recoveryNotice'){if(!recoveryNext||!form.reportValidity())return;accessBusy=true;const next=recoveryNext;recoveryData=recoveryNext=null;$('#accessDialog').close();$('#accessDialog').replaceChildren();try{await next();}catch(error){await showAccess('login');toast(error.message);}finally{accessBusy=false;}return;}
  accessBusy=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try {
    const data=Object.fromEntries(new FormData(form));let result;
    if(form.id==='authForm') {
      const mode=form.dataset.mode;
      if(['setup','register','recover'].includes(mode)&&data.accessPassword!==data.accessConfirm)throw new Error('Las contraseñas no coinciden.');
      if(mode==='setup')result=await UNRCAuth.createUser({username:data.username,name:data.name,password:data.accessPassword});
      else if(mode==='recover')result=await UNRCAuth.recover(data.username,data.recoveryCode,data.accessPassword);
      else if(mode==='register') {
        result=await UNRCAuth.register({username:data.username,name:data.name,password:data.accessPassword,role:data.role});
      } else {
        await UNRCAuth.login(data.username,data.accessPassword);
      }
      form.reset();
      if(result&&result.recoveryCode)showRecovery(result,enterSystem);else await enterSystem();
    } else {
      if(!await ensureAccess())return;
      if(data.newPassword!==data.newConfirm)throw new Error('Las contraseñas no coinciden.');
      if(form.dataset.mode==='create')result=await UNRCAuth.createUser({username:data.username,name:data.name,role:data.role,password:data.newPassword});
      if(form.dataset.mode==='reset')result=await UNRCAuth.resetPassword(form.dataset.id,data.newPassword);
      if(form.dataset.mode==='change'){const username=UNRCAuth.current.username;result=await UNRCAuth.changePassword(data.currentPassword,data.newPassword);await UNRCAuth.login(username,data.newPassword);}
      const created=form.dataset.mode==='create';
      form.reset();showRecovery(result,async()=>{await refreshUsers();if(created){ui.view='administracion';}renderSession();render();if(created)toast('Usuario creado exitosamente.');});
    }
  }catch(error){accessError(form,error);}finally{accessBusy=false;submit.disabled=false;}
});
$('#accessDialog').addEventListener('cancel',e=>{if(recoveryData)e.preventDefault();});
async function checkSession() {if($('#appShell').hidden||accessBusy||busy)return;try{if(!await UNRCAuth.restore())await showAccess('login');else{await refreshUsers();renderSession();refreshIcons();}}catch{await showAccess('login');}}
window.addEventListener('unrc-auth-changed',checkSession);
window.addEventListener('focus',checkSession);
setInterval(checkSession,30000);
(async()=>{try{if(await UNRCAuth.restore())await enterSystem();else await showAccess();}catch(error){$('#authRoot').innerHTML=notice(error.message,'error');refreshIcons();}})();
