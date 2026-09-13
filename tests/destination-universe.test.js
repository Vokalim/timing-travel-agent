import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {DESTINATION_UNIVERSE,getDestination} from '../dist/lib/discovery/destination-universe.js';
import {CuratedDestinationAccessResolver,planningCandidateForDestination} from '../dist/lib/discovery/destination-access-resolver.js';
import {discoverDestinations,DemoDestinationDiscoveryService,DestinationRecommendationSession,rerankDestinations} from '../dist/lib/discovery/destination-discovery.js';
import {presentDestination} from '../dist/lib/discovery/destination-identity.js';
import {presentDiscoveryCandidate,displayTransportStatus} from '../dist/lib/display-localization.js';
import {LocalDestinationVisualProvider} from '../dist/lib/discovery/destination-visual-provider.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {renderTripSections} from '../dist/trip-view.js';
import {LLMDestinationDiscoveryService as ServerDiscoveryService} from '../server/llm-destination-discovery.js';
import {DESTINATION_DISCOVERY_SCHEMA} from '../server/destination-discovery-schema.js';

const now=new Date('2026-09-13T00:00:00Z'),noFlights={search:async()=>[]};
const base={origin:'Shanghai',destination:null,departureWindowText:'December',durationDays:5,travelIntents:[]};
const demo=new DemoDestinationDiscoveryService();
const discover=(preferences=base,options={})=>discoverDestinations(preferences,{now,flightProvider:noFlights,discoveryService:demo,...options});

test('destination universe is a country/region/place hierarchy independent of airport support',()=>{
 assert.ok(DESTINATION_UNIVERSE.length>=70);
 for(const city of ['Jingdezhen','Quanzhou','Yanji','Wuyuan','Chaozhou','Hakodate','Fukuoka','Chiang Mai','Da Nang','Penang'])assert.equal(getDestination(city)?.discoveryTier,'long_tail',city);
 const nara=getDestination('Nara');assert.equal(nara.entityType,'historic_destination');assert.equal(nara.countryCode,'JP');assert.equal(nara.region,'Nara');assert.equal(nara.directAirportCode,null);
 assert.deepEqual(nara.coordinates,{lat:null,lon:null});assert.equal(nara.names.zh,'奈良');assert.equal(nara.names.en,'Nara');
 assert.equal(getDestination('Hoi An').transportAccess.airportHubIds[0],'da_nang');
 assert.equal(getDestination('Wuyuan').transportAccess.railHubIds[0],'wuyuan');
 for(const entity of DESTINATION_UNIVERSE)for(const hubId of [...entity.transportAccess.airportHubIds,...entity.transportAccess.railHubIds])assert.ok(getDestination(hubId),`${entity.id} → ${hubId}`);
});

test('strict LLM candidate schema accepts real curated places without direct IATA codes',async()=>{
 const cities=['Nara','Hoi An','Fukuoka','Quanzhou','Dali'];
 const candidates=cities.map(city=>({city,countryOrRegion:getDestination(city).countryNames.en,iataOrMetroCode:getDestination(city).directAirportCode,themes:['culture'],seasonalReasons:[],generalReasons:[],estimatedFitSignals:[],sourceType:'llm_suggestion',confidence:'medium'}));
 let request;const fetchImpl=async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({candidates})})};};
 const result=await new ServerDiscoveryService({apiKey:'fixture-only',fetchImpl}).discover(base,{});
 assert.deepEqual(result.candidates.map(candidate=>candidate.city),cities);
 assert.equal(result.candidates[0].iataOrMetroCode,null);assert.equal(result.candidates[1].iataOrMetroCode,null);
 assert.equal(DESTINATION_DISCOVERY_SCHEMA.properties.candidates.maxItems,20);
 assert.match(request.instructions,/Nara.*Hoi An|Hoi An.*Nara/);assert.doesNotMatch(request.instructions,/Choose only from Beijing \(BJS\)/);
});

test('curated fallback generates 15–30 non-capital and mixed geography candidates',async()=>{
 const generated=await demo.discover(base,{inferredTravelIntents:['food','snow_winter']});
 assert.equal(generated.candidates.length,30);assert.ok(generated.candidates.some(c=>c.city==='Yanji'));
 assert.ok(generated.candidates.some(c=>c.countryOrRegion==='China'));assert.ok(generated.candidates.some(c=>c.countryOrRegion!=='China'));
 assert.ok(generated.candidates.some(c=>c.iataOrMetroCode===null));
});

