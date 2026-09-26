import {providerLimits,ProviderRequestController,ProviderMemoryCache,ProviderError} from './provider-controls.js';
import {GooglePlaceProvider} from './providers/google-place-provider.js';
import {AMapPlaceProvider} from './providers/amap-place-provider.js';
import {GoogleRouteProvider} from './providers/google-route-provider.js';
import {AMapRouteProvider} from './providers/amap-route-provider.js';
import {routeSegmentKey} from '../dist/lib/models/route-segment.js';

const safeError=error=>({error:{code:error.code||'PROVIDER_UNAVAILABLE',message:error.message||'Live place data is unavailable.'}});
const string=(value,max=100)=>typeof value==='string'&&value.trim()&&value.length<=max?value.trim():null;
const providerFor=countryCode=>countryCode==='CN'?'amap':'google';
const allowedCategories=new Set(['culture','museum','nature','food','shopping','photography','relaxation','nightlife','beach','hiking']);

export function createPlaceRouteApi({env=process.env,fetchImpl=globalThis.fetch,now}={}){
 const limits=providerLimits(env),controller=new ProviderRequestController({limits,now}),cache=new ProviderMemoryCache({now});
 const placeProviders={google:new GooglePlaceProvider({apiKey:env.GOOGLE_MAPS_API_KEY,fetchImpl,controller}),amap:new AMapPlaceProvider({apiKey:env.AMAP_WEB_SERVICE_KEY,fetchImpl,controller})};
 const routeProviders={google:new GoogleRouteProvider({apiKey:env.GOOGLE_MAPS_API_KEY,fetchImpl,controller}),amap:new AMapRouteProvider({apiKey:env.AMAP_WEB_SERVICE_KEY,fetchImpl,controller})};
 const pilots=new Set(String(env.LIVE_POI_PILOT_DESTINATIONS||'paris,tokyo,shanghai').toLowerCase().split(',').map(value=>value.trim()).filter(Boolean));
 const api={
  async discover(body){const sessionId=string(body?.sessionId,120),destinationId=string(body?.destinationId),destinationName=string(body?.destinationName),countryCode=string(body?.countryCode,3),locale=string(body?.locale,10)||'en';if(!sessionId||!destinationId||!destinationName||!countryCode)throw new ProviderError('INVALID_REQUEST','A trip session and canonical destination are required.',400);if(!pilots.has(destinationId.toLowerCase()))throw new ProviderError('PILOT_UNAVAILABLE','Live place data is not enabled for this destination yet.',409);
   const provider=providerFor(countryCode),categories=[...new Set((body.categories||[]).filter(item=>allowedCategories.has(item)))].slice(0,3),key=`places:${provider}:${destinationId}:${locale}:${categories.join(',')}`,cached=cache.get(key);if(cached)return {...cached,cacheStatus:'permitted_memory_cache'};
   const places=await placeProviders[provider].searchDestinationPOIs({sessionId,destinationId,destinationName,countryCode,locale,categories});if(!places.length)throw new ProviderError('NO_PLACES','No verified live places were found.',404);
   return cache.set(key,{status:'success',source:'live',provider,verificationState:'LIVE_VERIFIED',places,attribution:provider==='google'?{provider:'Google Maps',required:true}:{provider:'高德地图',required:true}},'place');
  },
  async routes(body){const sessionId=string(body?.sessionId,120),provider=body?.provider,segments=Array.isArray(body?.segments)?body.segments:[];if(!sessionId||!['google','amap'].includes(provider)||!segments.length||segments.length>limits.maxRouteRequestsPerSession)throw new ProviderError('INVALID_REQUEST','Valid adjacent walking segments are required.',400);
   const expectedSystem=provider==='amap'?'GCJ02':'WGS84',results=[];for(const segment of segments){const origin=segment?.origin,destination=segment?.destination;if(!origin?.providerPlaceId||!destination?.providerPlaceId||origin.provider!==provider||destination.provider!==provider||origin.coordinates?.coordinateSystem!==expectedSystem||destination.coordinates?.coordinateSystem!==expectedSystem)throw new ProviderError('COORDINATE_SYSTEM_MISMATCH','Route coordinates do not match the selected provider.',400);
    const key=routeSegmentKey({provider,originPlaceId:origin.providerPlaceId,destinationPlaceId:destination.providerPlaceId,mode:'walking'}),cached=cache.get(`route:${sessionId}:${key}`);if(cached){results.push(cached);continue;}const route=await routeProviders[provider].routeSegment({sessionId,origin,destination,mode:'walking',locale:body.locale||'en'});cache.set(`route:${sessionId}:${key}`,route,'route');results.push(route);
   }return {status:'success',source:'live',provider,verificationState:'LIVE_VERIFIED',segments:results};
  },
  async handle(request,kind){try{const body=await request.json();return Response.json(kind==='places'?await api.discover(body):await api.routes(body));}catch(error){return Response.json(safeError(error),{status:error.status||503});}}
 };return api;
}

export {providerFor};
