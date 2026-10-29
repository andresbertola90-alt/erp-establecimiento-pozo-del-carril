'use strict';

let incomingTransfer = null;
let incomingBackup = null;
let transferBusy = false;
let cachedSafetySnapshots = [];

async function fetchSafetySnapshots() {
  try {
    const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
    if (!token) return [];
    const res = await fetch('/api/backup/safety-snapshots', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      cachedSafetySnapshots = data.snapshots || [];
      return cachedSafetySnapshots;
    }
  } catch (e) {
    console.warn('[Backup] No se pudieron cargar los snapshots de seguridad:', e.message);
  }
  return cachedSafetySnapshots;
}

function renderBackupAndRecovery() {
  const u = UNRCAuth.current;
  const isAdmin = u?.role === 'admin';
  const status = typeof UNRCStorage !== 'undefined' && UNRCStorage.getStatus ? UNRCStorage.getStatus() : { serverSynced: true, source: 'server' };

  // Count active records
  const agriCount = (db.campaigns || []).filter(r => !r.voided).length + (db.transfers || []).filter(r => !r.voided).length;
  const livestockCount = (db.lots || []).filter(r => !r.voided).length + (db.movements || []).filter(r => !r.voided).length + (db.births || []).filter(r => !r.voided).length;
  const commercialCount = (db.sales || []).filter(r => !r.voided).length + (db.costs || []).filter(r => !r.voided).length;
  const stockCount = (db.stock || []).filter(r => !r.voided).length;
  const accountingCount = (db.accounts || []).filter(r => !r.voided).length + (db.entries || []).filter(r => !r.voided).length;
  const auditCount = (db.auditLog || []).length;
  const totalCount = agriCount + livestockCount + commercialCount + stockCount + accountingCount;

  return `
    <div class="backup-recovery-container">
      <!-- Section 1: Estado y Diagnóstico de Almacenamiento -->
      <section class="panel" style="margin-bottom:20px; border-left:4px solid #14263D">
        <div class="surface-title">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="color:#14263D; font-size:1.4rem">${icon('database')}</span>
            <div>
              <h4 style="margin:0 0 2px 0; color:#14263D">Persistencia y Estado de la Base de Datos</h4>
              <p class="muted" style="margin:0; font-size:0.83rem">Trazabilidad operativa, atómica y respaldada en servidor local</p>
            </div>
          </div>
          <span class="badge ${status.serverSynced ? 'positive' : 'neutral'}" style="${status.serverSynced ? 'background:#ecfdf5;color:#047857' : 'background:#f1f5f9;color:#475569'}; font-weight:700">
            ${status.serverSynced ? '🟢 Sincronizado con el servidor' : '🔵 Almacenado localmente (IndexedDB)'}
          </span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-top:14px">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <span style="font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase">Versión y Revisión</span>
            <div style="font-size:1.15rem; font-weight:800; color:#14263D; margin-top:4px">Revisión N.º ${db.revision || 1}</div>
            <small style="color:#64748b; font-size:0.78rem">Esquema v4 (Workflow Normalizado)</small>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <span style="font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase">Última Modificación</span>
            <div style="font-size:0.95rem; font-weight:700; color:#14263D; margin-top:4px">${date(db.lastSavedAt || today())}</div>
            <small style="color:#087FBD; font-size:0.78rem">Por usuario: ${esc(db.lastSavedBy || 'admin')}</small>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <span style="font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase">Volumen de Registros</span>
            <div style="font-size:1.15rem; font-weight:800; color:#23845B; margin-top:4px">${number(totalCount, 0)} operaciones</div>
            <small style="color:#64748b; font-size:0.78rem">5 Unidades de Negocio integradas</small>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <span style="font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase">Integridad & Auditoría</span>
            <div style="font-size:0.95rem; font-weight:700; color:#059669; margin-top:4px">${number(auditCount, 0)} eventos</div>
            <small style="color:#64748b; font-size:0.78rem">Trazabilidad inmutable 3FN</small>
          </div>
        </div>
      </section>

      <!-- Section 2: Exportar Respaldo -->
      <section class="panel" style="margin-bottom:20px; border-left:4px solid #087FBD">
        <div class="surface-title">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="color:#087FBD; font-size:1.4rem">${icon('download')}</span>
            <div>
              <h4 style="margin:0 0 2px 0; color:#14263D">Exportar Copia de Respaldo Completa</h4>
              <p class="muted" style="margin:0; font-size:0.83rem">Descargá un archivo estructurado con todos los datos del establecimiento para resguardo externo</p>
            </div>
          </div>
        </div>

        <p style="font-size:0.88rem; color:#475569; line-height:1.55; margin:10px 0 16px 0">
          La exportación genera un archivo <strong>JSON estructurado y autosuficiente</strong> con la totalidad de los comprobantes agrícolas (campañas, siembras, cosechas), ganaderos (porcinos, bovinos, ovinos, pesajes, sanidad), comerciales (ventas, compras, existencias), plan contable bimonetario, asientos y el historial inmutable de auditoría.
        </p>

        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px">
          <button type="button" class="btn primary" data-backup-action="export-json" style="background:#087FBD; border-color:#087FBD">
            ${icon('file-text')} Descargar Respaldo Estructurado (.json)
          </button>
          <button type="button" class="btn ghost" data-backup-action="export-unrc" style="color:#14263D">
            ${icon('archive')} Descargar Respaldo UNRC (.unrc)
          </button>
          <button type="button" class="btn ghost" data-backup-action="export-xlsx" style="color:#047857">
            ${icon('file-spreadsheet')} Exportar Planilla Excel (.xlsx)
          </button>
        </div>
      </section>

      <!-- Section 3: Restaurar Respaldo -->
      <section class="panel" style="margin-bottom:20px; border-left:4px solid #C39235">
        <div class="surface-title">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="color:#C39235; font-size:1.4rem">${icon('upload')}</span>
            <div>
              <h4 style="margin:0 0 2px 0; color:#14263D">Restaurar Copia de Respaldo</h4>
              <p class="muted" style="margin:0; font-size:0.83rem">Recuperá el sistema a partir de un archivo JSON o UNRC verificado previamente</p>
            </div>
          </div>
        </div>

        ${!isAdmin ? `
          <div class="notice" style="background:#fefce8; border-color:#fef08a; color:#854d0e; padding:12px 16px">
            ${icon('shield-alert')} <span>La restauración de copias de seguridad reemplaza la base de datos activa y requiere permisos de <strong>Administrador</strong>.</span>
          </div>
        ` : `
          <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:16px; margin-bottom:16px">
            <div style="display:flex; align-items:flex-start; gap:10px">
              <span style="color:#d97706; font-size:1.3rem">${icon('alert-triangle')}</span>
              <div style="font-size:0.86rem; color:#92400e; line-height:1.5">
                <strong>Protocolo de Seguridad ante Restauración:</strong>
                <ul style="margin:6px 0 0 0; padding-left:18px">
                  <li>El sistema validará la integridad estructural y compatibilidad del archivo antes de aplicarlo.</li>
                  <li><strong>Respaldo de seguridad automático:</strong> Se generará automáticamente una instantánea del estado actual en el servidor antes de sobrescribir cualquier dato.</li>
                  <li>En caso de error o archivo corrupto, la restauración se cancela de forma atómica sin pérdidas de información.</li>
                </ul>
              </div>
            </div>
          </div>

          <input type="file" id="backupRestoreInput" accept=".json,.unrc" style="display:none">
          <div style="display:flex; gap:12px; align-items:center">
            <button type="button" class="btn primary" data-backup-action="trigger-file-select" style="background:#C39235; border-color:#C39235">
              ${icon('folder-open')} Seleccionar archivo de respaldo (.json o .unrc)
            </button>
            <span style="font-size:0.83rem; color:#64748b" id="selectedBackupFilename">Ningún archivo seleccionado</span>
          </div>
        `}
      </section>

      <!-- Section 4: Respaldos de Seguridad Automáticos (Rollback Safety) -->
      ${isAdmin ? `
        <section class="surface">
          <div class="surface-title">
            <div style="display:flex; align-items:center; gap:10px">
              <span style="color:#14263D; font-size:1.3rem">${icon('history')}</span>
              <div>
                <h4 style="margin:0 0 2px 0; color:#14263D">Instantáneas de Seguridad Automáticas (Rollback)</h4>
                <p class="muted" style="margin:0; font-size:0.83rem">Copias de resguardo generadas de forma automática previo a restauraciones o cambios críticos</p>
              </div>
            </div>
            <button type="button" class="btn ghost btn-sm" data-backup-action="refresh-snapshots">
              ${icon('refresh-cw')} Actualizar lista
            </button>
          </div>

          <div id="safetySnapshotsListContainer">
            ${renderSafetySnapshotsTable(cachedSafetySnapshots)}
          </div>
        </section>
      ` : ''}
    </div>
  `;
}

