import assert from 'node:assert/strict';
import {worker,env,DB} from './checkout.test.mjs';
import {getRule,quote} from '../dist/server/studio.mjs';
import {calculate,validateRule,DEFAULT_RULES} from '../dist/server/studio-model.mjs';
import {upgradeRule,EXTRA_RULES} from '../dist/server/updates.mjs';
import {vectorCheck} from '../dist/server/checkout/vector-check.mjs';
import {publicProducts} from '../dist/server/catalog.mjs';
for(const seed of [...DEFAULT_RULES,...EXTRA_RULES]){const rule=upgradeRule(seed);validateRule(rule);calculate(rule);assert.deepEqual(upgradeRule(rule),rule,'migration must preserve owner changes after upgrade');}
assert.ok((await publicProducts(DB)).every(p=>(p.images||[]).every(s=>typeof s==='string')));
const transit=await quote(DB,'wrap-transit-van',{vehicle_0:1,vehicle_1:1,vehicle_2:1,coverage:1,finish:1,material:1.08,roof:0,design:0});assert.equal(transit.subtotal,320000);
const sedan=await getRule(DB,'wrap-sedan');const withoutReduction={...sedan,constants:{...sedan.constants,fullWrapFactor:1}};assert.equal(calculate(sedan,{coverage:.22}).subtotal,calculate(withoutReduction,{coverage:.22}).subtotal,'decals are unchanged');assert.ok(calculate(sedan,{coverage:1}).subtotal<calculate(withoutReduction,{coverage:1}).subtotal);
assert.equal((await quote(DB,'print-poly-bag-lawn-sign',{size:0,colours:1,quantity:100,design:1})).subtotal,49100);
assert.equal((await quote(DB,'print-poly-bag-lawn-sign',{size:1,colours:3,quantity:1000,design:0})).subtotal,868000);
assert.equal((await quote(DB,'wrap-prints',{width:144,height:48,quantity:1,kind:0,material:0,shipping:100,rush:1,design:0})).subtotal,58080);
assert.equal((await quote(DB,'wrap-prints',{width:144,height:48,quantity:1,kind:1,material:1,shipping:0,rush:0,design:0})).subtotal,48000);
await assert.rejects(()=>quote(DB,'wrap-prints',{kind:1,height:49}),/48 inches/);
const flyer=await getRule(DB,'print-flyers');assert.equal(calculate(flyer,{size:flyer.customSizeValue,width:7,height:5,design:0}).subtotal,0,'unknown supplier cost must never create a made-up sale price');
const svg=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="24in" height="48in"><path d="M0 0 L1 1"/></svg>');await vectorCheck(svg,'image/svg+xml',24,48);await assert.rejects(()=>vectorCheck(svg,'image/svg+xml',25,48),/1:1/);
const base='https://satin.test';const r=await worker.fetch(new Request(base+'/api/product-reviews',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({product:'print-flyers',rating:5,body:'A valid example review'})}),env);assert.equal(r.status,401,'review submission requires login');
const logged=await worker.fetch(new Request(base+'/api/product-reviews',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','oai-authenticated-user-id':'test-reviewer','oai-authenticated-user-email':'review@example.com'},body:JSON.stringify({product:'print-flyers',rating:4,body:'My real customer review'})}),env);assert.equal(logged.status,201);const reviews=await worker.fetch(new Request(base+'/api/product-reviews?product=print-flyers'),env);assert.equal((await reviews.json()).reviews[0].rating,4,'customers can submit their actual rating');
assert.equal((await worker.fetch(new Request(base+'/api/digital/download?order=unknown&item=unknown'),env)).status,401);
console.log('PASS: migrated forms, catalog galleries, full/decal wrap pricing, bag markup, rush totals, missing supplier costs, vector scale, authenticated customer reviews and private downloads.');
let cookie='';async function post(path,value){const r=await worker.fetch(new Request(base+path,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(value)}),env);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
await post('/api/studio/session',{});let draft=await worker.fetch(new Request(base+'/api/checkout/draft',{headers:{Cookie:cookie}}),env);let state=await draft.json();
for(const id of ['wallpaper-botanical','design-services','material-squeegee-install-kit']){const r=await post('/api/checkout/import',{revision:state.revision,items:[{id,pricing:{ruleId:id,values:{}}}]});assert.equal(r.status,200,JSON.stringify(r.body));state=r.body;assert.ok(state.draft.items.some(i=>i.ruleId===id),'purchase item was imported');assert.ok(state.draft.items.find(i=>i.ruleId===id).artworkAccepted||state.draft.items.find(i=>i.ruleId===id).designRequested,'no artwork required for predefined art, materials or design services');}
const empty=await post('/api/checkout/new',{revision:state.revision});state=empty.body;
import {PDFDocument} from '../dist/server/checkout/pdf-lib.mjs';
const pdf=await PDFDocument.create();pdf.addPage([400,300]);const bytes=await pdf.save();const fileIds=[];
for(let n=0;n<2;n++){const fd=new FormData();fd.set('file',new File([bytes],'art-'+n+'.pdf',{type:'application/pdf'}));fd.set('product','print-business-cards');const r=await worker.fetch(new Request(base+'/api/studio/upload',{method:'POST',headers:{Origin:base,Cookie:cookie},body:fd}),env);assert.equal(r.status,201);fileIds.push((await r.json()).file.id);}
const check=await post('/api/artwork/check',{ruleId:'print-business-cards',values:{quantity:500},fileIds});assert.equal(check.status,200);assert.equal(check.body.reports.length,2);
const imported=await post('/api/checkout/import',{revision:state.revision,items:[{id:'multi-file',pricing:{ruleId:'print-business-cards',values:{quantity:500}},artwork:{fileIds},artworkAccepted:true}]});assert.equal(imported.status,200);assert.equal(imported.body.draft.items[0].fileIds.length,2);assert.equal(imported.body.draft.items[0].artworkAccepted,true,'customer can accept files that fail size preflight');
const fd=new FormData();fd.set('file',new File([bytes],'not-an-image.pdf',{type:'application/pdf'}));fd.set('product','wallpaper-custom');assert.equal((await worker.fetch(new Request(base+'/api/studio/upload',{method:'POST',headers:{Origin:base,Cookie:cookie},body:fd}),env)).status,400,'wallpaper upload is image-only');
