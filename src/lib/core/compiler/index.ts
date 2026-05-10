import { generateRoutes } from "./generator"
export class Compiler {
    public async generateRoutes (options: {
        folder: string
        name: RegExp
    }) {
        return await generateRoutes({ controllers : options })
        .catch(err => console.log(err))
    }   
}