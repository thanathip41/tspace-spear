
export const ServiceTemplate = `
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
        return this.cats.find(cat => cat.id === id);
    };

    public async create({ name, age }: Omit<Cat, "id">) {

        const cat: Cat = {
            id: this.cats.length + 1,
            name: name,
            age: age
        };

        this.cats.push(cat);

        return {
            message: "Created",
            cat
        };
    }
    
    public async update(id: number, { name, age }: Omit<Cat, "id">) {
        const index = this.cats.findIndex(d => d.id === id);

        if (index === -1) {
            throw new Error("Cat not found");
        }

        this.cats[index] = {
            ...this.cats[index],
            ...{ name, age }        
        };

        return {
            message: "Updated",
            cat: this.cats[index]
        };
    }

    public async remove(id: number) {
        const index = this.cats.findIndex(d => d.id === id);

        if (index === -1) {
            throw new Error("Cat not found");
        }

        const [removedCat] = this.cats.splice(index, 1);

        return {
            message: "Deleted",
            cat: removedCat
        };
    }
}
`;