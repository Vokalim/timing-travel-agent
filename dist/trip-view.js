import {displayCity} from './lib/discovery/destination-identity.js';
import {displayLabel} from './lib/display-localization.js';
import {LocalDestinationVisualProvider} from './lib/discovery/destination-visual-provider.js';

const visualProvider=new LocalDestinationVisualProvider();
const e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const label=(language,zh,en)=>language==='zh'?zh:en;
export const MAX_TRIP_COLLAGE_IMAGES=2;

export function tripHeroImages(destination){const visual=visualProvider.getVisual(destination),primary=visual.heroImages[0],secondary=visual.scenicImages[0]||primary;return [primary,secondary].filter(Boolean).slice(0,MAX_TRIP_COLLAGE_IMAGES);}
export function renderTripHero(experience,language='zh'){
 const city=displayCity(experience.trip.destination,language),images=tripHeroImages(experience.trip.destination);
 return `<div class="trip-hero"><div class="trip-hero-copy"><span>${label(language,'从一个想法，到一趟完整旅行','FROM AN IDEA TO A COMPLETE TRIP')}</span><strong>${e(city)}</strong><small>${e(experience.trip.nights)} ${label(language,'天的旅行方向','day trip outline')}</small></div><div class="trip-hero-images" aria-hidden="true">${images.map((image,index)=>`<img class="${index?'trip-hero-small':'trip-hero-large'}" src="${e(image.src)}" alt="" loading="lazy">`).join('')}</div></div>`;
}
export function renderTripSections(experience,language='zh'){
 const transport=experience.transport.options.map(option=>{
  const title=displayLabel(option.mode,language),primary=option.allowed&&option.mode===experience.transport.preferredMode;
  const fit=!option.allowed?label(language,'与你的限定交通方式不符','Excluded by your transport requirement'):option.suitability==='not_applicable'?label(language,'不适用于此路线','Not suitable for this route'):option.suitability==='high'?label(language,'适合这条路线','Well suited to this route'):option.suitability==='medium'?label(language,'可以考虑','Worth considering'):label(language,'不优先','Lower priority');
  let verification=option.mode==='train'?label(language,'实时车次与票价暂未接入','Live schedules and fares not connected'):option.mode==='self_drive'?label(language,'未接入路线、路费与驾车时间','No route, toll or drive-time data'):option.verification.status==='verified'?`${option.verification.source==='live'?'Duffel':displayLabel('demo',language)} · ${option.currency==='CNY'?'¥'+Math.round(option.price).toLocaleString('en-US'):label(language,'已核验航班','Verified flight')}`:option.verification.status==='partially_verified'?option.verification.source==='demo'?label(language,'演示航班参考 · 接驳与总价待核验','Demo flight reference · Onward transfer and total cost unverified'):label(language,'入口航班已核验 · 接驳与总价待核验','Entry flight checked · Onward transfer and total cost unverified'):option.verification.status==='unavailable'?label(language,'航班数据暂不可用','Flight data unavailable'):label(language,'航班尚未核验','Flight not verified');
  if(option.suitability==='not_applicable')verification='';
  return `<div class="transport-row${primary?' transport-primary':''}"><div><strong>${e(title)}</strong><span>${e(fit)}</span></div><p>${e(verification)}</p></div>`;
 }).join('');
 const areas=experience.stay.areas.map(area=>`<span>${e(area.labels[language==='zh'?'zh':'en'])}</span>`).join(' · ');
 const itinerary=experience.itinerary.days.map(day=>`<li><b>${label(language,'第','Day ')}${day.day}${language==='zh'?'天':''}</b><span>${e(day.labels[language==='zh'?'zh':'en'])}</span></li>`).join('');
 return `<section class="trip-module" data-trip-module="transport"><div class="trip-module-heading"><span>02</span><h3>${label(language,'怎么去','Transport')}</h3></div><div class="transport-rows">${transport}</div></section><section class="trip-module" data-trip-module="stay"><div class="trip-module-heading"><span>03</span><h3>${label(language,'住哪里','Stay')}</h3></div><p class="trip-module-intro">${label(language,'推荐关注的区域：','Areas to consider: ')}${areas}</p><p class="trip-availability">${label(language,'途米规划建议 · 住宿实时价格与库存暂未接入','Timing planning guidance · Live hotel prices and inventory not connected')}</p></section><section class="trip-module" data-trip-module="itinerary"><div class="trip-module-heading"><span>04</span><h3>${label(language,'怎么玩','Itinerary')}</h3></div><ol class="itinerary-days">${itinerary}</ol><p class="trip-availability">${label(language,'灵活行程建议 · 具体地点与营业时间尚未核验','Flexible trip outline · Specific places and opening hours are not verified')}</p></section>`;
}
