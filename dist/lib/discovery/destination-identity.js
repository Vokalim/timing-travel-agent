import {getDestination,destinationKey} from './destination-universe.js';

export function destinationIdentity(value){
 const city=typeof value==='string'?value:value?.city||value?.canonicalCity||'';
 const known=getDestination(value)||getDestination(city);
 if(known)return {key:known.id,code:known.directAirportCode||null,canonicalCity:known.canonicalName,names:{...known.names},countryNames:{...known.countryNames},regionNames:{...known.regionNames},entityType:known.entityType,fallbackCategory:known.sceneryCategory};
 const code=typeof value==='object'?value?.iataOrMetroCode||value?.code||null:null;
 const country=typeof value==='object'?value?.countryOrRegion||'':'';
 return {key:destinationKey(String(city)),code,canonicalCity:String(city),names:{zh:String(city),en:String(city)},countryNames:{zh:({'china':'中国','mainland china':'中国','hong kong sar':'中国香港','japan':'日本','south korea':'韩国','thailand':'泰国','singapore':'新加坡','united kingdom':'英国','france':'法国'}[country.toLowerCase()]||country),en:country},fallbackCategory:'urban'};
}
export const displayCity=(value,language='en')=>destinationIdentity(value).names[language==='zh'?'zh':'en'];
export const displayCountry=(value,language='en')=>{
 const identity=destinationIdentity(value);
 return identity.countryNames[language==='zh'?'zh':'en'];
};
export const presentDestination=(candidate,language='en')=>({
 key:destinationIdentity(candidate).key,canonicalCity:candidate.city,code:candidate.iataOrMetroCode,
 city:displayCity(candidate,language),country:displayCountry(candidate,language)
});
