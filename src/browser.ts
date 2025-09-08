import {isBrowser} from "@antfu/utils"
let cpuCores:number;
if(isBrowser){
   cpuCores = navigator.hardwareConcurrency;
     
}

export{
    cpuCores
}
export default typeof Worker !== 'undefined' ? Worker : undefined;