import {searchTravel} from './lib/travel-service.js';
import {setupTripInput} from './trip-input.js';
import {applyCompletePlanDefaults} from './lib/complete-plan-defaults.js';
import {DemoPreferenceParser} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {discoverDestinations,DestinationRecommendationSession,destinationRequestKey} from './lib/discovery/destination-discovery.js';
import {InspirationService} from './lib/discovery/inspiration-service.js';
import {nextClarification} from './lib/discovery/clarification.js';
import {displayCity,presentDestination} from './lib/discovery/destination-identity.js';
import {LocalDestinationVisualProvider} from './lib/discovery/destination-visual-provider.js';
import {planTrip,prepareExploration} from './lib/planning-service.js';
import {preferenceSummary} from './lib/preference-constraints.js';
import {TripWorkspaceSession} from './lib/trip-workspace.js';
import {renderTripHero,renderTripSections,renderTripTimingControls} from './trip-view.js';
import {presentDiscoveryCandidate,displayTransportStatus,displayLabel} from './lib/display-localization.js';
import {planningCandidateForDestination} from './lib/discovery/destination-access-resolver.js';
import {getDestination} from './lib/discovery/destination-universe.js';

const form=document.querySelector('#trip-form'),output=document.querySelector('#results');
const modeControl=document.querySelector('#data-mode'),indicator=document.querySelector('#source-indicator');
const notice=document.querySelector('#source-notice'),resultsState=document.querySelector('#results-state');
const agentStatus=document.querySelector('#agent-status'),structured=document.querySelector('#structured-details');
let result,discoveryResult,clarificationDraft,independentTrip,selected,language='zh',requestId=0,editVersion=0,discoveryFilter='all',chosenCandidate=null;
let tripWorkspace=null,tripWorkspaceKey='',preferredTripPace=null,preferredSpendingOrientation=null;
function workspaceFor({trip,plan,flightVerification,candidate=null,key}){
 if(!tripWorkspace||tripWorkspaceKey!==key){tripWorkspace=new TripWorkspaceSession({trip,plan,flightVerification,candidate,pace:preferredTripPace,spendingOrientation:preferredSpendingOrientation});tripWorkspaceKey=key;}
 return tripWorkspace;
}
const discoverySession=new DestinationRecommendationSession();
const discoveryCache=new Map();

