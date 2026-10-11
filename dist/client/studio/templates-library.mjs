// Design Studio generated template library.
// Layout PROGRAMS × industry THEMES → 100+ templates per product family. Every program reflows to any artboard:
// content is stacked into regions with a flow engine that measures (estimates) text, shrinks everything uniformly to
// fit the region and picks text colours by WCAG contrast against the region's background. Coordinates are fractions
// of the trim box; sizes are fractions of the short side (same spec format as templates.mjs).
import {NEW_THEMES,LEGACY_META} from './templates-themes.mjs';

const CONTACT={phone:'(905) 555-0123',email:'hello@yourbusiness.ca',web:'www.yourbusiness.ca',address:'123 Main Street, Vaughan, ON'};

/* ---------------- primitives ---------------- */
const txt=(text,o)=>({type:'text',text:String(text),align:'center',...o});
const rect=(x,y,w,h,color,o={})=>({type:'rect',x,y,w,h,color,...o});
const ell=(x,y,w,h,color,o={})=>({type:'circle',x,y,w,h,color,...o});
const shp=(shape,x,y,w,h,color,o={})=>({type:'shape',shape,x,y,w,h,color,...o});
const hline=(x,y,w,color,st=.006)=>({type:'line',x,y,w,color,st});
const mx=(c,d)=>d*c.mn/c.W,my=(c,d)=>d*c.mn/c.H;
const sq=(c,cx,cy,d)=>({x:cx-mx(c,d)/2,y:cy-my(c,d)/2,w:mx(c,d),h:my(c,d)});
const icon=(c,shape,cx,cy,d,color,o={})=>{const b=sq(c,cx,cy,d);return shp(shape,b.x,b.y,b.w,b.h,color,o);};
const dot=(c,cx,cy,d,color,o={})=>{const b=sq(c,cx,cy,d);return ell(b.x,b.y,b.w,b.h,color,o);};
const th_=(size,c,lines=1)=>size*c.mn*(1.25+1.2*(lines-1))/c.H;
const nl=s=>String(s).split('\n').length;

