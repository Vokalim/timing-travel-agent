// Curated discovery metadata. This is a starter hierarchy, not an airport allowlist or a live inventory feed.
// Columns: canonical | zh | country | region | regionZh | type | traits | airport hubs | rail hubs | scenery | tier.
const rows=`
Beijing|北京|CN|Beijing|北京|city|culture,food,festive|Beijing|Beijing|historic|iconic
Shanghai|上海|CN|Shanghai|上海|city|food,culture,shopping|Shanghai|Shanghai|urban|iconic
Suzhou|苏州|CN|Jiangsu|江苏|city|culture,food,slow_travel,nature|Shanghai|Suzhou|historic|established
Tianjin|天津|CN|Tianjin|天津|city|culture,food,slow_travel|Beijing|Tianjin|historic|established
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
Edinburgh|爱丁堡|GB|Scotland|苏格兰|city|culture,architecture,food,festive|Edinburgh|Edinburgh|historic|established
Bath|巴斯|GB|England|英格兰|historic_destination|culture,architecture,relaxation|London|Bath|historic|long_tail
York|约克|GB|England|英格兰|historic_destination|culture,architecture,food|Manchester|York|historic|long_tail
Bristol|布里斯托|GB|England|英格兰|city|food,culture,nightlife|Birmingham|Bristol|urban|established
Whitby|惠特比|GB|England|英格兰|town|food,coastal,slow_travel|Newcastle|Whitby|coastal|long_tail
Rye|拉伊|GB|England|英格兰|town|culture,architecture,slow_travel|London|Rye|historic|long_tail
Ludlow|勒德洛|GB|England|英格兰|town|food,culture,slow_travel|Birmingham|Ludlow|historic|long_tail
Manchester|曼彻斯特|GB|England|英格兰|city|food,culture,nightlife|Manchester|Manchester|urban|established
Birmingham|伯明翰|GB|England|英格兰|city|food,culture,architecture|Birmingham|Birmingham|urban|established
Newcastle|纽卡斯尔|GB|England|英格兰|city|food,culture,architecture|Newcastle|Newcastle|urban|established
Lyon|里昂|FR|Auvergne-Rhône-Alpes|奥弗涅-罗讷-阿尔卑斯|city|food,culture,architecture|Lyon|Lyon|historic|established
Annecy|阿讷西|FR|Auvergne-Rhône-Alpes|奥弗涅-罗讷-阿尔卑斯|town|nature,relaxation,romantic|Lyon|Annecy|lakes|long_tail
Colmar|科尔马|FR|Grand Est|大东部|town|architecture,food,festive,romantic|Strasbourg|Colmar|historic|long_tail
Dijon|第戎|FR|Bourgogne-Franche-Comté|勃艮第-弗朗什-孔泰|city|food,culture,architecture|Paris|Dijon|historic|long_tail
Strasbourg|斯特拉斯堡|FR|Grand Est|大东部|city|culture,architecture,food,festive|Strasbourg|Strasbourg|historic|established
Rome|罗马|IT|Lazio|拉齐奥|city|culture,architecture,food|Rome|Rome|historic|iconic
Bologna|博洛尼亚|IT|Emilia-Romagna|艾米利亚-罗马涅|city|food,culture,architecture|Bologna|Bologna|historic|established
Turin|都灵|IT|Piedmont|皮埃蒙特|city|food,culture,architecture|Turin|Turin|historic|established
Verona|维罗纳|IT|Veneto|威尼托|historic_destination|culture,architecture,romantic|Verona|Verona|historic|long_tail
Naples|那不勒斯|IT|Campania|坎帕尼亚|city|food,culture,architecture|Naples|Naples|coastal|established
Barcelona|巴塞罗那|ES|Catalonia|加泰罗尼亚|city|architecture,food,culture,beach|Barcelona|Barcelona|urban|iconic
San Sebastian|圣塞巴斯蒂安|ES|Basque Country|巴斯克|city|food,beach,culture|Bilbao|San Sebastian|coastal|long_tail
Valencia|瓦伦西亚|ES|Valencian Community|瓦伦西亚|city|food,architecture,beach|Valencia|Valencia|coastal|established
Madrid|马德里|ES|Madrid|马德里|city|culture,food,architecture|Madrid|Madrid|urban|iconic
Bilbao|毕尔巴鄂|ES|Basque Country|巴斯克|city|food,architecture,culture|Bilbao|Bilbao|urban|established
Lisbon|里斯本|PT|Lisbon|里斯本|city|food,culture,architecture|Lisbon|Lisbon|historic|iconic
Braga|布拉加|PT|Braga|布拉加|city|culture,architecture,food|Porto|Braga|historic|long_tail
Amsterdam|阿姆斯特丹|NL|North Holland|北荷兰|city|culture,architecture,food|Amsterdam|Amsterdam|historic|iconic
Utrecht|乌得勒支|NL|Utrecht|乌得勒支|city|culture,architecture,slow_travel|Amsterdam|Utrecht|historic|long_tail
Rotterdam|鹿特丹|NL|South Holland|南荷兰|city|architecture,food,culture|Amsterdam|Rotterdam|urban|established
Berlin|柏林|DE|Berlin|柏林|city|culture,food,architecture,nightlife|Berlin|Berlin|urban|iconic
Munich|慕尼黑|DE|Bavaria|巴伐利亚|city|food,culture,festive|Munich|Munich|historic|iconic
Hamburg|汉堡|DE|Hamburg|汉堡|city|food,culture,architecture|Hamburg|Hamburg|urban|established
Frankfurt|法兰克福|DE|Hesse|黑森|city|food,culture,architecture|Frankfurt|Frankfurt|urban|established
Freiburg|弗赖堡|DE|Baden-Württemberg|巴登-符腾堡|city|nature,food,slow_travel|Frankfurt|Freiburg|historic|long_tail
Vienna|维也纳|AT|Vienna|维也纳|city|culture,architecture,food,festive|Vienna|Vienna|historic|iconic
Graz|格拉茨|AT|Styria|施蒂利亚|city|architecture,food,slow_travel|Vienna|Graz|historic|long_tail
Prague|布拉格|CZ|Prague|布拉格|city|architecture,culture,food,festive|Prague|Prague|historic|iconic
Brno|布尔诺|CZ|South Moravia|南摩拉维亚|city|architecture,food,culture|Vienna|Brno|historic|long_tail
Budapest|布达佩斯|HU|Central Hungary|匈牙利中部|city|architecture,food,culture,relaxation|Budapest|Budapest|historic|iconic
Krakow|克拉科夫|PL|Lesser Poland|小波兰|city|architecture,culture,food|Krakow|Krakow|historic|established
Gdansk|格但斯克|PL|Pomerania|滨海|city|architecture,food,culture|Gdansk|Gdansk|coastal|long_tail
Ljubljana|卢布尔雅那|SI|Central Slovenia|中斯洛文尼亚|city|architecture,food,nature,slow_travel|Ljubljana|Ljubljana|historic|long_tail
Zagreb|萨格勒布|HR|Central Croatia|克罗地亚中部|city|culture,food,architecture|Zagreb|Zagreb|historic|established
Split|斯普利特|HR|Dalmatia|达尔马提亚|city|beach,culture,architecture|Split|Split|coastal|long_tail
Athens|雅典|GR|Attica|阿提卡|city|culture,architecture,food|Athens|Athens|historic|iconic
Thessaloniki|塞萨洛尼基|GR|Central Macedonia|中马其顿|city|food,culture,architecture|Thessaloniki|Thessaloniki|coastal|long_tail
Copenhagen|哥本哈根|DK|Capital Region|首都大区|city|food,architecture,culture|Copenhagen|Copenhagen|urban|iconic
Stockholm|斯德哥尔摩|SE|Stockholm|斯德哥尔摩|city|culture,food,architecture|Stockholm|Stockholm|urban|iconic
Bergen|卑尔根|NO|Vestland|韦斯特兰|city|nature,food,photography|Bergen|Bergen|coastal|long_tail
Tallinn|塔林|EE|Harju|哈留|historic_destination|architecture,culture,festive|Tallinn|Tallinn|historic|long_tail
Dublin|都柏林|IE|Leinster|伦斯特|city|food,culture,nightlife|Dublin|Dublin|historic|established
Istanbul|伊斯坦布尔|TR|Marmara|马尔马拉|city|food,culture,architecture|Istanbul|Istanbul|historic|iconic
Tbilisi|第比利斯|GE|Tbilisi|第比利斯|city|food,culture,architecture|Tbilisi|Tbilisi|historic|long_tail
Marrakesh|马拉喀什|MA|Marrakesh-Safi|马拉喀什-萨菲|city|food,culture,architecture|Marrakesh|Marrakesh|historic|established
Cape Town|开普敦|ZA|Western Cape|西开普|city|food,nature,beach|Cape Town|Cape Town|coastal|iconic
Dubai|迪拜|AE|Dubai|迪拜|city|architecture,shopping,food|Dubai|Dubai|urban|iconic
Muscat|马斯喀特|OM|Muscat|马斯喀特|city|culture,nature,relaxation|Muscat|Muscat|coastal|long_tail
Almaty|阿拉木图|KZ|Almaty|阿拉木图|city|nature,food,culture|Almaty|Almaty|mountain|long_tail
Samarkand|撒马尔罕|UZ|Samarkand|撒马尔罕|historic_destination|architecture,culture,food|Samarkand|Samarkand|historic|long_tail
New York|纽约|US|New York|纽约州|city|food,culture,shopping,architecture|New York|New York|urban|iconic
Boston|波士顿|US|Massachusetts|马萨诸塞州|city|culture,food,architecture|Boston|Boston|historic|established
Philadelphia|费城|US|Pennsylvania|宾夕法尼亚州|city|food,culture,architecture|Philadelphia|Philadelphia|historic|established
Portland Maine|波特兰（缅因州）|US|Maine|缅因州|city|food,coastal,relaxation|Boston|Portland Maine|coastal|long_tail
Providence|普罗维登斯|US|Rhode Island|罗得岛州|city|food,culture,architecture|Boston|Providence|historic|long_tail
Hudson Valley|哈德逊河谷|US|New York|纽约州|nature_destination|food,nature,relaxation|New York|Hudson Valley|forest|long_tail
Charleston|查尔斯顿|US|South Carolina|南卡罗来纳州|city|food,culture,architecture|Charleston|Charleston|historic|long_tail
New Orleans|新奥尔良|US|Louisiana|路易斯安那州|city|food,culture,nightlife|New Orleans|New Orleans|historic|established
Chicago|芝加哥|US|Illinois|伊利诺伊州|city|food,culture,architecture|Chicago|Chicago|urban|iconic
Montreal|蒙特利尔|CA|Quebec|魁北克|city|food,culture,architecture|Montreal|Montreal|historic|established
Quebec City|魁北克城|CA|Quebec|魁北克|historic_destination|food,culture,architecture|Montreal|Quebec City|historic|long_tail
Toronto|多伦多|CA|Ontario|安大略|city|food,culture,shopping|Toronto|Toronto|urban|iconic
Vancouver|温哥华|CA|British Columbia|不列颠哥伦比亚|city|food,nature,culture|Vancouver|Vancouver|coastal|iconic
Mexico City|墨西哥城|MX|Mexico City|墨西哥城|city|food,culture,architecture|Mexico City|Mexico City|historic|iconic
Oaxaca|瓦哈卡|MX|Oaxaca|瓦哈卡|city|food,culture,architecture|Oaxaca|Oaxaca|historic|long_tail
Merida|梅里达|MX|Yucatan|尤卡坦|city|food,culture,architecture|Merida|Merida|historic|long_tail
Havana|哈瓦那|CU|Havana|哈瓦那|city|culture,architecture,food|Havana|Havana|historic|established
Cartagena|卡塔赫纳|CO|Bolivar|玻利瓦尔|historic_destination|culture,food,beach|Cartagena|Cartagena|coastal|long_tail
Buenos Aires|布宜诺斯艾利斯|AR|Buenos Aires|布宜诺斯艾利斯|city|food,culture,architecture|Buenos Aires|Buenos Aires|urban|iconic
Lima|利马|PE|Lima|利马|city|food,culture,architecture|Lima|Lima|coastal|iconic
Cusco|库斯科|PE|Cusco|库斯科|historic_destination|culture,architecture,hiking|Cusco|Cusco|mountain|established
Melbourne|墨尔本|AU|Victoria|维多利亚|city|food,culture,architecture|Melbourne|Melbourne|urban|iconic
Sydney|悉尼|AU|New South Wales|新南威尔士|city|food,beach,culture|Sydney|Sydney|coastal|iconic
Adelaide|阿德莱德|AU|South Australia|南澳大利亚|city|food,relaxation,culture|Adelaide|Adelaide|urban|long_tail
Auckland|奥克兰|NZ|Auckland|奥克兰|city|food,nature,culture|Auckland|Auckland|coastal|established
Wellington|惠灵顿|NZ|Wellington|惠灵顿|city|food,culture,nature|Wellington|Wellington|coastal|long_tail
`.trim().split('\n').map(line=>line.split('|'));

