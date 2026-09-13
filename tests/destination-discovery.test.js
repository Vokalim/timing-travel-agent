import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';
import {searchTravel} from '../dist/lib/travel-service.js';
import {createTemporalContext,planRepresentativeDateWindows} from '../dist/lib/discovery/temporal-context.js';
import {DemoDestinationDiscoveryService,FallbackDestinationDiscoveryService,GeneralPopularityProvider,discoverDestinations,requiresDestinationDiscovery} from '../dist/lib/discovery/destination-discovery.js';
import {LLMDestinationDiscoveryService as ServerDiscoveryService} from '../server/llm-destination-discovery.js';
import {DESTINATION_DISCOVERY_SCHEMA} from '../server/destination-discovery-schema.js';

const now=new Date('2026-09-11T00:00:00Z');
const preferences={origin:'Shanghai',destination:null,destinationState:'discovery_required',departureWindowText:'12月',earliestDeparture:null,latestDeparture:null,durationDays:5,totalTripBudgetCny:3000,flightBudgetCny:null,avoidOvernightFlights:false,travelIntents:[]};
const flightProvider={search:async(trip,date)=>[{id:`${trip.destination}-${date}`,price:1800,stops:0,currency:'CNY',airline:'Fixture Air',departureDateTime:`${date}T09:00:00+08:00`,source:'duffel'}]};
const candidate=(city,themes)=>({city,countryOrRegion:'Test region',iataOrMetroCode:'TST',themes,seasonalReasons:[],generalReasons:[],estimatedFitSignals:[],sourceType:'llm_suggestion',confidence:'medium'});
const serviceFor=candidates=>({discover:async()=>({source:'openai',parserStatus:'ai',candidates})});

test('open-ended December request runs discovery without requiring a destination',async()=>{
  const parsed=await new DemoPreferenceParser().parse('12月上海出发，5天，预算3000，想出去玩但不知道去哪。');
  assert.equal(parsed.interpretation.destination,null);assert.equal(parsed.interpretation.destinationState,'discovery_required');assert.equal(parsed.interpretation.totalTripBudgetCny,3000);
  const result=await discoverDestinations(parsed.interpretation,{now,flightProvider,discoveryService:new DemoDestinationDiscoveryService()});
  assert.ok(result.candidates.length>=5);assert.ok(result.candidates.every(item=>item.city&&item.countryOrRegion));
});

test('explicit festive intent strongly influences deterministic destination ranking',async()=>{
  const parsed=await new DemoPreferenceParser().parse('12月上海出发，想找一个圣诞氛围很浓的地方玩5天。');
  const candidates=[candidate('Festive City',['festive']),candidate('Generic City',['nature']),candidate('Other City',['food']),candidate('Fourth City',[]),candidate('Fifth City',[])];
  const result=await discoverDestinations(parsed.interpretation,{now,flightProvider,discoveryService:serviceFor(candidates)});
  assert.equal(result.candidates[0].city,'Festive City');
});

test('explicit beach intent outranks generic December festive inference',async()=>{
  const parsed=await new DemoPreferenceParser().parse('12月上海出发，想去海边躺5天。');
  const candidates=[candidate('Christmas City',['festive','shopping']),candidate('Beach City',['beach']),candidate('Other City',['food']),candidate('Fourth City',[]),candidate('Fifth City',[])];
  const result=await discoverDestinations(parsed.interpretation,{now,flightProvider,discoveryService:serviceFor(candidates)});
  assert.equal(result.candidates[0].city,'Beach City');
});

test('a beach stays an intent before discovery and produces geographic cities',async()=>{
  const parsed=await new DemoPreferenceParser().parse('From Shanghai to a beach for 5 days.');
  assert.equal(parsed.interpretation.destination,null);assert.deepEqual(parsed.interpretation.travelIntents,['beach']);
  const result=await discoverDestinations(parsed.interpretation,{now,flightProvider,discoveryService:new DemoDestinationDiscoveryService()});
  assert.ok(result.candidates.some(item=>item.themes.includes('beach')));assert.ok(result.candidates.every(item=>item.city!=='a beach'));
});

test('provided destination keeps the existing direct destination workflow',async()=>{
  const parsed=await new DemoPreferenceParser().parse('11月上海去东京5天');assert.equal(parsed.interpretation.destination,'Tokyo');assert.equal(requiresDestinationDiscovery(parsed.interpretation),false);
  const direct=await searchTravel({origin:'Shanghai',destination:'Tokyo',start:'2026-11-02',end:'2026-11-02',nights:5,flightBudget:4900,hotelBudget:1260,rating:4.5,notes:''});assert.equal(direct.trip.destination,'Tokyo');
});

test('missing date uses current time only as soft context and fabricates no date windows',()=>{
  const context=createTemporalContext({...preferences,departureWindowText:null},{now});assert.equal(context.basis,'current_date_soft_context');assert.deepEqual(planRepresentativeDateWindows(context,5),[]);
});

test('Spring Festival without dates remains holiday context and creates no January flight dates',()=>{
  const context=createTemporalContext({...preferences,departureWindowText:'春节'},{now});
  assert.equal(context.holiday,'spring_festival');
  assert.equal(context.basis,'user_requested_holiday');
  assert.deepEqual(planRepresentativeDateWindows(context,5),[]);
});

