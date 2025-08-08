const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const app = express();

const PORT = process.env.PORT || 5000;

console.log("🔄 Starting Whisspra Backend...");
console.log("✅ NODE_ENV:", process.env.NODE_ENV);
console.log("✅ PORT:", PORT);
console.log("✅ JWT_SECRET:", process.env.JWT_SECRET ? "✔️ Present" : "❌ Missing");
console.log("✅ API_KEY:", process.env.API_KEY ? "✔️ Present" : "❌ Missing");
console.log("✅ MONGO_URI:", process.env.MONGO_URI ? "✔️ Present" : "❌ Missing");

// ✅ Root route to fix Render 404 issue
app.get("/", (req, res) => {
  res.send("✅ Whisspra Backend API is running!");
});

try {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ Connected to MongoDB");
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      process.exit(1); // Exit process if DB connection fails
    });
} catch (error) {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
}
