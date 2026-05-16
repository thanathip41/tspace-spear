export const MiddlewareTemplate = `
import { type T } from "tspace-spear";

const sleep = async (ms : number) => new Promise(resolve => setTimeout(resolve, ms))

export const LogMiddleware = async (ctx : T.Context, next: T.NextFunction) =>{
    await sleep(100);
    console.log('after logging middleware Meow!');
    ctx.req.cat = 'Meow!';
    return next()
}
`