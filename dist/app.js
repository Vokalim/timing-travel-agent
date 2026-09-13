import {searchTravel} from './lib/travel-service.js';
import {setupTripInput} from './trip-input.js';
import {DemoPreferenceParser} from './lib/preference-parser.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from './lib/llm-preference-parser.js';
import {discoverDestinations} from './lib/discovery/destination-discovery.js';
import {InspirationService} from './lib/discovery/inspiration-service.js';
import {nextClarification} from './lib/discovery/clarification.js';
import {displayCity,presentDestination} from './lib/discovery/destination-identity.js';
import {LocalDestinationVisualProvider} from './lib/discovery/destination-visual-provider.js';

const form=document.querySelector('#trip-form'),output=document.querySelector('#results');
const modeControl=document.querySelector('#data-mode'),indicator=document.querySelector('#source-indicator');
const notice=document.querySelector('#source-notice'),resultsState=document.querySelector('#results-state');
const agentStatus=document.querySelector('#agent-status'),structured=document.querySelector('#structured-details');
let result,discoveryResult,clarificationDraft,selected,language='zh',requestId=0,editVersion=0,discoveryFilter='all';

const copy={
 zh:{kicker:'你的旅行，从一个念头开始',heroTitle:'找个时机，出发吧。',heroSubtitle:'告诉途米你想去哪，或者想要怎样的旅行。',askLabel:'这次想怎么走？',aiNote:'目的地未定也没关系',explore:'开始探索',inspireLabel:'这个时节适合',refreshInspiration:'换一换',chipChristmas:'过圣诞',chipBeach:'去看海',chipHiking:'去爬山',chipFood:'吃点好的',chipRelax:'放空几天',chipWeekend:'周末短途',workingTitle:'途米正在为你找……',working1:'理解旅行偏好',working2:'整理时间与预算',working3:'寻找适合的旅行方案',working4:'比较交通与价格',editConditions:'查看 / 修改旅行条件',tripDetails:'旅行条件',confirmHint:'搜索前请确认',from:'出发地',to:'目的地',earliest:'最早出发',latest:'最晚出发',duration:'旅行时长（晚）',rating:'酒店最低评分',flightBudget:'往返机票预算',hotelBudget:'每晚酒店预算',preferences:'其他偏好（可选）',searchDates:'比较这些日期',editRequest:'修改需求',stale:'旅行条件已修改，请重新比较。',howDecision:'途米如何做判断',methodPreferences:'<strong>先理解偏好。</strong> AI 只负责整理可复核的旅行条件；不可用时会明确标记本地解析。',methodMath:'<strong>计算保持确定。</strong> 价格、预算、评分和 BOOK / WAIT / CHANGE DATE 都由固定规则计算。',methodSource:'<strong>来源保持透明。</strong> Demo 为模拟数据；Live 使用 Duffel 航班，酒店仍为 Demo。',footer:'在出发之前，先找到对的时机。'},
 en:{kicker:'YOUR TRIP STARTS WITH AN IDEA',heroTitle:'Find your moment to go.',heroSubtitle:'Tell Timing where you want to go — or what kind of trip you want.',askLabel:'What kind of trip are you imagining?',aiNote:'Not sure where to go? That is fine.',explore:'Explore',inspireLabel:'Good for this season',refreshInspiration:'Refresh ideas',chipChristmas:'Christmas',chipBeach:'Beach',chipHiking:'Hiking',chipFood:'Food',chipRelax:'Relax',chipWeekend:'Weekend escape',workingTitle:'Timing is looking for your trip…',working1:'Understanding your preferences',working2:'Organising dates and budget',working3:'Finding suitable options',working4:'Comparing transport and price',editConditions:'View / edit trip details',tripDetails:'Trip details',confirmHint:'Confirm before searching',from:'From',to:'To',earliest:'Earliest departure',latest:'Latest departure',duration:'Trip duration (nights)',rating:'Minimum hotel rating',flightBudget:'Round-trip flight budget',hotelBudget:'Hotel budget per night',preferences:'Other preferences (optional)',searchDates:'Compare these dates',editRequest:'Edit request',stale:'Your trip details changed. Compare again.',howDecision:'How Timing makes a decision',methodPreferences:'<strong>Preferences first.</strong> AI creates a reviewable trip draft; local fallback is always clearly labeled.',methodMath:'<strong>Deterministic calculations.</strong> Prices, budgets, scores and BOOK / WAIT / CHANGE DATE use fixed rules.',methodSource:'<strong>Transparent sources.</strong> Demo is simulated; Live uses Duffel flights while hotels remain Demo.',footer:'Find the right moment before you go.'}
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
 renderInspiration();
 document.dispatchEvent(new CustomEvent('timing:language',{detail:{language}}));
 if(result) render();else if(discoveryResult){document.querySelector('#result-meta').textContent=tr('目的地灵感','DESTINATION IDEAS');renderDiscovery(discoveryResult);}else if(clarificationDraft)showClarification(clarificationDraft);
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
 const items=[b.flight.stops===0?tr('直飞','Nonstop'):tr(`${b.flight.stops} 次中转`,`${b.flight.stops} stop${b.flight.stops===1?'':'s'}`),b.feasible?tr('符合预算','Within budget'):tr('当前超出预算','Over budget'),tr(`适合 ${t.nights} 晚`,`Fits ${t.nights} nights`),tr(`酒店评分 ${b.hotel.rating}` ,`Hotel rating ${b.hotel.rating}`)];
 return items;
}
function detailText(c,t){
 const carrier=c.flight.airline?` · ${escape(c.flight.airline)}`:'';
 return language==='zh'?`往返机票 ${money(c.flight.price)}${carrier} + 酒店 ${money(c.hotel.nightly)} × ${t.nights} 晚 = <strong>${money(c.total)}</strong>。<br>${c.flight.price>t.flightBudget?`机票超出预算 ${money(c.flight.price-t.flightBudget)}。`:'机票符合预算。'} ${c.hotel.nightly>t.hotelBudget?`酒店每晚超出预算 ${money(c.hotel.nightly-t.hotelBudget)}。`:'酒店符合每晚预算。'} 住客评分 ${c.hotel.rating}/5。`:`Round-trip flight ${money(c.flight.price)}${carrier} + hotel ${money(c.hotel.nightly)} × ${t.nights} nights = <strong>${money(c.total)}</strong>.<br>${c.flight.price>t.flightBudget?`Flight exceeds budget by ${money(c.flight.price-t.flightBudget)}.`:'Flight budget met.'} ${c.hotel.nightly>t.hotelBudget?`Hotel exceeds nightly budget by ${money(c.hotel.nightly-t.hotelBudget)}.`:'Hotel budget met.'} Guest rating ${c.hotel.rating}/5.`;
}
function render(){
 const {trip:t,best:b,decision:d,candidates:cs,preferences:p}=result;
 const route=`${escape(displayCity(t.origin,language))} → ${escape(displayCity(t.destination,language))}`,max=Math.max(...cs.map(c=>c.total),1);
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
function flightLine(candidate){const verification=candidate.verification;if(verification.status==='verified'){const q=verification.quote;return `${verification.source==='live'?tr('Duffel 航班已验证','Duffel flight verified'):tr('Demo 航班','Demo flight')} · ${money(q.price)}${q.stops===0?` · ${tr('直飞','Nonstop')}`:''}`;}return verification.status==='not_checked'?tr('航班待验证','Flight not checked'):tr('航班暂不可用','Flight unavailable');}
function renderDiscovery(data,expanded=false){
 const visible=data.candidates.filter(candidate=>discoveryFilter==='all'||(discoveryFilter==='domestic')===(candidate.countryOrRegion==='China'));
 const [best,...rest]=visible;
 const filter=`<nav class="discovery-filters" aria-label="${tr('目的地范围','Destination region')}">${[['all','全部','All'],['domestic','国内','Domestic'],['international','出境','International']].map(([key,zh,en])=>`<button type="button" data-region="${key}" aria-pressed="${discoveryFilter===key}">${tr(zh,en)}</button>`).join('')}</nav>`;
 if(!best){output.innerHTML=`${filter}<p class="empty">${tr('这个范围暂时没有建议，试试其他范围。','No ideas in this region yet. Try another region.')}</p>`;bindDiscovery(data,expanded);return;}
 const alternatives=rest.slice(0,expanded?rest.length:2),visual=visualProvider.getVisual(best),bestDisplay=presentDestination(best,language);
 const images=[...visual.heroImages,...visual.scenicImages].slice(0,2);
 const statement=best.reasons.find(reason=>!reason.includes('¥')&&!/flight|航班|prior|先验/i.test(reason))||best.generalReasons[0]||tr('一个值得探索的旅行方向。','A direction worth exploring.');
 const tags=[...(best.themes||[]).slice(0,2).map(theme=>({beach:tr('海边','Coast'),festive:tr('节日氛围','Festive'),nature:tr('自然','Nature'),food:tr('美食','Food'),culture:tr('文化','Culture'),snow_winter:tr('冬日','Winter'),hiking:tr('徒步','Hiking'),relaxation:tr('放松','Relaxation')}[theme]||theme)),data.context.dateDescription||tr('日期灵活','Flexible dates')].slice(0,3);
 output.innerHTML=`${filter}<article class="discovery-feature"><div class="feature-copy"><span class="eyebrow">${tr('为你找到一个不错的方向','A PLACE TO START')}</span><h2>${escape(bestDisplay.city)}</h2><span class="feature-region">${escape(bestDisplay.country)} · ${best.score}% ${tr('契合','match')}</span><div class="feature-tags">${tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div><p>${escape(statement)}</p><small>${flightLine(best)}</small><button type="button" class="choose-destination" data-city="${escape(best.city)}">${tr('看看这趟旅行','Explore this trip')} →</button></div><div class="feature-art ${images.length>1?'has-secondary':''}" aria-hidden="true">${images.map((item,index)=>`<img class="${index?'secondary-image':'primary-image'}" src="${escape(item.src)}" alt="" loading="lazy">`).join('')}</div></article><section class="discovery-alternatives"><h3>${tr('也可以看看','Also worth a look')}</h3><div class="idea-list">${alternatives.map(candidate=>{const display=presentDestination(candidate,language);return `<article><div><strong>${escape(display.city)}</strong><span>${escape(display.country)}</span></div><b>${candidate.score}%</b><p>${escape(candidate.reasons.find(reason=>!reason.includes('¥'))||candidate.generalReasons[0]||'')}</p><small>${flightLine(candidate)}</small><button type="button" class="choose-destination" data-city="${escape(candidate.city)}">${tr('查看','Explore')} →</button></article>`;}).join('')}</div>${!expanded&&rest.length>2?`<button type="button" id="show-more-ideas">${tr('换一批 / 查看更多','More ideas')}</button>`:''}<p class="source-footnote">${data.source==='openai'?tr('目的地灵感由 AI 提议，航班与评分单独核验。','AI suggested destinations; flights and scores are checked separately.'):tr('AI 暂不可用 · 使用通用目的地灵感。','AI unavailable · General destination ideas shown.')} ${data.dateWindows.length?tr('日期仅用于探索比较，尚未由你确认。','Dates are exploratory and not confirmed by you.'):''}</p><div class="future-services">${tr('酒店 · 即将支持　　高铁 · 即将支持　　景点 / 门票 · 即将支持','Stays · Coming soon　　Rail · Coming soon　　Attractions · Coming soon')}</div></section>`;
 bindDiscovery(data,expanded);
}
function bindDiscovery(data,expanded){
 output.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{discoveryFilter=button.dataset.region;renderDiscovery(data);}));
 output.querySelector('#show-more-ideas')?.addEventListener('click',()=>renderDiscovery(data,true));
 output.querySelectorAll('.choose-destination').forEach(button=>button.addEventListener('click',()=>{form.elements.namedItem('destination').value=button.dataset.city;structured.open=true;structured.scrollIntoView({behavior:'smooth',block:'start'});}));
}
async function runDiscovery(draft,{skip=false}={}){
 const preferences=draft.interpretation;
 if(!skip&&nextClarification(preferences)){showClarification(draft);return;}
 const id=++requestId,mode=modeControl.value,started=Date.now();result=undefined;discoveryResult=undefined;clarificationDraft=undefined;discoveryFilter=preferences.geographyPreference||(preferences.domesticAllowed===false?'international':preferences.internationalAllowed===false?'domestic':'all');agentStatus.hidden=false;resultsState.hidden=true;notice.hidden=true;
 agentStatus.querySelector('strong').textContent=tr('途米正在寻找适合的旅行……','Timing is finding your trip…');agentStatus.querySelector('ul').innerHTML=`<li class="done">${tr('正在理解你的旅行想法…','Understanding your trip…')}</li><li>${tr('正在寻找适合的国内外目的地…','Finding suitable destinations…')}</li><li>${tr('正在检查可用交通方案…','Checking transport options…')}</li><li>${tr('正在比较时间与预算…','Comparing dates and budget…')}</li>`;
 try{const next=await discoverDestinations(preferences,{mode,language});if(id!==requestId)return;await new Promise(resolve=>setTimeout(resolve,Math.max(0,550-(Date.now()-started))));if(id!==requestId)return;discoveryResult=next;renderDiscovery(next);resultsState.hidden=false;document.querySelector('#result-meta').textContent=tr('目的地灵感','DESTINATION IDEAS');resultsState.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(id!==requestId)return;resultsState.hidden=false;output.innerHTML=`<p class="empty">${tr('暂时无法获取旅行灵感，请稍后重试或修改条件。','Travel ideas are unavailable right now. Try again or edit your trip.')}</p>`;notice.hidden=false;notice.textContent=tr('请稍后重试。','Please try again later.');}finally{if(id===requestId)agentStatus.hidden=true;}
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
function changeMode(){++requestId;result=undefined;discoveryResult=undefined;clarificationDraft=undefined;output.innerHTML='';resultsState.hidden=true;notice.hidden=true;indicator.textContent=sourceLabel();}

modeControl.addEventListener('change',changeMode);form.addEventListener('submit',e=>{e.preventDefault();run();});form.addEventListener('input',()=>{++editVersion;document.querySelector('#stale').hidden=!result;});
document.querySelector('#edit-request').addEventListener('click',()=>{structured.open=true;document.querySelector('#ask-state').scrollIntoView({behavior:'smooth'});});
document.querySelector('#lang-zh').addEventListener('click',()=>applyLanguage('zh'));document.querySelector('#lang-en').addEventListener('click',()=>applyLanguage('en'));
document.querySelector('#trip-description').addEventListener('input',renderInspiration);
document.querySelector('#refresh-inspiration').addEventListener('click',()=>renderInspiration({refresh:true}));
const preferenceParser=new FallbackPreferenceParser(
 new LLMPreferenceParser({endpoint:'/api/travel/preferences/parse'}),
 new DemoPreferenceParser()
);
setupTripInput(form,draft=>{++editVersion;agentStatus.hidden=true;document.querySelector('#stale').hidden=!result;if(draft.interpretation?.destinationState==='discovery_required')runDiscovery(draft);else if(draft.needsConfirmation.length)structured.open=true;else form.requestSubmit();},preferenceParser);
applyLanguage('zh');
