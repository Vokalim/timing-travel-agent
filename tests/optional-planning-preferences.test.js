import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripRequest} from '../dist/lib/trip-request.js';
import {prepareExploration,planTrip} from '../dist/lib/planning-service.js';
import {scout,satisfiesHardConstraints} from '../dist/lib/engine.js';
import {MockPreferenceInterpreter} from '../dist/lib/preferences.js';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {parsePreferenceConstraints,preferenceSummary,isExcludedDestination} from '../dist/lib/preference-constraints.js';

const base={origin:'Shanghai',destination:'Tokyo',start:'2026-12-10',end:'2026-12-10',nights:5,flightBudget:5000,hotelBudget:1000,rating:null};
const flights={search:async()=>[
 {id:'cheap-red-eye',price:1800,stops:1,departureDateTime:'2026-12-10T01:30:00',returnDateTime:'2026-12-15T03:00:00'},
 {id:'direct-day',price:2300,stops:0,departureDateTime:'2026-12-10T09:30:00',returnDateTime:'2026-12-15T14:00:00'}
]};
const hotel={search:async()=>[{id:'h',name:'Central hotel',nightly:500,rating:4.5,centralLocation:true}]};
const interpreter=new MockPreferenceInterpreter();

test('只看直飞 excludes connecting flights; 最好直飞 changes rank but keeps options eligible',async()=>{
 const hard=await scout({...base,notes:'只看直飞'},interpreter,flights,hotel);
 assert.equal(hard.best.flight.id,'direct-day');assert.equal(hard.preferences.constraints.hard.directFlightRequired,true);
 const strong=await scout({...base,notes:'最好直飞'},interpreter,flights,hotel);
 assert.equal(strong.best.flight.id,'direct-day');assert.equal(strong.preferences.constraints.hard.directFlightRequired,undefined);
 assert.equal(strong.candidates.length,1);assert.equal(strong.preferences.constraints.strong.directFlightPreferred,true);
 assert.equal(satisfiesHardConstraints(strong.trip,strong.preferences,(await flights.search())[0],(await hotel.search())[0]),true);
});
test('不要红眼 strictly removes overnight options; 尽量不要红眼 boosts daytime without exclusion',async()=>{
 const hard=await scout({...base,notes:'不要红眼'},interpreter,flights,hotel);
 assert.equal(hard.best.flight.id,'direct-day');assert.equal(hard.preferences.constraints.hard.avoidOvernightFlights,true);
 const preferred=await scout({...base,notes:'尽量不要红眼'},interpreter,flights,hotel);
 assert.equal(preferred.best.flight.id,'direct-day');assert.equal(preferred.preferences.constraints.strong.avoidOvernightFlightsPreferred,true);
 assert.equal(preferred.preferences.constraints.hard.avoidOvernightFlights,undefined);
 assert.equal(satisfiesHardConstraints(preferred.trip,preferred.preferences,(await flights.search())[0],(await hotel.search())[0]),true);
});
test('explicit preferences materially change deterministic ranking; no preference leaves cheaper option first',async()=>{
 const neutral=await scout({...base,notes:''},interpreter,flights,hotel);
 const preferred=await scout({...base,notes:'最好直飞，尽量不要红眼'},interpreter,flights,hotel);
 assert.equal(neutral.best.flight.id,'cheap-red-eye');assert.equal(preferred.best.flight.id,'direct-day');
});
test('constraints persist in request for flight, hotel, and itinerary consumers',()=>{
 const trip=createTripRequest({...base,destination:null,notes:'只看直飞，不要红眼，住市中心，喜欢吃当地特色，节奏慢一点'});
 assert.equal(trip.destinationState,'discovery_required');assert.equal(trip.constraints.hard.directFlightRequired,true);assert.equal(trip.constraints.hard.avoidOvernightFlights,true);
 assert.equal(trip.constraints.strong.centralLocationPreferred,true);assert.equal(trip.constraints.soft.localFood,1);assert.equal(trip.constraints.pace,'relaxed');
 assert.match(trip.constraints.rawText,/当地特色/);assert.match(preferenceSummary(trip.constraints,'zh'),/直飞/);
});
test('local parser preserves natural-language constraints for the same deterministic planner',async()=>{
 const draft=await new DemoPreferenceParser().parse('11月从上海出发，只看直飞，不要红眼，节奏慢一点');
 const trip=createTripRequest({...draft.fields,destination:null});
 assert.equal(trip.constraints.hard.directFlightRequired,true);assert.equal(trip.constraints.hard.avoidOvernightFlights,true);
 assert.equal(trip.constraints.pace,'relaxed');
});
test('missing optional fields lead to labeled provisional windows, duration and budget-neutral ranking',async()=>{
 const request={origin:'Shanghai',destination:'Tokyo',departureWindowText:'December',flightBudget:null,hotelBudget:null};
 const plan=prepareExploration(request,{now:new Date('2026-09-13T00:00:00Z'),language:'zh'});
 assert.equal(plan.context.dateDescription,'December');assert.equal(plan.dateSource,'system_generated_exploration_window');assert.deepEqual(plan.durationRange,[4,6]);
 assert.ok(plan.windows.every(w=>w.userProvided===false));assert.match(plan.guidance,/具体日期/);
 const result=await planTrip(request,'demo',{now:new Date('2026-09-13T00:00:00Z')});
 assert.equal(result.checked,3);assert.equal(result.best.budgetStatus,'unconfirmed');assert.equal(result.trip.nights,5);
});
test('this weekend and named holidays remain flexible while giving representative dates',()=>{
 for(const period of ['this weekend','National Day','Spring Festival','Mid-Autumn Festival','next month']){
  const plan=prepareExploration({origin:'Shanghai',departureWindowText:period},{now:new Date('2026-09-13T00:00:00Z')});
  assert.ok(plan.windows.length>=1,period);assert.ok(plan.windows.every(w=>!w.userProvided),period);
 }
});
test('a single earliest or latest date bounds provisional comparison dates',()=>{
 const earliest=prepareExploration({origin:'Shanghai',start:'2026-11-02'},{now:new Date('2026-09-13T00:00:00Z')});
 const latest=prepareExploration({origin:'Shanghai',end:'2026-11-15'},{now:new Date('2026-09-13T00:00:00Z')});
 assert.ok(earliest.windows.every(w=>w.departure>='2026-11-02'&&!w.userProvided));
 assert.ok(latest.windows.every(w=>w.departure<='2026-11-15'&&!w.userProvided));
});
test('summary remains concise and neutral text creates no hard or strong constraints',()=>{
 assert.equal(preferenceSummary(parsePreferenceConstraints('只看直飞，不要红眼，节奏慢一点'),'zh'),'只看直飞 · 不要红眼 · 慢节奏');
 const none=parsePreferenceConstraints('');assert.deepEqual(none.hard.excludedDestinations,[]);assert.deepEqual(none.strong,{});assert.deepEqual(none.soft,{});
});
test('flight duration, stop limit, strict cap and geographic exclusions remain enforceable',async()=>{
 assert.equal(parsePreferenceConstraints('飞行不超过4小时，最多0次中转').hard.maxFlightDurationMinutes,240);
 assert.equal(parsePreferenceConstraints('飞行不超过4小时，最多0次中转').hard.maxStops,0);
 const constrained=await scout({...base,notes:'最多0次中转'},interpreter,flights,hotel);
 assert.equal(constrained.best.flight.id,'direct-day');
 const capped=await scout({...base,flightBudget:2000,notes:'严格预算，只看直飞'},interpreter,flights,hotel);
 assert.equal(capped.best,undefined);
 const timed={search:async()=>[{id:'long',price:1000,stops:0,segments:[{departingAt:'2026-12-10T09:00:00',arrivingAt:'2026-12-10T15:00:00'}]},{id:'short',price:1200,stops:0,segments:[{departingAt:'2026-12-10T10:00:00',arrivingAt:'2026-12-10T13:00:00'}]}]};
 const short=await scout({...base,notes:'飞行不超过4小时'},interpreter,timed,hotel);
 assert.equal(short.best.flight.id,'short');
 await assert.rejects(scout({...base,notes:'只去国内'},interpreter,flights,hotel),/does not match/);
 await assert.rejects(scout({...base,notes:'不要去Tokyo'},interpreter,flights,hotel),/excluded/);
 assert.equal(isExcludedDestination(parsePreferenceConstraints('不要去欧洲').hard,'Paris','France'),true);
 assert.equal(isExcludedDestination(parsePreferenceConstraints('不要去欧洲').hard,'Tokyo','Japan'),false);
});
