import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {applyCompletePlanDefaults} from '../dist/lib/complete-plan-defaults.js';
import {createTripRequest} from '../dist/lib/trip-request.js';
import {prepareExploration} from '../dist/lib/planning-service.js';
import {discoverDestinations,DemoDestinationDiscoveryService,DestinationRecommendationSession} from '../dist/lib/discovery/destination-discovery.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {renderRoutePreview,renderTripSections} from '../dist/trip-view.js';
import {LocalDestinationVisualProvider} from '../dist/lib/discovery/destination-visual-provider.js';

const now=new Date('2026-09-18T00:00:00Z');

async function minimalPlan(){
 const parsed=applyCompletePlanDefaults(await new DemoPreferenceParser().parse('12月想出去玩'));
 const request=createTripRequest({...parsed.fields,destination:null,departureWindowText:parsed.dateHint});
 const planning=prepareExploration(request,{now,language:'zh'});
 const discovery=await discoverDestinations({...request,durationDays:planning.nights},{now,language:'zh',mode:'demo',discoveryService:new DemoDestinationDiscoveryService()});
 const candidate=discovery.candidates[0];
 const workspace=new TripWorkspaceSession({trip:{...planning.trip,destination:candidate.city,nights:planning.nights},plan:planning,candidate,flightVerification:candidate.verification});
 return {parsed,request,planning,discovery,candidate,workspace};
}

test('minimal broad idea produces a complete editable starting plan with explicit defaults',async()=>{
 const {parsed,planning,discovery,workspace}=await minimalPlan();
 assert.equal(parsed.fields.origin,'Shanghai');assert.equal(parsed.originAssumption,true);
 assert.ok(discovery.candidates.length>=15);assert.ok(planning.windows.length);
 assert.equal(workspace.pace,'balanced');assert.equal(workspace.spendingOrientation,'value');
 assert.ok(workspace.experience.transport.preferredMode);assert.ok(workspace.experience.stay.primaryArea);
 assert.equal(workspace.experience.itinerary.days.length,planning.nights);
 assert.ok(workspace.experience.itinerary.days.every(day=>day.activities.length>=3));
});

test('same normalized request is stable across five runs and changes only on explicit pagination',async()=>{
 const {discovery,request}=await minimalPlan(),session=new DestinationRecommendationSession({seed:19}),key=discovery.requestKey;
 const runs=Array.from({length:5},()=>session.select(discovery.candidates,{...request,requestKey:key},3).map(item=>item.id));
 runs.slice(1).forEach(ids=>assert.deepEqual(ids,runs[0]));
 const next=session.next(key,discovery.candidates,request,3).map(item=>item.id);
 assert.equal(next.filter(id=>runs[0].includes(id)).length,0);
});

test('pace controls activity density while spending orientation changes deterministic planning guidance',()=>{
 const trip=createTripRequest({origin:'Shanghai',destination:'Hangzhou',nights:2});
 const workspace=new TripWorkspaceSession({trip});
 assert.equal(workspace.experience.itinerary.days[0].activities.length,3);
 workspace.changePace('relaxed');assert.equal(workspace.experience.itinerary.days[0].activities.length,2);
 workspace.changePace('intensive');assert.equal(workspace.experience.itinerary.days[0].activities.length,5);
 const value=new TripWorkspaceSession({trip,spendingOrientation:'value'}).experience;
 const comfort=new TripWorkspaceSession({trip,spendingOrientation:'comfort'}).experience;
 assert.notEqual(value.stay.reason.zh,comfort.stay.reason.zh);
 assert.notEqual(value.transport.options.find(x=>x.mode==='train').suitabilityScore,comfort.transport.options.find(x=>x.mode==='train').suitabilityScore);
});

test('route preview follows the itinerary order and updates after an edit',()=>{
 const session=new TripWorkspaceSession({trip:createTripRequest({origin:'Shanghai',destination:'Tokyo',nights:1})});
 const day=session.experience.itinerary.days[0],first=day.activities[0];
 const before=renderRoutePreview(day,'zh');assert.match(before,new RegExp(`<b>1</b>(?:<span>)?${first.place.names.zh}`));
 session.removeActivity(1,first.id);const after=renderRoutePreview(session.experience.itinerary.days[0],'zh');
 assert.doesNotMatch(after,new RegExp(first.place.names.zh));assert.match(after,/<b>1<\/b>/);
});

test('transport, stay, opening-hours and navigation data preserve verification boundaries',()=>{
 const unknown=buildTripExperience({trip:{origin:'Shanghai',destination:'Hangzhou',nights:3},flightVerification:{status:'not_checked'}});
 for(const option of unknown.transport.options){assert.equal(option.price,null);assert.equal(option.referenceLevel,'unknown');}
 assert.equal(unknown.stay.hotelName,null);assert.equal(unknown.stay.price,null);assert.equal(unknown.stay.availability,null);
 assert.ok(unknown.itinerary.days.flatMap(day=>day.activities).every(item=>item.openingHoursState==='unverified'));
 assert.ok(unknown.itinerary.days.every(day=>day.routeDurationMinutes==null&&day.routeDistanceMeters==null));
 const html=renderTripSections(unknown,'zh');assert.match(html,/预算参考：(?:低|中|高)/);assert.doesNotMatch(html,/预算参考 · ¥/);
 const quote={price:880,currency:'CNY',provider:'Duffel',stops:0,segments:[]};
 const verified=buildTripExperience({trip:{origin:'Shanghai',destination:'Tokyo',nights:3},flightVerification:{status:'verified',source:'live',quote}});
 assert.equal(verified.transport.options.find(x=>x.mode==='flight').referenceLevel,'verified');
 assert.match(renderTripSections(verified,'zh'),/已核验 · Duffel · ¥880/);
});

test('required non-text travel collage motifs are present and image count stays restrained',async()=>{
 const css=await readFile(new URL('../dist/product.css',import.meta.url),'utf8'),app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(css,/\.ask-state:before/);assert.match(css,/\.ask-state:after/);
 assert.match(css,/\.destination-pin-motif/);assert.match(css,/\.trip-stamp-motif/);
 assert.match(app,/destination-pin-motif/);
 const visual=new LocalDestinationVisualProvider().getVisual('Harbin');assert.notEqual(visual.heroImages[0].src,visual.scenicImages[0].src);
 const {workspace}=await minimalPlan(),html=renderTripSections(workspace.experience,'zh');
 assert.ok((html.match(/<img\b/g)||[]).length<=2);
});
