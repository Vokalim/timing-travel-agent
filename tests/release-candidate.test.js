import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {prepareExploration,planTrip} from '../dist/lib/planning-service.js';
import {discoverDestinations,DemoDestinationDiscoveryService,DestinationRecommendationSession} from '../dist/lib/discovery/destination-discovery.js';
import {createTripRequest} from '../dist/lib/trip-request.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {displayCity} from '../dist/lib/discovery/destination-identity.js';
import {displayLabel} from '../dist/lib/display-localization.js';
import {renderTripSections,renderTripTimingControls} from '../dist/trip-view.js';

const now=new Date('2026-09-17T00:00:00Z');
const parser=new DemoPreferenceParser();
const preferencesFrom=draft=>createTripRequest({...draft.fields,destination:null,departureWindowText:draft.dateHint,notes:draft.fields.notes||''});

test('broad Chinese request completes parse, discovery, selection, and editable trip planning',async()=>{
 const draft=await parser.parse('12月上海出发，5天，预算3000，想去海边，最好直飞，不要红眼');
 assert.equal(draft.interpretation.destinationState,'discovery_required');
 assert.deepEqual(draft.interpretation.travelIntents,['beach']);
 const trip=preferencesFrom(draft),planning=prepareExploration(trip,{now,language:'zh'});
 const discovery=await discoverDestinations({...draft.interpretation,...trip,durationDays:planning.nights},{mode:'demo',now,language:'zh',discoveryService:new DemoDestinationDiscoveryService()});
 assert.ok(discovery.candidates.length>=5);
 const chosen=discovery.candidates[0];
 const session=new TripWorkspaceSession({trip:{...planning.trip,destination:chosen.city,nights:planning.nights},plan:planning,candidate:chosen,flightVerification:chosen.verification});
 assert.ok(session.experience.transport.options.length>=3);
 assert.ok(session.experience.stay.areas.length>=1);
 assert.equal(session.experience.itinerary.days.length,5);
 const preserved=session.trip.constraints.rawText;
 session.changeDates('7');session.changePace('relaxed');
 assert.equal(session.trip.constraints.rawText,preserved);
 assert.equal(session.experience.itinerary.pace,'relaxed');
});

test('explicit Tokyo request completes deterministic date comparison and trip workspace',async()=>{
 const draft=await parser.parse('12月上海去东京5天');
 assert.equal(draft.interpretation.destination,'Tokyo');
 const result=await planTrip({...draft.fields,departureWindowText:draft.dateHint},'demo',{now,language:'zh'});
 assert.ok(result.candidates.length>=1);assert.equal(result.trip.destination,'Tokyo');
 const session=new TripWorkspaceSession({trip:result.trip,plan:result.plan,flightVerification:{status:'verified',source:'demo',quote:result.best.flight}});
 assert.match(renderTripTimingControls(session.experience,'zh'),/更换日期/);
 assert.match(renderTripSections(session.experience,'zh'),/怎么玩/);
});

test('portfolio audit inputs preserve optionality and actionable intent without hidden form defaults',async()=>{
 const cases=[
  ['中秋从南昌出发，不知道去哪，想吃好吃的，4-6天',draft=>{assert.equal(draft.fields.origin,'Nanchang');assert.equal(draft.fields.nights,5);assert.ok(draft.fields.travelIntents.includes('food'));}],
  ['周末上海出发，想坐高铁找个安静的小城',draft=>{const trip=preferencesFrom(draft);assert.equal(draft.dateHint,'周末');assert.equal(trip.constraints.strong.trainPreferred,true);assert.equal(trip.constraints.soft.quietAreas,1);}],
  ['想自驾看山，3-4天，不想太赶',draft=>{const trip=preferencesFrom(draft);assert.equal(draft.fields.origin,undefined);assert.equal(trip.constraints.strong.selfDrivePreferred,true);assert.equal(trip.constraints.strong.mountainPreferred,true);assert.equal(trip.constraints.pace,'relaxed');}],
  ['最近想出去玩',draft=>{assert.equal(draft.fields.origin,undefined);assert.equal(draft.interpretation.destinationState,'discovery_required');}]
 ];
 for(const [input,check] of cases)check(await parser.parse(input));
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const form=html.match(/<form id="trip-form">([\s\S]*?)<\/form>/)?.[1];
 assert.ok(form);assert.doesNotMatch(form,/value="(?:San Francisco|Tokyo|2026-11-02|2026-11-09|4900|1260)"/);
 for(const optional of ['destination','start','end','nights','rating','flightBudget','hotelBudget'])assert.doesNotMatch(form.match(new RegExp(`<input\\b[^>]*name="${optional}"[^>]*>`))?.[0]||'',/\srequired\b/);
});

test('Chinese presentation localizes identities and enum labels without changing canonical values',()=>{
 const canonical='Tokyo';assert.equal(displayCity(canonical,'zh'),'东京');assert.equal(displayCity(canonical,'en'),'Tokyo');assert.equal(canonical,'Tokyo');
 for(const key of ['food','beach','relaxation','self_drive','CHANGE_DATE','discovery_required','system_generated_exploration_window','seasonal_match','live_verified','parserStatus','source']){
  const value=displayLabel(key,'zh');assert.notEqual(value,key,`missing Chinese label for ${key}`);
 }
});

test('pace controls are real buttons and changing pace changes itinerary density',()=>{
 const trip=createTripRequest({origin:'Shanghai',destination:'Tokyo',nights:2,travelIntents:['food']});
 const session=new TripWorkspaceSession({trip});const balanced=session.experience.itinerary.days.flatMap(day=>day.activities).length;
 const html=renderTripSections(session.experience,'zh');assert.match(html,/data-trip-pace="relaxed"/);assert.match(html,/aria-pressed="true"/);assert.match(html,/data-trip-action="swap"/);
 session.changePace('intensive');assert.ok(session.experience.itinerary.days.flatMap(day=>day.activities).length>balanced);
});

test('destination refresh stays diverse and does not require another provider request',async()=>{
 let calls=0;const service=new DemoDestinationDiscoveryService(),wrapped={discover:async(...args)=>{calls++;return service.discover(...args);}};
 const draft=await parser.parse('12月上海出发，想去海边玩5天');
 const result=await discoverDestinations({...draft.interpretation,...preferencesFrom(draft)},{now,language:'zh',discoveryService:wrapped});
 const session=new DestinationRecommendationSession({seed:7}),first=session.select(result.candidates,{travelIntents:['beach']},3),second=session.select(result.candidates,{travelIntents:['beach']},3);
 assert.equal(calls,1);assert.notDeepEqual(first.map(x=>x.id),second.map(x=>x.id));
});
