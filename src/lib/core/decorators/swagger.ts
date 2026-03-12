import { type T } from "../types";

export const Swagger = (data : T.Swagger.Spec) => {
    return (target: any, propertyKey: any) => {
        const controller = target.constructor;
        
        const swaggers: any[] = Reflect.hasMetadata("swaggers", controller) 
        ? Reflect.getMetadata("swaggers", controller) 
        : [];
  
        swaggers.push({
            handler :propertyKey,
            ...data
        });
  
        Reflect.defineMetadata("swaggers", swaggers, controller);
      }
  }