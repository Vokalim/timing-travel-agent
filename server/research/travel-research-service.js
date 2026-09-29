import {WikivoyageResearchProvider} from './wikivoyage-research-provider.js';
import {AMapPlaceProvider} from '../providers/amap-place-provider.js';
import {VerificationState,geographicAreaKey} from '../../dist/lib/models/canonical-poi.js';
import {localizePoiContent,normalizeContentLocale} from '../../dist/lib/content-localization.js';

const keyName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu,' ').trim();
export function deduplicateTravelPois(places=[]){const merged=new Map();for(const place of places){const key=keyName(place.canonicalName||place.displayName||place.names?.en);if(!key)continue;const current=merged.get(key);if(!current){merged.set(key,place);continue;}const preferred=current.coordinates?current:place.coordinates?place:current;merged.set(key,{...preferred,planningTags:[...new Set([...(current.planningTags||[]),...(place.planningTags||[])])],provenance:[...new Map([...(current.provenance||[]),...(place.provenance||[])].map(item=>[item.sourceUrl,item])).values()]});}return [...merged.values()];}

const amapTags=place=>[...new Set([place.category,place.category==='museum'?'art':null,place.category==='culture'?'architecture':null,place.category==='food'?'food':null].filter(Boolean))];
export class TravelResearchService{
 constructor({wikivoyageProvider,amapProvider=null}={}){this.wikivoyageProvider=wikivoyageProvider;this.amapProvider=amapProvider;}
 async research(request){let primary=null,error=null;
  if(request.countryCode==='CN'&&this.amapProvider){try{const places=await this.amapProvider.searchDestinationPOIs(request);if(places.length)primary={candidatePois:places.map((place,index)=>({...place,areaKey:place.areaKey||geographicAreaKey(place.coordinates),sourceType:'live_place_provider',sourceUrl:'https://lbs.amap.com/',provenance:[{provider:'高德地图',sourceType:'live_place_provider',sourceUrl:'https://lbs.amap.com/',retrievedAt:place.dataFetchedAt,license:null,attribution:'高德地图',verificationLevel:'live'}],planningTags:amapTags(place),planningSignals:{destinationRepresentativeness:Math.max(.4,1-index*.03)}})),destinationInsights:[],sources:[{provider:'高德地图',sourceType:'live_place_provider',sourceUrl:'https://lbs.amap.com/',retrievedAt:new Date().toISOString(),license:null,attribution:'高德地图',verificationLevel:'live'}],researchStatus:VerificationState.LIVE_VERIFIED};}catch(cause){error=cause;}}
  if(!primary){try{const open=await this.wikivoyageProvider.research(request);if(open.candidatePois.length)primary={...open,researchStatus:VerificationState.OPEN_SOURCE_VERIFIED};}catch(cause){error=cause;}}
  if(!primary)return {destination:{id:request.destinationId,name:request.destinationName,countryCode:request.countryCode},candidatePois:[],destinationInsights:[],sources:[],researchStatus:VerificationState.UNAVAILABLE,errorCode:error?.code||'RESEARCH_UNAVAILABLE'};
  const contentLocale=normalizeContentLocale(request.contentLocale||request.locale),candidatePois=deduplicateTravelPois(primary.candidatePois).map(place=>localizePoiContent(place,contentLocale));
  return {...primary,destination:{id:request.destinationId,name:request.destinationName,countryCode:request.countryCode},contentLocale,candidatePois,errorCode:error?.code||null};
 }
}

export function createTravelResearchService({env,fetchImpl,controller}){const wikivoyageProvider=new WikivoyageResearchProvider({fetchImpl,controller,maxDistrictPages:Number(env.WIKIVOYAGE_MAX_DISTRICT_PAGES||4)}),amapProvider=env.AMAP_WEB_SERVICE_KEY?new AMapPlaceProvider({apiKey:env.AMAP_WEB_SERVICE_KEY,fetchImpl,controller}):null;return new TravelResearchService({wikivoyageProvider,amapProvider});}
