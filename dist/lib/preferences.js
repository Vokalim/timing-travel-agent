/** Replace this adapter with a server-side LLM returning only validated preferences.
 * It must never return prices, scores or a booking decision. */
export class MockPreferenceInterpreter {
  async interpret(text) {
    const t=text.toLowerCase();
    return {priority: /comfort|quality|luxury/.test(t)?'comfort':'value', nonstop:/non.?stop|direct flight/.test(t), source:'Local preference simulator'};
  }
}
export function validatePreferences(p) {
  if (!p || !['comfort','value'].includes(p.priority) || typeof p.nonstop!=='boolean') throw new Error('Invalid preference response.');
  return {priority:p.priority,nonstop:p.nonstop};
}
