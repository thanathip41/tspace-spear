import { type T } from '../types';

export const  StatusCode = (statusCode : T.Code): Function => {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        const code = statusCode < 100 ? 100 : statusCode > 599 ? 599 : statusCode;

        descriptor.value = async function(ctx : T.Context , next :T.NextFunction) {
            ctx.res.writeHead(code , { 'Content-Type': 'application/json'})
            return await originalMethod.call(this, ctx , next);
        };

        return descriptor;
    };
}
