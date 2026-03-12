import { type T } from '../types'

const methodDecorator = (method: T.Method) => {
  return (path: `/${string}`) => {
    return (target:any, propertyKey:any) => {
      const controller = target.constructor;

      const routers: T.Router[] = Reflect.hasMetadata("routers", controller) 
        ? Reflect.getMetadata("routers", controller) 
        : [];

      routers.push({
        method,
        path,
        handler: propertyKey,
      });

      Reflect.defineMetadata("routers", routers, controller);
    }
  }
}

export const Get = methodDecorator('get');
export const Post = methodDecorator('post');
export const Put = methodDecorator('put');
export const Patch = methodDecorator('patch');
export const Delete = methodDecorator('delete');