/**
 * HICONIQUE Internal Hub — Node.js server
 * Serves the static portal. Production-ready for Vercel & Hostinger.
 */
require('dotenv').config();

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security headers — tuned for an internal portal (no CDN script execution).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google Fonts is whitelisted for typography.
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        // Google Fonts CSS + Notion/Sheets iframes (added on each route).
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        // Notion embeds + Google Sheets iframe integration.
        frameSrc: ['https://notion.so', 'https://www.notion.so', 'https://docs.google.com'],
        connectSrc: ["'self'", 'https://sheets.googleapis.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Compression + logging.
app.use(compression());
if (NODE_ENV !== 'test') {
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static files — public/ is the only folder served.
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Health probe for Vercel / Hostinger.
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok', service: 'hiconique-internal-hub' }));

// Fallback to index.html for SPA-like routes.
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`HICONIQUE Internal Hub listening on port ${PORT} (${NODE_ENV})`);
});

module.exports = app;