test('capital status is not a ranking bonus and iconic capitals do not occupy the broad shortlist',async()=>{
 const result=await discover({...base,geographyPreference:'international'});
 assert.ok(result.candidates.length>=15);
 const shortlist=result.candidates.slice(0,3),famous=new Set(['Hong Kong','Tokyo','Seoul']);
 assert.ok(shortlist.filter(c=>famous.has(c.city)).length<=1);
 assert.ok(shortlist.some(c=>getDestination(c).discoveryTier==='long_tail'));
 assert.ok(new Set(shortlist.map(c=>c.sceneryCategory)).size>=2);
 const food=await discoverDestinations({...base,departureWindowText:'July',travelIntents:['food']},{now,flightProvider:noFlights,discoveryService:{discover:async()=>({source:'fixture',candidates:['Fukuoka','Tokyo'].map(city=>({city,countryOrRegion:'Japan',themes:['food']}))})}});
 assert.ok(food.candidates.find(c=>c.city==='Fukuoka')?.score>food.candidates.find(c=>c.city==='Tokyo')?.score);
});

test('session refresh deterministically avoids recently shown places without another model call',async()=>{
 const result=await discover(),session=new DestinationRecommendationSession({seed:12});
 const first=session.select(result.candidates,base),second=session.select(result.candidates,base);
 assert.equal(first.length,3);assert.equal(second.length,3);assert.equal(first.filter(c=>second.includes(c)).length,0);
 assert.ok(new Set(first.map(c=>c.sceneryCategory)).size>=2);
 const replay=new DestinationRecommendationSession({seed:12});assert.deepEqual(replay.select(result.candidates,base).map(c=>c.id),first.map(c=>c.id));
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');assert.match(app,/show-more-ideas[^\n]*renderDiscovery\(data,true\)/);assert.doesNotMatch(app,/show-more-ideas[^\n]*discoverDestinations/);
});

test('precise intent can outweigh diversity while broad intent favors archetype spread',()=>{
 const candidates=[['Sanya',80],['Beihai',78],['Quanzhou',65]].map(([city,score])=>({id:getDestination(city).id,city,countryOrRegion:'China',entityType:getDestination(city).entityType,score}));
 const broad=rerankDestinations(candidates,{limit:3}),precise=rerankDestinations(candidates,{travelIntents:['beach'],limit:3});
 assert.equal(broad[0].city,'Sanya');assert.equal(broad[1].city,'Quanzhou');assert.equal(precise[1].city,'Beihai');
});

test('nearby hub resolution never invents transfer duration, fare or confirmed availability',()=>{
 const resolver=new CuratedDestinationAccessResolver(),nara=resolver.resolve({city:'Nara'}),hoiAn=resolver.resolve({city:'Hoi An'}),wuyuan=resolver.resolve({city:'Wuyuan'});
 assert.equal(nara.flightAccess.hub.canonicalName,'Osaka');assert.equal(nara.flightAccess.providerLookup,'Osaka');assert.equal(nara.flightAccess.requiresOnwardTransfer,true);
 assert.equal(hoiAn.flightAccess.hub.canonicalName,'Da Nang');assert.equal(hoiAn.flightAccess.providerLookup,null);
 assert.equal(wuyuan.railAccess.hub.canonicalName,'Wuyuan');assert.equal(wuyuan.selfDriveAccess.suitable,true);
 for(const access of [nara,hoiAn,wuyuan]){assert.equal(access.flightAccess.verificationState,'unverified');assert.equal(access.railAccess.verificationState,'unverified');assert.equal(access.selfDriveAccess.notes,null);assert.equal('transferMinutes' in access,false);assert.equal('fare' in access,false);}
});

test('an explicitly named unsupported destination still opens an unpriced planning candidate',async()=>{
 const candidate=planningCandidateForDestination('Fukuoka','live');assert.equal(candidate.city,'Fukuoka');assert.equal(candidate.access.flightAccess.providerLookup,null);
 assert.equal(candidate.verification.status,'not_checked');assert.equal(planningCandidateForDestination('Invented Place','live'),null);
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');assert.match(app,/planningCandidateForDestination\(t.destination,mode\)/);
 assert.match(app,/t.destination=getDestination\(t.destination\)\?\.canonicalName/);
 assert.match(app,/candidate&&\(!candidate.access\?\.flightAccess.providerLookup\|\|candidate.access.flightAccess.requiresOnwardTransfer\)\)\{renderStandaloneTrip/);
});

