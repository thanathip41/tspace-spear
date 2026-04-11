import { T } from "../../src/lib";

const sleep = (ms : number) => new Promise(resolve => setTimeout(resolve, ms))

export const CatMiddleware = async (ctx : T.Context, next: T.NextFunction) =>{
    await sleep(100);
    console.log('Cat middleware globals');
    ctx.req.cat = 'Meow!';
    return await next();
}