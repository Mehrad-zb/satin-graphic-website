import {customerRoutes} from './customer.mjs';
import {session,fileRow} from './studio.mjs';
import {apparelPhoto} from './apparel-photos.mjs';
import {viewerFetch,isVerifiedViewer} from './admin-viewer.mjs';
import {paymentRoutes,paymentWebhookRoutes} from './checkout/payments.mjs';
import {navigationRoutes,renderNavigation} from './navigation.mjs';
import {checkoutRoutes} from './checkout/routes.mjs';
import {renderPricing} from './pricing-render.mjs';
import {optimizedAssets} from './optimized-assets.mjs';
import {customPage,esc as escapePage} from './service-pages.mjs';
import {serviceRoutes,bookingSlots,serviceSettings} from './services.mjs';
import {portfolioRoutes} from './portfolio.mjs';
import {contentRoutes,renderContent as renderSavedContent} from './content.mjs';
import {managementRoutes} from './management.mjs';
import {catalogRoutes,publicProducts} from './catalog.mjs';
import {commerceRoutes} from './commerce.mjs';
import {studioRoutes} from './studio.mjs';
import {PRODUCTS as STUDIO_PRODUCTS} from './studio-model.mjs';
const DEFAULT_PRICING={"bases": {"sedan": 2800.0, "suv": 3400.0, "pickup-truck": 3200.0, "minivan": 3600.0, "transit-van": 3950.0, "sprinter-van": 4300.0, "cargo-van": 4200.0, "box-truck": 5800.0, "trailer": 4800.0, "bus": 8500.0}, "roofMultiplier": 1.12, "designDeposit": 250};
const ALLOWED = new Set(['Auto Detailing','Interior Detailing','Exterior Detailing','Paint Correction','Ceramic Coating','Social Media Services','Videography']);
const OPTIONS = new Set(['Interior detailing','Exterior detailing','Paint correction','Ceramic coating','Pet hair removal','Upholstery cleaning','Social strategy','Post design','Short-form video','Content calendar','Publishing support','Campaign creative','Brand film','Product video','Social clips','Event coverage','Editing','Captions']);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const app = {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&/^\/satin(?:\/(?:fa|fr|es))?\/design-studio\/?$/.test(url.pathname)&&STUDIO_PRODUCTS.find(p=>p.id===url.searchParams.get('product'))?.garment?.category==='t-shirts')return Response.redirect('https://satingraphic-apparel-studio.mehrad-tr.chatgpt.site/',302);
  const garmentImage=await apparelPhoto(request,url,env);if(garmentImage)return garmentImage;
  if(optimizedAssets[url.pathname]){
   const assetUrl=new URL(url);assetUrl.pathname=optimizedAssets[url.pathname];
   return env.ASSETS.fetch(new Request(assetUrl,request));
  }
  if(/^(?:\/satin(?:\/(fa|fr|es))?)?\/checkout\/?$/.test(url.pathname)){return renderNavigation(await env.ASSETS.fetch(new Request(new URL('/checkout/index.html',url),request)),request,env);}
  const webhookResult=await paymentWebhookRoutes(request,env,url);if(webhookResult)return webhookResult;
  const paymentResult=await paymentRoutes(request,env,url);if(paymentResult)return paymentResult;
  const checkoutResult=await checkoutRoutes(request,env,url);if(checkoutResult)return checkoutResult;
  const customerResult=await customerRoutes(request,env,url,isAdmin);if(customerResult)return customerResult;
  const serviceResult=await serviceRoutes(request,env,url,isAdmin);if(serviceResult)return serviceResult;
  const managementResult=await managementRoutes(request,env,url,isAdmin);if(managementResult)return managementResult;
  const catalogResult=await catalogRoutes(request,env,url,isAdmin);if(catalogResult)return catalogResult;
  const commerceResult=await commerceRoutes(request,env,url,isAdmin);if(commerceResult)return commerceResult;
  const studioResult=await studioRoutes(request,env,url,isAdmin);if(studioResult)return studioResult;
  const navigationResult=await navigationRoutes(request,env,url,isAdmin);if(navigationResult)return navigationResult;
  const contentResult=await contentRoutes(request,env,url,isAdmin);if(contentResult)return contentResult;
  const adminResult=await adminRoutes(request,env,url);if(adminResult)return adminResult;
  if(url.pathname==='/api/quote-requests'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   if(request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin'},403);
   if(!env.DB)return json({error:'Quote storage is unavailable'},503);
   try{
    const v=await body(request),name=text(v.name,120),email=text(v.email,254).toLowerCase(),service=text(v.service,120);
    if(!/^[a-f0-9-]{36}$/i.test(v.id||'')||name.length<2||!/^\S+@\S+\.\S+$/.test(email)||text(v.phone,40).length<7||!service||v.consent!==true||v.website)return json({error:'Check your details and consent'},400);
    if((v.designRequested===true||/design/i.test(service))&&v.designTermsAccepted!==true)return json({error:'Read and accept the design agreement'},400);
    const existing=await env.DB.prepare('SELECT email FROM service_requests WHERE id = ?').bind(v.id).first();const reference='SG-'+v.id.slice(0,8).toUpperCase();if(existing)return existing.email===email?json({reference}):json({error:'Start a new request'},409);
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM service_requests WHERE email = ? AND created_at > ?').bind(email,new Date(Date.now()-3600000).toISOString()).first();if(count.n>=5)return json({error:'Too many requests. Please wait or contact us.'},429);
    const attachments=[];if(v.attachments?.length){const owner=await session(request,env.DB);if(!owner||!Array.isArray(v.attachments)||v.attachments.length>10)throw Error('Invalid documents');for(const id of v.attachments){const f=await fileRow(env.DB,id,owner.id,false);attachments.push({id:f.id,name:f.name,mime:f.mime});}}
    const details=JSON.stringify({attachments,services:[service],notes:text(v.notes,2000),custom:cleanCustom(v.details),designRequested:v.designRequested===true,designAgreementAcceptedAt:v.designTermsAccepted===true?new Date().toISOString():null,estimate:text(v.estimate,5000),contactPreference:text(v.contactPreference,40)}),now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO service_requests (id,type,service,name,email,phone,preferred_date,preferred_time,details,status,created_at,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,'quote',service,name,email,text(v.phone,40),'','',details,'pending_confirmation',now,now).run();return json({reference},201);
   }catch(e){console.error('Quote storage failed',e?.message);return json({error:'Could not save your quote request. Please retry.'},400);}
  }
  if(url.pathname==='/api/service-requests'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   if(request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin'},403);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use JSON'},415);
   if(Number(request.headers.get('Content-Length')||0)>12000)return json({error:'Request too large'},413);
   let value;try{const raw=await request.text();if(raw.length>12000)return json({error:'Request too large'},413);value=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
   if(!value||typeof value!=='object'||Array.isArray(value))return json({error:'Invalid request'},400);
   if(value.website)return json({error:'Invalid request'},400);
   if(!/^[a-f0-9-]{36}$/i.test(value.id||'')||!['booking','quote'].includes(value.type)||!ALLOWED.has(value.service)||value.consent!==true)return json({error:'Check your request details and consent'},400);
   const name=text(value.name,120),email=text(value.email,254).toLowerCase(),vehicle=text(value.vehicle,120),phone=text(value.phone,40);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))return json({error:'Add a valid name and email'},400);
   if(!Array.isArray(value.services)||value.services.length<1||value.services.length>12||value.services.some(s=>!OPTIONS.has(s)))return json({error:'Select valid services'},400);
   if(!env.DB)return json({error:'Request storage is unavailable'},503);
   if(!value.formPath)return json({error:'Form page required'},400);
   if(value.formPath){
    if(!safePath(value.formPath))return json({error:'Invalid form page'},400);
    const canonical=value.formPath.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/,'/satin').replace(/\/$/,'');
    const expected={'Auto Detailing':'/satin/auto-detailing','Interior Detailing':'/satin/auto-detailing/interior-detailing','Exterior Detailing':'/satin/auto-detailing/exterior-detailing','Paint Correction':'/satin/auto-detailing/paint-correction','Ceramic Coating':'/satin/auto-detailing/ceramic-coating','Social Media Services':'/satin/social-media-services','Videography':'/satin/videography'};
    if(canonical!==(value.type==='booking'?'/satin/auto-detailing/booking':expected[value.service]))return json({error:'Form does not match this service'},400);
    const config=await env.DB.prepare('SELECT value FROM site_settings WHERE key = ?').bind('published:'+value.formPath.replace(/\/$/,'')).first();
    if(config){const custom=cleanCustom(value.custom);for(const field of JSON.parse(config.value).fields||[]){const answer=custom[field.key]||'';if(field.required&&!answer.trim())return json({error:'Complete '+field.label},400);if(answer&&(field.type==='email'&&!/^\S+@\S+\.\S+$/.test(answer)||field.type==='number'&&!Number.isFinite(Number(answer))))return json({error:'Check '+field.label},400);}}
   }
   const selected=[...new Set(value.services)],detail=JSON.stringify({services:selected,vehicle,vehicleSize:text(value.vehicleSize,40),plan:text(value.plan,100),notes:text(value.notes,2000),custom:cleanCustom(value.custom),timezone:'America/Toronto'});
   let date='',time='';
   if(value.type==='booking'){
    date=text(value.date,10);time=text(value.time,5);
    if(!(await bookingSlots(env.DB,date)).includes(time))return json({error:'This time is unavailable. Select another offered time.'},400);
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const maxDate=new Date();maxDate.setUTCFullYear(maxDate.getUTCFullYear()+1);
    const parsedDate=new Date(date+'T12:00:00Z');
    if(!vehicle||!value.service.includes('Detailing')&&!['Ceramic Coating','Paint Correction'].includes(value.service)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date||date<today||date>maxDate.toISOString().slice(0,10)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return json({error:'Choose a valid future date, time and vehicle'},400);
    if(date===today){const current=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Toronto',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());if(time<=current)return json({error:'Choose a future appointment time'},400);}
   }
   if(!env.DB)return json({error:'Booking is temporarily unavailable. Please contact info@satingraphic.ca.'},503);
   try{
    const existing=await env.DB.prepare('SELECT email FROM service_requests WHERE id = ?').bind(value.id).first();
    const reference='SG-'+value.id.slice(0,8).toUpperCase();
    if(existing)return existing.email===email?json({reference,status:'pending_confirmation'}):json({error:'Please start a new request'},409);
    const since=new Date(Date.now()-3600000).toISOString();
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM service_requests WHERE email = ? AND created_at > ?').bind(email,since).first();
    if(count.n>=5)return json({error:'Too many requests. Please wait or contact us directly.'},429);
    await env.DB.prepare('INSERT INTO service_requests (id, type, service, name, email, phone, preferred_date, preferred_time, details, status, created_at, consent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(value.id,value.type,value.service,name,email,phone,date,time,detail,'pending_confirmation',new Date().toISOString(),new Date().toISOString()).run();
    return json({reference,status:'pending_confirmation'},201);
   }catch(error){console.error('Service request storage failed',error?.message);return json({error:'Your request could not be saved. Please try again.'},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
  if(url.searchParams.has('cms')&&url.pathname.startsWith('/satin')&&!isAdmin(request))return new Response('Owner sign-in required',{status:403,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
  const customPath=url.pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/,'/satin').replace(/^\/satin/,'').replace(/\/$/,'');
  if(['/print-shop/large-format/poly-bag-lawn-sign','/shop/dtf-transfers'].includes(customPath)||customPath.startsWith('/apparel')||customPath==='/wallpaper'||customPath.startsWith('/wallpaper/')||['/design-agreement','/installation-terms'].includes(customPath)||/\/paint-protection-film\/(partial|full)$/.test(customPath)){
   const page=customPage(customPath,await serviceSettings(env.DB),await publicProducts(env.DB));if(!page)return new Response('Not found',{status:404});
   const shell=await env.ASSETS.fetch(new Request(new URL('/satin/',url),request));let html=await shell.text();html=html.replace(/(<main\b[^>]*>)[\s\S]*?(<\/main>)/,(_,a,b)=>a+'<div class="page-enter">'+page.html+'</div>'+b).replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapePage(page.title)+' | Satin Graphic</title>').replace(/data-prerender-path="[^"]*"/,'data-prerender-path="'+customPath+'"');
   html=html.replace(/(<link rel="canonical" href=")[^"]*/,(_,a)=>a+url.origin+url.pathname).replace(/(<meta property="og:url" content=")[^"]*/,(_,a)=>a+url.origin+url.pathname).replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g,(_,a)=>a+escapePage(page.title)+' | Satin Graphic');
   html=html.replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*/g,(_,a)=>a+escapePage(page.description||page.title+' — custom services from Satin Graphic in Vaughan.')).replace(/<script type="application\/ld\+json" id="page-schema">[\s\S]*?<\/script>/,'').replace('</head>','<link rel="stylesheet" href="/services.css"></head>');return renderContent(new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}}),request,env);
  }
  const portfolioResult=await portfolioRoutes(request,env,url);if(portfolioResult)return portfolioResult;
  if(/^\/satin(?:\/(fa|fr|es))?\/shop\/products\/[a-z0-9-]+\/?$/.test(url.pathname)){const html=await env.ASSETS.fetch(new Request(new URL('/satin/index.html',url),request));return new Response(html.body,{status:html.status,headers:html.headers});}
  if(/^\/satin(?:\/(fa|fr|es))?\/(wallpaper\/[a-z-]+|design-agreement|installation-terms|vehicle-wraps\/paint-protection-film\/(partial|full))\/?$/.test(url.pathname)){const r=await env.ASSETS.fetch(new Request(new URL('/satin/',url),request));return new Response(r.body,{headers:r.headers});}
  return renderContent(await env.ASSETS.fetch(request),request,env);
 }
};

