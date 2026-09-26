import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WikivoyageResearchProvider,extractListingTemplates,normalizeWikivoyageListings} from '../server/research/wikivoyage-research-provider.js';
import {TravelResearchService,deduplicateTravelPois} from '../server/research/travel-research-service.js';
import {SOURCE_REGISTRY,approvedResearchUrl} from '../server/research/source-registry.js';
import {createTravelResearchApi} from '../server/travel-research-api.js';
import {normalizeTravelPoi,canonicalCoordinates,VerificationState} from '../dist/lib/models/canonical-poi.js';
import {buildPoiItinerary} from '../dist/lib/poi-itinerary.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {renderTravelFootprintMap,renderTripSections} from '../dist/trip-view.js';
import {TravelResearchClient} from '../dist/lib/providers/travel-research-client.js';

const controller={run:(_session,_kind,task)=>task(new AbortController().signal)};
const listingFixture=`
{{see | name=Louvre Museum | lat=48.8606 | long=2.3376 | type=art museum | content=Major art museum in a historic palace.}}
{{do | name=Tuileries Garden | lat=48.8635 | long=2.3275 | type=park | content=Historic garden near the Louvre.}}
{{eat | name=Marché Bastille | type=market | content=Local food market.}}
`;
const source=(title='Paris')=>({provider:'Wikivoyage',sourceType:'open_travel_guide',sourceUrl:`https://en.wikivoyage.org/wiki/${title}`,retrievedAt:'2026-09-27T00:00:00.000Z',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',attribution:'Wikivoyage contributors',verificationLevel:'open_source'});
const poi=(id,{destinationId='paris',category='culture',tags=[category],lat=48.85,lng=2.34,provider='wikivoyage',representativeness=.7}={})=>normalizeTravelPoi({id,provider,providerPlaceId:`place-${id}`,canonicalName:id,displayName:id,names:{zh:id,en:id},destinationId,category,coordinates:canonicalCoordinates(lat,lng,provider==='amap'?'GCJ02':'WGS84'),source:provider,sourceType:provider==='amap'?'live_place_provider':'open_travel_guide',sourceUrl:provider==='amap'?'https://lbs.amap.com/':`https://en.wikivoyage.org/wiki/${destinationId}`,sourceAttribution:{provider:provider==='amap'?'高德地图':'Wikivoyage',required:true},provenance:provider==='amap'?[]:[source(destinationId)],verificationState:provider==='amap'?VerificationState.LIVE_VERIFIED:VerificationState.OPEN_SOURCE_VERIFIED,planningTags:tags,planningSignals:{destinationRepresentativeness:representativeness},dataFetchedAt:'2026-09-27T00:00:00.000Z'});
const researchResult=(destinationId,places,status=VerificationState.OPEN_SOURCE_VERIFIED)=>({destination:{id:destinationId,name:destinationId},candidatePois:places,destinationInsights:[],sources:[source(destinationId)],researchStatus:status});

test('Wikivoyage provider parses named listings into normalized POIs without copying article prose',async()=>{
 assert.equal(extractListingTemplates(listingFixture).length,3);
 const places=normalizeWikivoyageListings({wikitext:listingFixture,pageTitle:'Paris',revid:42,destination:'Paris',country:'France',destinationId:'paris',retrievedAt:'2026-09-27T00:00:00.000Z'});
 assert.deepEqual(places.map(place=>place.canonicalName),['Louvre Museum','Tuileries Garden','Marché Bastille']);
 assert.equal(places[0].verificationState,VerificationState.OPEN_SOURCE_VERIFIED);assert.equal(places[2].coordinates,null);assert.ok(places[0].planningTags.includes('art'));
 assert.equal(places[0].provenance[0].license,'CC BY-SA 4.0');assert.doesNotMatch(JSON.stringify(places),/Major art museum in a historic palace/);
 const provider=new WikivoyageResearchProvider({controller,maxDistrictPages:0,fetchImpl:async()=>({ok:true,json:async()=>({parse:{title:'Paris',revid:42,wikitext:listingFixture,links:[],sections:[{line:'See'}]}})})});
 const result=await provider.research({sessionId:'wiki',destinationId:'paris',destinationName:'Paris',countryName:'France'});assert.equal(result.candidatePois.length,3);assert.equal(result.sources[0].provider,'Wikivoyage');
});

test('TravelResearchService deduplicates POIs, retains provenance, and prefers AMap for mainland China',async()=>{
 const duplicateA=poi('one',{tags:['art'],lat:48.85,lng:2.34}),duplicateB={...poi('two',{tags:['museum'],lat:48.85,lng:2.34}),canonicalName:'one',provenance:[source('Paris/1st')]};
 const deduped=deduplicateTravelPois([duplicateA,duplicateB]);assert.equal(deduped.length,1);assert.deepEqual(new Set(deduped[0].planningTags),new Set(['art','museum']));assert.equal(deduped[0].provenance.length,2);
 let wikiCalls=0;const amapPlaces=Array.from({length:10},(_,index)=>poi(`上海地点${index}`,{destinationId:'shanghai',provider:'amap',lat:31.2+index*.001,lng:121.45+index*.001}));
 const service=new TravelResearchService({amapProvider:{searchDestinationPOIs:async()=>amapPlaces},wikivoyageProvider:{research:async()=>{wikiCalls++;return {candidatePois:[]};}}});
 const result=await service.research({countryCode:'CN',destinationId:'shanghai',destinationName:'Shanghai',categories:['culture']});assert.equal(result.researchStatus,VerificationState.LIVE_VERIFIED);assert.equal(result.candidatePois.length,10);assert.equal(wikiCalls,0);
});

test('without an AMap key, mainland research uses open data and provider failure remains explicit',async()=>{
 const openPlaces=[poi('The Bund',{destinationId:'shanghai'})],service=new TravelResearchService({wikivoyageProvider:{research:async()=>({candidatePois:openPlaces,destinationInsights:[],sources:[source('Shanghai')]})}});
 const open=await service.research({countryCode:'CN',destinationId:'shanghai',destinationName:'Shanghai'});assert.equal(open.researchStatus,VerificationState.OPEN_SOURCE_VERIFIED);
 const unavailable=await new TravelResearchService({wikivoyageProvider:{research:async()=>{throw Object.assign(new Error('offline'),{code:'PROVIDER_UNAVAILABLE'});}}}).research({countryCode:'FR',destinationId:'paris',destinationName:'Paris'});
 assert.equal(unavailable.researchStatus,VerificationState.UNAVAILABLE);assert.equal(unavailable.candidatePois.length,0);assert.equal(unavailable.errorCode,'PROVIDER_UNAVAILABLE');
});

test('preference relevance and coordinates materially affect deterministic POI ranking and clustering',()=>{
 const places=[poi('Architecture Museum',{category:'museum',tags:['art','architecture'],lat:48.850,lng:2.340}),poi('Nearby Gallery',{category:'museum',tags:['art'],lat:48.851,lng:2.341}),poi('Far Landmark',{tags:['landmark'],lat:48.95,lng:2.55}),poi('Nearby Garden',{category:'nature',tags:['nature'],lat:48.852,lng:2.342})];
 const art=buildPoiItinerary({places,nights:1,pace:'balanced',preferenceText:'喜欢艺术和建筑'}),neutral=buildPoiItinerary({places,nights:1,pace:'balanced'});
 assert.equal(art.days[0].activities[0].placeId,'Architecture Museum');assert.equal(art.days[0].activities[1].placeId,'Nearby Gallery');assert.notEqual(neutral.days[0].activities[0].placeId,undefined);
 assert.match(art.days[0].labels.zh,/艺术与博物馆|城市建筑与经典/);
});

test('research POIs create concrete pace-aware itineraries and coordinate footprints for Shanghai, Paris, and Tokyo',()=>{
 const cases=[
  {destination:'Shanghai',id:'shanghai',nights:3,pace:'balanced',notes:'喜欢建筑、美食',provider:'amap',count:12,tags:index=>index%2?['food']:['architecture']},
  {destination:'Paris',id:'paris',nights:5,pace:'relaxed',notes:'喜欢艺术、建筑，不想太赶',provider:'wikivoyage',count:14,tags:index=>index%2?['art','museum']:['architecture']},
  {destination:'Tokyo',id:'tokyo',nights:4,pace:'balanced',notes:'喜欢美食、城市街区',provider:'wikivoyage',count:16,tags:index=>index%2?['food']:['neighborhood']}
 ];
 for(const item of cases){const places=Array.from({length:item.count},(_,index)=>poi(`${item.destination} Real Place ${index+1}`,{destinationId:item.id,provider:item.provider,category:index%3===0?'food':'culture',tags:item.tags(index),lat:(item.id==='shanghai'?31.2:item.id==='tokyo'?35.67:48.85)+(index%5)*.002,lng:(item.id==='shanghai'?121.45:item.id==='tokyo'?139.72:2.33)+Math.floor(index/5)*.003})),session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:item.destination,nights:item.nights,notes:item.notes},pace:item.pace});session.applyResearchResult(researchResult(item.id,places,item.provider==='amap'?VerificationState.LIVE_VERIFIED:VerificationState.OPEN_SOURCE_VERIFIED));
  const activities=session.experience.itinerary.days.flatMap(day=>day.activities);assert.ok(activities.length>=item.nights*2);assert.ok(activities.every(activity=>activity.place.source!=='planning_template'));assert.match(renderTravelFootprintMap(session.experience.itinerary.days[0],'zh'),/data-route-state="coordinates"/);
  assert.ok(session.experience.itinerary.days.every(day=>day.activities.length===(item.pace==='relaxed'?2:3)));
 }
});

