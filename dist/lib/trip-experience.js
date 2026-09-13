import {createTripRequest} from './trip-request.js';
import {destinationIdentity} from './discovery/destination-identity.js';
import {planTransportOptions} from './discovery/transport-planner.js';

const area=(key,zh,en)=>({key,labels:{zh,en}});
export class StayRecommendation {recommend(){throw new Error('Implement StayRecommendation.recommend(trip).');}}
export class PlanningStayRecommendation extends StayRecommendation {
 recommend(trip){const identity=destinationIdentity(trip.destination),{strong={},soft={}}=trip.constraints||{};
  const choices=[];
  if(strong.seasidePreferred||identity.fallbackCategory==='coastal'||identity.fallbackCategory==='tropical')choices.push(area('coastal','海边区域','A coastal area'));
  if(strong.mountainPreferred||identity.fallbackCategory==='mountain')choices.push(area('scenic','景观区域','A scenic area'));
  if(soft.quietAreas||trip.constraints?.pace==='relaxed')choices.push(area('quiet','安静街区','A quieter neighborhood'));
  if(strong.centralLocationPreferred)choices.push(area('central','市中心','A central area'));
  if(strong.convenientTransportPreferred||choices.length<2)choices.push(area('transit','交通便利区域','An area near transit'));
  if(!choices.length)choices.push(area('central','市中心','A central area'));
  return {status:'planning_guidance',areas:[...new Map(choices.map(item=>[item.key,item])).values()].slice(0,3),inventoryStatus:'not_yet_live',hotelName:null,price:null,rating:null,availability:null};
 }
}

const themeCopy={food:['探索当地风味','Explore local food'],culture:['安排文化漫步','Explore culture at an easy pace'],nature:['留给自然风景','Spend time with nature'],beach:['在海边放松','Relax by the coast'],hiking:['安排适合体力的徒步','Plan a suitable hike'],shopping:['逛一逛本地街区','Browse local neighborhoods'],relaxation:['放慢脚步','Take a slower day'],photography:['寻找适合拍摄的风景','Make room for photography'],nightlife:['体验夜间氛围','Explore the evening atmosphere']};
export class ItineraryPlanner {plan(){throw new Error('Implement ItineraryPlanner.plan(trip,stay).');}}
export class PlanningItinerary extends ItineraryPlanner {
 plan(trip,stay,plan=null){const nights=Number.isInteger(trip.nights)&&trip.nights>0?trip.nights:5,days=Math.min(15,nights),soft=trip.constraints?.soft||{},intents=trip.travelIntents||[];
  const themes=[...new Set([...intents,...Object.entries(soft).filter(([,value])=>value>0).map(([key])=>key)])].filter(key=>themeCopy[key]);
  if(!themes.length)themes.push('culture','food','nature');
  const relaxed=trip.constraints?.pace==='relaxed'||soft.slowTravel>0;
  const schedule=Array.from({length:days},(_,index)=>({day:index+1,theme:index===0?'arrival':index===days-1?'departure':themes[(index-1)%themes.length],
   labels:index===0?{zh:'抵达后熟悉周边',en:'Arrive and get oriented'}:index===days-1?{zh:'从容返程',en:'Depart at an easy pace'}:{zh:`${themeCopy[themes[(index-1)%themes.length]][0]}${relaxed?'，留些自由时间':''}`,en:`${themeCopy[themes[(index-1)%themes.length]][1]}${relaxed?', with free time':''}`}}));
  const strong=trip.constraints?.strong||{},transportPreference=trip.constraints?.hard?.transportModeRequired||strong.trainPreferred&&'train'||strong.selfDrivePreferred&&'self_drive'||strong.flightPreferred&&'flight'||null;
  return {status:'planning_guidance',days:schedule,pace:trip.constraints?.pace||null,transportPreference,transportPreferenceStrength:trip.constraints?.hard?.transportModeRequired?'hard':transportPreference?'strong':null,
   departureWindow:plan?.context?.dateDescription||null,representativeDeparture:plan?.windows?.[0]?.departure||null,dateSource:plan?.dateSource||null,
   stayAreaKeys:stay.areas.map(item=>item.key),confirmedBookings:false};
 }
}

export function buildTripExperience({trip,plan=null,candidate=null,flightVerification={status:'not_checked',source:null},stayProvider=new PlanningStayRecommendation(),itineraryPlanner=new PlanningItinerary()}){
 const request=createTripRequest({...trip,destination:trip.destination||candidate?.city||null});
 if(!request.destination)throw new Error('Select a destination before planning a stay or itinerary.');
 const nights=plan?.nights||request.nights||5,context={...request,nights};
 const transport=planTransportOptions({origin:context.origin,destination:context.destination,countryOrRegion:candidate?.countryOrRegion,durationDays:nights,constraints:context.constraints,flightVerification});
 const stay=stayProvider.recommend(context),itinerary=itineraryPlanner.plan(context,stay,plan);
 return {trip:context,plan,transport,stay,itinerary,flightVerification,access:candidate?.access||null};
}
