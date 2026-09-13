export class LocationResolutionError extends Error {
  constructor(input) {
    super(`Location “${String(input || '').trim()}” is not supported yet. Try a supported city or airport name; Travel Scout will not guess.`);
    this.name = 'LocationResolutionError';
    this.code = 'LOCATION_UNRESOLVED';
    this.status = 422;
  }
}

const locations = [
  {code:'SHA',city:'Shanghai',airports:['PVG','SHA'],aliases:['shanghai','shanghai city']},
  {code:'PVG',city:'Shanghai',airports:['PVG'],aliases:['shanghai pudong','pudong','pudong airport','shanghai pudong international airport']},
  {code:'SHA',city:'Shanghai',airports:['SHA'],aliases:['shanghai hongqiao','hongqiao','hongqiao airport','shanghai hongqiao international airport']},
  {code:'BJS',city:'Beijing',airports:['PEK','PKX'],aliases:['beijing','beijing city']},
  {code:'CAN',city:'Guangzhou',airports:['CAN'],aliases:['guangzhou','guangzhou baiyun','baiyun']},
  {code:'SZX',city:'Shenzhen',airports:['SZX'],aliases:['shenzhen','shenzhen baoan','baoan airport']},
  {code:'CTU',city:'Chengdu',airports:['CTU','TFU'],aliases:['chengdu','chengdu city']},
  {code:'CKG',city:'Chongqing',airports:['CKG'],aliases:['chongqing']},
  {code:'CSX',city:'Changsha',airports:['CSX'],aliases:['changsha']},
  {code:'XMN',city:'Xiamen',airports:['XMN'],aliases:['xiamen']},
  {code:'SYX',city:'Sanya',airports:['SYX'],aliases:['sanya']},
  {code:'KMG',city:'Kunming',airports:['KMG'],aliases:['kunming']},
  {code:'DLU',city:'Dali',airports:['DLU'],aliases:['dali']},
  {code:'LJG',city:'Lijiang',airports:['LJG'],aliases:['lijiang']},
  {code:'KWL',city:'Guilin',airports:['KWL'],aliases:['guilin']},
  {code:'XIY',city:"Xi'an",airports:['XIY'],aliases:["xi'an",'xian']},
  {code:'HGH',city:'Hangzhou',airports:['HGH'],aliases:['hangzhou']},
  {code:'NKG',city:'Nanjing',airports:['NKG'],aliases:['nanjing']},
  {code:'TAO',city:'Qingdao',airports:['TAO'],aliases:['qingdao']},
  {code:'HRB',city:'Harbin',airports:['HRB'],aliases:['harbin']},
  {code:'HKG',city:'Hong Kong',airports:['HKG'],aliases:['hong kong','hong kong international airport']},
  {code:'TYO',city:'Tokyo',airports:['NRT','HND'],aliases:['tokyo','tokyo city']},
  {code:'NRT',city:'Tokyo',airports:['NRT'],aliases:['tokyo narita','narita','narita airport']},
  {code:'HND',city:'Tokyo',airports:['HND'],aliases:['tokyo haneda','haneda','haneda airport']},
  {code:'OSA',city:'Osaka',airports:['KIX','ITM'],aliases:['osaka','osaka city']},
  {code:'SEL',city:'Seoul',airports:['ICN','GMP'],aliases:['seoul','seoul city']},
  {code:'SIN',city:'Singapore',airports:['SIN'],aliases:['singapore','singapore changi','changi','changi airport']},
  {code:'BKK',city:'Bangkok',airports:['BKK','DMK'],aliases:['bangkok','bangkok city']},
  {code:'LON',city:'London',airports:['LHR','LGW','STN','LTN','LCY'],aliases:['london','london city']},
  {code:'LHR',city:'London',airports:['LHR'],aliases:['london heathrow','heathrow','heathrow airport']},
  {code:'PAR',city:'Paris',airports:['CDG','ORY'],aliases:['paris','paris city']},
  {code:'SFO',city:'San Francisco',airports:['SFO'],aliases:['san francisco','san francisco airport']}
];

const normalize = value => String(value || '').normalize('NFKD').toLowerCase()
  .replace(/international airport|airport/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const byAlias = new Map();
for (const location of locations) {
  byAlias.set(location.code.toLowerCase(),location);
  for (const alias of location.aliases) byAlias.set(normalize(alias),location);
}

/** Exact, allowlisted resolution only. City codes let Duffel search all listed airports. */
export function resolveLocation(input) {
  const resolved = byAlias.get(normalize(input));
  if (!resolved) throw new LocationResolutionError(input);
  return {...resolved};
}

export const supportedLocations = [...new Set(locations.map(location=>location.city))];
