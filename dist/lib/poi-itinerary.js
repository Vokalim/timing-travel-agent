const paceLimits={relaxed:2,balanced:3,intensive:5,deep_dive:3};
const startMinutes={relaxed:600,balanced:570,intensive:540,deep_dive:570};
const visitMinutes={relaxed:105,balanced:90,intensive:70,deep_dive:120};
const breakMinutes={relaxed:75,balanced:55,intensive:35,deep_dive:65};
const pad=n=>String(n).padStart(2,'0');
const clock=minutes=>`${pad(Math.floor(minutes/60))}:${pad(minutes%60)}`;
const unique=items=>[...new Map(items.filter(item=>item?.id).map(item=>[item.id,item])).values()];
const affinity=(place,intents,soft)=>intents.includes(place.category)?5:soft.localFood&&place.category==='food'?4:soft.photography&&place.category==='photography'?4:soft.nature&&place.category==='nature'?4:0;
const routeMinutes=(matrix,from,to)=>matrix?.[from]?.[to]?.durationMinutes??matrix?.[`${from}|${to}`]?.durationMinutes??null;
const routeDistance=(matrix,from,to)=>matrix?.[from]?.[to]?.distanceMeters??matrix?.[`${from}|${to}`]?.distanceMeters??null;
const afterLunch=(start,length)=>start<13*60+30&&start+length>12*60?13*60+30:start;

export function placeOpenAt(place,dayDate,start,end){
 const hours=place.openingHours;if(!hours)return null;
 const weekday=dayDate?new Date(`${dayDate}T00:00:00Z`).getUTCDay():null;
 const windows=Array.isArray(hours)?hours:weekday==null?null:hours[weekday];
 if(!Array.isArray(windows))return null;
 return windows.some(window=>{const open=window.openMinutes??(window.open?Number(window.open.slice(0,2))*60+Number(window.open.slice(3,5)):null),close=window.closeMinutes??(window.close?Number(window.close.slice(0,2))*60+Number(window.close.slice(3,5)):null);return open!=null&&close!=null&&start>=open&&end<=close;});
}

export function buildPoiItinerary({places=[],nights=5,pace='balanced',intents=[],soft={},dates=[],routeMatrix=null,stayAreaKeys=[]}={}){
 const validPace=paceLimits[pace]?pace:'balanced',pool=unique(places),days=[],used=new Set();
 const fraction={relaxed:.65,balanced:.85,intensive:1,deep_dive:.75}[validPace];
 const targetTotal=nights===1?pool.length:Math.max(0,Math.round(pool.length*fraction));
 const focus=validPace==='deep_dive'?[...new Set(intents.filter(intent=>pool.some(place=>place.category===intent)))].slice(0,1):[];
 for(let index=0;index<Math.min(15,Math.max(1,nights));index++){
  const date=dates[index]||null,remainingDays=Math.min(15,Math.max(1,nights))-index;
  const limit=Math.min(paceLimits[validPace],Math.ceil((targetTotal-used.size)/remainingDays)),activities=[];let minute=startMinutes[validPace],previous=null;
  while(activities.length<limit){
   const ranked=pool.filter(place=>!used.has(place.id)).map(place=>{
    const travel=previous?routeMinutes(routeMatrix,previous.id,place.id):null;
    const distance=previous?routeDistance(routeMatrix,previous.id,place.id):null;
    const areaBonus=previous?.areaKey===place.areaKey?3:stayAreaKeys.includes(place.areaKey)?1:0;
    const focusBonus=focus.includes(place.category)?8:0;
    const score=affinity(place,intents,soft)+focusBonus+areaBonus-(travel==null?0:travel/35)-(distance==null?0:distance/6000);
    return {place,travel,score};
   }).sort((a,b)=>b.score-a.score||a.place.id.localeCompare(b.place.id));
   const selected=ranked.find(({place,travel})=>{
    const maxLeg={relaxed:40,balanced:65,intensive:100,deep_dive:55}[validPace];
    if(travel!=null&&travel>maxLeg)return false;
    const start=afterLunch(minute+(travel??0),visitMinutes[validPace]),end=start+visitMinutes[validPace];
    return end<=19*60&&placeOpenAt(place,date,start,end)!==false;
   });
   if(!selected)break;
   const {place,travel}=selected;minute=afterLunch(minute+(travel??0),visitMinutes[validPace]);const start=minute,end=start+visitMinutes[validPace];
   activities.push({id:`day-${index+1}-${place.id}`,placeId:place.id,place,startTime:clock(start),endTime:clock(end),openingHoursState:placeOpenAt(place,date,start,end)===null?'unverified':'checked',routeState:travel==null?'unverified':'verified',travelMinutes:travel,travelDistanceMeters:previous?routeDistance(routeMatrix,previous.id,place.id):null});
   used.add(place.id);previous=place;minute=end+breakMinutes[validPace];
  }
  const dominantArea=activities.length?activities.reduce((counts,activity)=>(counts[activity.place.areaKey]=(counts[activity.place.areaKey]||0)+1,counts),{}):{};
  const areaKey=Object.entries(dominantArea).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const legs=activities.slice(1),verified=legs.length>0&&legs.every(activity=>activity.travelMinutes!=null&&activity.travelDistanceMeters!=null);
  days.push({day:index+1,date,theme:focus[0]||activities[0]?.place.category||'flexible',areaKey,activities,
    labels:activities.length?{zh:`${activities[0].place.names.zh}及周边`,en:`${activities[0].place.names.en} and nearby`}:{zh:'自由安排 · 地点待核验',en:'Flexible day · places not yet verified'},
    routeState:verified?'verified':'unverified',routeDistanceMeters:verified?legs.reduce((sum,activity)=>sum+activity.travelDistanceMeters,0):null,routeDurationMinutes:verified?legs.reduce((sum,activity)=>sum+activity.travelMinutes,0):null});
 }
 return {status:pool.length?'place_identity_only':'places_unavailable',days,pace:validPace,placeSource:pool.length?pool[0].source:null,availablePlaces:pool};
}

export function replaceDayActivity(itinerary,dayNumber,activityId,replacement=null){
 return {...itinerary,days:itinerary.days.map(day=>day.day!==dayNumber?day:{...day,activities:replacement?day.activities.map(activity=>activity.id===activityId?replacement:activity):day.activities.filter(activity=>activity.id!==activityId),routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null})};
}
