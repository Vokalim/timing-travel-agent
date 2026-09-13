import {getDestination,destinationKey} from './destination-universe.js';

export class DestinationAccessResolver { resolve(){throw new Error('Implement DestinationAccessResolver.resolve(destination).');} }

// Access denotes possible entry points, never a timetable, ground transfer, or fare.
export class CuratedDestinationAccessResolver extends DestinationAccessResolver {
 resolve(destination){
  const entity=getDestination(destination),name=entity?.canonicalName||destination?.city||String(destination||''),id=entity?.id||destinationKey(name);
  const airport=entity?.transportAccess.airportHubIds[0]&&getDestination(entity.transportAccess.airportHubIds[0]);
  const rail=entity?.transportAccess.railHubIds[0]&&getDestination(entity.transportAccess.railHubIds[0]);
  const hub=value=>value?{id:value.id,canonicalName:value.canonicalName,code:value.directAirportCode||null,names:value.names}:null;
  return {destinationId:id,
   flightAccess:{hub:hub(airport)||(!entity&&destination?.iataOrMetroCode?{id,canonicalName:name,code:destination.iataOrMetroCode,names:{zh:name,en:name}}:null),confidence:airport?'curated':'unknown',verificationState:'unverified',requiresOnwardTransfer:Boolean(airport&&airport.id!==id),providerLookup:airport?.directAirportCode?airport.canonicalName:!entity&&destination?.iataOrMetroCode?name:null},
   railAccess:{hub:hub(rail),confidence:rail?'curated':'unknown',verificationState:'unverified',requiresOnwardTransfer:Boolean(rail&&rail.id!==id)},
   selfDriveAccess:{suitable:Boolean(entity?.transportAccess.roadTripSuitable),notes:null,verificationState:'unverified'}
  };
 }
}

export function planningCandidateForDestination(name,source='demo'){
 const entity=getDestination(name);if(!entity)return null;
 return {id:entity.id,city:entity.canonicalName,countryOrRegion:entity.countryNames.en,entityType:entity.entityType,themes:entity.destinationTraits,
  access:new CuratedDestinationAccessResolver().resolve({city:entity.canonicalName}),verification:{status:'not_checked',source}};
}
