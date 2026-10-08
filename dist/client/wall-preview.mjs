// Wallpaper room preview. Each room has three layers made from one photo:
//   wallroom-<room>.webp        the original photo (shown before an image is uploaded)
//   wallroom-<room>-shade.webp  greyscale light map of the wall (multiplied over the design for natural shadows)
//   wallroom-<room>-front.webp  furniture, floor and decor with the wall cut out (drawn on top)
// The design sits between the wall and the furniture, so it looks hung behind the sofa, bed or desk.
const W=1536,H=1024,HANDLE=26;
export const ROOMS=['living-room','adult-bedroom','child-bedroom','office','lounge'];
export function mountWallPreview(box){
 const host=document.querySelector('[data-room-preview]');if(!host)return;
 const canvas=host.querySelector('canvas');canvas.width=W;canvas.height=H;canvas.style.touchAction='none';
 const ctx=canvas.getContext('2d');
 let room=host.querySelector('[data-room][aria-pressed="true"]')?.dataset.room||ROOMS[0];
 let layers=null,art=null,rect=null,drag=null,hover=null,loadId=0,roomId=0;
 const controls=document.createElement('div');controls.className='wall-controls';
 controls.innerHTML='<button type="button" class="btn ghost sm" data-wall-fill>Fill the wall</button><button type="button" class="btn ghost sm" data-wall-fit>Fit whole image</button><button type="button" class="btn ghost sm" data-wall-reset>Reset</button><p role="status" class="small" data-wall-status>Choose your image in “Your artwork” below to see it on the wall.</p>';
 canvas.after(controls);
 const status=m=>controls.querySelector('[data-wall-status]').textContent=m;
 const load=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;});
 const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;const t=tmp.getContext('2d');
 function corners(){return rect?[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h]]:[];}
 function draw(){
  if(!layers)return;ctx.clearRect(0,0,W,H);
  if(!art){ctx.drawImage(layers.photo,0,0,W,H);return;}
  // wall layer: the design, lit by the room's own light map
  t.globalCompositeOperation='source-over';t.clearRect(0,0,W,H);
  t.drawImage(art,rect.x,rect.y,rect.w,rect.h);
  t.globalCompositeOperation='multiply';t.drawImage(layers.shade,0,0,W,H);
  t.globalCompositeOperation='destination-in';t.fillStyle='#000';t.fillRect(rect.x,rect.y,rect.w,rect.h);t.globalCompositeOperation='source-over';
  ctx.drawImage(layers.photo,0,0,W,H);ctx.drawImage(tmp,0,0);
  // furniture layer on top
  ctx.drawImage(layers.front,0,0,W,H);
  // outline + corner handles (not part of the room, only for editing)
  ctx.save();ctx.setLineDash([12,8]);ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.95)';ctx.strokeRect(rect.x,rect.y,rect.w,rect.h);
  ctx.setLineDash([]);ctx.strokeStyle='rgba(23,25,30,.55)';ctx.lineWidth=1.5;ctx.strokeRect(rect.x-1.5,rect.y-1.5,rect.w+3,rect.h+3);
  for(const [x,y] of corners()){ctx.beginPath();ctx.arc(x,y,HANDLE/2,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#c91c50';ctx.stroke();}
  ctx.restore();
 }
 function place(mode){if(!art)return;const r=art.width/art.height;let w,h;
  if(mode==='fit'){h=H*.62;w=h*r;if(w>W*.92){w=W*.92;h=w/r;}}
  else{w=W;h=w/r;if(h<H){h=H;w=h*r;}}
  rect={x:(W-w)/2,y:mode==='fit'?H*.06:(H-h)/2,w,h};draw();}
 async function setRoom(key){const id=++roomId;room=key;host.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===key)));
  try{const base='/satin/img/wallroom-'+key;const [photo,shade,front]=await Promise.all([load(base+'.webp'),load(base+'-shade.webp'),load(base+'-front.webp')]);if(id!==roomId)return;layers={photo,shade,front};draw();}
  catch{status('Room photo could not load. Please reload or contact info@satingraphic.ca.');}}
 host.querySelectorAll('[data-room]').forEach(b=>b.addEventListener('click',()=>setRoom(b.dataset.room)));
 controls.querySelector('[data-wall-fill]').onclick=()=>place('fill');controls.querySelector('[data-wall-fit]').onclick=()=>place('fit');controls.querySelector('[data-wall-reset]').onclick=()=>place('fill');
 const pt=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];};
 const hit=([x,y])=>{if(!rect)return null;const c=corners().findIndex(([cx,cy])=>Math.hypot(cx-x,cy-y)<HANDLE*1.4);if(c>=0)return {corner:c};if(x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h)return {move:true};return null;};
 canvas.addEventListener('pointerdown',e=>{if(!art)return;const p=pt(e),h=hit(p);if(!h)return;e.preventDefault();drag={...h,p,start:{...rect}};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{const p=pt(e);if(!drag){const h=hit(p);canvas.style.cursor=!h?'default':h.move?'move':(h.corner===0||h.corner===3)?'nwse-resize':'nesw-resize';return;}
  const dx=p[0]-drag.p[0],dy=p[1]-drag.p[1],s=drag.start;
  if(drag.move){rect={...s,x:s.x+dx,y:s.y+dy};}
  else{const ratio=s.w/s.h,c=drag.corner,ax=c%2===0?s.x+s.w:s.x,ay=c<2?s.y+s.h:s.y;// opposite corner stays fixed
   let w=Math.abs(p[0]-ax);w=Math.max(80,Math.max(w,Math.abs(p[1]-ay)*ratio));const h=w/ratio;
   rect={w,h,x:c%2===0?ax-w:ax,y:c<2?ay-h:ay};}
  draw();});
 const end=()=>{drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 box.addEventListener('change',e=>{if(!e.target.matches('[data-art-upload]'))return;const file=e.target.files?.[0],id=++loadId;if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000){status('Preview works with JPG, PNG or WebP images up to 20 MB.');return;}
  const url=URL.createObjectURL(file),image=new Image();status('Loading your wall design…');
  image.onload=()=>{URL.revokeObjectURL(url);if(id!==loadId)return;art=image;place('fill');status('Drag to move · pull a corner handle to resize. Furniture stays in front of your wallpaper.');};
  image.onerror=()=>{URL.revokeObjectURL(url);if(id===loadId)status('This image could not be read. Choose another image.');};image.src=url;});
 setRoom(room);
}
