import test from 'node:test';
import assert from 'node:assert/strict';
import {DestinationImageCache,DESTINATION_IMAGE_CACHE_TTL} from '../dist/lib/discovery/destination-image-cache.js';
import {WikimediaDestinationImageDiscovery,acceptedLicense,buildCommonsSearchQuery,scoreCommonsCandidate} from '../dist/lib/discovery/wikimedia-image-discovery.js';
import {LocalDestinationVisualProvider} from '../dist/lib/discovery/destination-visual-provider.js';
import {destinationIdentity} from '../dist/lib/discovery/destination-identity.js';
import {getDestination} from '../dist/lib/discovery/destination-universe.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {renderTripHero} from '../dist/trip-view.js';

const metadata=(place,{license='CC BY-SA 4.0',licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',description=`A panoramic skyline of ${place}`}={})=>({
 LicenseShortName:{value:license},LicenseUrl:{value:licenseUrl},UsageTerms:{value:license},Artist:{value:'<a href="/creator">Verified photographer</a>'},ImageDescription:{value:description},Categories:{value:`Photographs of ${place}|Panoramic skylines`}
});
const page=(place,options={})=>({title:`File:${options.title||`${place} skyline photograph`}.jpg`,imageinfo:[{mime:'image/jpeg',mediatype:'BITMAP',width:3600,height:2000,thumbwidth:1280,thumbheight:711,thumburl:`https://upload.wikimedia.org/${encodeURIComponent(place)}.jpg`,descriptionurl:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(place)}_skyline_photograph.jpg`,extmetadata:metadata(place,options)}]});
const identity=city=>{const base=destinationIdentity(city),known=getDestination(city);return {...base,entityType:known?.entityType||base.entityType||'city'};};

test('Wikimedia discovery accepts only destination-matched reusable landscape photography',()=>{
 const london=identity('London'),accepted=scoreCommonsCandidate(page('London'),london);
 assert.equal(accepted.image.destinationId,'london');assert.equal(accepted.image.kind,'photograph');assert.equal(accepted.image.license,'CC BY-SA 4.0');assert.equal(accepted.image.author,'Verified photographer');
 assert.equal(scoreCommonsCandidate(page('Boston'),london),null);
 assert.equal(scoreCommonsCandidate(page('London',{license:'CC BY-NC 4.0',licenseUrl:'https://creativecommons.org/licenses/by-nc/4.0/'}),london),null);
 assert.equal(scoreCommonsCandidate({...page('London'),title:'File:London visitor map poster.jpg'},london),null);
 const portrait=page('London');portrait.imageinfo[0].width=900;portrait.imageinfo[0].height=1400;assert.equal(scoreCommonsCandidate(portrait,london),null);
 assert.equal(acceptedLicense(metadata('London',{license:'All rights reserved',licenseUrl:'https://example.test'})),null);
});

test('search terms use canonical place and destination type without translated provider strings',()=>{
 assert.equal(buildCommonsSearchQuery(identity('东京')),'Tokyo Japan skyline');
 assert.equal(buildCommonsSearchQuery(identity('Bali')),'Bali Indonesia landscape');
 assert.equal(buildCommonsSearchQuery(identity('Hoi An')),'Hoi An Quang Nam Vietnam landmark');
});

test('selection prefers a representative high-resolution landscape and preserves complete metadata',async()=>{
 const compact=page('London',{title:'London skyline panorama'});compact.imageinfo[0].width=1500;compact.imageinfo[0].height=1200;
 const cinematic=page('London',{title:'London skyline aerial panorama'});cinematic.imageinfo[0].width=4200;cinematic.imageinfo[0].height=2400;cinematic.imageinfo[0].thumburl='https://upload.wikimedia.org/london-cinematic.jpg';
 const service=new WikimediaDestinationImageDiscovery({fetchImpl:async()=>({ok:true,json:async()=>({query:{pages:[compact,cinematic]}})}),timeoutMs:100});
 const image=await service.discover(identity('London'));
 assert.equal(image.url,'https://upload.wikimedia.org/london-cinematic.jpg');
 assert.deepEqual([image.destinationId,image.destinationIdentity,image.imageWidth,image.imageHeight],['london','london',4200,2400]);
 for(const field of ['source','sourceUrl','author','license','licenseUrl'])assert.equal(typeof image[field],'string');
});

test('Wikivoyage page image is accepted only after Commons license and relevance validation',async()=>{
 let calls=0;const service=new WikimediaDestinationImageDiscovery({fetchImpl:async url=>{calls++;
  if(url.startsWith('https://commons.wikimedia.org')&&url.includes('generator=search'))return {ok:true,json:async()=>({query:{pages:[]}})};
  if(url.startsWith('https://en.wikivoyage.org'))return {ok:true,json:async()=>({query:{pages:[{pageimage:'Hallstatt panorama.jpg'}]}})};
  return {ok:true,json:async()=>({query:{pages:[page('Hallstatt',{title:'Hallstatt Austria landscape panorama',description:'Panoramic landscape of Hallstatt Austria'})]}})};
 },timeoutMs:100});
 const image=await service.discover(destinationIdentity({city:'Hallstatt',countryOrRegion:'Austria',entityType:'historic_destination'}));
 assert.equal(calls,3);assert.equal(image.destinationIdentity,'hallstatt');assert.equal(image.resolutionSource,'wikivoyage-page-image');assert.match(image.license,/CC BY-SA/);
});

test('verified and failed discoveries use separate expiries and never search every render',async()=>{
 let now=1000,calls=0;const storage=new Map(),storageAdapter={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const cache=new DestinationImageCache({storage:storageAdapter,now:()=>now,prefix:'test-cache:',successTtl:100,failureTtl:20});
 const image={...scoreCommonsCandidate(page('London'),identity('London')).image};cache.writeSuccess('london',image);assert.equal(cache.read('london').image.destinationId,'london');now=1101;assert.equal(cache.read('london'),null);
 cache.writeFailure('rome','no-match');assert.equal(cache.read('rome').status,'unavailable');now=1122;assert.equal(cache.read('rome'),null);
 assert.ok(DESTINATION_IMAGE_CACHE_TTL.success>DESTINATION_IMAGE_CACHE_TTL.failure);
 const providerCache=new DestinationImageCache({storage:null,prefix:`provider-${Date.now()}:`}),discovery={discover:async id=>{calls++;return {...image,destinationId:id.key};}},provider=new LocalDestinationVisualProvider({cache:providerCache,discovery});
 const [first,second]=await Promise.all([provider.resolveVisual('London'),provider.resolveVisual('London')]);assert.equal(calls,1);assert.equal(first.specificity,'discovered');assert.deepEqual(second.heroImages,first.heroImages);
 await provider.resolveVisual('London');assert.equal(calls,1);
});

test('aliases share one canonical visual and Discovery can pass that exact image into Trip Hero',async()=>{
 const provider=new LocalDestinationVisualProvider(),english=provider.getVisual('Paris'),chinese=provider.getVisual('巴黎');
 assert.equal(destinationIdentity('Paris').key,destinationIdentity('巴黎').key);assert.equal(english.heroImages[0].src,chinese.heroImages[0].src);
 const experience=buildTripExperience({trip:{origin:'Shanghai',destination:'Paris',nights:5},plan:{windows:[{departure:'2026-12-05',returnDate:'2026-12-10'}]},flightVerification:{status:'not_checked'}}),html=renderTripHero(experience,'zh',english);
 assert.match(html,new RegExp(english.heroImages[0].src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(html,/data-trip-hero="paris"/);assert.equal((html.match(/<img\b/g)||[]).length,1);
});

test('API normalization covers diverse cities, islands, towns and scenic destinations with mocked Commons metadata',async()=>{
 const destinations=['Paris','London','Tokyo','Kyoto','Osaka','Chengdu','Shanghai','Beijing','Hangzhou',"Xi'an",'Singapore','Bangkok','Chiang Mai','Bali','Phuket','Seoul','Rome','Barcelona','Istanbul','Sydney','Hoi An','Wuyuan','Jeju','Huangshan'];
 const fetchImpl=async url=>{const query=new URL(url).searchParams.get('gsrsearch'),subject=query.match(/(skyline|landscape|landmark)$/)?.[1]||'skyline',place=query.replace(/ (skyline|landscape|landmark)$/,'');return {ok:true,json:async()=>({query:{pages:[page(place,{title:`${place} ${subject} photograph`,description:`A panoramic ${subject} view of ${place}`})]}})};};
 const service=new WikimediaDestinationImageDiscovery({fetchImpl,timeoutMs:100});
 for(const city of destinations){const known=getDestination(city),base=destinationIdentity(known||{city,countryOrRegion:'Unknown'}),id={...base,entityType:known?.entityType||(['Bali','Phuket','Jeju'].includes(city)?'island':'city')},image=await service.discover(id);assert.equal(image?.destinationId,id.key,city);assert.match(image.license,/CC BY-SA/);}
 assert.equal(destinations.length,24);
});

test('initial hero coverage resolves canonically or returns an honest non-photo fallback',async()=>{
 const destinations=[
  {city:'Paris',countryOrRegion:'France'},{city:'Tokyo',countryOrRegion:'Japan'},{city:'Shanghai',countryOrRegion:'China'},{city:'Kyoto',countryOrRegion:'Japan',entityType:'historic_destination'},{city:'Chengdu',countryOrRegion:'China'},{city:'Lijiang',countryOrRegion:'China',region:'Yunnan',entityType:'historic_destination'},
  {city:'London',countryOrRegion:'United Kingdom'},{city:'Rome',countryOrRegion:'Italy'},{city:'Barcelona',countryOrRegion:'Spain'},{city:'New York',countryOrRegion:'United States'},{city:'Bangkok',countryOrRegion:'Thailand'},{city:'Singapore',countryOrRegion:'Singapore'},{city:'Bali',countryOrRegion:'Indonesia',entityType:'island'},{city:'Reykjavik',countryOrRegion:'Iceland'},{city:'Hallstatt',countryOrRegion:'Austria',entityType:'historic_destination'}
 ];
 const cache=new DestinationImageCache({storage:null,prefix:`coverage-${Date.now()}:`}),discovery={discover:async id=>{if(id.key==='reykjavik')return null;const nature=['island','scenic_area','nature_destination'].includes(id.entityType),subject=nature?'landscape':'skyline';return scoreCommonsCandidate(page(id.canonicalCity,{title:`${id.canonicalCity} ${subject} panorama`,description:`Panoramic ${subject} view of ${id.canonicalCity} ${id.countryNames.en}`}),id)?.image||null;}},provider=new LocalDestinationVisualProvider({cache,discovery});
 for(const destination of destinations){const identity=destinationIdentity(destination),visual=await provider.resolveVisual(destination),image=visual.heroImages[0];assert.equal(visual.destinationKey,identity.key);assert.equal(image.destinationIdentity,identity.key);assert.ok(image.kind==='photograph'||image.kind==='illustration');if(image.kind==='illustration')assert.match(visual.specificity,/fallback/);}
 assert.equal(destinations.length,15);
});
