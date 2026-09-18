import {createTripRequest} from './trip-request.js';
import {destinationIdentity} from './discovery/destination-identity.js';
import {planTransportOptions} from './discovery/transport-planner.js';
import {CuratedPlaceProvider} from './providers/place-provider.js';
import {buildPoiItinerary} from './poi-itinerary.js';

const area=(key,zh,en)=>({key,labels:{zh,en}});
const areaNames={asakusa:['浅草','Asakusa'],ueno:['上野','Ueno'],central:['市中心','Central district'],shibuya:['涩谷','Shibuya'],bund:['外滩一带','The Bund area'],old_town:['老城街区','Old town'],people_square:['人民广场一带',"People's Square area"],west_lake:['西湖沿线','West Lake area'],longjing:['龙井一带','Longjing area'],castle:['大阪城一带','Osaka Castle area'],minami:['难波 / 心斋桥','Namba / Shinsaibashi'],daoli:['中央大街 / 道里','Central Street / Daoli'],songbei:['松北','Songbei'],ice_world:['冰雪大世界周边','Ice and Snow World area'],louvre:['卢浮宫 / 歌剧院一带','Louvre / Opéra'],saint_germain:['圣日耳曼一带','Saint-Germain'],cite:['西岱岛周边','Île de la Cité'],marais:['玛黑区','Le Marais'],montmartre:['蒙马特','Montmartre'],eiffel:['埃菲尔铁塔 / 七区','Eiffel Tower / 7th arrondissement'],champs_elysees:['香榭丽舍一带','Champs-Élysées'],canal:['圣马丁运河一带','Canal Saint-Martin'],bastille:['巴士底一带','Bastille']};
const namedArea=key=>{const labels=areaNames[key]||['活动集中区域','Main activity area'];return area(key,labels[0],labels[1]);};
export class StayRecommendation {recommend(){throw new Error('Implement StayRecommendation.recommend(trip).');}}
export class PlanningStayRecommendation extends StayRecommendation {
 recommend(trip,{itinerary=null,transport=null}={}){const identity=destinationIdentity(trip.destination),{strong={},soft={}}=trip.constraints||{},spending=trip.spendingOrientation||'value',pace=trip.planningPace||trip.constraints?.pace||'balanced';
  const choices=[];
  const counts={};for(const day of itinerary?.days||[])for(const activity of day.activities||[])if(activity.place.areaKey)counts[activity.place.areaKey]=(counts[activity.place.areaKey]||0)+1;
  const clusters=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([key])=>key);
  if(clusters[0])choices.push({...namedArea(clusters[0]),role:'best'});
  if(strong.seasidePreferred||identity.fallbackCategory==='coastal'||identity.fallbackCategory==='tropical')choices.push({...area('coastal','海边区域','A coastal area'),role:'scenic'});
  if(strong.mountainPreferred||identity.fallbackCategory==='mountain')choices.push({...area('scenic','景观区域','A scenic area'),role:'scenic'});
  if(soft.quietAreas||pace==='relaxed')choices.push({...area('quiet','安静街区','A quieter neighborhood'),role:'quiet'});
  if(soft.nightlife)choices.push({...area('nightlife','夜间出行便利区域','An area convenient for evenings'),role:'convenient'});
  if(strong.centralLocationPreferred||spending==='comfort')choices.push({...area('central','市中心','A central area'),role:'convenient'});
  if(strong.convenientTransportPreferred||spending==='value'||['flight','train'].includes(transport?.preferredMode)||choices.length<2)choices.push({...area('transit','交通便利区域','An area near transit'),role:spending==='value'?'value':'convenient'});
  if(!choices.length)choices.push(area('central','市中心','A central area'));
  const areas=[...new Map(choices.map(item=>[item.key,item])).values()].slice(0,3),primary=areas[0];
  const reason={zh:clusters[0]?`行程主要集中在${primary.labels.zh}，${spending==='comfort'?'优先减少往返与换乘。':'兼顾交通便利与性价比。'}`:`先以${primary.labels.zh}为住宿方向，具体通勤待核验。`,en:clusters[0]?`Most activities cluster around ${primary.labels.en}; ${spending==='comfort'?'this reduces transfers and backtracking.':'this balances access and value.'}`:`Start with ${primary.labels.en}; exact commute times remain unverified.`};
  return {status:'planning_guidance',areas,primaryArea:primary,reason,clusterAreaKey:clusters[0]||null,inventoryStatus:'not_yet_live',hotelName:null,price:null,rating:null,availability:null};
 }
}

