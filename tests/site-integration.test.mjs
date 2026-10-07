import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {worker,env} from './checkout.test.mjs';
test('direct static page loads include one login link immediately beside the cart',()=>{
 const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())visit(file);else if(entry.name.endsWith('.html')){const html=fs.readFileSync(file,'utf8');if(!html.includes('<header class="hdr"'))continue;assert.match(html,/<a class="header-login"[^>]*>[^<]+<\/a><button[^>]*data-cart/,file.pathname);assert.equal((html.match(/class="header-login"/g)||[]).length,1,file.pathname);}}};
 visit(new URL('../dist/client/',import.meta.url));
});
test('apparel JavaScript assets are never intercepted by apparel page routing',async()=>{
 for(const file of ['apparel-ui.mjs','apparel-colours.mjs','apparel-data.mjs']){const response=await worker.fetch(new Request('https://satin.test/'+file),env);assert.equal(response.status,200);assert.equal(await response.text(),fs.readFileSync(new URL('../dist/client/'+file,import.meta.url),'utf8'));}
});
test('all five Offset product templates render without unrelated vehicle state',()=>{
 const source=fs.readFileSync(new URL('../dist/client/satin/assets/satin.9464926f1bc9.js',import.meta.url),'utf8');
 const data=source.slice(source.indexOf('const OFFSET = ['),source.indexOf('const LARGE = ['));
 const template=source.slice(source.indexOf('PAGES.offsetItem ='),source.indexOf('PAGES.largeItem ='));
 const context={PAGES:{},PROCESS:{print:[]},WORK:{offset:[]}};
 for(const name of ['hero','art','sec','seg','dropzone','summaryBox','esc','feats','secHead','spec','guideRows','steps','icon','A','workSec','faqSec','ctaBand'])context[name]=()=>'';
 vm.createContext(context);vm.runInContext(data+'\n'+template+'\nfor(const item of OFFSET){if(!PAGES.offsetItem({slug:item.slug})?.title)throw Error(item.slug);}',context);
});
test('apparel JPEG and WebP uploads work in the existing private design session',async()=>{
 const origin='https://satin.test',session=await worker.fetch(new Request(origin+'/api/studio/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),env),cookie=session.headers.get('set-cookie').split(';')[0];
 for(const [name,data,mime] of [['art.jpg',[255,216,255,224,0,0,0,0],'image/jpeg'],['art.webp',[82,73,70,70,0,0,0,0,87,69,66,80],'image/webp']]){const form=new FormData();form.set('product','apparel-men-g500');form.set('file',new File([new Uint8Array(data)],name,{type:mime}));const response=await worker.fetch(new Request(origin+'/api/studio/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:form}),env);assert.equal(response.status,201);assert.equal((await response.json()).file.mime,mime);}
});
