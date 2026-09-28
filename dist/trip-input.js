import {DemoPreferenceParser,tripFields} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {displayCity} from './lib/discovery/destination-identity.js';
import {parsePreferenceConstraints,preferenceSummary} from './lib/preference-constraints.js';
import {knownDisplayLabel,displayTravelPeriod} from './lib/display-localization.js';
import {createTemporalContext} from './lib/discovery/temporal-context.js';
import {normalizeExplicitDestination} from './lib/discovery/explicit-destination.js';

const isZh=()=>document.documentElement.lang.startsWith('zh');
const t=(zh,en)=>isZh()?zh:en;

// UI integration only: interpreting fills a draft and never changes search logic.
export function setupTripInput(form,onDraftChange,parser=new FallbackPreferenceParser(new LLMPreferenceParser(),new DemoPreferenceParser()),{deferSubmission=false}={}){
 const input=document.querySelector('#trip-description'),button=document.querySelector('#interpret-trip'),review=document.querySelector('#trip-review'),status=document.querySelector('#agent-status');
 const travelIntents=document.createElement('input');travelIntents.type='hidden';travelIntents.name='travelIntents';form.append(travelIntents);
 let lastDraft,readyToSend=false;
 const setButtonMode=mode=>{button.dataset.signalMode=mode;const text=button.querySelector?.('span');if(text)text.textContent=mode==='send'?t('发出旅行信号','Send travel signal'):t('理解这个想法','Understand this idea');};
 const signalNodes=draft=>{
  const fields=draft.fields||{},interpretation=draft.interpretation||{},uiLanguage=isZh()?'zh':'en',nodes=[];
  if(fields.origin)nodes.push({kind:'origin',label:draft.originAssumption?t(`暂按 ${displayCity(fields.origin,uiLanguage)}`,`Starting from ${displayCity(fields.origin,uiLanguage)} provisionally`):displayCity(fields.origin,uiLanguage)});
  const period=draft.dateHint||interpretation.departureWindowText;if(period)nodes.push({kind:'time',label:period});
  for(const intent of (fields.travelIntents||[]).slice(0,2)){const label=knownDisplayLabel(intent,uiLanguage);if(label)nodes.push({kind:'intent',label});}
  if(interpretation.pace)nodes.push({kind:'pace',label:knownDisplayLabel(interpretation.pace,uiLanguage)||interpretation.pace});
  const budget=fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget;if(budget)nodes.push({kind:'budget',label:`¥${Number(budget).toLocaleString()}`});
  if(interpretation.avoidOvernightFlights===true)nodes.push({kind:'preference',label:t('不要红眼','No overnight flights')});
  return nodes.slice(0,6);
 };
 const renderReview=draft=>{
  review.hidden=false;review.replaceChildren();
  const fields=draft.fields,interpretation=draft.interpretation||{};
  const uiLanguage=isZh()?'zh':'en',period=createTemporalContext({earliestDeparture:fields.start||null,latestDeparture:fields.end||null,departureWindowText:draft.dateHint||interpretation.departureWindowText||''},{language:uiLanguage});const title=document.createElement('strong');title.textContent=[fields.origin?`${displayCity(fields.origin,uiLanguage)}${fields.destination?' → '+displayCity(fields.destination,uiLanguage):t('出发',' departure')}`:null,!fields.destination&&t('目的地交给途米','Destination by Timing'),draft.dateHint||interpretation.departureWindowText||fields.start?displayTravelPeriod(period,uiLanguage):null,fields.nights&&t(`${fields.nights} 天`,`${fields.nights} days`),(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget)&&`¥${Number(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget).toLocaleString()}`].filter(Boolean).join(' · ');review.append(title);
  const nodes=signalNodes(draft);if(nodes.length){const field=document.createElement('div');field.className='signal-node-field';field.setAttribute('role','list');for(const [index,node] of nodes.entries()){const item=document.createElement('span');item.className=`signal-node signal-node-${index+1}`;item.dataset.signalKind=node.kind;item.setAttribute('role','listitem');item.textContent=node.label;field.append(item);}review.append(field);}
  const concise=preferenceSummary(parsePreferenceConstraints(fields.notes),uiLanguage);
  const tags=[...(fields.travelIntents||[]).slice(0,3).map(intent=>knownDisplayLabel(intent,uiLanguage)).filter(Boolean),concise?`${t('偏好：','Preferences: ')}${concise}`:interpretation.avoidOvernightFlights===true?t('避开红眼航班','No overnight flights'):null];
  if(tags.filter(Boolean).length){const small=document.createElement('p');small.textContent=tags.filter(Boolean).join(' · ');review.append(small);}
  if(draft.originAssumption){const assumption=document.createElement('small');assumption.textContent=t('暂按上海出发生成基础方案 · 可修改','Starting with Shanghai as a provisional origin · editable');review.append(assumption);}
  if(draft.parserStatus==='fallback'||draft.parserStatus==='demo'){const warning=document.createElement('small');warning.textContent=t('AI 暂不可用 · 已用本地解析，请核对条件','AI unavailable · Local fallback used; please review');review.append(warning);}
  const edit=document.createElement('button');edit.type='button';edit.textContent=t('修改条件','Edit conditions');edit.addEventListener('click',()=>{const details=document.querySelector('#structured-details');if(details){details.open=true;details.scrollIntoView?.({behavior:'smooth',block:'start'});}});review.append(edit);
 };
 button.addEventListener('click',async()=>{
  if(deferSubmission&&readyToSend&&lastDraft){readyToSend=false;setButtonMode('interpret');onDraftChange(lastDraft);return;}
  if(!input.value.trim()){review.hidden=false;review.textContent=t('请先描述你的旅行，当前条件没有改变。','Describe your trip first. Your form has not changed.');return;}
  button.disabled=true;if(!deferSubmission)status.hidden=false;
  try{const draft=await parser.parse(input.value),explicitDestination=normalizeExplicitDestination(input.value,{origin:draft.fields.origin||draft.interpretation?.origin});if(explicitDestination){draft.fields.destination=explicitDestination;draft.interpretation={...(draft.interpretation||{}),destination:explicitDestination,destinationState:'provided'};draft.needsConfirmation=(draft.needsConfirmation||[]).filter(key=>key!=='destination');}lastDraft=draft;for(const key of [...Object.keys(tripFields),'notes']){const field=form.elements.namedItem(key);field.value=draft.fields[key]??'';field.classList.toggle('needs-confirmation',key==='origin'&&draft.needsConfirmation.includes(key));field.setAttribute('aria-describedby','trip-review');}const total=form.elements.namedItem('totalTripBudgetCny');if(total)total.value=draft.fields.totalTripBudgetCny??draft.interpretation?.totalTripBudgetCny??'';travelIntents.value=draft.fields.travelIntents.join(',');renderReview(draft);if(deferSubmission){readyToSend=true;setButtonMode('send');}else onDraftChange(draft);}
  catch{status.hidden=true;review.hidden=false;review.textContent=t('无法理解这段描述，请使用旅行条件表单。','Could not interpret this description. Please use the trip details form.');}
  finally{button.disabled=false;}
 });
 input.addEventListener('input',()=>{if(readyToSend){readyToSend=false;setButtonMode('interpret');}});
 form.addEventListener('input',event=>{const key=event.target.name;if((!Object.hasOwn(tripFields,key)&&key!=='notes')||review.hidden)return;const field=event.target;field.classList.toggle('needs-confirmation',false);if(lastDraft){lastDraft.fields[key]=field.value||undefined;renderReview(lastDraft);}});
 document.addEventListener('timing:language',()=>{if(lastDraft)renderReview(lastDraft);setButtonMode(readyToSend?'send':'interpret');});
 setButtonMode('interpret');
}
