export const SOURCE_REGISTRY=Object.freeze({
 wikivoyage:{tier:'B',provider:'Wikivoyage',host:'en.wikivoyage.org',sourceType:'open_travel_guide',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',attribution:'Wikivoyage contributors'},
 amap:{tier:'A',provider:'高德地图',host:'restapi.amap.com',sourceType:'live_place_provider',license:null,licenseUrl:null,attribution:'高德地图'}
});

export const approvedResearchUrl=value=>{try{const url=new URL(value);return Object.values(SOURCE_REGISTRY).some(source=>source.host===url.hostname);}catch{return false;}};

export function sourceReference(key,{sourceUrl,retrievedAt=new Date().toISOString(),verificationLevel}={}){const source=SOURCE_REGISTRY[key];if(!source||!approvedResearchUrl(sourceUrl))throw new Error('Unapproved research source.');return {provider:source.provider,sourceType:source.sourceType,sourceUrl,retrievedAt,license:source.license,licenseUrl:source.licenseUrl,attribution:source.attribution,verificationLevel};}
