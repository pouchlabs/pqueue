// oxlint-disable
import Worker from './browser.ts';
import Wrknode from "./node.ts";
import { Json,checktype} from "@pouchlab/core-utils"; 
import {Pemitter} from "@pouchlab/emitter"
import { getCores,RoundRobin } from './utils.ts';

const numWorkers = getCores();
const workers = new Map();
const queuedJobs = new Map();
const failedJobs = new Map();
const completed_Jobs = new Map();
const jobs = new Map();

export var Qev = Object.assign(new Pemitter());
 

export interface QueueOptions {
 
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

interface WorkerMessage{
   iserror: any,
    error: any,
     data: {
       status: string, 
       id: string, 
       iserror: boolean,
       msg:string,
       wrk_id:string
      },
     msg: string,
  }


//message handler
function handleWorkerMessage(ev: WorkerMessage):void{
     //error custom
     if(ev.data?.iserror){
      //general messenger error on job
      Qev.emit("job_error",ev.data)
      let found:Job = queuedJobs.get(ev.data?.id);
      if(!found)return;
      found.status = "failed"
      failedJobs.set(ev?.data?.id,found)
      Qev.emit("on_failed_job",found)
      queuedJobs.delete(ev?.data?.id)
    }
    //update  status
    if(ev?.data?.status === "running"){
      let found:Job = jobs.get(ev?.data?.data.id);
      if(!found)return;
      found.status = "running";
      jobs.set(ev?.data?.id,found)
      queuedJobs.set(found.id,found)
      Qev.emit("job_running",found)
      return 
    }
     //completed job
    if(ev?.data?.msg === "completed"){
      
      let found:Job = jobs.get(ev?.data?.id);
      if(!found)return; 
      found.status = "completed";
      completed_Jobs.set(ev?.data?.id,found) 
      //remove from queue 
      queuedJobs.delete(found.id)
      Qev.emit("job_completed",ev.data)
      Qev.emit("job_completed"+ev?.data?.id,ev.data)
      return
    } 
   
    //update worker 
    if(ev?.data?.msg === "count"){
       let found = workers.get(ev.data.wrk_id)
       if(found){
        found.count = ev.data?.num;
       }
       
    }
}

//handle worker error
function handleWorkerError(error,wrk){
  try { 
    Qev.emit("worker_error",{id: wrk.id,error:error?.message})
  } catch (error) {
    //handle err
  }
} 
function handleWorkerExit(code,wrk){
  try {
   let timmer = setTimeout(()=>{
     workers.delete(wrk);
     Qev.emit("worker_exit",{code,id:wrk})
     clearTimeout(timmer)
   },100)
  } catch (error) {
    //handle err
  }
}
//spawn single worker 
function spawnWorker(){
  try {
    let url = new URL("./worker.js" ?? "./worker.ts",import.meta.url);
    //check for availability
    if(Wrknode || Worker){
    const worker = new Wrknode(url,{type:"module"}) || new Worker(url);
    let newWorker = {
      id:crypto.randomUUID(), //todo add own ids gens
      worker,
      count:0
    }
    worker?.addEventListener("message", handleWorkerMessage);
    worker?.addEventListener("error",err=>{
      handleWorkerError(err,newWorker.id)
      handleWorkerExit(1,newWorker.id)
    });
    worker.addEventListener("exit",(code)=>{
      handleWorkerExit(code,newWorker.id)
    })
      workers.set(newWorker.id,newWorker);
      return worker
    }
  } catch (error) {
    return null
  }
}

function spawnWorkers(){
  try{
// Create and initialize workers
for (let i = 0; i < numWorkers; i++) {
   let url = new URL("./worker.js" ?? "./worker.ts",import.meta.url)
  //check for availability
  if(Wrknode || Worker){
  const worker = new Wrknode(url,{type:"module"}) || new Worker(url);
  let newWorker = {
    id:crypto.randomUUID(), //todo add own ids gens
    worker,
    count:0
  }
  worker?.addEventListener("message", handleWorkerMessage);
  worker?.addEventListener("error",err=>{
    handleWorkerError(err,newWorker.id)
    handleWorkerExit(1,newWorker.id)
  });
  worker.addEventListener("exit",(code)=>{
    handleWorkerExit(code,newWorker.id)
  })
   workers.set(newWorker.id,newWorker);
  } 
}
  }catch(error){
   throw new Error("error occurred while creating workers: \n","bb")
  }
}

//init workers
spawnWorkers()


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


function scheduleJob(wrk: WorkerInstance,job:Job){
   wrk.worker.postMessage(Json.stringify({job,wrkid:wrk.id}))
   //update worker state
   wrk.isActive = true;
}

/**
 *  recieves jobs and schedules them
 * @param jobs 
 */
 async function onJobs(job:Job){
          let free_Workers =  [...workers.values()];
          if(free_Workers && free_Workers?.length > 0){
          let assigned_worker: WorkerInstance = new RoundRobin(free_Workers).next();
            scheduleJob(assigned_worker,job)
          }else{
            if(workers.size < getCores()){
              spawnWorker()
            }
            onJobs(job)
          }
} 

