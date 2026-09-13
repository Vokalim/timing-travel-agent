import {TRANSPORT_MODES,planTransportOptions} from './transport-planner.js';
export const transportModes=TRANSPORT_MODES;
export function transportAvailability(flightVerification,context={}){
 const plan=planTransportOptions({...context,flightVerification});
 return Object.fromEntries(plan.options.map(option=>[option.mode,option]));
}
