// Minimal print-ready PDF writer for the Design Studio (no dependencies).
// Each page holds one full-bleed raster: MediaBox/BleedBox = trim + bleed, TrimBox = trim.
// Every image is written as DeviceCMYK: CMYK JPEGs from printRasters() are embedded as-is (DCTDecode, plain ink samples;
// older Adobe-inverted files keep /Decode [1 0 1 0 1 0 1 0]); any other raster (PNG with transparency, RGB JPEGs) is
// converted with rgbToCmyk (FlateDecode, transparency kept as an SMask).
// Below each artwork page (outside the bleed box) a slug lists the design's colours as CMYK swatches; the last page is
// the customer's mockup (which vehicle / product the artwork was designed on), also in CMYK.
import {rgbaToCmyk,canvasToCMYKJpeg,rgbToCmyk} from './cmyk.mjs';
const enc=new TextEncoder();
function bytesOf(dataURL){const b=atob(dataURL.slice(dataURL.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not read the print image.'));i.src=src;});
async function deflate(u8){const stream=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
const num=n=>(Math.round(n*1000)/1000).toString();
const pdfText=s=>'('+String(s).replace(/[^\x20-\x7e]/g,'').replace(/[\\()]/g,c=>'\\'+c)+')';
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
// extra: {swatches?: [{hex, cmyk}], mockup?: {image: data URL, title, lines: [text]}}
export async function pdfFromRasters(pages,title='Design',extra={}){
 const chunks=[],offsets=[];let size=0;const push=x=>{const u=typeof x==='string'?enc.encode(x):x;chunks.push(u);size+=u.length;};
 const object=(n,dict,stream)=>{offsets[n]=size;push(`${n} 0 obj\n${dict}\n`);if(stream){push(`stream\n`);push(stream);push(`\nendstream\n`);}push(`endobj\n`);};
 push('%PDF-1.6\n');push(new Uint8Array([37,226,227,207,211,10]));
 const sw=(extra.swatches||[]).slice(0,24),font=4;
 const kids=[];let next=5;const plan=[];
 for(const p of pages){const img=await imageObject(p);const ids={page:next++,content:next++,image:next++,smask:img.smask?next++:0};kids.push(ids.page);plan.push({p,img,ids});}
 let mock=null;if(extra.mockup?.image){try{const img=await imageObject({image:extra.mockup.image,flatten:'#ffffff'});mock={img,ids:{page:next++,content:next++,image:next++}};kids.push(mock.ids.page);}catch(e){console.warn('mockup page',e);}}
 object(1,`<< /Type /Catalog /Pages 2 0 R >>`);
 object(2,`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);
 object(3,`<< /Title ${pdfText(title)} /Creator (Satin Graphic Design Studio) /Producer (Satin Graphic Design Studio) /Subject (Print-ready artwork, DeviceCMYK) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}Z) >>`);
 object(font,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
 for(const {p,img,ids} of plan){/* pages over 200 in (vehicle sides) use /UserUnit: viewers cap page boxes at 14400 units */
  const tw=(+p.widthIn)+2*(+p.bleedIn||0),th=(+p.heightIn)+2*(+p.bleedIn||0);
  // slug under the bleed: CMYK swatches, sized to the page (never huge on a vehicle side)
  const sq=sw.length?Math.min(1.2,Math.max(.3,Math.min(tw,th)*.05)):0,slugIn=sw.length?sq*1.9:0;
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
