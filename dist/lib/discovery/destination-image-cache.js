const DEFAULT_SUCCESS_TTL=30*24*60*60*1000;
const DEFAULT_FAILURE_TTL=24*60*60*1000;

const memoryCache=new Map();

export class DestinationImageCache {
 constructor({storage=globalThis.localStorage,now=()=>Date.now(),successTtl=DEFAULT_SUCCESS_TTL,failureTtl=DEFAULT_FAILURE_TTL,prefix='timing:destination-image:v1:'}={}){
  this.storage=storage;this.now=now;this.successTtl=successTtl;this.failureTtl=failureTtl;this.prefix=prefix;
 }
 key(destinationId){return `${this.prefix}${destinationId}`;}
 read(destinationId){
  const key=this.key(destinationId);let record=memoryCache.get(key)||null;
  if(!record&&this.storage){try{record=JSON.parse(this.storage.getItem(key)||'null');}catch{record=null;}}
  if(!record||record.destinationId!==destinationId||record.expiresAt<=this.now()){this.remove(destinationId);return null;}
  return record;
 }
 writeSuccess(destinationId,image){return this.write(destinationId,{status:'verified',image},this.successTtl);}
 writeFailure(destinationId,reason='unavailable'){return this.write(destinationId,{status:'unavailable',reason},this.failureTtl);}
 write(destinationId,value,ttl){
  const key=this.key(destinationId),record={destinationId,...value,cachedAt:this.now(),expiresAt:this.now()+ttl};memoryCache.set(key,record);
  if(this.storage){try{this.storage.setItem(key,JSON.stringify(record));}catch{/* memory cache remains available */}}
  return record;
 }
 remove(destinationId){const key=this.key(destinationId);memoryCache.delete(key);if(this.storage){try{this.storage.removeItem(key);}catch{/* ignore unavailable storage */}}}
}

export const DESTINATION_IMAGE_CACHE_TTL={success:DEFAULT_SUCCESS_TTL,failure:DEFAULT_FAILURE_TTL};
