const select=(key,label,rows)=>({key,label,type:'select',default:rows[0][1],options:rows.map(([label,value])=>({label,value}))});
const number=(key,label,value,min=1,max=1200,step=.01)=>({key,label,type:'number',default:value,min,max,step});
const check=(key,label)=>({key,label,type:'checkbox',default:0});
export function batchUpgrade(original){
 if(original.updateVersion>=4)return original;
 const r=structuredClone(original),field=k=>r.fields.find(f=>f.key===k),replace=(key,f)=>{const i=r.fields.findIndex(x=>x.key===key);if(i<0)r.fields.push(f);else r.fields[i]=f;};r.constants||={};
 const purchasable=/\/print-shop\/|\/wallpaper|\/window-graphics|\/apparel|\/shop\//.test(r.path);if(purchasable)r.deposit={type:'percent',value:100};
 if(r.path.includes('/vehicle-wraps/estimator/')){
  const c=field('coverage');if(c){c.options=c.options.map(o=>({...o,label:o.value===.45?'Partial wrap · rear half':o.value===.7?'¾ wrap · rear to front':o.label}));}
  // Keep decal prices unchanged and apply the reduction only to full coverage.
  r.constants.fullWrapFactor=.9;r.formula=r.formula.replace(/round\((.*?) \/ 10\) \* 10/,(_,body)=>'round(('+body+') * if(coverage == 1, fullWrapFactor, 1) / 10) * 10');
  if(r.id==='wrap-transit-van'){r.constants.base=3200/(1.08*.9);}
  if(r.id==='wrap-cargo-van'){r.label='Ram ProMaster wrap estimator';field('vehicle_0').label='ProMaster wheelbase';field('vehicle_0').options=[{label:'136 in wheelbase',value:1},{label:'159 in wheelbase',value:1.1}];field('vehicle_1').options=[{label:'Low roof',value:1},{label:'High roof',value:1.12},{label:'Super high roof',value:1.2}];}
  if(r.id==='wrap-trailer')replace('vehicle_0',select('vehicle_0','Trailer length',[10,12,14,16,20,24].map(n=>[n+' ft',n/12])));
 }
 if(r.path.includes('/print-shop/large-format/')){
  replace('quantity',number('quantity','Quantity',1,1,10000,1));r.constants.designFee=100;
  if(['print-roll-up-banner','print-x-frame-banner'].includes(r.id)){r.fields=r.fields.filter(f=>f.key!=='installation');r.formula=r.formula.replace(/ \+ installation \* installFee/g,'');}
  // Extend existing volume tiers to any entered quantity using their per-unit rates.
  if(r.constants.baseq1!==undefined){r.constants.unit1=r.constants.baseq1;for(const n of [2,5,10,25])r.constants['unit'+n]=r.constants['baseq'+n]/n; r.formula=r.formula.replace(/\(if\(quantity == 1, baseq1, if\(quantity == 2, baseq2, if\(quantity == 5, baseq5, if\(quantity == 10, baseq10, baseq25\)\)\)\)\)/g,'(quantity * if(quantity < 2, unit1, if(quantity < 5, unit2, if(quantity < 10, unit5, if(quantity < 25, unit10, unit25)))))');}
 }
 if(r.id.startsWith('apparel-')){r.constants.designFee=30;r.constants.designDeposit=30;}
 if(r.id==='wallpaper'||r.id.startsWith('wallpaper-'))r.constants.designFee=150;
 if(r.id.startsWith('glass-')||r.id==='window-graphics')r.constants.designFee=100;
 if(r.id==='glass-full-window-graphics'){replace('material',select('material','Material',[['Regular vinyl',9],['Blackout film · grey adhesive',12],['Clear film',10]]));replace('adhesive',select('adhesive','Adhesive',[['Removable',0],['Permanent',1]]));}
 if(r.id==='glass-window-decals'){replace('material',select('material','Material',[['Single-colour calendered vinyl',15],['Full-colour digital print',15]]));}
 if(r.id==='tint-commercial'){replace('film',select('film','Material',[['Ceramic',12],['Regular',5]]));replace('vlt',select('vlt','Visible light transmission',[['20%',20],['35%',35],['60%',60],['70%',70]]));}
 if(r.id==='tint-vehicle'){
  replace('film',select('film','Material',[['Ceramic',1.8],['Regular',1]]));replace('vlt',select('vlt','Visible light transmission',[['5%',5],['20%',20],['35%',35],['60%',60]]));r.fields=r.fields.filter(f=>f.key!=='coverage');
  for(const [key,label,def] of [['glass_fl','Front left',1],['glass_fr','Front right',1],['glass_rl','Rear left',0],['glass_rr','Rear right',0],['glass_back','Back glass',0],['glass_strip','Windshield sun strip',0]])r.fields.push({...check(key,label),default:def});
  r.constants.frontRate=.225;r.constants.rearRate=.2;r.constants.backRate=.15;r.constants.stripRate=.12;r.formula='round(vehicle * film * ((glass_fl + glass_fr) * frontRate + (glass_rl + glass_rr) * rearRate + glass_back * backRate + glass_strip * stripRate))';
 }
 if(['print-flyers','print-postcards'].includes(r.id)){
  const size=field('size');let custom=size.options.find(o=>/custom/i.test(o.label));if(!custom){custom={label:'Custom · exact quote',value:3};size.options.push(custom);}r.customSizeValue=custom.value;
  replace('width',number('width','Custom width (inches)',6,.1,60));replace('height',number('height','Custom height (inches)',4,.1,60));r.constants.supplierMultiplier=2;r.constants.supplierWidth=0;r.constants.supplierHeight=0;
  for(const n of [500,1000,2500,5000])r.constants['supplierCustom'+n]=0;
  const lookup='if(quantity == 500, supplierCustom500, if(quantity == 1000, supplierCustom1000, if(quantity == 2500, supplierCustom2500, supplierCustom5000)))';r.formula='if(size == '+custom.value+', if(width == supplierWidth && height == supplierHeight, ('+lookup+') * supplierMultiplier, 0) + design * designFee, '+r.formula+')';r.priceNote='Custom dimensions are priced from the supplier cost × 2. Request an exact quote when a supplier price has not been entered.';
 }
 if(r.id==='wrap-prints'){
  replace('height',number('height','Height (inches)',48,1,52,.01));replace('width',number('width','Width (inches)',120,1,1200,.01));replace('kind',select('kind','Print type',[['Full-colour wrap print',0],['Cut decals · vector artwork required',1]]));replace('material',select('material','Material',[['3M',0],['Arlon',1]]));replace('shipping',select('shipping','Delivery',[['Shop pickup',0],['Next business day shipping · $100',100]]));replace('rush',check('rush','Rush job · +20%'));
  Object.assign(r.constants,{printRate:8,decal3M:12,decalArlon:10,rushFactor:.2});r.formula='(width * height / 144 * quantity * if(kind == 0, printRate, if(material == 0, decal3M, decalArlon)) + shipping + design * designFee) * (1 + rush * rushFactor)';r.priceNote='Production: 3–4 business days. Shipping transit begins after production. Decals: maximum height 48 in; wrap print: 52 in. Supply artwork at 1:1 scale; decals require vector paths suitable for printing and cutting.';
 }
 if(r.id==='design-services'){r.fields=[select('service','Design service',[['Vehicle wrap design',250],['Window graphic design',150],['Print artwork design',100],['Wallpaper design',150],['Apparel design',30]])];}
 if(r.id==='website-design'){
  for(const k of ['type','pages']){const f=field(k);f.options=f.options.map((o,i)=>({...o,value:k==='type'&&i===0?400:Math.round(o.value*.5)}));f.default=f.options[0].value;}
  r.formula=r.formula.replace(/\* (\d+)/g,(_,n)=>'* '+Number(n)*.5);r.priceNote='Hosting and domain registration are not included.';
 }
 if(r.id.startsWith('design-')&&r.id!=='design-services'){replace('adjust',check('adjust','Need adjustment for your vehicle · $100'));r.constants.adjustFee=100;r.formula+=' + adjust * adjustFee';}
 r.updateVersion=4;return r;
}
const base={taxPercent:13,deposit:{type:'percent',value:100},discount:{type:'percent',value:0},revision:0,updateVersion:4};
const bagCosts=[[[5,3.15,3.05,2.95,2.8],[7,4.45,4.2,4.1,3.9],[9.7,5.7,5.6,5.3,5.2]],[[7.3,4.8,4.7,4.4,4.1],[9.2,6.1,5.9,5.2,5],[10.7,7.2,6.9,6.5,6.2]]];
const quantities=[50,100,250,500,1000],constants={markup:1.4,designFee:50};
const choose=(key,branches,final)=>branches.map(([value,expr])=>'if('+key+' == '+value+', '+expr+', ').join('')+final+')'.repeat(branches.length);
const sizes=bagCosts.map((colors,s)=>colors.map((costs,c)=>{costs.forEach((n,q)=>constants['s'+s+'c'+c+'q'+q]=n);return choose('quantity',quantities.slice(0,-1).map((n,q)=>[n,'s'+s+'c'+c+'q'+q]),'s'+s+'c'+c+'q4');}).map((x,c)=>[c+1,x]));
export const BATCH_RULES=[{...base,id:'print-poly-bag-lawn-sign',label:'Poly Bag Lawn Sign',path:'/satin/print-shop/large-format/poly-bag-lawn-sign',fields:[select('size','Bag size',[['24 × 20 in',0],['32 × 20 in',1]]),select('colours','Number of colours',[['1 colour',1],['2 colours',2],['3 colours',3]]),select('quantity','Quantity',quantities.map(n=>[String(n),n])),check('design','Design services · $50')],constants,formula:'quantity * ('+choose('size',[[0,choose('colours',sizes[0].slice(0,-1),sizes[0].at(-1)[1])]],choose('colours',sizes[1].slice(0,-1),sizes[1].at(-1)[1]))+') * markup + design * designFee'},
{...base,id:'dtf-transfers',label:'Custom DTF transfers',path:'/satin/shop/dtf-transfers',fields:[number('width','Width (inches)',10,.5,22),number('height','Height (inches)',10,.5,240),number('quantity','Quantity',1,1,10000,1),check('cut','Pre-cut individual transfers'),check('design','Design services')],constants:{sqInRate:.025,minimum:.25,cutFee:.15,designFee:30},formula:'quantity * (max(minimum, width * height * sqInRate) + cut * cutFee) + design * designFee',priceNote:'Upload transparent PNG or SVG artwork. Confirm the gang sheet dimensions before production.'}];
