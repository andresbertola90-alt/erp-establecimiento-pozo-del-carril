const test = require('node:test');
const assert = require('node:assert/strict');
const UNRCHelp = require('../help-engine.js');
const UNRC = require('../domain.js');

test('Help Engine: Preferencias de Usuario Aisladas por Cuenta', () => {
  // Mock localStorage
  const store = new Map();
  const mockStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key)
  };

  // 1. Estado inicial por defecto
  const prefsUser1 = UNRCHelp.getTourPrefs('juan_agronomo', mockStorage);
  assert.equal(prefsUser1.completed, false);
  assert.equal(prefsUser1.dismissed, false);
  assert.equal(prefsUser1.dontShowAgain, false);
  assert.equal(prefsUser1.lastStep, 0);

  // 2. Guardar preferencia para user 1
  UNRCHelp.saveTourPrefs('juan_agronomo', { dismissed: true, lastStep: 3 }, mockStorage);
  const updatedUser1 = UNRCHelp.getTourPrefs('juan_agronomo', mockStorage);
  assert.equal(updatedUser1.dismissed, true);
  assert.equal(updatedUser1.completed, false);
  assert.equal(updatedUser1.lastStep, 3);
  assert.ok(updatedUser1.updatedAt);

  // 3. Verificar que user 2 NO se ve afectado (aislamiento estricto)
  const prefsUser2 = UNRCHelp.getTourPrefs('maria_veterinaria', mockStorage);
  assert.equal(prefsUser2.dismissed, false);
  assert.equal(prefsUser2.lastStep, 0);

  // 4. Completar recorrido para user 2
  UNRCHelp.saveTourPrefs('maria_veterinaria', { completed: true, dontShowAgain: true, lastStep: 7 }, mockStorage);
  const updatedUser2 = UNRCHelp.getTourPrefs('maria_veterinaria', mockStorage);
  assert.equal(updatedUser2.completed, true);
  assert.equal(updatedUser2.dontShowAgain, true);
  assert.equal(updatedUser2.lastStep, 7);

  // 5. Reinicio de preferencias
  UNRCHelp.resetTourPrefs('juan_agronomo', mockStorage);
  const resetUser1 = UNRCHelp.getTourPrefs('juan_agronomo', mockStorage);
  assert.equal(resetUser1.dismissed, false);
  assert.equal(resetUser1.lastStep, 0);
});

test('Help Engine: Filtrado de Etapas del Recorrido según Rol de Usuario', () => {
  // 1. Administrador accede a las 7 etapas
  const adminStages = UNRCHelp.filterStagesForRole('admin');
  assert.equal(adminStages.length, 7);
  assert.equal(adminStages[0].id, 'stage_general');
  assert.equal(adminStages[6].id, 'stage_admin');

  // 2. Responsable de Agricultura: no debe ver Ganadería (Etapa 3)
  const agriStages = UNRCHelp.filterStagesForRole('responsable_agricultura');
  assert.ok(agriStages.some(s => s.id === 'stage_agricultura'));
  assert.ok(!agriStages.some(s => s.id === 'stage_ganaderia'));

  // 3. Responsable de Ganadería: no debe ver Agricultura (Etapa 2)
  const ganStages = UNRCHelp.filterStagesForRole('responsable_ganaderia');
  assert.ok(ganStages.some(s => s.id === 'stage_ganaderia'));
  assert.ok(!ganStages.some(s => s.id === 'stage_agricultura'));

  // 4. Auditor accede a etapas de consulta permitidas
  const auditorStages = UNRCHelp.filterStagesForRole('auditor');
  assert.ok(auditorStages.length >= 5);
  assert.ok(auditorStages.some(s => s.id === 'stage_general'));
  assert.ok(auditorStages.some(s => s.id === 'stage_indicadores'));
});

