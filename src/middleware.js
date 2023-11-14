const logger = require('./logger');
const config = require('./config');
const ApiError = require("./api-error");

const middlewares = {}
middlewares.rest = async (ctx, next) => {
    try {
        await next();
        // Set header
        ctx.set("Content-Type", "application/json")
        // Handle not found or not implemented response
        if (!ctx.matched || ctx.status === 405 || ctx.status === 404) {
            ctx.body = {
                success: false,
                code: "404",
                message: "Not Found",
                data: null
            }
            return
        }
        // Handle success response
        ctx.status = 200;
        ctx.body = {
            success: false,
            code: "OK",
            message: "Success",
            data: ctx.data || null
        }
        logger.debug(`Endpoint="${ctx.method} ${ctx.path}" Status=${ctx.status}`)
    } catch (err) {
        logger.error(`Endpoint="${ctx.method} ${ctx.path}" Status=${ctx.status} Error="${err}"`)
        // Determine error
        let httpStatus, code;
        if (err.code && err.options && err.options.httpStatus) {
            httpStatus = err.options.httpStatus;
            code = err.code
        } else {
            httpStatus = 500;
            code = "500"
        }
        // Set http error response
        ctx.set("Content-Type", "application/json")
        ctx.status = httpStatus;
        ctx.body = {
            success: false,
            code,
            message: err.message,
            data: null
        }
    }
}

middlewares.basicAuth = async (ctx, next) => {
    // Get authorization header
    const headerVal = ctx.request.headers["authorization"];
    if (!headerVal) {
        throw unauthorizedError;
    }

    // Get Basic headers
    let tmp = headerVal.split(" ");
    if (tmp.length !== 2) {
        throw unauthorizedError;
    }
    if (tmp[0] !== "Basic") {
        throw unauthorizedError;
    }

    // Decode
    const token = Buffer.from(tmp[1], "base64").toString();
    tmp = token.split(":");
    if (tmp.length !== 2) {
        throw unauthorizedError;
    }

    if (tmp[0] !== config.auth.basic.username || tmp[1] !== config.auth.basic.password) {
        throw unauthorizedError;
    }

    await next();
}

const unauthorizedError = new ApiError("401", "Unauthorized", {httpStatus: 401});

module.exports = middlewares