import {destinationIdentity} from './destination-identity.js';
import {getDestination} from './destination-universe.js';
import {DestinationImageCache} from './destination-image-cache.js';
import {WikimediaDestinationImageDiscovery} from './wikimedia-image-discovery.js';

const ownedIllustration=(src,description)=>({
 src,url:src,description,kind:'illustration',source:'Timing · 途米',sourceUrl:null,
 author:'Timing · 途米',license:'Project-owned',licenseUrl:null,attributionRequired:false,
 destinationId:null,destinationIdentity:null,imageWidth:null,imageHeight:null
});
const asset=(name,description)=>ownedIllustration(`/assets/${name}-editorial.jpg`,description);
const commonsPhoto=({destinationId,file,description,sourceUrl,author,license,licenseUrl,attributionRequired=true})=>({
 src:`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`,
 url:`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`,
 description,kind:'photograph',source:'Wikimedia Commons',sourceUrl,author,license,licenseUrl,attributionRequired,destinationId,
 destinationIdentity:destinationId,imageWidth:null,imageHeight:null
});

const cityVisuals={
 tokyo:{heroImages:[commonsPhoto({destinationId:'tokyo',file:'Tokyo-skyline.jpg',description:'Tokyo skyline',sourceUrl:'https://commons.wikimedia.org/wiki/File:Tokyo-skyline.jpg',author:'Zara Seemann',license:'CC BY-SA 2.0 DE',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/de/deed.en'})],scenicImages:[],fallbackCategory:'urban'},
 seoul:{heroImages:[commonsPhoto({destinationId:'seoul',file:'Seoul Night Skyline 2022.jpg',description:'Seoul skyline viewed from N Seoul Tower',sourceUrl:'https://commons.wikimedia.org/wiki/File:Seoul_Night_Skyline_2022.jpg',author:'Takipoint123',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'})],scenicImages:[],fallbackCategory:'urban'},
 chengdu:{heroImages:[commonsPhoto({destinationId:'chengdu',file:'在成都遥望雪山 Chengdu skyline at sunset with a view of Mount Siguniang 4.jpg',description:'Chengdu skyline at sunset with Mount Siguniang',sourceUrl:'https://commons.wikimedia.org/wiki/File:在成都遥望雪山_Chengdu_skyline_at_sunset_with_a_view_of_Mount_Siguniang_4.jpg',author:'书剑飘零',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'})],scenicImages:[],fallbackCategory:'urban'},
 kyoto:{heroImages:[commonsPhoto({destinationId:'kyoto',file:'Kiyomizu-dera panorama.jpg',description:'Kiyomizu-dera and Kyoto panorama',sourceUrl:'https://commons.wikimedia.org/wiki/File:Kiyomizu-dera_panorama.jpg',author:'lumoplank',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attributionRequired:false})],scenicImages:[],fallbackCategory:'historic'},
 paris:{heroImages:[commonsPhoto({destinationId:'paris',file:'Panorama of the Paris Skyline.jpg',description:'Panorama of the Paris skyline',sourceUrl:'https://commons.wikimedia.org/wiki/File:Panorama_of_the_Paris_Skyline.jpg',author:'DiscoA340',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'})],scenicImages:[],fallbackCategory:'urban'}
};
const categoryVisuals={
 coastal:asset('coastal','Illustrative coastal travel mood'),tropical:asset('coastal','Illustrative tropical coast mood'),
 mountain:ownedIllustration('/assets/journey-landscape.png','Illustrative mountain journey mood'),
 winter:asset('winter-forest','Illustrative winter forest mood'),urban:asset('east-asian-urban','Illustrative city travel mood'),
 historic:asset('historic','Illustrative historic travel mood'),
 grassland:ownedIllustration('/assets/grassland-landscape.svg','Illustrative grassland mood'),
 desert:ownedIllustration('/assets/desert-landscape.svg','Illustrative desert mood'),
 east_asian_urban:asset('east-asian-urban','Illustrative East Asian city travel mood'),
 east_asian_historic:asset('east-asian-historic','Illustrative East Asian historic travel mood')
};
const globalFallback=ownedIllustration('/assets/journey-landscape.png','Neutral Timing journey illustration');

const withIdentity=(image,identity)=>({...image,
 destinationId:identity.key,destinationIdentity:identity.key,
 description:image.kind==='photograph'?image.description:`Timing visual fallback for ${identity.canonicalCity}`
});
const visualResult=(identity,image,specificity)=>({
 destinationKey:identity.key,heroImages:[withIdentity(image,identity)],scenicImages:[],
 fallbackCategory:identity.fallbackCategory,specificity
});

export class DestinationVisualProvider { getVisual(){throw new Error('Implement DestinationVisualProvider.getVisual(destination).');} }
export class LocalDestinationVisualProvider extends DestinationVisualProvider {
 constructor({discovery=new WikimediaDestinationImageDiscovery(),cache=new DestinationImageCache()}={}){super();this.discovery=discovery;this.cache=cache;this.inflight=new Map();}
 getVisual(destination){
  const identity=destinationIdentity(destination),city=cityVisuals[identity.key],known=getDestination(destination);
  const cached=!city&&this.cache?.read(identity.key);if(cached?.status==='verified')return visualResult(identity,cached.image,'discovered');
  const fallbackCategory=city?.fallbackCategory||identity.fallbackCategory;
  const isAsian=['中国','中国香港','日本','韩国','新加坡','泰国'].includes(identity.countryNames.zh);
  const regionalCategory=isAsian&&fallbackCategory==='historic'?'east_asian_historic':isAsian&&fallbackCategory==='urban'?'east_asian_urban':fallbackCategory;
  const category=known?categoryVisuals[regionalCategory]:null;
  if(city)return visualResult(identity,city.heroImages[0],'city');
  return visualResult({...identity,fallbackCategory},category||globalFallback,category?'fallback-category':'fallback-neutral');
 }
 async resolveVisual(destination){
  const base=destinationIdentity(destination),known=getDestination(destination),identity={...base,entityType:known?.entityType||destination?.entityType||base.entityType||'city'},existing=cityVisuals[base.key];if(existing)return this.getVisual(destination);
  const cached=this.cache.read(identity.key);if(cached?.status==='verified')return visualResult(identity,cached.image,'discovered');
  if(cached?.status==='unavailable')return this.getVisual(destination);
  if(!this.inflight.has(identity.key))this.inflight.set(identity.key,this.discovery.discover(identity).then(image=>{if(image){this.cache.writeSuccess(identity.key,image);return image;}this.cache.writeFailure(identity.key);return null;}).finally(()=>this.inflight.delete(identity.key)));
  const image=await this.inflight.get(identity.key);return image?visualResult(identity,image,'discovered'):this.getVisual(destination);
 }
}
