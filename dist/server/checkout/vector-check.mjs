import {PDFDocument,PDFName} from './pdf-lib.mjs';
export async function vectorCheck(bytes,mime,width,height){
 const near=(a,b)=>Math.abs(a-b)<=.03;
 if(mime==='image/svg+xml'){
  const text=new TextDecoder().decode(bytes),root=text.match(/<svg\b[^>]*>/i)?.[0]||'';
  const length=key=>{const raw=root.match(new RegExp('\\b'+key+'\\s*=\\s*["\']([^"\']+)["\']','i'))?.[1],m=/^([\d.]+)\s*(in|mm|cm|pt|px)?$/i.exec(raw||'');if(!m)return null;return Number(m[1])*({in:1,mm:1/25.4,cm:1/2.54,pt:1/72,px:1/96}[(m[2]||'px').toLowerCase()]);};
  const w=length('width'),h=length('height');if(!w||!h)throw Error('SVG must declare physical width and height at 1:1 scale.');if(!near(w,width)||!near(h,height))throw Error('SVG dimensions must match the ordered '+width+' × '+height+' inches at 1:1 scale.');if(!/<(?:path|rect|circle|ellipse|polygon|polyline|line)\b/i.test(text))throw Error('Supply vector shapes for print and cutting.');return {width:w,height:h};
 }
 if(mime!=='application/pdf')throw Error('Supply SVG or vector PDF artwork.');const doc=await PDFDocument.load(bytes,{ignoreEncryption:false});const page=doc.getPages()[0];if(doc.getPageCount()!==1)throw Error('Supply one vector PDF per print panel.');const size=page.getSize();if(!near(size.width/72,width)||!near(size.height/72,height))throw Error('PDF must match the ordered dimensions at 1:1 scale.');for(const [,object] of doc.context.enumerateIndirectObjects())if(object.get?.(PDFName.of('Subtype'))?.toString()==='/Image'||object.dict?.get(PDFName.of('Subtype'))?.toString()==='/Image')throw Error('This PDF contains raster images. Supply vector paths for print and cutting.');return {width:width,height:height};
}
