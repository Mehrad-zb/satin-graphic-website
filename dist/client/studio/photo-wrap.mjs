// Design Studio — "Use my vehicle photo".
// The customer photographs (or picks) a photo of their own vehicle. We find the vehicle (a browser-side segmentation
// model loaded lazily from a CDN, else a classic computer-vision estimate, and the corners/brush are always adjustable
// by hand) and project the studio artwork for the chosen view onto it with a perspective warp, the vehicle mask and the
// car's own shading. Nothing is uploaded until the customer submits the design; then the original photo, the photo
// mock-up and the panel corners travel with the order like any other studio upload.
import {DICT,t,language} from './i18n.mjs';
import {paintHex} from './mockups.mjs';

// Pinned model sources (only fetched when the customer opens this feature).
export const MP_VERSION='0.10.14';
export const MP_BASE=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
export const MP_MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';
const AI_TIMEOUT=8000,SAM_TIMEOUT=120000,MAX_PHOTO=2400,MASK_MAX=640,VIEW_MAX=1400,DOCK_W=380;
const PASCAL_VEHICLES=[6,7]; // DeepLab v3 (PASCAL VOC): 6 = bus, 7 = car
const NOTE_START='[Customer vehicle photo]',NOTE_END='[/Customer vehicle photo]';

Object.assign(DICT,{
 'Loading the AI model…':{fa:'در حال بارگذاری هوش مصنوعی…',fr:'Chargement du modèle d’IA…',es:'Cargando el modelo de IA…'},
 'Use my vehicle photo':{fa:'استفاده از عکس خودروی من',fr:'Utiliser la photo de mon véhicule',es:'Usar la foto de mi vehículo'},
 'My vehicle photo':{fa:'عکس خودروی من',fr:'Photo de mon véhicule',es:'Foto de mi vehículo'},
 'Your vehicle photo':{fa:'عکس خودروی شما',fr:'Photo de votre véhicule',es:'Foto de su vehículo'},
 'Design on a photo of your own vehicle':{fa:'روی عکس خودروی خودتان طراحی کنید',fr:'Créez sur une photo de votre propre véhicule',es:'Diseñe sobre una foto de su propio vehículo'},
 'Stand back so the whole side is in the frame, hold the phone level and shoot straight on in daylight.':{fa:'کمی عقب بایستید تا کل بدنه در کادر باشد، گوشی را صاف و روبه‌روی خودرو در نور روز نگه دارید.',fr:'Reculez pour cadrer tout le côté, tenez le téléphone droit, face au véhicule, à la lumière du jour.',es:'Aléjese para que todo el lateral entre en la foto, sostenga el teléfono recto y de frente, con luz de día.'},
 'Take a photo':{fa:'گرفتن عکس',fr:'Prendre une photo',es:'Tomar una foto'},
 'Choose from gallery':{fa:'انتخاب از گالری',fr:'Choisir dans la galerie',es:'Elegir de la galería'},
 'Change photo':{fa:'تغییر عکس',fr:'Changer de photo',es:'Cambiar foto'},
 'Finding your vehicle…':{fa:'در حال پیدا کردن خودروی شما…',fr:'Recherche de votre véhicule…',es:'Buscando su vehículo…'},
 'Preparing your photo…':{fa:'در حال آماده‌سازی عکس…',fr:'Préparation de votre photo…',es:'Preparando su foto…'},
 'Vehicle found automatically. Drag the corners to fine-tune.':{fa:'خودرو به‌طور خودکار پیدا شد. برای تنظیم دقیق، گوشه‌ها را بکشید.',fr:'Véhicule détecté automatiquement. Faites glisser les coins pour ajuster.',es:'Vehículo detectado automáticamente. Arrastre las esquinas para ajustar.'},
 'We estimated where your vehicle is. Drag the four corners to the ends of the body.':{fa:'محل خودرو را تخمین زدیم. چهار گوشه را تا ابتدا و انتهای بدنه بکشید.',fr:'Nous avons estimé la position du véhicule. Placez les quatre coins aux extrémités de la carrosserie.',es:'Estimamos dónde está su vehículo. Arrastre las cuatro esquinas a los extremos de la carrocería.'},
 'Place the four corners on the ends of the vehicle body.':{fa:'چهار گوشه را روی ابتدا و انتهای بدنه خودرو قرار دهید.',fr:'Placez les quatre coins aux extrémités de la carrosserie.',es:'Coloque las cuatro esquinas en los extremos de la carrocería.'},
 'Automatic':{fa:'خودکار',fr:'Automatique',es:'Automático'},
 'Estimated':{fa:'تخمینی',fr:'Estimé',es:'Estimado'},
 'Manual':{fa:'دستی',fr:'Manuel',es:'Manual'},
 'Corners':{fa:'گوشه‌ها',fr:'Coins',es:'Esquinas'},
 'Paint':{fa:'افزودن ناحیه',fr:'Ajouter',es:'Añadir'},
 'Erase':{fa:'پاک کردن',fr:'Effacer',es:'Borrar'},
 'Move design':{fa:'جابجایی طرح',fr:'Déplacer le design',es:'Mover diseño'},
 'Brush size':{fa:'اندازه قلم',fr:'Taille du pinceau',es:'Tamaño del pincel'},
 'This photo shows':{fa:'این عکس نشان می‌دهد',fr:'Cette photo montre',es:'Esta foto muestra'},
 'Side':{fa:'بغل',fr:'Côté',es:'Lateral'},
 'Rear':{fa:'عقب',fr:'Arrière',es:'Trasera'},
 'Front':{fa:'جلو',fr:'Avant',es:'Frontal'},
 'Studio view':{fa:'نمای استودیو',fr:'Vue du studio',es:'Vista del estudio'},
 'Realism (shading)':{fa:'واقع‌گرایی (سایه‌روشن)',fr:'Réalisme (ombres)',es:'Realismo (sombras)'},
 'Opacity':{fa:'شفافیت',fr:'Opacité',es:'Opacidad'},
 'Print the background colour (full wrap)':{fa:'چاپ رنگ پس‌زمینه (رپ کامل)',fr:'Imprimer la couleur de fond (covering complet)',es:'Imprimir el color de fondo (rotulado completo)'},
 'Show detected area':{fa:'نمایش ناحیه تشخیص‌داده‌شده',fr:'Afficher la zone détectée',es:'Mostrar la zona detectada'},
 'Year, make and model':{fa:'سال، برند و مدل',fr:'Année, marque et modèle',es:'Año, marca y modelo'},
 'e.g. 2021 Ford Transit 148" high roof':{fa:'مثلاً Ford Transit 2021 سقف بلند',fr:'ex. Ford Transit 2021 toit haut',es:'p. ej. Ford Transit 2021 techo alto'},
 'Detect again':{fa:'تشخیص دوباره',fr:'Détecter à nouveau',es:'Detectar de nuevo'},
 'Reset corners':{fa:'بازنشانی گوشه‌ها',fr:'Réinitialiser les coins',es:'Restablecer esquinas'},
 'Design on my photo':{fa:'طراحی روی عکس من',fr:'Créer sur ma photo',es:'Diseñar sobre mi foto'},
 'The photo mock-up is approximate. Our team checks the exact measurements for your vehicle before printing.':{fa:'ماکاپ روی عکس تقریبی است. تیم ما پیش از چاپ، اندازه‌های دقیق خودروی شما را بررسی می‌کند.',fr:'La maquette sur photo est approximative. Notre équipe vérifie les mesures exactes de votre véhicule avant l’impression.',es:'La maqueta sobre la foto es aproximada. Nuestro equipo verifica las medidas exactas de su vehículo antes de imprimir.'},
 'Your photo stays on this device until you submit your design.':{fa:'عکس شما تا زمان ارسال طرح فقط روی همین دستگاه می‌ماند.',fr:'Votre photo reste sur cet appareil jusqu’à l’envoi de votre design.',es:'Su foto permanece en este dispositivo hasta que envíe su diseño.'},
 'Drag on the photo to move the selected item (or the whole design).':{fa:'برای جابجایی مورد انتخاب‌شده (یا کل طرح) روی عکس بکشید.',fr:'Faites glisser sur la photo pour déplacer l’élément sélectionné (ou tout le design).',es:'Arrastre sobre la foto para mover el elemento seleccionado (o todo el diseño).'},
 'Paint over parts of the body the wrap should cover.':{fa:'روی بخش‌هایی از بدنه که باید رپ شوند بکشید.',fr:'Peignez les parties de la carrosserie à recouvrir.',es:'Pinte las partes de la carrocería que debe cubrir el vinilo.'},
 'Erase windows, wheels, lights or trim the wrap should not cover.':{fa:'شیشه‌ها، چرخ‌ها، چراغ‌ها یا قطعاتی را که نباید رپ شوند پاک کنید.',fr:'Effacez vitres, roues, feux ou garnitures à ne pas recouvrir.',es:'Borre ventanas, ruedas, luces o molduras que no se deben cubrir.'},
 'On your vehicle photo':{fa:'روی عکس خودروی شما',fr:'Sur la photo de votre véhicule',es:'Sobre la foto de su vehículo'},
 'Edit photo':{fa:'ویرایش عکس',fr:'Modifier la photo',es:'Editar foto'},
 'Hide':{fa:'پنهان',fr:'Masquer',es:'Ocultar'},
 'Remove photo':{fa:'حذف عکس',fr:'Retirer la photo',es:'Quitar la foto'},
 'Close':{fa:'بستن',fr:'Fermer',es:'Cerrar'},
 'Zoom in':{fa:'بزرگ‌نمایی',fr:'Zoom avant',es:'Acercar'},
 'Zoom out':{fa:'کوچک‌نمایی',fr:'Zoom arrière',es:'Alejar'},
 'Fit':{fa:'اندازه کامل',fr:'Ajuster',es:'Ajustar'},
 'Corner':{fa:'گوشه',fr:'Coin',es:'Esquina'},
 'This file is not a photo we can open. Try a JPEG or PNG.':{fa:'این فایل قابل باز شدن نیست. یک فایل JPEG یا PNG امتحان کنید.',fr:'Impossible d’ouvrir ce fichier. Essayez un JPEG ou un PNG.',es:'No podemos abrir este archivo. Pruebe con un JPEG o PNG.'},
 'Attaching your vehicle photo…':{fa:'در حال پیوست عکس خودروی شما…',fr:'Ajout de la photo de votre véhicule…',es:'Adjuntando la foto de su vehículo…'},
 'Your vehicle photo could not be attached; the design is still submitted.':{fa:'عکس خودرو پیوست نشد؛ طرح شما همچنان ارسال می‌شود.',fr:'La photo du véhicule n’a pas pu être jointe ; le design est tout de même envoyé.',es:'No se pudo adjuntar la foto del vehículo; el diseño se envía igualmente.'},
 'Tap the photo preview to edit it':{fa:'برای ویرایش، روی پیش‌نمایش عکس بزنید',fr:'Touchez l’aperçu pour le modifier',es:'Toque la vista previa para editarla'},
});

