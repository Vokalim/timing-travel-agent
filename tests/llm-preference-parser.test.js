import test from 'node:test';
import assert from 'node:assert/strict';
import {LLMPreferenceParser as ServerLLMPreferenceParser} from '../server/llm-preference-parser.js';
import {PREFERENCE_OUTPUT_SCHEMA} from '../server/preference-schema.js';
import {FallbackPreferenceParser,LLMPreferenceParser as BrowserLLMPreferenceParser} from '../dist/lib/llm-preference-parser.js';
import {DemoPreferenceParser,PreferenceParser} from '../dist/lib/preference-parser.js';

const base={origin:null,originEvidence:null,destination:null,destinationEvidence:null,destinationState:'discovery_required',
  earliestDeparture:null,latestDeparture:null,departureWindowText:null,durationDays:null,flightBudgetCny:null,
  hotelBudgetPerNightCny:null,minimumHotelRating:null,avoidOvernightFlights:null,travelIntents:[],
  domesticAllowed:null,internationalAllowed:null,pace:null,preferences:[]};
const apiResponse=(value,{ok=true,status=200}={})=>({ok,status,json:async()=>ok?{output:[{type:'message',content:[{type:'output_text',text:typeof value==='string'?value:JSON.stringify(value)}]}]}:{error:{message:'failed'}}});
const parseWith=(value,input='From Shanghai to Tokyo for 5 days.')=>new ServerLLMPreferenceParser({apiKey:'test-key',fetchImpl:async()=>apiResponse(value)}).parse(input);

test('English explicit destination is grounded and the strict schema is sent to OpenAI',async()=>{
  let request;
  const output={...base,origin:'Shanghai',originEvidence:'Shanghai',destination:'Tokyo',destinationEvidence:'Tokyo',destinationState:'provided',durationDays:5,flightBudgetCny:2000,avoidOvernightFlights:true};
  const parser=new ServerLLMPreferenceParser({apiKey:'test-key',fetchImpl:async(url,options)=>{request={url,body:JSON.parse(options.body),headers:options.headers};return apiResponse(output);}});
  const result=await parser.parse('From Shanghai to Tokyo for 5 days. Flight budget CNY 2000. Avoid overnight flights.');
  assert.ok(parser instanceof ServerLLMPreferenceParser);
  assert.equal(result.interpretation.destination,'Tokyo');
  assert.equal(result.interpretation.destinationState,'provided');
  assert.equal(result.interpretation.durationDays,5);
  assert.equal(result.interpretation.flightBudgetCny,2000);
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.headers.Authorization,'Bearer test-key');
  assert.deepEqual(request.body.text.format,{type:'json_schema',name:'travel_scout_trip_preferences',strict:true,schema:PREFERENCE_OUTPUT_SCHEMA});
});

test('Chinese Christmas trip keeps destination null and captures the broad window and permissions',async()=>{
  const output={...base,origin:'Shanghai',originEvidence:'上海',departureWindowText:'12月',durationDays:5,flightBudgetCny:2000,
    avoidOvernightFlights:true,travelIntents:['festive'],domesticAllowed:true,internationalAllowed:true};
  const result=await parseWith(output,'12月从上海出发，想找一个圣诞氛围很浓的地方玩5天，往返机票2000元以内，不要红眼，国内国外都可以。');
  assert.deepEqual(result.interpretation,{origin:'Shanghai',destination:null,destinationState:'discovery_required',earliestDeparture:null,latestDeparture:null,
    departureWindowText:'12月',durationDays:5,flightBudgetCny:2000,hotelBudgetPerNightCny:null,minimumHotelRating:null,
    avoidOvernightFlights:true,travelIntents:['festive'],domesticAllowed:true,internationalAllowed:true,pace:null,preferences:[]});
  assert.ok(result.needsConfirmation.includes('destination'));
  assert.ok(result.needsConfirmation.includes('earliestDeparture'));
  assert.ok(result.warnings.some(message=>message.includes('12月')));
});

test('a beach is an intent and never a literal destination',async()=>{
  const output={...base,origin:'Shanghai',originEvidence:'Shanghai',durationDays:5,travelIntents:['beach']};
  const result=await parseWith(output,'From Shanghai to a beach for 5 days.');
  assert.equal(result.interpretation.destination,null);
  assert.equal(result.interpretation.destinationState,'discovery_required');
  assert.deepEqual(result.interpretation.travelIntents,['beach']);
});

test('missing budget remains null and requires confirmation',async()=>{
  const output={...base,origin:'Shanghai',originEvidence:'Shanghai',destination:'Tokyo',destinationEvidence:'Tokyo',destinationState:'provided',durationDays:5};
  const result=await parseWith(output);
  assert.equal(result.interpretation.flightBudgetCny,null);
  assert.ok(result.needsConfirmation.includes('flightBudgetCny'));
  assert.ok(result.needsConfirmation.includes('hotelBudgetPerNightCny'));
});

