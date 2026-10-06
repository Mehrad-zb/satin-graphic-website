import { PDFDocument } from './pdf-lib.mjs';
const near=(a,b)=>Math.abs(a-b)<=1.5;
export async function inspectPDF(bytes,spec={width:3.5,height:2,bleed:0.0625,sides:2}) {
  if(bytes.length>25*1024*1024) throw new Error('Maximum file size is 25 MB.');
  if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-')) throw new Error('Upload a genuine PDF file.');
  let doc;try{doc=await PDFDocument.load(bytes,{ignoreEncryption:false});}catch{throw new Error('This PDF is damaged or password protected. Export an unlocked print PDF.');}
  const pages=doc.getPages();if(!pages.length||pages.length>spec.sides)throw new Error(`Expected up to ${spec.sides} page(s), received ${pages.length}.`);
  const checks=pages.map((p,i)=>{
    const m=p.getMediaBox(),t=p.getTrimBox(),b=p.getBleedBox(),w=spec.width*72,h=spec.height*72,bleed=spec.bleed*72;
    const explicit=p.node.has((p.node.context.obj('TrimBox')));
    const rotated=near(t.width,h)&&near(t.height,w);
    const trimOK=explicit?(near(t.width,w)&&near(t.height,h)||rotated):(near(m.width,w+bleed*2)&&near(m.height,h+bleed*2)||near(m.width,h+bleed*2)&&near(m.height,w+bleed*2)||near(m.width,w+18)&&near(m.height,h+18)||near(m.width,h+18)&&near(m.height,w+18));
    const contains=(outer,inner)=>inner.x-outer.x>=bleed-0.5&&inner.y-outer.y>=bleed-0.5&&outer.x+outer.width-inner.x-inner.width>=bleed-0.5&&outer.y+outer.height-inner.y-inner.height>=bleed-0.5;
    const bleedOK=explicit&&contains(m,t)&&contains(b,t);
    return {page:i+1,width:m.width/72,height:m.height/72,checks:[
      {name:'Trim size',status:trimOK?'pass':'fail',detail:trimOK?(explicit?'TrimBox matches the ordered size.':'Page size matches size plus bleed; TrimBox requires review.'):`Expected ${spec.width} × ${spec.height} in with ${spec.bleed} in bleed. Received ${(m.width/72).toFixed(3)} × ${(m.height/72).toFixed(3)} in.`},
      {name:'Bleed',status:bleedOK?'pass':'review',detail:bleedOK?'PDF boxes include the required bleed. Artwork coverage still requires review.':'Bleed coverage and trim marks require a production preflight.'},
      {name:'Image resolution',status:'review',detail:'Effective image resolution must be checked at final print size; target 300 DPI.'},
      {name:'Colour mode',status:'review',detail:'CMYK, spot colours and output profile require production preflight.'},
      {name:'Fonts',status:'review',detail:'Embedded or outlined fonts require production preflight.'}
    ]};
  });
  return {version:1,pages:checks,pageCount:pages.length,status:checks.some(p=>p.checks.some(c=>c.status==='fail'))?'rejected':'awaiting_preflight',spec,productionReady:false};
}
