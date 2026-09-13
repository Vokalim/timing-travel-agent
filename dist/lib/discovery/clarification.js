export function nextClarification(preferences={}) {
 if(preferences.destination)return null;
 if(preferences.origin&&(preferences.travelIntents?.length||preferences.departureWindowText||preferences.earliestDeparture||preferences.durationDays||preferences.totalTripBudgetCny||preferences.flightBudgetCny))return null;
 if(!preferences.travelIntents?.length&&!preferences.departureWindowText){
  return {kind:'theme',questionZh:'这次更想要哪种感觉？',questionEn:'What kind of trip feels right?',options:[
   ['beach','去看海','See the sea'],['festive','节日氛围','Festive atmosphere'],['nature','自然风景','Nature'],['food','吃喝逛逛','Food & city'],['relaxation','放空度假','Slow down']].map(([value,zh,en])=>({value,zh,en}))};
 }
 if(!preferences.departureWindowText&&!preferences.earliestDeparture)return {kind:'time',questionZh:'大概什么时候想走？',questionEn:'Roughly when would you go?',options:[{value:'这个月',zh:'这个月',en:'This month'},{value:'下个月',zh:'下个月',en:'Next month'},{value:'这个周末',zh:'这个周末',en:'This weekend'},{value:'flexible',zh:'日期灵活',en:'Flexible dates'}]};
 return {kind:'budget',questionZh:'预算大概多少？',questionEn:'What is your approximate budget?',options:[{value:2000,zh:'¥2,000 内',en:'Under ¥2,000'},{value:5000,zh:'¥2,000–5,000',en:'¥2,000–5,000'},{value:10000,zh:'¥5,000+',en:'¥5,000+'}]};
}
