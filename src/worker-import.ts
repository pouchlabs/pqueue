
const Workers: Worker = await (async function(){
   return (await (import("node:worker_threads"))).Worker || Worker;
})();

export {Workers as Worker}; 
export default Workers 