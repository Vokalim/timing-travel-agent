import {createTripRequest, requireDestination} from '../trip-request.js';
import {validateFlightQuotes} from './contracts.js';
const hash=s=>{let n=[...s].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;return n>>>0;};
export class MockFlightProvider {
  async search(trip,date) {
    trip = createTripRequest(trip);
    requireDestination(trip);
    const n=hash(`${trip.origin.toLowerCase()}|${trip.destination.toLowerCase()}|${date}`);
    const price=2520+(n%420)*7;
    return validateFlightQuotes([
      {id:'economy',price,stops:1,airline:'Demo Air',provider:'mock',source:'demo',sourceMode:'demo'},
      {id:'direct',price:price+665,stops:0,airline:'Demo Air',provider:'mock',source:'demo',sourceMode:'demo'}]);
  }
}
