'use strict';

const fs = require('fs');
const D = require('./domain.js');
const Plan = require('./assets/account-plan.js');
const Semaphore = require('./semaphore-engine.js');

function buildDataset() {
  const parties = [
    {
      id: 'demo-party-frigo',
      name: 'Frigorífico Río Cuarto S.A.',
      taxId: '30-65489123-8',
      kind: 'cliente',
      contact: 'comercial@frigorificoriocuarto.com.ar',
      note: 'Comprador principal de hacienda terminada a faena (porcinos y bovinos)',
      isDemo: true
    },
    {
      id: 'demo-party-acopio',
      name: 'Cooperativa Agropecuaria Río Cuarto',
      taxId: '30-54128795-4',
      kind: 'ambos',
      contact: 'granos@coopriocuarto.com.ar',
      note: 'Acopio cerealero de la zona y proveedor de raciones e insumos agrícolas',
      isDemo: true
    },
    {
      id: 'demo-party-carniceria',
      name: 'Distribuidora Cárnica Centro',
      taxId: '20-24895612-4',
      kind: 'cliente',
      contact: 'ventas@carniceriacentro.com.ar',
      note: 'Comprador directo de corderos terminados faena carnicera',
      isDemo: true
    },
    {
      id: 'demo-party-veterinaria',
      name: 'Veterinaria San Martín Agro',
      taxId: '30-70891234-2',
      kind: 'proveedor',
      contact: 'ventas@sanmartinagro.com.ar',
      note: 'Provisión de vacunas oficiales SENASA, antibióticos y antiparasitarios',
      isDemo: true
    },
    {
      id: 'demo-party-semillero',
      name: 'Semillería & Servicios Rurales del Sur',
      taxId: '30-68124567-9',
      kind: 'proveedor',
      contact: 'insumos@semilleriasur.com.ar',
      note: 'Semillas fiscalizadas híbridas, fertilizantes y fitosanitarios',
      isDemo: true
    },
    {
      id: 'demo-party-contratista',
      name: 'Contratista Rural Los Molles',
      taxId: '20-18456123-3',
      kind: 'proveedor',
      contact: 'servicios@losmollesrural.com.ar',
      note: 'Servicio de siembra directa, pulverización y cosecha mecanizada',
      isDemo: true
    },
    {
      id: 'demo-party-aca',
      name: 'ACA Acopio Vicuña Mackenna',
      taxId: '30-50001091-2',
      kind: 'ambos',
      contact: 'cereales@acavmackenna.com.ar',
      note: 'Asociación de Cooperativas Argentinas - Exportación y canje de cereal por insumos',
      isDemo: true
    },
    {
      id: 'demo-party-ypf',
      name: 'YPF Agro Distribuidor Regional',
      taxId: '30-54668997-1',
      kind: 'proveedor',
      contact: 'agro@ypfregional.com.ar',
      note: 'Combustible Infinia Diésel agro, fertilizantes a granel y fitosanitarios',
      isDemo: true
    },
    {
      id: 'demo-party-consignataria',
      name: 'Consignataria Ganadera del Sur S.A.',
      taxId: '30-61234567-8',
      kind: 'cliente',
      contact: 'remates@consignatariadelsur.com.ar',
      note: 'Operador de remates feria en Río Cuarto y comercialización a faena / invernada',
      isDemo: true
    },
    {
      id: 'demo-party-coop-elec',
      name: 'Cooperativa Eléctrica Pozo del Carril',
      taxId: '30-54555888-9',
      kind: 'proveedor',
      contact: 'administracion@cooppozodelcarril.com.ar',
      note: 'Suministro eléctrico rural y mantenimiento de infraestructura',
      isDemo: true
    },
    {
      id: 'demo-party-cabana',
      name: 'Cabaña Ovina El Amanecer',
      taxId: '20-17892341-5',
      kind: 'proveedor',
      contact: 'reproductores@elamanecerovinos.com.ar',
      note: 'Cabaña registrada de ovinos carniceros raza Dorper Puro de Pedigree',
      isDemo: true
    }
  ];

  const products = [
    {
      id: 'demo-prod-maiz',
      name: 'Grano de Maíz Propio',
      kind: 'grano',
      unit: 'kg',
      inventoryAccountId: '1.3.04.01',
      minStock: 25000,
      note: 'Maíz condición cámara cosechado en Pozo del Carril (Planta y Silo Bolsa)',
      isDemo: true
    },
    {
      id: 'demo-prod-soja',
      name: 'Grano de Soja 1ª Siembra',
      kind: 'grano',
      unit: 'kg',
      inventoryAccountId: '1.3.04.01',
      minStock: 15000,
      note: 'Soja propia cosechada en parcela norte (Acopio Cooperativa)',
      isDemo: true
    },
    {
      id: 'demo-prod-alim-porc',
      name: 'Alimento Balanceado Terminador Porcino',
      kind: 'alimento',
      unit: 'kg',
      phase: 'engorde_terminacion',
      inventoryAccountId: '1.3.04.01',
      minStock: 5000,
      note: 'Ración comercial balanceada 16% PB terminación capones',
      isDemo: true
    },
    {
      id: 'demo-prod-alim-recria',
      name: 'Alimento Balanceado Recría Porcino',
      kind: 'alimento',
      unit: 'kg',
      phase: 'destete_recria',
      inventoryAccountId: '1.3.04.01',
      minStock: 3000,
      note: 'Ración inicial de destete y desarrollo 18% PB con núcleo vitamínico',
      isDemo: true
    },
    {
      id: 'demo-prod-supl-bov',
      name: 'Suplemento Proteico Bovino Corral',
      kind: 'alimento',
      unit: 'kg',
      phase: 'engorde_bov',
      inventoryAccountId: '1.3.04.01',
      minStock: 4000,
      note: 'Concentrado proteico mineral para terminación novillos a corral feedlot',
      isDemo: true
    },
    {
      id: 'demo-prod-supl-ovi',
      name: 'Ración Suplementación Ovina Corderos',
      kind: 'alimento',
      unit: 'kg',
      phase: 'corderos_faena',
      inventoryAccountId: '1.3.04.01',
      minStock: 2000,
      note: 'Alimento concentrado balanceado para engorde intensivo corderos carne',
      isDemo: true
    }
  ];

  const campaigns = [
    // CAMPAÑA 2023/24
    {
      id: 'demo-camp-maiz-2324',
      name: 'Maíz Temprano 2023/24 - Lote La Aguada',
      date: '2023-10-14',
      crop: 'Maíz',
      area: 'maiz',
      parcel: 'Lote 1 La Aguada (40 ha)',
      hectares: 40,
      surface: 40,
      sowingDate: '2023-10-14',
      harvestDate: '2024-04-12',
      status: 'cosechada',
      variety: 'DK 72-10 VT3P',
      density: 72000,
      yield: 88.0,
      harvestTons: 352,
      destination: 'Silo Bolsa Planta',
      fertilization: 'Urea 200 kg/ha + MAP 80 kg/ha',
      note: 'Campaña Maíz 23/24: 40 ha, rinde 8.800 kg/ha (88 qq/ha) = 352 t totales',
      isDemo: true
    },
    {
      id: 'demo-camp-soja-2324',
      name: 'Soja 1ª Siembra 2023/24 - Lote Norte',
      date: '2023-11-12',
      crop: 'Soja',
      area: 'soja',
      parcel: 'Lote Norte (30 ha)',
      hectares: 30,
      surface: 30,
      sowingDate: '2023-11-12',
      harvestDate: '2024-05-02',
      status: 'cosechada',
      variety: 'DM 46i20 IPRO',
      density: 320000,
      yield: 34.0,
      harvestTons: 102,
      destination: 'Acopio Local Cooperativa',
      fertilization: 'Superfosfato simple 90 kg/ha',
      note: 'Campaña Soja 23/24: 30 ha, rinde 3.400 kg/ha (34 qq/ha) = 102 t totales',
      isDemo: true
    },

    // CAMPAÑA 2024/25
    {
      id: 'demo-camp-maiz-2425',
      name: 'Maíz Temprano 2024/25 - Lote La Aguada',
      date: '2024-10-12',
      crop: 'Maíz',
      area: 'maiz',
      parcel: 'Lote 1 La Aguada (40 ha)',
      hectares: 40,
      surface: 40,
      sowingDate: '2024-10-12',
      harvestDate: '2025-04-10',
      status: 'cosechada',
      variety: 'DK 72-10 VT3P',
      density: 72000,
      yield: 92.0,
      harvestTons: 368,
      destination: 'Silo Bolsa Planta',
      fertilization: 'Urea 210 kg/ha + MAP 85 kg/ha',
      note: 'Campaña Maíz 24/25: 40 ha, rinde 9.200 kg/ha (92 qq/ha) = 368 t totales',
      isDemo: true
    },
    {
      id: 'demo-camp-soja-2425',
      name: 'Soja 1ª Siembra 2024/25 - Lote Norte',
      date: '2024-11-10',
      crop: 'Soja',
      area: 'soja',
      parcel: 'Lote Norte (30 ha)',
      hectares: 30,
      surface: 30,
      sowingDate: '2024-11-10',
      harvestDate: '2025-04-28',
      status: 'cosechada',
      variety: 'DM 46i20 IPRO',
      density: 320000,
      yield: 35.0,
      harvestTons: 105,
      destination: 'Acopio Local Cooperativa',
      fertilization: 'Superfosfato simple 100 kg/ha',
      note: 'Campaña Soja 24/25: 30 ha, rinde 3.500 kg/ha (35 qq/ha) = 105 t totales',
      isDemo: true
    },

    // CAMPAÑA 2025/26
    {
      id: 'demo-camp-maiz',
      name: 'Maíz Temprano 2025/26 - Lote La Aguada',
      date: '2025-10-15',
      crop: 'Maíz',
      area: 'maiz',
      parcel: 'Lote 1 La Aguada (40 ha)',
      hectares: 40,
      surface: 40,
      sowingDate: '2025-10-15',
      harvestDate: '2026-04-10',
      status: 'cosechada',
      variety: 'DK 72-10 VT3P',
      density: 72000,
      yield: 95.0,
      harvestTons: 380,
      destination: 'Silo Bolsa Planta',
      fertilization: 'Urea 220 kg/ha + MAP 90 kg/ha',
      note: 'Campaña Maíz 25/26: 40 ha, rinde 9.500 kg/ha (95 qq/ha) = 380 t totales',
      isDemo: true
    },
    {
      id: 'demo-camp-soja',
      name: 'Soja 1ª Siembra 2025/26 - Lote Norte',
      date: '2025-11-10',
      crop: 'Soja',
      area: 'soja',
      parcel: 'Lote Norte (30 ha)',
      hectares: 30,
      surface: 30,
      sowingDate: '2025-11-10',
      harvestDate: '2026-04-25',
      status: 'cosechada',
      variety: 'DM 46i20 IPRO',
      density: 320000,
      yield: 35.0,
      harvestTons: 105,
      destination: 'Acopio Local Cooperativa',
      fertilization: 'Superfosfato simple 100 kg/ha',
      note: 'Campaña Soja 25/26: 30 ha, rinde 3.500 kg/ha (35 qq/ha) = 105 t totales',
      isDemo: true
    }
  ];

  const lots = [
    // --- 2024 LOTES ---
    {
      id: 'demo-lot-porc-engorde-24',
      name: 'Lote Porcino Engorde 2024',
      species: 'porcino',
      area: 'cerdos',
      date: '2024-01-01',
      phase: 'engorde_terminacion',
      bioStage: 'engorde',
      animals: 80,
      weight: 64.0,
      openingValue: 7800000,
      note: '80 capones en terminación ciclo 2024',
      isDemo: true
    },
    {
      id: 'demo-lot-porc-recria-24',
      name: 'Lote Porcino Recría 2024',
      species: 'porcino',
      area: 'cerdos',
      date: '2024-01-01',
      phase: 'destete_recria',
      bioStage: 'destete',
      animals: 60,
      weight: 26.0,
      openingValue: 3600000,
      note: '60 lechones recría 2024',
      isDemo: true
    },
    {
      id: 'demo-lot-bov-engorde-24',
      name: 'Tropa Bovinos Engorde 2024',
      species: 'bovino',
      area: 'bovinos',
      date: '2024-01-01',
      phase: 'engorde_bov',
      bioStage: 'engorde',
      animals: 30,
      weight: 330.0,
      openingValue: 15800000,
      note: '30 novillos terminación feedlot 2024',
      isDemo: true
    },
    {
      id: 'demo-lot-ovi-recria-24',
      name: 'Lote Corderos Faena 2024',
      species: 'ovino',
      area: 'ovinos',
      date: '2024-01-01',
      phase: 'corderos_faena',
      bioStage: 'engorde',
      animals: 30,
      weight: 25.4,
      openingValue: 1600000,
      note: '30 corderos pesados carne terminación 2024',
      isDemo: true
    },

    // --- 2025 LOTES ---
    {
      id: 'demo-lot-porc-engorde-25',
      name: 'Lote Porcino Engorde 2025',
      species: 'porcino',
      area: 'cerdos',
      date: '2025-01-01',
      phase: 'engorde_terminacion',
      bioStage: 'engorde',
      animals: 80,
      weight: 64.0,
      openingValue: 9800000,
      note: '80 capones en terminación ciclo 2025',
      isDemo: true
    },
    {
      id: 'demo-lot-porc-recria-25',
      name: 'Lote Porcino Recría 2025',
      species: 'porcino',
      area: 'cerdos',
      date: '2025-01-01',
      phase: 'destete_recria',
      bioStage: 'destete',
      animals: 65,
      weight: 27.0,
      openingValue: 4600000,
      note: '65 lechones recría 2025',
      isDemo: true
    },
    {
      id: 'demo-lot-bov-engorde-25',
      name: 'Tropa Bovinos Engorde 2025',
      species: 'bovino',
      area: 'bovinos',
      date: '2025-01-01',
      phase: 'engorde_bov',
      bioStage: 'engorde',
      animals: 30,
      weight: 330.0,
      openingValue: 19800000,
      note: '30 novillos terminación feedlot 2025',
      isDemo: true
    },
    {
      id: 'demo-lot-ovi-recria-25',
      name: 'Lote Corderos Faena 2025',
      species: 'ovino',
      area: 'ovinos',
      date: '2025-01-01',
      phase: 'corderos_faena',
      bioStage: 'engorde',
      animals: 30,
      weight: 25.4,
      openingValue: 2000000,
      note: '30 corderos pesados carne terminación 2025',
      isDemo: true
    },

    // --- 2026 LOTES (IDENTIFICADORES OFICIALES DEL SISTEMA Y TESTS) ---
    // PORCINOS: 200 cabezas de apertura
    {
      id: 'demo-lot-porc-cria',
      name: 'Lote Porcino Cría - Maternidad',
      species: 'porcino',
      area: 'cerdos',
      date: '2026-01-01',
      phase: 'cria_maternidad',
      bioStage: 'cria',
      animals: 50,
      weight: 12.0,
      openingValue: 3500000,
      note: '50 lechones al pie y madres lactantes',
      isDemo: true
    },
    {
      id: 'demo-lot-porc-recria',
      name: 'Lote Porcino Destete - Recría',
      species: 'porcino',
      area: 'cerdos',
      date: '2026-01-01',
      phase: 'destete_recria',
      bioStage: 'destete',
      animals: 70,
      weight: 28.0,
      openingValue: 5600000,
      note: '70 lechones en desarrollo y adaptación',
      isDemo: true
    },
    {
      id: 'demo-lot-porc-engorde',
      name: 'Lote Porcino Engorde - Terminación',
      species: 'porcino',
      area: 'cerdos',
      date: '2026-01-01',
      phase: 'engorde_terminacion',
      bioStage: 'engorde',
      animals: 80,
      weight: 64.0,
      openingValue: 12000000,
      note: '80 capones en engorde intensivo a frigorífico',
      isDemo: true
    },

    // BOVINOS: 80 cabezas de apertura
    {
      id: 'demo-lot-bov-cria',
      name: 'Rodeo Bovino Cría - La Aguada',
      species: 'bovino',
      area: 'bovinos',
      date: '2026-01-01',
      phase: 'cria_bov',
      bioStage: 'cria',
      animals: 50,
      weight: 380.0,
      openingValue: 28000000,
      location: 'Potrero La Aguada',
      note: '50 vacas de cría cruza británica en pastoreo',
      isDemo: true
    },
    {
      id: 'demo-lot-bov-engorde',
      name: 'Tropa Bovinos Engorde - Corral Feedlot',
      species: 'bovino',
      area: 'bovinos',
      date: '2026-01-01',
      phase: 'engorde_bov',
      bioStage: 'engorde',
      animals: 30,
      weight: 330.0,
      openingValue: 24500000,
      location: 'Corral de Engorde 2',
      note: '30 novillos británicos en corral de terminación',
      isDemo: true
    },

    // OVINOS: 120 cabezas de apertura
    {
      id: 'demo-lot-ovi-vientres',
      name: 'Majada Vientres Cruza Dorper',
      species: 'ovino',
      area: 'ovinos',
      date: '2026-01-01',
      phase: 'vientres_ovi',
      bioStage: 'cria',
      animals: 85,
      weight: 55.0,
      openingValue: 8500000,
      destination: 'Plantel de cría en absorción Dorper',
      note: '85 ovejas en servicio estacionado',
      isDemo: true
    },
    {
      id: 'demo-lot-ovi-carneros',
      name: 'Carneros Reproductores Dorper PO',
      species: 'ovino',
      area: 'ovinos',
      date: '2026-01-01',
      phase: 'carneros_ovi',
      bioStage: 'cria',
      animals: 5,
      weight: 85.0,
      openingValue: 2500000,
      destination: 'Servicio genético deslanador',
      note: '5 carneros puros deslanadores pedigree',
      isDemo: true
    },
    {
      id: 'demo-lot-ovi-recria',
      name: 'Lote Corderos y Borregos Terminación',
      species: 'ovino',
      area: 'ovinos',
      date: '2026-01-01',
      phase: 'corderos_faena',
      bioStage: 'engorde',
      animals: 30,
      weight: 25.4,
      openingValue: 2400000,
      destination: 'Engorde corderos pesados carne',
      note: '30 corderos para terminación a 38 kg',
      isDemo: true
    }
  ];

  const sows = [
    {
      id: 'demo-sow-1',
      name: 'Madre Landrace Caravana 101',
      date: '2023-06-01',
      sex: 'madre',
      breed: 'Landrace F1',
      value: 850000,
      residual: 200000,
      lifeMonths: 48,
      note: 'Plantel reproductor porcino UNRC',
      isDemo: true
    },
    {
      id: 'demo-sow-2',
      name: 'Madre Yorkshire Caravana 102',
      date: '2023-06-01',
      sex: 'madre',
      breed: 'Yorkshire F1',
      value: 850000,
      residual: 200000,
      lifeMonths: 48,
      note: 'Plantel reproductor porcino UNRC',
      isDemo: true
    }
  ];

  const births = [
    // 2026 Camadas (para evaluar indicadores 2026 en verde)
    {
      id: 'demo-birth-1',
      name: 'Camada 101/26',
      sowId: 'demo-sow-1',
      date: '2026-02-10',
      lotId: 'demo-lot-porc-cria',
      bornAlive: 13,
      stillborn: 0,
      weaned: 12,
      losses: 1,
      birthWeight: 1.42,
      weanWeight: 7.1,
      toLotId: 'demo-lot-porc-recria',
      weanDate: '2026-03-06',
      lossDate: '2026-02-18',
      closed: true,
      note: 'Camada ciclo 2026: 12 destetados vigorosos con 7.1 kg',
      isDemo: true
    },
    {
      id: 'demo-birth-2',
      name: 'Camada 102/26',
      sowId: 'demo-sow-2',
      date: '2026-03-12',
      lotId: 'demo-lot-porc-cria',
      bornAlive: 12,
      stillborn: 0,
      weaned: 12,
      losses: 0,
      birthWeight: 1.40,
      weanWeight: 7.0,
      toLotId: 'demo-lot-porc-recria',
      weanDate: '2026-04-05',
      closed: true,
      note: '12 lechones destetados limpios sin pérdidas',
      isDemo: true
    }
  ];

  const movements = [
    // --- 2024 MOVEMENTS ---
    {
      id: 'demo-mov-porc-pesaje1-24',
      date: '2024-02-01',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde-24',
      quantity: 80,
      weight: 64.0,
      note: 'Pesaje inicial capones engorde 2024 (64 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-pesaje2-24',
      date: '2024-04-01',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde-24',
      quantity: 80,
      weight: 115.0,
      note: 'Pesaje final terminación capones 2024 (115 kg, GDP 850 g/día)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-baja-24',
      date: '2024-04-10',
      type: 'baja',
      lotId: 'demo-lot-porc-recria-24',
      quantity: 2,
      weight: 25.0,
      note: 'Baja natural recría porcina 2024',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-compra-24',
      date: '2024-05-15',
      type: 'ingreso',
      lotId: 'demo-lot-porc-recria-24',
      quantity: 50,
      weight: 20.0,
      unitCost: 32000,
      note: 'Ingreso compra 50 lechones recría 20 kg',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-pesaje1-24',
      date: '2024-02-05',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde-24',
      quantity: 30,
      weight: 330.0,
      note: 'Pesaje inicial novillos feedlot 2024 (330 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-pesaje2-24',
      date: '2024-05-05',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde-24',
      quantity: 30,
      weight: 420.0,
      note: 'Pesaje final novillos feedlot 2024 (420 kg, GDP 1.000 kg/día)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-pesaje1-24',
      date: '2024-02-10',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria-24',
      quantity: 30,
      weight: 25.4,
      note: 'Pesaje inicial corderos recría 2024 (25.4 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-pesaje2-24',
      date: '2024-03-31',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria-24',
      quantity: 30,
      weight: 36.4,
      note: 'Pesaje corderos terminados faena 2024 (36.4 kg, GDP 220 g/día)',
      isDemo: true
    },

    // --- 2025 MOVEMENTS ---
    {
      id: 'demo-mov-porc-pesaje1-25',
      date: '2025-02-01',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde-25',
      quantity: 80,
      weight: 64.0,
      note: 'Pesaje inicial capones engorde 2025 (64 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-pesaje2-25',
      date: '2025-04-02',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde-25',
      quantity: 80,
      weight: 115.0,
      note: 'Pesaje final terminación capones 2025 (115 kg, GDP 850 g/día)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-baja-25',
      date: '2025-04-12',
      type: 'baja',
      lotId: 'demo-lot-porc-recria-25',
      quantity: 2,
      weight: 24.0,
      note: 'Baja natural recría porcina 2025',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-pesaje1-25',
      date: '2025-02-05',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde-25',
      quantity: 30,
      weight: 330.0,
      note: 'Pesaje inicial novillos feedlot 2025 (330 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-pesaje2-25',
      date: '2025-05-06',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde-25',
      quantity: 30,
      weight: 420.0,
      note: 'Pesaje final novillos feedlot 2025 (420 kg, GDP 1.000 kg/día)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-pesaje1-25',
      date: '2025-02-12',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria-25',
      quantity: 30,
      weight: 25.4,
      note: 'Pesaje inicial corderos recría 2025 (25.4 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-pesaje2-25',
      date: '2025-04-03',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria-25',
      quantity: 30,
      weight: 36.4,
      note: 'Pesaje corderos terminados faena 2025 (36.4 kg, GDP 220 g/día)',
      isDemo: true
    },

    // --- 2026 MOVEMENTS (OFICIALES) ---
    // PORCINOS
    {
      id: 'demo-mov-porc-compra',
      date: '2026-02-15',
      type: 'ingreso',
      lotId: 'demo-lot-porc-recria',
      quantity: 100,
      weight: 20.0,
      unitCost: 45000,
      note: 'Compra de 100 lechones de aproximadamente 20 kg',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-pesaje1',
      date: '2026-02-01',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde',
      quantity: 80,
      weight: 64.0,
      note: 'Pesaje inicial capones en engorde (64 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-trat',
      date: '2026-03-01',
      type: 'tratamiento',
      lotId: 'demo-lot-porc-recria',
      medication: 'Tilmicosina 300',
      activeIngredient: 'Tilmicosina',
      quantity: 100,
      responsible: 'Dr. Roberto Gómez (Med. Vet. UNRC)',
      withdrawalDays: 21,
      withdrawalEndDate: '2026-03-22',
      unitCost: 480000,
      note: 'Prevención neumonía enzoótica en recría',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-baja',
      date: '2026-03-15',
      type: 'baja',
      lotId: 'demo-lot-porc-recria',
      quantity: 4,
      weight: 24.0,
      note: 'Baja biológica predestete tardío / aplastamiento (4 cabezas)',
      isDemo: true
    },
    {
      id: 'demo-mov-porc-pesaje',
      date: '2026-04-02',
      type: 'pesaje',
      lotId: 'demo-lot-porc-engorde',
      quantity: 80,
      weight: 115.0,
      note: 'Pesaje completo previo a liquidación de 80 capones (115 kg, GDP 850 g/d)',
      isDemo: true
    },

    // BOVINOS
    {
      id: 'demo-mov-bov-pesaje1',
      date: '2026-02-05',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde',
      quantity: 30,
      weight: 330.0,
      note: 'Pesaje inicial novillos feedlot 2026 (330 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-ingreso',
      date: '2026-02-10',
      type: 'ingreso',
      lotId: 'demo-lot-bov-engorde',
      quantity: 20,
      weight: 260.0,
      unitCost: 680000,
      note: 'Compra / ingreso de 20 terneros de invernada para engorde',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-trat',
      date: '2026-03-08',
      type: 'tratamiento',
      lotId: 'demo-lot-bov-cria',
      medication: 'Vacuna Antiaftosa Biogénesis Bagó',
      activeIngredient: 'Virus antiaftosa inactivado',
      quantity: 50,
      responsible: 'Dr. Roberto Gómez (SENASA Acreditado)',
      withdrawalDays: 0,
      unitCost: 350000,
      note: 'Campaña obligatoria SENASA 1er ciclo antiaftosa',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-baja',
      date: '2026-04-12',
      type: 'baja',
      lotId: 'demo-lot-bov-cria',
      quantity: 1,
      weight: 390.0,
      note: 'Baja por timpanismo espumoso en pastura (1 cabeza)',
      isDemo: true
    },
    {
      id: 'demo-mov-bov-pesaje',
      date: '2026-05-06',
      type: 'pesaje',
      lotId: 'demo-lot-bov-engorde',
      quantity: 50,
      weight: 420.0,
      note: 'Pesaje control novillos terminados corral (420 kg, GDP 1.000 kg/d)',
      isDemo: true
    },

    // OVINOS
    {
      id: 'demo-mov-ovi-pesaje1',
      date: '2026-02-12',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria',
      quantity: 30,
      weight: 25.4,
      note: 'Pesaje inicial corderos recría 2026 (25.4 kg)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-ingreso',
      date: '2026-03-10',
      type: 'ingreso',
      lotId: 'demo-lot-ovi-recria',
      quantity: 15,
      weight: 14.0,
      unitCost: 0,
      note: 'Señalada e incorporación de 15 corderos diente de leche',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-baja',
      date: '2026-04-05',
      type: 'baja',
      lotId: 'demo-lot-ovi-recria',
      quantity: 2,
      weight: 22.0,
      note: 'Baja natural / predación zorro en campo (2 cabezas)',
      isDemo: true
    },
    {
      id: 'demo-mov-ovi-pesaje',
      date: '2026-05-15',
      type: 'pesaje',
      lotId: 'demo-lot-ovi-recria',
      quantity: 43,
      weight: 38.0,
      note: 'Pesaje corderos pesados carne terminados (38 kg)',
      isDemo: true
    }
  ];

  const costs = [
    // --- 2024 MAÍZ (Total: $20.000.000) ---
    {
      id: 'demo-cost-maiz-semilla-23',
      date: '2023-10-20',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2324',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00014200',
      category: 'Semillas',
      amount: 8000000,
      tax: 1680000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla híbrida maíz Dekalb 2023/24',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-fertilizante-23',
      date: '2023-11-25',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2324',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00015100',
      category: 'Fertilización',
      amount: 6000000,
      tax: 1260000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Fertilización con Urea granulada y arrancador fosfatado',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-cosecha-23',
      date: '2024-04-14',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2324',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00003100',
      category: 'Cosecha',
      amount: 6000000,
      tax: 1260000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Servicio de trilla mecanizada 40 ha maíz 2024',
      isDemo: true
    },

    // --- 2024 SOJA (Total: $10.000.000) ---
    {
      id: 'demo-cost-soja-semilla-23',
      date: '2023-11-15',
      area: 'soja',
      campaignId: 'demo-camp-soja-2324',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00014800',
      category: 'Semillas',
      amount: 4000000,
      tax: 840000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla fiscalizada soja DM 46i20 + inoculante',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-agroquimicos-23',
      date: '2024-01-20',
      area: 'soja',
      campaignId: 'demo-camp-soja-2324',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0002-00028100',
      category: 'Aplicaciones',
      amount: 3200000,
      tax: 672000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Control fitosanitario barbecho y post-emergente soja',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-cosecha-23',
      date: '2024-05-04',
      area: 'soja',
      campaignId: 'demo-camp-soja-2324',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00003250',
      category: 'Cosecha',
      amount: 2800000,
      tax: 588000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Cosecha directa 30 ha soja 2024',
      isDemo: true
    },

    // --- 2024 GANADERÍA ---
    {
      id: 'demo-cost-porc-sanidad-24',
      date: '2024-02-25',
      area: 'cerdos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-A 0001-00038100',
      category: 'Sanidad',
      amount: 850000,
      tax: 178500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Vacunación Mycoplasma y Circovirus plantel porcino 2024',
      isDemo: true
    },
    {
      id: 'demo-cost-bov-sanidad-24',
      date: '2024-03-12',
      area: 'bovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-B 0002-00071200',
      category: 'Sanidad',
      amount: 1450000,
      tax: 304500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Plan sanitario antiaftosa, mancha y carbunclo 2024',
      isDemo: true
    },
    {
      id: 'demo-cost-ovi-sanidad-24',
      date: '2024-03-25',
      area: 'ovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-C 0001-00002800',
      category: 'Sanidad',
      amount: 420000,
      tax: 88200,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Esquila higiénica de preparto e Ivermectina 2024',
      isDemo: true
    },

    // --- 2025 MAÍZ (Total: $24.000.000) ---
    {
      id: 'demo-cost-maiz-semilla-24',
      date: '2024-10-18',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2425',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00016800',
      category: 'Semillas',
      amount: 9500000,
      tax: 1995000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla híbrida maíz Dekalb 2024/25',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-fertilizante-24',
      date: '2024-11-22',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2425',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00017900',
      category: 'Fertilización',
      amount: 7500000,
      tax: 1575000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Fertilización con Urea granulada y MAP',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-cosecha-24',
      date: '2025-04-12',
      area: 'maiz',
      campaignId: 'demo-camp-maiz-2425',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00003800',
      category: 'Cosecha',
      amount: 7000000,
      tax: 1470000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Servicio de trilla mecanizada 40 ha maíz 2025',
      isDemo: true
    },

    // --- 2025 SOJA (Total: $12.000.000) ---
    {
      id: 'demo-cost-soja-semilla-24',
      date: '2024-11-15',
      area: 'soja',
      campaignId: 'demo-camp-soja-2425',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00017200',
      category: 'Semillas',
      amount: 4800000,
      tax: 1008000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla fiscalizada soja DM 46i20 + inoculante',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-agroquimicos-24',
      date: '2025-01-18',
      area: 'soja',
      campaignId: 'demo-camp-soja-2425',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0002-00029800',
      category: 'Aplicaciones',
      amount: 4000000,
      tax: 840000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Control fitosanitario barbecho y malezas soja',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-cosecha-24',
      date: '2025-04-30',
      area: 'soja',
      campaignId: 'demo-camp-soja-2425',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00003920',
      category: 'Cosecha',
      amount: 3200000,
      tax: 672000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Cosecha directa 30 ha soja 2025',
      isDemo: true
    },

    // --- 2025 GANADERÍA ---
    {
      id: 'demo-cost-porc-sanidad-25',
      date: '2025-02-22',
      area: 'cerdos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-A 0001-00041200',
      category: 'Sanidad',
      amount: 1050000,
      tax: 220500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Vacunación y sanidad plantel porcino 2025',
      isDemo: true
    },
    {
      id: 'demo-cost-bov-sanidad-25',
      date: '2025-03-10',
      area: 'bovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-B 0002-00079800',
      category: 'Sanidad',
      amount: 1750000,
      tax: 367500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Plan sanitario antiaftosa, mancha y carbunclo 2025',
      isDemo: true
    },
    {
      id: 'demo-cost-ovi-sanidad-25',
      date: '2025-03-24',
      area: 'ovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-C 0001-00003100',
      category: 'Sanidad',
      amount: 520000,
      tax: 109200,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Esquila higiénica y antiparasitarios ovinos 2025',
      isDemo: true
    },

    // --- 2026 MAÍZ (Total: $28.500.000) ---
    {
      id: 'demo-cost-maiz-semilla',
      date: '2025-10-20',
      area: 'maiz',
      campaignId: 'demo-camp-maiz',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00019200',
      category: 'Semillas',
      amount: 11200000,
      tax: 2352000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla híbrida maíz Dekalb + cura semilla profesional',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-fertilizante',
      date: '2025-11-28',
      area: 'maiz',
      campaignId: 'demo-camp-maiz',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00021050',
      category: 'Fertilización',
      amount: 8900000,
      tax: 1869000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Fertilización con Urea granulada al voleo 220 kg/ha',
      isDemo: true
    },
    {
      id: 'demo-cost-maiz-cosecha',
      date: '2026-04-12',
      area: 'maiz',
      campaignId: 'demo-camp-maiz',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00004510',
      category: 'Cosecha',
      amount: 8400000,
      tax: 1764000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Servicio de cosecha mecánica 40 ha y acarreo a silo bolsa',
      isDemo: true
    },

    // --- 2026 SOJA (Total: $14.200.000) ---
    {
      id: 'demo-cost-soja-semilla',
      date: '2025-11-15',
      area: 'soja',
      campaignId: 'demo-camp-soja',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0003-00019800',
      category: 'Semillas',
      amount: 5600000,
      tax: 1176000,
      taxRecoverable: true,
      accountId: '5.4.02.01',
      note: 'Semilla fiscalizada soja Don Mario + inoculante Bradyrhizobium',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-agroquimicos',
      date: '2026-01-18',
      area: 'soja',
      campaignId: 'demo-camp-soja',
      partyId: 'demo-party-semillero',
      reference: 'FC-A 0002-00031400',
      category: 'Aplicaciones',
      amount: 4800000,
      tax: 1008000,
      taxRecoverable: true,
      accountId: '5.4.02.02',
      note: 'Barbecho y control de malezas difíciles con glifosato y cletodim',
      isDemo: true
    },
    {
      id: 'demo-cost-soja-cosecha',
      date: '2026-04-26',
      area: 'soja',
      campaignId: 'demo-camp-soja',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0007-00004580',
      category: 'Cosecha',
      amount: 3800000,
      tax: 798000,
      taxRecoverable: true,
      accountId: '5.4.02.03',
      note: 'Cosecha directa lote 30 ha y acarreo a cooperativa',
      isDemo: true
    },

    // --- 2026 GANADERÍA ---
    {
      id: 'demo-cost-porc-sanidad',
      date: '2026-02-25',
      area: 'cerdos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-A 0001-00045210',
      category: 'Sanidad',
      amount: 1250000,
      tax: 262500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Vacunación Mycoplasma, Circovirus y antiparasitarios plantel y recría',
      isDemo: true
    },
    {
      id: 'demo-cost-bov-sanidad',
      date: '2026-03-05',
      area: 'bovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-B 0002-00088123',
      category: 'Sanidad',
      amount: 2100000,
      tax: 441000,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Plan oficial SENASA antiaftosa, mancha y carbunclo rodeo bovino',
      isDemo: true
    },
    {
      id: 'demo-cost-bov-labores',
      date: '2026-04-02',
      area: 'bovinos',
      partyId: 'demo-party-contratista',
      reference: 'FC-A 0005-00011400',
      category: 'Labores',
      amount: 1850000,
      tax: 388500,
      taxRecoverable: true,
      accountId: '5.3.02',
      note: 'Mantenimiento de pasturas consociadas y rollo suplementación',
      isDemo: true
    },
    {
      id: 'demo-cost-ovi-operativo',
      date: '2026-03-25',
      area: 'ovinos',
      partyId: 'demo-party-veterinaria',
      reference: 'FC-C 0001-00003410',
      category: 'Sanidad',
      amount: 650000,
      tax: 136500,
      taxRecoverable: true,
      accountId: '5.3.02.01',
      note: 'Esquila higiénica de preparto y dosificación antiparasitaria Ivermectina',
      isDemo: true
    }
  ];

  const stock = [
    // --- 2024 COSECHAS Y COMPRAS/CONSUMOS ---
    {
      id: 'demo-stock-maiz-cosecha-24',
      date: '2024-04-15',
      type: 'cosecha',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2324',
      quantity: 352000,
      unitCost: 56.818,
      reference: 'Ticket Cosecha Maíz 23/24 Lote 1',
      note: 'Cosecha 40 ha x 8.800 kg/ha = 352.000 kg ingresados a silo',
      isDemo: true
    },
    {
      id: 'demo-stock-soja-cosecha-24',
      date: '2024-05-05',
      type: 'cosecha',
      area: 'soja',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja-2324',
      quantity: 102000,
      unitCost: 98.039,
      reference: 'Ticket Cosecha Soja 23/24 Lote Norte',
      note: 'Cosecha 30 ha x 3.400 kg/ha = 102.000 kg ingresados a acopio',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-compra-24',
      date: '2024-02-10',
      type: 'compra',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      partyId: 'demo-party-acopio',
      quantity: 15000,
      unitCost: 260.00,
      tax: 546000,
      taxRecoverable: true,
      reference: 'FC-A 0002-00041200',
      note: 'Compra ración terminador porcino 2024 (15.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo1-24',
      date: '2024-02-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde-24',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 1 (ICA 2.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo2-24',
      date: '2024-03-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde-24',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 2 (Total: 11.424 kg para 4.080 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-compra-24',
      date: '2024-02-15',
      type: 'compra',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      partyId: 'demo-party-acopio',
      quantity: 20000,
      unitCost: 310.00,
      tax: 868000,
      taxRecoverable: true,
      reference: 'FC-A 0002-00041500',
      note: 'Compra suplemento proteico feedlot 2024 (20.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo1-24',
      date: '2024-02-25',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde-24',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 1 (ICA 6.50)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo2-24',
      date: '2024-04-05',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde-24',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 2 (Total: 17.550 kg para 2.700 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-compra-24',
      date: '2024-02-18',
      type: 'compra',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      partyId: 'demo-party-acopio',
      quantity: 3000,
      unitCost: 340.00,
      tax: 142800,
      taxRecoverable: true,
      reference: 'FC-A 0002-00041800',
      note: 'Compra ración ovina terminación 2024 (3.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo1-24',
      date: '2024-02-25',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria-24',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 1 (ICA 4.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo2-24',
      date: '2024-03-20',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria-24',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 2 (Total: 1.584 kg para 330 kg ganados)',
      isDemo: true
    },

    // --- 2025 COSECHAS Y COMPRAS/CONSUMOS ---
    {
      id: 'demo-stock-maiz-cosecha-25',
      date: '2025-04-14',
      type: 'cosecha',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2425',
      quantity: 368000,
      unitCost: 65.217,
      reference: 'Ticket Cosecha Maíz 24/25 Lote 1',
      note: 'Cosecha 40 ha x 9.200 kg/ha = 368.000 kg ingresados a silo',
      isDemo: true
    },
    {
      id: 'demo-stock-soja-cosecha-25',
      date: '2025-05-02',
      type: 'cosecha',
      area: 'soja',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja-2425',
      quantity: 105000,
      unitCost: 114.285,
      reference: 'Ticket Cosecha Soja 24/25 Lote Norte',
      note: 'Cosecha 30 ha x 3.500 kg/ha = 105.000 kg ingresados a acopio',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-compra-25',
      date: '2025-02-12',
      type: 'compra',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      partyId: 'demo-party-acopio',
      quantity: 16000,
      unitCost: 320.00,
      tax: 716800,
      taxRecoverable: true,
      reference: 'FC-A 0002-00048100',
      note: 'Compra ración terminador porcino 2025 (16.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo1-25',
      date: '2025-02-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde-25',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 1 2025 (ICA 2.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo2-25',
      date: '2025-03-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde-25',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 2 2025 (Total: 11.424 kg para 4.080 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-compra-25',
      date: '2025-02-15',
      type: 'compra',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      partyId: 'demo-party-acopio',
      quantity: 22000,
      unitCost: 380.00,
      tax: 1170400,
      taxRecoverable: true,
      reference: 'FC-A 0002-00048500',
      note: 'Compra suplemento proteico feedlot 2025 (22.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo1-25',
      date: '2025-02-25',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde-25',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 1 2025 (ICA 6.50)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo2-25',
      date: '2025-04-05',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde-25',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 2 2025 (Total: 17.550 kg para 2.700 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-compra-25',
      date: '2025-02-18',
      type: 'compra',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      partyId: 'demo-party-acopio',
      quantity: 3500,
      unitCost: 410.00,
      tax: 200900,
      taxRecoverable: true,
      reference: 'FC-A 0002-00048900',
      note: 'Compra ración ovina terminación 2025 (3.500 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo1-25',
      date: '2025-02-25',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria-25',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 1 2025 (ICA 4.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo2-25',
      date: '2025-03-20',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria-25',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 2 2025 (Total: 1.584 kg para 330 kg ganados)',
      isDemo: true
    },

    // --- 2026 COSECHAS Y COMPRAS/CONSUMOS ---
    {
      id: 'demo-stock-maiz-cosecha',
      date: '2026-04-15',
      type: 'cosecha',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz',
      quantity: 380000,
      unitCost: 75.00,
      reference: 'Ticket Cosecha Maíz Lote 1',
      note: 'Cosecha 40 ha x 9.500 kg/ha = 380.000 kg ingresados a silo',
      isDemo: true
    },
    {
      id: 'demo-stock-soja-cosecha',
      date: '2026-04-28',
      type: 'cosecha',
      area: 'soja',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja',
      quantity: 105000,
      unitCost: 135.23,
      reference: 'Ticket Cosecha Soja Lote Norte',
      note: 'Cosecha 30 ha x 3.500 kg/ha = 105.000 kg ingresados a acopio',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-compra',
      date: '2026-02-10',
      type: 'compra',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      partyId: 'demo-party-acopio',
      quantity: 18000,
      unitCost: 380.00,
      tax: 718200,
      taxRecoverable: true,
      reference: 'FC-A 0002-00055100',
      note: 'Compra ración terminador porcino (18.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo1',
      date: '2026-02-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 1 (ICA 2.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-alim-porc-consumo2',
      date: '2026-03-20',
      type: 'consumo',
      area: 'cerdos',
      productId: 'demo-prod-alim-porc',
      lotId: 'demo-lot-porc-engorde',
      quantity: 5712,
      note: 'Consumo ración terminador lote capones quincena 2 (Total: 11.424 kg para 4.080 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-compra',
      date: '2026-02-15',
      type: 'compra',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      partyId: 'demo-party-acopio',
      quantity: 25000,
      unitCost: 450.00,
      tax: 1575000,
      taxRecoverable: true,
      reference: 'FC-A 0002-00055400',
      note: 'Compra suplemento proteico feedlot (25.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo1',
      date: '2026-02-25',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 1 (ICA 6.50)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-bov-consumo2',
      date: '2026-04-05',
      type: 'consumo',
      area: 'bovinos',
      productId: 'demo-prod-supl-bov',
      lotId: 'demo-lot-bov-engorde',
      quantity: 8775,
      note: 'Consumo suplemento corral feedlot mes 2 (Total: 17.550 kg para 2.700 kg ganados)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-compra',
      date: '2026-02-18',
      type: 'compra',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      partyId: 'demo-party-acopio',
      quantity: 4000,
      unitCost: 490.00,
      tax: 274400,
      taxRecoverable: true,
      reference: 'FC-A 0002-00055800',
      note: 'Compra ración ovina terminación corderos (4.000 kg)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo1',
      date: '2026-02-25',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 1 (ICA 4.80)',
      isDemo: true
    },
    {
      id: 'demo-stock-supl-ovi-consumo2',
      date: '2026-03-20',
      type: 'consumo',
      area: 'ovinos',
      productId: 'demo-prod-supl-ovi',
      lotId: 'demo-lot-ovi-recria',
      quantity: 792,
      note: 'Consumo suplementación ovina lote corderos quincena 2 (Total: 1.584 kg para 330 kg ganados)',
      isDemo: true
    }
  ];

  const transfers = [
    {
      id: 'demo-trans-maiz-cerdos-24',
      date: '2024-05-15',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2324',
      quantity: 50000,
      opportunityPrice: 160.00,
      priceDate: '2024-05-15',
      source: 'Pizarra Rosario Maíz Cámara Arbitral',
      note: 'Transferencia interna para consumo ganadero propio 2024',
      isDemo: true
    },
    {
      id: 'demo-trans-maiz-cerdos-25',
      date: '2025-05-15',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2425',
      quantity: 55000,
      opportunityPrice: 210.00,
      priceDate: '2025-05-15',
      source: 'Pizarra Rosario Maíz Cámara Arbitral',
      note: 'Transferencia interna para consumo ganadero propio 2025',
      isDemo: true
    },
    {
      id: 'demo-trans-maiz-cerdos',
      date: '2026-05-15',
      area: 'maiz',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz',
      quantity: 60000,
      opportunityPrice: 270.00,
      priceDate: '2026-05-15',
      source: 'Pizarra Rosario Maíz Cámara Arbitral',
      note: 'Transferencia interna para consumo ganadero propio sin venta ficticia',
      isDemo: true
    }
  ];

  const sales = [
    // --- 2024 VENTAS ---
    {
      id: 'demo-sale-porcino-24',
      date: '2024-04-18',
      area: 'cerdos',
      reference: 'LIQ-VTA-2024-00008450',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-porc-engorde-24',
      destiny: 'faena',
      animals: 80,
      weight: 115.0,
      price: 1450.00,
      fees: 400200,
      tax: 1400700,
      retentions: 266800,
      perceptions: 0,
      note: 'Venta de 80 capones terminados 2024 (9.200 kg vivos) @ $1.450/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-bovino-24',
      date: '2024-05-14',
      area: 'bovinos',
      reference: 'LIQ-VTA-2024-00008890',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-bov-engorde-24',
      destiny: 'faena',
      animals: 15,
      weight: 420.0,
      price: 2100.00,
      fees: 396900,
      tax: 1389150,
      retentions: 264600,
      perceptions: 0,
      note: 'Venta de 15 novillos terminados feedlot 2024 (6.300 kg vivos) @ $2.100/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-ovino-24',
      date: '2024-05-20',
      area: 'ovinos',
      reference: 'LIQ-VTA-2024-00009120',
      partyId: 'demo-party-carniceria',
      lotId: 'demo-lot-ovi-recria-24',
      destiny: 'faena',
      animals: 25,
      weight: 36.4,
      price: 2300.00,
      fees: 62790,
      tax: 219765,
      retentions: 41860,
      perceptions: 0,
      note: 'Venta de 25 corderos pesados carne 2024 (910 kg vivos) @ $2.300/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-maiz-24',
      date: '2024-05-10',
      area: 'maiz',
      reference: 'LIQ-GRANO-2024-00055100',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2324',
      quantity: 180000,
      price: 160.00,
      fees: 864000,
      tax: 3024000,
      retentions: 1440000,
      perceptions: 0,
      note: 'Venta maíz 2024: 180 t (180.000 kg) @ $160.000/t con entrega a acopio',
      isDemo: true
    },
    {
      id: 'demo-sale-soja-24',
      date: '2024-05-18',
      area: 'soja',
      reference: 'LIQ-SOJA-2024-00031200',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja-2324',
      quantity: 70000,
      price: 320.00,
      fees: 672000,
      tax: 2352000,
      retentions: 7168000,
      perceptions: 0,
      note: 'Venta soja 2024: 70 t (70.000 kg) @ $320.000/t con retenciones DEX 33%',
      isDemo: true
    },

    // --- 2025 VENTAS ---
    {
      id: 'demo-sale-porcino-25',
      date: '2025-04-18',
      area: 'cerdos',
      reference: 'LIQ-VTA-2025-00010150',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-porc-engorde-25',
      destiny: 'faena',
      animals: 80,
      weight: 115.0,
      price: 1850.00,
      fees: 510600,
      tax: 1787100,
      retentions: 340400,
      perceptions: 0,
      note: 'Venta de 80 capones terminados 2025 (9.200 kg vivos) @ $1.850/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-bovino-25',
      date: '2025-05-14',
      area: 'bovinos',
      reference: 'LIQ-VTA-2025-00010880',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-bov-engorde-25',
      destiny: 'faena',
      animals: 15,
      weight: 420.0,
      price: 2700.00,
      fees: 510300,
      tax: 1786050,
      retentions: 340200,
      perceptions: 0,
      note: 'Venta de 15 novillos terminados feedlot 2025 (6.300 kg vivos) @ $2.700/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-ovino-25',
      date: '2025-05-20',
      area: 'ovinos',
      reference: 'LIQ-VTA-2025-00011240',
      partyId: 'demo-party-carniceria',
      lotId: 'demo-lot-ovi-recria-25',
      destiny: 'faena',
      animals: 25,
      weight: 36.4,
      price: 2950.00,
      fees: 80535,
      tax: 281872,
      retentions: 53690,
      perceptions: 0,
      note: 'Venta de 25 corderos pesados carne 2025 (910 kg vivos) @ $2.950/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-maiz-25',
      date: '2025-05-10',
      area: 'maiz',
      reference: 'LIQ-GRANO-2025-00067400',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz-2425',
      quantity: 190000,
      price: 210.00,
      fees: 1197000,
      tax: 4189500,
      retentions: 1995000,
      perceptions: 0,
      note: 'Venta maíz 2025: 190 t (190.000 kg) @ $210.000/t con entrega a acopio',
      isDemo: true
    },
    {
      id: 'demo-sale-soja-25',
      date: '2025-05-18',
      area: 'soja',
      reference: 'LIQ-SOJA-2025-00038900',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja-2425',
      quantity: 70000,
      price: 410.00,
      fees: 861000,
      tax: 3013500,
      retentions: 9184000,
      perceptions: 0,
      note: 'Venta soja 2025: 70 t (70.000 kg) @ $410.000/t con retenciones DEX 33%',
      isDemo: true
    },

    // --- 2026 VENTAS ---
    {
      id: 'demo-sale-porcino',
      date: '2026-04-18',
      area: 'cerdos',
      reference: 'LIQ-VTA-0001-00012480',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-porc-engorde',
      destiny: 'faena',
      animals: 80,
      weight: 115.0,
      price: 2350.00,
      fees: 648600,
      tax: 2270100,
      retentions: 432400,
      perceptions: 0,
      note: 'Venta de 80 capones terminados (9.200 kg vivos) @ $2.350/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-bovino',
      date: '2026-05-14',
      area: 'bovinos',
      reference: 'LIQ-VTA-0001-00012890',
      partyId: 'demo-party-frigo',
      lotId: 'demo-lot-bov-engorde',
      destiny: 'faena',
      animals: 15,
      weight: 420.0,
      price: 3400.00,
      fees: 642600,
      tax: 2249100,
      retentions: 428400,
      perceptions: 0,
      note: 'Venta de 15 novillos terminados corral (6.300 kg vivos) @ $3.400/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-ovino',
      date: '2026-05-20',
      area: 'ovinos',
      reference: 'LIQ-VTA-0001-00013050',
      partyId: 'demo-party-carniceria',
      lotId: 'demo-lot-ovi-recria',
      destiny: 'faena',
      animals: 25,
      weight: 38.0,
      price: 3700.00,
      fees: 105450,
      tax: 369075,
      retentions: 70300,
      perceptions: 0,
      note: 'Venta de 25 corderos pesados carne (950 kg vivos) @ $3.700/kg vivo',
      isDemo: true
    },
    {
      id: 'demo-sale-maiz',
      date: '2026-05-10',
      area: 'maiz',
      reference: 'LIQ-GRANO-0001-00088910',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-maiz',
      campaignId: 'demo-camp-maiz',
      quantity: 200000,
      price: 270.00,
      fees: 1620000,
      tax: 5670000,
      retentions: 2700000,
      perceptions: 0,
      note: 'Venta parcial maíz: 200 t (200.000 kg) @ $270.000/t con entrega a acopio',
      isDemo: true
    },
    {
      id: 'demo-sale-soja',
      date: '2026-05-18',
      area: 'soja',
      reference: 'LIQ-SOJA-0001-00044120',
      partyId: 'demo-party-acopio',
      productId: 'demo-prod-soja',
      campaignId: 'demo-camp-soja',
      quantity: 70000,
      price: 520.00,
      fees: 1092000,
      tax: 3822000,
      retentions: 11648000,
      perceptions: 0,
      note: 'Venta parcial soja: 70 t (70.000 kg) @ $520.000/t con retenciones DEX 33%',
      isDemo: true
    }
  ];

  const payments = [
    // --- 2024 PAGOS Y COBROS ---
    {
      id: 'demo-pay-porc-cobro-24',
      date: '2024-04-26',
      sourceId: 'demo-sale-porcino-24',
      amount: 14000000,
      reference: 'REC-2024-00008450',
      note: 'Cobro transferencia venta capones 2024',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-cobro-24',
      date: '2024-05-20',
      sourceId: 'demo-sale-bovino-24',
      amount: 13500000,
      reference: 'REC-2024-00008890',
      note: 'Cobro liquidación 15 novillos 2024',
      isDemo: true
    },
    {
      id: 'demo-pay-ovi-cobro-24',
      date: '2024-05-28',
      sourceId: 'demo-sale-ovino-24',
      amount: 2150000,
      reference: 'REC-2024-00009120',
      note: 'Cobro liquidación 25 corderos carnicería 2024',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cobro-24',
      date: '2024-05-16',
      sourceId: 'demo-sale-maiz-24',
      amount: 28800000,
      reference: 'REC-2024-00055100',
      note: 'Cobro liquidación cerealera acopio 180 t maíz 2024',
      isDemo: true
    },
    {
      id: 'demo-pay-soja-cobro-24',
      date: '2024-05-25',
      sourceId: 'demo-sale-soja-24',
      amount: 16000000,
      reference: 'REC-2024-00031200',
      note: 'Cobro liquidación acopio 70 t soja 2024',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cosecha-24',
      date: '2024-04-20',
      sourceId: 'demo-cost-maiz-cosecha-23',
      amount: 7260000,
      reference: 'OP-2024-00003100',
      note: 'Pago trilla maíz 2024 contratista',
      isDemo: true
    },
    {
      id: 'demo-pay-soja-cosecha-24',
      date: '2024-05-10',
      sourceId: 'demo-cost-soja-cosecha-23',
      amount: 3388000,
      reference: 'OP-2024-00003250',
      note: 'Pago trilla soja 2024 contratista',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-sanidad-24',
      date: '2024-03-20',
      sourceId: 'demo-cost-bov-sanidad-24',
      amount: 1754500,
      reference: 'OP-2024-00071200',
      note: 'Pago veterinaria plan antiaftosa 2024',
      isDemo: true
    },

    // --- 2025 PAGOS Y COBROS ---
    {
      id: 'demo-pay-porc-cobro-25',
      date: '2025-04-26',
      sourceId: 'demo-sale-porcino-25',
      amount: 17500000,
      reference: 'REC-2025-00010150',
      note: 'Cobro transferencia venta capones 2025',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-cobro-25',
      date: '2025-05-20',
      sourceId: 'demo-sale-bovino-25',
      amount: 17000000,
      reference: 'REC-2025-00010880',
      note: 'Cobro liquidación 15 novillos 2025',
      isDemo: true
    },
    {
      id: 'demo-pay-ovi-cobro-25',
      date: '2025-05-28',
      sourceId: 'demo-sale-ovino-25',
      amount: 2800000,
      reference: 'REC-2025-00011240',
      note: 'Cobro liquidación 25 corderos carnicería 2025',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cobro-25',
      date: '2025-05-16',
      sourceId: 'demo-sale-maiz-25',
      amount: 39900000,
      reference: 'REC-2025-00067400',
      note: 'Cobro liquidación cerealera acopio 190 t maíz 2025',
      isDemo: true
    },
    {
      id: 'demo-pay-soja-cobro-25',
      date: '2025-05-25',
      sourceId: 'demo-sale-soja-25',
      amount: 21500000,
      reference: 'REC-2025-00038900',
      note: 'Cobro liquidación acopio 70 t soja 2025',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cosecha-25',
      date: '2025-04-22',
      sourceId: 'demo-cost-maiz-cosecha-24',
      amount: 8470000,
      reference: 'OP-2025-00003800',
      note: 'Pago trilla maíz 2025 contratista',
      isDemo: true
    },
    {
      id: 'demo-pay-soja-cosecha-25',
      date: '2025-05-08',
      sourceId: 'demo-cost-soja-cosecha-24',
      amount: 3872000,
      reference: 'OP-2025-00003920',
      note: 'Pago trilla soja 2025 contratista',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-sanidad-25',
      date: '2025-03-22',
      sourceId: 'demo-cost-bov-sanidad-25',
      amount: 2117500,
      reference: 'OP-2025-00079800',
      note: 'Pago veterinaria plan antiaftosa 2025',
      isDemo: true
    },

    // --- 2026 PAGOS Y COBROS (OFICIALES) ---
    {
      id: 'demo-pay-porc-cobro',
      date: '2026-04-25',
      sourceId: 'demo-sale-porcino',
      amount: 20000000,
      reference: 'REC-0001-00012480',
      note: 'Cobro transferencia bancaria frigorífico por liquidación capones',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-cobro',
      date: '2026-05-18',
      sourceId: 'demo-sale-bovino',
      amount: 20000000,
      reference: 'REC-0001-00012890',
      note: 'Cobro liquidación 15 novillos terminados a faena',
      isDemo: true
    },
    {
      id: 'demo-pay-ovi-cobro',
      date: '2026-05-25',
      sourceId: 'demo-sale-ovino',
      amount: 3500000,
      reference: 'REC-0001-00013050',
      note: 'Cobro liquidación carnicería 25 corderos pesados carne',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cobro',
      date: '2026-05-15',
      sourceId: 'demo-sale-maiz',
      amount: 50000000,
      reference: 'REC-0001-00088910',
      note: 'Cobro liquidación cerealera acopio 200 t maíz',
      isDemo: true
    },
    {
      id: 'demo-pay-soja-cobro',
      date: '2026-05-22',
      sourceId: 'demo-sale-soja',
      amount: 25000000,
      reference: 'REC-0001-00044120',
      note: 'Cobro liquidación acopio cooperativa 70 t soja',
      isDemo: true
    },
    {
      id: 'demo-pay-porc-sanidad',
      date: '2026-03-05',
      sourceId: 'demo-cost-porc-sanidad',
      amount: 1512500,
      reference: 'OP-0001-00004521',
      note: 'Pago veterinaria por vacunas e insumos sanitarios porcinos',
      isDemo: true
    },
    {
      id: 'demo-pay-bov-sanidad',
      date: '2026-04-10',
      sourceId: 'demo-cost-bov-sanidad',
      amount: 2541000,
      reference: 'OP-0001-00008812',
      note: 'Pago plan sanitario oficial SENASA antiaftosa',
      isDemo: true
    },
    {
      id: 'demo-pay-maiz-cosecha',
      date: '2026-04-20',
      sourceId: 'demo-cost-maiz-cosecha',
      amount: 10164000,
      reference: 'OP-0001-00004510',
      note: 'Pago contratista cosecha mecanizada maíz',
      isDemo: true
    }
  ];

  const prices = [
    // 2024
    {
      id: 'demo-price-porc-24',
      date: '2024-04-15',
      product: 'terminador',
      price: 1450,
      unit: 'kg',
      source: 'Mercado Agroganadero / CAPPCOR Córdoba',
      market: 'Faena directo Rosario/Río Cuarto',
      note: 'Capones 90-115 kg año 2024',
      isDemo: true
    },
    {
      id: 'demo-price-bov-24',
      date: '2024-05-10',
      product: 'engorde_bov',
      price: 2100,
      unit: 'kg',
      source: 'Mercado Agroganadero de Cañuelas / Río Cuarto',
      market: 'Novillos especiales pesados',
      note: 'Novillos 420 kg en pie año 2024',
      isDemo: true
    },
    {
      id: 'demo-price-ovi-24',
      date: '2024-05-15',
      product: 'corderos_faena',
      price: 2300,
      unit: 'kg',
      source: 'Cámara de Productores Ovinos de Córdoba (CAPOC)',
      market: 'Corderos pesados carne',
      note: 'Corderos Dorper 35-40 kg año 2024',
      isDemo: true
    },
    {
      id: 'demo-price-maiz-24',
      date: '2024-05-01',
      product: 'maiz',
      price: 160000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario/Río Cuarto',
      note: 'Maíz condición cámara año 2024',
      isDemo: true
    },
    {
      id: 'demo-price-soja-24',
      date: '2024-05-01',
      product: 'soja',
      price: 320000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario',
      note: 'Soja fábrica año 2024',
      isDemo: true
    },

    // 2025
    {
      id: 'demo-price-porc-25',
      date: '2025-04-15',
      product: 'terminador',
      price: 1850,
      unit: 'kg',
      source: 'Mercado Agroganadero / CAPPCOR Córdoba',
      market: 'Faena directo Rosario/Río Cuarto',
      note: 'Capones 90-115 kg año 2025',
      isDemo: true
    },
    {
      id: 'demo-price-bov-25',
      date: '2025-05-10',
      product: 'engorde_bov',
      price: 2700,
      unit: 'kg',
      source: 'Mercado Agroganadero de Cañuelas / Río Cuarto',
      market: 'Novillos especiales pesados',
      note: 'Novillos 420 kg en pie año 2025',
      isDemo: true
    },
    {
      id: 'demo-price-ovi-25',
      date: '2025-05-15',
      product: 'corderos_faena',
      price: 2950,
      unit: 'kg',
      source: 'Cámara de Productores Ovinos de Córdoba (CAPOC)',
      market: 'Corderos pesados carne',
      note: 'Corderos Dorper 35-40 kg año 2025',
      isDemo: true
    },
    {
      id: 'demo-price-maiz-25',
      date: '2025-05-01',
      product: 'maiz',
      price: 210000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario/Río Cuarto',
      note: 'Maíz condición cámara año 2025',
      isDemo: true
    },
    {
      id: 'demo-price-soja-25',
      date: '2025-05-01',
      product: 'soja',
      price: 410000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario',
      note: 'Soja fábrica año 2025',
      isDemo: true
    },

    // 2026
    {
      id: 'demo-price-porc',
      date: '2026-04-15',
      product: 'terminador',
      price: 2350,
      unit: 'kg',
      source: 'Mercado Agroganadero / CAPPCOR Córdoba',
      market: 'Faena directo Rosario/Río Cuarto',
      note: 'Capones 90-115 kg año 2026',
      isDemo: true
    },
    {
      id: 'demo-price-porc-fase4',
      date: '2026-04-15',
      product: 'fase4',
      price: 2350,
      unit: 'kg',
      source: 'Mercado Agroganadero / CAPPCOR Córdoba',
      market: 'Faena directo',
      note: 'Engorde terminación',
      isDemo: true
    },
    {
      id: 'demo-price-bov',
      date: '2026-05-10',
      product: 'engorde_bov',
      price: 3400,
      unit: 'kg',
      source: 'Mercado Agroganadero de Cañuelas / Río Cuarto',
      market: 'Novillos especiales pesados',
      note: 'Novillos 420 kg en pie',
      isDemo: true
    },
    {
      id: 'demo-price-ovi',
      date: '2026-05-15',
      product: 'corderos_faena',
      price: 3700,
      unit: 'kg',
      source: 'Cámara de Productores Ovinos de Córdoba (CAPOC)',
      market: 'Corderos pesados carne',
      note: 'Corderos Dorper 35-40 kg',
      isDemo: true
    },
    {
      id: 'demo-price-maiz',
      date: '2026-05-01',
      product: 'maiz',
      price: 270000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario/Río Cuarto',
      note: 'Maíz condición cámara',
      isDemo: true
    },
    {
      id: 'demo-price-soja',
      date: '2026-05-01',
      product: 'soja',
      price: 520000,
      unit: 'tonelada',
      source: 'Pizarra Rosario - Cámara Arbitral de Cereales',
      market: 'Disponible Rosario',
      note: 'Soja fábrica',
      isDemo: true
    }
  ];

  const scenarios = [
    {
      id: 'demo-scenario-2024',
      date: '2024-05-15',
      savedAt: '2024-05-15T10:00:00Z',
      tonnes: 50,
      grainSell: 160000,
      sellFreight: 10000,
      sellFees: 5000,
      replacement: 165000,
      purchaseFreight: 8000,
      pigPrice: 1450,
      ica: 2.80,
      grainShare: 72,
      otherFeedKg: 280,
      otherCost: 280000,
      days: 75,
      annualRate: 48,
      mortality: 2.2,
      note: 'Escenario comparativo 2024: Maíz propio vs transformación en capones',
      isDemo: true
    },
    {
      id: 'demo-scenario-2025',
      date: '2025-05-15',
      savedAt: '2025-05-15T10:00:00Z',
      tonnes: 55,
      grainSell: 210000,
      sellFreight: 12000,
      sellFees: 6500,
      replacement: 215000,
      purchaseFreight: 10000,
      pigPrice: 1850,
      ica: 2.80,
      grainShare: 72,
      otherFeedKg: 320,
      otherCost: 360000,
      days: 75,
      annualRate: 45,
      mortality: 2.4,
      note: 'Escenario comparativo 2025: Maíz propio vs transformación en capones',
      isDemo: true
    },
    {
      id: 'demo-scenario-2026',
      date: '2026-05-15',
      savedAt: '2026-05-15T10:00:00Z',
      tonnes: 60,
      grainSell: 270000,
      sellFreight: 15000,
      sellFees: 8000,
      replacement: 275000,
      purchaseFreight: 12000,
      pigPrice: 2350,
      ica: 2.85,
      grainShare: 72,
      otherFeedKg: 350,
      otherCost: 450000,
      days: 75,
      annualRate: 42,
      mortality: 2.5,
      note: 'Escenario comparativo 2026: Maíz propio vs transformación en carne porcina',
      isDemo: true
    }
  ];

  return {
    parties,
    products,
    campaigns,
    lots,
    sows,
    births,
    movements,
    costs,
    stock,
    transfers,
    sales,
    payments,
    prices,
    allocations: [],
    entries: [],
    closings: [],
    scenarios,
    imports: []
  };
}

// Test validation
const dataset = buildDataset();
const initialDb = D.initial();

for (const [table, records] of Object.entries(dataset)) {
  if (!initialDb[table]) initialDb[table] = [];
  initialDb[table].push(...records);
}

console.log('Testing replay up to 2026-12-31...');
const replayState = D.replay(initialDb, '2026-12-31');
console.log('Replay errors:', replayState.errors);
if (replayState.errors.length > 0) {
  process.exit(1);
}

console.log('Testing results across periods:');
const r2024 = D.results(initialDb, '2024-01-01', '2024-12-31');
console.log('2024 Results:');
console.log('  Cerdos rev:', r2024.areas.cerdos.revenue, 'Bovinos rev:', r2024.areas.bovinos.revenue, 'Ovinos rev:', r2024.areas.ovinos.revenue);
console.log('  Maíz rev:', r2024.areas.maiz.revenue, 'Soja rev:', r2024.areas.soja.revenue);

const r2025 = D.results(initialDb, '2025-01-01', '2025-12-31');
console.log('2025 Results:');
console.log('  Cerdos rev:', r2025.areas.cerdos.revenue, 'Bovinos rev:', r2025.areas.bovinos.revenue, 'Ovinos rev:', r2025.areas.ovinos.revenue);
console.log('  Maíz rev:', r2025.areas.maiz.revenue, 'Soja rev:', r2025.areas.soja.revenue);

const r2026 = D.results(initialDb, '2026-01-01', '2026-12-31');
console.log('2026 Results:');
console.log('  Cerdos rev:', r2026.areas.cerdos.revenue, 'Bovinos rev:', r2026.areas.bovinos.revenue, 'Ovinos rev:', r2026.areas.ovinos.revenue);
console.log('  Maíz rev:', r2026.areas.maiz.revenue, 'Soja rev:', r2026.areas.soja.revenue);

console.log('Testing indicators 2026:');
const ind2026 = D.indicators(initialDb, '2026-01-01', '2026-12-31');
console.log('  Alive:', ind2026.alive, 'Weaned:', ind2026.weaned, 'Deaths:', ind2026.deaths, 'Mortality %:', ind2026.mortality);
for (const row of ind2026.rows) {
  if (['demo-lot-porc-engorde', 'demo-lot-bov-engorde', 'demo-lot-ovi-recria'].includes(row.lot.id)) {
    console.log(`  Lot: ${row.lot.name} | Gain: ${row.gain} | Consumed: ${row.consumed} | ICA: ${row.ica} | Daily: ${row.daily} | Reason: ${row.reason}`);
  }
}

console.log('\nTesting Semaphore Engine indicators for 2026:');
const sem2026 = Semaphore.computeAllIndicators(initialDb, '2026-01-01', '2026-12-31');
let grayCount26 = 0;
for (const ind of sem2026) {
  console.log(`  ${ind.name} [${ind.module}]: ${ind.formattedValue} | State: ${ind.state} (${ind.stateLabel})`);
  if (ind.state === 'gray') grayCount26++;
}
console.log(`Total semaphore indicators 2026: ${sem2026.length}, Gray: ${grayCount26}`);

console.log('\nTesting Semaphore Engine indicators for entire 2024-2026:');
const semAll = Semaphore.computeAllIndicators(initialDb, '2024-01-01', '2026-12-31');
let grayCountAll = 0;
for (const ind of semAll) {
  if (ind.state === 'gray') {
    console.log(`  GRAY: ${ind.name} [${ind.module}]: ${ind.explanation}`);
    grayCountAll++;
  }
}
console.log(`Total semaphore indicators all periods: ${semAll.length}, Gray: ${grayCountAll}`);

console.log('Testing stock levels:');
console.log('  Maiz silo 2026:', replayState.stock['demo-prod-maiz|maiz|demo-camp-maiz']?.quantity);
console.log('  Soja silo 2026:', replayState.stock['demo-prod-soja|soja|demo-camp-soja']?.quantity);

console.log('Testing active lots heads:');
const activeLots = Object.values(replayState.lots);
console.log('  Active lots count:', activeLots.length);
const totalHeads = activeLots.reduce((acc, l) => acc + (l.quantity || 0), 0);
console.log('  Total animal heads:', totalHeads);

console.log('\nDataset test completed successfully!');
