import Pqueue from "./queue";

let p = new Pqueue({numWorkers:5})

p.addJob({id: "one",delay:0,fn:async function (){
  return {mm:"h" }   
}}) 
// for(let i=0;i< 10;i++){
// p.addJob({id: "two"+i ,delay:1000,fn:async function (){
//   return {mm:"h" }  
// }})   
// }  

p.start()
p.addJob({id: "one2",delay:0,fn:async function (){
  return b//{mm:"h" }  
}}) 
    
 p.onCompleted((d)=>{console.log(d,"g")})

  p.workers.onError(er=>console.log(er,"er"))   

