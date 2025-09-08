import Pqueue from "./queue.ts"; 
import { Bench,hrtimeNow } from 'tinybench'

let p = new Pqueue() 
let p2 = new Pqueue() 
// p.addJob({id:"two",fn:function (){  
//   return {mm:"hb" }  
// }},(db)=>{   
//   console.log(db,"db")   
// }) 
// p.addJob({id:"one",fn:async function (){  
//     return {mm:"hb2" }  
//   }})   
// p.addJobs([{fn:function(){
//   return "many"
// }}]) 
//for bench
const bench = new Bench({ name: 'simple benchmark', time: 100 })

bench
  .add('faster task', () => {
  for(let i=0;i< 1;i++){    
    p.addJob({id: "two" ,delay:0,fn:async function (){
      await Bun.write(
        Bun.file("./hello.txt"),
        "Hello, world!"
      );
        //return {mm:"hm" }  
    }}) 
  }  
  
  })
await bench.run() 
console.table(bench.table())
// //for(let i=0;i< 2;i++){    
//     p.addJob({id: "two"+i ,delay:0,fn:async function (){
//         return {mm:"hm" }  
//     }},(d)=>console.log("f")) 
// //}   

//   p.addJobs([{id: "two1" ,delay:0,fn:async function (){
//         return {mm:"hmp2" }}  
//      },{id: "two1b" ,delay:5000,fn:async function (){
//         return {mm:"hmp2b" }}
//      }])
// p2.addJob({id: "two1" ,delay:0,fn:async function (){
//     return {mm:"hmp2" }  
// }},(d)=>console.log(d,"f"))  
// p2.addJob({id: "one" ,delay:0,fn:async function (){
//     return {mm:"hmp2" }  
// }},(d)=>console.log(d,"f")) 
  
// //p.start()
// p.addJob({id: "one2",delay:50,fn:async function (){
//   return {mm:"hbm" }   
// }})   

//p.onCompleted((d)=>{console.log(d,"g")}) 

p2.onCompleted((d)=>{console.log(d,"p2")}) 
 
p2.addJob({fn:function(){
  return "2"
}})
  