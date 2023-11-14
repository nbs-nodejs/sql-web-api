class ApiError extends Error {
    constructor(code, message, options) {
        super(message);
        this.code = code;
        this.options = options;
    }
}

module.exports = ApiError;