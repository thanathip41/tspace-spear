import { OutgoingHttpHeaders }  from 'http';
import { type T }               from '../types';

export const  WriteHeader = (statusCode : number , contentType : OutgoingHttpHeaders) => {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function(ctx : T.Context , next :T.NextFunction) {
            ctx.res.writeHead(...[ statusCode , contentType ])
            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}
