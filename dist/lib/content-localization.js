const key=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu,' ').trim();
const hasHan=value=>/[\p{Script=Han}]/u.test(String(value||''));
const hasLatin=value=>/[A-Za-z]/.test(String(value||''));

// Verified/common place-name equivalents. Provider identity and sourceName remain unchanged.
const pairs=[
 ['Dali Bai Nationality Autonomous Prefecture Museum','大理白族自治州博物馆'],['Dali Bai Autonomous Prefecture Museum','大理白族自治州博物馆'],['Dali Museum','大理州博物馆'],
 ['Erhai Park','洱海公园'],['Erhai Lake','洱海'],['Dali Ancient City','大理古城'],['Dali Old Town','大理古城'],['Three Pagodas','崇圣寺三塔'],['Chongsheng Temple','崇圣寺'],['Cangshan Mountain','苍山'],['Cangshan','苍山'],['Xizhou','喜洲'],['Shaxi','沙溪'],
 ['Louvre Museum','卢浮宫'],['Tuileries Garden','杜乐丽花园'],['Marché Bastille','巴士底市集'],['Musee d Orsay','奥赛博物馆'],['Musée d’Orsay','奥赛博物馆'],['Luxembourg Gardens','卢森堡公园'],['Eiffel Tower','埃菲尔铁塔'],['Arc de Triomphe','凯旋门'],['Notre Dame Cathedral','巴黎圣母院'],
 ['Senso ji','浅草寺'],['Sensō-ji','浅草寺'],['Ueno Park','上野公园'],['Tokyo National Museum','东京国立博物馆'],['Erhai Gate','洱海门']
];
const enToZh=new Map(pairs.map(([en,zh])=>[key(en),zh])),zhToEn=new Map(pairs.map(([en,zh])=>[key(zh),en]));
const brandNames=new Set(['cafe de jack']);
const categoryNames={museum:{zh:'当地博物馆',en:'Local museum'},nature:{zh:'当地自然景点',en:'Local nature spot'},food:{zh:'当地餐饮地点',en:'Local food stop'},shopping:{zh:'当地购物街区',en:'Local shopping area'},photography:{zh:'当地观景点',en:'Local viewpoint'},activity:{zh:'当地体验',en:'Local experience'},culture:{zh:'当地文化景点',en:'Local cultural place'},attraction:{zh:'当地景点',en:'Local attraction'}};

export const normalizeContentLocale=value=>String(value||'en-US').toLowerCase().startsWith('zh')?'zh-CN':'en-US';
export const contentLanguage=value=>normalizeContentLocale(value)==='zh-CN'?'zh':'en';
const descriptions=value=>{const source=value?.description||value?.descriptions||{};return {zh:source.zh||null,en:source.en||null};};

export function localizePoiContent(poi,locale='en-US'){
 const language=contentLanguage(locale),sourceName=String(poi?.sourceName||poi?.canonicalName||poi?.displayName||poi?.names?.en||poi?.names?.zh||''),names={zh:poi?.names?.zh||null,en:poi?.names?.en||sourceName||null},translated=language==='zh'?enToZh.get(key(sourceName)):zhToEn.get(key(sourceName)),brand=brandNames.has(key(sourceName));
 let state='localized';
 if(language==='zh'&&!hasHan(names.zh)){if(translated)names.zh=translated;else if(brand)names.zh=sourceName;else{names.zh=null;state='pending';}}
 if(language==='en'&&!hasLatin(names.en)){if(translated)names.en=translated;else if(brand)names.en=sourceName;else{names.en=null;state='pending';}}
 if(brand)state='brand_preserved';
 return {...poi,sourceName,names,description:descriptions(poi),localizationState:state,contentLocale:normalizeContentLocale(locale)};
}

export function localizedPoiName(poi,locale='en-US'){
 const language=contentLanguage(locale),source=String(poi?.sourceName||poi?.canonicalName||poi?.names?.en||poi?.names?.zh||''),localized=poi?.names?.[language],translated=language==='zh'?enToZh.get(key(source)):zhToEn.get(key(source)),brand=brandNames.has(key(source));
 if(translated)return translated;
 if(brand)return source;
 if(localized&&(language==='zh'?hasHan(localized):hasLatin(localized)))return localized;
 if(poi?.source==='user'&&localized)return localized;
 return categoryNames[poi?.category]?.[language]||categoryNames.attraction[language];
}

export function localizedPoiDescription(poi,locale='en-US'){
 return poi?.description?.[contentLanguage(locale)]||null;
}

export function localizedContentText(value,locale='en-US'){
 const language=contentLanguage(locale),text=typeof value==='object'&&value?value[language]:value;
 if(!text)return null;
 if(language==='zh'&&!hasHan(text)&&hasLatin(text))return null;
 if(language==='en'&&!hasLatin(text)&&hasHan(text))return null;
 return String(text);
}

export function secondaryOfficialName(poi,locale='en-US'){
 const primary=localizedPoiName(poi,locale),source=poi?.sourceName||poi?.canonicalName||null;
 return source&&source!==primary&&poi?.localizationState!=='pending'?source:null;
}
