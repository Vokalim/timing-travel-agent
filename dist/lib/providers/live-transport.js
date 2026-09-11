import {createTripRequest, requireDestination} from '../trip-request.js';
import {ProviderError} from './contracts.js';
import {addDays} from '../engine.js';

/** Browser-to-owned-backend transport; NEVER takes vendor credentials.
 * The owned server route authenticates to Duffel and returns safe errors when unavailable.
 */
export class LiveApiTransport {
  constructor({enabled = true, fetchImpl = globalThis.fetch, timeoutMs = 30000} = {}) {
    this.enabled = enabled;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async search(kind, trip, departure) {
    trip = createTripRequest(trip);
    requireDestination(trip);
    if (!['flights', 'hotels'].includes(kind)) throw new Error('Unknown travel provider.');
    if (!this.enabled) throw new ProviderError('NOT_CONFIGURED', 'Live flight data unavailable. Duffel is not enabled.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`/api/travel/${kind}/search`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        credentials: 'same-origin', signal: controller.signal,
        body: JSON.stringify({origin:trip.origin, destination:trip.destination,
          departure, returnDate:addDays(departure, trip.nights), nights:trip.nights,
          adults:1, rooms:1, currency:trip.currency})
      });
      if (!response.ok) {
        let providerError;
        try { providerError = (await response.json())?.error; } catch {}
        if (providerError?.message && typeof providerError.message === 'string')
          throw new ProviderError(providerError.code || 'UNAVAILABLE', providerError.message);
        const code = response.status === 429 ? 'RATE_LIMITED' : [401,403,503].includes(response.status) ? 'UNAVAILABLE' : 'HTTP_ERROR';
        throw new ProviderError(code, 'Live flight data unavailable. Duffel could not complete this search.');
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(controller.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE', 'Live flight data unavailable. Duffel did not return a usable response.');
    } finally {
      clearTimeout(timer);
    }
  }
}
