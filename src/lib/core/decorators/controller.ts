export const Controller = (path: `/${string}`): ClassDecorator => {
  return (target) => {
    return Reflect.defineMetadata("controllers", path, target);
  };
}
