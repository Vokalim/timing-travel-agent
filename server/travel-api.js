import {DuffelFlightProvider} from './duffel-flight-provider.js';

const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
function validateSearch(body) {
  if (!body || typeof body.origin!=='string' || typeof body.destination!=='string' || !date(body.departure) || !date(body.returnDate)) {
    const error=new Error('Enter supported origin, destination, departure, and return dates.');
    error.code='INVALID_REQUEST'; error.status=400; throw error;
  }
  if (body.currency!=='CNY' || body.adults!==1) {
    const error=new Error('Travel Scout currently supports one adult and CNY-normalized results.');
    error.code='INVALID_REQUEST'; error.status=400; throw error;
  }
  return body;
}
const safeError = error => ({error:{code:error.code || 'DUFFEL_UNAVAILABLE',
  message:error.message || 'Live flight data unavailable.'}});

export function createTravelApi({env=process.env,fetchImpl=globalThis.fetch}={}) {
  return {
    async searchFlights(body) {
      const request=validateSearch(body);
      const provider=new DuffelFlightProvider({token:env.DUFFEL_ACCESS_TOKEN,fetchImpl});
      return provider.search(request);
    },
    async handle(request) {
      try { return Response.json(await this.searchFlights(await request.json())); }
      catch(error) { return Response.json(safeError(error),{status:error.status || 503}); }
    }
  };
}
