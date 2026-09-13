import {PREFERENCE_OUTPUT_SCHEMA,TRAVEL_INTENTS} from './preference-schema.js';

const expectedKeys = new Set(PREFERENCE_OUTPUT_SCHEMA.required);
const places = new Map([
  ['shanghai','Shanghai'],['上海','Shanghai'],['tokyo','Tokyo'],['东京','Tokyo'],['東京','Tokyo'],
  ['beijing','Beijing'],['北京','Beijing'],['guangzhou','Guangzhou'],['广州','Guangzhou'],
  ['shenzhen','Shenzhen'],['深圳','Shenzhen'],['chengdu','Chengdu'],['成都','Chengdu'],
  ['chongqing','Chongqing'],['重庆','Chongqing'],['changsha','Changsha'],['长沙','Changsha'],
  ['xiamen','Xiamen'],['厦门','Xiamen'],['sanya','Sanya'],['三亚','Sanya'],
  ['kunming','Kunming'],['昆明','Kunming'],['dali','Dali'],['大理','Dali'],
  ['lijiang','Lijiang'],['丽江','Lijiang'],['guilin','Guilin'],['桂林','Guilin'],
  ["xi'an","Xi'an"],['西安',"Xi'an"],['hangzhou','Hangzhou'],['杭州','Hangzhou'],
  ['nanjing','Nanjing'],['南京','Nanjing'],['qingdao','Qingdao'],['青岛','Qingdao'],
  ['harbin','Harbin'],['哈尔滨','Harbin'],
  ['hong kong','Hong Kong'],['香港','Hong Kong'],['osaka','Osaka'],['大阪','Osaka'],
  ['seoul','Seoul'],['首尔','Seoul'],['singapore','Singapore'],['新加坡','Singapore'],
  ['bangkok','Bangkok'],['曼谷','Bangkok'],['london','London'],['伦敦','London'],['倫敦','London'],
  ['paris','Paris'],['巴黎','Paris']
]);
const themeDestination = /^(?:a |an |the )?(?:beach|somewhere(?: .*)?|someplace(?: .*)?|christmas|festive|(?:warm|cold|snowy|nice|fun|romantic|family-friendly) (?:place|city|destination)|place to hike|hiking|nature|snow|winter destination)$|^(?:海边|海灘|海滩|沙滩|某个地方|一个地方|温暖的地方|暖和的地方|圣诞(?:氛围)?(?:很浓)?的地方|适合徒步的地方)$/iu;
const compact = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const clean = value => typeof value==='string' && value.trim() ? value.trim().slice(0,120) : null;
const knownPlace = value => places.get(String(value ?? '').normalize('NFKC').trim().toLowerCase()) || null;
const canonicalPlace = value => knownPlace(value) || clean(value);
const isoDate = value => {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed=new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value ? value : null;
};
const finite = (value,min,max,integer=false) => typeof value==='number' && Number.isFinite(value) && value>=min && value<=max && (!integer || Number.isInteger(value)) ? value : null;
const groundedPlace = (value,evidence,input) => {
  const place=canonicalPlace(value),quote=clean(evidence);
  if (!place || !quote || themeDestination.test(quote) || !compact(input).includes(compact(quote))) return null;
  const evidencePlace=canonicalPlace(quote),knownValue=knownPlace(value),knownEvidence=knownPlace(quote);
  if (knownValue && knownEvidence) return knownValue===knownEvidence ? knownValue : null;
  if (compact(place)===compact(evidencePlace) || compact(quote).includes(compact(place)) || compact(place).includes(compact(quote))) return place;
  // Preserve unmatched multilingual evidence rather than accepting the model's translated/invented place.
  return quote;
};

export class InvalidPreferenceOutputError extends Error {
  constructor(message='The AI preference response was incomplete or invalid.') {
    super(message); this.name='InvalidPreferenceOutputError'; this.code='PREFERENCE_OUTPUT_INVALID'; this.status=502;
  }
}

