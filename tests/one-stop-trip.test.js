import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTripRequest} from '../dist/lib/trip-request.js';
import {planTransportOptions} from '../dist/lib/discovery/transport-planner.js';
import {discoverDestinations,DemoDestinationDiscoveryService} from '../dist/lib/discovery/destination-discovery.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {MAX_TRIP_COLLAGE_IMAGES,tripHeroImages,renderTripHero,renderTripSections} from '../dist/trip-view.js';

const route=(destination,notes='',extra={})=>({origin:'Shanghai',destination,nights:3,notes,...extra});
const plan=trip=>planTransportOptions({...trip,durationDays:trip.nights,constraints:createTripRequest(trip).constraints,flightVerification:{status:'not_checked',source:'demo'}});

test('no transport preference infers multiple modes; nearby domestic route favors rail',()=>{
 const result=plan(route('Hangzhou'));
 assert.deepEqual(result.options.map(option=>option.mode).sort(),['flight','self_drive','train']);
 assert.equal(result.preferredMode,'train');assert.equal(result.options.find(option=>option.mode==='train').verification.status,'not_yet_live');
});
test('train-only is hard, train preferred changes suitability without excluding flight',()=>{
 const required=plan(route('Hangzhou','只坐高铁'));
 assert.equal(required.requiredMode,'train');assert.equal(required.options.find(option=>option.mode==='flight').allowed,false);
 const neutral=plan(route('Qingdao')),preferred=plan(route('Qingdao','最好坐高铁'));
 assert.ok(preferred.options.find(option=>option.mode==='train').suitabilityScore>neutral.options.find(option=>option.mode==='train').suitabilityScore);
 assert.equal(preferred.options.find(option=>option.mode==='flight').allowed,true);
});
test('self-drive preference changes suitability; international route prioritizes flight',()=>{
 const neutral=plan(route('Dali')),driving=plan(route('Dali','想自驾看山'));
 assert.ok(driving.options.find(option=>option.mode==='self_drive').suitabilityScore>neutral.options.find(option=>option.mode==='self_drive').suitabilityScore);
 const international=plan(route('Tokyo'));
 assert.equal(international.preferredMode,'flight');assert.equal(international.options.find(option=>option.mode==='train').verification.status,'not_applicable');
});
test('transport suitability never fabricates rail fares, schedules, drive times or tolls',()=>{
 for(const option of plan(route('Hangzhou')).options){if(option.mode==='flight')continue;assert.equal(option.price,null);assert.equal(option.schedule,null);assert.equal(option.drivingTimeMinutes,null);}
});
test('explicit rail preference materially affects destination discovery ranking',async()=>{
 const candidates=['Hangzhou','Qingdao'].map((city,index)=>({city,countryOrRegion:'China',iataOrMetroCode:index?'TAO':'HGH',themes:['culture'],sourceType:'general_prior'}));
 const service={discover:async()=>({source:'general_prior_fallback',candidates})},base={origin:'Shanghai',destination:null,durationDays:3,departureWindowText:'December',travelIntents:['culture']};
 const options={mode:'demo',now:new Date('2026-09-13T00:00:00Z'),discoveryService:service,flightProvider:{search:async()=>[]}};
 const neutral=await discoverDestinations(base,options),preferred=await discoverDestinations({...base,notes:'最好坐高铁'},options);
 const gap=result=>result.candidates.find(c=>c.city==='Hangzhou').score-result.candidates.find(c=>c.city==='Qingdao').score;
 assert.ok(gap(preferred)>gap(neutral));assert.equal(preferred.candidates[0].transport.train.price,null);
});
test('train-only discovery avoids flight search and excludes unsuitable international candidates',async()=>{
 let calls=0;const candidates=[{city:'Hangzhou',countryOrRegion:'China',iataOrMetroCode:'HGH',themes:['culture']},{city:'Tokyo',countryOrRegion:'Japan',iataOrMetroCode:'TYO',themes:['culture']}];
 const result=await discoverDestinations({origin:'Shanghai',destination:null,durationDays:3,departureWindowText:'December',notes:'只坐高铁'},{now:new Date('2026-09-13T00:00:00Z'),discoveryService:{discover:async()=>({source:'general_prior_fallback',candidates})},flightProvider:{search:async()=>{calls++;return [];}}});
 assert.equal(calls,0);assert.deepEqual(result.candidates.map(candidate=>candidate.city),['Hangzhou']);
});
test('stay and itinerary remain available with undecided transport and no flight verification',()=>{
 const experience=buildTripExperience({trip:route('Hangzhou','住市中心，节奏慢一点，喜欢当地美食'),flightVerification:{status:'not_checked'}});
 assert.equal(experience.stay.status,'planning_guidance');assert.ok(experience.stay.areas.some(area=>area.key==='central'));
 assert.equal(experience.stay.hotelName,null);assert.equal(experience.stay.price,null);assert.equal(experience.stay.availability,null);
 assert.equal(experience.itinerary.days.length,3);assert.equal(experience.itinerary.pace,'relaxed');
 assert.ok(experience.itinerary.stayAreaKeys.includes('central'));
 assert.equal(experience.trip.constraints.strong.centralLocationPreferred,true);
});
test('trip detail shows four modules, transparent availability and at most two collage images',async()=>{
 const experience=buildTripExperience({trip:route('Hangzhou','最好坐高铁'),flightVerification:{status:'not_checked'}}),html=renderTripHero(experience,'zh')+renderTripSections(experience,'zh');
 assert.ok(tripHeroImages('Hangzhou').length<=MAX_TRIP_COLLAGE_IMAGES);assert.equal((html.match(/<img\b/g)||[]).length,2);
 for(const module of ['transport','stay','itinerary'])assert.match(html,new RegExp(`data-trip-module="${module}"`));
 assert.match(html,/实时车次与票价暂未接入/);assert.match(html,/住宿实时价格与库存暂未接入/);
 assert.doesNotMatch(html,/高铁\s*¥|自驾\s*¥|2h12m|酒店已确认/);
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');assert.match(app,/renderTripTimingControls\(experience,language\)/);
});