let A=null,host=null,chip=null,dock=null,ed=null,poll=0,seg=null,segLoading=null,reviewObs=null;
const S={productId:'',photo:null,name:'',mask:null,mw:0,mh:0,box:null,quad:null,view:0,shading:.85,opacity:1,bg:null,vehicle:'',method:'',showMask:true,mode:'corners',brush:28,version:0,dock:true,lref:.8};
const art={sig:'',max:0,data:null,bg:[255,255,255],busy:null,want:''};
let uploaded={photoKey:'',photo:null,mockKey:'',mock:null},photoKey='';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tt=s=>esc(t(s));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ICON={camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
 image:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5.5-5.5 4 4 2.5-2.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
 corners:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l13-1 1 13-14 1z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="6" r="2.2" fill="currentColor"/><circle cx="18" cy="5" r="2.2" fill="currentColor"/><circle cx="19" cy="18" r="2.2" fill="currentColor"/><circle cx="5" cy="19" r="2.2" fill="currentColor"/></svg>',
 paint:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5-8 8-5-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6.5 12.5c-2 1-2.5 3-2.5 6.5 3.5 0 5.5-.5 6.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
 erase:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 19h11M5.5 15.5l9-9 4 4-8.5 8.5H9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
 move:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'};

/* ---------------- mount: the chip in the studio, review figure, before-submit hook ---------------- */
export function mountPhotoWrap(root,api){
 A=api;host=root;
 const pid=A.vehicle()?A.product().id:'';
 if(S.productId!==pid){Object.assign(S,{photo:null,mask:null,quad:null,box:null,autoQuad:null,method:'',vehicle:'',view:0,bg:null,dock:true,productId:pid});art.data=null;art.sig='';uploaded={photoKey:'',photo:null,mockKey:'',mock:null};if(ed){ed.remove();ed=null;document.documentElement.classList.remove('pw-open');}bump();}
 if(!A.vehicle()){chip?.remove();dock?.remove();chip=dock=null;return {beforeSubmit:async()=>{}};}
 stylesheet();
 const main=host.querySelector('.cv-main');
 if(main&&(!chip||!main.contains(chip))){chip?.remove();chip=document.createElement('button');chip.type='button';chip.className='pw-chip';chip.dataset.photoWrap='';main.append(chip);}
 if(main&&dock&&!main.contains(dock)){dock.remove();dock=null;}
 if(!host._pwClick){host._pwClick=true;host.addEventListener('click',e=>{const b=e.target.closest('[data-photo-wrap]');if(!b)return;e.preventDefault();if(S.photo&&b===chip){S.dock=!S.dock;syncDock();}else openEditor();});}
 syncChip();positionChip();
 if(!mountPhotoWrap._resize){mountPhotoWrap._resize=true;addEventListener('resize',()=>{positionChip();if(ed)fitWorld();});}
 watchReview();
 if(!S.photo)restore().then(ok=>{if(ok){syncChip();syncDock();}}).catch(()=>{});else syncDock();
 if(new URLSearchParams(location.search).get('photo')==='1'&&!S.photo&&!mountPhotoWrap._auto){mountPhotoWrap._auto=true;setTimeout(openEditor,300);}
 return {beforeSubmit};
}
function stylesheet(){if(document.querySelector('link[data-photo-wrap-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('./photo-wrap.css',import.meta.url).href;l.dataset.photoWrapCss='';document.head.append(l);}
function syncChip(){if(!chip)return;chip.innerHTML=S.photo?`${ICON.image}<span>${tt('My vehicle photo')}</span>`:`${ICON.camera}<span>${tt('Use my vehicle photo')}</span>`;chip.classList.toggle('has-photo',!!S.photo);chip.setAttribute('aria-pressed',S.photo?String(!!S.dock):'false');}
function positionChip(){const main=host?.querySelector('.cv-main');if(!main||!chip)return;const foot=main.querySelector('.cv-footer'),ctx=main.querySelector('[data-context]'),mobile=host.querySelector('.studio-cv')?.classList.contains('cv-mobile');
 const fh=foot?foot.offsetHeight:0,ch=ctx&&getComputedStyle(ctx).display!=='none'?ctx.offsetHeight:0;
 chip.style.bottom=(fh+12)+'px';chip.style.top='';
 if(dock){if(mobile){dock.style.top=(ch+8)+'px';dock.style.bottom='';}else{dock.style.bottom=(fh+64)+'px';dock.style.top='';}}}

/* ---------------- photo input ---------------- */
async function readPhoto(file){
 const buf=await file.arrayBuffer(),ori=exifOrientation(buf),raw=jpegSize(buf);let src,w,h;
 try{src=await createImageBitmap(file,{imageOrientation:'from-image'});w=src.width;h=src.height;}
 catch{src=await new Promise((res,rej)=>{const i=new Image();const u=URL.createObjectURL(file);i.onload=()=>{res(i);setTimeout(()=>URL.revokeObjectURL(u),1000);};i.onerror=()=>rej(Error(t('This file is not a photo we can open. Try a JPEG or PNG.')));i.src=u;});w=src.naturalWidth;h=src.naturalHeight;}
 if(!w||!h)throw Error(t('This file is not a photo we can open. Try a JPEG or PNG.'));
 // Browsers apply EXIF orientation when decoding (createImageBitmap 'from-image', or the CSS image-orientation default).
 // If an older browser did not (decoded size equals the stored, unrotated size for a 90° orientation), rotate it ourselves.
 let manual=0;if(ori>1&&raw&&raw.w!==raw.h&&ori>=5&&w===raw.w&&h===raw.h)manual=ori;
 if(ori>1&&ori<5&&!(globalThis.CSS?.supports?.('image-orientation','from-image')))manual=ori;
 const rw=manual>=5?h:w,rh=manual>=5?w:h,k=Math.min(1,MAX_PHOTO/Math.max(rw,rh));
 const c=document.createElement('canvas');c.width=Math.round(rw*k);c.height=Math.round(rh*k);const g=c.getContext('2d');
 if(manual){const W=c.width,H=c.height;g.setTransform(...[[1,0,0,1,0,0],[1,0,0,1,0,0],[-1,0,0,1,W,0],[-1,0,0,-1,W,H],[1,0,0,-1,0,H],[0,1,1,0,0,0],[0,1,-1,0,W,0],[0,-1,-1,0,W,H],[0,-1,1,0,0,H]][manual]);g.drawImage(src,0,0,manual>=5?H:W,manual>=5?W:H);g.setTransform(1,0,0,1,0,0);}
 else g.drawImage(src,0,0,c.width,c.height);
 src.close?.();return c;
}
function exifOrientation(buf){try{const v=new DataView(buf);if(v.getUint16(0)!==0xFFD8)return 1;let o=2;while(o+4<v.byteLength){const m=v.getUint16(o);if(m===0xFFE1&&v.getUint32(o+4)===0x45786966){const ts=o+10,le=v.getUint16(ts)===0x4949,n=v.getUint16(ts+v.getUint32(ts+4,le),le),d=ts+v.getUint32(ts+4,le)+2;for(let i=0;i<n;i++){const e=d+i*12;if(v.getUint16(e,le)===0x0112)return v.getUint16(e+8,le)||1;}return 1;}if((m&0xFF00)!==0xFF00)return 1;o+=2+v.getUint16(o+2);}}catch{}return 1;}
function jpegSize(buf){try{const v=new DataView(buf);if(v.getUint16(0)!==0xFFD8)return null;let o=2;while(o+9<v.byteLength){const m=v.getUint16(o);if(m>=0xFFC0&&m<=0xFFCF&&![0xFFC4,0xFFC8,0xFFCC].includes(m))return {h:v.getUint16(o+5),w:v.getUint16(o+7)};o+=2+v.getUint16(o+2);}}catch{}return null;}

async function loadFile(file){
 if(!file)return;busy(t('Preparing your photo…'));ed?.querySelector('[data-pw-close]')?.focus({preventScroll:true});
 try{const c=await readPhoto(file);S.photo=c;S.name=file.name||'vehicle-photo.jpg';photoKey=crypto.randomUUID();S.mask=null;S.quad=null;S.box=null;S.autoQuad=null;bump();renderEditor();await detect();persist();}
 catch(e){busy('');note(e.message||t('This file is not a photo we can open. Try a JPEG or PNG.'),true);}
}

/* ---------------- detection ---------------- */
async function detect(){
 if(!S.photo)return;busy(t('Finding your vehicle…'));const token=(detect.n=(detect.n||0)+1);
 const W=S.photo.width,H=S.photo.height,k=Math.min(1,MASK_MAX/Math.max(W,H)),mw=Math.max(8,Math.round(W*k)),mh=Math.max(8,Math.round(H*k));
 const small=document.createElement('canvas');small.width=mw;small.height=mh;small.getContext('2d').drawImage(S.photo,0,0,mw,mh);
 const px=small.getContext('2d',{willReadFrequently:true}).getImageData(0,0,mw,mh).data;
 let cand=null,method='cv',res=null;
 // first choice: the wrap visualizer's segmentation model (finds the body, wheels, plates and windows); MediaPipe and classic CV are fallbacks
 try{res=await Promise.race([samBody(mw,mh),new Promise(r=>setTimeout(()=>r(null),SAM_TIMEOUT))]);if(res)method='ai';}catch(e){console.warn('Vehicle AI unavailable',e);res=null;}
 if(token!==detect.n)return;
 if(!res){busy(t('Finding your vehicle…'));
 try{cand=await Promise.race([aiMask(small,mw,mh),new Promise(r=>setTimeout(()=>r(null),AI_TIMEOUT))]);if(cand)method='ai';}catch{cand=null;}
 if(token!==detect.n)return;
 if(!cand)cand=salientObject(px,mw,mh);
 res=cand?vehicleBody(px,mw,mh,cand):null;}
 if(!res){method='manual';res={mask:new Uint8Array(mw*mh).fill(255),box:null};}
 S.mask=res.mask;S.mw=mw;S.mh=mh;S.method=method;
 S.box=res.box?[res.box[0]/k,res.box[1]/k,res.box[2]/k,res.box[3]/k]:null;S.autoQuad=res.quad?res.quad.map(([x,y])=>[x/k,y/k]):null;
 S.quad=defaultQuad();computeRef();bump();busy('');
 note(method==='ai'?t('Vehicle found automatically. Drag the corners to fine-tune.'):method==='cv'?t('We estimated where your vehicle is. Drag the four corners to the ends of the body.'):t('Place the four corners on the ends of the vehicle body.'));
 renderEditor();
}
// The visualizer's model (SlimSAM, loaded once and cached by the browser): painted body at mask size, its box and side corners.
async function samBody(mw,mh){
 const m=await import('/visualizer/sam-detect.mjs');
 const r=await m.detectVehicle(S.photo,{onProgress:(stage,pct)=>busy(stage==='load'?t('Loading the AI model…')+(pct!=null&&pct<100?' '+pct+'%':''):t('Finding your vehicle…'))});
 if(!r)return null;
 let mask=new Uint8Array(mw*mh),n=0;
 for(let y=0;y<mh;y++){const sy=Math.min(r.h-1,Math.floor((y+.5)*r.h/mh));for(let x=0;x<mw;x++){const sx=Math.min(r.w-1,Math.floor((x+.5)*r.w/mw));if(r.paint[sy*r.w+sx]){mask[y*mw+x]=255;n++;}}}
 if(n<mw*mh*.01)return null;
 mask=dilate(erode(mask,mw,mh,1),mw,mh,1);
 let bx0=mw,by0=mh,bx1=-1,by1=-1;for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)if(mask[y*mw+x]){if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;}
 if(bx1<0)return null;
 return {mask,box:[bx0,by0,bx1+1,by1+1],quad:hullQuad(mask,mw,mh,bx0,bx1+1)};
}
// Browser-side segmentation (MediaPipe Tasks Vision + DeepLab v3, PASCAL classes). Returns a 0/255 mask at mask size, or null.
async function aiMask(canvas,mw,mh){
 if(!seg){segLoading??=(async()=>{const vision=await import(/* @vite-ignore */MP_BASE+'/vision_bundle.mjs');const files=await vision.FilesetResolver.forVisionTasks(MP_BASE+'/wasm');return vision.ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:MP_MODEL,delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false});})().catch(e=>{segLoading=null;throw e;});seg=await segLoading;}
 const r=seg.segment(canvas),cm=r?.categoryMask;if(!cm){r?.close?.();return null;}
 const a=cm.getAsUint8Array(),cw=cm.width,ch=cm.height,out=new Uint8Array(mw*mh);let n=0;
 for(let y=0;y<mh;y++){const sy=Math.min(ch-1,Math.floor(y*ch/mh));for(let x=0;x<mw;x++){const v=a[sy*cw+Math.min(cw-1,Math.floor(x*cw/mw))];if(PASCAL_VEHICLES.includes(v)){out[y*mw+x]=255;n++;}}}
 r.close?.();if(n<mw*mh*.02)return null;
 return largest(out,mw,mh);
}
// Classic CV fallback: background colours sampled from the photo border + edge density -> Otsu threshold ->
// morphological close -> the largest, most central blob with its holes filled.
function salientObject(px,w,h){
 const n=w*h,L=new Float32Array(n),bin=new Uint16Array(n);
 for(let i=0,j=0;i<n;i++,j+=4){L[i]=(.299*px[j]+.587*px[j+1]+.114*px[j+2])/255;bin[i]=(px[j]>>5)<<6|(px[j+1]>>5)<<3|(px[j+2]>>5);}
 const hist=new Float32Array(512);let cnt=0;const add=i=>{hist[bin[i]]++;cnt++;};
 const bt=Math.round(h*.1),bb=Math.round(h*.04),bs=Math.round(w*.06);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(y<bt||y>=h-bb||x<bs||x>=w-bs)add(y*w+x);
 // spread each bin to its neighbours a little so near-identical colours count as background too
 const sm=new Float32Array(512);for(let b=0;b<512;b++){const r=b>>6,g=b>>3&7,bl=b&7;let s=0;for(let dr=-1;dr<=1;dr++)for(let dg=-1;dg<=1;dg++)for(let db=-1;db<=1;db++){const R=r+dr,G=g+dg,B=bl+db;if(R<0||G<0||B<0||R>7||G>7||B>7)continue;s+=hist[R<<6|G<<3|B]*(dr||dg||db?.25:1);}sm[b]=s;}
 const ref=cnt/60;const edge=new Float32Array(n);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,gx=L[i+1-w]+2*L[i+1]+L[i+1+w]-L[i-1-w]-2*L[i-1]-L[i-1+w],gy=L[i+w-1]+2*L[i+w]+L[i+w+1]-L[i-w-1]-2*L[i-w]-L[i-w+1];edge[i]=Math.min(1,Math.hypot(gx,gy)*2);}
 const ed=boxBlur(edge,w,h,Math.max(2,Math.round(w/80)));
 const s=new Float32Array(n);for(let i=0;i<n;i++)s[i]=(1-Math.min(1,sm[bin[i]]/ref))*.75+Math.min(1,ed[i]*3)*.25;
 const th=otsu(s);let m=new Uint8Array(n);for(let i=0;i<n;i++)m[i]=s[i]>th?255:0;
 const r=Math.max(1,Math.round(w/120));m=erode(dilate(m,w,h,r),w,h,r);
 const comp=largest(m,w,h,true);if(!comp)return null;
 let a=0;for(let i=0;i<n;i++)if(comp[i])a++;
 if(a<n*.03||a>n*.92)return null;
 return fillHoles(comp,w,h);
}
// Edge-bounded flood fill: the background is everything reachable from the photo border without crossing a colour edge.
// Works on plain studio / showroom backdrops and outdoor shots alike (even a white car on a white wall), then trims the
// floor / turntable below the tyres. Tries tighter edge thresholds until the object is a plausible vehicle.
function floodObject(px,w,h){const n=w*h,ch=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];
 for(let i=0,j=0;i<n;i++,j+=4){ch[0][i]=px[j]/255;ch[1][i]=px[j+1]/255;ch[2][i]=px[j+2]/255;}
 const b=ch.map(c=>boxBlur(c,w,h,1)),g=new Float32Array(n);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;let m=0;for(const c of b){const gx=c[i+1-w]+2*c[i+1]+c[i+1+w]-c[i-1-w]-2*c[i-1]-c[i-1+w],gy=c[i+w-1]+2*c[i+w]+c[i+w+1]-c[i-w-1]-2*c[i-w]-c[i-w+1],v=gx*gx+gy*gy;if(v>m)m=v;}g[i]=Math.sqrt(m);}
 const sorted=Float32Array.from(g.filter((_,i)=>i%7===0)).sort(),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
 const L=i=>(.299*px[i*4]+.587*px[i*4+1]+.114*px[i*4+2])/255;
 for(const [p,r,fl] of [[.6,2,.06],[.7,2,.09],[.78,2,.12]]){const th=Math.max(pct(p),fl);let e=new Uint8Array(n);for(let i=0;i<n;i++)if(g[i]>th)e[i]=255;e=dilate(e,w,h,r);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<4||y<4||x>=w-4||y>=h-4)e[y*w+x]=0; // the blur darkens the frame edge: never an edge there
  
  const bg=new Uint8Array(n),q=new Int32Array(n);let hd=0,tl=0;const push=i=>{if(!e[i]&&!bg[i]){bg[i]=1;q[tl++]=i;}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(hd<tl){const i=q[hd++],x=i%w,y=(i-x)/w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}
  let o=new Uint8Array(n);for(let i=0;i<n;i++)if(!bg[i])o[i]=255;o=erode(o,w,h,r);
  let comp=largest(o,w,h,true);if(!comp)continue;comp=fillHoles(comp,w,h);
  // trim the floor / turntable: nothing below the bottom of the tyres (lowest dark band inside the object)
  let x0=w,x1=-1,y0=h,y1=-1;for(let i=0;i<n;i++)if(comp[i]){const x=i%w,y=(i-x)/w;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  let tyre=-1;for(let y=y1;y>y0+(y1-y0)*.45&&tyre<0;y--){let d=0,c=0;for(let x=x0;x<=x1;x++){const i=y*w+x;if(!comp[i])continue;c++;if(L(i)<.28)d++;}if(c&&d>=Math.max(4,(x1-x0)*.03))tyre=y;}
  if(tyre>0)for(let y=tyre+Math.max(1,Math.round(h/200));y<h;y++)for(let x=0;x<w;x++)comp[y*w+x]=0;
  let a=0,edgeT=0;for(let i=0;i<n;i++)if(comp[i])a++;for(let x=0;x<w;x++){if(comp[x])edgeT++;if(comp[(h-1)*w+x])edgeT++;}for(let y=0;y<h;y++){if(comp[y*w])edgeT++;if(comp[y*w+w-1])edgeT++;}
  if(a>n*.06&&a<n*.8&&edgeT<(w+h)*.35)return comp;}
 return null;}
