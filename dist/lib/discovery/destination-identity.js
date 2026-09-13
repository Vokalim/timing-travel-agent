// Presentation metadata only. Search providers continue to receive candidate.city/code.
const entries=[
 ['Shanghai','SHA','上海','China','中国','urban'],['Beijing','BJS','北京','China','中国','historic'],
 ['Chengdu','CTU','成都','China','中国','urban'],['Chongqing','CKG','重庆','China','中国','urban'],
 ['Changsha','CSX','长沙','China','中国','urban'],['Xiamen','XMN','厦门','China','中国','coastal'],
 ['Sanya','SYX','三亚','China','中国','tropical'],['Kunming','KMG','昆明','China','中国','mountain'],
 ['Dali','DLU','大理','China','中国','mountain'],['Lijiang','LJG','丽江','China','中国','mountain'],
 ['Guilin','KWL','桂林','China','中国','mountain'],["Xi'an",'XIY','西安','China','中国','historic'],
 ['Hangzhou','HGH','杭州','China','中国','historic'],['Nanjing','NKG','南京','China','中国','historic'],
 ['Qingdao','TAO','青岛','China','中国','coastal'],['Harbin','HRB','哈尔滨','China','中国','winter'],
 ['Guangzhou','CAN','广州','China','中国','urban'],['Shenzhen','SZX','深圳','China','中国','coastal'],
 ['Hong Kong','HKG','香港','Hong Kong SAR','中国香港','urban'],['Tokyo','TYO','东京','Japan','日本','urban'],
 ['Osaka','OSA','大阪','Japan','日本','urban'],['Seoul','SEL','首尔','South Korea','韩国','urban'],
 ['Singapore','SIN','新加坡','Singapore','新加坡','urban'],['Bangkok','BKK','曼谷','Thailand','泰国','urban'],
 ['London','LON','伦敦','United Kingdom','英国','historic'],['Paris','PAR','巴黎','France','法国','historic']
];
const byCity=new Map(entries.map(([en,code,zh,countryEn,countryZh,fallbackCategory])=>[en.toLowerCase(),{key:en.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),code,canonicalCity:en,names:{zh,en},countryNames:{zh:countryZh,en:countryEn},fallbackCategory}]));
const countryZh=new Map([['china','中国'],['mainland china','中国'],['hong kong sar','中国香港'],['japan','日本'],['south korea','韩国'],['thailand','泰国'],['singapore','新加坡'],['united kingdom','英国'],['france','法国']]);
export function destinationIdentity(value){
 const city=typeof value==='string'?value:value?.city||value?.canonicalCity||'';
 const known=byCity.get(String(city).trim().toLowerCase());
 if(known)return {...known,names:{...known.names},countryNames:{...known.countryNames}};
 const code=typeof value==='object'?value?.iataOrMetroCode||value?.code||null:null;
 const country=typeof value==='object'?value?.countryOrRegion||'':'';
 return {key:String(city).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_'),code,canonicalCity:String(city),names:{zh:String(city),en:String(city)},countryNames:{zh:countryZh.get(country.toLowerCase())||country,en:country},fallbackCategory:'urban'};
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
