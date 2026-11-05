'use strict';

/**
 * Configuración centralizada de marca e identidad visual del ERP Entre Surcos.
 * Única fuente de verdad para nombre, eslogan, logotipos, isotipos e identificación institucional.
 */
const ERP_BRAND = Object.freeze({
  name: 'Entre Surcos',
  slogan: 'conectando al agro',
  fullName: 'Entre Surcos · conectando al agro',
  description: 'Sistema ERP de gestión agropecuaria integral. Conectando al agro.',
  logoHorizontal: './assets/entre-surcos-logo-horizontal.png',
  logoHeader: './assets/entre-surcos-logo-header.png',
  appIcon: './assets/entre-surcos-icon.png',
  unrcShield: './assets/escudo-unrc.png',
  institution: 'Universidad Nacional de Río Cuarto',
  faculty: 'Facultad de Ciencias Económicas',
  institutionalFull: 'Universidad Nacional de Río Cuarto · Facultad de Ciencias Económicas',
  colors: {
    forest: '#123F32',
    agri: '#62A544',
    graphite: '#252D2B',
    white: '#FFFFFF'
  }
});

if (typeof window !== 'undefined') {
  window.ERP_BRAND = ERP_BRAND;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ERP_BRAND;
}
