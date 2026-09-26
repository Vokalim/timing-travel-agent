const request=async(endpoint,body,fetchImpl)=>{const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.error?.message||'Live place data is unavailable.');error.code=payload.error?.code||'PROVIDER_UNAVAILABLE';error.status=response.status;throw error;}return payload;};

export class LivePlaceRouteClient{
 constructor({fetchImpl=globalThis.fetch}={}){this.fetchImpl=fetchImpl;}
 discover(input){return request('/api/travel/places/discover',input,this.fetchImpl);}
 routeSegments(input){return request('/api/travel/routes/segments',input,this.fetchImpl);}
}
