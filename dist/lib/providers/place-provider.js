import {destinationIdentity} from '../discovery/destination-identity.js';

// Place facts are supplied by a provider. Missing hours, coordinates and ratings stay null.
export class PlaceProvider {
  search(_destination) { throw new Error('Implement PlaceProvider.search(destination).'); }
}

const place=(id,zh,en,category,areaKey)=>({id,names:{zh,en},category,areaKey,
  coordinates:null,openingHours:null,rating:null,photos:[],address:null,
  source:'curated',verificationState:'place_identity_only'});
const catalog={
  tokyo:[place('tokyo-sensoji','浅草寺','Sensō-ji','culture','asakusa'),place('tokyo-nakamise','仲见世商店街','Nakamise Shopping Street','shopping','asakusa'),place('tokyo-ueno','上野公园','Ueno Park','nature','ueno'),place('tokyo-national-museum','东京国立博物馆','Tokyo National Museum','culture','ueno'),place('tokyo-tsukiji','筑地场外市场','Tsukiji Outer Market','food','central'),place('tokyo-shibuya','涩谷十字路口','Shibuya Crossing','photography','shibuya'),place('tokyo-meiji','明治神宫','Meiji Jingū','culture','shibuya'),place('tokyo-yoyogi','代代木公园','Yoyogi Park','nature','shibuya')],
  shanghai:[place('shanghai-bund','外滩','The Bund','photography','bund'),place('shanghai-yuyuan','豫园','Yu Garden','culture','old_town'),place('shanghai-city-god','城隍庙','City God Temple','culture','old_town'),place('shanghai-nanjing-road','南京路步行街','Nanjing Road','shopping','bund'),place('shanghai-museum','上海博物馆','Shanghai Museum','culture','people_square'),place('shanghai-people-square','人民广场','People’s Square','nature','people_square')],
  hangzhou:[place('hangzhou-west-lake','西湖','West Lake','nature','west_lake'),place('hangzhou-lingyin','灵隐寺','Lingyin Temple','culture','west_lake'),place('hangzhou-hefang','河坊街','Hefang Street','food','old_town'),place('hangzhou-leifeng','雷峰塔','Leifeng Pagoda','culture','west_lake'),place('hangzhou-longjing','龙井村','Longjing Village','nature','longjing')],
  osaka:[place('osaka-castle','大阪城','Osaka Castle','culture','castle'),place('osaka-park','大阪城公园','Osaka Castle Park','nature','castle'),place('osaka-dotonbori','道顿堀','Dōtonbori','food','minami'),place('osaka-kuromon','黑门市场','Kuromon Market','food','minami'),place('osaka-shinsaibashi','心斋桥','Shinsaibashi','shopping','minami')]
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
