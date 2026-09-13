export const transportModes=Object.freeze(['flight','train','ground']);
export function transportAvailability(flightVerification){
 return {flight:{status:flightVerification.status,source:flightVerification.source},train:{status:'not_yet_live'},ground:{status:'not_yet_live'}};
}
