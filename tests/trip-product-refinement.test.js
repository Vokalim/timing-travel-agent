import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DestinationRecommendationSession} from '../dist/lib/discovery/destination-discovery.js';
import {planTransportOptions} from '../dist/lib/discovery/transport-planner.js';
import {CuratedPlaceProvider} from '../dist/lib/providers/place-provider.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {renderRoutePreview,renderTripSections} from '../dist/trip-view.js';

const parisTrip={origin:'Shanghai',destination:'Paris',nights:5,travelIntents:['culture'],constraints:{hard:{},strong:{},soft:{culture:2}},spendingOrientation:'value'};

test('opening a destination preserves the exact discovery page and back path does not discover again',async()=>{
 const candidates=['Paris','Kyoto','Chiang Mai','Tokyo','Osaka','Seoul'].map((city,index)=>({id:city.toLowerCase().replaceAll(' ','_'),city,score:90-index,themes:['culture'],countryOrRegion:index<1?'France':'Japan'}));
 const session=new DestinationRecommendationSession({seed:7}),preferences={requestKey:'stable',travelIntents:['culture']};
 const before=session.page('stable',candidates,preferences,3).map(item=>item.city),snapshot={data:{candidates},filter:'all',selectedCandidate:candidates[0]};
 const after=session.page('stable',snapshot.data.candidates,preferences,3).map(item=>item.city);
 assert.deepEqual(after,before);assert.equal(snapshot.selectedCandidate.city,'Paris');
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/discoverySnapshot=\{data,filter:discoveryFilter,selectedCandidate:chosenCandidate\}/);
 assert.match(app,/function restoreDiscovery[\s\S]*renderDiscovery\(discoveryResult\)/);
 assert.doesNotMatch(app.match(/function restoreDiscovery[\s\S]*?\n}/)?.[0]||'',/discoverDestinations\(/);
});

test('reasonable mainland routes evaluate flight, train and self-drive without an explicit mode',()=>{
 for(const [origin,destination] of [['Shanghai','Hangzhou'],['Shanghai','Suzhou'],['Beijing','Tianjin']]){
  const plan=planTransportOptions({origin,destination,durationDays:3,constraints:{hard:{},strong:{}}});
  assert.deepEqual(new Set(plan.options.filter(option=>option.suitability!=='not_applicable').map(option=>option.mode)),new Set(['flight','train','self_drive']));
  assert.equal(plan.options.find(option=>option.mode==='train').price,null);
  assert.ok(plan.options.every(option=>option.reason?.zh));
 }
 const international=planTransportOptions({origin:'Shanghai',destination:'Paris',durationDays:5});
 assert.equal(international.options.find(option=>option.mode==='train').suitability,'not_applicable');
});

test('Paris baseline uses destination-specific POIs and a geographic route preview',()=>{
 const places=new CuratedPlaceProvider().search('Paris');
 assert.ok(places.length>=15);assert.ok(places.some(place=>place.names.en==='Louvre Museum'));assert.ok(places.some(place=>place.names.en.includes('Eiffel')));
 const experience=buildTripExperience({trip:parisTrip}),activities=experience.itinerary.days.flatMap(day=>day.activities);
 assert.ok(activities.every(activity=>activity.place.source==='curated'));
 assert.ok(activities.some(activity=>activity.place.names.en==='Montmartre'));
 assert.doesNotMatch(activities.map(activity=>activity.place.names.en).join('|'),/Core city area|Arrival and neighborhood/);
 assert.match(renderRoutePreview(experience.itinerary.days[0],'en'),/data-route-state="coordinates"/);
});

test('pace changes visible Paris density and itinerary style controls live in module 03',()=>{
 const relaxed=new TripWorkspaceSession({trip:parisTrip,pace:'relaxed'}),intensive=new TripWorkspaceSession({trip:parisTrip,pace:'intensive'});
 assert.ok(relaxed.experience.itinerary.days[0].activities.length<intensive.experience.itinerary.days[0].activities.length);
 const html=renderTripSections(relaxed.experience,'zh');
 assert.ok(html.indexOf('data-trip-module="itinerary"')<html.indexOf('data-trip-module="stay"'));
 assert.match(html,/data-trip-module="itinerary"[\s\S]*data-trip-pace="relaxed"/);
 assert.match(html,/data-trip-module="stay"><div class="trip-module-heading"><span>04/);
});

test('editing Day 2 start time shifts only Day 2 and keeps later activities coherent',()=>{
 const session=new TripWorkspaceSession({trip:parisTrip}),day1=session.experience.itinerary.days[0],day2=session.experience.itinerary.days[1],day3=session.experience.itinerary.days[2];
 const oldTimes=day2.activities.map(activity=>activity.startTime),first=day2.activities[0];
 session.changeActivityTime(2,first.id,'10:30',120);
 const updated=session.experience.itinerary.days[1];
 assert.equal(session.experience.itinerary.days[0],day1);assert.equal(session.experience.itinerary.days[2],day3);
 assert.equal(updated.activities[0].startTime,'10:30');assert.equal(updated.activities[0].endTime,'12:30');
 assert.notEqual(updated.activities[1].startTime,oldTimes[1]);assert.equal(updated.activities[0].schedulePrecision,'user_adjusted');
});

test('route markers match itinerary ids and order exactly',()=>{
 const experience=buildTripExperience({trip:{...parisTrip,nights:1}}),day=experience.itinerary.days[0],html=renderRoutePreview(day,'en');
 const ids=[...html.matchAll(/data-route-stop="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(ids.slice(-day.activities.length),day.activities.map(activity=>activity.id));
 day.activities.forEach((activity,index)=>assert.match(html,new RegExp(`>${index+1}</b><span>${activity.place.names.en}`)));
});

test('stay recommendation is recalculated from edited itinerary geography',()=>{
 const base=buildTripExperience({trip:parisTrip}),available=base.itinerary.availablePlaces;
 const override=areaKey=>({...base.itinerary,days:base.itinerary.days.map((day,index)=>({...day,activities:available.filter(place=>place.areaKey===areaKey).slice(0,2).map((place,slot)=>({id:`edited-${index}-${slot}`,placeId:place.id,place,startTime:'10:00',endTime:'11:30',schedulePrecision:'approximate',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null,travelDistanceMeters:null}))}))});
 const louvre=buildTripExperience({trip:parisTrip,itineraryOverride:override('louvre')}),marais=buildTripExperience({trip:parisTrip,itineraryOverride:override('marais')});
 assert.equal(louvre.stay.clusterAreaKey,'louvre');assert.equal(marais.stay.clusterAreaKey,'marais');assert.notEqual(louvre.stay.primaryArea.key,marais.stay.primaryArea.key);
});

test('unverified schedules use approximate labels and natural-language edits modify existing plan',()=>{
 const session=new TripWorkspaceSession({trip:parisTrip}),before=session.experience.itinerary.days.length;
 assert.match(renderTripSections(session.experience,'zh'),/约 09:30/);assert.doesNotMatch(renderTripSections(session.experience,'zh'),/>09:30–11:00</);
 session.applyItineraryInstruction('不要卢浮宫');assert.equal(session.experience.itinerary.days.length,before);assert.ok(!session.experience.itinerary.days.flatMap(day=>day.activities).some(activity=>activity.place.names.zh.includes('卢浮宫')));
 const first=session.experience.itinerary.days[1].activities[0].startTime;session.applyItineraryInstruction('第二天晚一点出门');assert.notEqual(session.experience.itinerary.days[1].activities[0].startTime,first);
});