test('research provenance is visible but restrained, and edits preserve unrelated days',()=>{
 const places=Array.from({length:12},(_,index)=>poi(`Paris Place ${index+1}`,{tags:index%2?['art']:['architecture'],lat:48.84+(index%4)*.002,lng:2.32+Math.floor(index/4)*.003})),session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:'Paris',nights:3,notes:'喜欢艺术'}});session.applyResearchResult(researchResult('paris',places));
 const untouched=session.experience.itinerary.days[1],first=session.experience.itinerary.days[0].activities[0];session.removeActivity(1,first.id);assert.equal(session.experience.itinerary.days[1],untouched);
 const html=renderTripSections(session.experience,'zh');assert.match(html,/开放旅行资料 · Wikivoyage/);assert.match(html,/数据与来源/);assert.match(html,/CC BY-SA 4.0/);assert.doesNotMatch(html,/OPEN_SOURCE_VERIFIED/);
});

test('provider timeout falls back safely in the product and never creates fake verification',async()=>{
 const api=createTravelResearchApi({env:{PROVIDER_TIMEOUT_MS:'2'},fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('network detail'),{name:'AbortError'}))))});
 await assert.rejects(api.research({sessionId:'timeout',destinationId:'paris',destinationName:'Paris',countryCode:'FR'}),{code:'PROVIDER_TIMEOUT'});
 const session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:'Paris',nights:2}}),before=session.experience.itinerary.placeSource;session.applyResearchResult({candidatePois:[],researchStatus:VerificationState.UNAVAILABLE});assert.equal(session.experience.itinerary.placeSource,before);assert.ok(session.experience.itinerary.days.flatMap(day=>day.activities).length>0);assert.notEqual(session.experience.research?.researchStatus,VerificationState.LIVE_VERIFIED);
});

test('source registry excludes commercial scraping and browser research requests contain no credentials',async()=>{
 assert.deepEqual(Object.keys(SOURCE_REGISTRY).sort(),['amap','wikivoyage']);assert.equal(approvedResearchUrl('https://en.wikivoyage.org/wiki/Paris'),true);for(const host of ['tripadvisor.com','ctrip.com','xiaohongshu.com','booking.com'])assert.equal(approvedResearchUrl(`https://${host}/place`),false);
 const client=new TravelResearchClient({fetchImpl:async(url,options)=>{assert.equal(url,'/api/travel/research');assert.doesNotMatch(options.body,/api.?key|authorization|AMAP_WEB_SERVICE_KEY/i);return {ok:true,json:async()=>({candidatePois:[]})};}});await client.research({sessionId:'safe',destinationId:'paris'});
 const sources=await Promise.all([readFile(new URL('../dist/lib/providers/travel-research-client.js',import.meta.url),'utf8'),readFile(new URL('../dist/app.js',import.meta.url),'utf8')]);assert.doesNotMatch(sources.join('\n'),/process\.env|AMAP_WEB_SERVICE_KEY/);
});
