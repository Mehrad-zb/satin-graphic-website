from pathlib import Path
root=Path('.')
def edit(p,old,new):
 s=Path(p).read_text();assert old in s,(p,old[:100]);Path(p).write_text(s.replace(old,new))
# SVG uploads are validated as inert vector artwork before they enter storage.
p='dist/server/studio.mjs'
s=Path(p).read_text();s=s.replace("throw Error('Upload PNG, JPG, WebP or PDF files.');","const svg=new TextDecoder().decode(data);if(/^(?:\\s*<\\?xml[^>]*>\\s*)?\\s*<svg[\\s>]/i.test(svg)){if(/<!DOCTYPE|<!ENTITY|<(?:script|foreignObject|iframe|object|embed|image|use|style|animate|set)\\b|\\bon[a-z]+\\s*=|(?:href|src)\\s*=|url\\s*\\(|javascript:/i.test(svg))throw Error('SVG must contain self-contained vector paths without scripts or external assets.');return 'image/svg+xml';}throw Error('Upload PNG, JPG, WebP, SVG or PDF files.');")
s=s.replace("type=mime(data);if(usage", "type=mime(data);const product=clean(form.get('product'),120);if((product.startsWith('apparel-')||product==='dtf-transfers')&&!['image/png','image/svg+xml'].includes(type))throw Error('Apparel artwork must be PNG or SVG.');if(product==='wallpaper-custom'&&!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Upload an image for your wallpaper.');if(usage")
Path(p).write_text(s)
# Checkout accepts all purchasable configured products and validates their authoritative rule.
p='dist/server/checkout/routes.mjs';s=Path(p).read_text()
s=s.replace("const size=product.sizes[index]||product.sizes[0];", "const size=product.sizes?.[index]||product.sizes?.[0]||{width:values.width||1,height:values.height||1};if(rule.customSizeValue===values.size){size.width=values.width;size.height=values.height;}")
s=s.replace("function complete(item){return item.reports?.length&&item.reports.every(r=>r.status!=='rejected')&&item.reports.reduce((n,r)=>n+r.pageCount,0)===item.spec.sides;}","function complete(item){return item.designRequested||item.artworkAccepted===true;}")
s=s.replace("if(!url.pathname.startsWith('/api/checkout/'))return null;","if(!url.pathname.startsWith('/api/checkout/')&&url.pathname!=='/api/artwork/check')return null;")
needle="const row=await env.DB.prepare('SELECT * FROM checkout_drafts WHERE session_id = ?')"
pos=s.index(needle)
s=s[:pos]+"if(url.pathname==='/api/artwork/check'){const v=await input(request),rule=await getRule(env.DB,v.ruleId);if(!rule)throw Error('Product unavailable.');const values=answers(rule,v.values),product=PRODUCTS.find(p=>p.ruleId===rule.id)||{};if(!Array.isArray(v.fileIds)||v.fileIds.length>30)throw Error('Choose up to 30 files.');const item={fileIds:v.fileIds,spec:specification(product,rule,values)};const results=[];for(const id of v.fileIds){const file=await fileRow(env.DB,id,s.id,false);if(file.mime==='application/pdf'){try{results.push(...await reports({...item,fileIds:[id]},s,env));}catch(e){results.push({id,name:file.name,status:'review',message:e.message});}}else results.push({id,name:file.name,status:'review',message:'Image/vector upload saved. Dimensions, resolution, colour and cutting paths require production review.'});}return j({reports:results});}\n "+s[pos:]
s=s.replace("const initialCount=draft.items.length;", "const catalog=await publicProducts(env.DB);const initialCount=draft.items.length;")
s=s.replace("const product=PRODUCTS.find(p=>p.ruleId===a.pricing?.ruleId&&p.group==='Offset print');if(!product)continue;", "const configured=catalog.find(p=>p.ruleId===a.pricing?.ruleId);if(!configured||!/(?:\\/print-shop\\/|\\/wallpaper|\\/window-graphics|\\/apparel|\\/shop\\/)/.test(configured.path))continue;const product={...PRODUCTS.find(p=>p.ruleId===configured.ruleId),...configured};")
s=s.replace("if(price.net<=(a.pricing.values?.design?Number(rule.constants.designFee||100)*100:0))", "if(price.net<=0||(rule.customSizeValue===a.pricing.values?.size&&price.net<=(a.pricing.values?.design?Number(rule.constants.designFee||100)*100:0)))")
s=s.replace("const fileIds=a.artwork?.fileId?[a.artwork.fileId]:[];", "const fileIds=Array.isArray(a.artwork?.fileIds)?[...new Set(a.artwork.fileIds)].slice(0,30):a.artwork?.fileId?[a.artwork.fileId]:[];")
s=s.replace("reports:[],proof:false", "reports:[],artworkAccepted:a.artworkAccepted===true,proof:false")
s=s.replace("v.fileIds.length>item.spec.sides", "v.fileIds.length>30")
s=s.replace("if(v.proof===true){if(!complete(item))throw Error('Upload the required PDF pages with matching dimensions first.');", "if(v.proof===true){if(!item.fileIds.length)throw Error('Upload artwork first.');item.artworkAccepted=true;")
Path(p).write_text(s)
p='dist/server/checkout/payments.mjs';s=Path(p).read_text();start=s.index('const complete=');end=s.index('\n',start);s=s[:start]+"const complete=i=>i.designRequested||i.artworkAccepted===true;"+s[end:];s=s.replace('Complete artwork confirmation, address and shipping first.','Confirm your artwork on the product page, then complete address and shipping.');Path(p).write_text(s)
# The checkout stage sequence begins with Cart; proof lives on the product page.
p='dist/client/checkout/checkout.mjs';s=Path(p).read_text();s=s.replace("const labels=['Artwork','Proof','Cart','Shipping','Payment'];","const labels=['Cart','Shipping','Payment'];").replace('complete=i=>i.designRequested||i.proof','complete=i=>i.designRequested||i.artworkAccepted===true')
s=s.replace('[artwork,proof,cart,shipping,payment][stage]()','[cart,shipping,payment][stage]()').replace('if(stage===1)previews(item());if(stage===2)','if(stage===0)')
a=s.index('function canVisit(');b=s.index('\n',a);s=s[:a]+"function canVisit(n){return n===0||n===1&&draft().items.every(complete)||n===2&&draft().address&&draft().shipping&&draft().items.every(complete);}"+s[b:]
s=s.replace("if(stage===0)stage=item().designRequested?2:1;else if(stage===2)stage=3;else if(stage===3)stage=4;","stage=Math.min(2,stage+1);")
s=s.replace('stage=4','stage=2').replace('if(draft().items.every(complete)&&draft().items.length)stage=2;','')
s=s.replace('<button class="delete" data-review="${n}">Review / re-upload file</button>','<a class="delete" href="${esc(i.path)}">Edit product / artwork</a>')
s=s.replace("i.proof?'Files confirmed · production preflight pending':'Artwork confirmation required'","i.artworkAccepted?'Artwork accepted · production review pending':'Confirm artwork on the product page'")
s=s.replace('Your print cart is empty','Your cart is empty').replace('Choose business cards','Browse products').replace('/satin/print-shop/offset/business-cards/','/satin/shop/')
Path(p).write_text(s)
# Required contact fields and optional quote documents.
p='dist/client/satin/assets/satin.9464926f1bc9.js';s=Path(p).read_text()
s=s.replace('["Coverage", ["Full Vehicle Wrap", "Decals + Lettering", "Partial Wrap", "Half / ¾ Wrap", "Full Wrap", "Colour Change", "Paint Protection Film"]]', '["Wrap type", ["Commercial", "Color change", "Paint protection"]], ["Coverage", ["Full Wrap", "Decals + Lettering", "Partial Wrap", "¾ Wrap"]]')
s=s.replace('["Product", ["Window Decals", "Frosted Vinyl", "Perforated Vinyl", "Full Window Graphics"]]', '["Product", ["Window Decals", "Frosted Vinyl", "Perforated Vinyl", "Full Window Graphics"]], ["Material", ["Regular vinyl", "Blackout film · grey adhesive", "Clear film", "Perforated vinyl", "Single-colour calendered vinyl", "Full-colour digital print"]]')
s=s.replace('id="q-phone" type="tel" autocomplete','id="q-phone" type="tel" required autocomplete')
s=s.replace('</div><p class="small">Send artwork or photos to info@satingraphic.ca after submitting, with your request reference.</p>', '</div><label class="field">Add document (optional)<input id="q-document" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,image/svg+xml"></label><p class="small">Share a design, sample or supporting document. Support: info@satingraphic.ca.</p>')
s=s.replace(' : "";\n  if (err)', ' : !Q.contact.phone ? "Add your contact phone number." : "";\n  if (err)')
s=s.replace("const details=Object.fromEntries(Object.entries(Q.details)","const attachments=[];const documents=[...m.querySelector('#q-document').files];if(documents.length){await fetch('/api/studio/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});for(const file of documents){const fd=new FormData();fd.set('file',file);const rr=await fetch('/api/studio/upload',{method:'POST',body:fd}),d=await rr.json();if(!rr.ok)throw Error(d.error);attachments.push(d.file.id);}}\n   const details=Object.fromEntries(Object.entries(Q.details)")
s=s.replace('...Q.contact,details,consent:true','...Q.contact,details,attachments,consent:true')
s=s.replace('function quoteNeedsDesign()',"window.satinOpenQuote=openQuote;\nfunction quoteNeedsDesign()")
Path(p).write_text(s)
p='dist/server/index.js';s=Path(p).read_text();s="import {session,fileRow} from './studio.mjs';\n"+s;s=s.replace("||!service||v.consent", "||text(v.phone,40).length<7||!service||v.consent")
s=s.replace("const details=JSON.stringify({services:[service]", "const attachments=[];if(v.attachments?.length){const owner=await session(request,env.DB);if(!owner||!Array.isArray(v.attachments)||v.attachments.length>10)throw Error('Invalid documents');for(const id of v.attachments){const f=await fileRow(env.DB,id,owner.id,false);attachments.push({id:f.id,name:f.name,mime:f.mime});}}\n    const details=JSON.stringify({attachments,services:[service]")
Path(p).write_text(s)
