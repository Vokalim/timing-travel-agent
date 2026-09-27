const API='https://commons.wikimedia.org/w/api.php';
const WIKIVOYAGE_API='https://en.wikivoyage.org/w/api.php';
const ACCEPTED_LICENSES=[
 {test:/\bcc0\b/i,label:'CC0',attributionRequired:false},
 {test:/public domain|\bpd\b/i,label:'Public Domain',attributionRequired:false},
 {test:/cc\s*by-sa/i,label:null,attributionRequired:true},
 {test:/cc\s*by(?!-nc|-nd)/i,label:null,attributionRequired:true}
];
const REJECTED_TEXT=/\b(map|logo|poster|advertisement|brochure|coat of arms|flag|diagram|drawing|illustration|painting|render|floor plan|locator|screenshot|screen capture|document|scan|icon|seal|stamp|banner|infographic)\b/i;
const PEOPLE_TITLE=/\b(crowd|crowds|portrait|selfie|tour group|people)\b/i;
const WEAK_DETAIL=/\b(interior|menu|dish|food|sign|door|window|statue detail|shopfront|hotel room|museum exhibit)\b/i;
const PHOTO_MIME=new Set(['image/jpeg','image/png','image/webp']);

const clean=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const metadataValue=(metadata,key)=>clean(metadata?.[key]?.value);
const words=value=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(word=>word.length>1);
const includesIdentity=(text,identity)=>{
 const haystack=clean(text).toLowerCase(),names=[identity.canonicalCity,identity.names?.en,identity.names?.zh].filter(Boolean);
 return names.some(name=>haystack.includes(String(name).toLowerCase()));
};

export function acceptedLicense(metadata){
 const short=metadataValue(metadata,'LicenseShortName'),usage=metadataValue(metadata,'UsageTerms'),url=metadataValue(metadata,'LicenseUrl');
 const combined=`${short} ${usage}`;
 if(/noncommercial|no derivatives|\bcc-by-nc|\bcc-by-nd|all rights reserved/i.test(combined))return null;
 const accepted=ACCEPTED_LICENSES.find(item=>item.test.test(combined));
 if(!accepted||!url)return null;
 return {license:short||usage||accepted.label,licenseUrl:url,attributionRequired:accepted.attributionRequired};
}

export function buildCommonsSearchQuery(identity){
 const place=identity.canonicalCity,type=identity.entityType||'city';
 const subject=['island','scenic_area','nature_destination'].includes(type)?'landscape':type==='historic_destination'?'landmark':'skyline';
 const region=clean(identity.regionNames?.en),country=clean(identity.countryNames?.en),qualifiers=[];
 if(region&&region.toLowerCase()!==place.toLowerCase())qualifiers.push(region);
 if(country&&!/^unknown$/i.test(country)&&![place,...qualifiers].some(value=>value.toLowerCase()===country.toLowerCase()))qualifiers.push(country);
 return [place,...qualifiers,subject].join(' ');
}

