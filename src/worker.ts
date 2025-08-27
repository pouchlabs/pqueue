// oxlint-disable no-eval
//define self on nodejs
void !function () {
   typeof self == 'undefined'
     && typeof global == 'object'
     && (global.self = global);
 }();

import EventEmitter from "eventemitter3";
import { Json } from "@pouchlab/core-utils";
interface Job {
   id:string,
   fn:Function,
   status: "stopped" | "running" | "completed" | "failed",
   delay: number
}


const QueueEmitter = new EventEmitter();

const ctx: Worker = (await (import("node:worker_threads"))).parentPort || self;
let jobs_count = 0

async function scheduleJob(this: any, job:Job){
 try {
  let func = job.fn 
   let data = await func.call(this,arguments);
   //reduce job counts
   jobs_count = jobs_count - 1;
   ctx.postMessage({msg:"count",num:jobs_count,wrk_id:job?.wrkid});
     let timmer =  setTimeout(()=>{
      ctx.postMessage({
          iserror: false,
          msg: data?.status || "completed",
          error: null,
          data: data || null,
          id: job.id
       }); 
       clearTimeout(timmer)
 },job.delay || 0)

 }catch(error) {

  jobs_count = jobs_count - 1;
  ctx.postMessage({msg:"count",num:jobs_count});
 
  ctx.postMessage({
    iserror:true,
    msg:"error occurred",
    error,
    data:null,
    id:job.id
  })
 }
}

//
QueueEmitter.on("scheduled_job",scheduleJob) 

// message
ctx.onmessage = async (msg) => {
 let j:Job = Json.parse(msg.data)
 ctx.postMessage({data:{status:"running",id:j.id,fn:j.fn.toString()}})
 jobs_count = jobs_count + 1
 //emit count
 ctx.postMessage({msg:"count",num:jobs_count,wrk_id:j?.wrkid});
 QueueEmitter.emit("scheduled_job",j)
} 

export default ctx
