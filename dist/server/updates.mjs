import {batchUpgrade,BATCH_RULES} from './batch-updates.mjs';
import {DEFAULT_RULES} from './studio-model.mjs';
import {upgradePrint} from './print-pricing.mjs';
const select=(key,label,entries,def)=>({key,label,type:'select',default:def??entries[0][1],options:entries.map(([label,value])=>({label,value}))});
const number=(key,label,def,min=1,max=1200,step=.01)=>({key,label,type:'number',default:def,min,max,step});
const check=(key,label)=>({key,label,type:'checkbox',default:0});
const finish=()=>select('finish','Finish',[['Gloss',1],['Matte · +10%',1.1],['Satin · +10%',1.1]]);
const design=()=>check('design','Design services');
export const MATRIX={
 crossover:[3000,3500,900,1560,2100,0,0],suv:[3450,4025,1035,1794,2415,0,0],truck:[3200,3500,1300,1650,2550,0,400],bigtruck:[3680,4025,1495,1898,2933,0,400],minivan:[2800,3200,1200,1500,2200,650,400],
 shortlow:[3200,3700,1100,1700,2500,1200,700],shorthigh:[3650,4150,1250,2100,2900,1200,700],longlow:[3500,4050,1200,1900,2700,1200,700],longmid:[3500,4050,1200,1900,2700,1200,700],longhigh:[3900,4500,1350,2300,3350,1450,700],
 box12:[2560,3328,845,1280,1920,0,700],box16:[3100,4100,1023,1550,2325,0,700],box20:[3600,4700,1188,1800,2700,0,800],box24:[4100,4960,1353,2050,3075,0,800],
 trailer10:[2150,2750,710,1075,1613,0,500],trailer12:[2560,3328,845,1280,1920,0,700],trailer14:[2800,3900,924,1400,2100,0,800],trailer16:[2560,3328,845,1280,1920,0,800],trailer20:[3100,4100,1023,1550,2325,0,800]};