// From a vehicle candidate: keep the body (dominant paint colour region, holes filled) and drop dark windows/wheels.
function vehicleBody(px,w,h,cand){
 const n=w*h;let x0=w,y0=h,x1=-1,y1=-1,area=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(cand[y*w+x]){area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 if(!area)return null;
 // dominant colour (16 levels per channel) in the middle band of the candidate
 const hist=new Map(),cy0=y0+(y1-y0)*.2,cy1=y0+(y1-y0)*.75;
 for(let y=Math.round(cy0);y<=cy1;y++)for(let x=x0;x<=x1;x++){const i=y*w+x;if(!cand[i])continue;const j=i*4,k=(px[j]>>4)<<8|(px[j+1]>>4)<<4|(px[j+2]>>4);hist.set(k,(hist.get(k)||0)+1);}
 let best=0,bk=0;for(const [k,v] of hist){let s=v;for(const d of [1,16,256])s+=(hist.get(k+d)||0)*.5+(hist.get(k-d)||0)*.5;if(s>best){best=s;bk=k;}}
 const dr=((bk>>8)<<4)+8,dg=((bk>>4&15)<<4)+8,db=((bk&15)<<4)+8;
 // the candidate often misses shaded lower panels (they look like the road/sidewalk): also test the colour rule just below it, column by column
 const colBottom=new Int32Array(w).fill(-1);for(let i=0;i<n;i++)if(cand[i]){const xx=i%w,yy=(i-xx)/w;if(yy>colBottom[xx])colBottom[xx]=yy;}const reach=Math.round((y1-y0)*.3);
 let body=new Uint8Array(n);for(let i=0;i<n;i++){const xx=i%w,yy=(i-xx)/w;if(!cand[i]&&!(colBottom[xx]>=0&&yy>colBottom[xx]&&yy<=colBottom[xx]+reach))continue;const j=i*4,d=Math.abs(px[j]-dr)+Math.abs(px[j+1]-dg)+Math.abs(px[j+2]-db),l=(px[j]+px[j+1]+px[j+2])/3,dl=(dr+dg+db)/3;
  // tolerate shading: same hue direction, brightness within a wide band
  if(d<70||(Math.abs((px[j]-l)-(dr-dl))+Math.abs((px[j+1]-l)-(dg-dl))+Math.abs((px[j+2]-l)-(db-dl))<26&&l>dl*.55))body[i]=255;}
 const r=Math.max(1,Math.round(w/160));body=erode(dilate(body,w,h,r*2),w,h,r*2);
 let lg=largest(body,w,h);let ba=0;if(lg)for(let i=0;i<n;i++)if(lg[i])ba++;
 let mask=ba>=area*.25?fillHoles(lg,w,h):cand.slice();
 // Dark areas inside the region (glass, tyres, grilles) are not wrapped; the threshold follows the paint brightness so dark cars keep their panels.
 // Saturated paint (red, blue…) also drops grey glass that is darker than the paint.
 const Lb=(dr*.299+dg*.587+db*.114)/255,dark=Math.min(.3,Lb*.5),sat=(r,g,b)=>{const mx=Math.max(r,g,b);return mx?(mx-Math.min(r,g,b))/mx:0;},ps=sat(dr,dg,db);
 for(let i=0;i<n;i++)if(mask[i]){const j=i*4,l=(.299*px[j]+.587*px[j+1]+.114*px[j+2])/255;if(l<dark||ps>.3&&l<Lb*.8&&sat(px[j],px[j+1],px[j+2])<ps*.45)mask[i]=0;}
 mask=dilate(erode(mask,w,h,1),w,h,1);
 let bx0=w,by0=h,bx1=-1,by1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;}
 if(bx1<0)return null;
 return {mask,box:[bx0,by0,bx1+1,by1+1],quad:hullQuad(mask,w,h,bx0,bx1+1)};
}
// Perspective-aware starting quad: the roof line (longest edge of the upper hull of the mask) and the rocker line (longest
// edge of the lower hull), cut at the front and back of the body. Null when the lines look implausible.
function hullQuad(m,w,h,x0,x1){const top=[],bot=[];for(let x=x0;x<x1;x++){let a=-1,b=-1;for(let y=0;y<h;y++)if(m[y*w+x]){if(a<0)a=y;b=y;}if(a>=0){top.push([x,a]);bot.push([x,b+1]);}}
 if(top.length<8)return null;
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const hull=(pts,upper)=>{const out=[];for(const p of pts){while(out.length>1&&(upper?cross(out[out.length-2],out[out.length-1],p)<=0:cross(out[out.length-2],out[out.length-1],p)>=0))out.pop();out.push(p);}return out;};
 const longest=hp=>{let best=null,bl=0;for(let i=1;i<hp.length;i++){const l=hp[i][0]-hp[i-1][0];if(l>bl){bl=l;best=[hp[i-1],hp[i]];}}return best&&bl>=(x1-x0)*.3?best:null;};
 const tl=longest(hull(top,true)),bl=longest(hull(bot,false));if(!tl||!bl)return null;
 const at=([[ax,ay],[bx,by]],x)=>ay+(by-ay)*(x-ax)/((bx-ax)||1),slope=([[ax,ay],[bx,by]])=>(by-ay)/((bx-ax)||1);
 if(Math.abs(slope(tl))>.25||Math.abs(slope(bl))>.25)return null;
 const q=[[x0,at(tl,x0)],[x1,at(tl,x1)],[x1,at(bl,x1)],[x0,at(bl,x0)]];
 if(q[3][1]-q[0][1]<4||q[2][1]-q[1][1]<4)return null;return q;}
