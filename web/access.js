// Convenience gate only: all GitHub Pages files remain public.
const PASSWORD_HASH = '40b87757489f2e5e4d1c28837b2e0d344a08315d71bcaf1b800f4324b8efcce1';
const COOKIE = 'fcl_access_v1';
const gate=document.querySelector('#access-gate'),shell=document.querySelector('#judge-shell');
const cookiePath=new URL('./',location.href).pathname;
async function enter(){
 gate.hidden=true;
 try { await import('./app.js'); gate.hidden=true;shell.hidden=false; }
 catch {gate.hidden=false;document.querySelector('#access-error').textContent='No se pudo cargar la web. Comprueba la conexión y vuelve a entrar.';}
}
if(document.cookie.split(';').some(c=>c.trim()===COOKIE+'=accepted'))enter();
document.querySelector('#access-form').addEventListener('submit',async event=>{
 event.preventDefault();const input=document.querySelector('#access-password');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.value));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==PASSWORD_HASH){document.querySelector('#access-error').textContent='Contraseña incorrecta.';input.select();return;}
 document.cookie=COOKIE+'=accepted; Max-Age=2592000; Path='+cookiePath+'; SameSite=Strict'+(location.protocol==='https:'?'; Secure':'');
 input.value='';await enter();
});