test('Help Engine: Diccionario de Ayuda Contextual para Campos Clave', () => {
  const fieldsToCheck = [
    'hectares',
    'yield',
    'harvestTons',
    'animals',
    'weight',
    'withdrawalDays',
    'opportunityPrice',
    'price',
    'unitCost',
    'lines',
    'area'
  ];

  for (const f of fieldsToCheck) {
    const help = UNRCHelp.getFieldHelp(f);
    assert.ok(help, `Debe existir ayuda contextual para el campo ${f}`);
    assert.ok(help.title && help.title.length > 0, `Campo ${f} debe tener title`);
    assert.ok(help.purpose && help.purpose.length > 0, `Campo ${f} debe tener purpose`);
    assert.ok(help.unit && help.unit.length > 0, `Campo ${f} debe tener unit`);
    assert.ok(help.format && help.format.length > 0, `Campo ${f} debe tener format`);
    assert.ok(help.example && help.example.length > 0, `Campo ${f} debe tener example`);
    assert.ok(help.relations && help.relations.length > 0, `Campo ${f} debe tener relations`);
  }

  // Campo inexistente retorna null sin error
  assert.equal(UNRCHelp.getFieldHelp('campo_inexistente_123'), null);
});

test('Help Engine: Preguntas Frecuentes (FAQ) Institucionales', () => {
  const faqs = UNRCHelp.HELP_FAQ;
  assert.ok(Array.isArray(faqs));
  assert.equal(faqs.length, 8, 'Debe contener las 8 preguntas frecuentes solicitadas');

  const q1 = faqs.find(f => f.id === 'faq_1');
  assert.ok(q1 && q1.question.includes('registro una nueva operación'));

  const q5 = faqs.find(f => f.id === 'faq_5');
  assert.ok(q5 && q5.question.includes('colores de los semáforos'));
  assert.ok(q5.answer.includes('VERDE') && q5.answer.includes('AMARILLO') && q5.answer.includes('ROJO') && q5.answer.includes('GRIS'));

  const q8 = faqs.find(f => f.id === 'faq_8');
  assert.ok(q8 && q8.question.includes('guía interactiva'));
});

test('Help Engine: Formato Multinivel de Alertas y Notificaciones', () => {
  // Éxito / Confirmación
  const s = UNRCHelp.formatAlertMessage('success', 'Comprobante guardado con éxito.', 'Liquidación #120');
  assert.equal(s.type, 'success');
  assert.equal(s.badge, 'Confirmación');
  assert.equal(s.icon, 'circle-check');
  assert.equal(s.message, 'Comprobante guardado con éxito.');
  assert.equal(s.details, 'Liquidación #120');

  // Advertencia
  const w = UNRCHelp.formatAlertMessage('warning', 'El stock de maíz cayó bajo reserva.', 'Stock Mínimo');
  assert.equal(w.type, 'warning');
  assert.equal(w.badge, 'Advertencia');
  assert.equal(w.icon, 'triangle-alert');

  // Error
  const e = UNRCHelp.formatAlertMessage('error', 'Lote en período de carencia farmacológica.');
  assert.equal(e.type, 'error');
  assert.equal(e.badge, 'Error');
  assert.equal(e.icon, 'circle-alert');

  // Info
  const i = UNRCHelp.formatAlertMessage('info', 'Sesión iniciada como auditor.');
  assert.equal(i.type, 'info');
  assert.equal(i.badge, 'Información');
});

test('Help Engine: Inocuidad sobre la Base de Datos Operativa', () => {
  const initialDb = UNRC.initial();
  const tablesBefore = Object.keys(initialDb);

  // Consultar todas las ayudas y etapas
  UNRCHelp.filterStagesForRole('admin');
  UNRCHelp.getFieldHelp('hectares');
  UNRCHelp.formatAlertMessage('info', 'Prueba');

  const tablesAfter = Object.keys(initialDb);
  assert.deepEqual(tablesBefore, tablesAfter, 'El motor de ayuda no debe alterar las estructuras de la base de datos');
});