function boxBlur(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length);for(let y=0;y<h;y++){let s=0;for(let x=-r;x<w;x++){if(x+r<w)s+=a[y*w+x+r];if(x-r-1>=0)s-=a[y*w+x-r-1];if(x>=0)t[y*w+x]=s/(2*r+1);}}for(let x=0;x<w;x++){let s=0;for(let y=-r;y<h;y++){if(y+r<h)s+=t[(y+r)*w+x];if(y-r-1>=0)s-=t[(y-r-1)*w+x];if(y>=0)o[y*w+x]=s/(2*r+1);}}return o;}
function otsu(s){const hst=new Float64Array(256);for(const v of s)hst[Math.min(255,v*255|0)]++;const n=s.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hst[i];let sb=0,wb=0,max=0,th=128;for(let i=0;i<256;i++){wb+=hst[i];if(!wb)continue;const wf=n-wb;if(!wf)break;sb+=i*hst[i];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)**2;if(v>max){max=v;th=i;}}return th/255;}
function morph(m,w,h,r,isMax){const t=new Uint8Array(m.length),o=new Uint8Array(m.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=isMax?0:255;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++){const q=m[y*w+k];if(isMax?q>v:q<v)v=q;}t[y*w+x]=v;}for(let x=0;x<w;x++)for(let y=0;y<h;y++){let v=isMax?0:255;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++){const q=t[k*w+x];if(isMax?q>v:q<v)v=q;}o[y*w+x]=v;}return o;}
const dilate=(m,w,h,r)=>morph(m,w,h,r,true),erode=(m,w,h,r)=>morph(m,w,h,r,false);
function largest(m,w,h,central=false){const lab=new Int32Array(m.length).fill(-1),q=new Int32Array(m.length);let best=null,bs=0,id=0;for(let s=0;s<m.length;s++){if(!m[s]||lab[s]>=0)continue;let hd=0,tl=0,cx=0,cy=0;q[tl++]=s;lab[s]=id;while(hd<tl){const i=q[hd++],x=i%w,y=(i-x)/w;cx+=x;cy+=y;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&m[j]&&lab[j]<0){lab[j]=id;q[tl++]=j;}}
 let score=tl;if(central){const dx=cx/tl/w-.5,dy=cy/tl/h-.5;score*=1-Math.min(.8,Math.hypot(dx,dy)*1.2);}if(score>bs){bs=score;best=id;}id++;}
 if(best===null)return null;const o=new Uint8Array(m.length);for(let i=0;i<m.length;i++)if(lab[i]===best)o[i]=255;return o;}
function fillHoles(m,w,h){const seen=new Uint8Array(m.length),q=new Int32Array(m.length);let hd=0,tl=0;const push=i=>{if(!m[i]&&!seen[i]){seen[i]=1;q[tl++]=i;}};for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}while(hd<tl){const i=q[hd++],x=i%w,y=(i-x)/w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}const o=new Uint8Array(m.length);for(let i=0;i<m.length;i++)o[i]=m[i]||!seen[i]?255:0;return o;}

/* ---------------- geometry ---------------- */
function viewAspect(i=S.view){const v=A.views()[i];if(v?.width)return v.width/v.height;try{const d=A.dims(i);return d.width/d.height;}catch{return 2.5;}}
function defaultQuad(){const W=S.photo.width,H=S.photo.height;if(S.autoQuad&&/side/.test(A.views()[S.view]?.key||''))return S.autoQuad.map(p=>p.slice());let [x0,y0,x1,y1]=S.box||[0,0,0,0];
 if(!S.box){const a=viewAspect();let w=W*.8,h=w/a;if(h>H*.6){h=H*.6;w=h*a;}x0=(W-w)/2;y0=(H-h)/2;x1=x0+w;y1=y0+h;}
 return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];}
