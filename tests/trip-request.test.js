import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripRequest} from '../dist/lib/trip-request.js';
import {searchTravel} from '../dist/lib/travel-service.js';
import {MockFlightProvider} from '../dist/lib/providers/mock-flight.js';
import {MockHotelProvider} from '../dist/lib/providers/mock-hotel.js';
import {validateLiveEnvelope} from '../dist/lib/providers/contracts.js';
import {DemoPreferenceParser} from '../dist/lib/preference-parser.js';

test('optional destination normalizes safely to null but cannot start a search', async () => {
  for (const destination of [undefined,null,'']) {
    const request = createTripRequest({origin:'Shanghai',destination});
    assert.equal(request.destination,null);
    assert.equal(request.destinationState,'discovery_required');
    assert.equal(request.currency,'CNY');
    await assert.rejects(searchTravel(request), /Destination discovery is not available/);
    await assert.rejects(new MockFlightProvider().search(request,'2026-11-02'), /Destination discovery is not available/);
    await assert.rejects(new MockHotelProvider().search(request,'2026-11-02'), /Destination discovery is not available/);
  }
  const destinationTrip = createTripRequest({destination:'Tokyo'});
  assert.equal(destinationTrip.destination,'Tokyo');
  assert.equal(destinationTrip.destinationState,'provided');
});
test('currency must be normalized to CNY rather than relabeling foreign quotes', () => {
  assert.throws(()=>createTripRequest({currency:'USD'}), /Only CNY/);
  assert.throws(()=>validateLiveEnvelope({source:'live',currency:'USD',quotes:[]},'flights'));
  assert.throws(()=>validateLiveEnvelope({source:'live',currency:'CNY',quotes:[{id:'x',currency:'USD',price:100,stops:0}]},'flights'));
});
test('natural-language budgets accept RMB/CNY and reject dollar amounts without conversion', async () => {
  const parser = new DemoPreferenceParser();
  const cny = await parser.parse('Round-trip flight budget RMB 2100 and hotel budget CNY 700 per night.');
  assert.equal(cny.fields.currency,'CNY');
  assert.equal(cny.fields.flightBudget,2100);
  assert.equal(cny.fields.hotelBudget,700);
  const foreign = await parser.parse('Round-trip flight budget $300 and hotel budget $100 per night.');
  assert.equal(foreign.fields.flightBudget,undefined);
  assert.equal(foreign.fields.hotelBudget,undefined);
  assert.match(foreign.warnings[0],/no currency conversion/);
});
test('travel intents are normalized, deduplicated and preserved as non-scoring preferences', async () => {
  const request = createTripRequest({travelIntents:['Beach','food','beach','unsupported']});
  assert.deepEqual(request.travelIntents,['beach','food']);
  const result = await searchTravel({origin:'Shanghai',destination:'Tokyo',currency:'CNY',start:'2026-11-02',end:'2026-11-02',nights:5,flightBudget:4900,hotelBudget:1260,rating:4.5,notes:'',travelIntents:request.travelIntents});
  assert.deepEqual(result.preferences.travelIntents,['beach','food']);
  assert.equal(result.trip.destinationState,'provided');
  assert.ok(['BOOK','WAIT','CHANGE DATE'].includes(result.decision));
});
