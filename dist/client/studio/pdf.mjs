// Minimal print-ready PDF writer for the Design Studio (no dependencies).
// Each page holds one full-bleed raster: MediaBox/BleedBox = trim + bleed, TrimBox = trim.
// JPEG rasters are embedded as-is (DCTDecode); PNG rasters keep transparency (FlateDecode + SMask).
const enc=new TextEncoder();
function bytesOf(dataURL){const b=atob(dataURL.slice(dataURL.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not read the print image.'));i.src=src;});
async function deflate(u8){const stream=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
const num=n=>(Math.round(n*1000)/1000).toString();
const pdfText=s=>'('+String(s).replace(/[^\x20-\x7e]/g,'').replace(/[\\()]/g,c=>'\\'+c)+')';

async function imageObject(dataURL){const img=await loadImage(dataURL),w=img.naturalWidth,h=img.naturalHeight;
 if(/^data:image\/jpeg/.test(dataURL))return {w,h,data:bytesOf(dataURL),dict:`/Filter /DCTDecode /ColorSpace /DeviceRGB /BitsPerComponent 8`};
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 if(typeof CompressionStream==='undefined'){g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0);return imageObject(c.toDataURL('image/jpeg',.95));}
 g.drawImage(img,0,0);const px=g.getImageData(0,0,w,h).data,rgb=new Uint8Array(w*h*3),alpha=new Uint8Array(w*h);let opaque=true;
 for(let i=0,j=0,k=0;i<px.length;i+=4,j+=3,k++){rgb[j]=px[i];rgb[j+1]=px[i+1];rgb[j+2]=px[i+2];alpha[k]=px[i+3];if(px[i+3]!==255)opaque=false;}
 return {w,h,data:await deflate(rgb),dict:`/Filter /FlateDecode /ColorSpace /DeviceRGB /BitsPerComponent 8`,smask:opaque?null:{data:await deflate(alpha),dict:`/Filter /FlateDecode /ColorSpace /DeviceGray /BitsPerComponent 8`}};}

// pages: [{image: data URL (jpeg/png), widthIn, heightIn, bleedIn}] → Blob (application/pdf)
export async function pdfFromRasters(pages,title='Design'){
 const chunks=[],offsets=[];let size=0;const push=x=>{const u=typeof x==='string'?enc.encode(x):x;chunks.push(u);size+=u.length;};
 const object=(n,dict,stream)=>{offsets[n]=size;push(`${n} 0 obj\n${dict}\n`);if(stream){push(`stream\n`);push(stream);push(`\nendstream\n`);}push(`endobj\n`);};
 push('%PDF-1.4\n');push(new Uint8Array([37,226,227,207,211,10]));
 const kids=[];let next=4;const plan=[];
 for(const p of pages){const img=await imageObject(p.image);const ids={page:next++,content:next++,image:next++,smask:img.smask?next++:0};kids.push(ids.page);plan.push({p,img,ids});}
 object(1,`<< /Type /Catalog /Pages 2 0 R >>`);
 object(2,`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);
 object(3,`<< /Title ${pdfText(title)} /Creator (Satin Graphic Design Studio) /Producer (Satin Graphic Design Studio) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}Z) >>`);
 for(const {p,img,ids} of plan){const b=(+p.bleedIn||0)*72,W=(+p.widthIn)*72+2*b,H=(+p.heightIn)*72+2*b;
  const content=enc.encode(`q ${num(W)} 0 0 ${num(H)} 0 0 cm /Im0 Do Q\n`);
  object(ids.page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(W)} ${num(H)}] /BleedBox [0 0 ${num(W)} ${num(H)}] /TrimBox [${num(b)} ${num(b)} ${num(W-b)} ${num(H-b)}] /Resources << /XObject << /Im0 ${ids.image} 0 R >> >> /Contents ${ids.content} 0 R >>`);
  object(ids.content,`<< /Length ${content.length} >>`,content);
  object(ids.image,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.dict}${ids.smask?` /SMask ${ids.smask} 0 R`:''} /Length ${img.data.length} >>`,img.data);
  if(ids.smask)object(ids.smask,`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} ${img.smask.dict} /Length ${img.smask.data.length} >>`,img.smask.data);}
 const xref=size,count=next;push(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(chunks,{type:'application/pdf'});}
