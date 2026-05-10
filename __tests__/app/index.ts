import Spear from "../../src/lib";

export const app = new Spear({
    logger : true,
    controllers: {
        folder : `${__dirname}/controllers`,
        name:/controller\.(ts|js)$/i
    }
})
.useGlobalPrefix('api')
.useBodyParser()