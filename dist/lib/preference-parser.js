import {TRAVEL_INTENTS} from './trip-request.js';
import {parsePreferenceConstraints} from './preference-constraints.js';

export const tripFields = {
  origin:'Origin', destination:'Destination', start:'Earliest departure (including year)',
  end:'Latest departure (including year)', nights:'Trip duration', flightBudget:'Round-trip flight budget (CNY)',
  hotelBudget:'Hotel budget per night (CNY)', rating:'Minimum guest rating out of 5'
};
/** Replaceable parsing boundary. No pricing, search, scoring, or decisions.
 * parse(text) -> Promise<{fields: object, needsConfirmation: string[], warnings: string[], dateHint: string}>.
 * Missing/ambiguous fields MUST be omitted; never infer them from current form defaults.
 * LLM and fallback adapters return this same reviewed draft and never submit a search.
 */
export class PreferenceParser {
  async parse(text) { throw new Error('Implement PreferenceParser.parse(text).'); }
}
const months = 'January February March April May June July August September October November December'.split(' ');
const number = '(\\d+(?:,\\d{3})*(?:\\.\\d+)?)';
function unique(text, pattern, convert = s => s) {
  const values = [...text.matchAll(pattern)].map(m => convert(m[1]));
  return values.length && values.every(v => v === values[0]) ? values[0] : undefined;
}
function validDate(year, month, day) {
  const value = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const parsed = new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value ? value : undefined;
}
export class DemoPreferenceParser extends PreferenceParser {
  async parse(input) {
    const text = String(input ?? '').trim();
    const fields = {currency:'CNY'}, warnings = [];
    const intentPatterns = {
      festive:/\b(?:christmas|festive|holiday markets?)\b|圣诞|聖誕|节日氛围|節日氛圍/i, beach:/\bbeach(?:es)?\b|海边|海邊|海滩|海灘|沙滩|沙灘/i,
      relaxation:/\b(?:relax|relaxation|spa|wellness)\b|放松|放鬆|休闲|休閒/i, hiking:/\b(?:hike|hiking|trekking)\b|徒步|登山/i,
      food:/\b(?:food|culinary|cuisine|restaurants?)\b|美食|吃吃喝喝|好吃的|寻味|尋味/i, culture:/\b(?:culture|cultural|museums?|history|heritage)\b|文化|博物馆|博物館|历史|歷史/i,
      nature:/\b(?:nature|wildlife|scenery|outdoors?)\b|自然|风景|風景|看山|山里|山野/i, snow_winter:/\b(?:snow|winter|skiing?)\b|雪|冬季|滑雪/i,
      shopping:/\b(?:shopping|shops?)\b|购物|購物/i, family:/\b(?:family|kids?|children)\b|亲子|親子|家庭/i,
      romantic:/\b(?:romantic|romance|honeymoon)\b|浪漫|蜜月/i
    };
    fields.travelIntents = TRAVEL_INTENTS.filter(intent=>intentPatterns[intent].test(text));
    const route = [...text.matchAll(/\bfrom\s+([\p{L}][\p{L} .'-]*?)\s+to\s+([\p{L}][\p{L} .'-]*?)(?=\s+(?:for|between|sometime|on|in|with|from)\b|[,.!?]|$)/giu)];
    if (route.length === 1) {
      fields.origin = route[0][1].trim();
      const proposed=route[0][2].trim();
      if (!/^(?:a |an |the )?(?:beach|somewhere|someplace|warm place|place to hike|christmas destination)$/i.test(proposed)) fields.destination=proposed;
    }
    if (!fields.origin) {
      const found=[['上海','Shanghai'],['北京','Beijing'],['广州','Guangzhou'],['深圳','Shenzhen'],['成都','Chengdu'],['重庆','Chongqing'],['长沙','Changsha'],['南昌','Nanchang'],['厦门','Xiamen'],['三亚','Sanya'],['昆明','Kunming'],['大理','Dali'],['丽江','Lijiang'],['桂林','Guilin'],['西安',"Xi'an"],['杭州','Hangzhou'],['南京','Nanjing'],['青岛','Qingdao'],['哈尔滨','Harbin'],['香港','Hong Kong']].find(([name])=>text.includes(name));
      if(found)fields.origin=found[1];
    }
    if (!fields.destination) {
      const found=[['东京','Tokyo'],['東京','Tokyo'],['大阪','Osaka'],['首尔','Seoul'],['首爾','Seoul'],['新加坡','Singapore'],['曼谷','Bangkok'],['伦敦','London'],['巴黎','Paris'],['北京','Beijing'],['广州','Guangzhou'],['深圳','Shenzhen'],['成都','Chengdu'],['重庆','Chongqing'],['长沙','Changsha'],['厦门','Xiamen'],['三亚','Sanya'],['昆明','Kunming'],['大理','Dali'],['丽江','Lijiang'],['桂林','Guilin'],['西安',"Xi'an"],['杭州','Hangzhou'],['南京','Nanjing'],['青岛','Qingdao'],['哈尔滨','Harbin']].find(([name])=>new RegExp(`(?:去|到)${name}`).test(text));
      if(found&&!new RegExp(`(?:不要|排除|避开|避開)(?:去|到)?${found[0]}`).test(text))fields.destination=found[1];
    }
    const durationRange=text.match(/(\d+)\s*(?:-|~|–|到|至)\s*(\d+)\s*(?:天|晚|days?|nights?)/i);
    if(durationRange)fields.nights=Math.round((Number(durationRange[1])+Number(durationRange[2]))/2);
    if (!fields.nights) fields.nights = unique(text,/\b(\d+)\s+nights?\b/gi, Number);
    if (!fields.nights) fields.nights=unique(text,/(\d+)\s*(?:天|晚)/g,Number);
    const cny = !/(?:[$€£]|\b(?:USD|EUR|GBP|JPY|CAD|AUD|HKD)\b)/i.test(text);
    if (cny) {
      const amount = '(?:[¥￥]|CNY\\s*|RMB\\s*)'+number;
      fields.flightBudget = unique(text,new RegExp('\\bround[- ]trip flight budget\\s*(?:is|of|:)?\\s*'+amount,'gi'),s=>Number(s.replaceAll(',','')));
      fields.hotelBudget = unique(text,new RegExp('\\bhotel budget\\s*(?:is|of|:)?\\s*'+amount+'\\s*(?:per|a|/)\\s*night','gi'),s=>Number(s.replaceAll(',','')));
      const general=[...text.matchAll(/(?<!机票|酒店|住宿)(?:总预算|總預算|预算|預算)\s*(?:是|为|為|:)?\s*(?:[¥￥]|CNY\s*|RMB\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)/gi),...text.matchAll(/(?<!flight )(?<!hotel )(?<!airfare )\b(?:total\s+)?budget\s*(?:is|of|:)?\s*(?:[¥￥]|CNY\s*|RMB\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)/gi)].map(match=>Number(match[1].replaceAll(',','')));
      if(general.length&&general.every(value=>value===general[0]))fields.totalTripBudgetCny=general[0];
    } else warnings.push('Only CNY/RMB budgets are supported. Confirm both budgets in yuan; no currency conversion was applied.');
    fields.rating = unique(text,/\b(?:minimum (?:hotel |guest )?rating|rating of at least)\s*(?:is|of|:)?\s*(\d(?:\.\d+)?)\s*(?:\/\s*5|out of 5)\b/gi,Number);
    let dateHint = '';
    const named = new RegExp('\\bbetween\\s+('+months.join('|')+')\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s+and\\s+('+months.join('|')+')\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?','gi');
    const ranges = [...text.matchAll(named)];
    const iso = [...text.matchAll(/\bbetween\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})\b/gi)];
    if (ranges.length === 1 && iso.length === 0) {
      const [,m1,d1,y1,m2,d2,y2] = ranges[0];
      dateHint = ranges[0][0];
      if (y1 || y2) {
        fields.start = validDate(y1 || y2,months.findIndex(m=>m.toLowerCase()===m1.toLowerCase())+1,d1);
        fields.end = validDate(y2 || y1,months.findIndex(m=>m.toLowerCase()===m2.toLowerCase())+1,d2);
      } else warnings.push('The departure window has no year. Enter both full dates below.');
    } else if (iso.length === 1 && ranges.length === 0) {
      fields.start = validDate(...iso[0][1].split('-'));
      fields.end = validDate(...iso[0][2].split('-'));
    }
    if (!fields.start || !fields.end || fields.end < fields.start || (Date.parse(fields.end)-Date.parse(fields.start))/86400000>60) {
      delete fields.start; delete fields.end;
    }
    if (!Number.isInteger(fields.nights) || fields.nights<1 || fields.nights>30) delete fields.nights;
    for (const key of ['flightBudget','hotelBudget']) if (!Number.isFinite(fields[key]) || fields[key]<1 || fields[key]>100000) delete fields[key];
    if (!Number.isFinite(fields.rating) || fields.rating<1 || fields.rating>5) delete fields.rating;
    if (/highly rated|high[- ]rated|good ratings/i.test(text) && !fields.rating) warnings.push('“Highly rated” needs a numeric guest rating. No rating threshold was guessed.');
    // Only forward simple affirmative supported preferences to the existing simulator.
    const notes = [];
    if (!/\b(?:not|no|avoid|without|don['’]t)\b/i.test(text)) {
      if (/\b(?:prefer|prioritize|want)\s+comfort\b/i.test(text)) notes.push('Prioritize comfort');
      if (/\b(?:prefer|want)\s+(?:nonstop|non-stop|direct) flights?\b/i.test(text)) notes.push('Nonstop flights');
    }
    const constraints=parsePreferenceConstraints(text);
    const hasConstraints=Object.values(constraints.hard).some(value=>Array.isArray(value)?value.length:Boolean(value))||Object.values(constraints.strong).some(Boolean)||Object.values(constraints.soft).some(Boolean)||constraints.pace;
    fields.notes=hasConstraints&&!(notes.length===1&&notes[0]==='Prioritize comfort'&&Object.keys(constraints.strong).length===1)?text:notes.join('. ');
    for (const key of Object.keys(fields)) if (fields[key] === undefined) delete fields[key];
    const broadMonth=text.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*月|\b(?:January|February|March|April|May|June|July|August|September|October|November|December|next month|this weekend|Mid-Autumn Festival|National Day|Spring Festival)\b|中秋|国庆|國慶|春节|春節|下个月|下個月|这个周末|這個週末|周末|週末/i);if(!dateHint&&broadMonth)dateHint=broadMonth[0].trim();
    const domesticOnly=/只(?:想|去|看)?国内|仅限国内|domestic only/i.test(text),internationalOnly=/只(?:想|去|看)?出境|只(?:想|去|看)?国外|仅限出境|international only/i.test(text);
    const interpretation={origin:fields.origin||null,destination:fields.destination||null,destinationState:fields.destination?'provided':'discovery_required',earliestDeparture:fields.start||null,latestDeparture:fields.end||null,departureWindowText:dateHint||null,durationDays:fields.nights||null,totalTripBudgetCny:fields.totalTripBudgetCny||null,flightBudgetCny:fields.flightBudget||null,hotelBudgetPerNightCny:fields.hotelBudget||null,minimumHotelRating:fields.rating||null,avoidOvernightFlights:/不要红眼|避免红眼|avoid (?:overnight|red[- ]?eye)/i.test(text)?true:null,travelIntents:fields.travelIntents,domesticAllowed:internationalOnly?false:domesticOnly?true:null,internationalAllowed:domesticOnly?false:internationalOnly?true:null,pace:null,preferences:[]};
    return {fields, needsConfirmation:Object.keys(tripFields).filter(key=>fields[key]===undefined), warnings, dateHint,interpretation,
      source:'demo',parserStatus:'demo'};
  }
}