const themeCopy={food:['探索当地风味','Explore local food'],culture:['安排文化漫步','Explore culture at an easy pace'],nature:['留给自然风景','Spend time with nature'],beach:['在海边放松','Relax by the coast'],hiking:['安排适合体力的徒步','Plan a suitable hike'],shopping:['逛一逛本地街区','Browse local neighborhoods'],relaxation:['放慢脚步','Take a slower day'],photography:['寻找适合拍摄的风景','Make room for photography'],nightlife:['体验夜间氛围','Explore the evening atmosphere']};
export class ItineraryPlanner {plan(){throw new Error('Implement ItineraryPlanner.plan(trip,stay).');}}
export class PlanningItinerary extends ItineraryPlanner {
 plan(trip,stay,plan=null,{places=[],routeMatrix=null,pace=null,spendingOrientation='value'}={}){const nights=Number.isInteger(trip.nights)&&trip.nights>0?trip.nights:5,soft=trip.constraints?.soft||{},intents=trip.travelIntents||[];
  const preferredPace=pace||trip.constraints?.pace||'balanced';
  const departure=plan?.windows?.[0]?.departure;
  const dates=departure?Array.from({length:nights},(_,index)=>new Date(Date.parse(`${departure}T00:00:00Z`)+index*86400000).toISOString().slice(0,10)):[];
  const itinerary=buildPoiItinerary({places,nights,pace:preferredPace,intents,soft,dates,routeMatrix,stayAreaKeys:(stay?.areas||[]).map(item=>item.key),spendingOrientation});
  const strong=trip.constraints?.strong||{},transportPreference=trip.constraints?.hard?.transportModeRequired||strong.trainPreferred&&'train'||strong.selfDrivePreferred&&'self_drive'||strong.flightPreferred&&'flight'||null;
  return {...itinerary,transportPreference,transportPreferenceStrength:trip.constraints?.hard?.transportModeRequired?'hard':transportPreference?'strong':null,
   departureWindow:plan?.context?.dateDescription||null,representativeDeparture:plan?.windows?.[0]?.departure||null,dateSource:plan?.dateSource||null,
   stayAreaKeys:(stay?.areas||[]).map(item=>item.key),spendingOrientation,confirmedBookings:false};
 }
}

export function buildTripExperience({trip,plan=null,candidate=null,flightVerification={status:'not_checked',source:null},stayProvider=new PlanningStayRecommendation(),itineraryPlanner=new PlanningItinerary(),placeProvider=new CuratedPlaceProvider(),routeMatrix=null,pace=null,spendingOrientation=null,itineraryOverride=null}){
 const request=createTripRequest({...trip,destination:trip.destination||candidate?.city||null});
 if(!request.destination)throw new Error('Select a destination before planning a stay or itinerary.');
 const nights=plan?.nights||request.nights||5,context={...request,nights,planningPace:pace||request.constraints?.pace||'balanced',spendingOrientation:spendingOrientation||request.spendingOrientation||'value'};
 const transport=planTransportOptions({origin:context.origin,destination:context.destination,countryOrRegion:candidate?.countryOrRegion,durationDays:nights,constraints:context.constraints,flightVerification,spendingOrientation:context.spendingOrientation});
 const places=placeProvider.search(context.destination),skeleton=itineraryOverride||itineraryPlanner.plan(context,{areas:[]},plan,{places,routeMatrix,pace,spendingOrientation:context.spendingOrientation});
 const stay=stayProvider.recommend(context,{itinerary:skeleton,places,transport}),itinerary=itineraryOverride||itineraryPlanner.plan(context,stay,plan,{places,routeMatrix,pace,spendingOrientation:context.spendingOrientation});
 const frequentArea=Object.entries(itinerary.days.reduce((counts,day)=>{for(const activity of day.activities||[])counts[activity.place.areaKey]=(counts[activity.place.areaKey]||0)+1;return counts;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
 if(frequentArea){const anchor=places.find(place=>place.areaKey===frequentArea);stay.poiCluster={areaKey:frequentArea,nearPlace:anchor?.names||null,source:'itinerary_place_cluster'};}
 return {trip:context,plan,transport,stay,itinerary,flightVerification,access:candidate?.access||null};
}
