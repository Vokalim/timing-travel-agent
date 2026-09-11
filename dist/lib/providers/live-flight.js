import {validateLiveEnvelope} from './contracts.js';
import {LiveApiTransport} from './live-transport.js';
/** @implements {import('./contracts.js').FlightProvider} */
export class LiveFlightProvider {
  constructor(transport = new LiveApiTransport()) { this.transport = transport; }
  async search(trip, departure) {
    return validateLiveEnvelope(await this.transport.search('flights', trip, departure), 'flights');
  }
}
