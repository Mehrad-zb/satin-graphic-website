import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from './checkout.test.mjs';
import {serviceRoutes} from '../dist/server/services.mjs';
import {mountProjects} from '../dist/client/admin/services.mjs';
import {menuHTML} from '../dist/client/site-navigation.mjs';
import {customPage} from '../dist/client/services-ui.mjs';
import {vectorCheck} from '../dist/server/checkout/vector-check.mjs';
import {PDFDocument,rgb} from '../dist/server/checkout/pdf-lib.mjs';
import {identify} from '../dist/client/cms/runtime.mjs';

test('new banner content gets unique editor IDs without targeting existing images',()=>{
 const old={dataset:{cmsId:'e7'},hasAttribute:()=>true},added={dataset:{},hasAttribute:()=>false};
 const originalSection={dataset:{cmsSection:'s3'}},banner={dataset:{}};
 identify({querySelectorAll:()=>[added,old],querySelector:()=>({children:[banner,originalSection]})});
 assert.equal(old.dataset.cmsId,'e7');assert.equal(added.dataset.cmsId,'e8');assert.equal(banner.dataset.cmsSection,'s4');
});

test('public navigation evaluates and category pages pass their filter state',()=>{
 assert.match(menuHTML([{key:'wraps',label:'Vehicle Wraps',href:'/satin/vehicle-wraps',active:true,groups:[]}]),/Vehicle Wraps/);
 assert.match(customPage('/apparel/women').html,/data-initial-group="women"/);
 assert.match(customPage('/apparel/workwear').html,/data-initial-category="workwear"/);
 assert.doesNotMatch(customPage('/wallpaper/custom').html,/PDF artwork is accepted/);
});
test('opening a new Our Work project does not run unrelated slider code',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({projects:[]}));
 const elements=new Map(),root={innerHTML:'',querySelector(selector){if(!elements.has(selector))elements.set(selector,{innerHTML:'',value:'',files:[]});return elements.get(selector);}};
 try{await mountProjects(root,()=>{});root.onclick({target:{closest:selector=>selector==='[data-new]'?{}:null}});assert.match(root.innerHTML,/New project/);assert.match(root.innerHTML,/data-upload/);}finally{globalThis.fetch=previous;}
});
test('promotion appearance and video plans persist and are returned publicly',async()=>{
 const origin='https://satin.test',url=new URL(origin+'/api/admin/service-settings');
 const payload={promotionDisplay:{intervalSeconds:9,autoplay:false,background:'#112233',textColor:'#ffffff'},videoPartner:{title:'Zeus partnership',text:'Confirmed scope',plans:[{name:'Brand film',price:'$450 CAD',detail:'A confirmed plan'}]}};
 const req=new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal((await serviceRoutes(req,env,url,()=>true)).status,200);
 const publicURL=new URL(origin+'/api/service-settings');
 const result=await(await serviceRoutes(new Request(publicURL),env,publicURL,()=>false)).json();
 assert.deepEqual(result.promotionDisplay,payload.promotionDisplay);assert.deepEqual(result.videoPartner,payload.videoPartner);
 payload.promotionDisplay.intervalSeconds=0;
 assert.equal((await serviceRoutes(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}),env,url,()=>true)).status,400);
});
test('vector preflight rejects embedded raster and blank PDF, accepts outlined shapes',async()=>{
 const svg='<svg width="1in" height="1in"><image href="data:image/png;base64,AAA"/><path d="M0 0L1 1"/></svg>';
 await assert.rejects(()=>vectorCheck(new TextEncoder().encode(svg),'image/svg+xml',1,1),/vector-only/);
 const doc=await PDFDocument.create(),page=doc.addPage([72,72]);
 const blank=await doc.save();await assert.rejects(()=>vectorCheck(blank,'application/pdf',1,1),/no printable vector/);
 page.drawRectangle({x:0,y:0,width:50,height:50,color:rgb(1,0,0)});assert.deepEqual(await vectorCheck(await doc.save(),'application/pdf',1,1),{width:1,height:1});
});
