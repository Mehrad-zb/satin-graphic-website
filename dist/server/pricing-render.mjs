import {serviceSettings,projectRecords} from './services.mjs';
import {publicProducts} from './catalog.mjs';
import {getPricingSeed} from './studio.mjs';
import {pricingMarkup,genericMarkup,referenceForm,replaceConfig,choiceLines} from './pricing-form.mjs';
import {PRODUCTS,calculate} from './studio-model.mjs';
export async function renderPricing(response,request,env){
 if(!response.ok||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 const path=new URL(request.url).pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/,'/satin').replace(/\/$/,'');
 let html=await response.text();
 if(env.DB)try{const [settings,projects,products]=await Promise.all([serviceSettings(env.DB),projectRecords(env.DB),publicProducts(env.DB)]);html=html.replace('</head>','<script type="application/json" data-service-bootstrap>'+JSON.stringify({settings,projects:projects.map(p=>({slug:p.slug,title:p.title,category:p.category,vehicle:p.vehicle,cover:p.cover,imageCount:p.images?.length||0,images:p.images?.slice(0,1)||[]})),products:products.map(({source,...p})=>p)}).replace(/</g,'\\u003c')+'</script></head>');}catch(e){console.error('Service bootstrap unavailable',e.message);}

 for(const href of ['/batch.css','/services.css','/studio/designer.css','/pricing-form.css'])if(!html.includes('href="'+href+'"'))html=html.replace('</head>',`<link rel="stylesheet" href="${href}"${href.includes('designer.css')?' data-studio-css':''}></head>`);
 if(env.DB&&html.includes('class="cfg')){
  try{const seed=await getPricingSeed(env.DB,path);if(seed&&seed.configured){const values=Object.fromEntries(seed.rule.fields.map(f=>[f.key,f.default]));const special=referenceForm(seed.rule);const product=PRODUCTS.find(p=>p.ruleId===seed.rule.id);let body=special?pricingMarkup(seed.rule,seed.configured,values):genericMarkup(seed.rule,seed.configured,values,product);const quote=calculate(seed.rule,values);body=body.replace('<div class="product-order-choices lines" data-order-choices></div>','<div class="product-order-choices lines" data-order-choices>'+choiceLines(seed.rule,values)+'</div>');body=body.replace('<div class="product-order-total total" data-order-total></div>',`<div class="product-order-total total" data-order-total><b>$${(quote.subtotal/100).toLocaleString('en-CA',{maximumFractionDigits:2})}</b><span>Before tax · CAD</span></div>`);const json=JSON.stringify(seed).replace(/</g,'\\u003c');html=replaceConfig(html,`<div class="rule-cfg ${special?'reference-cfg':''}">${body}</div><script type="application/json" data-pricing-bootstrap data-path="${path}">${json}</script>`);}}
  catch(error){console.error('Pricing form could not be prepared',error.message);}
 }
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.delete('Content-Length');return new Response(html,{status:response.status,headers});
}