const vans=[['Short wheelbase · low roof','shortlow'],['Short wheelbase · high roof','shorthigh'],['Long wheelbase · low roof','longlow'],['Long wheelbase · mid roof','longmid'],['Long wheelbase · high roof','longhigh']];
const variants={'wrap-suv':[['Crossover','crossover'],['Full SUV','suv']],'wrap-pickup-truck':[['Regular truck','truck'],['Big truck','bigtruck']],'wrap-minivan':[['Mini van','minivan']],'wrap-transit-van':vans,'wrap-sprinter-van':vans,'wrap-cargo-van':vans,'wrap-box-truck':[['8 × 12 ft','box12'],['8 × 16 ft','box16'],['8 × 20 ft','box20'],['8 × 24 ft','box24']],'wrap-trailer':[['10 × 8 ft','trailer10'],['12 × 8 ft','trailer12'],['14 × 8 ft','trailer14'],['16 × 8 ft','trailer16'],['20 × 8 ft','trailer20']]};
function upgradeLegacyRule(original){original=upgradePrint(original);if(original.updateVersion===2)return original;const r=structuredClone(original);r.updateVersion=2;
 if(r.id.startsWith('wrap-')&&r.id!=='wrap-prints'){
 const rows=variants[r.id];r.constants={designFee:250};
 if(rows){r.fields=[select('vehicle','Vehicle size',rows.map(([n],i)=>[n,i])),select('coverage','Coverage',[['Full wrap',0],['Full wrap with roof',1],['1/3 wrap',2],['1/2 wrap',3],['3/4 wrap',4],...(rows.every(([,k])=>MATRIX[k][5]>0)?[['Channel wrap',5]]:[]),...(rows.every(([,k])=>MATRIX[k][6]>0)?[['Decals · starting price',6]]:[])]),finish(),select('material','Wrap material',[['3M',1]]),design()];
 const expression=rows.map(([,k],i)=>{MATRIX[k].forEach((n,j)=>r.constants['v'+i+'c'+j]=n);return Array.from({length:6},(_,j)=>'if(coverage == '+j+', v'+i+'c'+j+', ').join('')+'v'+i+'c6'+')'.repeat(6)});
 r.formula=rows.slice(0,-1).map((_,i)=>'if(vehicle == '+i+', '+expression[i]+', ').join('')+expression.at(-1)+')'.repeat(rows.length-1);r.formula='('+r.formula+') * finish + design * designFee';r.priceOnRequest=false;
 }else{r.fields=[finish(),select('material','Wrap material',[['3M',1]]),design()];r.constants.base=0;r.formula='base * finish + design * designFee';r.priceOnRequest=true;r.priceNote='Vehicle pricing is confirmed by our team.';}
 }
 if(r.id==='wallpaper'||r.id.startsWith('wallpaper-')){r.fields=[number('width','Width (inches)',144),number('height','Height (inches)',96),number('quantity','Number of walls',1,1,100,1),select('material','Material · per sq ft',[['Flat Matte · $7',7],['Texture · $10',10]]),select('adhesive','Adhesive · same price',[['Removable',0],['Permanent',1]]),check('install','Professional installation · $3 / sq ft')];r.constants={installRate:3};r.formula='width * height / 144 * quantity * (material + install * installRate)';r.artworkOptional=true;r.priceOnRequest=false;}
 if(r.id.startsWith('glass-')||r.id==='tint-commercial'||r.id==='window-graphics'){
 for(const f of r.fields)if(['width','height'].includes(f.key)){if(f.label.includes('(ft)'))f.default*=12;f.label=f.key==='width'?'Width per pane (inches)':'Height per pane (inches)';f.min=.01;f.max=1200;f.step=.01;}
 if(!r.fields.some(f=>f.key==='install'))r.fields.push(check('install','Professional installation · $3 / sq ft'));
 r.constants.installRate=3;r.constants.designFee=250;
 const art=!['glass-frosted-vinyl','tint-commercial'].includes(r.id);r.fields=r.fields.filter(f=>f.key!=='design');if(art)r.fields.push(design());
 const rate=r.fields.some(f=>f.key==='material')?'material':r.fields.some(f=>f.key==='film')?'film':'rate';r.formula=(r.constants.minimum?'max(minimum, ':'')+'width * height / 144 * quantity * ('+rate+' + install * installRate)'+(r.constants.minimum?')':'')+(art?' + design * designFee':'');
 }
 if(r.id.startsWith('apparel-')){r.fields=r.fields.map(f=>f.key==='method'?select('method','Decoration method',[['DTF',1.15],['Vinyl Heat Press',1.1],...(/hats|polo/.test(r.id)?[['Embroidery',1.25]]:[])]):f.key==='quantity'?{...f,min:1,default:1}:f.key==='design'?design():f);r.constants.designFee=250;r.formula='unitPrice * quantity * method * if(quantity > 20, 0.95, 1) + design * designFee';}
 if(r.id.startsWith('print-')&&!r.fields.some(f=>f.key==='design')){r.fields.push(design());r.constants.designFee=250;r.formula='('+r.formula+') + design * designFee';}
 if(r.id==='wrap-prints'){r.fields=r.fields.map(f=>f.key==='material'?select('material','Wrap material',[['3M IJ180 + laminate',9]]):f);r.fields.push(design());r.constants.designFee=250;r.formula='('+r.formula+') + design * designFee';}
 if(r.id==='design-services'){r.fields=[select('service','Design service',[['Vehicle wrap design',250],['Print artwork design',250],['Window graphic design',250],['Apparel design',250]])];r.formula='service';}
 return r;
}
const base={taxPercent:13,deposit:{type:'percent',value:50},discount:{type:'percent',value:0},revision:0,updateVersion:2};
export const EXTRA_RULES=[...['partial','full'].map(kind=>({...base,id:'ppf-'+kind,label:kind==='partial'?'Partial PPF packages':'Full vehicle PPF',path:'/satin/vehicle-wraps/paint-protection-film/'+kind,fields:[select('plan','Protection package',kind==='partial'?[['Mirrors',0],['Partial front',1],['Full front',2],['Track package',3]]:[['Full body · Gloss',0],['Full body · Matte',1],['Full body · Colour PPF',2]])],constants:kind==='partial'?{mirrors:0,partialFront:0,fullFront:0,track:0}:{gloss:0,matte:0,color:0},formula:kind==='partial'?'if(plan == 0, mirrors, if(plan == 1, partialFront, if(plan == 2, fullFront, track)))':'if(plan == 0, gloss, if(plan == 1, matte, color))',priceOnRequest:true,priceRanges:kind==='partial'?[{label:'Mirrors',min:150,max:250},{label:'Partial front',min:900,max:1400},{label:'Full front',min:1800,max:2600},{label:'Track package',min:2600,max:3600}]:[{label:'Full body · Gloss',min:5500,max:7500},{label:'Full body · Matte',min:6500,max:8500},{label:'Full body · Colour PPF',min:7500,max:10000}]})),...['custom','botanical','marble','geometric','kids','office','bedroom'].map(id=>upgradeRule({...base,updateVersion:0,id:'wallpaper-'+id,label:id==='custom'?'Custom wallpaper':id[0].toUpperCase()+id.slice(1)+' wallpaper',path:'/satin/wallpaper/'+id,fields:[],constants:{}}))];

