import sys,os,json,glob
sys.path.insert(0,'/tmp/claude-0/xp/glass')
from g import glass
import numpy as np
from PIL import Image
from scipy import ndimage as nd
d='/home/claude/hp/pkg/new.satingraphic.ca/studio/mockups/vehicles/g'
done=[]
for f in sorted(glob.glob(d+'/*-veil.webp')):
    base=os.path.basename(f)[:-10]
    if base.endswith('-top'): continue
    try: k,_=glass(base,d)
    except Exception as e: print('ERR',base,e); continue
    if k.sum()<2000: continue
    soft=nd.gaussian_filter(k.astype(float),1.2)
    ph=np.array(Image.open(f'{d}/{base}.webp').convert('RGB')).astype(float)
    lum=ph.mean(-1,keepdims=True)
    light=170+0.3*lum
    gp=ph*(1-soft[...,None])+np.repeat(light,3,-1)*soft[...,None]
    Image.fromarray(gp.clip(0,255).astype('uint8')).save(f'{d}/{base}-gp.webp',quality=82,method=6)
    veil=np.array(Image.open(f).convert('RGBA')).astype(float)
    veil[...,3]=veil[...,3]*(1-soft)
    Image.fromarray(veil.astype('uint8'),'RGBA').save(f'{d}/{base}-gv.webp',quality=85,method=6)
    m=np.array(Image.open(f'{d}/{base}-mask.webp').convert('RGBA')).astype(float)
    a=np.maximum(m[...,3],soft*255); m[...,:3]=255; m[...,3]=a
    Image.fromarray(m.astype('uint8'),'RGBA').save(f'{d}/{base}-gm.webp',quality=85,method=6)
    done.append(base)
json.dump(done,open('/tmp/claude-0/xp/glass/done.json','w'))
print(len(done))
