import {destinationIdentity} from './destination-identity.js';

export const TRANSPORT_MODES=Object.freeze(['flight','train','self_drive']);
const nearPairs=new Set(['shanghai|hangzhou','shanghai|nanjing','hangzhou|nanjing','chengdu|chongqing','guangzhou|shenzhen','beijing|tianjin','shenzhen|hong_kong','guangzhou|hong_kong'].map(value=>value.split('|').sort().join('|')));
const regionalPairs=new Set(['shanghai|qingdao','shanghai|xiamen','beijing|qingdao','guangzhou|changsha','chengdu|kunming','chongqing|kunming','hangzhou|xiamen'].map(value=>value.split('|').sort().join('|')));
const pair=(a,b)=>[a,b].sort().join('|');
const byScore=(a,b)=>b.suitabilityScore-a.suitabilityScore||TRANSPORT_MODES.indexOf(a.mode)-TRANSPORT_MODES.indexOf(b.mode);

/** TransportOption is suitability plus independent verification. Unknown fares and times are null. */
export function planTransportOptions({origin,destination,countryOrRegion,durationDays=null,constraints={},flightVerification={status:'not_checked'},spendingOrientation='value'}){
 const from=destinationIdentity(origin),to=destinationIdentity({city:destination,countryOrRegion}),country=countryOrRegion||to.countryNames.en;
 const domestic=country==='China'&&from.countryNames.en==='China';
 const crossBorderRail=pair(from.key,to.key)==='hong_kong|shenzhen'||pair(from.key,to.key)==='guangzhou|hong_kong';
 const near=nearPairs.has(pair(from.key,to.key)),regional=regionalPairs.has(pair(from.key,to.key));
 const scenic=['mountain','coastal','tropical'].includes(to.fallbackCategory),shortTrip=durationDays!=null&&durationDays<=3;
 const hard=constraints.hard||{},strong=constraints.strong||{};
 const required=hard.transportModeRequired||null;
 let scores=domestic?near?{flight:44,train:82,self_drive:scenic?71:59}:regional?{flight:69,train:66,self_drive:scenic?56:43}:{flight:79,train:48,self_drive:scenic?43:25}:crossBorderRail?{flight:62,train:77,self_drive:40}:{flight:85,train:8,self_drive:5};
 if(shortTrip&&near){scores.train+=6;scores.self_drive+=5;scores.flight-=6;}
 if(scenic&&domestic)scores.self_drive+=8;
 // Preference boosts stay below the score ceiling so route suitability still
 // differentiates otherwise similar destinations.
 if(strong.trainPreferred)scores.train+=12;
 if(strong.selfDrivePreferred)scores.self_drive+=12;
 if(strong.flightPreferred)scores.flight+=12;
 if(strong.fewerTransfersPreferred){scores.train+=near?6:0;scores.flight+=flightVerification.quote?.stops===0?6:0;}
 if(flightVerification.status==='verified')scores.flight+=8;
 if(spendingOrientation==='comfort'){scores.flight+=flightVerification.quote?.stops===0?8:2;scores.train+=near||regional?7:0;scores.self_drive-=4;}
 else {scores.train+=near?8:regional?4:0;scores.flight+=flightVerification.quote?.stops===0?3:0;scores.self_drive+=near&&scenic?4:0;}
 const options=TRANSPORT_MODES.map(mode=>{
  const applicable=mode==='flight'||domestic||mode==='train'&&crossBorderRail;
  const verification=mode==='flight'?{...flightVerification,status:flightVerification.status,source:flightVerification.source||null}: {status:applicable?'not_yet_live':'not_applicable',source:null};
  const quote=mode==='flight'&&flightVerification.status==='verified'?flightVerification.quote:null;
  const costBand=mode==='flight'?'high':mode==='train'?(near?'low':regional?'medium':'high'):(near?'medium':'high');
  const durationBand=mode==='flight'?(domestic&&near?'medium':'short'):mode==='train'?(near?'short':regional?'medium':'long'):(near?'medium':'long');
  return {mode,suitabilityScore:required&&mode!==required?0:applicable?Math.max(0,Math.min(100,scores[mode])):0,
   suitability:!applicable?'not_applicable':scores[mode]>=75?'high':scores[mode]>=50?'medium':'low',
   allowed:!required||required===mode,verification,
   price:quote?.price??null,currency:quote?.currency??null,quote,schedule:null,drivingTimeMinutes:null,
   referenceLevel:quote?'verified':'unknown',costBand:applicable?costBand:null,durationBand:applicable?durationBand:null,
   source:quote?.provider||quote?.source||null};
 }).sort(byScore);
 return {options,preferredMode:options.find(option=>option.allowed&&option.suitability!=='not_applicable')?.mode||null,requiredMode:required};
}
