import http from 'node:http';
import worker from './dist/server/index.js';
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{JUDGE_PASSWORD:process.env.JUDGE_PASSWORD,JUDGE_SESSION_SECRET:process.env.JUDGE_SESSION_SECRET});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Error');}
}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
