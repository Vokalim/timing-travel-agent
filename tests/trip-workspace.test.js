import test from 'node:test';
import assert from 'node:assert/strict';
import {TripWorkspaceSession,revisedTripDates} from '../dist/lib/trip-workspace.js';
import {buildPoiItinerary,placeOpenAt} from '../dist/lib/poi-itinerary.js';
import {CuratedPlaceProvider,PlaceProvider,AMapPlaceProvider,GooglePlacesProvider} from '../dist/lib/providers/place-provider.js';
import {AMapNavigationProvider,GoogleNavigationProvider,navigationForCountry} from '../dist/lib/providers/navigation-provider.js';
import {renderFlightDetails,renderTripSections,renderTripTimingControls} from '../dist/trip-view.js';

const trip={origin:'Shanghai',destination:'Tokyo',nights:5,notes:'不要红眼，喜欢当地美食',travelIntents:['food'],flightBudget:4000};
const sample=(id,category='culture',areaKey='old_town',openingHours=null)=>({id,names:{zh:id,en:id},category,areaKey,openingHours,source:'mock_provider'});

test('provider-backed flight details render actual times, but missing arrival is never invented',()=>{
 const live={price:3353,currency:'CNY',stops:0,airline:'Airline',sourceMode:'live',segments:[
  {slice:'outbound',origin:'PVG',destination:'HKG',departingAt:'2026-12-12T09:20:00',arrivingAt:'2026-12-12T10:55:00'},
  {slice:'return',origin:'HKG',destination:'PVG',departingAt:'2026-12-17T18:30:00',arrivingAt:'2026-12-17T20:05:00'}]};
 const html=renderFlightDetails(live,'live','zh');assert.match(html,/09:20–10:55/);assert.match(html,/18:30–20:05/);assert.match(html,/1小时35分/);assert.match(html,/¥3,353/);
 const demo=renderFlightDetails({price:2500,currency:'CNY',stops:1,departureDateTime:'2026-12-12T09:00:00',sourceMode:'demo'},'demo','zh');
 assert.match(demo,/演示航班/);assert.match(demo,/到达时间待提供/);assert.doesNotMatch(demo,/10:55|飞行时长/);
});
test('inline date and duration changes keep route and preferences while rebuilding the trip',()=>{
 const session=new TripWorkspaceSession({trip});const html=renderTripTimingControls(session.experience,'zh');
 assert.match(html,/data-trip-action="date"/);assert.match(html,/data-trip-action="duration"/);assert.match(html,/data-trip-editor="date" hidden/);
 const original=session.experience.itinerary.days.length;session.changeDuration(7);assert.equal(session.experience.itinerary.days.length,7);assert.notEqual(original,7);
 session.changeDates('custom',{departure:'2026-12-12',returnDate:'2026-12-18'});
 assert.equal(session.trip.nights,6);assert.equal(session.trip.origin,'Shanghai');assert.equal(session.trip.destination,'Tokyo');assert.equal(session.trip.notes,trip.notes);assert.equal(session.trip.flightBudget,4000);
 assert.equal(session.flightVerification.status,'not_checked');
 const shifted=revisedTripDates(trip,{departure:'2026-12-12'},'3');assert.equal(shifted.start,'2026-12-09');assert.equal(shifted.end,'2026-12-15');
});
test('train and drive stay unpriced and unrouted when providers are absent',()=>{
 const session=new TripWorkspaceSession({trip:{...trip,destination:'Hangzhou'},flightVerification:{status:'not_checked',source:'demo'}});
 const html=renderTripSections(session.experience,'zh');assert.match(html,/实时车次与票价暂未接入/);assert.match(html,/未接入路线、路费与驾车时间/);
 for(const option of session.experience.transport.options.filter(option=>option.mode!=='flight')){assert.equal(option.price,null);assert.equal(option.schedule,null);assert.equal(option.drivingTimeMinutes,null);}
});
test('navigation adapters separate map links from verified routing metrics',()=>{
 const amap=navigationForCountry('China'),google=navigationForCountry('Japan');
 assert.ok(amap instanceof AMapNavigationProvider);assert.ok(google instanceof GoogleNavigationProvider);
 assert.match(amap.mapUrl(sample('West Lake')),/^https:\/\/uri\.amap\.com\/search\?/);
 assert.match(google.directionsUrl(sample('Sensō-ji')),/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
 assert.deepEqual(amap.route({}),{status:'unverified',distanceMeters:null,durationMinutes:null,polyline:null});
 const supplied=new GoogleNavigationProvider(()=>({status:'verified',distanceMeters:1200,durationMinutes:12,polyline:'abc'}));
 assert.equal(supplied.route({}).distanceMeters,1200);
});
test('place provider owns POI facts; missing metadata stays null',()=>{
 assert.throws(()=>new PlaceProvider().search('Tokyo'));
 const places=new CuratedPlaceProvider().search('Tokyo');assert.ok(places.length>=6);assert.ok(places.every(place=>place.openingHours===null&&place.coordinates===null&&place.rating===null));
 assert.equal(new CuratedPlaceProvider().search('Unknown Place').length,0);
 assert.throws(()=>new AMapPlaceProvider().search('Tokyo'));
 assert.deepEqual(new GooglePlacesProvider(()=>[sample('from-provider')]).search('Tokyo'),[sample('from-provider')]);
});
test('opening hours and actual route matrix constrain deterministic itinerary order',()=>{
 const closed=sample('closed','culture','a',[{open:'12:00',close:'18:00'}]);
 assert.equal(placeOpenAt(closed,'2026-12-12',570,660),false);
 const open=sample('open','culture','a',[{open:'08:00',close:'18:00'}]);
 assert.equal(placeOpenAt(open,'2026-12-12',570,660),true);
 const unknown=sample('unknown');assert.equal(placeOpenAt(unknown,'2026-12-12',570,660),null);
 const places=[sample('a','culture','a'),sample('b','culture','b'),sample('c','culture','c')];
 const matrix={'a|b':{durationMinutes:110,distanceMeters:13000},'a|c':{durationMinutes:10,distanceMeters:1000},'c|b':{durationMinutes:20,distanceMeters:2000}};
 const day=buildPoiItinerary({places,nights:1,routeMatrix:matrix}).days[0];
 assert.deepEqual(day.activities.slice(0,2).map(activity=>activity.placeId),['a','c']);
 assert.equal(day.routeState,'verified');assert.ok(day.routeDistanceMeters>0);
 assert.equal(day.activities[0].openingHoursState,'unverified');
 const checked=buildPoiItinerary({places:[closed,open],nights:1,dates:['2026-12-12']}).days[0];assert.equal(checked.activities[0].placeId,'open');
});
test('pace changes POI count and deep dive follows explicit interests',()=>{
 const places=Array.from({length:12},(_,index)=>sample(String(index).padStart(2,'0'),index%3===0?'food':'culture',`area-${index}`));
 const relaxed=buildPoiItinerary({places,nights:1,pace:'relaxed'}),intensive=buildPoiItinerary({places,nights:1,pace:'intensive'});
 assert.ok(relaxed.days[0].activities.length<intensive.days[0].activities.length);
 const deep=buildPoiItinerary({places,nights:1,pace:'deep_dive',intents:['food']});assert.equal(deep.days[0].activities[0].place.category,'food');
 const session=new TripWorkspaceSession({trip});const destination=session.trip.destination;session.changePace('relaxed');assert.equal(session.trip.destination,destination);assert.equal(session.experience.itinerary.pace,'relaxed');
 const relaxedCount=session.experience.itinerary.days.flatMap(day=>day.activities).length;session.changePace('intensive');
 assert.ok(session.experience.itinerary.days.flatMap(day=>day.activities).length>relaxedCount);
});
test('editing one day leaves unrelated days intact',()=>{
 const session=new TripWorkspaceSession({trip});const other=session.experience.itinerary.days[1],first=session.experience.itinerary.days[0],activity=first.activities[0];
 const swapped=session.swapActivity(1,activity.id);assert.equal(swapped.itinerary.days[1],other);assert.notEqual(swapped.itinerary.days[0].activities[0].placeId,activity.placeId);
 session.removeActivity(1,swapped.itinerary.days[0].activities[0].id);assert.equal(session.experience.itinerary.days[1],other);assert.equal(session.experience.itinerary.days[0].activities.length,first.activities.length-1);
 session.addWish(1,'A place I found');assert.equal(session.experience.itinerary.days[1],other);assert.match(renderTripSections(session.experience,'zh'),/你添加的地点 · 待核验/);
});
