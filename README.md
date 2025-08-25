# @pouchlab/worker-pool
A worker pool for bun,nodejs,browser,deno..run cpu intensive tasks in parallel.

## install

```bash
  npm i @pouchlab/worker-pool
```

## usage
```js
  import Pqueue from "@pouchlab/worker-pool";

let p = new Pqueue({numWorkers:5})

p.addJob({id: "one",delay:0,fn:async function (){
  return {mm:"h" }   
}}) 
// for(let i=0;i< 10;i++){
// p.addJob({id: "two"+i ,delay:1000,fn:async function (){
//   return {mm:"h" }  
// }})   
// }  

p.addJob({id: "one2",delay:0,fn: async function (){
  return {mm:"h" }  
}}) 
    //listens for completed jobs
 p.onCompleted((d)=>{console.log(d,"g")})

//listens for errors on workers
  p.workers.onError(er=>console.log(er,"er"))   

//listens for failed jobs
p.onError((e)=>console.log(e))

//run failed jobs
p.runFailedJobs()

//clear all completed jobs to free memory
console.log(await p.clear())
```
# support
support the development of this project,financial and code contribution are welcomed.
Made with love by Pouchlabs