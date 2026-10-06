import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
import {PDFDocument} from '../dist/server/checkout/pdf-lib.mjs';
import {isGTA} from '../dist/server/checkout/shipping.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,''),db=new DatabaseSync(':memory:');for(const file of fs.readdirSync(root+'/drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync(root+'/drizzle/'+file,'utf8'));
const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:db.prepare(sql).run(...args)};}};},async batch(q){return Promise.all(q.map(i=>i.run()));}};
const objects=new Map(),FILES={async put(k,b,options){objects.set(k,{b,options});},async get(k){const x=objects.get(k);if(!x)return null;return {body:x.b,arrayBuffer:async()=>x.b.buffer.slice(x.b.byteOffset,x.b.byteOffset+x.b.byteLength)};},async delete(k){objects.delete(k);}};
const env={DB,FILES,ASSETS:{fetch:async r=>{const p=root+'/dist/client'+new URL(r.url).pathname;try{return new Response(fs.readFileSync(p));}catch{return new Response('missing',{status:404});}}}};
let cookie='',state;const base='https://satin.test';async function call(path,v,otherCookie=cookie){const req=new Request(base+path,v===undefined?{headers:{Cookie:otherCookie}}:{method:'POST',headers:{Origin:base,Cookie:otherCookie,'Content-Type':'application/json'},body:JSON.stringify(v)});const r=await worker.fetch(req,env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];let body;try{body=await r.json();}catch{body=null;}return {status:r.status,body};}
async function change(path,v){const r=await call('/api/checkout/'+path,{...v,revision:state.revision});assert.equal(r.status,200,JSON.stringify(r.body));state=r.body;return r;}
async function upload(size,pages=1){const d=await PDFDocument.create();for(let n=0;n<pages;n++){const p=d.addPage(size);p.setTrimBox(9,9,size[0]-18,size[1]-18);p.setBleedBox(0,0,size[0],size[1]);}const fd=new FormData();fd.set('file',new File([await d.save()],'business-card.pdf',{type:'application/pdf'}));const r=await worker.fetch(new Request(base+'/api/studio/upload',{method:'POST',headers:{Origin:base,Cookie:cookie},body:fd}),env);assert.equal(r.status,201);return (await r.json()).file.id;}
assert.equal((await call('/api/checkout/draft')).status,401);await call('/api/studio/session',{});state=(await call('/api/checkout/draft')).body;
const values={quantity:500,print_sides:1,design:0};await change('import',{items:[{id:1,name:'Spoof',total:0.01,pricing:{ruleId:'print-business-cards',values}}]});assert.equal(state.draft.items.length,1);assert.notEqual(state.draft.items[0].price.total,1);assert.equal(state.draft.items[0].spec.sides,2);
let item=state.draft.items[0];assert.equal((await call('/api/checkout/item',{revision:state.revision,id:item.id,proof:true})).status,400);
const bad=await upload([400,300]);await change('item',{id:item.id,fileIds:[bad]});assert.equal(state.draft.items[0].reports[0].status,'rejected');
const good=await upload([270,162],2);await change('item',{id:item.id,fileIds:[good]});assert.equal(state.draft.items[0].reports[0].status,'awaiting_preflight');assert.equal(state.draft.items[0].reports[0].productionReady,false);await change('item',{id:item.id,proof:true,jobName:'Test print'});
assert.equal((await call('/api/checkout/item',{revision:state.revision-1,id:item.id,proof:true})).status,409);
const a={name:'Test Customer',email:'test@example.com',phone:'',street1:'50 Viceroy Rd',street2:'Unit 22',city:'Vaughan',state:'ON',zip:'L4K 3A9',country:'CA'};await change('shipping',{address:a});assert.equal(state.draft.rates.find(r=>r.id==='gta-next-day').amount,50);assert.equal(state.draft.carrierStatus,'not_connected');await change('select-shipping',{id:'gta-next-day'});
assert.equal(isGTA({...a,city:'Hamilton',zip:'L8P 1A1'}),false);assert.equal(isGTA({...a,city:'Vaughan',zip:'L8P 1A1'}),false);assert.equal(isGTA({...a,city:'Toronto',zip:'M5V 2T6'}),true);
assert.equal((await call('/api/checkout/payment',{revision:state.revision})).status,503);
const firstCookie=cookie;await call('/api/studio/session',{},'');const other=cookie;assert.equal((await call('/api/studio/file?id='+good,undefined,other)).status,400);cookie=firstCookie;
assert.equal((await call('/api/checkout/request',{revision:state.revision,id:crypto.randomUUID(),consent:true})).status,410);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM service_requests').get().n,0);await change('new',{});assert.equal(state.draft.items.length,0);
console.log('PASS: real SQLite + R2 workflow, PDF dimensions/bleed, proof gate, authoritative pricing, stale revision, GTA boundary, blocked payment, private files.');
export {worker,env,DB,db};