/* ---------------- colour ---------------- */
const hx=h=>{const n=parseInt(h.slice(1),16);return [n>>16,(n>>8)&255,n&255];};
const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>{const x=hx(a),y=hx(b);return toHex(x.map((v,i)=>v+(y[i]-v)*t));};
const rl=h=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};const [r,g,b]=hx(h);return .2126*f(r)+.7152*f(g)+.0722*f(b);};
export const contrast=(a,b)=>{const x=rl(a),y=rl(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const on=(bg,cands,min=4.5)=>{for(const k of cands)if(k&&contrast(k,bg)>=min)return k;return contrast('#ffffff',bg)>=contrast('#141414',bg)?'#ffffff':'#141414';};
const toward=(h,target,min,vs)=>{let c=h;for(let i=0;i<24&&contrast(c,vs)<min;i++)c=mix(c,target,.1);return c;};
const isDark=h=>rl(h)<.18;

/* ---------------- text width estimate (em units; the studio re-measures with real fonts) ---------------- */
const FONTF={'Anton':.74,'Bebas Neue':.66,'Oswald':.78,'Kanit':1.02,'Alfa Slab One':1.14,'Abril Fatface':.98,'Black Ops One':1.1,'Bungee':1.22,'Righteous':1.04,'Fredoka':1.0,'Montserrat':1.12,'Poppins':1.1,'Archivo':1.0,'Rubik':1.03,'Outfit':1.0,'Figtree':.99,'Manrope':1.03,'Raleway':1.04,'Josefin Sans':.95,'Quicksand':1.0,'Nunito':1.0,'Inter':1.03,'Work Sans':1.06,'DM Sans':1.0,'Barlow':.94,'Roboto':.98,'Open Sans':1.04,'Lato':.96,
 'Playfair Display':1.02,'DM Serif Display':1.0,'Cormorant Garamond':.86,'EB Garamond':.9,'Libre Baskerville':1.12,'Lora':1.0,'Roboto Slab':1.04,'Great Vibes':.78,'Pacifico':1.08,'Kaushan Script':.96,'Sacramento':.72,'Allura':.74,'Dancing Script':.86,'Satisfy':.88,'Caveat':.8,'Lobster':.9,'Lalezar':.92,'Vazirmatn':1.0,'Space Mono':1.15,'Permanent Marker':1.12};
export function estEm(text,font,bold){let w=0;for(const ch of String(text)){if(ch===' ')w+=.27;else if('iljI.,:;\'!|’·'.includes(ch))w+=.27;else if('ftr1()-/'.includes(ch))w+=.37;else if('mwMW@%&'.includes(ch))w+=.88;else if(/[A-Z0-9$]/.test(ch))w+=.67;else if(/[؀-ۿ]/.test(ch))w+=.5;else w+=.54;}return w*(FONTF[font]||1)*(bold?1.07:1);}
const lineEm=(t,font,bold,spacing=0)=>Math.max(...String(t).split('\n').map(l=>estEm(l,font,bold)+(spacing?Math.max(0,[...l].length-1)*spacing:0)))*1.04;
// largest size (≤ size) whose estimated width fits maxW (fraction of W)
const fitSize=(c,text,font,bold,spacing,size,maxW)=>{const w=lineEm(text,font,bold,spacing)*size*c.mn/c.W;return w>maxW?size*maxW/w:size;};

/* ---------------- palette ---------------- */
function pal(th){if(th._pal)return th._pal;const pri=th.pri||(rl(th.bg)>.62?th.dark:th.bg);let acc=th.acc||th.accent;if(acc===pri||contrast(acc,pri)<1.25)acc=th.accent2&&th.accent2!==pri?th.accent2:th.dark;
 const acc2=th.acc2||th.accent2||acc,light=th.light||'#ffffff',dark=isDark(th.dark)?th.dark:'#151515',ink=isDark(th.ink||'#ffffff')?th.ink:dark;
 return th._pal={pri,acc,acc2,light,dark,soft:th.soft||mix(acc,'#ffffff',.8),ink,muted:th.muted||'#666666',grad:th.grad};}

/* ---------------- family profiles: base sizes (fraction of the short side) and which parts exist ---------------- */
const PROF={
 card:{logo:.2,brand:.085,kicker:.04,head:.098,sub:.047,list:0,cta:0,contact:.044,offer:0,lines:['phone','email','web'],headKey:'person',subKey:'role'},
 print:{logo:.13,brand:.05,kicker:.03,head:.11,sub:.038,list:.036,cta:.034,contact:.03,offer:.1,headKey:'headline',subKey:'sub'},
 hanger:{logo:.22,brand:.08,kicker:.045,head:.13,sub:.05,list:.048,cta:.05,contact:.055,offer:.14,headKey:'headline',subKey:'sub'},
 tall:{logo:.3,brand:.08,kicker:.04,head:.14,sub:.05,list:.05,cta:.05,contact:.06,offer:.15,headKey:'headline',subKey:'sub'},
 wide:{logo:.26,brand:.08,kicker:.055,head:.2,sub:.065,list:0,cta:.06,contact:.08,offer:.18,headKey:'headline',subKey:'sub'},
 sign:{logo:.17,brand:.075,kicker:.05,head:.2,sub:.055,list:0,cta:0,contact:.1,offer:.16,headKey:'big',subKey:'tagline'},
 cover:{logo:.26,brand:.09,kicker:.045,head:.1,sub:.05,list:0,cta:0,contact:.042,offer:0,lines:['web'],headKey:'headline',subKey:'tagline'},
 vehicle:{logo:.4,brand:.2,kicker:.065,head:.2,sub:.065,list:.06,cta:0,contact:.13,offer:0,headKey:'headline',subKey:'tagline'}
};

/* ---------------- kit: content parts + flow engine bound to a canvas, theme and family ---------------- */
function kit(c,th,fam,palOverride,fontOverride){const P={...pal(th),...(palOverride||{})},S=PROF[fam],cp=th.copy,rtl=!!th.rtl;
 const F={head:th.head,hb:th.hb,body:th.body,script:th.script,...(rtl?{}:fontOverride||{})};
 const up=s=>rtl?s:String(s).toUpperCase();
 const K={c,th,P,S,F,fam,rtl,cp,up,land:c.r>=1.15,y0:fam==='hanger'?.25:0,y1:fam==='tall'?.93:1};
 const I=bg=>on(bg,[P.ink,P.light,'#ffffff','#141414']);
 K.I=I;K.A=(bg,min=3)=>on(bg,[P.acc,P.acc2,P.pri,I(bg)],min);K.Mu=bg=>on(bg,[P.muted,mix(I(bg),bg,.3)],4.5);
 K.role=(r,bg)=>r==='acc'?K.A(bg):r==='mut'?K.Mu(bg):r==='pri'?on(bg,[P.pri,I(bg)],3):r==='acc2'?on(bg,[P.acc2,P.acc,I(bg)],3):I(bg);
 // a filled colour that stands out from bg (buttons, discs)
 K.fill=(bg,pref=[P.acc,P.pri,P.acc2])=>{for(const k of pref)if(contrast(k,bg)>=1.6)return k;return I(bg);};
 K.part=(p,o={})=>{const k=o.k||1;switch(p){
  case 'logo':return S.logo?{t:'icon',shape:o.shape||th.icon,d:S.logo*k,role:o.role||'acc',disc:o.disc,gap:o.gap}:null;
  case 'brand':return {t:'text',text:o.upper?up(cp.company):cp.company,size:S.brand*k,font:o.font||F.head,bold:o.bold??F.hb,role:o.role||'ink',spacing:rtl?0:o.spacing,gap:o.gap};
  case 'brandS':return {t:'text',text:up(cp.company),size:Math.max(S.kicker,S.brand*.6)*k,font:F.body,bold:true,role:o.role||'ink',spacing:rtl?0:(o.spacing??.18),gap:o.gap};
  case 'kicker':return S.kicker?{t:'text',text:up(cp.tagline),size:S.kicker*k,font:F.body,bold:true,role:o.role||'acc',spacing:rtl?0:(o.spacing??.12),gap:o.gap}:null;
  case 'head':{let v=cp[S.headKey]||cp.headline;if((fam==='wide'||fam==='vehicle')&&!o.keepLines)v=v.replace(/\n/g,' ');return {t:'text',text:o.upper?up(v):v,size:S.head*k,font:o.font||F.head,bold:o.bold??F.hb,italic:o.italic,role:o.role||'ink',gap:o.gap,spacing:rtl?0:o.spacing};}
  case 'script':return F.script&&cp.script&&!rtl?{t:'text',text:cp.script,size:S.head*1.15*k,font:F.script,role:o.role||'acc',gap:o.gap}:null;
  case 'sub':return S.sub?{t:'text',text:cp[S.subKey]||cp.sub,size:S.sub*k,font:F.body,role:o.role||'mut',gap:o.gap,italic:o.italic}:null;
  case 'list':return S.list?{t:'list',items:(o.num&&!rtl?cp.bullets.map((b,i)=>`0${i+1}   ${b}`):cp.bullets).slice(0,o.n||4),size:S.list*k,font:F.body,bold:o.bold,role:o.role||'ink',mark:o.num?null:(o.mark??'check'),markRole:'acc',gap:o.gap}:null;
  case 'line':return S.sub?{t:'text',text:cp.bullets.slice(0,3).join('  ·  '),size:S.sub*.9*k,font:F.body,bold:true,role:o.role||'ink',gap:o.gap}:null;
  case 'cta':return S.cta?{t:'btn',text:up(cp.cta),size:S.cta*k,font:F.body,fill:o.fill,gap:o.gap,outline:o.outline}:null;
  case 'offer':return S.offer?[{t:'text',text:cp.offer,size:S.offer*k,font:F.head,bold:F.hb,role:o.role||'ink',gap:.01},{t:'text',text:up(cp.offerSub),size:S.offer*.3*k,font:F.body,bold:true,role:o.role||'ink',spacing:rtl?0:.06}]:null;
  case 'rule':return {t:'rule',len:o.len||.14,st:o.st||.008,role:o.role||'acc',gap:o.gap};
  case 'contact':{const sz=S.contact*k;if(fam==='card')return {t:'contacts',items:S.lines,size:sz,font:F.body,role:o.role||'ink',markRole:'acc',gap:o.gap};
   if(fam==='print')return {t:'text',text:`${CONTACT.phone}   ·   ${CONTACT.web}`,size:sz,font:F.body,bold:true,role:o.role||'ink',gap:o.gap};
   if(fam==='cover')return {t:'text',text:CONTACT.web,size:sz,font:F.body,bold:true,role:o.role||'ink',spacing:.06,gap:o.gap};
   return [{t:'text',text:CONTACT.phone,size:sz,font:F.body,bold:true,role:o.role||'ink',gap:sz*.15},{t:'text',text:CONTACT.web,size:sz*.55,font:F.body,role:o.webRole||o.role||'ink',gap:o.gap}];}
  case 'cline':return {t:'text',text:`${CONTACT.phone}   |   ${CONTACT.web}`,size:S.contact*k,font:F.body,bold:true,role:o.role||'ink',gap:o.gap};
  case 'phone':return {t:'text',text:CONTACT.phone,size:S.contact*k,font:F.body,bold:true,role:o.role||'ink',gap:o.gap};
  case 'web':return {t:'text',text:CONTACT.web,size:S.contact*.55*k,font:F.body,bold:o.bold,role:o.role||'ink',gap:o.gap};
  case 'space':return {t:'space',h:o.h||.02};}return null;};
 K.parts=(spec,ov={})=>{const out=[];for(const p of spec.split(/\s+/)){if(!p)continue;const base=p.replace(/\d+$/,''),o=ov[p]||ov[base]||{},it=K.part(base,o);if(it)for(const x of [].concat(it)){if(o.color&&x.t!=='btn')x.color=o.color;if(DROP[base]&&x.drop==null)x.drop=DROP[base];out.push(x);}}return out;};
 // a region clamped to the family's safe band (hanger hole / banner stand), inset by pad (short-side units)
 K.box=(x0,y0,x1,y1,bg,pad=.07)=>{y0=Math.max(y0,K.y0);y1=Math.min(y1,K.y1);return {x:x0+mx(c,pad),y:y0+my(c,pad),w:Math.max(.02,x1-x0-2*mx(c,pad)),h:Math.max(.02,y1-y0-2*my(c,pad)),bg};};
 K.flow=(R,items,o)=>flow(K,R,items,o);
 // card back side: colour block with logo + name + website
 K.back=(bg,style=0)=>{if(fam!=='card')return undefined;const R=K.box(0,0,1,1,bg,.12);const sp=style===1?'brand rule kicker':style===2?'logo brand web':'logo brand kicker';
  return {bg,layers:K.flow(R,K.parts(sp,{logo:{k:1.1,disc:style===2?K.fill(bg,[P.light,P.soft,P.acc]):undefined,role:style===2?'pri':'acc'},brand:{k:1.15},web:{k:1.6}}),{valign:'center'})};};
 return K;}

/* ---------------- flow engine ---------------- */
// optional parts are dropped (lowest number first) when a region is too small to keep text >= MIN_PT
const DROP={kicker:1,sub:2,line:2,script:2,list:3,rule:4,brandS:4,cta:5,web:6};
const MIN_PT=5.5,MIN_SCALE={card:.5,print:.5,hanger:.55,tall:.6,wide:.78,sign:.72,cover:.55,vehicle:.75};
function flow(K,R,items,o={}){items=items.filter(Boolean);for(let i=0;i<8;i++){const r=flowOnce(K,R,items,o);if(r.ok&&r.s>=(o.minScale??MIN_SCALE[K.fam]??.5))return r.out;const opt=items.filter(x=>x.drop);if(!opt.length)return r.out;const lo=Math.min(...opt.map(x=>x.drop));const k=items.findIndex(x=>x.drop===lo);items=items.filter((_,j)=>j!==k);}return flowOnce(K,R,items,o).out;}
function flowOnce(K,R,items,{align='center',valign='center'}={}){const c=K.c;items=items.map(x=>({...x}));
 const inner=R.w*.98;
 for(const x of items){if(x.t==='text')x.size=fitSize(c,x.text,x.font,x.bold,x.spacing,x.size,inner*(x.maxW??1));
  if(x.t==='btn')x.size=fitSize(c,x.text,x.font,true,.06,x.size,inner*.94-2*mx(c,x.size*.9));
  if(x.t==='list'||x.t==='contacts'){const iw=(x.t==='contacts'||x.mark)&&align!=='center'?mx(c,x.size*1.7):0;const ls=x.t==='contacts'?x.items.map(k=>CONTACT[k]):x.items;x.size=Math.min(...ls.map(t=>fitSize(c,t,x.font,x.bold,0,x.size,inner-iw)));}}
 const hOf=(x,s)=>{switch(x.t){case 'text':return th_(x.size*s,c,nl(x.text));case 'icon':return my(c,x.d*s);case 'rule':return my(c,Math.max(.004,x.st));case 'btn':return th_(x.size*s,c)+2*my(c,x.size*s*.55);
  case 'list':case 'contacts':{const n=x.items.length;return n*th_(x.size*s,c)+(n-1)*my(c,x.size*s*.5);}case 'space':return my(c,x.h*s);}return 0;};
 const gOf=(x,s)=>my(c,(x.gap??(x.t==='icon'?x.d*.18:x.t==='rule'?.035:x.t==='btn'?x.size*.8:x.t==='list'||x.t==='contacts'?x.size*.9:x.size*.42))*s);
 const total=s=>items.reduce((a,x,i)=>a+hOf(x,s)+(i<items.length-1?gOf(x,s):0),0);
 let s=1;const T=total(1);if(T>R.h)s=R.h/T*.995;let tot=total(s);
 let gapAdd=0,y=valign==='top'?R.y:valign==='bottom'?R.y+R.h-tot:R.y+(R.h-tot)/2;
 if(valign==='spread'&&items.length>1){gapAdd=Math.min((R.h-tot)/(items.length-1),my(c,.12));y=R.y+(R.h-tot-gapAdd*(items.length-1))/2;}
 const ax=align==='left'?R.x:align==='right'?R.x+R.w:R.x+R.w/2,out=[];
 const colorOf=x=>x.color||K.role(x.role||'ink',R.bg);
 for(const x of items){const h=hOf(x,s);
  if(x.t==='text')out.push(txt(x.text,{x:ax,y,size:x.size*s,font:x.font,bold:!!x.bold,italic:!!x.italic,color:colorOf(x),align,maxW:R.w*(x.maxW??1),...(x.spacing?{spacing:x.spacing}:{})}));
  else if(x.t==='icon'){const d=x.d*s,cx=align==='center'?ax:align==='left'?R.x+mx(c,d)/2:R.x+R.w-mx(c,d)/2;
   if(x.disc){out.push(dot(c,cx,y+h/2,d,x.disc));out.push(icon(c,x.shape,cx,y+h/2,d*.56,x.color||on(x.disc,[K.P.pri,K.P.acc,K.P.ink,'#ffffff'],3)));}
   else out.push(icon(c,x.shape,cx,y+h/2,d,x.color||K.role(x.role||'acc',R.bg)));}
  else if(x.t==='rule'){const len=Math.min(R.w,mx(c,x.len)),x0=align==='center'?ax-len/2:align==='left'?R.x:R.x+R.w-len;out.push(hline(x0,y+h/2,len,x.color||K.role(x.role||'acc',R.bg),x.st));}
  else if(x.t==='btn'){const sz=x.size*s,tw=lineEm(x.text,x.font,true,.06)*sz*c.mn/c.W,pw=Math.min(R.w,tw+2*mx(c,sz*.9)),px=align==='center'?ax-pw/2:align==='left'?R.x:R.x+R.w-pw;
   const fill=x.fill||K.fill(R.bg);if(x.outline){out.push(rect(px,y,pw,h,fill,{outline:Math.max(.5,c.mn*100*.006),radius:.5}));}else out.push(rect(px,y,pw,h,fill,{radius:.5}));
   const ink=x.outline?on(R.bg,[fill,K.I(R.bg)],4.5):on(fill,[K.P.light,'#ffffff',K.P.ink,'#141414']);
   out.push(txt(x.text,{x:px+pw/2,y:y+my(c,sz*.55),size:sz,font:x.font,bold:true,color:ink,maxW:pw-2*mx(c,sz*.55),spacing:K.rtl?0:.06}));}
  else if(x.t==='list'||x.t==='contacts'){const sz=x.size*s,lh=th_(sz,c)+my(c,sz*.5),col=colorOf(x),mcol=K.role(x.markRole||'acc',R.bg);let yy=y;
   const ic={phone:'phone',email:'mail',web:'globe',address:'pin'};
   for(const it of x.items){const label=x.t==='contacts'?CONTACT[it]:it,mark=x.t==='contacts'?ic[it]:x.mark;
    if(align!=='center'&&mark){const d=sz*1.0,ix=align==='left'?R.x+mx(c,d)/2:R.x+R.w-mx(c,d)/2;out.push(icon(c,mark,ix,yy+th_(sz,c)/2,d,mcol));
     out.push(txt(label,{x:align==='left'?R.x+mx(c,sz*1.7):R.x+R.w-mx(c,sz*1.7),y:yy,size:sz,font:x.font,bold:!!x.bold,color:col,align,maxW:R.w-mx(c,sz*1.7)}));}
    else out.push(txt(label,{x:ax,y:yy,size:sz,font:x.font,bold:!!x.bold,color:col,align,maxW:R.w}));yy+=lh;}}
  y+=h+gOf(x,s)+gapAdd;}
 const minPt=Math.min(...items.filter(x=>x.t!=='icon'&&x.t!=='rule'&&x.t!=='space').map(x=>x.size*s*c.mn*72),99);
 return {out,s,ok:minPt>=MIN_PT||c.mn>=8};}

/* ================= GENERIC LAYOUT PROGRAMS (flyers, cards, hangers, banners, signs, brochure covers) ================= */
// each: n (name), i18n names, moods, fams (omit = all generic), fn(c,th,K) → {bg, layers, back?}
const ALLM=['any'];
const G={
 split:{n:'Split Panel',fa:'پنل دوبخشی',fr:'Panneau divisé',es:'Panel dividido',moods:ALLM,fn(c,th,K){const P=K.P,o=[];
  if(K.land){const pw=K.fam==='wide'?.34:.38;o.push(rect(0,0,pw,1,P.pri),...K.flow(K.box(0,0,pw,1,P.pri,.07),K.parts('logo brand kicker')),...K.flow(K.box(pw,0,1,1,'#ffffff',.08),K.parts('head sub list cta contact'),{align:'left'}));}
  else{const ph=K.y0+(K.fam==='hanger'?.24:K.fam==='tall'?.32:.36);o.push(rect(0,0,1,ph,P.pri),...K.flow(K.box(0,0,1,ph,P.pri,.07),K.parts('logo brand kicker')),...K.flow(K.box(0,ph,1,1,'#ffffff',.08),K.parts('head sub list cta contact'),{align:'left'}));}
  return {bg:'#ffffff',layers:o,back:K.back(P.pri)};}},
 reverse:{n:'Reverse Split',fa:'دوبخشی معکوس',fr:'Division inversée',es:'División invertida',moods:ALLM,fn(c,th,K){const P=K.P,o=[],side=K.fill(P.pri,[P.acc,P.acc2,P.light]);
  if(K.land){const pw=.36;o.push(rect(1-pw,0,pw,1,side),...K.flow(K.box(0,0,1-pw,1,P.pri,.08),K.parts('kicker head sub list cta contact'),{align:'left'}),...K.flow(K.box(1-pw,0,1,1,side,.07),K.parts('logo brand',{logo:{role:'ink'}})));}
  else{const ph=K.fam==='card'?.36:.3;o.push(rect(0,1-ph,1,ph,side),...K.flow(K.box(0,0,1,1-ph,P.pri,.08),K.parts('kicker head sub list cta'),{align:'left'}),...K.flow(K.box(0,1-ph,1,1,side,.06),K.parts('brand contact',{brand:{k:.8}})));}
  return {bg:P.pri,layers:o,back:K.back(side,1)};}},
 diagonal:{n:'Diagonal Cut',noRtl:true,fa:'برش مورب',fr:'Coupe diagonale',es:'Corte diagonal',moods:['bold','pro','industrial','friendly'],fn(c,th,K){const P=K.P,o=[];
  if(K.land){o.push(rect(.72,0,.28,1,P.pri),shp('slant',.56,0,.3,1,P.pri),shp('slant',.5,0,.12,1,P.acc),...K.flow(K.box(.72,0,1,1,P.pri,.04),K.parts('logo brand',{brand:{k:.8}})),...K.flow(K.box(0,0,.5,1,P.light,.08),K.parts('kicker head sub list cta contact'),{align:'left'}));}
  else{const t=K.fam==='card'?.34:.3;o.push(shp('corner-flip',0,1-t,1,t,P.pri),shp('corner',0,0,.42,.14+K.y0*.4,P.acc),icon(c,th.icon,.84,1-t*.28,Math.min(.22,t*c.H/c.mn*.42),K.A(P.pri)),
   ...K.flow(K.box(0,.12+K.y0*.6,1,1-t*.9,P.light,.08),K.parts('brand kicker head sub list cta'),{align:'left'}),...K.flow(K.box(0,1-t*.95,.56,Math.min(K.y1,1-t*.3),P.light,.06),K.parts(K.fam==='print'?'phone web':'contact',{contact:{k:.85},phone:{k:1.3},web:{k:2.2}}),{align:'left',valign:'top'}));}
  return {bg:P.light,layers:o,back:K.back(P.pri)};}},
 bands:{n:'Header & Footer',fa:'سربرگ و پابرگ',fr:'En-tête et pied',es:'Encabezado y pie',moods:ALLM,fn(c,th,K){const P=K.P,o=[],hb=K.y0+(K.land?.27:.19),fb=K.land?.22:.14,f0=K.y1-fb,foot=K.fill('#ffffff',[P.acc,P.pri]);
  o.push(rect(0,0,1,hb,P.pri),rect(0,f0,1,1-f0,foot));
  const H=K.box(0,K.y0,1,hb,P.pri,.05),ld=Math.min(PROF[K.fam].logo,H.h*c.H/c.mn*.9);o.push(icon(c,th.icon,H.x+mx(c,ld)/2,H.y+H.h/2,ld,K.A(P.pri)),...K.flow({...H,x:H.x+mx(c,ld*1.3),w:H.w-mx(c,ld*1.3)},K.parts('brand kicker',{brand:{k:1}}),{align:'left'}));
  o.push(...K.flow(K.box(0,hb,1,f0,'#ffffff',.08),K.parts('head sub list cta'),{align:K.land?'left':'center'}),...K.flow(K.box(0,f0,1,K.y1,foot,.035),K.parts(K.fam==='card'?'cline':'contact',{contact:{k:.8}}),{align:'center'}));
  return {bg:'#ffffff',layers:o,back:K.back(P.pri,2)};}},
 badge:{n:'Center Badge',fa:'نشان مرکزی',fr:'Insigne central',es:'Insignia central',moods:ALLM,fn(c,th,K){const P=K.P,o=[],disc=K.fill(P.pri,[P.light,P.soft,P.acc]);
  if(K.land){const lw=.36;o.push(...K.flow(K.box(0,0,lw,1,P.pri,.1),K.parts('logo',{logo:{k:2,disc}})),...K.flow(K.box(lw,0,1,1,P.pri,.08),K.parts('brand kicker rule head sub list cta contact',{brand:{k:.9}}),{align:'left'}));}
  else o.push(...K.flow(K.box(0,0,1,1,P.pri,.09),K.parts('logo brand kicker rule head sub list cta contact',{logo:{k:1.3,disc}}),{valign:'spread'}));
  return {bg:P.pri,layers:o,back:K.back(disc)};}},
 frame:{n:'Classic Frame',fa:'قاب کلاسیک',fr:'Cadre classique',es:'Marco clásico',moods:['elegant','clean','pro','friendly'],fn(c,th,K){const P=K.P,bg=P.light,e=K.fam==='card'?.085:.045,o=[];
  const fx=mx(c,e),fy=Math.max(my(c,e),K.y0),fy1=Math.min(1-my(c,e),K.fam==='tall'?.95:1-my(c,e));
  o.push(rect(fx,fy,1-2*fx,fy1-fy,on(bg,[P.pri,P.ink],3),{outline:Math.max(.5,c.mn*100*.006)}),shp('brackets',fx+mx(c,.025),fy+my(c,.025),1-2*fx-2*mx(c,.025),fy1-fy-2*my(c,.025),on(bg,[P.acc,P.pri],2)));
  o.push(...K.flow({x:fx+mx(c,.09),y:fy+my(c,.09),w:1-2*fx-2*mx(c,.09),h:fy1-fy-2*my(c,.09),bg},K.parts('logo brand rule kicker head sub list cta contact',{logo:{k:.8},brand:{k:K.fam==='card'?1:1}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(P.pri)};}},
 bigtype:{n:'Big Type',fa:'تایپوگرافی درشت',fr:'Grande typo',es:'Tipografía grande',moods:['bold','industrial','playful'],fn(c,th,K){const P=K.P,bg=contrast(P.acc,'#141414')>=7||contrast(P.acc,'#ffffff')>=4.5?P.acc:P.pri;
  const o=K.flow(K.box(0,0,1,1,bg,.08),K.parts('brandS head sub list cta contact',{head:{k:1.55,upper:true},brandS:{role:'ink'},sub:{role:'ink'}}),{align:'left',valign:'spread'});
  return {bg,layers:o,back:K.back(P.pri)};}},
 hazard:{n:'Hazard Stripes',fa:'نوار هشدار',fr:'Bandes de chantier',es:'Franjas de obra',moods:['industrial','bold'],fn(c,th,K){const P=K.P,bg=contrast(P.acc,'#141414')>=6?P.acc:'#ffc31f',band=on(bg,[P.dark,'#141414']),st=K.land?.1:.055,o=[];
  o.push(shp('stripes',0,0,1,st,band),shp('stripes',0,1-st,1,st,band));const y0=st,y1=1-st;
  if(K.land){o.push(rect(.56,y0,.44,y1-y0,band),...K.flow(K.box(0,y0,.56,y1,bg,.06),K.parts('logo brand head',{brand:{k:.9},head:{upper:true}}),{align:'left'}),...K.flow(K.box(.56,y0,1,y1,band,.06),K.parts('kicker sub list cta contact',{kicker:{role:'acc'}})));}
  else{const m=y0+(y1-y0)*.52,m2=y0+(y1-y0)*.76;o.push(rect(0,m,1,m2-m,band),...K.flow(K.box(0,y0,1,m,bg,.06),K.parts('logo brand head',{head:{upper:true}})),...K.flow(K.box(0,m,1,m2,band,.04),K.parts(K.fam==='card'?'sub':'list',{list:{mark:null,bold:true}})),...K.flow(K.box(0,m2,1,y1,bg,.04),K.parts('cta contact')));}
  return {bg,layers:o,back:K.back(band)};}},
 corners:{n:'Corner Accents',noRtl:true,fa:'گوشه‌های رنگی',fr:'Coins colorés',es:'Esquinas de color',moods:ALLM,fn(c,th,K){const P=K.P,o=[],cw=K.land?.26:.44,ch=K.land?.42:.2;
  o.push(shp('corner',0,0,cw,ch,P.pri),shp('corner-flip',1-cw,1-ch,cw,ch,P.acc));
  const R=K.land?K.box(cw*.55,0,1-cw*.55,1,'#ffffff',.07):K.box(0,ch*.7,1,1-ch*.7,'#ffffff',.07);
  o.push(...K.flow(R,K.parts('logo brand kicker head sub list cta contact',{logo:{k:.8}}),{valign:'spread'}));return {bg:'#ffffff',layers:o,back:K.back(P.pri)};}},
 services:{n:'Service Grid',fa:'جدول خدمات',fr:'Grille de services',es:'Cuadrícula de servicios',moods:ALLM,fams:['print','hanger','tall','wide','sign'],fn(c,th,K){const P=K.P,o=[],items=K.cp.bullets.slice(0,4),icons=th.icons||[th.icon,th.icon2||th.icon,'shield','check'],ring=P.soft;
  const grid=(R,cols)=>{const rows=Math.ceil(items.length/cols),cw=R.w/cols,ch=R.h/rows;items.forEach((b,i)=>{const cx=R.x+cw*(i%cols+.5),cy0=R.y+ch*Math.floor(i/cols);
   const d=Math.min(cw*c.W,ch*c.H*.55)/c.mn*.8,lab=Math.min(PROF[K.fam].list||.05,.07);o.push(dot(c,cx,cy0+my(c,d)/2+ch*.04,d,ring),icon(c,icons[i%icons.length],cx,cy0+my(c,d)/2+ch*.04,d*.5,on(ring,[P.pri,P.acc,P.ink],3)));
   const ly=cy0+my(c,d)+ch*.1,lsz=Math.min(lab,(cy0+ch-ly)*c.H/c.mn/1.3);o.push(txt(b,{x:cx,y:ly,size:fitSize(c,b,K.F.body,true,0,lsz,cw*.92),font:K.F.body,bold:true,color:K.I(R.bg),maxW:cw*.94}));});};
  if(K.land){const lw=.42;o.push(rect(0,0,lw,1,P.pri),...K.flow(K.box(0,0,lw,1,P.pri,.07),K.parts('logo brand kicker head cta contact',{head:{k:.7},logo:{k:.6}}),{align:'left'}));grid(K.box(lw,0,1,1,'#ffffff',.07),2);}
  else{const hb=K.y0+.25;o.push(rect(0,0,1,hb,P.pri),...K.flow(K.box(0,0,1,hb,P.pri,.06),K.parts('brand kicker head',{head:{k:.7}})),...K.flow(K.box(0,K.y1-.14,1,K.y1,'#ffffff',.04),K.parts('cta contact')));
   const R=K.box(0,hb,1,K.y1-.14,'#ffffff',.06);o.push(...K.flow({...R,y:R.y,h:my(c,PROF[K.fam].kicker*1.6)},K.parts('kicker',{kicker:{role:'acc'}}).map(x=>({...x,text:K.rtl?'خدمات ما':'OUR SERVICES'}))));grid({...R,y:R.y+my(c,PROF[K.fam].kicker*2.4),h:R.h-my(c,PROF[K.fam].kicker*2.4)},2);}
  return {bg:'#ffffff',layers:o};}},
 qr:{n:'Contact Panel',fa:'پنل تماس',fr:'Panneau contact',es:'Panel de contacto',moods:['pro','clean','friendly','industrial'],fams:['card','print','hanger','tall','wide','sign'],fn(c,th,K){const P=K.P,o=[],box=P.soft,bg='#ffffff';
  const qr=(R)=>{const d=Math.min(R.w*c.W,R.h*c.H)/c.mn*.92,b=sq(c,R.x+R.w/2,R.y+R.h/2,d);o.push(rect(b.x,b.y,b.w,b.h,'#ffffff',{radius:.06}),rect(b.x,b.y,b.w,b.h,on('#ffffff',[P.pri,P.ink],3),{outline:Math.max(.5,c.mn*100*.004),radius:.06}),...K.flow({x:b.x+b.w*.12,y:b.y+b.h*.3,w:b.w*.76,h:b.h*.4,bg:'#ffffff'},[{t:'text',text:'QR',size:d*.22,font:K.F.body,bold:true,role:'pri',gap:d*.02},{t:'text',text:K.rtl?'کد شما':'YOUR CODE',size:d*.07,font:K.F.body,bold:true,role:'mut',spacing:.1}]));};
  const contacts=fam=>fam==='card'?'contact':'phone web',pk=K.fam==='print'?1.5:K.fam==='hanger'?1:.6;
  if(K.land){const cw=.4;o.push(rect(1-cw,0,cw,1,box));const R=K.box(1-cw,0,1,1,box,.06);const qh=R.h*.45;qr({x:R.x,y:R.y,w:R.w,h:qh});
   o.push(...K.flow({...R,y:R.y+qh+my(c,.04),h:R.h-qh-my(c,.04)},K.parts(contacts(K.fam),{phone:{k:pk},web:{k:pk*2}}),{align:'center'}),...K.flow(K.box(0,0,1-cw,1,bg,.08),K.parts('logo brand kicker head sub list cta',{logo:{k:.6}}),{align:'left'}));}
  else{const ch=K.fam==='hanger'||K.fam==='tall'?.24:.3,y0=K.y1-ch;o.push(rect(0,y0,1,1-y0,box));const R=K.box(0,y0,1,K.y1,box,.05);
   qr({x:R.x+R.w*.62,y:R.y,w:R.w*.38,h:R.h});o.push(...K.flow({...R,w:R.w*.58},K.parts(contacts(K.fam),{phone:{k:pk},web:{k:pk*2}}),{align:'left'}),...K.flow(K.box(0,0,1,y0,bg,.08),K.parts('logo brand kicker head sub list cta',{logo:{k:.7}}),{align:'left'}));}
  return {bg,layers:o,back:K.back(P.pri)};}},
 mono:{n:'Minimal Mono',fa:'مینیمال تک‌رنگ',fr:'Minimal monochrome',es:'Minimal monocromo',moods:['clean','elegant','pro'],pal:{acc:'#111111',acc2:'#111111',pri:'#111111',ink:'#111111',muted:'#5c5c5c',soft:'#efefef'},fn(c,th,K){const o=[];
  o.push(...K.flow(K.box(0,0,1,1,'#ffffff',.1),K.parts('brandS rule head sub list cta contact',{rule:{len:.1,st:.004},brandS:{spacing:.3}}),{align:'left',valign:'spread'}));
  return {bg:'#ffffff',layers:o,back:K.back('#111111',1)};}},
 luxury:{n:'Gold on Black',fa:'طلایی روی مشکی',fr:'Or sur noir',es:'Dorado sobre negro',moods:['elegant','pro'],pal:{pri:'#0e0e0e',acc:'#c9a14a',acc2:'#e7d3a1',ink:'#151515',light:'#f3ead7',muted:'#b7ab93',soft:'#2a2722'},fonts:{head:'Playfair Display',hb:false,body:'Montserrat'},fn(c,th,K){const bg='#0e0e0e',g='#c9a14a',o=[],e=K.fam==='card'?.085:.05;
  const fx=mx(c,e),fy=Math.max(my(c,e),K.y0),fy1=Math.min(1-my(c,e),K.fam==='tall'?.95:1-my(c,e));o.push(rect(fx,fy,1-2*fx,fy1-fy,g,{outline:Math.max(.5,c.mn*100*.004)}));
  o.push(...K.flow({x:fx+mx(c,.08),y:fy+my(c,.08),w:1-2*fx-2*mx(c,.08),h:fy1-fy-2*my(c,.08),bg},K.parts('logo kicker brand rule head sub list cta contact',{logo:{k:.75},brand:{k:.9},head:{role:'acc2',italic:!K.rtl},cta:{outline:true,fill:g},contact:{role:'acc2'}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(bg,1)};}},
 playful:{n:'Playful Bubbles',fa:'حباب‌های شاد',fr:'Bulles ludiques',es:'Burbujas alegres',moods:['playful','friendly'],fonts:{head:'Fredoka',hb:true},fn(c,th,K){const P=K.P,bg=P.light,o=[];
  const b=(x,y,d,col,op)=>{const s=sq(c,x,y,d);o.push(shp('blob',Math.max(0,s.x),Math.max(0,s.y),Math.min(s.w,1-Math.max(0,s.x)),Math.min(s.h,1-Math.max(0,s.y)),col,{opacity:op}));};
  const d=K.land?.5:.6;b(mx(c,d)*.3,my(c,d)*.3,d,P.acc,.35);b(1-mx(c,d)*.3,1-my(c,d)*.3,d,P.acc2,.35);
  const R=K.land?K.box(mx(c,d)*.5,0,1-mx(c,d)*.5,1,bg,.06):K.box(0,my(c,d)*.62,1,1-my(c,d)*.62,bg,.06);
  o.push(...K.flow(R,K.parts('logo brand head sub list cta contact',{logo:{k:.8,disc:P.acc},brand:{role:'pri'}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(P.pri,2)};}},
 photo:{n:'Photo Spot',fa:'جای عکس',fr:'Espace photo',es:'Espacio para foto',moods:ALLM,fn(c,th,K){const P=K.P,o=[],tint=P.soft;
  if(K.land){const pw=.42;o.push(rect(1-pw,0,pw,1,tint),icon(c,th.icon,1-pw/2,.5,Math.min(pw*c.W/c.mn*.55,.7),P.pri,{opacity:.85}),shp('dots',1-pw+mx(c,.05),my(c,.05),Math.min(pw*.3,mx(c,.3)),my(c,.18),P.pri,{opacity:.25}),...K.flow(K.box(0,0,1-pw,1,'#ffffff',.08),K.parts('brand kicker head sub list cta contact',{brand:{role:'pri'}}),{align:'left'}));}
  else{const ph=K.y0+(K.fam==='card'?.42:.4);o.push(rect(0,0,1,ph,tint),icon(c,th.icon,.5,(K.y0+ph)/2,Math.min((ph-K.y0)*c.H/c.mn*.55,.7),P.pri,{opacity:.85}),...K.flow(K.box(0,ph,1,1,'#ffffff',.08),K.parts('brand kicker head sub list cta contact',{brand:{role:'pri'}}),{align:'left'}));}
  return {bg:'#ffffff',layers:o,back:K.back(P.pri)};}},
 gradient:{n:'Gradient Glow',fa:'گرادیان درخشان',fr:'Dégradé lumineux',es:'Degradado luminoso',moods:['bold','playful','elegant','pro'],fn(c,th,K){const P=K.P,from=toward(P.pri,'#000000',7,'#ffffff'),to=toward(P.grad||P.acc,'#000000',5.5,'#ffffff'),o=[];
  o.push(rect(0,0,1,1,from,{gradient:{to,angle:K.land?20:70}}),icon(c,'sparkle',1-mx(c,.08),my(c,.08)+K.y0,.08,'#ffffff',{opacity:.25}));
  const rd=Math.min(c.W,c.H)/c.mn*.9;o.push(dot(c,1-mx(c,rd)*.42,1-my(c,rd)*.42,rd,'#ffffff',{opacity:.06}));
  o.push(...K.flow(K.box(0,0,1,1,from,.09),K.parts('logo kicker head sub list cta contact brandS',{logo:{color:'#ffffff'},kicker:{color:'#ffffff'},head:{color:'#ffffff'},sub:{color:'#ffffff'},list:{color:'#ffffff'},contact:{color:'#ffffff'},brandS:{color:'#ffffff'},cta:{fill:'#ffffff'}}).map(x=>x.t==='list'?{...x,color:'#ffffff',mark:null}:x),{valign:'spread'}));
  return {bg:from,layers:o,back:K.back(from)};}},
 wave:{n:'Wave Footer',fa:'موج پایین',fr:'Vague en pied',es:'Ola inferior',moods:['friendly','clean','playful','pro'],fn(c,th,K){const P=K.P,o=[],bh=K.land?.3:.2,y0=1-bh;
  const foot=P.pri,band=my(c,PROF[K.fam].contact*2.4)<(1-(y0+bh*.55))-.01&&K.fam!=='tall'&&K.fam!=='card';
  o.push(shp('wave-bottom',0,y0-bh*.12,1,bh*1.12,P.acc),shp('wave-bottom',0,y0,1,bh,foot));
  o.push(...K.flow(K.box(0,0,1,y0+bh*.3,'#ffffff',.08),K.parts(band?'logo brand kicker head sub list cta':'logo brand kicker head sub list cta contact',{logo:{k:.8}}),{valign:'spread'}));
  if(band)o.push(...K.flow(K.box(0,y0+bh*.56,1,1,foot,.025),K.parts('contact',{contact:{k:.85}})));
  return {bg:'#ffffff',layers:o,back:K.back(foot)};}},
 arch:{n:'Arch Window',fa:'پنجره قوسی',fr:'Arche',es:'Arco',moods:['elegant','friendly','clean'],fn(c,th,K){const P=K.P,bg=P.light,a=P.soft,o=[];
  if(K.land){const aw=.36,ax=.07,ay=my(c,.08),ah=1-ay;o.push(shp('arch',ax,ay,aw,ah,a),...K.flow({x:ax+aw*.14,y:ay+ah*.3,w:aw*.72,h:ah*.62,bg:a},K.parts('logo script',{logo:{k:.9}})),...K.flow(K.box(ax+aw,0,1,1,bg,.07),K.parts('brand kicker head sub list cta contact',{head:{italic:!K.rtl}}),{align:'left'}));}
  else{const aw=.76,ax=.12,ay=K.y0+my(c,.06),ah=Math.min(.5,(aw*c.W/c.H)*1.25);o.push(shp('arch',ax,ay,aw,ah,a),...K.flow({x:ax+aw*.14,y:ay+ah*.3,w:aw*.72,h:ah*.64,bg:a},K.parts('logo script brand',{logo:{k:.8},brand:{k:.8}})),...K.flow(K.box(0,ay+ah,1,1,bg,.07),K.parts('kicker head sub list cta contact',{head:{italic:!K.rtl}}),{valign:'spread'}));}
  return {bg,layers:o,back:K.back(P.pri,1)};}},
 burst:{n:'Offer Burst',fa:'ستاره تخفیف',fr:'Éclat promo',es:'Estallido de oferta',moods:['bold','playful','friendly'],fams:['print','hanger','tall','wide','sign'],fn(c,th,K){const P=K.P,bg=P.pri,b=K.fill(bg,[P.acc,P.acc2,P.light]),o=[];
  if(K.land){const d=Math.min(.95,.42*c.W/c.mn),cx=1-mx(c,d)/2-mx(c,.04);o.push(icon(c,'star-burst',cx,.5,d,b),...K.flow({x:cx-mx(c,d*.3),y:.5-my(c,d*.24),w:mx(c,d*.6),h:my(c,d*.48),bg:b},K.parts('offer')),...K.flow(K.box(0,0,cx-mx(c,d)/2,1,bg,.07),K.parts('brandS head sub cta contact',{head:{upper:true}}),{align:'left'}));}
  else{const d=Math.min(.8,(K.y1-K.y0)*c.H/c.mn*.36),cy=K.y0+(K.y1-K.y0)*.5;o.push(icon(c,'star-burst',.5,cy,d,b),...K.flow({x:.5-mx(c,d*.3),y:cy-my(c,d*.24),w:mx(c,d*.6),h:my(c,d*.48),bg:b},K.parts('offer')),
   ...K.flow(K.box(0,0,1,cy-my(c,d)/2,bg,.07),K.parts('brandS head',{head:{upper:true}})),...K.flow(K.box(0,cy+my(c,d)/2,1,1,bg,.06),K.parts('sub cta contact')));}
  return {bg,layers:o};}},
 ribbon:{n:'Ribbon Title',fa:'روبان عنوان',fr:'Ruban titre',es:'Cinta de título',moods:['friendly','playful','elegant'],fn(c,th,K){const P=K.P,bg=P.light,rb=K.fill(bg,[P.acc,P.pri]),o=[];
  const bs=PROF[K.fam].brand,rh=my(c,bs*1.25)+my(c,bs*.9),ry=K.y0+my(c,K.land?.1:.09)+(K.land?0:my(c,PROF[K.fam].logo*1.1));
  if(!K.land)o.push(...K.flow({x:0,y:K.y0+my(c,.05),w:1,h:my(c,PROF[K.fam].logo*1.05),bg},K.parts('logo',{logo:{role:'pri'}})));
  o.push(shp('ribbon',.06,ry,.88,rh,rb),...K.flow({x:.14,y:ry+my(c,bs*.45),w:.72,h:rh-my(c,bs*.9),bg:rb},K.parts('brand',{brand:{upper:true}})));
  o.push(...K.flow(K.box(0,ry+rh,1,1,bg,.07),K.parts('kicker head sub list cta contact'),{valign:'spread'}));
  return {bg,layers:o,back:K.back(rb,1)};}},
 chevron:{n:'Sport Chevrons',fa:'شورون اسپرت',fr:'Chevrons sport',es:'Chevrones deportivos',moods:['bold','industrial'],fn(c,th,K){const bg=isDark(K.P.pri)?K.P.pri:K.P.dark,P=K.P,o=[];
  const cw=mx(c,K.land?.4:.3),chh=my(c,K.land?.4:.3)*.5;o.push(shp('chevrons',1-cw-mx(c,.06),Math.max(my(c,.06),K.y0+my(c,.02)),cw,chh,P.acc));
  o.push(...K.flow(K.box(0,K.y0?0:my(c,.06)+chh,1,1,bg,.08),K.parts('brandS head rule sub list cta contact',{head:{k:1.2,upper:true,italic:!K.rtl},rule:{len:.3,st:.014}}),{align:'left',valign:'spread'}));
  return {bg,layers:o,back:K.back(bg,2)};}},
 twotone:{n:'Two Tone',fa:'دو رنگ',fr:'Deux tons',es:'Dos tonos',moods:ALLM,fn(c,th,K){const P=K.P,o=[],low=P.light,disc=K.fill(P.pri,[P.acc,P.light]),d=Math.min(PROF[K.fam].logo*1.3,.34);
  if(K.land){const sx=.5;o.push(rect(0,0,sx,1,P.pri),dot(c,sx,.5,d*1.25,low),dot(c,sx,.5,d,disc),icon(c,th.icon,sx,.5,d*.55,on(disc,[P.pri,P.ink,'#ffffff'],3)));
   o.push(...K.flow(K.box(0,0,sx-mx(c,d*.65),1,P.pri,.07),K.parts('brand kicker head sub',{brand:{k:.9}}),{align:'left'}),...K.flow(K.box(sx+mx(c,d*.65),0,1,1,low,.07),K.parts('list cta contact'),{align:'left'}));}
  else{const sy=K.y0+(K.y1-K.y0)*.5;o.push(rect(0,0,1,sy,P.pri),dot(c,.5,sy,d*1.25,low),dot(c,.5,sy,d,disc),icon(c,th.icon,.5,sy,d*.55,on(disc,[P.pri,P.ink,'#ffffff'],3)));
   o.push(...K.flow(K.box(0,0,1,sy-my(c,d*.65),P.pri,.07),K.parts('brand kicker head',{brand:{k:.9}})),...K.flow(K.box(0,sy+my(c,d*.65),1,1,low,.07),K.parts('sub list cta contact')));}
  return {bg:low,layers:o,back:K.back(P.pri)};}},
 sidebar:{n:'Side Stripes',fa:'نوارهای کناری',fr:'Bandes latérales',es:'Franjas laterales',moods:['pro','clean','industrial'],fn(c,th,K){const P=K.P,o=[],w=mx(c,.05);
  o.push(rect(0,0,w*1.4,1,P.pri),rect(w*1.4,0,w*.5,1,P.acc),rect(w*1.9,0,w*.25,1,P.acc2));
  o.push(...K.flow(K.box(w*2.15,0,1,1,'#ffffff',.08),K.parts('logo brand kicker head sub list cta contact',{logo:{k:.7},brand:{role:'pri'}}),{align:'left',valign:'spread'}));
  return {bg:'#ffffff',layers:o,back:K.back(P.pri,1)};}},
 circle:{n:'Big Circle',fa:'دایره بزرگ',fr:'Grand cercle',es:'Gran círculo',moods:['friendly','bold','playful','pro'],fn(c,th,K){const P=K.P,o=[],bg='#ffffff';
  if(K.land){const d=Math.min(.92,.44*c.W/c.mn),cx=1-mx(c,d)/2-mx(c,.05);o.push(dot(c,cx,.5,d,P.pri),...K.flow({x:cx-mx(c,d*.34),y:.5-my(c,d*.34),w:mx(c,d*.68),h:my(c,d*.68),bg:P.pri},K.parts('logo brand',{brand:{k:.8}})),...K.flow(K.box(0,0,cx-mx(c,d)/2,1,bg,.07),K.parts('kicker head sub list cta contact'),{align:'left'}));}
  else{const d=Math.min(.86,(K.y1-K.y0)*c.H/c.mn*.42),cy=K.y0+my(c,d)/2+my(c,.05);o.push(dot(c,.5,cy,d,P.pri),...K.flow({x:.5-mx(c,d*.34),y:cy-my(c,d*.34),w:mx(c,d*.68),h:my(c,d*.68),bg:P.pri},K.parts('logo brand',{brand:{k:.8}})),...K.flow(K.box(0,cy+my(c,d)/2,1,1,bg,.07),K.parts('kicker head sub list cta contact'),{valign:'spread'}));}
  return {bg,layers:o,back:K.back(P.pri)};}},
 dots:{n:'Dot Pattern',fa:'الگوی نقطه‌ای',fr:'Motif à pois',es:'Patrón de puntos',moods:['playful','bold','friendly'],fn(c,th,K){const P=K.P,bg=P.pri,o=[],dw=mx(c,K.land?.32:.36),dh=my(c,K.land?.24:.26);
  o.push(shp('dots',mx(c,.04),Math.max(my(c,.04),K.y0),dw,dh,P.acc,{opacity:.55}),shp('dots',1-dw-mx(c,.04),1-dh-my(c,.04),dw,dh,P.acc2,{opacity:.4}));
  o.push(...K.flow(K.land?K.box(dw*.7,0,1-dw*.7,1,bg,.08):K.box(0,dh+my(c,.02)+(K.y0?K.y0:0)*.2,1,1-dh-my(c,.02),bg,.07),K.parts('logo brand kicker head sub list cta contact'),{valign:'spread'}));
  return {bg,layers:o,back:K.back(bg,2)};}},
 boxed:{n:'Card on Colour',fa:'کارت روی رنگ',fr:'Carte sur couleur',es:'Tarjeta sobre color',moods:ALLM,fn(c,th,K){const P=K.P,bg=P.pri,o=[],e=K.fam==='card'?.08:.07;
  const x0=mx(c,e),y0=Math.max(my(c,e),K.y0),y1=Math.min(1-my(c,e),K.y1);o.push(rect(x0,y0,1-2*x0,y1-y0,'#ffffff',{radius:.05}),shp('dots',1-x0-mx(c,.18),y0+my(c,.04),mx(c,.14),my(c,.1),P.acc,{opacity:.5}));
  o.push(...K.flow({x:x0+mx(c,.07),y:y0+my(c,.07),w:1-2*x0-2*mx(c,.07),h:y1-y0-2*my(c,.07),bg:'#ffffff'},K.parts('logo brand kicker rule head sub list cta contact',{logo:{k:.8},brand:{role:'pri'}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(bg)};}},
 editorial:{n:'Editorial',fa:'سبک مجله',fr:'Éditorial',es:'Editorial',moods:['elegant','clean','pro'],fonts:{head:'DM Serif Display',hb:false},fn(c,th,K){const P=K.P,bg=P.light,o=[];
  o.push(...K.flow(K.box(0,0,1,1,bg,.09),K.parts('brandS rule head sub list cta contact',{brandS:{role:'acc',spacing:.25},rule:{len:.5,st:.004,role:'ink'},head:{k:1.15},list:{num:true}}),{align:'left',valign:'spread'}));
  return {bg,layers:o,back:K.back(P.pri,1)};}},
 columns:{n:'Colour Columns',fa:'ستون‌های رنگی',fr:'Colonnes de couleur',es:'Columnas de color',moods:['pro','bold','clean'],fn(c,th,K){const P=K.P,o=[],cols=[P.acc2,P.acc,P.pri];
  if(K.land){const w=.2;cols.forEach((col,i)=>o.push(rect(1-w+i*w/3,0,w/3+.001,1,col)));o.push(...K.flow(K.box(0,0,1-w,1,'#ffffff',.08),K.parts('logo brand kicker head sub list cta contact',{logo:{k:.7},brand:{role:'pri'}}),{align:'left'}));}
  else{const h=K.fam==='card'?.16:.1,y=K.y1-h;cols.forEach((col,i)=>o.push(rect(i/3,y,1/3+.001,1-y,col)));o.push(...K.flow(K.box(0,0,1,y,'#ffffff',.08),K.parts('logo brand kicker head sub list cta contact',{logo:{k:.7},brand:{role:'pri'}}),{align:'left',valign:'spread'}));}
  return {bg:'#ffffff',layers:o,back:K.back(P.pri,1)};}},
 swoosh:{n:'Swoosh Motion',fa:'حرکت منحنی',fr:'Courbe dynamique',es:'Curva dinámica',moods:['bold','pro','industrial','friendly'],fn(c,th,K){const P=K.P,o=[],h=K.land?.4:.26,y0=1-h;
  o.push(shp('swoosh',-.02,y0,1.04,h,P.acc),shp('swoosh',-.02,y0+h*.18,1.04,h*.82,P.pri,{opacity:.95}));
  o.push(...K.flow(K.box(0,0,1,y0+h*.3,'#ffffff',.08),K.parts('logo brand kicker head sub list cta contact',{logo:{k:.75},brand:{role:'pri'}}),{align:K.land?'left':'center',valign:'spread'}));
  return {bg:'#ffffff',layers:o,back:K.back(P.pri)};}},
 outline:{n:'Bold Outline',fa:'قاب ضخیم',fr:'Contour épais',es:'Contorno grueso',moods:['bold','industrial','clean'],fn(c,th,K){const P=K.P,bg='#ffffff',col=on(bg,[P.acc,P.pri],3),e=K.fam==='card'?.085:.05,o=[];
  const fx=mx(c,e),fy=Math.max(my(c,e),K.y0),fy1=Math.min(1-my(c,e),K.fam==='tall'?.95:1-my(c,e));o.push(rect(fx,fy,1-2*fx,fy1-fy,col,{outline:Math.max(.5,c.mn*100*.022)}));
  o.push(...K.flow({x:fx+mx(c,.09),y:fy+my(c,.09),w:1-2*fx-2*mx(c,.09),h:fy1-fy-2*my(c,.09),bg},K.parts('brand head sub list cta contact',{brand:{upper:true,k:.8,role:'pri'},head:{upper:true,k:1.15}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(col)};}},
 halfround:{n:'Half Circle',fa:'نیم‌دایره',fr:'Demi-cercle',es:'Medio círculo',moods:['friendly','clean','elegant'],fn(c,th,K){const P=K.P,bg=P.light,o=[],hh=K.land?.3:.18,hw=Math.min(.86,mx(c,hh*c.H/c.mn*2.1)),y0=1-hh;
  o.push(shp('half-round',.5-hw/2,y0,hw,hh,P.pri),icon(c,th.icon,.5,y0+hh*.62,Math.min(hh*c.H/c.mn*.45,hw*c.W/c.mn*.3),K.A(P.pri)));
  o.push(...K.flow(K.box(0,0,1,y0,bg,.08),K.parts('brand kicker rule head sub list cta contact',{brand:{role:'pri'}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(P.pri)};}},
 retro:{n:'Retro Lines',fa:'خطوط رترو',fr:'Lignes rétro',es:'Líneas retro',moods:['friendly','industrial','playful'],fonts:{head:'Alfa Slab One',hb:false},fn(c,th,K){const P=K.P,bg='#f6efe0',o=[];
  const lines=[P.acc,P.pri,P.acc2].map(col=>({t:'rule',len:3,st:.012,color:col,gap:.012}));
  const items=K.parts('logo brand',{brand:{upper:true,role:'pri'},logo:{role:'pri'}}).concat(lines,K.parts('head sub list cta contact',{head:{k:.9}}));
  o.push(...K.flow(K.box(0,0,1,1,bg,.08),items,{valign:'spread'}));return {bg,layers:o,back:K.back(P.pri,1)};}},
 neon:{n:'Night Neon',fa:'نئون شب',fr:'Néon de nuit',es:'Neón nocturno',moods:['bold','playful'],fn(c,th,K){const bg='#0b0b14',P=K.P,n1=toward(P.acc,'#ffffff',6,bg),n2=toward(P.acc2,'#ffffff',6,bg),o=[];
  const ne=K.fam==='card'?.085:.04;o.push(rect(mx(c,ne),Math.max(my(c,ne),K.y0),1-2*mx(c,ne),Math.min(1,K.y1)-Math.max(my(c,ne),K.y0)-my(c,ne),n2,{outline:Math.max(.5,c.mn*100*.004),radius:.04,opacity:.8}));
  o.push(...K.flow(K.box(0,0,1,1,bg,.1),K.parts('logo kicker head sub list cta contact brandS',{logo:{color:n1},kicker:{color:n2},head:{color:n1,upper:true},list:{color:'#ffffff'},contact:{color:'#ffffff'},cta:{outline:true,fill:n1},brandS:{color:n2}}),{valign:'spread'}));
  return {bg,layers:o,back:K.back(bg,2)};}}
};

/* ================= BROCHURES: generic cover program on the cover panel + coordinated outside/inside panels ================= */
function subLayers(layers,px,pw,c,c2){const k=c2.mn/c.mn;return layers.map(l=>{l={...l};if(l.type!=='text'&&l.x<0){l.w+=l.x;l.x=0;}const m={...l,x:px+l.x*pw};if(l.w!=null)m.w=l.w*pw;if(l.type==='text'){m.size=l.size*k;if(l.maxW!=null)m.maxW=l.maxW*pw;}if(l.type==='line')m.st=l.st*k;if(l.type==='rect'&&l.outline)m.outline=l.outline;return m;});}
function genBrochure(c,th,lay,variant){const n=c.fold==='Half-fold'?2:3,pw=1/n,cover=n-1,back=n-2,O=[],I=[];
 const c2={...c,W:c.W*pw,r:c.W*pw/c.H,mn:Math.min(c.W*pw,c.H)};const L=G[lay];const K2=kit(c2,th,'cover',L.pal,L.fonts);const cv=L.fn(c2,th,K2);
 O.push(rect(cover*pw,0,pw,1,cv.bg),...subLayers(cv.layers,cover*pw,pw,c,c2));
 const K=kit(c2,th,'cover',L.pal,L.fonts),P=K.P,fa=!!th.rtl,cp=th.copy;
 const panel=(i,bg,items,o)=>subLayers([rect(0,0,1,1,bg),...K.flow(K.box(0,o.valign==='top'?.06:0,1,1,bg,.12),items,o)],i*pw,pw,c,c2);
 const T=(text,size,o={})=>({t:'text',text,size:size*1.25,font:o.head?K.F.head:K.F.body,bold:o.bold??(o.head?K.F.hb:false),role:o.role||'ink',spacing:fa?0:o.spacing,gap:o.gap});
 const bk=variant===1?P.pri:P.light;
 O.push(...panel(back,bk,[{t:'icon',shape:th.icon2||th.icon,d:.16,role:'acc'},T(fa?'تماس با ما':'CONTACT US',.035,{bold:true,role:'acc',spacing:.25}),T(cp.company,.05,{head:true}),{t:'rule',len:.1,st:.006,role:'acc'},
  ...['phone','email','web','address'].map(k=>T(CONTACT[k],.032,{gap:.025}))],{valign:'center'}));
 if(n===3)O.push(...panel(0,'#ffffff',[T(fa?'چرا ما؟':'WHY CHOOSE US',.032,{bold:true,role:'acc',spacing:.25}),T(cp.sub,.055,{head:true,gap:.04}),{t:'list',items:cp.bullets,size:.045,font:K.F.body,role:'ink',mark:'check',markRole:'acc'},{t:'btn',text:K.up(cp.cta),size:.04,font:K.F.body}],{align:'left',valign:'spread'}));
 const heads=fa?['درباره ما','خدمات ما','شروع همکاری']:['About us','What we do','Get started'],paras=fa?['ما یک تیم محلی با سال‌ها تجربه\nهستیم و هر کار را با دقت\nو کیفیت انجام می‌دهیم.','برای هر پروژه قیمت شفاف،\nمشاور اختصاصی و ضمانت کیفیت\nدر نظر می‌گیریم.','برای مشاوره رایگان تماس بگیرید\nیا به وب‌سایت ما سر بزنید.']:['We are a local team with years of\nexperience and a passion for\ndoing the job right the first time.','Every project gets a clear quote,\na dedicated contact and quality\nwork backed by our guarantee.','Call or visit our website to book\na free consultation. We reply\nwithin one business day.'];
 for(let i=0;i<n;i++){const j=n===2?i+1:i,bg=variant===2&&i===n-1?P.pri:variant===1&&i===0?P.soft:'#ffffff';const items=[];
  if(variant===0)items.push(T(String(i+1).padStart(2,'0'),.09,{head:true,role:'acc'}));else items.push({t:'icon',shape:(th.icons||[th.icon,th.icon2])[j%2]||th.icon,d:.16,disc:K.fill(bg,[P.soft,P.acc]),gap:.03});
  items.push(T(heads[j],.06,{head:true}),{t:'rule',len:.12,st:.006,role:'acc'},T(paras[j],.034,{role:'mut'}));
  if(j===1)items.push({t:'list',items:cp.bullets,size:.042,font:K.F.body,role:'ink',mark:'check',markRole:'acc'});
  if(j===2)items.push(T(CONTACT.phone,.05,{bold:true,role:'acc'}),T(CONTACT.web,.032,{bold:true}));
  I.push(...panel(i,bg,items,{align:variant===2?'center':'left',valign:'top'}));}
 return {bg:'#ffffff',layers:O,back:{bg:'#ffffff',layers:I},bothSides:true};}

/* ================= FEATHER FLAGS (long text reads bottom → top) ================= */
// vertical text column: centre cx (fraction of W), spanning y0..y1 (fraction of H), max thickness (fraction of W)
function vtxt(c,text,{cx,y0,y1,thick,size,font,bold,color,spacing}){const len=Math.min((y1-y0)*c.H,(2*Math.min(cx+1,2-cx)-.08)*c.W)/1.04,em=lineEm(text,font,bold,spacing);let f=size*c.mn;if(em*f>len)f=len/em;const lines=nl(text);if(f*(1.25+1.2*(lines-1))>thick*c.W)f=thick*c.W/(1.25+1.2*(lines-1));
 return txt(text,{x:cx,y:(y0+y1)/2,size:f/c.mn,font,bold:!!bold,color,rot:-90,maxW:len*1.04/c.H,maxH:thick,...(spacing?{spacing}:{})});}
const FLAGL={
 pole:{n:'Pole Stripe',fa:'نوار میله',fr:'Bande de mât',es:'Franja de mástil',fn(c,th,K){const P=K.P,s=K.fill(P.pri,[P.acc,P.acc2,P.light]);return {bg:P.pri,layers:[rect(0,0,.2,1,s),icon(c,th.icon,.6,.11,.56,K.A(P.pri)),vtxt(c,K.cp.big,{cx:.6,y0:.2,y1:.95,thick:.66,size:.7,font:K.F.head,bold:K.F.hb,color:K.I(P.pri)}),vtxt(c,CONTACT.phone,{cx:.1,y0:.3,y1:.92,thick:.14,size:.12,font:K.F.body,bold:true,color:on(s,[P.pri,P.ink,'#ffffff'])})]};}},
 cap:{n:'Colour Cap',fa:'سرپوش رنگی',fr:'Tête colorée',es:'Cabeza de color',fn(c,th,K){const P=K.P;return {bg:'#ffffff',layers:[rect(0,0,1,.22,P.pri),icon(c,th.icon,.5,.11,.6,K.A(P.pri)),vtxt(c,K.cp.big,{cx:.5,y0:.25,y1:.92,thick:.72,size:.7,font:K.F.head,bold:K.F.hb,color:on('#ffffff',[P.pri,P.ink])}),rect(0,.95,1,.05,P.acc)]};}},
 burst:{n:'Burst Top',fa:'ستاره بالا',fr:'Éclat en tête',es:'Estallido superior',fn(c,th,K){const P=K.P,b=K.fill(P.pri,[P.acc,P.acc2,P.light]),ink=on(b,[P.pri,P.ink,'#ffffff']);const d=.94,cy=my(c,d)/2+.01;
  return {bg:P.pri,layers:[icon(c,'star-burst',.5,cy,d,b),txt(K.cp.offer,{x:.5,y:cy-th_(fitSize(c,K.cp.offer,K.F.head,K.F.hb,0,.2,.52),c)/2,size:fitSize(c,K.cp.offer,K.F.head,K.F.hb,0,.2,.52),font:K.F.head,bold:K.F.hb,color:ink,maxW:.54}),vtxt(c,K.cp.big,{cx:.5,y0:cy+my(c,d)/2+.01,y1:.96,thick:.72,size:.7,font:K.F.head,bold:K.F.hb,color:K.I(P.pri)})]};}},
 twocol:{n:'Two Columns',fa:'دو ستون',fr:'Deux colonnes',es:'Dos columnas',fn(c,th,K){const P=K.P,from=toward(P.pri,'#000000',7,'#ffffff'),to=toward(P.acc,'#000000',5,'#ffffff');return {bg:from,layers:[rect(0,0,1,1,from,{gradient:{to,angle:90}}),icon(c,'sparkle',.5,.07,.34,'#ffffff'),vtxt(c,K.cp.big,{cx:.4,y0:.14,y1:.95,thick:.56,size:.6,font:K.F.head,bold:K.F.hb,color:'#ffffff'}),vtxt(c,K.up(K.cp.tagline),{cx:.84,y0:.2,y1:.95,thick:.18,size:.12,font:K.F.body,bold:true,color:'#ffffff'})]};}},
 stripes:{n:'Hazard Flag',fa:'پرچم هشدار',fr:'Drapeau rayé',es:'Bandera de franjas',fn(c,th,K){const P=K.P,bg=contrast(P.acc,'#141414')>=6?P.acc:'#ffc31f',ink=on(bg,[P.dark,'#141414']);return {bg,layers:[shp('stripes',0,0,1,.05,ink),shp('stripes',0,.95,1,.05,ink),icon(c,th.icon,.5,.15,.6,ink),vtxt(c,K.cp.big,{cx:.5,y0:.28,y1:.93,thick:.7,size:.7,font:K.F.head,bold:K.F.hb,color:ink})]};}},
 frame:{n:'Framed Flag',fa:'پرچم قاب‌دار',fr:'Drapeau encadré',es:'Bandera enmarcada',fn(c,th,K){const P=K.P,bg=P.light,ink=on(bg,[P.pri,P.ink]);return {bg,layers:[rect(.06,my(c,.06),.88,1-2*my(c,.06),ink,{outline:c.mn*100*.02}),icon(c,th.icon,.5,.1,.42,K.A(bg)),vtxt(c,K.cp.big,{cx:.42,y0:.18,y1:.94,thick:.5,size:.55,font:K.F.head,bold:K.F.hb,color:ink}),vtxt(c,K.cp.company,{cx:.78,y0:.22,y1:.94,thick:.16,size:.12,font:K.F.body,bold:true,color:K.A(bg)})]};}},
 split:{n:'Split Flag',fa:'پرچم دوبخشی',fr:'Drapeau divisé',es:'Bandera dividida',fn(c,th,K){const P=K.P,b=K.fill(P.pri,[P.acc,P.acc2,P.light]);return {bg:P.pri,layers:[rect(.42,0,.58,1,b),icon(c,th.icon,.71,.08,.4,on(b,[P.pri,P.ink,'#ffffff'],3)),vtxt(c,K.cp.company,{cx:.21,y0:.06,y1:.94,thick:.3,size:.3,font:K.F.head,bold:K.F.hb,color:K.I(P.pri)}),vtxt(c,K.cp.big,{cx:.71,y0:.16,y1:.95,thick:.46,size:.5,font:K.F.head,bold:K.F.hb,color:on(b,[P.pri,P.ink,'#ffffff'])})]};}},
 dots:{n:'Dotted Flag',fa:'پرچم نقطه‌ای',fr:'Drapeau à pois',es:'Bandera de puntos',fn(c,th,K){const P=K.P;return {bg:P.pri,layers:[shp('dots',.08,.02,.84,.07,P.acc,{opacity:.6}),icon(c,th.icon,.5,.15,.5,K.A(P.pri)),vtxt(c,K.cp.big,{cx:.5,y0:.26,y1:.9,thick:.72,size:.7,font:K.F.head,bold:K.F.hb,color:K.I(P.pri)}),shp('dots',.08,.92,.84,.06,P.acc2,{opacity:.5})]};}},
 mono:{n:'Mono Flag',fa:'پرچم تک‌رنگ',fr:'Drapeau mono',es:'Bandera mono',fn(c,th,K){return {bg:'#ffffff',layers:[rect(0,0,1,.012,'#111111'),icon(c,th.icon,.5,.1,.4,'#111111'),vtxt(c,K.cp.big,{cx:.5,y0:.2,y1:.9,thick:.66,size:.62,font:K.F.head,bold:K.F.hb,color:'#111111'}),rect(.2,.93,.6,.006,'#111111'),vtxt(c,CONTACT.web,{cx:.5,y0:.94,y1:.995,thick:.4,size:.05,font:K.F.body,color:'#111111'})]};}},
 lux:{n:'Gold Flag',fa:'پرچم طلایی',fr:'Drapeau doré',es:'Bandera dorada',fn(c,th,K){const g='#c9a14a',bg='#0e0e0e';return {bg,layers:[rect(.08,my(c,.08),.84,1-2*my(c,.08),g,{outline:c.mn*100*.008}),icon(c,th.icon,.5,.1,.36,g),vtxt(c,K.cp.big,{cx:.5,y0:.18,y1:.94,thick:.6,size:.55,font:K.rtl?K.F.head:'Playfair Display',bold:false,color:'#f3ead7'})]};}},
 wave:{n:'Wave Flag',fa:'پرچم موجی',fr:'Drapeau vague',es:'Bandera ola',fn(c,th,K){const P=K.P;return {bg:'#ffffff',layers:[shp('wave-top',0,0,1,.26,P.pri),icon(c,th.icon,.5,.09,.5,K.A(P.pri)),vtxt(c,K.cp.big,{cx:.5,y0:.28,y1:.95,thick:.72,size:.7,font:K.F.head,bold:K.F.hb,color:on('#ffffff',[P.pri,P.ink])})]};}}
};

/* ================= VEHICLES: side panels (logo, name, phone, web large and readable at distance) + rear / front / roof ================= */
const viewOf=c=>{const k=c.sideKey||'';if(/top|roof/.test(k))return 'top';if(/front|hood/.test(k))return 'front';if(/rear|back|tail/.test(k))return 'rear';if(/side|driver|passenger|left|right/.test(k))return 'side';return c.r>=2.4?'side':'rear';};
// generic end panel (rear / front / roof) in the program's colours
function vehEndG(c,th,K,bg){const v=viewOf(c);const o=[];
 if(v==='top')o.push(...K.flow(K.box(0,0,1,1,bg,.1),K.parts('brand phone',{brand:{k:1.2},phone:{k:.7}})));
 else if(v==='front')o.push(...K.flow(K.box(0,0,1,1,bg,.12),K.parts('brand web',{brand:{k:1.1},web:{k:.9,bold:true}})));
 else if(c.r>2.2)o.push(...K.flow(K.box(0,0,.3,1,bg,.08),K.parts('logo',{logo:{k:2}})),...K.flow(K.box(.3,0,1,1,bg,.08),K.parts('brand phone web',{brand:{k:1.1},phone:{k:.8},web:{k:.9}}),{align:'left'}));
 else o.push(...K.flow(K.box(0,0,1,1,bg,.1),K.parts('logo brand kicker phone web',{logo:{k:.7},brand:{k:.65},phone:{k:.7},web:{k:.9}}),{valign:'spread'}));
 return {bg,layers:o};}
const SIDE=(c,K)=>({tx:.36,ty:.06,tb:.6}); // text zone: right of the front door handle area, above the wheels
const VEHL={
 classic:{n:'Classic Lettering',fa:'نوشته کلاسیک',fr:'Lettrage classique',es:'Rotulación clásica',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P,z=SIDE();
  return {bg:'#ffffff',layers:[...K.flow({x:.1,y:z.ty,w:.22,h:z.tb-z.ty,bg:'#ffffff'},K.parts('logo',{logo:{k:1.2,disc:P.pri}})),...K.flow({x:z.tx,y:z.ty,w:.6,h:z.tb-z.ty,bg:'#ffffff'},K.parts('brand kicker phone web',{brand:{role:'pri'}}),{align:'left'})]};}},
 swoosh:{n:'Swoosh Graphic',fa:'گرافیک منحنی',fr:'Graphique courbe',es:'Gráfico curvo',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P;
  return {bg:'#ffffff',layers:[shp('swoosh',-.02,.56,1.04,.4,P.acc),shp('swoosh',-.02,.66,1.04,.3,P.pri,{opacity:.95}),...K.flow({x:.3,y:.06,w:.64,h:.5,bg:'#ffffff'},K.parts('brand kicker phone',{brand:{role:'pri'}}))]};}},
 block:{n:'Colour Block',fa:'بلوک رنگی',fr:'Bloc de couleur',es:'Bloque de color',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,K.P.pri);const P=K.P;
  return {bg:'#ffffff',layers:[rect(.46,0,.54,1,P.pri),shp('slant',.38,0,.16,1,P.acc),...K.flow({x:.08,y:.1,w:.28,h:.5,bg:'#ffffff'},K.parts('logo',{logo:{k:1.4,role:'pri'}})),...K.flow({x:.56,y:.06,w:.4,h:.56,bg:P.pri},K.parts('brand kicker phone web'))]};}},
 stripes:{n:'Pinstripes',fa:'نوار باریک',fr:'Filets',es:'Filetes',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P;
  return {bg:'#ffffff',layers:[rect(0,.62,1,.05,P.pri),rect(0,.69,1,.018,P.acc),rect(0,.72,1,.008,P.acc2),...K.flow({x:.08,y:.08,w:.22,h:.5,bg:'#ffffff'},K.parts('logo',{logo:{k:1.2}})),...K.flow({x:.34,y:.06,w:.62,h:.52,bg:'#ffffff'},K.parts('brand kicker phone web',{brand:{role:'pri'}}),{align:'left'})]};}},
 fullwrap:{n:'Full Colour Wrap',fa:'روکش کامل رنگی',fr:'Covering complet',es:'Rotulado completo',fn(c,th,K){const P=K.P;if(viewOf(c)!=='side')return vehEndG(c,th,K,P.pri);
  return {bg:P.pri,layers:[shp('wave-bottom',0,.6,1,.4,P.acc,{opacity:.95}),shp('wave-bottom',0,.7,1,.3,P.dark),...K.flow({x:.3,y:.06,w:.64,h:.54,bg:P.pri},K.parts('brand kicker phone web'))]};}},
 slash:{n:'Front Slash',fa:'برش جلو',fr:'Biseau avant',es:'Corte frontal',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P;
  return {bg:'#ffffff',layers:[shp('slant',-.06,0,.42,1,P.pri),shp('slant',.3,0,.08,1,P.acc),...K.flow({x:.04,y:.2,w:.2,h:.4,bg:P.pri},K.parts('logo',{logo:{k:1.2,role:'acc'}})),...K.flow({x:.42,y:.06,w:.54,h:.54,bg:'#ffffff'},K.parts('brand kicker phone web',{brand:{role:'pri'}}),{align:'left'})]};}},
 chevrons:{n:'Racing Chevrons',fa:'شورون مسابقه‌ای',fr:'Chevrons course',es:'Chevrones de carrera',fn(c,th,K){const bg=isDark(K.P.pri)?K.P.pri:K.P.dark;if(viewOf(c)!=='side')return vehEndG(c,th,K,bg);const P=K.P;
  return {bg,layers:[shp('chevrons',.04,.12,.22,.46,P.acc),rect(0,.68,1,.04,P.acc),...K.flow({x:.32,y:.06,w:.64,h:.56,bg},K.parts('brand kicker phone web',{brand:{italic:!K.rtl,upper:true}}),{align:'left'})]};}},
 minimal:{n:'Minimal Wordmark',fa:'نوشتار مینیمال',fr:'Logotype minimal',es:'Logotipo minimal',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');
  return {bg:'#ffffff',layers:K.flow({x:.34,y:.12,w:.58,h:.44,bg:'#ffffff'},K.parts('brand rule web',{brand:{role:'pri',k:.85},rule:{len:.5,st:.012},web:{k:1.4}}))};}},
 bigphone:{n:'Big Phone Number',fa:'شماره تلفن درشت',fr:'Grand numéro',es:'Número grande',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P,b=K.fill('#ffffff',[P.pri,P.acc]);
  return {bg:'#ffffff',layers:[rect(.32,.4,.64,.22,b,{radius:.2}),...K.flow({x:.08,y:.08,w:.22,h:.5,bg:'#ffffff'},K.parts('logo',{logo:{k:1.3}})),...K.flow({x:.34,y:.06,w:.6,h:.32,bg:'#ffffff'},K.parts('brand kicker',{brand:{role:'pri'}}),{align:'left'}),...K.flow({x:.36,y:.42,w:.56,h:.18,bg:b},K.parts('phone',{phone:{k:1.4}}))]};}},
 twotone:{n:'Two-Tone Body',fa:'بدنه دو رنگ',fr:'Carrosserie bicolore',es:'Carrocería bicolor',fn(c,th,K){const P=K.P;if(viewOf(c)!=='side')return vehEndG(c,th,K,P.pri);
  return {bg:'#ffffff',layers:[rect(0,.56,1,.44,P.pri),rect(0,.54,1,.02,P.acc),...K.flow({x:.08,y:.06,w:.22,h:.46,bg:'#ffffff'},K.parts('logo',{logo:{k:1.1,role:'pri'}})),...K.flow({x:.34,y:.05,w:.62,h:.46,bg:'#ffffff'},K.parts('brand phone',{brand:{role:'pri'}}),{align:'left'}),...K.flow({x:.34,y:.58,w:.6,h:.1,bg:P.pri},K.parts('web',{web:{k:1.2,bold:true}}),{align:'left'})]};}},
 gradient:{n:'Gradient Wrap',fa:'روکش گرادیان',fr:'Covering dégradé',es:'Rotulado degradado',fn(c,th,K){const P=K.P,from=toward(P.pri,'#000000',7,'#ffffff'),to=toward(P.acc,'#000000',5,'#ffffff');if(viewOf(c)!=='side')return vehEndG(c,th,K,from);
  return {bg:from,layers:[rect(0,0,1,1,from,{gradient:{to,angle:0}}),...K.flow({x:.3,y:.06,w:.64,h:.56,bg:from},K.parts('logo brand kicker phone web',{logo:{color:'#ffffff',k:.5},brand:{color:'#ffffff'},kicker:{color:'#ffffff'},phone:{color:'#ffffff'},web:{color:'#ffffff'}}))]};}},
 luxury:{n:'Black & Gold',fa:'مشکی و طلایی',fr:'Noir et or',es:'Negro y dorado',fn(c,th,K){const bg='#0e0e0e',g='#c9a14a';if(viewOf(c)!=='side')return vehEndG(c,th,K,bg);
  return {bg,layers:[rect(0,.64,1,.01,g),...K.flow({x:.3,y:.08,w:.64,h:.52,bg},K.parts('logo brand rule web',{logo:{color:g,k:.45},brand:{color:'#f3ead7',font:K.rtl?undefined:'Playfair Display',bold:false},rule:{color:g,len:.6,st:.01},web:{color:g,k:1.3}}))]};}},
 corner:{n:'Rear Corner Sweep',fa:'گوشه عقب',fr:'Angle arrière',es:'Esquina trasera',fn(c,th,K){if(viewOf(c)!=='side')return vehEndG(c,th,K,'#ffffff');const P=K.P;
  return {bg:'#ffffff',layers:[shp('corner-flip',.62,.2,.38,.8,P.acc),shp('corner-flip',.72,.4,.28,.6,P.pri),...K.flow({x:.08,y:.06,w:.58,h:.56,bg:'#ffffff'},K.parts('logo brand kicker phone web',{logo:{k:.45},brand:{role:'pri'}}),{align:'left'})]};}},
 dotsrear:{n:'Halftone Dots',fa:'نقطه‌های هافتون',fr:'Points de trame',es:'Puntos de trama',fn(c,th,K){const P=K.P;if(viewOf(c)!=='side')return vehEndG(c,th,K,P.pri);
  return {bg:P.pri,layers:[shp('dots',.76,.1,.2,.52,P.acc,{opacity:.6}),...K.flow({x:.08,y:.06,w:.66,h:.56,bg:P.pri},K.parts('brand kicker phone web'),{align:'left'})]};}},
 hazard:{n:'Work Truck Stripes',fa:'نوار کاری',fr:'Bandes de chantier',es:'Franjas de trabajo',fn(c,th,K){const P=K.P,bg=contrast(P.acc,'#141414')>=6?P.acc:'#ffc31f',ink=on(bg,[P.dark,'#141414']);if(viewOf(c)!=='side')return vehEndG(c,th,K,bg);
  return {bg,layers:[shp('stripes',0,.66,1,.08,ink),...K.flow({x:.08,y:.06,w:.22,h:.54,bg},K.parts('logo',{logo:{k:1.2,color:ink}})),...K.flow({x:.34,y:.06,w:.62,h:.56,bg},K.parts('brand kicker phone web',{brand:{upper:true}}),{align:'left'})]};}},
 services:{n:'Services Panel',fa:'پنل خدمات',fr:'Panneau de services',es:'Panel de servicios',fn(c,th,K){const P=K.P;if(viewOf(c)!=='side')return vehEndG(c,th,K,P.pri);
  return {bg:'#ffffff',layers:[rect(0,0,.42,1,P.pri),...K.flow({x:.04,y:.08,w:.34,h:.54,bg:P.pri},K.parts('logo brand',{logo:{k:.5},brand:{k:.75}})),...K.flow({x:.48,y:.06,w:.48,h:.56,bg:'#ffffff'},K.parts('list phone web',{list:{mark:'check'},phone:{k:.8}}),{align:'left'})]};}}
};

/* ================= APPAREL (transparent garment; colours follow the garment) ================= */
const gAcc=(c,P)=>on(c.garment,[P.acc,P.acc2,P.pri,c.ink],3);
const APPL={
 ring:{n:'Ring Badge',fa:'نشان حلقه‌ای',fr:'Badge anneau',es:'Insignia de anillo',fn(c,th,K){const d=.66,b=sq(c,.5,.38,d),A=gAcc(c,K.P);return {layers:[shp('ring',b.x,b.y,b.w,b.h,c.ink),...K.flow({x:.5-mx(c,d*.3),y:.38-my(c,d*.3),w:mx(c,d*.6),h:my(c,d*.6),bg:c.garment},[{t:'icon',shape:th.icon,d:.14,color:A},{t:'text',text:K.cp.company,size:.07,font:K.F.head,bold:K.F.hb,color:c.ink,gap:.02},{t:'text',text:K.rtl?'از ۲۰۲۶':'EST. 2026',size:.03,font:K.F.body,bold:true,color:A,spacing:K.rtl?0:.3}])]};}},
 stacked:{n:'Stacked Words',fa:'کلمات روی هم',fr:'Mots empilés',es:'Palabras apiladas',fn(c,th,K){const w=K.cp.company.split(/\s+/).slice(0,3).join('\n');return {layers:K.flow({x:.1,y:.08,w:.8,h:.6,bg:c.garment},[{t:'text',text:K.up(w),size:.22,font:K.rtl?K.F.head:'Anton',color:c.ink,gap:.03},{t:'rule',len:.4,st:.01,color:gAcc(c,K.P)},{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.2}])};}},
 crew:{n:'Crew Tee',fa:'تی‌شرت تیم',fr:'T-shirt d’équipe',es:'Camiseta de equipo',fn(c,th,K){return {layers:K.flow({x:.1,y:.08,w:.8,h:.56,bg:c.garment},[{t:'icon',shape:th.icon,d:.26,color:gAcc(c,K.P)},{t:'text',text:K.cp.company,size:.12,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.up(K.cp.tagline),size:.04,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.15},{t:'text',text:CONTACT.web,size:.038,font:K.F.body,color:c.ink}])};}},
 back:{n:'Back Print',fa:'چاپ پشت',fr:'Impression dos',es:'Estampado trasero',fn(c,th,K){const A=gAcc(c,K.P);return {layers:K.flow({x:.08,y:.06,w:.84,h:.84,bg:c.garment},[{t:'icon',shape:th.icon,d:.2,color:A},{t:'text',text:K.cp.company,size:.12,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'rule',len:.3,st:.008,color:A},{t:'list',items:K.cp.bullets,size:.05,font:K.F.body,bold:true,color:c.ink,mark:null},{t:'text',text:CONTACT.phone,size:.08,font:K.F.body,bold:true,color:A},{t:'text',text:CONTACT.web,size:.04,font:K.F.body,color:c.ink}],{valign:'spread'})};}},
 chest:{n:'Left Chest',fa:'لوگوی سینه',fr:'Logo poitrine',es:'Logo en el pecho',fn(c,th,K){return {layers:K.flow({x:.58,y:.08,w:.3,h:.24,bg:c.garment},[{t:'icon',shape:th.icon,d:.1,color:gAcc(c,K.P)},{t:'text',text:K.cp.company,size:.05,font:K.F.head,bold:K.F.hb,color:c.ink}])};}},
 disc:{n:'Colour Disc',fa:'دایره رنگی',fr:'Disque couleur',es:'Disco de color',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc,P.acc2],1.6),d=.36;return {layers:[dot(c,.5,.28,d,f),icon(c,th.icon,.5,.28,d*.55,on(f,['#ffffff','#141414'],3)),...K.flow({x:.1,y:.28+my(c,d)/2+.02,w:.8,h:.26,bg:c.garment},[{t:'text',text:K.cp.company,size:.11,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.15}])]};}},
 ribbon:{n:'Ribbon Banner',fa:'روبان',fr:'Banderole',es:'Banderola',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc],1.6),ry=.3,rh=.12;return {layers:[icon(c,th.icon,.5,.18,.2,gAcc(c,P)),shp('ribbon',.06,ry,.88,rh,f),...K.flow({x:.16,y:ry+.02,w:.68,h:rh-.04,bg:f},[{t:'text',text:K.up(K.cp.company),size:.09,font:K.F.head,bold:K.F.hb,color:on(f,['#ffffff','#141414'])}]),...K.flow({x:.1,y:ry+rh+.02,w:.8,h:.1,bg:c.garment},[{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.15}])]};}},
 hex:{n:'Hex Monogram',fa:'مونوگرام شش‌ضلعی',fr:'Monogramme hexagonal',es:'Monograma hexagonal',fn(c,th,K){const d=.5,b=sq(c,.5,.3,d),ini=K.rtl?K.cp.company.split(/\s+/)[0]:K.cp.company.split(/\s+/).filter(w=>/^[A-Z]/i.test(w)).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  return {layers:[shp('hexagon',b.x,b.y,b.w,b.h,gAcc(c,K.P),{outline:c.mn*100*.012}),...K.flow({x:.5-mx(c,d*.3),y:.3-my(c,d*.24),w:mx(c,d*.6),h:my(c,d*.48),bg:c.garment},[{t:'text',text:ini,size:.2,font:K.F.head,bold:K.F.hb,color:c.ink}]),...K.flow({x:.1,y:.3+my(c,d)/2+.02,w:.8,h:.14,bg:c.garment},[{t:'text',text:K.up(K.cp.company),size:.06,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.2}])]};}},
 retro:{n:'Retro Stripes',fa:'نوار رترو',fr:'Rayures rétro',es:'Rayas retro',fn(c,th,K){const P=K.P,cols=[P.acc,P.acc2,P.pri].map(x=>on(c.garment,[x,c.ink],1.5));return {layers:[...K.flow({x:.1,y:.1,w:.8,h:.24,bg:c.garment},[{t:'text',text:K.cp.company,size:.13,font:K.rtl?K.F.head:'Alfa Slab One',color:c.ink}]),...cols.map((col,i)=>rect(.15,.37+i*.035,.7,.022,col)),...K.flow({x:.1,y:.49,w:.8,h:.08,bg:c.garment},[{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.15}])]};}},
 sunset:{n:'Retro Sunset',fa:'غروب رترو',fr:'Coucher rétro',es:'Atardecer retro',fn(c,th,K){const P=K.P;return {layers:[shp('half-round',.2,.1,.6,.24,P.acc,{gradient:{to:P.acc2,angle:90}}),...[0,1,2].map(i=>rect(.2,.25+i*.03,.6,.012,c.garment)),...K.flow({x:.08,y:.37,w:.84,h:.26,bg:c.garment},[{t:'text',text:K.rtl?K.cp.company:(K.cp.script||K.cp.company),size:.13,font:K.rtl?K.F.head:'Kaushan Script',color:c.ink},{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.2}])]};}},
 est:{n:'Established',fa:'تاسیس',fr:'Fondé en',es:'Fundado en',fn(c,th,K){const A=gAcc(c,K.P);return {layers:K.flow({x:.08,y:.1,w:.84,h:.5,bg:c.garment},[{t:'text',text:K.cp.company,size:.14,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'rule',len:.5,st:.006,color:A},{t:'text',text:K.rtl?'تاسیس ۲۰۲۶':'EST.  2026',size:.05,font:K.F.body,bold:true,color:A,spacing:K.rtl?0:.4}])};}},
 slogan:{n:'Slogan Tee',fa:'تی‌شرت شعار',fr:'T-shirt slogan',es:'Camiseta con lema',fn(c,th,K){return {layers:K.flow({x:.08,y:.1,w:.84,h:.6,bg:c.garment},[{t:'text',text:K.up(K.cp.headline),size:.16,font:K.rtl?K.F.head:'Anton',color:c.ink,gap:.04},{t:'text',text:K.cp.company,size:.05,font:K.F.body,bold:true,color:gAcc(c,K.P)}])};}},
 boxed:{n:'Boxed Logo',fa:'لوگوی قاب‌دار',fr:'Logo encadré',es:'Logo enmarcado',fn(c,th,K){const by=.12,bh=.2;return {layers:[rect(.12,by,.76,bh,c.ink,{outline:c.mn*100*.01}),...K.flow({x:.17,y:by+.025,w:.66,h:bh-.05,bg:c.garment},[{t:'text',text:K.up(K.cp.company),size:.09,font:K.F.head,bold:K.F.hb,color:c.ink}]),...K.flow({x:.12,y:by+bh+.02,w:.76,h:.08,bg:c.garment},[{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:gAcc(c,K.P),spacing:K.rtl?0:.15}])]};}},
 staff:{n:'Staff Back',fa:'پشت کارکنان',fr:'Dos personnel',es:'Espalda personal',fn(c,th,K){return {layers:K.flow({x:.08,y:.08,w:.84,h:.5,bg:c.garment},[{t:'text',text:K.rtl?'کارکنان':'STAFF',size:.34,font:K.rtl?K.F.head:'Anton',color:c.ink,spacing:K.rtl?0:.05},{t:'rule',len:.55,st:.012,color:gAcc(c,K.P)},{t:'text',text:K.up(K.cp.company),size:.06,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.2}])};}},
 stars:{n:'Five Stars',fa:'پنج ستاره',fr:'Cinq étoiles',es:'Cinco estrellas',fn(c,th,K){const A=gAcc(c,K.P),d=.1;return {layers:[...[0,1,2,3,4].map(i=>icon(c,'star',.5+(i-2)*mx(c,d*1.2),.14,d,A)),...K.flow({x:.08,y:.22,w:.84,h:.32,bg:c.garment},[{t:'text',text:K.cp.company,size:.12,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.rtl?'خدمات پنج ستاره':'5-STAR SERVICE',size:.045,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.25}])]};}},
 minimal:{n:'Lowercase Minimal',fa:'مینیمال',fr:'Minuscule minimal',es:'Minúscula minimal',fn(c,th,K){return {layers:[...K.flow({x:.1,y:.22,w:.8,h:.14,bg:c.garment},[{t:'text',text:K.rtl?K.cp.company:K.cp.company.toLowerCase(),size:.1,font:K.rtl?K.F.head:'Manrope',bold:true,color:c.ink}]),dot(c,.5,.42,.035,gAcc(c,K.P))]};}},
 script:{n:'Script Signature',fa:'امضای دست‌نویس',fr:'Signature manuscrite',es:'Firma manuscrita',fn(c,th,K){return {layers:K.flow({x:.08,y:.12,w:.84,h:.4,bg:c.garment},[{t:'text',text:K.rtl?K.cp.company:(K.cp.script||K.cp.company.split(' ')[0]),size:.2,font:K.rtl?K.F.head:(K.F.script||'Pacifico'),color:c.ink},{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:gAcc(c,K.P),spacing:K.rtl?0:.2}])};}},
 bigdisc:{n:'Circle Logo',fa:'لوگوی دایره',fr:'Logo rond',es:'Logo circular',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc],1.6),d=.66,ink=on(f,['#ffffff','#141414']);return {layers:[dot(c,.5,.38,d,f),...K.flow({x:.5-mx(c,d*.33),y:.38-my(c,d*.33),w:mx(c,d*.66),h:my(c,d*.66),bg:f},[{t:'icon',shape:th.icon,d:.16,color:ink},{t:'text',text:K.cp.company,size:.08,font:K.F.head,bold:K.F.hb,color:ink},{t:'text',text:K.up(K.cp.short),size:.03,font:K.F.body,bold:true,color:ink,spacing:K.rtl?0:.15}])]};}},
 sport:{n:'Sport Chevron',fa:'اسپرت',fr:'Sport',es:'Deportivo',fn(c,th,K){const A=gAcc(c,K.P);return {layers:[shp('chevrons',.36,.08,.28,.1,A),...K.flow({x:.08,y:.2,w:.84,h:.34,bg:c.garment},[{t:'text',text:K.up(K.cp.company),size:.13,font:K.rtl?K.F.head:'Anton',italic:!K.rtl,color:c.ink},{t:'text',text:K.up(K.cp.tagline),size:.035,font:K.F.body,bold:true,color:A,spacing:K.rtl?0:.15}])]};}},
 dotsart:{n:'Halftone Dots',fa:'نقطه‌های هافتون',fr:'Points de trame',es:'Puntos de trama',fn(c,th,K){const A=gAcc(c,K.P);return {layers:[shp('dots',.18,.08,.64,.14,A,{opacity:.7}),...K.flow({x:.08,y:.24,w:.84,h:.36,bg:c.garment},[{t:'text',text:K.up(K.cp.headline),size:.12,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.cp.company,size:.045,font:K.F.body,bold:true,color:A}])]};}},
 local:{n:'Support Local',fa:'حمایت محلی',fr:'Achat local',es:'Apoya lo local',fn(c,th,K){const A=gAcc(c,K.P);return {layers:K.flow({x:.08,y:.1,w:.84,h:.5,bg:c.garment},[{t:'icon',shape:'heart',d:.14,color:A},{t:'text',text:K.rtl?'حمایت از کسب‌وکار محلی':'SUPPORT LOCAL',size:.12,font:K.rtl?K.F.head:'Anton',color:c.ink},{t:'text',text:K.cp.company,size:.06,font:K.F.head,bold:K.F.hb,color:A},{t:'text',text:K.rtl?'وان، انتاریو':'VAUGHAN · ONTARIO',size:.03,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.25}])};}},
 team:{n:'Team Number',fa:'شماره تیم',fr:'Numéro d’équipe',es:'Número de equipo',fn(c,th,K){const A=gAcc(c,K.P);return {layers:K.flow({x:.1,y:.08,w:.8,h:.6,bg:c.garment},[{t:'text',text:K.up(K.cp.company.split(/\s+/)[0]),size:.12,font:K.rtl?K.F.head:'Alfa Slab One',color:c.ink},{t:'text',text:K.rtl?'۲۶':'26',size:.36,font:K.rtl?K.F.head:'Alfa Slab One',color:A},{t:'text',text:K.rtl?'تیم':'TEAM',size:.04,font:K.F.body,bold:true,color:c.ink,spacing:K.rtl?0:.4}])};}}
};

/* ================= HATS (4 × 2 in front panel) ================= */
const word1=K=>{const w=K.cp.company.replace(/[.,]/g,'').split(/\s+/);if(K.rtl)return w.slice(0,2).join(' ');const ws=w[0].toUpperCase()==='THE'&&w.length>1?w.slice(1):w;let out=[];for(const x of ws){out.push(x);if(x!=='&'&&out.join(' ').length>=6||out.length>=3)break;}return out.join(' ');};
const HATL={
 word:{n:'Wordmark',fa:'نوشتار',fr:'Logotype',es:'Logotipo',fn(c,th,K){return {layers:K.flow({x:.05,y:.15,w:.9,h:.7,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.42,font:K.F.head,bold:K.F.hb,color:c.ink}])};}},
 iconword:{n:'Icon + Name',fa:'آیکون و نام',fr:'Icône + nom',es:'Icono + nombre',fn(c,th,K){return {layers:[icon(c,th.icon,.18,.5,.6,gAcc(c,K.P)),...K.flow({x:.34,y:.15,w:.62,h:.7,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.32,font:K.F.head,bold:K.F.hb,color:c.ink}],{align:'left'})]};}},
 badge:{n:'Round Badge',fa:'نشان گرد',fr:'Badge rond',es:'Insignia redonda',fn(c,th,K){const b=sq(c,.5,.5,.92);return {layers:[shp('ring',b.x,b.y,b.w,b.h,c.ink),icon(c,th.icon,.5,.5,.5,gAcc(c,K.P))]};}},
 script:{n:'Script',fa:'دست‌نویس',fr:'Script',es:'Caligrafía',fn(c,th,K){return {layers:K.flow({x:.05,y:.12,w:.9,h:.76,bg:c.garment},[{t:'text',text:K.rtl?word1(K):(K.cp.script||word1(K)),size:.5,font:K.rtl?K.F.head:(K.F.script||'Great Vibes'),color:c.ink}])};}},
 mono:{n:'Hex Monogram',fa:'مونوگرام',fr:'Monogramme',es:'Monograma',fn(c,th,K){const b=sq(c,.5,.5,.9),ini=K.rtl?K.cp.company.split(/\s+/)[0]:K.cp.company.split(/\s+/).filter(w=>/^[A-Z]/i.test(w)).slice(0,2).map(w=>w[0]).join('').toUpperCase();return {layers:[shp('hexagon',b.x,b.y,b.w,b.h,gAcc(c,K.P),{outline:c.mn*4}),...K.flow({x:.5-mx(c,.27),y:.5-my(c,.25),w:mx(c,.54),h:my(c,.5),bg:c.garment},[{t:'text',text:ini,size:.38,font:K.F.head,bold:K.F.hb,color:c.ink}])]};}},
 est:{n:'Established',fa:'تاسیس',fr:'Fondé en',es:'Fundado en',fn(c,th,K){return {layers:K.flow({x:.05,y:.08,w:.9,h:.84,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.36,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.rtl?'تاسیس ۲۰۲۶':'EST. 2026',size:.13,font:K.F.body,bold:true,color:gAcc(c,K.P),spacing:K.rtl?0:.3}])};}},
 patch:{n:'Colour Patch',fa:'وصله رنگی',fr:'Écusson couleur',es:'Parche de color',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc],1.6);return {layers:[rect(.04,.1,.92,.8,f,{radius:.25}),...K.flow({x:.12,y:.2,w:.76,h:.6,bg:f},[{t:'text',text:K.up(word1(K)),size:.36,font:K.F.head,bold:K.F.hb,color:on(f,['#ffffff','#141414'])}])]};}},
 outline:{n:'Outline Patch',fa:'وصله خطی',fr:'Écusson contour',es:'Parche contorno',fn(c,th,K){return {layers:[rect(.04,.1,.92,.8,c.ink,{outline:c.mn*100*.03,radius:.25}),...K.flow({x:.14,y:.22,w:.72,h:.56,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.34,font:K.F.head,bold:K.F.hb,color:c.ink}])]};}},
 stack:{n:'Two-Line Stack',fa:'دو خطی',fr:'Deux lignes',es:'Dos líneas',fn(c,th,K){return {layers:K.flow({x:.05,y:.06,w:.9,h:.88,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.34,font:K.F.head,bold:K.F.hb,color:c.ink,gap:.02},{t:'text',text:K.up(K.cp.short),size:.13,font:K.F.body,bold:true,color:gAcc(c,K.P),spacing:K.rtl?0:.15}])};}},
 underline:{n:'Underlined',fa:'زیرخط‌دار',fr:'Souligné',es:'Subrayado',fn(c,th,K){return {layers:K.flow({x:.05,y:.12,w:.9,h:.76,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.38,font:K.F.head,bold:K.F.hb,color:c.ink,gap:.05},{t:'rule',len:1.6,st:.05,color:gAcc(c,K.P)}])};}},
 stars:{n:'Star Flank',fa:'ستاره‌ها',fr:'Étoiles',es:'Estrellas',fn(c,th,K){const A=gAcc(c,K.P);return {layers:[icon(c,'star',.08,.5,.18,A),icon(c,'star',.92,.5,.18,A),...K.flow({x:.17,y:.15,w:.66,h:.7,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.34,font:K.F.head,bold:K.F.hb,color:c.ink}])]};}},
 ribbon:{n:'Ribbon',fa:'روبان',fr:'Ruban',es:'Cinta',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc],1.6);return {layers:[shp('ribbon',.02,.24,.96,.52,f),...K.flow({x:.14,y:.3,w:.72,h:.4,bg:f},[{t:'text',text:K.up(word1(K)),size:.3,font:K.F.head,bold:K.F.hb,color:on(f,['#ffffff','#141414'])}])]};}},
 disc:{n:'Disc + Name',fa:'دایره و نام',fr:'Disque + nom',es:'Disco + nombre',fn(c,th,K){const P=K.P,f=on(c.garment,[P.pri,P.acc],1.6);return {layers:[dot(c,.17,.5,.7,f),icon(c,th.icon,.17,.5,.38,on(f,['#ffffff','#141414'],3)),...K.flow({x:.36,y:.12,w:.6,h:.76,bg:c.garment},[{t:'text',text:K.up(word1(K)),size:.3,font:K.F.head,bold:K.F.hb,color:c.ink},{t:'text',text:K.up(K.cp.short),size:.1,font:K.F.body,bold:true,color:gAcc(c,P),spacing:K.rtl?0:.1}],{align:'left'})]};}},
 bolt:{n:'Icon Stack',fa:'آیکون روی نام',fr:'Icône empilée',es:'Icono apilado',fn(c,th,K){return {layers:K.flow({x:.05,y:.04,w:.9,h:.92,bg:c.garment},[{t:'icon',shape:th.icon2||th.icon,d:.42,color:gAcc(c,K.P)},{t:'text',text:K.up(word1(K)),size:.26,font:K.F.head,bold:K.F.hb,color:c.ink}])};}}
};

