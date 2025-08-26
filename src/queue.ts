import { Worker } from "./worker-import.ts";
import { Json,checktype,genListByRange } from "@pouchlab/core-utils"; 
import EventEmitter from "eventemitter3";


export interface QueueOptions {
    numWorkers?:number
}
export interface WorkerInstance {
  id:string,
  worker:object,
  isActive:boolean,
  count: number
}
export interface Job {
    id:string,
    fn:Function,
    status: "stopped" | "running" | "completed" | "failed",
    delay: number
}
export interface JobType {
  id:string,
  fn:Function,
  delay: number
}
function genWorkerUrl(){
 
// "Server response", used in all examples
var response = `
import EventEmitter from "eventemitter3";
import { Json } from "@pouchlab/core-utils";
var QueueEmitter = new EventEmitter;
var ctx = self;
var jobs_count = 0;
async function scheduleJob(job) {
  try {
    let func = job.fn;
    if (func && func.then || func.catch || func instanceof Promise) {
      const completed = await func.call(this);
      jobs_count = jobs_count - 1;
      ctx.postMessage({ msg: "count", num: jobs_count, wrk_id: job?.wrkid });
      let timmer = setTimeout(() => {
        ctx.postMessage({
          iserror: false,
          msg: completed?.status || "completed",
          error: null,
          data: completed || null,
          id: job.id
        });
        clearTimeout(timmer);
      }, job.delay || 0);
    } else {
      let data = await func();
      jobs_count = jobs_count - 1;
      ctx.postMessage({ msg: "count", num: jobs_count, wrk_id: job?.wrkid });
      let timmer = setTimeout(() => {
        ctx.postMessage({
          iserror: false,
          msg: data?.status || "completed",
          error: null,
          data: data || null,
          id: job.id
        });
        clearTimeout(timmer);
      }, job.delay || 0);
    }
  } catch (error) {
    jobs_count = jobs_count - 1;
    ctx.postMessage({ msg: "count", num: jobs_count });
    ctx.postMessage({
      iserror: true,
      msg: "error occurred",
      error,
      data: null,
      id: job.id
    });
  }
}
QueueEmitter.on("scheduled_job", scheduleJob);
ctx.onmessage = async (msg) => {
  let j = Json.parse(msg.data);
  ctx.postMessage({ data: { status: "running", id: j.id, fn: j.fn.toString() } });
  jobs_count = jobs_count + 1;
  ctx.postMessage({ msg: "count", num: jobs_count, wrk_id: j?.wrkid });
  QueueEmitter.emit("scheduled_job", j);
};
var worker_default = ctx;
export {
  worker_default as default
};
`;

var blob;
try {
    blob = new Blob([response], {type: 'application/javascript'});
    return (new URL("./worker.js",import.meta.url) || URL?.createObjectURL(blob))
} catch (e) { // Backwards-compatibility
  return  new URL("./worker.js",import.meta.url);
 
}
}
export  function spawnWorkers(num:number,...wrks: WorkerInstance[]){
   if(num && typeof num === "number" && num <= 50 ){
    let workers = [];
    for(let i =0;i <= num;i++){
      
     const worker = new Worker(genWorkerUrl())
       workers.push({id:crypto.randomUUID(),worker,isActive:false})
     
    }
   workers = wrks.concat(workers)
    if(workers && workers.length > 0) return workers;
    return workers
   }
}

export function range(start:number, stop:number, step=1) {
    var a = [start], b = start;
    while (b < stop) {
        a.push(b += step || 1);
    }
    return (b > stop) ? a.slice(0,-1) : a;
}

export  function findWorkerById(id:string,workers=[]){
    let found = workers.find((_w:WorkerInstance) => _w?.id === id);
    if(!found)return null;
    return found
}

export function changeWorkerState(id:string,workers:[]=[]){
 let found = findWorkerById(id,workers);
 if(found){
  let filtered = workers.filter((_w:WorkerInstance) => _w?.id !== id);
   found.isActive = true;
  filtered.push(found)
   return filtered
 }
 return workers
}


function scheduleJob(wrk: WorkerInstance,jobs:Job[]){
  for(let job of jobs){
    job.fn = job.fn;
    job.wrkid = wrk.id
    //post to worker
   wrk.worker.postMessage(Json.stringify(job))
   //update worker state
   wrk.isActive = true;

}  
}

/**
 *  recieves jobs and schedules them
 * @param jobs 
 */
 async function onJobs(jobs: Map,workers: any[] | undefined){ 
           jobs = Array.from(jobs.values()).filter((j:Job)=>j.status === "stopped");
         let free_Worker =  workers?.filter((w: { isActive: boolean; })=>w?.isActive === false)
         let range_by  = Math.floor((free_Worker?.length / 2) + 2)
         //this makes workers recieve jobs
       let arr_in_range = await genListByRange(jobs,0,range_by);
        let found_sorted_workers = free_Worker?.sort().slice(0,arr_in_range.length)
       for(let wrk in found_sorted_workers){
        let worker: WorkerInstance = found_sorted_workers[wrk]
        scheduleJob(worker,arr_in_range[wrk])
       }
   
 
} 
   
