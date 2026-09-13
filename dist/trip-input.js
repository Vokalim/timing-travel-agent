import {DemoPreferenceParser,tripFields} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {displayCity} from './lib/discovery/destination-identity.js';
import {parsePreferenceConstraints,preferenceSummary} from './lib/preference-constraints.js';
import {knownDisplayLabel,displayTravelPeriod} from './lib/display-localization.js';
import {createTemporalContext} from './lib/discovery/temporal-context.js';

const isZh=()=>document.documentElement.lang.startsWith('zh');
const t=(zh,en)=>isZh()?zh:en;

// UI integration only: interpreting fills a draft and never changes search logic.
export function setupTripInput(form,onDraftChange,parser=new FallbackPreferenceParser(new LLMPreferenceParser(),new DemoPreferenceParser())){
 const input=document.querySelector('#trip-description'),button=document.querySelector('#interpret-trip'),review=document.querySelector('#trip-review'),status=document.querySelector('#agent-status');
 const travelIntents=document.createElement('input');travelIntents.type='hidden';travelIntents.name='travelIntents';form.append(travelIntents);
 let lastDraft;
 const renderReview=draft=>{
  review.hidden=false;review.replaceChildren();
  const fields=draft.fields,interpretation=draft.interpretation||{};
  const uiLanguage=isZh()?'zh':'en',period=createTemporalContext({earliestDeparture:fields.start||null,latestDeparture:fields.end||null,departureWindowText:draft.dateHint||interpretation.departureWindowText||''},{language:uiLanguage});const title=document.createElement('strong');title.textContent=[fields.origin?`${displayCity(fields.origin,uiLanguage)}${fields.destination?' → '+displayCity(fields.destination,uiLanguage):t('出发',' departure')}`:null,!fields.destination&&t('目的地交给途米','Destination by Timing'),draft.dateHint||interpretation.departureWindowText||fields.start?displayTravelPeriod(period,uiLanguage):null,fields.nights&&t(`${fields.nights} 天`,`${fields.nights} days`),(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget)&&`¥${Number(fields.totalTripBudgetCny||interpretation.totalTripBudgetCny||fields.flightBudget).toLocaleString()}`].filter(Boolean).join(' · ');review.append(title);
  const concise=preferenceSummary(parsePreferenceConstraints(fields.notes),uiLanguage);
  const tags=[...(fields.travelIntents||[]).slice(0,3).map(intent=>knownDisplayLabel(intent,uiLanguage)).filter(Boolean),concise?`${t('偏好：','Preferences: ')}${concise}`:interpretation.avoidOvernightFlights===true?t('避开红眼航班','No overnight flights'):null];
  if(tags.filter(Boolean).length){const small=document.createElement('p');small.textContent=tags.filter(Boolean).join(' · ');review.append(small);}
  if(draft.parserStatus==='fallback'||draft.parserStatus==='demo'){const warning=document.createElement('small');warning.textContent=t('AI 暂不可用 · 已用本地解析，请核对条件','AI unavailable · Local fallback used; please review');review.append(warning);}
  const edit=document.createElement('button');edit.type='button';edit.textContent=t('修改条件','Edit conditions');edit.addEventListener('click',()=>{const details=document.querySelector('#structured-details');if(details){details.open=true;details.scrollIntoView?.({behavior:'smooth',block:'start'});}});review.append(edit);
 };
 button.addEventListener('click',async()=>{
  console.info('[Timing] Explore click received');
  if(!input.value.trim()){review.hidden=false;review.textContent=t('请先描述你的旅行，当前条件没有改变。','Describe your trip first. Your form has not changed.');return;}
  button.disabled=true;status.hidden=false;
  try{const draft=await parser.parse(input.value);lastDraft=draft;for(const key of [...Object.keys(tripFields),'notes']){const field=form.elements.namedItem(key);field.value=draft.fields[key]??'';field.classList.toggle('needs-confirmation',key==='origin'&&draft.needsConfirmation.includes(key));field.setAttribute('aria-describedby','trip-review');}const total=form.elements.namedItem('totalTripBudgetCny');if(total)total.value=draft.fields.totalTripBudgetCny??draft.interpretation?.totalTripBudgetCny??'';travelIntents.value=draft.fields.travelIntents.join(',');renderReview(draft);onDraftChange(draft);}
  catch{status.hidden=true;review.hidden=false;review.textContent=t('无法理解这段描述，请使用旅行条件表单。','Could not interpret this description. Please use the trip details form.');}
  finally{button.disabled=false;}
 });
 form.addEventListener('input',event=>{const key=event.target.name;if((!Object.hasOwn(tripFields,key)&&key!=='notes')||review.hidden)return;const field=event.target;field.classList.toggle('needs-confirmation',false);if(lastDraft){lastDraft.fields[key]=field.value||undefined;renderReview(lastDraft);}});
 document.addEventListener('timing:language',()=>{if(lastDraft)renderReview(lastDraft);});
}
