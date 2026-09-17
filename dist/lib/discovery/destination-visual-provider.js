import {destinationIdentity} from './destination-identity.js';
import {getDestination} from './destination-universe.js';

const asset=(name,description)=>({src:`/assets/${name}-editorial.jpg`,description,kind:'illustration'});
const cityVisuals={
 tokyo:{heroImages:[asset('tokyo','Illustrative Tokyo street at dusk')],scenicImages:[asset('east-asian-urban','Illustrative East Asian urban travel mood')],fallbackCategory:'urban'},
 chengdu:{heroImages:[asset('chengdu','Illustrative Chengdu teahouse courtyard')],scenicImages:[asset('east-asian-historic','Illustrative East Asian historic travel mood')],fallbackCategory:'urban'}
};
const regionVisuals={Hokkaido:asset('winter-forest','Illustrative Hokkaido winter mood'),Andalusia:asset('historic','Illustrative Andalusian historic mood'),Yunnan:{src:'/assets/journey-landscape.png',description:'Illustrative Yunnan landscape mood',kind:'illustration'}};
const categoryVisuals={
 coastal:asset('coastal','Illustrative coastal travel mood'),tropical:asset('coastal','Illustrative tropical coast mood'),
 mountain:{src:'/assets/journey-landscape.png',description:'Illustrative mountain journey mood',kind:'illustration'},
 winter:asset('winter-forest','Illustrative winter forest mood'),urban:asset('east-asian-urban','Illustrative city travel mood'),
 historic:asset('historic','Illustrative historic travel mood'),
 grassland:{src:'/assets/grassland-landscape.svg',description:'Illustrative grassland mood',kind:'illustration'},
 desert:{src:'/assets/desert-landscape.svg',description:'Illustrative desert mood',kind:'illustration'},
 east_asian_urban:asset('east-asian-urban','Illustrative East Asian city travel mood'),
 east_asian_historic:asset('east-asian-historic','Illustrative East Asian historic travel mood')
};
const categoryScenic={
 coastal:asset('historic','Illustrative coastal-town travel mood'),tropical:asset('east-asian-urban','Illustrative tropical-city travel mood'),
 mountain:asset('winter-forest','Illustrative mountain forest mood'),winter:{src:'/assets/journey-landscape.png',description:'Illustrative winter journey mood',kind:'illustration'},
 urban:asset('historic','Illustrative historic city detail'),historic:asset('east-asian-urban','Illustrative city travel detail'),
 grassland:{src:'/assets/journey-landscape.png',description:'Illustrative open-landscape journey mood',kind:'illustration'},
 desert:asset('historic','Illustrative historic travel detail'),east_asian_urban:asset('east-asian-historic','Illustrative East Asian historic detail'),east_asian_historic:asset('east-asian-urban','Illustrative East Asian city detail')
};
const globalFallback={src:'/assets/journey-landscape.png',description:'Illustrative journey landscape without a named destination',kind:'illustration'};
export class DestinationVisualProvider { getVisual(){throw new Error('Implement DestinationVisualProvider.getVisual(destination).');} }
export class LocalDestinationVisualProvider extends DestinationVisualProvider {
 getVisual(destination){
  const identity=destinationIdentity(destination),city=cityVisuals[identity.key],known=getDestination(destination);
  const fallbackCategory=city?.fallbackCategory||identity.fallbackCategory;
  const isAsian=['中国','中国香港','日本','韩国','新加坡','泰国'].includes(identity.countryNames.zh);
  const regionalCategory=isAsian&&fallbackCategory==='historic'?'east_asian_historic':isAsian&&fallbackCategory==='urban'?'east_asian_urban':fallbackCategory;
  const region=identity.regionNames?.en,regionalVisual=regionVisuals[region];
  const category=known?categoryVisuals[regionalCategory]:null;
  const heroImages=city?.heroImages||[regionalVisual||category||globalFallback];
  const scenicImages=city?.scenicImages||[categoryScenic[regionalCategory]||categoryScenic[fallbackCategory]||globalFallback];
  return {destinationKey:identity.key,heroImages:heroImages.slice(0,1),scenicImages:scenicImages.slice(0,1),fallbackCategory,specificity:city?'city':regionalVisual?'region':category?'category':'global'};
 }
}
