import { CreateCatDto, UpdateCatDto } from "./cat-dto";
import { Cat } from "./cat-model";

export class CatService {

    private cats: Cat[] = [
        { id: 1, name: 'cat1', age: 1.6 },
        { id: 2, name: 'cat2', age: 1.8 },
    ]
    
    public index () {
        return this.cats;
    }

    public show (id: number) {
        return this.cats.find((d) => d.id === Number(id));
    }

    public create (body: CreateCatDto) {

        const id = this.cats.length + 1;

        const cat = {
            id : id,
            ...body
        }

        this.cats.push(cat);

        return cat;

    }

    public update (id: number, body: UpdateCatDto) {

        const index = this.cats.findIndex((d) => d.id === id);

        if (index === -1) {
            return null;
        }

        this.cats[index] = {
            ...this.cats[index],
            ...body,
            id : id
        };

        const cat = this.cats[index];

        return cat;
    }

    public remove(id: number) {
        const index = this.cats.findIndex((d) => d.id === id);

        if (index === -1) {
            return null;
        }

        this.cats = this.cats.filter((d) => d.id !== id);

        return true;
    }
}