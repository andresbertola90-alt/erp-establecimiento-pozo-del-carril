'use strict';

const ORIGIN = 'unrc://app';
const ENTRY = ORIGIN + '/index.html';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';";

const ALLOWED_ASSETS = new Set([
  'index.html',
  'styles.css',
  'integrated.css',
  'access-print.css',
  'journal-audit.css',
  'journal.js',
  'journal-ui.js',
  'audit.js',
  'audit-ui.js',
  'domain.js',
  'storage.js',
  'auth.js',
  'interface.js',
  'access-ui.js',
  'printing.js',
  'transfer.js',
  'transfer-ui.js',
  'desktop-ui.js',
  'demo-data.js'
]);

function isEntry(url) {
  if (typeof url !== 'string') return false;
  return url === ENTRY || url.startsWith(ENTRY + '#');
}

function downloadAllowed(url) {
  if (typeof url !== 'string') return false;
  return url.startsWith('blob:' + ORIGIN + '/');
}

function assetPath(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  if (rawUrl.includes('%') || rawUrl.includes('..') || rawUrl.includes('?')) return null;

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'unrc:') return null;
  if (parsed.hostname !== 'app') return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  let pathname = parsed.pathname;
  if (pathname.startsWith('/')) pathname = pathname.slice(1);
  if (!pathname) pathname = 'index.html';

  if (pathname.startsWith('desktop/') || pathname.startsWith('tests/')) return null;
  if (['package.json', 'server.cjs', 'README.md', '.env', 'desktop-ui.js'].includes(pathname) && pathname !== 'desktop-ui.js') return null;
  if (pathname === 'package.json' || pathname === 'server.cjs' || pathname === 'README.md' || pathname === '.env') return null;

  if (ALLOWED_ASSETS.has(pathname)) return pathname;
  if (pathname.startsWith('assets/')) return pathname;

  return null;
}

module.exports = {
  ORIGIN,
  ENTRY,
  CSP,
  isEntry,
  downloadAllowed,
  assetPath
};
