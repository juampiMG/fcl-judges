const COOKIE='__Host-fcl_judge';
const TTL=30*24*60*60;
const encoder=new TextEncoder();
const attempts=new Map();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function key(env){return crypto.subtle.importKey('raw',encoder.encode(env.JUDGE_SESSION_SECRET+'|'+env.JUDGE_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function token(env){
 const data=Math.floor(Date.now()/1000)+TTL+'.'+crypto.randomUUID();
 return data+'.'+hex(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(data)));
}
export async function authorized(request,env){
 const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!value)return false;
 const parts=value.split('.');
 if(parts.length!==3||!/^\d+$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 const expires=Number(parts[0]);if(expires<=Date.now()/1000||expires>Date.now()/1000+TTL+60)return false;
 const signature=Uint8Array.from(parts[2].match(/../g),v=>parseInt(v,16));
 return crypto.subtle.verify('HMAC',await key(env),signature,encoder.encode(parts[0]+'.'+parts[1]));
}
const page=error=>`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso · FCL Jueces</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f3f3;color:#202020;font:17px Arial,sans-serif}header{background:#202020;color:white;border-bottom:5px solid #53bdd5;padding:24px}main{max-width:460px;margin:8vh auto;padding:30px;background:white;border:1px solid #d5dcde;border-radius:10px}h1{font-size:30px}label{display:block;font-weight:bold}input,button{display:block;width:100%;font:inherit;margin-top:12px;min-height:56px;border-radius:8px;padding:14px}input{border:1px solid #879399}button{border:0;background:#53bdd5;color:#132c33;font-weight:bold;cursor:pointer}p{line-height:1.5}.error{color:#a12718}:focus-visible{outline:3px solid #087d98;outline-offset:3px}@media(max-width:480px){main{margin:24px 14px;padding:24px}}
</style><header><strong>FCL · COSTA BRAVA</strong></header><main><h1>Acceso de jueces</h1><p>Introduce la contraseña para entrar.</p>${error?'<p role="alert" class="error">'+error+'</p>':''}<form action="/login" method="post"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128" autofocus><button>Entrar</button></form><p>Recordaremos el acceso durante 30 días en este navegador.</p></main></html>`;
function response(body,status=200,headers={}){
 return new Response(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':'text/html; charset=utf-8',...headers}});
}
export function createHandler(assets){
 return {async fetch(request,env){
  const url=new URL(request.url);
  // Public migration worker must reach old installations before their next reload.
  if(url.pathname==='/sw.js')return response(assets['/sw.js'].body,200,{'Content-Type':'text/javascript; charset=utf-8'});
  if(!env.JUDGE_PASSWORD||!env.JUDGE_SESSION_SECRET)return response('Acceso no configurado. Contacta con organización.',503);
  if(url.pathname==='/login'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return response('Solicitud no válida.',403);
   const id=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'unknown';
   const now=Date.now();let state=attempts.get(id);
   if(!state||now-state.start>600000){state={start:now,count:0};if(attempts.size>=10000)attempts.clear();attempts.set(id,state);}
   if(state.count>=10)return response(page('Demasiados intentos. Vuelve a intentarlo en 10 minutos.'),429,{'Retry-After':'600'});
   state.count++;
   if(Number(request.headers.get('content-length')||0)>4096)return response('Solicitud demasiado grande.',413);
   const raw=await request.text();if(raw.length>4096)return response('Solicitud demasiado grande.',413);
   const password=new URLSearchParams(raw).get('password')||'';
   const a=await crypto.subtle.digest('SHA-256',encoder.encode(password));
   const b=await crypto.subtle.digest('SHA-256',encoder.encode(env.JUDGE_PASSWORD));
   let mismatch=0;const aa=new Uint8Array(a),bb=new Uint8Array(b);for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];
   if(mismatch)return response(page('Contraseña incorrecta.'),401);
   attempts.delete(id);
   return response(null,303,{'Location':'/','Set-Cookie':COOKIE+'='+await token(env)+'; Path=/; Max-Age='+TTL+'; HttpOnly; Secure; SameSite=Strict'});
  }
  if(!await authorized(request,env)){
   if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/login')return response(page(''));
   return response('Acceso requerido.',401);
  }
  if(!['GET','HEAD'].includes(request.method))return response('Método no permitido.',405);
  const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return response('No encontrado.',404);
  return response(request.method==='HEAD'?null:asset.body,200,{'Content-Type':asset.type});
 }};
}
