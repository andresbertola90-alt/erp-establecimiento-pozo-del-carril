'use strict';

/**
 * ERP Agropecuario Establecimiento Pozo del Carril - UNRC
 * Capa de Interfaz de Usuario para Ayuda, Recorrido Guiado y Notificaciones (Modificación N.º 12)
 */

const UNRCHelpUI = (function () {
  let currentTourStages = [];
  let currentTourIndex = 0;
  let activePopover = null;

  function getCurrentUser() {
    return typeof UNRCAuth !== 'undefined' && UNRCAuth.current ? UNRCAuth.current : { username: 'invitado', role: 'operador' };
  }

  // --- 1. GUÍA INTERACTIVA DE PRIMER INGRESO (MODAL DE BIENVENIDA) ---
  function checkAutoStartTour() {
    const user = getCurrentUser();
    if (!user || !user.username || user.username === 'invitado') return;
    const prefs = UNRCHelp.getTourPrefs(user.username);
    if (!prefs.completed && !prefs.dontShowAgain && !prefs.dismissed) {
      setTimeout(() => {
        showWelcomeModal();
      }, 700);
    }
  }

  function showWelcomeModal() {
    let dialog = document.getElementById('welcomeTourDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'welcomeTourDialog';
      dialog.className = 'record-dialog welcome-tour-dialog';
      document.body.appendChild(dialog);
    }

    const user = getCurrentUser();
    const roleName = user.role ? (user.role.replace(/_/g, ' ').toUpperCase()) : 'USUARIO';

    dialog.innerHTML = `
      <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
        <div class="welcome-header">
          <div class="welcome-header-logo">
            <img src="./assets/logo-pozo-del-carril.svg" alt="Pozo del Carril" class="welcome-logo-img">
          </div>
          <div>
            <span class="welcome-eyebrow">Universidad Nacional de Río Cuarto · FCE</span>
            <h2 id="welcomeTitle" class="welcome-title">Bienvenido al ERP Establecimiento Pozo del Carril</h2>
          </div>
        </div>

        <div class="welcome-body">
          <p class="welcome-intro">
            Este sistema permite <strong>administrar integralmente las actividades agrícolas, ganaderas, comerciales y contables</strong> del establecimiento. A continuación, podrás realizar un recorrido para conocer sus principales funcionalidades.
          </p>

          <div class="welcome-modules-badges">
            <span class="welcome-badge badge-agri"><i data-lucide="sprout"></i> Agricultura: Maíz y Soja</span>
            <span class="welcome-badge badge-gan"><i data-lucide="beef"></i> Ganadería: Porcinos, Bovinos y Ovinos</span>
            <span class="welcome-badge badge-com"><i data-lucide="handshake"></i> Comercial, Insumos y Stock</span>
            <span class="welcome-badge badge-con"><i data-lucide="book-open"></i> Contabilidad y Tesorería</span>
            <span class="welcome-badge badge-sem"><i data-lucide="traffic-light"></i> Semáforos e Indicadores</span>
          </div>

          <div class="welcome-user-notice">
            <i data-lucide="user-check"></i>
            <span>Sesión iniciada como <strong>${esc(user.name || user.username)}</strong> (Rol: ${esc(roleName)}). El recorrido se adaptará automáticamente a tus módulos habilitados.</span>
          </div>

          <label class="welcome-dont-show-again">
            <input type="checkbox" id="chkWelcomeDontShow">
            <span>No volver a mostrar esta bienvenida automáticamente al iniciar sesión</span>
          </label>
        </div>

        <div class="welcome-actions">
          <button type="button" class="btn ghost" id="btnWelcomeDismiss">Omitir por ahora</button>
          <button type="button" class="btn primary" id="btnWelcomeStart">
            <i data-lucide="compass"></i> Comenzar recorrido guiado
          </button>
        </div>
      </div>
    `;

    const closeDialog = () => {
      dialog.close();
    };

    dialog.querySelector('#btnWelcomeDismiss').onclick = () => {
      const dontShow = dialog.querySelector('#chkWelcomeDontShow').checked;
      UNRCHelp.saveTourPrefs(user.username, { dismissed: true, dontShowAgain: dontShow });
      closeDialog();
    };

    dialog.querySelector('#btnWelcomeStart').onclick = () => {
      const dontShow = dialog.querySelector('#chkWelcomeDontShow').checked;
      UNRCHelp.saveTourPrefs(user.username, { dontShowAgain: dontShow });
      closeDialog();
      startTour(0);
    };

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      const dontShow = dialog.querySelector('#chkWelcomeDontShow')?.checked;
      UNRCHelp.saveTourPrefs(user.username, { dismissed: true, dontShowAgain: Boolean(dontShow) });
      closeDialog();
    }, { once: true });

    dialog.showModal();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  // --- 2. RECORRIDO GUIADO POR MÓDULOS (TOUR INTERACTIVO) ---
  function startTour(startIndex = 0) {
    const user = getCurrentUser();
    currentTourStages = UNRCHelp.filterStagesForRole(user.role);
    if (!currentTourStages.length) {
      toast('No hay etapas de recorrido disponibles para tu rol actual.', 'warning');
      return;
    }

    currentTourIndex = Math.max(0, Math.min(startIndex, currentTourStages.length - 1));
    renderCurrentTourStep();
  }

  function renderCurrentTourStep() {
    clearTourSpotlight();

    if (currentTourIndex < 0 || currentTourIndex >= currentTourStages.length) {
      finishTour();
      return;
    }

    const stage = currentTourStages[currentTourIndex];
    const user = getCurrentUser();

    // Auto-navigate to view if necessary
    if (stage.view && typeof ui !== 'undefined' && ui.view !== stage.view && stage.view !== 'ayuda') {
      ui.view = stage.view;
      if (typeof render === 'function') {
        render();
      }
    }

    let overlay = document.getElementById('tourOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tourOverlay';
      overlay.className = 'tour-overlay';
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;

    let card = document.getElementById('tourCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'tourCard';
      card.className = 'tour-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-label', 'Asistente de recorrido guiado');
      document.body.appendChild(card);
    }
    card.hidden = false;

    const isFirst = currentTourIndex === 0;
    const isLast = currentTourIndex === currentTourStages.length - 1;

    card.innerHTML = `
      <div class="tour-card-head">
        <div class="tour-step-badge">
          <i data-lucide="compass"></i>
          <span>Paso ${currentTourIndex + 1} de ${currentTourStages.length}</span>
        </div>
        <button type="button" class="tour-close-btn" id="btnTourClose" title="Omitir recorrido (Escape)" aria-label="Cerrar recorrido">×</button>
      </div>

      <div class="tour-card-body">
        <h3 class="tour-stage-title">${esc(stage.title)}</h3>
        <p class="tour-stage-subtitle">${esc(stage.subtitle)}</p>
        <p class="tour-stage-desc">${esc(stage.description)}</p>

        ${stage.tips && stage.tips.length ? `
          <div class="tour-tips-box">
            <strong><i data-lucide="lightbulb"></i> Puntos clave a recordar:</strong>
            <ul>
              ${stage.tips.map(tip => `<li>${esc(tip)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <div class="tour-card-actions">
        <button type="button" class="btn ghost tour-btn-skip" id="btnTourSkip">Omitir</button>
        <div class="tour-nav-group">
          <button type="button" class="btn ghost" id="btnTourPrev" ${isFirst ? 'disabled' : ''}>
            <i data-lucide="arrow-left"></i> Anterior
          </button>
          <button type="button" class="btn primary" id="btnTourNext">
            ${isLast ? '<i data-lucide="check-circle"></i> Finalizar recorrido' : 'Siguiente <i data-lucide="arrow-right"></i>'}
          </button>
        </div>
      </div>
    `;

    // Highlight target element if present on screen
    let targetEl = null;
    if (stage.targetSelector) {
      targetEl = document.querySelector(stage.targetSelector);
    }
    if (targetEl && targetEl.offsetParent !== null) {
      targetEl.classList.add('tour-spotlight-target');
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}
    }

    // Attach event handlers
    card.querySelector('#btnTourClose').onclick = () => finishTour(false);
    card.querySelector('#btnTourSkip').onclick = () => finishTour(false);
    card.querySelector('#btnTourPrev').onclick = () => {
      if (currentTourIndex > 0) {
        currentTourIndex--;
        renderCurrentTourStep();
      }
    };
    card.querySelector('#btnTourNext').onclick = () => {
      if (isLast) {
        finishTour(true);
      } else {
        currentTourIndex++;
        renderCurrentTourStep();
      }
    };

    // Keyboard listener for Escape and arrows
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', onKeyDown);
        finishTour(false);
      } else if (e.key === 'ArrowRight' && !isLast) {
        window.removeEventListener('keydown', onKeyDown);
        currentTourIndex++;
        renderCurrentTourStep();
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        window.removeEventListener('keydown', onKeyDown);
        currentTourIndex--;
        renderCurrentTourStep();
      }
    };
    window.addEventListener('keydown', onKeyDown, { once: true });

    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function clearTourSpotlight() {
    document.querySelectorAll('.tour-spotlight-target').forEach(el => {
      el.classList.remove('tour-spotlight-target');
    });
  }

  function finishTour(completed = true) {
    clearTourSpotlight();
    const overlay = document.getElementById('tourOverlay');
    if (overlay) overlay.hidden = true;
    const card = document.getElementById('tourCard');
    if (card) card.hidden = true;

    const user = getCurrentUser();
    if (completed) {
      UNRCHelp.saveTourPrefs(user.username, { completed: true, lastStep: currentTourStages.length });
      toast('¡Recorrido guiado completado! Podés volver a iniciarlo en cualquier momento desde el Centro de Ayuda.', 'success');
    } else {
      UNRCHelp.saveTourPrefs(user.username, { dismissed: true, lastStep: currentTourIndex });
      toast('Recorrido guiado pausado. Podés retomarlo desde el Centro de Ayuda cuando lo necesites.', 'info');
    }
  }

  // --- 3. AYUDA CONTEXTUAL EN FORMULARIOS Y CAMPOS ---
  function getHelpTriggerHtml(fieldName) {
    const help = UNRCHelp.getFieldHelp(fieldName);
    if (!help) return '';
    return `
      <button type="button" class="field-help-btn" data-help-field="${esc(fieldName)}" title="Ayuda contextual: ${esc(help.title)}" aria-label="Ayuda para ${esc(help.title)}">
        <i data-lucide="info" aria-hidden="true"></i>
      </button>
    `;
  }

  function attachContextualHelpEvents(container = document) {
    container.querySelectorAll('[data-help-field]').forEach(btn => {
      if (btn.dataset.helpAttached) return;
      btn.dataset.helpAttached = 'true';

      const showHelp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fieldName = btn.getAttribute('data-help-field');
        const help = UNRCHelp.getFieldHelp(fieldName);
        if (!help) return;
        showContextualPopover(btn, help);
      };

      btn.addEventListener('click', showHelp);
    });
  }

  function showContextualPopover(anchorEl, help) {
    closeContextualPopover();

    const popover = document.createElement('div');
    popover.id = 'contextualHelpPopover';
    popover.className = 'field-help-popover';
    popover.setAttribute('role', 'tooltip');

    popover.innerHTML = `
      <div class="popover-header">
        <div class="popover-title-row">
          <i data-lucide="info"></i>
          <strong>${esc(help.title)}</strong>
        </div>
        <button type="button" class="popover-close-btn" aria-label="Cerrar ayuda">×</button>
      </div>
      <div class="popover-body">
        <div class="popover-item">
          <span class="popover-label">Finalidad:</span>
          <span class="popover-val">${esc(help.purpose)}</span>
        </div>
        <div class="popover-item">
          <span class="popover-label">Unidad de medida:</span>
          <span class="popover-val popover-unit"><strong>${esc(help.unit)}</strong></span>
        </div>
        <div class="popover-item">
          <span class="popover-label">Formato esperado:</span>
          <span class="popover-val">${esc(help.format)}</span>
        </div>
        <div class="popover-item">
          <span class="popover-label">Ejemplo de uso:</span>
          <span class="popover-val popover-example"><em>${esc(help.example)}</em></span>
        </div>
        <div class="popover-item">
          <span class="popover-label">Relación con el ERP:</span>
          <span class="popover-val">${esc(help.relations)}</span>
        </div>
      </div>
    `;

    document.body.appendChild(popover);
    activePopover = popover;

    // Positioning near anchor
    const rect = anchorEl.getBoundingClientRect();
    const popWidth = 320;
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 6;

    if (left + popWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popWidth - 16);
    }
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    popover.querySelector('.popover-close-btn').onclick = closeContextualPopover;

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
        closeContextualPopover();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 50);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeContextualPopover();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey, { once: true });

    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function closeContextualPopover() {
    if (activePopover && activePopover.parentNode) {
      activePopover.parentNode.removeChild(activePopover);
      activePopover = null;
    }
  }

  // --- 4. CENTRO DE AYUDA PERMANENTE ---
  function renderHelpCenter() {
    const user = getCurrentUser();
    const faqs = UNRCHelp.HELP_FAQ;

    return `
      <section class="help-center-wrapper">
        <header class="page-heading">
          <div>
            <h3>Centro de Ayuda y Asistencia al Usuario</h3>
            <small>Guías operativas, preguntas frecuentes, glosario y recorrido interactivo por los módulos</small>
          </div>
          <div class="toolbar">
            <button type="button" class="btn primary" id="btnRestartTourFromHelp">
              <i data-lucide="compass"></i> Iniciar Recorrido Guiado
            </button>
            <button type="button" class="btn ghost" data-action="print">
              <i data-lucide="printer"></i> Imprimir manual
            </button>
          </div>
        </header>

        <!-- SECCIÓN A: INTRODUCCIÓN AL ERP -->
        <article class="surface help-section">
          <div class="surface-title">
            <h4><i data-lucide="landmark"></i> A. Introducción al ERP Establecimiento Pozo del Carril</h4>
          </div>
          <div class="help-section-content">
            <p>
              El <strong>ERP Agropecuario Establecimiento Pozo del Carril</strong> es una solución de gestión integral desarrollada en el marco de la asignatura <strong>Taller de Práctica II</strong> de la carrera de <strong>Contador Público</strong> en la <strong>Facultad de Ciencias Económicas de la Universidad Nacional de Río Cuarto (UNRC)</strong>.
            </p>
            <p>
              Su objetivo primordial es articular la administración económica, comercial y contable con las cinco unidades operativas del campo experimental: <strong>Maíz</strong> y <strong>Soja</strong> (sector agrícola) junto a <strong>Porcinos</strong>, <strong>Bovinos</strong> y <strong>Ovinos</strong> (sector ganadero). A través de este sistema, cada transacción física o biológica genera automáticamente su imputación por partida doble en el Libro Diario General, facilitando el control de gestión, el cálculo de costos unitarios y la trazabilidad de resultados.
            </p>
          </div>
        </article>

        <!-- SECCIÓN B: GUÍA POR MÓDULOS -->
        <article class="surface help-section">
          <div class="surface-title">
            <h4><i data-lucide="layout-grid"></i> B. Guía Operativa por Módulos</h4>
          </div>
          <div class="help-modules-grid">
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="wheat"></i> <strong>Agricultura (Maíz y Soja)</strong></div>
              <p>Seguimiento agronómico de campañas de 1ª y 2ª ocupación. Registro de hectáreas sembradas, dosis de fertilizantes y fitosanitarios (L y kg), y cosecha física. Transferencia interna de cereal a costo de oportunidad hacia comederos de ganadería.</p>
            </div>
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="beef"></i> <strong>Ganadería (Porcinos, Bovinos y Ovinos)</strong></div>
              <p>Control de existencias por tropa y categoría biológica. Pesajes periódicos para calcular la ganancia diaria de peso (GDP), seguimiento de mortandad e índice de conversión alimenticia (ICA), y bloqueo estricto de faena ante carencia sanitaria.</p>
            </div>
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="handshake"></i> <strong>Comercial, Compras e Insumos</strong></div>
              <p>Gestión de proveedores, contratistas y clientes. Registro de facturas de compra con IVA crédito fiscal y retenciones, y liquidaciones de venta de hacienda y granos con destino a faena o invernada. Control de inventario en almacenes.</p>
            </div>
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="book-open"></i> <strong>Contabilidad y Tesorería</strong></div>
              <p>Plan de cuentas formal UNRC con 48 rubros y 19 cuentas analíticas. Generación automática de asientos de partida doble balanceados al centavo. Conciliación de cobranzas, órdenes de pago bancarias y distinción entre resultado devengado y flujo de caja.</p>
            </div>
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="traffic-light"></i> <strong>Semáforos y Control de Gestión</strong></div>
              <p>Tablero de control con 28 indicadores bajo cuatro estados: Verde (Normal), Amarillo (Atención), Rojo (Crítico) y Gris (Sin datos suficientes). Umbrales configurables por administradores y centro unificado de alertas operativas.</p>
            </div>
            <div class="help-module-card">
              <div class="help-card-head"><i data-lucide="shield-check"></i> <strong>Auditoría y Seguridad (RBAC)</strong></div>
              <p>Pista de auditoría inmutable que registra usuario, fecha/hora y valores previos de cada comprobante. Matriz de 7 roles de acceso y respaldos criptográficos con suma de verificación SHA-256 descargables en cualquier momento.</p>
            </div>
          </div>
        </article>

        <!-- SECCIÓN C: PREGUNTAS FRECUENTES (FAQ) -->
        <article class="surface help-section">
          <div class="surface-title">
            <h4><i data-lucide="help-circle"></i> C. Preguntas Frecuentes (FAQ)</h4>
          </div>
          <div class="help-faq-accordion" id="helpFaqAccordion">
            ${faqs.map((faq, idx) => `
              <div class="faq-item" data-faq-id="${faq.id}">
                <button type="button" class="faq-question-btn" aria-expanded="${idx === 0 ? 'true' : 'false'}" aria-controls="faq-ans-${faq.id}">
                  <span class="faq-q-number">${idx + 1}.</span>
                  <span class="faq-q-text">${esc(faq.question)}</span>
                  <i data-lucide="chevron-down" class="faq-chevron"></i>
                </button>
                <div class="faq-answer-panel" id="faq-ans-${faq.id}" ${idx === 0 ? '' : 'hidden'}>
                  <p>${esc(faq.answer)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </article>

        <!-- SECCIÓN D: REINICIAR RECORRIDO INTERACTIVO -->
        <article class="surface help-section help-section-action">
          <div class="surface-title">
            <h4><i data-lucide="refresh-cw"></i> D. Reiniciar Recorrido Guiado</h4>
          </div>
          <div class="help-section-content" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px">
            <div>
              <p style="margin:0 0 4px">¿Deseás repasar la guía paso a paso por los 7 módulos del ERP Establecimiento Pozo del Carril?</p>
              <small style="color:#64748b">Esta acción no modifica tus datos registrados ni altera la configuración de tu cuenta.</small>
            </div>
            <button type="button" class="btn primary" id="btnRestartTourBottom">
              <i data-lucide="compass"></i> Iniciar Recorrido Ahora
            </button>
          </div>
        </article>

        <!-- SECCIÓN E: INFORMACIÓN INSTITUCIONAL -->
        <footer class="surface help-institutional-card">
          <div class="inst-logo-row">
            <img src="./assets/logo-pozo-del-carril.svg" alt="Pozo del Carril" class="inst-logo-field">
          </div>
          <div class="inst-details">
            <h4>ERP Agropecuario — Establecimiento Pozo del Carril</h4>
            <p><strong>Universidad Nacional de Río Cuarto</strong> · Facultad de Ciencias Económicas</p>
            <p>Asignatura: <strong>Taller de Práctica II</strong> · Ciclo Lectivo 2026</p>
            <p class="inst-sub">Diseñado para la gestión integrada de agricultura (maíz/soja), porcinos, bovinos, ovinos, comercialización y contabilidad patrimonial.</p>
          </div>
        </footer>
      </section>
    `;
  }

  function attachHelpCenterEvents() {
    const btnTop = document.getElementById('btnRestartTourFromHelp');
    const btnBottom = document.getElementById('btnRestartTourBottom');
    const startAction = () => {
      startTour(0);
    };

    if (btnTop) btnTop.onclick = startAction;
    if (btnBottom) btnBottom.onclick = startAction;

    // FAQ Accordion
    document.querySelectorAll('.faq-question-btn').forEach(btn => {
      btn.onclick = () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        const panel = btn.nextElementSibling;
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (panel) {
          panel.hidden = expanded;
        }
      };
    });

    if (typeof refreshIcons === 'function') refreshIcons();
  }

  // --- 5. ALERTAS Y NOTIFICACIONES MULTINIVEL ---
  function showEnhancedToast(message, type = 'info', title = '') {
    const formatted = UNRCHelp.formatAlertMessage(type, message, title);
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;

    toastEl.className = 'toast toast-' + formatted.type + ' show';
    toastEl.setAttribute('role', formatted.type === 'error' ? 'alert' : 'status');
    toastEl.setAttribute('aria-live', formatted.type === 'error' ? 'assertive' : 'polite');

    toastEl.innerHTML = `
      <div class="toast-content-wrapper">
        <span class="toast-badge badge-${formatted.type}">
          <i data-lucide="${formatted.icon}"></i>
          <span>${esc(formatted.badge)}</span>
        </span>
        <div class="toast-text-col">
          ${formatted.details ? `<strong class="toast-title">${esc(formatted.details)}</strong>` : ''}
          <span class="toast-message">${esc(formatted.message)}</span>
        </div>
        <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">×</button>
      </div>
    `;

    toastEl.querySelector('.toast-close-btn').onclick = () => {
      toastEl.classList.remove('show');
    };

    clearTimeout(toastEl.timer);
    toastEl.timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, formatted.type === 'error' ? 7000 : 4500);

    if (typeof refreshIcons === 'function') refreshIcons();
  }

  return {
    checkAutoStartTour,
    showWelcomeModal,
    startTour,
    renderCurrentTourStep,
    finishTour,
    getHelpTriggerHtml,
    attachContextualHelpEvents,
    renderHelpCenter,
    attachHelpCenterEvents,
    toast: showEnhancedToast
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UNRCHelpUI;
}
