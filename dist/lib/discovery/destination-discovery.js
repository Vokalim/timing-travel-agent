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
import {destinationContinent,destinationCostLevel,destinationRegion,evaluateOriginAccess,resolveOriginContext} from './destination-geography.js';

const accessResolver=new CuratedDestinationAccessResolver();
const countryOf=candidate=>getDestination(candidate)?.countryNames.en||candidate.countryOrRegion;
const isDomestic=(candidate,origin)=>{const entity=getDestination(candidate),originCountry=resolveOriginContext(origin,getDestination).countryCode;return Boolean(originCountry&&entity?.countryCode===originCountry);};
const keyOf=candidate=>getDestination(candidate)?.id||destinationIdentity(candidate).key;

// Greedy, deterministic presentation reranking. The numeric fit score is unchanged.
export function rerankDestinations(candidates,{travelIntents=[],recentIds=[],seed=0,limit=candidates.length}={}){
 const precise=travelIntents.length>0,selected=[],remaining=[...candidates],recent=new Set(recentIds);
 while(remaining.length&&selected.length<limit){
  const score=candidate=>{
   const entity=getDestination(candidate),category=entity?.sceneryCategory||destinationIdentity(candidate).fallbackCategory;
   const sameCategory=selected.filter(item=>(getDestination(item)?.sceneryCategory||destinationIdentity(item).fallbackCategory)===category).length;
   const sameCountry=selected.filter(item=>countryOf(item)===countryOf(candidate)).length;
   const sameRegion=selected.filter(item=>destinationRegion(getDestination(item))===destinationRegion(entity)).length;
   const sameContinent=selected.filter(item=>destinationContinent(getDestination(item))===destinationContinent(entity)).length;
   const sameType=selected.filter(item=>item.entityType===candidate.entityType).length;
   const sameTier=selected.filter(item=>getDestination(item)?.discoveryTier===entity?.discoveryTier).length;
   const sameCost=selected.filter(item=>destinationCostLevel(getDestination(item))===destinationCostLevel(entity)).length;
   const traits=entity?.destinationTraits||candidate.themes||[];
   const sameTheme=selected.filter(item=>{const prior=getDestination(item)?.destinationTraits||item.themes||[];return ['beach','snow_winter','food','nature','culture'].some(theme=>traits.includes(theme)&&prior.includes(theme));}).length;
   const iconic=entity?.discoveryTier==='iconic';
   const diversity=(precise?.55:1)*(sameCategory*13+Math.min(2,sameCountry)*7+Math.min(2,sameRegion)*7+Math.min(2,sameContinent)*8+Math.min(2,sameType)*4+Math.min(2,sameTier)*2+Math.min(2,sameCost)+sameTheme*15+(iconic?selected.filter(item=>getDestination(item)?.discoveryTier==='iconic').length*7:0));
   const repetition=recent.has(keyOf(candidate))?28:0;
   return candidate.score-diversity-repetition-(iconic&&!precise?5:0);
  };
  remaining.sort((a,b)=>score(b)-score(a)||((keyOf(a).length+seed)%23)-((keyOf(b).length+seed)%23)||keyOf(a).localeCompare(keyOf(b)));
  selected.push(remaining.shift());
 }
 return selected;
}

