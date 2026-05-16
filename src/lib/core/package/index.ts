class Package {
    static import(name : string) {
        try {
            return require(name)
        }
        catch (err:any) {
            throw new Error(`The package '${name}' caused by '${err.message}'. Please try installing the package using : npm install ${name} --save`)
        }
    }

    static get classTransformer () {
        try {

            const { plainToInstance } = require('class-transformer');

            type ClassConstructor<T> = new (...args: any[]) => T;
            
            return {
                plainToInstance: <T>(cls: ClassConstructor<T>, plain: object) => {
                    return plainToInstance(cls, plain);
                }
            }

        } catch (err:any) {
            throw new Error(`The package 'class-transformer' caused by '${err.message}'. Please try installing the package using : npm install class-transformer --save`)
        }
    }

    static get classValidator () {
        try {

            const { validate } = require('class-validator');

            return {
                validate: async <T extends object>(dto: T) => {
                    return await validate(dto);
                }
            }

        } catch (err:any) {
            throw new Error(`The package 'class-validator' caused by '${err.message}'. Please try installing the package using : npm install class-validator --save`)
        }
    }
}

export { Package }
export default Package