test('a hub flight is only partially verified and its fare is never treated as the destination total',async()=>{
 const calls=[],quote={price:900,stops:0,currency:'CNY',departureDateTime:'2026-12-05T09:00:00+08:00',returnDateTime:'2026-12-10T10:00:00+09:00'};
 const nara={city:'Nara',countryOrRegion:'Japan',iataOrMetroCode:null,themes:['culture']};
 const result=await discoverDestinations(base,{now,mode:'live',discoveryService:{discover:async()=>({source:'fixture',candidates:[nara]})},flightProvider:{search:async trip=>{calls.push(trip.destination);return [quote];}}});
 const found=result.candidates[0];assert.ok(calls.length&&calls.every(name=>name==='Osaka'));
 assert.equal(found.verification.status,'partially_verified');assert.equal(found.verification.hubQuote.price,900);assert.equal('quote' in found.verification,false);
 assert.equal(found.transport.flight.price,null);assert.match(displayTransportStatus(found,'zh'),/大阪.*奈良.*总价待核验/);
 const experience=buildTripExperience({trip:{origin:'Shanghai',destination:'Nara',nights:5},candidate:found,flightVerification:found.verification});
 assert.ok(experience.stay.areas.length&&experience.itinerary.days.length===5);
 assert.equal(experience.transport.options.find(option=>option.mode==='flight').price,null);
 assert.match(renderTripSections(experience,'zh'),/接驳与总价待核验/);
});

test('unsupported airport, failed Duffel, rail-only and road-trip candidates remain eligible',async()=>{
 const candidates=['Hoi An','Wuyuan','Dali'].map(city=>({city,countryOrRegion:getDestination(city).countryNames.en,themes:getDestination(city).destinationTraits}));
 const service={discover:async()=>({source:'fixture',candidates})},provider={search:async()=>{throw new Error('Duffel unavailable');}};
 const result=await discoverDestinations(base,{now,mode:'live',discoveryService:service,flightProvider:provider});
 assert.deepEqual(new Set(result.candidates.map(c=>c.city)),new Set(['Hoi An','Wuyuan','Dali']));
 assert.equal(result.candidates.find(c=>c.city==='Hoi An').verification.status,'not_checked');
 assert.equal(result.candidates.find(c=>c.city==='Dali').verification.status,'unavailable');
 assert.ok(result.candidates.every(c=>!c.verification.quote));
 const rail=await discoverDestinations({...base,notes:'只坐高铁'},{now,discoveryService:service,flightProvider:provider});assert.ok(rail.candidates.some(c=>c.city==='Wuyuan'&&c.transport.train.allowed));
 const drive=await discoverDestinations({...base,notes:'只自驾'},{now,discoveryService:service,flightProvider:provider});assert.ok(drive.candidates.some(c=>c.city==='Wuyuan'&&c.transport.self_drive.allowed));
});

test('localized identity, reasons and status do not mutate hub or canonical identity',()=>{
 const candidate={city:'Hoi An',countryOrRegion:'Vietnam',themes:['culture','food'],access:new CuratedDestinationAccessResolver().resolve({city:'Hoi An'}),verification:{status:'not_checked'},transport:{}};
 const data={displayPreferences:{travelIntents:['food']},context:{datePrecision:'broad_month',month:11,season:'autumn',inferredTravelIntents:[]}};
 const zh=presentDiscoveryCandidate(candidate,data,'zh'),en=presentDiscoveryCandidate(candidate,data,'en');
 assert.deepEqual([zh.city,zh.country,zh.tags[0],zh.tags.at(-1)],['会安','越南','文化','11月']);
 assert.deepEqual([en.city,en.country,en.tags[0],en.tags.at(-1)],['Hoi An','Vietnam','Culture','November']);
 assert.match(zh.statement,/边吃边逛/);assert.match(en.statement,/food/i);
 assert.match(zh.transportStatus,/岘港.*会安/);assert.match(en.transportStatus,/Da Nang.*Hoi An/);
 assert.doesNotMatch([en.city,en.country,en.statement,...en.tags,en.transportStatus].join(' '),/[\u3400-\u9fff]/);
 assert.equal(presentDestination(candidate,'zh').canonicalCity,'Hoi An');assert.equal(candidate.access.flightAccess.hub.canonicalName,'Da Nang');
 assert.doesNotMatch([zh.statement,...zh.tags,zh.transportStatus].join(' '),/\b(food|culture|not_checked|broad_month|self_drive)\b/);
});

test('visuals select city, region, scenery and global fallback regardless of language',async()=>{
 const provider=new LocalDestinationVisualProvider();
 const city=provider.getVisual('Tokyo'),region=provider.getVisual('Sapporo'),category=provider.getVisual('Dunhuang'),grass=provider.getVisual('Hulunbuir'),unknown=provider.getVisual({city:'Unknown Place'});
 assert.deepEqual([city.specificity,region.specificity,category.specificity,unknown.specificity],['city','region','category','global']);
 assert.match(category.heroImages[0].src,/desert-landscape/);assert.match(grass.heroImages[0].src,/grassland-landscape/);
 assert.equal(provider.getVisual('会安').destinationKey,provider.getVisual('Hoi An').destinationKey);
 for(const visual of [city,region,category,grass,unknown])for(const image of [...visual.heroImages,...visual.scenicImages])assert.ok((await stat(new URL(`../dist${image.src}`,import.meta.url))).size>100);
});