const copy={
 zh:{kicker:'你的旅行，从一个念头开始',heroTitle:'找个时机，出发吧。',heroSubtitle:'从一个想法，到一趟完整旅行。告诉途米你想去哪，或想怎么玩。',askLabel:'这次想怎么走？',aiNote:'目的地未定也没关系',explore:'开始探索',inspireLabel:'这个时节适合',refreshInspiration:'换一换',chipChristmas:'过圣诞',chipBeach:'去看海',chipHiking:'去爬山',chipFood:'吃点好的',chipRelax:'放空几天',chipWeekend:'周末短途',workingTitle:'途米正在为你找……',working1:'正在理解你的旅行想法…',working2:'正在寻找合适的目的地…',working3:'正在比较时间与交通…',working4:'正在整理这趟旅行…',editConditions:'查看 / 修改旅行条件',tripDetails:'旅行条件',confirmHint:'没想好也没关系，途米可以先帮你比较',from:'出发地',to:'目的地',earliest:'最早出发',latest:'最晚出发',duration:'旅行时长（晚）',rating:'酒店最低评分',flightBudget:'往返机票预算',hotelBudget:'每晚酒店预算',preferences:'其他偏好（可选）',searchDates:'继续规划',demoMode:'演示',liveMode:'实时',editRequest:'修改需求',stale:'旅行条件已修改，请重新比较。',howDecision:'途米如何做判断',methodPreferences:'<strong>先理解偏好。</strong> AI 只负责整理可复核的旅行条件；不可用时会明确标记本地解析。',methodMath:'<strong>计算保持确定。</strong> 价格、预算、评分和预订时机建议都由固定规则计算。',methodSource:'<strong>来源保持透明。</strong> 演示模式使用模拟数据；实时模式使用 Duffel 航班，酒店仍为演示数据。',footer:'在出发之前，先找到对的时机。'},
 en:{kicker:'YOUR TRIP STARTS WITH AN IDEA',heroTitle:'Find your moment to go.',heroSubtitle:'From one idea to a complete trip. Tell Timing where you want to go or how you want to travel.',askLabel:'What kind of trip are you imagining?',aiNote:'Not sure where to go? That is fine.',explore:'Explore',inspireLabel:'Good for this season',refreshInspiration:'Refresh ideas',chipChristmas:'Christmas',chipBeach:'Beach',chipHiking:'Hiking',chipFood:'Food',chipRelax:'Relax',chipWeekend:'Weekend escape',workingTitle:'Timing is looking for your trip…',working1:'Understanding your trip…',working2:'Finding suitable destinations…',working3:'Comparing dates and transport…',working4:'Putting the trip together…',editConditions:'View / edit trip details',tripDetails:'Trip details',confirmHint:'Not sure yet? Timing can compare first.',from:'From',to:'To',earliest:'Earliest departure',latest:'Latest departure',duration:'Trip duration (nights)',rating:'Minimum hotel rating',flightBudget:'Round-trip flight budget',hotelBudget:'Hotel budget per night',preferences:'Other preferences (optional)',searchDates:'Continue planning',demoMode:'Demo',liveMode:'Live',editRequest:'Edit request',stale:'Your trip details changed. Compare again.',howDecision:'How Timing makes a decision',methodPreferences:'<strong>Preferences first.</strong> AI creates a reviewable trip draft; local fallback is always clearly labeled.',methodMath:'<strong>Deterministic calculations.</strong> Prices, budgets, scores and BOOK / WAIT / CHANGE DATE use fixed rules.',methodSource:'<strong>Transparent sources.</strong> Demo is simulated; Live uses Duffel flights while hotels remain Demo.',footer:'Find the right moment before you go.'}
};
const tr=(zh,en)=>language==='zh'?zh:en;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat(language==='zh'?'zh-CN':'en-US',{style:'currency',currency:'CNY',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n);
const date=d=>new Date(d+'T00:00:00Z').toLocaleDateString(language==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric',timeZone:'UTC'});

function sourceLabel(mode=modeControl.value,state='ready'){
 if(mode==='demo') return tr('模拟航班与酒店','Mock flights + hotels');
 if(state==='checking') return tr('正在查询 Duffel · 演示酒店','Checking Duffel · Demo hotels');
 if(state==='error') return tr('实时航班不可用 · 演示酒店','Duffel unavailable · Demo hotels');
 return tr('实时航班 · 演示酒店','Duffel flights · Demo hotels');
}
function applyLanguage(next){
 const tripWasOpen=!output.querySelector('#trip-detail')?.hidden&&Boolean(output.querySelector('#trip-detail'));
 language=next;document.documentElement.lang=next==='zh'?'zh-CN':'en';
 document.querySelector('#lang-zh').classList.toggle('active',next==='zh');document.querySelector('#lang-en').classList.toggle('active',next==='en');
 document.querySelectorAll('[data-i18n]').forEach(el=>{const value=copy[next][el.dataset.i18n];if(value!=null) value.includes('<strong>')?el.innerHTML=value:el.textContent=value;});
 document.querySelectorAll('[data-placeholder-zh]').forEach(el=>el.placeholder=el.dataset[next==='zh'?'placeholderZh':'placeholderEn']);
 indicator.textContent=sourceLabel();
 updateGuidance();
 renderInspiration();
 document.dispatchEvent(new CustomEvent('timing:language',{detail:{language}}));
 if(result){document.querySelector('#result-meta').textContent=result.dataSource==='live'?tr('实时航班 · Duffel','LIVE · DUFFEL'):tr('演示数据 · 搜索完成','DEMO · SEARCH COMPLETE');render();if(tripWasOpen)output.querySelector('#trip-detail').hidden=false;}else if(independentTrip)renderStandaloneTrip(independentTrip);else if(discoveryResult){document.querySelector('#result-meta').textContent=tr('目的地灵感','DESTINATION IDEAS');renderDiscovery(discoveryResult);}else if(clarificationDraft)showClarification(clarificationDraft);
}
const inspirationService=new InspirationService();
const visualProvider=new LocalDestinationVisualProvider();
function renderInspiration({refresh=false}={}){
 const input=document.querySelector('#trip-description'),container=document.querySelector('.chips');
 const ideas=(refresh?inspirationService.refresh({text:input.value}):inspirationService.getIdeas({text:input.value}));
 container.replaceChildren();
 for(const idea of ideas){const button=document.createElement('button');button.type='button';button.className='inspire-chip';button.textContent=language==='zh'?idea.zh:idea.en;button.addEventListener('click',()=>{const phrase=language==='zh'?idea.promptZh:idea.promptEn;input.value=input.value.trim()?`${input.value.trim()}${language==='zh'?'，':'. '}${phrase}`:phrase;input.focus();renderInspiration();});container.append(button);}
}

function reasonsFor(b,t){
 if(!b) return [];
 const items=[b.flight.stops===0?tr('直飞','Nonstop'):tr(`${b.flight.stops} 次中转`,`${b.flight.stops} stop${b.flight.stops===1?'':'s'}`),b.budgetStatus==='unconfirmed'?tr('按性价比排序 · 预算未定','Ranked for value · Budget unset'):b.feasible?tr('符合预算','Within budget'):tr('当前超出预算','Over budget'),tr(`适合 ${t.nights} 晚`,`Fits ${t.nights} nights`),tr(`酒店评分 ${b.hotel.rating}` ,`Hotel rating ${b.hotel.rating}`)];
 return items;
}
function detailText(c,t){
 const carrier=c.flight.airline?` · ${escape(result?.dataSource==='demo'&&language==='zh'?'演示航班':c.flight.airline)}`:'';
 const flightBudget=t.flightBudget==null?tr('机票预算未设','Flight budget unset'):c.flight.price>t.flightBudget?tr(`机票超出预算 ${money(c.flight.price-t.flightBudget)}`,`Flight exceeds budget by ${money(c.flight.price-t.flightBudget)}`):tr('机票符合预算','Flight budget met');
 const hotelBudget=t.hotelBudget==null?tr('酒店预算未设','Hotel budget unset'):c.hotel.nightly>t.hotelBudget?tr(`酒店每晚超出预算 ${money(c.hotel.nightly-t.hotelBudget)}`,`Hotel exceeds nightly budget by ${money(c.hotel.nightly-t.hotelBudget)}`):tr('酒店符合每晚预算','Hotel budget met');
 return `${tr('往返机票','Round-trip flight')} ${money(c.flight.price)}${carrier} + ${tr('酒店','hotel')} ${money(c.hotel.nightly)} × ${t.nights} ${tr('晚','nights')} = <strong>${money(c.total)}</strong>.<br>${flightBudget}. ${hotelBudget}. ${tr('住客评分','Guest rating')} ${c.hotel.rating}/5.`;
}
function render(){
 const {trip:t,best:b,decision:d,candidates:cs,preferences:p}=result;
 const active=cs.find(c=>c.date===selected)||b;
 const displayPlan=active?{...result.plan,windows:[{departure:active.date,returnDate:active.returnDate},...(result.plan?.windows||[]).filter(window=>window.departure!==active.date)]}:result.plan;
 const tripExperience=workspaceFor({trip:t,plan:displayPlan,flightVerification:{status:active?'verified':'not_checked',source:result.dataSource,quote:active?.flight||null},key:`result:${t.origin}:${t.destination}:${active?.date}:${active?.flight?.id}`}).experience;
 const route=`${escape(displayCity(t.origin,language))} → ${escape(displayCity(t.destination,language))}`,max=Math.max(...cs.map(c=>c.total),1);
 const reason=!b?tr('当前没有符合条件的航班与酒店组合。请调整偏好或旅行时间。','No flight and hotel combination matches your current constraints.'):d==='WAIT'?tr('当前没有符合已设置预算的方案；这不是价格下跌预测。','No option fits the budgets you set; this is not a price forecast.'):b.budgetStatus==='unconfirmed'?tr('预算未定，先按价格、便利程度与偏好比较；这里不判断是否负担得起。','With no confirmed budget, this ranks value, convenience and preferences without an affordability claim.'):d==='CHANGE DATE'?tr(`换到 ${date(b.date)} 出发，是当前候选中更划算的选择。`,`Leaving on ${date(b.date)} is better value among the current candidates.`):tr('这是当前候选中评分最高、且符合预算的选择。','This is the highest-scoring current candidate that fits your budget.');
 const detail=cs.length?`<section id="trip-detail" class="detail-shell" hidden><div class="detail-heading"><div><h2>${tr('这趟旅行','Trip detail')}</h2><p>${route}${b?` · ${date(b.date)} – ${date(b.returnDate)}`:''}</p></div><span class="badge ${d==='WAIT'?'wait':d==='CHANGE DATE'?'change':''}">${displayLabel(d,language)}</span></div>${renderTripHero(tripExperience,language)}${renderTripTimingControls(tripExperience,language)}<div class="timing-copy"><h3>${tr('为什么是这个时间？','Why this timing?')}</h3><p>${reason}</p></div><div class="chart" aria-label="${tr('不同出发日期的旅行总价','Total trip cost by departure date')}">${cs.map(c=>`<button class="bar-col ${c.date===selected?'active':''}" data-date="${c.date}" aria-label="${date(c.date)}, ${money(c.total)}"><strong>${money(c.total)}</strong><span class="bar" style="height:${Math.round(c.total/max*105)}px"><b style="height:${c.flight.price/c.total*100}%"></b></span><span>${date(c.date)}</span></button>`).join('')}</div><div class="table-wrap"><table><thead><tr><th>${tr('出发日期','DEPARTURE')}</th><th>${tr('航班','FLIGHT')}</th><th>${tr('演示酒店 / 晚','DEMO HOTEL / NIGHT')}</th><th>${tr('总价','TOTAL')}</th><th>${tr('匹配度','FIT')}</th></tr></thead><tbody>${cs.map(c=>`<tr class="${c.date===selected?'selected':''}"><td data-label="${tr('出发日期','Departure')}"><button class="row-button" data-date="${c.date}">${date(c.date)} – ${date(c.returnDate)}</button><small>${c.date===b?.date&&b.feasible?tr('✦ 推荐','✦ Recommended'):c.budgetStatus==='unconfirmed'?tr('预算未定','Budget unset'):c.feasible?tr('预算内','Within budgets'):tr('超出预算','Over budget')}</small></td><td data-label="${tr('航班','Flight')}">${money(c.flight.price)}<small>${escape(result.dataSource==='demo'&&language==='zh'?'演示航班':c.flight.airline||'')} · ${c.flight.stops?tr(`${c.flight.stops} 次中转`,`${c.flight.stops} stop${c.flight.stops===1?'':'s'}`):tr('直飞','Nonstop')}</small></td><td data-label="${tr('演示住宿 / 晚','Demo stay / night')}">${money(c.hotel.nightly)}<small>★ ${c.hotel.rating}</small></td><td data-label="${tr('总价','Total')}"><strong>${money(c.total)}</strong></td><td data-label="${tr('匹配度','Fit')}"><span class="score">${c.score}/100</span></td></tr>`).join('')}</tbody></table></div><div class="selection">${selection(cs.find(c=>c.date===selected)||b,t)}</div>${renderTripSections(tripExperience,language)}</section>`:'';
 output.innerHTML=`${result.plan?.dateSource==='system_generated_exploration_window'?`<p class="source-footnote">${tr('以下是系统生成的探索日期，尚未确定；之后可修改具体日期。','These are provisional exploration dates; you can lock exact dates later.')}</p>`:''}${result.plan?.durationRange?`<p class="source-footnote">${tr(`暂按 ${result.plan.nights} 晚比较（建议 ${result.plan.durationRange[0]}–${result.plan.durationRange[1]} 晚），可以修改。`,`Comparing ${result.plan.nights} nights provisionally (${result.plan.durationRange[0]}–${result.plan.durationRange[1]} suggested); editable.`)}</p>`:''}<article class="recommendation"><div class="rec-top"><span class="badge ${d==='WAIT'?'wait':d==='CHANGE DATE'?'change':''}">${displayLabel(d,language)}</span><span class="rec-label">${tr('途米推荐','TIMING RECOMMENDS')}</span></div><h2 class="rec-route">${route}</h2>${b?`<p class="rec-dates">${date(b.date)} – ${date(b.returnDate)}</p>`:''}<p>${reason}</p>${b?`<div class="rec-summary"><div class="rec-cost"><small>${result.dataSource==='live'?tr('含演示酒店估算的旅行总价','TOTAL WITH DEMO HOTEL ESTIMATE'):tr('演示旅行总价估算','DEMO TOTAL ESTIMATE')}</small><strong>${money(b.total)}</strong></div><div class="fit-reasons"><span>${tr('为什么适合你','WHY IT FITS')}</span><ul>${reasonsFor(b,t).map(x=>`<li>${x}</li>`).join('')}</ul></div></div><button type="button" class="view-trip">${tr('查看这趟旅行','View this trip')} →</button>`:''}</article>${detail}<p class="source-footnote">${result.dataSource==='live'?tr('Duffel 实时航班 · 演示酒店数据','Duffel live flights · Demo hotel'):tr('演示数据 · 模拟航班与酒店','Demo data · Mock flight and hotel prices')} · ${p.priority==='comfort'?tr('舒适优先','comfort priority'):tr('性价比优先','best value')}</p>`;
 bindResults();
}
function selection(c,t){return `<h3>${tr('演示酒店','Demo hotel')} · ${escape(language==='zh'?'酒店参考方案':c.hotel.name)} · ${date(c.date)} – ${date(c.returnDate)}</h3><p>${detailText(c,t)}</p>`}
function bindResults(){
 output.querySelector('.view-trip')?.addEventListener('click',()=>{const el=output.querySelector('#trip-detail');el.hidden=false;el.scrollIntoView({behavior:'smooth',block:'start'});});
 output.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('click',()=>{const open=!output.querySelector('#trip-detail')?.hidden;selected=el.dataset.date;tripWorkspace=null;render();if(open){const detail=output.querySelector('#trip-detail');detail.hidden=false;}}));
}
function renderStandaloneTrip(state){
 independentTrip=state;result=undefined;discoveryResult=undefined;
 const {trip,plan,flightVerification,candidate}=state,experience=workspaceFor({trip,plan,flightVerification,candidate,key:`standalone:${trip.origin}:${trip.destination}:${plan.windows[0]?.departure}:${trip.nights}`}).experience;
 const windows=plan.windows.slice(0,3).map(window=>`<span>${date(window.departure)} – ${date(window.returnDate)}</span>`).join(' · ');
 const timing=plan.dateSource==='user_provided'?tr('你选择的旅行时间','Your travel window'):tr('系统生成的探索日期 · 可在旅行条件中修改','Provisional exploration dates · Edit in trip details');
 output.innerHTML=`<section id="trip-detail" class="detail-shell standalone-trip">${renderTripHero(experience,language)}${renderTripTimingControls(experience,language)}<p class="trip-window-list">${windows}</p>${candidate?`<p class="trip-availability">${escape(displayTransportStatus(candidate,language))}</p>`:''}${renderTripSections(experience,language)}</section>`;
 resultsState.hidden=false;document.querySelector('#result-meta').textContent=tr('旅行规划','TRIP PLAN');resultsState.scrollIntoView({behavior:'smooth',block:'start'});
}
function showClarification(draft){
 const question=nextClarification(draft.interpretation);
 if(!question){runDiscovery(draft,{skip:true});return;}
 clarificationDraft=draft;
 agentStatus.hidden=true;resultsState.hidden=false;
 document.querySelector('#result-meta').textContent=tr('再了解一点','ONE QUICK QUESTION');
 output.innerHTML=`<section class="clarification"><span class="eyebrow">${tr('旅行灵感','TRIP INSPIRATION')}</span><h2>${escape(language==='zh'?question.questionZh:question.questionEn)}</h2><div class="clarification-options">${question.options.map((option,index)=>`<button type="button" data-choice="${index}">${escape(language==='zh'?option.zh:option.en)}</button>`).join('')}<button type="button" data-choice="skip" class="skip-choice">${tr('先看推荐','Show ideas first')} →</button></div><p>${tr('只问这一个问题，也可以直接看灵感。','Just one question, or browse ideas right away.')}</p></section>`;
 output.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{
  const value=button.dataset.choice;
  if(value!=='skip'){
   const selected=question.options[Number(value)].value;
   if(question.kind==='theme')draft.interpretation.travelIntents=[...new Set([...(draft.interpretation.travelIntents||[]),selected])];
   if(question.kind==='time'&&selected!=='flexible')draft.interpretation.departureWindowText=selected;
   if(question.kind==='budget')draft.interpretation.totalTripBudgetCny=selected;
  }
  runDiscovery(draft,{skip:true});
 }));
 resultsState.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderDiscovery(data,advance=false){
 const visible=data.candidates.filter(candidate=>discoveryFilter==='all'||(discoveryFilter==='domestic')===(candidate.countryOrRegion==='China'));
 const pageKey=`${data.requestKey}:${discoveryFilter}`,pagePreferences={...(data.displayPreferences||{}),requestKey:pageKey};
 const discoveryVisible=advance?discoverySession.next(pageKey,visible,pagePreferences,3):discoverySession.page(pageKey,visible,pagePreferences,3);
 const [best,...rest]=discoveryVisible;
 const filter=`<nav class="discovery-filters" aria-label="${tr('目的地范围','Destination region')}">${[['all','全部','All'],['domestic','国内','Domestic'],['international','出境','International']].map(([key,zh,en])=>`<button type="button" data-region="${key}" aria-pressed="${discoveryFilter===key}">${tr(zh,en)}</button>`).join('')}</nav>`;
 if(!best){output.innerHTML=`${filter}<p class="empty">${tr('这个范围暂时没有建议，试试其他范围。','No ideas in this region yet. Try another region.')}</p>`;bindDiscovery(data);return;}
 const alternatives=rest,visual=visualProvider.getVisual(best),bestDisplay=presentDiscoveryCandidate(best,data,language);
 const images=[visual.heroImages[0],visual.scenicImages[0]||visual.heroImages[0]].filter(Boolean).slice(0,2);
 const statement=bestDisplay.statement;
 const tags=bestDisplay.tags;
 const baselineTrip={...data.planning.trip,origin:data.preferences.origin,destination:best.city,nights:data.planning.nights,travelIntents:data.preferences.travelIntents||[],spendingOrientation:data.preferences.spendingOrientation||'value'};
 const baselinePlan={...data.planning,windows:data.dateWindows.length?data.dateWindows:data.planning.windows},baseline=workspaceFor({trip:baselineTrip,plan:baselinePlan,flightVerification:best.verification,candidate:best,key:`discovery:${data.requestKey}:${best.id}`}).experience;
 output.innerHTML=`${filter}<article class="discovery-feature"><div class="feature-art ${images.length>1?'has-secondary':''}" aria-hidden="true">${images.map((item,index)=>`<img class="${index?'secondary-image':'primary-image'}" src="${escape(item.src)}" alt="" loading="lazy">`).join('')}<svg class="destination-route-motif"><use href="#motif-route"/></svg><svg class="destination-pin-motif"><use href="#motif-map-pin"/></svg></div><div class="feature-copy"><span class="eyebrow">${tr('为你找到一个不错的方向','A PLACE TO START')}</span><h2>${escape(bestDisplay.city)}</h2><span class="feature-region">${escape(bestDisplay.country)} · ${best.score}% ${tr('契合','match')}</span><div class="feature-tags">${tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div><p>${escape(statement)}</p><small>${bestDisplay.transportStatus}</small><button type="button" class="choose-destination" data-city="${escape(best.city)}">${tr('查看日期价格','Compare exact dates')} <b>→</b></button></div></article><section class="discovery-alternatives"><div class="alternatives-heading"><span>${tr('下一站，也可以是','YOUR NEXT OPTION')}</span><h3>${tr('也可以看看','Also worth a look')}</h3></div><div class="idea-list">${alternatives.map(candidate=>{const display=presentDestination(candidate,language),alternativeVisual=visualProvider.getVisual(candidate),thumb=alternativeVisual.heroImages[0];return `<article>${thumb?`<img src="${escape(thumb.src)}" alt="" loading="lazy">`:''}<div class="idea-copy"><div><strong>${escape(display.city)}</strong><span>${escape(display.country)}</span></div><b>${candidate.score}%</b><p>${escape(presentDiscoveryCandidate(candidate,data,language).statement)}</p><small>${displayTransportStatus(candidate,language)}</small><button type="button" class="choose-destination" data-city="${escape(candidate.city)}">${tr('查看','Explore')} →</button></div></article>`;}).join('')}</div>${visible.length>3?`<button type="button" id="show-more-ideas">${tr('换一批','Next set')}</button>`:''}<p class="source-footnote">${data.source==='openai'?tr('目的地灵感来自智能提议与精选目录，交通信息单独核验。','Ideas combine AI suggestions and a curated catalog; transport is checked separately.'):tr('AI 暂不可用 · 使用通用目的地灵感。','AI unavailable · General destination ideas shown.')} ${data.dateWindows.length?tr('日期仅用于探索比较，尚未由你确认。','Dates are exploratory and not confirmed by you.'):''}</p></section><section class="baseline-plan"><div class="baseline-heading"><span>${tr('途米先为你准备的基础方案','YOUR STARTING PLAN')}</span><h2>${tr('先从这套完整方案开始','Start with a complete plan')}</h2></div>${renderTripHero(baseline,language)}${renderTripTimingControls(baseline,language)}${renderTripSections(baseline,language)}</section>`;
 if(data.planning?.durationRange){const hint=document.createElement('p');hint.className='source-footnote';hint.textContent=tr(`暂按 ${data.planning.nights} 晚探索（建议 ${data.planning.durationRange[0]}–${data.planning.durationRange[1]} 晚），可在旅行条件中修改。`,`Exploring ${data.planning.nights} nights provisionally (${data.planning.durationRange[0]}–${data.planning.durationRange[1]} suggested). Edit this in trip details.`);output.append(hint);}
 bindDiscovery(data);
}
function bindDiscovery(data){
 output.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{discoveryFilter=button.dataset.region;renderDiscovery(data);}));
 output.querySelector('#show-more-ideas')?.addEventListener('click',()=>renderDiscovery(data,true));
 output.querySelectorAll('.choose-destination').forEach(button=>button.addEventListener('click',()=>{chosenCandidate=data.candidates.find(item=>item.city===button.dataset.city)||null;form.elements.namedItem('destination').value=button.dataset.city;run();}));
}
function formTrip(){const t=Object.fromEntries(new FormData(form));for(const key of ['nights','flightBudget','hotelBudget','rating','totalTripBudgetCny'])t[key]=t[key]===''?null:Number(t[key]);t.origin=getDestination(t.origin)?.canonicalName||t.origin;t.destination=getDestination(t.destination)?.canonicalName||t.destination?.trim()||null;t.start=t.start||null;t.end=t.end||null;return t;}
function updateGuidance(){try{document.querySelector('#planning-guidance').textContent=prepareExploration(formTrip(),{language}).guidance||'';}catch{document.querySelector('#planning-guidance').textContent='';}}
async function runDiscovery(draft,{skip=false}={}){
 const current=formTrip(),plan=prepareExploration(current,{language});
 const preferences={...draft.interpretation,...current,origin:current.origin,destination:null,durationDays:current.nights||plan.nights,earliestDeparture:current.start,latestDeparture:current.end,departureWindowText:current.departureWindowText||draft.dateHint||draft.interpretation?.departureWindowText||'',flightBudgetCny:current.flightBudget,hotelBudgetPerNightCny:current.hotelBudget,minimumHotelRating:current.rating,travelIntents:draft.fields.travelIntents||[],constraints:plan.trip.constraints};
 if(!skip&&nextClarification(preferences)){showClarification(draft);return;}
 const id=++requestId,mode=modeControl.value,started=Date.now(),cacheKey=destinationRequestKey(preferences,mode);result=undefined;independentTrip=undefined;clarificationDraft=undefined;discoveryFilter=preferences.geographyPreference||(preferences.domesticAllowed===false?'international':preferences.internationalAllowed===false?'domestic':'all');agentStatus.hidden=false;resultsState.hidden=true;notice.hidden=true;
 agentStatus.querySelector('strong').textContent=tr('途米正在寻找适合的旅行……','Timing is finding your trip…');agentStatus.querySelector('ul').innerHTML=`<li class="done">${tr('正在理解你的旅行想法…','Understanding your trip…')}</li><li>${tr('正在寻找合适的目的地…','Finding suitable destinations…')}</li><li>${tr('正在比较时间与交通…','Comparing dates and transport…')}</li><li>${tr('正在整理这趟旅行…','Putting the trip together…')}</li>`;
 try{let next=discoveryCache.get(cacheKey);if(!next){next=await discoverDestinations(preferences,{mode,language});discoveryCache.set(cacheKey,next);}if(id!==requestId)return;await new Promise(resolve=>setTimeout(resolve,Math.max(0,350-(Date.now()-started))));if(id!==requestId)return;discoveryResult={...next,requestKey:cacheKey,planning:plan,preferences};renderDiscovery(discoveryResult);resultsState.hidden=false;document.querySelector('#result-meta').textContent=tr('完整旅行建议','COMPLETE TRIP IDEA');resultsState.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(id!==requestId)return;resultsState.hidden=false;output.innerHTML=`<p class="empty">${tr('暂时无法获取旅行灵感，请稍后重试或修改条件。','Travel ideas are unavailable right now. Try again or edit your trip.')}</p>`;notice.hidden=false;notice.textContent=tr('请稍后重试。','Please try again later.');}finally{if(id===requestId)agentStatus.hidden=true;}
}
function showLiveUnavailable(message,trip){
 result=undefined;output.innerHTML='';resultsState.hidden=false;document.querySelector('#result-meta').textContent=tr('实时数据不可用','LIVE UNAVAILABLE');indicator.textContent=sourceLabel('live','error');notice.hidden=false;
 notice.innerHTML=`<strong>${tr('实时航班数据暂时不可用','Live flight data is temporarily unavailable')}</strong><p>${tr('先为你保留目的地与行程建议；不会用模拟航班替代实时价格。','Your destination and itinerary suggestions are preserved; mock flights will not replace live prices.')}</p><button type="button" id="use-demo">${tr('切换到演示模式','Use Demo Mode')}</button>`;
 notice.querySelector('#use-demo').addEventListener('click',()=>{modeControl.value='demo';changeMode();});resultsState.scrollIntoView({behavior:'smooth'});
 if(trip?.destination){renderStandaloneTrip({trip,plan:prepareExploration(trip,{language}),flightVerification:{status:'unavailable',source:'live'}});}
}
async function run(){
 const id=++requestId,version=editVersion,mode=modeControl.value,button=document.querySelector('#submit');
 tripWorkspace=null;tripWorkspaceKey='';
 button.disabled=true;agentStatus.hidden=false;notice.hidden=true;document.querySelector('#error').textContent='';indicator.textContent=sourceLabel(mode,'checking');
 try{const t=formTrip();if(!t.origin?.trim())throw new Error(tr('请填写出发地，再继续规划。','Add an origin to continue planning.'));if(!t.destination){button.disabled=false;agentStatus.hidden=true;await runDiscovery({fields:{travelIntents:t.travelIntents?.split(',').filter(Boolean)||[]},interpretation:{...t,destinationState:'discovery_required',departureWindowText:t.departureWindowText}},{skip:true});return;}const plan=prepareExploration(t,{language}),candidate=chosenCandidate?.city===t.destination?chosenCandidate:planningCandidateForDestination(t.destination,mode);if(candidate&&(!candidate.access?.flightAccess.providerLookup||candidate.access.flightAccess.requiresOnwardTransfer)){renderStandaloneTrip({trip:plan.trip,plan,flightVerification:candidate.verification,candidate});return;}if(['train','self_drive'].includes(plan.trip.constraints.hard.transportModeRequired)){renderStandaloneTrip({trip:plan.trip,plan,flightVerification:{status:'not_checked',source:mode},candidate});return;}const next=await planTrip(t,mode,{language});if(id!==requestId)return;if(!next.best){renderStandaloneTrip({trip:next.trip,plan:next.plan,flightVerification:{status:'unavailable',source:mode},candidate});return;}independentTrip=undefined;discoveryResult=undefined;result=next;selected=result.best?.date;render();resultsState.hidden=false;indicator.textContent=sourceLabel(mode);document.querySelector('#result-meta').textContent=mode==='live'?tr('实时航班 · Duffel','LIVE · DUFFEL'):tr('演示数据 · 搜索完成','DEMO · SEARCH COMPLETE');document.querySelector('#stale').hidden=version===editVersion;resultsState.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(id!==requestId)return;if(mode==='live'&&form.elements.namedItem('origin').value.trim())showLiveUnavailable(error.message,formTrip());else{structured.open=true;document.querySelector('#error').textContent=error.message;}}finally{if(id===requestId){button.disabled=false;agentStatus.hidden=true;button.querySelector('span').textContent=copy[language].searchDates;}}
}
function changeMode(){++requestId;result=undefined;independentTrip=undefined;discoveryResult=undefined;clarificationDraft=undefined;output.innerHTML='';resultsState.hidden=true;notice.hidden=true;indicator.textContent=sourceLabel();}

