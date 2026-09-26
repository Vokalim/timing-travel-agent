import {RouteProvider} from './route-provider.js';
import {ProviderError} from '../provider-controls.js';
import {normalizeRouteSegment} from '../../dist/lib/models/route-segment.js';

const seconds=value=>Number(String(value||'0s').replace(/s$/,''));
export class GoogleRouteProvider extends RouteProvider{
 constructor({apiKey,fetchImpl=globalThis.fetch,controller}){super();this.apiKey=apiKey;this.fetchImpl=fetchImpl;this.controller=controller;this.provider='google';}
 normalizeRoute(route,context){return normalizeRouteSegment({provider:this.provider,originPlaceId:context.origin.providerPlaceId,destinationPlaceId:context.destination.providerPlaceId,mode:'walking',distanceMeters:route.distanceMeters,durationMinutes:seconds(route.duration)/60,geometry:route.polyline?.encodedPolyline||null,coordinateSystem:'WGS84',sourceAttribution:{provider:'Google Maps',required:true}});}
 async routeSegment(request){if(!this.apiKey)throw new ProviderError('GOOGLE_NOT_CONFIGURED','Google route data is not configured.');const body={origin:{location:{latLng:{latitude:request.origin.coordinates.lat,longitude:request.origin.coordinates.lng}}},destination:{location:{latLng:{latitude:request.destination.coordinates.lat,longitude:request.destination.coordinates.lng}}},travelMode:'WALK',languageCode:request.locale?.startsWith('zh')?'zh-CN':'en'};
  const response=await this.controller.run(request.sessionId,'route',signal=>this.fetchImpl('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.apiKey,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'},body:JSON.stringify(body)}));if(!response.ok)throw new ProviderError('GOOGLE_ROUTE_FAILED','Google route data is unavailable.',response.status===429?429:503);const data=await response.json();if(!data.routes?.[0])throw new ProviderError('ROUTE_UNAVAILABLE','Walking route unavailable.',404);return this.normalizeRoute(data.routes[0],request);
 }
}
