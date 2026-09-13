import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {createTemporalContext,planRepresentativeDateWindows} from '../dist/lib/discovery/temporal-context.js';
import {InspirationService} from '../dist/lib/discovery/inspiration-service.js';
import {nextClarification} from '../dist/lib/discovery/clarification.js';
import {transportModes,transportAvailability} from '../dist/lib/discovery/transport-modes.js';
import {discoverDestinations,DemoDestinationDiscoveryService,requiresDestinationDiscovery} from '../dist/lib/discovery/destination-discovery.js';
import {resolveLocation} from '../server/location-resolver.js';

const now=new Date('2026-09-11T00:00:00Z');
const base={origin:'Shanghai',destination:null,destinationState:'discovery_required',durationDays:5,travelIntents:[],departureWindowText:'12月',domesticAllowed:null,internationalAllowed:null};
const flights={search:async()=>[]};
const discover=(preferences,extra={})=>discoverDestinations(preferences,{now,flightProvider:flights,discoveryService:new DemoDestinationDiscoveryService(),...extra});

test('direct destination still routes to existing search, while beach intent routes to discovery',async()=>{
 const parser=new DemoPreferenceParser();
 const tokyo=await parser.parse('11月上海去东京5天');
 const beach=await parser.parse('From Shanghai to a beach for 5 days.');
 assert.equal(requiresDestinationDiscovery(tokyo.interpretation),false);
 assert.equal(requiresDestinationDiscovery(beach.interpretation),true);
 assert.equal(nextClarification(beach.interpretation),null);
});

test('vague requests get one skippable clarification and still support usable discovery',async()=>{
 const parser=new DemoPreferenceParser();
 for(const phrase of ['不知道去哪','最近想出去玩']){
  const draft=await parser.parse(phrase),question=nextClarification(draft.interpretation);
  assert.equal(question.kind,'theme');assert.ok(question.options.length>=4);
  const result=await discover(draft.interpretation);assert.ok(result.candidates.length);
 }
 const html=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(html,/data-choice="skip"/);assert.match(html,/runDiscovery\(draft,\{skip:true\}\)/);
});

test('catalog balances domestic and international ideas, and filters regions',async()=>{
 const all=await discover(base);
 assert.ok(all.candidates.some(item=>item.countryOrRegion==='China'));
 assert.ok(all.candidates.some(item=>item.countryOrRegion!=='China'));
 const domestic=await discover({...base,geographyPreference:'domestic'}),international=await discover({...base,geographyPreference:'international'});
 assert.ok(domestic.candidates.length&&domestic.candidates.every(item=>item.countryOrRegion==='China'));
 assert.ok(international.candidates.length&&international.candidates.every(item=>item.countryOrRegion!=='China'));
 const onlyDomestic=await discover({...base,internationalAllowed:false});assert.ok(onlyDomestic.candidates.every(item=>item.countryOrRegion==='China'));
});

test('major mainland destination names resolve to real airport or metro codes',()=>{
 const expected={Beijing:'BJS',Shanghai:'SHA',Chengdu:'CTU',Chongqing:'CKG',Changsha:'CSX',Xiamen:'XMN',Sanya:'SYX',Kunming:'KMG',Dali:'DLU',Lijiang:'LJG',Guilin:'KWL',"Xi'an":'XIY',Hangzhou:'HGH',Nanjing:'NKG',Qingdao:'TAO',Harbin:'HRB',Guangzhou:'CAN',Shenzhen:'SZX'};
 for(const [city,code] of Object.entries(expected))assert.equal(resolveLocation(city).code,code);
});

test('explicit beach theme beats December festive inference in mixed catalog',async()=>{
 const result=await discover({...base,travelIntents:['beach']});
 assert.ok(result.candidates[0].themes.includes('beach'));
});

test('inspiration varies by season and holiday, stays concise and responds to intent',()=>{
 const service=new InspirationService();
 const winter=service.getIdeas({text:'12月',now}),summer=service.getIdeas({text:'7月',now}),spring=service.getIdeas({text:'清明',now});
 assert.notDeepEqual(winter.map(x=>x.key),summer.map(x=>x.key));
 assert.ok(winter.some(x=>x.key==='festive')&&summer.some(x=>x.key==='beach')&&spring.some(x=>x.key==='qingming'));
 assert.ok([winter,summer,spring].every(items=>items.length>=4&&items.length<=6));
 assert.equal(service.getIdeas({text:'12月',preferences:{travelIntents:['beach']},now})[0].key,'warm_beach');
});

test('broad month stays broad; representative dates are never user-confirmed',()=>{
 const context=createTemporalContext(base,{now}),windows=planRepresentativeDateWindows(context,5);
 assert.equal(context.datePrecision,'broad_month');assert.equal(context.dateDescription,'12月');
 assert.ok(windows.every(window=>window.source==='system_generated_exploration_window'&&!window.userProvided));
});

test('lunar and named holidays stay soft with explicitly provisional comparison dates',()=>{
 for(const holiday of ['春节','清明','端午','中秋','国庆']){
  const context=createTemporalContext({...base,departureWindowText:holiday},{now});
  assert.equal(context.datePrecision,'holiday');assert.equal(context.dateDescription,holiday);
  assert.ok(planRepresentativeDateWindows(context,5).every(window=>window.source==='system_generated_exploration_window'&&window.basis==='user_requested_holiday'&&!window.userProvided));
 }
});

test('train and self-drive suitability never fabricate schedules, fares or route times',async()=>{
 assert.deepEqual(transportModes,['flight','train','self_drive']);
 const transport=transportAvailability({status:'not_checked',source:'demo'},{origin:'Shanghai',destination:'Hangzhou'});
 assert.equal(transport.train.verification.status,'not_yet_live');assert.equal(transport.self_drive.verification.status,'not_yet_live');
 assert.equal(transport.train.price,null);assert.equal(transport.train.schedule,null);assert.equal(transport.self_drive.drivingTimeMinutes,null);
 const result=await discover(base);assert.ok(result.candidates.every(item=>item.transport.train.price===null&&item.transport.self_drive.drivingTimeMinutes===null));
});

test('untrusted LLM price or score fields never become ranking inputs',async()=>{
 const candidates=[{city:'Sanya',countryOrRegion:'China',iataOrMetroCode:'SYX',themes:['beach'],price:1,score:1000},{city:'Harbin',countryOrRegion:'China',iataOrMetroCode:'HRB',themes:['snow_winter'],price:999,score:1000}];
 const result=await discover({...base,travelIntents:['beach']},{discoveryService:{discover:async()=>({source:'openai',candidates})}});
 assert.equal(result.candidates[0].city,'Sanya');assert.ok(result.candidates.every(item=>!('price' in item)&&item.score<=100));
});

test('consumer shell keeps bilingual UI and hides technical diagnostics',async()=>{
 const [html,app,review]=await Promise.all(['index.html','app.js','trip-input.js'].map(name=>readFile(new URL(`../dist/${name}`,import.meta.url),'utf8')));
 assert.match(html,/id="lang-zh"/);assert.match(html,/id="lang-en"/);assert.match(html,/class="chips"[^>]*><\/div>/);
 assert.doesNotMatch(html,/brand-orbit|discovery_required|parserStatus|source=openai|Broad travel window captured/);
 assert.doesNotMatch(review,/主题暂不影响当前评分|Broad travel window captured|目的地状态/);
 assert.match(app,/inspireLabel:'Good for this season'/);
});
