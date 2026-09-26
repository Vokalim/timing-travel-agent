import {PlaceProvider} from './place-provider.js';
import {ProviderError} from '../provider-controls.js';
import {canonicalCoordinates,normalizeCanonicalPoi} from '../../dist/lib/models/canonical-poi.js';

const category=value=>/博物馆|文化|古迹|寺/.test(value)?'culture':/公园|自然|山|湖/.test(value)?'nature':/餐饮|美食|市场/.test(value)?'food':/购物/.test(value)?'shopping':'culture';
export class AMapPlaceProvider extends PlaceProvider{
 constructor({apiKey,fetchImpl=globalThis.fetch,controller}){super();this.apiKey=apiKey;this.fetchImpl=fetchImpl;this.controller=controller;this.provider='amap';}
 assertConfigured(){if(!this.apiKey)throw new ProviderError('AMAP_NOT_CONFIGURED','AMap place data is not configured.',503);}
 normalizePlace(place,context){const [lng,lat]=String(place.location||'').split(',').map(Number),display=place.name||'';return normalizeCanonicalPoi({id:`amap:${place.id}`,provider:this.provider,providerPlaceId:place.id,canonicalName:display,displayName:display,names:{zh:display,en:display},destinationId:context.destinationId,category:category(`${place.type||''} ${place.typecode||''}`),coordinates:canonicalCoordinates(lat,lng,'GCJ02'),sourceAttribution:{provider:'高德地图',required:true},dataFetchedAt:context.dataFetchedAt});}
 async searchDestinationPOIs(request){this.assertConfigured();const queries=[...(request.categories||[])].slice(0,3);if(!queries.length)queries.push('景点');const results=[];
  for(const intent of queries){const term={culture:'景点',food:'特色美食',nature:'公园景区',shopping:'购物'}[intent]||intent;const url=new URL('https://restapi.amap.com/v5/place/text');url.searchParams.set('key',this.apiKey);url.searchParams.set('keywords',term);url.searchParams.set('region',request.destinationName);url.searchParams.set('city_limit','true');url.searchParams.set('page_size','8');
   const response=await this.controller.run(request.sessionId,'place',signal=>this.fetchImpl(url,{signal}));if(!response.ok)throw new ProviderError('AMAP_REQUEST_FAILED','AMap place data is unavailable.',response.status===429?429:503);const body=await response.json();if(body.status!=='1')throw new ProviderError(body.info==='DAILY_QUERY_OVER_LIMIT'?'DAILY_QUOTA_EXHAUSTED':'AMAP_REQUEST_FAILED','AMap place data is unavailable.',body.info==='DAILY_QUERY_OVER_LIMIT'?429:503);
   for(const place of body.pois||[]){try{results.push(this.normalizePlace(place,{destinationId:request.destinationId,dataFetchedAt:new Date().toISOString()}));}catch{/* omit malformed provider rows */}}
  }
  return [...new Map(results.map(item=>[item.providerPlaceId,item])).values()].slice(0,24);
 }
 async resolvePlace(request){const [place]=await this.searchDestinationPOIs({...request,categories:[request.query]});return place||null;}
}
