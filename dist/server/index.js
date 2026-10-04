const ALLOWED = new Set(['Auto Detailing','Interior Detailing','Exterior Detailing','Paint Correction','Ceramic Coating','Social Media Services','Videography']);
const OPTIONS = new Set(['Interior detailing','Exterior detailing','Paint correction','Ceramic coating','Pet hair removal','Upholstery cleaning','Social strategy','Post design','Short-form video','Content calendar','Publishing support','Campaign creative','Brand film','Product video','Social clips','Event coverage','Editing','Captions']);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
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
   const selected=[...new Set(value.services)],detail=JSON.stringify({services:selected,vehicle,vehicleSize:text(value.vehicleSize,40),plan:text(value.plan,100),notes:text(value.notes,2000),timezone:'America/Toronto'});
   let date='',time='';
   if(value.type==='booking'){
    date=text(value.date,10);time=text(value.time,5);
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
  return env.ASSETS.fetch(request);
 }
};
