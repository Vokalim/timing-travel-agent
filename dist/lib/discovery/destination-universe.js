// Curated discovery metadata. This is a starter hierarchy, not an airport allowlist or a live inventory feed.
// Columns: canonical | zh | country | region | regionZh | type | traits | airport hubs | rail hubs | scenery | tier.
const rows=`
Beijing|北京|CN|Beijing|北京|city|culture,food,festive|Beijing|Beijing|historic|iconic
Shanghai|上海|CN|Shanghai|上海|city|food,culture,shopping|Shanghai|Shanghai|urban|iconic
Chengdu|成都|CN|Sichuan|四川|city|food,culture,relaxation,nature|Chengdu|Chengdu|urban|iconic
Chongqing|重庆|CN|Chongqing|重庆|city|food,culture,nature|Chongqing|Chongqing|urban|iconic
Changsha|长沙|CN|Hunan|湖南|city|food,culture|Changsha|Changsha|urban|established
Nanchang|南昌|CN|Jiangxi|江西|city|food,culture,nature|Nanchang|Nanchang|urban|established
Xiamen|厦门|CN|Fujian|福建|city|beach,food,relaxation,culture|Xiamen|Xiamen|coastal|established
Sanya|三亚|CN|Hainan|海南|city|beach,relaxation,nature|Sanya|Sanya|tropical|established
Kunming|昆明|CN|Yunnan|云南|city|nature,food,relaxation|Kunming|Kunming|mountain|established
Dali|大理|CN|Yunnan|云南|city|nature,relaxation,culture|Dali|Dali|mountain|long_tail
Lijiang|丽江|CN|Yunnan|云南|historic_destination|nature,hiking,culture|Lijiang|Lijiang|mountain|long_tail
Guilin|桂林|CN|Guangxi|广西|city|nature,hiking,relaxation|Guilin|Guilin|mountain|established
Xi'an|西安|CN|Shaanxi|陕西|city|culture,food|Xi'an|Xi'an|historic|established
Hangzhou|杭州|CN|Zhejiang|浙江|city|nature,culture,relaxation|Hangzhou|Hangzhou|historic|established
Nanjing|南京|CN|Jiangsu|江苏|city|culture,food,nature|Nanjing|Nanjing|historic|established
Qingdao|青岛|CN|Shandong|山东|city|beach,food,culture|Qingdao|Qingdao|coastal|established
Harbin|哈尔滨|CN|Heilongjiang|黑龙江|city|snow_winter,festive,food|Harbin|Harbin|winter|established
Guangzhou|广州|CN|Guangdong|广东|city|food,culture,shopping|Guangzhou|Guangzhou|urban|iconic
Shenzhen|深圳|CN|Guangdong|广东|city|beach,shopping,food,nature|Shenzhen|Shenzhen|coastal|established
Jingdezhen|景德镇|CN|Jiangxi|江西|city|culture,photography,slow_travel|Jingdezhen|Jingdezhen|historic|long_tail
Quanzhou|泉州|CN|Fujian|福建|city|culture,food,historic_towns|Xiamen|Quanzhou|historic|long_tail
Yanji|延吉|CN|Jilin|吉林|city|food,culture,snow_winter|Yanji|Yanji|winter|long_tail
Weihai|威海|CN|Shandong|山东|city|beach,food,relaxation|Qingdao|Weihai|coastal|long_tail
Yantai|烟台|CN|Shandong|山东|city|beach,food,relaxation|Qingdao|Yantai|coastal|long_tail
Chaozhou|潮州|CN|Guangdong|广东|city|food,culture,historic_towns|Shantou|Chaozhou|historic|long_tail
Shantou|汕头|CN|Guangdong|广东|city|food,culture,beach|Shantou|Shantou|coastal|established
Shunde|顺德|CN|Guangdong|广东|town|food,culture,slow_travel|Guangzhou|Shunde|urban|long_tail
Luoyang|洛阳|CN|Henan|河南|historic_destination|culture,food,photography|Zhengzhou|Luoyang|historic|long_tail
Zhengzhou|郑州|CN|Henan|河南|city|culture,food|Zhengzhou|Zhengzhou|urban|established
Yangzhou|扬州|CN|Jiangsu|江苏|city|food,culture,slow_travel|Nanjing|Yangzhou|historic|long_tail
Shaoxing|绍兴|CN|Zhejiang|浙江|city|culture,food,slow_travel|Hangzhou|Shaoxing|historic|long_tail
Wuyuan|婺源|CN|Jiangxi|江西|scenic_area|nature,photography,hiking|Huangshan|Wuyuan|mountain|long_tail
Anji|安吉|CN|Zhejiang|浙江|nature_destination|nature,hiking,relaxation|Hangzhou|Anji|mountain|long_tail
Kashgar|喀什|CN|Xinjiang|新疆|historic_destination|culture,food,photography|Kashgar|Kashgar|desert|long_tail
Altay|阿勒泰|CN|Xinjiang|新疆|nature_destination|nature,snow_winter,hiking|Altay|Altay|winter|long_tail
Mohe|漠河|CN|Heilongjiang|黑龙江|nature_destination|snow_winter,nature,photography|Harbin|Mohe|winter|long_tail
Huangshan|黄山|CN|Anhui|安徽|scenic_area|nature,hiking,photography|Huangshan|Huangshan|mountain|long_tail
Zhangjiajie|张家界|CN|Hunan|湖南|scenic_area|nature,hiking,photography|Zhangjiajie|Zhangjiajie|mountain|long_tail
Xishuangbanna|西双版纳|CN|Yunnan|云南|nature_destination|nature,relaxation,food|Xishuangbanna|Xishuangbanna|tropical|long_tail
Beihai|北海|CN|Guangxi|广西|city|beach,food,relaxation|Beihai|Beihai|coastal|long_tail
Datong|大同|CN|Shanxi|山西|historic_destination|culture,food,photography|Beijing|Datong|historic|long_tail
Pingyao|平遥|CN|Shanxi|山西|historic_destination|culture,food,photography|Taiyuan|Pingyao|historic|long_tail
Taiyuan|太原|CN|Shanxi|山西|city|culture,food|Taiyuan|Taiyuan|historic|established
Enshi|恩施|CN|Hubei|湖北|nature_destination|nature,hiking,photography|Chongqing|Enshi|mountain|long_tail
Shangri-La|香格里拉|CN|Yunnan|云南|nature_destination|nature,hiking,culture|Lijiang|Shangri-La|mountain|long_tail
Dunhuang|敦煌|CN|Gansu|甘肃|historic_destination|culture,photography,nature|Dunhuang|Dunhuang|desert|long_tail
Hulunbuir|呼伦贝尔|CN|Inner Mongolia|内蒙古|nature_destination|nature,photography,relaxation|Hulunbuir|Hulunbuir|grassland|long_tail
Hong Kong|香港|HK|Hong Kong|香港|city|beach,food,shopping,culture,nature|Hong Kong|Hong Kong|urban|iconic
Tokyo|东京|JP|Tokyo|东京|city|food,culture,shopping,festive|Tokyo|Tokyo|urban|iconic
Osaka|大阪|JP|Osaka|大阪|city|food,culture,shopping|Osaka|Osaka|urban|iconic
Seoul|首尔|KR|Seoul|首尔|city|food,shopping,culture,snow_winter,festive|Seoul|Seoul|urban|iconic
Singapore|新加坡|SG|Singapore|新加坡|city|beach,food,culture,nature,shopping,festive|Singapore|Singapore|tropical|iconic
Bangkok|曼谷|TH|Bangkok|曼谷|city|food,culture,relaxation|Bangkok|Bangkok|urban|iconic
London|伦敦|GB|England|英格兰|city|culture,food,shopping,festive|London|London|historic|iconic
Paris|巴黎|FR|Île-de-France|法兰西岛|city|culture,food,romantic,festive|Paris|Paris|historic|iconic
Sapporo|札幌|JP|Hokkaido|北海道|city|snow_winter,food,festive|Sapporo|Sapporo|winter|established
Hakodate|函馆|JP|Hokkaido|北海道|city|snow_winter,food,photography|Hakodate|Hakodate|winter|long_tail
Fukuoka|福冈|JP|Fukuoka|福冈|city|food,culture,relaxation|Fukuoka|Fukuoka|urban|long_tail
Kyoto|京都|JP|Kyoto|京都|historic_destination|culture,food,photography|Osaka|Kyoto|historic|established
Nara|奈良|JP|Nara|奈良|historic_destination|culture,nature,slow_travel|Osaka|Nara|historic|long_tail
Okinawa|冲绳|JP|Okinawa|冲绳|island|beach,relaxation,nature|Okinawa|Okinawa|tropical|established
Ishigaki|石垣岛|JP|Okinawa|冲绳|island|beach,relaxation,nature|Okinawa|Ishigaki|tropical|long_tail
Busan|釜山|KR|Busan|釜山|city|beach,food,culture|Busan|Busan|coastal|long_tail
Jeju|济州岛|KR|Jeju|济州|island|beach,nature,relaxation|Jeju|Jeju|tropical|established
Chiang Mai|清迈|TH|Chiang Mai|清迈|city|food,culture,nature,relaxation|Chiang Mai|Chiang Mai|mountain|long_tail
Da Nang|岘港|VN|Da Nang|岘港|city|beach,food,relaxation|Da Nang|Da Nang|coastal|long_tail
Hoi An|会安|VN|Quang Nam|广南|historic_destination|culture,food,beach,photography|Da Nang|Da Nang|historic|long_tail
Penang|槟城|MY|Penang|槟城|island|food,culture,beach|Penang|Penang|coastal|long_tail
Phuket|普吉岛|TH|Phuket|普吉|island|beach,relaxation,nature|Phuket|Phuket|tropical|established
Cebu|宿务|PH|Cebu|宿务|island|beach,nature,relaxation|Cebu|Cebu|tropical|long_tail
Bali|巴厘岛|ID|Bali|巴厘|island|beach,relaxation,culture|Bali|Bali|tropical|established
Porto|波尔图|PT|Porto|波尔图|city|food,culture,romantic|Porto|Porto|historic|long_tail
Seville|塞维利亚|ES|Andalusia|安达卢西亚|historic_destination|culture,food,photography|Seville|Seville|historic|long_tail
Granada|格拉纳达|ES|Andalusia|安达卢西亚|historic_destination|culture,food,photography|Seville|Granada|historic|long_tail
Florence|佛罗伦萨|IT|Tuscany|托斯卡纳|historic_destination|culture,food,romantic|Florence|Florence|historic|long_tail
Salzburg|萨尔茨堡|AT|Salzburg|萨尔茨堡|historic_destination|culture,nature,festive|Salzburg|Salzburg|mountain|long_tail
Innsbruck|因斯布鲁克|AT|Tyrol|蒂罗尔|nature_destination|snow_winter,nature,hiking|Salzburg|Innsbruck|winter|long_tail
Nice|尼斯|FR|Provence-Alpes-Côte d’Azur|普罗旺斯-阿尔卑斯-蓝色海岸|city|beach,relaxation,culture|Nice|Nice|coastal|long_tail
Bruges|布鲁日|BE|West Flanders|西佛兰德|historic_destination|culture,romantic,festive|Paris|Bruges|historic|long_tail
Lucerne|卢塞恩|CH|Lucerne|卢塞恩|nature_destination|nature,romantic,hiking|Zurich|Lucerne|mountain|long_tail
Zurich|苏黎世|CH|Zurich|苏黎世|city|culture,food,shopping|Zurich|Zurich|urban|established
Queenstown|皇后镇|NZ|Otago|奥塔哥|nature_destination|nature,hiking,photography|Queenstown|Queenstown|mountain|long_tail
Hobart|霍巴特|AU|Tasmania|塔斯马尼亚|city|nature,food,photography|Hobart|Hobart|coastal|long_tail
`.trim().split('\n').map(line=>line.split('|'));

