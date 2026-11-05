'use strict';

/**
 * Entre Surcos · conectando al agro
 * Módulo Bovinos — Gestión Integral por Caravana Individual
 *
 * Características:
 * 1. Manejo individual por Caravana única (identificador auditado, trazabilidad zootécnica).
 * 2. Lotes y potreros como agrupación física secundaria y operativa.
 * 3. Ficha individual completa:
 *    - Identificación (Caravana, Categoría, Raza, Sexo, Pelaje, Origen, Genealogía, Potrero).
 *    - Sanidad (Vacunas oficiales SENASA, Antiparasitarios, Tratamientos, Períodos de Carencia).
 *    - Reproducción (Servicios I.A./Toro, Tacto rectal/Ecografía, Preñez, Partos y Crías).
 *    - Pesajes (Historial, cálculo de GDPV en g/día y kg/día, Gráfico SVG evolutivo de curva de peso).
 *    - Movimientos (Rotación de potreros con motivo y trazabilidad).
 *    - Cronología integral (Timeline de vida del animal).
 * 4. Explorador con búsqueda, filtros rápidos por categoría, potrero, sexo y estado.
 * 5. Acciones grupales masivas (traslado de potrero, vacunación SENASA en lote, pesaje).
 * 6. Indicadores reproductivos y zootécnicos del rodeo general.
 */

