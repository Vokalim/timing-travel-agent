import test from 'node:test';
import assert from 'node:assert/strict';
import {searchTravel} from '../dist/lib/travel-service.js';
import {scout} from '../dist/lib/engine.js';
import {MockPreferenceInterpreter} from '../dist/lib/preferences.js';
import {createTravelProviders} from '../dist/lib/providers/index.js';
import {MockFlightProvider, MockHotelProvider} from '../dist/lib/providers.js';
import {LiveFlightProvider} from '../dist/lib/providers/live-flight.js';
import {LiveHotelProvider} from '../dist/lib/providers/live-hotel.js';
import {LiveApiTransport} from '../dist/lib/providers/live-transport.js';
import {ProviderError} from '../dist/lib/providers/contracts.js';

const trip = {origin:'San Francisco',destination:'Tokyo',start:'2026-11-02',end:'2026-11-09',nights:6,flightBudget:4900,hotelBudget:1260,rating:4.5,notes:''};
// These are test fixtures only. No fixture is shipped in a live provider.
const flight = {id:'test-flight',price:500,stops:0,currency:'CNY'};
const hotel = {id:'test-hotel',name:'Test hotel',nightly:150,rating:4.6,currency:'CNY'};
const envelope = kind => ({source:'live',currency:'CNY',quotes:[kind==='flights'?flight:hotel]});
const fixtureTransport = {search:async kind=>envelope(kind)};

test('Demo results use CNY prices and preserve seeded decisions with no network or credentials', async () => {
  const liveTransport = {search:()=>{throw new Error('Demo must never request live data');}};
  const result = await searchTravel(trip, 'demo', {liveTransport});
  assert.equal(result.dataSource, 'demo');
  assert.equal(result.best.date, '2026-11-09');
  assert.equal(result.best.total, 8897);
  assert.equal(result.savings, 4879);
  assert.equal(result.decision, 'CHANGE DATE');
  const {dataSource, ...actual} = result;
  assert.deepEqual(actual, await scout(trip,new MockPreferenceInterpreter(),new MockFlightProvider(),new MockHotelProvider()));
});

test('unconfigured Live rejects instead of returning mock prices or a decision', async () => {
  const disabled=new LiveApiTransport({enabled:false,fetchImpl:()=>{throw new Error('Must not call network');}});
  await assert.rejects(searchTravel(trip,'live',{liveTransport:disabled}), error=>error instanceof ProviderError && error.code==='NOT_CONFIGURED');
  await assert.rejects(disabled.search('flights',trip,trip.start), {code:'NOT_CONFIGURED'});
});

test('Live and Demo implement the same search contract', async () => {
  const demo = createTravelProviders('demo');
  const live = createTravelProviders('live',{liveTransport:fixtureTransport});
  assert.deepEqual(Object.keys((await demo.flights.search(trip,trip.start))[0]),Object.keys((await live.flights.search(trip,trip.start))[0]));
  assert.deepEqual(Object.keys((await demo.hotels.search(trip,trip.start))[0]),Object.keys((await live.hotels.search(trip,trip.start))[0]));
  const result = await searchTravel(trip,'live',{liveTransport:fixtureTransport});
  assert.equal(result.best.flight.id,'test-flight');
  assert.equal(result.best.hotel.provider,undefined);
  assert.equal(result.dataSource,'live');
});

test('one failed live flight date rejects the whole search', async () => {
  const liveTransport = {search:async(kind,t,date)=>{
    if(date==='2026-11-05') throw new ProviderError('UNAVAILABLE','Live unavailable');
    return envelope(kind);
  }};
  await assert.rejects(searchTravel(trip,'live',{liveTransport}), {code:'UNAVAILABLE'});
});

test('legitimate empty live availability remains live and never triggers Demo', async () => {
  const result = await searchTravel(trip,'live',{liveTransport:{search:async()=>({source:'duffel',currency:'CNY',quotes:[]})}});
  assert.equal(result.dataSource,'live');
  assert.equal(result.candidates.length,0);
  assert.equal(result.decision,'WAIT');
});

test('unrecognized modes cannot silently select Demo', () => assert.throws(()=>createTravelProviders('sandbox')));

test('live adapters reject demo/sandbox provenance, unsupported currency and malformed quotes', async () => {
  for(const bad of [{...envelope('flights'),source:'demo'},{...envelope('flights'),source:'sandbox'},{...envelope('flights'),currency:'EUR'}, {quotes:[flight]}, {...envelope('flights'),quotes:null}]) {
    await assert.rejects(new LiveFlightProvider({search:async()=>bad}).search(trip,trip.start),{code:'INVALID_RESPONSE'});
  }
  for(const price of [null,NaN,Infinity,-1,0,'500']) {
    await assert.rejects(new LiveFlightProvider({search:async()=>({...envelope('flights'),quotes:[{...flight,price}]})}).search(trip,trip.start),{code:'INVALID_RESPONSE'});
  }
  for(const patch of [{rating:null},{rating:8},{nightly:-1},{name:''}]) {
    await assert.rejects(new LiveHotelProvider({search:async()=>({...envelope('hotels'),quotes:[{...hotel,...patch}]})}).search(trip,trip.start),{code:'INVALID_RESPONSE'});
  }
});

test('untrusted scores and decisions are stripped before reaching the engine', async () => {
  const adapter = new LiveFlightProvider({search:async()=>({...envelope('flights'),quotes:[{...flight,score:100,decision:'BOOK'}]})});
  const [quote]=await adapter.search(trip,trip.start);
  assert.equal(quote.id,flight.id);
  assert.equal(quote.price,flight.price);
  assert.equal('score' in quote,false);
  assert.equal('decision' in quote,false);
});

test('owned-backend request sends trip facts, not preference text or credentials', async () => {
  const transport = new LiveApiTransport({enabled:true,fetchImpl:async(url,options)=>{
    assert.equal(url,'/api/travel/flights/search');
    assert.equal(options.method,'POST');
    assert.deepEqual(JSON.parse(options.body),{origin:trip.origin,destination:trip.destination,departure:trip.start,returnDate:'2026-11-08',nights:6,adults:1,rooms:1,currency:'CNY'});
    assert.deepEqual(options.headers,{'Content-Type':'application/json'});
    return {ok:true,json:async()=>envelope('flights')};
  }});
  const [quote]=await new LiveFlightProvider(transport).search({...trip,notes:'private preference'},trip.start);
  assert.equal(quote.id,flight.id);
});

test('network, missing credentials, rate limit, server error and bad JSON fail closed', async () => {
  for(const status of [401,403,404,429,500,503]) {
    const transport = new LiveApiTransport({enabled:true,fetchImpl:async()=>({ok:false,status})});
    await assert.rejects(transport.search('hotels',trip,trip.start),error=>error instanceof ProviderError);
  }
  for(const fetchImpl of [async()=>{throw new Error('secret upstream details');},async()=>({ok:true,json:async()=>{throw new Error('bad JSON');}})]) {
    await assert.rejects(new LiveApiTransport({enabled:true,fetchImpl}).search('flights',trip,trip.start),error=>error.code==='UNAVAILABLE'&&!error.message.includes('secret'));
  }
});

test('slow requests are aborted and reported as unavailable', async () => {
  const transport = new LiveApiTransport({enabled:true,timeoutMs:5,fetchImpl:(_,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  })});
  await assert.rejects(transport.search('flights',trip,trip.start),{code:'TIMEOUT'});
});
