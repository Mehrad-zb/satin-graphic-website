import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
def glass(base, d):
    ph=np.array(Image.open(f'{d}/{base}.webp').convert('RGB')).astype(float)
    veil=np.array(Image.open(f'{d}/{base}-veil.webp').convert('RGBA')).astype(float)
    body=np.array(Image.open(f'{d}/{base}-mask.webp').convert('RGBA'))[...,3]>128
    body=nd.binary_closing(body,iterations=2)
    h,w=body.shape
    corners=np.concatenate([ph[:20,:20].reshape(-1,3),ph[:20,-20:].reshape(-1,3),ph[:60,w//2-10:w//2+10].reshape(-1,3)])
    bg=np.median(corners,0)
    diff=np.abs(ph-bg).max(-1)
    veh=(diff>18)|body
    veh=nd.binary_opening(veh,iterations=2)
    lab,n=nd.label(veh); 
    if n: sizes=nd.sum(veh,lab,range(1,n+1)); veh=lab==(np.argmax(sizes)+1)
    sil=nd.binary_fill_holes(nd.binary_closing(veh,iterations=4))
    rgb=ph; mx=rgb.max(-1); mn=rgb.min(-1); sat=(mx-mn)/(mx+1)
    ys,xs=np.nonzero(sil); y0,y1=ys.min(),ys.max(); H=y1-y0+1
    top='-top' in base; fr='-front' in base or '-rear' in base
    cand=sil&~body&(sat<0.2)&(mx<200)
    cand0=cand
    cand=nd.binary_opening(cand,structure=np.ones((3,3)),iterations=6)
    lab,n=nd.label(cand); keep=np.zeros_like(cand); info=[]
    for i,sl in enumerate(nd.find_objects(lab),1):
        comp=lab[sl]==i; area=comp.sum(); cy=(sl[0].start+sl[0].stop)/2
        bh=sl[0].stop-sl[0].start; bw=sl[1].stop-sl[1].start
        rel=(cy-y0)/H; v=mx[sl][comp].mean()
        cx=(sl[1].start+sl[1].stop)/2; X0,X1=xs.min(),xs.max(); W=X1-X0; relx=(cx-X0)/W
        fill=area/(bh*bw)
        ok= area>0.004*sil.sum() and min(bh,bw)>0.035*H and 35<v<(190 if top else 215) and fill>0.35 and (top or rel<((0.45 if base.split('-')[0] in ('box','cube','step') else 0.36) if fr else 0.5)) and (fr or top or 0.12<relx<0.92) and (not fr or bw>0.3*W)
        if area>0.002*sil.sum(): info.append((round(area/sil.sum(),3),round(rel,2),int(v),ok))
        if ok: keep[sl]|=comp
    keep=nd.binary_dilation(keep,iterations=7)&cand0
    keep=nd.binary_fill_holes(keep)
    keep=nd.binary_dilation(keep,iterations=2)&~body&sil
    return keep,info
if __name__=='__main__':
    d=sys.argv[1]
    for base in sys.argv[2:]:
        k,info=glass(base,d)
        ph=Image.open(f'{d}/{base}.webp').convert('RGB'); o=np.array(ph).astype(float)
        o[k]=o[k]*0.4+np.array([255,0,0])*0.6
        im=Image.fromarray(o.astype('uint8')); im.thumbnail((512,342)); im.save(f'/tmp/claude-0/xp/glass/{base}.jpg')
        print(base,info)