// Homography that maps the unit square (u,v) to the quad TL,TR,BR,BL.
function squareToQuad(q){const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;let g=0,h=0;if(Math.abs(sx)>1e-9||Math.abs(sy)>1e-9){const den=dx1*dy2-dx2*dy1||1e-9;g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h,1];}
function inv3(m){const [a,b,c,d,e,f,g,h,i]=m,A_=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A_+b*B+c*C||1e-12;return [A_/det,-(b*i-c*h)/det,(b*f-c*e)/det,B/det,(a*i-c*g)/det,-(a*f-c*d)/det,C/det,-(a*h-b*g)/det,(a*e-b*d)/det];}
const toUV=(Hi,x,y)=>{const w=Hi[6]*x+Hi[7]*y+Hi[8];return [(Hi[0]*x+Hi[1]*y+Hi[2])/w,(Hi[3]*x+Hi[4]*y+Hi[5])/w];};
function convex(q){let sgn=0;for(let i=0;i<4;i++){const [ax,ay]=q[i],[bx,by]=q[(i+1)%4],[cx,cy]=q[(i+2)%4],z=(bx-ax)*(cy-by)-(by-ay)*(cx-bx);if(Math.abs(z)<1e-6)return false;const s=Math.sign(z);if(sgn&&s!==sgn)return false;sgn=s;}return true;}
// Reference brightness of the panel (75th percentile inside mask and quad) for the shading pass.
function computeRef(){if(!S.photo||!S.mask)return;const W=S.photo.width,k=S.mw/W,c=document.createElement('canvas');c.width=S.mw;c.height=S.mh;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(S.photo,0,0,S.mw,S.mh);const px=g.getImageData(0,0,S.mw,S.mh).data,Hi=inv3(squareToQuad(S.quad.map(([x,y])=>[x*k,y*k]))),hst=new Uint32Array(256);let n=0;
 for(let y=0;y<S.mh;y+=2)for(let x=0;x<S.mw;x+=2){const i=y*S.mw+x;if(S.mask[i]<128)continue;const [u,v]=toUV(Hi,x+.5,y+.5);if(u<0||u>1||v<0||v>1)continue;const j=i*4;hst[Math.round(.299*px[j]+.587*px[j+1]+.114*px[j+2])]++;n++;}
 if(!n){S.lref=.8;return;}let acc=0;for(let b=0;b<256;b++){acc+=hst[b];if(acc>=n*.75){S.lref=clamp(b/255,.08,.98);return;}}}

/* ---------------- artwork + projection ---------------- */
function artSig(){const d=A.design(),s=d.sides[S.view];return S.view+'|'+(s?JSON.stringify(s):'')+'|'+d.options.vehicleColour;}
async function ensureArt(max){const sig=artSig();if(art.data&&art.sig===sig&&art.max>=max)return true;if(art.busy){art.want=sig;await art.busy;return ensureArt(max);}
 art.busy=(async()=>{try{const c=await A.art(S.view,max);const g=c.getContext('2d',{willReadFrequently:true});art.data=g.getImageData(0,0,c.width,c.height);art.sig=sig;art.max=max;const b=A.design().sides[S.view]?.background||'#ffffff';art.bg=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));}catch(e){console.warn('photo-wrap art',e);}finally{art.busy=null;}})();
 await art.busy;return !!art.data;}
function printBg(){if(S.bg!==null)return S.bg;const b=(A.design().sides[S.view]?.background||'#ffffff').toLowerCase();return b!==paintHex(A.design().options)&&!['#ffffff','#1e2023'].includes(b);}
// Draw the photo with the artwork projected into the quad, clipped by the mask, keeping the car's shading.
// Edge-aware mask at the output size: the detection mask (≤640 px) is upsampled and refined with a guided filter that follows
// the photo's own edges, so the wrap stops exactly at panel gaps, glass and wheel arches instead of blocky, blurred borders.
let refined={key:'',data:null,mask:null};
function refinedMask(g,W2,H2,full){const key=W2+'x'+H2+':'+(S.maskVer||0)+':'+S.mw;if(refined.key===key&&refined.mask===S.mask)return refined.data;
 const n=W2*H2,I=new Float32Array(n),P=new Float32Array(n),px=g.getImageData(0,0,W2,H2).data,M=S.mask,mw=S.mw,mh=S.mh,kx=mw/W2,ky=mh/H2;
 for(let y=0,i=0;y<H2;y++){const my=Math.max(0,Math.min(mh-1.001,(y+.5)*ky-.5)),y0=my|0,fy=my-y0;for(let x=0;x<W2;x++,i++){const j=i*4;I[i]=(.299*px[j]+.587*px[j+1]+.114*px[j+2])/255;const mx=Math.max(0,Math.min(mw-1.001,(x+.5)*kx-.5)),x0=mx|0,fx=mx-x0,a=y0*mw+x0;P[i]=((M[a]*(1-fx)+M[a+1]*fx)*(1-fy)+(M[a+mw]*(1-fx)+M[a+mw+1]*fx)*fy)/255;}}
 const r=Math.max(2,Math.round(Math.max(W2,H2)/(full?320:260))),eps=.0025,II=new Float32Array(n),IP=new Float32Array(n);for(let i=0;i<n;i++){II[i]=I[i]*I[i];IP[i]=I[i]*P[i];}
 const mI=boxBlur(I,W2,H2,r),mP=boxBlur(P,W2,H2,r),cI=boxBlur(II,W2,H2,r),cIP=boxBlur(IP,W2,H2,r),A=new Float32Array(n),B=new Float32Array(n);
 for(let i=0;i<n;i++){const v=cI[i]-mI[i]*mI[i],cv=cIP[i]-mI[i]*mP[i];A[i]=cv/(v+eps);B[i]=mP[i]-A[i]*mI[i];}
 const mA=boxBlur(A,W2,H2,r),mB=boxBlur(B,W2,H2,r),out=new Float32Array(n);
 for(let i=0;i<n;i++){let q=mA[i]*I[i]+mB[i];q=(q-.3)/.4;out[i]=q<0?0:q>1?1:q*q*(3-2*q);if(P[i]<.02)out[i]=0;}
 refined={key,data:out,mask:S.mask};return out;}
function project(dst,full=false){
 const W=S.photo.width,H=S.photo.height,k=dst.width/W,g=dst.getContext('2d',{willReadFrequently:true});
 g.imageSmoothingQuality='high';g.drawImage(S.photo,0,0,dst.width,dst.height);
 if(!art.data||!S.quad||!S.mask||!convex(S.quad))return;
 const q=S.quad.map(([x,y])=>[x*k,y*k]),Hi=inv3(squareToQuad(q));
 const bx=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),by=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),ex=Math.min(dst.width,Math.ceil(Math.max(...q.map(p=>p[0])))),ey=Math.min(dst.height,Math.ceil(Math.max(...q.map(p=>p[1]))));
 const bw=ex-bx,bh=ey-by;if(bw<1||bh<1)return;
 const RM=refinedMask(g,dst.width,dst.height,full),DW=dst.width;const img=g.getImageData(bx,by,bw,bh),d=img.data,ad=art.data.data,aw=art.data.width,ah=art.data.height,M=S.mask,mw=S.mw,mh=S.mh,mk=mw/(W*k);
 const key=!printBg(),[kr,kg,kb]=art.bg,sh=S.shading,op=S.opacity,lref=S.lref,hiDen=1/Math.max(.05,1-lref);
 for(let y=0;y<bh;y++){const Y=y+by+.5;for(let x=0;x<bw;x++){const X=x+bx+.5,w=Hi[6]*X+Hi[7]*Y+Hi[8],u=(Hi[0]*X+Hi[1]*Y+Hi[2])/w,v=(Hi[3]*X+Hi[4]*Y+Hi[5])/w;if(u<0||u>1||v<0||v>1)continue;
  // mask (bilinear)
  const m=RM[(y+by)*DW+x+bx];if(m<=.01)continue;
  // artwork sample (bilinear on the full-quality export, nearest for the live preview)
  let r,gg,b,a;const ax=u*aw-.5,ay=v*ah-.5;
  if(full){const x0=clamp(Math.floor(ax),0,aw-1),y0=clamp(Math.floor(ay),0,ah-1),x1=Math.min(aw-1,x0+1),y1=Math.min(ah-1,y0+1),gx=clamp(ax-x0,0,1),gy=clamp(ay-y0,0,1),i00=(y0*aw+x0)*4,i10=(y0*aw+x1)*4,i01=(y1*aw+x0)*4,i11=(y1*aw+x1)*4,w00=(1-gx)*(1-gy),w10=gx*(1-gy),w01=(1-gx)*gy,w11=gx*gy;
   r=ad[i00]*w00+ad[i10]*w10+ad[i01]*w01+ad[i11]*w11;gg=ad[i00+1]*w00+ad[i10+1]*w10+ad[i01+1]*w01+ad[i11+1]*w11;b=ad[i00+2]*w00+ad[i10+2]*w10+ad[i01+2]*w01+ad[i11+2]*w11;a=(ad[i00+3]*w00+ad[i10+3]*w10+ad[i01+3]*w01+ad[i11+3]*w11)/255;}
  else{const i=(clamp(Math.round(ay),0,ah-1)*aw+clamp(Math.round(ax),0,aw-1))*4;r=ad[i];gg=ad[i+1];b=ad[i+2];a=ad[i+3]/255;}
  if(key){const dist=Math.abs(r-kr)+Math.abs(gg-kg)+Math.abs(b-kb);a*=clamp((dist-10)/40,0,1);}
  const al=a*m*op;if(al<=.004)continue;
  const j=(y*bw+x)*4,pr=d[j],pg=d[j+1],pb=d[j+2],L=(.299*pr+.587*pg+.114*pb)/255;
  // shading: multiply by the panel's relative brightness (shadows, panel lines), then screen back its highlights
  const mul=1+sh*(Math.min(L/lref,1.04)-1),hi=sh*clamp((L-lref)*hiDen,0,1)*.85;
  let cr=r*mul,cg=gg*mul,cb=b*mul;cr+=(255-cr)*hi;cg+=(255-cg)*hi;cb+=(255-cb)*hi;
  d[j]=pr+(cr-pr)*al;d[j+1]=pg+(cg-pg)*al;d[j+2]=pb+(cb-pb)*al;}}
 g.putImageData(img,bx,by);
}
export async function photoMockup(maxSide=MAX_PHOTO){if(!S.photo)return null;await ensureArt(2000);const W=S.photo.width,H=S.photo.height,k=Math.min(1,maxSide/Math.max(W,H)),c=document.createElement('canvas');c.width=Math.round(W*k);c.height=Math.round(H*k);project(c,true);return c;}

