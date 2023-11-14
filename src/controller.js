const Router = require("koa-router");
const camelCase = require('lodash.camelcase');
const db = require("./db");
const logger = require("./logger");

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
            let count = 0;
            for (const key in query.where) {
                let value = query.where[key];

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

    return controller;
}

module.exports = initController();