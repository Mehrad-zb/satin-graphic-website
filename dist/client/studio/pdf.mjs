// Minimal print-ready PDF writer for the Design Studio (no dependencies).
// Layered pages (pdfFromRasters with page.layers): the background is a vector CMYK rectangle and every design element (text,
// graphic, mascot, photo, shape) is its own image with a transparency mask, placed at its real position and stacked in design
// order, each in a named PDF layer (optional content). Illustrator / CorelDRAW open them as separate objects that can be
// selected, moved or deleted one by one; colours are CMYK (lossless Flate for drawn elements, CMYK JPEG for photos).
// Each page holds one full-bleed raster: MediaBox/BleedBox = trim + bleed, TrimBox = trim.
// Every image is written as DeviceCMYK: CMYK JPEGs from printRasters() are embedded as-is (DCTDecode, plain ink samples;
// older Adobe-inverted files keep /Decode [1 0 1 0 1 0 1 0]); any other raster (PNG with transparency, RGB JPEGs) is
// converted with rgbToCmyk (FlateDecode, transparency kept as an SMask).
// Below each artwork page (outside the bleed box) a slug lists the design's colours as CMYK swatches; the last page is
// the customer's mockup (which vehicle / product the artwork was designed on), also in CMYK.
import {rgbaToCmyk,canvasToCMYKJpeg,rgbToCmyk,encodeCMYKJpeg} from './cmyk.mjs';
const enc=new TextEncoder();
function bytesOf(dataURL){const b=atob(dataURL.slice(dataURL.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not read the print image.'));i.src=src;});
const deflateMaybe=Promise.resolve(typeof CompressionStream!=='undefined');
async function deflate(u8){const stream=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
const num=n=>(Math.round(n*1000)/1000).toString();
const pdfText=s=>'('+String(s).replace(/[^\x20-\x7e]/g,'').replace(/[\\()]/g,c=>'\\'+c)+')';
// any text (Persian too) as a UTF-16BE hex string, for layer names
const pdfUni=s=>'<FEFF'+[...String(s)].map(ch=>{const c=ch.codePointAt(0);if(c<0x10000)return c.toString(16).padStart(4,'0');const v=c-0x10000;return (0xD800+(v>>10)).toString(16)+(0xDC00+(v&1023)).toString(16);}).join('').toUpperCase()+'>';
const CMYK_JPEG='/Filter /DCTDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8';
const ADOBE_DECODE=' /Decode [1 0 1 0 1 0 1 0]';
// 4-component JPEG? (SOF component count = 4)
function jpegComponents(u8){for(let i=2;i+9<u8.length;){if(u8[i]!==0xFF){i++;continue;}const m=u8[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return u8[i+9];if(m===0xD8||m===0x01||(m>=0xD0&&m<=0xD7)){i+=2;continue;}i+=2+(u8[i+2]<<8|u8[i+3]);}return 0;}
// Adobe APP14 marker present? (then the CMYK samples are stored inverted, the Photoshop convention)
function jpegAdobe(u8){for(let i=2;i+11<u8.length;){if(u8[i]!==0xFF){i++;continue;}const m=u8[i+1];if(m===0xDA||m===0xD9)return false;if(m===0xEE&&u8[i+4]===0x41&&u8[i+5]===0x64&&u8[i+6]===0x6F&&u8[i+7]===0x62&&u8[i+8]===0x65)return true;if(m===0xD8||m===0x01||(m>=0xD0&&m<=0xD7)){i+=2;continue;}i+=2+(u8[i+2]<<8|u8[i+3]);}return false;}

async function imageObject(p){const dataURL=p.image;
 if(/^data:image\/jpeg/.test(dataURL)){const data=bytesOf(dataURL);if(p.cmyk||jpegComponents(data)===4){let w=p.w,h=p.h;if(!w||!h){const img=await loadImage(dataURL);w=img.naturalWidth;h=img.naturalHeight;}return {w,h,data,dict:CMYK_JPEG+(jpegAdobe(data)?ADOBE_DECODE:'')};}}
 const img=await loadImage(dataURL),w=img.naturalWidth,h=img.naturalHeight;
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
 g.drawImage(img,0,0);const px=g.getImageData(0,0,w,h).data;let opaque=true;for(let i=3;i<px.length;i+=4)if(px[i]!==255){opaque=false;break;}
 if(opaque||p.flatten||typeof CompressionStream==='undefined'){if(!opaque){g.globalCompositeOperation='destination-over';g.fillStyle=p.flatten||'#fff';g.fillRect(0,0,w,h);}const data=await canvasToCMYKJpeg(c,92);c.width=c.height=1;return {w,h,data,dict:CMYK_JPEG};}
 const cmyk=rgbaToCmyk(px),alpha=new Uint8Array(w*h);for(let i=3,k=0;i<px.length;i+=4,k++)alpha[k]=px[i];c.width=c.height=1;
 return {w,h,data:await deflate(cmyk),dict:`/Filter /FlateDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8`,smask:{data:await deflate(alpha),dict:`/Filter /FlateDecode /ColorSpace /DeviceGray /BitsPerComponent 8`}};}

/**
 * One design element rendered alone on a transparent canvas → cropped CMYK image + alpha mask.
 * Returns null when nothing was drawn, else {img:{w,h,data,dict,smask?}, x, y} (crop offset in canvas pixels).
 * photo=true: CMYK JPEG (photos); otherwise lossless Flate (text, shapes, mascots keep crisp edges and exact colours).
 */
export async function layerFromCanvas(canvas,photo=false,fill='#ffffff'){const g=canvas.getContext('2d',{willReadFrequently:true}),W=canvas.width,H=canvas.height;
 let x0=W,y0=H,x1=-1,y1=-1;const STRIP=256;
 for(let sy=0;sy<H;sy+=STRIP){const rows=Math.min(STRIP,H-sy),px=g.getImageData(0,sy,W,rows).data;for(let r=0;r<rows;r++){let any=false;const o=r*W*4;for(let x=0;x<W;x++)if(px[o+x*4+3]){any=true;if(x<x0)x0=x;break;}if(!any)continue;for(let x=W-1;x>=0;x--)if(px[o+x*4+3]){if(x>x1)x1=x;break;}const y=sy+r;if(y<y0)y0=y;y1=y;}}
 if(x1<0)return null;const w=x1-x0+1,h=y1-y0+1;
 const n=parseInt(String(fill).slice(1),16),fr=n>>16&255,fg=n>>8&255,fb=n&255;
 const cmyk=new Uint8Array(w*h*4),alpha=new Uint8Array(w*h);let opaque=true;
 for(let sy=0;sy<h;sy+=STRIP){const rows=Math.min(STRIP,h-sy),px=g.getImageData(x0,y0+sy,w,rows).data;for(let i=0,k=sy*w;i<px.length;i+=4,k++){const a=px[i+3];alpha[k]=a;if(a<255)opaque=false;if(!a){px[i]=fr;px[i+1]=fg;px[i+2]=fb;}}
  rgbaToCmyk(px,cmyk.subarray(sy*w*4,(sy+rows)*w*4));}
 let img;
 if(photo){const data=await encodeCMYKJpeg(w,h,(yy,rows)=>cmyk.subarray(yy*w*4,(yy+rows)*w*4),92);img={w,h,data,dict:CMYK_JPEG};}
 else img={w,h,data:await deflate(cmyk),dict:'/Filter /FlateDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8'};
 if(!opaque)img.smask={data:await deflate(alpha),dict:'/Filter /FlateDecode /ColorSpace /DeviceGray /BitsPerComponent 8'};
 return {img,x:x0,y:y0};}

/** '#rrggbb' → {hex, cmyk:[c,m,y,k] in %} with the same conversion as the print rasters. */
export function cmykSwatch(hex){const n=parseInt(String(hex).slice(1),16);const v=rgbToCmyk(n>>16&255,n>>8&255,n&255).map(x=>Math.round(x*100/255));return {hex:String(hex).toLowerCase(),cmyk:v};}
const cmykOp=v=>v.map(x=>num(x/100)).join(' ');
const label=v=>`C${v[0]} M${v[1]} Y${v[2]} K${v[3]}`;
// Swatch row: squares filled with the exact CMYK values (vector, operator k), each with its CMYK code (and hex) below.
function swatchOps(list,x0,y0,size,maxW){let ops='',x=x0;const fs=Math.max(4,size*.22);
 for(const s of list){const w=Math.max(size,fs*.56*Math.max(label(s.cmyk).length,s.hex.length));if(x+w>x0+maxW)break;
  ops+=`q ${cmykOp(s.cmyk)} k ${num(x)} ${num(y0+fs*2.6)} ${num(size)} ${num(size)} re f 0 0 0 .5 K ${num(Math.max(.3,size/80))} w ${num(x)} ${num(y0+fs*2.6)} ${num(size)} ${num(size)} re S Q\n`;
  ops+=`BT /F1 ${num(fs)} Tf 0 0 0 1 k ${num(x)} ${num(y0+fs*1.35)} Td ${pdfText(label(s.cmyk))} Tj ET\nBT /F1 ${num(fs*.85)} Tf 0 0 0 .6 k ${num(x)} ${num(y0+fs*.25)} Td ${pdfText(s.hex.toUpperCase())} Tj ET\n`;x+=w+size*.35;}
 return ops;}

// pages: [{image: data URL (CMYK or RGB jpeg / png), widthIn, heightIn, bleedIn, w?, h?, cmyk?}] → Blob (application/pdf)
// or layered: [{widthIn, heightIn, bleedIn, background: '#rrggbb'|null, layers: [{name, xIn, yIn, wIn, hIn, img}]}] (positions
// from the bleed box's top-left corner; img from layerFromCanvas)
// extra: {swatches?: [{hex, cmyk}], mockup?: {image: data URL, title, lines: [text]}}
export async function pdfFromRasters(pages,title='Design',extra={}){
 const chunks=[],offsets=[];let size=0;const push=x=>{const u=typeof x==='string'?enc.encode(x):x;chunks.push(u);size+=u.length;};
 const object=(n,dict,stream)=>{offsets[n]=size;push(`${n} 0 obj\n${dict}\n`);if(stream){push(`stream\n`);push(stream);push(`\nendstream\n`);}push(`endobj\n`);};
 push('%PDF-1.6\n');push(new Uint8Array([37,226,227,207,211,10]));
 const sw=(extra.swatches||[]).slice(0,24),font=4;
 const kids=[];let next=5;const plan=[];
 const ocgs=[];const ocg=name=>{const id=next++;ocgs.push({id,name});return id;};
 for(const p of pages){if(p.layers){const ids={page:next++,content:next++,bg:p.background?ocg('Background'):0,
   layers:p.layers.map(L=>L.vec?{vec:true,ocg:ocg(L.name),content:0,images:L.vec.images.map(x=>({image:next++,smask:x.img.smask?next++:0})),forms:L.vec.forms.map(()=>next++)}:{image:next++,smask:L.img.smask?next++:0,ocg:ocg(L.name)}),res:next++,sw:sw.length?ocg('CMYK colour codes'):0,cut:p.cut?ocg('CutContour (die line)'):0,cutCs:p.cut?next++:0};kids.push(ids.page);plan.push({p,ids,layered:true});continue;}
  const img=await imageObject(p);const ids={page:next++,content:next++,image:next++,smask:img.smask?next++:0};kids.push(ids.page);plan.push({p,img,ids});}
 let mock=null;if(extra.mockup?.image){try{const img=await imageObject({image:extra.mockup.image,flatten:'#ffffff'});mock={img,ids:{page:next++,content:next++,image:next++}};kids.push(mock.ids.page);}catch(e){console.warn('mockup page',e);}}
 object(1,`<< /Type /Catalog /Pages 2 0 R${ocgs.length?` /OCProperties << /OCGs [${ocgs.map(o=>o.id+' 0 R').join(' ')}] /D << /Name (Layers) /Order [${ocgs.map(o=>o.id+' 0 R').join(' ')}] /ON [${ocgs.map(o=>o.id+' 0 R').join(' ')}] >> >>`:''} >>`);
 for(const o of ocgs)object(o.id,`<< /Type /OCG /Name ${pdfUni(o.name)} >>`);
 object(2,`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);
 object(3,`<< /Title ${pdfText(title)} /Creator (Satin Graphic Design Studio) /Producer (Satin Graphic Design Studio) /Subject (Print-ready artwork, DeviceCMYK) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}Z) >>`);
 object(font,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
 for(const {p,img,ids,layered} of plan){
  if(layered){const sc=Math.max(1,+p.scale||1),tw=((+p.widthIn)+2*(+p.bleedIn||0))/sc,th=((+p.heightIn)+2*(+p.bleedIn||0))/sc;
   const sq=sw.length?Math.min(3,Math.max(.3,Math.min(tw,th)*.05)):0,notes=p.notes||[],noteIn=notes.length?Math.min(.6,Math.max(.12,Math.min(tw,th)*.03))*1.6*notes.length:0,slugIn=(sw.length?sq*1.9:0)+noteIn;
   const u=Math.max(1,Math.ceil(tw*72/14400),Math.ceil((th+slugIn)*72/14400)),b=(+p.bleedIn||0)/sc*72/u,W=tw*72/u,H=th*72/u,S=slugIn*72/u,pt=v=>v/sc*72/u,NS=noteIn*72/u;
   let ops='';const props=[],xo=[],shd=[],gst=[];const zz=await deflateMaybe;
   if(ids.bg){ops+=`/OC /B0 BDC q ${cmykOp(cmykSwatch(p.background).cmyk)} k 0 ${num(S)} ${num(W)} ${num(H)} re f Q EMC\n`;props.push(`/B0 ${ids.bg} 0 R`);}
   const vk=.72/(u*sc); // vector layers: SVG user units (0.01 in, y down, origin at the bleed's top-left) → page points
   p.layers.forEach((L,j)=>{const id=ids.layers[j];props.push(`/L${j} ${id.ocg} 0 R`);
    if(L.vec){const v=L.vec;ops+=`/OC /L${j} BDC q ${num(vk)} 0 0 ${num(-vk)} 0 ${num(S+H)} cm\n${v.ops}Q EMC\n`;
     v.images.forEach((x,k)=>xo.push(`/${x.name} ${id.images[k].image} 0 R`));v.forms.forEach((f,k)=>xo.push(`/${f.name} ${id.forms[k]} 0 R`));
     v.shadings.forEach(x=>shd.push(`/${x.name} ${x.dict}`));v.gstates.forEach(x=>gst.push(`/${x.name} ${x.dict}`));return;}
    const x=pt(L.xIn),w=pt(L.wIn),h=pt(L.hIn),y=S+H-pt(L.yIn)-h;ops+=`/OC /L${j} BDC q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im${j} Do Q EMC\n`;xo.push(`/Im${j} ${id.image} 0 R`);});
   if(ids.cut){/* die line at the trim, spot colour "CutContour" (cutters / RIPs pick it up; it does not print) */const x0=b,y0=S+b,cw=W-2*b,ch=H-2*b,k=.5523;let path='';
    if(p.cut.shape==='ellipse'){const rx=cw/2,ry=ch/2,cx=x0+rx,cy=y0+ry;path=`${num(cx+rx)} ${num(cy)} m ${num(cx+rx)} ${num(cy+ry*k)} ${num(cx+rx*k)} ${num(cy+ry)} ${num(cx)} ${num(cy+ry)} c ${num(cx-rx*k)} ${num(cy+ry)} ${num(cx-rx)} ${num(cy+ry*k)} ${num(cx-rx)} ${num(cy)} c ${num(cx-rx)} ${num(cy-ry*k)} ${num(cx-rx*k)} ${num(cy-ry)} ${num(cx)} ${num(cy-ry)} c ${num(cx+rx*k)} ${num(cy-ry)} ${num(cx+rx)} ${num(cy-ry*k)} ${num(cx+rx)} ${num(cy)} c h`;}
    else{const r=Math.min(pt(p.cut.radiusIn||0),cw/2,ch/2);if(r>0){const x1=x0+cw,y1=y0+ch;path=`${num(x0+r)} ${num(y0)} m ${num(x1-r)} ${num(y0)} l ${num(x1-r+r*k)} ${num(y0)} ${num(x1)} ${num(y0+r-r*k)} ${num(x1)} ${num(y0+r)} c ${num(x1)} ${num(y1-r)} l ${num(x1)} ${num(y1-r+r*k)} ${num(x1-r+r*k)} ${num(y1)} ${num(x1-r)} ${num(y1)} c ${num(x0+r)} ${num(y1)} l ${num(x0+r-r*k)} ${num(y1)} ${num(x0)} ${num(y1-r+r*k)} ${num(x0)} ${num(y1-r)} c ${num(x0)} ${num(y0+r)} l ${num(x0)} ${num(y0+r-r*k)} ${num(x0+r-r*k)} ${num(y0)} ${num(x0+r)} ${num(y0)} c h`;}else path=`${num(x0)} ${num(y0)} ${num(cw)} ${num(ch)} re`;}
    ops+=`/OC /CC BDC q /CS0 CS 1 SCN ${num(Math.max(.25,.5/u))} w ${path} S Q EMC\n`;props.push(`/CC ${ids.cut} 0 R`);}
   if(ids.sw){ops+=`/OC /SW BDC\n${swatchOps(sw,0,NS+(S-NS)*.08,sq*72/u,W)}EMC\n`;props.push(`/SW ${ids.sw} 0 R`);}
   if(notes.length){const fs=NS/notes.length/1.6;notes.forEach((t,k)=>{const f2=Math.min(fs,W/(.5*Math.max(10,String(t).length)));ops+=`BT /F1 ${num(f2)} Tf 0 0 0 1 k 0 ${num(NS-(k+1)*fs*1.6+fs*.45)} Td ${pdfText(t)} Tj ET\n`;});}
   const content=zz?await deflate(enc.encode(ops)):enc.encode(ops);
   object(ids.res,`<< /XObject << ${xo.join(' ')} >> /Font << /F1 ${font} 0 R >> /Properties << ${props.join(' ')} >>${shd.length?` /Shading << ${shd.join(' ')} >>`:''}${gst.length?` /ExtGState << ${gst.join(' ')} >>`:''}${ids.cutCs?` /ColorSpace << /CS0 ${ids.cutCs} 0 R >>`:''} >>`);
   object(ids.page,`<< /Type /Page /Parent 2 0 R ${u>1?`/UserUnit ${u} `:''}/MediaBox [0 0 ${num(W)} ${num(H+S)}] /BleedBox [0 ${num(S)} ${num(W)} ${num(H+S)}] /TrimBox [${num(b)} ${num(S+b)} ${num(W-b)} ${num(H+S-b)}] /Resources ${ids.res} 0 R /Contents ${ids.content} 0 R${p.layers.some(L=>L.vec&&L.vec.forms.length)?' /Group << /S /Transparency /CS /DeviceCMYK >>':''} >>`);
   if(ids.cutCs)object(ids.cutCs,`[/Separation /CutContour /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>]`);
   object(ids.content,`<< /Length ${content.length}${zz?' /Filter /FlateDecode':''} >>`,content);
   for(let j=0;j<p.layers.length;j++){const L=p.layers[j],id=ids.layers[j];
    const imgs=L.vec?L.vec.images.map((x,k)=>[x.img,id.images[k]]):[[L.img,id]];
    for(const [im,ii] of imgs){object(ii.image,`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} ${im.dict}${ii.smask?` /SMask ${ii.smask} 0 R`:''} /Length ${im.data.length} >>`,im.data);
     if(ii.smask)object(ii.smask,`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} ${im.smask.dict} /Length ${im.smask.data.length} >>`,im.smask.data);}
    if(L.vec)for(let k=0;k<L.vec.forms.length;k++){const f=L.vec.forms[k],d=zz?await deflate(enc.encode(f.ops)):enc.encode(f.ops);
     object(id.forms[k],`<< /Type /XObject /Subtype /Form /BBox [-100000 -100000 100000 100000] /Group << /S /Transparency /I true /CS /DeviceCMYK >> /Resources ${ids.res} 0 R /Length ${d.length}${zz?' /Filter /FlateDecode':''} >>`,d);}}
   continue;}/* pages over 200 in (vehicle sides) use /UserUnit: viewers cap page boxes at 14400 units */
  const tw=(+p.widthIn)+2*(+p.bleedIn||0),th=(+p.heightIn)+2*(+p.bleedIn||0);
  // slug under the bleed: CMYK swatches, sized to the page (never huge on a vehicle side)
  const sq=sw.length?Math.min(3,Math.max(.3,Math.min(tw,th)*.05)):0,slugIn=sw.length?sq*1.9:0;
  const u=Math.max(1,Math.ceil(tw*72/14400),Math.ceil((th+slugIn)*72/14400)),b=(+p.bleedIn||0)*72/u,W=tw*72/u,H=th*72/u,S=slugIn*72/u;
  let ops=`q ${num(W)} 0 0 ${num(H)} 0 ${num(S)} cm /Im0 Do Q\n`;
  if(sw.length)ops+=swatchOps(sw,0,S*.08,sq*72/u,W);
  const content=enc.encode(ops);
  object(ids.page,`<< /Type /Page /Parent 2 0 R ${u>1?`/UserUnit ${u} `:''}/MediaBox [0 0 ${num(W)} ${num(H+S)}] /BleedBox [0 ${num(S)} ${num(W)} ${num(H+S)}] /TrimBox [${num(b)} ${num(S+b)} ${num(W-b)} ${num(H+S-b)}] /Resources << /XObject << /Im0 ${ids.image} 0 R >> /Font << /F1 ${font} 0 R >> >> /Contents ${ids.content} 0 R >>`);
  object(ids.content,`<< /Length ${content.length} >>`,content);
  object(ids.image,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.dict}${ids.smask?` /SMask ${ids.smask} 0 R`:''} /Length ${img.data.length} >>`,img.data);
  if(ids.smask)object(ids.smask,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.smask.dict} /Length ${img.smask.data.length} >>`,img.smask.data);}
 if(mock){// last page: 11 × 8.5 in landscape, title, mockup image fitted, colour list
  const {img,ids}=mock,W=792,H=612,m=36,lines=extra.mockup.lines||[];let ops=`BT /F1 16 Tf 0 0 0 1 k ${m} ${H-m-12} Td ${pdfText(extra.mockup.title||'Mockup')} Tj ET\n`;
  lines.slice(0,3).forEach((t,i)=>{ops+=`BT /F1 9 Tf 0 0 0 .7 k ${m} ${H-m-30-i*12} Td ${pdfText(t)} Tj ET\n`;});
  const top=H-m-36-Math.min(3,lines.length)*12,bottom=m+(sw.length?58:0),aw=W-2*m,ah=top-bottom,k=Math.min(aw/img.w,ah/img.h),dw=img.w*k,dh=img.h*k;
  ops+=`q ${num(dw)} 0 0 ${num(dh)} ${num(m+(aw-dw)/2)} ${num(bottom+(ah-dh)/2)} cm /Im0 Do Q\n`;
  if(sw.length)ops+=`BT /F1 9 Tf 0 0 0 1 k ${m} ${m+48} Td (Colours used \\(CMYK\\)) Tj ET\n`+swatchOps(sw,m,m,22,W-2*m);
  const content=enc.encode(ops);
  object(ids.page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${ids.image} 0 R >> /Font << /F1 ${font} 0 R >> >> /Contents ${ids.content} 0 R >>`);
  object(ids.content,`<< /Length ${content.length} >>`,content);
  object(ids.image,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.dict} /Length ${img.data.length} >>`,img.data);}
 const xref=size,count=next;push(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(chunks,{type:'application/pdf'});}
