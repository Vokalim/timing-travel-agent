import test from 'node:test';
import assert from 'node:assert/strict';
import {LocationOriginSession,LocationPermissionState,resolveKnownCity} from '../dist/lib/location-origin.js';
import {InspirationService} from '../dist/lib/discovery/inspiration-service.js';
import {parseLiveTravelSignal} from '../dist/trip-input.js';
import {discoverDestinations,DemoDestinationDiscoveryService} from '../dist/lib/discovery/destination-discovery.js';
import {destinationContinent} from '../dist/lib/discovery/destination-geography.js';
import {getDestination} from '../dist/lib/discovery/destination-universe.js';

const now=new Date('2026-10-03T00:00:00Z');
const continent=item=>destinationContinent(getDestination(item));

test('fresh and vague signals keep origin unknown and offer only geography-neutral continuations',async()=>{
 const session=new LocationOriginSession({geolocation:null});
 assert.equal(session.snapshot().travelOrigin.status,'unknown');assert.equal(session.snapshot().permissionState,LocationPermissionState.NOT_REQUESTED);
 for(const text of ['', '我想出去玩']){
  const draft=text?await parseLiveTravelSignal(text):{interpretation:{}};
  const pool=new InspirationService({seed:3}).getEligiblePool({text,preferences:draft.interpretation,now});
  assert.ok(pool.every(item=>!item.region&&!item.requiresOrigin));
  assert.ok(pool.every(item=>!/(北美|欧洲周末|上海周边|日本短途|火车可达)/.test(item.zh)));
 }
});

test('browser location remains unconfirmed until the user accepts it',async()=>{
 let requests=0;const geolocation={getCurrentPosition(success){requests++;success({coords:{latitude:52.4862,longitude:-1.8904}});}};
 const session=new LocationOriginSession({geolocation});
 await session.requestCurrentLocation();const pending=session.snapshot();
 assert.equal(pending.permissionState,LocationPermissionState.AVAILABLE_UNCONFIRMED);assert.equal(pending.currentLocation.city,'Birmingham');
 assert.equal(pending.currentLocation.confirmedAsOrigin,false);assert.equal(pending.travelOrigin.status,'unknown');
 session.confirmAsOrigin();const confirmed=session.snapshot();
 assert.equal(confirmed.permissionState,LocationPermissionState.CONFIRMED_AS_ORIGIN);assert.equal(confirmed.travelOrigin.city,'Birmingham');assert.equal(confirmed.travelOrigin.source,'user_confirmed_current_location');
 assert.equal(requests,1);
});

test('explicit origin immediately overrides a confirmed current location',()=>{
 const session=new LocationOriginSession();session.currentLocation={city:'Birmingham',confidence:'city_nearby'};session.permissionState=LocationPermissionState.AVAILABLE_UNCONFIRMED;session.confirmAsOrigin();session.applyExplicitOrigin('Shanghai');
 assert.deepEqual(session.snapshot().travelOrigin,{status:'provided',city:'Shanghai',source:'explicit_user_input',confidence:'explicit',confirmed:true});
 assert.equal(session.snapshot().currentLocation.city,'Birmingham');
});

test('explicit Europe guides discovery while origin remains unknown',async()=>{
 const draft=await parseLiveTravelSignal('想去欧洲，小城市也可以');assert.equal(draft.interpretation.origin,null);assert.deepEqual(draft.interpretation.constraints.strong.preferredRegions,['europe']);
 const ideas=new InspirationService({seed:5}).getEligiblePool({text:'想去欧洲，小城市也可以',preferences:draft.interpretation,now});assert.ok(ideas.some(item=>item.region==='europe'));
 const result=await discoverDestinations({...draft.interpretation,notes:draft.fields.notes,durationDays:5},{mode:'demo',now,discoveryService:new DemoDestinationDiscoveryService(),flightProvider:{search:async()=>[]}}),top=result.candidates.slice(0,10);
 assert.ok(top.filter(item=>continent(item)==='europe').length>=6);assert.ok(top.every(item=>item.verification.status==='not_checked'));
});

test('denied or unresolved location is not retried and never fabricates an origin',async()=>{
 let deniedCalls=0;const denied=new LocationOriginSession({geolocation:{getCurrentPosition(_success,error){deniedCalls++;error({code:1});}}});
 await denied.requestCurrentLocation();await denied.requestCurrentLocation();assert.equal(deniedCalls,1);assert.equal(denied.snapshot().permissionState,LocationPermissionState.DENIED);assert.equal(denied.confirmedOrigin(),null);
 const unresolved=new LocationOriginSession({geolocation:{getCurrentPosition(success){success({coords:{latitude:0,longitude:0}});}}});await unresolved.requestCurrentLocation();assert.equal(unresolved.snapshot().permissionState,LocationPermissionState.UNAVAILABLE);assert.equal(unresolved.snapshot().currentLocation,null);
 assert.equal(resolveKnownCity({latitude:0,longitude:0}),null);
});

test('development diagnostics distinguish current location from confirmed travel origin',async()=>{
 const locationContext={permissionState:'AVAILABLE_UNCONFIRMED',currentLocation:{city:'Birmingham',source:'browser_geolocation',confirmedAsOrigin:false},travelOrigin:{status:'unknown',city:null,source:null,confidence:null,confirmed:false}};
 const result=await discoverDestinations({origin:null,destination:null,durationDays:5,travelIntents:['food']},{debug:true,locationContext,now,discoveryService:{discover:async()=>({source:'fixture',candidates:[{city:'Paris',countryOrRegion:'France',themes:['food']}]})},flightProvider:{search:async()=>[]}});
 assert.equal(result.diagnostics.currentLocation.city,'Birmingham');assert.equal(result.diagnostics.travelOrigin.status,'unknown');assert.equal(result.diagnostics.locationPermissionState,'AVAILABLE_UNCONFIRMED');
});
