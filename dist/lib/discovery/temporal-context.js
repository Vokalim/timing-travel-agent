const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const pad=value=>String(value).padStart(2,'0');
const iso=date=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
const addDays=(date,days)=>new Date(date.getTime()+days*86400000);
const season=month=>[12,1,2].includes(month)?'winter':[3,4,5].includes(month)?'spring':[6,7,8].includes(month)?'summer':'autumn';
const inferredFor=(month,holiday)=>{
  if(holiday==='christmas') return ['festive','snow_winter','shopping'];
  if(holiday==='spring_festival') return ['family','food','culture'];
  const bySeason={winter:['festive','snow_winter','food','shopping','relaxation'],spring:['nature','culture','hiking'],summer:['beach','nature','relaxation'],autumn:['nature','food','hiking','culture']};
  return bySeason[season(month)]||[];
};
const monthFromText=text=>{
  const normalized=String(text||'').trim().toLowerCase();
  const chinese=normalized.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*月/);if(chinese)return Number(chinese[1]);
  const index=MONTHS.findIndex(month=>new RegExp(`\\b${month}(?:\\s+travel)?\\b`,'i').test(normalized));return index<0?null:index+1;
};
const yearFromText=text=>{const match=String(text||'').match(/\b(20\d{2})\s*年|\b(20\d{2})\b/);return match?Number(match[1]||match[2]):null;};
const nextMonthYear=(month,now)=>({month,year:month<now.getUTCMonth()+1?now.getUTCFullYear()+1:now.getUTCFullYear()});

export function createTemporalContext(preferences,{now=new Date(),language='en'}={}) {
  const earliest=preferences.earliestDeparture,latest=preferences.latestDeparture,text=String(preferences.departureWindowText||'').trim();
  if(earliest&&latest) {const month=Number(earliest.slice(5,7));return {kind:'exact_window',datePrecision:'exact',dateDescription:`${earliest} – ${latest}`,basis:'user_provided_dates',earliestDeparture:earliest,latestDeparture:latest,month,year:Number(earliest.slice(0,4)),season:season(month),holiday:null,inferredTravelIntents:inferredFor(month),language};}
  let month=monthFromText(text),holiday=null,kind='broad_period';
  if(/圣诞|聖誕|christmas/i.test(text)){month=month||12;holiday=month===12?'christmas':null;}
  else if(/春节|春節|lunar new year|spring festival|清明|qingming|五一|劳动节|勞動節|may holiday|端午|dragon boat|中秋|mid.autumn|国庆|國慶|golden week|national day|跨年|new year/i.test(text)){
    holiday=/春节|春節|lunar new year|spring festival/i.test(text)?'spring_festival':/清明|qingming/i.test(text)?'qingming':/五一|劳动节|勞動節|may holiday/i.test(text)?'labor':/端午|dragon boat/i.test(text)?'dragon_boat':/中秋|mid.autumn/i.test(text)?'mid_autumn':/国庆|國慶|golden week|national day/i.test(text)?'national_day':'new_year';
    if(!month)return {kind:'holiday_soft_context',datePrecision:'holiday',dateDescription:text,basis:'user_requested_holiday',periodText:text,month:null,year:null,season:holiday==='spring_festival'||holiday==='new_year'?'winter':'unknown',holiday,inferredTravelIntents:holiday==='spring_festival'?inferredFor(null,holiday):[],language};
  }
  else if(/暑假|summer holiday/i.test(text)){month=month||7;}
  else if(/下个月|下個月|next month/i.test(text)){month=(now.getUTCMonth()+1)%12+1;kind='relative_period';}
  else if(/这个周末|這個週末|this weekend/i.test(text)){const day=now.getUTCDay(),offset=(6-day+7)%7;const start=addDays(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),offset);return {kind:'relative_weekend',datePrecision:'relative',dateDescription:text,basis:'user_relative_period',month:start.getUTCMonth()+1,year:start.getUTCFullYear(),season:season(start.getUTCMonth()+1),holiday:null,inferredTravelIntents:inferredFor(start.getUTCMonth()+1),generatedAnchor:iso(start),language};}
  if(month){const year=yearFromText(text)||nextMonthYear(month,now).year;return {kind,datePrecision:kind==='relative_period'?'relative':holiday?'holiday':'broad_month',dateDescription:text,basis:'user_requested_period',periodText:text,month,year,season:season(month),holiday,inferredTravelIntents:inferredFor(month,holiday),language};}
  const currentMonth=now.getUTCMonth()+1;
  return {kind:'current_soft_context',datePrecision:'none',dateDescription:null,basis:'current_date_soft_context',month:currentMonth,year:now.getUTCFullYear(),season:season(currentMonth),holiday:null,inferredTravelIntents:inferredFor(currentMonth),language};
}

export function planRepresentativeDateWindows(context,durationDays,{limit=3}={}) {
  if(!Number.isInteger(durationDays)||durationDays<1||durationDays>30) return [];
  if(context.kind==='current_soft_context'||context.kind==='holiday_soft_context') return [];
  if(context.kind==='relative_weekend') {const departure=context.generatedAnchor;return [{departure,returnDate:iso(addDays(new Date(departure+'T00:00:00Z'),durationDays)),source:'system_generated_exploration_window',userProvided:false,basis:'relative_period'}];}
  if(context.kind==='exact_window') {
    const start=new Date(context.earliestDeparture+'T00:00:00Z'),end=new Date(context.latestDeparture+'T00:00:00Z'),days=Math.floor((end-start)/86400000),offsets=[0,Math.floor(days/2),days];
    return [...new Set(offsets)].slice(0,limit).map(offset=>{const departure=iso(addDays(start,offset));return {departure,returnDate:iso(addDays(new Date(departure+'T00:00:00Z'),durationDays)),source:'system_generated_exploration_window',userProvided:false,basis:'user_provided_dates'};});
  }
  const lastDay=new Date(Date.UTC(context.year,context.month,0)).getUTCDate(),latestStart=Math.max(1,lastDay-durationDays),days=[5,Math.max(5,Math.floor(latestStart/2)),Math.min(20,latestStart)].filter(day=>day<=latestStart);
  return [...new Set(days)].slice(0,limit).map(day=>{const departure=`${context.year}-${pad(context.month)}-${pad(day)}`;return {departure,returnDate:iso(addDays(new Date(departure+'T00:00:00Z'),durationDays)),source:'system_generated_exploration_window',userProvided:false,basis:'user_requested_period'};});
}
