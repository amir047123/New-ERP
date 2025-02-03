require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Fingerprint Schema and Model
const fingerprintSchema = new mongoose.Schema({
  fingerprint_id: { type: String, required: true, unique: true },
  template: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Fingerprint = mongoose.model("Fingerprint", fingerprintSchema);

// Function to calculate similarity (Hamming Distance)
function calculateSimilarity(template1, template2) {
  const buffer1 = Buffer.from(template1, "base64");
  const buffer2 = Buffer.from(template2, "base64");

  if (buffer1.length !== buffer2.length) return 0;

  let diffCount = 0;
  for (let i = 0; i < buffer1.length; i++) {
    diffCount += (buffer1[i] ^ buffer2[i]).toString(2).split("1").length - 1;
  }

  const totalBits = buffer1.length * 8;
  return ((totalBits - diffCount) / totalBits) * 100;
}

// API: Save Fingerprint (Upsert Logic)
app.post("/api/fingerprint", async (req, res) => {
  try {
    const { fingerprint_id, template } = req.body;

    if (!fingerprint_id || !template) {
      return res
        .status(400)
        .json({ message: "Missing fingerprint ID or template" });
    }

    const updatedFingerprint = await Fingerprint.findOneAndUpdate(
      { fingerprint_id },
      { template, createdAt: Date.now() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      message: "Fingerprint saved successfully",
      data: updatedFingerprint,
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// API: Match Fingerprint
app.post("/api/fingerprint/match", async (req, res) => {
  try {
    const { template } = req.body;

    if (!template) {
      return res
        .status(400)
        .json({ message: "Missing fingerprint template for matching" });
    }

    const fingerprints = await Fingerprint.find();

    let bestMatch = null;
    let highestSimilarity = 0;

    fingerprints.forEach((record) => {
      const similarity = calculateSimilarity(template, record.template);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = record;
      }
    });

    if (highestSimilarity > 85) {
      // Adjust the threshold as needed
      res.status(200).json({
        message: "Fingerprint matched",
        similarity: `${highestSimilarity.toFixed(2)}%`,
        data: bestMatch,
      });
    } else {
      res.status(404).json({
        message: "No matching fingerprint found",
        similarity: `${highestSimilarity.toFixed(2)}%`,
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// API: Get All Fingerprints (For Postman Testing)
app.get("/api/fingerprint", async (req, res) => {
  try {
    const fingerprints = await Fingerprint.find();
    res.status(200).json({
      message: "All fingerprints retrieved successfully",
      count: fingerprints.length,
      data: fingerprints,
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
