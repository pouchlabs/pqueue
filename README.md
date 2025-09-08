# @pouchlab/worker-pool
A worker pool for bun,nodejs,browser,deno..run cpu intensive tasks in parallel.

## install

```bash
  npm i @pouchlab/worker-pool
```

## usage
version >= 2.0.0
```js
  import Pqueue from "@pouchlab/worker-pool";
//numWorkers no longer needed,workers are determined by cpus.
let p = new Pqueue()

p.addJob({id: "one",delay:0,fn:async function (){
  return {mm:"h" }   
}})//no cb 

//add bulk
p.addJobs([{id: "one",delay:0,fn:async function (){
  return {mm:"h" }   
}},{id: "one2",delay:0,fn:async function (){
  return {mm:"h2" }   
}}],(result)=>{
  console.log(result) //cb
})
// or
// for(let i=0;i< 10;i++){
// p.addJob({id: "two"+i ,delay:1000,fn:async function (){
//   return {mm:"h" }  
// }})   
// }  

p.addJob({id: "one2",delay:0,fn: async function (){
  return {mm:"h" }  
}},(data)=>{
  //cb listener for results
  console.log(data)
}) 
    //listens for completed jobs globally
 p.onCompleted((d)=>{console.log(d,"g")})

//listens for errors on workers
  p.workers.onError(er=>console.log(er,"er"))   
  console.log(p.workers)
//listens for failed jobs
p.onError((e)=>console.log(e))

//on failed jobs
p.onFailedJobs((j)=>console.log(j))

//clear all completed jobs to free memory
console.log(await p.clear())
```
# support
support the development of this project,financial and code contribution are welcomed.
Made with love by Pouchlabs