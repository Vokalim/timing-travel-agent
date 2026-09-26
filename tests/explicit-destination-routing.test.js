import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {applyCompletePlanDefaults} from '../dist/lib/complete-plan-defaults.js';
import {destinationFlowForDraft,clearedDiscoverySelection} from '../dist/lib/discovery/destination-routing.js';
import {normalizePreferenceOutput} from '../server/preference-normalizer.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';

const parser=new DemoPreferenceParser();
const explicitCases=[
 ['去巴黎','Paris'],
 ['12月从上海出发，去巴黎玩5天','Paris'],
 ['12月从上海出发，想去巴黎跨年','Paris'],
 ['去东京','Tokyo'],
 ['去上海玩3天','Shanghai']
];

test('explicit named destinations are normalized and always route directly to trip planning',async()=>{
 for(const [input,expected] of explicitCases){const draft=applyCompletePlanDefaults(await parser.parse(input)),flow=destinationFlowForDraft(draft);assert.equal(draft.fields.destination,expected,input);assert.equal(draft.interpretation.destinationState,'provided',input);assert.deepEqual(flow,{kind:'trip',destination:expected,discoveryRequired:false},input);}
});

test('a destination without 去/到 syntax remains explicit while a thematic trip still enters discovery',async()=>{
 const paris=await parser.parse('上海出发，巴黎5天，喜欢艺术'),open=await parser.parse('12月从上海出发，想跨年旅行');
 assert.equal(paris.fields.destination,'Paris');assert.equal(destinationFlowForDraft(paris).kind,'trip');
 assert.equal(open.fields.destination,undefined);assert.equal(open.interpretation.destinationState,'discovery_required');assert.equal(destinationFlowForDraft(open).kind,'discovery');
});

test('server normalization gives the explicitly named destination precedence over a conflicting model proposal',()=>{
 const model={origin:'Shanghai',originEvidence:'上海',destination:'Lijiang',destinationEvidence:'巴黎',destinationState:'provided',earliestDeparture:null,latestDeparture:null,departureWindowText:'12月',durationDays:5,totalTripBudgetCny:null,flightBudgetCny:null,hotelBudgetPerNightCny:null,minimumHotelRating:null,avoidOvernightFlights:null,travelIntents:['festive'],domesticAllowed:null,internationalAllowed:null,pace:null,preferences:[]};
 const result=normalizePreferenceOutput(model,'12月从上海出发，想去巴黎跨年');assert.equal(result.interpretation.destination,'Paris');assert.equal(result.interpretation.destinationState,'provided');assert.ok(result.warnings.some(value=>/precedence/.test(value)));
});

test('stale discovery selection is invalidated when a new explicit destination is submitted',()=>{
 const stale={city:'Lijiang',score:88},cleared=clearedDiscoverySelection('Paris',stale);assert.equal(cleared.chosenCandidate,null);assert.equal(cleared.discoveryResult,undefined);assert.equal(cleared.discoverySnapshot,null);assert.equal(cleared.discoveryFilter,'all');
 const matching={city:'Paris',score:90};assert.equal(clearedDiscoverySelection('Paris',matching).chosenCandidate,matching);
});

test('confirmed Paris remains the TravelResearch destination and its POIs enter the itinerary',async()=>{
 const draft=await parser.parse('12月从上海出发，去巴黎玩5天'),flow=destinationFlowForDraft(draft),session=new TripWorkspaceSession({trip:{origin:draft.fields.origin,destination:flow.destination,nights:draft.fields.nights}}),place={id:'paris-open-poi',provider:'wikivoyage',providerPlaceId:'Paris#Louvre',canonicalName:'Louvre Museum',displayName:'Louvre Museum',names:{zh:'卢浮宫',en:'Louvre Museum'},destinationId:'paris',category:'museum',areaKey:'geo_paris_center',coordinates:{lat:48.8606,lng:2.3376,lon:2.3376,coordinateSystem:'WGS84'},source:'wikivoyage',verificationState:'OPEN_SOURCE_VERIFIED',planningTags:['art','museum'],planningSignals:{destinationRepresentativeness:1},openingHours:null};
 session.applyResearchResult({destination:{id:'paris',name:'Paris'},candidatePois:[place],sources:[],researchStatus:'OPEN_SOURCE_VERIFIED'});
 assert.equal(session.experience.trip.destination,'Paris');assert.equal(session.experience.research.destination.id,'paris');assert.equal(session.experience.itinerary.days[0].activities[0].placeId,'paris-open-poi');
});
