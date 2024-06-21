const Router = require("koa-router");
const camelCase = require('lodash.camelcase');
const db = require("./db");
const logger = require("./logger");
const ApiError = require("./api-error");

/**
 * @return {module:koa-router|Router}
 */
function initController() {
    // Init controller
    const controller = new Router();

    // Find by PK
    controller.get("/v1/:tableName/:id", async (ctx, _) => {
        const {tableName, id} = ctx.params;

        const rows = await db(tableName).where("id", id).select();

        let row = null;
        if (rows.length > 0) {
            row = rows[0];
        }

        ctx.status = 200;
        ctx.data = row;
    })

    // Find All
    controller.get("/v1/:tableName", async (ctx, _) => {
        const {tableName} = ctx.params;

        // Build query
        let {query} = ctx;
        if (!query) {
            query = {}
        }

        let qb = db(tableName);
        if (query.limit) {
            qb = qb.limit(query.limit);
        }
        if (query.skip) {
            qb = qb.offset(query.skip);
        }

        if (query.where) {
            buildWhere(qb, query.where);
        }

        if (query.orderBy) {
            if (typeof query.orderBy === "string") {
                const tmp = query.orderBy.split(" ");
                if (tmp.length === 2) {
                    if (["asc", "desc"].includes(tmp[1].toLowerCase())) {
                        qb = qb.orderBy(tmp[0], tmp[1]);
                    } else {
                        qb = qb.orderBy(tmp[0]);
                    }
                } else {
                    qb = qb.orderBy(query.orderBy);
                }
            } else if (Array.isArray(query.orderBy)) {
                query.orderBy = query.orderBy.reduce((result, column) => {
                    if (typeof column !== "string") {
                        return result;
                    }

                    const tmp = column.split(" ");
                    if (tmp.length === 1) {
                        result.push(tmp[0]);
                        return result;
                    }

                    if (!["asc", "desc"].includes(tmp[1].toLowerCase())) {
                        result.push(tmp[0]);
                        return result;
                    }

                    result.push({column: tmp[0], order: tmp[1]});
                    return result;
                }, [])

                qb = qb.orderBy(query.orderBy);
            }
        }

        // Execute query
        logger.debug(`Select Query=${qb.select().toString()}`)
        const rows = await qb.select();

        ctx.status = 200;
        ctx.data = rows;
    })

    // Insert
    controller.post("/v1/:tableName", async (ctx, _) => {
        const {tableName} = ctx.params;
        const data = ctx.request.body;

        const result = await db(tableName).returning("id").insert(data);
        data.id = result[0].id;

        ctx.status = 200;
        ctx.data = data;
    })

    // Delete
    controller.delete("/v1/:tableName/:id", async (ctx, _) => {
        const {tableName, id} = ctx.params;
        await db(tableName).where("id", id).del();

        ctx.status = 200
    })

    // Update by ID
    controller.put("/v1/:tableName/:id", async (ctx, _) => {
        const {tableName, id} = ctx.params;
        const data = ctx.request.body;

        const result = await db(tableName).where("id", id).update(data);

        ctx.status = 200;
        ctx.data = data;
    })

    // Update by query
    controller.put("/v1/:tableName", async (ctx, _) => {
        const {tableName} = ctx.params;
        const data = ctx.request.body;

        // Validate where params
        const {query} = ctx;
        if (!query.where) {
            throw new ApiError("400", "Query where is required", {httpStatus: 400});
        }

        // Build where query
        let qb = db(tableName);
        const countWhere = buildWhere(qb, query.where);
        if (countWhere === 0) {
            throw new ApiError("400", "Query where is required", {httpStatus: 400});
        }
        let result = await qb.update(data);

        // If row is updated or insert flag is not set
        if (!result && query.insert) {
            // Set data from exact query
            setDataFromCondition(data, query.where);
            logger.debug(`Setting data from where condition. Data=${JSON.stringify(data)}`)
            // Insert data
            result = await db(tableName).returning("id").insert(data);
            data.id = result[0].id;
            logger.debug(`Success insert data. id=${data.id}`)
        } else if (!query.insert) {
            throw new ApiError("400", "Data not found", {httpStatus: 400})
        } else {
            logger.debug(`Success update data.`)
        }

        ctx.status = 200;
        ctx.data = data;
    })

    return controller;
}

function setDataFromCondition(data, conditions) {
    for (const key in conditions) {
        let value = conditions[key];

        // Check if condition using where
        switch (typeof value) {
            case "string":
            case "number":
            case "bigint":
            case "boolean": {
                data[key] = value;
                break;
            }
        }
    }
}

function buildWhere(qb, conditions) {
    if (typeof conditions !== "object" || Array.isArray(conditions)) {
        throw new ApiError("400", "query where must be an object", {httpStatus: 400});
    }

    let count = 0;
    for (const key in conditions) {
        let value = conditions[key];

        // Check if value is type, then use equal operator
        switch (typeof value) {
            case "string":
            case "number":
            case "bigint":
            case "boolean": {
                count++;

                if (count === 1) {
                    qb.where(key, value);
                    continue;
                }

                qb.andWhere(key, value);
                continue;
            }
            case "object": {
                // Do nothing
                break;
            }
            default: {
                continue;
            }
        }

        // If value is an array, then skip
        if (Array.isArray(value)) {
            continue;
        }

        // If Object does not contain any key, then skip
        const vKeys = Object.keys(value);
        if (vKeys.length === 0) {
            continue;
        }

        // If value of clause is not a string, then skip
        let clause = vKeys[0];
        switch (clause) {
            case "isNull": {
                count++;
                qb = qb.whereNull(key);
                continue;
            }
            case "isNotNull": {
                count++;
                if (count === 1) {
                    qb = qb.whereNot(key, null);
                } else {
                    qb = qb.andWhereNot(key, null);
                }
                continue;
            }
        }

        let op;
        switch (clause) {
            case "gt": {
                op = ">";
                break;
            }
            case "gte": {
                op = ">=";
                break;
            }
            case "lt": {
                op = "<";
                break;
            }
            case "lte": {
                op = "<=";
                break;
            }
        }

        if (op) {
            value = value[clause];
            count++;
            if (count === 1) {
                qb = qb.where(key, op, value);
            } else {
                qb = qb.andWhere(key, op, value);
            }
            continue;
        }

        // TODO: Check if grouped where clause

        value = value[clause];
        if (typeof value !== "string") {
            continue;
        }

        switch (clause) {
            case "not":
            case "like":
            case "iLike":
            case "exists":
            case "notExists": {
                clause = camelCase("where-" + clause);
                if (value === "null") {
                    value = null;
                }
                break;
            }
            case "in": {
                clause = "whereIn";
                value = value.split(",");
                break;
            }
            case "notIn": {
                clause = "whereNotIn";
                value = value.split(",");
                break;
            }
            case "between": {
                clause = "whereBetween";
                value = value.split(",", 2)
                if (value.length !== 2) {
                    continue;
                }
                break;
            }
            case "notBetween": {
                clause = "whereNotBetween";
                value = value.split(",", 2)
                if (value.length !== 2) {
                    continue;
                }
                break;
            }
            default: {
                continue;
            }
        }

        count++;
        if (count > 1) {
            clause = camelCase("and-" + clause);
        }
        qb = qb[clause](key, value);
    }

    return count;
}

module.exports = initController();