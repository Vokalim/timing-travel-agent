import {DemoPreferenceParser,tripFields} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {displayCity} from './lib/discovery/destination-identity.js';
import {parsePreferenceConstraints,preferenceSummary} from './lib/preference-constraints.js';
import {knownDisplayLabel,displayTravelPeriod} from './lib/display-localization.js';
import {createTemporalContext} from './lib/discovery/temporal-context.js';
import {normalizeExplicitDestination} from './lib/discovery/explicit-destination.js';
import {SignalSource} from './lib/travel-signal.js';

const isZh=()=>document.documentElement.lang.startsWith('zh');
const t=(zh,en)=>isZh()?zh:en;

const foreignBudget=text=>{
 const value=String(text||''),match=value.match(/(?:\b(USD|GBP|EUR|JPY|HKD|AUD|CAD)\s*|([$£€]))\s*([\d,]+(?:\.\d+)?)/i),suffix=value.match(/([\d,]+(?:\.\d+)?)\s*(英镑|英鎊|镑|鎊|美元|欧元|歐元|日元|日圓|港币|港幣)/i);
 if(!match&&suffix){const currency=/(?:英镑|英鎊|镑|鎊)/.test(suffix[2])?'GBP':/美元/.test(suffix[2])?'USD':/(?:欧元|歐元)/.test(suffix[2])?'EUR':/(?:日元|日圓)/.test(suffix[2])?'JPY':'HKD';return {currency,amount:Number(suffix[1].replaceAll(',','')),raw:suffix[0].trim()};}
 if(!match)return null;
 const currency=(match[1]||({'$':'USD','£':'GBP','€':'EUR'}[match[2]])||'').toUpperCase();
 return currency?{currency,amount:Number(match[3].replaceAll(',','')),raw:match[0].trim()}:null;
};
export async function parseLiveTravelSignal(text,parser=new DemoPreferenceParser()){
 const draft=await parser.parse(text);
 draft.interpretation={...(draft.interpretation||{}),constraints:parsePreferenceConstraints(draft.fields?.notes||text)};
 const originalBudget=foreignBudget(text);
 if(originalBudget)draft.interpretation={...(draft.interpretation||{}),originalBudget,currencyNormalizationState:'conversion_required'};
 return draft;
}

