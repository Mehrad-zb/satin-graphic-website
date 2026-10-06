import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
for(const name of ['dist/server/index.js','dist/server/wrangler.json','dist/client/satin/index.html','dist/client/admin/index.html','dist/client/admin/builder.mjs','dist/client/cms/portfolio-data.mjs']){
  if(!fs.statSync(new URL(name,root)).isFile())throw Error('Missing authored website output: '+name);
}
const config=JSON.parse(fs.readFileSync(new URL('.openai/hosting.json',root),'utf8'));
if(!config.project_id||config.d1!=='DB'||config.r2!=='FILES')throw Error('Invalid website bindings');
const {default:worker}=await import(new URL('dist/server/index.js',root));
if(typeof worker.fetch!=='function')throw Error('Invalid Worker entrypoint');
const {optimizedAssets}=await import(new URL('dist/server/optimized-assets.mjs',root));
for(const [original,target] of Object.entries(optimizedAssets)){
  if(!fs.statSync(new URL('dist/client'+target,root)).isFile())throw Error('Missing optimized asset: '+target);
  let requested;
  const response=await worker.fetch(new Request('https://example.com'+original),{ASSETS:{fetch:async request=>{requested=new URL(request.url).pathname;return new Response('asset',{headers:{'Content-Type':'image/webp'}});}}});
  if(requested!==target||response.headers.get('Content-Type')!=='image/webp')throw Error('Invalid optimized image route: '+original);
}
fs.mkdirSync(new URL('dist/.openai/',root),{recursive:true});
fs.copyFileSync(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
fs.cpSync(new URL('drizzle/',root),new URL('dist/.openai/drizzle/',root),{recursive:true});
const outputRoot=fileURLToPath(new URL('dist/',root));
function outputBytes(directory){return fs.readdirSync(directory,{withFileTypes:true}).reduce((total,entry)=>{const filename=directory+'/'+entry.name;return total+(entry.isDirectory()?outputBytes(filename):fs.statSync(filename).size);},0);}
if(outputBytes(outputRoot)>250*1024*1024)throw Error('Expanded website output exceeds the safe publishing size; optimize media before publishing.');
console.log('Authored website output ready:',fileURLToPath(new URL('dist',root)));
