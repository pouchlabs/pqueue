
const Workers:Worker = await (async function(){
   let worker =  await  import("node:worker_threads") || Worker;
   return worker.Worker
})();
export {Workers as Worker};
export default Workers 