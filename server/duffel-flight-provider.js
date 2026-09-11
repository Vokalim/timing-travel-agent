import {resolveLocation} from './location-resolver.js';
import {CurrencyConversionRequiredError,partitionByCny} from './currency-normalizer.js';

export class DuffelProviderError extends Error {
  constructor(code,message,status=503) { super(message); this.name='DuffelProviderError'; this.code=code; this.status=status; }
}

const asNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const time = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

export function normalizeDuffelOffer(offer,origin,destination,requestLiveMode=false) {
  const amount = asNumber(offer?.total_amount);
  const currency = typeof offer?.total_currency === 'string' ? offer.total_currency.toUpperCase() : null;
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];
  if (!offer?.id || !amount || !currency || slices.length < 2) return null;
  const segments = slices.flatMap((slice,sliceIndex)=>(Array.isArray(slice.segments)?slice.segments:[]).map((segment,index)=>({
    slice:sliceIndex===0?'outbound':'return', index,
    origin:segment.origin?.iata_code || null, destination:segment.destination?.iata_code || null,
    departingAt:time(segment.departing_at), arrivingAt:time(segment.arriving_at),
    operatingCarrier:segment.operating_carrier?.name || null,
    operatingCarrierCode:segment.operating_carrier?.iata_code || null,
    marketingCarrier:segment.marketing_carrier?.name || null,
    flightNumber:segment.marketing_carrier_flight_number || null,
    overnight:Boolean(time(segment.departing_at)&&time(segment.arriving_at)&&segment.departing_at.slice(0,10)!==segment.arriving_at.slice(0,10))
  })));
  if (!segments.length || segments.some(segment=>!segment.departingAt || !segment.arrivingAt)) return null;
  const outbound = slices[0]?.segments || [], inbound = slices[1]?.segments || [];
  const stops = Math.max(Math.max(0,outbound.length-1),Math.max(0,inbound.length-1));
  const carriers = [...new Set(segments.map(s=>s.operatingCarrier).filter(Boolean))];
  return {id:offer.id,originalPrice:amount,originalCurrency:currency,stops,
    origin:origin.code,destination:destination.code,
    departureDateTime:segments.find(s=>s.slice==='outbound')?.departingAt || null,
    returnDateTime:segments.find(s=>s.slice==='return')?.departingAt || null,
    airline:carriers.join(' + ') || offer.owner?.name || 'Carrier unavailable',
    carrierCode:offer.owner?.iata_code || null,segments,provider:'duffel',source:'duffel',
    sourceMode:(typeof offer.live_mode==='boolean' ? offer.live_mode : requestLiveMode) ? 'live' : 'test',expiresAt:time(offer.expires_at)};
}

export class DuffelFlightProvider {
  constructor({token,fetchImpl=globalThis.fetch,timeoutMs=25000}={}) {
    this.token=token; this.fetchImpl=fetchImpl; this.timeoutMs=timeoutMs;
  }
  async search(request) {
    if (!this.token) throw new DuffelProviderError('MISSING_CREDENTIALS','Live flight data unavailable. DUFFEL_ACCESS_TOKEN is not configured.');
    const origin=resolveLocation(request.origin),destination=resolveLocation(request.destination);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const response=await this.fetchImpl('https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000&view=offers',{
        method:'POST',signal:controller.signal,headers:{Accept:'application/json','Accept-Encoding':'gzip','Content-Type':'application/json','Duffel-Version':'v2',Authorization:`Bearer ${this.token}`},
        body:JSON.stringify({data:{slices:[
          {origin:origin.code,destination:destination.code,departure_date:request.departure},
          {origin:destination.code,destination:origin.code,departure_date:request.returnDate}],
          passengers:[{type:'adult'}],cabin_class:'economy',max_connections:1}})
      });
      const payload=await response.json().catch(()=>null);
      if (!response.ok) throw new DuffelProviderError(response.status===429?'RATE_LIMITED':'DUFFEL_ERROR',
        response.status===429?'Live flight data unavailable. Duffel rate limit reached.':'Live flight data unavailable. Duffel rejected the search.',response.status===429?429:503);
      const offers=Array.isArray(payload?.data?.offers)?payload.data.offers:[];
      const normalized=offers.map(offer=>normalizeDuffelOffer(offer,origin,destination,payload?.data?.live_mode===true)).filter(Boolean)
        .sort((a,b)=>a.originalPrice-b.originalPrice);
      if (!normalized.length) throw new DuffelProviderError('NO_FLIGHTS','No Duffel flight offers were found for these dates.',404);
      const {scorable,unconverted}=partitionByCny(normalized);
      if (!scorable.length) throw new CurrencyConversionRequiredError(unconverted);
      return {source:'duffel',currency:'CNY',sourceMode:scorable.some(q=>q.sourceMode==='live')?'live':'test',
        quotes:scorable.slice(0,20),unconverted:unconverted.slice(0,20)};
    } catch(error) {
      if (error instanceof DuffelProviderError || error instanceof CurrencyConversionRequiredError || error.code==='LOCATION_UNRESOLVED') throw error;
      throw new DuffelProviderError(controller.signal.aborted?'TIMEOUT':'DUFFEL_UNAVAILABLE','Live flight data unavailable. Duffel could not complete the search.');
    } finally { clearTimeout(timer); }
  }
}