const countries={CN:['China','中国'],HK:['Hong Kong SAR','中国香港'],JP:['Japan','日本'],KR:['South Korea','韩国'],SG:['Singapore','新加坡'],TH:['Thailand','泰国'],GB:['United Kingdom','英国'],FR:['France','法国'],VN:['Vietnam','越南'],MY:['Malaysia','马来西亚'],PH:['Philippines','菲律宾'],ID:['Indonesia','印度尼西亚'],PT:['Portugal','葡萄牙'],ES:['Spain','西班牙'],IT:['Italy','意大利'],AT:['Austria','奥地利'],BE:['Belgium','比利时'],CH:['Switzerland','瑞士'],NZ:['New Zealand','新西兰'],AU:['Australia','澳大利亚'],NL:['Netherlands','荷兰'],DE:['Germany','德国'],CZ:['Czechia','捷克'],HU:['Hungary','匈牙利'],PL:['Poland','波兰'],SI:['Slovenia','斯洛文尼亚'],HR:['Croatia','克罗地亚'],GR:['Greece','希腊'],DK:['Denmark','丹麦'],SE:['Sweden','瑞典'],NO:['Norway','挪威'],EE:['Estonia','爱沙尼亚'],IE:['Ireland','爱尔兰'],TR:['Türkiye','土耳其'],GE:['Georgia','格鲁吉亚'],MA:['Morocco','摩洛哥'],ZA:['South Africa','南非'],AE:['United Arab Emirates','阿联酋'],OM:['Oman','阿曼'],KZ:['Kazakhstan','哈萨克斯坦'],UZ:['Uzbekistan','乌兹别克斯坦'],US:['United States','美国'],CA:['Canada','加拿大'],MX:['Mexico','墨西哥'],CU:['Cuba','古巴'],CO:['Colombia','哥伦比亚'],AR:['Argentina','阿根廷'],PE:['Peru','秘鲁']};
const directCodes={Beijing:'BJS',Shanghai:'SHA',Chengdu:'CTU',Chongqing:'CKG',Changsha:'CSX',Xiamen:'XMN',Sanya:'SYX',Kunming:'KMG',Dali:'DLU',Lijiang:'LJG',Guilin:'KWL',"Xi'an":'XIY',Hangzhou:'HGH',Nanjing:'NKG',Qingdao:'TAO',Harbin:'HRB',Guangzhou:'CAN',Shenzhen:'SZX','Hong Kong':'HKG',Tokyo:'TYO',Osaka:'OSA',Seoul:'SEL',Singapore:'SIN',Bangkok:'BKK',London:'LON',Paris:'PAR',Edinburgh:'EDI',Manchester:'MAN',Birmingham:'BHX',Newcastle:'NCL',Lyon:'LYS',Strasbourg:'SXB',Rome:'ROM',Bologna:'BLQ',Turin:'TRN',Verona:'VRN',Naples:'NAP',Barcelona:'BCN',Valencia:'VLC',Madrid:'MAD',Bilbao:'BIO',Lisbon:'LIS',Amsterdam:'AMS',Berlin:'BER',Munich:'MUC',Hamburg:'HAM',Frankfurt:'FRA',Vienna:'VIE',Prague:'PRG',Budapest:'BUD',Krakow:'KRK',Gdansk:'GDN',Ljubljana:'LJU',Zagreb:'ZAG',Split:'SPU',Athens:'ATH',Thessaloniki:'SKG',Copenhagen:'CPH',Stockholm:'STO',Bergen:'BGO',Tallinn:'TLL',Dublin:'DUB',Istanbul:'IST',Tbilisi:'TBS',Marrakesh:'RAK','Cape Town':'CPT',Dubai:'DXB',Muscat:'MCT',Almaty:'ALA',Samarkand:'SKD','New York':'NYC',Boston:'BOS',Philadelphia:'PHL',Charleston:'CHS','New Orleans':'MSY',Chicago:'CHI',Montreal:'YMQ',Toronto:'YTO',Vancouver:'YVR','Mexico City':'MEX',Oaxaca:'OAX',Merida:'MID',Havana:'HAV',Cartagena:'CTG','Buenos Aires':'BUE',Lima:'LIM',Cusco:'CUZ',Melbourne:'MEL',Sydney:'SYD',Adelaide:'ADL',Auckland:'AKL',Wellington:'WLG'};
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