test('broad month preserves the requested period and labels representative windows as generated',()=>{
  const context=createTemporalContext(preferences,{now});const windows=planRepresentativeDateWindows(context,5);assert.equal(context.month,12);assert.ok(windows.length>0);assert.ok(windows.every(window=>window.source==='system_generated'&&window.userProvided===false&&window.departure.startsWith('2026-12-')));
});

test('LLM discovery failure uses a labeled deterministic fallback with no invented flight prices',async()=>{
  const fallback=new FallbackDestinationDiscoveryService({discover:async()=>{throw new Error('LLM unavailable');}},new DemoDestinationDiscoveryService());const discovery=await fallback.discover(preferences,createTemporalContext(preferences,{now}));assert.equal(discovery.parserStatus,'fallback');assert.match(discovery.fallbackReason,/unavailable/);assert.ok(discovery.candidates.every(item=>!('price' in item)));
});

test('Duffel failure retains candidates and labels flight verification unavailable without mock prices',async()=>{
  const failing={search:async()=>{throw new Error('Live flight data unavailable.');}};const result=await discoverDestinations(preferences,{mode:'live',now,flightProvider:failing,discoveryService:new DemoDestinationDiscoveryService()});assert.ok(result.candidates.length);assert.ok(result.candidates.every(item=>item.verification.status==='unavailable'&&!('quote' in item.verification)));
});

test('general popularity prior never claims live or current trends',()=>{
  const signal=new GeneralPopularityProvider().getSignal(candidate('City',[]));assert.equal(signal.current,false);assert.equal(signal.source,'general_prior');assert.doesNotMatch(signal.label,/currently|trending|this month/i);
});

test('server LLM discovery requests strict structured candidates without price fields',async()=>{
  const candidates=['Tokyo','Seoul','Osaka','Hong Kong','Singapore'].map((city,index)=>({...candidate(city,['food']),iataOrMetroCode:['TYO','SEL','OSA','HKG','SIN'][index],sourceType:'llm_suggestion'}));let request;
  const fetchImpl=async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({candidates})})};};
  const result=await new ServerDiscoveryService({apiKey:'test-key',fetchImpl}).discover(preferences,createTemporalContext(preferences,{now}));
  assert.equal(result.candidates.length,5);assert.ok(result.candidates.every(item=>!('price' in item)));
  assert.equal(result.candidates[0].countryOrRegion,'Japan');
  assert.deepEqual(request.text.format,{type:'json_schema',name:'timing_destination_discovery',strict:true,schema:DESTINATION_DISCOVERY_SCHEMA});
});

test('server discovery rejects unsupported cities and mismatched IATA codes before flight checks',async()=>{
  const candidates=['Tokyo','Seoul','Osaka','Hong Kong','Singapore'].map((city,index)=>({...candidate(city,['food']),iataOrMetroCode:['TYO','SEL','OSA','HKG','SIN'][index],sourceType:'llm_suggestion'}));
  const malformed=[...candidates.slice(0,4),{...candidate('Invented Beach City',['beach']),iataOrMetroCode:'TYO',sourceType:'llm_suggestion'}];
  const fetchImpl=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({candidates:malformed})})});
  await assert.rejects(new ServerDiscoveryService({apiKey:'test-key',fetchImpl}).discover(preferences,{}),{code:'DESTINATION_DISCOVERY_UNAVAILABLE'});
  const mismatched=[...candidates.slice(0,4),{...candidates[4],iataOrMetroCode:'TYO'}];
  const wrongCode=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({candidates:mismatched})})});
  await assert.rejects(new ServerDiscoveryService({apiKey:'test-key',fetchImpl:wrongCode}).discover(preferences,{}),{code:'DESTINATION_DISCOVERY_UNAVAILABLE'});
});

test('avoid-overnight preference filters verified red-eye options deterministically',async()=>{
  const overnightProvider={search:async(trip,date)=>[{id:trip.destination,price:1200,stops:0,currency:'CNY',departureDateTime:`${date}T02:00:00+08:00`,segments:[]}]};
  const result=await discoverDestinations({...preferences,avoidOvernightFlights:true},{now,flightProvider:overnightProvider,discoveryService:new DemoDestinationDiscoveryService()});
  assert.ok(result.candidates.every(item=>item.verification.status==='unavailable'));
});

test('avoid-overnight preference rejects unknown or overnight return timing',async()=>{
  for(const quote of [
    {id:'missing-return',price:1300,stops:0,departureDateTime:'2026-12-05T09:00:00+08:00'},
    {id:'red-eye-return',price:1300,stops:0,segments:[{departingAt:'2026-12-05T09:00:00+08:00'},{departingAt:'2026-12-10T02:00:00+09:00'}]}
  ]){
    const result=await discoverDestinations({...preferences,avoidOvernightFlights:true},{now,flightProvider:{search:async()=>[quote]},discoveryService:new DemoDestinationDiscoveryService()});
    assert.ok(result.candidates.every(item=>item.verification.status==='unavailable'));
  }
});
