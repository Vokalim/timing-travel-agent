import {displayLabel} from './display-localization.js';

// Structured, deterministic interpretation of optional preference text. Preserve the
// original wording so hotel and itinerary planners can use it when richer data exists.
export function parsePreferenceConstraints(text='', existing={}) {
 const rawText=String(text||existing.rawText||'').trim(),t=rawText.toLowerCase();
 const hard={...existing.hard},strong={...existing.strong},soft={...existing.soft};
 const has=re=>re.test(t);
 const direct=has(/直飞|直飛|non.?stop|direct flight/);
 if(direct&&!has(/do not want (?:non.?stop|direct)|don['’]t want (?:non.?stop|direct)|不要直飞|不坐直飞/)){if(has(/只看直飞|只要直飞|必须直飞|必須直飛|仅限直飞|直飞限定|direct flights? only|must (?:be )?(?:non.?stop|direct)|no connections|^non.?stop\b/)){hard.directFlightRequired=true;hard.transportModeRequired='flight';}
 else strong.directFlightPreferred=true;}
 if(has(/只坐高铁|只坐高鐵|只看高铁|只看高鐵|必须坐高铁|必須坐高鐵|train only|rail only|only (?:by )?(?:train|rail)/))hard.transportModeRequired='train';
 else if(has(/最好(?:坐|乘)?高铁|最好(?:坐|乘)?高鐵|高铁优先|高鐵優先|prefer (?:the )?(?:train|rail)|train preferred/))strong.trainPreferred=true;
 if(has(/只自驾|只自駕|必须自驾|必須自駕|self.drive only|drive only/))hard.transportModeRequired='self_drive';
 else if(has(/想自驾|想自駕|最好自驾|最好自駕|自驾优先|自駕優先|prefer (?:to )?drive|road trip|self.drive preferred/))strong.selfDrivePreferred=true;
 if(has(/只坐飞机|只坐飛機|只看飞机|只看飛機|flight only|fly only|only (?:by )?(?:plane|air)/))hard.transportModeRequired='flight';
 else if(has(/最好坐飞机|最好坐飛機|飞机优先|飛機優先|prefer (?:to )?fly|prefer flights?/))strong.flightPreferred=true;
 if(has(/红眼|紅眼|overnight flight|red.?eye/)){
  if(has(/(?:尽量|盡量|最好)\s*(?:不要|避免)?\s*(?:红眼|紅眼)|(?:prefer|ideally|if possible|avoid if possible)[^，,。.;]{0,18}(?:overnight flight|red.?eye)/))strong.avoidOvernightFlightsPreferred=true;
  else if(has(/不要|不坐|拒绝|避开|避開|no |avoid |never |must not /))hard.avoidOvernightFlights=true;
 }
 const duration=t.match(/(?:飞行|飛行|flight)(?:时间|時間| duration)?(?:不超过|不超過|最多|以内|以內|under|within|at most)\s*(\d+(?:\.\d+)?)\s*(?:小时|小時|hours?|h\b)/);
 if(duration)hard.maxFlightDurationMinutes=Math.round(Number(duration[1])*60);
 const stops=t.match(/(?:最多|不超过|不超過|at most|maximum|max)\s*(\d+)\s*(?:次)?\s*(?:中转|轉機|transfers?|stops?)/);
 if(stops)hard.maxStops=Number(stops[1]);
 if(has(/不能超预算|预算上限|預算上限|严格预算|嚴格預算|strict budget|hard budget cap/))hard.strictBudgetCap=true;
 if(has(/只去国内|只看国内|仅限国内|domestic only/))hard.geography='domestic';
 if(has(/只去国外|只看国外|仅限出境|international only/))hard.geography='international';
 const exclusions=[...(t.matchAll(/(?:不要去|排除|避开|避開|exclude|not (?:to|in))\s*([\p{L}][\p{L}\s'-]{1,24})/gu))].flatMap(m=>m[1].trim().replace(/[，。,;.!].*$/,'').split(/\s+and\s+|\s*和\s*/i));
 hard.excludedDestinations=[...new Set([...(hard.excludedDestinations||[]),...exclusions])];
 const strongPatterns={shorterFlightPreferred:/飞行时间短|短航程|shorter flights?|short flight time/,daytimeFlightsPreferred:/白天航班|白天飞|daytime flights?/,fewerTransfersPreferred:/少中转|少轉機|fewer transfers?|fewer stops?/,comfortPreferred:/舒适|舒適|comfort|豪华|luxury/,centralLocationPreferred:/市中心|中心地段|central location|city cent(?:er|re)/,seasidePreferred:/海边|海邊|seaside|coast|beach/,mountainPreferred:/山景|山里|mountains?/,naturePreferred:/亲近自然|親近自然|prefer nature/,higherRatedHotelsPreferred:/高评分酒店|高評分酒店|highly rated hotels?/,convenientTransportPreferred:/交通方便|交通便利|convenient transport|easy transit/};
 for(const [key,re] of Object.entries(strongPatterns))if(has(re))strong[key]=true;
 const softPatterns={localFood:/当地特色|當地特色|美食|food|local cuisine/,shopping:/购物|購物|shopping/,photography:/摄影|攝影|拍照|photography/,nightlife:/夜生活|nightlife/,relaxation:/放松|放空|relax/,slowTravel:/慢旅行|慢节奏|慢節奏|slow travel/,culture:/文化|culture/,nature:/自然|nature/,family:/亲子|親子|family/,romantic:/浪漫|romantic/,quietAreas:/安静|安靜|quiet/,lessCrowded:/人少|避开人群|避開人群|less crowded/};
 for(const [key,re] of Object.entries(softPatterns))if(has(re))soft[key]=has(/特别|非常|很|最|especially|really|love|highly/)?2:1;
 const pace=has(/节奏慢|節奏慢|慢一点|慢一點|slow pace|relaxed pace/)?'relaxed':existing.pace??null;
 return {hard,strong,soft,pace,rawText};
}

export function isExcludedDestination(hard={},city='',country=''){
 const places=hard.excludedDestinations||[],name=String(city).toLowerCase(),region=String(country).toLowerCase();
 const europe=new Set(['france','united kingdom']),asia=new Set(['china','mainland china','japan','south korea','singapore','thailand','hong kong sar']);
 return places.some(place=>{const excluded=String(place).toLowerCase();return excluded===name||excluded===region||
  (['欧洲','europe'].includes(excluded)&&europe.has(region))||(['亚洲','asia'].includes(excluded)&&asia.has(region))||
  (['国内','中国','china'].includes(excluded)&&region==='china')||(['国外','international'].includes(excluded)&&region!=='china')||
  ({日本:'japan',韩国:'south korea',英国:'united kingdom',法国:'france',新加坡:'singapore',泰国:'thailand',香港:'hong kong sar'}[excluded]===region);});
}

export function preferenceSummary(constraints,language='zh') {
 const {hard={},strong={},soft={},pace}=constraints||{};
 const keys=[hard.transportModeRequired==='train'?'trainOnly':hard.transportModeRequired==='self_drive'?'selfDriveOnly':hard.transportModeRequired==='flight'&&!hard.directFlightRequired?'flightOnly':strong.trainPreferred?'trainPreferred':strong.selfDrivePreferred?'selfDrivePreferred':null,hard.directFlightRequired?'directFlightRequired':strong.directFlightPreferred?'directFlightPreferred':null,hard.avoidOvernightFlights?'avoidOvernightFlights':strong.avoidOvernightFlightsPreferred?'avoidOvernightFlightsPreferred':null,pace==='relaxed'?'paceRelaxed':null,soft.localFood?'localFood':null,strong.centralLocationPreferred?'centralLocationPreferred':null].filter(Boolean);
 return keys.slice(0,3).map(key=>displayLabel(key,language)).join(' · ');
}
