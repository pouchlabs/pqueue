
const Workers:Worker = await (async function(){
   let worker =  await  import("worker_threads") || Worker;
   return worker.Worker
})();
export {Workers as Worker};
export default Workers 