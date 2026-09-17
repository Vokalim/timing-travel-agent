/** Planning assumptions are explicit, editable, and never stored as permanent preferences. */
export function applyCompletePlanDefaults(draft,{origin='Shanghai'}={}){
 const next={...draft,fields:{...(draft.fields||{})},interpretation:{...(draft.interpretation||{})},needsConfirmation:[...(draft.needsConfirmation||[])]};
 if(!next.fields.origin){
  next.fields.origin=origin;
  next.interpretation.origin=origin;
  next.originAssumption=true;
  next.needsConfirmation=[...new Set([...next.needsConfirmation,'origin'])];
 }
 return next;
}
