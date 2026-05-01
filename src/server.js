// Divinely Backend — Phase 3 Server
// Data Ingestion Pipeline Entry Point

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./routes/upload');
const profileRoutes = require('./routes/profile');
const voiceRoutes = require('./routes/voice');
const whatsappRoutes = require("./routes/whatsapp");
const videoRoutes = require("./routes/video");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Divinely Backend',
    phase: 3,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/upload', uploadRoutes);
app.use('/api/profile', profileRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/video", videoRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// ── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Divinely Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    phase: 3,
  });
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✨ Divinely Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Phase 3: Data Ingestion Pipeline ACTIVE\n`);
});

module.exports = app;
