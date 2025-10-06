# Capgo Self-Hosted Update Server

This is a self-hosted alternative to Capgo's update service using the same Capacitor plugin API.

## Features

- ✅ Capgo-compatible API endpoints (can use existing `@capgo/capacitor-updater` plugin)
- ✅ Automatic updates for Capacitor apps
- ✅ Version management with semantic versioning
- ✅ Channel management (stable, beta, dev)
- ✅ Update statistics and logging
- ✅ Admin interface for uploading updates
- ✅ No subscription fees - full control over your data
- ✅ Supabase integration for database and storage

## Requirements

- Node.js (v16 or higher)
- Supabase account (free tier available)
- A server to host the service (VPS, EC2, etc.)

## Setup

### 1. Supabase Configuration

1. Sign up at [Supabase](https://supabase.com/) (free tier available)
2. Create a new project
3. Get your Project URL and API Key from Project Settings → API

### 2. Database Setup

Run the SQL script to create the required tables in your Supabase SQL Editor:

```sql
-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing app updates
CREATE TABLE IF NOT EXISTS updates (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,  -- 'android', 'ios', 'web'
  version VARCHAR(20) NOT NULL,   -- '1.2.3'
  download_url TEXT NOT NULL,     -- URL to ZIP bundle
  checksum VARCHAR(100),          -- SHA256 checksum
  session_key VARCHAR(100),       -- For encrypted updates (optional)
  channel VARCHAR(20) DEFAULT 'stable',
  environment VARCHAR(20) DEFAULT 'prod',
  required BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  
  INDEX idx_platform_version (platform, version),
  INDEX idx_active (active),
  INDEX idx_channel_env (channel, environment)
);

-- Table for device channel assignments
CREATE TABLE IF NOT EXISTS device_channels (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  platform VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(app_id, device_id),
  INDEX idx_app_id (app_id),
  INDEX idx_channel (channel)
);

-- Table for update statistics
CREATE TABLE IF NOT EXISTS update_stats (
  id SERIAL PRIMARY KEY,
  bundle_id VARCHAR(100),
  status VARCHAR(20),             -- 'downloaded', 'installed', 'failed'
  device_id VARCHAR(100),
  app_id VARCHAR(100),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_device (device_id),
  INDEX idx_app (app_id),
  INDEX idx_status (status)
);

-- Table for update logs (analytics)
CREATE TABLE IF NOT EXISTS update_logs (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(100),
  app_id VARCHAR(100),
  current_version VARCHAR(20),
  new_version VARCHAR(20),
  platform VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_device (device_id),
  INDEX idx_app (app_id),
  INDEX idx_timestamp (timestamp)
);
```

### 3. Storage Setup

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **New Bucket** and create a bucket named `updates`
4. Optionally set it as public for direct file access
5. Set appropriate file size limits (recommend 100MB or higher for app bundles)

### 4. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_or_service_role_key
BUCKET_NAME=updates

# Server Configuration
PORT=3000
ENVIRONMENT=prod

# Storage Configuration (for bundle files)
STORAGE_BASE_URL=http://your-server-ip:3000
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Start the Server

```bash
# For development
npm run dev

# For production
npm start
```

Your server will be available at `http://your-server-ip:3000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/update` | Check for updates |
| POST | `/api/stats` | Update statistics |
| POST | `/api/channel_self` | Channel management |
| POST | `/api/admin/upload` | Upload new update |
| GET | `/` | Admin interface |

## Usage

### In Your Capacitor App

Update your app to use your self-hosted server:

```javascript
await AutoUpdaterService.init({
  updateServerUrl: 'http://your-server-ip:3000/api/update',
  // ... other config options
});

// Or configure via environment variables in your .env file:
// VITE_UPDATE_SERVER_URL=http://your-server-ip:3000/api/update
// VITE_AUTOUPDATE_MECANISM=true
// VITE_AUTOUPDATE_MODE=seamless
```

### Environment Configuration

Add these variables to your app's `.env` file:

```env
# Enable the auto-updater mechanism
VITE_AUTOUPDATE_MECANISM=true

# Set update mode (seamless for automatic updates, prompt for user confirmation)
VITE_AUTOUPDATE_MODE=seamless

# URL of your self-hosted update server
VITE_UPDATE_SERVER_URL=https://your-actual-server.com/api/update

# API environment (dev, staging, prod)
VITE_API_ENV=prod

# Publisher identifier
VITE_PUBLISHER=your_company
```

### Deployment

To deploy the self-hosted update server:

1. **Prepare your server environment** (VPS, cloud instance, etc.)
2. **Clone or upload this repository** to your server
3. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```
4. **Set up environment variables** in your server environment:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_service_role_key
   BUCKET_NAME=updates
   PORT=3000
   ENVIRONMENT=prod
   ```
5. **Create Supabase database tables** using the SQL in `supabase-setup.sql`
6. **Create Supabase Storage bucket** named `updates`
7. **Start the server**:
   ```bash
   npm start
   # For development: npm run dev
   ```

### Admin Interface

Access the admin interface at `http://your-server:3000/` to upload new updates.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/update` | Check for updates |
| POST | `/api/stats` | Update statistics |
| POST | `/api/channel_self` | Channel management |
| POST | `/api/admin/upload` | Upload new update |
| GET | `/api/builtin` | Get builtin version info |
| POST | `/api/downloaded` | Download completion notification |
| POST | `/api/applied` | Update application notification |
| POST | `/api/failed` | Update failure notification |
| GET | `/` | Admin interface |
| GET | `/health` | Health check |
});
```

### Uploading Updates

1. Build your web app: `pnpm build`
2. Zip the contents of the `dist` folder
3. Go to `http://your-server-ip:3000` and upload the ZIP file
4. Enter the version number (e.g., `1.2.3`)
5. Select platform, channel, etc.
6. The update will be available to your apps

## Admin Interface

The admin interface is available at the root URL (`http://your-server-ip:3000`).

Features:
- Upload new app versions
- Manage channels
- View update statistics
- Set required updates

## Security Considerations

- Use HTTPS in production
- Secure your admin upload endpoint with authentication
- Implement rate limiting
- Validate all inputs
- Regular security updates

## Architecture

```
Your App (Capacitor) 
    ↓ (calls update API)
Self-Hosted Server (Node.js + Supabase)
    ↓ (stores bundles)
Supabase Storage
```

The server acts as a middleman between your app and your bundle storage.

## Migration from Capgo Cloud

1. Deploy this self-hosted server
2. Update your app's `updateServerUrl` to point to your server
3. Upload your existing app bundles to the admin interface
4. Update will automatically work with the same Capacitor plugin

## Troubleshooting

### Common Issues:

- **Database Connection**: Ensure Supabase credentials are correct
- **File Uploads**: Ensure `uploads/` directory exists and has write permissions
- **CORS**: The server allows all origins by default (adjust as needed)
- **Version Format**: Use semantic versioning (e.g., `1.2.3`)

### Enable Debug Logging

Add `DEBUG=1` to your `.env` file for detailed logging.

## License

MIT