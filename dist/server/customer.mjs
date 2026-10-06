import {session} from './studio.mjs';
const j=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export const customer=request=>{const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return id&&email?{id,email,name:request.headers.get('oai-authenticated-user-name')||email.split('@')[0]}:null;};
export async function customerRoutes(request,env,url,isAdmin){
 const p=url.pathname;if(!['/api/customer/me','/api/product-reviews','/api/digital/download','/api/admin/digital-upload'].includes(p))return null;
 if(!env.DB)return j({error:'Storage unavailable'},503);if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return j({error:'Invalid origin'},403);
 try{
 if(p==='/api/customer/me')return j({customer:customer(request),login:'/signin-with-chatgpt?return_to='+encodeURIComponent('/satin/account/')});
 if(p==='/api/product-reviews'){
  if(request.method==='GET'){const rows=await env.DB.prepare('SELECT name,rating,body,created_at FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 100').bind(clean(url.searchParams.get('product'),80)).all();return j({reviews:rows.results});}
  if(request.method!=='POST')return j({error:'Use POST'},405);const who=customer(request);if(!who)return j({error:'Log in before writing a review.'},401);const v=await request.json();if(!/^[a-z0-9-]{2,80}$/.test(v.product||'')||!Number.isInteger(v.rating)||v.rating<1||v.rating>5||clean(v.body,1500).length<10)throw Error('Choose a rating and add at least 10 characters.');const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM product_reviews WHERE user_id = ? AND created_at > ?').bind(who.id,new Date(Date.now()-3600000).toISOString()).first();if(count.n>=5)throw Error('Please wait before submitting another review.');await env.DB.prepare('INSERT INTO product_reviews (id,product_id,user_id,name,rating,body,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),v.product,who.id,clean(who.name,120),v.rating,clean(v.body,1500),new Date().toISOString()).run();return j({saved:true},201);
 }
 if(p==='/api/admin/digital-upload'){
  if(!isAdmin(request))return j({error:'Owner sign-in required'},403);if(request.method!=='POST'||!env.FILES)return j({error:'File storage unavailable'},503);const fd=await request.formData(),file=fd.get('file'),ruleId=fd.get('ruleId');if(!/^[a-z0-9-]{2,80}$/.test(ruleId||'')||!file?.size||file.size>20000000||!/\.(svg|pdf|ai|eps|zip)$/i.test(file.name))throw Error('Upload a vector or ZIP file, up to 20 MB.');const id=crypto.randomUUID(),key='digital/'+id;await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:'application/octet-stream'}});await env.DB.prepare('INSERT INTO digital_files (id,rule_id,object_key,name,created_at) VALUES (?,?,?,?,?)').bind(id,ruleId,key,clean(file.name,160),new Date().toISOString()).run();return j({id,name:file.name},201);
 }
 if(p==='/api/digital/download'){
  if(request.method!=='GET')return j({error:'Use GET'},405);const s=await session(request,env.DB);if(!s)return j({error:'Sign in to the browser session used for purchase.'},401);const order=await env.DB.prepare("SELECT snapshot FROM checkout_orders WHERE id = ? AND session_id = ? AND status = 'paid'").bind(url.searchParams.get('order'),s.id).first();if(!order)return j({error:'A confirmed payment is required.'},403);const items=JSON.parse(order.snapshot).items,item=items.find(i=>i.id===url.searchParams.get('item'));if(!item||!item.digitalKey)throw Error('No download attached to this item.');const file=await env.FILES.get(item.digitalKey);if(!file)return j({error:'File unavailable. Contact info@satingraphic.ca with your order reference.'},404);return new Response(file.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+String(item.digitalName||'satin-artwork.zip').replace(/[^a-zA-Z0-9._-]/g,'_')+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 }catch(e){return j({error:e.message},400);}
}
