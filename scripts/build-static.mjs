import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../web/',import.meta.url),output,{recursive:true});
await writeFile(new URL('../dist/.nojekyll',import.meta.url),'');
console.log('Static site ready in dist/');