function previousUpgradeRule(original){
 if(original.updateVersion>=3){const r=structuredClone(original);for(const f of r.fields||[])if(f.key==='design')f.label='Design services';if(/vistaprint|sinalite|benchmark/i.test(r.priceNote||''))r.priceNote='';delete r.pricingSource;return r;}
 let r=upgradeLegacyRule(original);
 if(r.path.includes('/vehicle-wraps/estimator/')){
  const old=DEFAULT_RULES.find(x=>x.id===r.id);
  if(old){const saved=structuredClone(original);r={...r,fields:structuredClone(old.fields),constants:{...old.constants,...(saved.constants.base!==undefined?{base:saved.constants.base}:{})},formula:old.formula,priceOnRequest:false};
   r.fields.find(f=>f.key==='material').options=[{label:'3M',value:1.08}];r.fields.find(f=>f.key==='material').default=1.08;
   r.fields.find(f=>f.key==='finish').options=r.fields.find(f=>f.key==='finish').options.slice(0,3);
   r.constants.designDeposit=250;
   if(r.id==='wrap-sprinter-van'){
    r.fields=r.fields.filter(f=>!['vehicle_1','vehicle_2'].includes(f.key));
    r.fields.find(f=>f.key==='vehicle_0').label='Sprinter configuration';
    r.fields.find(f=>f.key==='vehicle_0').options=[{label:'Short wheelbase · low roof',value:1},{label:'Short wheelbase · high roof',value:1.1},{label:'Long wheelbase · high roof',value:1.21},{label:'Long wheelbase · high roof · extended',value:1.3068}];
    r.formula='round(base * vehicle_0 * coverage * finish * material * if(roof, roofMultiplier, 1) / 10) * 10 + design * designDeposit';
   }
  }
 }
 if(r.path.includes('/print-shop/offset/'))r.constants.designFee=100;
 if(r.id.startsWith('glass-')||r.id==='window-graphics')r.constants.designFee=150;
 r.updateVersion=3;return r;
}

export function upgradeRule(original){let r=original.updateVersion>=4?original:batchUpgrade(previousUpgradeRule(original));if(r.id==='dtf-transfers'&&!r.fields.some(f=>f.key==='layout')){r=structuredClone(r);r.fields.unshift(select('layout','Transfer format',[['Transfers by size',0],['Custom gang sheet',1]]));}if(r.id==='wrap-trailer'){const f=r.fields.find(x=>x.key==='vehicle_0');if(f&&f.options?.length>1&&f.options.every(o=>/^\d+ ft$/.test(o.label))){r=structuredClone(r);const g=r.fields.find(x=>x.key==='vehicle_0');g.label='Trailer length';g.options=[{label:'12–24 ft',value:1}];g.default=1;}}return r;}
EXTRA_RULES.push(...BATCH_RULES);
