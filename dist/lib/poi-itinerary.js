const paceLimits={relaxed:2,balanced:3,intensive:5,deep_dive:3};
const startMinutes={relaxed:600,balanced:570,intensive:540,deep_dive:570};
const visitMinutes={relaxed:105,balanced:90,intensive:70,deep_dive:120};
const breakMinutes={relaxed:75,balanced:55,intensive:35,deep_dive:65};
const pad=n=>String(n).padStart(2,'0');
const clock=minutes=>`${pad(Math.floor(minutes/60))}:${pad(minutes%60)}`;
const minutesOf=value=>/^\d\d:\d\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3,5)):null;
const unique=items=>[...new Map(items.filter(item=>item?.id).map(item=>[item.id,item])).values()];
const preferenceTags=(intents,soft,text='')=>{const tags=new Set(intents),value=String(text).toLowerCase(),rules={art:/艺术|美术|art|gallery/,museum:/博物馆|museum/,architecture:/建筑|architecture|cathedral|temple/,food:/美食|当地特色|吃|food|cuisine|market/,shopping:/购物|shopping/,photography:/摄影|拍照|photography/,nature:/自然|山|海|公园|nature|mountain|beach/,nightlife:/夜生活|酒吧|nightlife/,relaxation:/放松|慢一点|relax|slow/,neighborhood:/街区|city walk|neighbou?rhood/};for(const [tag,pattern] of Object.entries(rules))if(pattern.test(value))tags.add(tag);if(soft.localFood)tags.add('food');if(soft.photography)tags.add('photography');if(soft.nature)tags.add('nature');if(soft.shopping)tags.add('shopping');if(soft.nightlife)tags.add('nightlife');if(soft.relaxation||soft.slowTravel)tags.add('relaxation');return [...tags];};
const sourceConfidence=place=>place.verificationState==='LIVE_VERIFIED'?5:place.verificationState==='OPEN_SOURCE_VERIFIED'?4:place.source==='curated'?2:1;
const affinity=(place,signals)=>{const tags=new Set([place.category,...(place.planningTags||[])]);return signals.reduce((score,signal)=>score+(tags.has(signal)?6:0),0)+sourceConfidence(place)+(Number(place.planningSignals?.destinationRepresentativeness)||0)*3;};
const coordinateDistanceKm=(from,to)=>{const a=from?.coordinates,b=to?.coordinates;if(!a||!b||a.coordinateSystem!==b.coordinateSystem)return null;const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180,dLat=lat2-lat1,dLon=((b.lng??b.lon)-(a.lng??a.lon))*Math.PI/180,h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.sqrt(h));};
const routeIdentity=place=>place?.providerPlaceId||place?.id;
const routeMinutes=(matrix,from,to)=>matrix?.[from]?.[to]?.durationMinutes??matrix?.[`${from}|${to}`]?.durationMinutes??null;
const routeDistance=(matrix,from,to)=>matrix?.[from]?.[to]?.distanceMeters??matrix?.[`${from}|${to}`]?.distanceMeters??null;
const afterLunch=(start,length)=>start<13*60+30&&start+length>12*60?13*60+30:start;
const planningTemplates=[
 {zh:'抵达与熟悉周边',en:'Arrival and neighborhood orientation',category:'culture',areaKey:'central'},
 {zh:'城市经典区域',en:'Core city area',category:'culture',areaKey:'central'},
 {zh:'当地风味时段',en:'Local food stop',category:'food',areaKey:'central'},
 {zh:'自然风景方向',en:'Nature and scenery',category:'nature',areaKey:'scenic'},
 {zh:'本地街区漫步',en:'Local neighborhood walk',category:'culture',areaKey:'local'},
 {zh:'自由探索与休息',en:'Flexible exploration and rest',category:'relaxation',areaKey:'local'}
];
const planningActivity=(day,slot,pace)=>{const template=planningTemplates[(day-1+slot)%planningTemplates.length],id=`plan-${day}-${slot+1}`,start=startMinutes[pace]+slot*(visitMinutes[pace]+breakMinutes[pace]);return {id,placeId:id,place:{id,names:{zh:template.zh,en:template.en},category:template.category,areaKey:template.areaKey,coordinates:null,openingHours:null,source:'planning_template'},startTime:clock(start),endTime:clock(start+visitMinutes[pace]),schedulePrecision:'approximate',openingHoursState:'unverified',routeState:'unverified',travelMinutes:null,travelDistanceMeters:null};};

export function placeOpenAt(place,dayDate,start,end){
 const hours=place.openingHours;if(!hours)return null;
 const weekday=dayDate?new Date(`${dayDate}T00:00:00Z`).getUTCDay():null;
 const windows=Array.isArray(hours)?hours:weekday==null?null:hours[weekday];
 if(!Array.isArray(windows))return null;
 return windows.some(window=>{const open=window.openMinutes??(window.open?Number(window.open.slice(0,2))*60+Number(window.open.slice(3,5)):null),close=window.closeMinutes??(window.close?Number(window.close.slice(0,2))*60+Number(window.close.slice(3,5)):null);return open!=null&&close!=null&&start>=open&&end<=close;});
}