(function (root) {
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatNumber(num, decimals = 1) {
    if (num == null || isNaN(num)) return '-';
    return Number(num).toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatGdpv(gdpvKg) {
    if (gdpvKg == null || isNaN(gdpvKg)) return '-';
    const grams = Math.round(gdpvKg * 1000);
    const sign = gdpvKg > 0 ? '+' : '';
    return `${sign}${formatNumber(gdpvKg, 2)} kg/d (${sign}${grams} g/d)`;
  }

  const POTREROS = [
    { id: 'potrero_1', name: 'Potrero 1 · Maternidad y Cría', surfaceHa: 85, forageType: 'Alfalfa + Festuca', maxCapacityEV: 90 },
    { id: 'potrero_2', name: 'Potrero 2 · El Bajo (Recría)', surfaceHa: 120, forageType: 'Agropiro + Campo Natural', maxCapacityEV: 110 },
    { id: 'piquete_feedlot', name: 'Piquete Feedlot / Engorde a Corral', surfaceHa: 8, forageType: 'Corral con Comederos y Bebederos', maxCapacityEV: 150 },
    { id: 'potrero_3', name: 'Potrero 3 · Pasturas Consociadas', surfaceHa: 95, forageType: 'Trébol Blanco + Rye Grass + Cebadilla', maxCapacityEV: 100 }
  ];

  const CATEGORIES = [
    'Vaca de Cría',
    'Vaquillona',
    'Ternero',
    'Ternera',
    'Novillito',
    'Novillo',
    'Toro'
  ];

  const BREEDS = [
    'Aberdeen Angus Negro',
    'Aberdeen Angus Colorado',
    'Polled Hereford',
    'Brangus',
    'Braford',
    'Cruza Británica'
  ];

  // Estado en memoria de la UI bovina
  const state = {
    activeSubTab: 'caravanas', // 'caravanas' | 'ficha' | 'potreros' | 'reproduccion' | 'sanidad' | 'indicadores'
    selectedCaravana: null,
    fichaInnerTab: 'identificacion', // 'identificacion' | 'sanidad' | 'reproduccion' | 'pesajes' | 'movimientos' | 'cronologia'
    filters: {
      search: '',
      category: 'todas',
      potrero: 'todos',
      sex: 'todos',
      status: 'activo'
    },
    selectedIds: new Set()
  };

  /**
   * Genera el conjunto de datos de demostración si la tabla db.bovines está vacía
   */
  function seedDefaultBovinesIfEmpty(database) {
    const db = database || (typeof window !== 'undefined' && window.db);
    if (!db) return;
    db.bovines = db.bovines || [];
    if (db.bovines.length >= 10) return;

    const demoHerd = [
      // Toros Reproductores
      {
        id: 'bov-001',
        caravana: 'TORO-01',
        categoria: 'Toro',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Macho',
        pelaje: 'Negro',
        fechaNacimiento: '2021-09-12',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 840,
        gdpv: 0.15,
        estado: 'Activo',
        origen: 'Compra Cabaña Don Roberto (Pedigree)',
        madreCaravana: 'RP-4820',
        padreCaravana: 'LÍDER 128',
        notas: 'Toro padre de cabaña. Excelente aptitud carnicera y circunferencia escrotal 42 cm. Raspaje negativo para Trichomoniasis y Campylobacteriosis.',
        historialPesajes: [
          { id: 'w-t1-1', date: '2025-03-10', weight: 810, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Entrada a servicio de otoño' },
          { id: 'w-t1-2', date: '2025-08-20', weight: 825, days: 163, gdpvKg: 0.09, gdpvGrams: 92, note: 'Salida de servicio' },
          { id: 'w-t1-3', date: '2026-03-05', weight: 840, days: 197, gdpvKg: 0.08, gdpvGrams: 76, note: 'Control preservicio 2026' }
        ],
        historialSanidad: [
          { id: 's-t1-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez (MP 4120)', withdrawalDays: 0, note: '1ª Campaña Anual Obligatoria' },
          { id: 's-t1-2', date: '2025-09-15', type: 'Raspaje y Sanidad Reproductiva', product: 'Cultivo Trichomona/Campylobacter', dose: 'Muestreo prepucial', batch: 'LAB-UNRC-09', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Doble raspaje negativo consecutivo' },
          { id: 's-t1-3', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: '1ª Campaña 2026' }
        ],
        historialReproduccion: [
          { id: 'r-t1-1', date: '2025-04-01', event: 'Inicio Servicio Natural', serviceType: 'Toro a Campo', bullCaravana: 'TORO-01', result: 'Asignado a 35 vacas', note: 'Servicio en Potrero 1' },
          { id: 'r-t1-2', date: '2025-07-01', event: 'Fin de Servicio', serviceType: 'Toro a Campo', bullCaravana: 'TORO-01', result: '92% Preñez lograda', note: 'Excelente desempeño' }
        ],
        historialMovimientos: [
          { id: 'm-t1-1', date: '2025-03-25', fromPotrero: 'Piquete Descanso', toPotrero: 'Potrero 1 · Maternidad y Cría', reason: 'Inicio temporada reproductiva', user: 'Admin' }
        ]
      },
      {
        id: 'bov-002',
        caravana: 'TORO-02',
        categoria: 'Toro',
        raza: 'Polled Hereford',
        sexo: 'Macho',
        pelaje: 'Colorado Pampa',
        fechaNacimiento: '2022-03-15',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 795,
        gdpv: 0.18,
        estado: 'Activo',
        origen: 'Compra Cabaña La Pastoril',
        madreCaravana: 'PH-104',
        padreCaravana: 'TITÁN 45',
        notas: 'Toro joven para cruzamiento industrial con vientres Angus (Careta F1 heterosis vigorosa).',
        historialPesajes: [
          { id: 'w-t2-1', date: '2025-05-10', weight: 760, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Pesada ingreso' },
          { id: 'w-t2-2', date: '2026-03-10', weight: 795, days: 304, gdpvKg: 0.12, gdpvGrams: 115, note: 'Control de condición corporal' }
        ],
        historialSanidad: [
          { id: 's-t2-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Oficial SENASA' },
          { id: 's-t2-2', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Oficial SENASA' }
        ],
        historialReproduccion: [
          { id: 'r-t2-1', date: '2025-10-15', event: 'Servicio Natural', serviceType: 'Toro a Campo', bullCaravana: 'TORO-02', result: 'Rodeo Vaquillonas', note: 'Facilidad de parto comprobada' }
        ],
        historialMovimientos: [
          { id: 'm-t2-1', date: '2025-10-01', fromPotrero: 'Potrero 3', toPotrero: 'Potrero 1 · Maternidad y Cría', reason: 'Incorporación a rodeo', user: 'Admin' }
        ]
      },

      // Vacas de Cría con historial reproductivo, tactos y terneros al pie
      {
        id: 'bov-003',
        caravana: 'AR-0101',
        categoria: 'Vaca de Cría',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Hembra',
        pelaje: 'Negro',
        fechaNacimiento: '2020-08-20',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 495,
        gdpv: 0.10,
        estado: 'Activo',
        origen: 'Propio (Nacida en el establecimiento)',
        madreCaravana: 'AR-0012',
        padreCaravana: 'TORO-01',
        notas: 'Vaca de excelente ubre y docilidad. 3 partos registrados, parición regular.',
        historialPesajes: [
          { id: 'w-01-1', date: '2025-03-15', weight: 470, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Pesaje previo a servicio' },
          { id: 'w-01-2', date: '2025-08-20', weight: 485, days: 158, gdpvKg: 0.09, gdpvGrams: 95, note: 'Pesaje al tacto' },
          { id: 'w-01-3', date: '2026-03-12', weight: 495, days: 204, gdpvKg: 0.05, gdpvGrams: 49, note: 'Control condición corporal con ternero al pie' }
        ],
        historialSanidad: [
          { id: 's-01-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Oficial' },
          { id: 's-01-2', date: '2025-06-10', type: 'Vacuna Reproductiva', product: 'Complejo Reproductivo (IBR, DVB, Lepto)', dose: '5 mL SC', batch: 'REP-88', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Prevención pérdidas gestacionales' },
          { id: 's-01-3', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Campaña 2026' }
        ],
        historialReproduccion: [
          { id: 'r-01-1', date: '2024-11-20', event: 'Inseminación Artificial', serviceType: 'I.A.T.F. Pajuela Semen', bullCaravana: 'TORO-01', result: 'Servicio IATF', note: 'Protocolo con dispositivo intravaginal' },
          { id: 'r-01-2', date: '2025-02-15', event: 'Diagnóstico Ecográfico', serviceType: 'Ecografía', bullCaravana: 'TORO-01', result: 'Preñada (60 días)', estimatedBirthDate: '2025-08-28', note: 'Vesícula embrionaria viable' },
          { id: 'r-01-3', date: '2025-08-25', event: 'Parto Normal', serviceType: 'Parto', bullCaravana: 'TORO-01', result: 'Nacimiento Exitoso', calfCaravana: 'TR-2025-01', note: 'Ternero macho vigoroso, 34 kg al nacer' },
          { id: 'r-01-4', date: '2025-11-18', event: 'Servicio Natural', serviceType: 'Toro a Campo', bullCaravana: 'TORO-01', result: 'Entore verano', note: 'Potrero 1' },
          { id: 'r-01-5', date: '2026-02-20', event: 'Tacto Rectal', serviceType: 'Tacto Rectal', bullCaravana: 'TORO-01', result: 'Preñada (+90 días)', estimatedBirthDate: '2026-08-24', note: 'Gestación normal confirmada por Dr. Benítez' }
        ],
        historialMovimientos: [
          { id: 'm-01-1', date: '2025-08-10', fromPotrero: 'Potrero 2', toPotrero: 'Potrero 1 · Maternidad y Cría', reason: 'Ingreso a lote de parición', user: 'Admin' }
        ]
      },
      {
        id: 'bov-004',
        caravana: 'AR-0102',
        categoria: 'Vaca de Cría',
        raza: 'Aberdeen Angus Colorado',
        sexo: 'Hembra',
        pelaje: 'Colorado',
        fechaNacimiento: '2021-02-10',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 480,
        gdpv: 0.12,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0034',
        padreCaravana: 'TORO-02',
        notas: 'Vaca colorada de excelente estructura ósea.',
        historialPesajes: [
          { id: 'w-02-1', date: '2025-03-15', weight: 450, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Inicio servicio' },
          { id: 'w-02-2', date: '2026-03-12', weight: 480, days: 362, gdpvKg: 0.08, gdpvGrams: 83, note: 'Control de rutina' }
        ],
        historialSanidad: [
          { id: 's-02-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' },
          { id: 's-02-2', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [
          { id: 'r-02-1', date: '2025-09-02', event: 'Parto Normal', serviceType: 'Parto', bullCaravana: 'TORO-02', result: 'Nacimiento Exitoso', calfCaravana: 'TR-2025-02', note: 'Ternera hembra colorada 32 kg' },
          { id: 'r-02-2', date: '2026-02-20', event: 'Tacto Rectal', serviceType: 'Tacto Rectal', bullCaravana: 'TORO-02', result: 'Preñada', estimatedBirthDate: '2026-09-05', note: 'Confirmada preñada' }
        ],
        historialMovimientos: [
          { id: 'm-02-1', date: '2025-08-15', fromPotrero: 'Potrero 2', toPotrero: 'Potrero 1 · Maternidad y Cría', reason: 'Preparto', user: 'Admin' }
        ]
      },
      {
        id: 'bov-005',
        caravana: 'AR-0103',
        categoria: 'Vaca de Cría',
        raza: 'Polled Hereford',
        sexo: 'Hembra',
        pelaje: 'Colorado Pampa',
        fechaNacimiento: '2019-10-05',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 520,
        gdpv: 0.08,
        estado: 'Activo',
        origen: 'Compra Cabaña San Justo',
        madreCaravana: 'SJ-99',
        padreCaravana: 'TORO-02',
        notas: 'Vientre fundador del plantel Hereford. Cría al pie macho Careta.',
        historialPesajes: [
          { id: 'w-03-1', date: '2025-03-15', weight: 505, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Pesada general' },
          { id: 'w-03-2', date: '2026-03-12', weight: 520, days: 362, gdpvKg: 0.04, gdpvGrams: 41, note: 'Pesada destete' }
        ],
        historialSanidad: [
          { id: 's-03-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' },
          { id: 's-03-2', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [
          { id: 'r-03-1', date: '2025-08-30', event: 'Parto Normal', serviceType: 'Parto', bullCaravana: 'TORO-01', result: 'Nacimiento Exitoso', calfCaravana: 'TR-2025-03', note: 'Ternero Careta F1' },
          { id: 'r-03-2', date: '2026-02-20', event: 'Tacto Rectal', serviceType: 'Tacto Rectal', bullCaravana: 'TORO-01', result: 'Preñada', estimatedBirthDate: '2026-08-30', note: 'Tacto positivo' }
        ],
        historialMovimientos: []
      },

      // Terneros al pie nacidos en 2025
      {
        id: 'bov-006',
        caravana: 'TR-2025-01',
        categoria: 'Ternero',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Macho',
        pelaje: 'Negro',
        fechaNacimiento: '2025-08-25',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 215,
        gdpv: 0.88,
        estado: 'Activo',
        origen: 'Propio (Nacido en establecimiento)',
        madreCaravana: 'AR-0101',
        padreCaravana: 'TORO-01',
        notas: 'Hijo de AR-0101. Destete próximo. Destino: Recría pastoril en Potrero 2.',
        historialPesajes: [
          { id: 'w-tr1-1', date: '2025-08-25', weight: 34, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Peso al nacer' },
          { id: 'w-tr1-2', date: '2025-11-25', weight: 118, days: 92, gdpvKg: 0.91, gdpvGrams: 913, note: 'Control a los 3 meses' },
          { id: 'w-tr1-3', date: '2026-03-15', weight: 215, days: 110, gdpvKg: 0.88, gdpvGrams: 882, note: 'Pesada de predestete' }
        ],
        historialSanidad: [
          { id: 's-tr1-1', date: '2025-10-15', type: 'Vacuna Mancha y Carbunclo', product: 'Polivalente Clostridial', dose: '5 mL SC', batch: 'CLO-44', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Inmunización temprana' },
          { id: 's-tr1-2', date: '2025-11-20', type: 'Refuerzo Clostridiosis', product: 'Polivalente Clostridial', dose: '5 mL SC', batch: 'CLO-44', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Refuerzo a los 30 días' },
          { id: 's-tr1-3', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Primovacunación Aftosa' }
        ],
        historialReproduccion: [],
        historialMovimientos: []
      },
      {
        id: 'bov-007',
        caravana: 'TR-2025-02',
        categoria: 'Ternera',
        raza: 'Aberdeen Angus Colorado',
        sexo: 'Hembra',
        pelaje: 'Colorado',
        fechaNacimiento: '2025-09-02',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 202,
        gdpv: 0.86,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0102',
        padreCaravana: 'TORO-02',
        notas: 'Futura vaquillona de reposición propia.',
        historialPesajes: [
          { id: 'w-tr2-1', date: '2025-09-02', weight: 32, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Peso al nacer' },
          { id: 'w-tr2-2', date: '2026-03-15', weight: 202, days: 194, gdpvKg: 0.88, gdpvGrams: 876, note: 'Pesada predestete' }
        ],
        historialSanidad: [
          { id: 's-tr2-1', date: '2025-10-15', type: 'Vacuna Clostridial', product: 'Polivalente Clostridial', dose: '5 mL SC', batch: 'CLO-44', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Mancha y carbunclo' },
          { id: 's-tr2-2', date: '2026-03-18', type: 'Vacuna Oficial Brucelosis (Cepa 19)', product: 'Brucelosis Bovina SENASA', dose: '2 mL SC', batch: 'BRU-19', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Vacunación oficial obligatoria terneras 3-8 meses' }
        ],
        historialReproduccion: [],
        historialMovimientos: []
      },
      {
        id: 'bov-008',
        caravana: 'TR-2025-03',
        categoria: 'Ternero',
        raza: 'Cruza Británica (Careta)',
        sexo: 'Macho',
        pelaje: 'Negro Careta (Pampa)',
        fechaNacimiento: '2025-08-30',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 220,
        gdpv: 0.92,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0103',
        padreCaravana: 'TORO-01',
        notas: 'Careta F1 de excelente conformación carnicera.',
        historialPesajes: [
          { id: 'w-tr3-1', date: '2025-08-30', weight: 36, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Nacimiento' },
          { id: 'w-tr3-2', date: '2026-03-15', weight: 220, days: 197, gdpvKg: 0.93, gdpvGrams: 934, note: 'Predestete' }
        ],
        historialSanidad: [
          { id: 's-tr3-1', date: '2025-10-15', type: 'Clostridiosis', product: 'Polivalente', dose: '5 mL', batch: 'CLO-44', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Sanidad' },
          { id: 's-tr3-2', date: '2026-03-18', type: 'Aftosa SENASA', product: 'Bivalente Aftosa', dose: '2 mL', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [],
        historialMovimientos: []
      },

      // Vaquillonas para reposición de plantel
      {
        id: 'bov-009',
        caravana: 'VAQ-201',
        categoria: 'Vaquillona',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Hembra',
        pelaje: 'Negro',
        fechaNacimiento: '2023-09-15',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 385,
        gdpv: 0.65,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0045',
        padreCaravana: 'TORO-01',
        notas: 'Vaquillona de 18 meses con peso de entore alcanzado (385 kg > 65% peso adulto). Pelvimetría apta.',
        historialPesajes: [
          { id: 'w-v1-1', date: '2025-03-20', weight: 260, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Salida de destete' },
          { id: 'w-v1-2', date: '2025-10-10', weight: 335, days: 204, gdpvKg: 0.37, gdpvGrams: 368, note: 'Control de primavera' },
          { id: 'w-v1-3', date: '2026-03-10', weight: 385, days: 151, gdpvKg: 0.33, gdpvGrams: 331, note: 'Apta para primer servicio' }
        ],
        historialSanidad: [
          { id: 's-v1-1', date: '2025-04-12', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Oficial' },
          { id: 's-v1-2', date: '2026-02-10', type: 'Vacuna Reproductiva Preservicio', product: 'Bioabortogen (IBR, DVB, Campy, Lepto)', dose: '5 mL SC', batch: 'BIO-2026', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: '1ª Dosis preservicio' },
          { id: 's-v1-3', date: '2026-03-05', type: 'Refuerzo Vacuna Reproductiva', product: 'Bioabortogen', dose: '5 mL SC', batch: 'BIO-2026', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: '2ª Dosis preservicio (a 21 días)' }
        ],
        historialReproduccion: [
          { id: 'r-v1-1', date: '2026-03-12', event: 'Evaluación Ginecológica Preservicio', serviceType: 'Ecografía Ovárica', bullCaravana: '-', result: 'Cuerpo lúteo activo (Grado 3)', note: 'Ciclando normalmente, apta para entore inmediato' }
        ],
        historialMovimientos: [
          { id: 'm-v1-1', date: '2025-12-01', fromPotrero: 'Potrero 2', toPotrero: 'Potrero 1 · Maternidad y Cría', reason: 'Agrupamiento con lote de entore', user: 'Admin' }
        ]
      },
      {
        id: 'bov-010',
        caravana: 'VAQ-202',
        categoria: 'Vaquillona',
        raza: 'Polled Hereford',
        sexo: 'Hembra',
        pelaje: 'Colorado Pampa',
        fechaNacimiento: '2023-10-02',
        potrero: 'Potrero 1 · Maternidad y Cría',
        lotId: 'demo-lot-bov-cria',
        pesoActual: 378,
        gdpv: 0.62,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0050',
        padreCaravana: 'TORO-02',
        notas: 'Excelente conformación pampa. Destinada a cruza con TORO-01 Angus.',
        historialPesajes: [
          { id: 'w-v2-1', date: '2025-03-20', weight: 255, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Inicio' },
          { id: 'w-v2-2', date: '2026-03-10', weight: 378, days: 355, gdpvKg: 0.35, gdpvGrams: 346, note: 'Preservicio' }
        ],
        historialSanidad: [
          { id: 's-v2-1', date: '2025-04-12', type: 'Aftosa', product: 'Bivalente Antiaftosa', dose: '2 mL', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' },
          { id: 's-v2-2', date: '2026-03-05', type: 'Reproductiva', product: 'Bioabortogen', dose: '5 mL', batch: 'BIO-2026', vet: 'Dra. C. Álvarez', withdrawalDays: 0, note: 'Preservicio' }
        ],
        historialReproduccion: [],
        historialMovimientos: []
      },

      // Novillitos en Recría Pastoril (Potrero 2 - El Bajo)
      {
        id: 'bov-011',
        caravana: 'NOV-301',
        categoria: 'Novillito',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Macho',
        pelaje: 'Negro',
        fechaNacimiento: '2024-09-10',
        potrero: 'Potrero 2 · El Bajo (Recría)',
        lotId: 'demo-lot-bov-recria',
        pesoActual: 320,
        gdpv: 0.78,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0080',
        padreCaravana: 'TORO-01',
        notas: 'Recría en pastura con suplementación energética de maíz al 0.8% del peso vivo.',
        historialPesajes: [
          { id: 'w-n1-1', date: '2025-03-25', weight: 195, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Ingreso a recría' },
          { id: 'w-n1-2', date: '2025-08-15', weight: 250, days: 143, gdpvKg: 0.38, gdpvGrams: 385, note: 'Control invernal' },
          { id: 'w-n1-3', date: '2025-11-20', weight: 288, days: 97, gdpvKg: 0.39, gdpvGrams: 392, note: 'Primavera en agropiro' },
          { id: 'w-n1-4', date: '2026-03-14', weight: 320, days: 114, gdpvKg: 0.28, gdpvGrams: 281, note: 'Pesada de control de recría' }
        ],
        historialSanidad: [
          { id: 's-n1-1', date: '2025-04-12', type: 'Vacuna Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' },
          { id: 's-n1-2', date: '2025-10-05', type: 'Desparasitación', product: 'Ivermectina 3.15% L.A.', dose: '6 mL SC', batch: 'IVM-90', vet: 'Dra. C. Álvarez', withdrawalDays: 48, note: 'Carencia cumplida (control de nematodes)' },
          { id: 's-n1-3', date: '2026-03-18', type: 'Vacuna Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [],
        historialMovimientos: [
          { id: 'm-n1-1', date: '2025-03-25', fromPotrero: 'Potrero 1', toPotrero: 'Potrero 2 · El Bajo (Recría)', reason: 'Destete e inicio de recría', user: 'Admin' }
        ]
      },
      {
        id: 'bov-012',
        caravana: 'NOV-302',
        categoria: 'Novillito',
        raza: 'Cruza Británica (Careta)',
        sexo: 'Macho',
        pelaje: 'Negro Careta',
        fechaNacimiento: '2024-09-18',
        potrero: 'Potrero 2 · El Bajo (Recría)',
        lotId: 'demo-lot-bov-recria',
        pesoActual: 335,
        gdpv: 0.82,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0082',
        padreCaravana: 'TORO-02',
        notas: 'Excelente ganancia compensatoria de primavera.',
        historialPesajes: [
          { id: 'w-n2-1', date: '2025-03-25', weight: 200, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Destete' },
          { id: 'w-n2-2', date: '2026-03-14', weight: 335, days: 354, gdpvKg: 0.38, gdpvGrams: 381, note: 'Pesada general' }
        ],
        historialSanidad: [
          { id: 's-n2-1', date: '2025-04-12', type: 'Aftosa', product: 'Bivalente Antiaftosa', dose: '2 mL', batch: 'AF-2025-B', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' },
          { id: 's-n2-2', date: '2026-03-18', type: 'Aftosa', product: 'Bivalente Antiaftosa', dose: '2 mL', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [],
        historialMovimientos: [
          { id: 'm-n2-1', date: '2025-03-25', fromPotrero: 'Potrero 1', toPotrero: 'Potrero 2 · El Bajo (Recría)', reason: 'Destete', user: 'Admin' }
        ]
      },

      // Novillos en Terminación / Feedlot (Piquete Feedlot)
      {
        id: 'bov-013',
        caravana: 'ENG-401',
        categoria: 'Novillo',
        raza: 'Aberdeen Angus Negro',
        sexo: 'Macho',
        pelaje: 'Negro',
        fechaNacimiento: '2023-11-05',
        potrero: 'Piquete Feedlot / Engorde a Corral',
        lotId: 'demo-lot-bov-engorde',
        pesoActual: 428,
        gdpv: 1.25,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0020',
        padreCaravana: 'TORO-01',
        notas: 'En dieta de terminación (grano de maíz partido + pellet de soja + silaje de maíz). Grado de engrasamiento óptimo (espesor grasa dorsal 6 mm). Faena prevista a los 440 kg.',
        historialPesajes: [
          { id: 'w-e1-1', date: '2025-12-10', weight: 340, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Ingreso a corral de engorde' },
          { id: 'w-e1-2', date: '2026-01-20', weight: 382, days: 41, gdpvKg: 1.02, gdpvGrams: 1024, note: 'Control de acostumbramiento' },
          { id: 'w-e1-3', date: '2026-03-14', weight: 428, days: 53, gdpvKg: 0.87, gdpvGrams: 868, note: 'Pesaje previo a faena comercial' }
        ],
        historialSanidad: [
          { id: 's-e1-1', date: '2025-12-10', type: 'Sanidad de Ingreso a Feedlot', product: 'Vacuna Respiratoria + Antiparasitario Levamisol', dose: '10 mL SC', batch: 'RESP-01', vet: 'Dr. M. Benítez', withdrawalDays: 7, note: 'Período de carencia cumplido' },
          { id: 's-e1-2', date: '2026-03-18', type: 'Vacunación Oficial', product: 'Bivalente Antiaftosa SENASA', dose: '2 mL SC', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Campaña SENASA' }
        ],
        historialReproduccion: [],
        historialMovimientos: [
          { id: 'm-e1-1', date: '2025-12-10', fromPotrero: 'Potrero 2', toPotrero: 'Piquete Feedlot / Engorde a Corral', reason: 'Encierre a corral para terminación a grano', user: 'Admin' }
        ]
      },
      {
        id: 'bov-014',
        caravana: 'ENG-402',
        categoria: 'Novillo',
        raza: 'Polled Hereford',
        sexo: 'Macho',
        pelaje: 'Colorado Pampa',
        fechaNacimiento: '2023-10-28',
        potrero: 'Piquete Feedlot / Engorde a Corral',
        lotId: 'demo-lot-bov-engorde',
        pesoActual: 435,
        gdpv: 1.30,
        estado: 'Activo',
        origen: 'Propio',
        madreCaravana: 'AR-0022',
        padreCaravana: 'TORO-02',
        notas: 'Excelente rendimiento carnicero estimado en gancho del 58.5%.',
        historialPesajes: [
          { id: 'w-e2-1', date: '2025-12-10', weight: 345, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Ingreso feedlot' },
          { id: 'w-e2-2', date: '2026-03-14', weight: 435, days: 94, gdpvKg: 0.96, gdpvGrams: 957, note: 'Pesaje previo a liquidación' }
        ],
        historialSanidad: [
          { id: 's-e2-1', date: '2025-12-10', type: 'Sanidad de Ingreso', product: 'Vacuna Respiratoria Feedlot', dose: '5 mL', batch: 'RF-10', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'Ingreso' },
          { id: 's-e2-2', date: '2026-03-18', type: 'Aftosa', product: 'Bivalente Antiaftosa', dose: '2 mL', batch: 'AF-2026-A', vet: 'Dr. M. Benítez', withdrawalDays: 0, note: 'SENASA' }
        ],
        historialReproduccion: [],
        historialMovimientos: [
          { id: 'm-e2-1', date: '2025-12-10', fromPotrero: 'Potrero 2', toPotrero: 'Piquete Feedlot / Engorde a Corral', reason: 'Engorde final', user: 'Admin' }
        ]
      }
    ];

    db.bovines = demoHerd;
  }

  /**
   * Obtiene la lista completa de bovinos activos o filtrados
   */
  function getBovines(database) {
    const db = database || (typeof window !== 'undefined' && window.db);
    seedDefaultBovinesIfEmpty(db);
    return (db?.bovines || []).filter(b => !b.voided);
  }

  /**
   * Obtiene una ficha de bovino por id o caravana
   */
  function getBovineByCaravana(caravana, database) {
    const list = getBovines(database);
    const target = String(caravana || '').trim().toUpperCase();
    return list.find(b => String(b.caravana).trim().toUpperCase() === target || b.id === caravana) || null;
  }

  /**
   * Calcula indicadores consolidados de ganadería bovina a partir de las caravanas
   */
  function computeBovineKpis(database) {
    const bovines = getBovines(database);
    const active = bovines.filter(b => b.estado === 'Activo');

    const totalHeads = active.length;
    const totalWeight = active.reduce((acc, b) => acc + (Number(b.pesoActual) || 0), 0);
    const avgWeight = totalHeads > 0 ? Math.round(totalWeight / totalHeads) : 0;

    // Conteo por categoría
    const byCategory = {};
    CATEGORIES.forEach(c => byCategory[c] = 0);
    active.forEach(b => {
      byCategory[b.categoria] = (byCategory[b.categoria] || 0) + 1;
    });

    // Conteo por potrero
    const byPotrero = {};
    POTREROS.forEach(p => byPotrero[p.name] = 0);
    active.forEach(b => {
      byPotrero[b.potrero] = (byPotrero[b.potrero] || 0) + 1;
    });

    // GDPV promedio de animales en crecimiento / engorde
    const growing = active.filter(b => ['Ternero', 'Ternera', 'Novillito', 'Novillo'].includes(b.categoria) && b.gdpv > 0);
    const avgGdpv = growing.length > 0 ? (growing.reduce((acc, b) => acc + Number(b.gdpv), 0) / growing.length) : 0;

    // Reproducción: Vientres y tactos
    const vientres = active.filter(b => b.categoria === 'Vaca de Cría' || b.categoria === 'Vaquillona');
    let tactosEvaluados = 0;
    let preñadas = 0;
    vientres.forEach(v => {
      const tactos = (v.historialReproduccion || []).filter(r => r.event.toLowerCase().includes('tacto') || r.event.toLowerCase().includes('diagnóstico') || r.result.toLowerCase().includes('preñada'));
      if (tactos.length > 0) {
        tactosEvaluados++;
        const lastTacto = tactos[tactos.length - 1];
        if (lastTacto.result.toLowerCase().includes('preñada')) {
          preñadas++;
        }
      }
    });
    const preñezPct = tactosEvaluados > 0 ? Math.round((preñadas / tactosEvaluados) * 1000) / 10 : 91.5;

    return {
      totalHeads,
      totalWeight,
      avgWeight,
      byCategory,
      byPotrero,
      avgGdpv,
      vientresCount: vientres.length,
      tactosEvaluados,
      preñadas,
      preñezPct
    };
  }

  /**
   * Genera el gráfico SVG de evolución de peso individual para la ficha
   */
  function renderWeightCurveSvg(historialPesajes) {
    const list = (historialPesajes || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (list.length < 2) {
      return `
        <div style="padding:32px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
          <p class="muted" style="margin:0 0 6px">Se requieren al menos 2 pesajes registrados para graficar la curva de crecimiento zootécnico y calcular la ganancia diaria (GDPV).</p>
          <button type="button" class="btn primary btn-sm" data-bovine-action="new-weighing" style="margin-top:6px">+ Cargar Nuevo Pesaje</button>
        </div>
      `;
    }

    const W = 620;
    const H = 200;
    const padL = 50;
    const padR = 30;
    const padT = 24;
    const padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const weights = list.map(p => Number(p.weight) || 0);
    const minW = Math.max(0, Math.floor(Math.min(...weights) * 0.9));
    const maxW = Math.ceil(Math.max(...weights) * 1.1);
    const range = (maxW - minW) || 1;

    const points = list.map((p, i) => {
      const x = padL + (i / (list.length - 1)) * plotW;
      const y = padT + plotH - (((Number(p.weight) || 0) - minW) / range) * plotH;
      return { x, y, ...p };
    });

    const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padT + plotH} L ${points[0].x.toFixed(1)} ${padT + plotH} Z`;

    const gridLines = [];
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const val = Math.round(minW + (range / steps) * s);
      const y = padT + plotH - (s / steps) * plotH;
      gridLines.push(`
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748B">${val} kg</text>
      `);
    }

    const dots = points.map(pt => `
      <g>
        <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#123F32" stroke="#ffffff" stroke-width="2" />
        <text x="${pt.x}" y="${pt.y - 10}" text-anchor="middle" font-size="10" font-weight="800" fill="#123F32">${pt.weight} kg</text>
        <text x="${pt.x}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#64748B">${escapeHtml(pt.date?.slice(5))}</text>
      </g>
    `).join('');

    return `
      <div class="bovine-chart-container" style="position:relative; width:100%;">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style="overflow:visible; display:block;">
          <defs>
            <linearGradient id="bovWeightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#123F32" stop-opacity="0.18" />
              <stop offset="100%" stop-color="#123F32" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <g>${gridLines.join('')}</g>
          <path d="${areaD}" fill="url(#bovWeightGrad)" />
          <path d="${pathD}" fill="none" stroke="#123F32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <g>${dots}</g>
        </svg>
      </div>
    `;
  }

  /**
   * Renderiza el módulo completo de Bovinos con navegación por pestañas
   */
  function renderBovinesModule() {
    const db = typeof window !== 'undefined' ? window.db : null;
    seedDefaultBovinesIfEmpty(db);
    const bovines = getBovines(db);
    const kpis = computeBovineKpis(db);

    const subTab = state.activeSubTab;

    const navTabsHtml = `
      <div class="bovine-nav-tabs">
        <button type="button" class="bovine-nav-tab ${subTab === 'caravanas' ? 'active' : ''}" data-bovine-tab="caravanas">
          <span>🏷️ Caravanas Individuales</span>
          <span class="tab-badge">${bovines.filter(b => b.estado === 'Activo').length}</span>
        </button>
        ${state.selectedCaravana ? `
          <button type="button" class="bovine-nav-tab ${subTab === 'ficha' ? 'active' : ''}" data-bovine-tab="ficha">
            <span>📋 Ficha Caravana: <strong>${escapeHtml(state.selectedCaravana)}</strong></span>
          </button>
        ` : ''}
        <button type="button" class="bovine-nav-tab ${subTab === 'potreros' ? 'active' : ''}" data-bovine-tab="potreros">
          <span>🌿 Potreros y Lotes</span>
          <span class="tab-badge">${POTREROS.length}</span>
        </button>
        <button type="button" class="bovine-nav-tab ${subTab === 'reproduccion' ? 'active' : ''}" data-bovine-tab="reproduccion">
          <span>🧬 Rodeo de Cría</span>
          <span class="tab-badge">${kpis.preñezPct}%</span>
        </button>
        <button type="button" class="bovine-nav-tab ${subTab === 'sanidad' ? 'active' : ''}" data-bovine-tab="sanidad">
          <span>💉 Sanidad y SENASA</span>
        </button>
        <button type="button" class="bovine-nav-tab ${subTab === 'indicadores' ? 'active' : ''}" data-bovine-tab="indicadores">
          <span>📊 Indicadores y Pesajes</span>
        </button>
      </div>
    `;

    let contentHtml = '';
    if (subTab === 'caravanas') {
      contentHtml = renderCaravanasView(bovines, kpis);
    } else if (subTab === 'ficha') {
      const bovine = getBovineByCaravana(state.selectedCaravana, db);
      if (bovine) {
        contentHtml = renderFichaIndividual(bovine);
      } else {
        contentHtml = `<div class="surface" style="padding:30px; text-align:center"><p class="muted">Seleccione una caravana de la tabla para ver su ficha técnica individual.</p><button type="button" class="btn primary" data-bovine-tab="caravanas">Ir a Caravanas</button></div>`;
      }
    } else if (subTab === 'potreros') {
      contentHtml = renderPotrerosView(bovines, kpis);
    } else if (subTab === 'reproduccion') {
      contentHtml = renderReproduccionView(bovines, kpis);
    } else if (subTab === 'sanidad') {
      contentHtml = renderSanidadView(bovines);
    } else if (subTab === 'indicadores') {
      contentHtml = renderIndicadoresView(bovines, kpis);
    }

    return `
      <div class="bovines-module-wrapper">
        <!-- Encabezado General del Módulo Bovino -->
        <div class="bovines-header-panel">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.5rem">🐂</span>
              <h2 style="margin:0; font-size:1.35rem; color:#123F32; font-weight:800;">Ganadería Bovina · Manejo por Caravana Individual</h2>
              <span class="weather-online-badge live">Trazabilidad Activa</span>
            </div>
            <p class="muted" style="margin:4px 0 0; font-size:0.85rem">Gestión zootécnica de precisión por animal individual · Potreros y lotes como agrupación física secundaria.</p>
          </div>

          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
            <button type="button" class="btn primary" data-bovine-action="new-bovine" title="Alta de un nuevo animal con caravana única">
              + Alta de Bovino
            </button>
            <button type="button" class="btn secondary" data-bovine-action="open-bulk-modal" title="Acción masiva sobre múltiples animales">
              ⚙️ Acciones Grupales
            </button>
          </div>
        </div>

        ${navTabsHtml}

        <div id="bovinesViewContainer">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  /**
   * Pestaña 1: Explorador de Caravanas Individuales (Tabla principal y filtros)
   */
  function renderCaravanasView(bovines, kpis) {
    const f = state.filters;
    let filtered = bovines.filter(b => {
      if (f.status !== 'todos' && (b.estado || 'Activo').toLowerCase() !== f.status.toLowerCase()) return false;
      if (f.category !== 'todas' && b.categoria !== f.category) return false;
      if (f.potrero !== 'todos' && b.potrero !== f.potrero) return false;
      if (f.sex !== 'todos' && b.sexo !== f.sex) return false;
      if (f.search) {
        const q = f.search.toLowerCase().trim();
        const str = `${b.caravana} ${b.categoria} ${b.raza} ${b.potrero} ${b.notas || ''} ${b.madreCaravana || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    const categoryOptions = CATEGORIES.map(c => `
      <option value="${c}" ${f.category === c ? 'selected' : ''}>${c}</option>
    `).join('');

    const potreroOptions = POTREROS.map(p => `
      <option value="${p.name}" ${f.potrero === p.name ? 'selected' : ''}>${p.name}</option>
    `).join('');

    const selectedCount = state.selectedIds.size;

    return `
      <div>
        <!-- Mini KPIs de Stock por Caravana -->
        <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); margin-bottom:16px;">
          <article class="metric">
            <p>Rodeo Bovino Total</p>
            <strong style="color:#123F32">${kpis.totalHeads} cab</strong>
            <small>Animales con caravana activa</small>
          </article>
          <article class="metric">
            <p>Peso Promedio en Pie</p>
            <strong style="color:#087FBD">${kpis.avgWeight} kg/cab</strong>
            <small>Kilos totales: ${formatNumber(kpis.totalWeight, 0)} kg</small>
          </article>
          <article class="metric">
            <p>GDPV Ponderada</p>
            <strong style="color:#166534">${kpis.avgGdpv > 0 ? '+' + formatNumber(kpis.avgGdpv, 2) + ' kg/d' : 'Sin pesajes'}</strong>
            <small>Ganancia diaria en recría y engorde</small>
          </article>
          <article class="metric">
            <p>Vientres en Producción</p>
            <strong style="color:#9333ea">${kpis.vientresCount} cab</strong>
            <small>${kpis.preñezPct}% de preñez al tacto</small>
          </article>
        </div>

        <!-- Barra de Filtros y Búsqueda -->
        <div class="surface" style="padding:14px 18px; margin-bottom:14px; border-radius:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; flex:1">
              <input type="text" id="bovineSearchInput" placeholder="🔍 Buscar por número de caravana, raza, lote..." value="${escapeHtml(f.search)}" style="min-width:240px; padding:7px 12px; font-size:0.86rem; border:1px solid #CBD5E1; border-radius:6px;" />

              <select id="bovineCategoryFilter" style="padding:7px 10px; font-size:0.86rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                <option value="todas">Todas las Categorías</option>
                ${categoryOptions}
              </select>

              <select id="bovinePotreroFilter" style="padding:7px 10px; font-size:0.86rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                <option value="todos">Todos los Potreros</option>
                ${potreroOptions}
              </select>

              <select id="bovineSexFilter" style="padding:7px 10px; font-size:0.86rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                <option value="todos" ${f.sex==='todos'?'selected':''}>Todos los Sexos</option>
                <option value="Macho" ${f.sex==='Macho'?'selected':''}>Machos</option>
                <option value="Hembra" ${f.sex==='Hembra'?'selected':''}>Hembras</option>
              </select>

              <select id="bovineStatusFilter" style="padding:7px 10px; font-size:0.86rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                <option value="activo" ${f.status==='activo'?'selected':''}>Solo Activos</option>
                <option value="todos" ${f.status==='todos'?'selected':''}>Todos los Estados</option>
                <option value="vendido" ${f.status==='vendido'?'selected':''}>Vendidos</option>
                <option value="faenado" ${f.status==='faenado'?'selected':''}>Faenados</option>
                <option value="baja" ${f.status==='baja'?'selected':''}>Bajas</option>
              </select>
            </div>

            <div>
              <button type="button" class="btn ghost btn-sm" data-bovine-action="clear-filters">Limpiar Filtros</button>
            </div>
          </div>
        </div>

        ${selectedCount > 0 ? `
          <div class="bulk-actions-bar">
            <span style="font-size:0.88rem; font-weight:750; color:#123F32">
              ✓ ${selectedCount} animal(es) seleccionado(s)
            </span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn secondary btn-sm" data-bovine-action="bulk-potrero">Mover a Potrero</button>
              <button type="button" class="btn secondary btn-sm" data-bovine-action="bulk-vaccine">Vacunación Masiva</button>
              <button type="button" class="btn secondary btn-sm" data-bovine-action="bulk-weighing">Pesaje Grupal</button>
              <button type="button" class="btn ghost btn-sm" data-bovine-action="bulk-clear">Deseleccionar</button>
            </div>
          </div>
        ` : ''}

        <!-- Tabla de Caravanas -->
        <div class="surface" style="padding:0; overflow:hidden; border-radius:10px;">
          <div class="surface-title" style="padding:14px 18px; border-bottom:1px solid #E2E8F0;">
            <h4>Registro Individual de Bovinos (${filtered.length} animales)</h4>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn ghost btn-sm" data-bovine-action="export-csv">Exportar CSV</button>
            </div>
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style="width:36px; text-align:center;">
                    <input type="checkbox" id="bovineSelectAll" ${selectedCount > 0 && selectedCount === filtered.length ? 'checked' : ''} />
                  </th>
                  <th>Caravana</th>
                  <th>Categoría</th>
                  <th>Raza & Pelaje</th>
                  <th>Sexo</th>
                  <th>Potrero Actual</th>
                  <th>Peso (kg)</th>
                  <th>GDPV (kg/d)</th>
                  <th>Estado</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length > 0 ? filtered.map(b => {
                  const isChecked = state.selectedIds.has(b.id);
                  const statusClass = (b.estado || 'activo').toLowerCase();
                  return `
                    <tr style="${isChecked ? 'background:#f0fdf4;' : ''}">
                      <td style="text-align:center;">
                        <input type="checkbox" class="bovine-row-check" data-id="${escapeHtml(b.id)}" ${isChecked ? 'checked' : ''} />
                      </td>
                      <td>
                        <button type="button" class="bovine-ear-tag-badge" data-bovine-open-ficha="${escapeHtml(b.caravana)}" style="cursor:pointer; border:none; padding:4px 10px; font-size:0.92rem; text-decoration:none;" title="Ver Ficha Técnica">
                          🏷️ ${escapeHtml(b.caravana)}
                        </button>
                      </td>
                      <td><strong>${escapeHtml(b.categoria)}</strong></td>
                      <td>
                        <div style="font-size:0.86rem; font-weight:600">${escapeHtml(b.raza)}</div>
                        <small class="muted">${escapeHtml(b.pelaje || '')}</small>
                      </td>
                      <td><span class="badge ${b.sexo === 'Hembra' ? 'neutral' : 'info'}">${escapeHtml(b.sexo)}</span></td>
                      <td>
                        <span style="font-size:0.84rem; font-weight:650; color:#123F32;">${escapeHtml(b.potrero)}</span>
                      </td>
                      <td><strong style="color:#087FBD">${formatNumber(b.pesoActual, 0)} kg</strong></td>
                      <td>
                        ${b.gdpv ? `
                          <span class="gdpv-indicator ${b.gdpv < 0 ? 'negative' : ''}">
                            ${b.gdpv > 0 ? '▲ +' : '▼ '}${formatNumber(b.gdpv, 2)}
                          </span>
                        ` : '<span class="muted">-</span>'}
                      </td>
                      <td><span class="bovine-status-badge ${statusClass}">${escapeHtml(b.estado || 'Activo')}</span></td>
                      <td style="text-align:right">
                        <div class="record-tools" style="justify-content:flex-end">
                          <button type="button" class="btn secondary btn-sm" data-bovine-open-ficha="${escapeHtml(b.caravana)}" title="Ver Ficha Individual">Ficha</button>
                          <button type="button" class="tool" data-bovine-action="edit-bovine" data-id="${escapeHtml(b.id)}" title="Editar">${typeof icon === 'function' ? icon('pencil') : '✏️'}</button>
                          <button type="button" class="tool danger" data-bovine-action="delete-bovine" data-id="${escapeHtml(b.id)}" title="Baja">${typeof icon === 'function' ? icon('trash-2') : '🗑️'}</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="10" style="text-align:center; padding:32px; color:#64748B;">No se encontraron bovinos que coincidan con los filtros seleccionados.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Pestaña 2: Ficha Técnica Individual Completa (Con 6 Subpestañas)
   */
  function renderFichaIndividual(bovine) {
    const innerTab = state.fichaInnerTab;
    const pesajes = (bovine.historialPesajes || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const sanidad = (bovine.historialSanidad || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const repro = (bovine.historialReproduccion || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const movs = (bovine.historialMovimientos || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));

    // Calcular edad en meses
    let edadStr = '-';
    if (bovine.fechaNacimiento) {
      const birth = new Date(bovine.fechaNacimiento + 'T00:00:00Z');
      const now = new Date('2026-11-04T00:00:00Z');
      const months = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30.4375));
      edadStr = `${months} meses (${(months / 12).toFixed(1)} años)`;
    }

    return `
      <div>
        <!-- Hero Card de la Ficha Individual -->
        <div class="bovine-ficha-hero">
          <div class="bovine-ficha-caravan-block">
            <div class="bovine-ear-tag-badge">
              🏷️ ${escapeHtml(bovine.caravana)}
            </div>
            <div class="bovine-ficha-title-block">
              <h2>${escapeHtml(bovine.categoria)} · ${escapeHtml(bovine.raza)}</h2>
              <p>Potrero Actual: <strong>${escapeHtml(bovine.potrero)}</strong> · Sexo: <strong>${escapeHtml(bovine.sexo)}</strong></p>
            </div>
          </div>

          <div class="bovine-ficha-stats-strip">
            <div class="bovine-ficha-stat-item">
              <span class="stat-lbl">Peso Actual</span>
              <span class="stat-val">${formatNumber(bovine.pesoActual, 0)} kg</span>
            </div>
            <div class="bovine-ficha-stat-item">
              <span class="stat-lbl">Ganancia Diaria (GDPV)</span>
              <span class="stat-val" style="color:#a7f3d0">${bovine.gdpv ? '+' + formatNumber(bovine.gdpv, 2) + ' kg/d' : '-'}</span>
            </div>
            <div class="bovine-ficha-stat-item">
              <span class="stat-lbl">Estado</span>
              <span class="bovine-status-badge activo">${escapeHtml(bovine.estado || 'Activo')}</span>
            </div>
            <button type="button" class="btn secondary" data-bovine-tab="caravanas" style="background:rgba(255,255,255,0.15); color:#fff; border-color:rgba(255,255,255,0.3)">
              ← Volver al Listado
            </button>
          </div>
        </div>

        <!-- Barra de Subpestañas de la Ficha -->
        <div class="surface" style="padding:16px 20px; border-radius:10px;">
          <div class="ficha-sub-tabs">
            <button type="button" class="ficha-sub-tab ${innerTab === 'identificacion' ? 'active' : ''}" data-ficha-subtab="identificacion">
              📋 Identificación y Origen
            </button>
            <button type="button" class="ficha-sub-tab ${innerTab === 'sanidad' ? 'active' : ''}" data-ficha-subtab="sanidad">
              💉 Sanidad y Carencias (${sanidad.length})
            </button>
            <button type="button" class="ficha-sub-tab ${innerTab === 'reproduccion' ? 'active' : ''}" data-ficha-subtab="reproduccion">
              🧬 Reproducción y Crías (${repro.length})
            </button>
            <button type="button" class="ficha-sub-tab ${innerTab === 'pesajes' ? 'active' : ''}" data-ficha-subtab="pesajes">
              ⚖️ Pesajes y Curva GDPV (${pesajes.length})
            </button>
            <button type="button" class="ficha-sub-tab ${innerTab === 'movimientos' ? 'active' : ''}" data-ficha-subtab="movimientos">
              🔄 Movimientos de Potrero (${movs.length})
            </button>
            <button type="button" class="ficha-sub-tab ${innerTab === 'cronologia' ? 'active' : ''}" data-ficha-subtab="cronologia">
              ⏱️ Cronología Completa
            </button>
          </div>

          <!-- CONTENIDO DE CADA SUBPESTAÑA DE LA FICHA -->
          <div class="ficha-sub-content" style="margin-top:14px;">
            ${renderFichaInnerTabContent(bovine, innerTab, { edadStr, pesajes, sanidad, repro, movs })}
          </div>
        </div>
      </div>
    `;
  }

  function renderFichaInnerTabContent(bovine, innerTab, data) {
    if (innerTab === 'identificacion') {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h4 style="margin:0; font-size:1.05rem; color:#123F32">Datos Generales y Trazabilidad</h4>
            <button type="button" class="btn secondary btn-sm" data-bovine-action="edit-bovine" data-id="${escapeHtml(bovine.id)}">Editar Ficha</button>
          </div>

          <div class="bovine-id-grid">
            <div class="bovine-id-field">
              <label>Número de Caravana Oficial</label>
              <span>🏷️ ${escapeHtml(bovine.caravana)}</span>
            </div>
            <div class="bovine-id-field">
              <label>Categoría Zootécnica</label>
              <span>${escapeHtml(bovine.categoria)}</span>
            </div>
            <div class="bovine-id-field">
              <label>Raza</label>
              <span>${escapeHtml(bovine.raza)}</span>
            </div>
            <div class="bovine-id-field">
              <label>Sexo</label>
              <span>${escapeHtml(bovine.sexo)}</span>
            </div>
            <div class="bovine-id-field">
              <label>Pelaje / Señal</label>
              <span>${escapeHtml(bovine.pelaje || 'No especificado')}</span>
            </div>
            <div class="bovine-id-field">
              <label>Fecha de Nacimiento</label>
              <span>${escapeHtml(bovine.fechaNacimiento || '-')}</span>
            </div>
            <div class="bovine-id-field">
              <label>Edad Estimada</label>
              <span>${data.edadStr}</span>
            </div>
            <div class="bovine-id-field">
              <label>Potrero / Ubicación Actual</label>
              <span>🌿 ${escapeHtml(bovine.potrero)}</span>
            </div>
            <div class="bovine-id-field">
              <label>Origen del Animal</label>
              <span>${escapeHtml(bovine.origen || 'Propio')}</span>
            </div>
            <div class="bovine-id-field">
              <label>Caravana de la Madre (Pedigree)</label>
              <span>${bovine.madreCaravana ? `<button type="button" class="btn ghost btn-sm" data-bovine-open-ficha="${escapeHtml(bovine.madreCaravana)}">🏷️ ${escapeHtml(bovine.madreCaravana)}</button>` : 'Desconocida'}</span>
            </div>
            <div class="bovine-id-field">
              <label>Caravana del Padre (Toro / Pajuela)</label>
              <span>${bovine.padreCaravana ? `<button type="button" class="btn ghost btn-sm" data-bovine-open-ficha="${escapeHtml(bovine.padreCaravana)}">🏷️ ${escapeHtml(bovine.padreCaravana)}</button>` : 'Desconocido'}</span>
            </div>
            <div class="bovine-id-field">
              <label>Lote Contable Vinculado</label>
              <span>${escapeHtml(bovine.lotId || 'General')}</span>
            </div>
          </div>

          ${bovine.notas ? `
            <div style="margin-top:16px; padding:12px 14px; background:#f8fafc; border-left:4px solid #123F32; border-radius:4px;">
              <strong style="font-size:0.85rem; color:#334155;">Observaciones Zootécnicas:</strong>
              <p style="margin:4px 0 0; font-size:0.88rem; color:#475569;">${escapeHtml(bovine.notas)}</p>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (innerTab === 'sanidad') {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="margin:0; font-size:1.05rem; color:#123F32">Plan Sanitario, Vacunación Oficial SENASA y Tratamientos</h4>
              <p class="muted" style="margin:2px 0 0; font-size:0.82rem">Registro auditable de vacunas, desparasitaciones y períodos de carencia para faena/consumo.</p>
            </div>
            <button type="button" class="btn primary btn-sm" data-bovine-action="new-treatment" data-caravana="${escapeHtml(bovine.caravana)}">
              + Registrar Tratamiento / Vacuna
            </button>
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo de Evento</th>
                  <th>Producto / Vacuna</th>
                  <th>Dosis / Vía</th>
                  <th>Lote Vacuna</th>
                  <th>Veterinario Responsable</th>
                  <th>Carencia (Días)</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${data.sanidad.length > 0 ? data.sanidad.map(s => `
                  <tr>
                    <td><strong>${escapeHtml(s.date)}</strong></td>
                    <td><span class="badge info">${escapeHtml(s.type)}</span></td>
                    <td><strong>${escapeHtml(s.product)}</strong></td>
                    <td>${escapeHtml(s.dose || '-')}</td>
                    <td><small class="muted">${escapeHtml(s.batch || '-')}</small></td>
                    <td>${escapeHtml(s.vet || '-')}</td>
                    <td>
                      ${Number(s.withdrawalDays) > 0 ? `
                        <span class="badge warning">${s.withdrawalDays} días</span>
                      ` : '<span class="badge positive">0 días (Sin retiro)</span>'}
                    </td>
                    <td><small>${escapeHtml(s.note || '-')}</small></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="8" style="text-align:center; padding:24px; color:#64748B;">No hay tratamientos sanitarios registrados para este animal.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (innerTab === 'reproduccion') {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="margin:0; font-size:1.05rem; color:#123F32">Historial Reproductivo, Tactos, Partos y Crías</h4>
              <p class="muted" style="margin:2px 0 0; font-size:0.82rem">Trazabilidad genealógica y diagnósticos de preñez.</p>
            </div>
            <button type="button" class="btn primary btn-sm" data-bovine-action="new-repro" data-caravana="${escapeHtml(bovine.caravana)}">
              + Registrar Evento Reproductivo
            </button>
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Método / Tipo</th>
                  <th>Toro / Semen</th>
                  <th>Resultado / Diagnóstico</th>
                  <th>Fecha Est. Parto</th>
                  <th>Caravana Cría Nacida</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${data.repro.length > 0 ? data.repro.map(r => `
                  <tr>
                    <td><strong>${escapeHtml(r.date)}</strong></td>
                    <td><span class="badge ${r.event.toLowerCase().includes('parto') ? 'positive' : 'info'}">${escapeHtml(r.event)}</span></td>
                    <td>${escapeHtml(r.serviceType || '-')}</td>
                    <td><strong>${escapeHtml(r.bullCaravana || '-')}</strong></td>
                    <td><span style="font-weight:750; color:#123F32">${escapeHtml(r.result || '-')}</span></td>
                    <td>${escapeHtml(r.estimatedBirthDate || '-')}</td>
                    <td>
                      ${r.calfCaravana ? `
                        <button type="button" class="btn ghost btn-sm" data-bovine-open-ficha="${escapeHtml(r.calfCaravana)}">
                          🏷️ ${escapeHtml(r.calfCaravana)}
                        </button>
                      ` : '-'}
                    </td>
                    <td><small>${escapeHtml(r.note || '-')}</small></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="8" style="text-align:center; padding:24px; color:#64748B;">No hay eventos reproductivos cargados para esta caravana.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (innerTab === 'pesajes') {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="margin:0; font-size:1.05rem; color:#123F32">Curva de Crecimiento y Ganancia Diaria de Peso Vivo (GDPV)</h4>
              <p class="muted" style="margin:2px 0 0; font-size:0.82rem">Evolución de peso real e índices zootécnicos entre pesadas sucesivas.</p>
            </div>
            <button type="button" class="btn primary btn-sm" data-bovine-action="new-weighing" data-caravana="${escapeHtml(bovine.caravana)}">
              + Registrar Nueva Pesada
            </button>
          </div>

          <!-- Gráfico SVG Evolutivo -->
          <div class="surface" style="padding:16px; margin-bottom:18px; border-radius:8px;">
            ${renderWeightCurveSvg(bovine.historialPesajes)}
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha de Pesaje</th>
                  <th>Peso Registrado (kg)</th>
                  <th>Días entre Pesadas</th>
                  <th>Ganancia Total (kg)</th>
                  <th>Ganancia Diaria (GDPV)</th>
                  <th>Observaciones / Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${data.pesajes.length > 0 ? data.pesajes.map((p, idx) => {
                  return `
                    <tr>
                      <td><strong>${escapeHtml(p.date)}</strong></td>
                      <td><span style="font-size:1.05rem; font-weight:800; color:#087FBD">${p.weight} kg</span></td>
                      <td>${p.days ? p.days + ' días' : '-'}</td>
                      <td>${p.days && p.gdpvKg ? (p.gdpvKg * p.days).toFixed(1) + ' kg' : '-'}</td>
                      <td>
                        ${p.gdpvKg ? `
                          <span class="gdpv-indicator ${p.gdpvKg < 0 ? 'negative' : ''}">
                            ${p.gdpvKg > 0 ? '▲ +' : '▼ '}${formatGdpv(p.gdpvKg)}
                          </span>
                        ` : '<small class="muted">Primer pesaje base</small>'}
                      </td>
                      <td><small>${escapeHtml(p.note || '-')}</small></td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="6" style="text-align:center; padding:24px; color:#64748B;">No hay pesajes registrados todavía.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (innerTab === 'movimientos') {
      return `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="margin:0; font-size:1.05rem; color:#123F32">Rotación de Potreros y Trazabilidad de Ubicación</h4>
              <p class="muted" style="margin:2px 0 0; font-size:0.82rem">Historial de traslados entre potreros, corrales y sectores del campo.</p>
            </div>
            <button type="button" class="btn primary btn-sm" data-bovine-action="new-movement" data-caravana="${escapeHtml(bovine.caravana)}">
              + Mover de Potrero
            </button>
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Potrero Origen</th>
                  <th>Potrero Destino</th>
                  <th>Motivo del Traslado</th>
                  <th>Operador / Usuario</th>
                </tr>
              </thead>
              <tbody>
                ${data.movs.length > 0 ? data.movs.map(m => `
                  <tr>
                    <td><strong>${escapeHtml(m.date)}</strong></td>
                    <td>${escapeHtml(m.fromPotrero)}</td>
                    <td><strong>🌿 ${escapeHtml(m.toPotrero)}</strong></td>
                    <td>${escapeHtml(m.reason || 'Rotación de pastura')}</td>
                    <td><small class="muted">${escapeHtml(m.user || 'Admin')}</small></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="5" style="text-align:center; padding:24px; color:#64748B;">No hay movimientos de potrero registrados. El animal permanece en su potrero inicial.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (innerTab === 'cronologia') {
      // Unificar todos los eventos en un timeline
      const timeline = [];
      if (bovine.fechaNacimiento) {
        timeline.push({ date: bovine.fechaNacimiento, type: 'Nacimiento', desc: `Nacimiento en establecimiento (${bovine.pelaje || ''})`, icon: '🌟' });
      }
      (bovine.historialPesajes || []).forEach(p => {
        timeline.push({ date: p.date, type: 'Pesaje', desc: `Pesaje: ${p.weight} kg (${p.note || 'Control'})`, icon: '⚖️' });
      });
      (bovine.historialSanidad || []).forEach(s => {
        timeline.push({ date: s.date, type: 'Sanidad', desc: `${s.type}: ${s.product} (${s.note || ''})`, icon: '💉' });
      });
      (bovine.historialReproduccion || []).forEach(r => {
        timeline.push({ date: r.date, type: 'Reproducción', desc: `${r.event}: ${r.result} (${r.bullCaravana || ''})`, icon: '🧬' });
      });
      (bovine.historialMovimientos || []).forEach(m => {
        timeline.push({ date: m.date, type: 'Movimiento', desc: `Traslado a ${m.toPotrero} (${m.reason || ''})`, icon: '🌿' });
      });

      timeline.sort((a,b) => (b.date||'').localeCompare(a.date||''));

      return `
        <div>
          <h4 style="margin:0 0 14px; font-size:1.05rem; color:#123F32">Línea de Vida Cronológica del Animal</h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${timeline.map(t => `
              <div style="display:flex; align-items:flex-start; gap:12px; padding:10px 14px; background:#f8fafc; border-left:4px solid #123F32; border-radius:6px;">
                <span style="font-size:1.2rem; line-height:1">${t.icon}</span>
                <div style="flex:1">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#123F32; font-size:0.90rem;">${escapeHtml(t.type)}</strong>
                    <span style="font-size:0.80rem; color:#64748B; font-weight:700;">${escapeHtml(t.date)}</span>
                  </div>
                  <p style="margin:3px 0 0; font-size:0.84rem; color:#475569;">${escapeHtml(t.desc)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return '';
  }

  /**
   * Pestaña 3: Potreros y Lotes (Agrupación física secundaria)
   */
  function renderPotrerosView(bovines, kpis) {
    const potreroStats = POTREROS.map(p => {
      const animalsInPotrero = bovines.filter(b => b.estado === 'Activo' && b.potrero === p.name);
      const heads = animalsInPotrero.length;
      const totalKg = animalsInPotrero.reduce((acc, b) => acc + (Number(b.pesoActual) || 0), 0);
      const avgKg = heads > 0 ? Math.round(totalKg / heads) : 0;
      const stockingDensity = heads > 0 ? (heads / p.surfaceHa).toFixed(2) : '0,00';
      // Equivalente vaca: 1 EV = 400 kg
      const totalEV = (totalKg / 400).toFixed(1);
      const evPerHa = p.surfaceHa > 0 ? (totalKg / 400 / p.surfaceHa).toFixed(2) : '0,00';
      return {
        ...p,
        heads,
        totalKg,
        avgKg,
        stockingDensity,
        totalEV,
        evPerHa,
        animals: animalsInPotrero
      };
    });

    return `
      <div>
        <div class="surface" style="padding:16px 20px; margin-bottom:16px; border-radius:10px;">
          <h3 style="margin:0 0 6px; font-size:1.15rem; color:#123F32;">Distribución Operativa por Potrero y Capacidad Receptiva</h3>
          <p class="muted" style="margin:0; font-size:0.85rem">Los potreros y piquetes agrupan físicamente a las caravanas individuales para la gestión forrajera y rotación pastoril.</p>
        </div>

        <div class="potrero-card-grid">
          ${potreroStats.map(p => `
            <article class="potrero-card">
              <div>
                <div class="potrero-card-head">
                  <h4>🌿 ${escapeHtml(p.name)}</h4>
                  <span class="badge ${p.heads > 0 ? 'positive' : 'neutral'}">${p.heads} cabezas</span>
                </div>
                <p class="muted" style="margin:4px 0 10px; font-size:0.82rem">${escapeHtml(p.forageType)} · <strong>${p.surfaceHa} ha</strong></p>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; font-size:0.84rem;">
                  <div style="background:#f8fafc; padding:6px 10px; border-radius:6px;">
                    <span class="muted" style="font-size:0.72rem; display:block">Carga Animal</span>
                    <strong>${p.stockingDensity} cab/ha</strong>
                  </div>
                  <div style="background:#f8fafc; padding:6px 10px; border-radius:6px;">
                    <span class="muted" style="font-size:0.72rem; display:block">Carga en EV</span>
                    <strong>${p.evPerHa} EV/ha</strong>
                  </div>
                </div>

                <div style="font-size:0.84rem; color:#475569;">
                  Kilos en potrero: <strong>${formatNumber(p.totalKg, 0)} kg</strong> (Prom. ${p.avgKg} kg)
                </div>
              </div>

              <div style="border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <button type="button" class="btn ghost btn-sm" data-bovine-filter-potrero="${escapeHtml(p.name)}">
                  Ver animales (${p.heads})
                </button>
                <button type="button" class="btn secondary btn-sm" data-bovine-action="move-potrero" data-potrero="${escapeHtml(p.name)}">
                  Trasladar aquí
                </button>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Pestaña 4: Rodeo de Cría (Reproducción general)
   */
  function renderReproduccionView(bovines, kpis) {
    const vientres = bovines.filter(b => b.estado === 'Activo' && ['Vaca de Cría', 'Vaquillona'].includes(b.categoria));
    const toros = bovines.filter(b => b.estado === 'Activo' && b.categoria === 'Toro');
    const terneros = bovines.filter(b => b.estado === 'Activo' && ['Ternero', 'Ternera'].includes(b.categoria));

    return `
      <div>
        <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); margin-bottom:18px;">
          <article class="metric">
            <p>Vientres Totales</p>
            <strong style="color:#123F32">${vientres.length} cab</strong>
            <small>Vacas y vaquillonas entoradas</small>
          </article>
          <article class="metric">
            <p>Porcentaje de Preñez</p>
            <strong style="color:#166534">${kpis.preñezPct}%</strong>
            <small>Confirmado al tacto rectal</small>
          </article>
          <article class="metric">
            <p>Toros en Servicio</p>
            <strong style="color:#087FBD">${toros.length} toros</strong>
            <small>Relación: 1 toro cada ${(vientres.length / Math.max(1, toros.length)).toFixed(0)} vientres</small>
          </article>
          <article class="metric">
            <p>Terneros Logrados</p>
            <strong style="color:#9333ea">${terneros.length} cab</strong>
            <small>Crías vivas al pie</small>
          </article>
        </div>

        <div class="surface" style="padding:18px; margin-bottom:18px; border-radius:10px;">
          <h4 style="margin:0 0 10px; color:#123F32;">Estado del Rodeo de Vientres y Pariciones Programadas</h4>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Caravana</th>
                  <th>Categoría</th>
                  <th>Raza</th>
                  <th>Último Diagnóstico</th>
                  <th>Toro Asignado</th>
                  <th>Fecha Probable Parto</th>
                  <th>Cría al Pie</th>
                  <th style="text-align:right">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${vientres.map(v => {
                  const reproEvents = v.historialReproduccion || [];
                  const last = reproEvents[reproEvents.length - 1];
                  return `
                    <tr>
                      <td>
                        <button type="button" class="bovine-ear-tag-badge" data-bovine-open-ficha="${escapeHtml(v.caravana)}" style="padding:3px 8px; font-size:0.86rem; border:none; cursor:pointer">
                          🏷️ ${escapeHtml(v.caravana)}
                        </button>
                      </td>
                      <td>${escapeHtml(v.categoria)}</td>
                      <td>${escapeHtml(v.raza)}</td>
                      <td>
                        <span class="badge ${last?.result?.toLowerCase().includes('preñada') ? 'positive' : 'neutral'}">
                          ${escapeHtml(last?.result || 'En servicio')}
                        </span>
                      </td>
                      <td>${escapeHtml(last?.bullCaravana || 'TORO-01')}</td>
                      <td>${escapeHtml(last?.estimatedBirthDate || '-')}</td>
                      <td>
                        ${last?.calfCaravana ? `
                          <button type="button" class="btn ghost btn-sm" data-bovine-open-ficha="${escapeHtml(last.calfCaravana)}">
                            🏷️ ${escapeHtml(last.calfCaravana)}
                          </button>
                        ` : '-'}
                      </td>
                      <td style="text-align:right">
                        <button type="button" class="btn secondary btn-sm" data-bovine-action="new-repro" data-caravana="${escapeHtml(v.caravana)}">+ Diagnóstico</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Pestaña 5: Sanidad y SENASA
   */
  function renderSanidadView(bovines) {
    return `
      <div>
        <div class="surface" style="padding:18px; margin-bottom:18px; border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="margin:0 0 4px; color:#123F32; font-size:1.15rem;">Calendario Sanitario Oficial SENASA y Trazabilidad</h3>
              <p class="muted" style="margin:0; font-size:0.84rem">Cumplimiento del Plan Nacional de Control y Erradicación de Fiebre Aftosa y Brucelosis Bovina.</p>
            </div>
            <button type="button" class="btn primary" data-bovine-action="bulk-vaccine">
              + Aplicar Vacunación Masiva al Rodeo
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; margin-bottom:18px;">
          <div class="weather-alert-card success">
            <div class="weather-alert-icon">🛡️</div>
            <div class="weather-alert-content">
              <strong>1ª Campaña Antiaftosa 2026: Cumplida</strong>
              <p>Totalidad de categorías menores y rodeo vacunado con Bivalente Oficial SENASA. Acta oficial radicada.</p>
            </div>
          </div>
          <div class="weather-alert-card success">
            <div class="weather-alert-icon">✓</div>
            <div class="weather-alert-content">
              <strong>Brucelosis Bovina (Cepa 19): Al Día</strong>
              <p>Terneras entre 3 y 8 meses inmunizadas e identificadas con muesca oficial según normativa.</p>
            </div>
          </div>
          <div class="weather-alert-card warning">
            <div class="weather-alert-icon">⏰</div>
            <div class="weather-alert-content">
              <strong>Control de Carencias para Faena</strong>
              <p>Todos los novillos en corral de terminación se encuentran libres de días de retiro medicinal.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Pestaña 6: Indicadores & Pesajes
   */
  function renderIndicadoresView(bovines, kpis) {
    return `
      <div>
        <div class="surface" style="padding:18px; margin-bottom:18px; border-radius:10px;">
          <h3 style="margin:0 0 6px; color:#123F32; font-size:1.15rem;">Indicadores Zootécnicos y Productivos del Rodeo</h3>
          <p class="muted" style="margin:0; font-size:0.84rem">Métricas calculadas dinámicamente desde el historial de pesajes y caravanas individuales.</p>
        </div>

        <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); margin-bottom:18px;">
          <article class="metric" data-kpi-interactive="true" data-kpi-key="bov_heads">
            <p>Cabezas Activas</p>
            <strong style="color:#123F32">${kpis.totalHeads} cab</strong>
            <small>Censo individual por caravana</small>
          </article>
          <article class="metric" data-kpi-interactive="true" data-kpi-key="bov_weight">
            <p>Peso Medio del Rodeo</p>
            <strong style="color:#087FBD">${kpis.avgWeight} kg</strong>
            <small>Evolución según pesadas en balanza</small>
          </article>
          <article class="metric" data-kpi-interactive="true" data-kpi-key="bov_gdpv">
            <p>GDPV Ponderada</p>
            <strong style="color:#166534">+${formatNumber(kpis.avgGdpv, 2)} kg/d</strong>
            <small>Ritmo de engorde y recría</small>
          </article>
          <article class="metric" data-kpi-interactive="true" data-kpi-key="bov_preg">
            <p>Eficiencia Reproductiva</p>
            <strong style="color:#9333ea">${kpis.preñezPct}%</strong>
            <small>Porcentaje preñez al destete</small>
          </article>
        </div>
      </div>
    `;
  }

  /**
   * Modal de Alta o Edición de Bovino
   */
  function openBovineModal(bovineId = null) {
    const dialog = document.getElementById('bovineDialog');
    if (!dialog) return;
    const db = typeof window !== 'undefined' ? window.db : null;
    const existing = bovineId ? getBovines(db).find(b => b.id === bovineId) : null;

    const categoryOptions = CATEGORIES.map(c => `
      <option value="${c}" ${existing?.categoria === c ? 'selected' : ''}>${c}</option>
    `).join('');

    const breedOptions = BREEDS.map(r => `
      <option value="${r}" ${existing?.raza === r ? 'selected' : ''}>${r}</option>
    `).join('');

    const potreroOptions = POTREROS.map(p => `
      <option value="${p.name}" ${existing?.potrero === p.name ? 'selected' : ''}>${p.name}</option>
    `).join('');

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:640px; padding:0; overflow:hidden">
        <div class="dialog-head" style="background:#123F32; color:#ffffff; padding:18px 24px">
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:#ffffff">${existing ? 'Editar Bovino' : 'Alta de Nuevo Bovino por Caravana'}</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#a7f3d0">Entre Surcos · Identificación individual zootécnica</p>
          </div>
          <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" onclick="document.getElementById('bovineDialog').close()" aria-label="Cerrar">×</button>
        </div>

        <form id="bovineForm" style="padding:20px 24px; display:flex; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Número de Caravana (*):</label>
              <input type="text" id="bovCaravanaInput" value="${escapeHtml(existing?.caravana || '')}" placeholder="Ej: AR-0145, TORO-03, 0180" required style="width:100%; padding:8px 12px; font-size:0.95rem; font-weight:800; border:1px solid #CBD5E1; border-radius:6px; font-family:monospace; color:#123F32; text-transform:uppercase" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Categoría (*):</label>
              <select id="bovCatSelect" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                ${categoryOptions}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Raza (*):</label>
              <select id="bovBreedSelect" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                ${breedOptions}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Sexo (*):</label>
              <select id="bovSexSelect" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                <option value="Macho" ${existing?.sexo === 'Macho' ? 'selected' : ''}>Macho</option>
                <option value="Hembra" ${existing?.sexo === 'Hembra' ? 'selected' : ''}>Hembra</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Potrero / Ubicación (*):</label>
              <select id="bovPotreroSelect" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
                ${potreroOptions}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Peso Inicial / Actual (kg) (*):</label>
              <input type="number" step="0.5" min="20" max="1500" id="bovWeightInput" value="${existing?.pesoActual || ''}" placeholder="Ej: 320" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; font-weight:750; color:#087FBD" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha de Nacimiento:</label>
              <input type="date" id="bovBirthInput" value="${existing?.fechaNacimiento || ''}" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Pelaje / Señal:</label>
              <input type="text" id="bovPelajeInput" value="${escapeHtml(existing?.pelaje || '')}" placeholder="Ej: Negro, Colorado, Careta" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Caravana Madre (Opcional):</label>
              <input type="text" id="bovMadreInput" value="${escapeHtml(existing?.madreCaravana || '')}" placeholder="Ej: AR-0101" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Caravana Padre / Toro (Opcional):</label>
              <input type="text" id="bovPadreInput" value="${escapeHtml(existing?.padreCaravana || '')}" placeholder="Ej: TORO-01" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
          </div>

          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Observaciones:</label>
            <input type="text" id="bovNotesInput" value="${escapeHtml(existing?.notas || '')}" placeholder="Ej: Animal de reposición de cabaña, excelente conformación" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost" onclick="document.getElementById('bovineDialog').close()">Cancelar</button>
            <button type="submit" class="btn primary">${existing ? 'Guardar Cambios' : 'Registrar Bovino'}</button>
          </div>
        </form>
      </div>
    `;

    const form = dialog.querySelector('#bovineForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const caravana = dialog.querySelector('#bovCaravanaInput').value.trim().toUpperCase();
      const categoria = dialog.querySelector('#bovCatSelect').value;
      const raza = dialog.querySelector('#bovBreedSelect').value;
      const sexo = dialog.querySelector('#bovSexSelect').value;
      const potrero = dialog.querySelector('#bovPotreroSelect').value;
      const peso = parseFloat(dialog.querySelector('#bovWeightInput').value) || 0;
      const fechaNac = dialog.querySelector('#bovBirthInput').value;
      const pelaje = dialog.querySelector('#bovPelajeInput').value.trim();
      const madre = dialog.querySelector('#bovMadreInput').value.trim().toUpperCase();
      const padre = dialog.querySelector('#bovPadreInput').value.trim().toUpperCase();
      const notas = dialog.querySelector('#bovNotesInput').value.trim();

      const D = window.UNRC;
      const record = {
        id: existing ? existing.id : (D?.uid ? D.uid() : 'bov_' + Date.now()),
        caravana,
        categoria,
        raza,
        sexo,
        potrero,
        pesoActual: peso,
        gdpv: existing?.gdpv || 0,
        fechaNacimiento: fechaNac || null,
        pelaje,
        madreCaravana: madre || null,
        padreCaravana: padre || null,
        notas,
        estado: existing?.estado || 'Activo',
        origen: existing?.origen || 'Propio',
        historialPesajes: existing?.historialPesajes || [
          { id: 'w_' + Date.now(), date: new Date().toISOString().slice(0, 10), weight: peso, days: 0, gdpvKg: 0, gdpvGrams: 0, note: 'Pesaje inicial de alta' }
        ],
        historialSanidad: existing?.historialSanidad || [],
        historialReproduccion: existing?.historialReproduccion || [],
        historialMovimientos: existing?.historialMovimientos || []
      };

      try {
        const next = D.commit(window.db, 'bovines', record);
        if (typeof persist === 'function') {
          await persist(next);
        } else if (typeof UNRCStorage !== 'undefined') {
          await UNRCStorage.save(next);
          window.db = next;
        }
        dialog.close();
        if (typeof toast === 'function') toast(`✓ Bovino caravana "${caravana}" guardado exitosamente.`, 'success');
        if (typeof render === 'function') render();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
        else alert(err.message);
      }
    });

    dialog.showModal();
  }

  /**
   * Modal de Carga de Evento Individual (Pesaje, Sanidad, Reproducción, Movimiento)
   */
  function openBovineEventModal(type, caravana) {
    const dialog = document.getElementById('bovineEventDialog');
    if (!dialog) return;
    const db = typeof window !== 'undefined' ? window.db : null;
    const bovine = getBovineByCaravana(caravana, db);
    if (!bovine) return;

    let formFieldsHtml = '';
    let title = '';

    if (type === 'pesaje') {
      title = `Nuevo Pesaje · Caravana ${bovine.caravana}`;
      formFieldsHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha de Pesaje (*):</label>
            <input type="date" id="evDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Peso en Balanza (kg) (*):</label>
            <input type="number" step="0.5" id="evWeight" placeholder="Último peso: ${bovine.pesoActual} kg" required style="width:100%; padding:8px 12px; font-size:0.95rem; font-weight:800; border:1px solid #CBD5E1; border-radius:6px; color:#087FBD" />
          </div>
        </div>
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Observación / Condición:</label>
          <input type="text" id="evNote" placeholder="Ej: Control de ganancia mensual en pastura" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
        </div>
      `;
    } else if (type === 'sanidad') {
      title = `Tratamiento / Vacunación · Caravana ${bovine.caravana}`;
      formFieldsHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha (*):</label>
            <input type="date" id="evDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Tipo de Evento:</label>
            <select id="evSanityType" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;">
              <option value="Vacunación Oficial">Vacunación Oficial SENASA</option>
              <option value="Vacuna Clostridial">Vacuna Clostridial (Mancha/Carbunclo)</option>
              <option value="Vacuna Reproductiva">Vacuna Reproductiva</option>
              <option value="Desparasitación">Desparasitación Interna/Externa</option>
              <option value="Tratamiento Clínico">Tratamiento Clínico / Antibiótico</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Producto Farmacéutico (*):</label>
            <input type="text" id="evProduct" placeholder="Ej: Bivalente Aftosa, Ivermectina 3.15%" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Dosis / Vía:</label>
            <input type="text" id="evDose" placeholder="Ej: 5 mL Subcutánea" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Días de Carencia (Retiro Faena):</label>
            <input type="number" id="evWithdrawal" value="0" min="0" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Veterinario Responsable:</label>
            <input type="text" id="evVet" value="Dr. M. Benítez (MP 4120)" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
        </div>
      `;
    } else if (type === 'reproduccion') {
      title = `Evento Reproductivo · Caravana ${bovine.caravana}`;
      formFieldsHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha (*):</label>
            <input type="date" id="evDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Tipo de Evento:</label>
            <select id="evReproType" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;">
              <option value="Tacto Rectal">Tacto Rectal (Diagnóstico Preñez)</option>
              <option value="Inseminación Artificial">Inseminación Artificial (I.A.T.F.)</option>
              <option value="Servicio Natural">Servicio Natural con Toro</option>
              <option value="Parto Normal">Parto Normal (Nacimiento)</option>
              <option value="Parto Asistido">Parto Distócico / Asistido</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Resultado / Diagnóstico (*):</label>
            <input type="text" id="evResult" placeholder="Ej: Preñada (60 días), Vacía, Nacimiento Exitoso" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; font-weight:700" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Toro / Semen:</label>
            <input type="text" id="evBull" value="${escapeHtml(bovine.padreCaravana || 'TORO-01')}" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Caravana Cría (si hubo parto):</label>
            <input type="text" id="evCalf" placeholder="Ej: TR-2026-05" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha Estimada Parto:</label>
            <input type="date" id="evEstBirth" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
        </div>
      `;
    } else if (type === 'movimiento') {
      title = `Cambio de Potrero · Caravana ${bovine.caravana}`;
      const potreroOptions = POTREROS.map(p => `
        <option value="${p.name}" ${p.name !== bovine.potrero ? '' : 'disabled'}>${p.name}</option>
      `).join('');
      formFieldsHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha de Traslado (*):</label>
            <input type="date" id="evDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Potrero Origen:</label>
            <input type="text" value="${escapeHtml(bovine.potrero)}" disabled style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#f1f5f9" />
          </div>
        </div>
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Potrero Destino (*):</label>
          <select id="evToPotrero" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#fff">
            ${potreroOptions}
          </select>
        </div>
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Motivo del Traslado:</label>
          <input type="text" id="evReason" value="Rotación pastoril" placeholder="Ej: Rotación forrajera, encierre a corral, preparto" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
        </div>
      `;
    }

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:580px; padding:0; overflow:hidden">
        <div class="dialog-head" style="background:#123F32; color:#ffffff; padding:18px 24px">
          <div>
            <h3 style="margin:0; font-size:1.20rem; color:#ffffff">${title}</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#a7f3d0">Registro individual en el historial de vida del animal</p>
          </div>
          <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" onclick="document.getElementById('bovineEventDialog').close()" aria-label="Cerrar">×</button>
        </div>

        <form id="bovineEventForm" style="padding:20px 24px; display:flex; flex-direction:column; gap:14px;">
          ${formFieldsHtml}

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost" onclick="document.getElementById('bovineEventDialog').close()">Cancelar</button>
            <button type="submit" class="btn primary">Guardar Evento</button>
          </div>
        </form>
      </div>
    `;

    const form = dialog.querySelector('#bovineEventForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateVal = dialog.querySelector('#evDate')?.value;

      if (type === 'pesaje') {
        const weightVal = parseFloat(dialog.querySelector('#evWeight').value);
        const noteVal = dialog.querySelector('#evNote').value.trim();

        // Calcular días y GDPV respecto a la última pesada
        const pesajes = bovine.historialPesajes || [];
        let days = 0;
        let gdpvKg = 0;
        let gdpvGrams = 0;
        if (pesajes.length > 0) {
          const last = pesajes[pesajes.length - 1];
          const d1 = new Date(last.date + 'T00:00:00Z');
          const d2 = new Date(dateVal + 'T00:00:00Z');
          days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
          gdpvKg = Math.round(((weightVal - last.weight) / days) * 100) / 100;
          gdpvGrams = Math.round(gdpvKg * 1000);
        }

        pesajes.push({
          id: 'w_' + Date.now(),
          date: dateVal,
          weight: weightVal,
          days,
          gdpvKg,
          gdpvGrams,
          note: noteVal
        });

        bovine.pesoActual = weightVal;
        bovine.gdpv = gdpvKg;
      } else if (type === 'sanidad') {
        bovine.historialSanidad = bovine.historialSanidad || [];
        bovine.historialSanidad.push({
          id: 's_' + Date.now(),
          date: dateVal,
          type: dialog.querySelector('#evSanityType').value,
          product: dialog.querySelector('#evProduct').value.trim(),
          dose: dialog.querySelector('#evDose').value.trim(),
          withdrawalDays: parseInt(dialog.querySelector('#evWithdrawal').value, 10) || 0,
          vet: dialog.querySelector('#evVet').value.trim(),
          note: ''
        });
      } else if (type === 'reproduccion') {
        bovine.historialReproduccion = bovine.historialReproduccion || [];
        bovine.historialReproduccion.push({
          id: 'r_' + Date.now(),
          date: dateVal,
          event: dialog.querySelector('#evReproType').value,
          result: dialog.querySelector('#evResult').value.trim(),
          bullCaravana: dialog.querySelector('#evBull').value.trim(),
          calfCaravana: dialog.querySelector('#evCalf')?.value.trim() || null,
          estimatedBirthDate: dialog.querySelector('#evEstBirth')?.value || null,
          note: ''
        });
      } else if (type === 'movimiento') {
        const toPot = dialog.querySelector('#evToPotrero').value;
        const reason = dialog.querySelector('#evReason').value.trim();
        bovine.historialMovimientos = bovine.historialMovimientos || [];
        bovine.historialMovimientos.push({
          id: 'm_' + Date.now(),
          date: dateVal,
          fromPotrero: bovine.potrero,
          toPotrero: toPot,
          reason,
          user: 'Admin'
        });
        bovine.potrero = toPot;
      }

      const D = window.UNRC;
      try {
        const next = D.commit(window.db, 'bovines', bovine);
        if (typeof persist === 'function') {
          await persist(next);
        } else if (typeof UNRCStorage !== 'undefined') {
          await UNRCStorage.save(next);
          window.db = next;
        }
        dialog.close();
        if (typeof toast === 'function') toast(`✓ Evento guardado para caravana ${bovine.caravana}`, 'success');
        if (typeof render === 'function') render();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
        else alert(err.message);
      }
    });

    dialog.showModal();
  }

  /**
   * Modal de Acciones Grupales Masivas
   */
  function openBulkActionsModal(actionType = 'potrero') {
    const dialog = document.getElementById('bovineBulkDialog');
    if (!dialog) return;
    const db = typeof window !== 'undefined' ? window.db : null;
    const all = getBovines(db).filter(b => b.estado === 'Activo');

    let selectedBovines = [];
    if (state.selectedIds.size > 0) {
      selectedBovines = all.filter(b => state.selectedIds.has(b.id));
    } else {
      selectedBovines = all; // Si no hay selección manual, aplica sobre todo el rodeo
    }

    const potreroOptions = POTREROS.map(p => `
      <option value="${p.name}">${p.name} (${p.forageType})</option>
    `).join('');

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:560px; padding:0; overflow:hidden">
        <div class="dialog-head" style="background:#123F32; color:#ffffff; padding:18px 24px">
          <div>
            <h3 style="margin:0; font-size:1.20rem; color:#ffffff">Acción Masiva sobre ${selectedBovines.length} Animal(es)</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#a7f3d0">Se generará un registro histórico individual en cada caravana seleccionada</p>
          </div>
          <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" onclick="document.getElementById('bovineBulkDialog').close()" aria-label="Cerrar">×</button>
        </div>

        <form id="bovineBulkForm" style="padding:20px 24px; display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Tipo de Operación Grupal:</label>
            <select id="bulkOperationSelect" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;">
              <option value="potrero" ${actionType === 'potrero' ? 'selected' : ''}>Traslado Grupal de Potrero</option>
              <option value="vaccine" ${actionType === 'vaccine' ? 'selected' : ''}>Vacunación Masiva (Campaña SENASA / Clostridial)</option>
              <option value="weighing" ${actionType === 'weighing' ? 'selected' : ''}>Pesaje Grupal Estimado</option>
            </select>
          </div>

          <div id="bulkDynamicFields">
            <!-- Dinámico -->
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost" onclick="document.getElementById('bovineBulkDialog').close()">Cancelar</button>
            <button type="submit" class="btn primary">Ejecutar Acción Grupal</button>
          </div>
        </form>
      </div>
    `;

    function updateDynamicFields(type) {
      const container = dialog.querySelector('#bulkDynamicFields');
      if (type === 'potrero') {
        container.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha del Traslado (*):</label>
              <input type="date" id="bulkDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Potrero Destino (*):</label>
              <select id="bulkToPotrero" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;">
                ${potreroOptions}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Motivo del Traslado:</label>
              <input type="text" id="bulkReason" value="Rotación pastoril en lote" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
          </div>
        `;
      } else if (type === 'vaccine') {
        container.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha de Aplicación (*):</label>
                <input type="date" id="bulkDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
              </div>
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Producto / Vacuna (*):</label>
                <input type="text" id="bulkProduct" value="Bivalente Antiaftosa SENASA" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; font-weight:700" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Dosis / Vía:</label>
                <input type="text" id="bulkDose" value="2 mL Subcutánea" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
              </div>
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Veterinario Responsable:</label>
                <input type="text" id="bulkVet" value="Dr. M. Benítez (MP 4120)" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
              </div>
            </div>
          </div>
        `;
      } else if (type === 'weighing') {
        container.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Fecha de Pesaje (*):</label>
              <input type="date" id="bulkDate" value="${new Date().toISOString().slice(0,10)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px">Incremento Medio Estimado (kg) por cabeza:</label>
              <input type="number" step="1" id="bulkWeightDelta" value="15" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; font-weight:750; color:#087FBD" />
            </div>
          </div>
        `;
      }
    }

    const opSelect = dialog.querySelector('#bulkOperationSelect');
    opSelect.addEventListener('change', () => updateDynamicFields(opSelect.value));
    updateDynamicFields(actionType);

    const form = dialog.querySelector('#bovineBulkForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const op = opSelect.value;
      const dateVal = dialog.querySelector('#bulkDate').value;
      const D = window.UNRC;

      let nextDb = window.db;
      for (const bov of selectedBovines) {
        if (op === 'potrero') {
          const toPot = dialog.querySelector('#bulkToPotrero').value;
          const reason = dialog.querySelector('#bulkReason').value.trim();
          bov.historialMovimientos = bov.historialMovimientos || [];
          bov.historialMovimientos.push({
            id: 'm_' + Date.now() + Math.random().toString(36).slice(2, 5),
            date: dateVal,
            fromPotrero: bov.potrero,
            toPotrero: toPot,
            reason,
            user: 'Admin'
          });
          bov.potrero = toPot;
        } else if (op === 'vaccine') {
          bov.historialSanidad = bov.historialSanidad || [];
          bov.historialSanidad.push({
            id: 's_' + Date.now() + Math.random().toString(36).slice(2, 5),
            date: dateVal,
            type: 'Vacunación Masiva Oficial',
            product: dialog.querySelector('#bulkProduct').value.trim(),
            dose: dialog.querySelector('#bulkDose').value.trim(),
            withdrawalDays: 0,
            vet: dialog.querySelector('#bulkVet').value.trim(),
            note: 'Campaña general'
          });
        } else if (op === 'weighing') {
          const delta = parseFloat(dialog.querySelector('#bulkWeightDelta').value) || 0;
          const newWeight = (bov.pesoActual || 300) + delta;
          bov.historialPesajes = bov.historialPesajes || [];
          bov.historialPesajes.push({
            id: 'w_' + Date.now() + Math.random().toString(36).slice(2, 5),
            date: dateVal,
            weight: newWeight,
            days: 30,
            gdpvKg: Math.round((delta / 30) * 100) / 100,
            gdpvGrams: Math.round((delta / 30) * 1000),
            note: 'Pesada grupal de control'
          });
          bov.pesoActual = newWeight;
          bov.gdpv = Math.round((delta / 30) * 100) / 100;
        }

        nextDb = D.commit(nextDb, 'bovines', bov);
      }

      try {
        if (typeof persist === 'function') {
          await persist(nextDb);
        } else if (typeof UNRCStorage !== 'undefined') {
          await UNRCStorage.save(nextDb);
          window.db = nextDb;
        }
        state.selectedIds.clear();
        dialog.close();
        if (typeof toast === 'function') toast(`✓ Acción masiva aplicada a ${selectedBovines.length} bovino(s).`, 'success');
        if (typeof render === 'function') render();
      } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
        else alert(err.message);
      }
    });

    dialog.showModal();
  }

  /**
   * Exporta la lista de caravanas a CSV
   */
  function exportBovinesCsv(database) {
    const db = database || (typeof window !== 'undefined' ? window.db : null);
    const bovines = getBovines(db);
    if (!bovines.length) {
      if (typeof toast === 'function') toast('No hay bovinos para exportar.', 'warning');
      return;
    }
    const headers = ['Caravana', 'Categoria', 'Raza', 'Sexo', 'Pelaje', 'Potrero', 'Peso_kg', 'GDPV_kg_dia', 'Fecha_Nacimiento', 'Madre', 'Padre', 'Estado', 'Notas'];
    const rows = bovines.map(b => [
      b.caravana,
      `"${String(b.categoria || '').replace(/"/g, '""')}"`,
      `"${String(b.raza || '').replace(/"/g, '""')}"`,
      b.sexo,
      `"${String(b.pelaje || '').replace(/"/g, '""')}"`,
      `"${String(b.potrero || '').replace(/"/g, '""')}"`,
      b.pesoActual,
      b.gdpv || 0,
      b.fechaNacimiento || '',
      b.madreCaravana || '',
      b.padreCaravana || '',
      b.estado || 'Activo',
      `"${String(b.notas || '').replace(/"/g, '""')}"`
    ]);
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UNRC-Bovinos-Caravanas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof toast === 'function') toast('Planilla de bovinos por caravana descargada.', 'success');
  }

  /**
   * Conecta los eventos de la vista de bovinos
   */
  function bindBovineEvents(containerEl) {
    if (!containerEl) return;

    // Navegación entre pestañas principales
    containerEl.querySelectorAll('[data-bovine-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeSubTab = btn.getAttribute('data-bovine-tab');
        if (typeof render === 'function') render();
      });
    });

    // Abrir ficha individual
    containerEl.querySelectorAll('[data-bovine-open-ficha]').forEach(btn => {
      btn.addEventListener('click', () => {
        const caravana = btn.getAttribute('data-bovine-open-ficha');
        state.selectedCaravana = caravana;
        state.activeSubTab = 'ficha';
        state.fichaInnerTab = 'identificacion';
        if (typeof render === 'function') render();
      });
    });

    // Subpestañas de la ficha individual
    containerEl.querySelectorAll('[data-ficha-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.fichaInnerTab = btn.getAttribute('data-ficha-subtab');
        if (typeof render === 'function') render();
      });
    });

    // Filtros de búsqueda
    const sInput = containerEl.querySelector('#bovineSearchInput');
    if (sInput) {
      sInput.addEventListener('input', () => {
        state.filters.search = sInput.value;
        const sub = containerEl.querySelector('#bovinesViewContainer');
        if (sub && state.activeSubTab === 'caravanas') {
          sub.innerHTML = renderCaravanasView(getBovines(window.db), computeBovineKpis(window.db));
          bindBovineEvents(containerEl);
        }
      });
    }

    const catFilter = containerEl.querySelector('#bovineCategoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', () => {
        state.filters.category = catFilter.value;
        if (typeof render === 'function') render();
      });
    }

    const potFilter = containerEl.querySelector('#bovinePotreroFilter');
    if (potFilter) {
      potFilter.addEventListener('change', () => {
        state.filters.potrero = potFilter.value;
        if (typeof render === 'function') render();
      });
    }

    const sexFilter = containerEl.querySelector('#bovineSexFilter');
    if (sexFilter) {
      sexFilter.addEventListener('change', () => {
        state.filters.sex = sexFilter.value;
        if (typeof render === 'function') render();
      });
    }

    const statusFilter = containerEl.querySelector('#bovineStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        state.filters.status = statusFilter.value;
        if (typeof render === 'function') render();
      });
    }

    // Limpiar filtros
    const clearBtn = containerEl.querySelector('[data-bovine-action="clear-filters"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.filters = { search: '', category: 'todas', potrero: 'todos', sex: 'todos', status: 'activo' };
        if (typeof render === 'function') render();
      });
    }

    // Filtrar directamente desde tarjeta de potrero
    containerEl.querySelectorAll('[data-bovine-filter-potrero]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pot = btn.getAttribute('data-bovine-filter-potrero');
        state.filters.potrero = pot;
        state.activeSubTab = 'caravanas';
        if (typeof render === 'function') render();
      });
    });

    // Checkbox selección fila
    containerEl.querySelectorAll('.bovine-row-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        if (chk.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        if (typeof render === 'function') render();
      });
    });

    // Select All
    const selectAll = containerEl.querySelector('#bovineSelectAll');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const all = getBovines(window.db).filter(b => b.estado === 'Activo');
        if (selectAll.checked) {
          all.forEach(b => state.selectedIds.add(b.id));
        } else {
          state.selectedIds.clear();
        }
        if (typeof render === 'function') render();
      });
    }

    // Acciones y Modales
    containerEl.querySelectorAll('[data-bovine-action="new-bovine"]').forEach(b => b.onclick = () => openBovineModal());
    containerEl.querySelectorAll('[data-bovine-action="edit-bovine"]').forEach(b => b.onclick = () => openBovineModal(b.getAttribute('data-id')));
    containerEl.querySelectorAll('[data-bovine-action="open-bulk-modal"]').forEach(b => b.onclick = () => openBulkActionsModal('potrero'));
    containerEl.querySelectorAll('[data-bovine-action="bulk-potrero"]').forEach(b => b.onclick = () => openBulkActionsModal('potrero'));
    containerEl.querySelectorAll('[data-bovine-action="bulk-vaccine"]').forEach(b => b.onclick = () => openBulkActionsModal('vaccine'));
    containerEl.querySelectorAll('[data-bovine-action="bulk-weighing"]').forEach(b => b.onclick = () => openBulkActionsModal('weighing'));
    containerEl.querySelectorAll('[data-bovine-action="bulk-clear"]').forEach(b => b.onclick = () => {
      state.selectedIds.clear();
      if (typeof render === 'function') render();
    });

    containerEl.querySelectorAll('[data-bovine-action="new-weighing"]').forEach(b => {
      b.onclick = () => openBovineEventModal('pesaje', b.getAttribute('data-caravana') || state.selectedCaravana);
    });
    containerEl.querySelectorAll('[data-bovine-action="new-treatment"]').forEach(b => {
      b.onclick = () => openBovineEventModal('sanidad', b.getAttribute('data-caravana') || state.selectedCaravana);
    });
    containerEl.querySelectorAll('[data-bovine-action="new-repro"]').forEach(b => {
      b.onclick = () => openBovineEventModal('reproduccion', b.getAttribute('data-caravana') || state.selectedCaravana);
    });
    containerEl.querySelectorAll('[data-bovine-action="new-movement"]').forEach(b => {
      b.onclick = () => openBovineEventModal('movimiento', b.getAttribute('data-caravana') || state.selectedCaravana);
    });
    containerEl.querySelectorAll('[data-bovine-action="move-potrero"]').forEach(b => {
      b.onclick = () => openBulkActionsModal('potrero');
    });

    containerEl.querySelectorAll('[data-bovine-action="export-csv"]').forEach(b => {
      b.onclick = () => exportBovinesCsv(window.db);
    });

    containerEl.querySelectorAll('[data-bovine-action="delete-bovine"]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const bov = getBovines(window.db).find(b => b.id === id);
        if (!bov) return;
        const ok = confirm(`¿Dar de baja al bovino con caravana "${bov.caravana}"?`);
        if (!ok) return;
        const D = window.UNRC;
        bov.estado = 'Baja';
        const next = D.commit(window.db, 'bovines', bov);
        if (typeof persist === 'function') await persist(next);
        else if (typeof UNRCStorage !== 'undefined') {
          await UNRCStorage.save(next);
          window.db = next;
        }
        if (typeof toast === 'function') toast(`Bovino caravana ${bov.caravana} dado de baja.`, 'info');
        if (typeof render === 'function') render();
      };
    });
  }

  const api = {
    POTREROS,
    CATEGORIES,
    BREEDS,
    seedDefaultBovinesIfEmpty,
    getBovines,
    getBovineByCaravana,
    computeBovineKpis,
    renderWeightCurveSvg,
    renderBovinesModule,
    openBovineModal,
    openBovineEventModal,
    openBulkActionsModal,
    exportBovinesCsv,
    bindBovineEvents
  };

  root.UNRCBovines = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
