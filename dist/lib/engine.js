import {createTripRequest, requireDestination} from './trip-request.js';
import {validatePreferences} from './preferences.js';
import {destinationIdentity} from './discovery/destination-identity.js';
import {isExcludedDestination} from './preference-constraints.js';
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function validateTrip(t) {
  t = createTripRequest(t);
  requireDestination(t);
  if(!t.origin?.trim()) throw new Error('Enter an origin.');
  if(t.origin.trim().toLowerCase()===t.destination.trim().toLowerCase()) throw new Error('Choose a destination different from your origin.');
  const hard=t.constraints?.hard||{};
  if(isExcludedDestination(hard,t.destination,destinationIdentity(t.destination).countryNames.en))throw new Error('This destination is excluded by your preferences.');
  if(hard.geography){const country=destinationIdentity(t.destination).countryNames.en;if(!country)throw new Error('Cannot verify this destination against your domestic/international constraint.');if((hard.geography==='domestic')!==(country==='China'))throw new Error('This destination does not match your domestic/international constraint.');}
  for(const k of ['start','end']) if(!/^\d{4}-\d{2}-\d{2}$/.test(t[k])||!Number.isFinite(Date.parse(t[k]))||new Date(t[k]).toISOString().slice(0,10)!==t[k]) throw new Error('Enter valid travel dates.');
  const days=(Date.parse(t.end)-Date.parse(t.start))/86400000;
  if(days<0||days>60) throw new Error('Use a departure window of 0–60 days.');
  if(!Number.isInteger(t.nights)||t.nights<1||t.nights>30) throw new Error('Trip duration must be 1–30 nights.');
  if(![t.flightBudget,t.hotelBudget].every(n=>n==null||(Number.isFinite(n)&&n>0&&n<=100000))) throw new Error('Budgets must be between ¥1 and ¥100,000.');
  if(t.totalTripBudgetCny!=null&&(!Number.isFinite(t.totalTripBudgetCny)||t.totalTripBudgetCny<=0))throw new Error('Enter a valid total trip budget.');
  if(t.rating!=null&&(!Number.isFinite(t.rating)||t.rating<1||t.rating>5)) throw new Error('Minimum rating must be between 1 and 5.');
}
export function isOvernightFlight(f){
 const legs=Array.isArray(f.segments)&&f.segments.length?f.segments:[{departingAt:f.departureDateTime,arrivingAt:null},{departingAt:f.returnDateTime,arrivingAt:null}];
 return legs.some(leg=>{if(leg.overnight===true)return true;const departure=leg.departingAt||leg.departureDateTime;if(!departure)return true;const hour=Number(departure.slice(11,13));return !Number.isFinite(hour)||hour<6||hour>=22;});
}
function flightDuration(f){const segments=f.segments;if(!Array.isArray(segments)||!segments.length)return f.durationMinutes??null;
 const durations=segments.map(s=>Date.parse(s.arrivingAt)-Date.parse(s.departingAt));return durations.every(d=>Number.isFinite(d)&&d>=0)?durations.reduce((a,b)=>a+b,0)/60000:null;}
export function satisfiesHardConstraints(t,p,f,h){const c=p.constraints?.hard||{};
 if((p.nonstop||c.directFlightRequired)&&f.stops!==0)return false;
 if(c.maxStops!=null&&f.stops>c.maxStops)return false;
 if(c.avoidOvernightFlights&&isOvernightFlight(f))return false;
 if(c.maxFlightDurationMinutes!=null&&(flightDuration(f)==null||flightDuration(f)>c.maxFlightDurationMinutes))return false;
 if(c.strictBudgetCap&&((t.flightBudget!=null&&f.price>t.flightBudget)||(t.hotelBudget!=null&&h.nightly>t.hotelBudget)||(t.totalTripBudgetCny!=null&&f.price+h.nightly*t.nights>t.totalTripBudgetCny)))return false;
 return true;}
// Weights: base value/quality 70 points; strong flight convenience up to 24;
// soft evidenced hotel/destination fit up to 6. Hard constraints filter first.
export function preferenceFit(p,f,h){const {strong={},soft={}}=p.constraints||{};let points=0;
 if(strong.directFlightPreferred)points+=f.stops===0?16:-12;
 if(strong.avoidOvernightFlightsPreferred)points+=isOvernightFlight(f)?-16:16;
 if(strong.daytimeFlightsPreferred)points+=isOvernightFlight(f)?-10:10;
 if(strong.fewerTransfersPreferred)points+=f.stops===0?8:-Math.min(8,4*f.stops);
 if(strong.shorterFlightPreferred&&flightDuration(f)!=null)points+=Math.max(-8,8-flightDuration(f)/60);
 if(strong.higherRatedHotelsPreferred)points+=(h.rating-3)*4;
  if(strong.comfortPreferred)points+=(h.rating-3)*3;
  if(strong.centralLocationPreferred&&h.centralLocation===true)points+=12;
  if(strong.convenientTransportPreferred&&h.convenientTransport===true)points+=10;
 if(soft.quietAreas&&h.quietArea===true)points+=Math.min(4,soft.quietAreas*2);
 if(soft.localFood&&h.localFoodAccess===true)points+=Math.min(4,soft.localFood*2);
 return Math.max(-30,Math.min(30,points));}
export function scoreQuote(t,p,f,h) {
  const total=f.price+h.nightly*t.nights;
  const budget=t.flightBudget!=null&&t.hotelBudget!=null?t.flightBudget+t.hotelBudget*t.nights:null;
  const feasible=(t.flightBudget==null||f.price<=t.flightBudget)&&(t.hotelBudget==null||h.nightly<=t.hotelBudget);
  const value=budget==null?1/(1+total/5000):Math.max(0,1-total/(budget*1.5));
  const quality=h.rating/5;
  const base=100*(p.priority==='comfort'?value*.35+quality*.65:value*.8+quality*.2);
  const fit=preferenceFit(p,f,h),convenience=budget==null?(f.stops===0?6:-Math.min(8,f.stops*4))+(isOvernightFlight(f)?-3:3):0;
  const score=Math.max(0,Math.min(100,Math.round(base*.7+fit+convenience+10)));
  return {flight:f,hotel:h,total,feasible,budgetStatus:budget==null?'unconfirmed':feasible?'within':'over',score,preferenceFit:fit};
}
export async function scout(t, interpreter, flights, hotels) {
  t = createTripRequest(t);
  validateTrip(t);
  const interpreted=await interpreter.interpret(t.notes||'',{travelIntents:t.travelIntents,constraints:t.constraints});
  const preferences=validatePreferences({...interpreted,constraints:t.constraints,travelIntents:t.travelIntents});
  const dates=[];if(Array.isArray(t.candidateDates)&&t.candidateDates.length)dates.push(...t.candidateDates);else for(let d=t.start;d<=t.end;d=addDays(d,1))dates.push(d);
  const candidates=await Promise.all(dates.map(async date=>{
    const [fs,hs]=await Promise.all([flights.search(t,date),hotels.search(t,date)]);
    const options=fs.flatMap(f=>hs.filter(h=>(t.rating==null||h.rating>=t.rating)&&satisfiesHardConstraints(t,preferences,f,h)).map(h=>scoreQuote(t,preferences,f,h)));
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