export function buildPoiItinerary({places=[],nights=5,pace='balanced',intents=[],soft={},preferenceText='',dates=[],routeMatrix=null,stayAreaKeys=[],spendingOrientation='value'}={}){
 const validPace=paceLimits[pace]?pace:'balanced',pool=unique(places),days=[],used=new Set(),signals=preferenceTags(intents,soft,preferenceText);
 if(!pool.length){
  const count={relaxed:2,balanced:3,intensive:5,deep_dive:3}[validPace];
  for(let index=0;index<Math.min(15,Math.max(1,nights));index++){
   const activities=Array.from({length:count},(_,slot)=>planningActivity(index+1,slot,validPace));
   days.push({day:index+1,date:dates[index]||null,theme:intents[0]||activities[0].place.category,areaKey:activities[0].place.areaKey,activities,labels:{zh:index===0?'抵达 · 基础体验':`${activities[0].place.names.zh} · 可继续修改`,en:index===0?'Arrival · first look':`${activities[0].place.names.en} · editable`},routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null});
  }
  return {status:'planning_skeleton',days,pace:validPace,placeSource:'planning_template',availablePlaces:[]};
 }
 const targetTotal=Math.min(pool.length,Math.min(15,Math.max(1,nights))*paceLimits[validPace]);
 const focus=validPace==='deep_dive'?[...new Set(intents.filter(intent=>pool.some(place=>place.category===intent)))].slice(0,1):[];
 for(let index=0;index<Math.min(15,Math.max(1,nights));index++){
  const date=dates[index]||null,remainingDays=Math.min(15,Math.max(1,nights))-index;
  const limit=Math.min(paceLimits[validPace],Math.ceil((targetTotal-used.size)/remainingDays)),activities=[];let minute=startMinutes[validPace],previous=null;
  while(activities.length<limit){
   const ranked=pool.filter(place=>!used.has(place.id)).map(place=>{
    const travel=previous?routeMinutes(routeMatrix,routeIdentity(previous),routeIdentity(place)):null;
    const distance=previous?routeDistance(routeMatrix,routeIdentity(previous),routeIdentity(place)):null;
    const geographicDistance=previous?coordinateDistanceKm(previous,place):null;
    const areaBonus=previous?.areaKey===place.areaKey?(spendingOrientation==='comfort'?6:3):stayAreaKeys.includes(place.areaKey)?(spendingOrientation==='comfort'?3:1):0;
    const focusBonus=focus.includes(place.category)?8:0;
    const usedCategories=new Set(activities.map(activity=>activity.place.category)),diversityBonus=usedCategories.has(place.category)?0:2;
    const geographicPenalty=geographicDistance==null?0:geographicDistance/({relaxed:2.2,balanced:3.5,intensive:5,deep_dive:3}[validPace]);
    const score=affinity(place,signals)+focusBonus+areaBonus+diversityBonus-(travel==null?0:travel/35)-(distance==null?0:distance/6000)-geographicPenalty;
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
   const openingState=placeOpenAt(place,date,start,end)===null?'unverified':'checked';
   activities.push({id:`day-${index+1}-${place.id}`,placeId:place.id,place,startTime:clock(start),endTime:clock(end),schedulePrecision:openingState==='checked'&&travel!=null?'verified':'approximate',openingHoursState:openingState,routeState:travel==null?'unverified':'verified',travelMinutes:travel,travelDistanceMeters:previous?routeDistance(routeMatrix,routeIdentity(previous),routeIdentity(place)):null});
   used.add(place.id);previous=place;minute=end+breakMinutes[validPace];
  }
  // A sparse curated catalog must not produce empty or half-built days. Fill
  // the remaining pace slots with clearly unverified planning directions.
  while(activities.length<paceLimits[validPace])activities.push(planningActivity(index+1,activities.length,validPace));
  const dominantArea=activities.length?activities.reduce((counts,activity)=>(counts[activity.place.areaKey]=(counts[activity.place.areaKey]||0)+1,counts),{}):{};
  const areaKey=Object.entries(dominantArea).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const legs=activities.slice(1),verified=legs.length>0&&legs.every(activity=>activity.travelMinutes!=null&&activity.travelDistanceMeters!=null);
  const theme=focus[0]||signals.find(signal=>activities.some(activity=>(activity.place.planningTags||[]).includes(signal)))||activities[0]?.place.category||'flexible',themeNames={art:['艺术与博物馆','Art and museums'],museum:['艺术与博物馆','Art and museums'],architecture:['城市建筑与经典','Architecture and landmarks'],food:['街区与当地风味','Neighborhoods and local food'],nature:['自然与风景','Nature and scenery'],shopping:['街区与购物','Neighborhoods and shopping'],nightlife:['城市夜晚','City evenings'],culture:['城市经典与文化','City highlights and culture']},themeName=themeNames[theme]||['城市漫游','City exploration'];
  days.push({day:index+1,date,theme,areaKey,activities,
    labels:activities.length?{zh:`${activities[0].place.names.zh} · ${themeName[0]}`,en:`${activities[0].place.names.en} · ${themeName[1]}`}:{zh:'自由安排 · 地点待核验',en:'Flexible day · places not yet verified'},
    routeState:verified?'verified':'unverified',routeDistanceMeters:verified?legs.reduce((sum,activity)=>sum+activity.travelDistanceMeters,0):null,routeDurationMinutes:verified?legs.reduce((sum,activity)=>sum+activity.travelMinutes,0):null});
 }
 return {status:pool.length?'place_identity_only':'places_unavailable',days,pace:validPace,placeSource:pool.length?pool[0].source:null,availablePlaces:pool};
}

export function replaceDayActivity(itinerary,dayNumber,activityId,replacement=null){
 return {...itinerary,days:itinerary.days.map(day=>day.day!==dayNumber?day:{...day,activities:replacement?day.activities.map(activity=>activity.id===activityId?replacement:activity):day.activities.filter(activity=>activity.id!==activityId),routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null})};
}

export function applyRouteMatrixToItinerary(itinerary,routeMatrix){
 if(!routeMatrix||!Object.keys(routeMatrix).length)return itinerary;
 let itineraryChanged=false;const days=itinerary.days.map(day=>{let activitiesChanged=false;const activities=day.activities.map((activity,index)=>{const previous=index?day.activities[index-1]:null,from=routeIdentity(previous?.place),to=routeIdentity(activity.place),travelMinutes=previous?routeMinutes(routeMatrix,from,to):null,travelDistanceMeters=previous?routeDistance(routeMatrix,from,to):null,routeState=travelMinutes!=null&&travelDistanceMeters!=null?'verified':'unverified';if(activity.routeState===routeState&&activity.travelMinutes===travelMinutes&&activity.travelDistanceMeters===travelDistanceMeters)return activity;activitiesChanged=true;return {...activity,routeState,travelMinutes,travelDistanceMeters};}),legs=activities.slice(1),verified=legs.length>0&&legs.every(activity=>activity.travelMinutes!=null&&activity.travelDistanceMeters!=null),routeState=verified?'verified':'unverified',routeDistanceMeters=verified?legs.reduce((sum,item)=>sum+item.travelDistanceMeters,0):null,routeDurationMinutes=verified?legs.reduce((sum,item)=>sum+item.travelMinutes,0):null;
  if(!activitiesChanged&&day.routeState===routeState&&day.routeDistanceMeters===routeDistanceMeters&&day.routeDurationMinutes===routeDurationMinutes)return day;itineraryChanged=true;return {...day,activities,routeState,routeDistanceMeters,routeDurationMinutes};});return itineraryChanged?{...itinerary,days}:itinerary;
}

export function retimeDayItinerary(itinerary,dayNumber,activityId,startTime,{durationMinutes=null}={}){
 const requested=minutesOf(startTime);if(requested==null||requested<5*60||requested>22*60)throw new Error('Choose a valid start time.');
 return {...itinerary,days:itinerary.days.map(day=>{
  if(day.day!==dayNumber)return day;
  const selectedIndex=day.activities.findIndex(activity=>activity.id===activityId);if(selectedIndex<0)return day;
  const current=day.activities[selectedIndex],currentStart=minutesOf(current.startTime)??requested,currentEnd=minutesOf(current.endTime),selectedDuration=Number.isInteger(durationMinutes)&&durationMinutes>=30&&durationMinutes<=360?durationMinutes:currentEnd!=null?currentEnd-currentStart:visitMinutes[itinerary.pace]||90;
  const delta=requested-currentStart;
  const activities=day.activities.map((activity,index)=>{
   if(index<selectedIndex)return activity;
   const oldStart=minutesOf(activity.startTime);if(oldStart==null)return activity;
   const oldEnd=minutesOf(activity.endTime),start=index===selectedIndex?requested:oldStart+delta,length=index===selectedIndex?selectedDuration:(oldEnd!=null?oldEnd-oldStart:visitMinutes[itinerary.pace]||90);
   return {...activity,startTime:clock(start),endTime:clock(start+length),schedulePrecision:index===selectedIndex?'user_adjusted':'approximate'};
  });
  return {...day,activities,routeState:'unverified',routeDistanceMeters:null,routeDurationMinutes:null};
 })};
}