function refreshTripModules(){
 if(!tripWorkspace)return;
 const wrapper=document.createElement('div');wrapper.innerHTML=`${renderTripHero(tripWorkspace.experience,language)}${renderTripTimingControls(tripWorkspace.experience,language)}${renderTripSections(tripWorkspace.experience,language)}`;
 const hero=wrapper.querySelector('.trip-hero');if(hero)output.querySelector('.trip-hero')?.replaceWith(hero);
 for(const section of wrapper.querySelectorAll('[data-trip-module]'))output.querySelector(`[data-trip-module="${section.dataset.tripModule}"]`)?.replaceWith(section);
}
async function commitTripRefinement(){
 if(!tripWorkspace)return;preferredTripPace=tripWorkspace.pace;preferredSpendingOrientation=tripWorkspace.spendingOrientation;
 const trip=tripWorkspace.trip;
 for(const [key,value] of Object.entries({origin:trip.origin||'',destination:trip.destination||'',start:trip.start||'',end:trip.end||'',nights:trip.nights,departureWindowText:trip.departureWindowText||'',spendingOrientation:tripWorkspace.spendingOrientation})){
  const field=form.elements.namedItem(key);if(field)field.value=value;
 }
 await run();
 const detail=output.querySelector('#trip-detail');if(detail){detail.hidden=false;detail.scrollIntoView({behavior:'smooth',block:'start'});}
}
output.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||!tripWorkspace)return;
 const action=button.dataset.tripAction,pace=button.dataset.tripPace,spending=button.dataset.tripSpending,option=button.dataset.tripDateOption,nights=button.dataset.tripNights;
 if(pace){preferredTripPace=pace;tripWorkspace.changePace(pace);refreshTripModules();return;}
 if(spending){preferredSpendingOrientation=spending;tripWorkspace.changeSpendingOrientation(spending);const field=form.elements.namedItem('spendingOrientation');if(field)field.value=spending;refreshTripModules();return;}
 if(nights){tripWorkspace.changeDuration(Number(nights));await commitTripRefinement();return;}
 if(option){if(option==='custom'){output.querySelector('.trip-custom-dates')?.querySelector('input')?.focus();return;}
  try{tripWorkspace.changeDates(option);await commitTripRefinement();}catch(error){output.querySelector('.trip-editor-feedback').textContent=error.message;}return;}
 if(action==='date'||action==='duration'){
  for(const panel of output.querySelectorAll('[data-trip-editor]'))panel.hidden=panel.dataset.tripEditor!==action?true:!panel.hidden;
  return;
 }
 if(action==='style'){output.querySelector('.trip-style-controls')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
 if(action==='stay'){const feedback=button.closest('[data-trip-module="stay"]')?.querySelector('.stay-feedback');if(feedback)feedback.textContent=tr('住宿实时库存尚未接入，已为你保留推荐区域。','Live stay inventory is not connected; your recommended area is saved.');return;}
 if(action==='apply-date'){
  const departure=output.querySelector('[data-trip-field="departure"]')?.value,returnDate=output.querySelector('[data-trip-field="return"]')?.value;
  try{tripWorkspace.changeDates('custom',{departure,returnDate});await commitTripRefinement();}catch(error){output.querySelector('.trip-editor-feedback').textContent=error.message;}return;
 }
 if(action==='apply-duration'){
  try{tripWorkspace.changeDuration(Number(output.querySelector('[data-trip-field="nights"]')?.value));await commitTripRefinement();}catch(error){output.querySelector('[data-trip-editor="duration"] p').textContent=error.message;}return;
 }
 const day=Number(button.dataset.day),activityId=button.dataset.activity;
 const before=tripWorkspace.experience;
 if(action==='remove')tripWorkspace.removeActivity(day,activityId);
 else if(action==='swap')tripWorkspace.swapActivity(day,activityId);
 else if(action==='adjust-day')tripWorkspace.adjustDay(day);
 else if(action==='add-wish'){
  const row=button.closest('[data-trip-day]');if(row.querySelector('.trip-wish-editor'))return;
  const editor=document.createElement('div');editor.className='trip-wish-editor';editor.innerHTML=`<label>${tr('想去哪里？','Where would you like to go?')} <input type="text" maxlength="100"></label><button type="button" data-trip-action="save-wish" data-day="${day}">${tr('加入','Add')}</button>`;button.after(editor);editor.querySelector('input').focus();return;
 }else if(action==='save-wish'){const input=button.closest('.trip-wish-editor')?.querySelector('input'),name=input?.value;if(!name?.trim()){input?.focus();return;}tripWorkspace.addWish(day,name);}
 else return;
 if(before===tripWorkspace.experience){const note=document.createElement('small');note.className='trip-action-note';note.textContent=tr('暂无更多地点，可以加入你想去的地方。','No other place yet; add one you would like to visit.');button.after(note);return;}
 refreshTripModules();
});

