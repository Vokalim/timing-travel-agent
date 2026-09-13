import {presentDestination,displayCity} from './discovery/destination-identity.js';

// Canonical values remain unchanged in requests, providers, and ranking.
export const DISPLAY_LABELS=Object.freeze({
 zh:Object.freeze({food:'美食',beach:'海边',relaxation:'放松',hiking:'徒步',culture:'文化',nature:'自然',shopping:'购物',nightlife:'夜生活',photography:'摄影',snow:'冰雪',snow_winter:'冰雪',hot_spring:'温泉',hot_springs:'温泉',city_break:'城市漫游',slow_travel:'慢旅行',family:'亲子',romantic:'浪漫',festive:'节日氛围',flight:'飞机',train:'高铁',self_drive:'自驾',winter:'冬季',spring:'春季',summer:'夏季',autumn:'秋季',christmas:'圣诞节',new_year:'新年',spring_festival:'春节',lantern_festival:'元宵节',qingming:'清明节',labor:'劳动节',dragon_boat:'端午节',mid_autumn:'中秋节',national_day:'国庆节',cherry_blossom:'樱花季',autumn_foliage:'秋叶季',snow_season:'雪季',europe_festivals:'欧洲节庆',north_american_foliage:'北美秋色',island:'海岛',mountains:'山地',grassland:'草原',desert:'沙漠',forest:'森林',lakes:'湖泊',flowers:'花海',foliage:'秋叶',tropical:'热带',aurora:'极光',historic_towns:'古镇',weekend_escape:'周末短途',coastal:'海滨',mountain:'山地',urban:'都市',historic:'历史古城',verified:'已验证',not_checked:'待验证',unavailable:'暂不可用',not_yet_live:'即将支持',not_applicable:'不适用',demo:'演示数据',live:'实时数据',directFlightPreferred:'直飞优先',directFlightRequired:'只看直飞',trainPreferred:'高铁优先',selfDrivePreferred:'自驾优先',domestic:'国内',international:'出境',general_prior_fallback:'一般旅行方向',openai:'智能旅行建议',BOOK:'建议预订',WAIT:'再等等',CHANGE_DATE:'换个日期',trainOnly:'只坐高铁',selfDriveOnly:'只自驾',flightOnly:'只坐飞机',avoidOvernightFlights:'不要红眼',avoidOvernightFlightsPreferred:'尽量不坐红眼',paceRelaxed:'慢节奏',localFood:'当地美食',centralLocationPreferred:'住市中心'}),
 en:Object.freeze({food:'Food',beach:'Beach',relaxation:'Relaxation',hiking:'Hiking',culture:'Culture',nature:'Nature',shopping:'Shopping',nightlife:'Nightlife',photography:'Photography',snow:'Snow',snow_winter:'Snow',hot_spring:'Hot springs',hot_springs:'Hot springs',city_break:'City break',slow_travel:'Slow travel',family:'Family',romantic:'Romantic',festive:'Festive',flight:'Flight',train:'Train',self_drive:'Self-drive',winter:'Winter',spring:'Spring',summer:'Summer',autumn:'Autumn',christmas:'Christmas',new_year:'New Year',spring_festival:'Spring Festival',lantern_festival:'Lantern Festival',qingming:'Qingming Festival',labor:'Labour Day',dragon_boat:'Dragon Boat Festival',mid_autumn:'Mid-Autumn Festival',national_day:'National Day',cherry_blossom:'Cherry blossom season',autumn_foliage:'Autumn foliage season',snow_season:'Snow season',europe_festivals:'European festivals',north_american_foliage:'North American foliage',island:'Island',mountains:'Mountains',grassland:'Grassland',desert:'Desert',forest:'Forest',lakes:'Lakes',flowers:'Flowers',foliage:'Autumn foliage',tropical:'Tropical',aurora:'Aurora',historic_towns:'Historic towns',weekend_escape:'Weekend escape',coastal:'Coastal',mountain:'Mountain',urban:'Urban',historic:'Historic',verified:'Verified',not_checked:'Pending',unavailable:'Unavailable',not_yet_live:'Coming soon',not_applicable:'Not applicable',demo:'Demo data',live:'Live data',directFlightPreferred:'Prefer direct',directFlightRequired:'Direct only',trainPreferred:'Train preferred',selfDrivePreferred:'Self-drive preferred',domestic:'Domestic',international:'International',general_prior_fallback:'General travel idea',openai:'AI travel suggestion',BOOK:'Book',WAIT:'Wait',CHANGE_DATE:'Change date',trainOnly:'Train only',selfDriveOnly:'Drive only',flightOnly:'Flight only',avoidOvernightFlights:'No red-eyes',avoidOvernightFlightsPreferred:'Prefer no red-eyes',paceRelaxed:'Slow pace',localFood:'Local food',centralLocationPreferred:'Central stay'})
});
const fallback={zh:'旅行偏好',en:'Travel preference'};
const normalizedLanguage=language=>language==='en'?'en':'zh';
const warnMissing=key=>{if(typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname))console.warn('[Timing] Missing display localization',{key});};
export function displayLabel(key,language='zh'){const locale=normalizedLanguage(language),value=DISPLAY_LABELS[locale][key];if(value)return value;warnMissing(key);return fallback[locale];}
export function knownDisplayLabel(key,language='zh'){const locale=normalizedLanguage(language),value=DISPLAY_LABELS[locale][key];if(!value)warnMissing(key);return value||null;}

