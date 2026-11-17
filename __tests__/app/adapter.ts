import net from "net";
import http from "http";
import { T } from "../../dist/lib";

export type AdapterType = T.Adapter["kind"];

export function getAdapter() {
  const adapterEnv = process.env.TEST_ADAPTER || 'http';
  
  switch (adapterEnv.toLowerCase()) {
    case 'uws': {
      const uWS  = require('uWebSockets.js');
      return { adapter: uWS, portOffset: 100, type: 'uws' };
    }

    case 'bun': {
      return { adapter: Bun, portOffset: 200, type: 'bun' };
    }
   
    case 'net': {
      return { adapter: net, portOffset: 300, type: 'net' };
    }
      
    case 'http':
    default:
      return { adapter: http, portOffset: 0, type: 'http' };
  }
}

