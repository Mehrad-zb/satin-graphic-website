// Minimal print-ready PDF writer for the Design Studio (no dependencies).
// Each page holds one full-bleed raster: MediaBox/BleedBox = trim + bleed, TrimBox = trim.
// Every image is written as DeviceCMYK: CMYK JPEGs from printRasters() are embedded as-is (DCTDecode, Adobe-inverted,
// /Decode [1 0 1 0 1 0 1 0]); any other raster (PNG with transparency, older RGB JPEGs) is converted with rgbToCmyk
// (FlateDecode, transparency kept as an SMask).
import {rgbaToCmyk,canvasToCMYKJpeg} from './cmyk.mjs';
const enc=new TextEncoder();
function bytesOf(dataURL){const b=atob(dataURL.slice(dataURL.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not read the print image.'));i.src=src;});
async function deflate(u8){const stream=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
const num=n=>(Math.round(n*1000)/1000).toString();
const pdfText=s=>'('+String(s).replace(/[^\x20-\x7e]/g,'').replace(/[\\()]/g,c=>'\\'+c)+')';
const CMYK_JPEG='/Filter /DCTDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Decode [1 0 1 0 1 0 1 0]';
// 4-component JPEG? (SOF component count = 4)
function jpegComponents(u8){for(let i=2;i+9<u8.length;){if(u8[i]!==0xFF){i++;continue;}const m=u8[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return u8[i+9];if(m===0xD8||m===0x01||(m>=0xD0&&m<=0xD7)){i+=2;continue;}i+=2+(u8[i+2]<<8|u8[i+3]);}return 0;}

async function imageObject(p){const dataURL=p.image;
 if(/^data:image\/jpeg/.test(dataURL)){const data=bytesOf(dataURL);if(p.cmyk||jpegComponents(data)===4){let w=p.w,h=p.h;if(!w||!h){const img=await loadImage(dataURL);w=img.naturalWidth;h=img.naturalHeight;}return {w,h,data,dict:CMYK_JPEG};}}
 const img=await loadImage(dataURL),w=img.naturalWidth,h=img.naturalHeight;
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
 g.drawImage(img,0,0);const px=g.getImageData(0,0,w,h).data;let opaque=true;for(let i=3;i<px.length;i+=4)if(px[i]!==255){opaque=false;break;}
 if(opaque||typeof CompressionStream==='undefined'){if(!opaque){g.globalCompositeOperation='destination-over';g.fillStyle='#fff';g.fillRect(0,0,w,h);}const data=await canvasToCMYKJpeg(c,92);c.width=c.height=1;return {w,h,data,dict:CMYK_JPEG};}
 const cmyk=rgbaToCmyk(px),alpha=new Uint8Array(w*h);for(let i=3,k=0;i<px.length;i+=4,k++)alpha[k]=px[i];c.width=c.height=1;
 return {w,h,data:await deflate(cmyk),dict:`/Filter /FlateDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8`,smask:{data:await deflate(alpha),dict:`/Filter /FlateDecode /ColorSpace /DeviceGray /BitsPerComponent 8`}};}

// pages: [{image: data URL (CMYK or RGB jpeg / png), widthIn, heightIn, bleedIn, w?, h?, cmyk?}] → Blob (application/pdf)
export async function pdfFromRasters(pages,title='Design'){
 const chunks=[],offsets=[];let size=0;const push=x=>{const u=typeof x==='string'?enc.encode(x):x;chunks.push(u);size+=u.length;};
 const object=(n,dict,stream)=>{offsets[n]=size;push(`${n} 0 obj\n${dict}\n`);if(stream){push(`stream\n`);push(stream);push(`\nendstream\n`);}push(`endobj\n`);};
 push('%PDF-1.6\n');push(new Uint8Array([37,226,227,207,211,10]));
 const kids=[];let next=4;const plan=[];
 for(const p of pages){const img=await imageObject(p);const ids={page:next++,content:next++,image:next++,smask:img.smask?next++:0};kids.push(ids.page);plan.push({p,img,ids});}
 object(1,`<< /Type /Catalog /Pages 2 0 R >>`);
 object(2,`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);
 object(3,`<< /Title ${pdfText(title)} /Creator (Satin Graphic Design Studio) /Producer (Satin Graphic Design Studio) /Subject (Print-ready artwork, DeviceCMYK) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}Z) >>`);
 for(const {p,img,ids} of plan){/* pages over 200 in (vehicle sides) use /UserUnit: viewers cap page boxes at 14400 units */const u=Math.max(1,Math.ceil(((+p.widthIn)+2*(+p.bleedIn||0))*72/14400),Math.ceil(((+p.heightIn)+2*(+p.bleedIn||0))*72/14400)),b=(+p.bleedIn||0)*72/u,W=(+p.widthIn)*72/u+2*b,H=(+p.heightIn)*72/u+2*b;
  const content=enc.encode(`q ${num(W)} 0 0 ${num(H)} 0 0 cm /Im0 Do Q\n`);
  object(ids.page,`<< /Type /Page /Parent 2 0 R ${u>1?`/UserUnit ${u} `:''}/MediaBox [0 0 ${num(W)} ${num(H)}] /BleedBox [0 0 ${num(W)} ${num(H)}] /TrimBox [${num(b)} ${num(b)} ${num(W-b)} ${num(H-b)}] /Resources << /XObject << /Im0 ${ids.image} 0 R >> >> /Contents ${ids.content} 0 R >>`);
  object(ids.content,`<< /Length ${content.length} >>`,content);
  object(ids.image,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.dict}${ids.smask?` /SMask ${ids.smask} 0 R`:''} /Length ${img.data.length} >>`,img.data);
  if(ids.smask)object(ids.smask,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.smask.dict} /Length ${img.smask.data.length} >>`,img.smask.data);}
 const xref=size,count=next;push(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(chunks,{type:'application/pdf'});}
