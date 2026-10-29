const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../server.cjs');
test('preview serves only public app assets, not source configuration or private files',async()=>{
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const route of ['/','/index.html','/assets/account-plan.js','/assets/logo-unrc.png','/domain.js']){
      const r=await fetch(base+route);assert.equal(r.status,200,route);await r.arrayBuffer();
    }
    for(const route of ['/package.json','/.env','/server.cjs','/desktop/main.cjs','/README.md','/tests/domain.test.cjs','/../package.json','/%2e%2e/package.json']){
      const r=await fetch(base+route);assert.equal(r.status,404,route);await r.text();
    }
    const head=await fetch(base+'/index.html',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    const post=await fetch(base+'/',{method:'POST'});assert.equal(post.status,405);await post.text();
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
