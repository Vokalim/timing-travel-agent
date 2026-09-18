import {prepareExploration} from './planning-service.js';
import {buildTripExperience} from './trip-experience.js';
import {replaceDayActivity,retimeDayItinerary} from './poi-itinerary.js';

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
 constructor({trip,plan=null,candidate=null,flightVerification={status:'not_checked',source:null},pace=null,spendingOrientation=null}={}){
  this.trip=trip;this.plan=plan||prepareExploration(trip);this.candidate=candidate;this.flightVerification=flightVerification;
  this.pace=pace||trip.constraints?.pace||'balanced';this.spendingOrientation=spendingOrientation||trip.spendingOrientation||'value';this.experience=this.build();
 }
 build(itineraryOverride=null){return buildTripExperience({trip:{...this.trip,spendingOrientation:this.spendingOrientation},plan:this.plan,candidate:this.candidate,flightVerification:this.flightVerification,pace:this.pace,spendingOrientation:this.spendingOrientation,itineraryOverride});}
 rebuildFromItinerary(itinerary){this.experience=this.build(itinerary);return this.experience;}
 changePace(pace){if(!['relaxed','balanced','intensive','deep_dive'].includes(pace))throw new Error('Unknown travel pace.');this.pace=pace;this.experience=this.build();return this.experience;}
 changeSpendingOrientation(value){if(!['value','comfort'].includes(value))throw new Error('Unknown spending orientation.');this.spendingOrientation=value;this.trip={...this.trip,spendingOrientation:value};this.experience=this.build();return this.experience;}
 changeDuration(nights){if(!Number.isInteger(nights)||nights<1||nights>30)throw new Error('Choose 1–30 nights.');this.trip={...this.trip,nights};this.plan=prepareExploration(this.trip);this.flightVerification={status:'not_checked',source:this.flightVerification.source};this.experience=this.build();return this.experience;}
 changeDates(selection,custom){this.trip=revisedTripDates(this.trip,this.plan.windows[0],selection,custom);this.plan=prepareExploration(this.trip);this.flightVerification={status:'not_checked',source:this.flightVerification.source};this.experience=this.build();return this.experience;}
 removeActivity(day,activityId){return this.rebuildFromItinerary(replaceDayActivity(this.experience.itinerary,day,activityId));}
 swapActivity(day,activityId){const old=this.experience.itinerary.days.find(item=>item.day===day)?.activities.find(item=>item.id===activityId);if(!old)return this.experience;
  const used=new Set(this.experience.itinerary.days.flatMap(item=>item.activities.map(activity=>activity.placeId)));
  const alternative=this.experience.itinerary.availablePlaces.find(place=>!used.has(place.id)&&(place.areaKey===old.place.areaKey||place.category===old.place.category))||this.experience.itinerary.availablePlaces.find(place=>!used.has(place.id));
  if(!alternative)return this.experience;
  return this.rebuildFromItinerary(replaceDayActivity(this.experience.itinerary,day,activityId,{...old,id:`day-${day}-${alternative.id}`,placeId:alternative.id,place:alternative,schedulePrecision:'approximate',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null}));
 }
 addWish(day,name){const trimmed=String(name||'').trim();if(!trimmed)return this.experience;const id=`wish-${day}-${this.experience.itinerary.days.flatMap(item=>item.activities).filter(activity=>activity.place.source==='user').length+1}`;
  const itinerary={...this.experience.itinerary,days:this.experience.itinerary.days.map(item=>item.day!==day?item:{...item,activities:[...item.activities,{id,placeId:id,place:{id,names:{zh:trimmed,en:trimmed},areaKey:null,category:'wish',source:'user',openingHours:null,coordinates:null},startTime:'--:--',endTime:'--:--',schedulePrecision:'unplanned',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null}],routeState:'unverified'})};
  return this.rebuildFromItinerary(itinerary);
 }
 adjustDay(day){const item=this.experience.itinerary.days.find(entry=>entry.day===day);if(!item)return this.experience;const available=this.experience.itinerary.availablePlaces.find(place=>!this.experience.itinerary.days.some(d=>d.activities.some(activity=>activity.placeId===place.id)));
  if(item.activities.length&&available)return this.swapActivity(day,item.activities[0].id);
  if(item.activities.length>1){const itinerary={...this.experience.itinerary,days:this.experience.itinerary.days.map(entry=>entry.day!==day?entry:{...entry,activities:entry.activities.map((activity,index)=>{const alternative=entry.activities[entry.activities.length-1-index];return {...activity,place:alternative.place,placeId:alternative.placeId,schedulePrecision:'approximate',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null,travelDistanceMeters:null};}),routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null})};return this.rebuildFromItinerary(itinerary);}
  return this.experience;
 }
 changeActivityTime(day,activityId,startTime,durationMinutes=null){return this.rebuildFromItinerary(retimeDayItinerary(this.experience.itinerary,day,activityId,startTime,{durationMinutes}));}
 applyItineraryInstruction(text){const instruction=String(text||'').trim();if(!instruction)return this.experience;
  const chineseDay=instruction.match(/第([一二三四五六七八九十\d]+)天/),englishDay=instruction.match(/day\s*(\d+)/i),digits={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  const dayNumber=englishDay?Number(englishDay[1]):chineseDay?Number(chineseDay[1])||digits[chineseDay[1]]||1:1;
  const day=this.experience.itinerary.days.find(item=>item.day===dayNumber)||this.experience.itinerary.days[0];if(!day)return this.experience;
  if(/晚一点|later/i.test(instruction)&&day.activities[0]){const [hour,minute]=day.activities[0].startTime.split(':').map(Number);return this.changeActivityTime(day.day,day.activities[0].id,`${String(Math.min(22,hour+1)).padStart(2,'0')}:${String(minute||0).padStart(2,'0')}`);}
  if(/轻松一点|lighter|more relaxed/i.test(instruction)){const itinerary={...this.experience.itinerary,days:this.experience.itinerary.days.map(item=>item.day!==day.day?item:{...item,activities:item.activities.slice(0,2),routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null})};return this.rebuildFromItinerary(itinerary);}
  const removal=instruction.match(/(?:不要|删除|remove|skip)\s*([^，,。.!]+)/i);if(removal){const term=removal[1].trim().toLowerCase(),activity=this.experience.itinerary.days.flatMap(item=>item.activities.map(activity=>({day:item.day,activity}))).find(({activity})=>Object.values(activity.place.names).some(name=>name.toLowerCase().includes(term)||term.includes(name.toLowerCase())));if(activity)return this.removeActivity(activity.day,activity.activity.id);}
  const addition=instruction.match(/(?:想加|加一个|加入|add)\s*([^，,。.!]+)/i);if(addition)return this.addWish(day.day,addition[1]);
  if(/半天购物|shopping/i.test(instruction))return this.addWish(day.day,instruction.match(/购物|shopping/i)?.[0]||'Shopping');
  return this.experience;
 }
}
