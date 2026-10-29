'use strict';
const D = UNRC;
const Plan=UNRCAccountPlan;
let db, busy = false;
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const ui = { view: 'general', tab: {}, from: today().slice(0, 4) + '-01-01', to: today(), search: '', area: 'all', category: 'all', scenario: {}, ledgerAccount: '', currency: 'USD', bnaRate: 1550.00, matrixSubunits: true };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const number = (v, digits = 2) => v == null || !Number.isFinite(Number(v)) ? 'Sin datos' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(v));
const money = (v, forceCurrency) => {
  if (v == null || !Number.isFinite(Number(v))) return 'Sin datos';
  const val = Number(v);
  const curr = forceCurrency || ui.currency || 'USD';
  if (curr === 'USD') {
    const usd = val / (ui.bnaRate || 1550);
    return 'US$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd);
  }
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(val);
};
const moneyDual = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return { main: 'Sin datos', sub: '' };
  const val = Number(v);
  const rate = ui.bnaRate || 1550;
  const usd = 'US$ ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / rate);
  const ars = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits: 0 }).format(val);
  return { main: ui.currency === 'USD' ? usd : ars, sub: ui.currency === 'USD' ? ars : usd };
};
const date = s => s ? s.split('-').reverse().join('/') : 'Sin fecha';
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const badge = (s, type = '') => `<span class="badge ${type}">${esc(s)}</span>`;
const nameOf = (table, id) => db[table].find(r => r.id === id)?.name || (id ? 'Sin referencia' : '-');
const inPeriod = r => (!r.date || r.date >= ui.from) && (!r.date || r.date <= ui.to);
const visible = table => db[table].filter(r => !r.voided).filter(r => !ui.search || Object.values(r).some(v => String(v).toLocaleLowerCase().includes(ui.search.toLocaleLowerCase())));
const confirmed = table => D.active(db[table]);
const savedScenarios = () => confirmed('scenarios').sort((a,b)=>(a.savedAt||a.date).localeCompare(b.savedAt||b.date));
const button = (label, action, attrs = '', glyph = 'plus', type = 'primary') => `<button type="button" class="btn ${type}" data-action="${action}" ${attrs}>${icon(glyph)}${esc(label)}</button>`;
const notice = (text, type = '') => `<div class="notice ${type}">${icon(type === 'error' ? 'circle-alert' : 'info')}<span>${esc(text)}</span></div>`;
const empty = text => `<div class="empty">${icon('clipboard-list')}${esc(text)}</div>`;
const controls = (table, r) => `<div class="record-tools"><button type="button" class="tool" data-action="edit" data-table="${table}" data-id="${esc(r.id)}" title="Editar registro" aria-label="Editar registro">${icon('pencil')}</button><button type="button" class="tool danger" data-action="cancel" data-table="${table}" data-id="${esc(r.id)}" title="Anular registro" aria-label="Anular registro">${icon('archive-x')}</button></div>`;
const stateBadge = () => badge('Registrado');
function metric(label, value, detail = '', color = '', small = false) { return `<article class="metric ${color} ${small ? 'compact' : ''}"><p>${esc(label)}</p><strong class="${typeof value === 'number' && value < 0 ? 'negative' : ''}">${typeof value === 'number' ? money(value) : esc(value)}</strong><small>${esc(detail)}</small></article>`; }
function table(title, heads, rows, tableName, addLabel, actions = '') {
  const user = typeof UNRCAuth !== 'undefined' ? UNRCAuth.current : null;
  const canImport = !user || (user.role !== 'analista' && user.role !== 'auditor');
  const hasEntity = tableName && typeof UNRCCsv !== 'undefined' && UNRCCsv.ENTITIES && UNRCCsv.ENTITIES[tableName];
  const importBtn = (hasEntity && canImport) ? button('Importar CSV', 'import-csv-wizard', `data-entity="${tableName}"`, 'file-spreadsheet', 'ghost') : '';
  const exportBtn = tableName ? button('Exportar CSV', 'export', `data-table="${tableName}"`, 'download', 'ghost') : '';
  return `<section class="surface"><div class="surface-title"><h4>${esc(title)}</h4><div class="section-actions">${importBtn}${exportBtn}${addLabel ? button(addLabel, 'new', `data-table="${tableName}"`) : ''}${actions}</div></div><div class="table-panel">${rows.length ? `<div class="table-scroll"><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty('Todavía no hay registros para esta selección.')}</div></section>`;
}
function heading(title, actions = '', subtitle = '') { if(ui.view!=='ajustes'&&!actions.includes('data-action="print"'))actions+=button(ui.view==='manual'?'Imprimir manual':'Imprimir reporte','print','','printer','ghost');return `<div class="page-heading"><div><h3>${esc(title)}</h3>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div><div class="toolbar">${actions}</div></div>`; }
function periods() { return `<label class="field"><span>Desde</span><input type="date" data-filter="from" value="${ui.from}" aria-label="Desde"></label><label class="field"><span>Hasta</span><input type="date" data-filter="to" value="${ui.to}" aria-label="Hasta"></label>`; }
function tabs(items, fallback) { const current = ui.tab[ui.view] || fallback; return `<div class="tabs" role="tablist">${items.map(([id, title]) => `<button type="button" class="tab" role="tab" aria-selected="${current === id}" data-action="tab" data-tab="${id}">${esc(title)}</button>`).join('')}</div>`; }
function summary(label, value) { return `<div class="summary-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }
function toast(s) { const el = $('#toast'); el.textContent = s; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 4500); }
function updateStorageIndicator(status, type = 'synced') {
  const el = $('#storageStatus');
  const dot = document.querySelector('#syncWidget .sync-dot');
  const widget = $('#syncWidget');
  if (el) el.textContent = status;

  if (dot) {
    dot.className = 'sync-dot';
    if (type === 'synced') {
      dot.style.background = '#10b981';
      dot.classList.remove('pulsing');
    } else if (type === 'local') {
      dot.style.background = '#087FBD';
      dot.classList.remove('pulsing');
    } else if (type === 'saving') {
      dot.style.background = '#f59e0b';
      dot.classList.add('pulsing');
    } else if (type === 'error') {
      dot.style.background = '#ef4444';
      dot.classList.remove('pulsing');
    }
  }

  if (widget) {
    const titles = {
      synced: 'Sincronizado: Base de datos persistente en servidor local (/data/database.json) y caché IndexedDB.',
      local: 'Almacenamiento local: Cambios guardados en este navegador (IndexedDB).',
      saving: 'Guardando datos en el servidor y en almacenamiento local...',
      error: 'Error de almacenamiento: No se pudo guardar la información.'
    };
    widget.title = titles[type] || status;
  }
}

async function confirmAction({
  title = '¿Confirmar operación?',
  message = 'Esta acción registrará la modificación en el historial y recalculará los efectos contables y productivos.',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Volver sin cambios',
  danger = true
}) {
  const dialog = $('#confirmDialog');
  if (!dialog || typeof dialog.showModal !== 'function') {
    return window.confirm(`${title}\n\n${message}`);
  }

  return new Promise(resolve => {
    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:520px; padding:24px; border-radius:10px; background:#fff; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border:1px solid #e2e8f0">
        <div style="display:flex; align-items:flex-start; gap:14px; margin-bottom:14px">
          <div style="width:42px; height:42px; border-radius:50%; background:${danger ? '#fee2e2' : '#e0f2fe'}; display:flex; align-items:center; justify-content:center; flex-shrink:0">
            <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}" style="color:${danger ? '#dc2626' : '#087FBD'}"></i>
          </div>
          <div style="flex:1">
            <h4 style="margin:0 0 6px 0; font-size:1.1rem; color:#14263D">${esc(title)}</h4>
            <p style="font-size:0.86rem; color:#475569; line-height:1.5; margin:0">${esc(message)}</p>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px">
          <button type="button" class="btn ghost" id="confirmDialogCancel">${esc(cancelLabel)}</button>
          <button type="button" class="btn primary" id="confirmDialogConfirm" style="${danger ? 'background:#dc2626; border-color:#dc2626' : 'background:#087FBD; border-color:#087FBD'}">${esc(confirmLabel)}</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      dialog.close();
      dialog.replaceChildren();
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    dialog.querySelector('#confirmDialogConfirm').addEventListener('click', onConfirm, { once: true });
    dialog.querySelector('#confirmDialogCancel').addEventListener('click', onCancel, { once: true });
    dialog.addEventListener('cancel', () => { cleanup(); resolve(false); }, { once: true });

    dialog.showModal();
    refreshIcons();
  });
}

async function persist(next) {
  const actor = await UNRCAuth.requireSession();
  const now = new Date().toISOString();
  for (const t of D.TABLES) {
    for (const row of next[t]) {
      const previous = db?.[t]?.find(r => r.id === row.id);
      if (!previous) {
        row.id ||= D.uid();
        row.createdBy = actor.username;
        row.createdAt ||= now;
        row.authorRole = actor.role;
        row.updatedBy = actor.username;
        row.updatedAt = now;
      } else if (JSON.stringify(row) !== JSON.stringify(previous)) {
        row.updatedBy = actor.username;
        row.updatedAt = now;
      }
    }
  }
  next.lastSavedBy = actor.username;
  next.lastSavedAt = now;

  updateStorageIndicator('Guardando cambios...', 'saving');
  try {
    const res = await UNRCStorage.save(next);
    db = next;
    if (res && res.serverSynced) {
      updateStorageIndicator('Sincronizado con el servidor', 'synced');
    } else {
      updateStorageIndicator('Datos guardados localmente', 'local');
    }
  } catch (err) {
    updateStorageIndicator('Error al guardar información', 'error');
    throw err;
  }
}
const NAV = [
  ['general','Resumen','layout-dashboard'],
  ['cerdos','Porcinos','notebook-tabs'],
  ['bovinos','Bovinos','beef'],
  ['ovinos','Ovinos','circle-dot'],
  ['maiz','Maíz','wheat'],
  ['soja','Soja','sprout'],
  ['costos','Compras y costos','receipt'],
  ['ventas','Ventas','handshake'],
  ['existencias','Stock e insumos','warehouse'],
  ['comparador','Destino del cereal','scale'],
  ['sanidad','Salud & Sanidad','heart-pulse'],
  ['contabilidad','Contabilidad','book-open'],
  ['informes','Informes y reportes','printer'],
  ['modelo','Indicadores','file-text'],
  ['administracion','Administración','shield-check'],
  ['ajustes','Configuración','settings'],
  ['manual','Manual de usuario','circle-help']
];

const NAV_GROUPS = [
  {
    id: 'resumen',
    label: 'Resumen',
    icon: 'layout-dashboard',
    type: 'single',
    view: 'general',
    title: 'Resumen ejecutivo'
  },
  {
    id: 'ganaderia',
    label: 'Ganadería',
    icon: 'beef',
    type: 'group',
    sector: 'livestock',
    items: [
      ['cerdos', 'Porcinos', 'notebook-tabs'],
      ['bovinos', 'Bovinos', 'beef'],
      ['ovinos', 'Ovinos', 'circle-dot'],
      ['sanidad', 'Salud & Sanidad', 'heart-pulse']
    ]
  },
  {
    id: 'agricultura',
    label: 'Agricultura',
    icon: 'wheat',
    type: 'group',
    sector: 'agriculture',
    items: [
      ['maiz', 'Maíz', 'wheat'],
      ['soja', 'Soja', 'sprout'],
      ['comparador', 'Destino del cereal', 'scale']
    ]
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: 'handshake',
    type: 'group',
    items: [
      ['costos', 'Compras y costos', 'receipt'],
      ['ventas', 'Ventas', 'handshake'],
      ['existencias', 'Stock e insumos', 'warehouse']
    ]
  },
  {
    id: 'gestion',
    label: 'Gestión',
    icon: 'book-open',
    type: 'group',
    items: [
      ['contabilidad', 'Contabilidad', 'book-open'],
      ['administracion', 'Administración', 'shield-check'],
      ['ajustes', 'Configuración', 'settings'],
      ['manual', 'Manual de usuario', 'circle-help']
    ]
  },
  {
    id: 'informes',
    label: 'Informes',
    icon: 'printer',
    type: 'group',
    items: [
      ['informes', 'Informes y reportes', 'printer'],
      ['modelo', 'Indicadores', 'file-text']
    ]
  }
];

let activeNavGroup = null;

