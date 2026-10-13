import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const assets={};
for(const file of await readdir(new URL('../web/',import.meta.url))){
 const ext=file.split('.').pop();if(!types[ext])throw new Error('Unexpected asset: '+file);
 assets['/'+file]={body:await readFile(new URL('../web/'+file,import.meta.url),'utf8'),type:types[ext]};
}
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('../dist/server/',import.meta.url),{recursive:true});
await mkdir(new URL('../dist/.openai/',import.meta.url),{recursive:true});
const auth=await readFile(new URL('../worker/auth.js',import.meta.url),'utf8');
await writeFile(new URL('../dist/server/index.js',import.meta.url),auth+'\nconst ASSETS='+JSON.stringify(assets)+';\nexport default createHandler(ASSETS);\n');
await writeFile(new URL('../dist/.openai/hosting.json',import.meta.url),await readFile(new URL('../.openai/hosting.json',import.meta.url)));
console.log('Built protected Worker; no public static assets.');
