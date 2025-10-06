# Capgo Self-Hosted Update Implementation Guide

## Overview
This document describes the implementation of a self-hosted Capgo update server using Supabase as the backend, replacing the need for Capgo Cloud services. The implementation maintains compatibility with the official `@capgo/capacitor-updater` plugin.

## Architecture

### Backend (Node.js/Express + Supabase)
- **Server**: Express.js server with Supabase integration
- **Database**: Supabase PostgreSQL for storing update metadata
- **Storage**: Supabase Storage for update bundle files
- **API**: Capgo-compatible REST API endpoints

### Frontend (Vue 3 + Capacitor)
- **Update Service**: AutoUpdaterService.ts manages the update process
- **Configuration**: Environment-based configuration for different environments
- **User Interface**: Update prompts and progress indicators

## Backend Implementation

### Required API Endpoints
The server implements the following Capgo-compatible API endpoints:

1. `GET /api/update` - Check for available updates
2. `POST /api/stats` - Update statistics logging
3. `POST /api/channel_self` - Device channel management
4. `POST /api/admin/upload` - Upload new app versions
5. `GET /api/builtin` - Get builtin version info
6. `POST /api/downloaded` - Download completion notification
7. `POST /api/applied` - Update application notification
8. `POST /api/failed` - Update failure notification
9. `GET /` - Admin interface
10. `GET /health` - Health check

### Database Schema
The implementation uses the following Supabase tables:
- `updates`: Stores update metadata (version, download URL, checksum, etc.)
- `device_channels`: Manages device channel assignments
- `update_stats`: Tracks update statistics and events
- `update_logs`: Analytics logs for update checks

### Security Features
- Helmet.js for security headers
- CORS configuration for secure cross-origin requests
- Rate limiting to prevent abuse
- Input validation for all parameters
- CSP policy for admin interface

## Frontend Implementation

### AutoUpdaterService
The main service that handles the update process:

- **Initialization**: Configured via environment variables and programmatic options
- **Automatic Checks**: Periodic checks for updates on app start/resume
- **Progress Tracking**: Real-time download progress monitoring
- **Configuration**: Flexible settings for different update behaviors

### Configuration Options

The updater can be configured with the following settings:

```typescript
interface UpdaterConfig {
  autoUpdate: boolean;        // Enable automatic checking
  checkInterval: number;      // Check interval in minutes
  autoDownload: boolean;      // Auto-download updates
  autoApply: boolean;         // Auto-apply updates
  askBeforeUpdate: boolean;   // Show confirmation dialogs
  seamlessUpdates?: boolean;  // Update without user interaction
  updateServerUrl?: string;   // Custom update server URL
  channel?: string;           // Update channel (stable, beta, dev)
  maxBundleCount: number;     // Max number of bundles to keep
}
```

### Environment Variables

Required environment variables for the frontend:

```env
# Enable the auto-updater mechanism
VITE_AUTOUPDATE_MECANISM=true

# Set update mode (seamless for automatic updates, prompt for user confirmation)
VITE_AUTOUPDATE_MODE=seamless

# URL of your self-hosted update server
VITE_UPDATE_SERVER_URL=https://your-server.com/api/update

# API environment (dev, staging, prod)
VITE_API_ENV=prod

# Publisher identifier
VITE_PUBLISHER=your_company
```

## Setup Instructions

### 1. Backend Setup
1. Deploy the Node.js server to your preferred hosting platform
2. Create a Supabase project and configure the database
3. Run the SQL setup script to create required tables
4. Configure Supabase Storage bucket for update files
5. Set environment variables in your server environment

### 2. Frontend Integration
1. Ensure `@capgo/capacitor-updater` is installed
2. Configure environment variables in your `.env` file
3. Initialize `AutoUpdaterService` in your app's main component
4. Test the update flow in a development environment

### 3. Upload New Versions
1. Use the admin interface at `/` to upload new versions
2. Or use the API endpoint: `POST /api/admin/upload`
3. Provide version, platform, channel, and update file
4. The system will store in Supabase Storage and update the database

## Update Process Flow

1. **Check for Updates**: App contacts the update server with current version
2. **Server Response**: Server returns newer version info if available
3. **Download**: Update bundle is downloaded in the background
4. **Install**: User is prompted to install (configurable behavior)
5. **Apply**: Update is applied on app restart or immediately (seamless mode)

## Testing the Implementation

### Backend Testing
- Verify health check: `GET /health`
- Test update endpoint with valid parameters
- Verify database connectivity
- Test file upload functionality

### Frontend Testing
- Enable development mode with `VITE_AUTOUPDATE_MECANISM=true`
- Check console logs for update process messages
- Test both seamless and prompt-based update flows
- Verify update cleanup (old bundles)

## Security Considerations

- Store Supabase credentials securely in server environment
- Implement proper RLS (Row Level Security) in Supabase
- Use HTTPS for all update server communications
- Validate all file uploads and parameters
- Implement appropriate rate limiting

## Troubleshooting

### Common Issues:
1. **Connection problems**: Check CORS settings and server URL
2. **Supabase errors**: Verify database credentials and table structure
3. **File upload failures**: Check storage permissions and file size limits
4. **Update not applying**: Ensure proper bundle ID management

### Debugging:
- Check server logs for API request details
- Monitor database queries and storage operations
- Verify network connectivity from app to update server
- Review Capacitor plugin documentation for compatibility

## Maintenance

### Regular Tasks:
- Monitor storage usage in Supabase
- Clean up old bundle files periodically
- Rotate API keys and credentials
- Update dependencies as needed

## Benefits Over Capgo Cloud

1. **Cost Savings**: No subscription fees
2. **Data Control**: Full control over update data
3. **Customization**: Ability to modify as needed
4. **Privacy**: No external data sharing
5. **Reliability**: Control over service availability