/* ---------------- catalogue generation ---------------- */
export function genThemes(TH){const out={};for(const t of NEW_THEMES)out[t.key]=t;for(const [k,m] of Object.entries(LEGACY_META))if(TH[k])Object.assign(TH[k],{names:m.names,moods:m.moods,tags:m.tags,icons:TH[k].icons||[TH[k].icon,TH[k].icon2||TH[k].icon,'shield','check']});return out;}
const FAMS={card:G,print:G,hanger:G,tall:G,wide:G,sign:G,brochure:G,flag:FLAGL,vehicle:VEHL,apparel:APPL,hat:HATL};
const TARGET={card:132,print:140,hanger:120,tall:120,wide:120,sign:120,brochure:110,flag:112,vehicle:128,apparel:132,hat:112};
const hash=s=>{let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
const BROCHURE_OK=k=>!['services','burst','qr','bands'].includes(k);
export function genCatalog(TH){const out={},keys=Object.keys(TH).filter(k=>TH[k].names);
 for(const [fam,LIB] of Object.entries(FAMS)){const lays=Object.keys(LIB).filter(k=>(!LIB[k].fams||LIB[k].fams.includes(fam))&&(fam!=='brochure'||BROCHURE_OK(k)));
  const compat=(lk,t)=>{if(LIB[lk].noRtl&&TH[t].rtl)return false;const m=LIB[lk].moods;if(!m||m.includes('any'))return true;return (TH[t].moods||[]).some(x=>m.includes(x));};
  const used=new Map(),pairs=new Set(),list=[];const target=TARGET[fam];
  for(let round=0;list.length<target&&round<40;round++)for(const lk of lays){if(list.length>=target)break;
   const cands=keys.filter(t=>compat(lk,t)&&!pairs.has(lk+'|'+t));if(!cands.length)continue;
   cands.sort((a,b)=>(used.get(a)||0)-(used.get(b)||0)||(hash(fam+lk+a+round)-hash(fam+lk+b+round)));const t=cands[0];used.set(t,(used.get(t)||0)+1);pairs.add(lk+'|'+t);
   const L=LIB[lk],T=TH[t];list.push({id:`${fam}-g-${lk}-${t}`,fam,lay:lk,theme:t,gen:true,name:`${L.n} — ${T.names.en}`,cat:T.cat,tags:`${T.tags||''} ${L.n.toLowerCase()} ${(T.moods||[]).join(' ')}`,
    i18n:{fa:`${L.fa} — ${T.names.fa}`,fr:`${L.fr} — ${T.names.fr}`,es:`${L.es} — ${T.names.es}`}});}
  out[fam]=list;}
 return out;}
export function genFonts(tp){const L=FAMS[tp.fam]?.[tp.lay];const f=L?.fonts?[L.fonts.head,L.fonts.body].filter(Boolean):[];
 if(tp.fam==='apparel'||tp.fam==='hat')f.push('Anton','Alfa Slab One','Kaushan Script','Manrope','Pacifico','Great Vibes');if(tp.fam==='vehicle'||tp.fam==='flag')f.push('Playfair Display');return f;}
export function layoutCount(){return {generic:Object.keys(G).length,flag:Object.keys(FLAGL).length,vehicle:Object.keys(VEHL).length,apparel:Object.keys(APPL).length,hat:Object.keys(HATL).length};}

// c: {W,H,r,mn,fold,sideKey,dark,ink}; returns {bg,layers,back?,bothSides?,noMirror?}
export function buildGenerated(tp,c,th){const LIB=FAMS[tp.fam],L=LIB[tp.lay];
 if(tp.fam==='brochure')return genBrochure(c,th,tp.lay,hash(tp.id)%3);
 const fam=tp.fam==='vehicle'?'vehicle':tp.fam==='apparel'||tp.fam==='hat'||tp.fam==='flag'?'print':tp.fam;
 if(tp.fam==='apparel'||tp.fam==='hat')c={...c,garment:c.dark?'#151515':'#ffffff'};
 const K=kit(c,th,fam,L.pal,L.fonts),out=L.fn(c,th,K);
 // door hangers: mark the die-cut hole (decoration only; the top band never holds text)
 if(tp.fam==='hanger'){const cy=Math.max(.3*c.W,.12*c.H)/c.H,b=sq(c,.5,cy,.46);out.layers.push(shp('ring',b.x,b.y,b.w,b.h,'#9ca3af',{opacity:.7}));}
 return out;}