 // listen on jobs and emit jobs for schedule
 Qev.once("jobs_added",(data)=>{onJobs(data.data)})
 
/**
 * Queue Tasks like a boss in worker pool.
 * @param opts {object} - options to be initialize.
 */
export default class Queue{
  [x: string]: any;
 constructor(opts: QueueOptions = {}){}
  /** 
   * schedules a single job.
   * @param job {object} - job to run.
   * @param cb - a callback function to listen to results.
   * @returns 
   */
 addJob(job: JobType,cb=()=>{}){
  if(!job || checktype(job) !== checktype({})  || !job.fn || typeof job.fn !== "function" || job.delay && typeof job.delay !== "number" || job.id && typeof job.id !== "string" ){
    throw new Error("job must be a valid object && fn must be a function and is required");  
  }
  let newjob: Job = {id:job.id || crypto.randomUUID(),fn: job.fn,status:"stopped",delay: job.delay || 0}
  if(!jobs.has(newjob.id)){
  jobs.set(newjob.id,{id: newjob.id,fn:newjob.fn,status:newjob.status,delay:newjob.delay})
  Qev.emit("jobs_added",newjob)

let timmer = setTimeout(()=>{  
    this._id = newjob.id;
    if(this._id){
      Qev.on("job_completed"+this._id, data =>{cb(data.data)})     
    } 
clearTimeout(timmer) 
},2)
  return this
  }
   return this
 }
 /**
  * schedules jobs in bulk.
  * @param arr - array of jobs to schedule.
  * @param cb 
  */
 addJobs(arr:JobType[],cb=()=>{}){
   if(arr && checktype(arr) === checktype([{}])){
    for(let job of arr){
      if(job.fn && typeof job.fn === "function"){
        this.addJob(job,(data)=>{
           if(cb && typeof cb === "function"){
            cb(data)
           }
        })
      }
    }
   }
 }
 /**
  * clears all completed jobs and failed jobs,to release memory
  */
  async clear(){
    try {
      completed_Jobs.clear()
      failedJobs.clear()
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
    Qev.once("on_failed_job",async (j)=>{
       return cb.call(this,j.data)
    })
    return this
  }
 workers={
    /**
     * list all workers
     */
   list: async ()=> {
     return workers;
   },
   onError: (cb:Function)=>{
      if(cb && typeof cb === "function"){
      Qev.on("worker_error",res =>{cb(res.data)})
      }
      return this
      } ,
      /**
       * runs when a worker exits
       * @param cb 
       * @returns 
       */
      onExit(cb: Function){
        if(cb && typeof cb === "function"){
          Qev.on("worker_exit",res =>{cb(res.data)})
          }
          return this
      }
    
 }
/**
 * Listens on all completed tasks sequentially.
 * @param cb -callback to listen on completed jobs
 * @returns 
 */
 onCompleted(cb:Function){
   if(cb && typeof cb === "function"){
    Qev.on("job_completed",async (data)=>{ 
     if(data.type === "job_completed"){
          cb(data.data)  
     }
    })
   }
   return this
 }
 /**
  * Listens on failed jobs.
  * @param cb -callback for failed jobs.
  * @returns 
  */
 onError(cb:Function){
  if(cb && typeof cb === "function"){
     Qev.on("job_error",cb)
  }
  return this
  }
}