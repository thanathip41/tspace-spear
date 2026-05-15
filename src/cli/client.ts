
export const client = `
// for example E2E
import { AppRouter } from ".";
import { ApiClient } from "tspace-spear/client";

const client: ApiClient<AppRouter> = new ApiClient(
  "http://localhost:8000/api"
);

async function main() { 
    
    const res = await client.get("/cats");
    res.data.cats = 1 // Type error: Type 'number' is not assignable to type '{ id: number; name: string; age: number; }[]'
    res.data.cats[0].name = 1 // Type error: Type 'number' is not assignable to type 'string'
    res.data.cats[0].age = "1.6" // Type error: Type 'string' is not assignable to type 'number'

    console.log(res) 
    // res.ok -> boolean
    // res.status -> number
    // res.data -> { cats: [{ id: 1, name: 'cat1', age: 1.6 },{ id: 2, name: 'cat2', age: 1.8 }] }

    await client.get("/catsq"); // Type error: Argument of type '"/catsq"' is not assignable to parameter of type '"/cats" | "/cats/:id" | ... 3 more
    
}
main()
`