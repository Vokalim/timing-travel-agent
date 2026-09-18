import {destinationIdentity} from '../discovery/destination-identity.js';

// Place facts are supplied by a provider. Missing hours, coordinates and ratings stay null.
export class PlaceProvider {
  search(_destination) { throw new Error('Implement PlaceProvider.search(destination).'); }
}

const place=(id,zh,en,category,areaKey,coordinates=null)=>({id,names:{zh,en},category,areaKey,
  coordinates,openingHours:null,rating:null,photos:[],address:null,
  source:'curated',verificationState:'place_identity_only'});
const catalog={
  tokyo:[place('tokyo-sensoji','浅草寺','Sensō-ji','culture','asakusa'),place('tokyo-nakamise','仲见世商店街','Nakamise Shopping Street','shopping','asakusa'),place('tokyo-ueno','上野公园','Ueno Park','nature','ueno'),place('tokyo-national-museum','东京国立博物馆','Tokyo National Museum','culture','ueno'),place('tokyo-tsukiji','筑地场外市场','Tsukiji Outer Market','food','central'),place('tokyo-shibuya','涩谷十字路口','Shibuya Crossing','photography','shibuya'),place('tokyo-meiji','明治神宫','Meiji Jingū','culture','shibuya'),place('tokyo-yoyogi','代代木公园','Yoyogi Park','nature','shibuya')],
  shanghai:[place('shanghai-bund','外滩','The Bund','photography','bund'),place('shanghai-yuyuan','豫园','Yu Garden','culture','old_town'),place('shanghai-city-god','城隍庙','City God Temple','culture','old_town'),place('shanghai-nanjing-road','南京路步行街','Nanjing Road','shopping','bund'),place('shanghai-museum','上海博物馆','Shanghai Museum','culture','people_square'),place('shanghai-people-square','人民广场','People’s Square','nature','people_square')],
  hangzhou:[place('hangzhou-west-lake','西湖','West Lake','nature','west_lake'),place('hangzhou-lingyin','灵隐寺','Lingyin Temple','culture','west_lake'),place('hangzhou-hefang','河坊街','Hefang Street','food','old_town'),place('hangzhou-leifeng','雷峰塔','Leifeng Pagoda','culture','west_lake'),place('hangzhou-longjing','龙井村','Longjing Village','nature','longjing')],
  osaka:[place('osaka-castle','大阪城','Osaka Castle','culture','castle'),place('osaka-park','大阪城公园','Osaka Castle Park','nature','castle'),place('osaka-dotonbori','道顿堀','Dōtonbori','food','minami'),place('osaka-kuromon','黑门市场','Kuromon Market','food','minami'),place('osaka-shinsaibashi','心斋桥','Shinsaibashi','shopping','minami')],
  harbin:[place('harbin-central-street','中央大街','Central Street','culture','daoli'),place('harbin-sophia','圣索菲亚教堂广场','Saint Sophia Cathedral Square','culture','daoli'),place('harbin-songhua-river','松花江畔','Songhua Riverfront','nature','daoli'),place('harbin-sun-island','太阳岛','Sun Island','nature','songbei'),place('harbin-ice-world','哈尔滨冰雪大世界','Harbin Ice and Snow World','snow_winter','ice_world'),place('harbin-laodaowai','老道外','Lao Daowai','food','daoli')],
  paris:[
    place('paris-louvre','卢浮宫','Louvre Museum','museum','louvre',{lat:48.8606,lon:2.3376}),
    place('paris-tuileries','杜乐丽花园','Tuileries Garden','nature','louvre',{lat:48.8635,lon:2.3275}),
    place('paris-palais-royal','皇家宫殿花园','Palais-Royal Garden','culture','louvre',{lat:48.8638,lon:2.3370}),
    place('paris-orsay','奥赛博物馆','Musée d’Orsay','museum','saint_germain',{lat:48.8600,lon:2.3266}),
    place('paris-seine','塞纳河左岸','Left Bank of the Seine','photography','saint_germain',{lat:48.8568,lon:2.3358}),
    place('paris-luxembourg','卢森堡公园','Luxembourg Gardens','nature','saint_germain',{lat:48.8462,lon:2.3372}),
    place('paris-notre-dame','巴黎圣母院广场','Notre-Dame Square','culture','cite',{lat:48.8530,lon:2.3499}),
    place('paris-sainte-chapelle','圣礼拜堂','Sainte-Chapelle','culture','cite',{lat:48.8554,lon:2.3450}),
    place('paris-marais','玛黑区','Le Marais','culture','marais',{lat:48.8590,lon:2.3622}),
    place('paris-place-des-vosges','孚日广场','Place des Vosges','culture','marais',{lat:48.8556,lon:2.3656}),
    place('paris-montmartre','蒙马特','Montmartre','culture','montmartre',{lat:48.8867,lon:2.3431}),
    place('paris-sacre-coeur','圣心大教堂','Sacré-Cœur','culture','montmartre',{lat:48.8867,lon:2.3431}),
    place('paris-eiffel','埃菲尔铁塔 / 战神广场','Eiffel Tower / Champ de Mars','photography','eiffel',{lat:48.8584,lon:2.2945}),
    place('paris-trocadero','特罗卡德罗广场','Trocadéro','photography','eiffel',{lat:48.8625,lon:2.2877}),
    place('paris-arc','凯旋门','Arc de Triomphe','culture','champs_elysees',{lat:48.8738,lon:2.2950}),
    place('paris-champs','香榭丽舍大街','Champs-Élysées','shopping','champs_elysees',{lat:48.8698,lon:2.3076}),
    place('paris-canal','圣马丁运河','Canal Saint-Martin','relaxation','canal',{lat:48.8723,lon:2.3658}),
    place('paris-bastille-market','巴士底市集一带','Bastille market area','food','bastille',{lat:48.8532,lon:2.3692})
  ]
};

export class CuratedPlaceProvider extends PlaceProvider {
  search(destination) { return (catalog[destinationIdentity(destination).key]||[]).map(item=>({...item,city:String(destination),names:{...item.names}})); }
}

export class AMapPlaceProvider extends PlaceProvider {
  constructor(searchImpl=null){super();this.searchImpl=searchImpl;}
  search(destination){if(!this.searchImpl)throw new Error('AMap place data is not connected.');return this.searchImpl(destination);}
}
export class GooglePlacesProvider extends PlaceProvider {
  constructor(searchImpl=null){super();this.searchImpl=searchImpl;}
  search(destination){if(!this.searchImpl)throw new Error('Google Places data is not connected.');return this.searchImpl(destination);}
}
