export const DEFAULT_CURRENCY = 'CNY';
export const TRAVEL_INTENTS = ['festive','beach','relaxation','hiking','food','culture','nature','snow_winter','shopping','family','romantic'];
import {parsePreferenceConstraints} from './preference-constraints.js';
/** Internal request model; null destination is reserved for future discovery.
 * @typedef {{origin:string, destination?:string|null, currency?:string,
 * start:string, end:string, nights:number, flightBudget:number, hotelBudget:number,
 * rating:number, totalTripBudgetCny?:number|null, notes?:string, travelIntents?:string[]}} TripRequest
 * Amounts are numeric major units of currency (yuan for CNY).
 */
export function normalizeTravelIntents(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map(v=>String(v).trim().toLowerCase()).filter(v=>TRAVEL_INTENTS.includes(v)))];
}
/** @returns {TripRequest & {currency: "CNY", destination: string|null, destinationState:"provided"|"discovery_required", travelIntents:string[]}} */
export function createTripRequest(input) {
  const currency = input.currency ?? DEFAULT_CURRENCY;
  if (currency !== DEFAULT_CURRENCY) throw new Error('Only CNY budgets are supported. Convert other currencies before searching.');
  if (input.destination != null && typeof input.destination !== 'string') throw new Error('Destination must be a place name or null.');
  const destination = input.destination?.trim() || null;
  return {...input, currency, destination,
    destinationState:destination ? 'provided' : 'discovery_required',
    travelIntents:normalizeTravelIntents(input.travelIntents),
    constraints:parsePreferenceConstraints(input.notes,input.constraints)};
}
export function requireDestination(trip) {
  if (!trip.destination?.trim()) throw new Error('Choose a destination to search. Destination discovery is not available yet.');
}
