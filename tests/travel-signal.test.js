import test from 'node:test';
import assert from 'node:assert/strict';
import {TravelSignalSession,SignalSource,travelSignalDependencies} from '../dist/lib/travel-signal.js';
import {parsePreferenceConstraints} from '../dist/lib/preference-constraints.js';
import {DestinationRecommendationSession,discoverDestinations,destinationRequestKey} from '../dist/lib/discovery/destination-discovery.js';

const draft=(fields={},interpretation={})=>({fields:{travelIntents:[],notes:'',...fields},interpretation:{destinationState:'discovery_required',...interpretation},needsConfirmation:[]});

test('TravelSignal records explicit, default and unknown provenance without inventing fields',()=>{
 const signal=new TravelSignalSession();
 signal.updateFromDraft(draft({origin:'Shanghai',travelIntents:['food']},{origin:'Shanghai',travelIntents:['food']}),{text:'上海出发，想吃当地美食'});
 assert.deepEqual(signal.fields.origin,{value:'Shanghai',source:SignalSource.EXPLICIT});
 assert.deepEqual(signal.fields.budget,{value:null,source:SignalSource.UNKNOWN});
 assert.deepEqual(signal.fields.spendingOrientation,{value:'value',source:SignalSource.DEFAULT});
 assert.equal(signal.toPreferences().destination,null);
});

test('local corrections preserve unrelated signal fields and recompute only dependencies',()=>{
 const signal=new TravelSignalSession();
 signal.updateFromDraft(draft({origin:'Shanghai',nights:7,travelIntents:['food','architecture']},{origin:'Shanghai',durationDays:7,departureWindowText:'10月',travelIntents:['food','architecture']}),{text:'上海出发，10月玩7天，喜欢建筑和美食'});
 const update=signal.updateFromDraft(draft({nights:5},{durationDays:5}),{text:'其实我只有5天'});
 const value=signal.toPreferences();
 assert.equal(value.origin,'Shanghai');assert.equal(value.durationDays,5);assert.equal(value.departureWindowText,'10月');assert.deepEqual(value.travelIntents,['food','architecture']);assert.equal(value.spendingOrientation,'value');
 assert.deepEqual(update.changed,['duration']);assert.deepEqual(update.affected,['destinationPracticality','destinationRanking','transport','itinerary']);
 signal.updateFromDraft(draft(),{text:'预算改成一万'});assert.equal(signal.toPreferences().totalTripBudgetCny,10000);assert.equal(signal.toPreferences().origin,'Shanghai');
 signal.updateFromDraft(draft({origin:'Hangzhou'},{origin:'Hangzhou'}),{text:'还是从杭州出发'});assert.equal(signal.toPreferences().origin,'Hangzhou');assert.deepEqual(signal.toPreferences().travelIntents,['food','architecture']);
});

test('explicit trip rejections become session-scoped constraints instead of display-only notes',()=>{
 const constraints=parsePreferenceConstraints('不要海边，不要欧洲了，不想去日本，这个太远了，也不想去这么热门的地方');
 assert.ok(constraints.hard.excludedThemes.includes('beach'));
 assert.ok(constraints.hard.excludedDestinations.includes('欧洲'));
 assert.ok(constraints.hard.excludedDestinations.includes('日本'));
 assert.equal(constraints.strong.shorterFlightPreferred,true);
 assert.equal(constraints.strong.lessPopularPreferred,true);
 assert.notEqual(constraints.strong.seasidePreferred,true);
});

test('explicit rejected themes filter subsequent destination discovery',async()=>{
 const constraints=parsePreferenceConstraints('不要海边');
 const service={discover:async()=>({source:'fixture',candidates:[{city:'Phuket',countryOrRegion:'Thailand',themes:['beach','tropical']},{city:'Kyoto',countryOrRegion:'Japan',themes:['culture','food']}]})};
 const result=await discoverDestinations({origin:'Shanghai',destination:null,durationDays:5,constraints,travelIntents:[]},{mode:'demo',language:'zh',discoveryService:service,flightProvider:{search:async()=>[]}});
 assert.deepEqual(result.candidates.map(item=>item.city),['Kyoto']);
});

test('exploration memory preserves pool, exposure, opened point, selection and exact positions',()=>{
 const candidates=Array.from({length:7},(_,index)=>({id:`place-${index}`,city:`Place ${index}`,themes:['culture'],score:90-index}));
 const session=new DestinationRecommendationSession({seed:8}),key='trip';
 const first=session.page(key,candidates,{},3),position=session.position(key,first[0].id,()=>({x:18,y:32}));
 session.markOpened(key,first[0].id);session.markSelected(key,first[1].id);session.next(key,candidates,{},3);
 const state=session.diagnostics(key);
 assert.equal(state.rankedPoolIds.length,7);assert.ok(state.exposureHistory.length>=6);assert.deepEqual(state.openedDestinationIds,[first[0].id]);assert.equal(state.selectedDestinationId,first[1].id);assert.deepEqual(state.worldPointPositions[first[0].id],position);
 assert.deepEqual(session.position(key,first[0].id,()=>({x:99,y:99})),position);
});

test('dependency graph scopes deterministic downstream work',()=>{
 assert.deepEqual(travelSignalDependencies(['budget']),['destinationValue','destinationRanking','transport','stay']);
 assert.deepEqual(travelSignalDependencies(['poi']),['itinerary','footprint','adjacentRoutes','stayArea']);
 assert.equal(destinationRequestKey({origin:'Shanghai',pace:'relaxed'}),destinationRequestKey({origin:'Shanghai',pace:'intensive'}),'pace-only edits must reuse destination discovery');
 assert.notEqual(destinationRequestKey({origin:'Shanghai',durationDays:5}),destinationRequestKey({origin:'Shanghai',durationDays:7}),'duration changes must refresh destination practicality');
});
