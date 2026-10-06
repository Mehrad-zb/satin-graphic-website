const areas={
  toronto:/^M/,scarborough:/^M/,etobicoke:/^M/, 'north york':/^M/, 'east york':/^M/,
  vaughan:/^L(4[HJLK]|6A)/,woodbridge:/^L4[HL]/,concord:/^L4K/,thornhill:/^L[34]T/,
  markham:/^L(3[PRS]|6[BCGE])/, 'richmond hill':/^L4[BCES]/,aurora:/^L4G/,newmarket:/^L3[XY]/,
  mississauga:/^L(4[TVWXYZ]|5[A-Z])/,brampton:/^L(6[PRSTVWXYZ]|7A)/,
  oakville:/^L6[HJKLM]/,burlington:/^L7[LMNPRST]/,milton:/^L9[ET]/,
  pickering:/^L1[UVWX]/,ajax:/^L1[STZ]/,whitby:/^L1[MNPR]/,oshawa:/^L1[GHJKL]/,
  'halton hills':/^L7[GJ]/,georgetown:/^L7G/,acton:/^L7J/,clarington:/^L1[BCE]/,bowmanville:/^L1C/,courtice:/^L1E/,newcastle:/^L1B/,uxbridge:/^L9P/,georgina:/^L4P/,keswick:/^L4P/,'king city':/^L7B/,'stouffville':/^L4A/,'whitchurch stouffville':/^L4A/,'east gwillimbury':/^L9N/
};
export function isGTA(a){const city=String(a.city||'').trim().toLowerCase().replace(/[-,]+/g,' ').replace(/\s+/g,' '),postal=String(a.zip||a.postal||'').toUpperCase().replace(/\s/g,'');return a.country==='CA'&&String(a.state||a.province||'').toUpperCase()==='ON'&&/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)&&!!areas[city]?.test(postal);}
export async function shippingRates(address,parcels,env){
  const rates=[{id:'pickup',label:'Pickup at Satin',amount:0,currency:'CAD',detail:'Collect after your order is ready.'}];
  if(isGTA(address))rates.push({id:'gta-next-day',label:'GTA next business day delivery',amount:50,currency:'CAD',detail:'After production is complete. Weekends and holidays excluded.'});
  if(!env.SHIPPO_API_KEY)return {rates,carrierStatus:'not_connected',notice:'Carrier delivery rates will be available after shipping is connected. GTA eligibility is checked against city and postal code; contact Satin for other local areas.'};
  if(!parcels?.length||!env.SHIPPING_ORIGIN_JSON)return {rates,carrierStatus:'needs_package',notice:'Packed weight and dimensions must be confirmed before carrier rates can be calculated.'};
  let origin;try{origin=JSON.parse(env.SHIPPING_ORIGIN_JSON);}catch{return {rates,carrierStatus:'needs_origin',notice:'Shipping origin is awaiting confirmation.'};}
  const response=await fetch('https://api.goshippo.com/shipments/',{method:'POST',headers:{Authorization:`ShippoToken ${env.SHIPPO_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({address_from:origin,address_to:address,parcels,async:false}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {rates,carrierStatus:'unavailable',notice:'Carrier rates are temporarily unavailable. Please retry.'};
  const data=await response.json();for(const r of data.rates||[])if(/^UPS$/i.test(r.provider||'')&&r.currency==='CAD'&&Number.isFinite(Number(r.amount))&&Number(r.amount)>=0)rates.push({id:r.object_id,label:`${r.provider} · ${r.servicelevel?.name||'Delivery'}`,amount:Number(r.amount),currency:'CAD',detail:r.estimated_days?`Estimated ${r.estimated_days} business day(s) after dispatch.`:'Delivery estimate supplied by carrier.'});
  return {rates,carrierStatus:'connected',notice:rates.length===1?'No carrier rates available for this address.':''};
}
