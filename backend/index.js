const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const AUTH_TOKEN = process.env.TIMESHEET_AUTH_TOKEN;

const authMiddleware = (req, res, next) => {
  const authHeader =
    req.headers["timesheet-auth"] || req.headers["x-timesheet-auth"];
  const authQuery = req.query.auth;

  console.log("Received headers:", req.headers);
  console.log("Auth header value:", authHeader);
  console.log("Auth query value:", authQuery);

  const authToken = authHeader || authQuery;

  if (!authToken || authToken !== AUTH_TOKEN) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid timesheet-auth header",
      receivedHeaders: Object.keys(req.headers),
      authHeaderValue: authHeader,
      authQueryValue: authQuery,
    });
  }

  next();
};

// Apply auth middleware to all API routes
app.use("/api", authMiddleware);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

// Alternative connection string without appName (sometimes causes issues)
const MONGODB_URI_ALT = MONGODB_URI.replace("&appName=timesheet", "");

const DATABASE_NAME = "timesheet";
const COLLECTIONS = {
  LABELS: "labels",
  SESSIONS: "sessions",
  SETTINGS: "settings",
};

let db = null;

async function connectToMongoDB() {
  try {
    console.log("Attempting to connect to MongoDB...");
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
    console.log("Using URI:", MONGODB_URI.substring(0, 50) + "...");

    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 10000, // 10 seconds
      maxPoolSize: 10,
      retryWrites: true,
      w: "majority",
    });

    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error with primary URI:", error);

    // Try alternative URI
    try {
      console.log("Trying alternative URI...");
      const clientAlt = new MongoClient(MONGODB_URI_ALT, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true,
        w: "majority",
      });

      await clientAlt.connect();
      db = clientAlt.db(DATABASE_NAME);
      console.log("Connected to MongoDB successfully with alternative URI");
    } catch (errorAlt) {
      console.error("MongoDB connection error with alternative URI:", errorAlt);
    }
  }
}

// Initialize MongoDB connection and start server
async function startServer() {
  try {
    await connectToMongoDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`Timesheet API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Timesheet API is running" });
});

// Labels endpoints
app.get("/api/labels", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const collection = db.collection(COLLECTIONS.LABELS);
    const labels = await collection.find({}).toArray();
    res.json(labels.map((label) => label.name));
  } catch (error) {
    console.error("Error getting labels:", error);
    res.status(500).json({ error: "Failed to get labels" });
  }
});

app.post("/api/labels", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Label name is required" });
    }

    const collection = db.collection(COLLECTIONS.LABELS);

    // Check if label already exists
    const existingLabel = await collection.findOne({ name });
    if (existingLabel) {
      return res.status(409).json({ error: "Label already exists" });
    }

    await collection.insertOne({
      name,
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, message: "Label created" });
  } catch (error) {
    console.error("Error creating label:", error);
    res.status(500).json({ error: "Failed to create label" });
  }
});

app.delete("/api/labels/:name", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const { name } = req.params;
    const collection = db.collection(COLLECTIONS.LABELS);

    const result = await collection.deleteOne({ name });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Label not found" });
    }

    res.json({ success: true, message: "Label deleted" });
  } catch (error) {
    console.error("Error deleting label:", error);
    res.status(500).json({ error: "Failed to delete label" });
  }
});

// Sessions endpoints
app.get("/api/sessions", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const collection = db.collection(COLLECTIONS.SESSIONS);
    const sessions = await collection
      .find({})
      .sort({ startTime: -1 })
      .toArray();
    res.json(sessions);
  } catch (error) {
    console.error("Error getting sessions:", error);
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const { label, startTime, id, endTime, duration } = req.body;

    if (!label || !startTime) {
      return res
        .status(400)
        .json({ error: "Label and startTime are required" });
    }

    const collection = db.collection(COLLECTIONS.SESSIONS);
    const sessionData = {
      label,
      startTime,
      id,
      createdAt: new Date(),
    };

    // Add endTime and duration if they exist (for completed sessions)
    if (endTime) {
      sessionData.endTime = endTime;
    }
    if (duration !== undefined) {
      sessionData.duration = duration;
    }

    const result = await collection.insertOne(sessionData);

    res.status(201).json({
      success: true,
      sessionId: result.insertedId,
      session: { ...sessionData, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.put("/api/sessions/:id", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const { id } = req.params;
    const { endTime, duration } = req.body;

    if (!endTime || duration === undefined) {
      return res
        .status(400)
        .json({ error: "endTime and duration are required" });
    }

    const collection = db.collection(COLLECTIONS.SESSIONS);
    const result = await collection.updateOne(
      { _id: new require("mongodb").ObjectId(id) },
      {
        $set: {
          endTime,
          duration,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ success: true, message: "Session updated" });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const { id } = req.params;
    console.log("Delete request received for ID:", id);
    console.log("ID type:", typeof id);

    const collection = db.collection(COLLECTIONS.SESSIONS);

    // First, let's see what sessions exist
    const allSessions = await collection.find({}).toArray();
    console.log(
      "All sessions in DB:",
      allSessions.map((s) => ({ id: s.id, _id: s._id, label: s.label }))
    );

    const result = await collection.deleteOne({
      id: parseInt(id), // Convert to number since our id is a timestamp
    });

    console.log("Delete result:", result);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ success: true, message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// Settings endpoints
app.get("/api/settings", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const collection = db.collection(COLLECTIONS.SETTINGS);
    const settings = await collection.findOne({});
    res.json(settings || {});
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const settings = req.body;
    const collection = db.collection(COLLECTIONS.SETTINGS);

    await collection.updateOne(
      {},
      { $set: { ...settings, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true, message: "Settings saved" });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});
