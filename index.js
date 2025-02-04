require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

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

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  fingerprint_id: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

// Hamming Distance Algorithm
function calculateHammingDistance(template1, template2) {
  const buffer1 = Buffer.from(template1, "base64");
  const buffer2 = Buffer.from(template2, "base64");

  const minLength = Math.min(buffer1.length, buffer2.length);
  if (minLength === 0) return 0;

  let matchingBits = 0;
  let totalBits = minLength * 8;

  for (let i = 0; i < minLength; i++) {
    const byte1 = buffer1[i];
    const byte2 = buffer2[i];

    // Count the number of matching bits (similar to Python's bitwise comparison)
    const xor = byte1 ^ byte2;
    const invertedXor = ~xor & 0xff; // Invert XOR to count matching bits (8-bit mask)

    matchingBits += invertedXor.toString(2).split("1").length - 1;
  }

  const similarity = (matchingBits / totalBits) * 100; // Percentage of matching bits
  return similarity;
}

// Fingerprint Registration API
app.post("/api/fingerprint", async (req, res) => {
  const { template } = req.body;
  console.log("🔑 Registration API Called");

  if (!template) {
    return res.status(400).json({ message: "❌ Missing template" });
  }

  try {
    const existingFingerprint = await Fingerprint.findOne({ template });
    if (existingFingerprint) {
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

    res
      .status(201)
      .json({ message: "✅ Fingerprint registered", data: newFingerprint });
  } catch (error) {
    res.status(500).json({ message: "❌ Server error during registration" });
  }
});

// Attendance API
app.post("/api/fingerprint/attendance", async (req, res) => {
  const { template } = req.body;

  if (!template) {
    return res.status(400).json({ message: "❌ Missing template" });
  }

  try {
    const fingerprints = await Fingerprint.find();
    let bestMatch = null;
    let highestSimilarity = 0;

    fingerprints.forEach((record) => {
      const similarity = calculateHammingDistance(template, record.template);

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = record;
      }
    });

    const MATCH_THRESHOLD = 75;

    if (highestSimilarity >= MATCH_THRESHOLD) {
      const attendance = new Attendance({
        fingerprint_id: bestMatch.fingerprint_id,
      });
      await attendance.save();

      res.status(200).json({
        message: "✅ Attendance marked",
        similarity: `${highestSimilarity.toFixed(2)}%`,
        data: bestMatch,
      });
    } else {
      res.status(404).json({
        message: "❌ No match",
        similarity: `${highestSimilarity.toFixed(2)}%`,
      });
    }
  } catch (error) {
    res.status(500).json({ message: "❌ Server error during attendance" });
  }
});

// Get All Fingerprints API
app.get("/api/fingerprint/all", async (req, res) => {
  try {
    const fingerprints = await Fingerprint.find();
    res
      .status(200)
      .json({ message: "✅ All fingerprints fetched", data: fingerprints });
  } catch (error) {
    res
      .status(500)
      .json({ message: "❌ Server error while fetching fingerprints" });
  }
});

// Decode Fingerprint Template API
app.get("/api/fingerprint/decode/:fingerprint_id", async (req, res) => {
  const { fingerprint_id } = req.params;

  try {
    const fingerprint = await Fingerprint.findOne({ fingerprint_id });
    if (!fingerprint) {
      return res.status(404).json({ message: "❌ Fingerprint not found" });
    }

    const decodedTemplate = Buffer.from(
      fingerprint.template,
      "base64"
    ).toString("hex");

    res.status(200).json({
      message: "✅ Template decoded successfully",
      fingerprint_id: fingerprint.fingerprint_id,
      decoded_template: decodedTemplate,
    });
  } catch (error) {
    res.status(500).json({ message: "❌ Server error during decoding" });
  }
});

// API Status Check
app.get("/api/fingerprint/status", (req, res) => {
  try {
    res.status(200).json({
      message: "✅ API Status Check",
      registrationStatus: "🟢 Registration API is live",
      matchingStatus: "🟢 Matching API is live",
    });
  } catch (error) {
    res.status(500).json({ message: "❌ Server error during status check" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
