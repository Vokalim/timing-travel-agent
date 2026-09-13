import {DESTINATION_DISCOVERY_SCHEMA,DESTINATION_DISCOVERY_SCHEMA_NAME} from './destination-discovery-schema.js';
import {TRAVEL_INTENTS} from './preference-schema.js';
import {resolveLocation} from './location-resolver.js';

export class DestinationDiscoveryUnavailableError extends Error {
  constructor(message='AI destination discovery is unavailable.') { super(message);this.name='DestinationDiscoveryUnavailableError';this.code='DESTINATION_DISCOVERY_UNAVAILABLE';this.status=503; }
}
const outputText=payload=>{
  if(typeof payload?.output_text==='string') return payload.output_text;
  for(const item of payload?.output||[]) for(const content of item?.content||[]) if(content?.type==='output_text'&&typeof content.text==='string') return content.text;
  return null;
};
const clean=(value,max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
const regions={Beijing:'China',Guangzhou:'China',Shenzhen:'China',Chengdu:'China','Hong Kong':'Hong Kong SAR',Tokyo:'Japan',Osaka:'Japan',Seoul:'South Korea',Singapore:'Singapore',Bangkok:'Thailand',London:'United Kingdom',Paris:'France'};
const normalizeCandidate=value=>{
  if(!value||typeof value!=='object') return null;
  const city=clean(value.city,80),countryOrRegion=clean(value.countryOrRegion,80),code=clean(value.iataOrMetroCode,3)?.toUpperCase();
  if(!city||!countryOrRegion||!/^[A-Z]{3}$/.test(code||'')) return null;
  let resolved;try {resolved=resolveLocation(city);} catch {return null;}
  if(resolved.code!==code) return null;
  const strings=key=>Array.isArray(value[key])?value[key].map(item=>clean(item)).filter(Boolean).slice(0,4):[];
  return {city:resolved.city,countryOrRegion:regions[resolved.city]||countryOrRegion,iataOrMetroCode:code,
    themes:[...new Set(Array.isArray(value.themes)?value.themes.filter(theme=>TRAVEL_INTENTS.includes(theme)):[])].slice(0,6),
    seasonalReasons:strings('seasonalReasons'),generalReasons:strings('generalReasons'),estimatedFitSignals:strings('estimatedFitSignals'),
    sourceType:'llm_suggestion',confidence:['high','medium','low'].includes(value.confidence)?value.confidence:'low'};
};

export class LLMDestinationDiscoveryService {
  constructor({apiKey,model='gpt-4o-mini',fetchImpl=globalThis.fetch,timeoutMs=20000}={}) { this.apiKey=apiKey;this.model=model;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs; }
  async discover(preferences,context={}) {
    if(!this.apiKey) throw new DestinationDiscoveryUnavailableError('AI destination discovery is unavailable because OPENAI_API_KEY is not configured.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    const instructions=`Propose 5 to 8 real destination cities for travel discovery. For this MVP choose only from Beijing (BJS), Guangzhou (CAN), Shenzhen (SZX), Chengdu (CTU), Hong Kong (HKG), Tokyo (TYO), Osaka (OSA), Seoul (SEL), Singapore (SIN), Bangkok (BKK), London (LON), and Paris (PAR), excluding the origin city. Return suggestions and qualitative reasons only. Never provide flight or hotel prices, availability, popularity rankings, or numeric recommendation scores. Explicit travelIntents outrank inferredTemporalIntents. A general popularity prior may only be described as generally popular; never claim currently trending. Keep geography and trip duration practical. Write reasons in the requested language.`;
    const input=JSON.stringify({origin:preferences.origin||null,durationDays:preferences.durationDays||null,totalTripBudgetCny:preferences.totalTripBudgetCny||null,flightBudgetCny:preferences.flightBudgetCny||null,avoidOvernightFlights:preferences.avoidOvernightFlights??null,explicitTravelIntents:preferences.travelIntents||[],temporalContext:context});
    try {
      const response=await this.fetchImpl('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,instructions,input,store:false,max_output_tokens:2200,text:{format:{type:'json_schema',name:DESTINATION_DISCOVERY_SCHEMA_NAME,strict:true,schema:DESTINATION_DISCOVERY_SCHEMA}}})});
      if(!response.ok) throw new DestinationDiscoveryUnavailableError();
      const payload=await response.json().catch(()=>null),raw=outputText(payload);
      let parsed;try{parsed=JSON.parse(raw);}catch{throw new DestinationDiscoveryUnavailableError('AI destination discovery returned an invalid response.');}
      const seen=new Set(),candidates=[];
      for(const value of parsed?.candidates||[]){const candidate=normalizeCandidate(value),key=candidate?.city.toLowerCase();if(candidate&&key!==String(preferences.origin||'').trim().toLowerCase()&&!seen.has(key)){seen.add(key);candidates.push(candidate);}}
      if(candidates.length<5) throw new DestinationDiscoveryUnavailableError('AI destination discovery returned too few usable cities.');
      return {candidates:candidates.slice(0,8),source:'openai',parserStatus:'ai',model:this.model};
    } catch(error) {
      if(error instanceof DestinationDiscoveryUnavailableError) throw error;
      throw new DestinationDiscoveryUnavailableError(controller.signal.aborted?'AI destination discovery timed out.':'AI destination discovery is unavailable.');
    } finally { clearTimeout(timer); }
  }
}
