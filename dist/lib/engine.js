import {createTripRequest, requireDestination} from './trip-request.js';
import {validatePreferences} from './preferences.js';
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function validateTrip(t) {
  t = createTripRequest(t);
  requireDestination(t);
  if(!t.origin?.trim()) throw new Error('Enter an origin.');
  if(t.origin.trim().toLowerCase()===t.destination.trim().toLowerCase()) throw new Error('Choose a destination different from your origin.');
  for(const k of ['start','end']) if(!/^\d{4}-\d{2}-\d{2}$/.test(t[k])||!Number.isFinite(Date.parse(t[k]))||new Date(t[k]).toISOString().slice(0,10)!==t[k]) throw new Error('Enter valid travel dates.');
  const days=(Date.parse(t.end)-Date.parse(t.start))/86400000;
  if(days<0||days>60) throw new Error('Use a departure window of 0–60 days.');
  if(!Number.isInteger(t.nights)||t.nights<1||t.nights>30) throw new Error('Trip duration must be 1–30 nights.');
  if(![t.flightBudget,t.hotelBudget].every(n=>Number.isFinite(n)&&n>0&&n<=100000)) throw new Error('Budgets must be between ¥1 and ¥100,000.');
  if(!Number.isFinite(t.rating)||t.rating<1||t.rating>5) throw new Error('Minimum rating must be between 1 and 5.');
}
export function scoreQuote(t,p,f,h) {
  const total=f.price+h.nightly*t.nights;
  const budget=t.flightBudget+t.hotelBudget*t.nights;
  const feasible=f.price<=t.flightBudget&&h.nightly<=t.hotelBudget;
  const value=Math.max(0,1-total/(budget*1.5));
  const quality=h.rating/5;
  const score=Math.round(100*(p.priority==='comfort'?value*.35+quality*.65:value*.8+quality*.2));
  return {flight:f,hotel:h,total,feasible,score};
}
export async function scout(t, interpreter, flights, hotels) {
  t = createTripRequest(t);
  validateTrip(t);
  const interpreted=await interpreter.interpret(t.notes||'',{travelIntents:t.travelIntents});
  const preferences=validatePreferences({...interpreted,travelIntents:t.travelIntents});
  const dates=[];for(let d=t.start;d<=t.end;d=addDays(d,1))dates.push(d);
  const candidates=await Promise.all(dates.map(async date=>{
    const [fs,hs]=await Promise.all([flights.search(t,date),hotels.search(t,date)]);
    const options=fs.filter(f=>!preferences.nonstop||f.stops===0).flatMap(f=>hs.filter(h=>h.rating>=t.rating).map(h=>scoreQuote(t,preferences,f,h)));
    options.sort((a,b)=>Number(b.feasible)-Number(a.feasible)||b.score-a.score||a.total-b.total);
    return options.length?{date,returnDate:addDays(date,t.nights),...options[0]}:null;
  }));
  const available=candidates.filter(Boolean);
  const ranked=[...available].sort((a,b)=>Number(b.feasible)-Number(a.feasible)||b.score-a.score||a.total-b.total||a.date.localeCompare(b.date));
  const best=ranked[0]; const first=available.find(c=>c.date===t.start);
  const savings=first&&best?first.total-best.total:0;
  const decision=!best||!best.feasible?'WAIT':best.date!==t.start&&(!first?.feasible||savings>=first.total*.05)?'CHANGE DATE':'BOOK';
  return {trip:{...t},preferences,candidates:available,checked:dates.length,best,decision,savings};
}
