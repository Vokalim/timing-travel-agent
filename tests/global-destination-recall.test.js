import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {discoverDestinations,DemoDestinationDiscoveryService} from '../dist/lib/discovery/destination-discovery.js';
import {destinationContinent,evaluateOriginAccess} from '../dist/lib/discovery/destination-geography.js';
import {getDestination} from '../dist/lib/discovery/destination-universe.js';
import {parsePreferenceConstraints} from '../dist/lib/preference-constraints.js';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';

const noFlights={search:async()=>[]},service=new DemoDestinationDiscoveryService(),now=new Date('2026-09-29T00:00:00Z');
const discover=preferences=>discoverDestinations(preferences,{mode:'demo',language:'en',now,discoveryService:service,flightProvider:noFlights});
const continent=candidate=>destinationContinent(getDestination(candidate));

test('Birmingham food discovery recalls Europe deeply without becoming Europe-only',async()=>{
 const result=await discover({origin:'Birmingham, United Kingdom',durationDays:4,travelIntents:['food'],notes:'地方小吃之旅'}),top=result.candidates.slice(0,12);
 assert.equal(result.displayPreferences.spendingOrientation,'value');assert.ok(result.candidatePoolSize>=30&&result.candidatePoolSize<=80);
 assert.ok(top.filter(item=>continent(item)==='europe').length>=6);assert.ok(top.some(item=>getDestination(item)?.discoveryTier==='long_tail'&&continent(item)==='europe'));
 assert.ok(result.candidates.some(item=>continent(item)!=='europe'));assert.notEqual(top[0].city,'Shanghai');
});

test('New York short value trip favors practical North America but keeps international candidates',async()=>{
 const result=await discover({origin:'New York, USA',durationDays:4,totalTripBudgetCny:8500,travelIntents:['food','relaxation'],notes:'4-day relaxing food trip'}),top=result.candidates.slice(0,10);
 assert.ok(top.filter(item=>continent(item)==='north_america').length>=2);
 assert.ok(result.candidates.some(item=>continent(item)!=='north_america'));
 assert.ok(result.candidates.some(item=>['Portland Maine','Providence','Hudson Valley','Quebec City'].includes(item.city)));
 const nearby=result.candidates.find(item=>item.city==='Hudson Valley'),longhaul=result.candidates.find(item=>item.city==='Chiang Mai');assert.ok(nearby&&longhaul);assert.ok(nearby.accessEvaluation.travelBurden<longhaul.accessEvaluation.travelBurden);
});

test('Tokyo February warmth balances nearby Asia with a global long-haul pool',async()=>{
 const result=await discover({origin:'Tokyo, Japan',departureWindowText:'February',durationDays:5,travelIntents:['beach','relaxation'],notes:'somewhere warm'}),top=result.candidates.slice(0,10);
 assert.equal(result.displayPreferences.spendingOrientation,'value');assert.ok(top.filter(item=>continent(item)==='asia').length>=5);
 assert.ok(result.candidates.some(item=>continent(item)!=='asia'));
});

test('Shanghai culture discovery keeps smaller Chinese and international destinations eligible',async()=>{
 const result=await discover({origin:'Shanghai, China',durationDays:7,travelIntents:['culture'],notes:'7-day cultural trip'});
 assert.equal(result.displayPreferences.spendingOrientation,'value');assert.ok(result.candidates.some(item=>getDestination(item)?.countryCode==='CN'&&getDestination(item)?.discoveryTier==='long_tail'));
 assert.ok(result.candidates.some(item=>getDestination(item)?.countryCode!=='CN'));
});

test('Paris quiet autumn trip can surface nearby smaller Europe instead of only capitals',async()=>{
 const result=await discover({origin:'Paris, France',departureWindowText:'October',durationDays:5,travelIntents:['relaxation','nature'],notes:'quiet autumn trip'}),top=result.candidates.slice(0,8);
 assert.ok(top.some(item=>continent(item)==='europe'&&getDestination(item)?.discoveryTier==='long_tail'));
 assert.ok(top.filter(item=>getDestination(item)?.discoveryTier==='iconic').length<top.length/2);
});

