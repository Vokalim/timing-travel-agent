// Deterministic planning geography. These are qualitative bands, not live route,
// fare, schedule, or distance claims.
const REGION_BY_COUNTRY=Object.freeze({
 CN:'east_asia',HK:'east_asia',JP:'east_asia',KR:'east_asia',
 SG:'southeast_asia',TH:'southeast_asia',VN:'southeast_asia',MY:'southeast_asia',PH:'southeast_asia',ID:'southeast_asia',
 KZ:'central_asia',UZ:'central_asia',AE:'middle_east',OM:'middle_east',GE:'middle_east',
 GB:'western_europe',FR:'western_europe',BE:'western_europe',NL:'western_europe',IE:'western_europe',
 DE:'central_europe',AT:'central_europe',CH:'central_europe',CZ:'central_europe',HU:'central_europe',PL:'central_europe',SI:'central_europe',
 ES:'southern_europe',PT:'southern_europe',IT:'southern_europe',GR:'southern_europe',HR:'southern_europe',TR:'southern_europe',
 DK:'northern_europe',SE:'northern_europe',NO:'northern_europe',EE:'northern_europe',
 US:'north_america',CA:'north_america',MX:'north_america',CU:'caribbean',
 CO:'south_america',AR:'south_america',PE:'south_america',
 AU:'oceania',NZ:'oceania',MA:'north_africa',ZA:'southern_africa'
});
const CONTINENT_BY_REGION=Object.freeze({east_asia:'asia',southeast_asia:'asia',central_asia:'asia',middle_east:'asia',western_europe:'europe',central_europe:'europe',southern_europe:'europe',northern_europe:'europe',north_america:'north_america',caribbean:'north_america',south_america:'south_america',oceania:'oceania',north_africa:'africa',southern_africa:'africa'});
const COUNTRY_ALIASES=Object.freeze({
 china:'CN','中国':'CN',uk:'GB','u.k.':'GB','united kingdom':'GB','英国':'GB',england:'GB',france:'FR','法国':'FR',
 japan:'JP','日本':'JP','south korea':'KR',korea:'KR','韩国':'KR',usa:'US','u.s.':'US','united states':'US','美国':'US',
 canada:'CA','加拿大':'CA',australia:'AU','澳大利亚':'AU','new zealand':'NZ','新西兰':'NZ',spain:'ES','西班牙':'ES',
 italy:'IT','意大利':'IT',germany:'DE','德国':'DE',portugal:'PT','葡萄牙':'PT',netherlands:'NL','荷兰':'NL',
 singapore:'SG','新加坡':'SG',thailand:'TH','泰国':'TH',mexico:'MX','墨西哥':'MX',turkey:'TR','türkiye':'TR','土耳其':'TR'
});
const ORIGIN_CITY_COUNTRIES=Object.freeze({birmingham:'GB',london:'GB',manchester:'GB',edinburgh:'GB',paris:'FR',lyon:'FR',newyork:'US',nyc:'US',boston:'US',chicago:'US',tokyo:'JP',osaka:'JP',shanghai:'CN',beijing:'CN',chengdu:'CN',guangzhou:'CN',shenzhen:'CN',sydney:'AU',melbourne:'AU','伯明翰':'GB','伦敦':'GB','巴黎':'FR','纽约':'US','东京':'JP','上海':'CN','北京':'CN','悉尼':'AU'});
const LOCAL_COST=Object.freeze({
 CN:1,TH:1,VN:1,MY:1,ID:1,PH:1,MX:1,CO:1,PE:1,MA:1,KZ:1,UZ:1,GE:1,
 JP:2,KR:2,SG:3,HK:3,GB:3,FR:3,CH:3,AT:2,DE:2,NL:3,BE:2,IE:3,ES:2,PT:2,IT:2,CZ:1,HU:1,PL:1,SI:2,HR:2,GR:2,DK:3,SE:3,NO:3,EE:2,TR:1,AE:3,OM:2,ZA:2,
 US:3,CA:3,CU:1,AR:2,AU:3,NZ:3
});
const REGION_ALIASES=Object.freeze({
 europe:['europe','欧洲','western_europe','central_europe','southern_europe','northern_europe'],
 asia:['asia','亚洲','east_asia','southeast_asia','central_asia','middle_east'],
 north_america:['north america','北美','north_america','caribbean'],south_america:['south america','南美','south_america'],
 oceania:['oceania','大洋洲','澳洲'],africa:['africa','非洲','north_africa','southern_africa'],
 east_asia:['east asia','东亚','east_asia'],southeast_asia:['southeast asia','东南亚','southeast_asia'],middle_east:['middle east','中东','middle_east']
});
const clean=value=>String(value||'').trim().toLowerCase();
export const destinationRegion=entity=>REGION_BY_COUNTRY[entity?.countryCode]||'unknown';
export const destinationContinent=entity=>CONTINENT_BY_REGION[destinationRegion(entity)]||'unknown';
export const destinationCostLevel=entity=>LOCAL_COST[entity?.countryCode]||2;
export function resolveOriginContext(origin,getDestination){
 const exact=getDestination?.(origin),text=clean(origin);if(exact){const region=destinationRegion(exact);return {countryCode:exact.countryCode,region,continent:CONTINENT_BY_REGION[region]||'unknown',confidence:'canonical'};}
 let countryCode=null;for(const [alias,code] of Object.entries(COUNTRY_ALIASES))if(text===alias||text.includes(`, ${alias}`)||text.endsWith(` ${alias}`)){countryCode=code;break;}
 if(!countryCode){const city=text.replace(/[^\p{L}\p{N}]+/gu,'');countryCode=ORIGIN_CITY_COUNTRIES[city]||ORIGIN_CITY_COUNTRIES[text]||null;}
 const region=REGION_BY_COUNTRY[countryCode]||'unknown';return {countryCode,region,continent:CONTINENT_BY_REGION[region]||'unknown',confidence:countryCode?'resolved':'unknown'};
}
export function matchesGeographicPreference(entity,preference){
 const value=clean(preference),region=destinationRegion(entity),continent=destinationContinent(entity);if(!value)return false;
 if(value===clean(entity.countryCode)||value===clean(entity.countryNames?.en)||value===clean(entity.countryNames?.zh))return true;
 return Object.entries(REGION_ALIASES).some(([key,aliases])=>aliases.includes(value)&&(key===region||key===continent||aliases.includes(region)));
}
export function evaluateOriginAccess(origin,entity,{durationDays=5,constraints={},totalTripBudgetCny=null,flightBudgetCny=null,getDestination}={}){
 const from=resolveOriginContext(origin,getDestination),toRegion=destinationRegion(entity),toContinent=destinationContinent(entity);
 const band=from.countryCode&&from.countryCode===entity?.countryCode?'same_country':from.region!=='unknown'&&from.region===toRegion?'same_region':from.continent!=='unknown'&&from.continent===toContinent?'same_continent':from.continent!=='unknown'&&toContinent!=='unknown'?'intercontinental':'unknown';
 const base={same_country:0,same_region:3,same_continent:6,intercontinental:11,unknown:6}[band],days=Number(durationDays)||5;
 const durationPenalty=days<=3?{same_country:0,same_region:3,same_continent:9,intercontinental:22,unknown:10}[band]:days<=5?{same_country:0,same_region:1,same_continent:5,intercontinental:12,unknown:7}[band]:days<=7?{same_country:0,same_region:0,same_continent:3,intercontinental:4,unknown:4}[band]:{same_country:0,same_region:0,same_continent:1,intercontinental:2,unknown:3}[band];
 const hard=constraints?.hard||{},strong=constraints?.strong||{},preferred=[...(strong.preferredRegions||[]),...(strong.preferredCountries||[])],explicitFit=preferred.some(item=>matchesGeographicPreference(entity,item));
 let adjustment=-(base+durationPenalty);if(explicitFit)adjustment+=34;if(strong.fartherPreferred&&band==='intercontinental')adjustment+=14;if(strong.nearbyPreferred)adjustment-=base;if(strong.shorterFlightPreferred)adjustment-=Math.round(base*.8);
 const costLevel=destinationCostLevel(entity),perDay=totalTripBudgetCny&&days?totalTripBudgetCny/days:null;
 if(perDay!=null){if(perDay<900)adjustment-=Math.max(0,costLevel-1)*6+(band==='intercontinental'?10:0);else if(perDay<1600)adjustment-=Math.max(0,costLevel-2)*4+(band==='intercontinental'?4:0);}
 if(flightBudgetCny!=null&&band==='intercontinental')adjustment-=flightBudgetCny<2500?12:flightBudgetCny<5000?5:0;
 return {origin:from,destinationRegion:toRegion,destinationContinent:toContinent,distanceBand:band,travelBurden:base+durationPenalty,costLevel,explicitGeographicFit:explicitFit,scoreAdjustment:adjustment};
}
export const geographicRegionAliases=REGION_ALIASES;
