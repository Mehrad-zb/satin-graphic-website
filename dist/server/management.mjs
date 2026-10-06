import {invoiceTotals} from './commerce.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const clean=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const validId=v=>/^[a-f0-9-]{36}$/i.test(v||'');
const defaults={name:'Satin Graphic',email:'info@satingraphic.ca',phone:'',address:'',taxId:'',terms:'',tax:13,currency:'CAD'};
async function input(r){const raw=await r.text();if(raw.length>60000)throw Error('Request too large');return JSON.parse(raw);}
async function invoiceId(id){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('quote-invoice:'+id)));const s=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);return s.slice(0,8)+'-'+s.slice(8,12)+'-4'+s.slice(13,16)+'-a'+s.slice(17,20)+'-'+s.slice(20);}
const date=v=>{if(!v)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(new Date(v+'T12:00:00Z').getTime())||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('Check date');return v;};
export async function managementRoutes(request,env,url,isAdmin){
 const path=url.pathname;if(!['/api/admin/quotes','/api/admin/quotes/save','/api/admin/quotes/convert','/api/admin/reports','/api/admin/payments','/api/admin/business'].includes(path))return null;
 if(!isAdmin(request))return json({error:'Owner sign-in required'},403);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin'},403);
 if(!env.DB)return json({error:'Storage unavailable'},503);
 try{const db=env.DB,now=new Date().toISOString();
 if(path==='/api/admin/business'){
 const old=await db.prepare("SELECT value FROM site_settings WHERE key='business'").first();
 if(request.method==='GET')return json({business:old?JSON.parse(old.value):defaults});
 const v=await input(request),b={};for(const [k,n] of [['name',160],['email',254],['phone',60],['address',1000],['taxId',100],['terms',3000]])b[k]=clean(v[k],n);b.tax=Number(v.tax);b.currency='CAD';if(!b.name||b.email&&!/^\S+@\S+\.\S+$/.test(b.email)||!Number.isFinite(b.tax)||b.tax<0||b.tax>30)throw Error('Check business name, email and tax');
 await db.prepare("INSERT INTO site_settings (key,value,updated_at) VALUES ('business',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(b),now).run();return json({saved:true,business:b});
 }
 if(path==='/api/admin/quotes'&&request.method==='GET'){
 const rows=(await db.prepare("SELECT * FROM business_documents WHERE kind='quote' ORDER BY updated_at DESC LIMIT 300").all()).results;
 const quotes=await Promise.all(rows.map(async r=>{const d=JSON.parse(r.data),linked=await db.prepare("SELECT id FROM business_documents WHERE id=? AND kind='invoice'").bind(await invoiceId(r.id)).first();return {id:r.id,...d,status:r.status,displayStatus:r.status==='sent'&&d.dueDate&&d.dueDate<now.slice(0,10)?'expired':r.status,invoiceId:linked?.id||null,updatedAt:r.updated_at};}));return json({quotes});
 }
 if(path==='/api/admin/quotes/save'&&request.method==='POST'){
 const v=await input(request),id=v.id||crypto.randomUUID();if(!validId(id)||!['draft','sent','accepted','cancelled'].includes(v.status))throw Error('Check quote status');
 const old=await db.prepare('SELECT * FROM business_documents WHERE id=?').bind(id).first();if(old&&old.kind!=='quote')throw Error('Invalid quote');const before=old?JSON.parse(old.data):null;
 if(await db.prepare("SELECT id FROM business_documents WHERE id=? AND kind='invoice'").bind(await invoiceId(id)).first())throw Error('Converted quote is locked. Edit its draft invoice.');
 if((before?.revision||0)!==(v.expectedRevision||0))return json({error:'Quote changed elsewhere. Reopen it.'},409);
 let c=v.customerId?await db.prepare('SELECT * FROM customers WHERE id=?').bind(v.customerId).first():{name:clean(v.customer,120),email:clean(v.email,254),business:clean(v.business,160),address:clean(v.address,1000),phone:clean(v.phone,60)};
 if(!c?.name)throw Error('Choose a customer');
 const profile=await db.prepare("SELECT value FROM site_settings WHERE key='business'").first();
 const d={...invoiceTotals(v),customerId:c.id||null,customer:c.name,email:c.email,business:c.business,address:c.address,phone:c.phone,title:clean(v.title)||'Price quote',dueDate:date(clean(v.dueDate,10)),issueDate:before?.issueDate||date(clean(v.issueDate,10))||now.slice(0,10),notes:clean(v.notes,3000),terms:clean(v.terms,3000),seller:profile?JSON.parse(profile.value):defaults,revision:(before?.revision||0)+1};
 const result=old?await db.prepare("UPDATE business_documents SET status=?,data=?,updated_at=? WHERE id=? AND kind='quote' AND data=? AND NOT EXISTS(SELECT 1 FROM business_documents WHERE id=? AND kind='invoice')").bind(v.status,JSON.stringify(d),now,id,old.data,await invoiceId(id)).run():await db.prepare("INSERT INTO business_documents(id,kind,status,data,updated_at) VALUES (?,'quote',?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,v.status,JSON.stringify(d),now).run();
 if(!result.meta.changes)return json({error:'Quote changed elsewhere. Reopen it.'},409);return json({saved:true,id});
 }
 if(path==='/api/admin/quotes/convert'&&request.method==='POST'){
 const v=await input(request);if(!validId(v.id))throw Error('Invalid quote');const row=await db.prepare("SELECT * FROM business_documents WHERE id=? AND kind='quote'").bind(v.id).first();if(!row||row.status!=='accepted')throw Error('Mark the quote accepted before converting');
 const id=await invoiceId(v.id),d=JSON.parse(row.data),data={...d,sourceQuoteId:v.id,title:d.title||'Invoice',issueDate:now.slice(0,10),dueDate:'',revision:1};
 await db.prepare("INSERT INTO business_documents (id,kind,status,data,updated_at) SELECT ?,'invoice','draft',?,? WHERE EXISTS(SELECT 1 FROM business_documents WHERE id=? AND kind='quote' AND status='accepted' AND data=?) ON CONFLICT(id) DO NOTHING").bind(id,JSON.stringify(data),now,v.id,row.data).run();
 if(!await db.prepare("SELECT id FROM business_documents WHERE id=? AND kind='invoice'").bind(id).first())return json({error:'Quote changed. Reopen it.'},409);return json({saved:true,id});
 }
 if(path==='/api/admin/payments'&&request.method==='GET')return json({payments:(await db.prepare("SELECT p.*,json_extract(d.data,'$.title') AS title,json_extract(d.data,'$.customer') AS customer FROM invoice_payments p JOIN business_documents d ON p.document_id=d.id ORDER BY p.created_at DESC LIMIT 1000").all()).results});
 if(path==='/api/admin/reports'&&request.method==='GET'){
 const days=Number(url.searchParams.get('days')||30);if(![7,30,90,365].includes(days))throw Error('Choose a valid reporting period');const since=new Date(Date.now()-days*86400000).toISOString();
 const payments=await db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS total FROM invoice_payments WHERE created_at>=?').bind(since).first();
 const daily=(await db.prepare('SELECT substr(created_at,1,10) AS date,SUM(amount) AS total,COUNT(*) AS count FROM invoice_payments WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY date').bind(since).all()).results;
 const requests=(await db.prepare('SELECT type,status,COUNT(*) AS count FROM service_requests WHERE created_at>=? GROUP BY type,status').bind(since).all()).results;
 const docs=(await db.prepare("SELECT d.id,d.status,json_extract(d.data,'$.total') AS total,json_extract(d.data,'$.dueDate') AS dueDate,COALESCE(SUM(p.amount),0) AS paid FROM business_documents d LEFT JOIN invoice_payments p ON d.id=p.document_id WHERE d.kind='invoice' GROUP BY d.id").all()).results;
 const open=docs.filter(d=>!['draft','cancelled'].includes(d.status)),outstanding=open.reduce((s,d)=>s+Math.max(0,d.total-d.paid),0),overdue=open.filter(d=>d.dueDate&&d.dueDate<now.slice(0,10)).reduce((s,d)=>s+Math.max(0,d.total-d.paid),0);
 const customers=await db.prepare('SELECT COUNT(*) AS count FROM customers').first();
 return json({days,since,generatedAt:now,payments,daily,requests,invoices:{count:docs.length,outstanding,overdue,paid:docs.reduce((s,d)=>s+d.paid,0)},customers:customers.count,currency:'CAD',onlinePaymentsConnected:false});
 }
 return json({error:'Not found'},404);
 }catch(e){return json({error:e.message||'Operation failed'},400);}
}
