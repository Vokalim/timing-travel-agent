import {validateLiveEnvelope} from './contracts.js';
import {LiveApiTransport} from './live-transport.js';
/** @implements {import('./contracts.js').HotelProvider} */
export class LiveHotelProvider {
  constructor(transport = new LiveApiTransport()) { this.transport = transport; }
  async search(trip, departure) {
    return validateLiveEnvelope(await this.transport.search('hotels', trip, departure), 'hotels');
  }
}
