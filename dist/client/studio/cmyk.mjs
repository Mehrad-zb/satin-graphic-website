// CMYK output for print files (no dependencies).
// rgbToCmyk: device conversion with full grey-component replacement (neutral greys and black print with K only,
// at most two process colours + K, total ink ≤ 200 %). No ICC profile is applied; the shop's RIP may fine-tune.
// encodeCMYKJpeg: baseline JPEG encoder for 4-component (CMYK) images, Adobe convention (APP14, transform 0,
// inverted samples) — embed in PDF with /ColorSpace /DeviceCMYK /Decode [1 0 1 0 1 0 1 0].
// The same conversion is implemented in PHP (print_pdf.php, ppdf_cmyk) for server-side fallbacks.

/** 0–255 RGB → 0–255 ink amounts [C, M, Y, K]. */
export function rgbToCmyk(r,g,b){const c=255-r,m=255-g,y=255-b,k=Math.min(c,m,y);if(k>=255)return [0,0,0,255];const d=255-k;return [Math.round((c-k)*255/d),Math.round((m-k)*255/d),Math.round((y-k)*255/d),k];}

/** RGBA pixels → interleaved CMYK ink bytes (alpha ignored: composite onto white first when needed). */
export function rgbaToCmyk(px,out=new Uint8Array(px.length)){for(let i=0;i<px.length;i+=4){const c=255-px[i],m=255-px[i+1],y=255-px[i+2];let k=c<m?c:m;if(y<k)k=y;if(k>=255){out[i]=out[i+1]=out[i+2]=0;out[i+3]=255;continue;}const s=255/(255-k);out[i]=((c-k)*s+.5)|0;out[i+1]=((m-k)*s+.5)|0;out[i+2]=((y-k)*s+.5)|0;out[i+3]=k;}return out;}

const ZZ=new Int32Array([0,1,5,6,14,15,27,28,2,4,7,13,16,26,29,42,3,8,12,17,25,30,41,43,9,11,18,24,31,40,44,53,10,19,23,32,39,45,52,54,20,22,33,38,46,51,55,60,21,34,37,47,50,56,59,61,35,36,48,49,57,58,62,63]);
const QT=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
const DC_N=[0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0],DC_V=[0,1,2,3,4,5,6,7,8,9,10,11];
const AC_N=[0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d],AC_V=[0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa];
function huff(n,v){const code=new Int32Array(256),len=new Int32Array(256);let c=0,p=0;for(let k=1;k<=16;k++){for(let j=0;j<n[k];j++){code[v[p]]=c;len[v[p]]=k;p++;c++;}c<<=1;}return {code,len};}
const HDC=huff(DC_N,DC_V),HAC=huff(AC_N,AC_V);
const AASF=[1,1.387039845,1.306562965,1.175875602,1,.785694958,.5411961,.275899379];

/**
 * Encodes CMYK ink data as a baseline JPEG.
 * read(y0, rows) must return interleaved CMYK ink bytes (Uint8Array, width*rows*4) for image rows y0…y0+rows-1.
 * Returns Uint8Array. Async: yields to the browser between strips so large vehicle files keep the page responsive.
 */
