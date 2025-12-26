// ============================================
// ORBIT BACKEND SERVER
// Node.js + Express + yt-dlp
// ============================================

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;
const execPromise = util.promisify(exec);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(console.error);

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Clean up old files (run every hour)
setInterval(async () => {
  try {
    const files = await fs.readdir(DOWNLOADS_DIR);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtimeMs < oneHourAgo) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Format bytes to human readable
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Format duration to MM:SS
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Orbit Backend',
    timestamp: new Date().toISOString()
  });
});

// Extract video metadata
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`[EXTRACT] Requesting: ${url}`);

  try {
    // Use yt-dlp to get video info without downloading
    // --dump-json returns all metadata as JSON
    const command = `yt-dlp --dump-json --no-warnings "${url}"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 30000 // 30 second timeout
    });

    if (stderr) {
      console.error(`[EXTRACT] Warning: ${stderr}`);
    }

    const data = JSON.parse(stdout);
    
    // Get available formats
    const formats = data.formats || [];
    
    // Filter formats with both video and audio
    const videoFormats = formats.filter(f => 
      f.vcodec !== 'none' && 
      f.acodec !== 'none' &&
      f.ext === 'mp4'
    );
    
    // Get best quality for each resolution
    const get1080p = videoFormats.find(f => f.height === 1080);
    const get720p = videoFormats.find(f => f.height === 720);
    const get480p = videoFormats.find(f => f.height === 480);
    const get360p = videoFormats.find(f => f.height === 360);
    
    // Get audio-only format
    const audioOnly = formats.find(f => 
      f.acodec !== 'none' && 
      f.vcodec === 'none'
    );

    // Build response
    const response = {
      title: data.title,
      thumbnail: data.thumbnail,
      duration: formatDuration(data.duration),
      durationSeconds: data.duration,
      size: formatBytes(data.filesize_approx),
      format: data.ext?.toUpperCase() || 'MP4',
      author: data.uploader || data.channel || 'Unknown',
      platform: data.extractor_key || 'Unknown',
      directLinks: {
        '1080p': get1080p ? get1080p.format_id : null,
        '720p': get720p ? get720p.format_id : null,
        '480p': get480p ? get480p.format_id : null,
        '360p': get360p ? get360p.format_id : null,
        'audio': audioOnly ? audioOnly.format_id : null
      },
      // Store original URL for download endpoint
      originalUrl: url
    };

    console.log(`[EXTRACT] Success: ${data.title}`);
    res.json(response);

  } catch (error) {
    console.error(`[EXTRACT] Error: ${error.message}`);
    
    // More specific error messages
    if (error.message.includes('Unsupported URL')) {
      return res.status(400).json({ 
        error: 'This platform is not supported yet.' 
      });
    }
    
    if (error.message.includes('Video unavailable')) {
      return res.status(404).json({ 
        error: 'Video not found or is private.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to extract video. Please check the URL and try again.',
      details: error.message 
    });
  }
});

// Download video with specific format
app.post('/api/download', async (req, res) => {
  const { url, formatId, muteAudio } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`[DOWNLOAD] Requesting: ${url} | Format: ${formatId} | Mute: ${muteAudio}`);

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const outputTemplate = path.join(DOWNLOADS_DIR, `video_${timestamp}.%(ext)s`);
    
    let command;
    
    if (muteAudio) {
      // Download video without audio
      command = `yt-dlp -f "${formatId}" --no-audio --merge-output-format mp4 "${url}" -o "${outputTemplate}"`;
    } else if (formatId && formatId !== 'best') {
      // Download specific format
      command = `yt-dlp -f "${formatId}" --merge-output-format mp4 "${url}" -o "${outputTemplate}"`;
    } else {
      // Download best quality
      command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 "${url}" -o "${outputTemplate}"`;
    }

    console.log(`[DOWNLOAD] Executing: ${command}`);

    // Execute download with progress
    const { stdout, stderr } = await execPromise(command, {
      timeout: 300000 // 5 minute timeout
    });

    if (stderr) {
      console.error(`[DOWNLOAD] Warning: ${stderr}`);
    }

    // Find the downloaded file
    const files = await fs.readdir(DOWNLOADS_DIR);
    const videoFile = files.find(f => f.startsWith(`video_${timestamp}`));

    if (!videoFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(DOWNLOADS_DIR, videoFile);
    const stats = await fs.stat(filePath);

    console.log(`[DOWNLOAD] Success: ${videoFile} (${formatBytes(stats.size)})`);

    // Send file to client
    res.download(filePath, `orbit_video.mp4`, async (err) => {
      if (err) {
        console.error(`[DOWNLOAD] Send error: ${err}`);
      }
      
      // Delete file after sending (or keep for caching)
      try {
        await fs.unlink(filePath);
        console.log(`[DOWNLOAD] Cleaned up: ${videoFile}`);
      } catch (cleanupError) {
        console.error(`[DOWNLOAD] Cleanup error: ${cleanupError}`);
      }
    });

  } catch (error) {
    console.error(`[DOWNLOAD] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Download failed. Please try again.',
      details: error.message 
    });
  }
});

// Stream video (alternative to download)
app.get('/api/stream/:formatId', async (req, res) => {
  const { formatId } = req.params;
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Get direct stream URL from yt-dlp
    const command = `yt-dlp -f "${formatId}" -g "${url}"`;
    const { stdout } = await execPromise(command);
    const streamUrl = stdout.trim();

    // Redirect to stream URL
    res.redirect(streamUrl);
  } catch (error) {
    console.error(`[STREAM] Error: ${error.message}`);
    res.status(500).json({ error: 'Streaming failed' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/extract',
      'POST /api/download',
      'GET /api/stream/:formatId?url=...'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('🚀 ORBIT BACKEND SERVER RUNNING');
  console.log('==========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`   GET  /health`);
  console.log(`   POST /api/extract`);
  console.log(`   POST /api/download`);
  console.log(`   GET  /api/stream/:formatId`);
  console.log('');
  console.log('📁 Downloads Directory:', DOWNLOADS_DIR);
  console.log('🔄 Auto-cleanup: Every 1 hour');
  console.log('⚡ Rate Limit: 20 requests per 15 minutes');
  console.log('==========================================');
  console.log('');
});