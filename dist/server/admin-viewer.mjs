const encoder=new TextEncoder();
const COOKIE='__Host-satin-admin-viewer';
const MARKER='x-satin-verified-viewer';
const VIEWER_EMAIL='p.moeini67@gmail.com';
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isVerifiedViewer=request=>request.headers.get(MARKER)==='1';
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function signature(value,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
function loginPage(env,error=''){return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Satin · Admin login</title><style>body{margin:0;background:#f3f4f6;font:16px system-ui;color:#18202b;display:grid;place-items:center;min-height:100vh}main{background:white;padding:36px;border-radius:16px;box-shadow:0 8px 40px #0001;width:min(360px,80vw)}h1{margin:0 0 8px}label{display:block;margin-top:20px}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:1px solid #cbd0d8;font:inherit;margin-top:7px}button{background:#17202c;color:white;cursor:pointer;margin-top:24px}p{color:#586273;font-size:14px}.error{color:#b42318}</style></head><body><main><h1>Satin Management</h1><p>Temporary access · ${env.TEMP_ADMIN_ACCESS_MODE==='admin'?'Full admin permissions':'View only'}</p>${error?`<p class="error" role="alert">${escape(error)}</p>`:''}<form method="post" action="/admin/login"><label>Username<input name="username" autocomplete="username" required maxlength="120"></label><label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="200"></label><button>Open admin panel</button></form><p><a href="/signin-with-chatgpt?return_to=%2Fadmin%2F">Sign in with ChatGPT</a></p></main></body></html>`,{status:error?401:200,headers});}
async function login(request,env){
 if(!env.TEMP_ADMIN_PASSWORD_HASH||!env.TEMP_ADMIN_SESSION_SECRET||!env.TEMP_ADMIN_USERNAME||!env.DB)return new Response('Temporary login is not configured.',{status:503,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response('Invalid request origin.',{status:403,headers});
 if(Number(request.headers.get('Content-Length')||0)>2048)return new Response('Request too large.',{status:413,headers});
 const body=await request.text();if(body.length>2048)return new Response('Request too large.',{status:413,headers});
 const form=new URLSearchParams(body),username=form.get('username')||'',password=form.get('password')||'';
 const now=Date.now(),window=Math.floor(now/900000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const key='temporary_admin_attempts:'+await digest(ip+':'+window);
 const count=await env.DB.prepare('SELECT value FROM site_settings WHERE key = ?').bind(key).first();
 if(Number(count?.value||0)>=8)return new Response('Too many login attempts. Try again in 15 minutes.',{status:429,headers:{...headers,'Retry-After':'900'}});
 const hash=await digest(password);
 if(!equal(username,env.TEMP_ADMIN_USERNAME)||!equal(hash,env.TEMP_ADMIN_PASSWORD_HASH)){
  await env.DB.prepare('INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT),updated_at=excluded.updated_at').bind(key,'1',new Date(now).toISOString()).run();
  return loginPage(env,'Username or password is incorrect.');
 }
 const expiry=now+8*3600000,payload=String(expiry),mac=await signature(payload,env.TEMP_ADMIN_SESSION_SECRET);
 return new Response(null,{status:303,headers:{Location:'/admin/','Cache-Control':'no-store','Set-Cookie':`${COOKIE}=${payload}.${mac}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`}});
}
async function validSession(request,env){
 if(!env.TEMP_ADMIN_PASSWORD_HASH||!env.TEMP_ADMIN_SESSION_SECRET||!env.TEMP_ADMIN_USERNAME)return false;
 const value=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!value)return false;const [expiry,mac,...extra]=value.split('.');
 if(extra.length||!/^\d{13}$/.test(expiry)||!Number.isFinite(Number(expiry))||Number(expiry)<=Date.now()||Number(expiry)>Date.now()+8*3600000||!/^[a-f0-9]{64}$/.test(mac||''))return false;
 return equal(mac,await signature(expiry,env.TEMP_ADMIN_SESSION_SECRET));
}
function viewerHTML(html,canEdit){return html.replace('Owner account',canEdit?'Developer account':'Viewer account')+`<script src="/admin/${canEdit?'admin-access':'view-only'}.js" defer></script>`;}
export async function viewerFetch(request,env,app){
 const url=new URL(request.url),clean=new Headers(request.headers);clean.delete(MARKER);request=new Request(request,{headers:clean});
 if(url.pathname==='/admin/login'){
  if(request.method==='GET')return loginPage(env);
  if(request.method==='POST')try{return await login(request,env);}catch{return new Response('Login is temporarily unavailable. Please retry.',{status:503,headers});}
  return new Response('Method not allowed',{status:405,headers});
 }
 if(url.pathname==='/admin/logout')return new Response(null,{status:303,headers:{Location:'/admin/login','Set-Cookie':`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,'Cache-Control':'no-store'}});
 const owner=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()==='mehrad.tr@gmail.com';
 const viewer=!owner&&((!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===VIEWER_EMAIL)||await validSession(request,env));
 const canEdit=env.TEMP_ADMIN_ACCESS_MODE==='admin';
 if(viewer){
  if(!canEdit&&!['GET','HEAD','OPTIONS'].includes(request.method))return new Response(JSON.stringify({error:'This account has view-only access. Changes are disabled.'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  clean.set(MARKER,'1');request=new Request(request,{headers:clean});
 }
 if(!owner&&!viewer&&(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))&&request.method==='GET')return Response.redirect(url.origin+'/admin/login',302);
 const response=await app.fetch(request,env);
 if(viewer&&['/admin/','/admin/index.html'].includes(url.pathname)&&response.status===200){
  const h=new Headers(response.headers);h.delete('Content-Length');h.set('Cache-Control','private, no-store');return new Response(viewerHTML(await response.text(),canEdit),{status:response.status,headers:h});
 }
 return response;
}
