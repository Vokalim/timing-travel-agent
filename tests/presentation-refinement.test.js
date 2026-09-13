import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {destinationIdentity,displayCity,displayCountry,presentDestination} from '../dist/lib/discovery/destination-identity.js';
import {LocalDestinationVisualProvider} from '../dist/lib/discovery/destination-visual-provider.js';
import {INSPIRATION_TAXONOMY,InspirationService} from '../dist/lib/discovery/inspiration-service.js';
import {discoverDestinations} from '../dist/lib/discovery/destination-discovery.js';
import {createTemporalContext} from '../dist/lib/discovery/temporal-context.js';

const now=new Date('2026-12-08T00:00:00Z');
const options=(text,preferences={})=>({text,preferences,now});

test('Chinese and English discovery presentation localizes names without changing identity or code',()=>{
 const tokyo={city:'Tokyo',countryOrRegion:'Japan',iataOrMetroCode:'TYO'};
 const zh=presentDestination(tokyo,'zh'),en=presentDestination(tokyo,'en');
 assert.deepEqual([zh.city,zh.country,zh.key,zh.code],['东京','日本','tokyo','TYO']);
 assert.deepEqual([en.city,en.country,en.key,en.code],['Tokyo','Japan','tokyo','TYO']);
 assert.equal(tokyo.city,'Tokyo');assert.equal(tokyo.iataOrMetroCode,'TYO');
 const pairs={Seoul:'首尔',Osaka:'大阪',Bangkok:'曼谷',Singapore:'新加坡',Chengdu:'成都',Chongqing:'重庆',Changsha:'长沙',Xiamen:'厦门',Sanya:'三亚',Kunming:'昆明',Dali:'大理',Lijiang:'丽江',Guilin:'桂林',"Xi'an":'西安',Hangzhou:'杭州',Nanjing:'南京',Qingdao:'青岛',Harbin:'哈尔滨'};
 for(const [canonical,localized] of Object.entries(pairs)){assert.equal(displayCity(canonical,'zh'),localized);assert.equal(displayCity(canonical,'en'),canonical);}
 assert.equal(displayCountry({city:'Chengdu',countryOrRegion:'China'},'zh'),'中国');
});

test('flight provider receives canonical city even when the UI uses Chinese labels',async()=>{
 const received=[],candidate={city:'Tokyo',countryOrRegion:'Japan',iataOrMetroCode:'TYO',themes:['food']};
 const preferences={origin:'Shanghai',destination:null,destinationState:'discovery_required',departureWindowText:'12月',durationDays:5,travelIntents:['food']};
 const result=await discoverDestinations(preferences,{now,language:'zh',discoveryService:{discover:async()=>({source:'fixture',candidates:[candidate]})},flightProvider:{search:async trip=>{received.push(trip.destination);return [];}}});
 assert.equal(presentDestination(result.candidates[0],'zh').city,'东京');
 assert.ok(received.length>0&&received.every(name=>name==='Tokyo'));
});

test('visual provider selects the right city and category fallback with no cross-city mismatch',async()=>{
 const provider=new LocalDestinationVisualProvider();
 const tokyo=provider.getVisual({city:'Tokyo',iataOrMetroCode:'TYO'}),chengdu=provider.getVisual({city:'Chengdu',iataOrMetroCode:'CTU'}),sanya=provider.getVisual({city:'Sanya',iataOrMetroCode:'SYX'});
 assert.equal(tokyo.destinationKey,'tokyo');assert.equal(destinationIdentity('Tokyo').code,'TYO');
 assert.match(tokyo.heroImages[0].src,/tokyo-editorial/);assert.doesNotMatch(tokyo.heroImages[0].src,/chengdu/);
 assert.match(chengdu.heroImages[0].src,/chengdu-editorial/);assert.equal(chengdu.specificity,'city');
 assert.equal(sanya.fallbackCategory,'tropical');assert.equal(sanya.specificity,'category');assert.match(sanya.heroImages[0].src,/coastal-editorial/);
 assert.match(provider.getVisual({city:"Xi'an"}).heroImages[0].src,/east-asian-historic/);
 assert.match(provider.getVisual({city:'Harbin'}).heroImages[0].src,/winter-forest/);
 for(const visual of [tokyo,chengdu,sanya,provider.getVisual({city:'Harbin'})]){
  assert.ok(visual.heroImages.length+visual.scenicImages.length<=2);
  for(const image of [...visual.heroImages,...visual.scenicImages]){assert.equal(image.kind,'illustration');assert.ok((await stat(new URL(`../dist${image.src}`,import.meta.url))).size>1000);}
 }
});

