const knex = require("knex");
const config = require("./config");

function initDb(db) {
    let option = {
        client: db.driver,
    }

    switch (db.driver) {
        case "postgres": {
            option.client = "pg"
            option.connection = `postgresql://${db.user}:${db.pass}@${db.host}:${db.port}/${db.name}?useSSL=${db.sslMode}`
            if (db.postgres.searchPath) {
                option.searchPath = db.postgres.searchPath.split(",")
            }
            break
        }
        case "sqlite3":
        case "better-sqlite3": {
            option.connection = {
                filename: db.sqlite.filename || ":memory:"
            }
            break
        }
        default: {
            throw new Error(`Unsupported db driver. Driver=${db.driver}`);
        }
    }

    return new knex(option);
}

module.exports = initDb(config.db);