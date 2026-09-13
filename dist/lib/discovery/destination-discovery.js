import {createTravelProviders} from '../providers/index.js';
import {createTemporalContext,planRepresentativeDateWindows} from './temporal-context.js';

const catalog=[
 {city:'Tokyo',countryOrRegion:'Japan',iataOrMetroCode:'TYO',themes:['food','culture','shopping','festive'],seasonal:['Winter city atmosphere and seasonal lights'],general:['Varied neighborhoods suit a short city break']},
 {city:'Osaka',countryOrRegion:'Japan',iataOrMetroCode:'OSA',themes:['food','culture','shopping'],seasonal:['Comfortable for a winter city itinerary'],general:['Food and compact urban experiences fit shorter trips']},
 {city:'Seoul',countryOrRegion:'South Korea',iataOrMetroCode:'SEL',themes:['food','shopping','culture','snow_winter','festive'],seasonal:['Winter city experiences and seasonal displays'],general:['A practical city-break format for a short trip']},
 {city:'Hong Kong',countryOrRegion:'Hong Kong SAR',iataOrMetroCode:'HKG',themes:['beach','food','shopping','culture','nature'],seasonal:['Milder conditions support city, coast, and outdoor time'],general:['Compact mix of food, neighborhoods, and nature']},
 {city:'Bangkok',countryOrRegion:'Thailand',iataOrMetroCode:'BKK',themes:['food','culture','relaxation'],seasonal:['A warm-weather direction during northern winter'],general:['Combines food, culture, and relaxed pacing']},
 {city:'Singapore',countryOrRegion:'Singapore',iataOrMetroCode:'SIN',themes:['beach','food','culture','nature','shopping','festive'],seasonal:['Warm-weather city and coastal escape with seasonal displays'],general:['Compact transport network suits a shorter stay']},
 {city:'Paris',countryOrRegion:'France',iataOrMetroCode:'PAR',themes:['culture','food','romantic','festive'],seasonal:['Seasonal city atmosphere and winter culture'],general:['Strong museum, food, and neighborhood mix']},
 {city:'London',countryOrRegion:'United Kingdom',iataOrMetroCode:'LON',themes:['culture','food','shopping','festive'],seasonal:['Seasonal lights and winter city experiences'],general:['Broad cultural and food options']}
];
const shortHaul=new Set(['Tokyo','Osaka','Seoul','Hong Kong']);
const safeCandidates=value=>{
  if(!Array.isArray(value)) throw new Error('Destination discovery returned no candidates.');
  const seen=new Set(),result=[];
  for(const candidate of value){const city=typeof candidate?.city==='string'?candidate.city.trim():'',country=typeof candidate?.countryOrRegion==='string'?candidate.countryOrRegion.trim():'';if(!city||!country||seen.has(city.toLowerCase()))continue;seen.add(city.toLowerCase());result.push({...candidate,city,countryOrRegion:country,themes:Array.isArray(candidate.themes)?[...new Set(candidate.themes)]:[],seasonalReasons:Array.isArray(candidate.seasonalReasons)?candidate.seasonalReasons.slice(0,4):[],generalReasons:Array.isArray(candidate.generalReasons)?candidate.generalReasons.slice(0,4):[],estimatedFitSignals:Array.isArray(candidate.estimatedFitSignals)?candidate.estimatedFitSignals.slice(0,4):[]});}
  if(!result.length) throw new Error('Destination discovery returned no usable cities.');return result.slice(0,8);
};
export class DestinationDiscoveryService { async discover(){throw new Error('Implement DestinationDiscoveryService.discover(preferences, context).');} }
export class LLMDestinationDiscoveryService extends DestinationDiscoveryService {
  constructor({fetchImpl=globalThis.fetch,endpoint='/api/travel/destinations/discover',timeoutMs=25000}={}){super();this.fetchImpl=fetchImpl?.bind(globalThis);this.endpoint=endpoint;this.timeoutMs=timeoutMs;}
  async discover(preferences,context){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);try{const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({preferences,context})});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error?.message||'AI destination discovery is unavailable.');return {...payload,candidates:safeCandidates(payload.candidates)};}finally{clearTimeout(timer);}}
}
export class DemoDestinationDiscoveryService extends DestinationDiscoveryService {
  async discover(preferences,context){const explicit=new Set(preferences.travelIntents||[]),inferred=new Set(context.inferredTravelIntents||[]);const ranked=catalog.filter(item=>item.city.toLowerCase()!==String(preferences.origin||'').toLowerCase()).map(item=>({...item,value:item.themes.filter(x=>explicit.has(x)).length*10+item.themes.filter(x=>inferred.has(x)).length*2})).sort((a,b)=>b.value-a.value||a.city.localeCompare(b.city)).slice(0,6);return {source:'general_prior_fallback',parserStatus:'fallback',candidates:ranked.map(item=>({city:item.city,countryOrRegion:item.countryOrRegion,iataOrMetroCode:item.iataOrMetroCode,themes:item.themes,seasonalReasons:item.seasonal,generalReasons:item.general,estimatedFitSignals:[shortHaul.has(item.city)?'Suitable for a short-haul city break':'Suitable when schedule and budget allow'],sourceType:'general_prior',confidence:'medium'}))};}
}
export class FallbackDestinationDiscoveryService extends DestinationDiscoveryService {
  constructor(primary=new LLMDestinationDiscoveryService(),fallback=new DemoDestinationDiscoveryService()){super();this.primary=primary;this.fallback=fallback;}
  async discover(preferences,context){try{return await this.primary.discover(preferences,context);}catch(error){return {...await this.fallback.discover(preferences,context),fallbackReason:error.message};}}
}
export class PopularityProvider { getSignal(){throw new Error('Implement PopularityProvider.getSignal(candidate).');} }
export class GeneralPopularityProvider extends PopularityProvider { getSignal(candidate){return {source:'general_prior',label:shortHaul.has(candidate?.city)?'Generally popular short-haul destination':'General destination familiarity prior',score:5,current:false};} }
const overlaps=(themes,wanted)=>themes.filter(theme=>wanted.includes(theme)).length;
const acceptableTiming=quote=>{
  const departures=Array.isArray(quote.segments)&&quote.segments.length?quote.segments.map(segment=>segment.departingAt):[quote.departureDateTime,quote.returnDateTime];
  return departures.length>=2&&departures.every(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value))&&
    departures.every(value=>{const hour=Number(value.slice(11,13));return hour>=6&&hour<24;})&&
    !quote.segments?.some(segment=>segment.overnight===true);
};
async function verifyFlights(candidate,preferences,windows,flightProvider,mode){
  if(!windows.length||!preferences.origin||!preferences.durationDays)return {status:'not_checked',reason:'Exact or representative travel dates are not available.',source:mode};
  const quotes=[];let failure;
  for(const window of windows){try{const found=await flightProvider.search({origin:preferences.origin,destination:candidate.city,currency:'CNY',nights:preferences.durationDays},window.departure);for(const quote of found)quotes.push({...quote,window});}catch(error){failure=error;}}
  const eligible=preferences.avoidOvernightFlights?quotes.filter(acceptableTiming):quotes;
  if(!eligible.length)return {status:'unavailable',reason:failure?.message||'No usable flight was found for the exploration windows.',source:mode};
  eligible.sort((a,b)=>a.price-b.price);return {status:'verified',quote:eligible[0],source:mode};
}
function scoreCandidate(candidate,preferences,context,verification,popularity){
  const explicit=preferences.travelIntents||[],inferred=(context.inferredTravelIntents||[]).filter(theme=>!explicit.includes(theme));let score=30;
  score+=explicit.length?Math.min(40,overlaps(candidate.themes,explicit)*40/explicit.length):0;
  score+=Math.min(18,overlaps(candidate.themes,inferred)*6);
  if(shortHaul.has(candidate.city)&&preferences.durationDays&&preferences.durationDays<=6)score+=10;
  score+=popularity.score;
  if(verification.status==='verified'){score+=10;if(verification.quote.stops===0)score+=5;if(preferences.flightBudgetCny!=null)score+=verification.quote.price<=preferences.flightBudgetCny?10:-10;else if(preferences.totalTripBudgetCny!=null&&verification.quote.price<preferences.totalTripBudgetCny)score+=5;}
  return Math.max(0,Math.min(100,Math.round(score)));
}
const explanation=(candidate,preferences,context,verification,popularity)=>{
  const say=(zh,en)=>context.language==='zh'?zh:en;
  const explicit=(preferences.travelIntents||[]).filter(theme=>candidate.themes.includes(theme));const inferred=(context.inferredTravelIntents||[]).filter(theme=>candidate.themes.includes(theme)&&!explicit.includes(theme));const reasons=[];
  if(explicit.length)reasons.push(say(`符合你明确提出的 ${explicit.join(' / ')} 偏好`,`Matches your explicit ${explicit.join(' / ')} preference`));
  if(inferred.length)reasons.push(say(`与${context.season}时间背景下的 ${inferred.slice(0,2).join(' / ')} 相符`,`Fits the ${context.season} context through ${inferred.slice(0,2).join(' / ')}`));
  if(shortHaul.has(candidate.city)&&preferences.durationDays&&preferences.durationDays<=6)reasons.push(say(`适合 ${preferences.durationDays} 天短途旅行`,`A practical short-haul shape for ${preferences.durationDays} days`));
  if(verification.status==='verified')reasons.push(say(`${verification.quote.window.departure} 找到${verification.quote.stops===0?'直飞':'中转'}航班，价格 ¥${Math.round(verification.quote.price).toLocaleString('en-US')}`,`${verification.quote.stops===0?'Direct':'Connecting'} flight found for ${verification.quote.window.departure} at ¥${Math.round(verification.quote.price).toLocaleString('en-US')}`));else reasons.push(say(`航班验证${verification.status==='not_checked'?'尚未执行':'暂不可用'}`,`Flight verification ${verification.status==='not_checked'?'not run':'unavailable'}`));
  reasons.push(shortHaul.has(candidate.city)?say('通用热门短途目的地先验','Generally popular short-haul destination'):say('通用目的地熟悉度先验','General destination familiarity prior'));return reasons.slice(0,4);
};
export const requiresDestinationDiscovery=preferences=>preferences?.destinationState==='discovery_required'||!preferences?.destination;
export async function discoverDestinations(preferences,{mode='demo',now=new Date(),language='en',discoveryService=new FallbackDestinationDiscoveryService(),popularityProvider=new GeneralPopularityProvider(),flightProvider}={}){
  const context=createTemporalContext(preferences,{now,language}),windows=planRepresentativeDateWindows(context,preferences.durationDays,{limit:2});
  const discovery=await discoveryService.discover(preferences,context),allCandidates=safeCandidates(discovery.candidates),originCountry=['Shanghai','Beijing','Guangzhou','Shenzhen','Chengdu'].includes(preferences.origin)?'China':null;
  const candidates=allCandidates.filter(candidate=>{if(!originCountry)return true;const domestic=candidate.countryOrRegion==='China'||candidate.countryOrRegion==='Mainland China';if(preferences.domesticAllowed===false&&domestic)return false;if(preferences.internationalAllowed===false&&!domestic)return false;return true;}),provider=flightProvider||createTravelProviders(mode).flights;
  const ranked=await Promise.all(candidates.map(async candidate=>{const verification=await verifyFlights(candidate,preferences,windows,provider,mode),popularity=popularityProvider.getSignal(candidate),score=scoreCandidate(candidate,preferences,context,verification,popularity);return {...candidate,verification,popularity,score,fitLabel:score>=75?'strong_fit':score>=55?'good_fit':'possible_fit',reasons:explanation(candidate,preferences,context,verification,popularity)};}));
  ranked.sort((a,b)=>b.score-a.score||a.city.localeCompare(b.city));return {...discovery,context,dateWindows:windows,candidates:ranked};
}
