import {getDestination} from './discovery/destination-universe.js';

export const LocationPermissionState=Object.freeze({
 NOT_REQUESTED:'NOT_REQUESTED',REQUESTING:'REQUESTING',AVAILABLE_UNCONFIRMED:'AVAILABLE_UNCONFIRMED',CONFIRMED_AS_ORIGIN:'CONFIRMED_AS_ORIGIN',DENIED:'DENIED',UNAVAILABLE:'UNAVAILABLE'
});

// Coarse, checked-in city centroids support an offline city-level approximation.
// A result is accepted only within 80 km; otherwise location remains unavailable.
const CITY_CENTROIDS=Object.freeze([
 ['Birmingham',52.4862,-1.8904],['London',51.5074,-0.1278],['Paris',48.8566,2.3522],['Berlin',52.52,13.405],['Rome',41.9028,12.4964],['Madrid',40.4168,-3.7038],
 ['New York',40.7128,-74.006],['Toronto',43.6532,-79.3832],['Vancouver',49.2827,-123.1207],['Mexico City',19.4326,-99.1332],
 ['Shanghai',31.2304,121.4737],['Beijing',39.9042,116.4074],['Tokyo',35.6762,139.6503],['Osaka',34.6937,135.5023],['Seoul',37.5665,126.978],['Hong Kong',22.3193,114.1694],['Singapore',1.3521,103.8198],['Bangkok',13.7563,100.5018],
 ['Sydney',-33.8688,151.2093],['Melbourne',-37.8136,144.9631]
]);
const radians=value=>value*Math.PI/180;
const distanceKm=(a,b)=>{const dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
export function resolveKnownCity({latitude,longitude},maxDistanceKm=80){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 const ranked=CITY_CENTROIDS.map(([city,lat,lon])=>({city,distanceKm:distanceKm({lat:latitude,lon:longitude},{lat,lon})})).sort((a,b)=>a.distanceKm-b.distanceKm),best=ranked[0];
 if(!best||best.distanceKm>maxDistanceKm)return null;
 const entity=getDestination(best.city);return entity?{city:entity.canonicalName,displayNames:entity.names,confidence:best.distanceKm<=25?'city_nearby':'regional_nearby'}:null;
}
const browserPosition=geolocation=>new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:8000,maximumAge:10*60_000}));
export class LocationOriginSession {
 constructor({geolocation=globalThis.navigator?.geolocation,reverseGeocode=resolveKnownCity}={}){this.geolocation=geolocation;this.reverseGeocode=reverseGeocode;this.permissionState=LocationPermissionState.NOT_REQUESTED;this.currentLocation=null;this.travelOrigin={status:'unknown',city:null,source:null,confidence:null,confirmed:false};}
 snapshot(){return {permissionState:this.permissionState,currentLocation:this.currentLocation?{city:this.currentLocation.city,source:'browser_geolocation',confidence:this.currentLocation.confidence,confirmedAsOrigin:this.permissionState===LocationPermissionState.CONFIRMED_AS_ORIGIN}:null,travelOrigin:{...this.travelOrigin}};}
 async requestCurrentLocation(){
  if(this.permissionState!==LocationPermissionState.NOT_REQUESTED)return this.snapshot();
  if(!this.geolocation?.getCurrentPosition){this.permissionState=LocationPermissionState.UNAVAILABLE;return this.snapshot();}
  this.permissionState=LocationPermissionState.REQUESTING;
  try{const position=await browserPosition(this.geolocation),resolved=await this.reverseGeocode?.({latitude:position.coords.latitude,longitude:position.coords.longitude});if(!resolved?.city){this.permissionState=LocationPermissionState.UNAVAILABLE;return this.snapshot();}this.currentLocation={city:resolved.city,displayNames:resolved.displayNames||null,confidence:resolved.confidence||'city_nearby'};this.permissionState=LocationPermissionState.AVAILABLE_UNCONFIRMED;}
  catch(error){this.permissionState=error?.code===1?LocationPermissionState.DENIED:LocationPermissionState.UNAVAILABLE;}
  return this.snapshot();
 }
 confirmAsOrigin(){if(this.permissionState!==LocationPermissionState.AVAILABLE_UNCONFIRMED||!this.currentLocation)return this.snapshot();this.permissionState=LocationPermissionState.CONFIRMED_AS_ORIGIN;this.travelOrigin={status:'provided',city:this.currentLocation.city,source:'user_confirmed_current_location',confidence:this.currentLocation.confidence,confirmed:true};return this.snapshot();}
 applyExplicitOrigin(city){const canonical=getDestination(city)?.canonicalName||String(city||'').trim();if(canonical)this.travelOrigin={status:'provided',city:canonical,source:'explicit_user_input',confidence:'explicit',confirmed:true};return this.snapshot();}
 confirmedOrigin(){return this.travelOrigin.confirmed?this.travelOrigin.city:null;}
}
