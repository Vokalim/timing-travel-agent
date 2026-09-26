import {RouteProvider} from './route-provider.js';
import {ProviderError} from '../provider-controls.js';
import {normalizeRouteSegment} from '../../dist/lib/models/route-segment.js';

export class AMapRouteProvider extends RouteProvider{
 constructor({apiKey,fetchImpl=globalThis.fetch,controller}){super();this.apiKey=apiKey;this.fetchImpl=fetchImpl;this.controller=controller;this.provider='amap';}
 normalizeRoute(path,context){return normalizeRouteSegment({provider:this.provider,originPlaceId:context.origin.providerPlaceId,destinationPlaceId:context.destination.providerPlaceId,mode:'walking',distanceMeters:Number(path.distance),durationMinutes:Number(path.cost?.duration||path.duration)/60,geometry:(path.steps||[]).map(step=>step.polyline).filter(Boolean).join(';')||null,coordinateSystem:'GCJ02',sourceAttribution:{provider:'高德地图',required:true}});}
 async routeSegment(request){if(!this.apiKey)throw new ProviderError('AMAP_NOT_CONFIGURED','AMap route data is not configured.');const url=new URL('https://restapi.amap.com/v5/direction/walking');url.searchParams.set('key',this.apiKey);url.searchParams.set('origin',`${request.origin.coordinates.lng},${request.origin.coordinates.lat}`);url.searchParams.set('destination',`${request.destination.coordinates.lng},${request.destination.coordinates.lat}`);url.searchParams.set('show_fields','cost,polyline');
  const response=await this.controller.run(request.sessionId,'route',signal=>this.fetchImpl(url,{signal}));if(!response.ok)throw new ProviderError('AMAP_ROUTE_FAILED','AMap route data is unavailable.',response.status===429?429:503);const data=await response.json();if(data.status!=='1'||!data.route?.paths?.[0])throw new ProviderError('ROUTE_UNAVAILABLE','Walking route unavailable.',404);return this.normalizeRoute(data.route.paths[0],request);
 }
}
