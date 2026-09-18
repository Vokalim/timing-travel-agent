import {destinationIdentity} from '../discovery/destination-identity.js';

// Place facts are supplied by a provider. Missing hours, coordinates and ratings stay null.
export class PlaceProvider {
  search(_destination) { throw new Error('Implement PlaceProvider.search(destination).'); }
}

const place=(id,zh,en,category,areaKey,coordinates=null)=>({id,names:{zh,en},category,areaKey,
  coordinates,openingHours:null,rating:null,photos:[],address:null,
  source:'curated',verificationState:'place_identity_only'});
const catalog={
  tokyo:[
    place('tokyo-sensoji','浅草寺','Sensō-ji','culture','asakusa',{lat:35.7148,lon:139.7967}),place('tokyo-nakamise','仲见世商店街','Nakamise Shopping Street','shopping','asakusa',{lat:35.7117,lon:139.7964}),
    place('tokyo-ueno','上野公园','Ueno Park','nature','ueno',{lat:35.7148,lon:139.7732}),place('tokyo-national-museum','东京国立博物馆','Tokyo National Museum','museum','ueno',{lat:35.7188,lon:139.7765}),place('tokyo-yanaka','谷中银座','Yanaka Ginza','food','ueno',{lat:35.7277,lon:139.7668}),
    place('tokyo-tsukiji','筑地场外市场','Tsukiji Outer Market','food','central',{lat:35.6655,lon:139.7708}),place('tokyo-ginza','银座','Ginza','shopping','central',{lat:35.6717,lon:139.7650}),place('tokyo-station','东京站丸之内','Tokyo Station Marunouchi','culture','central',{lat:35.6812,lon:139.7671}),place('tokyo-east-garden','皇居东御苑','Imperial Palace East Gardens','nature','central',{lat:35.6852,lon:139.7528}),
    place('tokyo-shibuya','涩谷十字路口','Shibuya Crossing','photography','shibuya',{lat:35.6595,lon:139.7005}),place('tokyo-meiji','明治神宫','Meiji Jingū','culture','shibuya',{lat:35.6764,lon:139.6993}),place('tokyo-yoyogi','代代木公园','Yoyogi Park','nature','shibuya',{lat:35.6717,lon:139.6949}),place('tokyo-shimokitazawa','下北泽','Shimokitazawa','culture','shibuya',{lat:35.6616,lon:139.6680}),
    place('tokyo-shinjuku-gyoen','新宿御苑','Shinjuku Gyoen','nature','shinjuku',{lat:35.6852,lon:139.7101}),place('tokyo-metropolitan','东京都厅展望室','Tokyo Metropolitan Government Observatories','photography','shinjuku',{lat:35.6896,lon:139.6917}),
    place('tokyo-teamlab','丰洲 teamLab Planets','teamLab Planets Tokyo','culture','bay',{lat:35.6491,lon:139.7898}),place('tokyo-odaiba','台场海滨公园','Odaiba Seaside Park','nature','bay',{lat:35.6296,lon:139.7755}),place('tokyo-kiyosumi','清澄庭园','Kiyosumi Gardens','nature','east_tokyo',{lat:35.6780,lon:139.7975})
  ],
  shanghai:[place('shanghai-bund','外滩','The Bund','photography','bund'),place('shanghai-yuyuan','豫园','Yu Garden','culture','old_town'),place('shanghai-city-god','城隍庙','City God Temple','culture','old_town'),place('shanghai-nanjing-road','南京路步行街','Nanjing Road','shopping','bund'),place('shanghai-museum','上海博物馆','Shanghai Museum','culture','people_square'),place('shanghai-people-square','人民广场','People’s Square','nature','people_square')],
  hangzhou:[place('hangzhou-west-lake','西湖','West Lake','nature','west_lake'),place('hangzhou-lingyin','灵隐寺','Lingyin Temple','culture','west_lake'),place('hangzhou-hefang','河坊街','Hefang Street','food','old_town'),place('hangzhou-leifeng','雷峰塔','Leifeng Pagoda','culture','west_lake'),place('hangzhou-longjing','龙井村','Longjing Village','nature','longjing')],
  osaka:[place('osaka-castle','大阪城','Osaka Castle','culture','castle'),place('osaka-park','大阪城公园','Osaka Castle Park','nature','castle'),place('osaka-dotonbori','道顿堀','Dōtonbori','food','minami'),place('osaka-kuromon','黑门市场','Kuromon Market','food','minami'),place('osaka-shinsaibashi','心斋桥','Shinsaibashi','shopping','minami')],
  harbin:[place('harbin-central-street','中央大街','Central Street','culture','daoli'),place('harbin-sophia','圣索菲亚教堂广场','Saint Sophia Cathedral Square','culture','daoli'),place('harbin-songhua-river','松花江畔','Songhua Riverfront','nature','daoli'),place('harbin-sun-island','太阳岛','Sun Island','nature','songbei'),place('harbin-ice-world','哈尔滨冰雪大世界','Harbin Ice and Snow World','snow_winter','ice_world'),place('harbin-laodaowai','老道外','Lao Daowai','food','daoli')],
  chengdu:[
    place('chengdu-people-park','人民公园','People’s Park','relaxation','central_chengdu',{lat:30.6570,lon:104.0550}),place('chengdu-kuanzhai','宽窄巷子','Kuanzhai Alley','culture','central_chengdu',{lat:30.6690,lon:104.0590}),place('chengdu-tianfu','天府广场','Tianfu Square','culture','central_chengdu',{lat:30.6570,lon:104.0660}),
    place('chengdu-wuhou','武侯祠','Wuhou Shrine','culture','wuhou',{lat:30.6450,lon:104.0430}),place('chengdu-jinli','锦里','Jinli Ancient Street','food','wuhou',{lat:30.6450,lon:104.0440}),place('chengdu-yulin','玉林街区','Yulin neighborhood','food','wuhou',{lat:30.6180,lon:104.0570}),
    place('chengdu-panda','成都大熊猫繁育研究基地','Chengdu Research Base of Giant Panda Breeding','nature','panda_base',{lat:30.7396,lon:104.1416}),
    place('chengdu-wenshu','文殊院','Wenshu Monastery','culture','wenshu',{lat:30.6800,lon:104.0730}),place('chengdu-taikoo','太古里','Taikoo Li Chengdu','shopping','chunxi',{lat:30.6540,lon:104.0830}),place('chengdu-daci','大慈寺','Daci Temple','culture','chunxi',{lat:30.6530,lon:104.0820}),
    place('chengdu-sichuan-museum','四川博物院','Sichuan Museum','museum','qingyang',{lat:30.6590,lon:104.0340}),place('chengdu-dufu','杜甫草堂','Du Fu Thatched Cottage','culture','qingyang',{lat:30.6610,lon:104.0290}),place('chengdu-qingyang','青羊宫','Qingyang Palace','culture','qingyang',{lat:30.6610,lon:104.0400}),place('chengdu-jinsha','金沙遗址博物馆','Jinsha Site Museum','museum','jinsha',{lat:30.6840,lon:104.0120}),
    place('chengdu-eastern-memory','东郊记忆','Eastern Suburb Memory','culture','east_chengdu',{lat:30.6710,lon:104.1230}),place('chengdu-wangjiang','望江楼公园','Wangjiang Pavilion Park','nature','jiuyanqiao',{lat:30.6260,lon:104.0890}),place('chengdu-jiuyan','九眼桥','Jiuyan Bridge','nightlife','jiuyanqiao',{lat:30.6370,lon:104.0910}),place('chengdu-anshun','安顺廊桥','Anshun Bridge','photography','jiuyanqiao',{lat:30.6350,lon:104.0910})
  ],
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
