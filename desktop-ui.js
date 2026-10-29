'use strict';
if (window.UNRCDesktop) {
  UNRCDesktop.onCommand(async command => {
    if (!await ensureAccess()) return;
    if (command === 'report') { if (!$('#reportDialog').open) openReportPreview(); return; }
    if (document.querySelector('dialog[open]')) return;
    ui.view = command === 'manual' ? 'manual' : 'ajustes';
    if (command === 'transfer') ui.tab.ajustes = 'traslado';
    render(); $('#viewRoot').focus({ preventScroll: true });
  });
}
