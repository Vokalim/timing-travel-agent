/** Planning defaults never invent a geographic origin. */
export function applyCompletePlanDefaults(draft){
 const next={...draft,fields:{...(draft.fields||{})},interpretation:{...(draft.interpretation||{})},needsConfirmation:[...(draft.needsConfirmation||[])]};
 if(!next.fields.origin){
  next.interpretation.origin=null;
  next.originAssumption=false;
  next.needsConfirmation=[...new Set([...next.needsConfirmation,'origin'])];
 }
 return next;
}
