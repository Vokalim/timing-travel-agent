import {searchTravel} from './lib/travel-service.js';
import {setupTripInput} from './trip-input.js';
import {DemoPreferenceParser} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {discoverDestinations} from './lib/discovery/destination-discovery.js';

const form=document.querySelector('#trip-form'),output=document.querySelector('#results');
const modeControl=document.querySelector('#data-mode'),indicator=document.querySelector('#source-indicator');
const notice=document.querySelector('#source-notice'),resultsState=document.querySelector('#results-state');
const agentStatus=document.querySelector('#agent-status'),structured=document.querySelector('#structured-details');
let result,discoveryResult,selected,language='zh',requestId=0,editVersion=0;

const copy={
 zh:{kicker:'你的旅行，从一个念头开始',heroTitle:'找个时机，出发吧。',heroSubtitle:'告诉途米你想去哪，或者想要怎样的旅行。',askLabel:'这次想怎么走？',aiNote:'AI 理解需求 · 结果可修改',explore:'开始探索',inspireLabel:'或者，从一种心情开始',chipChristmas:'过圣诞',chipBeach:'去看海',chipHiking:'去爬山',chipFood:'吃点好的',chipRelax:'放空几天',chipWeekend:'周末短途',workingTitle:'途米正在为你找……',working1:'理解旅行偏好',working2:'整理时间与预算',working3:'寻找适合的旅行方案',working4:'比较交通与价格',editConditions:'查看 / 修改旅行条件',tripDetails:'旅行条件',confirmHint:'搜索前请确认',from:'出发地',to:'目的地',earliest:'最早出发',latest:'最晚出发',duration:'旅行时长（晚）',rating:'酒店最低评分',flightBudget:'往返机票预算',hotelBudget:'每晚酒店预算',preferences:'其他偏好（可选）',searchDates:'比较这些日期',editRequest:'修改需求',stale:'旅行条件已修改，请重新比较。',howDecision:'途米如何做判断',methodPreferences:'<strong>先理解偏好。</strong> AI 只负责整理可复核的旅行条件；不可用时会明确标记本地解析。',methodMath:'<strong>计算保持确定。</strong> 价格、预算、评分和 BOOK / WAIT / CHANGE DATE 都由固定规则计算。',methodSource:'<strong>来源保持透明。</strong> Demo 为模拟数据；Live 使用 Duffel 航班，酒店仍为 Demo。',footer:'在出发之前，先找到对的时机。'},
 en:{kicker:'YOUR TRIP STARTS WITH AN IDEA',heroTitle:'Find your moment to go.',heroSubtitle:'Tell Timing where you want to go — or what kind of trip you want.',askLabel:'What kind of trip are you imagining?',aiNote:'AI interpretation · Fully editable',explore:'Explore',inspireLabel:'Or start with a feeling',chipChristmas:'Christmas',chipBeach:'Beach',chipHiking:'Hiking',chipFood:'Food',chipRelax:'Relax',chipWeekend:'Weekend escape',workingTitle:'Timing is looking for your trip…',working1:'Understanding your preferences',working2:'Organising dates and budget',working3:'Finding suitable options',working4:'Comparing transport and price',editConditions:'View / edit trip details',tripDetails:'Trip details',confirmHint:'Confirm before searching',from:'From',to:'To',earliest:'Earliest departure',latest:'Latest departure',duration:'Trip duration (nights)',rating:'Minimum hotel rating',flightBudget:'Round-trip flight budget',hotelBudget:'Hotel budget per night',preferences:'Other preferences (optional)',searchDates:'Compare these dates',editRequest:'Edit request',stale:'Your trip details changed. Compare again.',howDecision:'How Timing makes a decision',methodPreferences:'<strong>Preferences first.</strong> AI creates a reviewable trip draft; local fallback is always clearly labeled.',methodMath:'<strong>Deterministic calculations.</strong> Prices, budgets, scores and BOOK / WAIT / CHANGE DATE use fixed rules.',methodSource:'<strong>Transparent sources.</strong> Demo is simulated; Live uses Duffel flights while hotels remain Demo.',footer:'Find the right moment before you go.'}
};
const tr=(zh,en)=>language==='zh'?zh:en;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat(language==='zh'?'zh-CN':'en-US',{style:'currency',currency:'CNY',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n);
const date=d=>new Date(d+'T00:00:00Z').toLocaleDateString(language==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric',timeZone:'UTC'});

function sourceLabel(mode=modeControl.value,state='ready'){
 if(mode==='demo') return tr('模拟航班与酒店','Mock flights + hotels');
 if(state==='checking') return tr('正在查询 Duffel · 酒店模拟','Checking Duffel · Demo hotels');
 if(state==='error') return tr('Duffel 航班不可用 · 酒店模拟','Duffel unavailable · Demo hotels');
 return tr('Duffel 航班 · 酒店模拟','Duffel flights · Demo hotels');
}
function applyLanguage(next){
 language=next;document.documentElement.lang=next==='zh'?'zh-CN':'en';
 document.querySelector('#lang-zh').classList.toggle('active',next==='zh');document.querySelector('#lang-en').classList.toggle('active',next==='en');
 document.querySelectorAll('[data-i18n]').forEach(el=>{const value=copy[next][el.dataset.i18n];if(value!=null) value.includes('<strong>')?el.innerHTML=value:el.textContent=value;});
 document.querySelectorAll('[data-placeholder-zh]').forEach(el=>el.placeholder=el.dataset[next==='zh'?'placeholderZh':'placeholderEn']);
 indicator.textContent=sourceLabel();
 document.dispatchEvent(new CustomEvent('timing:language',{detail:{language}}));
 if(result) render();else if(discoveryResult)renderDiscovery(discoveryResult);
}

function reasonsFor(b,t){
 if(!b) return [];
 const items=[b.flight.stops===0?tr('直飞','Nonstop'):tr(`${b.flight.stops} 次中转`,`${b.flight.stops} stop${b.flight.stops===1?'':'s'}`),b.feasible?tr('符合预算','Within budget'):tr('当前超出预算','Over budget'),tr(`适合 ${t.nights} 晚`,`Fits ${t.nights} nights`),tr(`酒店评分 ${b.hotel.rating}` ,`Hotel rating ${b.hotel.rating}`)];
 return items;
}
function detailText(c,t){
 const carrier=c.flight.airline?` · ${escape(c.flight.airline)}`:'';
 return language==='zh'?`往返机票 ${money(c.flight.price)}${carrier} + 酒店 ${money(c.hotel.nightly)} × ${t.nights} 晚 = <strong>${money(c.total)}</strong>。<br>${c.flight.price>t.flightBudget?`机票超出预算 ${money(c.flight.price-t.flightBudget)}。`:'机票符合预算。'} ${c.hotel.nightly>t.hotelBudget?`酒店每晚超出预算 ${money(c.hotel.nightly-t.hotelBudget)}。`:'酒店符合每晚预算。'} 住客评分 ${c.hotel.rating}/5。`:`Round-trip flight ${money(c.flight.price)}${carrier} + hotel ${money(c.hotel.nightly)} × ${t.nights} nights = <strong>${money(c.total)}</strong>.<br>${c.flight.price>t.flightBudget?`Flight exceeds budget by ${money(c.flight.price-t.flightBudget)}.`:'Flight budget met.'} ${c.hotel.nightly>t.hotelBudget?`Hotel exceeds nightly budget by ${money(c.hotel.nightly-t.hotelBudget)}.`:'Hotel budget met.'} Guest rating ${c.hotel.rating}/5.`;
}
function render(){
 const {trip:t,best:b,decision:d,candidates:cs,preferences:p}=result;
 const route=`${escape(t.origin)} → ${escape(t.destination)}`,max=Math.max(...cs.map(c=>c.total),1);
 const reason=!b?tr('当前没有符合条件的航班与酒店组合。请调整评分、预算或航班偏好。','No flight and hotel combination matches your current constraints.'):d==='WAIT'?tr('暂时没有日期同时符合两项预算。可以调整预算或出发区间；这不是价格下跌预测。','No date currently fits both budgets. Adjust a budget or the date window; this is not a price forecast.'):d==='CHANGE DATE'?tr(`换到 ${date(b.date)} 出发，更符合你的预算与偏好。`,`Leaving on ${date(b.date)} is a better fit for your budget and preferences.`):tr('这是当前条件下评分最高、且符合预算的选择。','This is the highest-scoring option that fits your current constraints.');
 const detail=cs.length?`<section id="trip-detail" class="detail-shell" hidden><div class="detail-heading"><div><h2>${tr('这趟旅行','Trip detail')}</h2><p>${route}${b?` · ${date(b.date)} – ${date(b.returnDate)}`:''}</p></div><span class="badge ${d==='WAIT'?'wait':d==='CHANGE DATE'?'change':''}">${d}</span></div><div class="timing-copy"><h3>${tr('为什么是这个时间？','Why this timing?')}</h3><p>${reason}</p></div><div class="chart" aria-label="${tr('不同出发日期的旅行总价','Total trip cost by departure date')}">${cs.map(c=>`<button class="bar-col ${c.date===selected?'active':''}" data-date="${c.date}" aria-label="${date(c.date)}, ${money(c.total)}"><strong>${money(c.total)}</strong><span class="bar" style="height:${Math.round(c.total/max*105)}px"><b style="height:${c.flight.price/c.total*100}%"></b></span><span>${date(c.date)}</span></button>`).join('')}</div><div class="table-wrap"><table><thead><tr><th>${tr('出发日期','DEPARTURE')}</th><th>${tr('航班','FLIGHT')}</th><th>${tr('酒店 / 晚','HOTEL / NIGHT')}</th><th>${tr('总价','TOTAL')}</th><th>${tr('匹配度','FIT')}</th></tr></thead><tbody>${cs.map(c=>`<tr class="${c.date===selected?'selected':''}"><td><button class="row-button" data-date="${c.date}">${date(c.date)} – ${date(c.returnDate)}</button><small>${c.date===b?.date&&b.feasible?tr('✦ 推荐','✦ Recommended'):c.feasible?tr('预算内','Within budgets'):tr('超出预算','Over budget')}</small></td><td>${money(c.flight.price)}<small>${escape(c.flight.airline||'')} · ${c.flight.stops?tr(`${c.flight.stops} 次中转`,`${c.flight.stops} stop${c.flight.stops===1?'':'s'}`):tr('直飞','Nonstop')}</small></td><td>${money(c.hotel.nightly)}<small>★ ${c.hotel.rating}</small></td><td><strong>${money(c.total)}</strong></td><td><span class="score">${c.score}/100</span></td></tr>`).join('')}</tbody></table></div><div class="selection">${selection(cs.find(c=>c.date===selected)||b,t)}</div><section class="service-section"><h3>${tr('服务信息','Service availability')}</h3><div class="service-list"><div class="service-item"><strong>${tr('航班','Flights')}</strong><span>${result.dataSource==='live'?`Duffel ${b?.flight?.sourceMode||'API'}`:tr('模拟数据','Demo data')}</span></div><div class="service-item"><strong>${tr('酒店','Hotels')}</strong><span>${tr('模拟数据 · 实时即将支持','Demo · Live coming soon')}</span></div><div class="service-item"><strong>${tr('火车 / 地面交通','Train / ground')}</strong><span>${tr('即将支持','Coming soon')}</span></div><div class="service-item"><strong>${tr('景点 / 门票','Attractions / tickets')}</strong><span>${tr('即将支持','Coming soon')}</span></div></div></section></section>`:'';
 output.innerHTML=`<article class="recommendation"><div class="rec-top"><span class="badge ${d==='WAIT'?'wait':d==='CHANGE DATE'?'change':''}">${d}</span><span class="rec-label">${tr('途米推荐','TIMING RECOMMENDS')}</span></div><h2 class="rec-route">${route}</h2>${b?`<p class="rec-dates">${date(b.date)} – ${date(b.returnDate)}</p>`:''}<p>${reason}</p>${b?`<div class="rec-summary"><div class="rec-cost"><small>${tr('预计旅行总价','ESTIMATED TOTAL')}</small><strong>${money(b.total)}</strong></div><div class="fit-reasons"><span>${tr('为什么适合你','WHY IT FITS')}</span><ul>${reasonsFor(b,t).map(x=>`<li>${x}</li>`).join('')}</ul></div></div><button type="button" class="view-trip">${tr('查看这趟旅行','View this trip')} →</button>`:''}</article>${detail}<p class="source-footnote">${result.dataSource==='live'?tr(`Duffel ${b?.flight?.sourceMode||'API'} 航班 · 酒店模拟数据`,`Duffel ${b?.flight?.sourceMode||'API'} flights · Demo hotel`):tr('Demo · 模拟航班与酒店','Demo · Mock flight and hotel prices')} · ${p.priority==='comfort'?tr('舒适优先','comfort priority'):tr('性价比优先','best value')}</p>`;
 bindResults();
}
function selection(c,t){return `<h3>${escape(c.hotel.name)} · ${date(c.date)} – ${date(c.returnDate)}</h3><p>${detailText(c,t)}</p>`}
function bindResults(){
 output.querySelector('.view-trip')?.addEventListener('click',()=>{const el=output.querySelector('#trip-detail');el.hidden=false;el.scrollIntoView({behavior:'smooth',block:'start'});});
 output.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('click',()=>{const open=!output.querySelector('#trip-detail')?.hidden;selected=el.dataset.date;render();if(open){const detail=output.querySelector('#trip-detail');detail.hidden=false;}}));
}
function showDiscovery(draft){
 resultsState.hidden=false;const themes=draft.fields.travelIntents||[];
 document.querySelector('#result-meta').textContent=tr('下一步 · 目的地探索','NEXT · DESTINATION DISCOVERY');
 output.innerHTML=`<article class="recommendation discovery"><div class="rec-top"><span class="badge">${tr('需要确认','CONFIRM')}</span><span class="rec-label">${tr('诚实的下一步','AN HONEST NEXT STEP')}</span></div><h2 class="rec-route">${tr('目的地由途米推荐','Destination discovery is the next step')}</h2><p>${tr('你描述了旅行感觉，但没有指定真实地点。目的地探索尚未上线，途米不会编造一个城市。请先在旅行条件中确认目的地。','You described the kind of trip you want without naming a real place. Destination discovery is not implemented, so Timing will not invent a city. Confirm a destination in trip details to continue.')}</p>${themes.length?`<div class="fit-reasons"><span>${tr('已理解的旅行主题','CAPTURED THEMES')}</span><ul>${themes.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div>`:''}</article>`;
 structured.open=true;resultsState.scrollIntoView({behavior:'smooth',block:'start'});
}
function discoveryFit(candidate){return candidate.fitLabel==='strong_fit'?tr('很适合这次旅行','Strong fit for this trip'):candidate.fitLabel==='good_fit'?tr('适合这次旅行','Good fit for this trip'):tr('值得考虑','Worth considering');}
function flightLine(candidate){const verification=candidate.verification;if(verification.status==='verified'){const q=verification.quote;return `${verification.source==='live'?tr('Duffel 已验证','Duffel verified'):tr('Demo 航班','Demo flight')} · ${money(q.price)} · ${q.stops===0?tr('直飞','Nonstop'):tr(`${q.stops} 次中转`,`${q.stops} stop${q.stops===1?'':'s'}`)}${q.airline?` · ${escape(q.airline)}`:''}`;}return verification.status==='not_checked'?tr('日期不足，尚未检查航班','Flight not checked because dates are insufficient'):tr('航班验证暂不可用','Flight verification unavailable');}
function renderDiscovery(data,expanded=false){
 const [best,...rest]=data.candidates;if(!best){output.innerHTML=`<p class="empty">${tr('暂时没有可用的目的地建议。','No destination ideas are available yet.')}</p>`;return;}
 const alternatives=rest.slice(0,expanded?rest.length:3),period=data.context.basis==='current_date_soft_context'?tr('当前季节仅作为柔性参考','Current season used only as a soft signal'):data.dateWindows.length?tr('日期为系统生成的探索窗口，并非用户指定日期','Dates are system-generated exploration windows, not user-provided dates'):tr('已保留用户的宽泛时间描述','The broad travel period was preserved');
 output.innerHTML=`<article class="recommendation discovery-result"><div class="rec-top"><span class="badge">DISCOVER</span><span class="rec-label">${tr('途米推荐目的地','TIMING RECOMMENDS')}</span></div><h2 class="rec-route">${escape(best.city)} <small>${escape(best.countryOrRegion)}</small></h2><p class="rec-dates">${discoveryFit(best)} · ${best.score}/100</p><div class="fit-reasons"><span>${tr('为什么适合','WHY IT FITS')}</span><ul>${best.reasons.map(reason=>`<li>✓ ${escape(reason)}</li>`).join('')}</ul></div><p class="flight-verification">${flightLine(best)}</p></article><section class="discovery-alternatives"><div class="detail-heading"><div><h2>${tr('其他灵感','More ideas')}</h2><p>${escape(period)}</p></div></div><div class="idea-list">${alternatives.map(candidate=>`<article><div><strong>${escape(candidate.city)}</strong><span>${escape(candidate.countryOrRegion)}</span></div><b>${candidate.score}/100</b><p>${escape(candidate.reasons[0]||'')}</p><small>${flightLine(candidate)}</small></article>`).join('')}</div>${!expanded&&rest.length>3?`<button type="button" id="show-more-ideas">${tr('换一批 / 查看更多','Show more ideas')}</button>`:''}<p class="source-footnote">${data.source==='openai'?tr('AI 生成目的地候选；最终分数由固定规则计算','AI proposed candidates; fixed rules produced the final score'):tr('AI 不可用 · 使用明确标记的通用目的地先验','AI unavailable · Clearly labeled general destination prior')} · ${tr('热度信号为通用先验，不代表实时趋势','Popularity is a general prior, not a live trend')}</p></section>`;
 document.querySelector('#show-more-ideas')?.addEventListener('click',()=>renderDiscovery(data,true));
}
async function runDiscovery(draft){
 const preferences=draft.interpretation;if(!preferences?.origin||!preferences?.durationDays){showDiscovery(draft);return;}
 const id=++requestId,mode=modeControl.value;result=undefined;discoveryResult=undefined;agentStatus.hidden=false;resultsState.hidden=true;notice.hidden=true;
 agentStatus.querySelector('strong').textContent=tr('途米正在寻找目的地……','Timing is discovering destinations…');agentStatus.querySelector('ul').innerHTML=`<li class="done">${tr('理解你的旅行偏好','Understand your preferences')}</li><li>${tr('结合时间与主题寻找目的地','Use timing and themes')}</li><li>${tr('检查出发地航班方案','Check flight options')}</li><li>${tr('比较预算与旅行时长','Compare budget and duration')}</li><li>${tr('生成推荐','Build recommendation')}</li>`;
 try{const next=await discoverDestinations(preferences,{mode,language});if(id!==requestId)return;discoveryResult=next;renderDiscovery(next);resultsState.hidden=false;document.querySelector('#result-meta').textContent=next.source==='openai'?'DISCOVER · AI + DETERMINISTIC':'DISCOVER · LABELED FALLBACK';resultsState.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(id!==requestId)return;showDiscovery(draft);notice.hidden=false;notice.textContent=error.message;}finally{if(id===requestId)agentStatus.hidden=true;}
}
function showLiveUnavailable(message){
 result=undefined;output.innerHTML='';resultsState.hidden=false;document.querySelector('#result-meta').textContent=tr('实时数据不可用','LIVE UNAVAILABLE');indicator.textContent=sourceLabel('live','error');notice.hidden=false;
 notice.innerHTML=`<strong>${tr('实时航班数据不可用','Live flight data unavailable')}</strong><p>${escape(message)} ${tr('不会显示推荐或用模拟航班替代。酒店仍为模拟数据。','No recommendation or mock-flight substitution is shown. Hotels remain Demo.')}</p><button type="button" id="use-demo">${tr('切换到 Demo','Use Demo Mode')}</button>`;
 notice.querySelector('#use-demo').addEventListener('click',()=>{modeControl.value='demo';changeMode();});resultsState.scrollIntoView({behavior:'smooth'});
}
async function run(){
 const id=++requestId,version=editVersion,mode=modeControl.value,button=document.querySelector('#submit');
 button.disabled=true;agentStatus.hidden=false;notice.hidden=true;document.querySelector('#error').textContent='';indicator.textContent=sourceLabel(mode,'checking');
 try{const t=Object.fromEntries(new FormData(form));for(const k of ['nights','flightBudget','hotelBudget','rating'])t[k]=Number(t[k]);const next=await searchTravel(t,mode);if(id!==requestId)return;discoveryResult=undefined;result=next;selected=result.best?.date;render();resultsState.hidden=false;indicator.textContent=sourceLabel(mode);document.querySelector('#result-meta').textContent=mode==='live'?'LIVE · DUFFEL':'DEMO · SEARCH COMPLETE';document.querySelector('#stale').hidden=version===editVersion;resultsState.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(id!==requestId)return;if(mode==='live')showLiveUnavailable(error.message);else{structured.open=true;document.querySelector('#error').textContent=error.message;}}finally{if(id===requestId){button.disabled=false;agentStatus.hidden=true;button.querySelector('span').textContent=copy[language].searchDates;}}
}
function changeMode(){++requestId;result=undefined;discoveryResult=undefined;output.innerHTML='';resultsState.hidden=true;notice.hidden=true;indicator.textContent=sourceLabel();}

modeControl.addEventListener('change',changeMode);form.addEventListener('submit',e=>{e.preventDefault();run();});form.addEventListener('input',()=>{++editVersion;document.querySelector('#stale').hidden=!result;});
document.querySelector('#edit-request').addEventListener('click',()=>{structured.open=true;document.querySelector('#ask-state').scrollIntoView({behavior:'smooth'});});
document.querySelector('#lang-zh').addEventListener('click',()=>applyLanguage('zh'));document.querySelector('#lang-en').addEventListener('click',()=>applyLanguage('en'));
document.querySelectorAll('.inspire-chip').forEach(chip=>chip.addEventListener('click',()=>{const input=document.querySelector('#trip-description'),phrase=chip.dataset[language];input.value=input.value.trim()?`${input.value.trim()}${language==='zh'?'，':'. '}${phrase}`:phrase;input.focus();}));
const preferenceParser=new FallbackPreferenceParser(
 new LLMPreferenceParser({endpoint:'/api/travel/preferences/parse'}),
 new DemoPreferenceParser()
);
setupTripInput(form,draft=>{++editVersion;agentStatus.hidden=true;document.querySelector('#stale').hidden=!result;if(draft.interpretation?.destinationState==='discovery_required')runDiscovery(draft);else if(draft.needsConfirmation.length)structured.open=true;else form.requestSubmit();},preferenceParser);
applyLanguage('zh');
