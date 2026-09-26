import {getDestination} from './destination-universe.js';

export function confirmedDestinationFromDraft(draft={}){
 const value=draft.fields?.destination||draft.interpretation?.destination||null;
 return getDestination(value)?.canonicalName||String(value||'').trim()||null;
}

export function destinationFlowForDraft(draft={}){
 const destination=confirmedDestinationFromDraft(draft);
 return destination?{kind:'trip',destination,discoveryRequired:false}:{kind:'discovery',destination:null,discoveryRequired:true};
}

export function clearedDiscoverySelection(destination,chosenCandidate=null){return {
 discoveryResult:undefined,clarificationDraft:undefined,discoverySnapshot:null,discoveryFilter:'all',
 chosenCandidate:chosenCandidate?.city===destination?chosenCandidate:null
};}
