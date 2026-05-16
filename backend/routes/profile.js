const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Admin = require("../models/admin");
const { authMiddleware } = require("../middleware/auth.cjs");

router.use(authMiddleware);

// GET /api/profile — current admin
router.get("/", async (req, res) => {
  try {
    const me = await Admin.findById(req.adminId).select("-password");
    if (!me) return res.status(404).json({ success: false, error: "Admin not found" });
    res.json({ success: true, data: me });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/profile — update name
router.put("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Name is required" });
    const me = await Admin.findByIdAndUpdate(
      req.adminId,
      { name },
      { new: true }
    ).select("-password");
    res.json({ success: true, data: me });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/profile/password — change password
router.put("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "currentPassword and newPassword required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
    }
    const me = await Admin.findById(req.adminId);
    if (!me) return res.status(404).json({ success: false, error: "Admin not found" });
    const ok = await bcrypt.compare(currentPassword, me.password);
    if (!ok) return res.status(401).json({ success: false, error: "Current password is incorrect" });
    me.password = await bcrypt.hash(newPassword, 10);
    await me.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
