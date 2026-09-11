import {MockFlightProvider} from './mock-flight.js';
import {MockHotelProvider} from './mock-hotel.js';
import {LiveFlightProvider} from './live-flight.js';
import {LiveApiTransport} from './live-transport.js';
export function createTravelProviders(mode, {liveTransport = new LiveApiTransport()} = {}) {
  if (mode === 'demo') return {flights:new MockFlightProvider(), hotels:new MockHotelProvider()};
  if (mode === 'live') return {flights:new LiveFlightProvider(liveTransport), hotels:new MockHotelProvider()};
  throw new Error('Choose Demo or Live Mode.');
}