export function scoreCommonsCandidate(page,identity){
 const info=page?.imageinfo?.[0];if(!info||!PHOTO_MIME.has(info.mime)||info.mediatype!=='BITMAP')return null;
 if(info.width<1200||info.height<600||info.width/info.height<1.12||info.width/info.height>2.8)return null;
 const metadata=info.extmetadata||{},license=acceptedLicense(metadata);if(!license)return null;
 const description=metadataValue(metadata,'ImageDescription'),categories=metadataValue(metadata,'Categories'),title=clean(page.title).replace(/^File:/i,''),combined=`${title} ${description} ${categories}`;
 if(REJECTED_TEXT.test(combined)||PEOPLE_TITLE.test(title)||!includesIdentity(combined,identity))return null;
 const type=identity.entityType||'city',visualText=`${title} ${description}`;
 if(type==='city'&&!/skyline|cityscape|panorama|aerial|urban|city view|opera house|castle|temple|cathedral|tower|palace|bridge|old town|central business district|\bcbd\b/i.test(visualText))return null;
 if(['island','scenic_area','nature_destination'].includes(type)&&!/landscape|panorama|coast|beach|mountain|lake|island|forest|valley|waterfall|national park|scenic/i.test(visualText))return null;
 const country=identity.countryNames?.en,region=identity.regionNames?.en;
 let score=includesIdentity(title,identity)?55:35;
 if(country&&clean(combined).toLowerCase().includes(country.toLowerCase()))score+=12;
 if(region&&region!==identity.canonicalCity&&clean(combined).toLowerCase().includes(region.toLowerCase()))score+=8;
 if(/panorama|skyline|cityscape|landscape|landmark|historic|aerial|view|streetscape|waterfront/i.test(combined))score+=8;
 if(WEAK_DETAIL.test(visualText))score-=18;
 const ratio=info.width/info.height;score+=Math.max(0,Math.round(8-Math.abs(ratio-1.7)*6));
 if(info.width>=2400&&info.height>=1200)score+=4;
 if(/night/i.test(combined))score+=1;
 const tokenOverlap=words(identity.canonicalCity).filter(token=>words(combined).includes(token)).length;score+=tokenOverlap*3;
 const author=metadataValue(metadata,'Artist')||metadataValue(metadata,'Credit');
 if(!author||!info.thumburl||!info.descriptionurl)return null;
 return {score,image:{
  src:info.thumburl,url:info.thumburl,description:description||`${identity.canonicalCity} destination photograph`,kind:'photograph',source:'Wikimedia Commons',sourceUrl:info.descriptionurl,
  author,license:license.license,licenseUrl:license.licenseUrl,attributionRequired:license.attributionRequired,destinationId:identity.key,destinationIdentity:identity.key,
  width:info.thumbwidth||info.width,height:info.thumbheight||info.height,imageWidth:info.width,imageHeight:info.height,discoveredAt:new Date().toISOString(),matchConfidence:score>=70?'high':'medium',resolutionSource:'commons-search'
 }};
}

export class WikimediaDestinationImageDiscovery {
 constructor({fetchImpl=globalThis.fetch,timeoutMs=6500}={}){this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;}
 async discover(identity){
  if(!this.fetchImpl||!identity?.key||!identity.canonicalCity)return null;
  const params=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',generator:'search',gsrnamespace:'6',gsrlimit:'10',gsrsearch:buildCommonsSearchQuery(identity),prop:'imageinfo',iiprop:'url|size|mime|mediatype|extmetadata',iiurlwidth:'1280',iiextmetadatalanguage:'en',iiextmetadatafilter:'LicenseShortName|LicenseUrl|UsageTerms|Artist|Credit|ImageDescription|Categories'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const response=await this.fetchImpl(`${API}?${params}`,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)return null;
   const payload=await response.json(),ranked=(payload?.query?.pages||[]).map(page=>scoreCommonsCandidate(page,identity)).filter(Boolean).sort((a,b)=>b.score-a.score);
   const selected=ranked.find(item=>item.score>=55);if(selected)return selected.image;
   return await this.resolveWikivoyagePageImage(identity,controller.signal);
  }catch{return null;}finally{clearTimeout(timer);}
 }
 async resolveWikivoyagePageImage(identity,signal){
  const pageParams=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',prop:'pageimages',piprop:'name',titles:identity.canonicalCity});
  const pageResponse=await this.fetchImpl(`${WIKIVOYAGE_API}?${pageParams}`,{signal,headers:{Accept:'application/json'}});if(!pageResponse.ok)return null;
  const pagePayload=await pageResponse.json(),fileName=pagePayload?.query?.pages?.[0]?.pageimage;if(!fileName)return null;
  const fileParams=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',titles:`File:${fileName}`,prop:'imageinfo',iiprop:'url|size|mime|mediatype|extmetadata',iiurlwidth:'1280',iiextmetadatalanguage:'en',iiextmetadatafilter:'LicenseShortName|LicenseUrl|UsageTerms|Artist|Credit|ImageDescription|Categories'});
  const fileResponse=await this.fetchImpl(`${API}?${fileParams}`,{signal,headers:{Accept:'application/json'}});if(!fileResponse.ok)return null;
  const filePayload=await fileResponse.json(),ranked=(filePayload?.query?.pages||[]).map(page=>scoreCommonsCandidate(page,identity)).filter(Boolean).sort((a,b)=>b.score-a.score),selected=ranked.find(item=>item.score>=55);
  return selected?{...selected.image,resolutionSource:'wikivoyage-page-image'}:null;
 }
}
