# Builds the Wrap Visualizer vehicle assets from our own site photos (white + optional black-paint pair).
import numpy as np, cv2, json, os, sys
from PIL import Image
I='/home/claude/hp/test/home/new.satingraphic.ca/satin/img/'
M='/home/claude/gh-satin/dist/client/studio/mockups/'
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/claude-0/agentI-work/cars/'
os.makedirs(OUT,exist_ok=True)
CW,CH,GROUND,CARW=1600,900,770,1330
VEH={
 'tesla':dict(w=I+'tesla-white-gloss.png',b=I+'tesla-black-gloss.png',wheels=[[353,612,145,100],[1440,602,148,100]]),
 'sedan':dict(w=I+'sedan-bare.png',glass_poly=[(565,496),(650,442),(700,407),(750,385),(810,375),(900,370),(1000,372),(1075,381),(1130,395),(1165,415),(1186,435),(1180,455),(1165,470),(1050,476),(900,479),(700,489),(565,496)],mirror=(632,466,34,24),wheels=[[332,597,146,118],[1610,600,146,118]]),
 'coupe':dict(w=I+'cc-audi-bare.png',wheels=[[362,498,146,117],[1484,494,146,117]]),
 'suv':dict(w=I+'suv-bare.png',glass_poly=[(629,392),(675,350),(727,327),(783,310),(833,303),(866,302),(842,424),(637,433)],wheels=[[342,494,146,108],[1400,494,146,108]]),
 'suvxl':dict(w=I+'suv-full-bare.png',wheels=[[362,557,152,108],[1550,560,151,108]]),
 'pickup':dict(w=M+'pickup.optimized.webp',b=M+'pickup-black.optimized.webp',wheels=[[243,624,125,92],[1194,620,125,92]]),
 'minivan':dict(w=M+'minivan.optimized.webp',b=M+'minivan-black.optimized.webp',wheels=[[243,611,112,79],[1193,621,112,79]]),
 'van':dict(w=M+'van.optimized.webp',b=M+'van-black.optimized.webp',wheels=[[249,708,110,70],[1225,712,110,70]]),
 'sprinter':dict(w=I+'sprinter-bare.png',wheels=[[377,671,104,66],[1410,671,104,66]]),
}
lin=lambda x: np.where(x<=0.04045,x/12.92,((x+0.055)/1.055)**2.4)
def smooth(x,a,b): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def backdrop():
  y=np.arange(CH)[:,None]/CH; x=np.arange(CW)[None,:]/CW
  wall=np.array([194,195,198])+ (np.array([201,202,204])-np.array([194,195,198]))*np.clip(y/0.66,0,1)[...,None]
  floor=np.array([205,205,207])+(np.array([214,214,216])-np.array([205,205,207]))*np.clip((y-0.66)/0.34,0,1)[...,None]
  bg=np.where((y<0.66)[...,None],wall,floor)
  bg=cv2.GaussianBlur(bg.astype(np.float32),(0,0),12)
  vig=1+0.035*np.exp(-(((x-0.5)/0.45)**2+((y-0.62)/0.5)**2))
  return np.broadcast_to(bg*vig[...,None],(CH,CW,3)).astype(np.float32)/255
