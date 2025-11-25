export const injectToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (token) {
        req.token = token;
    }
    next();
};
