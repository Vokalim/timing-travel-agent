import {PreferenceParser,tripFields} from './preference-parser.js';
import {normalizeTravelIntents} from './trip-request.js';

export class PreferenceParserError extends Error {
  constructor(code,message) { super(message); this.name='PreferenceParserError'; this.code=code; }
}

function toDraft(payload) {
  const p=payload?.interpretation;
  if (!p || !['provided','discovery_required'].includes(p.destinationState) || !Array.isArray(p.travelIntents) || !Array.isArray(payload.needsConfirmation) || !Array.isArray(payload.warnings))
    throw new PreferenceParserError('PREFERENCE_OUTPUT_INVALID','The AI preference response was incomplete or invalid.');
  const notes=[];
  if (p.avoidOvernightFlights===true) notes.push('Avoid overnight flights');
  if (p.pace) notes.push(`${p.pace} pace`);
  if (p.domesticAllowed===true && p.internationalAllowed===true) notes.push('Domestic and international destinations are both allowed');
  else if (p.domesticAllowed===true) notes.push('Domestic destinations allowed');
  else if (p.internationalAllowed===true) notes.push('International destinations allowed');
  if (Array.isArray(p.preferences)) notes.push(...p.preferences);
  const fields={currency:'CNY',travelIntents:normalizeTravelIntents(p.travelIntents),notes:notes.join('. ')};
  const map={origin:'origin',destination:'destination',earliestDeparture:'start',latestDeparture:'end',durationDays:'nights',flightBudgetCny:'flightBudget',hotelBudgetPerNightCny:'hotelBudget',minimumHotelRating:'rating'};
  for (const [source,target] of Object.entries(map)) if (p[source]!=null) fields[target]=p[source];
  return {fields,needsConfirmation:Object.keys(tripFields).filter(key=>fields[key]===undefined),warnings:payload.warnings,
    dateHint:p.departureWindowText || '',interpretation:p,source:'openai',parserStatus:'ai',model:payload.model};
}

/** Browser-side PreferenceParser adapter. Credentials remain behind the same-origin route. */
export class LLMPreferenceParser extends PreferenceParser {
  constructor({fetchImpl=globalThis.fetch,endpoint='/api/travel/preferences/parse',timeoutMs=25000}={}) {
    super(); this.fetchImpl=fetchImpl; this.endpoint=endpoint; this.timeoutMs=timeoutMs;
  }
  async parse(text) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({text})});
      const payload=await response.json().catch(()=>null);
      if (!response.ok) throw new PreferenceParserError(payload?.error?.code || 'PREFERENCE_PARSER_UNAVAILABLE',payload?.error?.message || 'AI trip interpretation is unavailable.');
      return toDraft(payload);
    } catch(error) {
      if (error instanceof PreferenceParserError) throw error;
      throw new PreferenceParserError(controller.signal.aborted?'PREFERENCE_PARSER_TIMEOUT':'PREFERENCE_PARSER_UNAVAILABLE',controller.signal.aborted?'AI trip interpretation timed out.':'AI trip interpretation is unavailable.');
    } finally { clearTimeout(timer); }
  }
}

/** Explicit fallback: callers can always tell whether the LLM or local parser produced the draft. */
export class FallbackPreferenceParser extends PreferenceParser {
  constructor(primary,fallback) { super(); this.primary=primary; this.fallback=fallback; }
  async parse(text) {
    try { return await this.primary.parse(text); }
    catch(error) {
      const draft=await this.fallback.parse(text);
      return {...draft,source:'demo_fallback',parserStatus:'fallback',fallbackReason:error.message || 'AI trip interpretation is unavailable.'};
    }
  }
}