const stableValue=value=>{
 if(Array.isArray(value))return value.map(stableValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
 return value??null;
};
export function destinationRequestKey(preferences={},mode='demo'){
 const meaningful={mode,origin:preferences.origin||null,departureWindowText:preferences.departureWindowText||null,earliestDeparture:preferences.earliestDeparture||preferences.start||null,latestDeparture:preferences.latestDeparture||preferences.end||null,durationDays:preferences.durationDays||preferences.nights||null,totalTripBudgetCny:preferences.totalTripBudgetCny||null,flightBudgetCny:preferences.flightBudgetCny||preferences.flightBudget||null,hotelBudgetPerNightCny:preferences.hotelBudgetPerNightCny||preferences.hotelBudget||null,minimumHotelRating:preferences.minimumHotelRating||preferences.rating||null,travelIntents:[...(preferences.travelIntents||[])].sort(),domesticAllowed:preferences.domesticAllowed??null,internationalAllowed:preferences.internationalAllowed??null,hard:preferences.constraints?.hard||{},strong:preferences.constraints?.strong||{},spendingOrientation:preferences.spendingOrientation||'value'};
 return JSON.stringify(stableValue(meaningful));
}
export class DestinationRecommendationSession {
 constructor({seed=0}={}){this.seed=seed;this.pools=new Map();this.pages=new Map();}
 persist(key,candidates,preferences={}){if(!this.pools.has(key))this.pools.set(key,rerankDestinations(candidates,{travelIntents:preferences.travelIntents||[],seed:this.seed,limit:candidates.length}));return this.pools.get(key);}
 page(key,candidates,preferences={},limit=3,{advance=false}={}){const pool=this.persist(key,candidates,preferences),pageCount=Math.max(1,Math.ceil(pool.length/limit)),current=this.pages.get(key)||0,next=advance?(current+1)%pageCount:current;this.pages.set(key,next);const start=next*limit;return pool.slice(start,start+limit);}
 select(candidates,preferences={},limit=3,{key=null}={}){return this.page(key||preferences.requestKey||'default',candidates,preferences,limit,{advance:false});}
 next(key,candidates,preferences={},limit=3){return this.page(key,candidates,preferences,limit,{advance:true});}
 reset(key=null){if(key){this.pools.delete(key);this.pages.delete(key);}else{this.pools.clear();this.pages.clear();}}
}
const safeCandidates=value=>{
  if(!Array.isArray(value)) throw new Error('Destination discovery returned no candidates.');
  const seen=new Set(),result=[];
  for(const candidate of value){const city=typeof candidate?.city==='string'?candidate.city.trim():'',entity=getDestination(city),country=entity?.countryNames.en||candidate?.countryOrRegion?.trim()||'';if(!city||!country||seen.has(city.toLowerCase()))continue;seen.add(city.toLowerCase());result.push({id:entity?.id||destinationIdentity(candidate).key,city:entity?.canonicalName||city,countryOrRegion:country,iataOrMetroCode:entity?.directAirportCode||candidate.iataOrMetroCode||null,entityType:entity?.entityType||'city',sceneryCategory:entity?.sceneryCategory||'urban',themes:entity?.destinationTraits|| (Array.isArray(candidate.themes)?[...new Set(candidate.themes)]:[]),seasonalReasons:Array.isArray(candidate.seasonalReasons)?candidate.seasonalReasons.slice(0,4):[],generalReasons:Array.isArray(candidate.generalReasons)?candidate.generalReasons.slice(0,4):[],estimatedFitSignals:Array.isArray(candidate.estimatedFitSignals)?candidate.estimatedFitSignals.slice(0,4):[],sourceType:candidate.sourceType,confidence:candidate.confidence});}
  if(!result.length) throw new Error('Destination discovery returned no usable cities.');return result.slice(0,80);
};
export class DestinationDiscoveryService { async discover(){throw new Error('Implement DestinationDiscoveryService.discover(preferences, context).');} }
export class LLMDestinationDiscoveryService extends DestinationDiscoveryService {
  constructor({fetchImpl=globalThis.fetch,endpoint='/api/travel/destinations/discover',timeoutMs=25000}={}){super();this.fetchImpl=fetchImpl?.bind(globalThis);this.endpoint=endpoint;this.timeoutMs=timeoutMs;}
  async discover(preferences,context){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);try{const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({preferences,context})});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error?.message||'AI destination discovery is unavailable.');return {...payload,candidates:safeCandidates(payload.candidates)};}finally{clearTimeout(timer);}}
}
export class DemoDestinationDiscoveryService extends DestinationDiscoveryService {
  async discover(preferences,context){const explicit=new Set(preferences.travelIntents||[]),inferred=new Set(context.inferredTravelIntents||[]),geography=preferences.geographyPreference|| (preferences.domesticAllowed===false?'international':preferences.internationalAllowed===false?'domestic':'all');
   const pool=DESTINATION_UNIVERSE.filter(item=>item.id!==keyOf({city:preferences.origin})&&(geography==='all'||(geography==='domestic')===isDomestic(item,preferences.origin))).map(item=>({id:item.id,city:item.canonicalName,countryOrRegion:item.countryNames.en,iataOrMetroCode:item.directAirportCode,entityType:item.entityType,sceneryCategory:item.sceneryCategory,themes:item.destinationTraits,seasonalReasons:[],generalReasons:[],estimatedFitSignals:[],sourceType:'general_prior',confidence:'medium',score:30+item.destinationTraits.filter(x=>explicit.has(x)).length*14+item.destinationTraits.filter(x=>inferred.has(x)).length*3+(item.discoveryTier==='long_tail'?4:0)}));
   const chosen=rerankDestinations(pool,{travelIntents:[...explicit],limit:80});
   return {source:'general_prior_fallback',parserStatus:'fallback',candidatePoolSize:chosen.length,candidates:chosen.map(({score,...candidate})=>candidate)};}
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
  const explicit=preferences.travelIntents||[],inferred=(context.inferredTravelIntents||[]).filter(theme=>!explicit.includes(theme)),entity=getDestination(candidate),originAccess=evaluateOriginAccess(preferences.origin,entity,{durationDays:preferences.durationDays,constraints:preferences.constraints,totalTripBudgetCny:preferences.totalTripBudgetCny,flightBudgetCny:preferences.flightBudgetCny,getDestination});let score=20+originAccess.scoreAdjustment;
  score+=explicit.length?Math.min(40,overlaps(candidate.themes,explicit)*40/explicit.length):0;
  score+=Math.min(18,overlaps(candidate.themes,inferred)*6);
  if(preferences.durationDays&&preferences.durationDays<=3&&(candidate.access?.railAccess.hub||candidate.access?.selfDriveAccess.suitable))score+=6;
  if(entity?.discoveryTier==='long_tail')score+=8;
  if((preferences.spendingOrientation||'value')==='value'&&preferences.totalTripBudgetCny==null&&preferences.flightBudgetCny==null)score+=({1:6,2:3,3:0}[originAccess.costLevel]||0);
  score+=Math.min(2,popularity.score||0);
  if(verification.status==='verified'){score+=10;if(verification.quote.stops===0)score+=5;if(preferences.flightBudgetCny!=null)score+=verification.quote.price<=preferences.flightBudgetCny?10:-10;else if(preferences.totalTripBudgetCny!=null&&verification.quote.price<preferences.totalTripBudgetCny)score+=5;}
  const strong=preferences.constraints?.strong||{},soft=preferences.constraints?.soft||{};
  if(verification.status==='verified'){if(strong.directFlightPreferred)score+=verification.quote.stops===0?16:-12;if(strong.avoidOvernightFlightsPreferred)score+=isOvernightFlight(verification.quote)?-16:16;}
  if(strong.seasidePreferred)score+=candidate.themes.includes('beach')?12:-6;
  if(strong.mountainPreferred||strong.naturePreferred)score+=candidate.themes.includes('nature')?10:-5;
  for(const [key,theme] of [['localFood','food'],['architecture','architecture'],['shopping','shopping'],['culture','culture'],['nature','nature'],['relaxation','relaxation'],['family','family'],['romantic','romantic']])if(soft[key])score+=candidate.themes.includes(theme)?Math.min(7,soft[key]*3.5):-2;
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
  if(candidate.accessEvaluation?.explicitGeographicFit)reasons.push(say('符合你明确提出的旅行地域','Matches your requested travel region'));
  else if(candidate.accessEvaluation?.distanceBand==='same_country'||candidate.accessEvaluation?.distanceBand==='same_region')reasons.push(say('出发负担相对较低','Relatively practical from your origin'));
  if((preferences.spendingOrientation||'value')==='value'&&candidate.accessEvaluation?.costLevel===1)reasons.push(say('当地消费层级更适合性价比比较','Local cost profile supports a value-focused plan'));
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
  const filtered=allCandidates.map(candidate=>({...candidate,access:accessResolver.resolve(candidate)})).filter(candidate=>{const domestic=isDomestic(candidate,preferences.origin),hard=preferences.constraints?.hard||{},required=hard.transportModeRequired,transport=required?transportAvailability({status:'not_checked',source:mode},{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints}):null;return candidate.city.toLowerCase()!==String(preferences.origin||'').toLowerCase()&&!isExcludedDestination(hard,candidate.city,candidate.countryOrRegion)&&(!required||transport?.[required]?.suitability!=='not_applicable')&&(hard.geography==null||(hard.geography==='domestic')===domestic)&&(geographyPreference==='all'||(geographyPreference==='domestic')===domestic);});
  const candidates=filtered.slice(0,80),provider=flightProvider||createTravelProviders(mode).flights;
  const preliminary=candidates.map(candidate=>{const pending={status:'not_checked',source:mode},popularity=popularityProvider.getSignal(candidate),transport=transportAvailability(pending,{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints}),accessEvaluation=evaluateOriginAccess(preferences.origin,getDestination(candidate),{durationDays:preferences.durationDays,constraints:preferences.constraints,totalTripBudgetCny:preferences.totalTripBudgetCny,flightBudgetCny:preferences.flightBudgetCny,getDestination});return {...candidate,accessEvaluation,score:scoreCandidate(candidate,preferences,context,pending,popularity,transport)};});
  const verificationCandidates=mode==='live'?rerankDestinations(preliminary.filter(candidate=>candidate.access.flightAccess.providerLookup),{travelIntents:preferences.travelIntents,recentIds,seed,limit:8}):preliminary;
  const verifyIds=new Set(verificationCandidates.map(candidate=>candidate.id));
  const ranked=await Promise.all(candidates.map(async candidate=>{const verification=verifyIds.has(candidate.id)?await verifyFlights(candidate,preferences,windows,provider,mode):{status:'not_checked',source:mode,reason:'Flight verification is pending.'},popularity=popularityProvider.getSignal(candidate),transport=transportAvailability(verification,{origin:preferences.origin,destination:candidate.city,countryOrRegion:candidate.countryOrRegion,durationDays:preferences.durationDays,constraints:preferences.constraints}),accessEvaluation=evaluateOriginAccess(preferences.origin,getDestination(candidate),{durationDays:preferences.durationDays,constraints:preferences.constraints,totalTripBudgetCny:preferences.totalTripBudgetCny,flightBudgetCny:preferences.flightBudgetCny,getDestination}),score=scoreCandidate(candidate,preferences,context,verification,popularity,transport),withAccess={...candidate,accessEvaluation};return {...withAccess,identity:destinationIdentity(candidate),verification,transport,popularity,score,fitLabel:score>=75?'strong_fit':score>=55?'good_fit':'possible_fit',reasons:explanation(withAccess,preferences,context,verification,popularity)};}));
  const requestKey=destinationRequestKey(preferences,mode);
  return {...discovery,requestKey,context,dateWindows:windows,geographyPreference,candidatePoolSize:candidates.length,universeSupplemented:supplement.length>0,displayPreferences:{travelIntents:[...(preferences.travelIntents||[])],spendingOrientation:preferences.spendingOrientation||'value',requestKey},candidates:rerankDestinations(ranked,{travelIntents:preferences.travelIntents,recentIds,seed})};
}
