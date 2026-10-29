const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../desktop/policy.cjs');
test('only packaged front-end assets are served', () => {
  assert.equal(P.assetPath(P.ENTRY), 'index.html');
  assert.equal(P.assetPath(P.ORIGIN + '/assets/logo-unrc.png'), 'assets/logo-unrc.png');
  for (const url of ['https://app/index.html', 'unrc://evil/index.html', 'unrc://user@app/index.html', 'unrc://app:80/index.html', 'unrc://app/desktop/main.cjs', 'unrc://app/../auth.db', 'unrc://app/%2e%2e%2fsecret', 'file:///C:/secret', 'unrc://app/%', 'unrc://app/index.html?file=secret']) assert.equal(P.assetPath(url), null, url);
});
test('navigation and downloads cannot reach an external origin', () => {
  assert.equal(P.isEntry(P.ENTRY + '#general'), true);
  assert.equal(P.isEntry(P.ORIGIN + '/auth.js'), false);
  assert.equal(P.downloadAllowed('blob:unrc://app/123'), true);
  assert.equal(P.downloadAllowed('blob:https://other/123'), false);
  assert.equal(P.downloadAllowed('https://other/program.exe'), false);
  assert.equal(P.CSP.includes("script-src 'self'"), true);
});
