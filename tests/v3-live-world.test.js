import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLiveTravelSignal} from '../dist/trip-input.js';
import {applyCompletePlanDefaults} from '../dist/lib/complete-plan-defaults.js';
import {InspirationService} from '../dist/lib/discovery/inspiration-service.js';
import {DestinationRecommendationSession,discoverDestinations} from '../dist/lib/discovery/destination-discovery.js';

const now=new Date('2026-10-10T00:00:00Z');

test('live signal evolves deterministically without running destination discovery',async()=>{
 const inputs=['伯明翰出发','伯明翰出发，想吃东西','伯明翰出发，想吃东西，小城市也可以','伯明翰出发，10月，4天，想吃东西，小城市也可以，预算500镑'];
 const drafts=[];for(const input of inputs)drafts.push(await parseLiveTravelSignal(input));
 assert.equal(drafts[0].fields.origin,'Birmingham');
 assert.deepEqual(drafts[1].fields.travelIntents,['food']);
 assert.equal(drafts[2].interpretation.destinationState,'discovery_required');
 assert.equal(drafts[3].interpretation.durationDays,4);
 assert.deepEqual(drafts[3].interpretation.originalBudget,{currency:'GBP',amount:500,raw:'500镑'});
 assert.equal(drafts[3].interpretation.totalTripBudgetCny,null);
 const source=await readFile(new URL('../dist/trip-input.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/discoverDestinations|\/api\/travel\/destinations/);
 assert.match(source,/setTimeout\([^]*?,400\)/);
});

test('contextual continuations react to intent and explicit destination',async()=>{
 const base=await parseLiveTravelSignal('伯明翰出发'),food=await parseLiveTravelSignal('伯明翰出发，想吃东西'),paris=await parseLiveTravelSignal('伯明翰出发，想去巴黎吃东西');
 const ideas=draft=>new InspirationService({seed:7}).getIdeas({text:'',preferences:draft.interpretation,now});
 assert.ok(ideas(base).some(item=>item.group==='continuation'));
 assert.ok(ideas(food).filter(item=>item.intent==='food').length>=2);
 assert.ok(ideas(paris).some(item=>item.destinationStage));
 assert.equal(paris.fields.destination,'Paris');assert.equal(paris.interpretation.destinationState,'provided');
});

test('unknown origin remains unknown and foreign budget stays unconverted',async()=>{
 const vague=applyCompletePlanDefaults(await parseLiveTravelSignal('我想出去玩'));
 assert.equal(vague.fields.origin,undefined);assert.equal(vague.originAssumption,false);
 const usd=await parseLiveTravelSignal('New York departure, 4-day relaxing food trip, budget USD 1200');
 assert.equal(usd.fields.origin,'New York');assert.equal(usd.fields.nights,4);
 assert.deepEqual(usd.interpretation.originalBudget,{currency:'USD',amount:1200,raw:'USD 1200'});
 assert.equal(usd.interpretation.totalTripBudgetCny,null);
});

test('holiday context follows travel geography rather than UI language',async()=>{
 const uk=new InspirationService({seed:2}).getEligiblePool({text:'伯明翰出发',preferences:{origin:'Birmingham',departureWindowText:'2026年10月'},now});
 assert.ok(uk.every(item=>item.key!=='national'&&item.key!=='midautumn'));
 const explicit=new InspirationService({seed:2}).getEligiblePool({text:'中秋想出去玩',preferences:{origin:'Birmingham'},now});
 assert.ok(explicit.some(item=>item.key==='midautumn'));
});

test('development diagnostics expose ranking counts and major factors only when requested',async()=>{
 const candidates=[
  ['Porto','Portugal',['food','culture']],['Bologna','Italy',['food','culture']],['Ghent','Belgium',['culture','architecture']],
  ['Tokyo','Japan',['food','culture']],['Chiang Mai','Thailand',['food','nature']],['Quebec City','Canada',['food','culture']]
 ].map(([city,country,themes])=>({city,countryOrRegion:country,themes}));
 const options={language:'en',now,debug:true,discoveryService:{discover:async()=>({source:'fixture',candidates})},flightProvider:{search:async()=>[]}};
 const result=await discoverDestinations({origin:'Birmingham',destination:null,durationDays:5,travelIntents:['food'],notes:'小城市也可以'},options);
 assert.equal(result.diagnostics.destinationUniverse>=100,true);
 assert.equal(result.diagnostics.globalRecall,6);assert.equal(result.diagnostics.afterHardConstraints,6);
 assert.equal(result.diagnostics.rankedPool,6);assert.ok(result.diagnostics.topCandidates[0].factors);
 const clean=await discoverDestinations({origin:'Birmingham',destination:null,durationDays:5,travelIntents:['food']},{...options,debug:false});
 assert.equal('diagnostics' in clean,false);
});

test('stable pool tracks exposure and explicit next batch without repetition',()=>{
 const candidates=Array.from({length:8},(_,index)=>({id:`place-${index}`,city:`Place ${index}`,themes:index%2?['food']:['culture'],score:90-index}));
 const session=new DestinationRecommendationSession({seed:4}),key='same-request',preferences={travelIntents:['food']};
 const first=session.page(key,candidates,preferences,3),again=session.page(key,candidates,preferences,3),second=session.next(key,candidates,preferences,3);
 assert.deepEqual(again.map(x=>x.id),first.map(x=>x.id));
 assert.equal(second.some(item=>first.some(previous=>previous.id===item.id)),false);
 assert.deepEqual(session.diagnostics(key).currentBatch,second.map(x=>x.id));
 assert.equal(session.diagnostics(key).exposureHistory.length,6);
});

test('world field uses stable primary and secondary interactive points rather than radar geometry',async()=>{
 const [app,css,trip]=await Promise.all(['app.js','product.css','trip-view.js'].map(name=>readFile(new URL(`../dist/${name}`,import.meta.url),'utf8')));
 assert.match(app,/worldPointPosition/);assert.match(app,/point-secondary/);assert.match(app,/secondaryVisible/);
 assert.doesNotMatch(app,/M500 260C410 170/);
 assert.match(css,/\.world-field\{height:500px;border-radius:38px/);
 assert.match(css,/destination-expand-v3/);assert.match(css,/prefers-reduced-motion/);
 assert.match(trip,/footprint-marker interactive-travel-point/);assert.match(trip,/trip-place-trigger interactive-travel-point/);
});
