/**
 * Both demo and live providers implement the SAME async search(trip, departure).
 * All prices are CNY tax-inclusive major units, never strings or inferred prices.
 * Flight price covers one adult's round trip; stops is the maximum per direction.
 * Hotel nightly is the full-stay average for one room; rating is guest score / 5.
 * Missing ratings must be excluded, never substituted with hotel star categories.
 * @typedef {{id:string, price:number, stops:number, currency:string, origin?:string,
 * destination?:string, departureDateTime?:string|null, returnDateTime?:string|null,
 * airline?:string, carrierCode?:string|null, segments?:object[], provider?:string,
 * source?:string, sourceMode?:string, originalPrice?:number, originalCurrency?:string,
 * currencyConversionRequired?:boolean, expiresAt?:string|null}} FlightQuote
 * @typedef {{id:string, name:string, nightly:number, rating:number, currency:string}} HotelQuote
 * @typedef {{search: (trip:object, departure:string) => Promise<FlightQuote[]>}} FlightProvider
 * @typedef {{search: (trip:object, departure:string) => Promise<HotelQuote[]>}} HotelProvider
 */
export class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}
const invalid = () => new ProviderError('INVALID_RESPONSE', 'Live data is unavailable because the provider returned unsupported or incomplete data.');
const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 300;
const price = v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 10000000;
function quotes(value) {
  if (!Array.isArray(value) || value.length > 1000) throw invalid();
  const ids = new Set();
  for (const q of value) {
    if (!q || !text(q.id) || ids.has(q.id) || (q.currency !== undefined && q.currency !== 'CNY')) throw invalid();
    ids.add(q.id);
  }
  return value;
}
export function validateFlightQuotes(value) {
  return quotes(value).map(q => {
    if (!price(q.price) || !Number.isInteger(q.stops) || q.stops < 0 || q.stops > 10) throw invalid();
    const optionalText = key => q[key] == null ? null : text(q[key]) ? q[key] : (()=>{throw invalid();})();
    const segments = q.segments == null ? [] : Array.isArray(q.segments) ? q.segments : (()=>{throw invalid();})();
    return {id:q.id, price:q.price, stops:q.stops, currency:'CNY',
      origin:optionalText('origin'), destination:optionalText('destination'),
      departureDateTime:optionalText('departureDateTime'), returnDateTime:optionalText('returnDateTime'),
      airline:optionalText('airline'), carrierCode:optionalText('carrierCode'), segments,
      provider:optionalText('provider'), source:optionalText('source'), sourceMode:optionalText('sourceMode'),
      originalPrice:q.originalPrice == null ? q.price : price(q.originalPrice) ? q.originalPrice : (()=>{throw invalid();})(),
      originalCurrency:q.originalCurrency == null ? 'CNY' : optionalText('originalCurrency'),
      currencyConversionRequired:q.currencyConversionRequired === true,
      expiresAt:optionalText('expiresAt')};
  });
}
export function validateHotelQuotes(value) {
  return quotes(value).map(q => {
    if (!text(q.name) || !price(q.nightly) || typeof q.rating !== 'number' || !Number.isFinite(q.rating) || q.rating < 1 || q.rating > 5) throw invalid();
    return {id:q.id, name:q.name, nightly:q.nightly, rating:q.rating, currency:'CNY',
      centralLocation:q.centralLocation===true,convenientTransport:q.convenientTransport===true,
      quietArea:q.quietArea===true,localFoodAccess:q.localFoodAccess===true};
  });
}
export function validateLiveEnvelope(value, kind) {
  if (!value || !['live','duffel'].includes(value.source) || value.currency !== 'CNY') throw invalid();
  return kind === 'flights' ? validateFlightQuotes(value.quotes) : validateHotelQuotes(value.quotes);
}