meta={}
for k,v in VEH.items():
  src=np.asarray(Image.open(v['w']).convert('RGBA')).astype(np.float32)/255
  studio=src[...,3].min()>0.99
  wh=v['wheels']
  ground=max(c[1]+c[2] for c in wh)
  if studio:
    b=np.asarray(Image.open(v['b']).convert('RGBA')).astype(np.float32)/255
    d=np.abs(src[...,:3]-b[...,:3]).sum(-1)>0.3
    d=cv2.morphologyEx(d.astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    ys,xs=np.where(d); x0,x1,top=xs.min(),xs.max(),ys.min()
  else:
    al=src[...,3].copy(); al[al<0.2]=0
    n_,lab_,st_,_=cv2.connectedComponentsWithStats((al>0.5).astype(np.uint8),8)
    big=1+np.argmax(st_[1:,cv2.CC_STAT_AREA]); keepm=cv2.dilate((lab_==big).astype(np.uint8),np.ones((5,5),np.uint8))
    src[...,3]=al*keepm
    ys,xs=np.where(src[...,3]>0.5); x0,x1,top=xs.min(),xs.max(),ys.min()
  s=min(CARW/(x1-x0), 560/(ground-top))
  tx=CW/2-s*(x0+x1)/2; ty=GROUND-s*ground
  A=np.float32([[s,0,tx],[0,s,ty]])
  warp=lambda im,border: cv2.warpAffine(im,A,(CW,CH),flags=cv2.INTER_AREA if s<1 else cv2.INTER_CUBIC,borderMode=border)
  if studio:
    W=np.clip(warp(src[...,:3],cv2.BORDER_REPLICATE),0,1); Bk=np.clip(warp(b[...,:3],cv2.BORDER_REPLICATE),0,1); alpha=np.ones((CH,CW),np.float32)
    # soften replicated borders
  else:
    w4=np.clip(warp(src,cv2.BORDER_CONSTANT),0,1); alpha=w4[...,3]
    rgb=np.where(alpha[...,None]>0,w4[...,:3]/np.maximum(alpha[...,None],1e-4),0)
    bg=backdrop()
    # contact shadow
    sh=np.zeros((CH,CW),np.float32)
    cx0,cx1=s*x0+tx,s*x1+tx
    cv2.ellipse(sh,(int((cx0+cx1)/2),int(GROUND-4)),(int((cx1-cx0)*0.5),26),0,0,360,0.55,-1)
    sh=cv2.GaussianBlur(sh,(0,0),18)
    for c in wh:
      wx,wy,wr=s*c[0]+tx,s*(c[1]+c[2])+ty,s*c[2]
      t=np.zeros_like(sh); cv2.ellipse(t,(int(wx),int(wy-2)),(int(wr*0.9),9),0,0,360,0.8,-1); sh=np.maximum(sh,cv2.GaussianBlur(t,(0,0),6))
    bg=bg*(1-0.5*sh[...,None])
    W=rgb*alpha[...,None]+bg*(1-alpha[...,None])
    if 'b' in v:
      b4=np.clip(warp(np.asarray(Image.open(v['b']).convert('RGBA')).astype(np.float32)/255,cv2.BORDER_CONSTANT),0,1)
      Bk=np.where(b4[...,3:]>0,b4[...,:3]/np.maximum(b4[...,3:],1e-4),0)
    else: Bk=None
    W=W.astype(np.float32)
  wheels=[[s*c[0]+tx,s*c[1]+ty,s*c[2],s*c[3]] for c in wh]
  yy,xx=np.mgrid[0:CH,0:CW]
  tire=np.zeros((CH,CW),np.float32); rim=np.zeros((CH,CW),np.float32)
  for (cx,cy,rt,rr) in wheels:
    dist=np.hypot(xx-cx,yy-cy)
    tire=np.maximum(tire,smooth(-dist,-rt-6,-rt-2)); rim=np.maximum(rim,smooth(-dist,-rr-1.5,-rr+1.5))
  rgbW=W if studio else rgb
  L=rgbW.mean(-1); sat=rgbW.max(-1)-rgbW.min(-1)
  Lw=lin(W).mean(-1)
  if Bk is not None:
    Lb=lin(Bk).mean(-1)
    dd=Lw-Lb
    hard=(dd>0.22)&(alpha>0.5)
    D=dd/0.8; S=np.clip(Lb-0.03*D,0,1)
  else:
    hard=(alpha>0.5)&(L>0.62)&(sat<0.1)
    D=cv2.bilateralFilter(Lw.astype(np.float32),9,0.05,5)/0.8; S=None
  hard&=tire<0.5
  hard=cv2.morphologyEx(hard.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
  # remove small paint specks
  n,lab,st,_=cv2.connectedComponentsWithStats(hard,8)
  keep=np.zeros(n,bool); keep[1:]=st[1:,cv2.CC_STAT_AREA]>400; hard=keep[lab]
  # greenhouse (glass): big non-paint dark components in the upper part
  car=(alpha>0.5)
  if studio:
    # silhouette for studio photos: anything differing from the replicated background, closed
    bgest=cv2.GaussianBlur(cv2.medianBlur((W*255).astype(np.uint8),31).astype(np.float32)/255,(0,0),40)
    car=(np.abs(W-bgest).sum(-1)>0.12)|hard
    car=cv2.morphologyEx(car.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((15,15),np.uint8)).astype(bool)
  ys_=np.where(hard.any(1))[0]; ctop=ys_.min()
  gtop=ctop; gbot=GROUND
  non=(car&~hard&(tire<0.5)&(L<(0.68 if studio else 0.8))&(sat<0.16)).astype(np.uint8)
  non=cv2.morphologyEx(non,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
  n,lab,st,cen=cv2.connectedComponentsWithStats(non,8)
  glass=np.zeros((CH,CW),bool); bel=[]
  carh=GROUND-ctop
  for i in range(1,n):
    x,y,w_,h_,ar=st[i]
    if ar>2500 and cen[i][1]<ctop+0.5*carh and w_>60 and y<ctop+0.35*carh:
      glass|=lab==i; bel.append(y+h_)
  # windows: fill reflections / interior highlights enclosed by the glass
  from scipy import ndimage
  glass=ndimage.binary_fill_holes(cv2.morphologyEx(glass.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)).astype(bool))&~hard
  belt=int(np.median(bel)) if bel else int(ctop+0.4*carh)
  # fill paint holes below the beltline (shaded door areas, reflections on the paired photo)
  holes=(~hard)&car&(tire<0.5)&~glass
  n,lab,st,cen=cv2.connectedComponentsWithStats(holes.astype(np.uint8),4)
  edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))
  fill=np.zeros(n,bool)
  meanL=cv2.calcHist if False else None
  for i in range(1,n):
    if i in edge: continue
    m=lab==i if st[i][4]<200000 else None
    if m is None: continue
    if cen[i][1]>belt-5 and L[m].mean()>(0.38 if Bk is None else 0.0) and sat[m].mean()<0.12 and st[i][4]<60000:
      fill[i]=True
  paint=hard|fill[lab]
  if 'glass_poly' in v:
    gp=np.zeros((CH,CW),np.uint8); cv2.fillPoly(gp,[np.array(v['glass_poly'],np.int32)],1)
    if 'mirror' in v: mx,my,ma,mb=v['mirror']; cv2.ellipse(gp,(mx,my),(ma,mb),0,0,360,0,-1)
    gp=gp.astype(bool); paint&=~gp; glass|=gp
  paint=cv2.morphologyEx(paint.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8)).astype(np.float32)
  paint=cv2.GaussianBlur(paint,(0,0),0.8)*np.minimum(alpha*1.02,1)*(1-tire)
  if not studio:  # recolour the light anti-aliased fringe along the silhouette too (no white halo)
    ring=cv2.dilate((paint>0.5).astype(np.uint8),np.ones((7,7),np.uint8)).astype(bool)&(alpha>0.02)&(alpha<0.98)&(L>0.55)&(tire<0.5)
    paint=np.maximum(paint,ring*np.clip(alpha,0,1))
  glassm=cv2.GaussianBlur(glass.astype(np.float32),(0,0),0.8)
  rimm=rim*(sat<0.35)
  rimm=cv2.GaussianBlur(rimm.astype(np.float32),(0,0),0.6)
  # shading normalisation
  pm=paint>0.5
  D=D/np.percentile(D[pm],93)
  D=np.clip(D,0,1.3)
  # environment / horizon map from geometry
  E=np.zeros((CH,CW),np.float32)
  cols=np.where(pm.any(0))[0]
  topb=np.full(CW,np.nan); botb=np.full(CW,np.nan)
  for x in cols:
    yv=np.where(pm[:,x])[0]; yb=yv[yv>belt]
    if len(yb)>3: topb[x]=yb.min(); botb[x]=yb.max()
  idx=np.arange(CW); ok=~np.isnan(topb)
  topb=np.interp(idx,idx[ok],topb[ok]); botb=np.interp(idx,idx[ok],botb[ok])
  topb=cv2.GaussianBlur(topb[None].astype(np.float32),(0,0),25)[0]; botb=cv2.GaussianBlur(botb[None].astype(np.float32),(0,0),25)[0]
  h=topb+0.42*(botb-topb)
  t_up=np.clip((h[None,:]-yy)/np.maximum(h-topb,1)[None,:],0,1)
  t_dn=np.clip((yy-h[None,:])/np.maximum(botb-h,1)[None,:],0,1)
  E=np.where(yy<h[None,:],0.3+0.62*(1-t_up)**1.6,0.05+0.2*t_dn**2)
  E=np.where(yy<belt-2,0.9,E)  # roof/hood/upper surfaces see the bright sky
  E=cv2.GaussianBlur(E.astype(np.float32),(0,0),1.6)*(0.55+0.45*np.clip(D,0,1))
  E=np.clip(E,0,1)
  if S is None:
    Ds=cv2.GaussianBlur(D.astype(np.float32),(0,0),2.5); hp=np.clip((Ds-cv2.GaussianBlur(Ds,(0,0),10))*2.0-0.02,0,1)
    S=0.13*E**2.5+0.16*hp
  S=np.clip(S,0,1)*(paint>0.02)
  # write
  enc=lambda a: (np.clip(a,0,1)*255+0.5).astype(np.uint8)
  Image.fromarray(enc(W)).save(OUT+k+'.webp',quality=88,method=6)
  th=Image.fromarray(enc(W)).crop((100,160,1500,820)); th.thumbnail((300,150)); th.save(OUT+k+'-thumb.webp',quality=80,method=6)
  maps=np.dstack([enc(np.sqrt(np.clip(D,0,1.3)/1.3)),enc(np.sqrt(S)),enc(E)])
  maps[paint<0.01]=0
  Image.fromarray(maps).save(OUT+k+'-maps.webp',lossless=True,quality=100,method=6)
  Image.fromarray(np.dstack([enc(paint),enc(glassm),enc(rimm)])).save(OUT+k+'-mask.webp',lossless=True,quality=100,method=6)
  meta[k]=dict(paired=Bk is not None,wheels=[[round(float(x),1) for x in c] for c in wheels],belt=belt)
  print(k,'belt',belt,'paint px',int(pm.sum()),'glass px',int(glass.sum()),[os.path.getsize(OUT+k+s_)//1024 for s_ in ['.webp','-maps.webp','-mask.webp']])
json.dump(meta,open(OUT+'meta.json','w'))
