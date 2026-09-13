import {LLMDestinationDiscoveryService} from './llm-destination-discovery.js';

const safeError=error=>({error:{code:error.code||'DESTINATION_DISCOVERY_UNAVAILABLE',message:error.message||'AI destination discovery is unavailable.'}});
export function createDestinationDiscoveryApi({env=process.env,fetchImpl=globalThis.fetch}={}) {
  return {
    async discover(body){
      if(!body?.preferences||typeof body.preferences!=='object'||!body?.context||typeof body.context!=='object'){const error=new Error('Discovery preferences and temporal context are required.');error.code='INVALID_REQUEST';error.status=400;throw error;}
      const service=new LLMDestinationDiscoveryService({apiKey:env.OPENAI_API_KEY,model:env.OPENAI_DISCOVERY_MODEL||env.OPENAI_PREFERENCE_MODEL||'gpt-4o-mini',fetchImpl});
      return service.discover(body.preferences,body.context);
    },
    async handle(request){try{return Response.json(await this.discover(await request.json()));}catch(error){return Response.json(safeError(error),{status:error.status||503});}}
  };
}
