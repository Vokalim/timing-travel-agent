import {normalizeTravelIntents} from './trip-request.js';
import {parsePreferenceConstraints} from './preference-constraints.js';

/** Replace this adapter with a server-side LLM returning only validated preferences.
 * It must never return prices, scores or a booking decision. */
export class MockPreferenceInterpreter {
  async interpret(text, context = {}) {
    const t=text.toLowerCase();
    const constraints=parsePreferenceConstraints(text,context.constraints);
    return {priority: /comfort|quality|luxury/.test(t)?'comfort':'value',
      nonstop:Boolean(constraints.hard.directFlightRequired),constraints,
      travelIntents:normalizeTravelIntents(context.travelIntents), source:'Local preference simulator'};
  }
}
export function validatePreferences(p) {
  if (!p || !['comfort','value'].includes(p.priority) || typeof p.nonstop!=='boolean') throw new Error('Invalid preference response.');
  return {priority:p.priority,nonstop:p.nonstop,constraints:parsePreferenceConstraints(p.constraints?.rawText,p.constraints),travelIntents:normalizeTravelIntents(p.travelIntents)};
}