test('inspiration taxonomy covers holidays, scenery, and travel styles without trending claims',async()=>{
 for(const group of ['holiday','scenery','style'])assert.ok(INSPIRATION_TAXONOMY[group].length>=12);
 const source=await readFile(new URL('../dist/lib/discovery/inspiration-service.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/近期爆火|热门|Trending/);
});

test('December and summer yield materially different, seasonally valid inspiration',()=>{
 const winter=new InspirationService({seed:42}).getIdeas(options('12月'));
 const summer=new InspirationService({seed:42}).getIdeas(options('7月'));
 assert.ok(winter.some(idea=>idea.key==='festive'));
 assert.ok(summer.some(idea=>idea.key==='beach'));
 assert.ok(new Set(winter.map(idea=>idea.key).filter(key=>summer.some(other=>other.key===key))).size<=2);
 assert.ok([winter,summer].every(ideas=>ideas.length>=4&&ideas.length<=6));
});

test('explicit beach and food intents influence the December pool',()=>{
 const beach=new InspirationService({seed:42}).getIdeas(options('12月想去海边'));
 const food=new InspirationService({seed:42}).getIdeas(options('12月想吃东西'));
 assert.equal(beach[0].key,'warm_beach');assert.ok(beach.filter(idea=>idea.intent==='beach').length>=2);
 assert.ok(food.filter(idea=>idea.intent==='food').length>=2);
 assert.ok(beach.some(idea=>idea.group==='holiday')&&food.some(idea=>idea.group==='scenery'));
});

test('requested month outranks current December and holiday signals follow the travel window',()=>{
 const july=new InspirationService({seed:1}).getEligiblePool(options('7月'));
 assert.ok(july.every(idea=>!['festive','christmas_lights','europe_christmas','snow_winter'].includes(idea.key)));
 const spring=new InspirationService({seed:1}).getEligiblePool(options('2026年2月'));
 assert.ok(spring.some(idea=>idea.key==='spring_festival'));
 assert.equal(createTemporalContext({departureWindowText:'2026年2月'},{now}).year,2026);
 const noDate=new InspirationService({seed:1}).getEligiblePool({text:'',now:new Date('2026-10-03T00:00:00Z')});
 assert.ok(noDate.some(idea=>idea.key==='national'));
});

test('refresh uses a seeded local pool, changes the set, and avoids immediate repetition',async()=>{
 const service=new InspirationService({seed:42}),input=options('12月');
 const first=service.getIdeas(input),second=service.refresh(input),third=service.refresh(input);
 assert.notDeepEqual(first.map(x=>x.key),second.map(x=>x.key));
 assert.equal(first.filter(item=>second.some(next=>next.key===item.key)).length,0);
 assert.ok(third.length>=4&&third.length<=6);
 const replay=new InspirationService({seed:42});assert.deepEqual(replay.getIdeas(input),first);assert.deepEqual(replay.refresh(input),second);
 const [app,html]=await Promise.all(['app.js','index.html'].map(name=>readFile(new URL(`../dist/${name}`,import.meta.url),'utf8')));
 assert.match(html,/id="refresh-inspiration"/);assert.match(app,/inspirationService\.refresh/);
 assert.doesNotMatch(app,/refresh-inspiration[^\n]*fetch\(/);
});

test('selected chips preserve category diversity where holiday and style choices exist',()=>{
 for(const text of ['12月','7月','10月']){
  const ideas=new InspirationService({seed:42}).getIdeas(options(text));
  assert.ok(new Set(ideas.map(idea=>idea.group)).size>=3);
  assert.ok(ideas.length>=4&&ideas.length<=6);
 }
});
