import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTravelApi} from './travel-api.js';
import {createPreferenceApi} from './preference-api.js';
import {createDestinationDiscoveryApi} from './destination-discovery-api.js';

const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
const api=createTravelApi();
const preferenceApi=createPreferenceApi();
const destinationDiscoveryApi=createDestinationDiscoveryApi();
const send=(response,status,body,type='text/plain; charset=utf-8')=>{response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});response.end(body);};
const readWebRequest=async(request,path)=>{
  const chunks=[];let size=0;
  for await (const chunk of request) { size+=chunk.length;if(size>32768) throw new Error('Request too large');chunks.push(chunk); }
  return new Request(`http://localhost${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:Buffer.concat(chunks)});
};

const server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if (request.method==='POST' && url.pathname==='/api/travel/flights/search') {
    try {
      const webRequest=await readWebRequest(request,url.pathname);
      const result=await api.handle(webRequest);
      return send(response,result.status,await result.text(),'application/json; charset=utf-8');
    } catch { return send(response,400,JSON.stringify({error:{code:'INVALID_REQUEST',message:'The live flight request was invalid.'}}),'application/json; charset=utf-8'); }
  }
  if (request.method==='POST' && url.pathname==='/api/travel/preferences/parse') {
    try {
      const result=await preferenceApi.handle(await readWebRequest(request,url.pathname));
      return send(response,result.status,await result.text(),'application/json; charset=utf-8');
    } catch { return send(response,400,JSON.stringify({error:{code:'INVALID_REQUEST',message:'The trip description was invalid.'}}),'application/json; charset=utf-8'); }
  }
  if (request.method==='POST' && url.pathname==='/api/travel/destinations/discover') {
    try {
      const result=await destinationDiscoveryApi.handle(await readWebRequest(request,url.pathname));
      return send(response,result.status,await result.text(),'application/json; charset=utf-8');
    } catch { return send(response,400,JSON.stringify({error:{code:'INVALID_REQUEST',message:'The destination discovery request was invalid.'}}),'application/json; charset=utf-8'); }
  }
  if (url.pathname.startsWith('/api/')) return send(response,404,JSON.stringify({error:{code:'NOT_LIVE',message:'Hotels are Demo / not yet live.'}}),'application/json; charset=utf-8');
  if (!['GET','HEAD'].includes(request.method)) return send(response,405,'Method not allowed');
  const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const file=resolve(root,'.'+relative);
  if (file!==root && !file.startsWith(root+sep)) return send(response,403,'Forbidden');
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    const body=await readFile(file);response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});response.end(request.method==='HEAD'?undefined:body);
  } catch { send(response,404,'Not found'); }
});

const port=Number(process.env.PORT || 4173);
server.listen(port,'0.0.0.0',()=>console.log(`Timing: http://localhost:${port}`));
