'use strict';

/**
 * ERP Agropecuario Establecimiento Pozo del Carril - UNRC
 * Motor Isomorfo de Ayuda, Guía Interactiva y Notificaciones (Modificación N.º 12)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UNRCHelp = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // 1. DICCIONARIO DE AYUDA CONTEXTUAL PARA FORMULARIOS Y CAMPOS
  const CONTEXTUAL_HELP = {
    // Agricultura
    hectares: {
      field: 'hectares',
      title: 'Superficie Sembrada',
      unit: 'Hectáreas (ha)',
      purpose: 'Superficie efectiva de labor agrícola correspondiente a la parcela o lote de campaña.',
      format: 'Número decimal no negativo (ej. 120,50 ha).',
      example: '75,00 ha para maíz de primera en Potrero Norte.',
      relations: 'Determina el cálculo automático de costo por hectárea ($/ha), rinde promedio y margen bruto.'
    },
    yield: {
      field: 'yield',
      title: 'Rendimiento Agrícola',
      unit: 'Quintales por hectárea (qq/ha) o Toneladas por hectárea (t/ha)',
      purpose: 'Productividad física de cosecha obtenida por unidad de superficie.',
      format: 'Decimal no negativo (1 qq = 100 kg; 1 t = 10 qq = 1.000 kg).',
      example: '92,5 qq/ha (equivalente a 9.250 kg/ha o 9,25 t/ha en maíz).',
      relations: 'Se evalúa contra el objetivo del plan agrícola en el semáforo de rendimientos.'
    },
    harvestTons: {
      field: 'harvestTons',
      title: 'Producción Cosechada',
      unit: 'Toneladas métricas (t) / Kilogramos (kg)',
      purpose: 'Volumen físico total recolectado de la parcela que ingresa a silos o acopio.',
      format: 'Decimal en toneladas (1 t = 1.000 kg).',
      example: '450,00 t cosechadas en campaña 2025/2026.',
      relations: 'Impacta directamente en el stock de granos y en el costo por tonelada producida ($/t).'
    },
    density: {
      field: 'density',
      title: 'Densidad de Siembra',
      unit: 'Plantas por hectárea (pl/ha) o kg/ha de semilla',
      purpose: 'Población vegetal objetivo establecida para la variedad sembrada.',
      format: 'Entero o decimal positivo.',
      example: '72.000 pl/ha en maíz bajo riego; 65 kg/ha en soja.',
      relations: 'Monitoreo técnico agronómico de implantación del cultivo.'
    },
    fertilization: {
      field: 'fertilization',
      title: 'Fertilización y Fitosanitarios',
      unit: 'kg/ha o L/ha según producto',
      purpose: 'Dosis de nutrientes y defensivos agrícolas aplicados al lote.',
      format: 'Texto descriptivo con dosis técnica.',
      example: '150 kg/ha Urea + 2,5 L/ha Glifosato 66%.',
      relations: 'Se imputa como costo directo del cultivo y genera salidas de stock de insumos.'
    },

    // Ganadería (Porcinos, Bovinos, Ovinos)
    animals: {
      field: 'animals',
      title: 'Cabezas de Hacienda',
      unit: 'Cabezas (cab)',
      purpose: 'Recuento físico de animales vivos del lote, tropa o movimiento.',
      format: 'Número entero positivo mayor que cero.',
      example: '140 cabezas en lote de Terminación Porcina.',
      relations: 'Actualiza el inventario biológico y la base de prorrateo del plantel reproductor.'
    },
    weight: {
      field: 'weight',
      title: 'Peso Promedio por Cabeza',
      unit: 'Kilogramos por cabeza (kg/cab)',
      purpose: 'Peso individual medio representativo de la tropa o lote.',
      format: 'Número decimal positivo.',
      example: '112,50 kg/cab en porcinos listos para faena; 380,00 kg/cab en novillos.',
      relations: 'Calcula el peso total del lote y la ganancia diaria de peso (GDP).'
    },
    openingValue: {
      field: 'openingValue',
      title: 'Valor Contable de Apertura',
      unit: 'Pesos Argentinos (ARS)',
      purpose: 'Valuación inicial patrimonial del lote de hacienda al momento de su apertura.',
      format: 'Importe monetario en pesos con centavos.',
      example: '$ 4.500.000,00 acreditados a cuenta de bienes de cambio.',
      relations: 'Genera el asiento contable de apertura y la base para el costo de hacienda vendida.'
    },
    withdrawalDays: {
      field: 'withdrawalDays',
      title: 'Período de Carencia Sanitaria',
      unit: 'Días corridos (días)',
      purpose: 'Tiempo obligatorio de restricción entre la aplicación del medicamento veterinario y la faena.',
      format: 'Número entero (0 si no requiere carencia).',
      example: '14 días de carencia para antibiótico inyectable.',
      relations: 'El sistema bloquea automáticamente la venta a faena si el lote se encuentra en carencia activa.'
    },
    toLotId: {
      field: 'toLotId',
      title: 'Lote de Destino (Traslado)',
      unit: 'Identificador de Lote',
      purpose: 'Lote o fase receptora de los animales trasladados dentro del ciclo cerrado.',
      format: 'Selección de lote existente en la misma especie.',
      example: 'Traslado de Lote Maternidad #4 a Lote Recría #2.',
      relations: 'Transfiere animales, peso acumulado y costo zootécnico proporcional sin duplicar existencias.'
    },

    // Comercial y Transferencias
    opportunityPrice: {
      field: 'opportunityPrice',
      title: 'Valor Neto de Realización (VNR)',
      unit: 'ARS por kilogramo ($/kg)',
      purpose: 'Cotización de mercado de cereal propio transferido a ganadería, neto de gastos de venta.',
      format: 'Precio por kilogramo con dos decimales.',
      example: '$ 210,50 / kg según cotización pizarra Rosario neta de flete y comisión.',
      relations: 'Valúa la transferencia como costo para Ganadería e ingreso para Agricultura sin duplicar resultado consolidado.'
    },
    price: {
      field: 'price',
      title: 'Precio Unitario Pactado',
      unit: 'ARS por unidad de medida ($/kg, $/t o $/cab)',
      purpose: 'Precio neto convenido en la operación comercial de compra o venta.',
      format: 'Número decimal positivo.',
      example: '$ 2.250,00 / kg vivo de capón faena.',
      relations: 'Determina el subtotal de la venta o compra antes de impuestos y retenciones.'
    },
    unitCost: {
      field: 'unitCost',
      title: 'Costo Unitario de Insumo',
      unit: 'ARS por unidad de medida ($/kg, $/L, $/bolsa)',
      purpose: 'Costo de adquisición o reposición unitario del bien inventariable.',
      format: 'Decimal no negativo.',
      example: '$ 420,00 / kg de concentrado proteico.',
      relations: 'Valúa las salidas por consumo hacia los lotes y el saldo patrimonial en almacén.'
    },
    kgPerBag: {
      field: 'kgPerBag',
      title: 'Factor Kilos por Bolsa',
      unit: 'Kilogramos (kg)',
      purpose: 'Factor de conversión para insumos comerciales fraccionados en bolsas.',
      format: 'Decimal positivo (típicamente 25, 40 o 50 kg).',
      example: '40 kg por bolsa de alimento balanceado.',
      relations: 'Permite ingresar consumos en bolsas y convertirlos automáticamente a kg para balance.'
    },

    // Contabilidad y Finanzas
    reference: {
      field: 'reference',
      title: 'Comprobante y Respaldo Documental',
      unit: 'Cadena alfanumérica',
      purpose: 'Identificación formal del documento que respalda la operación (Factura, Remito, DTA, Liquidación).',
      format: 'Formato AFIP o interno (ej. FC-A 0001-00004521 o DTA-2026-9981).',
      example: 'LIQ-GRANOS-0004-88912.',
      relations: 'Se vincula a la pista de auditoría inmutable y al libro diario.'
    },
    lines: {
      field: 'lines',
      title: 'Partidas Contables (Debe y Haber)',
      unit: 'Cuentas contables e importes ($)',
      purpose: 'Imputación contable formal respetando el principio universal de partida doble.',
      format: 'Cuentas imputadas con importes balanceados al centavo (Suma Debe = Suma Haber).',
      example: 'Débito a 1.1.01 Caja y bancos / Crédito a 4.3.01 Ventas porcinas.',
      relations: 'Genera el asiento en el Libro Diario General y actualiza los Mayores contables.'
    },
    area: {
      field: 'area',
      title: 'Actividad / Unidad de Negocio',
      unit: 'Clasificación de centro de costos',
      purpose: 'Identifica a qué actividad productiva se imputa la operación económica o biológica.',
      format: 'Selección: Porcinos, Bovinos, Ovinos, Maíz, Soja o Compartido (distribuir).',
      example: 'Porcinos (Cerdos).',
      relations: 'Permite la segmentación de costos, márgenes brutos e indicadores por unidad de negocio.'
    }
  };

  // 2. ETAPAS DEL RECORRIDO GUIADO POR MÓDULOS (7 ETAPAS)
  const TOUR_STAGES = [
    {
      id: 'stage_general',
      stageNumber: 1,
      title: 'Etapa 1 — Panel General y Tablero Ejecutivo',
      view: 'general',
      targetSelector: '#kpiBanner',
      allowedRoles: ['*'],
      subtitle: 'Visión consolidada y control de gestión en tiempo real',
      description: 'El Panel General reúne los indicadores clave del establecimiento: ingresos devengados, costos consolidados, margen operativo (ROI), recuento total de cabezas ganaderas, toneladas de cereal en silo y superficie productiva. Desde aquí también podés monitorear la cotización oficial del Banco Nación (BNA) y el estado de sincronización con la base central.',
      tips: [
        'Hacé clic en la tarjeta de Semáforo de Alertas para abrir el centro de advertencias operativas.',
        'La barra superior contiene botones de acceso rápido para registrar Lotes, Ventas, Costos y Sanidad.',
        'Los valores monetarios se visualizan en moneda dual (USD y ARS) según la preferencia seleccionada.'
      ]
    },
    {
      id: 'stage_agricultura',
      stageNumber: 2,
      title: 'Etapa 2 — Producción Agrícola (Maíz y Soja)',
      view: 'maiz',
      targetSelector: '#mainNav [data-nav-group="agricultura"]',
      allowedRoles: ['admin', 'responsable_agricultura', 'analista', 'auditor'],
      subtitle: 'Gestión por campañas, parcelas, rendimientos e insumos',
      description: 'El sector Agrícola administra las campañas de Maíz (primera y segunda ocupación) y Soja. Permite registrar las labores agronómicas, siembra, fertilización, tratamientos fitosanitarios y la cosecha física en toneladas. Además, gestiona las transferencias de cereal propio hacia la piara y corrales ganaderos valuadas a valor neto de realización.',
      tips: [
        'En la pestaña "Indicadores y Semáforos" de cada cultivo podés evaluar el cumplimiento del rinde objetivo.',
        'El módulo "Destino del cereal" permite simular y comparar la rentabilidad de vender grano vs. transformarlo en carne.',
        'Todas las superficies se expresan en hectáreas (ha) y los rindes en quintales (qq/ha) o toneladas (t/ha).'
      ]
    },
    {
      id: 'stage_ganaderia',
      stageNumber: 3,
      title: 'Etapa 3 — Producción Ganadera (Porcinos, Bovinos y Ovinos)',
      view: 'cerdos',
      targetSelector: '#mainNav [data-nav-group="ganaderia"]',
      allowedRoles: ['admin', 'responsable_ganaderia', 'responsable_cerdos', 'analista', 'auditor'],
      subtitle: 'Trazabilidad biológica, pesajes, ganancias de peso y sanidad',
      description: 'Contempla las tres especies pecuarias del establecimiento: Porcinos (ciclo cerrado semi-intensivo: Cría, Recría y Terminación), Bovinos de carne y Ovinos en transición racial a Dorper. Registra aperturas de lotes, pesajes periódicos, traslados entre fases, mortandad, índice de conversión alimenticia (ICA) y seguimiento veterinario con bloqueo de faena.',
      tips: [
        'La ficha sanitaria bloquea automáticamente la venta a faena de lotes que tengan períodos de carencia vigentes.',
        'Los pesajes calculan automáticamente la Ganancia Diaria de Peso (GDP en kg/día y g/día).',
        'El cálculo del ICA concilia únicamente consumos de ración y aumentos de peso del mismo lote y período.'
      ]
    },
    {
      id: 'stage_comercial',
      stageNumber: 4,
      title: 'Etapa 4 — Gestión Comercial, Compras y Existencias',
      view: 'ventas',
      targetSelector: '#mainNav [data-nav-group="comercial"]',
      allowedRoles: ['admin', 'analista', 'operador', 'auditor'],
      subtitle: 'Compras de insumos, liquidaciones de ventas y stock de almacén',
      description: 'Centraliza las relaciones con proveedores y clientes comerciales. Permite asentar compras de semillas, agroquímicos y balanceados con desglose de IVA crédito fiscal, y emitir liquidaciones de venta de hacienda y granos con retenciones, fletes y comisiones. El módulo de existencias monitorea inventarios y advierte cuando el stock cae bajo la reserva de seguridad.',
      tips: [
        'Al registrar compras podés ingresar insumos fraccionados en bolsas y el sistema computará los kilogramos exactos.',
        'El libro de ventas permite identificar destinos de hacienda (Faena en frigorífico o Invernada).',
        'Podés exportar en cualquier momento las planillas comerciales a formato CSV o Microsoft Excel (.xlsx).'
      ]
    },
    {
      id: 'stage_contabilidad',
      stageNumber: 5,
      title: 'Etapa 5 — Contabilidad y Tesorería Integrada',
      view: 'contabilidad',
      targetSelector: '#mainNav [data-nav-group="gestion"]',
      allowedRoles: ['admin', 'analista', 'auditor'],
      subtitle: 'Partida doble automática, libro diario y conciliación financiera',
      description: 'El ERP implementa el Plan de Cuentas formal de la UNRC de 48 rubros y 19 cuentas analíticas agropecuarias. Cada comprobante operativo genera automáticamente un asiento por partida doble balanceado al centavo. La tesorería administra cobranzas, órdenes de pago a proveedores y diferencia el resultado económico del flujo financiero de caja.',
      tips: [
        'El sistema distingue estrictamente entre ganancia devengada (resultado económico) y disponibilidad en efectivo (caja).',
        'Podés consultar el Libro Diario General, Mayores por cuenta y descargar el Balance en Excel.',
        'Los cierres de ejercicio bloquean modificaciones retroactivas para resguardar la inmutabilidad contable.'
      ]
    },
    {
      id: 'stage_indicadores',
      stageNumber: 6,
      title: 'Etapa 6 — Indicadores y Semaforización de Control',
      view: 'modelo',
      targetSelector: '#mainNav [data-nav-group="informes"]',
      allowedRoles: ['*'],
      subtitle: 'Evaluación gerencial en 4 estados: Verde, Amarillo, Rojo y Gris',
      description: 'Incorpora el sistema de semaforización de 28 indicadores productivos, comerciales y financieros: Verde (Normal / En objetivo), Amarillo (Atención / Desvío moderado), Rojo (Crítico / Requiere revisión) y Gris (Sin Datos suficientes para el cálculo, detallando qué registro falta). Los umbrales son configurables dinámicamente por el Administrador.',
      tips: [
        'Cada semáforo muestra valor registrado, meta u objetivo, período evaluado y motivo del desvío.',
        'El motor contempla sentidos de evaluación específicos: mayor es mejor (rindes), menor es mejor (costos, mortandad) o rango óptimo (pesos).',
        'Si un indicador carece de datos (estado Gris), nunca arroja un error técnico; orienta sobre el registro faltante.'
      ]
    },
    {
      id: 'stage_admin',
      stageNumber: 7,
      title: 'Etapa 7 — Administración, Seguridad y Centro de Ayuda',
      view: 'ayuda',
      targetSelector: '#mainNav .nav-drop-item[data-view="ayuda"]',
      allowedRoles: ['*'],
      subtitle: 'Centro de ayuda permanente, roles RBAC y copias de respaldo',
      description: 'El sistema garantiza el control interno mediante 7 roles de acceso diferenciados (Administrador, Responsables de Unidad, Analista, Operador y Auditor). Los administradores pueden gestionar usuarios, restaurar respaldos y configurar umbrales. El Centro de Ayuda permanece siempre accesible para consultar guías, preguntas frecuentes o reiniciar este recorrido.',
      tips: [
        'Las contraseñas están protegidas con algoritmo criptográfico PBKDF2/SHA-256 a 100.000 iteraciones.',
        'Podés descargar copias de respaldo (.json con firma SHA-256) y el libro de datos consolidado en Excel de 13 hojas.',
        'Para cerrar tu sesión de forma segura, utilizá el botón correspondiente en la barra superior derecha.'
      ]
    }
  ];

  // 3. PREGUNTAS FRECUENTES (FAQ)
  const HELP_FAQ = [
    {
      id: 'faq_1',
      question: '¿Cómo registro una nueva operación en el sistema?',
      answer: 'Podés registrar operaciones de dos formas: mediante los botones de acceso rápido situados en la barra superior (+ Lote, + Venta, + Costo, + Sanidad), o bien navegando al módulo correspondiente (por ejemplo: Comercial > Ventas) y presionando el botón "Nueva venta" o "Nuevo registro". Completá los campos solicitados en el formulario interactivo; los campos con ícono ℹ ofrecen ayuda contextual sobre formato y unidad de medida requerida.'
    },
    {
      id: 'faq_2',
      question: '¿Cómo consulto la información histórica y los movimientos previos?',
      answer: 'En cada pantalla del sistema encontrás filtros por fecha ("Desde" y "Hasta") en la cabecera. Al ajustar este período, todas las tablas, resúmenes, consumos y gráficos se actualizan de forma automática para reflejar con precisión el período seleccionado. Si deseás buscar una partida o comprobante específico, utilizá el cuadro de búsqueda rápida.'
    },
    {
      id: 'faq_3',
      question: '¿Cómo exporto los datos del ERP para auditoría o trabajo de campo?',
      answer: 'El sistema ofrece múltiples opciones de exportación: 1) En cada tabla operativa contás con el botón "Exportar CSV" para descargar datos tabulares directos; 2) En el módulo de Informes o Gestión podés descargar el Libro de Trabajo Completo en Microsoft Excel (.xlsx), que consolida 13 hojas de cálculo normalizadas con toda la historia contable, lotes y auditoría; 3) El botón "Imprimir reporte" genera una versión de lectura limpia y adaptada a hojas A4.'
    },
    {
      id: 'faq_4',
      question: '¿Cómo interpreto los indicadores productivos y económicos?',
      answer: 'Cada indicador compara el valor obtenido en el período contra un estándar técnico u objetivo del plan productivo. Los indicadores agronómicos informan rendimiento en kg/ha y t/ha y costo por hectárea; los indicadores ganaderos reflejan existencias, mortandad, GDP (kg/día) e ICA (conversión alimenticia); los comerciales y financieros reflejan facturación, márgenes y cuentas a cobrar. Cada tarjeta detalla el valor, la unidad estandarizada y la meta de comparación.'
    },
    {
      id: 'faq_5',
      question: '¿Qué significan los cuatro colores de los semáforos de gestión?',
      answer: 'El sistema utiliza un modelo de semaforización de 4 niveles: VERDE (Situación Normal: indicador dentro del rango esperado u objetivo alcanzado); AMARILLO (Atención: desviación moderada respecto de la meta que requiere seguimiento); ROJO (Crítico: desviación significativa que demanda intervención gerencial u operativa inmediata); y GRIS (Sin Datos: registros insuficientes para realizar el cálculo matemático, indicando con claridad qué comprobante o dato falta cargar).'
    },
    {
      id: 'faq_6',
      question: '¿Qué hago si un indicador aparece en gris o un dato no se visualiza?',
      answer: 'El estado gris es un estado neutral de protección que previene lecturas erróneas. Al hacer clic o consultar la tarjeta en gris, el sistema te informará con exactitud el motivo (por ejemplo: "Sin datos de pesajes para calcular GDP" o "Sin consumo de alimento registrado en este lote"). Una vez cargados los comprobantes correspondientes a ese período, el semáforo cambiará automáticamente a su color de evaluación.'
    },
    {
      id: 'faq_7',
      question: '¿Cómo consulto mis permisos y facultades dentro del sistema?',
      answer: 'Tu nombre y rol activo se encuentran indicados en la barra superior derecha (ej. "Administrador", "Responsable de Agricultura", "Auditor"). Si tu perfil tiene asignado un rol específico, el menú ocultará automáticamente las unidades o acciones no permitidas para tu perfil. Los usuarios con rol Auditor cuentan con acceso de lectura total a todos los módulos y balances, pero tienen bloqueada la creación, edición o anulación de registros.'
    },
    {
      id: 'faq_8',
      question: '¿Cómo vuelvo a iniciar la guía interactiva o el recorrido guiado?',
      answer: 'Podés iniciar el recorrido interactivo en cualquier momento ingresando a Gestión > Centro de Ayuda desde el menú principal, o haciendo clic en el botón de Ayuda de la barra superior. En la parte superior del Centro de Ayuda encontrarás el botón "Iniciar Recorrido Guiado", el cual activará nuevamente el asistente paso a paso sin afectar en absoluto tus registros ni tu trabajo actual.'
    }
  ];

  // 4. GESTIÓN DE PREFERENCIAS DE USUARIO
  function getStorageKey(userId) {
    const cleanId = String(userId || 'default').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return 'unrc_tour_pref_' + cleanId;
  }

  function getTourPrefs(userId, storageDriver = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!storageDriver) return { completed: false, dismissed: false, dontShowAgain: false, lastStep: 0 };
    try {
      const raw = storageDriver.getItem(getStorageKey(userId));
      if (!raw) return { completed: false, dismissed: false, dontShowAgain: false, lastStep: 0 };
      const parsed = JSON.parse(raw);
      return {
        completed: Boolean(parsed.completed),
        dismissed: Boolean(parsed.dismissed),
        dontShowAgain: Boolean(parsed.dontShowAgain),
        lastStep: Number(parsed.lastStep) || 0,
        updatedAt: parsed.updatedAt || null
      };
    } catch {
      return { completed: false, dismissed: false, dontShowAgain: false, lastStep: 0 };
    }
  }

  function saveTourPrefs(userId, prefs, storageDriver = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!storageDriver) return;
    try {
      const current = getTourPrefs(userId, storageDriver);
      const merged = {
        ...current,
        ...prefs,
        updatedAt: new Date().toISOString()
      };
      storageDriver.setItem(getStorageKey(userId), JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.warn('No se pudo guardar la preferencia de ayuda:', e);
    }
  }

  function resetTourPrefs(userId, storageDriver = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!storageDriver) return;
    try {
      storageDriver.removeItem(getStorageKey(userId));
    } catch (e) {
      console.warn('No se pudo reiniciar la preferencia de ayuda:', e);
    }
  }

  // 5. FILTRADO DE ETAPAS POR ROL DE USUARIO
  function filterStagesForRole(role) {
    const currentRole = String(role || 'operador').trim().toLowerCase();
    return TOUR_STAGES.filter(stage => {
      if (stage.allowedRoles.includes('*')) return true;
      if (currentRole === 'admin') return true;
      return stage.allowedRoles.includes(currentRole);
    });
  }

  // 6. CONSULTA DE AYUDA CONTEXTUAL
  function getFieldHelp(fieldName) {
    if (!fieldName) return null;
    return CONTEXTUAL_HELP[fieldName] || null;
  }

  // 7. FORMATO MULTINIVEL DE NOTIFICACIONES Y ALERTAS
  function formatAlertMessage(type, message, details = '') {
    const normalizedType = ['info', 'informacion', 'warning', 'advertencia', 'error', 'success', 'confirmacion'].includes(type) ? type : 'info';
    let category = 'info';
    let iconName = 'info';
    let badgeLabel = 'Información';

    if (normalizedType === 'success' || normalizedType === 'confirmacion') {
      category = 'success';
      iconName = 'circle-check';
      badgeLabel = 'Confirmación';
    } else if (normalizedType === 'warning' || normalizedType === 'advertencia') {
      category = 'warning';
      iconName = 'triangle-alert';
      badgeLabel = 'Advertencia';
    } else if (normalizedType === 'error') {
      category = 'error';
      iconName = 'circle-alert';
      badgeLabel = 'Error';
    }

    return {
      type: category,
      icon: iconName,
      badge: badgeLabel,
      message: String(message || '').trim(),
      details: String(details || '').trim(),
      timestamp: new Date().toISOString()
    };
  }

  return {
    CONTEXTUAL_HELP,
    TOUR_STAGES,
    HELP_FAQ,
    getTourPrefs,
    saveTourPrefs,
    resetTourPrefs,
    filterStagesForRole,
    getFieldHelp,
    formatAlertMessage
  };
});
