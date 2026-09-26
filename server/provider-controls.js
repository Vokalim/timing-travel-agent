const integer=(value,fallback)=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):fallback;
export const providerLimits=env=>({
 maxPlaceRequestsPerSession:integer(env.MAX_PLACE_REQUESTS_PER_SESSION,20),maxRouteRequestsPerSession:integer(env.MAX_ROUTE_REQUESTS_PER_SESSION,30),
 maxExternalRequestsPerDay:integer(env.MAX_EXTERNAL_REQUESTS_PER_DAY,400),maxProviderConcurrency:integer(env.MAX_PROVIDER_CONCURRENCY,4),providerTimeoutMs:integer(env.PROVIDER_TIMEOUT_MS,7000)
});

export class ProviderError extends Error{constructor(code,message,status=503){super(message);this.code=code;this.status=status;}}

export class ProviderRequestController{
 constructor({limits,now=()=>Date.now()}={}){this.limits=limits;this.now=now;this.sessions=new Map();this.day='';this.daily=0;this.active=0;}
 use(sessionId,kind){const today=new Date(this.now()).toISOString().slice(0,10);if(today!==this.day){this.day=today;this.daily=0;}if(this.daily>=this.limits.maxExternalRequestsPerDay)throw new ProviderError('DAILY_QUOTA_EXHAUSTED','Live place data is temporarily unavailable because the daily request limit was reached.',429);
  const state=this.sessions.get(sessionId)||{place:0,route:0};const field=kind==='place'?'place':'route',limit=kind==='place'?this.limits.maxPlaceRequestsPerSession:this.limits.maxRouteRequestsPerSession;
  if(state[field]>=limit)throw new ProviderError('SESSION_QUOTA_EXHAUSTED','Live place data is temporarily unavailable because this trip reached its request limit.',429);
  state[field]++;this.sessions.set(sessionId,state);this.daily++;
 }
 async run(sessionId,kind,task){this.use(sessionId,kind);if(this.active>=this.limits.maxProviderConcurrency)throw new ProviderError('PROVIDER_BUSY','Live place data is busy. Try again shortly.',503);this.active++;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.limits.providerTimeoutMs);
  try{return await task(controller.signal);}catch(error){if(error?.name==='AbortError'||controller.signal.aborted)throw new ProviderError('PROVIDER_TIMEOUT','Live place data timed out.',504);if(error instanceof ProviderError)throw error;throw new ProviderError('PROVIDER_UNAVAILABLE','Live place data is unavailable.');}finally{clearTimeout(timer);this.active--;}
 }
}

// Provider-derived responses stay in memory only. Place responses use a short TTL;
// place IDs may be retained by the trip state. Routes are session-scoped and short-lived.
export class ProviderMemoryCache{
 constructor({now=()=>Date.now(),placeTtlMs=30*60_000,routeTtlMs=15*60_000}={}){this.now=now;this.placeTtlMs=placeTtlMs;this.routeTtlMs=routeTtlMs;this.values=new Map();}
 get(key){const item=this.values.get(key);if(!item||item.expiresAt<=this.now()){this.values.delete(key);return null;}return structuredClone(item.value);}
 set(key,value,kind){this.values.set(key,{value:structuredClone(value),expiresAt:this.now()+(kind==='route'?this.routeTtlMs:this.placeTtlMs)});return value;}
}
