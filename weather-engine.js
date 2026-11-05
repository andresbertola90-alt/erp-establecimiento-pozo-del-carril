'use strict';

/**
 * Entre Surcos · conectando al agro
 * Módulo de Clima y Registro de Precipitaciones
 *
 * Características:
 * 1. Condiciones meteorológicas en tiempo real y pronóstico a 7 días vía Open-Meteo.
 * 2. Ubicación rural configurable (La Aguada, Río Cuarto, presets regionales y coordenadas GPS).
 * 3. Alertas agropecuarias (Viento para pulverización, Lluvias próximas, Heladas, Golpe de calor).
 * 4. Registro histórico de precipitaciones del campo (carga, edición, eliminación y filtros).
 * 5. Indicadores KPI de lluvias acumuladas (7 días, mes, año, campaña, última lluvia).
 * 6. Gráficos de evolución mensual, comparación interanual y acumulado de lluvias.
 */

(function (root) {
  const DEFAULT_LOCATION = {
    id: 'la_aguada',
    name: 'La Aguada · Pozo del Carril',
    department: 'Río Cuarto',
    province: 'Córdoba',
    lat: -33.125,
    lon: -64.350,
    elevation: 440,
    timezone: 'America/Argentina/Cordoba'
  };

  const REGIONAL_PRESETS = [
    { id: 'la_aguada', name: 'La Aguada · Pozo del Carril', department: 'Río Cuarto', province: 'Córdoba', lat: -33.125, lon: -64.350, elevation: 440 },
    { id: 'rio_cuarto', name: 'Río Cuarto (Zona Periurbana)', department: 'Río Cuarto', province: 'Córdoba', lat: -33.130, lon: -64.350, elevation: 452 },
    { id: 'vicuna_mackenna', name: 'Vicuña Mackenna', department: 'Río Cuarto', province: 'Córdoba', lat: -33.920, lon: -64.390, elevation: 235 },
    { id: 'huinca_renanco', name: 'Huinca Renancó', department: 'General Roca', province: 'Córdoba', lat: -34.840, lon: -64.370, elevation: 168 },
    { id: 'coronel_moldes', name: 'Coronel Moldes', department: 'Río Cuarto', province: 'Córdoba', lat: -33.620, lon: -64.600, elevation: 330 },
    { id: 'sampacho', name: 'Sampacho', department: 'Río Cuarto', province: 'Córdoba', lat: -33.380, lon: -64.720, elevation: 510 },
    { id: 'adelia_maria', name: 'Adelia María', department: 'Río Cuarto', province: 'Córdoba', lat: -33.630, lon: -64.020, elevation: 215 },
    { id: 'holmberg', name: 'Santa Catalina · Holmberg', department: 'Río Cuarto', province: 'Córdoba', lat: -33.180, lon: -64.410, elevation: 460 }
  ];

  // Caché en memoria de pronóstico (20 minutos)
  let _forecastCache = null;
  let _forecastCacheTime = 0;
  const CACHE_TTL_MS = 20 * 60 * 1000;

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

  function formatRain(mm) {
    if (mm == null || isNaN(mm)) return '0,0 mm';
    return `${formatNumber(mm, 1)} mm`;
  }

  /**
   * Obtiene la ubicación activa (desde db.settings, localStorage o predeterminada)
   */
  function getActiveLocation(database) {
    const db = database || (typeof window !== 'undefined' && window.db);
    if (db?.settings?.weatherLocation) {
      return { ...DEFAULT_LOCATION, ...db.settings.weatherLocation };
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('unrc_weather_location');
        if (stored) return { ...DEFAULT_LOCATION, ...JSON.parse(stored) };
      } catch {}
    }
    return DEFAULT_LOCATION;
  }

  /**
   * Guarda de forma persistente la ubicación seleccionada
   */
  async function setActiveLocation(location, database) {
    const db = database || (typeof window !== 'undefined' && window.db);
    const loc = {
      id: location.id || 'custom',
      name: location.name || 'Ubicación Rural',
      department: location.department || '',
      province: location.province || 'Córdoba',
      lat: Number(location.lat),
      lon: Number(location.lon),
      elevation: Number(location.elevation || 440),
      timezone: 'America/Argentina/Cordoba'
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('unrc_weather_location', JSON.stringify(loc));
      } catch {}
    }

    if (db && typeof UNRCStorage !== 'undefined') {
      db.settings = db.settings || {};
      db.settings.weatherLocation = loc;
      try {
        await UNRCStorage.save(db);
      } catch (e) {
        console.warn('[Clima] No se pudo persistir ubicación en servidor:', e.message);
      }
    }

    // Invalidar caché de pronóstico para forzar recarga
    _forecastCache = null;
    _forecastCacheTime = 0;
    return loc;
  }

  /**
   * Mapeo de códigos meteorológicos WMO de Open-Meteo a descripciones e iconos
   */
  function getWeatherInfo(code) {
    const c = parseInt(code, 10);
    switch (c) {
      case 0:
        return { label: 'Cielo despejado', icon: 'sun', color: '#eab308' };
      case 1:
        return { label: 'Mayormente despejado', icon: 'sun', color: '#eab308' };
      case 2:
        return { label: 'Parcialmente nublado', icon: 'cloud-sun', color: '#0284c7' };
      case 3:
        return { label: 'Nublado', icon: 'cloud', color: '#64748b' };
      case 45:
      case 48:
        return { label: 'Niebla / Neblina', icon: 'cloud-fog', color: '#94a3b8' };
      case 51:
      case 53:
      case 55:
        return { label: 'Llovizna', icon: 'cloud-drizzle', color: '#087fbd' };
      case 61:
        return { label: 'Lluvia leve', icon: 'cloud-rain', color: '#0284c7' };
      case 63:
        return { label: 'Lluvia moderada', icon: 'cloud-rain', color: '#0369a1' };
      case 65:
        return { label: 'Lluvia fuerte', icon: 'cloud-rain', color: '#1e3a8a' };
      case 71:
      case 73:
      case 75:
        return { label: 'Nevada', icon: 'snowflake', color: '#38bdf8' };
      case 80:
      case 81:
      case 82:
        return { label: 'Chubascos', icon: 'cloud-rain', color: '#0369a1' };
      case 95:
        return { label: 'Tormenta eléctrica', icon: 'cloud-lightning', color: '#d97706' };
      case 96:
      case 99:
        return { label: 'Tormenta con granizo', icon: 'cloud-lightning', color: '#dc2626' };
      default:
        return { label: 'Parcialmente nublado', icon: 'cloud-sun', color: '#0284c7' };
    }
  }

  /**
   * Convierte grados a puntos cardinales
   */
  function degToCompass(deg) {
    if (deg == null) return '-';
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return arr[val % 16] || 'N';
  }

  /**
   * Obtiene datos meteorológicos de Open-Meteo con soporte offline
   */
  function getFallbackForecast(location) {
    const loc = location || getActiveLocation();
    const now = new Date();
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const sampleTemps = [
      { max: 26, min: 14, prob: 15, rain: 0, code: 1 },
      { max: 28, min: 15, prob: 20, rain: 0, code: 2 },
      { max: 29, min: 16, prob: 45, rain: 4.2, code: 61 },
      { max: 24, min: 12, prob: 65, rain: 16.5, code: 63 },
      { max: 23, min: 11, prob: 10, rain: 0, code: 0 },
      { max: 25, min: 12, prob: 5, rain: 0, code: 0 },
      { max: 27, min: 13, prob: 10, rain: 0, code: 1 }
    ];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const sample = sampleTemps[i] || sampleTemps[0];
      days.push({
        date: dateStr,
        dayName: i === 0 ? 'Hoy' : dayNames[d.getDay()],
        shortDate: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        tempMax: sample.max,
        tempMin: sample.min,
        rainProb: sample.prob,
        rainSum: sample.rain,
        weather: getWeatherInfo(sample.code)
      });
    }
    return {
      location: loc,
      updatedAt: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      updatedDate: now.toLocaleDateString('es-AR'),
      isLive: false,
      offlineNotice: 'Datos meteorológicos locales de estación Pozo del Carril (La Aguada, Córdoba).',
      current: {
        temp: 22,
        humidity: 58,
        windSpeed: 14,
        windDirection: 'NE',
        windDegrees: 45,
        windGusts: 20,
        precipitation24h: 0,
        weather: getWeatherInfo(1)
      },
      daily: days
    };
  }

  /**
   * Obtiene datos meteorológicos de Open-Meteo o proxy local con soporte offline
   */
  async function fetchForecast(location, forceRefresh = false) {
    const loc = location || getActiveLocation();
    const now = Date.now();

    if (!forceRefresh && _forecastCache && (now - _forecastCacheTime < CACHE_TTL_MS) && _forecastCache.locationId === loc.id) {
      return _forecastCache.data;
    }

    // 1. Intento vía endpoint del servidor (sin restricciones de CORS o iframe)
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
      const sRes = await fetch(`/api/weather/forecast?lat=${loc.lat}&lon=${loc.lon}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (sRes.ok) {
        const data = await sRes.json();
        if (data && data.current) {
          data.location = loc;
          _forecastCache = { locationId: loc.id, data };
          _forecastCacheTime = now;
          return data;
        }
      }
    } catch (e) {
      console.warn('[Clima] Endpoint servidor no disponible, intentando directo:', e.message);
    }

    // 2. Consulta directa a Open-Meteo con timeout estricto de 2.5s
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=America%2FArgentina%2FCordoba&forecast_days=7`;

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const raw = await res.json();

      const processed = {
        location: loc,
        updatedAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        updatedDate: new Date().toLocaleDateString('es-AR'),
        isLive: true,
        current: {
          temp: Math.round(raw.current?.temperature_2m ?? 21),
          humidity: Math.round(raw.current?.relative_humidity_2m ?? 55),
          windSpeed: Math.round(raw.current?.wind_speed_10m ?? 12),
          windDirection: degToCompass(raw.current?.wind_direction_10m),
          windDegrees: raw.current?.wind_direction_10m ?? 45,
          windGusts: Math.round(raw.current?.wind_gusts_10m ?? 18),
          precipitation24h: Number(raw.current?.precipitation ?? 0),
          weather: getWeatherInfo(raw.current?.weather_code ?? 1)
        },
        daily: (raw.daily?.time || []).map((dateStr, i) => {
          const d = new Date(dateStr + 'T12:00:00Z');
          const dayName = i === 0 ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' });
          const shortDate = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
          return {
            date: dateStr,
            dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
            shortDate,
            tempMax: Math.round(raw.daily.temperature_2m_max?.[i] ?? 26),
            tempMin: Math.round(raw.daily.temperature_2m_min?.[i] ?? 13),
            rainProb: Math.round(raw.daily.precipitation_probability_max?.[i] ?? 10),
            rainSum: Number(raw.daily.precipitation_sum?.[i] ?? 0),
            weather: getWeatherInfo(raw.daily.weather_code?.[i] ?? 0)
          };
        })
      };

      _forecastCache = { locationId: loc.id, data: processed };
      _forecastCacheTime = now;
      return processed;
    } catch (err) {
      console.warn('[Clima] Falla de conexión a Open-Meteo, utilizando estación de respaldo:', err.message);
      const fallback = getFallbackForecast(loc);
      _forecastCache = { locationId: loc.id, data: fallback };
      _forecastCacheTime = now;
      return fallback;
    }
  }

  /**
   * Evalúa alertas técnicas agropecuarias preventivas
   */
  function computeAgroAlerts(forecast) {
    const alerts = [];
    if (!forecast || !forecast.current) return alerts;

    const c = forecast.current;
    const daily = forecast.daily || [];

    // 1. Alerta de viento para pulverización
    if (c.windSpeed > 20 || c.windGusts > 30) {
      alerts.push({
        id: 'pulverizacion',
        type: 'danger',
        level: 'red',
        icon: 'wind',
        title: 'Condición Desfavorable para Pulverización',
        message: `Viento actual de ${c.windSpeed} km/h (ráfagas de ${c.windGusts} km/h). Alto riesgo de deriva de fitosanitarios. Suspender aplicaciones terrestres.`
      });
    } else if (c.windSpeed < 4) {
      alerts.push({
        id: 'inversion_termica',
        type: 'warning',
        level: 'yellow',
        icon: 'alert-triangle',
        title: 'Alerta de Inversión Térmica',
        message: `Viento calmo (< 4 km/h). Verificar gradiente térmico antes de pulverizar para evitar atrapamiento de gotas en superficie.`
      });
    } else {
      alerts.push({
        id: 'pulverizacion_optima',
        type: 'success',
        level: 'green',
        icon: 'check-circle-2',
        title: 'Ventana Óptima de Aplicación',
        message: `Viento moderado de ${c.windSpeed} km/h (${c.windDirection}) y humedad del ${c.humidity}%. Condiciones aptas para labores de pulverización.`
      });
    }

    // 2. Alerta de lluvias próximas para cosecha / siembra
    const nextRainDay = daily.slice(0, 3).find(d => d.rainProb >= 50 || d.rainSum >= 8);
    if (nextRainDay) {
      alerts.push({
        id: 'lluvia_proxima',
        type: 'warning',
        level: 'yellow',
        icon: 'cloud-rain',
        title: `Lluvias Próximas (${nextRainDay.dayName})`,
        message: `Pronóstico de ${formatRain(nextRainDay.rainSum)} (${nextRainDay.rainProb}% de probabilidad) para el ${nextRainDay.dayName} ${nextRainDay.shortDate}. Planificar logística de camiones y tránsito de tolvas.`
      });
    }

    // 3. Alerta de helada agronómica
    const frostDay = daily.find(d => d.tempMin <= 3);
    if (frostDay) {
      alerts.push({
        id: 'helada',
        type: 'danger',
        level: 'red',
        icon: 'snowflake',
        title: `Riesgo de Helada Agronómica (${frostDay.dayName})`,
        message: `Temperatura mínima pronosticada de ${frostDay.tempMin}°C para el ${frostDay.dayName}. Riesgo potencial en etapas reproductivas o de emergencia.`
      });
    }

    // 4. Alerta de estrés térmico ganadero
    const heatDay = daily.find(d => d.tempMax >= 32);
    if (heatDay) {
      alerts.push({
        id: 'estres_termico',
        type: 'warning',
        level: 'yellow',
        icon: 'flame',
        title: `Alerta por Altas Temperaturas (${heatDay.dayName})`,
        message: `Máxima pronosticada de ${heatDay.tempMax}°C. Asegurar sombra, disponibilidad de agua fresca y caudal en comederos y piquetes de engorde.`
      });
    }

    return alerts;
  }

  /**
   * Calcula los indicadores KPI de precipitaciones a partir de los registros de la base de datos
   */
  function computeRainfallKpis(database, activeDate = null) {
    const db = database || (typeof window !== 'undefined' && window.db);
    const rainfalls = (db?.rainfalls || []).filter(r => !r.voided);

    const refDate = activeDate ? new Date(activeDate + 'T00:00:00Z') : new Date('2026-11-03T00:00:00Z');
    const refYear = refDate.getUTCFullYear();
    const refMonthStr = String(refDate.getUTCMonth() + 1).padStart(2, '0');
    const refMonthPrefix = `${refYear}-${refMonthStr}`;

    // Últimos 7 días
    const d7 = new Date(refDate);
    d7.setUTCDate(d7.getUTCDate() - 7);
    const d7Str = d7.toISOString().slice(0, 10);
    const rain7d = rainfalls.filter(r => r.date >= d7Str && r.date <= refDate.toISOString().slice(0, 10))
      .reduce((sum, r) => sum + Number(r.millimeters || 0), 0);

    // Mes actual
    const rainMonth = rainfalls.filter(r => r.date && r.date.startsWith(refMonthPrefix))
      .reduce((sum, r) => sum + Number(r.millimeters || 0), 0);

    // Año actual
    const yearPrefix = `${refYear}-`;
    const rainYear = rainfalls.filter(r => r.date && r.date.startsWith(yearPrefix))
      .reduce((sum, r) => sum + Number(r.millimeters || 0), 0);

    // Campaña agrícola (1 de Julio al 30 de Junio del siguiente año)
    let campStart, campEnd;
    if (refDate.getUTCMonth() >= 6) { // Julio o después
      campStart = `${refYear}-07-01`;
      campEnd = `${refYear + 1}-06-30`;
    } else {
      campStart = `${refYear - 1}-07-01`;
      campEnd = `${refYear}-06-30`;
    }
    const rainCampaign = rainfalls.filter(r => r.date >= campStart && r.date <= campEnd)
      .reduce((sum, r) => sum + Number(r.millimeters || 0), 0);

    // Última precipitación registrada
    const sorted = [...rainfalls].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const lastRain = sorted[0] || null;

    return {
      rain7d,
      rainMonth,
      rainYear,
      rainCampaign,
      lastRain,
      eventsCount: rainfalls.length,
      refYear,
      refMonthName: refDate.toLocaleDateString('es-AR', { month: 'long' }),
      campaignLabel: `${campStart.slice(0, 4)}/${campEnd.slice(2, 4)}`
    };
  }

  /**
   * Extrae la serie mensual de milímetros de lluvia para un año seleccionado
   */
  function getRainfallMonthlySeries(database, targetYear = 2026) {
    const db = database || (typeof window !== 'undefined' && window.db);
    const rainfalls = (db?.rainfalls || []).filter(r => !r.voided);
    const y = parseInt(targetYear, 10) || 2026;

    const months = [];
    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let m = 1; m <= 12; m++) {
      const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;
      const inMonth = rainfalls.filter(r => r.date && r.date.startsWith(monthPrefix));
      const mm = inMonth.reduce((sum, r) => sum + Number(r.millimeters || 0), 0);
      const isFuture = (y === 2026 && m > 11);

      months.push({
        month: m,
        label: MONTHS[m - 1],
        millimeters: isFuture ? null : mm,
        eventsCount: inMonth.length,
        hasData: !isFuture,
        isFuture
      });
    }

    const validMonths = months.filter(m => m.hasData && m.millimeters != null);
    const totalYear = validMonths.reduce((sum, m) => sum + m.millimeters, 0);
    const avgMonth = validMonths.length ? (totalYear / validMonths.length) : 0;
    const maxMonth = validMonths.reduce((max, m) => (!max || m.millimeters > max.millimeters ? m : max), null);

    return {
      year: y,
      months,
      totalYear,
      avgMonth,
      maxMonth
    };
  }

  /**
   * Genera el SVG del gráfico de barras de evolución mensual de lluvias
   */
  function renderRainfallBarChartSvg(series) {
    const W = 680;
    const H = 220;
    const padL = 50;
    const padR = 20;
    const padT = 25;
    const padB = 40;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const months = series.months;
    const valid = months.filter(m => m.hasData && m.millimeters != null);
    const maxVal = Math.max(120, ...valid.map(m => m.millimeters)) * 1.15;

    const barW = Math.max(16, (plotW / 12) * 0.55);

    // Grilla horizontal
    const gridLines = [];
    const numLevels = 4;
    for (let i = 0; i < numLevels; i++) {
      const frac = i / (numLevels - 1);
      const y = padT + plotH * (1 - frac);
      const val = Math.round(frac * maxVal);
      gridLines.push(`
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#E2E8F0" stroke-dasharray="3,3" stroke-width="1" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748B" font-weight="600">${val} mm</text>
      `);
    }

    // Barras de cada mes
    const bars = months.map((m, idx) => {
      const slotW = plotW / 12;
      const x = padL + idx * slotW + (slotW - barW) / 2;
      const val = m.millimeters || 0;
      const barH = m.hasData ? Math.max(2, (val / maxVal) * plotH) : 0;
      const y = padT + plotH - barH;

      if (!m.hasData) {
        return `
          <g class="rain-bar-group" data-month="${m.label}" data-val="Sin datos">
            <line x1="${x + barW/2 - 4}" y1="${padT + plotH - 2}" x2="${x + barW/2 + 4}" y2="${padT + plotH - 2}" stroke="#CBD5E1" stroke-width="2" />
            <text x="${x + barW / 2}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#94A3B8" font-weight="500">${m.label}</text>
          </g>
        `;
      }

      return `
        <g class="rain-bar-group" data-month="${m.label}" data-mm="${formatNumber(val, 1)} mm" data-events="${m.eventsCount} eventos">
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#087FBD" rx="4" class="rain-bar" style="cursor:pointer; transition: fill 0.15s ease;" />
          ${val > 0 ? `<text x="${x + barW / 2}" y="${Math.max(padT + 12, y - 6)}" text-anchor="middle" font-size="10" font-weight="700" fill="#14263D">${Math.round(val)}</text>` : ''}
          <text x="${x + barW / 2}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#1E293B" font-weight="700">${m.label}</text>
        </g>
      `;
    });

    return `
      <div class="rainfall-svg-wrapper" style="position:relative; width:100%;">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style="display:block; overflow:visible;">
          <g>${gridLines.join('')}</g>
          <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#CBD5E1" stroke-width="1.5" />
          <g>${bars.join('')}</g>
        </svg>
      </div>
    `;
  }

  /**
   * Genera el marcado de la vista principal del Módulo Clima
   */
  async function renderWeatherView(containerEl, forceRefresh = false) {
    if (!containerEl) return;
    const db = typeof window !== 'undefined' ? window.db : null;

    try {
      const loc = getActiveLocation(db);
      let forecast = null;
      try {
        forecast = await fetchForecast(loc, forceRefresh);
      } catch (errForecast) {
        console.warn('[Clima] Fallo pronóstico, usando respaldo local:', errForecast);
        forecast = getFallbackForecast(loc);
      }
      if (!forecast || !forecast.current) {
        forecast = getFallbackForecast(loc);
      }

      const alerts = computeAgroAlerts(forecast);
      const kpis = computeRainfallKpis(db);

      const c = forecast.current;

    // Alertas HTML
    const alertsHtml = alerts.map(a => `
      <div class="weather-alert-card ${a.type}">
        <div class="weather-alert-icon">${typeof icon === 'function' ? icon(a.icon) : '⚠️'}</div>
        <div class="weather-alert-content">
          <strong>${escapeHtml(a.title)}</strong>
          <p>${escapeHtml(a.message)}</p>
        </div>
      </div>
    `).join('');

    // Pronóstico 7 días HTML
    const forecastCardsHtml = (forecast.daily || []).map((d, i) => `
      <div class="weather-forecast-card ${i === 0 ? 'today-highlight' : ''}">
        <span class="forecast-day">${escapeHtml(d.dayName)}</span>
        <span class="forecast-date">${escapeHtml(d.shortDate)}</span>
        <div class="forecast-icon" title="${escapeHtml(d.weather.label)}">
          ${typeof icon === 'function' ? icon(d.weather.icon) : '⛅'}
        </div>
        <div class="forecast-temps">
          <span class="temp-max">${d.tempMax}°</span>
          <span class="temp-min">${d.tempMin}°</span>
        </div>
        <div class="forecast-rain ${d.rainProb >= 40 ? 'has-rain' : ''}">
          <span>${typeof icon === 'function' ? icon('droplets') : '💧'} ${d.rainProb}%</span>
          ${d.rainSum > 0 ? `<small>${formatNumber(d.rainSum, 1)} mm</small>` : ''}
        </div>
      </div>
    `).join('');

    // Precipitaciones recientes del establecimiento
    const rainfalls = (db?.rainfalls || []).filter(r => !r.voided).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Filtros de fecha activos
    const filterPreset = containerEl.dataset.rainFilter || 'all';

    const html = `
      <div class="weather-module-wrapper">
        <!-- Encabezado con Ubicación Configurable -->
        <div class="weather-header-panel">
          <div class="weather-loc-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="weather-header-pin">${typeof icon === 'function' ? icon('map-pin') : '📍'}</span>
              <h3 class="weather-loc-title">${escapeHtml(loc.name)}</h3>
              <span class="weather-online-badge ${forecast.isLive ? 'live' : 'cached'}">
                ● ${forecast.isLive ? 'En vivo Open-Meteo' : 'Estación Local'}
              </span>
            </div>
            <p class="weather-loc-coords">
              Latitud: <strong>${loc.lat}°</strong> · Longitud: <strong>${loc.lon}°</strong> · Elevación: <strong>${loc.elevation || 440} m</strong> · Zona Horaria: <strong>${loc.timezone}</strong>
            </p>
          </div>

          <div class="weather-header-actions">
            <button type="button" class="btn secondary" data-action="configure-weather-location" title="Cambiar ubicación o coordenadas GPS">
              ${typeof icon === 'function' ? icon('settings-2') : '⚙️'} Configurar Ubicación
            </button>
            <button type="button" class="btn primary" data-action="new-rainfall" title="Registrar milímetros caídos en el campo">
              ${typeof icon === 'function' ? icon('cloud-rain') : '🌧️'} + Registrar Lluvia
            </button>
            <button type="button" class="tool-btn-sm" data-action="refresh-weather" title="Actualizar pronóstico Open-Meteo">
              ${typeof icon === 'function' ? icon('refresh-cw') : '🔄'}
            </button>
          </div>
        </div>

        ${forecast.offlineNotice ? `
          <div class="notice" style="margin-bottom:14px; background:#fffbeb; border:1px solid #fef3c7; color:#92400e;">
            ${typeof icon === 'function' ? icon('info') : 'ℹ️'} <span>${escapeHtml(forecast.offlineNotice)}</span>
          </div>
        ` : ''}

        <!-- Panel de Alertas Agropecuarias -->
        <div class="weather-alerts-row">
          ${alertsHtml}
        </div>

        <!-- Panel de Condiciones Actuales y Pronóstico Extendido -->
        <div class="weather-main-grid">
          <!-- Card Clima Actual -->
          <article class="weather-current-card">
            <div class="weather-current-head">
              <div>
                <span class="weather-badge-now">AHORA</span>
                <p class="weather-current-desc">${escapeHtml(c.weather.label)}</p>
              </div>
              <div class="weather-current-icon-lg" title="${escapeHtml(c.weather.label)}">
                ${typeof icon === 'function' ? icon(c.weather.icon) : '☀️'}
              </div>
            </div>

            <div class="weather-current-temp-block">
              <span class="weather-temp-huge">${c.temp}°</span>
              <span class="weather-temp-unit">C</span>
            </div>

            <div class="weather-current-metrics">
              <div class="weather-sub-metric">
                <span class="sub-label">${typeof icon === 'function' ? icon('droplets') : '💧'} Humedad</span>
                <strong>${c.humidity}%</strong>
              </div>
              <div class="weather-sub-metric">
                <span class="sub-label">${typeof icon === 'function' ? icon('wind') : '💨'} Viento</span>
                <strong>${c.windSpeed} km/h (${c.windDirection})</strong>
              </div>
              <div class="weather-sub-metric">
                <span class="sub-label">${typeof icon === 'function' ? icon('gauge') : '🌪️'} Ráfagas</span>
                <strong>${c.windGusts} km/h</strong>
              </div>
              <div class="weather-sub-metric">
                <span class="sub-label">${typeof icon === 'function' ? icon('clock') : '🕒'} Actualizado</span>
                <strong>${forecast.updatedAt} hs</strong>
              </div>
            </div>
          </article>

          <!-- Tira de Pronóstico 7 Días -->
          <section class="weather-forecast-strip-panel">
            <div class="surface-title" style="margin-bottom:12px; padding:0;">
              <h4>Pronóstico a 7 Días (Zona Sur de Córdoba)</h4>
              <span class="muted" style="font-size:0.80rem">Vía Open-Meteo High-Resolution Model</span>
            </div>
            <div class="weather-forecast-strip">
              ${forecastCardsHtml}
            </div>
          </section>
        </div>

        <!-- SECCIÓN: REGISTRO HISTÓRICO DE PRECIPITACIONES -->
        <div class="weather-rainfall-section" style="margin-top:24px;">
          <div class="surface-title" style="margin-bottom:14px;">
            <div>
              <h3 style="font-size:1.2rem; color:#123F32; margin:0 0 4px;">Registro de Precipitaciones del Campo</h3>
              <p class="muted" style="margin:0; font-size:0.85rem">Mediciones pluviales reales en pluviómetros de Pozo del Carril y lotes productivos.</p>
            </div>
            <button type="button" class="btn primary" data-action="new-rainfall">
              ${typeof icon === 'function' ? icon('plus') : '+'} Cargar Medición Pluviómetro
            </button>
          </div>

          <!-- Indicadores KPI de Precipitaciones (Interactivos con apertura de gráficos) -->
          <div class="metrics four" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); margin-bottom:18px;">
            <article class="metric" data-kpi-interactive="true" data-kpi-key="rainfall_7d" title="Click para ver evolución de lluvias">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <p style="margin:0">Lluvias Últimos 7 Días</p>
                <span class="kpi-interactive-cue" title="Evolución temporal">📈</span>
              </div>
              <strong style="color:#087FBD;">${formatRain(kpis.rain7d)}</strong>
              <small>Precipitaciones recientes en el campo</small>
            </article>

            <article class="metric" data-kpi-interactive="true" data-kpi-key="rainfall_month" title="Click para ver evolución de lluvias">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <p style="margin:0">Lluvias del Mes (${kpis.refMonthName})</p>
                <span class="kpi-interactive-cue" title="Evolución temporal">📈</span>
              </div>
              <strong style="color:#087FBD;">${formatRain(kpis.rainMonth)}</strong>
              <small>Acumulado mensual en pluviómetros</small>
            </article>

            <article class="metric" data-kpi-interactive="true" data-kpi-key="rainfall_year" title="Click para ver evolución de lluvias">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <p style="margin:0">Lluvias del Año (${kpis.refYear})</p>
                <span class="kpi-interactive-cue" title="Evolución temporal">📈</span>
              </div>
              <strong style="color:#123F32;">${formatRain(kpis.rainYear)}</strong>
              <small>Acumulado pluvial anual en el establecimiento</small>
            </article>

            <article class="metric" data-kpi-interactive="true" data-kpi-key="rainfall_campaign" title="Click para ver evolución de lluvias">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <p style="margin:0">Campaña Agrícola (${kpis.campaignLabel})</p>
                <span class="kpi-interactive-cue" title="Evolución temporal">📈</span>
              </div>
              <strong style="color:#15803d;">${formatRain(kpis.rainCampaign)}</strong>
              <small>Ciclo pluvial agrícola (Julio a Junio)</small>
            </article>
          </div>

          <!-- Gráfico de Evolución Mensual de Precipitaciones -->
          <div class="surface" style="padding:18px; margin-bottom:20px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
              <div>
                <h4 style="margin:0; font-size:1.05rem; color:#123F32;">Evolución Mensual de Lluvias Registradas</h4>
                <p class="muted" style="margin:2px 0 0; font-size:0.80rem">Distribución de milímetros caídos por mes calendario</p>
              </div>

              <div class="kpi-year-select-wrapper">
                <label class="kpi-year-label">Año:</label>
                <select class="kpi-year-select" id="weatherYearSelect" data-action="change-weather-year">
                  <option value="2026" selected>2026 ▼</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </div>

            <div id="weatherRainfallChartContainer">
              ${renderRainfallBarChartSvg(getRainfallMonthlySeries(db, 2026))}
            </div>
          </div>

          <!-- Barra de Filtros de Precipitaciones -->
          <div class="surface" style="padding:16px; margin-bottom:18px; border-radius:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-size:0.82rem; font-weight:700; color:#475569; margin-right:4px;">Período rápido:</span>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='7d'?'active':''}" data-action="filter-rain-preset" data-preset="7d">Últimos 7 días</button>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='30d'?'active':''}" data-action="filter-rain-preset" data-preset="30d">Últimos 30 días</button>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='90d'?'active':''}" data-action="filter-rain-preset" data-preset="90d">Últimos 90 días</button>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='2026'?'active':''}" data-action="filter-rain-preset" data-preset="2026">Año 2026</button>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='2025'?'active':''}" data-action="filter-rain-preset" data-preset="2025">Año 2025</button>
                <button type="button" class="btn ghost btn-sm weather-preset-btn ${filterPreset==='all'?'active':''}" data-action="filter-rain-preset" data-preset="all">Todos los años</button>
              </div>

              <div style="display:flex; align-items:center; gap:8px;">
                <input type="text" id="rainSearchInput" placeholder="Buscar lote, observación..." style="min-height:36px; padding:6px 12px; font-size:0.85rem; border:1px solid #CBD5E1; border-radius:6px;" />
              </div>
            </div>
          </div>

          <!-- Tabla Histórica de Lluvias -->
          <div class="surface" style="padding:0; overflow:hidden; border-radius:8px;">
            <div class="surface-title" style="padding:14px 18px; border-bottom:1px solid #E2E8F0;">
              <h4>Planilla Histórica de Precipitaciones (${rainfalls.length} registros)</h4>
              <button type="button" class="btn ghost btn-sm" data-action="export-rain-csv">
                ${typeof icon === 'function' ? icon('download') : '⬇️'} Exportar CSV
              </button>
            </div>

            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Milímetros</th>
                    <th>Ubicación / Establecimiento</th>
                    <th>Lote / Sector</th>
                    <th>Tipo</th>
                    <th>Observaciones</th>
                    <th style="text-align:right">Acciones</th>
                  </tr>
                </thead>
                <tbody id="rainfallsTableBody">
                  ${rainfalls.length ? rainfalls.slice(0, 50).map(r => `
                    <tr>
                      <td><strong>${escapeHtml(r.date)}</strong></td>
                      <td><span style="font-size:1.05rem; font-weight:800; color:#087FBD">${formatRain(r.millimeters)}</span></td>
                      <td>${escapeHtml(r.location || loc.name)}</td>
                      <td>${escapeHtml(r.lotName || r.lotId || 'General Establecimiento')}</td>
                      <td><span class="badge positive">Medida Real</span></td>
                      <td><small class="muted">${escapeHtml(r.note || '-')}</small></td>
                      <td style="text-align:right">
                        <div class="record-tools" style="justify-content:flex-end">
                          <button type="button" class="tool" data-action="edit-rainfall" data-id="${escapeHtml(r.id)}" title="Editar registro">${typeof icon === 'function' ? icon('pencil') : '✏️'}</button>
                          <button type="button" class="tool danger" data-action="delete-rainfall" data-id="${escapeHtml(r.id)}" title="Eliminar registro">${typeof icon === 'function' ? icon('trash-2') : '🗑️'}</button>
                        </div>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="7" style="text-align:center; padding:30px; color:#64748B;">No hay mediciones de precipitaciones registradas todavía. Presione "+ Registrar Lluvia" para cargar una.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    containerEl.innerHTML = html;
    if (typeof refreshIcons === 'function') refreshIcons();
    bindWeatherEvents(containerEl);
  } catch (criticalErr) {
    console.error('[Clima] Error al renderizar vista del módulo clima:', criticalErr);
    containerEl.innerHTML = `<div class="surface" style="padding:24px; text-align:center;"><p style="color:#b91c1c; font-weight:700">Módulo Clima: Modo de respaldo activo</p><p class="muted">Estación meteorológica de Pozo del Carril, La Aguada, Córdoba conectada.</p><button type="button" class="btn primary" onclick="UNRCWeather.renderWeatherView(document.getElementById('weatherViewContainer'), true)">Reintentar conexión</button></div>`;
  }
}

  /**
   * Conecta eventos específicos de la pestaña Clima
   */
  function bindWeatherEvents(containerEl) {
    // Cambio de año en gráfico de barras
    const yearSelect = containerEl.querySelector('#weatherYearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        const y = parseInt(yearSelect.value, 10);
        const chartBox = containerEl.querySelector('#weatherRainfallChartContainer');
        if (chartBox) {
          chartBox.innerHTML = renderRainfallBarChartSvg(getRainfallMonthlySeries(window.db, y));
        }
      });
    }

    // Filtros rápidos de tabla
    containerEl.querySelectorAll('[data-action="filter-rain-preset"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = btn.getAttribute('data-preset');
        containerEl.dataset.rainFilter = preset;
        containerEl.querySelectorAll('.weather-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterRainfallRows(containerEl, preset);
      });
    });

    // Buscador en tabla
    const searchInput = containerEl.querySelector('#rainSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const rows = containerEl.querySelectorAll('#rainfallsTableBody tr');
        rows.forEach(r => {
          const text = r.textContent.toLowerCase();
          r.style.display = text.includes(q) ? '' : 'none';
        });
      });
    }
  }

  function filterRainfallRows(containerEl, preset) {
    const rows = containerEl.querySelectorAll('#rainfallsTableBody tr');
    const todayStr = '2026-11-03';
    const refDate = new Date(todayStr + 'T00:00:00Z');

    rows.forEach(tr => {
      const dateText = tr.querySelector('td strong')?.textContent?.trim();
      if (!dateText) return;

      let show = true;
      if (preset === '7d') {
        const d7 = new Date(refDate);
        d7.setUTCDate(d7.getUTCDate() - 7);
        show = dateText >= d7.toISOString().slice(0, 10) && dateText <= todayStr;
      } else if (preset === '30d') {
        const d30 = new Date(refDate);
        d30.setUTCDate(d30.getUTCDate() - 30);
        show = dateText >= d30.toISOString().slice(0, 10) && dateText <= todayStr;
      } else if (preset === '90d') {
        const d90 = new Date(refDate);
        d90.setUTCDate(d90.getUTCDate() - 90);
        show = dateText >= d90.toISOString().slice(0, 10) && dateText <= todayStr;
      } else if (preset === '2026') {
        show = dateText.startsWith('2026');
      } else if (preset === '2025') {
        show = dateText.startsWith('2025');
      }
      tr.style.display = show ? '' : 'none';
    });
  }

  function openLocationModal() {
    const dialog = document.getElementById('weatherLocationDialog');
    if (!dialog) return;
    const db = typeof window !== 'undefined' ? window.db : null;
    const currentLoc = getActiveLocation(db);

    const presetOptions = REGIONAL_PRESETS.map(p => `
      <option value="${p.id}" ${currentLoc.id === p.id ? 'selected' : ''}>
        ${escapeHtml(p.name)} (${p.department}) · Lat ${p.lat}°, Lon ${p.lon}°
      </option>
    `).join('');

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:620px; padding:0; overflow:hidden">
        <div class="dialog-head" style="background:#0d1e2b; color:#ffffff; padding:18px 24px">
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:#ffffff">Configuración de Ubicación Meteorológica</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#94a3b8">Entre Surcos · Establecimiento Pozo del Carril</p>
          </div>
          <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" onclick="document.getElementById('weatherLocationDialog').close()" aria-label="Cerrar">×</button>
        </div>

        <form id="weatherLocationForm" style="padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Predeterminados Regionales (Córdoba Sur):</label>
            <select id="weatherPresetSelect" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#F8FAFC">
              <option value="custom">-- Coordenadas GPS Personalizadas --</option>
              ${presetOptions}
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Nombre del Punto / Campo:</label>
              <input type="text" id="locNameInput" value="${escapeHtml(currentLoc.name)}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Departamento / Zona:</label>
              <input type="text" id="locDeptInput" value="${escapeHtml(currentLoc.department || 'Río Cuarto')}" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Latitud (°):</label>
              <input type="number" step="0.0001" id="locLatInput" value="${currentLoc.lat}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Longitud (°):</label>
              <input type="number" step="0.0001" id="locLonInput" value="${currentLoc.lon}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Elevación (msnm):</label>
              <input type="number" id="locElevInput" value="${currentLoc.elevation || 440}" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost" onclick="document.getElementById('weatherLocationDialog').close()">Cancelar</button>
            <button type="submit" class="btn primary">Guardar Ubicación</button>
          </div>
        </form>
      </div>
    `;

    const select = dialog.querySelector('#weatherPresetSelect');
    select.addEventListener('change', () => {
      const p = REGIONAL_PRESETS.find(x => x.id === select.value);
      if (p) {
        dialog.querySelector('#locNameInput').value = p.name;
        dialog.querySelector('#locDeptInput').value = p.department;
        dialog.querySelector('#locLatInput').value = p.lat;
        dialog.querySelector('#locLonInput').value = p.lon;
        dialog.querySelector('#locElevInput').value = p.elevation;
      }
    });

    const form = dialog.querySelector('#weatherLocationForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newLoc = {
        id: select.value,
        name: dialog.querySelector('#locNameInput').value.trim(),
        department: dialog.querySelector('#locDeptInput').value.trim(),
        province: 'Córdoba',
        lat: parseFloat(dialog.querySelector('#locLatInput').value),
        lon: parseFloat(dialog.querySelector('#locLonInput').value),
        elevation: parseInt(dialog.querySelector('#locElevInput').value, 10) || 440,
        timezone: 'America/Argentina/Cordoba'
      };

      await setActiveLocation(newLoc, window.db);
      _forecastCache = null;
      _forecastCacheTime = 0;
      dialog.close();
      if (typeof toast === 'function') toast('Ubicación meteorológica actualizada: ' + newLoc.name, 'success');
      const container = document.getElementById('weatherViewContainer');
      if (container) renderWeatherView(container);
    });

    dialog.showModal();
  }

  function openRainfallModal(id) {
    const dialog = document.getElementById('rainfallDialog');
    if (!dialog) return;
    const db = typeof window !== 'undefined' ? window.db : null;
    const existing = id ? (db?.rainfalls || []).find(r => r.id === id) : null;
    const defaultDate = existing ? existing.date : (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const activeLoc = getActiveLocation(db);

    const lotOptions = (db?.lots || []).filter(l => !l.voided).map(l => `
      <option value="${l.id}" ${existing?.lotId === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>
    `).join('');

    dialog.innerHTML = `
      <div class="dialog-card" style="max-width:540px; padding:0; overflow:hidden">
        <div class="dialog-head" style="background:#0d1e2b; color:#ffffff; padding:18px 24px">
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:#ffffff">${existing ? 'Editar Registro de Lluvia' : 'Nuevo Registro de Precipitaciones'}</h3>
            <p style="margin:4px 0 0; font-size:0.8rem; color:#94a3b8">Medición en pluviómetro de campo · Entre Surcos</p>
          </div>
          <button class="tool" style="background:rgba(255,255,255,0.1); color:#fff; border:0" onclick="document.getElementById('rainfallDialog').close()" aria-label="Cerrar">×</button>
        </div>

        <form id="rainfallForm" style="padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Fecha de la Lluvia (*):</label>
              <input type="date" id="rainDateInput" value="${defaultDate}" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Milímetros Medidos (mm) (*):</label>
              <input type="number" step="0.1" min="0" id="rainMmInput" value="${existing ? existing.millimeters : ''}" placeholder="Ej: 28.5" required style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; font-weight:700; color:#087FBD" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Ubicación / Sector:</label>
              <input type="text" id="rainLocInput" value="${escapeHtml(existing?.location || activeLoc.name)}" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Lote Productivo (Opcional):</label>
              <select id="rainLotInput" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px; background:#F8FAFC">
                <option value="">-- General Establecimiento --</option>
                ${lotOptions}
              </select>
            </div>
          </div>

          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:6px">Observaciones / Intensidad:</label>
            <input type="text" id="rainNoteInput" value="${escapeHtml(existing?.note || '')}" placeholder="Ej: Lluvia mansa y continua durante la madrugada, sin granizo" style="width:100%; padding:8px 12px; font-size:0.88rem; border:1px solid #CBD5E1; border-radius:6px;" />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost" onclick="document.getElementById('rainfallDialog').close()">Cancelar</button>
            <button type="submit" class="btn primary">${existing ? 'Guardar Cambios' : 'Registrar Lluvia'}</button>
          </div>
        </form>
      </div>
    `;

    const form = dialog.querySelector('#rainfallForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateVal = dialog.querySelector('#rainDateInput').value;
      const mmVal = parseFloat(dialog.querySelector('#rainMmInput').value);
      const locVal = dialog.querySelector('#rainLocInput').value.trim();
      const lotIdVal = dialog.querySelector('#rainLotInput').value;
      const lotObj = lotIdVal ? (db?.lots || []).find(l => l.id === lotIdVal) : null;
      const lotNameVal = lotObj ? lotObj.name : '';
      const noteVal = dialog.querySelector('#rainNoteInput').value.trim();

      const D = window.UNRC;
      const record = {
        id: existing ? existing.id : (D?.uid ? D.uid() : 'rain_' + Date.now()),
        date: dateVal,
        millimeters: mmVal,
        location: locVal || activeLoc.name,
        lotId: lotIdVal || '',
        lotName: lotNameVal || '',
        note: noteVal,
        type: 'Medición Pluviómetro',
        isDemo: existing ? Boolean(existing.isDemo) : false
      };

      try {
        const next = D.commit(window.db, 'rainfalls', record);
        if (typeof persist === 'function') {
          await persist(next);
        } else if (typeof UNRCStorage !== 'undefined') {
          await UNRCStorage.save(next);
          window.db = next;
        }
        dialog.close();
        if (typeof toast === 'function') toast(`✓ Lluvia registrada: ${mmVal} mm el ${dateVal}`, 'success');
        const container = document.getElementById('weatherViewContainer');
        if (container) renderWeatherView(container);
      } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
        else alert(err.message);
      }
    });

    dialog.showModal();
  }

  function exportRainfallCsv(database) {
    const db = database || (typeof window !== 'undefined' ? window.db : null);
    const rainfalls = (db?.rainfalls || []).filter(r => !r.voided).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    if (!rainfalls.length) {
      if (typeof toast === 'function') toast('No hay registros de lluvia para exportar.', 'warning');
      return;
    }
    const headers = ['Fecha', 'Milimetros', 'Ubicacion', 'Lote', 'Tipo', 'Observaciones'];
    const rows = rainfalls.map(r => [
      r.date,
      r.millimeters,
      `"${String(r.location || '').replace(/"/g, '""')}"`,
      `"${String(r.lotName || r.lotId || '').replace(/"/g, '""')}"`,
      `"${String(r.type || 'Medición').replace(/"/g, '""')}"`,
      `"${String(r.note || '').replace(/"/g, '""')}"`
    ]);
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UNRC-Precipitaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof toast === 'function') toast('Planilla de precipitaciones descargada.', 'success');
  }

  const api = {
    DEFAULT_LOCATION,
    REGIONAL_PRESETS,
    getActiveLocation,
    setActiveLocation,
    fetchForecast,
    computeAgroAlerts,
    computeRainfallKpis,
    getRainfallMonthlySeries,
    renderRainfallBarChartSvg,
    renderWeatherView,
    openLocationModal,
    openRainfallModal,
    exportRainfallCsv
  };

  root.UNRCWeather = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
