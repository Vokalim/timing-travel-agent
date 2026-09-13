import {destinationIdentity} from './destination-identity.js';

const asset=(name,description)=>({src:`/assets/${name}-editorial.jpg`,description,kind:'illustration'});
const cityVisuals={
 tokyo:{heroImages:[asset('tokyo','Illustrative Tokyo street at dusk')],scenicImages:[asset('east-asian-urban','Illustrative East Asian urban travel mood')],fallbackCategory:'urban'},
 chengdu:{heroImages:[asset('chengdu','Illustrative Chengdu teahouse courtyard')],scenicImages:[asset('east-asian-historic','Illustrative East Asian historic travel mood')],fallbackCategory:'urban'}
};
const categoryVisuals={
 coastal:asset('coastal','Illustrative coastal travel mood'),tropical:asset('coastal','Illustrative tropical coast mood'),
 mountain:{src:'/assets/journey-landscape.png',description:'Illustrative mountain journey mood',kind:'illustration'},
 winter:asset('winter-forest','Illustrative winter forest mood'),urban:asset('east-asian-urban','Illustrative city travel mood'),
 historic:asset('historic','Illustrative historic travel mood'),
 east_asian_urban:asset('east-asian-urban','Illustrative East Asian city travel mood'),
 east_asian_historic:asset('east-asian-historic','Illustrative East Asian historic travel mood')
};
export class DestinationVisualProvider { getVisual(){throw new Error('Implement DestinationVisualProvider.getVisual(destination).');} }
export class LocalDestinationVisualProvider extends DestinationVisualProvider {
 getVisual(destination){
  const identity=destinationIdentity(destination),city=cityVisuals[identity.key];
  const fallbackCategory=city?.fallbackCategory||identity.fallbackCategory;
  const isAsian=['中国','中国香港','日本','韩国','新加坡','泰国'].includes(identity.countryNames.zh);
  const regionalCategory=isAsian&&fallbackCategory==='historic'?'east_asian_historic':isAsian&&fallbackCategory==='urban'?'east_asian_urban':fallbackCategory;
  const heroImages=city?.heroImages||[categoryVisuals[regionalCategory]||categoryVisuals.urban];
  const scenicImages=city?.scenicImages||[];
  return {destinationKey:identity.key,heroImages:heroImages.slice(0,1),scenicImages:scenicImages.slice(0,1),fallbackCategory,specificity:city?'city':'category'};
 }
}
