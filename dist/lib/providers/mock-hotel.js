import {createTripRequest, requireDestination} from '../trip-request.js';
import {validateHotelQuotes} from './contracts.js';
const hash=s=>{let n=[...s].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;return n>>>0;};
export class MockHotelProvider {
  async search(trip,date) {
    trip = createTripRequest(trip);
    requireDestination(trip);
    const n=hash(trip.destination.toLowerCase()+date);
    return validateHotelQuotes([{id:'garden',name:'Garden House',nightly:595+(n%65)*7,rating:4.1},{id:'atelier',name:'Atelier Hotel',nightly:945+(n%80)*7,rating:4.6},{id:'grand',name:'The Grand',nightly:1610+(n%100)*7,rating:4.9}]);
  }
}