const zhIntentReason={food:'适合边吃边逛',beach:'很适合放松看海',relaxation:'适合慢下来休息几天',nature:'自然风景更符合你的偏好',hiking:'适合徒步旅行',culture:'适合深入体验当地文化',festive:'适合感受节日氛围',snow_winter:'适合去看雪',shopping:'适合边逛边玩',family:'适合亲子旅行',romantic:'适合浪漫旅行'};
const enIntentReason={food:'Matches your interest in local food',beach:'Matches your beach-trip preference',relaxation:'A good fit for a relaxing trip',nature:'Matches your interest in natural scenery',hiking:'A good fit for hiking',culture:'Matches your interest in culture',festive:'Matches your festive-trip preference',snow_winter:'Matches your interest in snow and winter',shopping:'Matches your shopping preference',family:'A good fit for family travel',romantic:'A good fit for a romantic trip'};
export function displayIntentReason(intent,language='zh'){const locale=normalizedLanguage(language);return (locale==='zh'?zhIntentReason:enIntentReason)[intent]||fallback[locale];}

const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function displayTravelPeriod(context={},language='zh'){
 const locale=normalizedLanguage(language),text=String(context.dateDescription||context.periodText||'').trim();
 if(context.holiday)return knownDisplayLabel(context.holiday,locale)||fallback[locale];
 if(context.kind==='relative_weekend'||/这个周末|這個週末|this weekend/i.test(text))return locale==='zh'?'这个周末':'This weekend';
 if(context.kind==='relative_period'||/下个月|下個月|next month/i.test(text))return locale==='zh'?'下个月':'Next month';
 if(context.datePrecision==='exact'||context.datePrecision==='partial'){
  const dates=text.match(/20\d{2}-\d{2}-\d{2}/g)||[];if(dates.length)return dates.map(date=>new Date(date+'T00:00:00Z').toLocaleDateString(locale==='zh'?'zh-CN':'en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})).join(' – ');
 }
 let month=Number(context.month)||null;
 if(!month){const zh=text.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*月/),en=monthNames.findIndex(name=>new RegExp(`\\b${name}\\b`,'i').test(text));month=zh?Number(zh[1]):en>=0?en+1:null;}
 if(month>=1&&month<=12&&context.datePrecision!=='none')return locale==='zh'?`${month}月`:monthNames[month-1];
 return locale==='zh'?'日期灵活':'Flexible dates';
}

export function displayTransportStatus(candidate,language='zh'){
 const locale=normalizedLanguage(language),options=Object.values(candidate.transport||{}).filter(option=>option.allowed&&option.suitability!=='not_applicable').sort((a,b)=>b.suitabilityScore-a.suitabilityScore),primary=options[0];
 const access=candidate.access,verification=candidate.verification||{};
 if(access?.flightAccess?.requiresOnwardTransfer){const hub=displayCity(access.flightAccess.hub.canonicalName,locale),destination=displayCity(candidate.city,locale),demo=verification.status==='partially_verified'&&verification.source==='demo';return locale==='zh'?`可经${hub}进入，前往${destination} · ${demo?'演示航班参考，':''}接驳与总价待核验`:`Possible entry via ${hub} for ${destination} · ${demo?'Demo flight reference; ':''}onward transfer and total cost unverified`;}
 if(primary?.mode==='train')return locale==='zh'?'高铁适合 · 实时车次与票价暂未接入':'Train suited · Live schedules and fares not connected';
 if(primary?.mode==='self_drive')return locale==='zh'?'可考虑自驾 · 路线与驾车时间未核验':'Self-drive possible · Route and drive time unverified';
 if(verification.status==='verified'&&Number.isFinite(verification.quote?.price))return `${locale==='zh'?(verification.source==='live'?'实时航班已验证':'演示航班参考'):(verification.source==='live'?'Live flight verified':'Demo flight reference')} · ¥${Math.round(verification.quote.price).toLocaleString('en-US')}${verification.quote.stops===0?` · ${locale==='zh'?'直飞':'Nonstop'}`:''}`;
 if(access?.railAccess?.hub&&candidate.transport?.train?.suitability!=='not_applicable')return locale==='zh'?'可考虑铁路进入 · 实时车次与票价待核验':'Rail access possible · Live schedules and fares unverified';
 if(access?.selfDriveAccess?.suitable)return locale==='zh'?'可考虑自驾 · 路线与时间待核验':'Self-drive possible · Route and time unverified';
 return locale==='zh'?(verification.status==='not_checked'?'航班待验证':'航班暂不可用'):(verification.status==='not_checked'?'Flight pending verification':'Flight unavailable');
}

export function presentDiscoveryCandidate(candidate,data,language='zh'){
 const locale=normalizedLanguage(language),identity=presentDestination(candidate,locale),explicit=(data.displayPreferences?.travelIntents||[]).filter(intent=>candidate.themes?.includes(intent)),inferred=(data.context?.inferredTravelIntents||[]).filter(intent=>candidate.themes?.includes(intent)&&!explicit.includes(intent));
 const statement=explicit.length?displayIntentReason(explicit[0],locale):inferred.length?locale==='zh'?`${displayLabel(data.context.season,locale)}适合${displayLabel(inferred[0],locale)}体验`:`${displayLabel(data.context.season,locale)} suits ${displayLabel(inferred[0],locale).toLowerCase()} experiences`:locale==='zh'?'适合探索的新旅行方向':'A travel direction worth exploring';
 const tags=[...(candidate.themes||[]).slice(0,2).map(intent=>knownDisplayLabel(intent,locale)).filter(Boolean),displayTravelPeriod(data.context,locale)].slice(0,3);
 return {...identity,statement,tags,transportStatus:displayTransportStatus(candidate,locale)};
}
