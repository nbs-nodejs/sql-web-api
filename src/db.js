const knex = require("knex");
const config = require("./config");

function initDb(db) {
    let option = {
        client: db.driver,
    }

    switch (db.driver) {
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