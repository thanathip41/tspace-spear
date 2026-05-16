
export const ServiceTemplate = `
import { 
    CreateCatDto, 
    UpdateCatDto 
}  from "./cat.dto";

type Cat = {
    id: number;
    name: string;
    age: number;
}

export class CatService {
    private cats: Cat[] = [
        { id: 1, name: 'cat1', age: 1.6 },
        { id: 2, name: 'cat2', age: 1.8 },
    ];
    public async index() {
        return this.cats;
    };

    public async show(id: number) {
        const cat = this.cats.find(cat => cat.id === id);
        if(cat == null) return null;
        return cat;
    };

    public async create({ name, age }: CreateCatDto) {

        const cat = {
            id: this.cats.length + 1,
            name: name,
            age: age
        };

        this.cats.push(cat);

        return cat;
    }
    
    public async update(id: number, { name, age }: UpdateCatDto) {
        const index = this.cats.findIndex(d => d.id === id);

        if (index === -1) {
            throw new Error("Cat not found");
        }

        this.cats[index] = {
            ...this.cats[index],
            ...{ name, age }        
        };

        const cat = this.cats[index];

        return cat;
    }

    public async remove(id: number) {
        const index = this.cats.findIndex(d => d.id === id);

        if (index === -1) {
            throw new Error("Cat not found");
        }

        this.cats.splice(index, 1);

        return true;
    }
}
`;