// oxlint-disable
import  Wrk from "./worker-import.ts";
import { Json,checktype,genListByRange } from "@pouchlab/core-utils"; 
import EventEmitter from "eventemitter3";


export interface QueueOptions {
    numWorkers?:number
}
export interface WorkerInstance {
  id:string,
  worker:Worker,
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
  id?:string,
  fn:Function,
  delay?: number
}

function spawnWorkers(num:number,...wrks: WorkerInstance[]){
  
   if(num && typeof num === "number" && num <= 50 ){
    let workers = [];
    for(let i =0;i <= num;i++){
      
     const worker = new Wrk(new URL("./worker.ts",import.meta.url)) //|| new URL("./worker.js",import.meta.url))
     
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
        
          let  jobs_to_use = [...jobs.values()].filter((j:Job)=>j.status === "stopped");
          let free_Worker =  workers?.filter((w: { isActive: boolean; })=>w?.isActive === false)
         let range_by  = Math.floor((free_Worker?.length / 2) + 2)
         //this makes workers recieve jobs
       let arr_in_range = await genListByRange(jobs_to_use,0,range_by);
        let found_sorted_workers = free_Worker?.sort().slice(0,arr_in_range.length)
       for(let wrk in found_sorted_workers){
        let worker: WorkerInstance = found_sorted_workers[wrk]
        scheduleJob(worker,arr_in_range[wrk])
       }
   
 
} 

async function onFailedJob(jobs: Map,workers: any[] | undefined){
  let  jobs_to_use = [...jobs.values()].filter((j:Job)=>j.status === "failed");
  
  let free_Worker =  workers?.filter((w: { isActive: boolean; })=>w?.isActive === false)
 let range_by  = Math.floor((free_Worker?.length / 2) + 2)
 //this makes workers recieve jobs
let arr_in_range = await genListByRange(jobs_to_use,0,range_by);

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
    #workers = [];
    #numWorkers: number;
    #Event = new EventEmitter();
 constructor(opts: QueueOptions = {}){
  this.#jobs = new Map();
  this.#numWorkers = (function():number{
    if(Number(opts?.numWorkers) < 4)return 4;
    return Number(opts?.numWorkers)
  })();
  //addworkers
  this.#workers =  (function(num:number,...wrks: WorkerInstance[]){
    if(num && typeof num === "number" && num <= 50 ){
     let workers = [];
     for(let i =0;i <= num;i++){
       
      const worker = new Wrk(new URL("./worker.js",import.meta.url)) ?? new Wrk(new URL("./worker.ts",import.meta.url))
      
      workers.push({id:crypto.randomUUID(),worker,isActive:false})
        
     }
    workers = wrks.concat(workers)
     if(workers && workers.length > 0) return workers;
     return workers
    }
 })(opts.numWorkers || 4);
    //
   //add message listeners
   this.#workers?.forEach((wrk: WorkerInstance)=>{
    // worker on error
    wrk?.worker.on("error",(ev: any)=>{
     this.#Event.emit("worker_error",{id:wrk.id,error:ev})
      //remove dead worker on error
      if(this.#workers.length > 0)
      this.#workers = this.#workers?.filter((w) => w?.id !== wrk.id)
   } )
    //message
  wrk?.worker.on("message",(ev: { iserror: any; error: any; data: { status: string; id: any; }; msg: string; })=>{
    //error custom
      if(ev?.iserror){
        //general messenger error on job
        this.#Event.emit("job_error",ev)
        let found:Job = this.#queuedJobs.get(ev?.id);
        if(!found)return;
        found.status = "failed"
        this.#failedJobs.set(ev?.id,found)
        this.#Event.emit("on_failed_job",found)
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
  this.#Event.once("jobs_added",data =>{onJobs(data,this.#workers)})
  //failed


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
  if(!this.#jobs.has(newjob.id)){
  this.#jobs.set(newjob.id,{id: newjob.id,fn:newjob.fn,status:newjob.status,delay:newjob.delay})
  let timmer = setTimeout(()=>{
  this.#Event.emit("jobs_added",this.#jobs)
 clearTimeout(timmer) 
  },1)
  return this
  }
   return this
 }
 /**
  * clears all completed jobs and failed jobs,to release memory
  */
  async clear(){
    try {
      this.#completed_Jobs.clear()
      this.#failedJobs.clear()
      return true;
    } catch (error) {
      return false
    }
  }
  /**
   * listener for failed job
   */
 onFailedJobs(cb:Function){
  if(cb && typeof cb === "function")
    this.#Event.once("on_failed_job",async (j)=>{
       return cb.call(this,j)
    })
    return this
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
       return cb.call(this,job)
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