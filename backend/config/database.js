const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_loan_automation', {
            // These options are no longer needed in Mongoose 6+
            // but keeping them for compatibility
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Don't exit process, just log the error
        // process.exit(1);
    }
};

module.exports = connectDB;