import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler,authorized } from '../worker/auth.js';
const env={JUDGE_PASSWORD:'test-password-only',JUDGE_SESSION_SECRET:'test-secret-not-production'};
const app=createHandler({'/index.html':{body:'protected app',type:'text/html'},'/teams.js':{body:'private roster',type:'text/javascript'},'/sw.js':{body:'cleanup',type:'text/javascript'}});
const get=(path,cookie)=>new Request('https://test.local'+path,{headers:cookie?{cookie}:{}});
const login=(password,origin='https://test.local')=>new Request('https://test.local/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})});
test('password gate protects page and assets; valid cookie persists access',async()=>{
 assert.match(await (await app.fetch(get('/'),env)).text(),/Acceso de jueces/);
 assert.equal((await app.fetch(get('/teams.js'),env)).status,401);
 assert.equal((await app.fetch(login('wrong'),env)).status,401);
 assert.equal((await app.fetch(login(env.JUDGE_PASSWORD,'https://other.local'),env)).status,403);
 const accepted=await app.fetch(login(env.JUDGE_PASSWORD),env);
 assert.equal(accepted.status,303);
 const cookie=accepted.headers.get('set-cookie');
 for(const attribute of ['HttpOnly','Secure','SameSite=Strict','Max-Age=2592000'])assert.ok(cookie.includes(attribute));
 assert.ok(!cookie.includes(env.JUDGE_PASSWORD));
 const session=cookie.split(';')[0];
 assert.equal(await (await app.fetch(get('/',session),env)).text(),'protected app');
 assert.equal(await (await app.fetch(get('/teams.js',session),env)).text(),'private roster');
 assert.equal(await authorized(get('/',session+'a'),env),false);
 assert.equal(await authorized(get('/',session),{...env,JUDGE_PASSWORD:'rotated'}),false);
 assert.equal((await app.fetch(get('/'),{})).status,503);
 assert.equal((await app.fetch(get('/sw.js'),env)).status,200);
});
test('repeated wrong passwords are throttled',async()=>{
 for(let i=0;i<10;i++)await app.fetch(login('incorrect'),env);
 assert.equal((await app.fetch(login('incorrect'),env)).status,429);
});