// UI integration only: interpreting fills a draft and never changes search logic.
export function setupTripInput(form,onDraftChange,parser=new FallbackPreferenceParser(new LLMPreferenceParser(),new DemoPreferenceParser()),{deferSubmission=false,locationSession=null,travelSignal=null}={}){
 const input=document.querySelector('#trip-description'),button=document.querySelector('#interpret-trip'),review=document.querySelector('#trip-review'),status=document.querySelector('#agent-status');
 const live=document.createElement('div');live.id='live-signal-feedback';live.className='live-signal-feedback';live.setAttribute('aria-live','polite');input.closest?.('.ask-box')?.insertAdjacentElement?.('afterend',live);
 const travelIntents=document.createElement('input');travelIntents.type='hidden';travelIntents.name='travelIntents';form.append(travelIntents);
 let lastDraft,liveDraft,readyToSend=false,liveTimer=0,liveRevision=0;
 const persistDraft=(draft,text=input.value,mode='auto')=>{if(!travelSignal)return draft;const update=travelSignal.updateFromDraft(draft,{text,mode}),merged=travelSignal.toDraft();return {...draft,...merged,affectedDomains:update.affected,parserStatus:draft.parserStatus,source:draft.source,warnings:draft.warnings||[]};};
 const prioritizeOrigin=draft=>{if(draft.fields?.origin)locationSession?.applyExplicitOrigin(draft.fields.origin);else{const confirmed=locationSession?.confirmedOrigin();if(confirmed){draft.fields.origin=confirmed;draft.interpretation={...(draft.interpretation||{}),origin:confirmed,originSource:'user_confirmed_current_location'};draft.needsConfirmation=(draft.needsConfirmation||[]).filter(key=>key!=='origin');}}return draft;};
 const setButtonMode=mode=>{button.dataset.signalMode=mode;const text=button.querySelector?.('span');if(text)text.textContent=mode==='send'?t('发出旅行信号','Send travel signal'):t('理解这个想法','Understand this idea');};
 const signalNodes=draft=>{
 const fields=draft.fields||{},interpretation=draft.interpretation||{},uiLanguage=isZh()?'zh':'en',nodes=[];
  const constraints=parsePreferenceConstraints(fields.notes||'');
  if(fields.origin)nodes.push({kind:'origin',label:draft.originAssumption?t(`暂按 ${displayCity(fields.origin,uiLanguage)}`,`Starting from ${displayCity(fields.origin,uiLanguage)} provisionally`):displayCity(fields.origin,uiLanguage)});
  const period=draft.dateHint||interpretation.departureWindowText;if(period)nodes.push({kind:'time',label:period});
  for(const intent of (fields.travelIntents||[]).slice(0,2)){const label=knownDisplayLabel(intent,uiLanguage);if(label)nodes.push({kind:'intent',label});}
  if(interpretation.pace)nodes.push({kind:'pace',label:knownDisplayLabel(interpretation.pace,uiLanguage)||interpretation.pace,source:draft.signalSources?.pace});
  else if(constraints.pace)nodes.push({kind:'pace',label:knownDisplayLabel(constraints.pace,uiLanguage)||constraints.pace});
  const budget=fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget;if(budget)nodes.push({kind:'budget',label:`¥${Number(budget).toLocaleString()}`});
  else if(interpretation.originalBudget)nodes.push({kind:'budget',label:`${interpretation.originalBudget.currency} ${interpretation.originalBudget.amount.toLocaleString()}`});
  else if(draft.signalSources?.spendingOrientation===SignalSource.DEFAULT)nodes.push({kind:'default',label:t('预算未填写 · 性价比优先','No budget yet · Value first'),source:SignalSource.DEFAULT});
  if(interpretation.avoidOvernightFlights===true)nodes.push({kind:'preference',label:t('不要红眼','No overnight flights')});
  if(constraints.strong?.smallerPlacesPreferred)nodes.push({kind:'place-scale',label:t('小城也可以','Smaller places welcome')});
  if(constraints.strong?.preferredRegions?.length)nodes.push({kind:'geography',label:knownDisplayLabel(constraints.strong.preferredRegions[0],uiLanguage)||constraints.strong.preferredRegions[0]});
  if(constraints.hard?.transportModeRequired)nodes.push({kind:'transport',label:knownDisplayLabel(`${constraints.hard.transportModeRequired}Only`,uiLanguage)||constraints.hard.transportModeRequired});
  const sourceFor={origin:'origin',time:'dateIntent',intent:'themes',budget:'budget',preference:'hardConstraints',geography:'geographicIntent',transport:'transportPreferences','place-scale':'transportPreferences'};
  return nodes.slice(0,7).map(node=>({...node,source:node.source||draft.signalSources?.[sourceFor[node.kind]]}));
 };
 const renderLive=draft=>{
  liveDraft=draft;const nodes=signalNodes(draft),destination=draft.fields?.destination,hasText=Boolean(input.value.trim());
  live.replaceChildren();live.hidden=!hasText&&!locationSession;
  if(hasText){const lead=document.createElement('span');lead.className='live-signal-lead';lead.textContent=destination?t(`听见了 · ${displayCity(destination,'zh')}`,`Got it · ${displayCity(destination,'en')}`):t('途米正在听','Timing is listening');live.append(lead);
  if(nodes.length){const field=document.createElement('div');field.className='live-signal-nodes';for(const node of nodes){const item=document.createElement('span');item.dataset.signalKind=node.kind;if(node.source)item.dataset.signalSource=node.source;item.textContent=node.label;field.append(item);}live.append(field);}
  if(!draft.fields?.origin){const unresolved=document.createElement('small');unresolved.textContent=t('出发地还没听清，也可以继续说','Origin is still open — keep going if you like');live.append(unresolved);}}
  if(!draft.fields?.origin&&locationSession){const state=locationSession.snapshot(),action=document.createElement('button');action.type='button';action.className='location-origin-action';if(state.permissionState==='NOT_REQUESTED'){action.textContent=t('◎ 使用我的位置作为出发地','◎ Use my location as origin');action.addEventListener('click',async()=>{action.disabled=true;action.textContent=t('正在获取位置…','Getting location…');await locationSession.requestCurrentLocation();renderLive(prioritizeOrigin(liveDraft));if(globalThis.CustomEvent&&document.dispatchEvent)document.dispatchEvent(new CustomEvent('timing:location-origin',{detail:locationSession.snapshot()}));});live.append(action);}else if(state.permissionState==='AVAILABLE_UNCONFIRMED'){action.textContent=t(`◎ ${displayCity(state.currentLocation.city,'zh')}附近 · 作为出发地？`,`◎ Near ${displayCity(state.currentLocation.city,'en')} · use as origin?`);action.addEventListener('click',()=>{locationSession.confirmAsOrigin();const origin=locationSession.confirmedOrigin(),field=form.elements.namedItem('origin');if(field)field.value=origin||'';renderLive(persistDraft(prioritizeOrigin(liveDraft),input.value,'merge'));if(globalThis.CustomEvent&&document.dispatchEvent)document.dispatchEvent(new CustomEvent('timing:location-origin',{detail:locationSession.snapshot()}));});live.append(action);}else if(['DENIED','UNAVAILABLE'].includes(state.permissionState)){const unavailable=document.createElement('small');unavailable.textContent=t('位置不可用 · 可以直接写出发地','Location unavailable · type an origin instead');live.append(unavailable);}}
  if(globalThis.CustomEvent&&document.dispatchEvent)document.dispatchEvent(new CustomEvent('timing:live-signal',{detail:{draft,text:input.value,travelSignal:travelSignal?.snapshot?.(),affectedDomains:draft.affectedDomains||[]}}));
 };
 const scheduleLive=()=>{clearTimeout(liveTimer);const revision=++liveRevision;if(!input.value.trim()){renderLive(prioritizeOrigin({fields:{travelIntents:[]},interpretation:{},needsConfirmation:['origin']}));if(globalThis.CustomEvent&&document.dispatchEvent)document.dispatchEvent(new CustomEvent('timing:live-signal',{detail:{draft:null,text:'',travelSignal:travelSignal?.snapshot?.()}}));return;}liveTimer=setTimeout(async()=>{try{const draft=persistDraft(prioritizeOrigin(await parseLiveTravelSignal(input.value)),input.value);if(revision===liveRevision)renderLive(draft);}catch{}},400);};
 const renderReview=draft=>{
  review.hidden=false;review.replaceChildren();
  const fields=draft.fields,interpretation=draft.interpretation||{};
  const uiLanguage=isZh()?'zh':'en',period=createTemporalContext({earliestDeparture:fields.start||null,latestDeparture:fields.end||null,departureWindowText:draft.dateHint||interpretation.departureWindowText||''},{language:uiLanguage});const title=document.createElement('strong');title.textContent=[fields.origin?`${displayCity(fields.origin,uiLanguage)}${fields.destination?' → '+displayCity(fields.destination,uiLanguage):t('出发',' departure')}`:null,!fields.destination&&t('目的地交给途米','Destination by Timing'),draft.dateHint||interpretation.departureWindowText||fields.start?displayTravelPeriod(period,uiLanguage):null,fields.nights&&t(`${fields.nights} 天`,`${fields.nights} days`),(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget)&&`¥${Number(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget).toLocaleString()}`].filter(Boolean).join(' · ');review.append(title);
  const nodes=signalNodes(draft);if(nodes.length){const field=document.createElement('div');field.className='signal-node-field';field.setAttribute('role','list');for(const [index,node] of nodes.entries()){const item=document.createElement('span');item.className=`signal-node signal-node-${index+1}`;item.dataset.signalKind=node.kind;if(node.source)item.dataset.signalSource=node.source;item.setAttribute('role','listitem');item.textContent=node.label;field.append(item);}review.append(field);}
  const concise=preferenceSummary(parsePreferenceConstraints(fields.notes),uiLanguage);
  const tags=[...(fields.travelIntents||[]).slice(0,3).map(intent=>knownDisplayLabel(intent,uiLanguage)).filter(Boolean),concise?`${t('偏好：','Preferences: ')}${concise}`:interpretation.avoidOvernightFlights===true?t('避开红眼航班','No overnight flights'):null];
  if(tags.filter(Boolean).length){const small=document.createElement('p');small.textContent=tags.filter(Boolean).join(' · ');review.append(small);}
  if(draft.parserStatus==='fallback'||draft.parserStatus==='demo'){const warning=document.createElement('small');warning.textContent=t('这里有些细节我还没完全听懂 · 已先整理可确认的部分','Some details are still unclear · Here is what I could confirm');review.append(warning);}
  const edit=document.createElement('button');edit.type='button';edit.textContent=t('修改条件','Edit conditions');edit.addEventListener('click',()=>{const details=document.querySelector('#structured-details');if(details){details.open=true;details.scrollIntoView?.({behavior:'smooth',block:'start'});}});review.append(edit);
 };
 button.addEventListener('click',async()=>{
  if(deferSubmission&&readyToSend&&lastDraft){readyToSend=false;setButtonMode('interpret');onDraftChange(lastDraft);return;}
  if(!input.value.trim()){review.hidden=false;review.textContent=t('请先描述你的旅行，当前条件没有改变。','Describe your trip first. Your form has not changed.');return;}
  button.disabled=true;if(!deferSubmission)status.hidden=false;
  try{let draft=prioritizeOrigin(await parser.parse(input.value)),explicitDestination=normalizeExplicitDestination(input.value,{origin:draft.fields.origin||draft.interpretation?.origin});if(explicitDestination){draft.fields.destination=explicitDestination;draft.interpretation={...(draft.interpretation||{}),destination:explicitDestination,destinationState:'provided'};draft.needsConfirmation=(draft.needsConfirmation||[]).filter(key=>key!=='destination');}draft=persistDraft(draft,input.value);lastDraft=draft;for(const key of [...Object.keys(tripFields),'notes']){const field=form.elements.namedItem(key);field.value=draft.fields[key]??'';field.classList.toggle('needs-confirmation',key==='origin'&&draft.needsConfirmation.includes(key));field.setAttribute('aria-describedby','trip-review');}const total=form.elements.namedItem('totalTripBudgetCny');if(total)total.value=draft.fields.totalTripBudgetCny??draft.interpretation?.totalTripBudgetCny??'';travelIntents.value=draft.fields.travelIntents.join(',');renderReview(draft);if(deferSubmission){readyToSend=true;setButtonMode('send');}else onDraftChange(draft);}
  catch{status.hidden=true;review.hidden=false;review.textContent=t('无法理解这段描述，请使用旅行条件表单。','Could not interpret this description. Please use the trip details form.');}
  finally{button.disabled=false;}
 });
 input.addEventListener('input',()=>{if(readyToSend){readyToSend=false;setButtonMode('interpret');}scheduleLive();});
 form.addEventListener('input',event=>{const key=event.target.name;if(key==='origin'&&event.target.value.trim())locationSession?.applyExplicitOrigin(event.target.value);if((!Object.hasOwn(tripFields,key)&&key!=='notes')||review.hidden)return;const field=event.target;field.classList.toggle('needs-confirmation',false);if(lastDraft){lastDraft.fields[key]=field.value||undefined;travelSignal?.updateFromDraft(lastDraft,{text:'',mode:'merge'});renderReview(lastDraft);}});
 document.addEventListener('timing:language',()=>{if(lastDraft)renderReview(lastDraft);if(liveDraft)renderLive(liveDraft);setButtonMode(readyToSend?'send':'interpret');});
 setButtonMode('interpret');
 if(locationSession)renderLive(prioritizeOrigin({fields:{travelIntents:[]},interpretation:{},needsConfirmation:['origin']}));
}