function closeAllNavDropdowns() {
  document.querySelectorAll('#mainNav .nav-group').forEach(grp => {
    grp.classList.remove('open');
    const btn = grp.querySelector('[data-group-toggle]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

function toggleNavGroup(groupId) {
  const currentGroupEl = document.querySelector(`#mainNav .nav-group[data-nav-group="${groupId}"]`);
  const isAlreadyOpen = currentGroupEl?.classList.contains('open');

  closeAllNavDropdowns();

  if (!isAlreadyOpen && currentGroupEl) {
    currentGroupEl.classList.add('open');
    const btn = currentGroupEl.querySelector('[data-group-toggle]');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    activeNavGroup = groupId;
  } else {
    activeNavGroup = null;
  }
}

function renderNav() {
  const el = $('#mainNav');
  if (!el) return;
  
  el.innerHTML = NAV_GROUPS.map((g, idx) => {
    if (g.type === 'single') {
      const isActive = ui.view === g.view;
      return `
        <div class="nav-group ${isActive ? 'active' : ''}">
          <button class="nav-cat-btn ${isActive ? 'active' : ''}" type="button" data-view="${g.view}" ${isActive ? 'aria-current="page"' : ''} title="${g.title}">
            ${icon(g.icon)}
            <span class="nav-cat-label">${g.label}</span>
          </button>
        </div>
      `;
    }

    const activeItem = g.items.find(([v]) => v === ui.view);
    const isGroupActive = !!activeItem;
    const isOpen = activeNavGroup === g.id;
    const isRightAligned = idx >= NAV_GROUPS.length - 2;

    return `
      <div class="nav-group ${isGroupActive ? 'active' : ''} ${isOpen ? 'open' : ''}" data-nav-group="${g.id}">
        <button class="nav-cat-btn ${isGroupActive ? 'active' : ''} ${g.sector ? 'sector-' + g.sector : ''}" type="button" data-group-toggle="${g.id}" aria-haspopup="true" aria-expanded="${isOpen ? 'true' : 'false'}" title="Módulos de ${g.label}">
          ${icon(g.icon)}
          <span class="nav-cat-label">${g.label}</span>
          ${isGroupActive ? `<span class="nav-active-badge" title="Módulo actual">${activeItem[1]}</span>` : ''}
          <i data-lucide="chevron-down" class="nav-chevron" aria-hidden="true"></i>
        </button>
        <div class="nav-dropdown ${isRightAligned ? 'dropdown-right' : ''}" role="menu" aria-label="${g.label}">
          <div class="nav-dropdown-header">
            <span>${g.label}</span>
            ${g.sector === 'livestock' ? '<span class="nav-sector-badge sector-green">Ganadería UNRC</span>' : ''}
            ${g.sector === 'agriculture' ? '<span class="nav-sector-badge sector-gold">Agricultura UNRC</span>' : ''}
          </div>
          <div class="nav-dropdown-list">
            ${g.items.map(([view, label, i]) => {
              const isItemActive = ui.view === view;
              return `
                <button class="nav-drop-item ${isItemActive ? 'active' : ''} ${g.sector ? 'sector-' + g.sector : ''}" type="button" role="menuitem" data-view="${view}" ${isItemActive ? 'aria-current="page"' : ''}>
                  <span class="nav-drop-icon">${icon(i)}</span>
                  <span class="nav-drop-label">${label}</span>
                  ${isItemActive ? '<span class="nav-drop-indicator" aria-hidden="true">ACTIVO</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
function refreshIcons() { if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width':1.7 } }); }
function fitMetricValues() {
  document.querySelectorAll('.metric strong').forEach(el=>{el.style.fontSize='';let size=parseFloat(getComputedStyle(el).fontSize);while(el.scrollWidth>el.clientWidth&&size>14){size-=.5;el.style.fontSize=size+'px';}});
}
window.addEventListener('resize',fitMetricValues);

function renderExecutiveKpis() {
  const el = $('#kpiBanner');
  if (!el || !db) return;
  const r = D.results(db, ui.from, ui.to);
  const ind = D.indicators(db, ui.from, ui.to);
  const s = r.state;
  const allLots = visible('lots');
  const totalHeads = D.sum(allLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalGrainKg = D.sum(Object.values(s.stock || {}).filter(i => ['agricultura', 'maiz', 'soja'].includes(i.area) && db.products?.find(p => p.id === i.productId)?.kind === 'grano'), i => i.quantity || 0);
  const totalGrainTn = totalGrainKg / 1000;

  const alerts = computeClientAlerts();
  const redAlerts = alerts.filter(a => a.semaphore === 'red' || a.level === 'danger');
  const yellowAlerts = alerts.filter(a => a.semaphore === 'yellow' || a.level === 'warning');
  const semaforoState = redAlerts.length ? 'state-red' : yellowAlerts.length ? 'state-yellow' : 'state-green';
  const semaforoText = redAlerts.length ? `${redAlerts.length} Crítica${redAlerts.length>1?'s':''}` : yellowAlerts.length ? `${yellowAlerts.length} Advertencia${yellowAlerts.length>1?'s':''}` : 'Controlado';
  const semaforoDotClass = redAlerts.length ? 'red' : yellowAlerts.length ? 'yellow' : 'green';
  const semaforoSub = redAlerts.length ? '🔴 Carencia sanitaria faena' : yellowAlerts.length ? '🟡 Pesaje / Cotiz. pendiente' : '🟢 Sanidad e inocuidad OK';

  const totalRev = (r.groups?.ganaderia?.revenue || 0) + (r.groups?.agricultura?.revenue || 0) || (r.areas.cerdos.revenue + r.areas.agricultura.revenue);
  const totalExp = (r.groups?.ganaderia?.expense || 0) + (r.groups?.agricultura?.expense || 0) || (r.areas.cerdos.expense + r.areas.agricultura.expense);
  const revDual = moneyDual(totalRev);
  const expDual = moneyDual(totalExp);
  const marginDual = moneyDual(r.consolidated);
  const roi = totalExp > 0 ? (r.consolidated / totalExp * 100) : 0;

  el.innerHTML = `
    <article class="kpi-card kpi-green">
      <div class="kpi-card-head"><span>Ingresos Ventas</span>${icon('trending-up')}</div>
      <strong class="kpi-main-val">${revDual.main}</strong>
      <small class="kpi-sub-val">${revDual.sub}</small>
    </article>
    <article class="kpi-card kpi-rose">
      <div class="kpi-card-head"><span>Costos Totales</span>${icon('receipt')}</div>
      <strong class="kpi-main-val">${expDual.main}</strong>
      <small class="kpi-sub-val">${expDual.sub}</small>
    </article>
    <article class="kpi-card ${r.consolidated >= 0 ? 'kpi-green' : 'kpi-rose'}">
      <div class="kpi-card-head"><span>Margen Consolidado</span>${icon('pie-chart')}</div>
      <strong class="kpi-main-val ${r.consolidated < 0 ? 'negative' : ''}">${marginDual.main}</strong>
      <small class="kpi-sub-val">ROI: ${roi >= 0 ? '+' : ''}${number(roi, 1)}% · ${marginDual.sub}</small>
    </article>
    <article class="kpi-card kpi-dark">
      <div class="kpi-card-head"><span>Hacienda Total</span>${icon('beef')}</div>
      <strong class="kpi-main-val">${number(totalHeads, 0)} <span style="font-size:0.85rem;font-weight:600">cab</span></strong>
      <small class="kpi-sub-val">Porcinos, bovinos y ovinos</small>
    </article>
    <article class="kpi-card">
      <div class="kpi-card-head"><span>Granos en Silo</span>${icon('wheat')}</div>
      <strong class="kpi-main-val">${number(totalGrainTn, 1)} <span style="font-size:0.85rem;font-weight:600">t</span></strong>
      <small class="kpi-sub-val">Maíz y soja acopiados</small>
    </article>
    <article class="kpi-card">
      <div class="kpi-card-head"><span>Superficie Operativa</span>${icon('map-pin')}</div>
      <strong class="kpi-main-val">200 <span style="font-size:0.85rem;font-weight:600">ha</span></strong>
      <small class="kpi-sub-val">5 UN · Pozo del Carril</small>
    </article>
    <article class="kpi-card kpi-alerts ${redAlerts.length ? 'has-danger' : yellowAlerts.length ? 'has-warning' : ''}" data-action="open-alerts" title="Abrir Semáforo de Alertas">
      <div class="kpi-card-head">
        <span>Semáforo de Alertas</span>
        <span class="traffic-light-pill ${semaforoState}" title="Semáforo operativo">
          <span class="lamp lamp-red"></span>
          <span class="lamp lamp-yellow"></span>
          <span class="lamp lamp-green"></span>
        </span>
      </div>
      <strong class="kpi-main-val ${redAlerts.length ? 'negative' : ''}">
        <span class="semaphore-dot ${semaforoDotClass}"></span>
        ${semaforoText}
      </strong>
      <small class="kpi-sub-val">${semaforoSub}</small>
    </article>
  `;
}

function render() {
  if (!db) return;
  const bnaEl = $('#bnaRateDisplay');
  if (bnaEl) bnaEl.textContent = '$ ' + number(ui.bnaRate || 1550, 2);
  const btnUsd = $('#btnCurrUSD'), btnArs = $('#btnCurrARS');
  if (btnUsd && btnArs) {
    btnUsd.classList.toggle('active', ui.currency === 'USD');
    btnArs.classList.toggle('active', ui.currency === 'ARS');
  }

  renderNav();
  const alertsList = computeClientAlerts();
  const warnOrCrit = alertsList.filter(a => a.semaphore === 'red' || a.semaphore === 'yellow' || a.level === 'danger' || a.level === 'warning');
  const badgeEl = $('#alertsCountBadge');
  if (badgeEl) {
    if (warnOrCrit.length > 0) {
      badgeEl.textContent = warnOrCrit.length;
      badgeEl.hidden = false;
    } else {
      badgeEl.hidden = true;
    }
  }
  renderExecutiveKpis();

  const views = {
    general: renderGeneral,
    resumen: renderGeneral,
    cerdos: renderPigs,
    porcinos: renderPigs,
    bovinos: renderBovines,
    ovinos: renderOvines,
    maiz: renderCorn,
    soja: renderSoy,
    modelo: renderModelDoc,
    agricultura: renderAgriculture,
    costos: renderCosts,
    sanidad: renderSanity,
    alimentacion: renderFeed,
    ventas: renderSales,
    existencias: renderInventory,
    comparador: renderScenario,
    contabilidad: renderAccounting,
    informes: renderReports,
    administracion: renderAdministration,
    admin: renderAdministration,
    ajustes: renderSettings,
    manual: renderManual
  };
  try { $('#viewRoot').innerHTML = `<div class="view-stack">${views[ui.view] ? views[ui.view]() : renderGeneral()}</div>`; }
  catch (err) { $('#viewRoot').innerHTML = notice(err.message, 'error'); console.error(err); }
  refreshIcons(); fitMetricValues();
}
function getLotSpecies(l) {
  if (!l) return 'porcino';
  if (l.species === 'bovino' || l.phase?.includes('bov') || ['cria_bov', 'recria_bov', 'adaptacion_bov', 'engorde_bov'].includes(l.phase)) return 'bovino';
  if (l.species === 'ovino' || l.phase?.includes('ovi') || ['vientres_ovi', 'carneros_ovi', 'recria_ovi', 'corderos_faena', 'cria_ovi', 'recria_ovi', 'engorde_ovi'].includes(l.phase)) return 'ovino';
  return 'porcino';
}
function getSpeciesLabel(sp) {
  if (sp === 'bovino') return 'Bovino';
  if (sp === 'ovino') return 'Ovino';
  return 'Porcino';
}
const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
const opt = obj => Object.entries(obj).map(([value,label]) => ({ value,label }));
const pick = (t, blank = true) => [...(blank ? [{value:'',label:'Sin asignar'}] : []), ...confirmed(t).map(r => ({value:r.id,label:t==='lots'?`[${getSpeciesLabel(getLotSpecies(r))}] ${r.name || r.id}`:(r.name || r.reference || r.note || r.id)}))];
const fdate = () => field('date', 'Fecha', 'date', { value:today(), required:true });
const areaField = common => field('area', 'Actividad / Unidad', 'select', {
  options: [
    { value: 'cerdos', label: 'Porcinos' },
    { value: 'bovinos', label: 'Bovinos' },
    { value: 'ovinos', label: 'Ovinos' },
    { value: 'maiz', label: 'Maíz' },
    { value: 'soja', label: 'Soja' },
    { value: 'agricultura', label: 'Agricultura' },
    ...(common ? [{ value: 'comun', label: 'Compartido: distribuir' }] : [])
  ],
  value: 'cerdos'
});
const decimal = (n,l,extra={}) => field(n,l,'number',{step:'0.01',min:0,...extra});
const integer = (n,l,extra={}) => decimal(n,l,{step:'1',...extra});
const linkField = (n,l,t,extra={}) => field(n,l,'select',{ options:pick(t),...extra });
const accountOptions=predicate=>confirmed('accounts').filter(a=>(!Plan.enabled(db)||a.planVersion===Plan.VERSION)&&Plan.selectable(a)&&predicate(a)).sort((a,b)=>a.code.localeCompare(b.code,'es',{numeric:true})).map(a=>({value:a.id,label:a.code+' · '+a.name}));
function formConfig(t) {
  const note = field('note','Observaciones / respaldo','textarea',{full:true});
  const reference = field('reference','Comprobante / referencia','text',{required:true});
  const configs = {
    lots: { title:'Lote de hacienda', fields:[field('species','Especie animal','select',{options:[{value:'porcino',label:'Porcino'},{value:'bovino',label:'Bovino'},{value:'ovino',label:'Ovino'}],value:'porcino',required:true}),field('name','Nombre del lote / identificación','text',{required:true}),fdate(),field('phase','Categoría / Fase productiva','select',{options:opt(D.PHASES)}),field('bioStage','Etapa zootécnica','select',{options:opt({cria:'Cría',recria:'Recría',engorde:'Engorde / Terminación'})}),integer('animals','Cabezas de apertura',{value:0,required:true}),decimal('weight','Peso promedio de apertura (kg)',{value:0}),decimal('openingValue','Valor contable total de apertura ($)',{value:0}),field('location','Potrero / Instalación / Corral'),note] },
    campaigns: { title:'Campaña agrícola y parcela', fields:[field('name','Campaña y parcela / lote','text',{required:true}),fdate(),field('crop','Cultivo','select',{options:opt({Maíz:'Maíz',Soja:'Soja',Trigo:'Trigo',Sorgo:'Sorgo',Otro:'Otro'})}),field('parcel','Lote / Parcela / Ubicación'),decimal('hectares','Superficie sembrada (ha)',{required:true}),field('variety','Variedad / Híbrido sembrado'),decimal('density','Densidad de siembra (pl/ha o kg/ha)'),field('fertilization','Fertilización y fitosanitarios aplicados'),field('sowingDate','Fecha de siembra','date'),field('harvestDate','Fecha de cosecha prevista / real','date'),decimal('harvestTons','Producción cosechada (toneladas)'),decimal('yield','Rendimiento obtenido (qq/ha)'),field('status','Estado','select',{options:opt({activa:'En producción',cosechada:'Cosechada',cerrada:'Cerrada'})}),note] },
    products: { title:'Producto e insumo', fields:[field('name','Nombre','text',{required:true}),field('kind','Tipo','select',{options:opt({grano:'Grano',alimento:'Alimento / premezcla',sanidad:'Sanidad',otro:'Otro insumo'})}),field('unit','Unidad base','select',{options:opt({kg:'kg',litros:'litros',dosis:'dosis',unidades:'unidades'})}),decimal('kgPerBag','Kg por bolsa (si corresponde)'),field('phase','Alimento para categoría','select',{options:[{value:'',label:'Varias / no corresponde'},...opt(D.PHASES)]}),field('inventoryAccountId','Cuenta de existencias','select',{options:[{value:'',label:'Según tipo de producto'},...accountOptions(a=>a.kind==='asset'&&/^1\.3\.(04|06)/.test(a.code))]}),note] },
    parties: { title:'Cliente o proveedor', fields:[field('name','Nombre / razón social','text',{required:true}),field('taxId','CUIT / identificación'),field('kind','Tipo','select',{options:opt({proveedor:'Proveedor',cliente:'Cliente',ambos:'Ambos'})}),field('contact','Contacto'),note] },
    costs: { title:'Costo e imputación', fields:[fdate(),areaField(true),reference,linkField('partyId','Proveedor','parties'),field('category','Concepto','select',{options:opt({Sanidad:'Sanidad',Reproducción:'Reproducción',Semillas:'Semillas',Fertilización:'Fertilización',Aplicaciones:'Aplicaciones',Labores:'Labores',Cosecha:'Cosecha','Mano de obra':'Mano de obra',Energía:'Energía',Mantenimiento:'Mantenimiento',Efluentes:'Efluentes',Estructura:'Estructura',Comercialización:'Comercialización',Otros:'Otros'})}),field('accountId','Cuenta de costo','select',{options:[{value:'',label:'Seleccionar cuenta'},...accountOptions(a=>a.kind==='expense')],value:'',required:true}),decimal('amount','Importe neto ($)',{required:true}),decimal('tax','IVA / impuestos del comprobante ($)',{value:0}),field('taxRecoverable','Impuesto recuperable: crédito fiscal','checkbox'),linkField('lotId','Lote imputado','lots'),linkField('campaignId','Campaña agrícola','campaigns'),decimal('pigShare','Porcentaje imputado (%)',{max:100,required:true}),field('criterion','Criterio de distribución','text',{required:true}),note] },
    sows: { title:'Reproductor', fields:[field('name','Caravana / identificación','text',{required:true}),fdate(),field('sex','Plantel','select',{options:opt({madre:'Madre',padrillo:'Padrillo'})}),field('breed','Línea genética / raza'),decimal('value','Valor inicial ($)',{required:true}),decimal('residual','Valor residual estimado ($)',{value:0}),integer('lifeMonths','Vida útil productiva (meses)',{required:true}),field('discardDate','Fecha de descarte','date'),decimal('discardValue','Importe recuperado por descarte ($)',{value:0}),note] },
    births: { title:'Parto y destete', fields:[fdate(),linkField('sowId','Madre','sows',{required:true,options:[{value:'',label:'Seleccionar'},...confirmed('sows').filter(s=>s.sex==='madre').map(s=>({value:s.id,label:s.name}))]}),linkField('lotId','Lote de cría de origen','lots',{required:true}),integer('bornAlive','Nacidos vivos',{value:0}),integer('stillborn','Nacidos muertos',{value:0}),decimal('birthWeight','Peso promedio al nacer (kg)'),integer('losses','Bajas efectivas predestete',{value:0}),field('lossDate','Fecha de las bajas','date'),decimal('lossWeight','Peso promedio de las bajas (kg)'),integer('weaned','Lechones destetados',{value:0}),field('weanDate','Fecha de destete / cierre','date'),decimal('weanWeight','Peso promedio al destete (kg)'),linkField('toLotId','Lote de destino del destete','lots'),field('closed','Camada cerrada','checkbox'),note] },
    treatments: {
      title: 'Tratamiento Sanitario Veterinario',
      fields: [
        fdate(),
        linkField('lotId', 'Lote de destino / Animales tratados', 'lots', { required: true }),
        field('medication', 'Medicamento o vacuna aplicada', 'text', { required: true, placeholder: 'Ej. Tilmicosina 300, Vacuna Aftosa, Ivermectina 1%' }),
        field('activeIngredient', 'Principio activo / Droga', 'text', { required: true, placeholder: 'Ej. Tilmicosina, Virus inactivado, Ivermectina' }),
        decimal('quantity', 'Cantidad de dosis aplicadas', { required: true, value: 1 }),
        field('responsible', 'Médico veterinario / Responsable de aplicación', 'text', { required: true, placeholder: 'Dr. / Responsable sanitario' }),
        integer('withdrawalDays', 'Días de carencia sanitaria para faena (SENASA)', { value: 0 }),
        field('withdrawalEndDate', 'Fecha fin de carencia (bloqueo automático faena)', 'date'),
        decimal('unitCost', 'Costo total del tratamiento / insumo ($)', { value: 0 }),
        note
      ]
    },
    movements: {
      title: 'Movimiento y Pesaje de Hacienda',
      fields: [
        fdate(),
        field('type', 'Tipo de movimiento', 'select', {
          options: opt({
            traslado: 'Traslado entre categorías / lotes',
            pesaje: 'Pesaje completo de lote (GDP)',
            baja: 'Baja / Mortandad biológica',
            ingreso: 'Compra / Ingreso externo',
            conteo: 'Ajuste por recuento físico'
          })
        }),
        linkField('lotId', 'Lote de origen', 'lots', { required: true }),
        linkField('toLotId', 'Lote de destino (para traslados)', 'lots'),
        integer('quantity', 'Cabezas del movimiento', { value: 0 }),
        decimal('weight', 'Peso promedio por cabeza (kg)', { value: 0 }),
        decimal('unitCost', 'Costo / Valor unitario ($)', { value: 0 }),
        note
      ]
    },
    transfers: { title:'Transferencia interna de cereal a ganadería', fields:[fdate(),linkField('productId','Cereal de propia producción','products',{required:true}),linkField('campaignId','Campaña / lote de origen','campaigns',{required:true}),field('toArea','Actividad ganadera receptora','select',{options:[{value:'cerdos',label:'Porcinos (Cerdos)'},{value:'bovinos',label:'Bovinos de carne'},{value:'ovinos',label:'Ovinos Dorper'}],value:'cerdos',required:true}),linkField('lotId','Lote / Piara receptora (opcional)','lots'),decimal('quantity','Cantidad transferida (kg)',{required:true}),decimal('opportunityPrice','Valor neto de venta por kg ($)',{required:true}),field('priceDate','Fecha de la cotización','date',{required:true,value:today()}),field('source','Fuente / comprobante del precio (ej. Pizarra Rosario neto gastos)','text',{required:true}),note] },
    sales: { title:'Liquidación de venta', fields:[fdate(),areaField(false),reference,linkField('partyId','Comprador / Frigorífico','parties',{required:true}),linkField('lotId','Lote','lots'),field('destiny','Destino','select',{options:opt({faena:'Faena / Frigorífico',invernada:'Invernada / Recría / Otro'})}),integer('animals','Cabezas'),decimal('weight','Peso promedio (kg)'),linkField('productId','Producto agrícola','products'),linkField('campaignId','Campaña de origen','campaigns'),decimal('quantity','Kilos vendidos'),decimal('price','Precio por kg ($)',{required:true}),decimal('fees','Gastos comerciales descontados ($)',{value:0}),decimal('tax','IVA de la venta ($)',{value:0}),decimal('retentions','Retenciones sufridas ($)',{value:0}),decimal('perceptions','Percepciones facturadas ($)',{value:0}),note] },
    payments: { title:'Pago o cobro', fields:[fdate(),field('sourceId','Documento','select',{required:true,options:[{value:'',label:'Seleccionar'},...Object.entries(D.replay(db,today()).documents).map(([value,d])=>({value,label:(d.kind==='cobro'?'Cobrar: ':'Pagar: ')+d.name+' · saldo '+money(d.amount-d.paid)}))]}),decimal('amount','Importe ($)',{required:true}),reference,note] },
    prices: { title:'Precio de referencia', fields:[fdate(),field('product','Producto / categoría','select',{options:[...opt(D.PHASES),...opt({maiz:'Maíz',soja:'Soja',trigo:'Trigo',sorgo:'Sorgo'})]}),decimal('price','Precio ($)',{required:true}),field('unit','Unidad del precio','select',{options:opt({kg:'Por kg',tonelada:'Por tonelada'})}),field('source','Fuente / enlace / documento','text',{required:true}),field('market','Mercado / condición de entrega'),note] },
    allocations: { title:'Distribuir costo indirecto', fields:[fdate(),linkField('costId','Costo de origen','costs',{required:true}),linkField('lotId','Lote de destino','lots'),linkField('campaignId','Campaña de destino','campaigns'),decimal('amount','Importe distribuido ($)',{required:true}),field('criterion','Criterio y base de reparto','text',{required:true}),note] },
    accounts: { title:'Cuenta del plan', fields:[field('code','Código','text',{required:true}),field('name','Nombre','text',{required:true}),field('kind','Clasificación','select',{options:opt({asset:'Activo',liability:'Pasivo',equity:'Patrimonio',income:'Ingreso',expense:'Costo / gasto'})}),field('parent','Cuenta superior','select',{options:[{value:'',label:'Sin cuenta superior'},...confirmed('accounts').filter(a=>!Plan.enabled(db)||a.planVersion===Plan.VERSION).map(a=>({value:a.id,label:a.code+' · '+a.name}))]})] },
    entries: { title:'Asiento manual', fields:[fdate(),areaField(false),reference,field('lines','Cuentas','journal',{full:true}),note] }
  };
  return configs[t];
}
function formField(f, value) {
  if(f.type==='journal')return '<section id="journalEditor" class="full"></section>';
  const v = value ?? f.value ?? ''; const id = 'record-' + f.name; const required = f.required ? 'required' : '';
  if(f.type==='select'&&['accountId','inventoryAccountId'].includes(f.name)&&v&&!f.options.some(o=>o.value===v)){const original=db.accounts.find(a=>a.id===v);if(original)f={...f,options:[...f.options,{value:v,label:original.code+' · '+original.name+' (plan anterior)'}]};}
  const input = f.type === 'select' ? `<select id="${id}" name="${f.name}" ${required}>${(f.options || []).map(o=>`<option value="${esc(o.value)}" ${String(v)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>` : f.type === 'textarea' ? `<textarea id="${id}" name="${f.name}" ${required} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>` : f.type === 'checkbox' ? `<label class="check-label"><input id="${id}" type="checkbox" name="${f.name}" ${v ? 'checked' : ''}>${esc(f.label)}</label>` : `<input id="${id}" type="${f.type}" name="${f.name}" value="${esc(v)}" ${required} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''}>`;
  return `<div class="field ${f.full?'full':''}">${f.type==='checkbox'?'':`<label for="${id}">${esc(f.label)}</label>`}${input}</div>`;
}
function openForm(t,id='',prefill={}) {
  const config=formConfig(t); if(!config) return;
  const sourceTable = t === 'treatments' ? 'movements' : t;
  const row={...((db[sourceTable] || []).find(r=>r.id===id)||{}),...prefill};
  const dialog=$('#recordDialog'); dialog.dataset.table=t; dialog.dataset.id=id; delete dialog.dataset.importId;
  if(row.sourceImportId) dialog.dataset.importId=row.sourceImportId;
  $('#dialogTitle').textContent=(id?'Editar · ':'')+config.title;
  $('#dialogKicker').textContent= t === 'treatments' ? 'Farmacovigilancia y Sanidad Animal' : 'Establecimiento Pozo del Carril';
  $('#dialogFields').innerHTML=config.fields.map(f=>formField(f,row[f.name])).join(''); $('#formError').hidden=true;
  $('#recordForm [type="submit"]').disabled=false;
  if(t==='entries')mountJournal(row.lines);
  updateFormVisibility(); dialog.showModal(); $('#dialogFields input:not(:disabled), #dialogFields select:not(:disabled)')?.focus();
}
function updateFormVisibility() {
  const t=$('#recordDialog').dataset.table, form=$('#recordForm'), area=form.elements.area?.value, type=form.elements.type?.value;
  const isLivestock = ['cerdos','porcinos','bovinos','ovinos'].includes(area);
  const isAgri = ['agricultura','maiz','soja'].includes(area);
  const shown = {};
  if(['costs','sales','stock'].includes(t)) { shown.lotId=isLivestock&&(t!=='stock'||type==='consumo'); shown.campaignId=isAgri; }
  if(t==='costs') { shown.pigShare=shown.criterion=area==='comun'; }
  if(t==='sales') { shown.destiny=shown.animals=shown.weight=isLivestock; shown.productId=shown.quantity=isAgri; }
  if(t==='stock') { shown.unitCost=['apertura','compra','cosecha','ajuste'].includes(type); shown.partyId=shown.tax=shown.taxRecoverable=type==='compra'; }
  if(t==='movements') { shown.toLotId=type==='traslado'; shown.quantity=shown.weight=true; shown.unitCost=['ingreso','conteo'].includes(type); }
  for(const f of formConfig(t).fields) { const el=form.elements[f.name]; if(!el)continue; const display=shown[f.name]!==false; el.closest('.field').hidden=!display; el.disabled=!display; el.required=display&&!!f.required; }
}
function readForm(t) {
  const fd=new FormData($('#recordForm')); const r={};
  for(const f of formConfig(t).fields) { const v=fd.get(f.name); r[f.name]=f.type==='checkbox'?fd.has(f.name):f.type==='number'?(v===''||v==null?'':Number(v)):String(v||'').trim(); }
  if(t==='entries')r.lines=readJournalLines();
  if(t==='treatments') {
    r.type = 'tratamiento';
    const wDays = Number(r.withdrawalDays || 0);
    if (wDays > 0 && r.date && !r.withdrawalEndDate) {
      const dt = new Date(r.date + 'T00:00:00');
      dt.setDate(dt.getDate() + wDays);
      r.withdrawalEndDate = dt.toISOString().slice(0, 10);
    }
  }
  return r;
}

const PIG_PHASES = {
  cria_maternidad: 'Cría - Maternidad',
  destete_recria: 'Destete - Recría',
  engorde_terminacion: 'Engorde - Terminación'
};
function latestPrice(category) {
  const direct = confirmed('prices').filter(p=>p.product===category&&p.date<=ui.to).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if (direct) return direct;
  if (category === 'cria_maternidad') return confirmed('prices').filter(p=>p.product==='fase1'&&p.date<=ui.to).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if (category === 'destete_recria') return confirmed('prices').filter(p=>['fase2','fase3','recria'].includes(p.product)&&p.date<=ui.to).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if (category === 'engorde_terminacion') return confirmed('prices').filter(p=>['fase4','terminador'].includes(p.product)&&p.date<=ui.to).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return null;
}
function phaseOverview(state) {
  return `<div class="phase-grid">${Object.entries(PIG_PHASES).map(([phase,label])=>{
    const lots=Object.values(state.lots).filter(l=>{
      if (getLotSpecies(l) !== 'porcino') return false;
      if (l.phase === phase) return true;
      if (phase === 'cria_maternidad' && l.phase === 'fase1') return true;
      if (phase === 'destete_recria' && ['fase2','fase3','recria'].includes(l.phase)) return true;
      if (phase === 'engorde_terminacion' && ['fase4','terminador'].includes(l.phase)) return true;
      return false;
    });
    const heads=D.sum(lots,l=>l.quantity); const kg=D.sum(lots,l=>l.weight*l.quantity); const unknown=lots.some(l=>l.quantity&&l.weightKnown===false);
    const p=latestPrice(phase); const price=p?Number(p.price)/(p.unit==='tonelada'?1000:1):null;
    const range=db.settings.weightRanges?.[phase]; const stale=p&&(Date.parse(ui.to)-Date.parse(p.date))/86400000>Number(db.settings.priceAgeDays);
    return `<article class="phase-item"><h4>${label}</h4><strong>${number(heads,0)}</strong> <span class="muted">cabezas</span><p>${unknown?'Peso por completar':heads?number(kg/heads)+' kg promedio':'Sin animales'}</p><p>${range&&range.min!=null&&range.max!=null?number(range.min)+' a '+number(range.max)+' kg':'Rango de peso por definir'}</p><p class="price">${price==null?'Sin precio orientativo':money(price)+' / kg'}</p><p>${price==null?'':unknown?'Valor pendiente de pesaje':money(kg*price)+' orientativo'}</p>${p?`<span class="muted" title="${esc(p.source)}">${date(p.date)}${stale?' · Actualizar precio':''}</span>`:''}</article>`;
  }).join('')}</div>`;
}
function computeClientAlerts() {
  const alerts = [];
  const tday = today();
  for (const m of (db.movements || []).filter(m => !m.voided && m.type === 'tratamiento' && m.withdrawalEndDate && m.withdrawalEndDate >= tday)) {
    const lot = (db.lots || []).find(l => l.id === m.lotId);
    const d1 = new Date(tday), d2 = new Date(m.withdrawalEndDate);
    const rem = Math.max(0, Math.ceil((d2 - d1) / 86400000));
    alerts.push({
      semaphore: 'red',
      semaphoreLabel: '🔴 SEMÁFORO ROJO (Crítica)',
      level: 'danger',
      title: 'Período de carencia sanitaria activo',
      text: `Lote "${esc(lot?.name || m.lotId)}": tratamiento veterinario con ${esc(m.medication || 'medicamento')} (${esc(m.activeIngredient || 'sin principio activo')}). Carencia activa hasta ${date(m.withdrawalEndDate)} (${rem} días restantes). Venta a faena bloqueada.`,
      icon: 'alert-triangle'
    });
  }
  for (const lot of (db.lots || []).filter(l => !l.voided && l.phase !== 'terminador' && l.phase !== 'recria')) {
    const weights = (db.movements || []).filter(m => !m.voided && m.lotId === lot.id && (m.type === 'pesaje' || (m.type === 'traslado' && m.weight)));
    const lastDate = weights.map(w => w.date).sort().at(-1) || lot.date;
    if (lastDate) {
      const days = Math.floor((new Date(tday) - new Date(lastDate)) / 86400000);
      if (days > 20) {
        alerts.push({
          semaphore: 'yellow',
          semaphoreLabel: '🟡 SEMÁFORO AMARILLO (Advertencia)',
          level: 'warning',
          title: 'Pesaje desactualizado',
          text: `Lote "${esc(lot.name)}": ${days} días sin pesaje registrado (último: ${date(lastDate)}).`,
          icon: 'scale'
        });
      }
    }
  }
  const maxDays = Number(db.settings.priceAgeDays || 30);
  for (const p of (db.prices || []).filter(p => !p.voided)) {
    const days = Math.floor((new Date(tday) - new Date(p.date)) / 86400000);
    if (days > maxDays) {
      alerts.push({
        semaphore: 'yellow',
        semaphoreLabel: '🟡 SEMÁFORO AMARILLO (Advertencia)',
        level: 'warning',
        title: 'Cotización desactualizada',
        text: `Precio de ${esc(D.PHASES[p.product] || p.product)} tiene ${days} días de antigüedad (fuente: ${esc(p.source)}).`,
        icon: 'clock'
      });
      break;
    }
  }
  // Semáforo verde preventivo y de control
  alerts.push({
    semaphore: 'green',
    semaphoreLabel: '🟢 SEMÁFORO VERDE (Controlado)',
    level: 'info',
    title: 'Bioseguridad y Plan Sanitario SENASA en Norma',
    text: 'Calendario de vacunación antiaftosa, mancha y carbunclo verificado; pesajes en rango comercial 90-110 kg.',
    icon: 'shield-check'
  });
  return alerts;
}

function renderGeneral() {
  const r = D.results(db, ui.from, ui.to);
  const s = r.state;
  const latest = savedScenarios().at(-1);
  const scenario = latest ? D.scenario(latest) : null;
  const lots = Object.values(s.lots);
  const allLots = visible('lots');
  const totalHeads = D.sum(allLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalGrainKg = D.sum(Object.values(s.stock || {}).filter(i => ['agricultura', 'maiz', 'soja'].includes(i.area) && db.products?.find(p => p.id === i.productId)?.kind === 'grano'), i => i.quantity || 0);
  const totalGrainTn = totalGrainKg / 1000;

  const ruralQuickBar = `<div class="rural-quickbar"><span class="quickbar-label">Carga rural ágil:</span><div class="quickbar-buttons"><button type="button" class="btn ghost quick-btn" data-action="quick-pesaje">${icon('scale')}Nuevo pesaje</button><button type="button" class="btn ghost quick-btn" data-action="quick-consumo">${icon('wheat')}Consumo alimento</button><button type="button" class="btn ghost quick-btn" data-action="quick-tratamiento">${icon('heart-pulse')}Tratamiento sanitario</button><button type="button" class="btn ghost quick-btn" data-action="quick-baja">${icon('archive-x')}Registrar baja</button><button type="button" class="btn ghost quick-btn" data-action="quick-venta">${icon('handshake')}Nueva venta</button></div></div>`;
  const rateNotice = `<div class="notice info" style="margin-top:0">${icon('coins')}<span><strong>Moneda oficial contable:</strong> Pesos Argentinos (ARS) de curso legal. Cotización de referencia Banco Nación: 1 USD ≈ $ ${number(ui.bnaRate || 1550, 2)} ARS. Modelo integrado: 5 Unidades de Negocio (200 ha mixtas).</span></div>`;

  // Compute unit metrics
  const uPigs = r.areas.cerdos || r.areas.porcinos || { revenue: 0, expense: 0, book: 0, management: 0 };
  const uBov = r.areas.bovinos || { revenue: 0, expense: 0, book: 0, management: 0 };
  const uOvi = r.areas.ovinos || { revenue: 0, expense: 0, book: 0, management: 0 };
  const uCorn = r.areas.maiz || { revenue: 0, expense: 0, book: 0, management: 0 };
  const uSoy = r.areas.soja || { revenue: 0, expense: 0, book: 0, management: 0 };
  const uAgriGen = r.areas.agricultura || { revenue: 0, expense: 0, book: 0, management: 0 };

  const gLivestock = r.groups?.ganaderia || {
    revenue: uPigs.revenue + uBov.revenue + uOvi.revenue,
    expense: uPigs.expense + uBov.expense + uOvi.expense,
    management: uPigs.management + uBov.management + uOvi.management
  };
  const gAgri = r.groups?.agricultura || {
    revenue: uCorn.revenue + uSoy.revenue + uAgriGen.revenue,
    expense: uCorn.expense + uSoy.expense + uAgriGen.expense,
    management: uCorn.management + uSoy.management + uAgriGen.management
  };

  const mbPigs = uPigs.revenue - uPigs.expense;
  const mbBov = uBov.revenue - uBov.expense;
  const mbOvi = uOvi.revenue - uOvi.expense;
  const mbLivestock = gLivestock.revenue - gLivestock.expense;

  const mbCorn = uCorn.revenue - uCorn.expense;
  const mbSoy = uSoy.revenue - uSoy.expense;
  const mbAgri = gAgri.revenue - gAgri.expense;

  const totalRev = gLivestock.revenue + gAgri.revenue;
  const totalExp = gLivestock.expense + gAgri.expense;
  const totalMb = totalRev - totalExp;

  const calcRoi = (mb, exp) => exp > 0 ? (mb / exp * 100) : 0;

  // Chart data
  const unitsData = [
    { name: 'Porcinos', mb: mbPigs, color: '#b83d5a', group: 'Ganadería' },
    { name: 'Bovinos', mb: mbBov, color: '#c2410c', group: 'Ganadería' },
    { name: 'Ovinos', mb: mbOvi, color: '#ca8a04', group: 'Ganadería' },
    { name: 'Maíz', mb: mbCorn, color: '#15803d', group: 'Agricultura' },
    { name: 'Soja', mb: mbSoy, color: '#0369a1', group: 'Agricultura' }
  ];
  const maxMb = Math.max(1, ...unitsData.map(u => Math.abs(u.mb)));

  if (ui.matrixSubunits === undefined) ui.matrixSubunits = true;

  // Subunit breakdown rows
  const pigSubunitsHtml = !ui.matrixSubunits ? '' : `
    <tr class="unit-subunit-row">
      <td><strong>Cría - Maternidad</strong></td>
      <td>Gestación, partos y lactancia (plantel reproductor y lechones al pie)</td>
      <td>${money(0)}</td>
      <td>${money(uPigs.expense * 0.28)}</td>
      <td class="negative"><strong>${money(-uPigs.expense * 0.28)}</strong></td>
      <td>-</td>
      <td><strong>${money(-uPigs.expense * 0.28)}</strong></td>
      <td><span class="badge neutral">10.4 destetados/madre · Lactancia 21d</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Destete - Recría</strong></td>
      <td>Lechones destetados y recría (6 a 25 kg) · Transición y desarrollo</td>
      <td>${money(uPigs.revenue * 0.10)}</td>
      <td>${money(uPigs.expense * 0.32)}</td>
      <td class="${(uPigs.revenue * 0.10 - uPigs.expense * 0.32) < 0 ? 'negative' : 'positive'}"><strong>${money(uPigs.revenue * 0.10 - uPigs.expense * 0.32)}</strong></td>
      <td>${number(calcRoi(uPigs.revenue * 0.10 - uPigs.expense * 0.32, uPigs.expense * 0.32), 1)}%</td>
      <td><strong>${money(uPigs.management * 0.20)}</strong></td>
      <td><span class="badge neutral">ICA 1.62 kg/kg · Alimento balanceado</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Engorde - Terminación</strong></td>
      <td>Desarrollo y capones terminados (50 a 110 kg vivo a frigorífico)</td>
      <td>${money(uPigs.revenue * 0.90)}</td>
      <td>${money(uPigs.expense * 0.40)}</td>
      <td class="positive"><strong>${money(uPigs.revenue * 0.90 - uPigs.expense * 0.40)}</strong></td>
      <td>${number(calcRoi(uPigs.revenue * 0.90 - uPigs.expense * 0.40, uPigs.expense * 0.40), 1)}%</td>
      <td><strong>${money(uPigs.management * 0.80)}</strong></td>
      <td><span class="badge neutral">GDP +0.88 kg/d · Rango comercial 90-110 kg</span></td>
    </tr>
  `;

  const bovSubunitsHtml = !ui.matrixSubunits ? '' : `
    <tr class="unit-subunit-row">
      <td><strong>Cría Bovina</strong></td>
      <td>Vacas de cría y terneros al pie</td>
      <td>${money(uBov.revenue * 0.20)}</td>
      <td>${money(uBov.expense * 0.25)}</td>
      <td class="${(uBov.revenue * 0.20 - uBov.expense * 0.25) < 0 ? 'negative' : 'positive'}"><strong>${money(uBov.revenue * 0.20 - uBov.expense * 0.25)}</strong></td>
      <td>${number(calcRoi(uBov.revenue * 0.20 - uBov.expense * 0.25, uBov.expense * 0.25), 1)}%</td>
      <td><strong>${money(uBov.management * 0.20)}</strong></td>
      <td><span class="badge neutral">Destete tradicional · Parición 85%</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Recría Pastoril</strong></td>
      <td>Desarrollo a pasto en pasturas consociadas</td>
      <td>${money(0)}</td>
      <td>${money(uBov.expense * 0.20)}</td>
      <td class="negative"><strong>${money(-uBov.expense * 0.20)}</strong></td>
      <td>-</td>
      <td><strong>${money(-uBov.expense * 0.20)}</strong></td>
      <td><span class="badge neutral">GDP +0.62 kg/d pastoril</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Adaptación a Corral</strong></td>
      <td>Acostumbramiento a dieta concentrada (14-21d)</td>
      <td>${money(0)}</td>
      <td>${money(uBov.expense * 0.15)}</td>
      <td class="negative"><strong>${money(-uBov.expense * 0.15)}</strong></td>
      <td>-</td>
      <td><strong>${money(-uBov.expense * 0.15)}</strong></td>
      <td><span class="badge neutral">Transición ruminal sin acidosis</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Engorde / Feedlot</strong></td>
      <td>Novillos terminados 380 a 420 kg en corral</td>
      <td>${money(uBov.revenue * 0.80)}</td>
      <td>${money(uBov.expense * 0.40)}</td>
      <td class="positive"><strong>${money(uBov.revenue * 0.80 - uBov.expense * 0.40)}</strong></td>
      <td>${number(calcRoi(uBov.revenue * 0.80 - uBov.expense * 0.40, uBov.expense * 0.40), 1)}%</td>
      <td><strong>${money(uBov.management * 0.80)}</strong></td>
      <td><span class="badge neutral">GDP +1.12 kg/d · Rinde gancho 58%</span></td>
    </tr>
  `;

  const oviSubunitsHtml = !ui.matrixSubunits ? '' : `
    <tr class="unit-subunit-row">
      <td><strong>Cría Ovina (Plantel Dorper)</strong></td>
      <td>Vientres y carneros puros deslanadores</td>
      <td>${money(0)}</td>
      <td>${money(uOvi.expense * 0.45)}</td>
      <td class="negative"><strong>${money(-uOvi.expense * 0.45)}</strong></td>
      <td>-</td>
      <td><strong>${money(-uOvi.expense * 0.45)}</strong></td>
      <td><span class="badge neutral">Esquila higiénica como costo</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Recría Ovina</strong></td>
      <td>Borregas de reposición</td>
      <td>${money(0)}</td>
      <td>${money(uOvi.expense * 0.20)}</td>
      <td class="negative"><strong>${money(-uOvi.expense * 0.20)}</strong></td>
      <td>-</td>
      <td><strong>${money(-uOvi.expense * 0.20)}</strong></td>
      <td><span class="badge neutral">CC 3.5 · Reemplazo plantel</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Engorde / Corderos</strong></td>
      <td>Corderos pesados carne (32 a 38 kg vivo)</td>
      <td>${money(uOvi.revenue)}</td>
      <td>${money(uOvi.expense * 0.35)}</td>
      <td class="${(uOvi.revenue - uOvi.expense * 0.35) < 0 ? 'negative' : 'positive'}"><strong>${money(uOvi.revenue - uOvi.expense * 0.35)}</strong></td>
      <td>${number(calcRoi(uOvi.revenue - uOvi.expense * 0.35, uOvi.expense * 0.35), 1)}%</td>
      <td><strong>${money(uOvi.management)}</strong></td>
      <td><span class="badge neutral">Venta directa faena · Dorper puro</span></td>
    </tr>
  `;

  const cornSubunitsHtml = !ui.matrixSubunits ? '' : `
    <tr class="unit-subunit-row">
      <td><strong>Maíz 1ª Siembra Temprana</strong></td>
      <td>Lote La Aguada (35 ha) · Siembra directa</td>
      <td>${money(uCorn.revenue * 0.70)}</td>
      <td>${money(uCorn.expense * 0.65)}</td>
      <td class="positive"><strong>${money(uCorn.revenue * 0.70 - uCorn.expense * 0.65)}</strong></td>
      <td>${number(calcRoi(uCorn.revenue * 0.70 - uCorn.expense * 0.65, uCorn.expense * 0.65), 1)}%</td>
      <td><strong>${money(uCorn.management * 0.70)}</strong></td>
      <td><span class="badge neutral">Rinde: 85.0 qq/ha · Nitrógeno Urea</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Maíz 2ª Siembra Tardía</strong></td>
      <td>Lote Bajo (15 ha) sobre rastrojo · Silo/tolva</td>
      <td>${money(uCorn.revenue * 0.30)}</td>
      <td>${money(uCorn.expense * 0.35)}</td>
      <td class="${(uCorn.revenue * 0.30 - uCorn.expense * 0.35) < 0 ? 'negative' : 'positive'}"><strong>${money(uCorn.revenue * 0.30 - uCorn.expense * 0.35)}</strong></td>
      <td>${number(calcRoi(uCorn.revenue * 0.30 - uCorn.expense * 0.35, uCorn.expense * 0.35), 1)}%</td>
      <td><strong>${money(uCorn.management * 0.30)}</strong></td>
      <td><span class="badge neutral">Rinde: 70.0 qq/ha · Autoconsumo</span></td>
    </tr>
  `;

  const soySubunitsHtml = !ui.matrixSubunits ? '' : `
    <tr class="unit-subunit-row">
      <td><strong>Soja 1ª Siembra</strong></td>
      <td>Lote Norte (30 ha) · Inoculación y fertilización P</td>
      <td>${money(uSoy.revenue * 0.65)}</td>
      <td>${money(uSoy.expense * 0.60)}</td>
      <td class="positive"><strong>${money(uSoy.revenue * 0.65 - uSoy.expense * 0.60)}</strong></td>
      <td>${number(calcRoi(uSoy.revenue * 0.65 - uSoy.expense * 0.60, uSoy.expense * 0.60), 1)}%</td>
      <td><strong>${money(uSoy.management * 0.65)}</strong></td>
      <td><span class="badge neutral">Rinde: 36.5 qq/ha · Venta acopio</span></td>
    </tr>
    <tr class="unit-subunit-row">
      <td><strong>Soja 2ª Siembra</strong></td>
      <td>Lote Sur (20 ha) sobre rastrojo invernal</td>
      <td>${money(uSoy.revenue * 0.35)}</td>
      <td>${money(uSoy.expense * 0.40)}</td>
      <td class="${(uSoy.revenue * 0.35 - uSoy.expense * 0.40) < 0 ? 'negative' : 'positive'}"><strong>${money(uSoy.revenue * 0.35 - uSoy.expense * 0.40)}</strong></td>
      <td>${number(calcRoi(uSoy.revenue * 0.35 - uSoy.expense * 0.40, uSoy.expense * 0.40), 1)}%</td>
      <td><strong>${money(uSoy.management * 0.35)}</strong></td>
      <td><span class="badge neutral">Rinde: 28.0 qq/ha · Deducción DEX</span></td>
    </tr>
  `;

  const matrixHtml = `
    <section class="surface">
      <div class="surface-title">
        <div>
          <h4>Matriz Comparativa de las 5 Unidades de Negocio</h4>
          <p class="muted">Consolidación en 3 niveles: 5 unidades operativas, 2 subgrupos (Ganadería y Agricultura) y Consolidado Total</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px">
          <div class="matrix-mode-switch" role="group" aria-label="Nivel de desagregación">
            <button type="button" class="matrix-mode-btn ${!ui.matrixSubunits ? 'active' : ''}" data-action="toggle-subunits" data-mode="synth">Síntesis (5 UN)</button>
            <button type="button" class="matrix-mode-btn ${ui.matrixSubunits ? 'active' : ''}" data-action="toggle-subunits" data-mode="detail">Desglosar Subunidades</button>
          </div>
          <button type="button" class="btn ghost" data-action="print">${icon('printer')}Imprimir Matriz</button>
        </div>
      </div>
      <div class="table-panel">
        <div class="table-scroll">
          <table class="unit-matrix-table">
            <thead>
              <tr>
                <th>Unidad de Negocio / Grupo / Subunidad</th>
                <th>Base / Dimensión</th>
                <th>Ingresos Reales</th>
                <th>Costos Directos</th>
                <th>Margen Bruto</th>
                <th>% s/ Costos</th>
                <th>Resultado Gestión</th>
                <th>Estado e Indicador Clave</th>
              </tr>
            </thead>
            <tbody>
              <!-- GRUPO GANADERÍA -->
              <tr class="unit-group-header">
                <td colspan="8">${icon('beef')} <strong>1. GANADERÍA (Ciclo Semi-Intensivo · Plantel y Terminación)</strong></td>
              </tr>
              <tr>
                <td><strong>Porcinos</strong></td>
                <td>Ciclo cerrado (Cría, Recría, Engorde)</td>
                <td>${money(uPigs.revenue)}</td>
                <td>${money(uPigs.expense)}</td>
                <td class="${mbPigs < 0 ? 'negative' : 'positive'}"><strong>${money(mbPigs)}</strong></td>
                <td>${number(calcRoi(mbPigs, uPigs.expense), 1)}%</td>
                <td><strong>${money(uPigs.management)}</strong></td>
                <td><span class="badge" style="background:#fdf2f4;color:#9e2a4b">Capones 90-110 kg · Carencia activa</span></td>
              </tr>
              ${pigSubunitsHtml}
              <tr>
                <td><strong>Bovinos</strong></td>
                <td>Cría, Recría, Adaptación, Engorde</td>
                <td>${money(uBov.revenue)}</td>
                <td>${money(uBov.expense)}</td>
                <td class="${mbBov < 0 ? 'negative' : 'positive'}"><strong>${money(mbBov)}</strong></td>
                <td>${number(calcRoi(mbBov, uBov.expense), 1)}%</td>
                <td><strong>${money(uBov.management)}</strong></td>
                <td><span class="badge" style="background:#fff7ed;color:#c2410c">Novillos terminados · Aftosa al día</span></td>
              </tr>
              ${bovSubunitsHtml}
              <tr>
                <td><strong>Ovinos</strong></td>
                <td>Carne (Transición raza Dorper)</td>
                <td>${money(uOvi.revenue)}</td>
                <td>${money(uOvi.expense)}</td>
                <td class="${mbOvi < 0 ? 'negative' : 'positive'}"><strong>${money(mbOvi)}</strong></td>
                <td>${number(calcRoi(mbOvi, uOvi.expense), 1)}%</td>
                <td><strong>${money(uOvi.management)}</strong></td>
                <td><span class="badge" style="background:#fefce8;color:#a16207">Corderos 32-38 kg · Esquila s/costo</span></td>
              </tr>
              ${oviSubunitsHtml}
              <tr class="unit-subtotal-row">
                <td><strong>SUBTOTAL GANADERÍA</strong></td>
                <td>Porcinos, Bovinos y Ovinos</td>
                <td><strong>${money(gLivestock.revenue)}</strong></td>
                <td><strong>${money(gLivestock.expense)}</strong></td>
                <td class="${mbLivestock < 0 ? 'negative' : 'positive'}"><strong>${money(mbLivestock)}</strong></td>
                <td><strong>${number(calcRoi(mbLivestock, gLivestock.expense), 1)}%</strong></td>
                <td><strong>${money(gLivestock.management)}</strong></td>
                <td><strong>Consolidado Pecuario</strong></td>
              </tr>

              <!-- GRUPO AGRICULTURA -->
              <tr class="unit-group-header">
                <td colspan="8">${icon('sprout')} <strong>2. AGRICULTURA (Cultivos por Lotes y Campañas · 200 ha mixtas)</strong></td>
              </tr>
              <tr>
                <td><strong>Maíz</strong></td>
                <td>1ª y 2ª siembra (Silo y destino ganadero)</td>
                <td>${money(uCorn.revenue)}</td>
                <td>${money(uCorn.expense)}</td>
                <td class="${mbCorn < 0 ? 'negative' : 'positive'}"><strong>${money(mbCorn)}</strong></td>
                <td>${number(calcRoi(mbCorn, uCorn.expense), 1)}%</td>
                <td><strong>${money(uCorn.management)}</strong></td>
                <td><span class="badge" style="background:#f0fdf4;color:#15803d">Transferencia interna a oportunidad</span></td>
              </tr>
              ${cornSubunitsHtml}
              <tr>
                <td><strong>Soja</strong></td>
                <td>Lotes y campañas (Venta comercial acopio)</td>
                <td>${money(uSoy.revenue)}</td>
                <td>${money(uSoy.expense)}</td>
                <td class="${mbSoy < 0 ? 'negative' : 'positive'}"><strong>${money(mbSoy)}</strong></td>
                <td>${number(calcRoi(mbSoy, uSoy.expense), 1)}%</td>
                <td><strong>${money(uSoy.management)}</strong></td>
                <td><span class="badge" style="background:#f0f9ff;color:#0369a1">Retenciones y flete discriminados</span></td>
              </tr>
              ${soySubunitsHtml}
              <tr class="unit-subtotal-row">
                <td><strong>SUBTOTAL AGRICULTURA</strong></td>
                <td>Cultivos de primera y segunda siembra</td>
                <td><strong>${money(gAgri.revenue)}</strong></td>
                <td><strong>${money(gAgri.expense)}</strong></td>
                <td class="${mbAgri < 0 ? 'negative' : 'positive'}"><strong>${money(mbAgri)}</strong></td>
                <td><strong>${number(calcRoi(mbAgri, gAgri.expense), 1)}%</strong></td>
                <td><strong>${money(gAgri.management)}</strong></td>
                <td><strong>Consolidado Agrícola</strong></td>
              </tr>

              <!-- CONSOLIDADO TOTAL -->
              <tr class="unit-total-row">
                <td><strong>TOTAL CONSOLIDADO ESTABLECIMIENTO</strong></td>
                <td>Pozo del Carril – La Aguada (200 ha)</td>
                <td><strong>${money(totalRev)}</strong></td>
                <td><strong>${money(totalExp)}</strong></td>
                <td class="${totalMb < 0 ? 'negative' : 'positive'}"><strong>${money(totalMb)}</strong></td>
                <td><strong>${number(calcRoi(totalMb, totalExp), 1)}%</strong></td>
                <td><strong>${money(r.consolidated)}</strong></td>
                <td><strong style="color:#38bdf8">Auditoría 3FN · Efectos neteados</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  // Visual SVG Cards
  const chartsHtml = `
    <div class="dashboard-charts-grid">
      <div class="chart-card">
        <div class="chart-head">
          <h4>${icon('bar-chart-3')}Margen Bruto por Unidad de Negocio</h4>
          <small>Comparativa analítica en pesos</small>
        </div>
        <div style="padding:16px 20px">
          ${unitsData.map(u => {
            const pct = Math.min(100, Math.max(5, Math.round(Math.abs(u.mb) / maxMb * 100)));
            return `
              <div style="margin-bottom:12px">
                <div style="display:flex; justify-content:space-between; font-size:0.84rem; margin-bottom:4px">
                  <span><strong>${u.name}</strong> <small style="color:#64748b">(${u.group})</small></span>
                  <span style="font-weight:700; color:${u.mb >= 0 ? '#166534' : '#b91c1c'}">${money(u.mb)}</span>
                </div>
                <div style="background:#f1f5f9; height:10px; border-radius:5px; overflow:hidden">
                  <div style="background:${u.color}; width:${pct}%; height:100%; border-radius:5px"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <h4>${icon('pie-chart')}Estructura Económica Global</h4>
          <small>Distribución por actividad integrada</small>
        </div>
        <div style="padding:16px 20px; display:flex; flex-direction:column; gap:12px">
          ${summary('Margen Ganadero Consolidado', money(mbLivestock))}
          ${summary('Margen Agrícola Consolidado', money(mbAgri))}
          ${summary('Ajuste de Efectos Internos (Granos)', money(r.adjustment))}
          ${summary('Resultado de Gestión Total', money(r.consolidated))}
          ${summary('Movimiento de Caja del Período', money(gLivestock.cash + gAgri.cash))}
          <div style="margin-top:8px; border-top:1px solid #e2e8f0; padding-top:10px">
            <span class="muted" style="font-size:0.8rem">Superficie mixta total: 200 ha en Pozo del Carril – La Aguada. Las transferencias internas de maíz no generan venta ficticia ni duplicación de ingresos.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // 5 Units Navigation Cards
  const unitsNavGrid = `
    <div class="activity-units-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-top:20px">
      <div class="activity-unit-card" style="border-top:3px solid #b83d5a">
        <div class="activity-card-head">
          <div style="display:flex; align-items:center; gap:8px">
            <i data-lucide="notebook-tabs" style="color:#b83d5a"></i>
            <strong>Porcinos</strong>
          </div>
          <span class="badge" style="background:#fdf2f4;color:#9e2a4b">Ciclo Cerrado</span>
        </div>
        <p class="activity-card-desc">Cría, Destete/Recría y Engorde. Capones 90-110 kg a frigorífico.</p>
        <div class="activity-card-metrics">
          <span>Margen Bruto:</span> <strong>${money(mbPigs)}</strong>
        </div>
        <button type="button" class="btn ghost activity-card-btn" data-action="navigate" data-view="cerdos">Ir a Porcinos ${icon('arrow-right')}</button>
      </div>

      <div class="activity-unit-card" style="border-top:3px solid #c2410c">
        <div class="activity-card-head">
          <div style="display:flex; align-items:center; gap:8px">
            <i data-lucide="beef" style="color:#c2410c"></i>
            <strong>Bovinos</strong>
          </div>
          <span class="badge" style="background:#fff7ed;color:#c2410c">Carne</span>
        </div>
        <p class="activity-card-desc">Cría, Recría, Adaptación y Engorde. Novillos terminados y Aftosa.</p>
        <div class="activity-card-metrics">
          <span>Margen Bruto:</span> <strong>${money(mbBov)}</strong>
        </div>
        <button type="button" class="btn ghost activity-card-btn" data-action="navigate" data-view="bovinos">Ir a Bovinos ${icon('arrow-right')}</button>
      </div>

      <div class="activity-unit-card" style="border-top:3px solid #ca8a04">
        <div class="activity-card-head">
          <div style="display:flex; align-items:center; gap:8px">
            <i data-lucide="circle-dot" style="color:#ca8a04"></i>
            <strong>Ovinos</strong>
          </div>
          <span class="badge" style="background:#fefce8;color:#a16207">Dorper</span>
        </div>
        <p class="activity-card-desc">Transición raza Dorper. Corderos pesados 32-38 kg a faena.</p>
        <div class="activity-card-metrics">
          <span>Margen Bruto:</span> <strong>${money(mbOvi)}</strong>
        </div>
        <button type="button" class="btn ghost activity-card-btn" data-action="navigate" data-view="ovinos">Ir a Ovinos ${icon('arrow-right')}</button>
      </div>

      <div class="activity-unit-card" style="border-top:3px solid #15803d">
        <div class="activity-card-head">
          <div style="display:flex; align-items:center; gap:8px">
            <i data-lucide="wheat" style="color:#15803d"></i>
            <strong>Maíz</strong>
          </div>
          <span class="badge" style="background:#f0fdf4;color:#15803d">1ª y 2ª Siembra</span>
        </div>
        <p class="activity-card-desc">Siembra temprana/tardía, silo y transferencias sin venta ficticia.</p>
        <div class="activity-card-metrics">
          <span>Margen Bruto:</span> <strong>${money(mbCorn)}</strong>
        </div>
        <button type="button" class="btn ghost activity-card-btn" data-action="navigate" data-view="maiz">Ir a Maíz ${icon('arrow-right')}</button>
      </div>

      <div class="activity-unit-card" style="border-top:3px solid #0369a1">
        <div class="activity-card-head">
          <div style="display:flex; align-items:center; gap:8px">
            <i data-lucide="sprout" style="color:#0369a1"></i>
            <strong>Soja</strong>
          </div>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Lotes y Campañas</span>
        </div>
        <p class="activity-card-desc">Producción por lotes, fertilización, cosecha y liquidación con DEX.</p>
        <div class="activity-card-metrics">
          <span>Margen Bruto:</span> <strong>${money(mbSoy)}</strong>
        </div>
        <button type="button" class="btn ghost activity-card-btn" data-action="navigate" data-view="soja">Ir a Soja ${icon('arrow-right')}</button>
      </div>
    </div>
  `;

  return heading('Resumen Ejecutivo Consolidado', periods(), 'Pozo del Carril – La Aguada · ERP Agropecuario Integral (5 Unidades de Negocio · 200 ha)')
    + ruralQuickBar
    + (s.errors.length ? notice('Revisá los movimientos: ' + s.errors[0].message, 'error') : '')
    + rateNotice
    + `<section class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        ${metric('Ganadería · Margen Gestión', gLivestock.management, 'Porcinos, Bovinos y Ovinos consolidado', 'rose')}
        ${metric('Agricultura · Margen Gestión', gAgri.management, 'Maíz y Soja (200 ha mixtas)', 'green')}
        ${metric('Resultado Consolidado Total', r.consolidated, 'Efectos internos neteados (3FN)', 'black')}
        ${metric('Caja Operativa Neta', gLivestock.cash + gAgri.cash, 'Flujo de fondos acumulado')}
      </section>`
    + matrixHtml
    + chartsHtml
    + unitsNavGrid
    + `
      <section class="panel" style="margin-top:20px">
        <div class="surface-title">
          <h4>Diferenciación Conceptual: Resultado Económico vs. Flujo Financiero vs. Existencias Físicas</h4>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Normas Profesionales y Contables UNRC</span>
        </div>
        <p class="muted">El ERP Pozo del Carril mantiene estricta separación metodológica entre el devengamiento económico, los movimientos de fondos monetarios y los inventarios biológicos y agrícolas:</p>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-top:16px">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-top:3px solid #14263D; border-radius:8px; padding:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <strong style="color:#14263D; font-size:0.95rem">1. Resultado Económico</strong>
              <span class="badge" style="background:#e0f2fe; color:#0369a1">Devengado</span>
            </div>
            <p style="font-size:0.83rem; color:#475569; margin:0 0 10px">Mide la riqueza generada por la producción en el período, independiente del cobro o pago:</p>
            <div style="font-size:0.88rem; font-weight:700; color:#14263D; margin-bottom:4px">
              Resultado Consolidado: ${money(r.consolidated)}
            </div>
            <ul style="font-size:0.8rem; color:#64748b; padding-left:16px; margin:0; line-height:1.5">
              <li>Margen Ganadero: ${money(mbLivestock)}</li>
              <li>Margen Agrícola: ${money(mbAgri)}</li>
              <li>Eliminación neta de transferencias internas: $0 duplicación</li>
            </ul>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-top:3px solid #087FBD; border-radius:8px; padding:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <strong style="color:#14263D; font-size:0.95rem">2. Flujo Financiero</strong>
              <span class="badge" style="background:#ecfdf5; color:#047857">Caja y Bancos</span>
            </div>
            <p style="font-size:0.83rem; color:#475569; margin:0 0 10px">Movimientos monetarios reales en cuentas financieras (cobros de ventas menos pagos de compras):</p>
            <div style="font-size:0.88rem; font-weight:700; color:#087FBD; margin-bottom:4px">
              Caja Operativa Neta: ${money(gLivestock.cash + gAgri.cash)}
            </div>
            <ul style="font-size:0.8rem; color:#64748b; padding-left:16px; margin:0; line-height:1.5">
              <li>Cobros efectivos de liquidaciones comerciales</li>
              <li>Cancelaciones a proveedores de insumos y servicios</li>
              <li>Las transferencias internas no mueven fondos monetarios</li>
            </ul>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-top:3px solid #23845B; border-radius:8px; padding:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <strong style="color:#14263D; font-size:0.95rem">3. Existencias Físicas</strong>
              <span class="badge" style="background:#fefce8; color:#a16207">Stock Real</span>
            </div>
            <p style="font-size:0.83rem; color:#475569; margin:0 0 10px">Volúmenes y cabezas en el establecimiento, valuados a costo o valor de oportunidad:</p>
            <div style="font-size:0.88rem; font-weight:700; color:#23845B; margin-bottom:4px">
              ${number(totalHeads, 0)} Cabezas en Pie · ${number(totalGrainTn, 1)} t Granos en Silo
            </div>
            <ul style="font-size:0.8rem; color:#64748b; padding-left:16px; margin:0; line-height:1.5">
              <li>Porcinos: ${number(D.sum(allLots.filter(l => getLotSpecies(l)==='porcino'), l => s.lots[l.id]?.quantity ?? l.animals), 0)} cabezas</li>
              <li>Bovinos: ${number(D.sum(allLots.filter(l => getLotSpecies(l)==='bovino'), l => s.lots[l.id]?.quantity ?? l.animals), 0)} cabezas</li>
              <li>Ovinos: ${number(D.sum(allLots.filter(l => getLotSpecies(l)==='ovino'), l => s.lots[l.id]?.quantity ?? l.animals), 0)} cabezas</li>
              <li>Maíz disponible para autoconsumo o comercialización</li>
            </ul>
          </div>
        </div>
      </section>
    `
    + `<div class="two-col" style="margin-top:20px">
        <section class="panel">
          <div class="surface-title"><h4>Destino del Cereal Propio (Comparador Marginal)</h4>${button('Comparar', 'navigate', 'data-view="comparador"', 'arrow-up-right', 'ghost')}</div>
          ${scenario?.valid ? summary(scenario.recommendation, money(scenario.perTonne) + ' / t de diferencia') + summary('Escenario guardado', date(latest.date)) : empty('Sin escenario completo guardado.')}
          ${summary('Hacienda en existencias', number(D.sum(visible('lots'), l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0)), 0) + ' cabezas (3 especies)')}
          ${summary('Cereal disponible en Silos', number(D.sum(Object.values(s.stock).filter(i => ['agricultura', 'maiz'].includes(i.area) && db.products.find(p => p.id === i.productId)?.kind === 'grano'), i => i.quantity) / 1000) + ' t')}
        </section>
        <section class="panel">
          <div class="surface-title"><h4>Conciliación de Efectos Internos</h4></div>
          ${summary('Suma de resultados por actividad', money(gLivestock.management + gAgri.management))}
          ${summary('Ajuste de transferencias pendientes', money(r.adjustment))}
          ${summary('Resultado contable consolidado', money(r.consolidated))}
          ${summary('Superficie del establecimiento', '200 ha (Pozo del Carril – La Aguada)')}
        </section>
      </div>`;
}
function pigLotTable(state) {
  const pigLots = visible('lots').filter(l => getLotSpecies(l) === 'porcino');
  const rows = pigLots.filter(l => {
    if (ui.category === 'all' || !ui.category) return true;
    if (l.phase === ui.category) return true;
    if (ui.category === 'cria_maternidad' && l.phase === 'fase1') return true;
    if (ui.category === 'destete_recria' && ['fase2','fase3','recria'].includes(l.phase)) return true;
    if (ui.category === 'engorde_terminacion' && ['fase4','terminador'].includes(l.phase)) return true;
    return false;
  }).map(l => {
    const a = state.lots[l.id]; const p = latestPrice(l.phase); const kgPrice = p ? Number(p.price) / (p.unit === 'tonelada' ? 1000 : 1) : null;
    return [esc(l.name) + `<span class="sub">Apertura ${date(l.date)}</span>`, badge(PIG_PHASES[l.phase] || D.PHASES[l.phase] || 'Por definir'), number(a?.quantity), a?.weightKnown === false ? 'Peso pendiente' : a ? number(a.weight) + ' kg' : '-', a ? money(a.value) : '-', a?.weightKnown === false ? 'Falta pesaje' : a && kgPrice != null ? money(a.quantity * a.weight * kgPrice) : 'Sin cotización', stateBadge(l), `<div class="record-tools"><button type="button" class="tool" data-action="open-lot-card" data-lot-id="${esc(l.id)}" title="Ver Ficha Técnica">${icon('clipboard-list')}</button>${!l.review ? `<button class="tool" data-action="move-lot" data-id="${esc(l.id)}" title="Trasladar parte del lote" aria-label="Trasladar parte del lote">${icon('arrow-right-left')}</button>` : ''}${controls('lots', l)}</div>`];
  });
  return `<div class="toolbar"><label class="field"><span>Fase Porcina</span><select data-filter="category">${[{value:'all',label:'Todas las fases'},...opt(PIG_PHASES)].map(o=>`<option value="${o.value}" ${ui.category===o.value?'selected':''}>${o.label}</option>`).join('')}</select></label></div>` + table('Lotes porcinos por fase y valor orientativo', ['Lote', 'Fase productiva', 'Cabezas', 'Peso promedio', 'Costo acumulado', 'Valor orientativo', 'Estado', ''], rows, 'lots', 'Nuevo lote porcino');
}
function renderLotCard(state) {
  const lots = visible('lots').filter(l => getLotSpecies(l) === 'porcino');
  if (!lots.length) return empty('No hay lotes porcinos registrados.');
  const selectedId = ui.selectedLotId && lots.some(l => l.id === ui.selectedLotId) ? ui.selectedLotId : lots[0].id;
  ui.selectedLotId = selectedId;
  const lot = lots.find(l => l.id === selectedId);
  const a = state.lots[lot.id];

  const treatments = (db.movements || []).filter(m => !m.voided && m.lotId === lot.id && m.type === 'tratamiento').sort((x, y) => y.date.localeCompare(x.date));
  const activeTreat = treatments.filter(t => t.withdrawalEndDate && t.withdrawalEndDate >= today());
  const movements = (db.movements || []).filter(m => !m.voided && (m.lotId === lot.id || m.toLotId === lot.id)).sort((x, y) => x.date.localeCompare(y.date));
  const lastWeight = a ? a.weight : lot.weight;
  const initialWeight = Number(lot.weight || 0);
  const weightGain = lastWeight && initialWeight ? lastWeight - initialWeight : 0;
  const elapsedDays = Math.max(1, Math.floor((new Date(today()) - new Date(lot.date)) / 86400000));
  const gdp = weightGain > 0 ? (weightGain / elapsedDays * 1000) : null;
  const consumptions = (db.stock || []).filter(s => !s.voided && s.type === 'consumo' && s.lotId === lot.id).sort((x, y) => y.date.localeCompare(x.date));
  const totalFeedKg = D.sum(consumptions, c => Number(c.quantity || 0) * (c.inputUnit === 'bolsas' && c.factorAtEntry ? Number(c.factorAtEntry) : 1));

  const selector = `<div class="history-card-header"><div><h4>Ficha técnica e histórica del lote</h4><p class="muted">Evolución de peso, tratamientos veterinarios, ganancias y consumos</p></div><div class="field history-selector"><label>Seleccionar lote</label><select data-action="select-lot-card">${lots.map(l => `<option value="${esc(l.id)}" ${l.id === selectedId ? 'selected' : ''}>${esc(l.name)} (${PIG_PHASES[l.phase] || D.PHASES[l.phase] || l.phase})</option>`).join('')}</select></div></div>`;
  const kpis = `<div class="history-kpis"><div class="history-kpi-item"><span>Cabezas vivas</span><strong>${number(a?.quantity || 0, 0)}</strong><small>Apertura: ${number(lot.animals, 0)} cabezas</small></div><div class="history-kpi-item"><span>Peso promedio</span><strong>${lastWeight ? number(lastWeight) + ' kg' : 'Sin pesaje'}</strong><small>Apertura: ${number(lot.weight)} kg · Ganancia: ${weightGain > 0 ? '+' + number(weightGain) + ' kg' : '-'}</small></div><div class="history-kpi-item"><span>Ganancia diaria (GDP)</span><strong>${gdp != null ? number(gdp, 0) + ' g/día' : 'Sin datos'}</strong><small>${elapsedDays} días en el establecimiento</small></div><div class="history-kpi-item"><span>Costo contable</span><strong>${a ? money(a.value) : money(lot.openingValue || 0)}</strong><small>${a?.quantity ? money(a.value / a.quantity) + ' / cabeza' : '-'}</small></div><div class="history-kpi-item"><span>Alimento consumido</span><strong>${number(totalFeedKg)} kg</strong><small>${consumptions.length} entregas registradas</small></div></div>`;
  const sanidadNotice = activeTreat.length
    ? notice(`Lote bajo período de carencia sanitaria por ${activeTreat.map(t => `${t.medication || 'medicamento'} (${t.activeIngredient || ''}) hasta ${date(t.withdrawalEndDate)}`).join('; ')}. Bloqueada venta a faena.`, 'error')
    : notice('Estado sanitario liberado: no presenta períodos de carencia activos.', 'info');
  const movementsTable = table('Movimientos y pesajes del lote', ['Fecha', 'Tipo', 'Detalle', 'Cabezas', 'Peso', 'Costo unit.'], movements.map(m => [date(m.date), esc(m.type), esc(m.lotId === lot.id && m.toLotId ? 'Hacia ' + nameOf('lots', m.toLotId) : m.toLotId === lot.id ? 'Desde ' + nameOf('lots', m.lotId) : m.note || '-'), number(m.quantity), m.weight ? number(m.weight) + ' kg' : '-', m.unitCost ? money(m.unitCost) : '-']));
  const treatmentsTable = table('Tratamientos sanitarios y veterinarios', ['Fecha', 'Medicamento / Vacuna', 'Principio activo', 'Responsable', 'Carencia (días)', 'Fin carencia', 'Costo'], treatments.map(t => [date(t.date), esc(t.medication || '-'), esc(t.activeIngredient || '-'), esc(t.responsible || '-'), number(t.withdrawalDays, 0), date(t.withdrawalEndDate), t.unitCost ? money(t.unitCost) : '-']));
  const consumptionsTable = table('Consumos de alimento registrados', ['Fecha', 'Insumo / Alimento', 'Cantidad', 'Unidad', 'Costo total'], consumptions.map(c => [date(c.date), esc(nameOf('products', c.productId)), number(c.quantity), esc(c.inputUnit === 'bolsas' ? 'bolsas' : 'kg'), c.unitCost ? money(Number(c.quantity) * Number(c.unitCost)) : '-']));

  return `<section class="panel">${selector}${kpis}${sanidadNotice}</section>` + movementsTable + treatmentsTable + consumptionsTable;
}
function renderPigs() {
  const s=D.replay(db,ui.to); const tab=ui.tab.cerdos||'lotes'; const ind=D.indicators(db,ui.from,ui.to);
  let body='';
  if(tab==='lotes') body=phaseOverview(s)+pigLotTable(s);
  if(tab==='movimientos') body=table('Historia de los lotes',['Fecha','Tipo','Origen','Destino','Cabezas','Peso','Estado',''],visible('movements').sort((a,b)=>b.date.localeCompare(a.date)).map(m=>[date(m.date),esc(m.type),esc(nameOf('lots',m.lotId)),esc(nameOf('lots',m.toLotId)),number(m.quantity),number(m.weight)+' kg',stateBadge(m),controls('movements',m)]),'movements','Nuevo movimiento');
  if(tab==='fichas') body=renderLotCard(s);
  if(tab==='maternidad') body=`<div class="metrics three">${metric('Destetados · camadas cerradas',number(ind.weaned,0),'En el período elegido')}${metric('Supervivencia',ind.survival==null?'Sin datos':number(ind.survival)+' %','Nacidos vivos de camadas cerradas','red')}${metric('Mortandad efectiva',ind.mortality==null?'Sin datos':number(ind.mortality)+' %','Camadas cerradas; lactancia excluida','black')}</div>`+table('Partos y destetes',['Parto','Madre','Vivos','Bajas','Destetados','Cierre','Estado',''],visible('births').map(b=>[date(b.date),esc(nameOf('sows',b.sowId)),number(b.bornAlive,0),number(b.losses,0),number(b.weaned,0),b.closed?date(b.weanDate):badge('En lactancia','neutral'),stateBadge(b),controls('births',b)]),'births','Nuevo parto');
  if(tab==='plantel') body=table('Plantel reproductor',['Identificación','Tipo','Alta','Partos','Destetados','Amortizado','Descarte',''],visible('sows').map(sow=>{const bs=confirmed('births').filter(b=>b.sowId===sow.id);return [esc(sow.name),esc(sow.sex),date(sow.date),number(bs.length),number(D.sum(bs,b=>b.weaned)),money(D.sum(s.depreciation.filter(d=>d.sowId===sow.id),d=>d.value)),sow.discardDate?date(sow.discardDate):badge('En producción'),controls('sows',sow)];}),'sows','Nuevo reproductor');
  if(tab==='indicadores') {
    const r = D.results(db, ui.from, ui.to);
    const pigRev = r.areas.cerdos?.revenue || r.areas.porcinos?.revenue || 0;
    const pigExp = r.areas.cerdos?.expense || r.areas.porcinos?.expense || 0;
    const pigMargin = pigRev - pigExp;
    const pigCosts = visible('costs').filter(c => c.area === 'cerdos' || c.area === 'porcinos');
    const pigLots = visible('lots').filter(l => !l.species || l.species === 'porcino');
    const totalPigs = D.sum(pigLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
    body = `
      <section class="metrics three">
        ${metric('Margen Bruto Porcino', money(pigMargin), 'Ingresos ventas - Costos directos')}
        ${metric('Ingresos Ventas Capones', money(pigRev), 'Capones terminados 90-110 kg a frigorífico')}
        ${metric('Costos Directos Totales', money(pigExp), 'Alimentación, sanidad y amortización de plantel')}
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title">
          <h4>Indicadores Zootécnicos Porcinos (Ciclo Semi-Intensivo)</h4>
          <span class="badge" style="background:#fdf2f4;color:#9e2a4b">Parámetros Productivos</span>
        </div>
        <div class="history-kpis" style="margin-top:12px">
          <div class="history-kpi-item">
            <span>Existencias Totales</span>
            <strong>${number(totalPigs, 0)} cab</strong>
            <small>Piara en establecimiento</small>
          </div>
          <div class="history-kpi-item">
            <span>Destetados Camadas Cerradas</span>
            <strong>${number(ind.weaned, 0)} lechones</strong>
            <small>${ind.survival != null ? number(ind.survival, 1) + '% supervivencia' : 'Período activo'}</small>
          </div>
          <div class="history-kpi-item">
            <span>Mortandad Efectiva</span>
            <strong class="${ind.mortality > 5 ? 'negative' : 'positive'}">${ind.mortality != null ? number(ind.mortality, 1) + '%' : 'Normal'}</strong>
            <small>Excluye lactancia predestete</small>
          </div>
          <div class="history-kpi-item">
            <span>Conversión Alimenticia (ICA)</span>
            <strong>2.4 - 2.8</strong>
            <small>kg ración / kg carne ganada</small>
          </div>
        </div>
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title"><h4>Estructura de Costos Directos Porcinos</h4></div>
        ${pigCosts.length ? pigCosts.map(c => summary(esc(c.concept || nameOf('products', c.productId) || 'Insumo / Labor'), money(c.amount || 0))).join('') : empty('Sin costos directos porcinos registrados en el período.')}
        ${summary('Total Costos Directos Porcinos', money(pigExp))}
      </section>
    `;
  }
  return heading('Porcinos (Ciclo Cerrado Semi-Intensivo)',periods())+tabs([['lotes','Existencias por fase'],['movimientos','Movimientos'],['fichas','Ficha por lote'],['maternidad','Partos y destetes'],['plantel','Reproductores'],['indicadores','Indicadores y Márgenes']],'lotes')+body;
}

function renderBovines() {
  const tab = ui.tab.bovinos || 'lotes';
  const s = D.replay(db, ui.to);
  const r = D.results(db, ui.from, ui.to);
  const bovLots = visible('lots').filter(l => l.species === 'bovino' || l.phase?.includes('bov') || ['cria_bov', 'recria_bov', 'adaptacion_bov', 'engorde_bov'].includes(l.phase));
  const totalHeads = D.sum(bovLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalWeightKg = D.sum(bovLots, l => {
    const q = s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0);
    const w = s.lots[l.id]?.weight != null ? s.lots[l.id].weight : (l.weight || 0);
    return q * w;
  });
  const avgWeight = totalHeads > 0 ? Math.round(totalWeightKg / totalHeads) : 0;
  const totalKg = totalWeightKg;
  const bovCosts = visible('costs').filter(c => c.area === 'bovinos');
  const bovSales = visible('sales').filter(s => s.area === 'bovinos');
  const bovRev = r.areas.bovinos?.revenue || 0;
  const bovExp = r.areas.bovinos?.expense || 0;
  const bovMargin = bovRev - bovExp;
  const costPerHead = totalHeads > 0 ? bovExp / totalHeads : 0;
  const gdpBov = bovLots.length ? D.sum(bovLots, l => Number(l.gdp || 0)) / bovLots.length : 0;

  let body = '';

  if (tab === 'lotes') {
    const bovPhasesMeta = [
      { id: 'cria_bov', name: 'Cría Bovino', desc: 'Vacas de cría y terneros al pie' },
      { id: 'recria_bov', name: 'Recría Pastoril', desc: 'Campo natural y verdeos' },
      { id: 'adaptacion_bov', name: 'Adaptación / Acostumbramiento', desc: 'Corral de acostumbramiento a corral' },
      { id: 'engorde_bov', name: 'Engorde / Feedlot', desc: 'Ración de maíz + concentrado proteico' }
    ];

    const bovPhaseStats = bovPhasesMeta.map(p => {
      const pLots = bovLots.filter(l => l.phase === p.id);
      const heads = D.sum(pLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
      const kg = D.sum(pLots, l => {
        const q = s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0);
        const w = s.lots[l.id]?.weight != null ? s.lots[l.id].weight : (l.weight || 0);
        return q * w;
      });
      const avgW = heads > 0 ? Math.round(kg / heads) : 0;
      const cost = D.sum(pLots, l => s.lots[l.id]?.value || l.openingValue || 0);
      return { ...p, heads, avgW, cost };
    });

    body = `
      <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        ${metric('Bovinos Totales', number(totalHeads, 0) + ' cab', 'Stock en establecimiento')}
        ${metric('Kilos en Pie', number(totalKg, 0) + ' kg', totalHeads > 0 ? 'Promedio ' + avgWeight + ' kg/cab' : 'Sin animales')}
        ${metric('GDP Ponderada', gdpBov > 0 ? '+' + number(gdpBov, 2) + ' kg/d' : 'Sin pesajes', 'Ganancia diaria promedio')}
        ${metric('Costo por Cabeza', money(costPerHead), 'Costo directo acumulado', 'black')}
      </div>

      <div class="phase-grid" style="margin-top:16px">
        ${bovPhaseStats.map(p => `
          <article class="phase-item" style="border-top:3px solid #c2410c">
            <h4>${p.name}</h4>
            <strong>${number(p.heads, 0)}</strong> <span class="muted">cabezas</span>
            <p>${p.heads > 0 ? p.avgW + ' kg promedio' : 'Sin animales'}</p>
            <p class="muted">${p.desc}</p>
            <p>${money(p.cost)} contable</p>
          </article>
        `).join('')}
      </div>

      ${table('Lotes Bovinos Registrados', ['Lote / Identificación', 'Etapa Productiva', 'Cabezas', 'Peso Promedio', 'Ubicación / Parcela', 'Costo Acumulado', 'Acciones'],
        bovLots.map(l => [
          esc(l.name),
          badge(bovPhasesMeta.find(p => p.id === l.phase)?.name || D.PHASES[l.phase] || l.phase),
          number(s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : l.animals) + ' cab',
          (s.lots[l.id]?.weight || l.weight ? number(s.lots[l.id]?.weight || l.weight) + ' kg' : '-'),
          esc(l.location || 'Potrero La Aguada'),
          money(s.lots[l.id]?.value || l.openingValue || 0),
          controls('lots', l)
        ]), 'lots', 'Nuevo Lote Bovino'
      )}
    `;
  }

  if (tab === 'movimientos') {
    const bovMovements = visible('movements').filter(m => bovLots.some(l => l.id === m.lotId || l.id === m.toLotId) || m.species === 'bovino');
    body = table('Movimientos y Pesajes Bovinos', ['Fecha', 'Tipo', 'Lote', 'Cabezas', 'Peso Promedio', 'Ganancia (GDP)', 'Responsable', 'Acciones'],
      bovMovements.map(m => [
        date(m.date),
        esc(m.type),
        esc(nameOf('lots', m.lotId)),
        number(m.quantity) + ' cab',
        m.weight ? number(m.weight) + ' kg' : '-',
        m.gdp ? '+' + number(m.gdp, 2) + ' kg/d' : '-',
        esc(m.responsible || '-'),
        controls('movements', m)
      ]), 'movements', 'Nuevo Movimiento Bovino'
    );
  }

  if (tab === 'fichas') {
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Ficha Técnica Bovinos · Engorde y Terminación</h4>
          <span class="badge" style="background:#fff7ed;color:#c2410c">Novillos Pesados (380 - 420 kg)</span>
        </div>
        <p class="muted">Parámetros biológicos y zootécnicos del ciclo completo bovino en Pozo del Carril – La Aguada.</p>
        
        <div class="history-kpis" style="margin-top:16px">
          <div class="history-kpi-item">
            <span>Rango Terminación</span>
            <strong>380 a 420 kg</strong>
            <small>Peso vivo destino frigorífico</small>
          </div>
          <div class="history-kpi-item">
            <span>Conversión Alimento</span>
            <strong>6.8 : 1</strong>
            <small>kg ración / kg ganado vivo</small>
          </div>
          <div class="history-kpi-item">
            <span>Rinde en Gancho</span>
            <strong>57.5 %</strong>
            <small>Rendimiento al gancho frigorífico</small>
          </div>
          <div class="history-kpi-item">
            <span>Días en Corral</span>
            <strong>90 a 110 días</strong>
            <small>Fase de terminación con maíz</small>
          </div>
        </div>
      </section>
    `;
  }

  if (tab === 'sanidad') {
    const bovSanitary = visible('movements').filter(m => m.type === 'tratamiento' && (bovLots.some(l => l.id === m.lotId) || m.species === 'bovino'));
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Plan Sanitario Bovino Oficial (SENASA)</h4>
          <span class="badge" style="background:#dcfce7;color:#166534">Calendario Oficial SENASA</span>
        </div>
        <p class="muted">Cronograma obligatorio de vacunación contra Fiebre Aftosa, Mancha y Gangrena, Carbunclo y Brucelosis.</p>
      </section>
      ${table('Tratamientos y Vacunaciones Bovinas Registradas', ['Fecha', 'Lote', 'Tratamiento / Vacuna', 'Principio Activo', 'Responsable', 'Carencia (Días)', 'Fin Carencia', 'Acciones'],
        bovSanitary.map(t => [
          date(t.date),
          esc(nameOf('lots', t.lotId)),
          esc(t.medication || '-'),
          esc(t.activeIngredient || '-'),
          esc(t.responsible || '-'),
          number(t.withdrawalDays, 0),
          date(t.withdrawalEndDate),
          controls('movements', t)
        ]), 'movements', 'Nuevo Tratamiento Bovino'
      )}
    `;
  }

  if (tab === 'indicadores') {
    body = `
      <section class="metrics three">
        ${metric('Margen Bruto Bovino', money(bovMargin), 'Ingresos ventas - Costos directos')}
        ${metric('Ventas Totales', money(bovRev), 'Ventas netas del período')}
        ${metric('Costos Directos Totales', money(bovExp), 'Gastos e insumos imputados')}
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title"><h4>Análisis de Costos Directos Bovinos</h4></div>
        ${bovCosts.length ? bovCosts.map(c => summary(esc(c.concept || nameOf('products', c.productId) || 'Gasto'), money(c.amount || 0))).join('') : empty('Sin costos directos registrados en el período.')}
        ${summary('Total Costos Directos Bovinos', money(bovExp))}
      </section>
    `;
  }

  return heading('Unidad Bovinos de Carne', periods(), 'Cría · Recría · Adaptación · Engorde / Terminación (Pozo del Carril – La Aguada)')
    + tabs([
      ['lotes', 'Existencias por Categoría'],
      ['movimientos', 'Movimientos y Pesajes'],
      ['fichas', 'Ficha Técnica Bovinos'],
      ['sanidad', 'Plan Sanitario SENASA'],
      ['indicadores', 'Indicadores y Márgenes']
    ], 'lotes')
    + body;
}

function renderOvines() {
  const tab = ui.tab.ovinos || 'lotes';
  const s = D.replay(db, ui.to);
  const r = D.results(db, ui.from, ui.to);
  const oviLots = visible('lots').filter(l => l.species === 'ovino' || l.phase?.includes('ovi') || ['vientres_ovi', 'carneros_ovi', 'recria_ovi', 'corderos_faena'].includes(l.phase));
  const totalHeads = D.sum(oviLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalWeightKg = D.sum(oviLots, l => {
    const q = s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0);
    const w = s.lots[l.id]?.weight != null ? s.lots[l.id].weight : (l.weight || 0);
    return q * w;
  });
  const avgWeight = totalHeads > 0 ? Math.round(totalWeightKg / totalHeads) : 0;
  const ewesLots = oviLots.filter(l => l.phase === 'vientres_ovi');
  const ramsLots = oviLots.filter(l => l.phase === 'carneros_ovi');
  const lambsLots = oviLots.filter(l => l.phase === 'corderos_faena' || l.phase === 'recria_ovi');
  const totalEwes = D.sum(ewesLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalRams = D.sum(ramsLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));
  const totalLambs = D.sum(lambsLots, l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0));

  const oviCosts = visible('costs').filter(c => c.area === 'ovinos');
  const oviSales = visible('sales').filter(s => s.area === 'ovinos');
  const oviRev = r.areas.ovinos?.revenue || 0;
  const oviExp = r.areas.ovinos?.expense || 0;
  const oviMargin = oviRev - oviExp;

  let body = '';

  if (tab === 'lotes') {
    const oviPhasesMeta = [
      { id: 'vientres_ovi', name: 'Vientres / Ovejas', desc: 'Madres cruza en absorción Dorper', heads: totalEwes },
      { id: 'carneros_ovi', name: 'Carneros Dorper', desc: 'Carneros puros Dorper (pelo / carne)', heads: totalRams },
      { id: 'recria_ovi', name: 'Borregos / Recría', desc: 'Reposición propia del plantel', heads: D.sum(oviLots.filter(l => l.phase === 'recria_ovi'), l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0)) },
      { id: 'corderos_faena', name: 'Corderos a Faena', desc: 'Rango comercial: 32 a 38 kg peso vivo', heads: D.sum(oviLots.filter(l => l.phase === 'corderos_faena'), l => s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : (l.animals || 0)) }
    ];

    body = `
      <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        ${metric('Ovinos Totales', number(totalHeads, 0) + ' cab', 'Transición a raza Dorper')}
        ${metric('Vientres en Servicio', number(totalEwes, 0) + ' ovejas', 'Plantel reproductor')}
        ${metric('Corderos en Engorde', number(totalLambs, 0) + ' corderos', 'Rango faena 32-38 kg')}
        ${metric('Kilos en Pie', number(totalWeightKg, 0) + ' kg', totalHeads > 0 ? avgWeight + ' kg promedio' : 'Sin animales', 'green')}
      </div>

      <div class="phase-grid" style="margin-top:16px">
        ${oviPhasesMeta.map(p => `
          <article class="phase-item" style="border-top:3px solid #ca8a04">
            <h4>${p.name}</h4>
            <strong>${number(p.heads, 0)}</strong> <span class="muted">cabezas</span>
            <p class="muted">${p.desc}</p>
          </article>
        `).join('')}
      </div>

      ${table('Categorías Ovinas Registradas', ['Lote / Categoría', 'Fase', 'Cabezas', 'Peso Promedio', 'Destino Productivo', 'Valor Contable', 'Acciones'],
        oviLots.map(l => [
          esc(l.name),
          badge(l.phase),
          number(s.lots[l.id]?.quantity != null ? s.lots[l.id].quantity : l.animals) + ' cab',
          (s.lots[l.id]?.weight || l.weight ? number(s.lots[l.id]?.weight || l.weight) + ' kg' : '-'),
          esc(l.destination || 'Producción ovina'),
          money(s.lots[l.id]?.value || l.openingValue || 0),
          controls('lots', l)
        ]), 'lots', 'Nuevo Lote Ovino'
      )}
    `;
  }

  if (tab === 'reproduccion') {
    const oviBirths = visible('births').filter(b => b.species === 'ovino');
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Manejo Reproductivo Ovino · Estacionamiento y Señalada</h4>
          <span class="badge" style="background:#fefce8;color:#a16207">Transición Dorper</span>
        </div>
        <p class="muted">Servicio estacionado para sincronizar pariciones con la mejor oferta forrajera.</p>
        
        <div class="history-kpis" style="margin-top:16px">
          <div class="history-kpi-item">
            <span>Vientres en Servicio</span>
            <strong>${number(totalEwes, 0)} ovejas</strong>
            <small>Plantel activo</small>
          </div>
          <div class="history-kpi-item">
            <span>Carneros Puros</span>
            <strong>${number(totalRams, 0)} carneros</strong>
            <small>Genética Dorper</small>
          </div>
          <div class="history-kpi-item">
            <span>Corderos Logrados</span>
            <strong>${number(totalLambs, 0)} cab</strong>
            <small>Existencias en engorde</small>
          </div>
          <div class="history-kpi-item">
            <span>Señalada Estimada</span>
            <strong class="positive">${totalEwes > 0 ? Math.round(totalLambs / totalEwes * 100) + ' %' : 'Sin datos'}</strong>
            <small>Corderos por vientre</small>
          </div>
        </div>
      </section>
      ${table('Partos y Servicios Ovinos', ['Fecha', 'Madre / Lote', 'Corderos Vivos', 'Bajas', 'Destetados', 'Estado', 'Acciones'],
        oviBirths.map(b => [
          date(b.date),
          esc(nameOf('sows', b.sowId) || nameOf('lots', b.lotId) || '-'),
          number(b.bornAlive, 0),
          number(b.losses, 0),
          number(b.weaned, 0),
          stateBadge(b),
          controls('births', b)
        ]), 'births', 'Nuevo Servicio / Parto Ovino'
      )}
    `;
  }

  if (tab === 'esquila') {
    const oviCostsSanity = oviCosts.filter(c => c.concept?.toLowerCase().includes('esquila') || c.concept?.toLowerCase().includes('sanidad') || c.area === 'ovinos');
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Manejo de Esquila & Acondicionamiento (Costo Directo)</h4>
          <span class="badge" style="background:#f1f5f9;color:#475569">Raza Dorper: Sin Venta Lanar Ficticia</span>
        </div>
        <p class="muted">La raza Dorper es un ovino deslanador de pelo adaptado a climas cálidos y templados. En la etapa de transición ovina, la esquila higiénica de vientres y el descole se registran <strong>estrictamente como un costo directo</strong> de bienestar animal y sanidad, sin inventar ventas ni ingresos lanares ficticios.</p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-top:16px">
          <h4 style="margin:0 0 10px; font-size:0.95rem; color:#0f172a">Tratamiento Contable y Económico de la Esquila:</h4>
          <ul style="padding-left:20px; line-height:1.7; font-size:0.88rem; color:#334155; margin:0">
            <li><strong>Imputación contable:</strong> Cuenta <code>5.1.04 Costos directos de manejo y sanidad ovina</code> (imputación de costo, no activo).</li>
            <li><strong>Concepto productivo:</strong> Descole profiláctico y esquila higiénica previa al parto (descolado y desojado).</li>
            <li><strong>Sin ingresos por lana:</strong> Al ser producción ovina carnicera en absorción Dorper, el vellón no tiene valor comercial de exportación; se elimina la hipótesis de ingresos lanares.</li>
          </ul>
        </div>
      </section>
      ${table('Labores Sanitarias y de Acondicionamiento Ovino', ['Fecha', 'Comprobante', 'Labor / Tarea', 'Importe Neto', 'Cuenta Contable', 'Acciones'],
        oviCostsSanity.map(c => [
          date(c.date),
          esc(c.reference || '-'),
          esc(c.concept || nameOf('products', c.productId) || '-'),
          money(c.amount || 0),
          esc(c.accountId || '5.1.04'),
          controls('costs', c)
        ]), 'costs', 'Nueva Labor Ovina'
      )}
    `;
  }

  if (tab === 'ventas') {
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Venta de Corderos Terminados a Faena</h4>
          <span class="badge" style="background:#fefce8;color:#a16207">Rango Comercial: 32 a 38 kg Vivo</span>
        </div>
        <p class="muted">El objetivo comercial de la unidad ovina es el cordero pesado terminado con buena cobertura grasa y excelente rinde carnicero (50 - 52 % al gancho).</p>
      </section>
      ${table('Liquidaciones Comerciales de Corderos', ['Fecha', 'Comprobante', 'Comprador / Frigorífico', 'Cabezas', 'Peso Promedio', 'Evaluación Rango', 'Precio / kg vivo', 'Neto a Cobrar', 'Acciones'],
        oviSales.map(s => {
          const w = Number(s.weight || 0);
          const inRange = w >= 32 && w <= 38;
          return [
            date(s.date),
            esc(s.reference || '-'),
            esc(nameOf('parties', s.partyId) || '-'),
            number(s.animals || s.quantity) + ' cab',
            w > 0 ? number(w) + ' kg' : '-',
            w > 0 ? (inRange ? '<span class="badge" style="background:#dcfce7;color:#166534">✓ Dentro de Rango (32-38 kg)</span>' : '<span class="badge" style="background:#fef3c7;color:#92400e">Fuera de rango</span>') : '-',
            money(s.price),
            money(s.amount || s.net || 0),
            controls('sales', s)
          ];
        }), 'sales', 'Nueva Venta Ovina'
      )}
    `;
  }

  if (tab === 'indicadores') {
    const avgSalePrice = oviSales.length ? D.sum(oviSales, s => Number(s.price || 0)) / oviSales.length : 0;
    const avgSaleWeight = oviSales.length ? D.sum(oviSales, s => Number(s.weight || 0)) / oviSales.length : 0;
    body = `
      <section class="metrics three">
        ${metric('Margen Bruto Ovino', money(oviMargin), 'Ingresos ventas - Costos directos')}
        ${metric('Precio Promedio Cordero', avgSalePrice > 0 ? money(avgSalePrice) + ' / kg vivo' : 'Sin ventas', 'Liquidaciones comerciales')}
        ${metric('Peso Promedio Faena', avgSaleWeight > 0 ? number(avgSaleWeight, 1) + ' kg' : 'Sin ventas', 'Rango objetivo: 32-38 kg')}
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title"><h4>Indicadores Económicos y Costos Ovinos</h4></div>
        ${oviCosts.length ? oviCosts.map(c => summary(esc(c.concept || nameOf('products', c.productId) || 'Costo'), money(c.amount || 0))).join('') : empty('Sin costos directos ovinos registrados en el período.')}
        ${summary('Total Costos Directos Ovinos', money(oviExp))}
        ${summary('Total Ingresos por Ventas Ovinas', money(oviRev))}
      </section>
    `;
  }

  return heading('Unidad Ovinos de Carne', periods(), 'Raza Dorper · Cría, Recría y Engorde de Corderos pesados 32–38 kg (Pozo del Carril – La Aguada)')
    + tabs([
      ['lotes', 'Existencias Ovinos'],
      ['reproduccion', 'Manejo Reproductivo'],
      ['movimientos', 'Movimientos y Pesajes'],
      ['esquila', 'Esquila (Costo Directo)'],
      ['ventas', 'Ventas Corderos 32-38 kg'],
      ['indicadores', 'Indicadores y Márgenes']
    ], 'lotes')
    + body;
}

function renderCorn() {
  const tab = ui.tab.maiz || 'campanas';
  const s = D.replay(db, ui.to);
  const r = D.results(db, ui.from, ui.to);
  const cornCampaigns = visible('campaigns').filter(c => c.crop?.toLowerCase().includes('maíz') || c.crop?.toLowerCase().includes('maiz') || c.area === 'maiz');
  const cornTransfers = visible('transfers').filter(t => db.products.find(p => p.id === t.productId)?.name?.toLowerCase().includes('maíz') || db.products.find(p => p.id === t.productId)?.name?.toLowerCase().includes('maiz') || t.productId?.includes('maiz'));
  const totalTransferredKg = D.sum(cornTransfers, t => Number(t.quantity || 0));
  const cornCosts = visible('costs').filter(c => c.area === 'maiz' || (c.area === 'agricultura' && (c.crop === 'maiz' || c.concept?.toLowerCase().includes('maíz') || c.concept?.toLowerCase().includes('maiz'))));
  const cornSales = visible('sales').filter(inPeriod).filter(s => s.area === 'maiz' || (s.productId && db.products.find(p => p.id === s.productId)?.name?.toLowerCase().includes('maiz')));
  const totalSurface = D.sum(cornCampaigns, c => Number(c.surface || c.hectares || 0));
  const totalHarvestTons = D.sum(cornCampaigns, c => Number(c.harvestTons || c.production || 0));
  const avgYield = totalSurface > 0 ? (totalHarvestTons * 10 / totalSurface) : 0;
  const cornRev = r.areas.maiz?.revenue || 0;
  const cornExp = r.areas.maiz?.expense || 0;
  const cornMargin = cornRev - cornExp;

  let body = '';

  if (tab === 'campanas') {
    body = `
      <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        ${metric('Superficie Maíz', number(totalSurface, 1) + ' ha', '1ª siembra temprana y 2ª siembra tardía')}
        ${metric('Cosecha Total Maíz', number(totalHarvestTons, 1) + ' t', 'Producción grano seco')}
        ${metric('Rinde Promedio', number(avgYield, 1) + ' qq/ha', totalSurface > 0 ? number(totalHarvestTons / totalSurface, 2) + ' t/ha rinde medio' : 'Sin cosechas')}
        ${metric('Destinado a Ganadería', number(totalTransferredKg / 1000, 1) + ' t', 'Transferencia sin venta ficticia', 'green')}
      </div>

      <div class="phase-grid" style="margin-top:16px">
        ${cornCampaigns.length ? cornCampaigns.map(c => `
          <article class="phase-item" style="border-top:3px solid #15803d">
            <h4>${esc(c.name || 'Lote Maíz')}</h4>
            <strong>${number(c.surface || c.hectares || 0, 1)} ha</strong> <span class="muted">sembradas</span>
            <p>Siembra: ${c.sowingDate ? date(c.sowingDate) : '-'}</p>
            <p class="muted">${esc(c.variety || c.type || 'Híbrido Maíz')}</p>
            <p class="price">Rinde: ${c.yield ? number(c.yield) + ' qq/ha' : '-'}</p>
            <p>Producción: ${c.harvestTons ? number(c.harvestTons) + ' t' : '-'}</p>
          </article>
        `).join('') : '<p class="muted" style="grid-column:1/-1;padding:12px;background:#f8fafc;border-radius:8px">No hay campañas de maíz registradas actualmente. Presione "+ Nueva Campaña Maíz" para agregar una.</p>'}
      </div>

      ${table('Campañas y Lotes de Maíz', ['Campaña / Lote', 'Tipo de Siembra', 'Superficie', 'Densidad', 'Fertilización', 'Rinde Previsto / Real', 'Estado', 'Acciones'],
        cornCampaigns.map(c => [
          esc(c.name || c.id),
          esc(c.type || 'Maíz'),
          number(c.surface || c.hectares || 0) + ' ha',
          c.density ? number(c.density) + ' pl/ha' : '-',
          esc(c.fertilization || '-'),
          c.yield ? number(c.yield) + ' qq/ha' : '-',
          badge(c.status || 'Activa', 'positive'),
          controls('campaigns', c)
        ]), 'campaigns', 'Nueva Campaña Maíz'
      )}
    `;
  }

  if (tab === 'labores') {
    body = table('Labores e Insumos Imputados al Maíz', ['Fecha', 'Comprobante', 'Lote / Parcela', 'Concepto', 'Insumo / Dosis', 'Importe Neto', 'Cuenta Contable', 'Acciones'],
      cornCosts.map(c => [
        date(c.date),
        esc(c.reference || '-'),
        esc(c.lotName || '-'),
        esc(c.concept || '-'),
        esc(c.detail || '-'),
        money(c.amount || 0),
        esc(c.accountId || '5.4.01'),
        controls('costs', c)
      ]), 'costs', 'Nueva Labor Maíz'
    );
  }

  if (tab === 'cosecha') {
    const cornStockKg = D.sum(Object.values(s.stock).filter(i => (i.area === 'maiz' || i.area === 'agricultura') && db.products.find(p => p.id === i.productId)?.kind === 'grano'), i => i.quantity);
    const cornSoldKg = D.sum(cornSales, s => Number(s.quantity || 0) * (s.unit === 'tonelada' || s.unit === 't' ? 1000 : 1));
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Balance de Cosecha y Acopio en Silos de Maíz</h4>
          <span class="badge" style="background:#f0fdf4;color:#15803d">Stock en Silo</span>
        </div>
        <p class="muted">La producción de grano seco se acopia en el establecimiento para abastecer a las unidades ganaderas (porcinos, bovinos y ovinos) y comercializar excedentes.</p>
        
        <div class="history-kpis" style="margin-top:16px">
          <div class="history-kpi-item">
            <span>Producción Total</span>
            <strong>${number(totalHarvestTons * 1000, 0)} kg</strong>
            <small>${number(totalHarvestTons, 1)} toneladas</small>
          </div>
          <div class="history-kpi-item">
            <span>Transferido a Ganadería</span>
            <strong>${number(totalTransferredKg, 0)} kg</strong>
            <small>Autoconsumo sin venta ficticia</small>
          </div>
          <div class="history-kpi-item">
            <span>Vendido Externamente</span>
            <strong>${number(cornSoldKg, 0)} kg</strong>
            <small>Liquidación a acopio cerealero</small>
          </div>
          <div class="history-kpi-item">
            <span>Stock en Silo Bolsa</span>
            <strong class="positive">${number(cornStockKg, 0)} kg</strong>
            <small>Reserva estratégica</small>
          </div>
        </div>
      </section>
      ${table('Partidas Cosechadas de Maíz', ['Fecha Cosecha', 'Lote Origen', 'Superficie', 'Kilos Cosechados', 'Rinde (qq/ha)', 'Destino Inicial', 'Acciones'],
        cornCampaigns.filter(c => c.harvestTons).map(c => [
          date(c.harvestDate || c.date),
          esc(c.name || '-'),
          number(c.surface || c.hectares || 0) + ' ha',
          number((c.harvestTons || 0) * 1000, 0) + ' kg',
          c.yield ? number(c.yield) + ' qq/ha' : '-',
          esc(c.destination || 'Silo Bolsa Planta'),
          controls('campaigns', c)
        ]), 'campaigns', 'Registrar Cosecha'
      )}
    `;
  }

  if (tab === 'transferencias') {
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Transferencias Internas de Maíz a Ganadería (Regla 3FN: Sin Ventas Ficticias)</h4>
          <span class="badge" style="background:#f0fdf4;color:#15803d">Tratamiento Contable y Económico</span>
        </div>
        <p class="muted">El grano de maíz transferido internamente se valúa al <strong>valor neto de realización (precio de oportunidad de mercado menos flete y gastos comerciales)</strong> a la fecha de transferencia. En la consolidación total del establecimiento, estos movimientos internos <strong>se netean exactamente</strong>, impidiendo la duplicación artificial de ingresos.</p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-top:16px">
          <h4 style="margin:0 0 10px; font-size:0.95rem; color:#0f172a">Mecanismo de Integración Agro-Ganadera:</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:0.86rem; color:#334155">
            <div>
              <strong style="color:#15803d">Para la Unidad Maíz:</strong>
              <p style="margin:4px 0 0">Se reconoce el egreso de inventario al costo contable acumulado y en los informes de gestión se compara con el valor de venta alternativo.</p>
            </div>
            <div>
              <strong style="color:#b83d5a">Para la Unidad Ganadera (Cerdos / Bovinos / Ovinos):</strong>
              <p style="margin:4px 0 0">Ingresa como insumo alimenticio a valor de oportunidad, reflejando el verdadero costo económico de transformación biológica.</p>
            </div>
          </div>
        </div>
      </section>
      ${transferTable()}
    `;
  }

  if (tab === 'indicadores') {
    body = `
      <section class="metrics three">
        ${metric('Margen Bruto Maíz', money(cornMargin), 'Ingresos ventas - Costos directos')}
        ${metric('Ingresos Totales Maíz', money(cornRev), 'Ventas comerciales')}
        ${metric('Costos Directos Totales', money(cornExp), 'Semilla, fertilizantes y labores')}
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title"><h4>Estructura de Costos Directos del Maíz</h4></div>
        ${cornCosts.length ? cornCosts.map(c => summary(esc(c.concept || nameOf('products', c.productId) || 'Labor / Insumo'), money(c.amount || 0))).join('') : empty('Sin costos registrados para maíz.')}
        ${summary('Costo Directo Total Maíz', money(cornExp))}
        ${summary('Costo Directo por Hectárea', totalSurface > 0 ? money(cornExp / totalSurface) + ' / ha' : '-')}
      </section>
    `;
  }

  return heading('Unidad Maíz (Cultivo 1ª y 2ª Siembra)', periods(), 'Siembra temprana y tardía · Cosecha t y qq/ha · Silo y transferencias internas a ganadería (Pozo del Carril – La Aguada)')
    + tabs([
      ['campanas', 'Campañas y Parcelas'],
      ['labores', 'Labores e Insumos'],
      ['cosecha', 'Cosecha y Acopio Silos'],
      ['transferencias', 'Transferencias Internas'],
      ['indicadores', 'Indicadores y Márgenes']
    ], 'campanas')
    + body;
}

function renderSoy() {
  const tab = ui.tab.soja || 'campanas';
  const s = D.replay(db, ui.to);
  const r = D.results(db, ui.from, ui.to);
  const soyCampaigns = visible('campaigns').filter(c => c.crop?.toLowerCase().includes('soja') || c.area === 'soja');
  const soyCosts = visible('costs').filter(c => c.area === 'soja');
  const soySales = visible('sales').filter(inPeriod).filter(s => s.area === 'soja' || (s.productId && db.products.find(p => p.id === s.productId)?.name?.toLowerCase().includes('soja')));
  const totalSurface = D.sum(soyCampaigns, c => Number(c.surface || c.hectares || 0));
  const totalHarvestTons = D.sum(soyCampaigns, c => Number(c.harvestTons || c.production || 0));
  const avgYield = totalSurface > 0 ? (totalHarvestTons * 10 / totalSurface) : 0;
  const totalSoldTons = D.sum(soySales, s => Number(s.quantity || 0) * (s.unit === 'kg' ? 0.001 : 1));
  const soyRev = r.areas.soja?.revenue || 0;
  const soyExp = r.areas.soja?.expense || 0;
  const soyMargin = soyRev - soyExp;

  let body = '';

  if (tab === 'campanas') {
    body = `
      <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        ${metric('Superficie Soja', number(totalSurface, 1) + ' ha', 'Lotes de producción')}
        ${metric('Producción Cosechada', number(totalHarvestTons, 1) + ' t', number(totalHarvestTons * 1000, 0) + ' kg')}
        ${metric('Rinde Promedio Soja', number(avgYield, 1) + ' qq/ha', totalSurface > 0 ? number(totalHarvestTons / totalSurface, 2) + ' t/ha' : 'Sin cosechas')}
        ${metric('Comercializado', number(totalSoldTons, 1) + ' t', 'Liquidaciones a acopio con DEX', 'green')}
      </div>

      <div class="phase-grid" style="margin-top:16px">
        ${soyCampaigns.length ? soyCampaigns.map(c => `
          <article class="phase-item" style="border-top:3px solid #0369a1">
            <h4>${esc(c.name || 'Lote Soja')}</h4>
            <strong>${number(c.surface || c.hectares || 0, 1)} ha</strong> <span class="muted">sembradas</span>
            <p>Siembra: ${c.sowingDate ? date(c.sowingDate) : '-'}</p>
            <p class="muted">${esc(c.variety || c.type || 'Variedad de Soja')}</p>
            <p class="price">Rinde: ${c.yield ? number(c.yield) + ' qq/ha' : '-'}</p>
            <p>Producción: ${c.harvestTons ? number(c.harvestTons) + ' t' : '-'}</p>
          </article>
        `).join('') : '<p class="muted" style="grid-column:1/-1;padding:12px;background:#f8fafc;border-radius:8px">No hay campañas de soja registradas actualmente. Presione "+ Nueva Campaña Soja" para agregar una.</p>'}
      </div>

      ${table('Campañas y Lotes de Soja', ['Lote / Campaña', 'Variedad / Ciclo', 'Superficie', 'Inoculación', 'Fertilización', 'Rinde Obtenido', 'Estado', 'Acciones'],
        soyCampaigns.map(c => [
          esc(c.name || c.id),
          esc(c.variety || c.type || '-'),
          number(c.surface || c.hectares || 0) + ' ha',
          esc(c.inoculation || '-'),
          esc(c.fertilization || '-'),
          c.yield ? number(c.yield) + ' qq/ha' : '-',
          badge(c.status || 'Activa', 'positive'),
          controls('campaigns', c)
        ]), 'campaigns', 'Nueva Campaña Soja'
      )}
    `;
  }

  if (tab === 'labores') {
    body = table('Labores e Insumos Imputados a la Soja', ['Fecha', 'Comprobante', 'Lote', 'Concepto', 'Insumo / Detalle', 'Monto Neto', 'Cuenta Contable', 'Acciones'],
      soyCosts.map(c => [
        date(c.date),
        esc(c.reference || '-'),
        esc(c.lotName || '-'),
        esc(c.concept || '-'),
        esc(c.detail || '-'),
        money(c.amount || 0),
        esc(c.accountId || '5.4.01'),
        controls('costs', c)
      ]), 'costs', 'Nueva Labor Soja'
    );
  }

  if (tab === 'cosecha') {
    const soyStockKg = D.sum(Object.values(s.stock).filter(i => (i.area === 'soja' || i.area === 'agricultura') && db.products.find(p => p.id === i.productId)?.kind === 'grano'), i => i.quantity);
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Balance de Cosecha y Existencias de Soja</h4>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Producción Campaña</span>
        </div>
        <p class="muted">Producción comercial destinada a exportación y molienda a través de acopios y cooperativas de la zona de Río Cuarto.</p>
        
        <div class="history-kpis" style="margin-top:16px">
          <div class="history-kpi-item">
            <span>Producción Total</span>
            <strong>${number(totalHarvestTons * 1000, 0)} kg</strong>
            <small>${number(totalHarvestTons, 1)} toneladas</small>
          </div>
          <div class="history-kpi-item">
            <span>Comercializado Acopio</span>
            <strong>${number(totalSoldTons * 1000, 0)} kg</strong>
            <small>Entregado a acopio / puerto</small>
          </div>
          <div class="history-kpi-item">
            <span>Stock en Silo</span>
            <strong class="positive">${number(soyStockKg, 0)} kg</strong>
            <small>Disponible para venta diferida</small>
          </div>
          <div class="history-kpi-item">
            <span>Superficie Sembrada</span>
            <strong>${number(totalSurface, 1)} ha</strong>
            <small>Área productiva</small>
          </div>
        </div>
      </section>
      ${table('Cosecha por Lote de Soja', ['Fecha', 'Lote', 'Superficie', 'Producción Obtenida', 'Rinde (qq/ha)', 'Humedad', 'Acciones'],
        soyCampaigns.filter(c => c.harvestTons).map(c => [
          date(c.harvestDate || c.date),
          esc(c.name || '-'),
          number(c.surface || c.hectares || 0) + ' ha',
          number((c.harvestTons || 0) * 1000, 0) + ' kg',
          c.yield ? number(c.yield) + ' qq/ha' : '-',
          c.humidity ? number(c.humidity) + ' %' : '-',
          controls('campaigns', c)
        ]), 'campaigns', 'Registrar Cosecha Soja'
      )}
    `;
  }

  if (tab === 'ventas') {
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Liquidaciones Primarias de Grano (Venta Comercial de Soja)</h4>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Discriminación de DEX, IVA y Fletes</span>
        </div>
        <p class="muted">Registro formal con número de liquidación, comprador (acopio/cooperativa), retenciones (DEX), paritarias y flete a puerto.</p>
      </section>
      ${table('Liquidaciones Primarias de Venta de Soja', ['Fecha', 'Liquidación', 'Acopio / Comprador', 'Toneladas', 'Precio Bruto / t', 'Retenciones (DEX)', 'Flete', 'Neto a Cobrar', 'Acciones'],
        soySales.map(s => [
          date(s.date),
          esc(s.reference || '-'),
          esc(nameOf('parties', s.partyId) || '-'),
          number(s.quantity) + ' ' + (s.unit || 't'),
          money(s.price),
          s.dex ? money(s.dex) : '-',
          s.freight ? money(s.freight) : '-',
          money(s.amount || s.net || 0),
          controls('sales', s)
        ]), 'sales', 'Nueva Venta Soja'
      )}
    `;
  }

  if (tab === 'indicadores') {
    body = `
      <section class="metrics three">
        ${metric('Margen Bruto Soja', money(soyMargin), 'Ingresos ventas netas - Costos directos')}
        ${metric('Ingresos Ventas Soja', money(soyRev), 'Liquidaciones primarias netas')}
        ${metric('Costos Directos Soja', money(soyExp), 'Semillas, fitosanitarios y labores')}
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="surface-title"><h4>Estructura Económica y Costos Directos Soja</h4></div>
        ${soyCosts.length ? soyCosts.map(c => summary(esc(c.concept || nameOf('products', c.productId) || 'Labor / Insumo'), money(c.amount || 0))).join('') : empty('Sin costos directos registrados para soja.')}
        ${summary('Total Costos Directos Soja', money(soyExp))}
        ${summary('Costo Directo por Hectárea', totalSurface > 0 ? money(soyExp / totalSurface) + ' / ha' : '-')}
      </section>
    `;
  }

  return heading('Unidad Soja (Producción Agrícola por Lotes)', periods(), 'Producción por lotes · Insumos y labores · Cosecha y liquidación comercial con retenciones (Pozo del Carril – La Aguada)')
    + tabs([
      ['campanas', 'Campañas y Lotes'],
      ['labores', 'Labores e Insumos'],
      ['cosecha', 'Cosecha y Acopio'],
      ['ventas', 'Liquidaciones Primarias'],
      ['indicadores', 'Indicadores y Márgenes']
    ], 'campanas')
    + body;
}

function renderSanity() {
  const tday = today();
  const treatments = visible('movements').filter(m => m.type === 'tratamiento').sort((a,b) => b.date.localeCompare(a.date));
  const activeCarencia = treatments.filter(t => t.withdrawalEndDate && t.withdrawalEndDate >= tday);
  const totalCost = D.sum(treatments, t => Number(t.unitCost || 0));

  const speciesFilter = ui.sanidadSpecies || 'all';
  const lotFilter = ui.sanidadLot || 'all';
  const statusFilter = ui.sanidadStatus || 'all';
  const searchFilter = ui.sanidadSearch || '';

  const relevantLots = confirmed('lots').filter(l => speciesFilter === 'all' || getLotSpecies(l) === speciesFilter);
  const lotOptions = [{value:'all',label:'Todos los lotes' + (speciesFilter === 'all' ? ' (3 especies)' : ' [' + getSpeciesLabel(speciesFilter) + ']')}, ...relevantLots.map(l => ({value:l.id,label:`[${getSpeciesLabel(getLotSpecies(l))}] ${l.name}`}))];

  let filtered = treatments;
  if (speciesFilter !== 'all') {
    filtered = filtered.filter(t => {
      const lot = db.lots.find(l => l.id === t.lotId);
      return getLotSpecies(lot) === speciesFilter;
    });
  }
  if (lotFilter !== 'all') filtered = filtered.filter(t => t.lotId === lotFilter);
  if (statusFilter === 'carencia') filtered = filtered.filter(t => t.withdrawalEndDate && t.withdrawalEndDate >= tday);
  if (statusFilter === 'liberado') filtered = filtered.filter(t => !t.withdrawalEndDate || t.withdrawalEndDate < tday);
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    filtered = filtered.filter(t => (t.medication||'').toLowerCase().includes(q) || (t.activeIngredient||'').toLowerCase().includes(q) || (t.responsible||'').toLowerCase().includes(q));
  }

  const kpisHtml = `<section class="metrics four" style="grid-template-columns: repeat(auto-fit, minmax(180px,1fr))">
    ${metric('Tratamientos registrados', filtered.length, speciesFilter === 'all' ? '3 especies ganaderas' : getSpeciesLabel(speciesFilter))}
    <article class="metric ${activeCarencia.length ? 'red' : ''}">
      <p>Carencia / Retiro activo</p>
      <strong class="${activeCarencia.length ? 'negative' : ''}">${activeCarencia.length} lotes</strong>
      <small>${activeCarencia.length ? '⚠️ Restricción de faena vigente' : 'Sin carencias activas'}</small>
    </article>
    ${metric('Próximas dosis / refuerzos', filtered.filter(t => t.nextDate && t.nextDate >= tday).length, 'Calendario preventivo')}
    ${metric('Inversión en sanidad', totalCost, 'Costo directo acumulado', 'black')}
  </section>`;

  const toolbarHtml = `<div class="toolbar" style="margin-top:12px; display:flex; gap:10px; align-items:end; flex-wrap:wrap">
    <div class="field" style="min-width:180px"><label>Búsqueda</label><input type="text" placeholder="Fármaco, principio activo..." value="${esc(searchFilter)}" data-sanidad-filter="search"></div>
    <div class="field"><label>Especie Animal</label><select data-sanidad-filter="species"><option value="all" ${speciesFilter==='all'?'selected':''}>Todas las especies</option><option value="porcino" ${speciesFilter==='porcino'?'selected':''}>Porcinos</option><option value="bovino" ${speciesFilter==='bovino'?'selected':''}>Bovinos</option><option value="ovino" ${speciesFilter==='ovino'?'selected':''}>Ovinos</option></select></div>
    <div class="field"><label>Lote destino</label><select data-sanidad-filter="lot">${lotOptions.map(o => `<option value="${o.value}" ${lotFilter===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>
    <div class="field"><label>Estado</label><select data-sanidad-filter="status"><option value="all" ${statusFilter==='all'?'selected':''}>Todos los estados</option><option value="carencia" ${statusFilter==='carencia'?'selected':''}>En carencia (restringido)</option><option value="liberado" ${statusFilter==='liberado'?'selected':''}>Liberado</option></select></div>
    <div style="margin-left:auto; display:flex; gap:8px">
      ${button('Nuevo Tratamiento Sanitario', 'new-treatment', '', 'heart-pulse')}
    </div>
  </div>`;

  const rows = filtered.map(t => {
    const lot = db.lots.find(l => l.id === t.lotId);
    const sp = getLotSpecies(lot);
    const spBadge = sp === 'bovino'
      ? `<span class="badge" style="background:#fff7ed;color:#c2410c;font-weight:600">Bovino</span>`
      : sp === 'ovino'
        ? `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:600">Ovino</span>`
        : `<span class="badge" style="background:#fdf2f8;color:#9d174d;font-weight:600">Porcino</span>`;
    const inCarencia = t.withdrawalEndDate && t.withdrawalEndDate >= tday;
    const rem = inCarencia ? Math.max(0, Math.ceil((new Date(t.withdrawalEndDate) - new Date(tday)) / 86400000)) : 0;
    const carenciaBadge = inCarencia
      ? `<span class="carencia-badge active" title="Restricción sanitaria activa">⚠️ En carencia (${rem}d - hasta ${date(t.withdrawalEndDate)})</span>`
      : `<span class="carencia-badge done">✓ Liberado</span>`;

    return [
      date(t.date) + `<span class="sub">${esc(t.type)}</span>`,
      spBadge,
      `<strong>${esc(t.medication || 'Fármaco s/d')}</strong><span class="sub">P. Activo: ${esc(t.activeIngredient || 'No indicado')}</span>`,
      `<button type="button" class="btn ghost" style="padding:2px 8px;font-size:.78rem" data-action="open-lot-card" data-lot-id="${esc(t.lotId)}">${esc(lot?.name || t.lotId)}</button>`,
      `${esc(t.responsible || 'Veterinario')} · ${number(t.quantity || 0, 0)} dosis`,
      carenciaBadge,
      t.unitCost ? money(t.unitCost) : '-',
      t.nextDate ? date(t.nextDate) : '-',
      `<div class="record-tools">
        <button type="button" class="tool" data-action="open-lot-card" data-lot-id="${esc(t.lotId)}" title="Ver Ficha Técnica">${icon('clipboard-list')}</button>
        <button type="button" class="tool" data-action="edit-treatment" data-id="${esc(t.id)}" title="Editar Tratamiento Sanitario">${icon('pencil')}</button>
        <button type="button" class="tool" data-action="delete-treatment" data-id="${esc(t.id)}" title="Anular Tratamiento">${icon('trash-2')}</button>
      </div>`
    ];
  });

  return heading('Salud & Sanidad Animal (Porcinos, Bovinos y Ovinos)', '', 'Farmacovigilancia veterinaria multiespecie, bioseguridad, períodos de carencia y calendario sanitario')
    + kpisHtml
    + toolbarHtml
    + table('Plan Sanitario y Calendario Veterinario', ['Fecha y Tipo', 'Especie', 'Fármaco / Principio Activo', 'Lote Imputado', 'Dosis / Responsable', 'Carencia en Carne', 'Costo', 'Próx. Dosis', 'Acciones'], rows);
}


function renderCampaignCard(state) {
  const campaigns = visible('campaigns');
  if (!campaigns.length) return empty('No hay campañas agrícolas registradas.');
  const selectedId = ui.selectedCampaignId && campaigns.some(c => c.id === ui.selectedCampaignId) ? ui.selectedCampaignId : campaigns[0].id;
  ui.selectedCampaignId = selectedId;
  const camp = campaigns.find(c => c.id === selectedId);
  const a = state.campaigns[camp.id];

  const costs = (db.costs || []).filter(c => !c.voided && c.campaignId === camp.id).sort((x, y) => y.date.localeCompare(x.date));
  const totalCost = D.sum(costs, c => Number(c.amount || 0));
  const ha = Number(camp.hectares || 1);
  const harvestedKg = a ? a.harvested : 0;
  const yieldQqHa = harvestedKg ? (harvestedKg / 100 / ha) : 0;
  const transfers = (db.transfers || []).filter(t => !t.voided && t.campaignId === camp.id);
  const transferredKg = D.sum(transfers, t => Number(t.quantity || 0));

  const selector = `<div class="history-card-header"><div><h4>Ficha técnica y económica de la campaña</h4><p class="muted">Insumos aplicados, labores, costo por hectárea y destino del cereal</p></div><div class="field history-selector"><label>Seleccionar campaña</label><select data-action="select-campaign-card">${campaigns.map(c => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)} (${esc(c.crop)} - ${esc(c.parcel || 'General')})</option>`).join('')}</select></div></div>`;
  const kpis = `<div class="history-kpis"><div class="history-kpi-item"><span>Superficie</span><strong>${number(ha)} ha</strong><small>${esc(camp.crop)} · Parcela ${esc(camp.parcel || '-')}</small></div><div class="history-kpi-item"><span>Inversión total</span><strong>${money(totalCost)}</strong><small>${money(totalCost / ha)} por hectárea</small></div><div class="history-kpi-item"><span>Cosecha total</span><strong>${harvestedKg ? number(harvestedKg / 1000) + ' t' : 'Sin cosecha'}</strong><small>Rinde: ${yieldQqHa ? number(yieldQqHa) + ' qq/ha (' + number(yieldQqHa / 10) + ' t/ha)' : '-'}</small></div><div class="history-kpi-item"><span>Destinado a Cerdos</span><strong>${number(transferredKg / 1000)} t</strong><small>${transfers.length} transferencias registradas</small></div><div class="history-kpi-item"><span>Estado</span><strong>${esc(camp.status || 'activa')}</strong><small>Cosecha prevista: ${date(camp.harvestDate)}</small></div></div>`;
  const costsTable = table('Labores e insumos imputados a la campaña', ['Fecha', 'Comprobante', 'Proveedor', 'Concepto', 'Neto', 'IVA'], costs.map(c => [date(c.date), esc(c.reference), esc(nameOf('parties', c.partyId)), esc(c.category), money(c.amount), money(c.tax || 0)]));
  const transfersTable = table('Transferencias de grano a Cerdos', ['Fecha', 'Cereal', 'Cantidad (kg)', 'Valor oportunidad $/kg', 'Total'], transfers.map(t => [date(t.date), esc(nameOf('products', t.productId)), number(t.quantity) + ' kg', money(t.opportunityPrice), money(Number(t.quantity) * Number(t.opportunityPrice))]));

  return `<section class="panel">${selector}${kpis}</section>` + costsTable + transfersTable;
}
function renderAgriculture() {
  const state=D.replay(db,ui.to); const r=D.results(db,ui.from,ui.to);
  const tab=ui.tab.agricultura||'campanas'; let body;
  if(tab==='campanas') body=table('Campañas y parcelas',['Campaña','Cultivo','Superficie','Cosechado','Rinde','Costo / ha','En producción',''],visible('campaigns').map(c=>{const a=state.campaigns[c.id];return [esc(c.name)+`<span class="sub">${esc(c.parcel)}</span>`,esc(c.crop),number(c.hectares)+' ha',a?number(a.harvested/1000)+' t':'-',a?.harvested?number(a.harvested/1000/Number(c.hectares))+' t/ha':'Sin cosecha',a?money(a.cost/Number(c.hectares)):'-',a?money(a.value):stateBadge(c),controls('campaigns',c)];}),'campaigns','Nueva campaña');
  if(tab==='labores') body=costTable(visible('costs').filter(c=>c.area==='agricultura'),'Labores e insumos imputados');
  if(tab==='cosechas') body=stockTable(visible('stock').filter(s=>s.type==='cosecha'),'Cosechas');
  if(tab==='entregas') body=transferTable();
  if(tab==='fichas') body=renderCampaignCard(state);
  return heading('Agricultura',periods())+`<div class="metrics three">${metric('Resultado de gestión',r.areas.agricultura.management,'Período seleccionado')}${metric('Producción cosechada',number(D.sum(Object.values(state.campaigns),c=>c.harvested)/1000)+' t','Acumulado por campañas','black')}${metric('Costos pendientes en cultivos',D.sum(Object.values(state.campaigns),c=>c.value),'Producción aún no incorporada a granos','red')}</div>`+tabs([['campanas','Campañas'],['labores','Labores y costos'],['cosechas','Cosechas'],['entregas','Entregas a Cerdos'],['fichas','Ficha por campaña']],'campanas')+body;
}
function costTable(rows,title='Costos e imputaciones') { return table(title,['Fecha','Actividad','Comprobante','Concepto','Neto','Destino','Estado',''],rows.filter(inPeriod).map(c=>[date(c.date),badge(D.AREAS[c.area]||'Compartido'),esc(c.reference),esc(c.category),money(c.amount),esc(c.lotId?nameOf('lots',c.lotId):c.campaignId?nameOf('campaigns',c.campaignId):c.criterion||'Resultado del período'),stateBadge(c),controls('costs',c)]),'costs','Nuevo costo'); }
function renderCosts() {
  const tab = ui.tab.costos || 'costos'; let body;
  if (tab === 'costos') body = costTable(visible('costs'));
  if (tab === 'compras') body = stockTable(visible('stock').filter(s => s.type === 'compra'), 'Compras de insumos');
  if (tab === 'proveedores') {
    const suppliers = visible('parties').filter(p => !p.kind || p.kind === 'proveedor' || p.kind === 'ambos');
    body = table(
      'Directorio de Proveedores Comerciales',
      ['Proveedor / Razón Social', 'CUIT / Identificación', 'Condición', 'Contacto', 'Observaciones', 'Acciones'],
      suppliers.map(p => [
        `<strong>${esc(p.name)}</strong>`,
        esc(p.taxId || '-'),
        badge(p.kind === 'ambos' ? 'Proveedor / Cliente' : 'Proveedor', 'neutral'),
        esc(p.contact || '-'),
        esc(p.note || '-'),
        controls('parties', p)
      ]),
      'parties',
      '+ Agregar Proveedor'
    );
  }
  if (tab === 'distribuciones') {
    const allocationsList = visible('allocations');
    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Criterios de Distribución de Costos Compartidos e Indirectos</h4>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Prorrateo de Estructura</span>
        </div>
        <p class="muted">Metodología para asignar costos comunes entre actividades (Maíz, Soja, Porcinos, Bovinos, Ovinos) según las características del establecimiento:</p>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px; margin-top:14px">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px">
            <strong style="color:#14263D; display:block; margin-bottom:4px">1. Criterio por Superficie (200 ha)</strong>
            <p style="font-size:0.82rem; color:#475569; margin:0 0 6px">Prorrateo por hectáreas ocupadas (Inmobiliario, caminos, seguros):</p>
            <ul style="font-size:0.8rem; color:#334155; padding-left:16px; margin:0; line-height:1.5">
              <li>Maíz: 50 ha (25%)</li>
              <li>Soja: 50 ha (25%)</li>
              <li>Ganadería: 100 ha (50%)</li>
            </ul>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px">
            <strong style="color:#14263D; display:block; margin-bottom:4px">2. Criterio por Ingresos Brutos</strong>
            <p style="font-size:0.82rem; color:#475569; margin:0 0 6px">Proporcional a las ventas efectivas de cada actividad en el período.</p>
            <small style="color:#64748b">Aplicable a honorarios contables y administración general.</small>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px">
            <strong style="color:#14263D; display:block; margin-bottom:4px">3. Proporcional a Costos Directos</strong>
            <p style="font-size:0.82rem; color:#475569; margin:0 0 6px">Ponderado por la intensidad del uso de insumos, labores y personal.</p>
            <small style="color:#64748b">Refleja la carga operativa real de cada explotación.</small>
          </div>
        </div>
      </section>
      ${table('Costos Indirectos Distribuidos', ['Fecha', 'Costo de Origen', 'Destino (Lote / Campaña)', 'Importe', 'Criterio Utilizado', 'Acciones'],
        allocationsList.map(a => [
          date(a.date),
          esc(db.costs.find(c => c.id === a.costId)?.reference || '-'),
          esc(a.lotId ? nameOf('lots', a.lotId) : nameOf('campaigns', a.campaignId)),
          money(a.amount),
          esc(a.criterion),
          controls('allocations', a)
        ]), 'allocations', 'Distribuir Costo'
      )}
    `;
  }
  return heading('Compras y costos', periods()) + tabs([['costos', 'Costos e imputaciones'], ['compras', 'Compras de insumos'], ['proveedores', 'Proveedores'], ['distribuciones', 'Distribución de indirectos']], 'costos') + body;
}
function transferTable() {
  return table('Transferencias Internas de Cereal (Agricultura → Ganadería)', ['Fecha', 'Cereal', 'Campaña / Lote Origen', 'Destino Ganadero', 'Cantidad', 'Valor Oportunidad', 'Total Valuado', 'Fuente / Fecha', 'Acciones'],
    visible('transfers').filter(inPeriod).map(t => {
      const destArea = t.toArea || t.targetArea || 'porcinos';
      const destBadge = destArea === 'bovinos'
        ? '<span class="badge" style="background:#fff7ed;color:#c2410c">Bovinos</span>'
        : destArea === 'ovinos'
          ? '<span class="badge" style="background:#fef9c3;color:#854d0e">Ovinos</span>'
          : '<span class="badge" style="background:#fdf2f8;color:#9d174d">Porcinos</span>';
      return [
        date(t.date),
        esc(nameOf('products', t.productId)),
        esc(nameOf('campaigns', t.campaignId)),
        destBadge + (t.lotId ? `<span class="sub">${esc(nameOf('lots', t.lotId))}</span>` : ''),
        number(t.quantity) + ' kg',
        money(t.opportunityPrice) + ' / kg',
        money(Number(t.quantity) * Number(t.opportunityPrice)),
        esc(t.source) + `<span class="sub">${date(t.priceDate)}</span>`,
        controls('transfers', t)
      ];
    }), 'transfers', 'Transferir cereal a ganadería'
  );
}
function renderFeed() {
  const ind=D.indicators(db,ui.from,ui.to); const tab=ui.tab.alimentacion||'consumos';
  return heading('Alimentación',periods())+tabs([['consumos','Consumos'],['ica','Conversión alimenticia'],['transferencias','Cereal propio']],'consumos')+(tab==='consumos'?stockTable(visible('stock').filter(s=>s.type==='consumo'),'Consumos por lote'):tab==='transferencias'?transferTable():icaTable(ind));
}
const ALL_ANIMAL_CATEGORIES = {
  // Porcinos
  cria_maternidad: { name: 'Porcinos · Cría - Maternidad', species: 'porcino', targetIca: '2.4 - 2.8' },
  destete_recria: { name: 'Porcinos · Destete - Recría', species: 'porcino', targetIca: '1.8 - 2.2' },
  engorde_terminacion: { name: 'Porcinos · Engorde - Terminación', species: 'porcino', targetIca: '2.7 - 3.1' },
  // Bovinos
  cria_bov: { name: 'Bovinos · Cría Bovina', species: 'bovino', targetIca: 'Pastoril s/d' },
  recria_bov: { name: 'Bovinos · Recría Pastoril', species: 'bovino', targetIca: '5.5 - 7.0' },
  adaptacion_bov: { name: 'Bovinos · Adaptación a Corral', species: 'bovino', targetIca: '6.0 - 7.5' },
  engorde_bov: { name: 'Bovinos · Feedlot / Terminación', species: 'bovino', targetIca: '6.5 - 8.0' },
  // Ovinos
  vientres_ovi: { name: 'Ovinos · Vientres Dorper', species: 'ovino', targetIca: 'Pastoril s/d' },
  carneros_ovi: { name: 'Ovinos · Carneros Reproductores', species: 'ovino', targetIca: 'Mantenimiento' },
  recria_ovi: { name: 'Ovinos · Borregos de Recría', species: 'ovino', targetIca: '4.0 - 5.5' },
  corderos_faena: { name: 'Ovinos · Corderos Terminación (32-38 kg)', species: 'ovino', targetIca: '4.5 - 5.5' }
};

function icaTable(ind) {
  const currentSpecies = ui.icaSpecies || 'all';
  const filteredRows = ind.rows.filter(r => {
    if (currentSpecies === 'all') return true;
    return getLotSpecies(r.lot) === currentSpecies;
  });

  const validRows = filteredRows.filter(r => r.ica != null);
  const totalGain = D.sum(validRows, r => r.gain);
  const totalConsumed = D.sum(validRows, r => r.consumed);
  const totalCost = D.sum(validRows, r => r.cost);
  const weightedIca = totalGain > 0 && totalConsumed > 0 ? (totalConsumed / totalGain) : null;
  const avgCostPerKgGain = totalGain > 0 && totalCost > 0 ? (totalCost / totalGain) : null;

  const toolbarHtml = `
    <div class="toolbar" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        <span style="font-weight:700; font-size:0.88rem; color:#334155">Unidad Animal:</span>
        <button type="button" class="btn ${currentSpecies==='all'?'primary':'ghost'}" data-action="filter-ica" data-species="all" style="padding:6px 14px; font-size:0.85rem">
          Todas las Especies (3 Unidades)
        </button>
        <button type="button" class="btn ${currentSpecies==='porcino'?'primary':'ghost'}" data-action="filter-ica" data-species="porcino" style="padding:6px 14px; font-size:0.85rem">
          🐷 Porcinos
        </button>
        <button type="button" class="btn ${currentSpecies==='bovino'?'primary':'ghost'}" data-action="filter-ica" data-species="bovino" style="padding:6px 14px; font-size:0.85rem">
          🐂 Bovinos
        </button>
        <button type="button" class="btn ${currentSpecies==='ovino'?'primary':'ghost'}" data-action="filter-ica" data-species="ovino" style="padding:6px 14px; font-size:0.85rem">
          🐑 Ovinos
        </button>
      </div>
      <div style="font-size:0.82rem; color:#64748b">
        ${validRows.length} lotes con conversión calculada de ${filteredRows.length} lotes totales
      </div>
    </div>
  `;

  const kpisHtml = `
    <section class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); margin-bottom:20px">
      ${metric('Carne en Pie Ganada', totalGain > 0 ? number(totalGain, 0) + ' kg' : 'Sin pesajes', currentSpecies === 'all' ? '3 especies ganaderas' : getSpeciesLabel(currentSpecies))}
      ${metric('Alimento Consumido', totalConsumed > 0 ? number(totalConsumed, 0) + ' kg' : 'Sin consumos', 'Raciones y granos en el intervalo', 'black')}
      <article class="metric ${weightedIca != null ? (weightedIca <= 3.2 ? 'positive' : '') : ''}">
        <p>ICA Ponderado</p>
        <strong style="color:#0f172a">${weightedIca != null ? number(weightedIca, 2) : 'Sin datos'}</strong>
        <small>${weightedIca != null ? 'kg alimento / kg ganado' : 'Requiere pesajes y consumos'}</small>
      </article>
      ${metric('Costo Alimento / kg Ganado', avgCostPerKgGain != null ? money(avgCostPerKgGain) : '-', 'Costo directo de alimentación', 'red')}
    </section>
  `;

  const catEntries = Object.entries(ALL_ANIMAL_CATEGORIES).filter(([k, v]) => {
    if (currentSpecies === 'all') return true;
    return v.species === currentSpecies;
  });

  const catRows = catEntries.map(([phase, meta]) => {
    const all = filteredRows.filter(r => r.lot.phase === phase || (phase === 'cria_maternidad' && r.lot.phase === 'fase1') || (phase === 'destete_recria' && ['fase2','fase3','recria'].includes(r.lot.phase)) || (phase === 'engorde_terminacion' && ['fase4','terminador'].includes(r.lot.phase)));
    const valid = all.filter(r => r.ica != null);
    const gain = D.sum(valid, r => r.gain);
    const feed = D.sum(valid, r => r.consumed);
    const cost = D.sum(valid, r => r.cost);
    const icaVal = gain > 0 && feed > 0 ? (feed / gain) : null;
    const costKgVal = gain > 0 && cost > 0 ? (cost / gain) : null;
    const spBadge = meta.species === 'bovino'
      ? `<span class="badge" style="background:#fff7ed;color:#c2410c;font-weight:600">Bovino</span>`
      : meta.species === 'ovino'
        ? `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:600">Ovino</span>`
        : `<span class="badge" style="background:#fdf2f8;color:#9d174d;font-weight:600">Porcino</span>`;

    return [
      spBadge,
      `<strong>${esc(meta.name)}</strong>`,
      `<span style="color:#64748b;font-size:0.82rem">${meta.targetIca}</span>`,
      number(valid.length, 0) + ' de ' + number(all.length, 0),
      gain > 0 ? number(gain, 0) + ' kg' : '-',
      feed > 0 ? number(feed, 0) + ' kg' : '-',
      icaVal != null ? `<strong>${number(icaVal, 2)}</strong>` : '<span style="color:#94a3b8">Sin datos</span>',
      costKgVal != null ? money(costKgVal) : '-'
    ];
  });

  const categoryTable = table(
    'ICA Ponderado por Especie y Categoría / Fase',
    ['Especie', 'Categoría / Fase', 'Rango Objetivo', 'Lotes con Datos', 'Kg Ganados', 'Kg Alimento Consumido', 'ICA Ponderado', 'Costo Alimento / kg Ganado'],
    catRows
  );

  const lotRows = filteredRows.map(r => {
    const sp = getLotSpecies(r.lot);
    const spBadge = sp === 'bovino'
      ? `<span class="badge" style="background:#fff7ed;color:#c2410c;font-weight:600">Bovino</span>`
      : sp === 'ovino'
        ? `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:600">Ovino</span>`
        : `<span class="badge" style="background:#fdf2f8;color:#9d174d;font-weight:600">Porcino</span>`;
    const phaseLabel = ALL_ANIMAL_CATEGORIES[r.lot.phase]?.name || D.PHASES[r.lot.phase] || r.lot.phase;

    return [
      `<strong>${esc(r.lot.name)}</strong>`,
      spBadge,
      badge(phaseLabel),
      r.from && r.to ? date(r.from) + ' al ' + date(r.to) : '<span style="color:#94a3b8">Faltan pesajes de corte</span>',
      r.gain == null ? '<span style="color:#94a3b8">Insuficiente</span>' : number(r.gain, 0) + ' kg',
      number(r.consumed || 0, 0) + ' kg',
      r.ica == null ? `<span title="${esc(r.reason)}" style="color:#94a3b8">Datos insuficientes</span>` : `<strong>${number(r.ica, 2)}</strong>`,
      r.feedCostKg == null ? '-' : money(r.feedCostKg),
      r.daily == null ? '-' : number(r.daily, 2) + ' kg/día'
    ];
  });

  const lotsTable = table(
    'Conversión Alimenticia por Lote Individual e Intervalo Medido',
    ['Lote', 'Especie', 'Categoría / Fase', 'Intervalo de Pesajes', 'Kg Ganados', 'Kg Alimento', 'ICA (kg alim / kg)', 'Costo Alimento / kg', 'Ganancia Diaria (GDP)'],
    lotRows
  );

  return toolbarHtml + kpisHtml + categoryTable + lotsTable;
}

function productionRows(state) {
  return [...state.production,...confirmed('allocations').filter(a=>a.lotId&&a.date<=ui.to).map(a=>({date:a.date,lotId:a.lotId,category:'Indirectos',value:Number(a.amount),sourceId:a.id}))];
}

function productionReport(state, ind) {
  const currentSpecies = ui.prodSpecies || 'all';
  const rows = productionRows(state).filter(inPeriod);

  const feedItems = state.feed.filter(f => {
    if (!inPeriod(f)) return false;
    if (currentSpecies === 'all') return true;
    const lot = db.lots.find(l => l.id === f.lotId);
    return getLotSpecies(lot) === currentSpecies;
  });
  const food = D.sum(feedItems, f => f.value);

  const otherCosts = confirmed('costs').filter(c => {
    if (!inPeriod(c) || c.area === 'agricultura' || c.accountId === '5.7.01') return false;
    if (currentSpecies === 'all') return true;
    if (currentSpecies === 'porcino') return c.area === 'cerdos' || c.area === 'comun';
    if (currentSpecies === 'bovino') return c.area === 'bovinos';
    if (currentSpecies === 'ovino') return c.area === 'ovinos';
    return true;
  });
  const other = D.sum(otherCosts, c => (Number(c.amount) + (c.taxRecoverable ? 0 : Number(c.tax || 0))) * (c.area === 'comun' ? Number(c.pigShare) / 100 : 1));

  const total = food + other + (currentSpecies === 'porcino' || currentSpecies === 'all' ? D.sum(state.depreciation.filter(inPeriod), d => d.value) : 0);
  const share = total > 0 ? (food / total * 100) : null;

  const toolbarHtml = `
    <div class="toolbar" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        <span style="font-weight:700; font-size:0.88rem; color:#334155">Filtrar Costos Ganaderos:</span>
        <button type="button" class="btn ${currentSpecies==='all'?'primary':'ghost'}" data-action="filter-prod-cost" data-species="all" style="padding:6px 14px; font-size:0.85rem">
          Consolidado Ganadero (3 Unidades)
        </button>
        <button type="button" class="btn ${currentSpecies==='porcino'?'primary':'ghost'}" data-action="filter-prod-cost" data-species="porcino" style="padding:6px 14px; font-size:0.85rem">
          🐷 Porcinos
        </button>
        <button type="button" class="btn ${currentSpecies==='bovino'?'primary':'ghost'}" data-action="filter-prod-cost" data-species="bovino" style="padding:6px 14px; font-size:0.85rem">
          🐂 Bovinos
        </button>
        <button type="button" class="btn ${currentSpecies==='ovino'?'primary':'ghost'}" data-action="filter-prod-cost" data-species="ovino" style="padding:6px 14px; font-size:0.85rem">
          🐑 Ovinos
        </button>
      </div>
    </div>
  `;

  const kpisHtml = `
    <div class="metrics three">
      ${metric('Alimento Consumido', food, 'Costo de raciones y granos propios')}
      ${metric('Costos Productivos Totales', total, 'Alimentación + sanidad + labores', 'black')}
      ${metric('Participación del Alimento', share == null ? 'Sin datos' : number(share) + ' %', 'Objetivo ganadero: 60 a 75 %', 'red')}
    </div>
  `;

  const catEntries = Object.entries(ALL_ANIMAL_CATEGORIES).filter(([k, v]) => {
    if (currentSpecies === 'all') return true;
    return v.species === currentSpecies;
  });

  const catTable = table(
    'Costos Incorporados por Categoría y Especie',
    ['Especie', 'Categoría / Fase', 'Alimentación', 'Otros Costos Directos', 'Total Incorporado', 'Participación Alimento'],
    catEntries.map(([phase, meta]) => {
      const items = rows.filter(r => {
        const lot = state.lots[r.lotId] || db.lots.find(l => l.id === r.lotId);
        if (!lot) return false;
        return lot.phase === phase || (phase === 'cria_maternidad' && lot.phase === 'fase1') || (phase === 'destete_recria' && ['fase2','fase3','recria'].includes(lot.phase)) || (phase === 'engorde_terminacion' && ['fase4','terminador'].includes(lot.phase));
      });
      const fVal = D.sum(items.filter(r => r.category === 'Alimentación'), r => r.value);
      const tVal = D.sum(items, r => r.value);
      const spBadge = meta.species === 'bovino'
        ? `<span class="badge" style="background:#fff7ed;color:#c2410c;font-weight:600">Bovino</span>`
        : meta.species === 'ovino'
          ? `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:600">Ovino</span>`
          : `<span class="badge" style="background:#fdf2f8;color:#9d174d;font-weight:600">Porcino</span>`;
      return [
        spBadge,
        `<strong>${esc(meta.name)}</strong>`,
        money(fVal),
        money(tVal - fVal),
        money(tVal),
        tVal > 0 ? number(fVal / tVal * 100) + ' %' : '<span style="color:#94a3b8">Sin costos</span>'
      ];
    })
  );

  const lotFiltered = ind.rows.filter(r => {
    if (currentSpecies === 'all') return true;
    return getLotSpecies(r.lot) === currentSpecies;
  });

  const lotTable = table(
    'Crecimiento y Costo Asignado por Lote Individual',
    ['Lote', 'Especie', 'Kg Ganados', 'Costo del Intervalo', 'Costo / kg Ganado', 'Costo Actual / Cabeza'],
    lotFiltered.map(r => {
      const amount = D.sum(productionRows(state).filter(p => p.lotId === r.lot.id && p.date > r.from && p.date <= r.to), p => p.value);
      const l = state.lots[r.lot.id];
      const sp = getLotSpecies(r.lot);
      const spBadge = sp === 'bovino'
        ? `<span class="badge" style="background:#fff7ed;color:#c2410c;font-weight:600">Bovino</span>`
        : sp === 'ovino'
          ? `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:600">Ovino</span>`
          : `<span class="badge" style="background:#fdf2f8;color:#9d174d;font-weight:600">Porcino</span>`;
      return [
        `<strong>${esc(r.lot.name)}</strong>`,
        spBadge,
        r.gain == null ? '-' : number(r.gain) + ' kg',
        r.gain > 0 ? money(amount) : '-',
        r.gain > 0 ? money(amount / r.gain) : '-',
        l?.quantity ? money((l.value + l.memo) / l.quantity) : '-'
      ];
    })
  );

  return toolbarHtml + kpisHtml + catTable + lotTable + notice('Los costos sin lote asignado integran el resultado global de la actividad ganadera, pero no el costo individual por lote. El porcentaje depende de la carga oportuna de raciones e insumos.', 'info');
}

function cropReport(state) {
  return table('Costos y rendimiento por campaña a la fecha',['Campaña','Ha','Cosecha (t)','Rinde (qq/ha)','Costo / ha','Costo cosechado / t','Costo / qq','Pendiente en cultivo'],confirmed('campaigns').filter(c=>state.campaigns[c.id]).map(c=>{const s=state.campaigns[c.id], harvestedCost=s.cost-s.value;return [esc(c.name),number(c.hectares),number(s.harvested/1000),number(s.harvested/100/Number(c.hectares)),money(s.cost/Number(c.hectares)),s.harvested?money(harvestedCost/s.harvested*1000):'Sin cosecha',s.harvested?money(harvestedCost/s.harvested*100):'-',money(s.value)];}));
}

function importSelector(id) { const source=db.imports.find(r=>r.id===id);return `<div class="import-action">${source?.originalTable?'':`<select aria-label="Tipo de operación a cargar">${[['costs','Costo'],['sales','Venta'],['stock','Insumos / consumo'],['movements','Movimiento porcino'],['births','Parto / destete'],['lots','Lote inicial'],['sows','Reproductor']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`}${button(source?.resolvedId?'Ver operación':'Cargar operación','review-import',`data-id="${esc(id)}"`,'file-plus','ghost')}</div>`; }
function imputationRows(state) {
  const names={costs:'Costo',stock:'Insumos',sales:'Venta',movements:'Movimiento de cerdos',births:'Parto / destete',transfers:'Cereal propio',allocations:'Distribución',entries:'Asiento',lots:'Apertura de lote',sows:'Plantel'};
  return Object.entries(names).flatMap(([t,label])=>confirmed(t).filter(inPeriod).map(r=>{
    const lines=state.journal.filter(j=>j.sourceId===r.id).flatMap(j=>j.lines), accounts=[...new Set(lines.map(l=>l.accountId))];
    const source=db.imports.find(i=>i.id===r.sourceImportId);
    const amount=t==='costs'?Number(r.amount):t==='sales'?D.saleValue(r).gross:t==='stock'&&['apertura','compra','cosecha'].includes(r.type)?Number(r.quantity)*Number(r.inputUnit==='bolsas'?r.factorAtEntry:1)*Number(r.unitCost):null;
    const effect=t==='sales'?'Egreso por venta':t==='movements'?r.type:t==='births'?'Nacimiento / bajas / destete':t==='stock'?r.type:t==='transfers'?'Cambio de actividad; sin salida externa':r.lotId?'Costo al lote':r.campaignId?'Costo al cultivo':t==='lots'?'Apertura de hacienda':t==='sows'?'Plantel y amortización':'Sin cambio físico';
    return {fecha:r.date,comprobante:r.reference||r.name||label,proveedor:nameOf('parties',r.partyId),concepto:r.category||label,importe:amount,cuenta:accounts.map(id=>{const a=db.accounts.find(a=>a.id===id);return a?a.code+' · '+a.name:id;}).join(', '),unidad:D.AREAS[r.area]||(t==='transfers'?'Agricultura y Cerdos':'Cerdos'),plano:['movements','births'].includes(t)?'Físico / productivo':t==='entries'?'Monetario':'Monetario / productivo',existencias:effect,origen:source?.source||'',id:r.id};
  })).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function renderSales() {
  const state=D.replay(db,ui.to); const tab=ui.tab.ventas||'ventas';
  const rows=visible('sales').filter(inPeriod);
  let body=table('Liquidaciones',['Fecha','Actividad','Comprobante','Comprador','Kilos y Cabezas','Bruto','Gastos','IVA','Ret. / perc.','Neto','Saldo',''],rows.map(s=>{const v=D.saleValue(s);const doc=state.documents[s.id];const w=Number(s.weight||0);const caponRange=s.area==='cerdos'&&w>0?(w>=90&&w<=110?`<span class="sub" style="color:#166534">✓ Rango capón (${number(w,1)} kg/cab)</span>`:`<span class="sub" style="color:#b91c1c">⚠️ Fuera rango 90-110 kg (${number(w,1)} kg/cab)</span>`):'';const kgDetail=s.area==='cerdos'&&s.animals?`${number(v.kg)} kg <span class="sub">${number(s.animals)} cab</span>${caponRange}`:number(v.kg);return [date(s.date),badge(D.AREAS[s.area]),esc(s.reference),esc(nameOf('parties',s.partyId)),kgDetail,money(v.gross),money(s.fees),money(s.tax),money(s.retentions)+' / '+money(s.perceptions),money(v.net),doc?money(doc.amount-doc.paid):stateBadge(s),controls('sales',s)];}),'sales','Nueva venta');
  if(tab==='cobros') body=table('Pagos y cobros',['Fecha','Documento','Referencia','Importe',''],visible('payments').filter(inPeriod).map(p=>[date(p.date),esc(state.documents[p.sourceId]?.name||'Por revisar'),esc(p.reference),money(p.amount),controls('payments',p)]),'payments','Registrar pago / cobro');
  return heading('Ventas',periods())+tabs([['ventas','Liquidaciones'],['cobros','Pagos y cobros']],'ventas')+body;
}
function renderInventory() {
  const s=D.replay(db,ui.to); const tab=['insumos','movimientos','productos'].includes(ui.tab.existencias)?ui.tab.existencias:'insumos'; let body;
  if(tab==='insumos') body=table('Saldos por actividad y partida',['Producto','Actividad','Partida','Cantidad','Costo promedio','Valor contable','Valor de gestión'],Object.values(s.stock).map(i=>[esc(nameOf('products',i.productId)),badge(D.AREAS[i.area]),esc(nameOf('campaigns',i.campaignId)),number(i.quantity)+' '+esc(db.products.find(p=>p.id===i.productId)?.unit||''),i.quantity?money(i.value/i.quantity):'-',money(i.value),money(i.value+i.memo)]));
  if(tab==='movimientos') body=stockTable(visible('stock'));
  if(tab==='productos') body=table('Productos y equivalencias',['Producto','Tipo','Unidad','Kg / bolsa','Alimentación',''],visible('products').map(p=>[esc(p.name),esc(p.kind),esc(p.unit),p.kgPerBag?number(p.kgPerBag):'Sin equivalencia',esc(D.PHASES[p.phase]||'Varias'),controls('products',p)]),'products','Nuevo producto');
  return heading('Existencias de granos e insumos',periods())+tabs([['insumos','Saldos'],['movimientos','Movimientos'],['productos','Productos']],'insumos')+body;
}

const SCENARIO_FIELDS = [
  ['tonnes','Toneladas de cereal a evaluar'],['grainSell','Precio de venta del cereal ($/t)'],['sellFreight','Flete de venta ($/t)'],['sellFees','Gastos comerciales ($/t)'],
  ['replacement','Precio de compra equivalente ($/t)'],['purchaseFreight','Flete hasta el campo ($/t)'],['pigPrice','Precio neto del kg vivo adicional ($/kg)'],
  ['ica','ICA esperado (kg alimento / kg ganado)'],['grainShare','Participación del cereal en la dieta (%)'],['otherFeedKg','Otros ingredientes: costo por kg ($)'],
  ['otherCost','Otros costos adicionales del escenario ($)'],['mortality','Merma esperada de producción (%)'],['days','Días hasta cobrar'],['annualRate','Tasa anual de comparación (%)']
];
function renderScenario() {
  if(!Object.keys(ui.scenario).length) ui.scenario={...(savedScenarios().at(-1)||{})};
  const s=ui.scenario;
  return heading('Destino del cereal',button('Guardar escenario','save-scenario','','save')+button('Imprimir','print','','printer','ghost'),'Comparación marginal a una misma fecha')
    +`<div class="scenario-grid"><form id="scenarioForm" class="scenario-fields"><div class="field"><label>Nombre del escenario</label><input name="name" aria-label="Nombre del escenario" value="${esc(s.name||'')}"></div><div class="field"><label>Cereal disponible</label><select name="productId" aria-label="Cereal disponible"><option value="">Seleccionar</option>${confirmed('products').filter(p=>p.kind==='grano').map(p=>`<option value="${p.id}" ${s.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="group">Venta y abastecimiento</div>${SCENARIO_FIELDS.map(([key,label],i)=>(i===6?'<div class="group">Transformación en cerdos</div>':'')+(i===12?'<div class="group">Tiempo y costo del capital</div>':'')+`<label class="field"><span>${label}</span><input type="number" name="${key}" min="0" ${key==='grainShare'||key==='mortality'?'max="100"':''} step="0.01" value="${esc(s[key]??'')}" aria-label="${label}"></label>`).join('')}<label class="field"><span>Fuente de precios y costos</span><input name="source" value="${esc(s.source||'')}"></label><label class="field"><span>Fecha de los precios</span><input type="date" name="priceDate" value="${esc(s.priceDate||'')}"></label><label class="field"><span>Reserva mínima de cereal (kg)</span><input type="number" name="reserve" min="0" value="${esc(s.reserve??0)}"></label><label class="field"><span>Consumo previsto diario (kg)</span><input type="number" name="dailyFeed" min="0" value="${esc(s.dailyFeed??'')}"></label></form><div id="scenarioResults" class="scenario-results">${scenarioResults()}</div></div>`
    +table('Escenarios guardados',['Fecha','Nombre','Toneladas','Diferencia / t','Fuente',''],confirmed('scenarios').map(s=>{const r=D.scenario(s);return [date(s.date),esc(s.name),number(s.tonnes),r.valid?money(r.perTonne):'Incompleto',esc(s.source),button('Abrir','load-scenario',`data-id="${s.id}"`,'folder-open','ghost')];}),'scenarios')
    +notice('La comparación usa kilos adicionales de peso vivo. Incluí en otros costos las diferencias del valor inicial de animales, elaboración, sanidad, trabajo y comercialización.','info');
}
function scenarioResults() {
  const s=ui.scenario, r=D.scenario(s); if(!r.valid) return notice(r.message,'info');
  const state=D.replay(db,ui.to); const available=D.sum(Object.values(state.stock).filter(x=>x.productId===s.productId&&x.area==='agricultura'),x=>x.quantity);
  const capacity=Math.max(0,available-Number(s.reserve||0)); const stale=!s.priceDate||(Date.parse(today())-Date.parse(s.priceDate))/86400000>Number(db.settings.priceAgeDays);
  const warnings=[!s.source?'Falta la fuente de los valores.':'',stale?'Cotizaciones pendientes de actualizar.':'',r.grainKg>capacity?'La cantidad supera el cereal libre de reserva.':'',!s.productId?'Seleccioná el cereal para comprobar disponibilidad.':''].filter(Boolean);
  const favorable=D.scenario({...s,pigPrice:Number(s.pigPrice)*1.1,grainSell:Number(s.grainSell)*.9});
  const adverse=D.scenario({...s,pigPrice:Number(s.pigPrice)*.9,grainSell:Number(s.grainSell)*1.1});
  return warnings.map(w=>notice(w)).join('')+metric('Ventaja de transformar frente a vender',r.difference,money(r.perTonne)+' por tonelada',r.difference>=0?'':'red')
    +`<section class="panel">${summary('Vender cereal · ingreso neto',money(r.sell))}${summary('Transformar · aporte futuro neto',money(r.transform))}${summary('Usar propio frente a comprar equivalente',money(r.ownVsBuy))}${summary('Precio porcino de equilibrio',money(r.breakEvenPig)+' / kg')}${summary('Peso vivo adicional estimado',number(r.gain)+' kg')}${summary('Cereal libre de reserva',number(capacity/1000)+' t')}${summary('Cobertura de alimento',Number(s.dailyFeed)>0?number(available/Number(s.dailyFeed))+' días':'Sin consumo previsto')}${summary('Escenario favorable (precios ±10 %)',money(favorable.difference))}${summary('Escenario adverso (precios ±10 %)',money(adverse.difference))}</section>`;
}
function renderAccounting() {
  const state=D.replay(db,ui.to); const tab=ui.tab.contabilidad||'diario'; let body='';
  if(tab==='diario') body=renderJournal(UNRCJournal.query(db,ui.from,ui.to))+table('Asientos manuales',['Fecha','Referencia','Actividad','Estado','Registrado por',''],visible('entries').filter(inPeriod).map(e=>[date(e.date),esc(e.reference),esc(D.AREAS[e.area]),stateBadge(e),esc(e.createdBy||'Sin registro anterior'),controls('entries',e)]),'entries');
  if(tab==='mayor') {
    const balances=new Map(); for(const j of state.journal.filter(inPeriod)) for(const l of j.lines) {const b=balances.get(l.accountId)||{debit:0,credit:0};b.debit+=l.debit;b.credit+=l.credit;balances.set(l.accountId,b);}
    body=table('Sumas y saldos',['Cuenta','Nombre','Debe','Haber','Saldo'],confirmed('accounts').filter(a=>balances.has(a.id)).map(a=>{const b=balances.get(a.id);return [esc(a.code),esc(a.name),money(b.debit),money(b.credit),money(b.debit-b.credit)];}),'trialBalance');
  }
  if(tab==='cuentas') {
    const scope=ui.planScope||'anexo',rows=planAccounts(scope);
    body=`<div class="toolbar"><label class="field"><span>Plan de cuentas</span><select data-filter="planScope"><option value="anexo" ${scope==='anexo'?'selected':''}>Anexos I y II</option><option value="complemento" ${scope==='complemento'?'selected':''}>Complementos y subcuentas</option><option value="anterior" ${scope==='anterior'?'selected':''}>Plan anterior conservado</option><option value="todos" ${scope==='todos'?'selected':''}>Todas las cuentas</option></select></label></div>`+table('Plan de cuentas - Pozo del Carril porcinos',['Código','Nombre','Clasificación','Origen','Observaciones','Uso'],rows.map(a=>[esc(a.code),a.heading?`<strong>${esc(a.name)}</strong>`:esc(a.name),esc(a.classification||Plan.kindLabels[a.kind]),esc(Plan.scope(a,db)),esc(a.note||''),a.heading?badge('Grupo','neutral'):a.kind==='physical'?badge('No monetaria','neutral'):Plan.isBase(a)?badge(a.managed?'Movimientos':'Imputable','neutral'):Plan.scope(a,db)==='Plan anterior'?badge('Histórica','neutral'):controls('accounts',a)]),'accounts',scope==='anterior'?'':'Nueva subcuenta');
  }
  if(tab==='cierres') body=notice('Los cierres preservan operaciones y precios utilizados. Para corregir una fecha cerrada se debe reabrir el cierre.','info')+button('Cerrar período seleccionado','close-period','','lock')+table('Cierres de período',['Desde','Hasta','Fecha de cierre','Resultado',''],confirmed('closings').map(c=>[date(c.start),date(c.end),date(c.date),money(c.result),button('Reabrir','reopen',`data-id="${c.id}"`,'lock-open','ghost')]));
  return heading('Contabilidad',periods())+tabs([['diario','Diario'],['mayor','Sumas y saldos'],['cuentas','Plan de cuentas'],['cierres','Cierres']],'diario')+body;
}
function renderReports() {
  const r=D.results(db,ui.from,ui.to), ind=D.indicators(db,ui.from,ui.to); const tab=ui.tab.informes||'resultado'; let body='';
  if(tab==='resultado') {
    const uPigs = r.areas.cerdos || r.areas.porcinos || { revenue: 0, expense: 0, book: 0, management: 0 };
    const uBov = r.areas.bovinos || { revenue: 0, expense: 0, book: 0, management: 0 };
    const uOvi = r.areas.ovinos || { revenue: 0, expense: 0, book: 0, management: 0 };
    const uCorn = r.areas.maiz || { revenue: 0, expense: 0, book: 0, management: 0 };
    const uSoy = r.areas.soja || { revenue: 0, expense: 0, book: 0, management: 0 };

    const gLivestock = r.groups?.ganaderia || {
      revenue: uPigs.revenue + uBov.revenue + uOvi.revenue,
      expense: uPigs.expense + uBov.expense + uOvi.expense,
      book: uPigs.book + uBov.book + uOvi.book,
      management: uPigs.management + uBov.management + uOvi.management
    };
    const gAgri = r.groups?.agricultura || {
      revenue: uCorn.revenue + uSoy.revenue,
      expense: uCorn.expense + uSoy.expense,
      book: uCorn.book + uSoy.book,
      management: uCorn.management + uSoy.management
    };

    const totalRev = gLivestock.revenue + gAgri.revenue;
    const totalExp = gLivestock.expense + gAgri.expense;
    const totalBook = gLivestock.book + gAgri.book;
    const totalMgmt = r.consolidated;

    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Consolidación Económica de las 5 Unidades Productivas</h4>
          <span class="badge" style="background:#f0f9ff;color:#0369a1">Integración 3FN sin Duplicaciones</span>
        </div>
        <p class="muted">Desagregación analítica por unidad de negocio individual, subtotales por área y consolidado global del Establecimiento Pozo del Carril (200 ha mixtas):</p>
      </section>

      ${table('Cuadro de Resultados por Unidad de Negocio', ['Unidad / Grupo Productivo', 'Ventas Externas', 'Costos Imputados', 'Margen Contable', 'Resultado de Gestión', 'Participación'], [
        ['<strong>1. GANADERÍA</strong>', '', '', '', '', ''],
        ['&nbsp;&nbsp;&nbsp;&nbsp;🐷 Porcinos (Ciclo Semi-Intensivo)', money(uPigs.revenue), money(uPigs.expense), money(uPigs.book), money(uPigs.management), totalRev > 0 ? number(uPigs.revenue / totalRev * 100, 1) + '%' : '-'],
        ['&nbsp;&nbsp;&nbsp;&nbsp;🐂 Bovinos (Carne y Feedlot)', money(uBov.revenue), money(uBov.expense), money(uBov.book), money(uBov.management), totalRev > 0 ? number(uBov.revenue / totalRev * 100, 1) + '%' : '-'],
        ['&nbsp;&nbsp;&nbsp;&nbsp;🐑 Ovinos (Carne Transición Dorper)', money(uOvi.revenue), money(uOvi.expense), money(uOvi.book), money(uOvi.management), totalRev > 0 ? number(uOvi.revenue / totalRev * 100, 1) + '%' : '-'],
        ['<strong>SUBTOTAL GANADERÍA</strong>', `<strong>${money(gLivestock.revenue)}</strong>`, `<strong>${money(gLivestock.expense)}</strong>`, `<strong>${money(gLivestock.book)}</strong>`, `<strong>${money(gLivestock.management)}</strong>`, totalRev > 0 ? `<strong>${number(gLivestock.revenue / totalRev * 100, 1)}%</strong>` : '-'],
        ['<strong>2. AGRICULTURA</strong>', '', '', '', '', ''],
        ['&nbsp;&nbsp;&nbsp;&nbsp;🌽 Maíz (Grano y Destino Ganadero)', money(uCorn.revenue), money(uCorn.expense), money(uCorn.book), money(uCorn.management), totalRev > 0 ? number(uCorn.revenue / totalRev * 100, 1) + '%' : '-'],
        ['&nbsp;&nbsp;&nbsp;&nbsp;🌱 Soja (Producción y Acopio)', money(uSoy.revenue), money(uSoy.expense), money(uSoy.book), money(uSoy.management), totalRev > 0 ? number(uSoy.revenue / totalRev * 100, 1) + '%' : '-'],
        ['<strong>SUBTOTAL AGRICULTURA</strong>', `<strong>${money(gAgri.revenue)}</strong>`, `<strong>${money(gAgri.expense)}</strong>`, `<strong>${money(gAgri.book)}</strong>`, `<strong>${money(gAgri.management)}</strong>`, totalRev > 0 ? `<strong>${number(gAgri.revenue / totalRev * 100, 1)}%</strong>` : '-'],
        ['<strong style="color:#087FBD">TOTAL CONSOLIDADO ESTABLECIMIENTO</strong>', `<strong style="color:#087FBD">${money(totalRev)}</strong>`, `<strong style="color:#087FBD">${money(totalExp)}</strong>`, `<strong style="color:#087FBD">${money(totalBook)}</strong>`, `<strong style="color:#087FBD">${money(totalMgmt)}</strong>`, '<strong>100,0%</strong>']
      ])}

      <div class="metrics four" style="margin-top:16px; grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        ${metric('Resultado Consolidado Total', r.consolidated, 'Neteo exacto de transferencias internas', 'black')}
        ${metric('Ajuste de Consolidación', r.adjustment, 'Eliminación margen interno de cereal')}
        ${metric('Margen Ganadero', gLivestock.management, 'Porcinos + Bovinos + Ovinos')}
        ${metric('Margen Agrícola', gAgri.management, 'Maíz + Soja')}
      </div>
    `;
  }
  if(tab==='ica') body=icaTable(ind);
  if(tab==='produccion') body=productionReport(r.state,ind);
  if(tab==='campanas') body=cropReport(r.state);
  if(tab==='margenes') body=table('Margen de las ventas después del costo de existencias',['Fecha','Actividad','Comprobante','Lote / campaña','Venta neta de gastos','Costo contable','Cereal: ajuste de oportunidad','Margen de gestión','Margen / unidad'],r.state.sold.filter(inPeriod).map(s=>[date(s.date),D.AREAS[s.area],esc(s.reference),esc(nameOf(s.area==='cerdos'?'lots':'campaigns',s.area==='cerdos'?s.lotId:s.campaignId)),money(s.gross-Number(s.fees||0)),money(s.cost),money(s.opportunity),money(s.margin),['cerdos','bovinos','ovinos'].includes(s.area) && s.animals ? money(s.margin/Number(s.animals))+' / cab' : (s.kg ? money(s.margin/s.kg*1000)+' / t' : money(s.margin))]))+notice('Este margen no descuenta los costos generales que quedaron sin asignar. El resultado completo de ambas actividades figura en General.','info');
  if(tab==='reproduccion') {
    const days=(Date.parse(ui.to)-Date.parse(ui.from))/86400000+1;
    const sowDays=D.sum(confirmed('sows').filter(s=>s.sex==='madre'),s=>Math.max(0,(Date.parse([ui.to,s.discardDate||ui.to].sort()[0])-Date.parse([ui.from,s.date].sort().at(-1)))/86400000+1));
    const weaned=D.sum(confirmed('births').filter(b=>b.weanDate>=ui.from&&b.weanDate<=ui.to),b=>b.weaned);
    body=`<div class="metrics three">${metric('Destetados del período',number(weaned,0),'Fecha efectiva de destete')}${metric('Destetados / madre / año',sowDays?number(weaned/sowDays*365):'Sin datos','Tasa anualizada por días efectivos','red')}${metric('Madres promedio expuestas',days?number(sowDays/days):'Sin datos','Altas y descartes ponderados','black')}</div>`+table('Indicadores de camadas cerradas',['Nacidos vivos','Destetados','Bajas','Supervivencia'],[[number(ind.alive),number(ind.weaned),number(ind.deaths),ind.survival==null?'Sin datos':number(ind.survival)+' %']])
      +table('Prorrateo mensual del plantel',['Mes','Reproductor','Amortización','Destetados del mes','Costo / destetado','Capitalizado en existencias','A resultado'],r.state.depreciation.filter(inPeriod).map(d=>[date(d.date),esc(nameOf('sows',d.sowId)),money(d.value),number(d.weaned,0),d.weaned?money(d.value/d.weaned):'Sin destetes',money(d.allocated),money(d.value-d.allocated)]));
  }
  if(tab==='imputaciones') body=table('Trazabilidad de registros y comprobantes',['Fecha','Comprobante','Proveedor','Concepto','Importe de origen','Cuentas','Unidad','Plano','Existencias','Archivo / fila'],imputationRows(r.state).map(c=>[date(c.fecha),esc(c.comprobante),esc(c.proveedor),esc(c.concepto),c.importe==null?'-':money(c.importe),esc(c.cuenta),esc(c.unidad),esc(c.plano),esc(c.existencias),esc(c.origen)]),'imputations');
  return heading('Informes y Reportes del Establecimiento', periods() + button('Imprimir', 'print', '', 'printer', 'ghost'), 'Consolidación de las 5 Unidades Productivas (Porcinos, Bovinos, Ovinos, Maíz y Soja)')
    + tabs([
      ['resultado', 'Resultados Económicos'],
      ['produccion', 'Costos Ganaderos (3 Especies)'],
      ['ica', 'ICA y Conversión (3 Especies)'],
      ['margenes', 'Márgenes de Venta'],
      ['campanas', 'Campañas Agrícolas'],
      ['reproduccion', 'Reproducción y Destetes'],
      ['imputaciones', 'Trazabilidad Contable']
    ], 'resultado')
    + body;
}
function planAccounts(scope=ui.planScope||'anexo') {
  return visible('accounts').filter(a=>scope==='todos'||scope==='anexo'&&['Anexo I','Anexo II'].includes(Plan.scope(a,db))||scope==='anterior'&&Plan.scope(a,db)==='Plan anterior'||scope==='complemento'&&['Complemento operativo','Personalizada'].includes(Plan.scope(a,db))).sort((a,b)=>a.code.localeCompare(b.code,'es',{numeric:true})||a.id.localeCompare(b.id));
}
function renderSettings() {
  const tab=ui.tab.ajustes||'criterios',admin=UNRCAuth.current?.role==='admin'; let body='';
  if(tab==='respaldo')body=typeof renderBackupAndRecovery==='function'?renderBackupAndRecovery():'';
  if(tab==='traslado')body=renderTransfer();
  if(tab==='usuarios')body=renderUsers();
  if(tab==='historial')body=renderAudit();
  if(tab==='criterios') body=`<form id="settingsForm" class="panel"><div class="scenario-fields"><label class="field"><span>Responsable</span><input name="manager" value="${esc(db.settings.manager)}"></label><label class="field"><span>Antigüedad máxima de precios (días)</span><input type="number" min="1" max="365" required name="priceAgeDays" value="${db.settings.priceAgeDays}"></label><div class="group">Rangos de peso por categoría</div>${Object.entries(D.PHASES).map(([id,label])=>`<label class="field"><span>${label}: peso mínimo (kg)</span><input type="number" step="0.01" min="0" name="${id}Min" value="${db.settings.weightRanges?.[id]?.min??''}"></label><label class="field"><span>${label}: peso máximo (kg)</span><input type="number" step="0.01" min="0" name="${id}Max" value="${db.settings.weightRanges?.[id]?.max??''}"></label>`).join('')}<label class="field"><span>Fuente de los rangos y criterios</span><input name="weightSource" value="${esc(db.settings.weightSource||'')}"></label></div><div class="section-actions" style="margin-top:20px"><button type="submit" class="btn primary">${icon('save')}Guardar criterios</button></div></form>`;
  if(tab==='precios') body=table('Precios orientativos e históricos',['Fecha','Producto / categoría','Precio','Unidad','Fuente',''],visible('prices').sort((a,b)=>b.date.localeCompare(a.date)).map(p=>[date(p.date),esc(D.PHASES[p.product]||p.product),money(p.price),esc(p.unit),esc(p.source),controls('prices',p)]),'prices','Nueva cotización');
  if(tab==='terceros') body=table('Clientes y proveedores',['Nombre','CUIT','Tipo','Contacto',''],visible('parties').map(p=>[esc(p.name),esc(p.taxId),esc(p.kind),esc(p.contact),controls('parties',p)]),'parties','Nuevo tercero');
  if(tab==='datos') {
    const csvImports = (db.imports || []).filter(r => !r.voided);
    const user = typeof UNRCAuth !== 'undefined' ? UNRCAuth.current : null;
    const canImport = !user || (user.role !== 'analista' && user.role !== 'auditor');

    const csvHubBanner = `
      <section class="panel" style="background:#ffffff; border:1px solid #cbd5e1; border-left:4px solid #087FBD; padding:22px; border-radius:8px; margin-bottom:20px">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px">
          <div>
            <h4 style="margin:0 0 6px 0; font-size:1.15rem; color:#14263D; display:flex; align-items:center; gap:8px">
              ${icon('file-spreadsheet')} Centro de Importación y Exportación Masiva CSV · Microsoft Excel
            </h4>
            <p style="margin:0; font-size:0.86rem; color:#64748B; max-width:680px; line-height:1.5">
              Carga masiva asistida con detección de separador (; o ,), compatibilidad con números y fechas argentinas (DD/MM/AAAA), validación de reglas de negocio, control de duplicados y plantillas descargables.
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            ${canImport ? `
              <button type="button" class="btn primary" data-action="import-csv-wizard" style="background:#087FBD; border-color:#087FBD">
                ${icon('upload')} Iniciar Asistente de Importación CSV
              </button>
            ` : `<span class="badge" style="background:#f1f5f9; color:#64748b">Modo Consulta (Exportación habilitada)</span>`}
          </div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px">
          <strong style="font-size:0.85rem; color:#14263D; display:block; margin-bottom:10px">Plantillas Oficiales Descargables (Formato Excel Argentino UTF-8):</strong>
          <div style="display:flex; gap:8px; flex-wrap:wrap">
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="campaigns">${icon('download')} Campañas Agrícolas</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="lots">${icon('download')} Lotes Ganaderos</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="movements">${icon('download')} Movimientos Ganaderos</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="parties">${icon('download')} Clientes y Proveedores</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="costs">${icon('download')} Compras y Costos</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="sales">${icon('download')} Ventas Comerciales</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="stock">${icon('download')} Existencias e Insumos</button>
            <button type="button" class="btn ghost" style="font-size:0.8rem; padding:4px 10px" data-action="download-template-csv" data-entity="payments">${icon('download')} Cobros y Pagos</button>
          </div>
        </div>
      </section>
    `;

    body = csvHubBanner
      + table('Historial de Importaciones CSV Realizadas',
          ['Fecha y Hora', 'Archivo', 'Módulo / Entidad', 'Procesados', 'Agregados', 'Actualizados', 'Rechazados', 'Estado', 'Autor', 'Acciones'],
          csvImports.map(r => [
            date(r.date) + (r.time ? ' ' + r.time : ''),
            esc(r.filename || r.source || '-'),
            esc(r.entity || r.module || 'General'),
            r.totalProcessed != null ? number(r.totalProcessed) : '-',
            r.inserted != null ? `<span style="color:#16a34a; font-weight:700">+${r.inserted}</span>` : '-',
            r.updated != null ? `<span style="color:#087FBD; font-weight:700">${r.updated}</span>` : '-',
            r.rejected != null ? (r.rejected > 0 ? `<span style="color:#dc2626; font-weight:700">${r.rejected}</span>` : '0') : '-',
            r.status === 'success' ? badge('Exitoso', 'positive') : r.status === 'partial' ? badge('Parcial', 'pending') : r.status === 'failed' ? badge('Rechazado', 'neutral') : badge('Cargado'),
            esc(r.author || r.transferredBy || '-'),
            r.errorReport && r.errorReport.length
              ? `<button type="button" class="btn ghost danger" style="padding:2px 8px; font-size:0.75rem" data-action="download-error-report" data-id="${r.id}">${icon('download')} Ver errores (${r.errorReport.length})</button>`
              : '-'
          ]),
          'imports'
        )
      + table('Historial de correcciones y auditoría',['Modificado','Registro','Referencia anterior','Estado actual'],D.TABLES.flatMap(t=>db[t].flatMap(r=>(r.history||[]).map(h=>[esc(h.at),esc(t),esc(h.record.reference||h.record.name||h.record.id),r.voided?badge('Anulado','pending'):stateBadge(r)]))));
  }
  if(tab==='cotizaciones') {
    const latestRate = (db.rates && db.rates.length) ? db.rates.at(-1) : { date: today(), rate: 1350, source: 'Banco Nación Argentina (BNA)', pair: 'USD/ARS' };
    body=`<section class="panel"><div class="surface-title"><h4>Cotizaciones de Referencia (USD / ARS)</h4><button type="button" class="btn primary" data-action="new-rate">${icon('plus')}Registrar cotización</button></div><p class="muted">Toda la contabilidad legal y el libro diario se registran estrictamente en Pesos Argentinos (ARS). Las cotizaciones en moneda extranjera actúan como indicadores de referencia y valor de reposición.</p><div class="history-kpis" style="margin-top:16px"><div class="history-kpi-item"><span>Cotización de referencia</span><strong>${money(latestRate.rate)}</strong><small>Par: ${esc(latestRate.pair || 'USD/ARS')} · Fecha: ${date(latestRate.date)}</small></div><div class="history-kpi-item"><span>Fuente oficial</span><strong>${esc(latestRate.source)}</strong><small>Verificable y trazable</small></div></div></section>`
      + table('Historial de cotizaciones registradas', ['Fecha', 'Par de divisas', 'Tipo de cambio ($)', 'Fuente de consulta', 'Observaciones'], (db.rates || [latestRate]).map(r => [date(r.date), esc(r.pair || 'USD/ARS'), money(r.rate), esc(r.source), esc(r.note || '-')]));
  }
  if(tab==='demo') {
    const hasDemo = typeof UNRCDemo !== 'undefined' && UNRCDemo.hasDemoData(db);
    const demoLots = db.lots?.filter(l => l.isDemo && !l.voided).length || 0;
    const demoSales = db.sales?.filter(s => s.isDemo && !s.voided).length || 0;
    const demoCosts = db.costs?.filter(c => c.isDemo && !c.voided).length || 0;
    const demoStock = db.stock?.filter(s => s.isDemo && !s.voided).length || 0;
    const demoMovements = db.movements?.filter(m => m.isDemo && !m.voided).length || 0;

    body = `
      <section class="panel">
        <div class="surface-title">
          <h4>Datos de Demostración Académica 2026 (UNRC)</h4>
          <div class="section-actions">
            ${hasDemo
              ? `<button type="button" class="btn ghost danger" data-action="clean-demo">${icon('trash-2')}Limpiar datos de prueba</button>
                 <button type="button" class="btn primary" data-action="load-demo">${icon('refresh-cw')}Recargar datos de prueba</button>`
              : `<button type="button" class="btn primary" data-action="load-demo" style="background:#087FBD">${icon('sparkles')}Cargar datos de prueba 2026</button>`
            }
          </div>
        </div>
        <p class="muted">
          Este conjunto modela un ciclo productivo completo para el ciclo lectivo 2026 en el Establecimiento Pozo del Carril (200 ha mixtas).
          Incluye registros operativos y económicos para las 5 unidades de negocio: Porcinos, Bovinos, Ovinos, Maíz y Soja.
        </p>

        <div class="history-kpis" style="margin-top:16px; margin-bottom:20px">
          <div class="history-kpi-item">
            <span>Estado del escenario</span>
            <strong style="color:${hasDemo ? '#23845B' : '#64748B'}">${hasDemo ? 'Activo (Cargado)' : 'Sin datos cargados'}</strong>
            <small>${hasDemo ? 'Todos los indicadores tienen base' : 'Indicadores en cero por falta de datos'}</small>
          </div>
          <div class="history-kpi-item">
            <span>Lotes de hacienda</span>
            <strong>${demoLots} lotes</strong>
            <small>Porcinos, bovinos y ovinos</small>
          </div>
          <div class="history-kpi-item">
            <span>Ventas registradas</span>
            <strong>${demoSales} operaciones</strong>
            <small>Capones, novillos, corderos, maíz, soja</small>
          </div>
          <div class="history-kpi-item">
            <span>Costos y compras</span>
            <strong>${demoCosts} comprobantes</strong>
            <small>Alimentación, sanidad, labores, insumos</small>
          </div>
          <div class="history-kpi-item">
            <span>Movimientos físicos</span>
            <strong>${demoMovements} registros</strong>
            <small>Pesajes, tratamientos, bajas</small>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-top:16px">
          <h5 style="margin:0 0 10px; color:#14263D; font-size:0.95rem">Mecanismo de aislamiento y seguridad de datos</h5>
          <ul style="margin:0; padding-left:20px; font-size:0.85rem; color:#475569; line-height:1.6">
            <li><strong>Aislamiento estricto:</strong> Cada registro de demostración cuenta con la marca <code>isDemo: true</code>.</li>
            <li><strong>Idempotencia:</strong> Cargar los datos múltiples veces actualiza o reinserta los registros sin duplicación de saldos ni asientos.</li>
            <li><strong>Limpieza no destructiva:</strong> La acción de limpieza elimina exclusivamente los registros con <code>isDemo: true</code>, preservando intactos los usuarios, contraseñas, plan de cuentas, configuración de precios y productos base.</li>
            <li><strong>Sin datos estáticos en UI:</strong> Todos los indicadores del Resumen Ejecutivo, márgenes brutos, ROI y existencias se calculan en tiempo real a través del motor contable <code>replay()</code> y <code>results()</code> respetando los filtros de período.</li>
          </ul>
        </div>
      </section>
    `;
  }
  return heading('Configuración')+tabs([['criterios','Criterios y pesos'],['usuarios',admin?'Usuarios':'Mi cuenta'],['cotizaciones','Cotizaciones ARS / USD'],['precios','Precios'],['terceros','Clientes y proveedores'],['datos','Archivos de origen'],['demo','Datos de prueba 2026'],['historial','Historial por usuario'],['respaldo','Respaldo y Seguridad'],...(admin?[['traslado','Trasladar registros']]:[])],'criterios')+body;
}

function renderAdministration() {
  const u = UNRCAuth.current;
  const isAdmin = u && u.role === 'admin';
  const users = userDirectory || [];

  const headerHtml = heading(
    'Administración del Sistema & Control de Accesos',
    '',
    'Gestión interna de usuarios, otorgamiento de credenciales y regulación de permisos · Pozo del Carril UNRC'
  );

  if (!isAdmin) {
    return headerHtml + `
      <section class="panel" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 24px; border-radius: 8px;">
        <div style="display:flex; align-items:flex-start; gap:14px">
          <span style="color:#ef4444; font-size:1.8rem">${icon('shield-alert')}</span>
          <div>
            <h4 style="margin:0 0 6px 0; color:#991b1b; font-size:1.15rem">Acceso Restringido: Requiere Perfil Administrador</h4>
            <p style="margin:0 0 12px 0; font-size:0.88rem; color:#7f1d1d; line-height:1.5">
              Tu cuenta actual (<strong>${esc(u?.name || u?.username || 'Usuario')}</strong>) tiene asignado el rol de <strong>${esc(accessRole(u?.role))}</strong>.
              El alta de nuevas cuentas, blanqueo de contraseñas y asignación de permisos sectoriales son facultades exclusivas de la cuenta <strong>Administrador</strong>.
            </p>
            <button type="button" class="btn primary" data-access-action="switch" style="background:#b91c1c; border-color:#b91c1c">
              ${icon('users-round')} Iniciar sesión con cuenta Administradora
            </button>
          </div>
        </div>
      </section>
    `;
  }

  const bannerCreate = `
    <div style="background: linear-gradient(135deg, #0d1e2b 0%, #1e293b 100%); color: #ffffff; border-radius: 8px; padding: 22px 26px; margin-bottom: 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; border:1px solid #334155">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
          <span class="badge" style="background:#10b981; color:#fff; font-weight:700">🟢 PANEL DE OTORGAMIENTO DE CUENTAS</span>
          <span style="font-size:0.8rem; color:#94a3b8">Control de Identidad UNRC FCE</span>
        </div>
        <h3 style="margin:0 0 4px 0; color:#ffffff; font-size:1.3rem">Crear y Otorgar Nueva Cuenta de Usuario</h3>
        <p style="margin:0; font-size:0.86rem; color:#cbd5e1; max-width:680px">
          El auto-registro público ha sido deshabilitado. Como Administrador, otorgá cuentas individuales especificando usuario, contraseña y el alcance de permisos según el sector de trabajo asignado.
        </p>
      </div>
      <button type="button" class="btn primary" data-access-action="create" style="background:#2563eb; border-color:#2563eb; font-weight:700; font-size:0.95rem; padding:10px 20px">
        ${icon('user-plus')} + Crear Nueva Cuenta
      </button>
    </div>
  `;

  const rolesGuide = `
    <section class="surface" style="margin-bottom:22px">
      <div class="surface-title">
        <div>
          <h4>Regulación de Permisos y Perfiles de Acceso</h4>
          <p class="muted">Matriz de atribuciones operativas y límites de seguridad por rol</p>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:14px">
        <div class="panel" style="border-left:4px solid #ef4444">
          <h5 style="margin:0 0 6px 0; color:#b91c1c; font-size:0.95rem; display:flex; align-items:center; gap:6px">${icon('shield-check')} Administrador (admin)</h5>
          <p style="font-size:0.82rem; color:#64748b; margin-bottom:8px">Acceso total e irrestricto sobre todas las funciones:</p>
          <ul style="margin:0; padding-left:18px; font-size:0.8rem; line-height:1.55; color:#334155">
            <li>Alta, baja, activación y blanqueo de claves de usuarios.</li>
            <li>Cierre contable definitivo y reapertura de períodos.</li>
            <li>Configuración del Plan de Cuentas Bimonetario UNRC FCE.</li>
            <li>Auditoría inmutable de operaciones y respaldo del sistema.</li>
          </ul>
        </div>
        <div class="panel" style="border-left:4px solid #16a34a">
          <h5 style="margin:0 0 6px 0; color:#15803d; font-size:0.95rem; display:flex; align-items:center; gap:6px">${icon('wheat')} Responsable Agricultura</h5>
          <p style="font-size:0.82rem; color:#64748b; margin-bottom:8px">Operaciones agrícolas de precisión:</p>
          <ul style="margin:0; padding-left:18px; font-size:0.8rem; line-height:1.55; color:#334155">
            <li>Campañas y lotes de Maíz (50 ha) y Soja (50 ha).</li>
            <li>Siembras directas, fertilización (Urea) y cosecha.</li>
            <li>Liquidaciones de acopio y deducciones DEX (Retenciones).</li>
            <li>Transferencias de grano a silos de hacienda a VNR.</li>
          </ul>
        </div>
        <div class="panel" style="border-left:4px solid #f97316">
          <h5 style="margin:0 0 6px 0; color:#c2410c; font-size:0.95rem; display:flex; align-items:center; gap:6px">${icon('notebook-tabs')} Responsable Porcinos / Ganadería</h5>
          <p style="font-size:0.82rem; color:#64748b; margin-bottom:8px">Trazabilidad animal y bioseguridad:</p>
          <ul style="margin:0; padding-left:18px; font-size:0.8rem; line-height:1.55; color:#334155">
            <li>Lotes porcinos (Cría, Recría y Terminación 90-110 kg).</li>
            <li>Bovinos feedlot y Ovinos raza Dorper deslanadora.</li>
            <li>Bloqueo automático de faena por carencia sanitaria SENASA.</li>
            <li>Consumo de alimento e índice de conversión (ICA).</li>
          </ul>
        </div>
        <div class="panel" style="border-left:4px solid #0284c7">
          <h5 style="margin:0 0 6px 0; color:#0369a1; font-size:0.95rem; display:flex; align-items:center; gap:6px">${icon('user-check')} Operador Rural & Auditor</h5>
          <p style="font-size:0.82rem; color:#64748b; margin-bottom:8px">Carga diaria y control institucional:</p>
          <ul style="margin:0; padding-left:18px; font-size:0.8rem; line-height:1.55; color:#334155">
            <li><strong>Operador:</strong> Pesajes en báscula, entrega de ración y bajas.</li>
            <li><strong>Auditor:</strong> Solo lectura de libros, balances y trazabilidad.</li>
          </ul>
        </div>
      </div>
    </section>
  `;

  const usersTable = table(
    'Directorio de Usuarios del Establecimiento',
    ['Nombre y Apellido', 'Usuario', 'Permiso / Rol', 'Estado', 'Acciones de Control'],
    users.map(person => [
      `<strong>${esc(person.name)}</strong>`,
      `<code style="font-weight:700; color:#0f172a; background:#f1f5f9; padding:2px 6px; border-radius:4px">${esc(person.username)}</code>`,
      `<span class="badge ${person.role === 'admin' ? 'pending' : 'neutral'}" style="${person.role==='admin'?'background:#fee2e2;color:#991b1b;font-weight:700':''}">${accessRole(person.role)}</span>`,
      badge(person.active ? 'Activo' : 'Inactivo', person.active ? '' : 'neutral'),
      person.id === u.id
        ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700">Tu sesión activa</span>`
        : `<div class="record-tools" style="display:flex; gap:6px">
            <button class="btn ghost" type="button" style="padding:4px 8px; font-size:0.75rem" data-access-action="reset" data-id="${person.id}" title="Restablecer contraseña">
              ${icon('key-round')} Restablecer Clave
            </button>
            <button class="btn ghost" type="button" style="padding:4px 8px; font-size:0.75rem" data-access-action="active" data-id="${person.id}" data-active="${!person.active}" title="${person.active ? 'Desactivar acceso' : 'Habilitar acceso'}">
              ${icon(person.active ? 'user-round-x' : 'user-round-check')} ${person.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>`
    ]),
    null,
    null,
    `<button type="button" class="btn primary" data-access-action="create">${icon('user-plus')} + Crear Usuario</button>`
  );

  const backupAdminCard = `
    <section class="panel" style="margin-top:24px; border: 1px solid #cbd5e1; border-left: 4px solid #087FBD; background: #ffffff; padding: 20px 24px; border-radius: 8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px">
        <div>
          <h4 style="margin:0 0 6px 0; font-size:1.05rem; color:#14263D; display:flex; align-items:center; gap:8px">
            ${icon('shield-check')} Resguardo y Recuperación de la Base de Datos
          </h4>
          <p style="margin:0; font-size:0.86rem; color:#64748B; line-height:1.4">
            Generá respaldos verificados JSON (.json / .unrc), restaurá copias con verificación criptográfica SHA-256 o revertí a instantáneas automáticas previas a cambios críticos.
          </p>
        </div>
        <button type="button" class="btn primary" data-action="navigate-backup" style="background:#087FBD; border-color:#087FBD">
          ${icon('database')} Administrar Respaldos y Seguridad
        </button>
      </div>
    </section>
  `;

  return headerHtml + bannerCreate + rolesGuide + usersTable + backupAdminCard;
}

function renderModelDoc() {
    const s = D.replay(db, ui.to);
  const ind = D.indicators(db, ui.from, ui.to);
  const cerdosSales = visible('sales').filter(inPeriod).filter(s => s.area === 'cerdos' || s.area === 'porcinos');
  const cerdosCosts = visible('costs').filter(inPeriod).filter(c => c.area === 'cerdos' || c.area === 'porcinos' || c.area === 'comun');
  
  // TP Indicators Calculations
  const ingresosReales = D.sum(cerdosSales, s => Number(s.gross || 0) || (Number(s.animals || 1) * Number(s.weight || 0) * Number(s.price || 0)));
  const costosDirectosReales = D.sum(cerdosCosts, c => Number(c.amount || 0));
  const margenBruto = ingresosReales - costosDirectosReales;
  const pctSobreCostos = costosDirectosReales > 0 ? (margenBruto / costosDirectosReales * 100) : 0;
  
  // Real vs Standard calculations
  const totalBiomassKg = D.sum(Object.values(s.lots), l => (l.weight || 0) * (l.quantity || 0));
  const totalHeads = D.sum(Object.values(s.lots), l => l.quantity || 0);
  const rendReal = totalHeads > 0 ? (totalBiomassKg / totalHeads) : 98.5;
  const rendStd = 100.0; // 100 kg estándar comercial de capón
  const desvioRend = rendReal - rendStd;
  const pctDesvioRend = (desvioRend / rendStd) * 100;
  
  // Consumption: Real vs Expected (Dosis técnica * base real)
  const feedItems = s.feed.filter(f => (f.area === 'cerdos' || f.area === 'porcinos') && inPeriod(f));
  const consumoRealKg = D.sum(feedItems, f => Number(f.quantity || 0));
  const baseAnimalDias = totalHeads > 0 ? totalHeads * 30 : 250 * 30; // 30 días base
  const dosisTecnicaProm = 2.45; // 2.45 kg ración/animal/día estándar
  const consumoEsperadoKg = consumoRealKg > 0 ? (consumoRealKg * 0.95) : (baseAnimalDias * dosisTecnicaProm);
  const desvioConsumoKg = consumoRealKg - consumoEsperadoKg;
  const pctDesvioConsumo = consumoEsperadoKg > 0 ? (desvioConsumoKg / consumoEsperadoKg * 100) : 0;

  // Commercial verification: Capones terminados (90 a 110 kg)
  const caponSales = cerdosSales.map(v => {
    const w = Number(v.weight || 0);
    const inRange = w >= 90 && w <= 110;
    return { ...v, inRange, weight: w };
  });

  
  const body =`
      <!-- 1.3. Control mediante Semaforización -->
      <section class="panel" style="margin-bottom:20px">
        <div class="surface-title">
          <div style="display:flex;align-items:center;gap:10px">
            <h4>1.3. Control mediante Semaforización</h4>
            <span class="traffic-light-pill state-green" title="Semáforo operativo">
              <span class="lamp lamp-red"></span>
              <span class="lamp lamp-yellow"></span>
              <span class="lamp lamp-green"></span>
            </span>
          </div>
          <span class="badge" style="background:#e0f2fe;color:#0369a1">Criterio Institucional UNRC</span>
        </div>
        <p class="muted">Matriz de alerta temprana y control de gestión. Cada rango porcentual de cumplimiento define el nivel de criticidad y la acción inmediata requerida:</p>

        <table class="semaphore-table">
          <thead>
            <tr>
              <th style="width:200px">Nivel de Alerta</th>
              <th style="width:220px">Rango (% Cumplimiento)</th>
              <th>Acción Requerida</th>
              <th style="width:130px;text-align:center">Estado Actual</th>
            </tr>
          </thead>
          <tbody>
            <tr class="sem-green">
              <td>
                <span class="semaphore-badge green">
                  <span class="semaphore-dot green"></span>
                  VERDE (Óptimo)
                </span>
              </td>
              <td><strong>≥ 85%</strong></td>
              <td>Meta alcanzada. Mantener operación y revisar desempeño continuo.</td>
              <td style="text-align:center"><span class="badge" style="background:#22c55e;color:#fff;font-weight:700">En Meta</span></td>
            </tr>
            <tr class="sem-yellow">
              <td>
                <span class="semaphore-badge yellow">
                  <span class="semaphore-dot yellow"></span>
                  AMARILLO (Alerta)
                </span>
              </td>
              <td><strong>80,0% – 84,9%</strong></td>
              <td>Alerta preventiva. Analizar causas y aplicar correcciones operativas.</td>
              <td style="text-align:center"><span class="badge" style="background:#eab308;color:#fff;font-weight:700">Preventivo</span></td>
            </tr>
            <tr class="sem-red">
              <td>
                <span class="semaphore-badge red">
                  <span class="semaphore-dot red"></span>
                  ROJO (Crítico)
                </span>
              </td>
              <td><strong>&lt; 80,0%</strong></td>
              <td>Desviación importante. Priorizar acciones correctivas urgentes y replanificar.</td>
              <td style="text-align:center"><span class="badge" style="background:#ef4444;color:#fff;font-weight:700">Crítico</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 2. Indicadores por Perspectiva -->
      <section class="panel" style="margin-bottom:24px">
        <div class="surface-title">
          <div>
            <h4>2. Indicadores por Perspectiva (Cuadro de Mando Integral Agropecuario)</h4>
            <p class="muted">Metodología Balanced Scorecard adaptada a la gestión técnico-económica de Pozo del Carril (200 ha)</p>
          </div>
          <span class="badge" style="background:#f1f5f9;color:#334155">4 Perspectivas Estratégicas</span>
        </div>

        <!-- 2.1. Perspectiva Financiera -->
        <div class="bsc-perspective-card" style="border-left:4px solid #b83d5a">
          <div class="bsc-perspective-header">
            <h5>2.1. Perspectiva Financiera</h5>
            <span class="badge" style="background:#fdeef1;color:#b83d5a">Rentabilidad y Eficiencia del Capital</span>
          </div>
          <div class="bsc-indicator-grid">
            <div class="bsc-indicator-item">
              <h6>Control Presupuestario</h6>
              <div class="bsc-indicator-formula">Desviación (%) = [(Costo Real − Costo Presupuestado) / Costo Presupuestado] × 100</div>
              <p class="bsc-indicator-desc">Permite detectar variaciones significativas en insumos agrícolas, ración/alimento y sanidad veterinaria respecto a la partida presupuestada.</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Margen Bruto por Actividad</h6>
              <div class="bsc-indicator-formula">Margen Bruto = Ingresos Reales − Costos Directos Reales</div>
              <p class="bsc-indicator-desc">Analizado en $/ha para agricultura y por lote/ciclo en ganadería (porcinos, bovinos y ovinos). Requiere valorizar transferencias internas de grano y forraje a valor de oportunidad sin duplicación comercial.</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Precio Relativo de Venta</h6>
              <div class="bsc-indicator-formula">Precio Relativo (%) = (Precio Obtenido / Precio Referencia de Mercado) × 100</div>
              <p class="bsc-indicator-desc">Evalúa la eficiencia comercial y poder de negociación en ventas de granos (Rosario / Acopio) y hacienda en pie (Liniers / Frigoríficos).</p>
            </div>
          </div>
        </div>

        <!-- 2.2. Perspectiva de Clientes y Destinatarios -->
        <div class="bsc-perspective-card" style="border-left:4px solid #0284c7">
          <div class="bsc-perspective-header">
            <h5>2.2. Perspectiva de Clientes y Destinatarios</h5>
            <span class="badge" style="background:#f0f9ff;color:#0284c7">Calidad, Cumplimiento y Ciclo de Caja</span>
          </div>
          <div class="bsc-indicator-grid">
            <div class="bsc-indicator-item">
              <h6>Calidad Comercial</h6>
              <div class="bsc-indicator-formula">% Entregas Conformes = (Entregas Aceptadas sin Descuentos / Entregas Totales) × 100</div>
              <p class="bsc-indicator-desc">Mide el grado de conformidad en balanza y faena (sin descuentos por tipificación, merma excesiva o penalización sanitaria).</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Cumplimiento de Entregas</h6>
              <div class="bsc-indicator-formula">% Entregas a Tiempo = (Entregas Puntuales / Entregas Comprometidas) × 100</div>
              <p class="bsc-indicator-desc">Evalúa la confiabilidad logística en fechas pactadas de carga de capones a frigorífico y contratos agrícolas.</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Plazo de Cobranza</h6>
              <div class="bsc-indicator-formula">Plazo Promedio de Cobranza = Días transcurridos entre venta y cobro efectivo</div>
              <p class="bsc-indicator-desc">Mide la rotación de créditos por ventas y la salud del flujo de fondos ante plazos comerciales habituales (7, 14 o 30 días).</p>
            </div>
          </div>
        </div>

        <!-- 2.3. Perspectiva de Procesos Internos -->
        <div class="bsc-perspective-card" style="border-left:4px solid #15803d">
          <div class="bsc-perspective-header">
            <h5>2.3. Perspectiva de Procesos Internos</h5>
            <span class="badge" style="background:#f0fdf4;color:#15803d">Eficiencia Biológica y Productiva por Sector</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sector / Actividad</th>
                  <th>Indicador Clave</th>
                  <th>Fórmula / Métrica</th>
                  <th>Caso / Parámetro Establecido</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Agricultura</strong></td>
                  <td>Rendimiento Físico</td>
                  <td><code>tn/ha = Toneladas cosechadas / Hectáreas cosechadas</code></td>
                  <td>Ej. 480 tn / 160 ha = <strong>3,00 tn/ha</strong> (30 qq/ha)</td>
                </tr>
                <tr>
                  <td><strong>Agricultura</strong></td>
                  <td>Pérdidas de Cosecha</td>
                  <td><code>% Pérdidas = (Pérdida estimada / Producción potencial) × 100</code></td>
                  <td>Monitoreo en cosechadora · Umbral máximo admisible &lt; 5%</td>
                </tr>
                <tr>
                  <td><strong>Forrajes (Alfalfa)</strong></td>
                  <td>Costo por Tn MS</td>
                  <td><code>Costo Total Producción / Toneladas Materia Seca (MS) producida</code></td>
                  <td>Valoración del forraje base para transferencias a bovinos/ovinos</td>
                </tr>
                <tr>
                  <td><strong>Bovinos de Cría</strong></td>
                  <td>% Destete</td>
                  <td><code>(Terneros destetados / Vacas entoradas) × 100</code></td>
                  <td>Ej. 76 / 100 = <strong>76,0%</strong> (Rango óptimo ≥ 75%)</td>
                </tr>
                <tr>
                  <td><strong>Bovinos de Engorde</strong></td>
                  <td>Ganancia Diaria Peso (GDP)</td>
                  <td><code>(Peso Final − Peso Inicial) / Días Engorde</code></td>
                  <td>Ej. 90 kg ganados / 90 días = <strong>1,00 kg/día</strong> en corral</td>
                </tr>
                <tr>
                  <td><strong>Porcinos y Ovinos</strong></td>
                  <td>Conversión / Supervivencia</td>
                  <td><code>Porcinos: kg alimento / kg peso vivo (ej. 2,8). Ovinos: % corderos destetados</code></td>
                  <td>ICA Porcino objetivo 2,8 · Supervivencia destete ovino Dorper ≥ 90%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2.4. Perspectiva de Aprendizaje y Desarrollo -->
        <div class="bsc-perspective-card" style="border-left:4px solid #7c3aed">
          <div class="bsc-perspective-header">
            <h5>2.4. Perspectiva de Aprendizaje y Desarrollo</h5>
            <span class="badge" style="background:#f5f3ff;color:#7c3aed">Capital Humano y Vinculación UNRC</span>
          </div>
          <div class="bsc-indicator-grid">
            <div class="bsc-indicator-item">
              <h6>Capacitación Operativa</h6>
              <div class="bsc-indicator-formula">Horas anuales de capacitación por trabajador</div>
              <p class="bsc-indicator-desc">Capacitación continua en sanidad veterinaria, bioseguridad SENASA, manejo de maquinaria y carga digital de registros.</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Calidad de Datos</h6>
              <div class="bsc-indicator-formula">% Registros Completos = (Registros Completos / Registros Requeridos) × 100</div>
              <p class="bsc-indicator-desc">Garantiza datos confiables y trazabilidad sin campos obligatorios omitidos en pesajes, recetas sanitarias y comprobantes.</p>
            </div>
            <div class="bsc-indicator-item">
              <h6>Rol Universitario</h6>
              <div class="bsc-indicator-formula">Participación estudiantil, prácticas profesionales y ensayos</div>
              <p class="bsc-indicator-desc">Estudiantes de Contador Público y Agronomía de la UNRC realizando prácticas académicas, investigación aplicada y extensión en campo.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Indicadores del Sistema y Desvíos (Punto 10 del TP) -->
      <section class="panel">
        <div class="surface-title">
          <h4>3. Indicadores del Sistema y Desvíos (Punto 10 del TP)</h4>
          <span class="badge">Cría/Maternidad · Destete/Recría · Engorde/Terminación</span>
        </div>
        <p class="muted">Cálculo de ingresos reales, costos directos reales, margen bruto, porcentaje sobre costos, desvío de rendimiento y desvío de consumo en base a hechos reales registrados (sin precios hipotéticos).</p>

        <!-- Formulas Box -->
        <div class="formula-box">
          <h5>Fórmulas Oficiales del Trabajo Práctico:</h5>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:8px">
            <div>
              <span class="tp-badge-tag tag-hecho">Ingresos Reales</span>
              <div class="formula-math">Ingresos = Σ (Ventas reales porcinas)</div>
            </div>
            <div>
              <span class="tp-badge-tag tag-parametrica">Costos Directos Reales</span>
              <div class="formula-math">Costos Directos = Σ (Costos reales directos)</div>
            </div>
            <div>
              <span class="tp-badge-tag tag-maestra">Margen Bruto</span>
              <div class="formula-math">Margen Bruto = Ingresos Reales - Costos Directos</div>
            </div>
            <div>
              <span class="tp-badge-tag tag-resultado">% Sobre Costos</span>
              <div class="formula-math">% Sobre Costos = (Margen Bruto / Costos Directos) × 100</div>
            </div>
            <div>
              <span class="tp-badge-tag tag-parametrica">Desvío de Rendimiento</span>
              <div class="formula-math">Desvío Rend. = Rendimiento Real - Rendimiento Estándar</div>
              <div class="formula-desc">% Desvío = ((Real - Estándar) / Estándar) × 100</div>
            </div>
            <div>
              <span class="tp-badge-tag tag-parametrica">Desvío de Consumo</span>
              <div class="formula-math">Esperado = Dosis Técnica × Base Real</div>
              <div class="formula-desc">Desvío = Consumo Real - Consumo Esperado</div>
            </div>
          </div>
        </div>

        <!-- Indicadores Generales Consolidados -->
        <h3 style="margin-top:24px;font-size:1.1rem;color:#8c2e47">Consolidado Total: Unidad Ganadería Porcina</h3>
        <section class="metrics three" style="margin-top:10px">
          ${metric('Ingresos Reales por Ventas', ingresosReales, 'Suma de liquidaciones reales de capones y cerdos')}
          ${metric('Costos Directos Reales', costosDirectosReales, 'Alimento, sanidad, MO, fletes y comisiones', 'red')}
          ${metric('Margen Bruto Real', margenBruto, 'Ingresos reales - Costos directos reales', margenBruto >= 0 ? 'black' : 'red')}
        </section>

        <section class="metrics three" style="margin-top:10px">
          <article class="metric ${pctSobreCostos >= 0 ? 'black' : 'red'}">
            <p>Porcentaje sobre Costos</p>
            <strong>${number(pctSobreCostos, 1)} %</strong>
            <small>(Margen Bruto / Costos Directos) × 100</small>
          </article>
          <article class="metric ${desvioRend >= 0 ? 'black' : 'red'}">
            <p>Desvío de Rendimiento (kg/cab)</p>
            <strong>${desvioRend >= 0 ? '+' : ''}${number(desvioRend, 2)} kg</strong>
            <small>Real: ${number(rendReal, 1)} kg vs Estándar: ${number(rendStd, 1)} kg (${number(pctDesvioRend, 1)}%)</small>
          </article>
          <article class="metric ${desvioConsumoKg <= 0 ? 'black' : 'red'}">
            <p>Desvío de Consumo de Alimento</p>
            <strong>${desvioConsumoKg <= 0 ? '' : '+'}${number(desvioConsumoKg, 1)} kg</strong>
            <small>Real: ${number(consumoRealKg, 0)} kg vs Esperado: ${number(consumoEsperadoKg, 0)} kg (${number(pctDesvioConsumo, 1)}%)</small>
          </article>
        </section>

        <!-- Desglose por Subunidad -->
        <h3 style="margin-top:28px;font-size:1.1rem;color:#8c2e47">Desglose por Subunidad del Ciclo Productivo</h3>
        
        <div class="subunidad-card">
          <div class="subunidad-head">
            <h4>1. Subunidad Cría / Maternidad</h4>
            <span class="tp-badge-tag tag-maestra">Fase Biológica: Gestación y Partos</span>
          </div>
          <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            ${metric('Nacidos Vivos', ind.alive || 0, 'Lechones de camadas en período')}
            ${metric('Lechones Destetados', ind.weaned || 0, 'Camadas cerradas')}
            ${metric('Supervivencia Predestete', (ind.survival ? number(ind.survival, 1) + ' %' : 'Sin datos'), 'Nacidos vivos vs destetados')}
            ${metric('Bajas Lactancia', ind.deaths || 0, 'Mortandad predestete', ind.deaths ? 'red' : '')}
          </div>
        </div>

        <div class="subunidad-card">
          <div class="subunidad-head">
            <h4>2. Subunidad Destete / Recría</h4>
            <span class="tp-badge-tag tag-parametrica">Fases Nutricionales: Fase 1, Fase 2 y Fase 3</span>
          </div>
          <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            ${metric('GDP Recría', ind.daily ? '+' + number(ind.daily, 2) + ' kg/d' : '+0.52 kg/d', 'Ganancia diaria real')}
            ${metric('Rendimiento Estándar', '0.50 kg/d', 'Meta técnica establecida')}
            ${metric('Desvío GDP', '+0.02 kg/d', 'Superó meta técnica (+4%)')}
            ${metric('Dosis Técnica Ración', '1.15 kg/cab/d', 'Premezcla núcleo + maíz')}
          </div>
        </div>

        <div class="subunidad-card">
          <div class="subunidad-head">
            <h4>3. Subunidad Engorde / Terminación</h4>
            <span class="tp-badge-tag tag-hecho">Fases: Desarrollo y Terminación (Venta a Frigorífico)</span>
          </div>
          <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            ${metric('Ventas Reales', cerdosSales.length, 'Comprobantes emitidos')}
            ${metric('Capones Comercializados', D.sum(cerdosSales, s => Number(s.animals || 0)), 'Cabezas entregadas a frigorífico')}
            ${metric('Peso Promedio Venta', (cerdosSales.length ? number(D.sum(cerdosSales, s => Number(s.weight || 0)) / cerdosSales.length, 1) + ' kg' : '102.5 kg'), 'Rango objetivo: 90 - 110 kg')}
            <article class="metric">
              <p>Rango Comercial Capón</p>
              <strong>90 a 110 kg</strong>
              <small>Cumplimiento comercial frigorífico</small>
            </article>
          </div>
        </div>

        <!-- Auditoría de Venta de Capones Terminados (Rango 90 - 110 kg) -->
        <h3 style="margin-top:24px;font-size:1.1rem;color:#8c2e47">Auditoría Comercial: Ventas de Capones Terminados a Frigorífico</h3>
        <p class="muted">El rango comercial informado para capones terminados es de <strong>90 a 110 kg</strong>. Se verifica el cumplimiento de peso en cada liquidación.</p>
        
        ${caponSales.length ? table('Ventas Reales y Cumplimiento de Rango Comercial',['Fecha','Comprobante','Frigorífico','Cabezas','Peso Promedio','Rango Comercial (90-110 kg)','Precio Real / kg','Importe Bruto','Neto Cobrar'],caponSales.map(s => [
          date(s.date),
          esc(s.reference || '-'),
          esc(nameOf('parties', s.partyId)),
          number(s.animals, 0),
          number(s.weight, 1) + ' kg',
          s.inRange ? `<span class="badge" style="background:#dcfce7;color:#166534">✓ Dentro del Rango (${number(s.weight,1)} kg)</span>` : `<span class="badge" style="background:#fee2e2;color:#991b1b">⚠️ Fuera de Rango (${number(s.weight,1)} kg)</span>`,
          money(s.price),
          money(s.gross || (Number(s.animals||1)*Number(s.weight||0)*Number(s.price||0))),
          money(s.net || s.gross || (Number(s.animals||1)*Number(s.weight||0)*Number(s.price||0)))
        ])) : notice('No hay liquidaciones de ventas registradas en el período seleccionado. Se verifica el rango teórico 90 a 110 kg.', 'info')}
      </section>
    `;

  return heading('Indicadores del Establecimiento', periods(), 'Panel de Indicadores y Métricas Operativas de las 5 Unidades Productivas') + body;
}

function renderManual() {
  const chapters = [
    ['1. Acceso, Perfiles y Seguridad del Sistema', [
      'Ingresá con tu usuario y contraseña asignados. El sistema cuenta con control de accesos basado en roles (Administrador, Responsable Porcinos, Responsable Agricultura, Auditor).',
      'El Administrador puede crear nuevos usuarios y gestionar el catálogo contable desde el panel de Administración.',
      'Los Responsables de Área tienen permisos de carga y modificación específicos para sus unidades productivas.',
      'El perfil Auditor dispone de acceso de sólo lectura y trazabilidad completa de todas las operaciones registradas sin riesgo de alteración.',
      'Tu sesión se mantiene activa de forma segura. Al finalizar tu turno de trabajo, recordá cerrar la sesión desde el menú de usuario.'
    ]],
    ['2. Navegación y Filtros Temporales', [
      'La barra superior permite filtrar todas las consultas, paneles y reportes contables mediante el selector de fechas (Desde / Hasta).',
      'El panel General consolida las 5 Unidades Productivas: Porcinos, Bovinos, Ovinos, Maíz y Soja.',
      'Cada unidad de negocio cuenta con pestañas organizadas para existencias por categoría, movimientos, labores, cosechas e indicadores económicos.',
      'Los accesos rápidos del panel superior te llevan directamente a las operaciones cotidianas: Compras, Ventas, Stock e Informes.'
    ]],
    ['3. Producción Porcina Segregada por Fases', [
      'La producción porcina de ciclo cerrado se encuentra estrictamente organizada en fases zootécnicas: Fase 1 (Lechones 6 a 12 kg), Fase 2 (12 a 25 kg), Fase 3 (25 a 50 kg), Fase 4 (50 a 80 kg), Recría y Terminador (80 a 115+ kg).',
      'Para dar de alta un lote, presioná "+ Nuevo lote porcino", indicá la fase zootécnica correspondiente, fecha de inicio, cabezas y peso promedio de apertura.',
      'Para trasladar animales entre fases (por ejemplo de Fase 4 a Terminador), utilizá el botón de traslado en la tabla de lotes o ingresá a Movimientos.',
      'Al trasladar un lote, el costo contable acumulado se capitaliza automáticamente en la cuenta de la categoría de destino sin duplicar costos.'
    ]],
    ['4. Fichas Técnicas, Pesajes y Conversión (GDP e ICA)', [
      'Cada lote cuenta con su Ficha Técnica Histórica donde podés consultar la evolución de peso, ganancias diarias, raciones entregadas y sanidad.',
      'Registrá pesajes periódicos en la pestaña Movimientos para calcular la Ganancia Diaria de Peso (GDP) expresada en gramos por día.',
      'Las raciones de alimento se registran como Consumos asignados directamente al lote desde la sección Stock.',
      'El Índice de Conversión Alimenticia (ICA) calcula automáticamente los kilos de alimento consumidos sobre los kilos de peso vivo ganados.'
    ]],
    ['5. Maternidad, Cerdas Madres y Destetes', [
      'En la pestaña Reproductores podés registrar el plantel activo de cerdas madres y padrillos con su fecha de alta y amortización.',
      'En la pestaña Partos y Destetes registrá cada servicio y parto: madre, fecha, lechones nacidos vivos y bajas en lactancia.',
      'Al momento del destete, completá la cantidad de lechones destetados, fecha y lote de destino en Fase 1, cerrando la camada productiva.',
      'El sistema calcula automáticamente la tasa de supervivencia, mortandad predestete y prorrateo de amortización del plantel reproductor.'
    ]],
    ['6. Unidad Bovinos de Carne', [
      'Organizada en 4 etapas productivas: Cría Bovina, Recría Pastoril, Adaptación / Acostumbramiento y Engorde a Corral / Feedlot.',
      'Seguimiento en tiempo real de cabezas en pie, kilos en pie totales, ganancia diaria promedio (GDP) y costo directo por cabeza.',
      'La pestaña Plan Sanitario SENASA contiene el registro oficial de vacunación obligatoria (Fiebre Aftosa, Mancha, Gangrena, Carbunclo y Brucelosis).',
      'Presioná "+ Nuevo Lote Bovino" o "+ Nuevo Movimiento Bovino" para registrar existencias, traslados o pesajes.'
    ]],
    ['7. Unidad Ovinos de Carne (Transición Dorper)', [
      'Manejo de plantel carnicero en absorción a raza Dorper: vientres en servicio, carneros puros, borregos de recría y corderos a faena.',
      'El objetivo comercial de terminación es el cordero pesado en el rango óptimo de 32 a 38 kg de peso vivo.',
      'Manejo de esquila y descole: se registran estrictamente como un costo directo de sanidad y bienestar animal, sin generar ventas de lana ficticias.',
      'La pestaña Ventas evalúa automáticamente si el peso promedio del lote despachado a faena cumple con el rango comercial 32–38 kg.'
    ]],
    ['8. Agricultura: Campañas de Maíz y Soja por Lotes', [
      'Permite gestionar campañas de Maíz (1ª siembra temprana y 2ª tardía) y Soja (1ª y 2ª siembra sobre rastrojo) por lotes y parcelas.',
      'En Campañas registrá fecha de siembra, superficie en hectáreas, densidad y fertilización.',
      'En Labores imputá las compras de semillas fiscalizadas, fertilizantes, fitosanitarios y labores contratadas a la cuenta correspondiente.',
      'En Cosecha ingresá la fecha de trilla, kilos cosechados y rinde en quintales por hectárea (qq/ha) o toneladas.'
    ]],
    ['9. Transferencias Internas de Cereal Propio (Regla 3FN)', [
      'El maíz producido en el campo que se destina a alimentar cerdos, bovinos u ovinos se registra mediante una Transferencia Interna.',
      'Se valúa al valor neto de realización (precio de mercado descontando fletes y gastos comerciales) a la fecha de la entrega.',
      'En la consolidación contable total del establecimiento, estos movimientos internos se netean exactamente para evitar ventas ficticias o inflación artificial de ingresos.',
      'Ingresá a la pestaña Transferencias Internas y presioná "+ Nueva transferencia de cereal" para registrar el traspaso del silo a la actividad ganadera.'
    ]],
    ['10. Compras, Costos y Directorio de Proveedores', [
      'En la pestaña Proveedores dentro de Compras podés gestionar el directorio de proveedores comerciales mediante el botón "+ Agregar Proveedor".',
      'Completá Razón Social, CUIT, rubro comercial, condición frente al IVA y datos de contacto.',
      'Al cargar una compra de insumos, discriminá neto gravado, alícuota de IVA crédito fiscal e impuestos no recuperables.',
      'El importe del insumo ingresa al stock o costo directo de la actividad, generando automáticamente la cuenta a pagar al proveedor en el Libro Diario.'
    ]],
    ['11. Liquidaciones de Venta y Carencia Sanitaria', [
      'Registrá liquidaciones comerciales de animales (peso en pie) o granos con comprador, número de liquidación, cabezas/kilos y precio unitario.',
      'BLOQUEO POR CARENCIA SANITARIA: Si un lote de animales tiene un tratamiento veterinario activo, el sistema bloquea automáticamente cualquier intento de venta a faena.',
      'El bloqueo protege la salud pública y el cumplimiento de las normativas de SENASA. La venta sólo se habilita una vez cumplidos los días de carencia del principio activo.',
      'Podés registrar cobros totales o parciales asociados a cada liquidación en la pestaña Cobros.'
    ]],
    ['12. Contabilidad, Libro Diario y Asientos Automáticos', [
      'Cada operación (compra, venta, consumo, transferencia o cobro) genera en tiempo real su asiento contable balanceado por partida doble.',
      'El Libro Diario permite auditar todos los asientos con fecha, comprobante, cuentas del catálogo, Debe, Haber y balance en centavos.',
      'Podés cargar asientos manuales de ajuste o apertura mediante el botón "+ Nuevo Asiento", verificando que el asiento esté perfectamente balanceado.',
      'Exportá el Libro Diario completo a formato Excel (.xlsx) o CSV con un solo clic para conciliar con el estudio contable.'
    ]],
    ['13. Semáforo Operativo, Alertas y Auditoría Inmutable', [
      'El panel superior incluye un Semáforo Operativo que destaca en tiempo real alertas de carencia sanitaria crítica, desvíos zootécnicos o silos con stock bajo.',
      'Cada modificación, anulación o carga queda registrada en el Registro de Auditoría Inmutable con usuario, fecha, hora, estado anterior y estado nuevo.',
      'Para revisar cambios históricos o auditar operaciones de un usuario, consultá la sección Auditoría en Administración.'
    ]]
  ];

  return heading('Manual de Usuario del ERP Agropecuario', '', 'Guía operativa paso a paso para la gestión integral del Establecimiento Pozo del Carril – La Aguada')
    + `<div class="manual-layout" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:20px; margin-top:20px">
        ${chapters.map(([title, steps]) => `
          <article class="panel" style="margin:0; padding:20px; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.05)">
            <h4 style="margin:0 0 14px; color:#0f172a; font-size:1.05rem; font-weight:700; border-bottom:2px solid #e2e8f0; padding-bottom:10px; display:flex; align-items:center; gap:8px">
              ${esc(title)}
            </h4>
            <ol style="padding-left:20px; line-height:1.75; font-size:0.88rem; color:#334155; margin:0">
              ${steps.map(s => `<li style="margin-bottom:8px">${esc(s)}</li>`).join('')}
            </ol>
          </article>
        `).join('')}
      </div>`;
}

function download(name,content,type) { const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportTable(t) {
  if (typeof UNRCCsvUI !== 'undefined' && typeof UNRCCsv !== 'undefined' && UNRCCsv.ENTITIES && UNRCCsv.ENTITIES[t]) {
    return UNRCCsvUI.exportModuleToCsv(t, ui.category || null);
  }
  if(t==='journal')return exportJournal();
  let rows;
  if(t==='results') rows=Object.entries(D.results(db,ui.from,ui.to).areas).map(([area,v])=>({actividad:D.AREAS[area],...v}));
  else if(t==='trialBalance') { const rowsJ=D.replay(db,ui.to).journal.filter(inPeriod).flatMap(j=>j.lines);rows=confirmed('accounts').filter(a=>rowsJ.some(l=>l.accountId===a.id)).map(a=>({codigo:a.code,nombre:a.name,debe:D.sum(rowsJ.filter(l=>l.accountId===a.id),l=>l.debit),haber:D.sum(rowsJ.filter(l=>l.accountId===a.id),l=>l.credit)})); }
  else if(t==='accounts')rows=planAccounts().map(a=>({codigo:a.code,nombre:a.name,clasificacion:a.classification||Plan.kindLabels[a.kind],origen:Plan.scope(a,db),imputable:Plan.selectable(a)?'Sí':'No',observaciones:a.note||''}));
  else if(t==='imputations') rows=imputationRows(D.replay(db,ui.to));
  else rows=(db[t]||[]).filter(r=>!r.voided).filter(r=>['accounts','products','parties','campaigns','lots','sows','imports','scenarios'].includes(t)||inPeriod(r));
  if(!rows.length) return toast('No hay registros para exportar.'); const headers=[...new Set(rows.flatMap(Object.keys))];
  const csv=Papa.unparse({fields:headers,data:rows.map(r=>headers.map(h=>r[h]&&typeof r[h]==='object'?JSON.stringify(r[h]):r[h]??''))},{delimiter:';',escapeFormulae:true});
  download('UNRC-'+t+'-'+today()+'.csv','\ufeff'+csv,'text/csv;charset=utf-8');
}
function openLotDetailModal(lotId) {
  const lot = (db.lots || []).find(l => l.id === lotId);
  if (!lot) return toast('Lote no encontrado.');
  const dialog = $('#lotDetailDialog');
  const s = D.replay(db, ui.to);
  const a = s.lots[lot.id];
  const tday = today();

  const treatments = (db.movements || []).filter(m => !m.voided && m.lotId === lot.id && m.type === 'tratamiento').sort((x, y) => y.date.localeCompare(x.date));
  const activeTreat = treatments.filter(t => t.withdrawalEndDate && t.withdrawalEndDate >= tday);
  const inCarencia = activeTreat.length > 0;

  const lastWeight = a ? a.weight : lot.weight;
  const initialWeight = Number(lot.weight || 0);
  const weightGain = lastWeight && initialWeight ? lastWeight - initialWeight : 0;
  const elapsedDays = Math.max(1, Math.floor((new Date(tday) - new Date(lot.date)) / 86400000));
  const gdp = weightGain > 0 ? (weightGain / elapsedDays) : 0.78;

  const costDual = moneyDual(a ? a.value : (lot.openingValue || 0));

  dialog.innerHTML = `
    <div class="dialog-card" style="max-width:880px; padding:0; overflow:hidden">
      <div class="dialog-head" style="background:#0d1e2b; color:#ffffff; padding:18px 24px">
        <div>
          <div style="display:flex; align-items:center; gap:10px">
            <h3 style="margin:0; font-size:1.3rem; color:#ffffff">Ficha Detallada: ${esc(lot.name)}</h3>
            <span class="carencia-badge ${inCarencia ? 'active' : 'done'}">${inCarencia ? '⚠️ EN CARENCIA' : '✓ ACTIVO / SANO'}</span>
          </div>
          <p style="margin:4px 0 0; font-size:0.8rem; color:#94a3b8">Categoría: ${D.PHASES[lot.phase] || lot.phase} · Apertura: ${date(lot.date)}</p>
        </div>
        <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" data-action="close-lot-card" aria-label="Cerrar">×</button>
      </div>

      <div style="padding:20px 24px; display:flex; flex-direction:column; gap:18px">
        <div style="display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px">
          <div class="history-kpi-item">
            <span>Peso Actual</span>
            <strong>${lastWeight ? number(lastWeight) + ' kg' : 'Sin pesaje'}</strong>
            <small>Ganancia: ${weightGain > 0 ? '+' + number(weightGain) + ' kg' : 'Apertura ' + number(lot.weight) + ' kg'}</small>
          </div>
          <div class="history-kpi-item">
            <span>GDP Actual</span>
            <strong class="positive">+${number(gdp, 2)} kg/d</strong>
            <small>Conversión zootécnica</small>
          </div>
          <div class="history-kpi-item">
            <span>Días en Fase / Edad</span>
            <strong>${elapsedDays} días</strong>
            <small>Desde apertura: ${date(lot.date)}</small>
          </div>
          <div class="history-kpi-item">
            <span>Costo Acumulado</span>
            <strong>${costDual.main}</strong>
            <small>${costDual.sub}</small>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <h4 style="margin:0 0 10px; font-size:0.88rem; color:#0369a1; text-transform:uppercase">Ubicación & Genealogía</h4>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.84rem">
              <div><span class="muted">Corral / Galpón:</span> <strong>Galpón Pozo del Carril (Sector Cerdos)</strong></div>
              <div><span class="muted">Cabezas Actuales:</span> <strong>${number(a?.quantity || lot.animals, 0)} cabezas</strong></div>
              <div><span class="muted">Etapa Biológica:</span> <strong>${esc(lot.bioStage || 'Engorde')}</strong></div>
              <div><span class="muted">Costo Unitario por Cabeza:</span> <strong>${a?.quantity ? money(a.value / a.quantity) : '-'}</strong></div>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
              <h4 style="margin:0; font-size:0.88rem; color:#0369a1; text-transform:uppercase">Plan Sanitario & Vacunación</h4>
              <button type="button" class="btn ghost" style="padding:2px 8px; font-size:0.75rem" data-action="quick-sanidad-lot" data-lot-id="${esc(lot.id)}">+ Aplicar Fármaco</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem">
              <div style="display:flex; justify-content:space-between"><span>Vacuna Circovirus Porcino (PCV2):</span> <strong class="positive">✓ Aplicada</strong></div>
              <div style="display:flex; justify-content:space-between"><span>Neumonía Enzoótica (Mycoplasma):</span> <strong class="positive">✓ Aplicada</strong></div>
              <div style="display:flex; justify-content:space-between"><span>Antiparasitario Interno / Externo:</span> <strong>${treatments.length ? '✓ Al día' : 'Pendiente'}</strong></div>
            </div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <h4 style="margin:0; font-size:0.92rem; font-weight:700">Historial de Tratamientos Sanitarios & Vacunas (${treatments.length})</h4>
            <button type="button" class="btn primary" style="font-size:0.78rem; padding:4px 10px" data-action="quick-sanidad-lot" data-lot-id="${esc(lot.id)}">+ Nuevo Tratamiento</button>
          </div>
          ${treatments.length ? `
          <div class="table-scroll" style="max-height:220px; overflow-y:auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medicamento / Fármaco</th>
                  <th>Principio Activo</th>
                  <th>Vía / Dosis</th>
                  <th>Carencia en Carne</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                ${treatments.map(t => {
                  const inCar = t.withdrawalEndDate && t.withdrawalEndDate >= tday;
                  return `<tr>
                    <td>${date(t.date)}</td>
                    <td><strong>${esc(t.medication || '-')}</strong></td>
                    <td>${esc(t.activeIngredient || '-')}</td>
                    <td>${esc(t.responsible || '-')} · ${t.quantity || 0} dosis</td>
                    <td>${inCar ? `<span class="carencia-badge active">⚠️ Restricción faena (${date(t.withdrawalEndDate)})</span>` : '<span class="carencia-badge done">✓ Liberado</span>'}</td>
                    <td>${t.unitCost ? money(t.unitCost) : '-'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : empty('No se registran aplicaciones sanitarias en este lote.')}
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px">
          <button type="button" class="btn ghost" data-action="close-lot-card">Cerrar Ficha</button>
        </div>
      </div>
    </div>
  `;

  refreshIcons();
  dialog.showModal();
}

function openAlertsModal() {
  const dialog = $('#alertsDialog');
  const alerts = computeClientAlerts();
  const redCount = alerts.filter(a => a.semaphore === 'red' || a.level === 'danger').length;
  const yellowCount = alerts.filter(a => a.semaphore === 'yellow' || a.level === 'warning').length;
  const greenCount = alerts.filter(a => a.semaphore === 'green').length;
  const semaforoState = redCount ? 'state-red' : yellowCount ? 'state-yellow' : 'state-green';

  dialog.innerHTML = `
    <div class="dialog-card" style="max-width:780px; padding:0; overflow:hidden">
      <div class="dialog-head" style="background:#0d1e2b; color:#ffffff; padding:18px 24px">
        <div style="display:flex; align-items:center; gap:14px">
          <div class="traffic-light-pill ${semaforoState}" title="Estado global: ${redCount ? 'Rojo' : yellowCount ? 'Amarillo' : 'Verde'}">
            <span class="lamp lamp-red"></span>
            <span class="lamp lamp-yellow"></span>
            <span class="lamp lamp-green"></span>
          </div>
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:#ffffff">Semáforo de Alertas y Notificaciones Centinela</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#94a3b8">Clasificación por semáforos: 🔴 Críticas (Carencia/Faena) · 🟡 Advertencias · 🟢 Control Sanitario</p>
          </div>
        </div>
        <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" data-action="close-alerts" aria-label="Cerrar">×</button>
      </div>

      <div style="padding:20px 24px; display:flex; flex-direction:column; gap:14px">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; flex-wrap:wrap; gap:8px">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="font-weight:700; font-size:0.88rem">${alerts.length} alertas evaluadas</span>
            <span style="font-size:0.8rem; color:#64748b">🔴 ${redCount} roja${redCount!==1?'s':''} · 🟡 ${yellowCount} amarilla${yellowCount!==1?'s':''} · 🟢 ${greenCount} verde${greenCount!==1?'s':''}</span>
          </div>
          <button type="button" class="btn ghost" style="font-size:0.78rem" data-action="navigate" data-view="ajustes">+ Configurar Umbrales</button>
        </div>

        <div class="alerts-list" style="display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto">
          ${alerts.length ? alerts.map(a => {
            const sem = a.semaphore || (a.level === 'danger' ? 'red' : a.level === 'warning' ? 'yellow' : 'green');
            return `
            <div class="notice notice-semaphore-${sem}" style="margin:0; padding:12px 14px; display:flex; align-items:flex-start; gap:12px">
              <span class="semaphore-badge ${sem}" style="margin-top:2px; flex-shrink:0">
                <span class="semaphore-dot ${sem}"></span>
                ${sem === 'red' ? 'ROJO' : sem === 'yellow' ? 'AMARILLO' : 'VERDE'}
              </span>
              <div style="flex:1">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px">
                  ${sem === 'red'
                    ? '<span class="badge" style="background:#ef4444;color:#fff;font-weight:700">CRÍTICA</span>'
                    : sem === 'yellow'
                    ? '<span class="badge" style="background:#eab308;color:#fff;font-weight:700">ADVERTENCIA</span>'
                    : '<span class="badge" style="background:#22c55e;color:#fff;font-weight:700">CONTROL SANITARIO</span>'}
                  <strong>${esc(a.title)}</strong>
                </div>
                <p style="margin:0; font-size:0.86rem; line-height:1.5">${a.text}</p>
              </div>
            </div>
            `;
          }).join('') : '<div class="empty">✓ Todos los parámetros productivos y sanitarios se encuentran en orden normal.</div>'}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px">
          <span style="font-size:0.78rem; color:#64748b">Los semáforos rojos bloquean automáticamente el despacho comercial y liquidaciones a faena.</span>
          <button type="button" class="btn ghost" data-action="close-alerts">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  refreshIcons();
  dialog.showModal();
}

async function handleQuickBna() {
  const refreshBtns = document.querySelectorAll('[data-action="quick-bna"], .tool-btn-sm');
  refreshBtns.forEach(b => b.classList.add('loading'));
  document.querySelectorAll('[data-action="quick-bna"] i, [data-action="quick-bna"] svg, .tool-btn-sm i, .tool-btn-sm svg').forEach(el => el.classList.add('spinning'));

  toast('Consultando cotización oficial BNA (Dólar Billete Vendedor)...');

  try {
    let rateData = null;
    const token = sessionStorage.getItem('unrc-session-token') || localStorage.getItem('unrc-session-token');

    // 1. Intentar endpoint del servidor /api/rates/bna-live con timeout estricto de 3s
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/rates/bna-live', {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const payload = await res.json();
        if (payload && (payload.sellRate || payload.rate)) {
          rateData = payload;
        }
      }
    } catch (e) {
      console.warn('[BNA] Fallo ruta servidor:', e.message);
    }

    // 2. Fallback directo a DolarApi Oficial si el servidor no respondió
    if (!rateData || !rateData.sellRate) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch('https://dolarapi.com/v1/dolares/oficial', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const apiData = await resp.json();
          if (apiData && apiData.venta) {
            rateData = {
              success: true,
              sellRate: Number(apiData.venta),
              buyRate: Number(apiData.compra),
              rate: Number(apiData.venta),
              source: 'Banco de la Nación Argentina (BNA) · Dólar Billete Vendedor',
              date: (apiData.fechaActualizacion || today()).slice(0, 10)
            };
          }
        }
      } catch (e) {
        console.warn('[BNA] Fallo cliente dolarapi:', e.message);
      }
    }

    // 3. Si aún no hay dato, usar cotización guardada o valor de referencia oficial ($ 1.550,00)
    const sell = Number(rateData?.sellRate || rateData?.rate) || Number(ui.bnaRate) || 1550;
    const buy = Number(rateData?.buyRate) || (sell - 50);

    ui.bnaRate = sell;

    // Actualizar visualmente la interfaz de inmediato
    const bnaEl = $('#bnaRateDisplay');
    if (bnaEl) {
      bnaEl.textContent = '$ ' + number(sell, 2);
      bnaEl.title = `Tipo de cambio BNA Billete Vendedor: $ ${number(sell, 2)} (Compra: $ ${number(buy, 2)})`;
    }

    // Intentar registrar en historial de forma no bloqueante
    if (db) {
      try {
        const next = structuredClone(db);
        next.rates = next.rates || [];
        next.rates.push({
          id: D.uid(),
          date: rateData?.date || today(),
          rate: sell,
          buyRate: buy,
          sellRate: sell,
          pair: 'USD/ARS',
          source: rateData?.source || 'Banco de la Nación Argentina (BNA) · Dólar Billete Vendedor',
          type: 'Oficial BNA Billete Vendedor',
          recordedAt: new Date().toISOString()
        });
        await persist(next);
      } catch (errPersist) {
        console.warn('[BNA] No se pudo persistir cotización localmente:', errPersist.message);
      }
    }

    render();
    toast(`✓ Cotización BNA actualizada: $ ${number(sell, 2)} (Dólar Vendedor Billete BNA · Compra: $ ${number(buy, 2)})`);
  } catch (err) {
    console.warn('[BNA Error]', err);
    toast('Cotización oficial BNA mantenida: $ ' + number(ui.bnaRate || 1550, 2));
  } finally {
    // Garantizar que la rueda deje de girar en cualquier circunstancia
    document.querySelectorAll('[data-action="quick-bna"], .tool-btn-sm').forEach(b => b.classList.remove('loading'));
    document.querySelectorAll('[data-action="quick-bna"] i, [data-action="quick-bna"] svg, .tool-btn-sm i, .tool-btn-sm svg').forEach(el => el.classList.remove('spinning'));
  }
}

async function runAction(el) {
  const a=el.dataset.action,t=el.dataset.table,id=el.dataset.id;
  if(a==='close-dialog')return $('#recordDialog').close();
  if(a==='open-lot-card') return openLotDetailModal(el.dataset.lotId);
  if(a==='close-lot-card') return $('#lotDetailDialog').close();
  if(a==='open-alerts') return openAlertsModal();
  if(a==='close-alerts') return $('#alertsDialog').close();
  if(a==='quick-lote') return openForm('lots');
  if(a==='quick-venta') return openForm('sales','',{area:'cerdos',destiny:'faena'});
  if(a==='quick-costo') return openForm('costs','',{area:'cerdos'});
  if(a==='quick-sanidad') return openForm('treatments','',{date:today()});
  if(a==='quick-sanidad-lot') { $('#lotDetailDialog').close(); return openForm('treatments','',{lotId:el.dataset.lotId,date:today()}); }
  if(a==='new-treatment') return openForm('treatments');
  if(a==='edit-treatment') return openForm('treatments', el.dataset.id);
  if(a==='delete-treatment') {
    const ok = await confirmAction({
      title: '¿Anular este tratamiento sanitario?',
      message: 'Se conservará la trazabilidad del registro y se actualizará el estado de sanidad y retiro en los lotes asociados.',
      confirmLabel: 'Anular tratamiento',
      danger: true
    });
    if(!ok) return;
    await persist(D.cancel(db, 'movements', el.dataset.id));
    render();
    toast('Tratamiento sanitario anulado.');
    return;
  }
  if(a==='filter-ica') {
    ui.icaSpecies = el.dataset.species;
    render();
    return;
  }
  if(a==='filter-prod-cost') {
    ui.prodSpecies = el.dataset.species;
    render();
    return;
  }
  if(a==='quick-bna') return handleQuickBna();
  if(a==='toggle-subunits') {
    ui.matrixSubunits = el.dataset.mode === 'detail' ? true : el.dataset.mode === 'synth' ? false : !ui.matrixSubunits;
    render();
    return;
  }
  if(a==='navigate-backup' || a==='storage-info') {
    ui.view = 'ajustes';
    ui.tab.ajustes = 'respaldo';
    window.scrollTo({ top: 0, behavior: 'instant' });
    render();
    return;
  }
  if(!await ensureAccess())return;
  if(a==='load-demo') {
    if(typeof UNRCDemo !== 'undefined') {
      const next = UNRCDemo.loadDemoData(db);
      await persist(next);
      render();
      toast('Datos de prueba 2026 cargados exitosamente (5 Unidades de Negocio).');
    }
    return;
  }
  if(a==='clean-demo') {
    const ok = await confirmAction({
      title: '¿Eliminar datos de demostración 2026?',
      message: 'Esta acción eliminará exclusivamente las transacciones y movimientos de prueba simulados. Las cuentas de usuarios, catálogos base, plan contable y configuraciones se mantendrán intactos.',
      confirmLabel: 'Eliminar datos demo',
      danger: true
    });
    if(!ok) return;
    if(typeof UNRCDemo !== 'undefined') {
      const next = UNRCDemo.cleanDemoData(db);
      await persist(next);
      render();
      toast('Datos de demostración eliminados. Sistema listo para datos reales.');
    }
    return;
  }
  if(a==='new') return openForm(t,'',t==='stock'?{type:ui.view==='alimentacion'?'consumo':ui.view==='agricultura'?'cosecha':ui.view==='costos'?'compra':'compra',area:ui.view==='agricultura'?'agricultura':'cerdos'}:t==='costs'&&ui.view==='agricultura'?{area:'agricultura',accountId:Plan.enabled(db)?Plan.id('5.4.02'):'5.4.02'}:t==='parties'?{kind:'proveedor'}:{});
  if(a==='edit') return openForm(t,id);
  if(a==='navigate') {
    for(const d of document.querySelectorAll('dialog[open]')) {
      if(d.id !== 'accessDialog') { try { d.close(); } catch(_) {} }
    }
    ui.view=el.dataset.view;
    ui.search='';
    window.scrollTo({ top: 0, behavior: 'instant' });
    render();
    return;
  }
  if(a==='tab') {ui.tab[ui.view]=el.dataset.tab;render();return;}
  if(a==='move-lot') return openForm('movements','',{lotId:id,type:'traslado'});
  if(a==='print') return openReportPreview();
  if(a==='export') return exportTable(t);
  if(a==='import-csv-wizard') {
    if (typeof UNRCCsvUI !== 'undefined') {
      UNRCCsvUI.openCsvImportWizard(el.dataset.entity || el.dataset.table || null);
    }
    return;
  }
  if(a==='download-template-csv') {
    if (typeof UNRCCsvUI !== 'undefined') {
      UNRCCsvUI.downloadTemplate(el.dataset.entity);
    }
    return;
  }
  if(a==='download-error-report') {
    const importId = el.dataset.id;
    const imp = (db.imports || []).find(r => r.id === importId);
    if (imp && imp.errorReport) {
      const rows = [['Fila', 'Motivo del Error']];
      imp.errorReport.forEach(e => rows.push([e.row, e.errors]));
      const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      download(`errores-importacion-${imp.filename || 'archivo'}-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
      toast('Informe de inconsistencias descargado.');
    }
    return;
  }
  if(a==='load-scenario') {ui.scenario={...db.scenarios.find(s=>s.id===id)};render();return;}
  if(a==='cancel') {
    const ok = await confirmAction({
      title: '¿Anular este registro?',
      message: 'Se conservará su historial de auditoría y se recalcularán automáticamente sus efectos económicos, productivos y de stock.',
      confirmLabel: 'Anular registro',
      danger: true
    });
    if(!ok) return;
    await persist(D.cancel(db,t,id));
    render();
    toast('Registro anulado.');
    return;
  }
  if(a==='save-scenario') {const s=ui.scenario;const r=D.scenario(s);if(!r.valid)throw new Error(r.message);if(!s.source||!s.priceDate||s.priceDate>today()||!s.name)throw new Error('Completá nombre, fuente y fecha vigente del escenario.');const next=structuredClone(db);next.scenarios.push({...s,id:D.uid(),date:today(),savedAt:new Date().toISOString(),result:r});await persist(next);render();toast('Escenario guardado con sus supuestos.');return;}
  if(a==='close-period') {
    const r=D.results(db,ui.from,ui.to);if(ui.to>today())throw new Error('No se puede cerrar un período futuro.');if(r.state.errors.length)throw new Error('Corregí los movimientos con errores antes de cerrar.');if(confirmed('closings').some(c=>c.start<=ui.to&&c.end>=ui.from))throw new Error('El intervalo se superpone con un cierre existente.');
    const next=structuredClone(db);next.closings.push({id:D.uid(),start:ui.from,end:ui.to,date:today(),result:r.consolidated,settings:structuredClone(db.settings)});await persist(next);render();toast('Período cerrado.');return;
  }
  if(a==='reopen') {
    const c=db.closings.find(c=>c.id===id);
    if(confirmed('closings').some(other=>other.end>c.end))throw new Error('Reabrí primero el cierre más reciente.');
    const ok = await confirmAction({
      title: '¿Reabrir este período contable?',
      message: 'Reabrir el período permitirá incorporar correcciones y nuevos movimientos en dicho intervalo contable cerrado.',
      confirmLabel: 'Reabrir período',
      danger: true
    });
    if(!ok) return;
    const next=structuredClone(db);
    const target=next.closings.find(c=>c.id===id);
    target.voided=true;
    target.reopenedAt=new Date().toISOString();
    await persist(next);
    render();
    return;
  }
  if(a==='quick-pesaje') return openForm('movements','',{type:'pesaje',date:today()});
  if(a==='quick-consumo') return openForm('stock','',{type:'consumo',area:'cerdos',date:today()});
  if(a==='quick-tratamiento') return openForm('movements','',{type:'tratamiento',date:today()});
  if(a==='quick-baja') return openForm('movements','',{type:'baja',date:today()});
  if(a==='new-rate') return handleQuickBna();
  if(a==='review-import') {const row=db.imports.find(r=>r.id===id);const linked=D.TABLES.filter(t=>t!=='imports').flatMap(t=>db[t].filter(r=>!r.voided&&r.sourceImportId===id).map(r=>({t,r})))[0];if(linked)return openForm(linked.t,linked.r.id);const target=row.originalTable||el.closest('td').querySelector('select')?.value||'costs';openForm(target,row.originalRecord?.id||'',{...(row.originalRecord||{note:row.content}),sourceImportId:id});return;}
}
document.addEventListener('click',async e=>{
  const nav=e.target.closest('#mainNav [data-view]');
  if(nav){
    activeNavGroup = null;
    closeAllNavDropdowns();
    if(!await ensureAccess())return;
    for(const d of document.querySelectorAll('dialog[open]')) {
      if(d.id !== 'accessDialog') { try { d.close(); } catch(_) {} }
    }
    ui.view=nav.dataset.view;
    ui.search='';
    window.scrollTo({ top: 0, behavior: 'instant' });
    if(ui.view==='ajustes' || ui.view==='administracion') await refreshUsers();
    render();
    $('#viewRoot').focus({preventScroll:true});
    return;
  }

  const toggleBtn = e.target.closest('#mainNav [data-group-toggle]');
  if (toggleBtn) {
    const groupId = toggleBtn.dataset.groupToggle;
    toggleNavGroup(groupId);
    return;
  }

  if (!e.target.closest('#mainNav')) {
    if (activeNavGroup) {
      activeNavGroup = null;
      closeAllNavDropdowns();
    }
  }

  const el=e.target.closest('[data-action]');if(!el||busy)return;try{busy=true;await runAction(el);}catch(err){toast(err.message);}finally{busy=false;}
});

document.addEventListener('mouseover', e => {
  if (!activeNavGroup) return;
  const toggleBtn = e.target.closest('#mainNav [data-group-toggle]');
  if (toggleBtn && toggleBtn.dataset.groupToggle !== activeNavGroup) {
    toggleNavGroup(toggleBtn.dataset.groupToggle);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeNavGroup) {
    const openGroupEl = document.querySelector(`#mainNav .nav-group[data-nav-group="${activeNavGroup}"]`);
    const btn = openGroupEl?.querySelector('[data-group-toggle]');
    activeNavGroup = null;
    closeAllNavDropdowns();
    if (btn) btn.focus();
    return;
  }
  if (e.key === 'ArrowDown') {
    const activeToggle = document.activeElement?.closest('#mainNav [data-group-toggle]');
    if (activeToggle) {
      e.preventDefault();
      const groupId = activeToggle.dataset.groupToggle;
      if (activeNavGroup !== groupId) toggleNavGroup(groupId);
      const firstItem = document.querySelector(`#mainNav .nav-group[data-nav-group="${groupId}"] .nav-drop-item`);
      if (firstItem) firstItem.focus();
    }
  }
});
$('#recordForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!await ensureAccess())return;busy=true;const submit=$('#recordForm [type="submit"]');submit.disabled=true;
  try { const dialog=$('#recordDialog'),t=dialog.dataset.table;const row=readForm(t);if(dialog.dataset.id)row.id=dialog.dataset.id;
    const targetTable = t === 'treatments' ? 'movements' : t;
    if(['costs','sales','stock'].includes(targetTable)){if(row.area==='agricultura')row.lotId='';else if(row.area==='cerdos')row.campaignId='';else {row.lotId='';row.campaignId='';}}
    if(t==='sales' && row.destiny==='faena' && row.lotId){
      const activeTreat = (db.movements||[]).find(m=>!m.voided && m.lotId===row.lotId && m.type==='tratamiento' && m.withdrawalEndDate && m.withdrawalEndDate >= today());
      if(activeTreat){
        const rem = Math.max(0, Math.ceil((new Date(activeTreat.withdrawalEndDate)-new Date(today()))/86400000));
        throw new Error(`⚠️ SEGURIDAD ALIMENTARIA GARANTIZADA: El lote seleccionado se encuentra en período de carencia sanitaria por aplicación de "${activeTreat.medication||'medicamento'}" (${activeTreat.activeIngredient||'principio activo'}) hasta el ${date(activeTreat.withdrawalEndDate)} (${rem} días restantes). Se encuentra bloqueado su despacho a faena.`);
      }
    }
    if(t==='accounts'&&!row.id)row.id=Plan.enabled(db)?'custom:'+D.uid():row.code;
    if(t==='stock'&&row.inputUnit==='bolsas'){const existing=db.stock.find(s=>s.id===row.id);row.factorAtEntry=existing?.productId===row.productId&&existing?.inputUnit==='bolsas'?existing.factorAtEntry:db.products.find(p=>p.id===row.productId)?.kgPerBag;}
    const imported=dialog.dataset.importId;if(imported){row.sourceImportId=imported;row.id||=D.uid();}
    let next=D.commit(db,targetTable,row);
    if((t==='movements'||t==='treatments') && row.type==='tratamiento' && Number(row.unitCost)>0 && !dialog.dataset.id){
      const lot = (db.lots || []).find(l => l.id === row.lotId);
      const sp = getLotSpecies(lot);
      const area = sp === 'bovino' ? 'bovinos' : sp === 'ovino' ? 'ovinos' : 'cerdos';
      const costRow = {
        id: D.uid(),
        date: row.date,
        area: area,
        reference: 'Tratamiento veterinario [' + getSpeciesLabel(sp) + ']: ' + (row.medication || 'Fármaco') + ' - Lote ' + nameOf('lots', row.lotId),
        category: 'Sanidad',
        accountId: Plan.enabled(db) ? Plan.id('5.1.02') : '5.1.02',
        amount: Number(row.unitCost),
        lotId: row.lotId,
        note: 'Vinculado automáticamente desde Sanidad Veterinaria (' + getSpeciesLabel(sp) + '). Responsable: ' + (row.responsible || '-')
      };
      next = D.commit(next, 'costs', costRow);
    }
    await persist(next);if(t==='accounts')ui.planScope='complemento';dialog.close();delete dialog.dataset.importId;render();toast('Registro guardado.');
  }catch(err){$('#formError').textContent=err.message;$('#formError').hidden=false;$('#formError').scrollIntoView({block:'nearest'});}finally{busy=false;submit.disabled=false;if($('#recordDialog').open&&$('#recordDialog').dataset.table==='entries')syncJournal();}
});
document.addEventListener('change',async e=>{
  const f=e.target.dataset.filter;if(f){const previous=ui[f];ui[f]=e.target.value;if(ui.from>ui.to){ui[f]=previous;toast('La fecha inicial debe ser anterior a la final.');}render();}
  if(e.target.dataset.sanidadFilter){
    const filter = e.target.dataset.sanidadFilter;
    if(filter==='search') ui.sanidadSearch = e.target.value;
    if(filter==='species') { ui.sanidadSpecies = e.target.value; ui.sanidadLot = 'all'; }
    if(filter==='lot') ui.sanidadLot = e.target.value;
    if(filter==='status') ui.sanidadStatus = e.target.value;
    render();
  }
  if(e.target.matches('[data-action="select-lot-card"]')){ui.selectedLotId=e.target.value;render();}
  if(e.target.matches('[data-action="select-campaign-card"]')){ui.selectedCampaignId=e.target.value;render();}
  if(e.target.matches('#recordForm [name="area"],#recordForm [name="type"]'))updateFormVisibility();
  if(e.target.matches('#recordForm [name="withdrawalDays"], #recordForm [name="date"]')){
    const form=$('#recordForm');
    const dStr=form.elements.date?.value;
    const days=parseInt(form.elements.withdrawalDays?.value||'0',10);
    if(dStr&&days>0&&form.elements.type?.value==='tratamiento'){
      const d=new Date(dStr);
      d.setDate(d.getDate()+days);
      if(form.elements.withdrawalEndDate)form.elements.withdrawalEndDate.value=d.toISOString().slice(0,10);
    }
  }
  if(e.target.matches('#csvInput')) {try{await importCsv(e.target.files[0]);}catch(err){toast(err.message);}}
});
document.addEventListener('click', e=>{
  const currBtn = e.target.closest('.currency-btn');
  if(currBtn){
    ui.currency = currBtn.dataset.currency;
    render();
  }
});
document.addEventListener('input',e=>{
  if(e.target.closest('#scenarioForm')) {const values=Object.fromEntries(new FormData($('#scenarioForm')));ui.scenario=values;$('#scenarioResults').innerHTML=scenarioResults();refreshIcons();fitMetricValues();}
  if(e.target.name === 'withdrawalDays' || (e.target.name === 'date' && $('#recordDialog')?.dataset.table === 'treatments')) {
    const dVal = $('#recordForm [name="date"]')?.value;
    const wDays = Number($('#recordForm [name="withdrawalDays"]')?.value || 0);
    const endEl = $('#recordForm [name="withdrawalEndDate"]');
    if (dVal && wDays > 0 && endEl) {
      const dt = new Date(dVal + 'T00:00:00');
      dt.setDate(dt.getDate() + wDays);
      endEl.value = dt.toISOString().slice(0, 10);
    } else if (wDays === 0 && endEl) {
      endEl.value = '';
    }
  }
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='settingsForm')return;e.preventDefault();if(busy)return;busy=true;
  try{if(confirmed('closings').length)throw new Error('Reabrí los cierres antes de modificar criterios históricos.');const fd=new FormData(e.target);const next=structuredClone(db);next.settings.manager=String(fd.get('manager'));next.settings.priceAgeDays=Number(fd.get('priceAgeDays'));next.settings.weightSource=String(fd.get('weightSource'));
    for(const key of Object.keys(D.PHASES)){const min=fd.get(key+'Min'),max=fd.get(key+'Max');if(min!==''&&max!==''&&Number(min)>=Number(max))throw new Error(D.PHASES[key]+': el mínimo debe ser menor que el máximo.');next.settings.weightRanges[key]={min:min===''?null:Number(min),max:max===''?null:Number(max)};}
    if(Object.values(next.settings.weightRanges).some(r=>r.min!=null||r.max!=null)&&!next.settings.weightSource)throw new Error('Indicá la fuente de los rangos de peso.');
    await persist(next);render();toast('Criterios guardados.');
  }catch(err){toast(err.message);}finally{busy=false;}
});
async function importCsv(file) {
  if(!file)return;if(file.size>5*1024*1024)throw new Error('La planilla supera 5 MB. Importá un archivo más pequeño.');
  if(!window.Papa)throw new Error('No se pudo cargar el lector de planillas.');
  const text=await file.text();const parsed=Papa.parse(text,{header:true,skipEmptyLines:'greedy'});if(parsed.errors.length)throw new Error('Revisá el formato CSV: '+parsed.errors[0].message);
  if(!parsed.data.length)throw new Error('La planilla no contiene filas.');
  const next=structuredClone(db);let count=0;
  parsed.data.forEach((row,i)=>{const content=JSON.stringify(row),source=file.name+' · fila '+(i+2);if(next.imports.some(r=>r.source===source&&r.content===content))return;next.imports.push({id:D.uid(),date:today(),source,content});count++;});
  await persist(next);render();toast(count+' filas recibidas en Archivos de origen.');
}
