import test from 'node:test';
import assert from 'node:assert/strict';
import {DuffelFlightProvider} from '../server/duffel-flight-provider.js';
import {resolveLocation,supportedLocations} from '../server/location-resolver.js';
import {createTravelProviders} from '../dist/lib/providers/index.js';
import {MockFlightProvider} from '../dist/lib/providers/mock-flight.js';
import {LiveFlightProvider} from '../dist/lib/providers/live-flight.js';

const request={origin:'Shanghai',destination:'Tokyo',departure:'2026-11-02',returnDate:'2026-11-07',currency:'CNY',adults:1};
const segment=(origin,destination,departing,arriving,carrier='China Eastern')=>({
  origin:{iata_code:origin},destination:{iata_code:destination},departing_at:departing,arriving_at:arriving,
  operating_carrier:{name:carrier,iata_code:'MU'},marketing_carrier:{name:carrier},marketing_carrier_flight_number:'MU523'});
const offer=(currency='CNY',amount='2988.40')=>({id:'off_test',total_amount:amount,total_currency:currency,live_mode:false,
  owner:{name:'China Eastern',iata_code:'MU'},expires_at:'2026-10-01T10:30:00Z',slices:[
    {segments:[segment('PVG','NRT','2026-11-02T09:05:00','2026-11-02T13:00:00')]},
    {segments:[segment('HND','SHA','2026-11-07T21:00:00','2026-11-08T00:15:00')]}]});
const response=(offers,status=200)=>({ok:status>=200&&status<300,status,json:async()=>status>=200&&status<300?{data:{offers}}:{errors:[{message:'failure'}]}});

test('Duffel round-trip request resolves cities and normalizes a CNY offer',async()=>{
  let sent;
  const provider=new DuffelFlightProvider({token:'duffel_test_example',fetchImpl:async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return response([offer()]);}});
  const result=await provider.search(request);
  assert.match(sent.url,/offer_requests\?return_offers=true/);
  assert.equal(sent.options.headers.Authorization,'Bearer duffel_test_example');
  assert.equal(sent.options.headers['Duffel-Version'],'v2');
  assert.deepEqual(sent.body.data.slices,[{origin:'SHA',destination:'TYO',departure_date:'2026-11-02'},{origin:'TYO',destination:'SHA',departure_date:'2026-11-07'}]);
  assert.deepEqual(sent.body.data.passengers,[{type:'adult'}]);
  assert.equal(result.source,'duffel');
  assert.equal(result.sourceMode,'test');
  const quote=result.quotes[0];
  assert.equal(quote.price,2988.4);
  assert.equal(quote.originalCurrency,'CNY');
  assert.equal(quote.airline,'China Eastern');
  assert.equal(quote.departureDateTime,'2026-11-02T09:05:00');
  assert.equal(quote.returnDateTime,'2026-11-07T21:00:00');
  assert.equal(quote.segments.length,2);
  assert.equal(quote.segments[1].overnight,true);
  assert.equal(quote.provider,'duffel');
});

test('missing credentials, Duffel failure, and no offers fail clearly',async()=>{
  await assert.rejects(new DuffelFlightProvider().search(request),{code:'MISSING_CREDENTIALS'});
  await assert.rejects(new DuffelFlightProvider({token:'x',fetchImpl:async()=>response([],503)}).search(request),{code:'DUFFEL_ERROR'});
  await assert.rejects(new DuffelFlightProvider({token:'x',fetchImpl:async()=>response([])}).search(request),{code:'NO_FLIGHTS'});
});

test('common city and airport names resolve exactly without guessing',()=>{
  for(const city of ['Shanghai','Beijing','Guangzhou','Shenzhen','Chengdu','Hong Kong','Tokyo','Osaka','Seoul','Singapore','Bangkok','London','Paris'])
    assert.ok(supportedLocations.includes(city) && resolveLocation(city).code);
  assert.deepEqual(resolveLocation('Shanghai').airports,['PVG','SHA']);
  assert.deepEqual(resolveLocation('Tokyo').airports,['NRT','HND']);
  assert.equal(resolveLocation('Tokyo Haneda').code,'HND');
  assert.throws(()=>resolveLocation('Springfield'),{code:'LOCATION_UNRESOLVED'});
});

test('foreign Duffel prices are preserved but never exposed as CNY scoring quotes',async()=>{
  const provider=new DuffelFlightProvider({token:'x',fetchImpl:async()=>response([offer('JPY','65000')])});
  await assert.rejects(provider.search(request),error=>error.code==='CURRENCY_CONVERSION_REQUIRED'&&
    error.unconverted[0].originalCurrency==='JPY'&&error.unconverted[0].originalPrice===65000&&
    error.unconverted[0].price===null&&error.unconverted[0].currencyConversionRequired===true);
});

test('Demo and Live flight providers remain separate and Live hotels remain mock',()=>{
  const demo=createTravelProviders('demo');
  const live=createTravelProviders('live',{liveTransport:{search:async()=>{}}});
  assert.ok(demo.flights instanceof MockFlightProvider);
  assert.ok(live.flights instanceof LiveFlightProvider);
  assert.ok(!(live.flights instanceof MockFlightProvider));
  assert.equal(live.hotels.constructor.name,'MockHotelProvider');
});
