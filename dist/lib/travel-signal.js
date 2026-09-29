import {parsePreferenceConstraints} from './preference-constraints.js';

export const SignalSource=Object.freeze({EXPLICIT:'EXPLICIT',CONFIRMED_LOCATION:'CONFIRMED_LOCATION',INFERRED:'INFERRED',DEFAULT:'DEFAULT',UNKNOWN:'UNKNOWN'});
const field=(value=null,source=SignalSource.UNKNOWN)=>({value,source});
const unique=value=>[...new Set((value||[]).filter(Boolean))];
const clone=value=>value==null?value:structuredClone(value);
const mergeObject=(base={},next={})=>{
 const out={...base};
 for(const [key,value] of Object.entries(next||{})){
  if(Array.isArray(value)){if(value.length)out[key]=unique([...(out[key]||[]),...value]);continue;}
  if(value!==undefined&&value!==null&&value!==false)out[key]=value;
  else if(value===true)out[key]=true;
 }
 return out;
};
const cnyCorrection=text=>{
 const value=String(text||'');
 const match=value.match(/(?:预算|預算)(?:改成|改为|改為|调整到|調整到|是|为|為|:)?\s*(?:[¥￥]|CNY\s*|RMB\s*)?([\d,]+(?:\.\d+)?|[一二两兩三四五六七八九十]+万)/i);
 if(!match)return null;
 if(match[1].endsWith('万')){const digits={一:1,二:2,两:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};return (digits[match[1][0]]||1)*10000;}
 return Number(match[1].replaceAll(',',''))||null;
};
const correctionLanguage=/其实|其實|改成|改为|改為|还是|還是|不要|不想|instead|change|actually|only/i;

export const travelSignalDependencies=changed=>{
 const map={
  origin:['access','destinationRanking','transport','itineraryPracticality'],
  geographicIntent:['destinationRecall','destinationRanking'],destinationIntent:['destinationRecall','destinationRanking'],
  dateIntent:['seasonalRecall','destinationRanking','transport','itinerary'],duration:['destinationPracticality','destinationRanking','transport','itinerary'],
  budget:['destinationValue','destinationRanking','transport','stay'],themes:['destinationRecall','destinationRanking','itineraryPoi'],
  pace:['itineraryDensity','stayArea'],spendingOrientation:['destinationValue','transport','stay'],
  transportPreferences:['destinationRanking','transport'],hardConstraints:['destinationRecall','destinationRanking','transport'],softPreferences:['destinationRanking','itineraryPoi','stayArea'],
  selectedDestinationId:['transport','itineraryPoi','stayArea'],poi:['itinerary','footprint','adjacentRoutes','stayArea']
 };
 return unique((changed||[]).flatMap(key=>map[key]||[]));
};