function renderSafetySnapshotsTable(snapshots) {
  if (!snapshots || !snapshots.length) {
    return `<div class="empty" style="padding:24px">${icon('shield-check')}<span>No hay instantáneas de seguridad automáticas registradas aún. Se generará una instantánea antes de cada restauración de datos.</span></div>`;
  }

  return `
    <div class="table-panel">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Archivo de Seguridad</th>
              <th>Tamaño</th>
              <th>Acción de Recuperación</th>
            </tr>
          </thead>
          <tbody>
            ${snapshots.map(s => `
              <tr>
                <td><strong>${date(s.createdAt)}</strong> <small style="color:#64748b">(${new Date(s.createdAt).toLocaleTimeString()})</small></td>
                <td><code style="font-size:0.82rem; background:#f1f5f9; padding:2px 6px; border-radius:4px">${esc(s.filename)}</code></td>
                <td>${number(s.size / 1024, 1)} KB</td>
                <td>
                  <button type="button" class="btn ghost btn-sm" data-backup-action="rollback" data-file="${esc(s.filename)}" style="color:#b91c1c; border-color:#fca5a5">
                    ${icon('rotate-ccw')} Revertir a este estado
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTransfer() {
  if (UNRCAuth.current?.role !== 'admin') return notice('El traslado de registros lo realiza un administrador.', 'info');
  const empty = UNRCTransfer.isEmpty(db);
  return `<section class="surface"><div class="surface-title"><h4>Copiar registros a otra instalación</h4><button type="button" class="btn ghost" data-transfer-action="export">${icon('download')}Crear archivo de traslado</button></div></section><section class="surface"><div class="surface-title"><h4>Recibir registros</h4></div>${empty?'<label class="field"><span>Archivo del establecimiento (.unrc)</span><input type="file" id="transferInput" accept=".unrc"></label>':notice('Esta instalación ya tiene registros o criterios modificados. No se permite reemplazarlos ni mezclar bases.','info')}</section>`;
}

// Global click handler for backup actions
document.addEventListener('click', async event => {
  const btn = event.target.closest('[data-backup-action]');
  if (!btn || transferBusy) return;
  const action = btn.dataset.backupAction;

  if (action === 'trigger-file-select') {
    $('#backupRestoreInput')?.click();
    return;
  }

  if (action === 'refresh-snapshots') {
    transferBusy = true;
    try {
      const list = await fetchSafetySnapshots();
      const el = $('#safetySnapshotsListContainer');
      if (el) el.innerHTML = renderSafetySnapshotsTable(list);
      refreshIcons();
      toast('Lista de instantáneas de seguridad actualizada.');
    } finally {
      transferBusy = false;
    }
    return;
  }

  if (action === 'export-json') {
    transferBusy = true;
    try {
      await UNRCAuth.requireSession(true);
      const data = await UNRCStorage.load();
      const backupData = {
        app: 'Establecimiento Pozo del Carril - UNRC',
        exportVersion: 4,
        exportedAt: new Date().toISOString(),
        exportedBy: UNRCAuth.current?.username || 'admin',
        revision: db.revision || 1,
        database: data
      };
      const jsonContent = JSON.stringify(backupData, null, 2);
      const filename = `respaldo-pozo-del-carril-rev${db.revision || 1}-${today()}.json`;
      download(filename, jsonContent, 'application/json');
      toast('Respaldo JSON generado y descargado exitosamente.');
    } catch (err) {
      toast('Error al exportar respaldo: ' + err.message);
    } finally {
      transferBusy = false;
    }
    return;
  }

  if (action === 'export-unrc') {
    transferBusy = true;
    try {
      await UNRCAuth.requireSession(true);
      const data = await UNRCStorage.load();
      const encoded = await UNRCTransfer.encode(data);
      const filename = `respaldo-pozo-del-carril-rev${db.revision || 1}-${today()}.unrc`;
      download(filename, encoded, 'application/json');
      toast('Respaldo UNRC generado exitosamente.');
    } catch (err) {
      toast('Error al exportar archivo UNRC: ' + err.message);
    } finally {
      transferBusy = false;
    }
    return;
  }

  if (action === 'export-xlsx') {
    try {
      const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
      if (token) {
        window.open('/api/sheets/export-xlsx', '_blank');
      } else {
        toast('Iniciá sesión para exportar el libro Excel.');
      }
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (action === 'rollback') {
    const filename = btn.dataset.file;
    if (!filename) return;

    const ok = await confirmAction({
      title: '¿Revertir al respaldo de seguridad?',
      message: `Se restaurará la base de datos completa desde el archivo "${filename}". Todos los cambios posteriores a dicha fecha serán reemplazados por el estado guardado.`,
      confirmLabel: 'Revertir base de datos',
      danger: true
    });
    if (!ok) return;

    transferBusy = true;
    try {
      const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
      const res = await fetch('/api/backup/rollback-safety', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ filename })
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || `Error ${res.status}`);

      db = await UNRCStorage.load();
      await fetchSafetySnapshots();
      render();
      toast('Base de datos revertida con éxito al respaldo de seguridad.');
    } catch (err) {
      toast('Error al revertir respaldo: ' + err.message);
    } finally {
      transferBusy = false;
    }
    return;
  }

  if (action === 'close-restore-modal') {
    $('#backupRestoreDialog')?.close();
    $('#backupRestoreDialog')?.replaceChildren();
    incomingBackup = null;
    return;
  }
});

// File input change handler for restoration
document.addEventListener('change', async event => {
  if (event.target.id !== 'backupRestoreInput' || transferBusy) return;
  const file = event.target.files[0];
  if (!file) return;

  transferBusy = true;
  try {
    await UNRCAuth.requireSession(true);
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('El archivo seleccionado no tiene un formato JSON válido.');
    }

    const targetDb = parsed.database || parsed;
    UNRCTransfer.inspect(targetDb);

    // Compute preview metadata
    const rev = targetDb.revision || parsed.revision || '?';
    const exportedAt = parsed.exportedAt || targetDb.lastSavedAt || 'Fecha no informada';
    const exportedBy = parsed.exportedBy || targetDb.lastSavedBy || 'Desconocido';
    const lotsCount = (targetDb.lots || []).filter(r => !r.voided).length;
    const campaignsCount = (targetDb.campaigns || []).filter(r => !r.voided).length;
    const salesCount = (targetDb.sales || []).filter(r => !r.voided).length;
    const costsCount = (targetDb.costs || []).filter(r => !r.voided).length;

    incomingBackup = {
      filename: file.name,
      size: file.size,
      rawContent: text,
      targetDb
    };

    const dialog = $('#backupRestoreDialog');
    if (!dialog) throw new Error('No se encontró el diálogo modal de restauración.');

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:620px; padding:24px; border-radius:10px; background:#fff; border:1px solid #e2e8f0; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px">
          <div style="display:flex; align-items:center; gap:10px">
            <div style="width:38px; height:38px; border-radius:50%; background:#fef3c7; display:flex; align-items:center; justify-content:center">
              <i data-lucide="shield-alert" style="color:#d97706"></i>
            </div>
            <div>
              <h4 style="margin:0; font-size:1.15rem; color:#14263D">Verificación Previa de Respaldo</h4>
              <small style="color:#64748b">Inspección de compatibilidad antes de aplicar cambios</small>
            </div>
          </div>
          <button type="button" class="tool" data-backup-action="close-restore-modal" title="Cancelar">${icon('x')}</button>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px">
            <span style="font-size:0.84rem; color:#64748b">Archivo:</span>
            <strong style="font-size:0.84rem; color:#14263D">${esc(file.name)} (${number(file.size / 1024, 1)} KB)</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px">
            <span style="font-size:0.84rem; color:#64748b">Revisión contenida:</span>
            <strong style="font-size:0.84rem; color:#14263D">N.º ${esc(rev)} · Autor: ${esc(exportedBy)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px">
            <span style="font-size:0.84rem; color:#64748b">Fecha de emisión:</span>
            <span style="font-size:0.84rem; color:#334155">${esc(exportedAt)}</span>
          </div>
          <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e1; font-size:0.82rem; color:#475569">
            <strong>Contenido detectado:</strong> ${lotsCount} lotes ganaderos · ${campaignsCount} campañas agrícolas · ${salesCount} ventas · ${costsCount} comprobantes de costos.
          </div>
        </div>

        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; margin-bottom:16px">
          <div style="display:flex; gap:10px">
            <span style="color:#b91c1c; font-size:1.2rem">${icon('alert-octagon')}</span>
            <div style="font-size:0.82rem; color:#991b1b; line-height:1.5">
              <strong>Advertencia de reemplazo:</strong> Esta operación actualizará el estado activo del ERP. Se generará una instantánea de seguridad previa de forma automática para permitir revertir la base de datos si fuera necesario.
            </div>
          </div>
        </div>

        <form id="backupRestoreForm">
          <label class="check-label" style="display:flex; align-items:center; gap:8px; margin-bottom:20px; font-size:0.86rem; color:#1e293b; cursor:pointer">
            <input type="checkbox" id="confirmBackupRestoreCheckbox" required>
            <span>Confirmo que he verificado este archivo y deseo restaurar sus datos en el sistema.</span>
          </label>
          <div style="display:flex; justify-content:flex-end; gap:10px">
            <button type="button" class="btn ghost" data-backup-action="close-restore-modal">Cancelar</button>
            <button type="submit" class="btn primary" id="btnConfirmBackupRestore" style="background:#b91c1c; border-color:#b91c1c">
              ${icon('upload')} Restaurar Base de Datos Ahora
            </button>
          </div>
        </form>
      </div>
    `;

    dialog.showModal();
    refreshIcons();
  } catch (err) {
    toast('Error al validar archivo de respaldo: ' + err.message);
  } finally {
    transferBusy = false;
    event.target.value = '';
  }
});

// Restore form submit handler
document.addEventListener('submit', async event => {
  if (event.target.id !== 'backupRestoreForm') return;
  event.preventDefault();
  if (transferBusy || !incomingBackup) return;

  const btn = event.target.querySelector('#btnConfirmBackupRestore');
  if (btn) btn.disabled = true;
  transferBusy = true;

  try {
    const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ content: incomingBackup.rawContent })
    });

    const result = await res.json().catch(() => null);
    if (!res.ok) throw new Error(result?.error || `Error ${res.status}`);

    db = await UNRCStorage.load();
    await fetchSafetySnapshots();
    $('#backupRestoreDialog')?.close();
    $('#backupRestoreDialog')?.replaceChildren();
    incomingBackup = null;

    render();
    toast(`Respaldo restaurado exitosamente. Se guardó copia previa: ${result.safetySnapshot || 'safety-pre-restore'}`);
  } catch (err) {
    toast('No se pudo restaurar el respaldo: ' + err.message);
  } finally {
    transferBusy = false;
    if (btn) btn.disabled = false;
  }
});

// Transfer to empty installation listeners (existing feature preservation)
document.addEventListener('click', async event => {
  const action = event.target.closest('[data-transfer-action]')?.dataset.transferAction;
  if (!action || transferBusy) return;
  if (action === 'close') { $('#transferDialog').close(); return; }
  if (action !== 'export') return;
  transferBusy = true;
  try {
    await UNRCAuth.requireSession(true);
    const data = await UNRCStorage.load();
    download('Pozo-del-Carril-' + today() + '.unrc', await UNRCTransfer.encode(data), 'application/json');
    toast('Archivo preparado. Conservá la copia en un lugar privado.');
  } catch (error) { toast(error.message); }
  finally { transferBusy = false; }
});

document.addEventListener('change', async event => {
  if (event.target.id !== 'transferInput' || transferBusy) return;
  const file = event.target.files[0]; if (!file) return;
  transferBusy = true;
  try {
    await UNRCAuth.requireSession(true);
    if (file.size > UNRCTransfer.MAX_BYTES * 2) throw new Error('El archivo supera el limite permitido.');
    const imported = await UNRCTransfer.decode(await file.text());
    const current = await UNRCStorage.load();
    if (!UNRCTransfer.isEmpty(current)) throw new Error('La instalación de destino ya tiene datos. No se reemplazó nada.');
    incomingTransfer = { ...imported, revision: current.revision };
    const count = D.TABLES.filter(t => t !== 'accounts').reduce((n, t) => n + imported.data[t].length, 0);
    $('#transferDialog').innerHTML = `<form id="transferConfirm" class="access-form"><div class="surface-title"><h3>Recibir registros</h3><button type="button" class="tool" data-transfer-action="close" title="Cancelar" aria-label="Cancelar">${icon('x')}</button></div><p>${esc(file.name)}</p>${summary('Registros', number(count))}${summary('Fecha de la copia', imported.createdAt)}<p>Se conservarán los registros, los archivos de origen y el historial. Los usuarios y contraseñas no se trasladan.</p><label class="check-label"><input type="checkbox" required>Confirmo que quiero cargar esta copia en la instalación vacía</label><p class="access-error" role="alert" hidden></p><button type="submit" class="btn primary">${icon('upload')}Importar registros</button></form>`;
    $('#transferDialog').showModal(); refreshIcons();
  } catch (error) { incomingTransfer = null; toast(error.message); }
  finally { transferBusy = false; event.target.value = ''; }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'transferConfirm') return;
  event.preventDefault();
  if (transferBusy || !incomingTransfer) return;
  transferBusy = true;
  const button = event.target.querySelector('[type="submit"]'); button.disabled = true;
  try {
    db = await UNRCStorage.importNew(incomingTransfer.data, incomingTransfer.revision);
    $('#transferDialog').close(); render(); toast('Registros importados. Se conservaron los registros, los archivos de origen y el historial.');
  } catch (error) { accessError(event.target, error); }
  finally { transferBusy = false; button.disabled = false; }
});

$('#transferDialog')?.addEventListener('close', () => { incomingTransfer = null; $('#transferDialog')?.replaceChildren(); });

// Preload safety snapshots if authenticated
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (typeof UNRCAuth !== 'undefined' && UNRCAuth.current?.role === 'admin') {
      fetchSafetySnapshots();
    }
  }, 1000);
}
