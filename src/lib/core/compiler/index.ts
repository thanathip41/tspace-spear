import { 
    generateRoutes, 
    transformBaseContract 
} from "./generator";
export class Compiler {
    public async generateRoutes (globalPrefix: string , options: {
        folder: string
        name: RegExp
    }) {
        return await generateRoutes(globalPrefix , options)
        .catch(_ => null)
    }   

    public async transformBaseContract (complie: string) {
        return await transformBaseContract(complie)
        .catch(_ => {
            return {}
        })
    }
}