modeControl.addEventListener('change',changeMode);form.addEventListener('submit',e=>{e.preventDefault();run();});form.addEventListener('input',()=>{++editVersion;updateGuidance();document.querySelector('#stale').hidden=!result;});
document.querySelector('#edit-request').addEventListener('click',()=>{structured.open=true;document.querySelector('#ask-state').scrollIntoView({behavior:'smooth'});});
document.querySelector('#lang-zh').addEventListener('click',()=>applyLanguage('zh'));document.querySelector('#lang-en').addEventListener('click',()=>applyLanguage('en'));
document.querySelector('#trip-description').addEventListener('input',renderInspiration);
document.querySelector('#refresh-inspiration').addEventListener('click',()=>renderInspiration({refresh:true}));
const preferenceParser=new FallbackPreferenceParser(
 new LLMPreferenceParser({endpoint:'/api/travel/preferences/parse'}),
 new DemoPreferenceParser()
);
const completePlanParser={async parse(text){return applyCompletePlanDefaults(await preferenceParser.parse(text));}};
setupTripInput(form,draft=>{++editVersion;agentStatus.hidden=true;document.querySelector('#stale').hidden=!result;form.elements.namedItem('departureWindowText').value=draft.dateHint||draft.interpretation?.departureWindowText||'';updateGuidance();if(draft.interpretation?.destinationState==='discovery_required')runDiscovery(draft,{skip:draft.originAssumption===true});else form.requestSubmit();},completePlanParser);
applyLanguage('zh');
