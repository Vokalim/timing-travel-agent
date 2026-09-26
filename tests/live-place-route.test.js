import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlaceRouteApi,providerFor} from '../server/place-route-api.js';
import {GooglePlaceProvider} from '../server/providers/google-place-provider.js';
import {AMapPlaceProvider} from '../server/providers/amap-place-provider.js';
import {ProviderRequestController,providerLimits} from '../server/provider-controls.js';
import {canonicalCoordinates,normalizeCanonicalPoi} from '../dist/lib/models/canonical-poi.js';
import {normalizeRouteSegment} from '../dist/lib/models/route-segment.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {renderTravelFootprintMap} from '../dist/trip-view.js';
import {LivePlaceRouteClient} from '../dist/lib/providers/live-place-route.js';

const googlePlace={id:'g-louvre',displayName:{text:'Louvre Museum'},location:{latitude:48.8606,longitude:2.3376},types:['museum']};
const amapPlace={id:'a-bund',name:'外滩',location:'121.4903,31.2417',type:'风景名胜'};
const controller=()=>new ProviderRequestController({limits:providerLimits({MAX_EXTERNAL_REQUESTS_PER_DAY:100})});

test('Google and AMap normalize minimal place fields with explicit coordinate systems',()=>{
 const google=new GooglePlaceProvider({apiKey:'test',controller:controller()}).normalizePlace(googlePlace,{destinationId:'paris'});
 const amap=new AMapPlaceProvider({apiKey:'test',controller:controller()}).normalizePlace(amapPlace,{destinationId:'shanghai'});
 assert.equal(google.coordinates.coordinateSystem,'WGS84');assert.equal(amap.coordinates.coordinateSystem,'GCJ02');
 assert.equal(google.rating,null);assert.equal(amap.openingHours,null);assert.equal(google.providerPlaceId,'g-louvre');
 assert.equal(providerFor('CN'),'amap');assert.equal(providerFor('JP'),'google');assert.equal(providerFor('HK'),'google');assert.equal(providerFor('MO'),'google');
});

test('place API routes mainland China to AMap and international destinations to Google',async()=>{
 const calls=[];const fetchImpl=async(url)=>{calls.push(String(url));return String(url).includes('amap.com')?{ok:true,json:async()=>({status:'1',pois:[amapPlace]})}:{ok:true,json:async()=>({places:[googlePlace]})};};
 const api=createPlaceRouteApi({env:{GOOGLE_MAPS_API_KEY:'g',AMAP_WEB_SERVICE_KEY:'a'},fetchImpl});
 const paris=await api.discover({sessionId:'p',destinationId:'paris',destinationName:'Paris',countryCode:'FR',categories:['culture']});
 const shanghai=await api.discover({sessionId:'s',destinationId:'shanghai',destinationName:'Shanghai',countryCode:'CN',categories:['culture']});
 assert.equal(paris.provider,'google');assert.equal(shanghai.provider,'amap');assert.ok(calls.some(url=>url.includes('places.googleapis.com')));assert.ok(calls.some(url=>url.includes('restapi.amap.com')));
});

test('coordinate systems cannot cross provider route boundaries',async()=>{
 const api=createPlaceRouteApi({env:{GOOGLE_MAPS_API_KEY:'g'},fetchImpl:async()=>{throw new Error('must not fetch');}}),origin={provider:'google',providerPlaceId:'a',coordinates:canonicalCoordinates(1,2,'GCJ02')},destination={provider:'google',providerPlaceId:'b',coordinates:canonicalCoordinates(2,3,'GCJ02')};
 await assert.rejects(api.routes({sessionId:'x',provider:'google',segments:[{origin,destination}]}),{code:'COORDINATE_SYSTEM_MISMATCH'});
});

test('provider timeout and session quota fail closed with sanitized states',async()=>{
 const slow=createPlaceRouteApi({env:{GOOGLE_MAPS_API_KEY:'g',PROVIDER_TIMEOUT_MS:'2'},fetchImpl:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('secret'),{name:'AbortError'}))))});
 await assert.rejects(slow.discover({sessionId:'slow',destinationId:'paris',destinationName:'Paris',countryCode:'FR',categories:['culture']}),{code:'PROVIDER_TIMEOUT'});
 const quota=createPlaceRouteApi({env:{GOOGLE_MAPS_API_KEY:'g',MAX_PLACE_REQUESTS_PER_SESSION:'1'},fetchImpl:async()=>({ok:true,json:async()=>({places:[googlePlace]})})});
 await assert.rejects(quota.discover({sessionId:'quota',destinationId:'paris',destinationName:'Paris',countryCode:'FR',categories:['culture','nature']}),{code:'SESSION_QUOTA_EXHAUSTED'});
});

