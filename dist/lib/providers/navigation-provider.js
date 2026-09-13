// Routing metrics must come from a real route response; map links make no metric claim.
export class NavigationProvider {
  route(_request){throw new Error('Implement NavigationProvider.route(request).');}
  mapUrl(_place){throw new Error('Implement NavigationProvider.mapUrl(place).');}
  directionsUrl(_place){throw new Error('Implement NavigationProvider.directionsUrl(place).');}
}
const query=(place,language='en')=>encodeURIComponent(`${place?.names?.[language]||place?.names?.en||place?.name||''}${place?.city?`, ${place.city}`:''}`);
export class GoogleNavigationProvider extends NavigationProvider {
  constructor(routeImpl=null){super();this.routeImpl=routeImpl;}
  route(request){return this.routeImpl?this.routeImpl(request):{status:'unverified',distanceMeters:null,durationMinutes:null,polyline:null};}
  mapUrl(place){return `https://www.google.com/maps/search/?api=1&query=${query(place)}`;}
  directionsUrl(place){return `https://www.google.com/maps/dir/?api=1&destination=${query(place)}`;}
}
export class AMapNavigationProvider extends NavigationProvider {
  constructor(routeImpl=null){super();this.routeImpl=routeImpl;}
  route(request){return this.routeImpl?this.routeImpl(request):{status:'unverified',distanceMeters:null,durationMinutes:null,polyline:null};}
  mapUrl(place){return `https://uri.amap.com/search?keyword=${query(place,'zh')}&view=map&src=timing`;}
  directionsUrl(place){const {longitude,latitude}=place?.coordinates||{};
    return Number.isFinite(longitude)&&Number.isFinite(latitude)?`https://uri.amap.com/navigation?from=&to=${encodeURIComponent(`${longitude},${latitude},${place.names?.zh||place.names?.en||''}`)}&mode=car&src=timing`:this.mapUrl(place);}
}
export const navigationForCountry=country=>country==='China'?new AMapNavigationProvider():new GoogleNavigationProvider();
