import net from "net";
import http from "http";

export type AdapterType = 'http' | 'uws' | 'net';

export function getAdapter() {
  const adapterEnv = process.env.TEST_ADAPTER || 'http';
  
  switch (adapterEnv.toLowerCase()) {
    case 'uws': {
      const uWS  = require('uWebSockets.js');
      return { adapter: uWS, portOffset: 100, type: 'uws' as AdapterType };
    }
   
    case 'net':
      return { adapter: net, portOffset: 200, type: 'net' as AdapterType };
    case 'http':
    default:
      return { adapter: http, portOffset: 0, type: 'http' as AdapterType };
  }
}

