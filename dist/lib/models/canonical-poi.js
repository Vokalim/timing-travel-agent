export const VerificationState=Object.freeze({
 LIVE_VERIFIED:'LIVE_VERIFIED',OPEN_SOURCE_VERIFIED:'OPEN_SOURCE_VERIFIED',PROVIDER_PARTIAL:'PROVIDER_PARTIAL',CURATED:'CURATED',CURATED_FALLBACK:'CURATED_FALLBACK',GENERATED_FALLBACK:'GENERATED_FALLBACK',UNAVAILABLE:'UNAVAILABLE'
});

export const CoordinateSystem=Object.freeze({WGS84:'WGS84',GCJ02:'GCJ02'});

export function canonicalCoordinates(lat,lng,coordinateSystem){
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
 if(!Object.values(CoordinateSystem).includes(coordinateSystem))throw new Error('A known coordinate system is required.');
 return {lat,lng,lon:lng,coordinateSystem};
}

export function normalizeCanonicalPoi(value){
 const names=value?.names||{zh:value?.displayName,en:value?.displayName};
 const coordinates=value?.coordinates||canonicalCoordinates(value?.lat,value?.lng,value?.coordinateSystem);
 if(!value?.id||!value?.provider||!value?.providerPlaceId||!names?.en||!coordinates)throw new Error('Provider POI is incomplete.');
 return {
  id:String(value.id),provider:String(value.provider),providerPlaceId:String(value.providerPlaceId),
  canonicalName:String(value.canonicalName||names.en),displayName:String(value.displayName||names.zh||names.en),names:{zh:String(names.zh||names.en),en:String(names.en)},
  destinationId:String(value.destinationId||''),category:String(value.category||'attraction'),areaKey:value.areaKey||geographicAreaKey(coordinates),coordinates,
  source:'provider',sourceAttribution:value.sourceAttribution||null,verificationState:value.verificationState||VerificationState.LIVE_VERIFIED,
  openingHours:null,rating:null,photos:[],address:null,dataFetchedAt:value.dataFetchedAt||new Date().toISOString()
 };
}

export function normalizeTravelPoi(value){
 const names=value?.names||value?.localizedName||{zh:value?.displayName,en:value?.displayName},coordinates=value?.coordinates||canonicalCoordinates(value?.lat,value?.lng,value?.coordinateSystem);
 if(!value?.id||!value?.provider||!value?.providerPlaceId||!names?.en)throw new Error('Travel POI identity is incomplete.');
 return {id:String(value.id),provider:String(value.provider),providerPlaceId:String(value.providerPlaceId),canonicalName:String(value.canonicalName||names.en),displayName:String(value.displayName||names.zh||names.en),names:{zh:String(names.zh||names.en),en:String(names.en)},
  destinationId:String(value.destinationId||''),destination:value.destination||null,country:value.country||null,category:String(value.category||'culture'),areaKey:value.areaKey||geographicAreaKey(coordinates),coordinates,
  source:value.source||'open_research',sourceType:value.sourceType||'open_knowledge',sourceId:value.sourceId||value.providerPlaceId,sourceUrl:value.sourceUrl||null,sourceAttribution:value.sourceAttribution||null,provenance:value.provenance||[],
  verificationState:value.verificationState||(coordinates?VerificationState.OPEN_SOURCE_VERIFIED:VerificationState.PROVIDER_PARTIAL),planningTags:[...new Set((value.planningTags||[]).map(String))],planningSignals:value.planningSignals||{},openingHours:null,rating:null,photos:[],address:null,dataFetchedAt:value.dataFetchedAt||new Date().toISOString()};
}

export const geographicAreaKey=coordinates=>coordinates?`geo_${Math.round(coordinates.lat*50)}_${Math.round(coordinates.lng*50)}`:null;