test('Shanghai architecture and food keeps strong European matches in primary recommendations',async()=>{
 const result=await discover({origin:'Shanghai, China',departureWindowText:'October',durationDays:7,travelIntents:['food','culture'],notes:'喜欢建筑和美食'}),primary=result.candidates.slice(0,5);
 assert.equal(result.displayPreferences.spendingOrientation,'value');assert.ok(primary.some(item=>continent(item)==='europe'));
 assert.ok(result.candidates.some(item=>continent(item)==='europe'&&getDestination(item)?.discoveryTier==='long_tail'));
 const europe=result.candidates.find(item=>continent(item)==='europe');assert.ok(europe);assert.equal(europe.accessEvaluation.distanceBand,'intercontinental');
});

test('explicit Europe preference overrides proximity for Tokyo while retaining global eligibility',async()=>{
 const constraints=parsePreferenceConstraints('想去欧洲看看，小城市也可以，10天');assert.deepEqual(constraints.strong.preferredRegions,['europe']);
 const result=await discover({origin:'Tokyo, Japan',durationDays:10,notes:'想去欧洲看看，小城市也可以，10天'}),top=result.candidates.slice(0,10);
 assert.ok(top.filter(item=>continent(item)==='europe').length>=7);assert.ok(top.some(item=>continent(item)==='europe'&&getDestination(item)?.discoveryTier==='long_tail'));
 assert.ok(result.candidates.some(item=>continent(item)==='asia'));
});


test('explicit Asia preference overrides proximity from Paris and Birmingham',async()=>{
 for(const origin of ['Paris, France','Birmingham, United Kingdom']){
  const result=await discover({origin,durationDays:10,travelIntents:['food'],notes:'想去亚洲旅行，喜欢当地美食'}),top=result.candidates.slice(0,10);
  assert.ok(top.filter(item=>continent(item)==='asia').length>=6);
  assert.ok(result.candidates.some(item=>continent(item)==='europe'));
 }
});

test('fallback parser resolves any catalog origin before complete-plan defaults apply',async()=>{
 const draft=await new DemoPreferenceParser().parse('东京出发，想去欧洲看看，小城市也可以，10天');
 assert.equal(draft.fields.origin,'Tokyo');assert.equal(draft.fields.nights,10);assert.equal(draft.interpretation.destination,null);
});

test('explicit geographic language is structured instead of being inferred from origin',()=>{
 assert.deepEqual(parsePreferenceConstraints('想去日本').strong.preferredCountries,['JP']);
 assert.equal(parsePreferenceConstraints('周边游').strong.nearbyPreferred,true);
 assert.equal(parsePreferenceConstraints('想去远一点').strong.fartherPreferred,true);
 assert.equal(parsePreferenceConstraints('不想坐太久飞机').strong.shorterFlightPreferred,true);
 assert.ok(parsePreferenceConstraints('不要亚洲').hard.excludedDestinations.includes('亚洲'));
});

test('distance changes score but never becomes an eligibility veto without a hard constraint',()=>{
 const europe=evaluateOriginAccess('Shanghai',getDestination('Lyon'),{durationDays:7,getDestination}),near=evaluateOriginAccess('Shanghai',getDestination('Suzhou'),{durationDays:7,getDestination});
 assert.equal(europe.distanceBand,'intercontinental');assert.ok(europe.scoreAdjustment<near.scoreAdjustment);assert.equal('eligible' in europe,false);
 const twoDays=evaluateOriginAccess('Shanghai',getDestination('Lyon'),{durationDays:2,getDestination});assert.ok(twoDays.travelBurden>europe.travelBurden);
});

test('Discovery UI treats domestic as origin-relative and explains the value default',async()=>{
 const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(source,/accessEvaluation\.origin\.countryCode/);assert.doesNotMatch(source,/candidate\.countryOrRegion==='China'/);
 assert.match(source,/未填写预算 · 默认性价比优先/);
});