export function normalizePreferenceOutput(value,input) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!expectedKeys.has(key)) || [...expectedKeys].some(key=>!(key in value)))
    throw new InvalidPreferenceOutputError();
  const nullableString=key=>value[key]===null || typeof value[key]==='string';
  const nullableNumber=key=>value[key]===null || typeof value[key]==='number';
  const nullableBoolean=key=>value[key]===null || typeof value[key]==='boolean';
  if (!['origin','originEvidence','destination','destinationEvidence','earliestDeparture','latestDeparture','departureWindowText'].every(nullableString) ||
    !['durationDays','totalTripBudgetCny','flightBudgetCny','hotelBudgetPerNightCny','minimumHotelRating'].every(nullableNumber) ||
    !['avoidOvernightFlights','domesticAllowed','internationalAllowed'].every(nullableBoolean) ||
    !['provided','discovery_required'].includes(value.destinationState) || !Array.isArray(value.travelIntents) || !Array.isArray(value.preferences) ||
    !(value.pace===null || ['relaxed','balanced','active'].includes(value.pace))) throw new InvalidPreferenceOutputError();
  const warnings=[];
  const origin=groundedPlace(value.origin,value.originEvidence,input);
  let destination=groundedPlace(value.destination,value.destinationEvidence,input);
  if (value.destination && !destination) warnings.push('The proposed destination was not grounded in a place named in your description, so it was cleared.');
  const earliestDeparture=isoDate(value.earliestDeparture),latestDeparture=isoDate(value.latestDeparture);
  const datesValid=earliestDeparture&&latestDeparture&&latestDeparture>=earliestDeparture&&
    (Date.parse(latestDeparture)-Date.parse(earliestDeparture))/86400000<=60;
  const departureWindowText=clean(value.departureWindowText);
  if (!datesValid && (value.earliestDeparture || value.latestDeparture)) warnings.push('The exact travel dates need confirmation and were not guessed.');
  if (departureWindowText && !datesValid) warnings.push(`Broad travel window captured: ${departureWindowText}. Any comparison dates are provisional and can be edited later.`);
  const travelIntents=[...new Set(Array.isArray(value.travelIntents)?value.travelIntents.filter(intent=>TRAVEL_INTENTS.includes(intent)):[])];
  const interpretation={
    origin,destination,destinationState:destination?'provided':'discovery_required',
    earliestDeparture:datesValid?earliestDeparture:null,latestDeparture:datesValid?latestDeparture:null,departureWindowText,
    durationDays:finite(value.durationDays,1,30,true),totalTripBudgetCny:finite(value.totalTripBudgetCny,1,300000),flightBudgetCny:finite(value.flightBudgetCny,1,100000),
    hotelBudgetPerNightCny:finite(value.hotelBudgetPerNightCny,1,100000),minimumHotelRating:finite(value.minimumHotelRating,1,5),
    avoidOvernightFlights:typeof value.avoidOvernightFlights==='boolean'?value.avoidOvernightFlights:null,
    travelIntents,domesticAllowed:typeof value.domesticAllowed==='boolean'?value.domesticAllowed:null,
    internationalAllowed:typeof value.internationalAllowed==='boolean'?value.internationalAllowed:null,
    pace:['relaxed','balanced','active'].includes(value.pace)?value.pace:null,
    preferences:Array.isArray(value.preferences)?value.preferences.filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim().slice(0,120)).slice(0,10):[]
  };
  const required={origin:'origin',destination:'destination',earliestDeparture:'earliest departure',latestDeparture:'latest departure',durationDays:'trip duration',flightBudgetCny:'flight budget',hotelBudgetPerNightCny:'hotel budget per night',minimumHotelRating:'minimum hotel rating'};
  const needsConfirmation=Object.entries(required).filter(([key])=>interpretation[key]==null).map(([key])=>key);
  return {interpretation,needsConfirmation,warnings};
}
