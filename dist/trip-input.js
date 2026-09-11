import {DemoPreferenceParser,tripFields} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';

const zhLabels={origin:'出发地',destination:'目的地',start:'最早出发日期',end:'最晚出发日期',nights:'旅行时长',flightBudget:'往返机票预算',hotelBudget:'每晚酒店预算',rating:'酒店最低评分'};
const isZh=()=>document.documentElement.lang.startsWith('zh');
const t=(zh,en)=>isZh()?zh:en;

// UI integration only: interpreting fills a draft and never changes search logic.
export function setupTripInput(form,onDraftChange,parser=new FallbackPreferenceParser(new LLMPreferenceParser(),new DemoPreferenceParser())){
 const input=document.querySelector('#trip-description'),button=document.querySelector('#interpret-trip'),review=document.querySelector('#trip-review'),status=document.querySelector('#agent-status');
 const travelIntents=document.createElement('input');travelIntents.type='hidden';travelIntents.name='travelIntents';form.append(travelIntents);
 let lastDraft;
 const renderReview=draft=>{
  review.hidden=false;review.replaceChildren();
  const summary=document.createElement('p');summary.textContent=draft.parserStatus==='ai'?t(`AI 已理解你的描述${draft.model?` · ${draft.model}`:''}。请确认或修改以下条件。`,`AI interpretation${draft.model?` · ${draft.model}`:''}. Review or edit the details below.`):t('AI 暂时不可用。以下内容来自本地解析，请逐项确认。','AI interpretation was unavailable. This draft came from the local fallback parser; review every field.');review.append(summary);
  const list=document.createElement('ul');
  for(const [key,enLabel] of Object.entries(tripFields)){const item=document.createElement('li');item.dataset.tripField=key;const value=draft.fields[key];item.textContent=`${isZh()?zhLabels[key]:enLabel}：${value??t('需要确认','Needs confirmation')}`;list.append(item);}review.append(list);
  const themes=document.createElement('p');themes.textContent=`${t('旅行主题','Travel themes')}：${draft.fields.travelIntents.length?draft.fields.travelIntents.join(', '):t('未识别','none recognized')}。${t('主题暂不影响当前评分。','Themes do not affect current scoring yet.')}`;review.append(themes);
  if(draft.interpretation){const state=document.createElement('p');state.textContent=`${t('目的地状态','Destination state')}：${draft.interpretation.destinationState} · ${t('红眼航班','Overnight flights')}：${draft.interpretation.avoidOvernightFlights===true?t('避开','avoid'):draft.interpretation.avoidOvernightFlights===false?t('可以','allowed'):t('未说明','not stated')}`;review.append(state);}
  for(const message of [draft.dateHint&&`${t('日期描述','Date wording')}：${draft.dateHint}`,...draft.warnings,draft.fields.notes&&`${t('已记录偏好','Captured preferences')}：${draft.fields.notes}`,draft.parserStatus==='fallback'&&`${draft.fallbackReason} ${t('此结果明确标记为本地解析。','This result is explicitly labeled as local fallback.')}`]){if(!message)continue;const p=document.createElement('p');p.textContent=message;review.append(p);}
 };
 button.addEventListener('click',async()=>{
  console.info('[Timing] Explore click received');
  if(!input.value.trim()){review.hidden=false;review.textContent=t('请先描述你的旅行，当前条件没有改变。','Describe your trip first. Your form has not changed.');return;}
  button.disabled=true;status.hidden=false;
  try{const draft=await parser.parse(input.value);lastDraft=draft;for(const key of [...Object.keys(tripFields),'notes']){const field=form.elements.namedItem(key);field.value=draft.fields[key]??'';field.classList.toggle('needs-confirmation',draft.needsConfirmation.includes(key));field.setAttribute('aria-describedby','trip-review');}travelIntents.value=draft.fields.travelIntents.join(',');renderReview(draft);onDraftChange(draft);}
  catch{status.hidden=true;review.hidden=false;review.textContent=t('无法理解这段描述，请使用旅行条件表单。','Could not interpret this description. Please use the trip details form.');}
  finally{button.disabled=false;}
 });
 form.addEventListener('input',event=>{const key=event.target.name;if(!Object.hasOwn(tripFields,key)||review.hidden)return;const field=event.target;field.classList.toggle('needs-confirmation',!field.value);const item=review.querySelector(`[data-trip-field="${key}"]`);if(item)item.textContent=`${isZh()?zhLabels[key]:tripFields[key]}：${field.value||t('需要确认','Needs confirmation')}`;});
 document.addEventListener('timing:language',()=>{if(lastDraft)renderReview(lastDraft);});
}
