import {createTravelProviders} from '../providers/index.js';
import {createTemporalContext,planRepresentativeDateWindows} from './temporal-context.js';
import {transportAvailability} from './transport-modes.js';
import {destinationIdentity} from './destination-identity.js';
import {createTripRequest} from '../trip-request.js';
import {isOvernightFlight} from '../engine.js';
import {isExcludedDestination} from '../preference-constraints.js';
import {displayIntentReason,displayLabel} from '../display-localization.js';
import {DESTINATION_UNIVERSE,getDestination,isMainlandDestination} from './destination-universe.js';
import {CuratedDestinationAccessResolver} from './destination-access-resolver.js';

const accessResolver=new CuratedDestinationAccessResolver();
const countryOf=candidate=>getDestination(candidate)?.countryNames.en||candidate.countryOrRegion;
const isDomestic=candidate=>isMainlandDestination(getDestination(candidate))||candidate.countryOrRegion==='China'||candidate.countryOrRegion==='Mainland China';
const keyOf=candidate=>getDestination(candidate)?.id||destinationIdentity(candidate).key;

// Greedy, deterministic presentation reranking. The numeric fit score is unchanged.
export function rerankDestinations(candidates,{travelIntents=[],recentIds=[],seed=0,limit=candidates.length}={}){
 const precise=travelIntents.length>0,selected=[],remaining=[...candidates],recent=new Set(recentIds);
 while(remaining.length&&selected.length<limit){
  const score=candidate=>{
   const entity=getDestination(candidate),category=entity?.sceneryCategory||destinationIdentity(candidate).fallbackCategory;
   const sameCategory=selected.filter(item=>(getDestination(item)?.sceneryCategory||destinationIdentity(item).fallbackCategory)===category).length;
   const sameCountry=selected.filter(item=>countryOf(item)===countryOf(candidate)).length;
   const sameType=selected.filter(item=>item.entityType===candidate.entityType).length;
   const traits=entity?.destinationTraits||candidate.themes||[];
   const sameTheme=selected.filter(item=>{const prior=getDestination(item)?.destinationTraits||item.themes||[];return ['beach','snow_winter','food','nature','culture'].some(theme=>traits.includes(theme)&&prior.includes(theme));}).length;
   const iconic=entity?.discoveryTier==='iconic';
   const diversity=(precise?.35:1)*(sameCategory*16+Math.min(2,sameCountry)*5+Math.min(2,sameType)*5+sameTheme*15+(iconic?selected.filter(item=>getDestination(item)?.discoveryTier==='iconic').length*7:0));
   const repetition=recent.has(keyOf(candidate))?28:0;
   return candidate.score-diversity-repetition-(iconic&&!precise?5:0);
  };
  remaining.sort((a,b)=>score(b)-score(a)||((keyOf(a).length+seed)%23)-((keyOf(b).length+seed)%23)||keyOf(a).localeCompare(keyOf(b)));
  selected.push(remaining.shift());
 }
 return selected;
}
export class DestinationRecommendationSession {
 constructor({seed=0}={}){this.seed=seed;this.recentIds=[];}
 select(candidates,preferences={},limit=3){const picked=rerankDestinations(candidates,{travelIntents:preferences.travelIntents||[],recentIds:this.recentIds,seed:this.seed,limit:Math.min(limit,candidates.length)});this.recentIds=[...picked.map(keyOf),...this.recentIds].slice(0,30);return picked;}
 reset(){this.recentIds=[];}
}
const safeCandidates=value=>{
  if(!Array.isArray(value)) throw new Error('Destination discovery returned no candidates.');
  const seen=new Set(),result=[];
  for(const candidate of value){const city=typeof candidate?.city==='string'?candidate.city.trim():'',entity=getDestination(city),country=entity?.countryNames.en||candidate?.countryOrRegion?.trim()||'';if(!city||!country||seen.has(city.toLowerCase()))continue;seen.add(city.toLowerCase());result.push({id:entity?.id||destinationIdentity(candidate).key,city:entity?.canonicalName||city,countryOrRegion:country,iataOrMetroCode:entity?.directAirportCode||candidate.iataOrMetroCode||null,entityType:entity?.entityType||'city',sceneryCategory:entity?.sceneryCategory||'urban',themes:entity?.destinationTraits|| (Array.isArray(candidate.themes)?[...new Set(candidate.themes)]:[]),seasonalReasons:Array.isArray(candidate.seasonalReasons)?candidate.seasonalReasons.slice(0,4):[],generalReasons:Array.isArray(candidate.generalReasons)?candidate.generalReasons.slice(0,4):[],estimatedFitSignals:Array.isArray(candidate.estimatedFitSignals)?candidate.estimatedFitSignals.slice(0,4):[],sourceType:candidate.sourceType,confidence:candidate.confidence});}
  if(!result.length) throw new Error('Destination discovery returned no usable cities.');return result.slice(0,60);
};
export class DestinationDiscoveryService { async discover(){throw new Error('Implement DestinationDiscoveryService.discover(preferences, context).');} }
export class LLMDestinationDiscoveryService extends DestinationDiscoveryService {
  constructor({fetchImpl=globalThis.fetch,endpoint='/api/travel/destinations/discover',timeoutMs=25000}={}){super();this.fetchImpl=fetchImpl?.bind(globalThis);this.endpoint=endpoint;this.timeoutMs=timeoutMs;}
  async discover(preferences,context){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);try{const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({preferences,context})});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error?.message||'AI destination discovery is unavailable.');return {...payload,candidates:safeCandidates(payload.candidates)};}finally{clearTimeout(timer);}}
}
export class DemoDestinationDiscoveryService extends DestinationDiscoveryService {
  async discover(preferences,context){const explicit=new Set(preferences.travelIntents||[]),inferred=new Set(context.inferredTravelIntents||[]),geography=preferences.geographyPreference|| (preferences.domesticAllowed===false?'international':preferences.internationalAllowed===false?'domestic':'all');const pool=DESTINATION_UNIVERSE.filter(item=>item.id!==keyOf({city:preferences.origin})&&(geography==='all'||(geography==='domestic')===isMainlandDestination(item))).map(item=>({item,fit:item.destinationTraits.filter(x=>explicit.has(x)).length*12+item.destinationTraits.filter(x=>inferred.has(x)).length*3+(item.discoveryTier==='long_tail'?4:0)})).sort((a,b)=>b.fit-a.fit||a.item.id.localeCompare(b.item.id));
   const chosen=geography==='all'?[...pool.filter(row=>isMainlandDestination(row.item)).slice(0,15),...pool.filter(row=>!isMainlandDestination(row.item)).slice(0,15)]:pool.slice(0,30);
   return {source:'general_prior_fallback',parserStatus:'fallback',candidates:chosen.map(({item})=>({city:item.canonicalName,countryOrRegion:item.countryNames.en,iataOrMetroCode:item.directAirportCode,themes:item.destinationTraits,seasonalReasons:[],generalReasons:[],estimatedFitSignals:[],sourceType:'general_prior',confidence:'medium'}))};}
}
export class FallbackDestinationDiscoveryService extends DestinationDiscoveryService {
  constructor(primary=new LLMDestinationDiscoveryService(),fallback=new DemoDestinationDiscoveryService()){super();this.primary=primary;this.fallback=fallback;}
  async discover(preferences,context){try{return await this.primary.discover(preferences,context);}catch(error){return {...await this.fallback.discover(preferences,context),fallbackReason:error.message};}}
}
export class PopularityProvider { getSignal(){throw new Error('Implement PopularityProvider.getSignal(candidate).');} }
export class GeneralPopularityProvider extends PopularityProvider { getSignal(){return {source:'general_prior',label:'General destination familiarity prior',score:2,current:false};} }
const overlaps=(themes,wanted)=>themes.filter(theme=>wanted.includes(theme)).length;
const acceptableTiming=quote=>{
  const departures=Array.isArray(quote.segments)&&quote.segments.length?quote.segments.map(segment=>segment.departingAt):[quote.departureDateTime,quote.returnDateTime];
  return departures.length>=2&&departures.every(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value))&&
    departures.every(value=>{const hour=Number(value.slice(11,13));return hour>=6&&hour<24;})&&
    !quote.segments?.some(segment=>segment.overnight===true);
};
const withinDuration=(quote,maxMinutes)=>{if(maxMinutes==null)return true;const segments=quote.segments;if(!Array.isArray(segments)||!segments.length)return false;const durations=segments.map(segment=>Date.parse(segment.arrivingAt)-Date.parse(segment.departingAt));return durations.every(value=>Number.isFinite(value)&&value>=0)&&durations.reduce((a,b)=>a+b,0)<=maxMinutes*60000;};
async function verifyFlights(candidate,preferences,windows,flightProvider,mode){
  const access=candidate.access||accessResolver.resolve(candidate);
  if(['train','self_drive'].includes(preferences.constraints?.hard?.transportModeRequired))return {status:'not_checked',reason:'Flight search was skipped for the requested transport mode.',source:mode};
  if(!windows.length||!preferences.origin||!preferences.durationDays)return {status:'not_checked',reason:'Representative travel dates are not available.',source:mode};
  if(!access.flightAccess.providerLookup)return {status:'not_checked',reason:'The possible airport hub is not yet supported by the flight provider.',source:mode};
  const quotes=[];let failure;
  for(const window of windows){try{const found=await flightProvider.search({origin:preferences.origin,destination:access.flightAccess.providerLookup,currency:'CNY',nights:preferences.durationDays},window.departure);for(const quote of found)quotes.push({...quote,window});}catch(error){failure=error;}}
  const hard=preferences.constraints?.hard||{};
  const eligible=quotes.filter(q=>(!preferences.avoidOvernightFlights&&!hard.avoidOvernightFlights||acceptableTiming(q))&&(!hard.directFlightRequired||q.stops===0)&&(hard.maxStops==null||q.stops<=hard.maxStops)&&withinDuration(q,hard.maxFlightDurationMinutes)&&(preferences.flightBudgetCny==null||!hard.strictBudgetCap||q.price<=preferences.flightBudgetCny));
  if(!eligible.length)return {status:'unavailable',reason:failure?.message||'No usable flight was found for the exploration windows.',source:mode};
  const strong=preferences.constraints?.strong||{};
  eligible.sort((a,b)=>(a.price-(strong.directFlightPreferred&&a.stops===0?800:0)-(strong.avoidOvernightFlightsPreferred&&!isOvernightFlight(a)?800:0))-(b.price-(strong.directFlightPreferred&&b.stops===0?800:0)-(strong.avoidOvernightFlightsPreferred&&!isOvernightFlight(b)?800:0)));return access.flightAccess.requiresOnwardTransfer?{status:'partially_verified',hubQuote:eligible[0],hub:access.flightAccess.hub,reason:'Onward transfer is not priced or verified.',source:mode}:{status:'verified',quote:eligible[0],source:mode};
}
function scoreCandidate(candidate,preferences,context,verification,popularity,transport){
  const explicit=preferences.travelIntents||[],inferred=(context.inferredTravelIntents||[]).filter(theme=>!explicit.includes(theme)),entity=getDestination(candidate);let score=20;
  score+=explicit.length?Math.min(40,overlaps(candidate.themes,explicit)*40/explicit.length):0;
  score+=Math.min(18,overlaps(candidate.themes,inferred)*6);
  if(preferences.durationDays&&preferences.durationDays<=3&&(candidate.access?.railAccess.hub||candidate.access?.selfDriveAccess.suitable))score+=6;
  if(entity?.discoveryTier==='long_tail')score+=8;
  score+=Math.min(2,popularity.score||0);
  if(verification.status==='verified'){score+=10;if(verification.quote.stops===0)score+=5;if(preferences.flightBudgetCny!=null)score+=verification.quote.price<=preferences.flightBudgetCny?10:-10;else if(preferences.totalTripBudgetCny!=null&&verification.quote.price<preferences.totalTripBudgetCny)score+=5;}
  const strong=preferences.constraints?.strong||{},soft=preferences.constraints?.soft||{};
  if(verification.status==='verified'){if(strong.directFlightPreferred)score+=verification.quote.stops===0?16:-12;if(strong.avoidOvernightFlightsPreferred)score+=isOvernightFlight(verification.quote)?-16:16;}
  if(strong.seasidePreferred)score+=candidate.themes.includes('beach')?12:-6;
  if(strong.mountainPreferred||strong.naturePreferred)score+=candidate.themes.includes('nature')?10:-5;
  for(const [key,theme] of [['localFood','food'],['shopping','shopping'],['culture','culture'],['nature','nature'],['relaxation','relaxation'],['family','family'],['romantic','romantic']])if(soft[key])score+=candidate.themes.includes(theme)?Math.min(6,soft[key]*3):-2;
  const mode=preferences.constraints?.hard?.transportModeRequired,desired=mode||strong.trainPreferred&&'train'||strong.selfDrivePreferred&&'self_drive'||strong.flightPreferred&&'flight';
  if(desired){const option=transport[desired];score+=option?.suitability==='not_applicable'?-45:Math.round((option?.suitabilityScore-50)*.45);}
  return Math.max(0,Math.min(100,Math.round(score)));
}
const explanation=(candidate,preferences,context,verification,popularity)=>{
  const say=(zh,en)=>context.language==='zh'?zh:en;
  const explicit=(preferences.travelIntents||[]).filter(theme=>candidate.themes.includes(theme));const inferred=(context.inferredTravelIntents||[]).filter(theme=>candidate.themes.includes(theme)&&!explicit.includes(theme));const reasons=[];
  if(explicit.length)reasons.push(displayIntentReason(explicit[0],context.language));
  if(inferred.length)reasons.push(say(`${displayLabel(context.season,'zh')}适合${displayLabel(inferred[0],'zh')}体验`,`${displayLabel(context.season,'en')} suits ${displayLabel(inferred[0],'en').toLowerCase()} experiences`));
  if(preferences.durationDays&&preferences.durationDays<=3&&candidate.access?.railAccess.hub)reasons.push(say(`可考虑 ${preferences.durationDays} 天短途旅行`,`An option for a ${preferences.durationDays}-day break`));
  if(verification.status==='verified')reasons.push(say(`已有${verification.quote.stops===0?'直飞':'中转'}航班参考，价格 ¥${Math.round(verification.quote.price).toLocaleString('en-US')}`,`${verification.quote.stops===0?'Direct':'Connecting'} flight reference at ¥${Math.round(verification.quote.price).toLocaleString('en-US')}`));else if(verification.status==='partially_verified')reasons.push(say('已核验入口航班，后续接驳与总价待核验','Entry flight checked; onward transfer and total cost unverified'));else reasons.push(say(verification.status==='not_checked'?'航班尚未核验':'航班暂不可用',verification.status==='not_checked'?'Flight not yet verified':'Flight unavailable'));
  reasons.push(say('可以考虑的旅行方向','A travel direction worth considering'));return reasons.slice(0,4);
};
export const requiresDestinationDiscovery=preferences=>preferences?.destinationState==='discovery_required'||!preferences?.destination;
export async function discoverDestinations(preferences,{mode='demo',now=new Date(),language='en',discoveryService=null,popularityProvider=new GeneralPopularityProvider(),flightProvider,recentIds=[],seed=0}={}){
  preferences=createTripRequest({...preferences,destination:null,notes:preferences.notes||preferences.preferences?.join(' · ')||''});
  preferences={...preferences,durationDays:preferences.durationDays||null};
  if(!preferences.durationDays)preferences.durationDays=preferences.departureWindowText&&/周末|weekend/i.test(preferences.departureWindowText)?2:5;
  const context=createTemporalContext(preferences,{now,language}),windows=planRepresentativeDateWindows(context,preferences.durationDays,{limit:2});
  const service=discoveryService||new FallbackDestinationDiscoveryService(),discovery=await service.discover(preferences,context);
  const supplement=discoveryService?[]:(await new DemoDestinationDiscoveryService().discover(preferences,context)).candidates;
  const allCandidates=safeCandidates([...discovery.candidates,...supplement]),geographyPreference=preferences.geographyPreference||(preferences.domesticAllowed===false?'international':preferences.internationalAllowed===false?'domestic':'all');
  const filtered=allCandidates.map(candidate=>({...candidate,access:accessResolver.resolve(candidate)})).filter(candidate=>{const domestic=isDomestic(candidate),hard=preferences.constraints?.hard||{},required=hard.transportModeRequired,transport=required?transportAvailability({status:'not_checked',source:mode},{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints}):null;return candidate.city.toLowerCase()!==String(preferences.origin||'').toLowerCase()&&!isExcludedDestination(hard,candidate.city,candidate.countryOrRegion)&&(!required||transport?.[required]?.suitability!=='not_applicable')&&(hard.geography==null||(hard.geography==='domestic')===domestic)&&(geographyPreference==='all'||(geographyPreference==='domestic')===domestic);});
  const candidates=(geographyPreference==='all'&&filtered.length>30?[...filtered.filter(isDomestic).slice(0,15),...filtered.filter(item=>!isDomestic(item)).slice(0,15)]:filtered).slice(0,30),provider=flightProvider||createTravelProviders(mode).flights;
  const preliminary=candidates.map(candidate=>{const pending={status:'not_checked',source:mode},popularity=popularityProvider.getSignal(candidate),transport=transportAvailability(pending,{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints});return {...candidate,score:scoreCandidate(candidate,preferences,context,pending,popularity,transport)};});
  const verificationCandidates=mode==='live'?rerankDestinations(preliminary.filter(candidate=>candidate.access.flightAccess.providerLookup),{travelIntents:preferences.travelIntents,recentIds,seed,limit:8}):preliminary;
  const verifyIds=new Set(verificationCandidates.map(candidate=>candidate.id));
  const ranked=await Promise.all(candidates.map(async candidate=>{const verification=verifyIds.has(candidate.id)?await verifyFlights(candidate,preferences,windows,provider,mode):{status:'not_checked',source:mode,reason:'Flight verification is pending.'},popularity=popularityProvider.getSignal(candidate),transport=transportAvailability(verification,{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints}),score=scoreCandidate(candidate,preferences,context,verification,popularity,transport);return {...candidate,identity:destinationIdentity(candidate),verification,transport,popularity,score,fitLabel:score>=75?'strong_fit':score>=55?'good_fit':'possible_fit',reasons:explanation(candidate,preferences,context,verification,popularity)};}));
  return {...discovery,context,dateWindows:windows,geographyPreference,universeSupplemented:supplement.length>0,displayPreferences:{travelIntents:[...(preferences.travelIntents||[])]},candidates:rerankDestinations(ranked,{travelIntents:preferences.travelIntents,recentIds,seed})};
}
