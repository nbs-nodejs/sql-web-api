// Import
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const qs = require("koa-qs");
const logger = require("./logger");
const config = require("./config");
const middlewares = require("./middleware");
const controller = require("./controller");

function main() {
    // Init app
    const app = new Koa();
    // Init middlewares
    qs(app)
    app.use(bodyParser({enableTypes: ['json']}))
    app.use(middlewares.rest)
    app.use(middlewares.basicAuth)
    // Register controllers
    app.use(controller.routes());
    app.use(controller.allowedMethods());
    // Start Server
    app.listen(config.port, () => {
        logger.info(`Server is running on http://localhost:${config.port}`)
    });
}

main()




