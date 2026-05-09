const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.js");

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

        // Find admin by id
        const admin = await Admin.findById(decoded.id);

        if (!admin) {
            return res.status(401).json({
                success: false,
                error: "Admin not found, token invalid"
            });
        }

        // Attach admin to request
        req.admin = admin;
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

module.exports = authMiddleware;