test('missing keys preserve startup and explicit fallback eligibility',async()=>{
 const api=createPlaceRouteApi({env:{},fetchImpl:async()=>{throw new Error('must not fetch');}});assert.ok(api);
 await assert.rejects(api.discover({sessionId:'no-key',destinationId:'tokyo',destinationName:'Tokyo',countryCode:'JP',categories:['culture']}),{code:'GOOGLE_NOT_CONFIGURED'});
 const session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:'Tokyo',nights:1}});assert.equal(session.experience.itinerary.placeSource,'curated');
});

const livePlace=(id,lat,lng)=>normalizeCanonicalPoi({id:`google:${id}`,provider:'google',providerPlaceId:id,canonicalName:id,displayName:id,names:{zh:id,en:id},destinationId:'paris',category:'culture',coordinates:canonicalCoordinates(lat,lng,'WGS84')});
const segment=(from,to)=>normalizeRouteSegment({provider:'google',originPlaceId:from,destinationPlaceId:to,mode:'walking',distanceMeters:1000,durationMinutes:12,coordinateSystem:'WGS84'});

test('adjacent route cache survives edits and only the new neighboring segment is requested',()=>{
 const session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:'Paris',nights:1},sessionId:'edit'}),places=[livePlace('a',48.85,2.32),livePlace('b',48.86,2.33),livePlace('c',48.87,2.34)];session.applyProviderPlaces(places);
 assert.deepEqual(session.missingAdjacentRouteSegments().map(item=>`${item.origin.providerPlaceId}-${item.destination.providerPlaceId}`),['a-b','b-c']);session.applyRouteSegments([segment('a','b'),segment('b','c')]);assert.equal(session.missingAdjacentRouteSegments().length,0);
 const middle=session.experience.itinerary.days[0].activities[1];session.removeActivity(1,middle.id);assert.deepEqual(session.missingAdjacentRouteSegments().map(item=>`${item.origin.providerPlaceId}-${item.destination.providerPlaceId}`),['a-c']);assert.ok(session.routeSegments.has('google:a:b:walking'));
});

test('provider coordinates drive the footprint map and mixed coordinate systems use schematic fallback',()=>{
 const activities=[livePlace('a',48.85,2.32),livePlace('b',48.87,2.35)].map((place,index)=>({id:`x${index}`,place})),day={day:1,activities};const html=renderTravelFootprintMap(day,'en');assert.match(html,/data-route-state="coordinates"/);assert.match(html,/data-coordinate-system="WGS84"/);
 activities[1].place={...activities[1].place,coordinates:canonicalCoordinates(31.2,121.4,'GCJ02')};assert.match(renderTravelFootprintMap(day,'en'),/data-route-state="schematic"/);
});

test('route endpoint caches adjacent segments within the session',async()=>{
 let calls=0;const api=createPlaceRouteApi({env:{GOOGLE_MAPS_API_KEY:'g'},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({routes:[{distanceMeters:800,duration:'600s',polyline:{encodedPolyline:'abc'}}]})};}}),origin=livePlace('a',1,2),destination=livePlace('b',2,3),body={sessionId:'cache',provider:'google',segments:[{origin,destination}]};
 const first=await api.routes(body),second=await api.routes(body);assert.equal(first.segments[0].key,second.segments[0].key);assert.equal(calls,1);
});

test('browser client sends no provider credentials and static client contains no server env access',async()=>{
 const client=new LivePlaceRouteClient({fetchImpl:async(url,options)=>{assert.equal(url,'/api/travel/places/discover');assert.deepEqual(options.headers,{'Content-Type':'application/json'});assert.doesNotMatch(options.body,/api.?key|authorization/i);return {ok:true,json:async()=>({places:[]})};}});await client.discover({sessionId:'safe',destinationId:'paris'});
 const source=await readFile(new URL('../dist/lib/providers/live-place-route.js',import.meta.url),'utf8');assert.doesNotMatch(source,/process\.env|GOOGLE_MAPS_API_KEY|AMAP_WEB_SERVICE_KEY/);
});
