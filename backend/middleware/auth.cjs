const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "No authentication token, access denied"
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Note: We're not checking admin existence in DB for performance
        // The token itself is proof of authentication
        // Attach admin id to request
        req.adminId = decoded.id;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                error: "Invalid token"
            });
        }
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                error: "Token expired"
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = { authMiddleware };