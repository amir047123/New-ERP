require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// Middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`📥 Incoming Request: ${req.method} ${req.originalUrl}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  next();
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB error:", err));

// Fingerprint Schema
const fingerprintSchema = new mongoose.Schema({
  fingerprint_id: { type: Number, unique: true },
  template: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Fingerprint = mongoose.model("Fingerprint", fingerprintSchema);

// Hamming Distance Algorithm for Better Accuracy
function calculateHammingDistance(template1, template2) {
  const buffer1 = Buffer.from(template1, "base64");
  const buffer2 = Buffer.from(template2, "base64");

  const minLength = Math.min(buffer1.length, buffer2.length);
  if (minLength === 0) return 0;

  let distance = 0;
  for (let i = 0; i < minLength; i++) {
    const xor = buffer1[i] ^ buffer2[i];
    distance += xor.toString(2).split("1").length - 1; // Count the number of differing bits
  }

  const similarity = 100 - (distance / (minLength * 8)) * 100; // Convert to percentage similarity
  return similarity;
}

// Fingerprint Registration API
app.post("/api/fingerprint", async (req, res) => {
  const { template } = req.body;
  console.log("🔑 Registration API Called");

  if (!template) {
    console.log("❌ Missing template in request");
    return res.status(400).json({ message: "❌ Missing template" });
  }

  try {
    const existingFingerprint = await Fingerprint.findOne({ template });
    if (existingFingerprint) {
      console.log("⚠️ Fingerprint already exists in DB");
      return res.status(409).json({ message: "❌ Fingerprint already exists" });
    }

    const lastFingerprint = await Fingerprint.findOne().sort({
      fingerprint_id: -1,
    });
    const newFingerprintId = lastFingerprint
      ? lastFingerprint.fingerprint_id + 1
      : 1;

    const newFingerprint = new Fingerprint({
      fingerprint_id: newFingerprintId,
      template,
    });
    await newFingerprint.save();

    console.log(`✅ Fingerprint registered with ID: ${newFingerprintId}`);
    res
      .status(201)
      .json({ message: "✅ Fingerprint registered", data: newFingerprint });
  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).json({ message: "❌ Server error during registration" });
  }
});

// Fingerprint Matching API
app.post("/api/fingerprint/match", async (req, res) => {
  const { template } = req.body;
  console.log("🔍 Matching API Called");

  if (!template) {
    console.log("❌ Missing template in request");
    return res.status(400).json({ message: "❌ Missing template" });
  }

  try {
    const fingerprints = await Fingerprint.find();
    let bestMatch = null;
    let highestSimilarity = 0;

    fingerprints.forEach((record) => {
      const similarity = calculateHammingDistance(template, record.template);
      console.log(
        `Comparing with ID: ${record.fingerprint_id}, Similarity: ${similarity}%`
      );

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = record;
      }
    });

    const MATCH_THRESHOLD = 75; // Adjusted threshold for better sensitivity

    console.log(`Best Match Similarity: ${highestSimilarity}%`);

    if (highestSimilarity >= MATCH_THRESHOLD) {
      res.status(200).json({
        message: "✅ Match found",
        similarity: `${highestSimilarity.toFixed(2)}%`,
        confidence: highestSimilarity >= 90 ? "High" : "Moderate",
        data: bestMatch,
      });
    } else {
      res.status(404).json({
        message: "❌ No match",
        similarity: `${highestSimilarity.toFixed(2)}%`,
        closestMatch: bestMatch ? bestMatch.fingerprint_id : "None",
      });
    }
  } catch (error) {
    console.error("❌ Matching Error:", error);
    res.status(500).json({ message: "❌ Server error during matching" });
  }
});

// New API to Get All Fingerprints
app.get("/api/fingerprint/all", async (req, res) => {
  try {
    const fingerprints = await Fingerprint.find();
    res
      .status(200)
      .json({ message: "✅ All fingerprints fetched", data: fingerprints });
  } catch (error) {
    console.error("❌ Error fetching fingerprints:", error);
    res
      .status(500)
      .json({ message: "❌ Server error while fetching fingerprints" });
  }
});

// New API to Decode Base64 Template
app.get("/api/fingerprint/decode/:fingerprint_id", async (req, res) => {
  const { fingerprint_id } = req.params;
  console.log(`🔍 Decoding API Called for ID: ${fingerprint_id}`);

  try {
    const fingerprint = await Fingerprint.findOne({ fingerprint_id });
    if (!fingerprint) {
      console.log("❌ Fingerprint not found");
      return res.status(404).json({ message: "❌ Fingerprint not found" });
    }

    const decodedTemplate = Buffer.from(
      fingerprint.template,
      "base64"
    ).toString("hex");

    console.log("✅ Template decoded successfully");
    res.status(200).json({
      message: "✅ Template decoded successfully",
      fingerprint_id: fingerprint.fingerprint_id,
      decoded_template: decodedTemplate,
    });
  } catch (error) {
    console.error("❌ Decoding Error:", error);
    res.status(500).json({ message: "❌ Server error during decoding" });
  }
});

// API to Check the Status of Registration and Matching APIs
app.get("/api/fingerprint/status", async (req, res) => {
  try {
    const registrationStatus = "🟢 Registration API is live";
    const matchingStatus = "🟢 Matching API is live";

    res.status(200).json({
      message: "✅ API Status Check",
      registrationStatus,
      matchingStatus,
    });
  } catch (error) {
    console.error("❌ Error checking API status:", error);
    res.status(500).json({ message: "❌ Server error during status check" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
