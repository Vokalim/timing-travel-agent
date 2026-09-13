import {createTemporalContext} from './temporal-context.js';

const ideas={
 festive:['圣诞街景','Christmas lights','想感受圣诞氛围','I want a festive Christmas trip'],
 snow_winter:['去看雪','Find the snow','想去看雪','I want to see snow'],
 beach:['去看海','See the sea','想去海边','I want a beach trip'],
 warm_beach:['暖冬海边','Winter sun by the sea','想去暖和的海边','I want a warm beach escape'],
 hiking:['春日徒步','Spring trails','想去徒步','I want a hiking trip'],
 nature:['山野风景','Into nature','想看自然风景','I want a nature trip'],
 food:['寻味一座城','A food journey','想去吃当地美食','I want to travel for food'],
 relaxation:['放空几天','Slow down','想找个地方放松几天','I want a relaxing escape'],
 shopping:['逛逛一座城','City wandering','想逛一逛城市','I want a city break'],
 foliage:['去看秋景','Autumn colors','想去看秋景','I want to see autumn scenery'],
 spring_festival:['过个不一样的年','Lunar New Year escape','春节想出去玩','I want a Lunar New Year trip'],
 qingming:['清明踏青','Spring holiday outdoors','清明想踏青','I want a spring holiday escape'],
 labor:['五一小长假','May holiday escape','五一想出去玩','I want a May holiday trip'],
 dragon:['端午走走','Dragon Boat break','端午想出去玩','I want a Dragon Boat holiday trip'],
 midautumn:['中秋去赏月','Mid-Autumn escape','中秋想出去玩','I want a Mid-Autumn trip'],
 national:['国庆去看看','Golden Week escape','国庆想出去玩','I want a Golden Week trip'],
 newyear:['跨年旅行','New Year escape','想找个地方跨年','I want a New Year trip'],
 weekend:['周末短途','Weekend escape','想安排周末短途旅行','I want a weekend escape']
};
const holidayIdeas=(text,month)=>{
 if(/春节|春節|lunar new year|spring festival/i.test(text))return 'spring_festival';
 if(/清明|qingming/i.test(text))return 'qingming';
 if(/五一|劳动节|勞動節|may holiday/i.test(text))return 'labor';
 if(/端午|dragon boat/i.test(text))return 'dragon';
 if(/中秋|mid.autumn/i.test(text))return 'midautumn';
 if(/国庆|國慶|golden week|national day/i.test(text))return 'national';
 if(/圣诞|聖誕|christmas/i.test(text))return 'festive';
 if(/跨年|new year/i.test(text))return 'newyear';
 // Approximate seasonal inspiration, not asserted holiday dates.
 return month===12?'festive':month===10?'national':month===5?'labor':null;
};
export class InspirationService {
 getIdeas({text='',preferences={},now=new Date()}={}){
  const context=createTemporalContext({...preferences,departureWindowText:preferences.departureWindowText||text},{now});
  const month=context.month,holiday=holidayIdeas(text,month);
  const seasonal=month===12||month<=2?['snow_winter','warm_beach','relaxation','food']:month<=5?['hiking','nature','food','relaxation']:month<=8?['beach','nature','relaxation','food']:['foliage','hiking','food','weekend'];
  const explicit=(preferences.travelIntents||[]).map(intent=>intent==='beach'&&context.season==='winter'?'warm_beach':intent).filter(key=>ideas[key]);
  const order=[...explicit,holiday,...seasonal,preferences.durationDays&&preferences.durationDays<=3?'weekend':null,'shopping','beach'];
  return [...new Set(order.filter(key=>ideas[key]))].slice(0,5).map(key=>({key,zh:ideas[key][0],en:ideas[key][1],promptZh:ideas[key][2],promptEn:ideas[key][3]}));
 }
}