/* ---------------- live preview loop ---------------- */
let lastSig='',lastVer=-1,renderQueued=false;
function bump(){S.version++;}
function tick(){if(!S.photo||!A)return;const visible=(ed&&!ed.hidden)||(dock&&!dock.hidden);if(!visible)return;const sig=artSig();if(sig!==lastSig||S.version!==lastVer)requestRender();}
function startPoll(){if(!poll)poll=setInterval(tick,350);}
function requestRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(async()=>{renderQueued=false;if(!S.photo)return;const sig=artSig(),ver=S.version;await ensureArt(1200);lastSig=sig;lastVer=ver;
 if(ed&&!ed.hidden){const c=ed.querySelector('[data-pw-canvas]');project(c,false);drawTint();placeHandles();}
 if(dock&&!dock.hidden){const c=dock.querySelector('canvas');project(c,false);}});}

/* ---------------- editor UI ---------------- */
function openEditor(){
 stylesheet();startPoll();
 if(!ed){ed=document.createElement('div');ed.className='pw-editor';ed.setAttribute('role','dialog');ed.setAttribute('aria-modal','true');ed.setAttribute('aria-label',t('Your vehicle photo'));document.body.append(ed);buildEditor();}
 ed.dir=document.documentElement.dir||'ltr';ed.lang=language();ed.hidden=false;document.documentElement.classList.add('pw-open');
 if(S.photo&&A.side()!==S.view&&S.view<A.views().length)A.selectSide(S.view);
 renderEditor();fitWorld();requestRender();
 setTimeout(()=>ed.querySelector(S.photo?'[data-pw-done]':'[data-pw-take]')?.focus({preventScroll:true}),30);
}
function closeEditor(){if(!ed)return;ed.hidden=true;document.documentElement.classList.remove('pw-open');if(S.photo){S.dock=true;syncChip();syncDock();}chip?.focus({preventScroll:true});}
function buildEditor(){
 const views=A.views(),models=A.product().vehicleModels||[];
 ed.innerHTML=`<div class="pw-panel">
 <header class="pw-head"><div><b>${tt('Your vehicle photo')}</b> <span class="pw-badge" data-pw-method hidden></span></div><button type="button" class="pw-icon-btn" data-pw-close aria-label="${tt('Close')}">✕</button></header>
 <div class="pw-body">
  <div class="pw-stage" data-pw-stage>
   <div class="pw-world" data-pw-world><canvas data-pw-canvas></canvas><canvas class="pw-tint" data-pw-tint></canvas><svg class="pw-quad" data-pw-quad preserveAspectRatio="none"><polygon vector-effect="non-scaling-stroke"/><polyline class="pw-grid" vector-effect="non-scaling-stroke"/></svg></div>
   <div class="pw-handles" data-pw-handles>${[0,1,2,3].map(i=>`<button type="button" class="pw-h" data-h="${i}" aria-label="${tt('Corner')} ${i+1}"></button>`).join('')}</div>
   <div class="pw-cursor" data-pw-cursor hidden></div>
   <div class="pw-empty" data-pw-empty>${ICON.camera}<h3>${tt('Design on a photo of your own vehicle')}</h3><p>${tt('Stand back so the whole side is in the frame, hold the phone level and shoot straight on in daylight.')}</p><div class="pw-row"><button type="button" class="pw-btn primary" data-pw-take>${ICON.camera}<span>${tt('Take a photo')}</span></button><button type="button" class="pw-btn" data-pw-pick>${ICON.image}<span>${tt('Choose from gallery')}</span></button></div><p class="pw-fine">${tt('Your photo stays on this device until you submit your design.')}</p></div>
   <div class="pw-busy" data-pw-busy hidden><span class="pw-spin"></span><span data-pw-busy-text></span></div>
   <div class="pw-zoom" data-pw-zoombar><button type="button" class="pw-icon-btn" data-pw-zoom="-1" aria-label="${tt('Zoom out')}">−</button><button type="button" class="pw-icon-btn" data-pw-zoom="0" aria-label="${tt('Fit')}">⤢</button><button type="button" class="pw-icon-btn" data-pw-zoom="1" aria-label="${tt('Zoom in')}">+</button></div>
  </div>
  <aside class="pw-side" data-pw-side>
   <p class="pw-note" data-pw-note role="status" aria-live="polite"></p>
   <div class="pw-tools" role="radiogroup">${[['corners','Corners',ICON.corners],['paint','Paint',ICON.paint],['erase','Erase',ICON.erase],['move','Move design',ICON.move]].map(([k,l,i])=>`<button type="button" role="radio" class="pw-tool" data-pw-mode="${k}">${i}<span>${tt(l)}</span></button>`).join('')}</div>
   <p class="pw-hint" data-pw-hint></p>
   <label class="pw-field" data-pw-brushrow><span>${tt('Brush size')}</span><input type="range" min="6" max="90" data-pw-brush></label>
   <div class="pw-field"><span>${tt('This photo shows')}</span><div class="pw-seg">${[['side','Side'],['rear','Rear'],['front','Front']].map(([k,l])=>`<button type="button" data-pw-preset="${k}">${tt(l)}</button>`).join('')}</div></div>
   <label class="pw-field"><span>${tt('Studio view')}</span><select data-pw-view>${views.map((v,i)=>`<option value="${i}">${tt(v.label)}</option>`).join('')}</select></label>
   <label class="pw-field"><span>${tt('Realism (shading)')}</span><input type="range" min="0" max="100" data-pw-shading></label>
   <label class="pw-field"><span>${tt('Opacity')}</span><input type="range" min="20" max="100" data-pw-opacity></label>
   <label class="pw-check"><input type="checkbox" data-pw-bg><span>${tt('Print the background colour (full wrap)')}</span></label>
   <label class="pw-check"><input type="checkbox" data-pw-showmask><span>${tt('Show detected area')}</span></label>
   <label class="pw-field"><span>${tt('Year, make and model')}</span><input type="text" maxlength="80" list="pw-models" data-pw-vehicle placeholder="${tt('e.g. 2021 Ford Transit 148" high roof')}" autocomplete="off"><datalist id="pw-models">${models.map(m=>`<option value="${esc(m)}">`).join('')}</datalist></label>
   <div class="pw-row wrap"><button type="button" class="pw-btn small" data-pw-detect>${tt('Detect again')}</button><button type="button" class="pw-btn small" data-pw-reset>${tt('Reset corners')}</button><button type="button" class="pw-btn small" data-pw-change>${tt('Change photo')}</button><button type="button" class="pw-btn small danger" data-pw-remove>${tt('Remove photo')}</button></div>
   <p class="pw-fine">${tt('The photo mock-up is approximate. Our team checks the exact measurements for your vehicle before printing.')}</p>
  </aside>
 </div>
 <footer class="pw-foot"><button type="button" class="pw-btn primary wide" data-pw-done>${tt('Design on my photo')}</button></footer>
 <input type="file" accept="image/*" capture="environment" hidden data-pw-camera><input type="file" accept="image/*" hidden data-pw-file>
 </div>`;
 const $=s=>ed.querySelector(s);
 ed.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeEditor();}});
 // focus can fall back to <body> after the file picker closes: still let Escape close the editor
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ed&&!ed.hidden&&!ed.contains(e.target)){e.preventDefault();closeEditor();}});
 $('[data-pw-close]').onclick=closeEditor;$('[data-pw-done]').onclick=()=>{if(!S.photo){$('[data-pw-take]').click();return;}persist();closeEditor();};
 $('[data-pw-take]').onclick=()=>$('[data-pw-camera]').click();$('[data-pw-pick]').onclick=$('[data-pw-change]').onclick=()=>$('[data-pw-file]').click();
 for(const inp of [$('[data-pw-camera]'),$('[data-pw-file]')])inp.onchange=()=>{const f=inp.files?.[0];inp.value='';if(f)loadFile(f);};
 $('[data-pw-detect]').onclick=()=>detect().then(persist);
 $('[data-pw-reset]').onclick=()=>{S.quad=defaultQuad();computeRef();bump();renderEditor();persist();};
 $('[data-pw-remove]').onclick=()=>{S.photo=null;S.mask=null;S.quad=null;S.box=null;S.dock=false;bump();clearStore();syncChip();syncDock();renderEditor();};
 ed.querySelectorAll('[data-pw-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.pwMode;if(S.mode==='paint'||S.mode==='erase')S.showMask=true;renderEditor();});
 ed.querySelectorAll('[data-pw-preset]').forEach(b=>b.onclick=()=>{const k=b.dataset.pwPreset,v=A.views(),i=Math.max(0,v.findIndex(x=>k==='side'?/side/.test(x.key):x.key.startsWith(k)));setView(i,true);});
 $('[data-pw-view]').onchange=e=>setView(Number(e.target.value),false);
 $('[data-pw-brush]').oninput=e=>{S.brush=Number(e.target.value);};
 $('[data-pw-shading]').oninput=e=>{S.shading=Number(e.target.value)/100;bump();};
 $('[data-pw-opacity]').oninput=e=>{S.opacity=Number(e.target.value)/100;bump();};
 $('[data-pw-bg]').onchange=e=>{S.bg=e.target.checked;bump();};
 $('[data-pw-showmask]').onchange=e=>{S.showMask=e.target.checked;drawTint();};
 $('[data-pw-vehicle]').oninput=e=>{S.vehicle=e.target.value.slice(0,80);};
 $('[data-pw-vehicle]').onchange=persist;
 ed.querySelectorAll('[data-pw-zoom]').forEach(b=>b.onclick=()=>{const z=Number(b.dataset.pwZoom),st=$('[data-pw-stage]').getBoundingClientRect();if(!z){view.s=1;view.tx=view.ty=0;}else zoomAt(st.left+st.width/2,st.top+st.height/2,z>0?1.4:1/1.4);applyView();});
 bindStage();
}
function setView(i,resetQuad){S.view=clamp(i,0,A.views().length-1);if(A.side()!==S.view)A.selectSide(S.view);if(resetQuad||!S.quad)S.quad=defaultQuad();computeRef();bump();renderEditor();persist();}
function renderEditor(){if(!ed)return;const $=s=>ed.querySelector(s),has=!!S.photo;
 $('[data-pw-empty]').hidden=has;$('[data-pw-world]').hidden=!has;$('[data-pw-handles]').hidden=!has||S.mode!=='corners';$('[data-pw-zoombar]').hidden=!has;$('[data-pw-side]').hidden=!has;ed.querySelector('.pw-body').classList.toggle('pw-no-photo',!has);
 ed.querySelectorAll('[data-pw-side] input,[data-pw-side] select,[data-pw-side] button').forEach(e=>e.disabled=!has);
 const m=$('[data-pw-method]');m.hidden=!has||!S.method;m.textContent=t(S.method==='ai'?'Automatic':S.method==='cv'?'Estimated':'Manual');m.dataset.kind=S.method;
 ed.querySelectorAll('[data-pw-mode]').forEach(b=>{const on=b.dataset.pwMode===S.mode;b.classList.toggle('active',on);b.setAttribute('aria-checked',on);});
 $('[data-pw-hint]').textContent=t(S.mode==='paint'?'Paint over parts of the body the wrap should cover.':S.mode==='erase'?'Erase windows, wheels, lights or trim the wrap should not cover.':S.mode==='move'?'Drag on the photo to move the selected item (or the whole design).':'Place the four corners on the ends of the vehicle body.');
 $('[data-pw-brushrow]').hidden=!(S.mode==='paint'||S.mode==='erase');$('[data-pw-brush]').value=S.brush;
 $('[data-pw-view]').value=String(S.view);$('[data-pw-shading]').value=Math.round(S.shading*100);$('[data-pw-opacity]').value=Math.round(S.opacity*100);
 if(!S.vehicle)S.vehicle=A.design().options.vehicleModel||'';$('[data-pw-vehicle]').value=S.vehicle;
 $('[data-pw-showmask]').checked=S.showMask;if(has)$('[data-pw-bg]').checked=printBg();
 ed.querySelectorAll('[data-pw-preset]').forEach(b=>{const v=A.views()[S.view]?.key||'',k=b.dataset.pwPreset;b.classList.toggle('active',k==='side'?/side/.test(v):v.startsWith(k));});
 ed.querySelector('[data-pw-done]').textContent=t(has?'Design on my photo':'Take a photo');
 ed.querySelector('[data-pw-stage]').dataset.mode=S.mode;
 if(has){const c=$('[data-pw-canvas]'),k=Math.min(1,VIEW_MAX/Math.max(S.photo.width,S.photo.height)),w=Math.round(S.photo.width*k),h=Math.round(S.photo.height*k);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}fitWorld();requestRender();}
}
function note(msg,error=false){const el=ed?.querySelector('[data-pw-note]');if(el){el.textContent=msg||'';el.classList.toggle('error',!!error);}}
function busy(msg){const el=ed?.querySelector('[data-pw-busy]');if(!el)return;el.hidden=!msg;el.querySelector('[data-pw-busy-text]').textContent=msg||'';}

