/**
 * ERP Establecimiento Pozo del Carril - UNRC
 * Módulo de Datos de Demostración y Prueba (Año 2026)
 *
 * Actividades modeladas:
 * 1. Porcinos (200 cabezas iniciales, compra 100 lechones ~20kg, venta 80 capones ~115kg @ $2.350/kg vivo)
 * 2. Bovinos (80 cabezas iniciales, ingreso 20 terneros, venta 15 novillos ~420kg @ $3.400/kg vivo)
 * 3. Ovinos (120 cabezas iniciales, 15 nacimientos, venta 25 corderos ~38kg @ $3.700/kg vivo)
 * 4. Maíz (40 ha, 9.500 kg/ha = 380 t, venta 200 t @ $270.000/t, transf. 60 t a ganadería, 120 t en silo)
 * 5. Soja (30 ha, 3.500 kg/ha = 105 t, venta 70 t @ $520.000/t con retenciones DEX, 35 t en silo)
 *
 * Características:
 * - Aislamiento estricto: todos los registros portan `isDemo: true`.
 * - Idempotencia: no duplica registros si se carga múltiples veces.
 * - Limpieza segura: elimina exclusivamente registros demo sin tocar datos reales, usuarios, cuentas ni configuración.
 */

(function (root) {
  'use strict';

  function getDemoDataset() {
    return {
      parties: [
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
          note: 'Acopio cerealero de la zona y proveedor de raciones/insumos agrícolas',
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
        }
      ],

      products: [
        {
          id: 'demo-prod-maiz',
          name: 'Grano de Maíz Propio',
          kind: 'grano',
          unit: 'kg',
          inventoryAccountId: '1.3.04.01',
          note: 'Maíz condición cámara cosechado en Pozo del Carril',
          isDemo: true
        },
        {
          id: 'demo-prod-soja',
          name: 'Grano de Soja 1ª Siembra',
          kind: 'grano',
          unit: 'kg',
          inventoryAccountId: '1.3.04.01',
          note: 'Soja propia cosechada en parcela norte',
          isDemo: true
        },
        {
          id: 'demo-prod-alim-porc',
          name: 'Alimento Balanceado Terminador Porcino',
          kind: 'alimento',
          unit: 'kg',
          phase: 'engorde_terminacion',
          inventoryAccountId: '1.3.04.01',
          note: 'Ración comercial balanceada 16% PB terminación capones',
          isDemo: true
        },
        {
          id: 'demo-prod-supl-bov',
          name: 'Suplemento Proteico Bovino Corral',
          kind: 'alimento',
          unit: 'kg',
          inventoryAccountId: '1.3.04.01',
          note: 'Concentrado proteico mineral para terminación novillos a corral',
          isDemo: true
        }
      ],

      campaigns: [
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
          note: 'Campaña Maíz: 40 ha, rinde 9.500 kg/ha (95 qq/ha) = 380 t totales',
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
          inoculation: 'Inoculante Bradyrhizobium',
          note: 'Campaña Soja: 30 ha, rinde 3.500 kg/ha (35 qq/ha) = 105 t totales',
          isDemo: true
        }
      ],

      lots: [
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
          weight: 85.0,
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
          weight: 360.0,
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
          weight: 26.0,
          openingValue: 2400000,
          destination: 'Engorde corderos pesados carne',
          note: '30 corderos para terminación a 38 kg',
          isDemo: true
        }
      ],

      sows: [
        {
          id: 'demo-sow-1',
          name: 'Madre Landrace Caravana 101',
          date: '2025-06-01',
          sex: 'madre',
          breed: 'Landrace F1',
          value: 850000,
          residual: 200000,
          lifeMonths: 36,
          note: 'Plantel reproductor porcino UNRC',
          isDemo: true
        },
        {
          id: 'demo-sow-2',
          name: 'Madre Yorkshire Caravana 102',
          date: '2025-06-01',
          sex: 'madre',
          breed: 'Yorkshire F1',
          value: 850000,
          residual: 200000,
          lifeMonths: 36,
          note: 'Plantel reproductor porcino UNRC',
          isDemo: true
        }
      ],

      births: [],

      movements: [
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
          date: '2026-04-10',
          type: 'pesaje',
          lotId: 'demo-lot-porc-engorde',
          quantity: 80,
          weight: 115.0,
          note: 'Pesaje completo previo a liquidación de 80 capones (115 kg)',
          isDemo: true
        },

        // BOVINOS
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
          date: '2026-05-10',
          type: 'pesaje',
          lotId: 'demo-lot-bov-engorde',
          quantity: 50,
          weight: 420.0,
          note: 'Pesaje control novillos terminados corral (420 kg)',
          isDemo: true
        },

        // OVINOS
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
      ],

      costs: [
        // PORCINOS
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

        // BOVINOS
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

        // OVINOS
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
        },

        // MAÍZ
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

        // SOJA
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
        }
      ],

      stock: [
        // COSECHAS
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

        // COMPRA Y CONSUMO DE ALIMENTO PORCINO
        {
          id: 'demo-stock-alim-porc-compra',
          date: '2026-02-20',
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
          id: 'demo-stock-alim-porc-consumo',
          date: '2026-03-20',
          type: 'consumo',
          area: 'cerdos',
          productId: 'demo-prod-alim-porc',
          lotId: 'demo-lot-porc-engorde',
          quantity: 18000,
          note: 'Consumo ración terminador lote capones',
          isDemo: true
        }
      ],

      transfers: [
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
      ],

      sales: [
        // PORCINOS: 80 capones ~115kg @ $2.350/kg vivo
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

        // BOVINOS: 15 novillos terminados ~420kg @ $3.400/kg vivo
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

        // OVINOS: 25 corderos terminados ~38kg @ $3.700/kg vivo
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

        // MAÍZ: Venta de 200 toneladas @ $270.000/t ($270/kg)
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

        // SOJA: Venta de 70 toneladas @ $520.000/t ($520/kg)
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
      ],

      payments: [
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
      ],

      prices: [
        {
          id: 'demo-price-porc',
          date: '2026-04-15',
          product: 'terminador',
          price: 2350,
          unit: 'kg',
          source: 'Mercado Agroganadero / CAPPCOR Córdoba',
          market: 'Faena directo Rosario/Río Cuarto',
          note: 'Capones 90-115 kg',
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
      ],

      allocations: [],
      entries: [],
      closings: [],

      scenarios: [
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
      ],

      imports: []
    };
  }

  function hasDemoData(db) {
    if (!db) return false;
    const tables = ['lots', 'campaigns', 'sales', 'costs', 'stock', 'parties', 'products'];
    return tables.some(t => (db[t] || []).some(r => r.isDemo === true || (typeof r.id === 'string' && r.id.startsWith('demo-'))));
  }

  function loadDemoData(db) {
    const next = structuredClone(db);
    const demo = getDemoDataset();

    for (const [table, records] of Object.entries(demo)) {
      if (!Array.isArray(next[table])) next[table] = [];
      for (const rec of records) {
        const existingIdx = next[table].findIndex(r => r.id === rec.id);
        if (existingIdx >= 0) {
          next[table][existingIdx] = { ...next[table][existingIdx], ...rec };
        } else {
          next[table].push(rec);
        }
      }
    }
    return next;
  }

  function cleanDemoData(db) {
    const next = structuredClone(db);
    const tables = ['parties', 'products', 'campaigns', 'lots', 'sows', 'births', 'movements', 'costs', 'stock', 'transfers', 'sales', 'payments', 'prices', 'allocations', 'entries', 'closings', 'scenarios', 'imports'];

    for (const table of tables) {
      if (Array.isArray(next[table])) {
        next[table] = next[table].filter(r => !(r.isDemo === true || (typeof r.id === 'string' && r.id.startsWith('demo-'))));
      }
    }
    return next;
  }

  const api = { getDemoDataset, hasDemoData, loadDemoData, cleanDemoData };
  root.UNRCDemo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
