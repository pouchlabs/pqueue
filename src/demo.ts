import Pqueue from "../dist/index.js"; 

let p = new Pqueue()  
  
p.addJob({id:"two",fn:function (){  
  return {mm:"hb" }  
}})
// for(let i=0;i< 10;i++){
// p.addJob({id: "two"+i ,delay:1000,fn:async function (){
//   return {mm:"h" }  
// }})   
// }  
 
//p.start()
p.addJob({id: "one2",delay:0,fn:async function (){
  return b//{mm:"hbm" }   
}})  
    
 p.onCompleted((d)=>{console.log(d,"g")}) 
 //p2.onCompleted((d)=>{console.log(d,"p2")}) 
p.onFailedJobs() 
//console.log(await p.clear())
  //p.workers.onError(er=>console.log(er,"er"))   
 