// pan / zoom of the photo inside the stage (s=1 fits the photo)
const view={s:1,tx:0,ty:0,fw:0,fh:0,ox:0,oy:0};
function fitWorld(){if(!ed||!S.photo)return;const st=ed.querySelector('[data-pw-stage]'),w=st.clientWidth,h=st.clientHeight;if(!w||!h)return;const pad=w<520?18:36,k=Math.min((w-pad*2)/S.photo.width,(h-pad*2)/S.photo.height);view.fw=S.photo.width*k;view.fh=S.photo.height*k;view.ox=(w-view.fw)/2;view.oy=(h-view.fh)/2;const wd=ed.querySelector('[data-pw-world]');wd.style.width=view.fw+'px';wd.style.height=view.fh+'px';ed.querySelector('[data-pw-quad]').setAttribute('viewBox',`0 0 ${S.photo.width} ${S.photo.height}`);applyView();}
function applyView(){if(!ed)return;view.s=clamp(view.s,1,8);const st=ed.querySelector('[data-pw-stage]'),w=st.clientWidth,h=st.clientHeight,sw=view.fw*view.s,sh=view.fh*view.s;
 // keep some of the photo on screen
 const minX=w-sw-view.ox,maxX=-view.ox,minY=h-sh-view.oy,maxY=-view.oy;
 if(view.s>1){view.tx=clamp(view.tx,Math.min(minX,maxX)-40,Math.max(minX,maxX)+40);view.ty=clamp(view.ty,Math.min(minY,maxY)-40,Math.max(minY,maxY)+40);}else{view.tx=0;view.ty=0;}
 ed.querySelector('[data-pw-world]').style.transform=`translate(${view.ox+view.tx}px,${view.oy+view.ty}px) scale(${view.s})`;placeHandles();}
function zoomAt(cx,cy,f){const st=ed.querySelector('[data-pw-stage]').getBoundingClientRect(),x=cx-st.left-view.ox-view.tx,y=cy-st.top-view.oy-view.ty,ns=clamp(view.s*f,1,8),r=ns/view.s;view.tx-=x*(r-1);view.ty-=y*(r-1);view.s=ns;}
function toPhoto(cx,cy){const r=ed.querySelector('[data-pw-world]').getBoundingClientRect();return [(cx-r.left)/r.width*S.photo.width,(cy-r.top)/r.height*S.photo.height];}
function placeHandles(){if(!ed||!S.photo||!S.quad)return;const st=ed.querySelector('[data-pw-stage]').getBoundingClientRect(),r=ed.querySelector('[data-pw-world]').getBoundingClientRect(),W=S.photo.width,H=S.photo.height;
 ed.querySelectorAll('.pw-h').forEach((h,i)=>{const [x,y]=S.quad[i];h.style.transform=`translate(${r.left-st.left+x/W*r.width}px,${r.top-st.top+y/H*r.height}px)`;});
 const svg=ed.querySelector('[data-pw-quad]');svg.querySelector('polygon').setAttribute('points',S.quad.map(p=>p.join(',')).join(' '));
 // a light perspective grid so the customer can see the warp follow the panel
 const Hm=squareToQuad(S.quad),P=(u,v)=>{const w=Hm[6]*u+Hm[7]*v+1;return ((Hm[0]*u+Hm[1]*v+Hm[2])/w).toFixed(1)+','+((Hm[3]*u+Hm[4]*v+Hm[5])/w).toFixed(1);};let pts=[];for(const u of [.25,.5,.75])pts.push(P(u,0),P(u,1),P(u,0));pts.push(P(0,0));for(const v of [.5])pts.push(P(0,v),P(1,v),P(0,v));svg.querySelector('polyline').setAttribute('points',pts.join(' '));
 svg.classList.toggle('bad',!convex(S.quad));svg.style.display=S.mode==='corners'?'':'none';}
function drawTint(){const c=ed?.querySelector('[data-pw-tint]');if(!c||!S.mask)return;const show=S.showMask&&S.mode!=='move';c.hidden=!show;if(!show)return;if(c.width!==S.mw||c.height!==S.mh){c.width=S.mw;c.height=S.mh;}const g=c.getContext('2d'),img=g.createImageData(S.mw,S.mh),d=img.data;for(let i=0;i<S.mask.length;i++){const j=i*4;if(S.mask[i]>127){d[j]=237;d[j+1]=23;d[j+2]=100;d[j+3]=70;}else{d[j+3]=0;}}g.putImageData(img,0,0);}

function bindStage(){
 const st=ed.querySelector('[data-pw-stage]'),cur=ed.querySelector('[data-pw-cursor]'),pts=new Map();let op=null,pinch=null,raf=0;
 const frame=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;placeHandles();drawTint();requestRender();});};
 const near=(x,y)=>{const st2=st.getBoundingClientRect();let best=-1,bd=34;ed.querySelectorAll('.pw-h').forEach((h,i)=>{const r=h.getBoundingClientRect(),d=Math.hypot(r.left+r.width/2-x,r.top+r.height/2-y);if(d<bd){bd=d;best=i;}});return best;};
 st.addEventListener('pointerdown',e=>{if(!S.photo||e.target.closest('.pw-zoom,.pw-empty,.pw-busy'))return;e.preventDefault();try{st.setPointerCapture(e.pointerId);}catch{}pts.set(e.pointerId,[e.clientX,e.clientY]);
  if(pts.size===2){if(op?.type==='move')endMove();op=null;const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2};return;}
  if(pts.size>2)return;
  const hEl=e.target.closest('.pw-h'),hi=hEl?Number(hEl.dataset.h):S.mode==='corners'?near(e.clientX,e.clientY):-1;
  if(hi>=0){op={type:'corner',i:hi};ed.querySelectorAll('.pw-h')[hi].classList.add('drag');return;}
  const p=toPhoto(e.clientX,e.clientY);
  if(S.mode==='paint'||S.mode==='erase'){op={type:'brush',last:p};paint(p,p);frame();return;}
  if(S.mode==='move'&&S.quad&&convex(S.quad)){const [u,v]=toUV(inv3(squareToQuad(S.quad)),p[0],p[1]);if(u>=0&&u<=1&&v>=0&&v<=1){op={type:'move',uv:[u,v],start:A.startMove(),t:0};return;}}
  op={type:'pan',x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty};
 });
 st.addEventListener('pointermove',e=>{
  if(S.photo&&(S.mode==='paint'||S.mode==='erase')&&e.pointerType!=='touch'){const r=st.getBoundingClientRect(),d=S.brush*2;cur.hidden=false;cur.style.width=cur.style.height=d+'px';cur.style.transform=`translate(${e.clientX-r.left-d/2}px,${e.clientY-r.top-d/2}px)`;}else cur.hidden=true;
  if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
  if(pinch&&pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;view.tx+=mx-pinch.mx;view.ty+=my-pinch.my;zoomAt(mx,my,d/Math.max(1,pinch.d));pinch={d,mx,my};applyView();return;}
  if(!op)return;
  if(op.type==='corner'){const [x,y]=toPhoto(e.clientX,e.clientY);S.quad[op.i]=[clamp(x,-S.photo.width*.25,S.photo.width*1.25),clamp(y,-S.photo.height*.25,S.photo.height*1.25)];bump();frame();}
  else if(op.type==='brush'){const p=toPhoto(e.clientX,e.clientY);paint(op.last,p);op.last=p;frame();}
  else if(op.type==='pan'){view.tx=op.tx+e.clientX-op.x;view.ty=op.ty+e.clientY-op.y;applyView();}
  else if(op.type==='move'){const p=toPhoto(e.clientX,e.clientY),[u,v]=toUV(inv3(squareToQuad(S.quad)),p[0],p[1]);A.moveBy(op.start,u-op.uv[0],v-op.uv[1]);const now=performance.now();if(now-op.t>90){op.t=now;requestRender();}}
 });
 const endMove=()=>{if(op?.type==='move'){A.endMove(op.start);requestRender();}};
 const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!op)return;if(op.type==='corner'){ed.querySelectorAll('.pw-h').forEach(h=>h.classList.remove('drag'));if(S.mask)computeRef();bump();persist();}if(op.type==='brush'){computeRef();bump();persist();}endMove();op=null;};
 st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);st.addEventListener('pointerleave',()=>{cur.hidden=true;});
 st.addEventListener('wheel',e=>{if(!S.photo)return;e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015));applyView();},{passive:false});
 // keyboard: arrow keys nudge the focused corner handle
 ed.querySelector('[data-pw-handles]').addEventListener('keydown',e=>{const h=e.target.closest('.pw-h');if(!h||!S.quad)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;e.preventDefault();const k=(e.shiftKey?10:2)*S.photo.width/Math.max(1,view.fw*view.s),i=Number(h.dataset.h);S.quad[i]=[S.quad[i][0]+d[0]*k,S.quad[i][1]+d[1]*k];bump();computeRef();frame();persist();});
}
function paint(a,b){if(!S.mask)return;const k=S.mw/S.photo.width,wr=ed.querySelector('[data-pw-world]').getBoundingClientRect(),r=Math.max(1,S.brush/(wr.width/S.photo.width)*k),val=S.mode==='paint'?255:0,steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*k/(r/2)));
 for(let s=0;s<=steps;s++){const cx=(a[0]+(b[0]-a[0])*s/steps)*k,cy=(a[1]+(b[1]-a[1])*s/steps)*k;for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(S.mh-1,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(S.mw-1,Math.ceil(cx+r));x++)if((x-cx)**2+(y-cy)**2<=r*r)S.mask[y*S.mw+x]=val;}
 S.maskVer=(S.maskVer||0)+1;bump();}

