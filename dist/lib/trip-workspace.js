import {prepareExploration} from './planning-service.js';
import {buildTripExperience} from './trip-experience.js';
import {replaceDayActivity} from './poi-itinerary.js';

const iso=date=>date.toISOString().slice(0,10);
const plus=(value,days)=>iso(new Date(Date.parse(`${value}T00:00:00Z`)+days*86400000));
export function revisedTripDates(trip,window,selection,{departure,returnDate}={}){
 if(!window?.departure)throw new Error('No current exploration window.');
 if(selection==='month')return {...trip,start:null,end:null,departureWindowText:window.departure.slice(0,7)};
 if(selection==='custom'){
  if(!/^\d{4}-\d\d-\d\d$/.test(departure||'')||!/^\d{4}-\d\d-\d\d$/.test(returnDate||''))throw new Error('Choose valid departure and return dates.');
  const nights=Math.round((Date.parse(`${returnDate}T00:00:00Z`)-Date.parse(`${departure}T00:00:00Z`))/86400000);
  if(nights<1||nights>30)throw new Error('Return must be 1–30 nights after departure.');
  return {...trip,start:departure,end:departure,nights,departureWindowText:''};
 }
 const offset=Number(selection);if(![3,7].includes(offset))throw new Error('Unknown date selection.');
 return {...trip,start:plus(window.departure,-offset),end:plus(window.departure,offset),departureWindowText:''};
}

export class TripWorkspaceSession {
 constructor({trip,plan=null,candidate=null,flightVerification={status:'not_checked',source:null},pace=null}={}){
  this.trip=trip;this.plan=plan||prepareExploration(trip);this.candidate=candidate;this.flightVerification=flightVerification;
  this.pace=pace||trip.constraints?.pace||'balanced';this.experience=this.build();
 }
 build(itineraryOverride=null){return buildTripExperience({trip:this.trip,plan:this.plan,candidate:this.candidate,flightVerification:this.flightVerification,pace:this.pace,itineraryOverride});}
 changePace(pace){if(!['relaxed','balanced','intensive','deep_dive'].includes(pace))throw new Error('Unknown travel pace.');this.pace=pace;this.experience=this.build();return this.experience;}
 changeDuration(nights){if(!Number.isInteger(nights)||nights<1||nights>30)throw new Error('Choose 1–30 nights.');this.trip={...this.trip,nights};this.plan=prepareExploration(this.trip);this.flightVerification={status:'not_checked',source:this.flightVerification.source};this.experience=this.build();return this.experience;}
 changeDates(selection,custom){this.trip=revisedTripDates(this.trip,this.plan.windows[0],selection,custom);this.plan=prepareExploration(this.trip);this.flightVerification={status:'not_checked',source:this.flightVerification.source};this.experience=this.build();return this.experience;}
 removeActivity(day,activityId){this.experience={...this.experience,itinerary:replaceDayActivity(this.experience.itinerary,day,activityId)};return this.experience;}
 swapActivity(day,activityId){const old=this.experience.itinerary.days.find(item=>item.day===day)?.activities.find(item=>item.id===activityId);if(!old)return this.experience;
  const used=new Set(this.experience.itinerary.days.flatMap(item=>item.activities.map(activity=>activity.placeId)));
  const alternative=this.experience.itinerary.availablePlaces.find(place=>!used.has(place.id)&&(place.areaKey===old.place.areaKey||place.category===old.place.category))||this.experience.itinerary.availablePlaces.find(place=>!used.has(place.id));
  if(!alternative)return this.experience;
  this.experience={...this.experience,itinerary:replaceDayActivity(this.experience.itinerary,day,activityId,{...old,id:`day-${day}-${alternative.id}`,placeId:alternative.id,place:alternative,openingHoursState:'unverified',routeState:'unverified',travelMinutes:null})};return this.experience;
 }
 addWish(day,name){const trimmed=String(name||'').trim();if(!trimmed)return this.experience;const id=`wish-${Date.now()}`;
  this.experience={...this.experience,itinerary:{...this.experience.itinerary,days:this.experience.itinerary.days.map(item=>item.day!==day?item:{...item,activities:[...item.activities,{id,placeId:id,place:{id,names:{zh:trimmed,en:trimmed},areaKey:null,category:'wish',source:'user',openingHours:null},startTime:'--:--',endTime:'--:--',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null}],routeState:'unverified'})}};
  return this.experience;
 }
 adjustDay(day){const item=this.experience.itinerary.days.find(entry=>entry.day===day);if(!item)return this.experience;const available=this.experience.itinerary.availablePlaces.find(place=>!this.experience.itinerary.days.some(d=>d.activities.some(activity=>activity.placeId===place.id)));
  if(item.activities.length&&available)return this.swapActivity(day,item.activities[0].id);
  if(item.activities.length>1){this.experience={...this.experience,itinerary:{...this.experience.itinerary,days:this.experience.itinerary.days.map(entry=>entry.day!==day?entry:{...entry,activities:entry.activities.map((activity,index)=>{const alternative=entry.activities[entry.activities.length-1-index];return {...activity,place:alternative.place,placeId:alternative.placeId,openingHoursState:'unverified',routeState:'unverified',travelMinutes:null,travelDistanceMeters:null};}),routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null})}};}
  return this.experience;
 }
}
