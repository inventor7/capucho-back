const express = require('express');
const https = require('https');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const semver = require('semver');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Path to your certificate files in the same directory as your app file
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
};

const app = express();
const port = process.env.PORT || 3000;

// Logging middleware to track all requests
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log incoming request
  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    query: req.query,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && typeof req.body === 'object') ? req.body : undefined
  });

  // Capture the original end method to log all responses (including non-send responses)
  const originalEnd = res.end;
  res.end = function (chunk, encoding, callback) {
    const duration = Date.now() - startTime;
    console.log(`[RESPONSE] ${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      status: res.statusCode,
      data: chunk ? (typeof chunk === 'string' ? chunk.substring(0, 200) + (chunk.length > 200 ? '...' : '') : '[BINARY DATA]') : undefined
    });
    originalEnd.call(this, chunk, encoding, callback);
  };

  next();
});

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dubnvfvlaiqzbimgaqvp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Ym52ZnZsYWlxemJpbWdhcXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MzA0MzAsImV4cCI6MjA3NTEwNjQzMH0.SbQ3dNb7gazStIcmsiLAGswiIOVRC2IaY2Irs6P20Aw';
const BUCKET_NAME = process.env.BUCKET_NAME || 'updates';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Create Supabase client with service role key for storage operations (if available)
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Ym52ZnZsYWlxemJpbWdhcXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUzMDQzMCwiZXhwIjoyMDc1MTA2NDMwfQ.AhH-PsZEmmvtXN93hlCP7tHpRER_oftbOG8R7ROkLa8"; // fallback to anon key if service key not provided
const supabaseStorage = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Security middleware with relaxed CSP for file uploads
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory (for local testing)
app.use('/bundles', express.static(path.join(__dirname, 'uploads')));

// File upload configuration with increased limits
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bundle-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Helper function to calculate SHA256 checksum
function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Middleware to validate required parameters
function validateUpdateParams(req, res, next) {
  const { platform, version, appId } = req.body;  // Changed from req.query to req.body

  if (!platform || !version || !appId) {
    return res.status(400).json({
      error: 'Missing required parameters: platform, version, appId'
    });
  }

  if (!['android', 'ios', 'web'].includes(platform)) {
    return res.status(400).json({
      error: 'Invalid platform. Must be: android, ios, web'
    });
  }

  if (!semver.valid(version)) {
    return res.status(400).json({
      error: 'Invalid version format. Must be semantic version (e.g., 1.2.3)'
    });
  }

  next();
}

// API endpoint: Check for updates
app.post('/api/update', validateUpdateParams, async (req, res) => {
  try {
    const {
      platform,
      version,
      channel = 'stable',
      deviceId,
      appId
    } = req.body;  // Changed from req.query to req.body

    // Query for newer versions from Supabase
    const { data, error } = await supabase
      .from('updates')
      .select('version, download_url, checksum, session_key')
      .eq('platform', platform)
      .eq('environment', process.env.ENVIRONMENT || 'prod')
      .eq('channel', channel)
      .eq('active', true)
      .gt('version', version)
      .order('version', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);

      // Handle specific errors
      if (error.code === '42P01') { // Table doesn't exist
        return res.status(500).json({
          error: 'Database table not found. Please run the supabase-setup.sql script.',
          details: error.message
        });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }

    if (data && data.length > 0) {
      const latestUpdate = data[0];

      // Log the update check for analytics
      if (deviceId) {
        await supabase
          .from('update_logs')
          .insert([
            {
              device_id: deviceId,
              app_id: appId,
              current_version: version,
              new_version: latestUpdate.version,
              platform: platform,
              timestamp: new Date().toISOString()
            }
          ]);
      }

      res.json({
        version: latestUpdate.version,
        url: latestUpdate.download_url,
        checksum: latestUpdate.checksum,
        sessionKey: latestUpdate.session_key || undefined
      });
    } else {
      // No update available
      res.json({});
    }
  } catch (error) {
    console.error('Update check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint: Update statistics
app.post('/api/stats', async (req, res) => {
  try {
    const { bundleId, status, deviceId, appId, platform } = req.body;

    if (!bundleId || !status || !deviceId || !appId || !platform) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const { error } = await supabase
      .from('update_stats')
      .insert([
        {
          bundle_id: bundleId,
          status: status,
          device_id: deviceId,
          app_id: appId,
          platform: platform,
          timestamp: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Stats error:', error);
      return res.status(500).json({ error: 'Failed to log stats' });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to log stats' });
  }
});

// API endpoint: Channel management
app.post('/api/channel_self', async (req, res) => {
  try {
    const { channel, deviceId, appId, platform } = req.body;

    if (!channel || !deviceId || !appId || !platform) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if device already has a channel assignment
    const { data, error: selectError } = await supabase
      .from('device_channels')
      .select('*')
      .eq('app_id', appId)
      .eq('device_id', deviceId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Channel selection error:', selectError);
      return res.status(500).json({ error: 'Failed to assign channel' });
    }

    if (data) {
      // Update existing assignment
      const { error: updateError } = await supabase
        .from('device_channels')
        .update({
          channel: channel,
          platform: platform,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('Channel update error:', updateError);
        return res.status(500).json({ error: 'Failed to assign channel' });
      }
    } else {
      // Create new assignment
      const { error: insertError } = await supabase
        .from('device_channels')
        .insert([
          {
            app_id: appId,
            device_id: deviceId,
            channel: channel,
            platform: platform,
            updated_at: new Date().toISOString()
          }
        ]);

      if (insertError) {
        console.error('Channel insert error:', insertError);
        return res.status(500).json({ error: 'Failed to assign channel' });
      }
    }

    res.json({
      status: 'success',
      message: `Assigned to channel: ${channel}`
    });
  } catch (error) {
    console.error('Channel assignment error:', error);
    res.status(500).json({ error: 'Failed to assign channel' });
  }
});

// API endpoint: Get channel for a device
app.get('/api/channel', async (req, res) => {
  try {
    const { deviceId, appId, platform } = req.query;

    if (!deviceId || !appId || !platform) {
      return res.status(400).json({ error: 'Missing required parameters: deviceId, appId, platform' });
    }

    // Get the channel assignment for the device
    const { data, error } = await supabase
      .from('device_channels')
      .select('channel')
      .eq('app_id', appId)
      .eq('device_id', deviceId)
      .eq('platform', platform)
      .single();

    if (error) {
      console.error('Channel retrieval error:', error);
      if (error.code === 'PGRST116') { // Row not found
        return res.status(200).json({ channel: 'stable' }); // Default channel
      }
      return res.status(500).json({ error: 'Failed to retrieve channel' });
    }

    res.json({
      channel: data?.channel || 'stable'
    });
  } catch (error) {
    console.error('Channel retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve channel' });
  }
});

// API endpoint: Get all available channels for an app
app.get('/api/channels', async (req, res) => {
  try {
    const { appId, platform } = req.query;

    if (!appId || !platform) {
      return res.status(400).json({ error: 'Missing required parameters: appId, platform' });
    }

    // Get all unique channels for the app
    const { data, error } = await supabase
      .from('updates')
      .select('channel', { count: 'exact' })
      .eq('app_id', appId)
      .eq('platform', platform)
      .eq('active', true)
      .order('channel', { ascending: true });

    if (error) {
      console.error('Channels retrieval error:', error);
      return res.status(500).json({ error: 'Failed to retrieve channels' });
    }

    // Extract unique channel names
    const uniqueChannels = [...new Set((data || []).map(item => item.channel))];

    res.json({
      channels: uniqueChannels
    });
  } catch (error) {
    console.error('Channels retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve channels' });
  }
});

// Admin endpoint: Upload new update
app.post('/api/admin/upload', upload.single('bundle'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      body: req.body,
      file: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      } : null
    });

    const {
      version,
      platform,
      channel = 'stable',
      environment = process.env.ENVIRONMENT || 'prod',
      required = false
    } = req.body;

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No bundle file uploaded' });
    }

    // Validate parameters
    if (!version || !platform || !semver.valid(version)) {
      console.log('Invalid parameters:', { version, platform });
      return res.status(400).json({
        error: 'Missing or invalid parameters: version, platform (semver required)'
      });
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      console.log('Invalid platform:', platform);
      return res.status(400).json({
        error: 'Invalid platform. Must be: android, ios, web'
      });
    }

    // Calculate checksum
    const buffer = fs.readFileSync(req.file.path);
    const checksum = calculateSHA256(buffer);
    console.log('File checksum calculated:', checksum);

    // Upload file to Supabase Storage
    const fileName = `bundle-${platform}-${version}-${Date.now()}${path.extname(req.file.originalname)}`;
    console.log('Uploading to Supabase Storage:', fileName);

    const { data: uploadData, error: uploadError } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      // Try to get more details about the error
      if (uploadError.message.includes('new row violates row-level security policy')) {
        return res.status(403).json({
          error: 'Storage permission denied. Please ensure your Supabase Storage bucket allows uploads. Use service role key for storage operations.',
          details: uploadError.message
        });
      }
      return res.status(500).json({
        error: 'Failed to upload bundle to storage',
        details: uploadError.message
      });
    }

    console.log('File uploaded to Supabase Storage:', uploadData);

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabaseStorage.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const downloadUrl = publicUrlData.publicUrl;
    console.log('Generated public URL:', downloadUrl);

    // Insert update record into database
    const updateRecord = {
      platform: platform,
      version: version,
      download_url: downloadUrl,
      checksum: checksum,
      channel: channel,
      environment: environment,
      required: required === 'true' || required === true,
      active: true,
      created_by: req.user?.email || 'system'
    };

    console.log('Inserting update record:', updateRecord);

    const { error: insertError } = await supabase
      .from('updates')
      .insert([updateRecord]);

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({
        error: 'Failed to save update record',
        details: insertError.message
      });
    }

    console.log('Upload completed successfully');
    res.json({
      success: true,
      message: `Version ${version} uploaded successfully`,
      downloadUrl: downloadUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Endpoint to serve the admin interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-csp-compliant.html'));
});

// API endpoint: Get current bundle info (needed for CapacitorUpdater.getBuiltinVersion, etc.)
app.get('/api/builtin', validateUpdateParams, async (req, res) => {
  try {
    const { platform, appId, version } = req.query;

    // For builtin version, return the current version information
    res.json({
      version: version,
      native: true,
      // Additional metadata if needed
      channel: 'builtin',
      platform: platform,
      app_id: appId
    });
  } catch (error) {
    console.error('Builtin version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint: Update download complete notification
app.post('/api/downloaded', async (req, res) => {
  try {
    const { bundleId, deviceId, appId, platform, version } = req.body;

    if (!bundleId || !deviceId || !appId || !platform || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Log the download completion for analytics
    const { error } = await supabase
      .from('update_stats')
      .insert([
        {
          bundle_id: bundleId,
          status: 'downloaded',
          device_id: deviceId,
          app_id: appId,
          platform: platform,
          timestamp: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Download notification error:', error);
      return res.status(500).json({ error: 'Failed to log download' });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Download notification error:', error);
    res.status(500).json({ error: 'Failed to log download' });
  }
});

// API endpoint: Update applied notification
app.post('/api/applied', async (req, res) => {
  try {
    const { bundleId, deviceId, appId, platform, version } = req.body;

    if (!bundleId || !deviceId || !appId || !platform || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Log the update application for analytics
    const { error } = await supabase
      .from('update_stats')
      .insert([
        {
          bundle_id: bundleId,
          status: 'installed',
          device_id: deviceId,
          app_id: appId,
          platform: platform,
          timestamp: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Applied notification error:', error);
      return res.status(500).json({ error: 'Failed to log applied update' });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Applied notification error:', error);
    res.status(500).json({ error: 'Failed to log applied update' });
  }
});

// API endpoint: Update failed notification
app.post('/api/failed', async (req, res) => {
  try {
    const { bundleId, deviceId, appId, platform, version, error: errorMessage } = req.body;

    if (!bundleId || !deviceId || !appId || !platform || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Log the update failure for analytics
    const { error } = await supabase
      .from('update_stats')
      .insert([
        {
          bundle_id: bundleId,
          status: 'failed',
          device_id: deviceId,
          app_id: appId,
          platform: platform,
          timestamp: new Date().toISOString(),
          details: errorMessage
        }
      ]);

    if (error) {
      console.error('Failed notification error:', error);
      return res.status(500).json({ error: 'Failed to log failed update' });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Failed notification error:', error);
    res.status(500).json({ error: 'Failed to log failed update' });
  }
});

// API endpoint: Get all available updates for an app
app.get('/api/updates', validateUpdateParams, async (req, res) => {
  try {
    const { platform, appId, channel = 'stable', environment = process.env.ENVIRONMENT || 'prod' } = req.query;

    // Query for all available versions from Supabase
    const { data, error } = await supabase
      .from('updates')
      .select('version, download_url, checksum, session_key, channel, environment, required, active, created_at')
      .eq('platform', platform)
      .eq('environment', environment)
      .eq('channel', channel)
      .eq('active', true)
      .gt('version', '0.0.0') // Get all versions
      .order('version', { ascending: false });

    if (error) {
      console.error('Supabase updates query error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      updates: data || []
    });
  } catch (error) {
    console.error('Updates query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint: Health check for the update service
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('updates')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Health check database error:', error);
      return res.status(503).json({
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      status: 'healthy',
      message: 'Update service is running',
      timestamp: new Date().toISOString(),
      supabase: 'connected',
      storage: 'configured'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== ADMIN DASHBOARD API ENDPOINTS =====

// API endpoint: Get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Get total bundles count
    const { count: totalBundles, error: bundlesError } = await supabase
      .from('updates')
      .select('*', { count: 'exact', head: true });

    if (bundlesError) throw bundlesError;

    // Get active devices count (unique device_ids)
    const { data: devicesData, error: devicesError } = await supabase
      .from('device_channels')
      .select('device_id');

    if (devicesError) throw devicesError;

    const activeDevices = new Set(devicesData.map(d => d.device_id)).size;

    // Get active channels count (unique channels)
    const { data: channelsData, error: channelsError } = await supabase
      .from('updates')
      .select('channel');

    if (channelsError) throw channelsError;

    const activeChannels = new Set(channelsData.map(c => c.channel)).size;

    // Get total downloads (downloaded stats)
    const { count: totalDownloads, error: downloadsError } = await supabase
      .from('update_stats')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'downloaded');

    if (downloadsError) throw downloadsError;

    res.json({
      totalBundles,
      activeDevices,
      activeChannels,
      totalDownloads
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// API endpoint: Get all bundles for the bundles page
app.get('/api/dashboard/bundles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Bundles fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

// API endpoint: Get all channels for the channels page
app.get('/api/dashboard/channels', async (req, res) => {
  try {
    // Get all unique channels with their details
    const { data: updatesData, error: updatesError } = await supabase
      .from('updates')
      .select('channel, platform, environment, created_at');

    if (updatesError) throw updatesError;

    // Get all device channels and group manually
    const { data: allChannels, error: allChannelsError } = await supabase
      .from('device_channels')
      .select('channel');

    // Manual grouping for device counts
    const channelCounts = {};
    if (!allChannelsError && allChannels) {
      allChannels.forEach(item => {
        channelCounts[item.channel] = (channelCounts[item.channel] || 0) + 1;
      });
    }

    // Create a map of channels with aggregated data
    const channelMap = {};

    // Process updates to get channel details
    updatesData.forEach(update => {
      if (!channelMap[update.channel]) {
        channelMap[update.channel] = {
          id: update.channel,
          name: update.channel.charAt(0).toUpperCase() + update.channel.slice(1),
          platforms: new Set(),
          environments: new Set(),
          created_at: update.created_at,
          device_count: 0
        };
      }

      channelMap[update.channel].platforms.add(update.platform);
      channelMap[update.channel].environments.add(update.environment);
      if (new Date(update.created_at) > new Date(channelMap[update.channel].created_at)) {
        channelMap[update.channel].created_at = update.created_at;
      }
    });

    // Add device counts
    Object.entries(channelCounts).forEach(([channel, count]) => {
      if (channelMap[channel]) {
        channelMap[channel].device_count = parseInt(count) || 0;
      }
    });

    // Convert to array format
    const channels = Object.values(channelMap).map(channel => ({
      id: channel.id,
      name: channel.name,
      platforms: Array.from(channel.platforms),
      environments: Array.from(channel.environments),
      created_at: channel.created_at,
      device_count: channel.device_count
    }));

    res.json(channels);
  } catch (error) {
    console.error('Channels fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// API endpoint: Get all devices for the devices page
app.get('/api/dashboard/devices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('device_channels')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Process data to match expected format
    const devices = data.map(device => ({
      id: device.id,
      device_id: device.device_id,
      app_id: device.app_id,
      platform: device.platform,
      channel: device.channel,
      updated_at: device.updated_at,
      last_version: 'Unknown' // This would need to be fetched from a separate query or stored in device_channels
    }));

    res.json(devices);
  } catch (error) {
    console.error('Devices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// API endpoint: Get statistics for the stats page
app.get('/api/dashboard/stats-data', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('update_stats')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100); // Limit to last 100 records for performance

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Stats data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics data' });
  }
});

// API endpoint: Create a new bundle
app.post('/api/dashboard/bundles', async (req, res) => {
  try {
    const {
      platform,
      version,
      download_url,
      checksum,
      session_key,
      channel,
      environment,
      required,
      active
    } = req.body;

    const { data, error } = await supabase
      .from('updates')
      .insert([{
        platform,
        version,
        download_url,
        checksum,
        session_key,
        channel,
        environment,
        required,
        active,
        created_by: 'admin',
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Bundle creation error:', error);
    res.status(500).json({ error: 'Failed to create bundle' });
  }
});

// API endpoint: Update a bundle
app.put('/api/dashboard/bundles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('updates')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Bundle update error:', error);
    res.status(500).json({ error: 'Failed to update bundle' });
  }
});

// API endpoint: Delete a bundle
app.delete('/api/dashboard/bundles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('updates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Bundle deletion error:', error);
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
});

// API endpoint: Create a new channel
app.post('/api/dashboard/channels', async (req, res) => {
  try {
    // Channels are created implicitly when bundles are uploaded
    // This endpoint is for dashboard purposes to manage channel metadata
    res.status(201).json({ message: 'Channels are managed through bundle uploads' });
  } catch (error) {
    console.error('Channel creation error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// API endpoint: Update a channel
app.put('/api/dashboard/channels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Channel updates would typically happen through bundle management
    res.json({ message: 'Channels are managed through bundle updates' });
  } catch (error) {
    console.error('Channel update error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// API endpoint: Delete a channel
app.delete('/api/dashboard/channels/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all bundles associated with this channel
    const { error } = await supabase
      .from('updates')
      .delete()
      .eq('channel', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Channel deletion error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// API endpoint: Update a device's channel
app.put('/api/dashboard/devices/:id/channel', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;

    const { data, error } = await supabase
      .from('device_channels')
      .update({ channel, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Device channel update error:', error);
    res.status(500).json({ error: 'Failed to update device channel' });
  }
});

// API endpoint: Delete a device
app.delete('/api/dashboard/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('device_channels')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Device deletion error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Capgo self-hosted update server running on port ${port}`);
  console.log(`Environment: ${process.env.ENVIRONMENT || 'prod'}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Bucket Name: ${BUCKET_NAME}`);
  console.log(`Admin interface: https://localhost:${port}`);
  console.log(`API endpoints available at: https://localhost:${port}/api/update`);
  console.log('Available endpoints:');
  console.log('  GET  /api/update - Check for updates');
  console.log('  POST /api/stats - Update statistics');
  console.log('  POST /api/channel_self - Channel management');
  console.log('  POST /api/admin/upload - Upload new update');
  console.log('  GET  /api/builtin - Get builtin version info');
  console.log('  POST /api/downloaded - Download completion notification');
  console.log('  POST /api/applied - Update application notification');
  console.log('  POST /api/failed - Update failure notification');
  console.log('  GET  /api/updates - Get all available updates');
  console.log('  GET  /api/health - Health check for update service');
  console.log('  GET  /api/channel - Get channel for a device');
  console.log('  GET  /api/channels - Get all available channels for an app');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});