const countries={CN:['China','中国'],HK:['Hong Kong SAR','中国香港'],JP:['Japan','日本'],KR:['South Korea','韩国'],SG:['Singapore','新加坡'],TH:['Thailand','泰国'],GB:['United Kingdom','英国'],FR:['France','法国'],VN:['Vietnam','越南'],MY:['Malaysia','马来西亚'],PH:['Philippines','菲律宾'],ID:['Indonesia','印度尼西亚'],PT:['Portugal','葡萄牙'],ES:['Spain','西班牙'],IT:['Italy','意大利'],AT:['Austria','奥地利'],BE:['Belgium','比利时'],CH:['Switzerland','瑞士'],NZ:['New Zealand','新西兰'],AU:['Australia','澳大利亚']};
const directCodes={Beijing:'BJS',Shanghai:'SHA',Chengdu:'CTU',Chongqing:'CKG',Changsha:'CSX',Xiamen:'XMN',Sanya:'SYX',Kunming:'KMG',Dali:'DLU',Lijiang:'LJG',Guilin:'KWL',"Xi'an":'XIY',Hangzhou:'HGH',Nanjing:'NKG',Qingdao:'TAO',Harbin:'HRB',Guangzhou:'CAN',Shenzhen:'SZX','Hong Kong':'HKG',Tokyo:'TYO',Osaka:'OSA',Seoul:'SEL',Singapore:'SIN',Bangkok:'BKK',London:'LON',Paris:'PAR'};
const id=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const universe=rows.map(([name,zh,country,region,regionZh,entityType,traits,airport,rail,scenery,tier])=>({
 id:id(name),canonicalName:name,names:{zh,en:name},countryCode:country,countryNames:{zh:countries[country][1],en:countries[country][0]},
 region,regionNames:{zh:regionZh,en:region},entityType,coordinates:{lat:null,lon:null},destinationTraits:traits.split(','),
 transportAccess:{airportHubIds:airport?[id(airport)]:[],railHubIds:rail?[id(rail)]:[],roadTripSuitable:country==='CN'&&['mountain','coastal','historic','grassland','desert'].includes(scenery)},
 directAirportCode:directCodes[name]||null,sceneryCategory:scenery,popularityTier:tier==='iconic'?'well_known':'general',discoveryTier:tier
}));
const byId=new Map(universe.map(entity=>[entity.id,entity]));
const byName=new Map(universe.flatMap(entity=>[[entity.canonicalName.toLowerCase(),entity],[entity.names.zh.toLowerCase(),entity]]));
export const DESTINATION_UNIVERSE=Object.freeze(universe);
export const destinationKey=id;
export const getDestination=value=>{
 const key=typeof value==='string'?value:value?.id||value?.canonicalName||value?.city||'';
 return byId.get(String(key).toLowerCase())||byName.get(String(key).trim().toLowerCase())||null;
};
export const isMainlandDestination=entity=>entity?.countryCode==='CN';