function cleanCustom(value){if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).slice(0,20).filter(([k,v])=>/^[a-z0-9_-]{1,40}$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,1000)]));}
const OWNER_EMAIL='mehrad.tr@gmail.com';
const safePath=v=>typeof v==='string'&&/^\/satin(?:\/[a-z0-9-]+)*\/?$/.test(v)&&v.length<240;
const isAdmin=r=>isVerifiedViewer(r)||(!!r.headers.get('oai-authenticated-user-id')&&r.headers.get('oai-authenticated-user-email')?.toLowerCase()===OWNER_EMAIL);
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('Use JSON');const raw=await request.text();if(raw.length>60000)throw Error('Request too large');return JSON.parse(raw);}
async function adminRoutes(request,env,url){
 const path=url.pathname;
 const protectedRoute=path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/');
 if(protectedRoute&&!isAdmin(request)){
  if(path.startsWith('/api/'))return json({error:'Owner sign-in required'},403);
  if(!request.headers.get('oai-authenticated-user-id'))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to='+encodeURIComponent('/admin/'),302);
  return new Response('This management panel is restricted to the site owner.',{status:403});
 }
 if(path==='/admin')return Response.redirect(url.origin+'/admin/',302);
 if(protectedRoute&&!path.startsWith('/api/')){const res=await env.ASSETS.fetch(request);const h=new Headers(res.headers);h.set('Cache-Control','private, no-store');h.set('X-Robots-Tag','noindex, nofollow');return new Response(res.body,{status:res.status,headers:h});}
 if(!path.startsWith('/api/admin/')&&!['/api/site-content','/api/visit','/api/pricing'].includes(path))return null;
 if(!env.DB)return json({error:'Management storage is unavailable'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin'},403);
 try{
  const db=env.DB;
  if((path==='/api/pricing'||path==='/api/admin/pricing')&&request.method==='GET'){const r=await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind('pricing').first();return json(r?JSON.parse(r.value):DEFAULT_PRICING);}
  if(path==='/api/admin/pricing'&&request.method==='POST'){
   const v=await body(request);if(!v.bases||typeof v.bases!=='object'||Object.keys(v.bases).length!==Object.keys(DEFAULT_PRICING.bases).length||Object.keys(DEFAULT_PRICING.bases).some(k=>!Number.isFinite(v.bases[k])||v.bases[k]<0||v.bases[k]>1000000)||!Number.isFinite(v.roofMultiplier)||v.roofMultiplier<1||v.roofMultiplier>3||!Number.isFinite(v.designDeposit)||v.designDeposit<0||v.designDeposit>10000)return json({error:'Check pricing values'},400);
   const value={bases:v.bases,roofMultiplier:v.roofMultiplier,designDeposit:v.designDeposit};await db.prepare('INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('pricing',JSON.stringify(value),new Date().toISOString()).run();return json({saved:true});
  }
  if(path==='/api/visit'&&request.method==='POST'){
   const v=await body(request);if(!/^[a-f0-9-]{36}$/.test(v.id||'')||!safePath(v.path)||v.consent!==true)return json({error:'Invalid visit'},400);
   const now=new Date().toISOString();const country=text(request.cf?.country||'Unknown',60),city=text(request.cf?.city||'Unknown',100);
   await db.batch([db.prepare('DELETE FROM site_visitors WHERE last_seen < ?').bind(new Date(Date.now()-86400000).toISOString()),db.prepare('INSERT INTO site_visitors (id,path,country,city,last_seen) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET path=excluded.path,last_seen=excluded.last_seen').bind(v.id,v.path,country,city,now)]);return json({saved:true});
  }
  if(path==='/api/admin/overview'&&request.method==='GET'){
   const reqs=await db.prepare('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 300').all();
   const docs=await db.prepare('SELECT * FROM business_documents ORDER BY updated_at DESC LIMIT 300').all();
   const active=await db.prepare('SELECT path,country,city,last_seen FROM site_visitors WHERE last_seen > ? ORDER BY last_seen DESC LIMIT 100').bind(new Date(Date.now()-90000).toISOString()).all();
   return json({requests:reqs.results,documents:docs.results.map(r=>({...r,data:JSON.parse(r.data)})),visitors:active.results,identity:OWNER_EMAIL});
  }
  if(path==='/api/admin/request'&&request.method==='POST'){
   const v=await body(request);if(!/^[a-f0-9-]{36}$/i.test(v.id||'')||!['pending_confirmation','confirmed','completed','cancelled'].includes(v.status))return json({error:'Invalid status'},400);
   const result=await db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').bind(v.status,v.id).run();if(!result.meta.changes)return json({error:'Request not found'},404);return json({saved:true});
  }
  if(path==='/api/admin/document'&&request.method==='POST'){
   const v=await body(request);if(v.kind==='invoice'||v.kind==='quote')return json({error:'Use the dedicated invoice or quote editor'},400);if(!['quote','invoice','order'].includes(v.kind)||!['draft','sent','accepted','cancelled'].includes(v.status)||!Array.isArray(v.items)||!v.items.length||v.items.length>30)return json({error:'Check document details'},400);
   if(v.id&&!/^[a-f0-9-]{36}$/i.test(v.id))return json({error:'Invalid document'},400);
   const items=v.items.map(i=>({description:text(i.description,240),quantity:Number(i.quantity),price:Number(i.price)}));
   if(items.some(i=>!i.description||!Number.isFinite(i.quantity)||i.quantity<=0||i.quantity>100000||!Number.isFinite(i.price)||i.price<0||i.price>1000000))return json({error:'Check quantities and prices'},400);
   const tax=Number(v.tax);if(!Number.isFinite(tax)||tax<0||tax>30)return json({error:'Check tax percentage'},400);
   const customer=text(v.customer,120),email=text(v.email,254);if(!customer)return json({error:'Customer name required'},400);
   const subtotal=Math.round(items.reduce((s,i)=>s+i.quantity*i.price,0)*100),total=subtotal+Math.round(subtotal*tax/100);
   const id=v.id||crypto.randomUUID(),now=new Date().toISOString();const data=JSON.stringify({customer,email,items,tax,subtotal,total,currency:'CAD',notes:text(v.notes,2000)});
   await db.prepare('INSERT INTO business_documents (id,kind,status,data,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=excluded.updated_at WHERE business_documents.kind=excluded.kind').bind(id,v.kind,v.status,data,now).run();return json({saved:true,id});
  }
  return json({error:'Not found'},404);
 }catch(e){console.error('Management operation failed',e?.message);return json({error:'Could not complete the operation. Check your input and retry.'},400);}
}

async function renderContent(response,request,env){return renderNavigation(await renderPricing(await renderSavedContent(response,request,env),request,env),request,env);}

export default {fetch:(request,env)=>viewerFetch(request,env,app)};