/* ---------------- dock (live preview over the studio) ---------------- */
function syncDock(){const main=host?.querySelector('.cv-main');if(!main)return;
 if(!S.photo||!S.dock){if(dock)dock.hidden=true;syncChip();return;}
 if(!dock){dock=document.createElement('div');dock.className='pw-dock';dock.innerHTML=`<button type="button" class="pw-dock-view" data-pw-dock-open aria-label="${tt('Edit photo')}"><canvas></canvas></button><div class="pw-dock-bar"><span>${tt('On your vehicle photo')}</span><button type="button" class="pw-link" data-pw-dock-open>${tt('Edit photo')}</button><button type="button" class="pw-link" data-pw-dock-hide>${tt('Hide')}</button></div>`;main.append(dock);
  dock.querySelectorAll('[data-pw-dock-open]').forEach(b=>b.onclick=()=>{openEditor();});dock.querySelector('[data-pw-dock-hide]').onclick=()=>{S.dock=false;syncDock();};}
 dock.hidden=false;const c=dock.querySelector('canvas'),k=Math.min(1,DOCK_W*Math.min(2,devicePixelRatio||1)/S.photo.width);c.width=Math.round(S.photo.width*k);c.height=Math.round(S.photo.height*k);
 syncChip();positionChip();startPoll();lastVer=-1;requestRender();}

/* ---------------- review figure ---------------- */
function watchReview(){if(reviewObs)reviewObs.disconnect();const shots=host.querySelector('[data-review-shots]');if(!shots)return;let url='',ver='';
 reviewObs=new MutationObserver(async()=>{if(!S.photo||shots.querySelector('.pw-review-fig')||shots.querySelector('.cv-loading'))return;const v=S.version+'|'+artSig();if(v!==ver){const c=await photoMockup(1400);url=c?c.toDataURL('image/jpeg',.85):'';ver=v;}if(!url||shots.querySelector('.pw-review-fig')||shots.querySelector('.cv-loading'))return;const f=document.createElement('figure');f.className='pw-review-fig';f.innerHTML=`<img src="${url}" alt="${tt('On your vehicle photo')}"><figcaption>${tt('On your vehicle photo')} · ${tt(A.views()[S.view]?.label||'')}</figcaption>`;shots.prepend(f);});
 reviewObs.observe(shots,{childList:true});}

/* ---------------- order: attach the photo, the mock-up and the corners ---------------- */
async function uploadBlob(blob,name){const fd=new FormData();fd.set('file',new File([blob],name,{type:'image/jpeg'}));fd.set('product',A.product().id);const r=await fetch('/api/studio/upload',{method:'POST',body:fd});let v={};try{v=await r.json();}catch{}if(!r.ok)throw Error(v.error||'Upload failed');return v.file;}
const toBlob=(c,q=.88)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('Could not encode the photo')),'image/jpeg',q));
const noteRE=()=>new RegExp('\\n*'+NOTE_START.replace(/[[\]/]/g,'\\$&')+'[\\s\\S]*?'+NOTE_END.replace(/[[\]/]/g,'\\$&'),'g');
async function beforeSubmit(){
 const design=A.design();
 if(!S.photo||!S.quad){/* photo removed since an earlier submit: drop its note and files */if(design.photoWrap){const old=new Set([design.photoWrap.photo?.id,design.photoWrap.mockup?.id]);design.assets=design.assets.filter(id=>!old.has(id));delete design.photoWrap;design.notes=(design.notes||'').replace(noteRE(),'').trimEnd();const ta=host.querySelector('[data-notes]');if(ta)ta.value=design.notes;}return;}A.status('Attaching your vehicle photo…');
 const key=A.views()[S.view]?.key||'side',sig=S.version+'|'+artSig();
 try{await A.ensureSession();
  if(uploaded.photoKey!==photoKey){uploaded.photo=await uploadBlob(await toBlob(S.photo,.9),'vehicle-photo.jpg');uploaded.photoKey=photoKey;}
  if(uploaded.mockKey!==sig+photoKey){const c=await photoMockup(MAX_PHOTO);uploaded.mock=await uploadBlob(await toBlob(c,.86),`photo-mockup-${key}.jpg`);uploaded.mockKey=sig+photoKey;}
  const mine=new Set(design.photoWrap?[design.photoWrap.photo?.id,design.photoWrap.mockup?.id]:[]);design.assets=design.assets.filter(id=>!mine.has(id));
  for(const f of [uploaded.photo,uploaded.mock])if(f&&!design.assets.includes(f.id)&&design.assets.length<30)design.assets.push(f.id);
 }catch(e){console.warn('photo-wrap upload',e);A.status('Your vehicle photo could not be attached; the design is still submitted.',true);}
 const W=S.photo.width,H=S.photo.height,q=S.quad.map(([x,y])=>[Math.round(x),Math.round(y)]);
 design.photoWrap={photo:uploaded.photo?{id:uploaded.photo.id,name:uploaded.photo.name,width:W,height:H}:null,mockup:uploaded.mock?{id:uploaded.mock.id,name:uploaded.mock.name}:null,view:key,quad:q,quadNormalized:S.quad.map(([x,y])=>[+(x/W).toFixed(4),+(y/H).toFixed(4)]),vehicle:S.vehicle||design.options.vehicleModel||'',detection:S.method,shading:+S.shading.toFixed(2),opacity:+S.opacity.toFixed(2),fullWrap:printBg(),approximate:true};
 const block=`${NOTE_START}\nVehicle: ${design.photoWrap.vehicle||'not given'} · view: ${key}\nFiles: ${uploaded.photo?.name||'photo not attached'}${uploaded.mock?', '+uploaded.mock.name:''} (${W}×${H}px)\nPanel corners TL,TR,BR,BL (px): ${q.map(p=>p.join(',')).join(' | ')}\nDetection: ${S.method||'manual'}. Photo mock-up is approximate — confirm measurements before printing.\n${NOTE_END}`;
 let notes=(design.notes||'').replace(noteRE(),'').trimEnd();notes=(notes?notes.slice(0,Math.max(0,2990-block.length))+'\n\n':'')+block;design.notes=notes.slice(0,3000);
 const ta=host.querySelector('[data-notes]');if(ta)ta.value=design.notes;
}

/* ---------------- keep the photo on this device (IndexedDB) ---------------- */
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('satin-photo-wrap',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
let persistTimer=0;
function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(async()=>{if(!S.photo||!A)return;try{const blob=await toBlob(S.photo,.9),db=await idb();const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({blob,name:S.name,key:photoKey,mask:S.mask,mw:S.mw,mh:S.mh,box:S.box,autoQuad:S.autoQuad,quad:S.quad,view:S.view,shading:S.shading,opacity:S.opacity,bg:S.bg,vehicle:S.vehicle,method:S.method,saved:Date.now()},A.product().id);tx.oncomplete=()=>db.close();}catch{}},400);}
async function restore(){try{const db=await idb(),rec=await new Promise((res,rej)=>{const r=db.transaction('photos').objectStore('photos').get(A.product().id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});db.close();if(!rec?.blob||Date.now()-rec.saved>30*864e5)return false;
 const bmp=await createImageBitmap(rec.blob),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);bmp.close?.();
 Object.assign(S,{photo:c,name:rec.name,mask:rec.mask,mw:rec.mw,mh:rec.mh,box:rec.box,autoQuad:rec.autoQuad||null,quad:rec.quad,view:Math.min(rec.view||0,A.views().length-1),shading:rec.shading??.85,opacity:rec.opacity??1,bg:rec.bg??null,vehicle:rec.vehicle||'',method:rec.method||'manual',dock:true});photoKey=rec.key||crypto.randomUUID();computeRef();bump();return true;}catch{return false;}}
async function clearStore(){try{const db=await idb();const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(A.product().id);tx.oncomplete=()=>db.close();}catch{}}

// test hooks (used by automated checks; harmless in production)
export const _internals={S,squareToQuad,inv3,toUV,salientObject,vehicleBody,detect,project,photoMockup,beforeSubmit};
