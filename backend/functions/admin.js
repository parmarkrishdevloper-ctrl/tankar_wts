const Admin = require("../models/admin.js");

const createAdmin = async (req, res) => {
    try {
        const { name, password } = req.body;
        const admin = await Admin.create({ name, password });
        res.status(201).json({ success: true, data: admin });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

const loginAdmin = async (req, res) => {
    try {
        const { name, password } = req.body;
        const admin = await Admin.findOne({ name });
        if (!admin) {
            return res.status(404).json({ success: false, error: "Admin not found" });
        }
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: "Invalid password" });
        }
        const token = admin.generateToken();
        res.status(200).json({ success: true, data: admin, token });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}


module.exports = {
    createAdmin,
    loginAdmin
}