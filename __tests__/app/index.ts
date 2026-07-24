import Spear from "../../src/lib";
import { getAdapter } from "./adapter";

const { adapter } = getAdapter();

export const app = new Spear({
    logger : true,
    adapter,
    controllers: {
        folder : `${__dirname}/modules/*`,
        name:/controller\.(ts|js)$/i,
        preRouteTypes: true
    }
})
.useGlobalPrefix('api')
.useBodyParser()
.useFileUpload()

// app.listen(5000,({ port , server : sCallback }) => {
//     console.log(`server listening on http://localhost:${port}`);
// })