export class TravelSignalSession {
 constructor(){this.reset();}
 reset(){
  this.fields={origin:field(),destinationIntent:field(),geographicIntent:field([],SignalSource.UNKNOWN),dateIntent:field(),duration:field(),budget:field(),currency:field('CNY',SignalSource.DEFAULT),themes:field([],SignalSource.UNKNOWN),pace:field('balanced',SignalSource.DEFAULT),spendingOrientation:field('value',SignalSource.DEFAULT),transportPreferences:field({},SignalSource.UNKNOWN),hardConstraints:field({},SignalSource.UNKNOWN),softPreferences:field({},SignalSource.UNKNOWN),rejectedDestinations:field([],SignalSource.UNKNOWN),exploredDestinations:field([],SignalSource.UNKNOWN)};
  this.exploration={rankedPool:[],shownDestinationIds:[],openedDestinationIds:[],selectedDestinationId:null,currentBatch:[],rejectedDestinationIds:[],worldPointPositions:{}};
  this.preferenceText='';this.lastText='';this.lastChanged=[];return this;
 }
 set(name,value,source=SignalSource.EXPLICIT){const previous=this.fields[name];if(JSON.stringify(previous?.value)===JSON.stringify(value)&&previous?.source===source)return false;this.fields[name]=field(clone(value),source);return true;}
 updateFromDraft(draft,{text='',mode='auto'}={}){
  const fields=draft?.fields||{},interpretation=draft?.interpretation||{},constraints=interpretation.constraints||parsePreferenceConstraints(fields.notes||text),changed=[];
  const merging=mode==='merge'||(mode==='auto'&&(correctionLanguage.test(text)||Boolean(this.lastText&&text.includes(this.lastText))));
  if(!merging&&this.lastText&&text&&text!==this.lastText){const exploration=this.exploration;this.reset();this.exploration=exploration;}
  if(text||fields.notes){const nextText=fields.notes||text;this.preferenceText=this.lastText&&text.includes(this.lastText)?nextText:merging?[this.preferenceText,nextText].filter(Boolean).join(' · '):nextText;}
  const put=(name,value,source=SignalSource.EXPLICIT)=>{if(value!==undefined&&value!==null&&value!==''&&this.set(name,value,source))changed.push(name);};
  put('origin',fields.origin||interpretation.origin,interpretation.originSource==='user_confirmed_current_location'?SignalSource.CONFIRMED_LOCATION:SignalSource.EXPLICIT);
  if(fields.destination||interpretation.destination)put('destinationIntent',fields.destination||interpretation.destination);
  const geography={preferredRegions:constraints.strong?.preferredRegions||[],excludedRegions:constraints.hard?.excludedRegions||[],excludedDestinations:constraints.hard?.excludedDestinations||[],domesticAllowed:interpretation.domesticAllowed??null,internationalAllowed:interpretation.internationalAllowed??null};
  if(Object.values(geography).some(value=>Array.isArray(value)?value.length:value!==null))put('geographicIntent',geography);
  const period={earliestDeparture:fields.start||interpretation.earliestDeparture||null,latestDeparture:fields.end||interpretation.latestDeparture||null,windowText:draft?.dateHint||interpretation.departureWindowText||null};
  if(Object.values(period).some(Boolean))put('dateIntent',period);
  put('duration',fields.nights||interpretation.durationDays);
  const correctedBudget=cnyCorrection(text),budget=correctedBudget||fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||null;
  if(budget)put('budget',{totalTripBudgetCny:Number(budget),flightBudgetCny:fields.flightBudget||interpretation.flightBudgetCny||null,hotelBudgetPerNightCny:fields.hotelBudget||interpretation.hotelBudgetPerNightCny||null});
  else if(fields.flightBudget||interpretation.flightBudgetCny||fields.hotelBudget||interpretation.hotelBudgetPerNightCny)put('budget',{totalTripBudgetCny:null,flightBudgetCny:fields.flightBudget||interpretation.flightBudgetCny||null,hotelBudgetPerNightCny:fields.hotelBudget||interpretation.hotelBudgetPerNightCny||null});
  if(interpretation.originalBudget)put('currency',interpretation.originalBudget.currency);
  if((fields.travelIntents||interpretation.travelIntents||[]).length)put('themes',unique(fields.travelIntents||interpretation.travelIntents));
  put('pace',interpretation.pace||constraints.pace);
  put('spendingOrientation',interpretation.spendingOrientation||constraints.spendingOrientation);
  const hard=mergeObject(this.fields.hardConstraints.value,constraints.hard),strong=mergeObject(this.fields.transportPreferences.value,constraints.strong),soft=mergeObject(this.fields.softPreferences.value,constraints.soft);
  if(Object.keys(hard).length)put('hardConstraints',hard);if(Object.keys(strong).length)put('transportPreferences',strong);if(Object.keys(soft).length)put('softPreferences',soft);
  const excluded=new Set(hard.excludedRegions||[]),geo=this.fields.geographicIntent.value||{};
  if(excluded.size&&geo.preferredRegions?.some(item=>excluded.has(item))){this.set('geographicIntent',{...geo,preferredRegions:geo.preferredRegions.filter(item=>!excluded.has(item))},SignalSource.EXPLICIT);if(!changed.includes('geographicIntent'))changed.push('geographicIntent');}
  this.lastText=text||this.lastText;this.lastChanged=changed;return {changed,affected:travelSignalDependencies(changed),snapshot:this.snapshot()};
 }
 updateField(name,value,source=SignalSource.EXPLICIT){const changed=this.set(name,value,source)?[name]:[];this.lastChanged=changed;return {changed,affected:travelSignalDependencies(changed)};}
 toPreferences(){
  const value=name=>clone(this.fields[name].value),date=value('dateIntent')||{},budget=value('budget')||{},geo=value('geographicIntent')||{};
  return {origin:value('origin'),destination:value('destinationIntent'),destinationState:value('destinationIntent')?'provided':'discovery_required',earliestDeparture:date.earliestDeparture||null,latestDeparture:date.latestDeparture||null,departureWindowText:date.windowText||null,durationDays:value('duration'),totalTripBudgetCny:budget.totalTripBudgetCny||null,flightBudgetCny:budget.flightBudgetCny||null,hotelBudgetPerNightCny:budget.hotelBudgetPerNightCny||null,currency:value('currency')||'CNY',travelIntents:value('themes')||[],pace:value('pace'),spendingOrientation:value('spendingOrientation'),domesticAllowed:geo.domesticAllowed??null,internationalAllowed:geo.internationalAllowed??null,rejectedDestinationIds:value('rejectedDestinations')||[],exploredDestinationIds:value('exploredDestinations')||[],notes:this.preferenceText,constraints:{hard:value('hardConstraints')||{},strong:value('transportPreferences')||{},soft:value('softPreferences')||{},pace:value('pace'),spendingOrientation:value('spendingOrientation')}};
 }
  toDraft(){const p=this.toPreferences();return {fields:{origin:p.origin||undefined,destination:p.destination||undefined,start:p.earliestDeparture||undefined,end:p.latestDeparture||undefined,nights:p.durationDays||undefined,flightBudget:p.flightBudgetCny||undefined,hotelBudget:p.hotelBudgetPerNightCny||undefined,totalTripBudgetCny:p.totalTripBudgetCny||undefined,travelIntents:p.travelIntents,notes:this.preferenceText},dateHint:p.departureWindowText||undefined,needsConfirmation:Object.entries(this.fields).filter(([,entry])=>entry.source===SignalSource.UNKNOWN).map(([name])=>name),interpretation:p,signalSources:Object.fromEntries(Object.entries(this.fields).map(([key,entry])=>[key,entry.source]))};}
 markRankedPool(ids){this.exploration.rankedPool=unique(ids);}
 markShown(ids){this.exploration.shownDestinationIds=unique([...this.exploration.shownDestinationIds,...ids]);this.exploration.currentBatch=[...ids];this.fields.exploredDestinations=field([...this.exploration.shownDestinationIds],SignalSource.INFERRED);}
 markOpened(id){this.exploration.openedDestinationIds=unique([...this.exploration.openedDestinationIds,id]);this.fields.exploredDestinations=field(unique([...this.exploration.shownDestinationIds,...this.exploration.openedDestinationIds]),SignalSource.INFERRED);}
 selectDestination(id){this.exploration.selectedDestinationId=id||null;}
 rejectDestination(id){this.exploration.rejectedDestinationIds=unique([...this.exploration.rejectedDestinationIds,id]);this.fields.rejectedDestinations=field([...this.exploration.rejectedDestinationIds],SignalSource.EXPLICIT);}
 setWorldPosition(id,position){if(!this.exploration.worldPointPositions[id])this.exploration.worldPointPositions[id]=clone(position);return this.exploration.worldPointPositions[id];}
 snapshot(){return {fields:clone(this.fields),exploration:clone(this.exploration),preferenceText:this.preferenceText,lastText:this.lastText};}
 restore(snapshot){if(!snapshot)return this;this.fields=clone(snapshot.fields);this.exploration=clone(snapshot.exploration);this.preferenceText=snapshot.preferenceText||'';this.lastText=snapshot.lastText||'';return this;}
 source(name){return this.fields[name]?.source||SignalSource.UNKNOWN;}
}