export async function encodeCMYKJpeg(width,height,read,quality=92){
 const q=Math.max(1,Math.min(100,quality)),sf=q<50?5000/q:200-q*2,table=new Uint8Array(64),fd=new Float64Array(64);
 for(let i=0;i<64;i++){table[ZZ[i]]=Math.max(1,Math.min(255,Math.floor((QT[i]*sf+50)/100)));}
 for(let r=0,k=0;r<8;r++)for(let c=0;c<8;c++,k++)fd[k]=1/(table[ZZ[k]]*AASF[r]*AASF[c]*8);
 let buf=new Uint8Array(Math.max(65536,width*height>>1)),pos=0;
 const grow=n=>{if(pos+n<=buf.length)return;let s=buf.length*2;while(s<pos+n)s*=2;const b=new Uint8Array(s);b.set(buf.subarray(0,pos));buf=b;};
 const byte=b=>{grow(1);buf[pos++]=b;},word=w=>{byte(w>>8&255);byte(w&255);},bytes=a=>{grow(a.length);for(const b of a)buf[pos++]=b;};
 let acc=0,nb=0;// bit accumulator
 const bits=(code,len)=>{acc=(acc<<len)|code;nb+=len;while(nb>=8){const b=(acc>>(nb-8))&255;nb-=8;grow(2);buf[pos++]=b;if(b===255)buf[pos++]=0;}acc&=(1<<nb)-1;};
 // headers: SOI, APP14 Adobe (transform 0 = CMYK as stored), DQT, SOF0 (4 × 1×1), DHT, SOS
 word(0xFFD8);word(0xFFEE);word(14);bytes([0x41,0x64,0x6F,0x62,0x65]);word(100);word(0);word(0);byte(0);
 word(0xFFDB);word(67);byte(0);bytes(table);
 word(0xFFC0);word(20);byte(8);word(height);word(width);byte(4);for(let c=1;c<=4;c++){byte(c);byte(0x11);byte(0);}
 word(0xFFC4);word(2+17+12+17+162);byte(0);for(let k=1;k<=16;k++)byte(DC_N[k]);bytes(DC_V);byte(0x10);for(let k=1;k<=16;k++)byte(AC_N[k]);bytes(AC_V);
 word(0xFFDA);word(14);byte(4);for(let c=1;c<=4;c++){byte(c);byte(0);}byte(0);byte(63);byte(0);
 const D=new Float64Array(64),Q=new Int32Array(64),DU=new Int32Array(64),dc=[0,0,0,0];
 const block=(prev)=>{// forward DCT (AAN) + quantisation + Huffman coding of D
  for(let o=0;o<64;o+=8){const d0=D[o],d1=D[o+1],d2=D[o+2],d3=D[o+3],d4=D[o+4],d5=D[o+5],d6=D[o+6],d7=D[o+7];let t0=d0+d7,t7=d0-d7,t1=d1+d6,t6=d1-d6,t2=d2+d5,t5=d2-d5,t3=d3+d4,t4=d3-d4;let t10=t0+t3,t13=t0-t3,t11=t1+t2,t12=t1-t2;D[o]=t10+t11;D[o+4]=t10-t11;const z1=(t12+t13)*.707106781;D[o+2]=t13+z1;D[o+6]=t13-z1;t10=t4+t5;t11=t5+t6;t12=t6+t7;const z5=(t10-t12)*.382683433,z2=.5411961*t10+z5,z4=1.306562965*t12+z5,z3=t11*.707106781,z11=t7+z3,z13=t7-z3;D[o+5]=z13+z2;D[o+3]=z13-z2;D[o+1]=z11+z4;D[o+7]=z11-z4;}
  for(let o=0;o<8;o++){const d0=D[o],d1=D[o+8],d2=D[o+16],d3=D[o+24],d4=D[o+32],d5=D[o+40],d6=D[o+48],d7=D[o+56];let t0=d0+d7,t7=d0-d7,t1=d1+d6,t6=d1-d6,t2=d2+d5,t5=d2-d5,t3=d3+d4,t4=d3-d4;let t10=t0+t3,t13=t0-t3,t11=t1+t2,t12=t1-t2;D[o]=t10+t11;D[o+32]=t10-t11;const z1=(t12+t13)*.707106781;D[o+16]=t13+z1;D[o+48]=t13-z1;t10=t4+t5;t11=t5+t6;t12=t6+t7;const z5=(t10-t12)*.382683433,z2=.5411961*t10+z5,z4=1.306562965*t12+z5,z3=t11*.707106781,z11=t7+z3,z13=t7-z3;D[o+40]=z13+z2;D[o+24]=z13-z2;D[o+8]=z11+z4;D[o+56]=z11-z4;}
  for(let i=0;i<64;i++){const v=D[i]*fd[i];let n=v>0?(v+.5)|0:(v-.5)|0;if(i&&(n>1023||n<-1023))n=n>0?1023:-1023;Q[i]=n;}// baseline AC range
  for(let i=0;i<64;i++)DU[ZZ[i]]=Q[i];
  const diff=DU[0]-prev;if(diff===0)bits(HDC.code[0],HDC.len[0]);else{const a=diff<0?-diff:diff,n=32-Math.clz32(a);bits(HDC.code[n],HDC.len[n]);bits(diff<0?diff+(1<<n)-1:diff,n);}
  let end=63;while(end>0&&DU[end]===0)end--;
  if(end===0){bits(HAC.code[0],HAC.len[0]);return DU[0];}
  for(let i=1;i<=end;){const start=i;while(DU[i]===0&&i<=end)i++;let z=i-start;while(z>=16){bits(HAC.code[0xF0],HAC.len[0xF0]);z-=16;}const v=DU[i],a=v<0?-v:v,n=32-Math.clz32(a),s=(z<<4)+n;bits(HAC.code[s],HAC.len[s]);bits(v<0?v+(1<<n)-1:v,n);i++;}
  if(end!==63)bits(HAC.code[0],HAC.len[0]);return DU[0];};
 let last=performance.now();
 for(let y0=0;y0<height;y0+=8){const rows=Math.min(8,height-y0),strip=read(y0,rows),rowBytes=width*4;
  for(let x0=0;x0<width;x0+=8)for(let c=0;c<4;c++){
   for(let yy=0;yy<8;yy++){const row=(yy<rows?yy:rows-1)*rowBytes;for(let xx=0;xx<8;xx++){const x=x0+xx<width?x0+xx:width-1;D[yy*8+xx]=127-strip[row+x*4+c];}}// Adobe CMYK: samples are stored inverted (255 − ink), level-shifted by 128
   dc[c]=block(dc[c]);}
  if(performance.now()-last>40){await new Promise(r=>setTimeout(r,0));last=performance.now();}}
 if(nb>0)bits((1<<(8-nb))-1,8-nb);word(0xFFD9);
 return buf.slice(0,pos);}

/** Canvas → CMYK JPEG bytes (opaque artwork; transparent pixels are composited on white). */
export async function canvasToCMYKJpeg(canvas,quality=92){const g=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;let tmp=null;
 return encodeCMYKJpeg(w,h,(y0,rows)=>{const px=g.getImageData(0,0+y0,w,rows).data;for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a<255){const k=255-a;px[i]=px[i]+k*(255-px[i])/255;px[i+1]=px[i+1]+k*(255-px[i+1])/255;px[i+2]=px[i+2]+k*(255-px[i+2])/255;}}return tmp=rgbaToCmyk(px,tmp&&tmp.length===px.length?tmp:undefined);},quality);}

export function bytesToDataURL(u8,mime){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return 'data:'+mime+';base64,'+btoa(s);}
