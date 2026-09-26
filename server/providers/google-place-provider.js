import {PlaceProvider} from './place-provider.js';
import {ProviderError} from '../provider-controls.js';
import {canonicalCoordinates,normalizeCanonicalPoi} from '../../dist/lib/models/canonical-poi.js';

const category=(types=[])=>types.includes('museum')?'museum':types.some(type=>type.includes('park')||type.includes('natural'))?'nature':types.some(type=>type.includes('market')||type.includes('restaurant'))?'food':types.some(type=>type.includes('shopping'))?'shopping':'culture';
export class GooglePlaceProvider extends PlaceProvider{
 constructor({apiKey,fetchImpl=globalThis.fetch,controller}){super();this.apiKey=apiKey;this.fetchImpl=fetchImpl;this.controller=controller;this.provider='google';}
 assertConfigured(){if(!this.apiKey)throw new ProviderError('GOOGLE_NOT_CONFIGURED','Google place data is not configured.',503);}
 normalizePlace(place,context){const display=place.displayName?.text||'';return normalizeCanonicalPoi({id:`google:${place.id}`,provider:this.provider,providerPlaceId:place.id,canonicalName:display,displayName:display,names:{zh:display,en:display},destinationId:context.destinationId,category:category(place.types||[]),coordinates:canonicalCoordinates(place.location?.latitude,place.location?.longitude,'WGS84'),sourceAttribution:{provider:'Google Maps',required:true},dataFetchedAt:context.dataFetchedAt});}
 async searchDestinationPOIs(request){this.assertConfigured();const queries=[...(request.categories||[])].slice(0,3);if(!queries.length)queries.push('top sights');const results=[];
  for(const intent of queries){const response=await this.controller.run(request.sessionId,'place',signal=>this.fetchImpl('https://places.googleapis.com/v1/places:searchText',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.apiKey,'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.primaryType,places.types'},body:JSON.stringify({textQuery:`${intent.replaceAll('_',' ')} in ${request.destinationName}`,languageCode:request.locale?.startsWith('zh')?'zh-CN':'en',maxResultCount:8})}));
   if(!response.ok)throw new ProviderError('GOOGLE_REQUEST_FAILED','Google place data is unavailable.',response.status===429?429:503);const body=await response.json();for(const place of body.places||[])results.push(this.normalizePlace(place,{destinationId:request.destinationId,dataFetchedAt:new Date().toISOString()}));
  }
  return [...new Map(results.map(item=>[item.providerPlaceId,item])).values()].slice(0,24);
 }
 async resolvePlace(request){const [place]=await this.searchDestinationPOIs({...request,categories:[request.query]});return place||null;}
}
