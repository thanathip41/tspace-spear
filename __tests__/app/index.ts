import Spear from "../../src/lib";

export const app = new Spear({
    logger : true,
    controllers: {
        folder : `${__dirname}/modules/*`,
        name:/controller\.(ts|js)$/i,
        preRouteTypes: true
    }
})
.useGlobalPrefix('api')
.useBodyParser()
.useFileUpload()

// app.listen(5000)