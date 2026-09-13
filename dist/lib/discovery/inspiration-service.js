import {createTemporalContext} from './temporal-context.js';

// Editorial inspiration only: no live popularity, availability, or weather claims.
const make=(key,group,zh,en,options={})=>({key,group,zh,en,promptZh:`想要${zh}的旅行`,promptEn:`I'd like a trip for ${en.toLowerCase()}`,...options});
export const INSPIRATION_TAXONOMY=Object.freeze({
 holiday:['christmas','new_year','spring_festival','lantern_festival','qingming','labor','dragon_boat','mid_autumn','national_day','cherry_blossom','autumn_foliage','snow_season','europe_festivals','north_american_foliage'],
 scenery:['beach','island','snow','mountains','grassland','desert','forest','lakes','flowers','foliage','hot_springs','tropical','aurora'],
 style:['city_break','food','relaxation','hiking','photography','nightlife','culture','historic_towns','family','romantic','shopping','weekend_escape','slow_travel']
});
const ideas=[
 make('festive','holiday','圣诞市集','Christmas markets',{holidays:['christmas'],intent:'festive',weight:10}),
 make('christmas_lights','holiday','冬日灯光季','Winter light season',{holidays:['christmas'],intent:'festive',weight:8}),
 make('europe_christmas','holiday','欧洲圣诞街景','European Christmas streets',{holidays:['christmas'],intent:'festive',weight:7}),
 make('newyear','holiday','跨年旅行','New Year escape',{holidays:['new_year'],intent:'festive',weight:9}),
 make('newyear_nights','holiday','跨年夜景','New Year night views',{holidays:['new_year'],intent:'festive',weight:7}),
 make('spring_festival','holiday','春节换个地方过','Lunar New Year away',{holidays:['spring_festival'],weight:9}),
 make('lantern_festival','holiday','元宵灯会','Lantern Festival lights',{holidays:['lantern_festival'],weight:8}),
 make('qingming','holiday','清明踏青','Qingming spring walk',{holidays:['qingming'],weight:9}),
 make('labor','holiday','五一小长假','May holiday escape',{holidays:['labor'],weight:9}),
 make('dragon','holiday','端午慢游','Dragon Boat break',{holidays:['dragon_boat'],weight:9}),
 make('midautumn','holiday','中秋赏月','Mid-Autumn moon views',{holidays:['mid_autumn'],weight:9}),
 make('national','holiday','国庆走走','National Day journey',{holidays:['national_day'],weight:9}),
 make('cherry_blossom','holiday','春日赏樱','Cherry blossom walks',{months:[3,4],weight:7}),
 make('europe_summer','holiday','欧洲夏日节庆','European summer festivals',{months:[6,7,8],weight:6}),
 make('open_air_summer','holiday','夏日露天音乐','Summer open-air music',{months:[6,7,8],weight:5}),
 make('north_america_summer','holiday','北美夏日节庆','North American summer festivals',{months:[6,7,8],weight:4}),
 make('north_america_fall','holiday','北美秋色','North American autumn colors',{months:[9,10],weight:6}),
 make('warm_beach','scenery','暖冬看海','Winter sun by the sea',{seasons:['winter'],intent:'beach',weight:9}),
 make('island_slow','scenery','海岛放空','Slow island days',{seasons:['winter','spring','summer'],intent:'beach',weight:7}),
 make('sunny_coast','scenery','去晒太阳','Follow the sun',{seasons:['winter','spring'],intent:'beach',weight:6}),
 make('coast_sunset','scenery','日落海岸','Coastal sunsets',{seasons:['spring','summer','autumn'],intent:'beach',weight:6}),
 make('beach','scenery','去看海','See the sea',{seasons:['summer'],intent:'beach',weight:8}),
 make('island','scenery','海岛度假','Island escape',{seasons:['summer'],intent:'beach',weight:6}),
 make('diving','scenery','海边潜水','Coastal diving',{seasons:['summer'],intent:'beach',weight:4}),
 make('snow_winter','scenery','追雪','Chase the snow',{seasons:['winter'],intent:'snow_winter',weight:8}),
 make('ski','scenery','滑雪季','Ski season',{seasons:['winter'],intent:'snow_winter',weight:6}),
 make('winter_town','scenery','冬日古城','Winter old towns',{seasons:['winter'],intent:'culture',weight:5}),
 make('hot_spring','scenery','泡温泉','Hot springs',{seasons:['autumn','winter'],intent:'relaxation',weight:7}),
 make('mountain','scenery','去山里透气','Mountain air',{seasons:['spring','summer','autumn'],intent:'nature',weight:5}),
 make('grassland','scenery','草原看星空','Grassland skies',{seasons:['summer'],intent:'nature',weight:5}),
 make('desert','scenery','沙漠日落','Desert sunsets',{seasons:['spring','autumn'],intent:'nature',weight:5}),
 make('forest','scenery','森林漫步','Forest walks',{seasons:['spring','summer','autumn'],intent:'nature',weight:5}),
 make('lakes','scenery','湖边发呆','Lakeside pause',{seasons:['spring','summer','autumn'],intent:'relaxation',weight:5}),
 make('flowers','scenery','去看花开','Follow the blooms',{seasons:['spring'],intent:'nature',weight:7}),
 make('foliage','scenery','去看秋景','Autumn landscapes',{seasons:['autumn'],intent:'nature',weight:7}),
 make('tropical','scenery','热带慢生活','Tropical slow days',{seasons:['winter','summer'],intent:'beach',weight:4}),
 make('aurora','scenery','追极光','Aurora journey',{destinations:['Tromsø','Reykjavík','Fairbanks'],seasons:['winter'],weight:4}),
 make('winter_food','style','冬日寻味','Winter food trails',{seasons:['winter'],intent:'food',weight:7}),
 make('local_snacks','style','地方小吃之旅','Local snack trail',{intent:'food',weight:6}),
 make('night_market','style','去逛夜市','Night markets',{intent:'food',weight:5}),
 make('old_town_food','style','老城美食','Old-town flavors',{intent:'food',weight:5}),
 make('food_city','style','去吃一座城','Eat your way through a city',{intent:'food',weight:6}),
 make('spring_hiking','style','春日徒步','Spring trails',{seasons:['spring'],intent:'hiking',weight:6}),
 make('autumn_hiking','style','秋日徒步','Autumn trails',{seasons:['autumn'],intent:'hiking',weight:5}),
 make('summer_hiking','style','山间避暑','Cool mountain trails',{seasons:['summer'],intent:'hiking',weight:5}),
 make('city_break','style','逛一座城','City wandering',{intent:'shopping',weight:4}),
 make('photography','style','带相机出发','Travel with a camera',{intent:'photography',weight:4}),
 make('nightlife','style','夜晚去走走','Explore after dark',{intent:'nightlife',weight:4}),
 make('culture','style','逛博物馆','Museum afternoons',{intent:'culture',weight:5}),
 make('historic_town','style','走进老城','Old-town wander',{intent:'culture',weight:4}),
 make('family','style','和家人一起走走','Family time away',{intent:'family',weight:4}),
 make('romantic','style','两个人的慢旅行','A slow trip for two',{intent:'romantic',weight:4}),
 make('shopping','style','城市橱窗漫步','City shops and streets',{intent:'shopping',weight:4}),
 make('relaxation','style','放空几天','Days to unwind',{intent:'relaxation',weight:5}),
 make('slow_travel','style','慢慢走一趟','Take it slowly',{intent:'relaxation',weight:4}),
 make('weekend','duration','周末短途','Weekend escape',{maxDays:3,weight:7}),
 make('weekend_food','duration','周末吃一座城','A food-filled weekend',{maxDays:3,intent:'food',weight:5}),
 make('five_day','duration','五天换个风景','A five-day change of scene',{minDays:4,maxDays:6,weight:5}),
 make('longer_trip','duration','多住几晚','Stay a little longer',{minDays:7,weight:4})
];
const intentPatterns={beach:/海边|海滩|海岛|沙滩|beach|island|coast/i,food:/美食|吃东西|吃吃喝喝|小吃|夜市|food|eat|culinary/i,festive:/圣诞|节日氛围|christmas|festive/i,snow_winter:/雪|滑雪|snow|ski/i,nature:/自然|山水|风景|nature|scenery/i,hiking:/徒步|爬山|hiking|trek/i,relaxation:/放松|放空|休息|relax|spa/i,culture:/文化|古城|历史|museum|culture|history/i,shopping:/购物|逛街|shopping/i,family:/亲子|家庭|family|kids/i,romantic:/浪漫|蜜月|romantic|honeymoon/i,photography:/摄影|拍照|photography/i,nightlife:/夜生活|夜游|nightlife/i};
const explicitIntents=(text,preferences)=>[...new Set([...(preferences.travelIntents||[]),...Object.entries(intentPatterns).filter(([,pattern])=>pattern.test(text)).map(([key])=>key)])];
const chineseCalendar=new Intl.DateTimeFormat('en-u-ca-chinese',{month:'numeric',day:'numeric',timeZone:'UTC'});
const lunarTargets={'1/1':'spring_festival','1/15':'lantern_festival','5/5':'dragon_boat','8/15':'mid_autumn'};
const lunarCache=new Map();
function lunarDates(year){
 if(lunarCache.has(year))return lunarCache.get(year);
 const found={};for(let day=Date.UTC(year,0,1);day<Date.UTC(year+1,0,1);day+=86400000){const date=new Date(day),holiday=lunarTargets[chineseCalendar.format(date)];if(holiday&&!found[holiday])found[holiday]=date;}
 lunarCache.set(year,found);return found;
}
function holidaySet(context){
 const active=new Set(),month=context.month,year=context.year;
 if(context.holiday)active.add(context.holiday);
 if(!month||!year)return active;
 const start=context.earliestDeparture?new Date(`${context.earliestDeparture}T00:00:00Z`):new Date(Date.UTC(year,month-1,1));
 const end=context.latestDeparture?new Date(`${context.latestDeparture}T00:00:00Z`):new Date(Date.UTC(year,month,0));
 const near=(date,days=14)=>date>=new Date(start.getTime()-days*86400000)&&date<=new Date(end.getTime()+days*86400000);
 for(const [key,date] of Object.entries(lunarDates(year)))if(near(date))active.add(key);
 if(near(new Date(Date.UTC(year,11,25)),14))active.add('christmas');
 if(near(new Date(Date.UTC(year,0,1)),12)||month===12)active.add('new_year');
 if(near(new Date(Date.UTC(year,3,5)),10))active.add('qingming');
 if(near(new Date(Date.UTC(year,4,1)),10))active.add('labor');
 if(near(new Date(Date.UTC(year,9,1)),12))active.add('national_day');
 return active;
}
const hash=value=>{let h=2166136261;for(const char of value){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const wantedDays=(text,preferences)=>preferences.durationDays||Number(text.match(/(?:^|\D)(\d{1,2})\s*(?:天|晚|days?|nights?)/i)?.[1])||null;
function contextFor({text='',preferences={},now=new Date()}={}){
 const temporal=createTemporalContext({...preferences,departureWindowText:preferences.departureWindowText||text},{now});
 return {temporal,intents:explicitIntents(text,preferences),holidays:holidaySet(temporal),duration:wantedDays(text,preferences),destination:preferences.destination||null};
}
function eligibleItems({temporal,intents,holidays,duration,destination}){
 return ideas.filter(idea=>{
  if(idea.holidays&&!idea.holidays.some(holiday=>holidays.has(holiday)))return false;
  if(idea.months&&!idea.months.includes(temporal.month))return false;
  if(idea.seasons&&!idea.seasons.includes(temporal.season))return false;
  if(idea.destinations&&!idea.destinations.includes(destination))return false;
  if(idea.maxDays&&(!duration||duration>idea.maxDays))return false;
  if(idea.minDays&&(!duration||duration<idea.minDays))return false;
  return true;
 }).map(idea=>({...idea,score:(idea.weight||0)+(idea.intent&&intents.includes(idea.intent)?24:0)+(idea.holidays?6:0)}));
}
function choose(items,{seed,revision,previous=[]}){
 const count=Math.min(5,items.length),fresh=items.filter(idea=>!previous.includes(idea.key)),candidates=fresh.length>=count?fresh:items;
 const ranked=[...candidates].sort((a,b)=>b.score-a.score||hash(`${seed}:${revision}:${a.key}`)-hash(`${seed}:${revision}:${b.key}`));
 const selected=[],groups=new Map();
 for(const idea of ranked){if((groups.get(idea.group)||0)>=2)continue;selected.push(idea);groups.set(idea.group,(groups.get(idea.group)||0)+1);if(selected.length===count)break;}
 for(const idea of ranked){if(selected.length===count)break;if(!selected.includes(idea))selected.push(idea);}
 return selected.map(({score,weight,...idea})=>idea);
}
export class InspirationService {
 constructor({seed=Math.floor(Math.random()*2**31)}={}){this.seed=seed;this.revision=0;this.signature=null;this.current=[];}
 getEligiblePool(options={}){return eligibleItems(contextFor(options)).map(({score,weight,...idea})=>idea);}
 getIdeas(options={}){
  const context=contextFor(options),signature=JSON.stringify([context.temporal.dateDescription,context.temporal.month,context.temporal.year,context.intents,context.duration,context.destination]);
  if(signature!==this.signature){this.signature=signature;this.revision=0;this.current=choose(eligibleItems(context),{seed:this.seed,revision:0});}
  return this.current;
 }
 refresh(options={}){
  const previous=this.getIdeas(options).map(idea=>idea.key),context=contextFor(options);
  this.revision+=1;this.current=choose(eligibleItems(context),{seed:this.seed,revision:this.revision,previous});
  return this.current;
 }
}
