import { Socket } from 'net';
import fsSystem   from 'fs';
import pathSystem from 'path';
import crypto     from 'crypto';
import mime       from 'mime-types';
import type { T } from '../../types';

import { 
  HTTP_STATUS_MESSAGES 
} from '../../const';

import { PayloadTooLargeException } from "../../exception";

export const netBody = (req: T.Request, res:T.Response): Promise<any> => {
  return new Promise((resolve, reject) => {
  
    if (req._bodyRead) return reject(new Error("Body already consumed"));
    req._bodyRead = true;

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength === 0) return resolve({});

    let buffer = req._body || Buffer.alloc(0);
    const socket = req.socket;

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= contentLength) {
        cleanup();
        try {
          const bodyStr = buffer.subarray(0, contentLength).toString('utf8');
          const contentType = req.headers['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(bodyStr));
          } else {
            resolve(Object.fromEntries(new URLSearchParams(bodyStr)));
          }
        } catch (e) { reject(e); }
      }
    };

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', reject);
    };

    if (buffer.length >= contentLength) return onData(Buffer.alloc(0));
    
    socket.on('data', onData);
    socket.on('error', reject);
  });
};