test('Chinese explicit Tokyo destination normalizes to the English provider-facing place',async()=>{
  const output={...base,origin:'Shanghai',originEvidence:'上海',destination:'Tokyo',destinationEvidence:'东京',destinationState:'provided',
    departureWindowText:'11月',durationDays:5,flightBudgetCny:2000,avoidOvernightFlights:true};
  const result=await parseWith(output,'11月上海去东京5天，机票2000以内，不要红眼。');
  assert.equal(result.interpretation.origin,'Shanghai');
  assert.equal(result.interpretation.destination,'Tokyo');
  assert.equal(result.interpretation.destinationState,'provided');
  assert.equal(result.interpretation.avoidOvernightFlights,true);
});

test('an ungrounded or conceptual model destination is cleared instead of hallucinated',async()=>{
  const output={...base,origin:'Shanghai',originEvidence:'Shanghai',destination:'Bali',destinationEvidence:'a beach',destinationState:'provided',durationDays:5,travelIntents:['beach']};
  const result=await parseWith(output,'From Shanghai to a beach for 5 days.');
  assert.equal(result.interpretation.destination,null);
  assert.equal(result.interpretation.destinationState,'discovery_required');
  assert.ok(result.warnings.some(message=>message.includes('not grounded')));
});

test('malformed LLM output and unavailable API fail with explicit parser states',async()=>{
  await assert.rejects(parseWith('{bad json'),{code:'PREFERENCE_OUTPUT_INVALID'});
  await assert.rejects(parseWith({}),{code:'PREFERENCE_OUTPUT_INVALID'});
  await assert.rejects(new ServerLLMPreferenceParser().parse('A trip'),{code:'PREFERENCE_PARSER_UNAVAILABLE'});
  await assert.rejects(new ServerLLMPreferenceParser({apiKey:'x',fetchImpl:async()=>apiResponse(null,{ok:false,status:500})}).parse('A trip'),{code:'PREFERENCE_PARSER_UNAVAILABLE'});
});

test('OpenAI HTTP failure logs sanitized upstream diagnostics and preserves the user-facing error',async()=>{
  const entries=[],apiKey='sk-sensitive-test-key',input='Private trip description';
  const logger={error:(message,details)=>entries.push({message,details})};
  const fetchImpl=async()=>({ok:false,status:429,json:async()=>({error:{type:'insufficient_quota',code:'insufficient_quota',message:`Quota failed for ${input} with Bearer ${apiKey}`}})});
  const parser=new ServerLLMPreferenceParser({apiKey,model:'test-model',fetchImpl,logger});
  await assert.rejects(parser.parse(input),error=>error.status===503 && error.message==='AI trip interpretation is unavailable because the model request failed.');
  assert.deepEqual(entries,[{message:'[Timing] OpenAI preference request failed',details:{status:429,errorType:'insufficient_quota',errorCode:'insufficient_quota',message:'Quota failed for [REDACTED] with [REDACTED]',model:'test-model'}}]);
  const logged=JSON.stringify(entries);
  assert.doesNotMatch(logged,/sk-sensitive-test-key|Private trip description|Authorization/i);
});

test('pre-response OpenAI failures log only a safe failure category',async()=>{
  for(const [error,timeoutMs,expected] of [[Object.assign(new TypeError('secret network detail'),{cause:{code:'ENOTFOUND'}}),20000,'DNS/network'],[Object.assign(new TypeError('secret connection detail'),{cause:{code:'ECONNREFUSED'}}),20000,'connection failure'],[new Error('late secret'),0,'timeout']]) {
    const entries=[],logger={error:(message,details)=>entries.push({message,details})};
    const fetchImpl=timeoutMs===0?async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('late secret')))):async()=>{throw error;};
    await assert.rejects(new ServerLLMPreferenceParser({apiKey:'sk-hidden',fetchImpl,timeoutMs,logger}).parse('hidden trip'),{code:'PREFERENCE_PARSER_UNAVAILABLE'});
    assert.deepEqual(entries,[{message:'[Timing] OpenAI preference request failed before response',details:{failure:expected}}]);
    assert.doesNotMatch(JSON.stringify(entries),/secret|sk-hidden|hidden trip/i);
  }
});

test('browser fallback is explicit and never labels the heuristic draft as AI-generated',async()=>{
  const unavailable=new BrowserLLMPreferenceParser({fetchImpl:async()=>({ok:false,json:async()=>({error:{code:'PREFERENCE_PARSER_UNAVAILABLE',message:'AI unavailable'}})})});
  const parser=new FallbackPreferenceParser(unavailable,new DemoPreferenceParser());
  const draft=await parser.parse('From Shanghai to Tokyo for 5 nights.');
  assert.ok(parser instanceof PreferenceParser);
  assert.equal(draft.parserStatus,'fallback');
  assert.equal(draft.source,'demo_fallback');
  assert.match(draft.fallbackReason,/AI unavailable/);
  assert.equal(draft.fields.destination,'Tokyo');
});
