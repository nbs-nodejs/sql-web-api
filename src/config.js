const config = {
    debug: process.env.DEBUG === "true",
    port: process.env.PORT || "3000",
    auth: {
        basic: {
            username: process.env.AUTH_BASIC_USERNAME,
            password: process.env.AUTH_BASIC_PASSWORD,
        }
    },
    db: {
        driver: process.env.DB_DRIVER,
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        sqlite: {
            filename: process.env.DB_SQLITE_FILENAME
        },
    }
}

module.exports = config;