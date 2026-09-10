const hash=s=>{let n=[...s].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;return n>>>0;};
/** Provider contract: async search(trip, departure) -> normalized quotes in USD.
 * Flight: {id, price, stops}; Hotel: {id, name, nightly, rating}.
 * Live adapters normalize taxes/currency and round-trip/whole-stay availability here. */
export class MockFlightProvider {
  async search(trip,date) {
    const n=hash(`${trip.origin.toLowerCase()}|${trip.destination.toLowerCase()}|${date}`);
    const price=360+n%420;
    return [{id:'economy',price,stops:1},{id:'direct',price:price+95,stops:0}];
  }
}
export class MockHotelProvider {
  async search(trip,date) {
    const n=hash(trip.destination.toLowerCase()+date);
    return [{id:'garden',name:'Garden House',nightly:85+n%65,rating:4.1},{id:'atelier',name:'Atelier Hotel',nightly:135+n%80,rating:4.6},{id:'grand',name:'The Grand',nightly:230+n%100,rating:4.9}];
  }
}
