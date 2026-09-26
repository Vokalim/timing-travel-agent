import test from 'node:test';
import assert from 'node:assert/strict';
import {DestinationImageCache,DESTINATION_IMAGE_CACHE_TTL} from '../dist/lib/discovery/destination-image-cache.js';
import {WikimediaDestinationImageDiscovery,acceptedLicense,buildCommonsSearchQuery,scoreCommonsCandidate} from '../dist/lib/discovery/wikimedia-image-discovery.js';
import {LocalDestinationVisualProvider} from '../dist/lib/discovery/destination-visual-provider.js';
import {destinationIdentity} from '../dist/lib/discovery/destination-identity.js';
import {getDestination} from '../dist/lib/discovery/destination-universe.js';

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
 assert.equal(buildCommonsSearchQuery(identity('东京')),'Tokyo skyline');
 assert.equal(buildCommonsSearchQuery(identity('Bali')),'Bali landscape');
 assert.equal(buildCommonsSearchQuery(identity('Hoi An')),'Hoi An landmark');
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

test('API normalization covers diverse cities, islands, towns and scenic destinations with mocked Commons metadata',async()=>{
 const destinations=['Paris','London','Tokyo','Kyoto','Osaka','Chengdu','Shanghai','Beijing','Hangzhou',"Xi'an",'Singapore','Bangkok','Chiang Mai','Bali','Phuket','Seoul','Rome','Barcelona','Istanbul','Sydney','Hoi An','Wuyuan','Jeju','Huangshan'];
 const fetchImpl=async url=>{const query=new URL(url).searchParams.get('gsrsearch'),subject=query.match(/(skyline|landscape|landmark)$/)?.[1]||'skyline',place=query.replace(/ (skyline|landscape|landmark)$/,'');return {ok:true,json:async()=>({query:{pages:[page(place,{title:`${place} ${subject} photograph`,description:`A panoramic ${subject} view of ${place}`})]}})};};
 const service=new WikimediaDestinationImageDiscovery({fetchImpl,timeoutMs:100});
 for(const city of destinations){const known=getDestination(city),base=destinationIdentity(known||{city,countryOrRegion:'Unknown'}),id={...base,entityType:known?.entityType||(['Bali','Phuket','Jeju'].includes(city)?'island':'city')},image=await service.discover(id);assert.equal(image?.destinationId,id.key,city);assert.match(image.license,/CC BY-SA/);}
 assert.equal(destinations.length,24);
});