/**
 * Queue Tasks like a boss in worker pool.
 * @param opts {object} - options to be initialize, numWorkers .
 */
export default class Queue{
    #queuedJobs=new Map();
    #failedJobs = new Map();
    #completed_Jobs = new Map();
    #jobs
    #workers: WorkerInstance[];
    #numWorkers: number;
    #Event = new EventEmitter();
 constructor(opts: QueueOptions = {}){
  this.#jobs = new Map();
  this.#numWorkers = (function():number{
    if(Number(opts?.numWorkers) < 4)return 4;
    return Number(opts?.numWorkers)
  })();
  this.#workers = spawnWorkers(this.#numWorkers,this.#workers) || [];

   //add message listeners
   this.#workers?.forEach((wrk: WorkerInstance)=>{
    // worker on error
    wrk?.worker.on("error",(ev: any)=>{
     this.#Event.emit("worker_error",{id:wrk.id,error:ev})
      //remove dead worker on error
      if(this.#workers.length > 0)
      this.#workers = this.#workers?.filter((w) => w?.id !== wrk.id)
   }) 
    
  wrk?.worker.on("message",(ev: { iserror: any; error: any; data: { status: string; id: any; }; msg: string; })=>{
    //error custom
      if(ev?.iserror){
        //general messenger error on job
        this.#Event.emit("job_error",ev)
        let found:Job = this.#queuedJobs.get(ev?.id);
        if(!found)return;
        found.status = "failed"
        this.#failedJobs.set(ev?.id,found)
        this.#queuedJobs.delete(ev?.id)
      }
      //update  status
      if(ev?.data?.status === "running"){
        let found:Job = this.#jobs.get(ev.data.id);
        if(!found)return;
        found.status = "running";
        this.#jobs.set(ev.data.id,found)
        this.#queuedJobs.set(found.id,found)
        this.#Event.emit("job_running",found)
      }
       //completed job
      if(ev?.msg === "completed"){
        let found:Job = this.#jobs.get(ev.id);
        if(!found)return; 
        found.status = "completed";
        this.#completed_Jobs.set(ev.id,found)
        //remove from queue 
        this.#queuedJobs.delete(found.id)
        this.#Event.emit("job_completed",ev)
      }
      //update worker
      if(ev?.msg === "count"){
          wrk.count = ev?.num;
          if(wrk.count === 0){
            wrk.isActive = false;
          }else if(wrk.count >= 50){
            wrk.isActive = true
          }else{
            wrk.isActive = false 
          }
      }
   })
   })

  // listen on jobs and emit jobs for schedule
  this.#Event.on("jobs_added",data =>{onJobs(data,this.#workers)})
 }
  /**
   * 
   * @param job {object} - job to run.
   * 
   * @returns 
   */
 addJob(job: JobType){
  if(!job || checktype(job) !== checktype({})  || !job.fn || typeof job.fn !== "function" || job.delay && typeof job.delay !== "number" || job.id && typeof job.id !== "string" ){
    throw new Error("job must be a valid object && fn must be a function and is required");  
  }
  let newjob: Job = {id:job.id || crypto.randomUUID(),fn: job.fn,status:"stopped",delay: job.delay || 0}
  if(this.#jobs.has(newjob.id))return;
  this.#jobs.set(newjob.id,{id: newjob.id,fn:newjob.fn,status:newjob.status,delay:newjob.delay})
  this.#Event.emit("jobs_added",this.#jobs)
   return this
 }
 /**
  * clears all completed jobs,to release memory
  */
  async clear(){
    try {
      this.#completed_Jobs.clear()
      return true;
    } catch (error) {
      return false
    }
  }
  /**
   * try run failed jobs 
   */
  runFailedJobs(){
     this.#failedJobs.forEach(j=>{
      this.addJob(j)
     })
  }
 workers={
    /**
     * list all workers
     */
   list: async ()=> {
     return this.#workers;
   },
   allActive:async()=>{
    return this.#workers?.filter((_w:WorkerInstance)=> _w?.isActive === true )
   },
   onError: (cb:Function)=>{
      if(cb && typeof cb === "function"){
      this.#Event.on("worker_error",cb)
      }
      return this
      }
    
 }

 onCompleted(cb:Function){
   if(cb && typeof cb === "function"){
    this.#Event.on("job_completed",(job:Job)=>{
       return cb(job)
    }) 
   }
   return this
 }
 onError(cb:Function){
  if(cb && typeof cb === "function"){
     this.#Event.on("job_error",cb)
  }
  return this
  }
}