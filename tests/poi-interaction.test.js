import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {buildPoiInteractionModel,renderTravelFootprintMap,renderTripSections} from '../dist/trip-view.js';

const experience=destination=>buildTripExperience({trip:{origin:'Shanghai',destination,nights:2,spendingOrientation:'value'}});

test('every current itinerary POI receives the same data-driven marker and expansion in Tokyo and Paris',()=>{
 for(const destination of ['Tokyo','Paris']){
  const trip=experience(destination),day=trip.itinerary.days[0],map=renderTravelFootprintMap(day,'en'),sections=renderTripSections(trip,'en');
  assert.ok(day.activities.length>=3);
  assert.equal((map.match(/data-poi-trigger="map"/g)||[]).length,day.activities.length);
  assert.equal((map.match(/data-poi-expansion=/g)||[]).length,day.activities.length);
  assert.equal((map.match(/class="footprint-route footprint-segment"/g)||[]).length,day.activities.length-1);
  for(const activity of day.activities){
   assert.match(map,new RegExp(`data-route-stop="${activity.id}"`));
   assert.match(map,new RegExp(`data-poi-expansion="${activity.id}"`));
   assert.match(sections,new RegExp(`data-poi-trigger="itinerary"[^>]*data-day="${day.day}"`));
  }
 }
});

test('POI model derives identity, stay guidance, and adjacent routes without city-specific logic',()=>{
 const day={day:4,activities:[
  {id:'alpha',startTime:'09:00',endTime:'10:00',routeState:'unverified',travelMinutes:null,place:{id:'a',names:{zh:'甲地',en:'Place Alpha'},canonicalName:'Place Alpha',category:'culture',verificationState:'CURATED'}},
  {id:'bravo',startTime:'10:30',endTime:'12:00',schedulePrecision:'approximate',routeState:'verified',travelMinutes:18,place:{id:'b',names:{zh:'乙地',en:'Place Bravo'},canonicalName:'Place Bravo',category:'museum',verificationState:'LIVE_VERIFIED',recommendationReason:'Matches the current art preference.'}},
  {id:'charlie',startTime:'13:00',endTime:'14:00',routeState:'verified',travelMinutes:12,place:{id:'c',names:{zh:'丙地',en:'Place Charlie'},canonicalName:'Place Charlie',category:'nature',verificationState:'OPEN_SOURCE_VERIFIED'}}
 ]};
 const model=buildPoiInteractionModel(day,1,'en');
 assert.equal(model.id,'bravo');assert.equal(model.localizedName,'Place Bravo');assert.equal(model.durationMinutes,90);assert.equal(model.durationState,'planning_guidance');
 assert.deepEqual(model.previous,{name:'Place Alpha',verified:true,durationMinutes:18});
 assert.deepEqual(model.next,{name:'Place Charlie',verified:true,durationMinutes:12});
 assert.equal(model.recommendationReason,'Matches the current art preference.');
 const html=renderTravelFootprintMap(day,'en');assert.match(html,/Timing planning guidance/);assert.match(html,/Verified · walk 18 min/);assert.match(html,/Matches the current art preference/);
});

test('missing POI photo, reason, and route metrics degrade without invented facts',()=>{
 const day={day:1,activities:[{id:'one',startTime:'--:--',endTime:'--:--',routeState:'unverified',travelMinutes:null,place:{id:'one',names:{zh:'地点一',en:'Place One'},category:'culture',coordinates:null,source:'user'}}]};
 const model=buildPoiInteractionModel(day,0,'en'),html=renderTravelFootprintMap(day,'en');
 assert.equal(model.image,null);assert.equal(model.recommendationReason,null);assert.equal(model.durationMinutes,null);
 assert.match(html,/poi-expansion-visual is-fallback/);assert.doesNotMatch(html,/Why Timing recommends it|Verified · walk|Photo:/);
});

test('POI interaction implementation contains no example-city or example-place branches',async()=>{
 const [view,app]=await Promise.all(['trip-view.js','app.js'].map(name=>readFile(new URL(`../dist/${name}`,import.meta.url),'utf8')));
 const source=view+app;
 for(const value of ['浅草寺','隅田公园','东京晴空塔'])assert.doesNotMatch(source,new RegExp(value));
 assert.doesNotMatch(source,/destination\s*===\s*['"]Tokyo['"]/);
 assert.match(app,/function activatePoi\(root,stopId,source\)/);assert.match(app,/dataset\.routeFrom===active\|\|segment\.dataset\.routeTo===active/);
});

test('hero typography uses the requested modern sans stack and desktop one-line treatment',async()=>{
 const css=await readFile(new URL('../dist/product.css',import.meta.url),'utf8'),v2=css.slice(css.lastIndexOf('/* Journey V2:'));
 assert.match(v2,/font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif/);
 assert.match(v2,/font-size:clamp\(48px,5vw,68px\)/);
 assert.match(v2,/@media\(min-width:900px\)[^{]*\{[^}]*white-space:nowrap/);
 assert.match(v2,/@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*\.poi-expansion/);
});
