import { SERVICE_METADATA } from "../metadata";

/**
 * Registers service dependencies for a controller.
 *
 * The specified services will be available for dependency injection
 * when the controller instance is created.
 *
 * @example
 * ```ts
 * \@Service([
 *   CatService,
 *   DogService
 * ])
 * \@Controller('/cats')
 * class CatController {
 *
 *   constructor(
 *     private dogService: DogService,
 *     private catService: CatService
 *   ) {}
 * }
 * ```
 *
 * @param services Array of service classes to register.
 * @returns Class decorator.
 */
export const Service = (services: (new () => any)[]): ClassDecorator => {
  return (target) => {
    Reflect.defineMetadata(SERVICE_METADATA,services,target);
  };
}