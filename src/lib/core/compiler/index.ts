import { generateRoutes } from "./generator"
export class Compiler {
    public async generateRoutes (globalPrefix: string , options: {
        folder: string
        name: RegExp
    }) {
        return await generateRoutes(globalPrefix , options)
        .catch(err => console.log(err))
    }   
}