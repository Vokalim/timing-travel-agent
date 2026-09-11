import {LLMPreferenceParser} from './llm-preference-parser.js';

const safeError = error => ({error:{code:error.code || 'PREFERENCE_PARSER_UNAVAILABLE',message:error.message || 'AI trip interpretation is unavailable.'}});

export function createPreferenceApi({env=process.env,fetchImpl=globalThis.fetch}={}) {
  return {
    async parse(body) {
      if (!body || typeof body.text!=='string' || !body.text.trim() || body.text.length>3000) {
        const error=new Error('Enter a trip description up to 3,000 characters.');error.code='INVALID_REQUEST';error.status=400;throw error;
      }
      return new LLMPreferenceParser({apiKey:env.OPENAI_API_KEY,model:env.OPENAI_PREFERENCE_MODEL || 'gpt-4o-mini',fetchImpl}).parse(body.text);
    },
    async handle(request) {
      try { return Response.json(await this.parse(await request.json())); }
      catch(error) { return Response.json(safeError(error),{status:error.status || 503}); }
    }
  };
}
