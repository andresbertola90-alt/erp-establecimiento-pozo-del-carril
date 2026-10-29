#!/usr/bin/env python3
import sys

with open("interface.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update NAV and define NAV_CATEGORIES
old_nav_block = """const NAV = [
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
];"""

new_nav_block = """const NAV = [
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

const NAV_CATEGORIES = [
  {
    id: 'general',
    name: 'Gestión General',
    icon: 'layout-dashboard',
    badge: 'Institucional',
    theme: 'general',
    items: [
      ['general', 'Inicio & Resumen', 'layout-dashboard'],
      ['administracion', 'Administración', 'shield-check'],
      ['ajustes', 'Configuración', 'settings'],
      ['informes', 'Informes y reportes', 'printer']
    ]
  },
  {
    id: 'ganaderia',
    name: 'Gestión Ganadera',
    icon: 'beef',
    badge: '3 especies',
    theme: 'livestock',
    items: [
      ['cerdos', 'Porcinos', 'notebook-tabs'],
      ['bovinos', 'Bovinos', 'beef'],
      ['ovinos', 'Ovinos', 'circle-dot'],
      ['sanidad', 'Salud & Sanidad', 'heart-pulse']
    ]
  },
  {
    id: 'agricultura',
    name: 'Gestión Agrícola',
    icon: 'wheat',
    badge: '2 especies',
    theme: 'agro',
    items: [
      ['maiz', 'Maíz', 'wheat'],
      ['soja', 'Soja', 'sprout'],
      ['comparador', 'Destino del cereal', 'scale']
    ]
  },
  {
    id: 'finanzas',
    name: 'Gestión Económico-Financiera',
    icon: 'landmark',
    badge: 'Contable',
    theme: 'finance',
    items: [
      ['contabilidad', 'Contabilidad', 'book-open'],
      ['ventas', 'Ventas & Clientes', 'handshake'],
      ['costos', 'Compras y costos', 'receipt'],
      ['existencias', 'Stock e insumos', 'warehouse'],
      ['modelo', 'Indicadores & Análisis', 'file-text']
    ]
  },
  {
    id: 'ayuda',
    name: 'Ayuda',
    icon: 'circle-help',
    theme: 'help',
    items: [
      ['manual', 'Manual de usuario', 'circle-help']
    ]
  }
];

function findCategoryForView(v) {
  for (const c of NAV_CATEGORIES) {
    if (c.items.some(it => it[0] === v)) return c.id;
  }
  return 'general';
}

function renderNav() {
  const el = $('#mainNav');
  if (!el) return;
  const currentCatId = ui.navCategory || findCategoryForView(ui.view);
  ui.navCategory = currentCatId;
  const currentCat = NAV_CATEGORIES.find(c => c.id === currentCatId) || NAV_CATEGORIES[0];
  
  el.innerHTML = `
    <div class="nav-categories-bar">
      ${NAV_CATEGORIES.map(c => {
        const isActive = c.id === currentCatId;
        const hasCurrentView = c.items.some(it => it[0] === ui.view);
        return `
          <button type="button" class="nav-cat-btn nav-cat-${c.theme} ${isActive ? 'active' : ''} ${hasCurrentView ? 'has-active' : ''}" data-nav-category="${c.id}">
            ${icon(c.icon)}
            <span>${c.name}</span>
            ${c.theme === 'livestock' ? '<span class="nav-unit-pill pill-livestock">3 sp.</span>' : ''}
            ${c.theme === 'agro' ? '<span class="nav-unit-pill pill-agro">2 sp.</span>' : ''}
          </button>
        `;
      }).join('')}
      <button type="button" class="nav-cat-btn nav-cat-all" data-action="toggle-all-modules" title="Ver catálogo completo de módulos">
        ${icon('grid')}
        <span>Todos los módulos</span>
      </button>
    </div>
    <div class="nav-subitems-bar nav-subitems-${currentCat.theme}">
      <span class="nav-current-cat-label">${currentCat.name}:</span>
      <div class="nav-subitems-list">
        ${currentCat.items.map(([view, label, i]) => `
          <button class="nav-item ${ui.view === view ? 'active' : ''}" type="button" data-view="${view}" ${ui.view === view ? 'aria-current="page"' : ''}>
            ${icon(i)}
            <span>${label}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="nav-all-modules-popover" id="navAllModulesPopover" hidden>
      <div class="nav-all-modules-grid">
        ${NAV_CATEGORIES.map(c => `
          <div class="nav-popover-col nav-col-${c.theme}">
            <div class="nav-popover-head">
              ${icon(c.icon)}
              <strong>${c.name}</strong>
            </div>
            <div class="nav-popover-items">
              ${c.items.map(([view, label, i]) => `
                <button type="button" class="nav-popover-item ${ui.view === view ? 'active' : ''}" data-view="${view}">
                  ${icon(i)}
                  <span>${label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}"""

if old_nav_block in code:
    code = code.replace(old_nav_block, new_nav_block, 1)
    print("Replaced NAV block with NAV_CATEGORIES and renderNav")
else:
    print("Could not find old NAV block")

# 2. In render(), call renderNav() and update alerts badge
old_render_nav_call = "$('#mainNav').innerHTML = NAV.map(([view,label,i]) => `<button class=\"nav-item ${ui.view === view ? 'active' : ''}\" type=\"button\" data-view=\"${view}\" ${ui.view === view ? 'aria-current=\"page\"' : ''}>${icon(i)}<span>${label}</span></button>`).join('');"

new_render_nav_call = """renderNav();
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
  }"""

if old_render_nav_call in code:
    code = code.replace(old_render_nav_call, new_render_nav_call, 1)
    print("Replaced flat nav call in render() with renderNav() and alerts badge")
else:
    print("Could not find flat nav call in render()")

with open("interface.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Pass 1 completed.")
