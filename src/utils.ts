import os from "node:os";
import { cpuCores } from "./browser.ts";
import {isBrowser} from "@antfu/utils"
export function getCores(){
    if(!isBrowser)return os.cpus().length - 2 ;//todo: use - minus 1
    return cpuCores;
}

export class RoundRobin {
    items:unknown[];
    currentIndex:number;
    constructor(items:unknown[]) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Items must be a non-empty array.");
      }
      this.items = items;
      this.currentIndex = 0;
    }
     /**
      * gets next item in the robin.
      * @returns 
      */
    next() {
      const item = this.items[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.items.length;
      return item;
    }
  }

