export const routeSegmentKey=({provider,originPlaceId,destinationPlaceId,mode='walking'})=>`${provider}:${originPlaceId}:${destinationPlaceId}:${mode}`;

export function normalizeRouteSegment(value){
 const key=routeSegmentKey(value||{});
 if(!value?.provider||!value?.originPlaceId||!value?.destinationPlaceId||value?.mode!=='walking')throw new Error('Route segment identity is incomplete.');
 if(!Number.isFinite(value.distanceMeters)||value.distanceMeters<0||!Number.isFinite(value.durationMinutes)||value.durationMinutes<0)throw new Error('Route segment metrics are invalid.');
 return {...value,key,verificationState:'LIVE_VERIFIED',distanceMeters:Math.round(value.distanceMeters),durationMinutes:Math.max(1,Math.round(value.durationMinutes)),dataFetchedAt:value.dataFetchedAt||new Date().toISOString()};
}

export function routeMatrixFromSegments(segments=[]){
 const matrix={};for(const segment of segments)matrix[`${segment.originPlaceId}|${segment.destinationPlaceId}`]={durationMinutes:segment.durationMinutes,distanceMeters:segment.distanceMeters,verificationState:segment.verificationState};return matrix;
}
