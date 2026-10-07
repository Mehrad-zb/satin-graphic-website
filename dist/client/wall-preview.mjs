export const WALL_POINTS=[[0,0],[1536,0],[1536,938],[1420,938],[1404,850],[1330,822],[1330,759],[1150,750],[1140,765],[490,765],[487,752],[256,771],[249,784],[261,833],[207,824],[188,841],[174,864],[143,890],[124,857],[99,857],[99,834],[83,818],[53,824],[48,844],[7,852],[0,874]];
export function traceWall(ctx){ctx.moveTo(...WALL_POINTS[0]);for(const point of WALL_POINTS.slice(1))ctx.lineTo(...point);ctx.closePath();}
export function mountWallPreview(box){
 const host=document.querySelector('[data-room-preview]');if(!host)return;
 const canvas=host.querySelector('canvas');canvas.width=1536;canvas.height=1024;
 const ctx=canvas.getContext('2d');let art=null,zoom=1,x=0,y=0,scene=null,drag=null,loadId=0;
 host.querySelector('[data-room]')?.parentElement.remove();
 const controls=document.createElement('div');controls.className='wall-controls';
 controls.innerHTML='<label>Artwork size<input type="range" min="0.25" max="4" step="0.01" value="1" data-wall-zoom></label><label>Horizontal position<input type="range" min="-1536" max="1536" value="0" data-wall-x></label><label>Vertical position<input type="range" min="-1024" max="1024" value="0" data-wall-y></label><button type="button" data-wall-reset>Reset preview</button><p role="status" data-wall-status>Choose your image in Upload ready artwork below.</p>';
 canvas.after(controls);canvas.style.touchAction='none';
 const status=message=>controls.querySelector('[data-wall-status]').textContent=message;
 function draw(){if(!scene)return;ctx.clearRect(0,0,1536,1024);ctx.drawImage(scene,0,0,1536,1024);if(!art)return;
  const scale=Math.max(1536/art.width,770/art.height)*zoom;
  ctx.save();ctx.beginPath();traceWall(ctx);ctx.clip();
  ctx.drawImage(art,(1536-art.width*scale)/2+x,(770-art.height*scale)/2+y,art.width*scale,art.height*scale);
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.16;ctx.drawImage(scene,0,0,1536,1024);ctx.restore();
  // Restore the photographed furniture and floor as the top layer.
  ctx.save();ctx.beginPath();ctx.rect(0,0,1536,1024);traceWall(ctx);ctx.clip('evenodd');ctx.drawImage(scene,0,0,1536,1024);ctx.restore();
 }
 const background=new Image();background.onload=()=>{scene=background;draw();};background.onerror=()=>status('Room photo could not load. Please reload or contact info@satingraphic.ca.');background.src='/satin/img/wall-room.png';
 const sync=()=>{controls.querySelector('[data-wall-zoom]').value=zoom;controls.querySelector('[data-wall-x]').value=x;controls.querySelector('[data-wall-y]').value=y;};
 const reset=()=>{zoom=1;x=y=0;sync();draw();};
 controls.oninput=e=>{if(e.target.matches('[data-wall-zoom]'))zoom=Number(e.target.value);if(e.target.matches('[data-wall-x]'))x=Number(e.target.value);if(e.target.matches('[data-wall-y]'))y=Number(e.target.value);draw();};controls.querySelector('[data-wall-reset]').onclick=reset;
 canvas.onpointerdown=e=>{if(!art)return;drag={x:e.clientX,y:e.clientY,ox:x,oy:y};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;const r=canvas.getBoundingClientRect();x=Math.max(-1536,Math.min(1536,drag.ox+(e.clientX-drag.x)*1536/r.width));y=Math.max(-1024,Math.min(1024,drag.oy+(e.clientY-drag.y)*1024/r.height));sync();draw();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 box.addEventListener('change',e=>{if(!e.target.matches('[data-art-upload]'))return;const file=e.target.files?.[0],id=++loadId;if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000){status('Choose a JPG, PNG or WebP image up to 20 MB.');return;}
  const url=URL.createObjectURL(file),image=new Image();status('Loading your wall design…');
  image.onload=()=>{URL.revokeObjectURL(url);if(id!==loadId)return;art=image;reset();status('Drag the design or use the controls to resize it. Furniture stays in front.');};image.onerror=()=>{URL.revokeObjectURL(url);if(id===loadId)status('This image could not be read. Choose another image.');};image.src=url;
 });
}
