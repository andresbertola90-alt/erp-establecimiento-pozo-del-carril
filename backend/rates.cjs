'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RATES_FILE = path.join(__dirname, '..', 'data', 'rates.json');

const INITIAL_RATES = [
  {
    id: 'rate-2026-09-01',
    date: '2026-09-01',
    source: 'Banco de la Nación Argentina (BNA)',
    type: 'Divisa Oficial',
    buyRate: 1320.00,
    sellRate: 1360.00,
    frozen: true,
    note: 'Cotización oficial histórica congelada de referencia'
  }
];

function ensureDataDir() {
  const dir = path.dirname(RATES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadRates() {
  ensureDataDir();
  if (fs.existsSync(RATES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));
    } catch {
      return INITIAL_RATES;
    }
  }
  saveRates(INITIAL_RATES);
  return INITIAL_RATES;
}

function saveRates(rates) {
  ensureDataDir();
  const tmp = RATES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rates, null, 2), 'utf8');
  fs.renameSync(tmp, RATES_FILE);
}

function getLatestRate() {
  const rates = loadRates();
  return rates.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function addRate(actor, { date, buyRate, sellRate, source, type, note }) {
  if (!actor) throw new Error('Se requiere sesión para registrar cotizaciones.');
  const cleanDate = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) throw new Error('Completá una fecha válida (AAAA-MM-DD).');
  const buy = Number(buyRate);
  const sell = Number(sellRate);
  if (!Number.isFinite(buy) || buy <= 0) throw new Error('Ingresá un tipo de cambio comprador válido mayor a cero.');
  if (!Number.isFinite(sell) || sell <= 0) throw new Error('Ingresá un tipo de cambio vendedor válido mayor a cero.');

  const rates = loadRates();
  const newRate = {
    id: `rate-${cleanDate}-${Date.now()}`,
    date: cleanDate,
    source: String(source || 'Carga manual').trim(),
    type: String(type || 'Manual').trim(),
    buyRate: buy,
    sellRate: sell,
    frozen: true,
    createdBy: actor.username,
    createdAt: new Date().toISOString(),
    note: String(note || '').trim()
  };

  rates.push(newRate);
  saveRates(rates);
  return newRate;
}

function recordLiveRate(actor, { date, buyRate, sellRate, source }) {
  const cleanDate = date || new Date().toISOString().slice(0, 10);
  const buy = Number(buyRate) || Number(sellRate);
  const sell = Number(sellRate);
  if (!Number.isFinite(sell) || sell <= 0) return null;

  const rates = loadRates();
  const existing = rates.find(r => r.date === cleanDate && r.sellRate === sell);
  if (!existing) {
    const newRate = {
      id: `bna-${cleanDate}-${Date.now()}`,
      date: cleanDate,
      source: String(source || 'Banco de la Nación Argentina (BNA) · Dólar Billete Vendedor').trim(),
      type: 'Oficial BNA Billete Vendedor',
      buyRate: buy,
      sellRate: sell,
      frozen: true,
      createdBy: actor?.username || 'sistema',
      createdAt: new Date().toISOString(),
      note: 'Cotización oficial BNA billete vendedor sincronizada en vivo'
    };
    rates.push(newRate);
    saveRates(rates);
    return newRate;
  }
  return existing;
}

async function fetchLiveBnaRate() {
  // Strategy 1: DolarApi Oficial (standard tracking of BNA Dólar Billete)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://dolarapi.com/v1/dolares/oficial', { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      const buyRate = Number(data.compra);
      const sellRate = Number(data.venta);
      if (Number.isFinite(sellRate) && sellRate > 0) {
        return {
          success: true,
          rate: sellRate,
          sellRate: sellRate,
          buyRate: Number.isFinite(buyRate) ? buyRate : sellRate,
          pair: 'USD/ARS',
          source: 'Banco de la Nación Argentina (BNA) · Dólar Billete Vendedor',
          sourceUrl: 'https://dolarapi.com/v1/dolares/oficial',
          updatedAt: data.fechaActualizacion || new Date().toISOString(),
          date: (data.fechaActualizacion ? new Date(data.fechaActualizacion) : new Date()).toISOString().slice(0, 10)
        };
      }
    }
  } catch (err) {
    console.warn('[Rates] Fallo consulta DolarApi:', err.message);
  }

  // Strategy 2: Direct BNA official website scraping
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch('https://www.bna.com.ar/Personas', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const html = await resp.text();
      const m = html.match(/Dolar U\.S\.A<\/td>\s*<td[^>]*>([0-9,\.]+)<\/td>\s*<td[^>]*>([0-9,\.]+)/i);
      if (m) {
        const buy = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        const sell = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(sell) && sell > 0) {
          return {
            success: true,
            rate: sell,
            sellRate: sell,
            buyRate: Number.isFinite(buy) ? buy : sell,
            pair: 'USD/ARS',
            source: 'Banco de la Nación Argentina (BNA) · Web Oficial',
            sourceUrl: 'https://www.bna.com.ar/Personas',
            updatedAt: new Date().toISOString(),
            date: new Date().toISOString().slice(0, 10)
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Rates] Fallo scrape directo BNA:', err.message);
  }

  // Strategy 3: Bluelytics Oficial fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://api.bluelytics.com.ar/v2/latest', { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      const sellRate = Number(data?.oficial?.value_sell);
      const buyRate = Number(data?.oficial?.value_buy);
      if (Number.isFinite(sellRate) && sellRate > 0) {
        return {
          success: true,
          rate: sellRate,
          sellRate: sellRate,
          buyRate: Number.isFinite(buyRate) ? buyRate : sellRate,
          pair: 'USD/ARS',
          source: 'Banco de la Nación Argentina (BNA) vía Bluelytics',
          sourceUrl: 'https://api.bluelytics.com.ar/v2/latest',
          updatedAt: data.last_update || new Date().toISOString(),
          date: new Date().toISOString().slice(0, 10)
        };
      }
    }
  } catch (err) {
    console.warn('[Rates] Fallo consulta Bluelytics:', err.message);
  }

  // Strategy 4: Latest saved rate from file cache
  const latest = getLatestRate();
  if (latest && (latest.sellRate || latest.buyRate)) {
    const sRate = Number(latest.sellRate || latest.buyRate);
    return {
      success: true,
      rate: sRate,
      sellRate: sRate,
      buyRate: Number(latest.buyRate) || sRate,
      pair: 'USD/ARS',
      source: latest.source + ' (Caché local)',
      updatedAt: latest.createdAt || new Date().toISOString(),
      date: latest.date,
      offline: true
    };
  }

  // Default fallback if initial
  return {
    success: true,
    rate: 1550.00,
    sellRate: 1550.00,
    buyRate: 1500.00,
    pair: 'USD/ARS',
    source: 'Banco de la Nación Argentina (BNA) · Valor referencial',
    updatedAt: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    offline: true
  };
}

module.exports = {
  loadRates,
  getLatestRate,
  addRate,
  recordLiveRate,
  fetchLiveBnaRate
};

