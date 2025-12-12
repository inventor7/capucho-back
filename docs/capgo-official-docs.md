I'll help you understand the APIs used by the Capgo backend. Let me start by exploring the repository structure to find API documentation and understand the architecture. Perfect! Now let me get the specific API files to extract detailed endpoints: Perfect! I found the API documentation you need. Let me give you a comprehensive guide to all the Capacitor plugin APIs that Capgo uses.

## 📋 Main Plugin APIs

Based on the codebase, the phone uses **3 main endpoints** via the Capacitor plugin:

### 1. **`/updates`** - Check for app updates

**Methods:** POST

**File:** `supabase/functions/_backend/plugins/updates.ts`

**Purpose:** The plugin checks if there's a new version available for the app.

**Request Body Parameters:**

```tsx
{
  app_id: string,           // Your app ID (e.g., "com.example.app")
  device_id: string,        // Unique device identifier
  version_name: string,     // Current app version (e.g., "1.2.3")
  version_build: string,    // Build number
  platform: "ios" | "android",
  is_emulator: boolean,
  is_prod: boolean,
  channel?:  string,         // Optional channel override
  plugin_version?: string   // Version of the Capgo plugin
}

```

**Response:** Returns bundle URL and manifest for the update

---

### 2. **`/stats`** - Send app analytics

**Methods:** POST

**File:** `supabase/functions/_backend/plugins/stats.ts`

**Purpose:** The plugin sends statistics about app usage, crashes, and version information.

**Request Body Parameters:**

```tsx
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  action: string,           // e.g., 'get', 'disablePlatformAndroid', 'needPlanUpgrade'
  versionName?:  string,
  is_emulator: boolean,
  is_prod: boolean
}

```

---

### 3. **`/channel_self`** - Manage device channels

**Methods:** GET, POST, PUT, DELETE

**File:** `supabase/functions/_backend/plugins/channel_self.ts`

**Purpose:** Devices can query available channels, set their channel, or get their current channel assignment.

### **GET** - List compatible channels

```tsx
Query Parameters:
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  is_emulator: boolean,
  is_prod: boolean
}

```

### **POST** - Set device channel

```tsx
Body:
{
  app_id:  string,
  device_id:  string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  channel: string,          // Channel name to set
  plugin_version?: string
}

```

### **PUT** - Get current channel (or list channels)

```tsx
Body:
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  defaultChannel?: string,
  plugin_version?: string
}

```

### **DELETE** - Remove device from channel

```tsx
Query Parameters:
{
  app_id: string,
  device_id: string
}

```

---

### 4. **`/ok`** - Health check

**Methods:** POST

**File:** `supabase/functions/_backend/public/ok.ts`

**Purpose:** Simple endpoint to verify the API is running.

---

### 5. **`/latency`** - Latency test

**Methods:** POST

**File:** `supabase/functions/_backend/private/latency.ts`

**Purpose:** Measure request latency.

---

## 🌐 API Endpoints Routing

The endpoints are deployed on **Cloudflare Workers** (primary):

```
cloudflare_workers/
├── api/index.ts          (Main API)
├── plugin/index.ts       (Plugin endpoints:  /updates, /stats, /channel_self)
└── files/index.ts        (File operations)

```

**Plugin Worker Routes:**

- `/channel_self` → channels management
- `/updates` or `/updates_v2` → update checks
- `/stats` or `/stats_v2` → statistics
- `/ok` → health check
- `/latency` → latency test

---

## 📝 Full Request/Response Examples

### Example: Check for Updates

```tsx
POST /updates
Content-Type: application/json

{
  "app_id": "com.example.myapp",
  "device_id": "device-uuid-123",
  "version_name": "1.0.0",
  "version_build": "100",
  "platform": "ios",
  "is_emulator": false,
  "is_prod": true,
  "plugin_version": "7.34.0"
}

Response (200):
{
  "url": "https://...bundle.zip",
  "manifest": [... ],
  "version":  "1.1.0"
}

```

### Example: Send Stats

```tsx
POST /stats
Content-Type: application/json

{
  "app_id": "com. example.myapp",
  "device_id": "device-uuid-123",
  "version_name": "1.0.0",
  "version_build":  "100",
  "platform":  "ios",
  "action":  "get",
  "versionName": "1.1.0",
  "is_emulator": false,
  "is_prod": true
}

Response (200):
{
  "status": "success"
}

```

### Example: Get Device Channel

```tsx
PUT /channel_self
Content-Type: application/json

{
  "app_id": "com. example.myapp",
  "device_id": "device-uuid-123",
  "version_name": "1.0.0",
  "version_build":  "100",
  "platform":  "ios",
  "defaultChannel": "production"
}

Response (200):
{
  "channel": "production",
  "status": "default",
  "allowSet": true
}

```

---

## 🔧 To Replicate the Backend

You'll need to implement these 5 endpoints in your custom backend:

1. **Database schema** - See `supabase/functions/_backend/utils/postgress_schema.ts`
2. **Parser logic** - See `supabase/functions/_backend/utils/plugin_parser.ts`
3. **Update logic** - See `supabase/functions/_backend/utils/update. ts`
4. **Stats tracking** - See `supabase/functions/_backend/utils/stats. ts`

The key files to study:

- `supabase/functions/_backend/plugins/` - Core endpoint implementations
- `supabase/functions/_backend/utils/` - Shared business logic
- `tests/` - Complete test examples with exact payloads

Would you like me to extract and document any specific endpoint in more detail, or help you understand the database schema these endpoints use?

Now let me get more details on the backend API implementations: Perfect! Now I have a complete picture. Let me give you a comprehensive guide to **ALL the APIs** that the Capacitor plugin uses, combining both repositories.

## 🎯 Complete API Ecosystem Overview

The Capacitor Updater plugin communicates with your backend through **3 main plugin endpoints** and multiple **internal plugin methods**. Here's the full breakdown:

---

## 📡 Backend API Endpoints (What the Phone Sends)

### **1. `/updates` - Check for App Updates**

**Method:** `POST`

**Default URL:** `https://plugin.capgo.app/updates`

**Override:** `capacitor. config.json` → `updateUrl`

**Request Body:**

```tsx
{
  app_id: string,              // e.g., "com.example.app"
  device_id: string,           // Unique device UUID
  version_name: string,        // Current version (e.g., "1.0.0")
  version_build: string,       // Build number
  platform: "ios" | "android",
  is_emulator: boolean,
  is_prod: boolean,
  channel?:  string,            // Optional channel override
  plugin_version?: string      // Capacitor Updater plugin version
}

```

**Response:**

```tsx
{
  url: string,                 // Signed URL to download bundle ZIP
  manifest: Array<... >,        // List of files in bundle
  version: string,             // New version name
  checksum?:  string,           // Checksum for verification
  sessionKey?: string          // For encrypted bundles (v2)
}

```

**What it does:**

- Checks if a new bundle version is available
- Returns download URL and manifest
- Handles version compatibility (breaking/major/minor)
- Checks plan limits (MAU, bandwidth)

---

### **2. `/stats` - Send Analytics & Events**

**Method:** `POST`

**Default URL:** `https://plugin.capgo.app/stats`

**Override:** `capacitor.config.json` → `statsUrl`

**Request Body:**

```tsx
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  action: string,              // e.g., 'get', 'set', 'download_fail', 'install', etc.
  old_version_name?:  string,   // For downgrade tracking
  plugin_version?: string,
  is_emulator: boolean,
  is_prod: boolean
}

```

**Possible `action` values:**

```
- 'get'                  // User checked for update
- 'set'                  // Update was installed
- 'download_fail'        // Bundle download failed
- 'install'              // Bundle installation started
- 'fail'                 // Generic update failure
- 'set_fail'             // Installation failed
- 'update_fail'          // Update process failed
- 'unzip_fail'           // Unzip failed
- 'checksum_fail'        // Checksum validation failed
- 'decrypt_fail'         // Decryption failed
- 'reset'                // User reverted to previous version
- 'delete'               // Bundle was deleted
- 'needPlanUpgrade'      // Plan quota exceeded
- 'mau'                  // Monthly active user tracking

```

**Response:**

```tsx
{
  status: "success";
}
```

**What it does:**

- Tracks all user actions and failures
- Updates device activity metrics
- Counts MAU (Monthly Active Users) for billing
- Stores failure diagnostics
- Checks plan usage limits

---

### **3. `/channel_self` - Manage Device Channels**

**Methods:** `GET`, `POST`, `PUT`, `DELETE`

**Default URL:** `https://plugin.capgo.app/channel_self`

**Override:** `capacitor.config.json` → `channelUrl`

### **GET** - List available channels for device

```tsx
Query Parameters:
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  is_emulator: boolean,
  is_prod: boolean
}

Response:
{
  channels:  [
    {
      id: string,
      name: string,
      public: boolean,
      allow_self_set: boolean
    }
  ]
}

```

### **POST** - Assign device to a channel

```tsx
Body:
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  channel: string,             // Channel name to join
  plugin_version?: string,
  is_emulator:  boolean,
  is_prod:  boolean
}

Response:
{
  status: "ok" | "override" | "default",
  allowSet: boolean
}

```

### **PUT** - Get current device channel (or retrieve default)

```tsx
Body:
{
  app_id: string,
  device_id: string,
  version_name: string,
  version_build: string,
  platform: "ios" | "android",
  defaultChannel?: string,
  plugin_version?: string
}

Response:
{
  channel: string,             // Current channel name
  status: "override" | "default",
  allowSet: boolean
}

```

### **DELETE** - Remove device from channel

```tsx
Query Parameters:
{
  app_id: string,
  device_id: string
}

```

**What it does:**

- Manages A/B testing groups
- Routes devices to beta/staging/production
- Allows devices to self-select channels
- Handles channel overrides (admin forcing devices to channel)

---

## 🔌 Plugin Methods (Phone's JavaScript API)

The plugin exposes these methods that your app calls:

### **Update Management**

```tsx
// Check for new version
await CapacitorUpdater.getLatest(options?:  { channel?: string })
// Returns: { version, url, manifest, ...  }

// Download a bundle
await CapacitorUpdater.download({ url, version })
// Returns: BundleInfo

// Install next version
await CapacitorUpdater.next({ id: bundleId })

// Set current version
await CapacitorUpdater.set({ id: bundleId })

// Delete bundle
await CapacitorUpdater.delete({ id: bundleId })

// Reload app with current bundle
await CapacitorUpdater.reload()

```

### **Channel Management**

```tsx
// Get current channel
await CapacitorUpdater.getChannel();
// Returns: { channel:  "production", status: "default", allowSet: true }

// Set device channel
await CapacitorUpdater.setChannel({ channel: "beta" });

// Remove from channel
await CapacitorUpdater.unsetChannel();

// List available channels
await CapacitorUpdater.listChannels();
// Returns: [{ id, name, public, allow_self_set }, ...]
```

### **Device Info**

```tsx
// Get unique device ID
await CapacitorUpdater.getDeviceId();
// Returns: { device_id: "uuid" }

// Set custom device ID
await CapacitorUpdater.setCustomId({ id: "custom-id" });

// Get app ID
await CapacitorUpdater.getAppId();

// Get current bundle info
await CapacitorUpdater.current();
// Returns: { bundle:  { id, version, downloaded } }

// Get builtin version (initial app version)
await CapacitorUpdater.getBuiltinVersion();

// Get plugin version
await CapacitorUpdater.getPluginVersion();
// Returns: { version: "7.34.0" }
```

### **Configuration (Runtime)**

```tsx
// Override URLs dynamically
await CapacitorUpdater.setUpdateUrl({ updateUrl: "https://..." });
await CapacitorUpdater.setStatsUrl({ statsUrl: "https://..." });
await CapacitorUpdater.setChannelUrl({ channelUrl: "https://..." });
```

### **Delay Management**

```tsx
// Delay next check
await CapacitorUpdater.setMultiDelay({ delayConditions: [... ] })

// Cancel pending delay
await CapacitorUpdater.cancelDelay()

```

### **Status & Notifications**

```tsx
// Signal app is ready (stops auto-revert)
await CapacitorUpdater.notifyAppReady();

// Check if auto-update is enabled
await CapacitorUpdater.isAutoUpdateEnabled();

// Get next pending bundle
await CapacitorUpdater.getNextBundle();

// Get failed update info
await CapacitorUpdater.getFailedUpdate();

// Mark bundle as error
await CapacitorUpdater.setBundleError({ id: bundleId });
```

### **Event Listeners**

```tsx
CapacitorUpdater.addListener("updateAvailable", (event) => {});
CapacitorUpdater.addListener("updateFailed", (event) => {});
CapacitorUpdater.addListener("downloadComplete", (event) => {});
CapacitorUpdater.addListener("appReady", (event) => {});
CapacitorUpdater.addListener("appReloaded", (event) => {});
CapacitorUpdater.addListener("channelPrivate", (event) => {});
CapacitorUpdater.addListener("noNeedUpdate", (event) => {});
```

---

## 🔄 Complete Plugin Flow (How It All Works Together)

### **On App Launch:**

```
1. Plugin initializes from capacitor.config.json
2. Calls notifyAppReady() when app is stable
3. Starts background update check (every periodCheckDelay - default 1 hour)

```

### **When Checking for Updates:**

```
1. GET device info:  getDeviceId(), getBuiltinVersion()
2. Get current channel: channel_self (PUT)
3. POST /updates with device info
4. Response returns new version URL
5. Download bundle: CapacitorUpdater.download(url)
6. Emit 'updateAvailable' event
7. User decides to install
8. Install: CapacitorUpdater.next() + reload()
9. Send stats: POST /stats with action='set'

```

### **Stats Tracking:**

```
Every action sends to /stats endpoint:
- 'get' when checking updates
- 'set' when installing
- 'download_fail' if download fails
- 'install' when installation starts
- 'fail' if installation fails
- 'reset' if user reverts
- Plan quota checks (MAU counting)

```

### **Channel Assignment:**

```
1. GET /channel_self to list channels
2. User selects channel or admin sets it
3. POST /channel_self to assign device
4. Next update check respects new channel
5. Different version delivered per channel

```

---

## 📋 Configuration Settings (capacitor.config.json)

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "updateUrl": "<https://your-api.com/updates>",
      "statsUrl": "<https://your-api.com/stats>",
      "channelUrl": "<https://your-api.com/channel_self>",
      "publicKey": "your-encryption-key",
      "version": "1.0.0",
      "appReadyTimeout": 1000,
      "responseTimeout": 10,
      "periodCheckDelay": 3600,
      "autoUpdate": false,
      "autoDeleteFailed": false,
      "autoDeletePrevious": false,
      "resetWhenUpdate": false,
      "directUpdate": "atInstall",
      "autoSplashscreen": true,
      "allowModifyUrl": true,
      "persistModifyUrl": false
    }
  }
}
```

---

## 🎯 For Your Custom Backend Implementation

You need to implement these **3 endpoints minimum**:

| Endpoint        | Method                 | Purpose                            |
| --------------- | ---------------------- | ---------------------------------- |
| `/updates`      | POST                   | Return available bundle & metadata |
| `/stats`        | POST                   | Track user actions & failures      |
| `/channel_self` | GET, POST, PUT, DELETE | Manage device channels             |

**Key things to track in your database:**

- Device metrics (device_id, version_name, platform, is_prod)
- Update metrics (downloads, success rate, failures per type)
- Channel assignments (device → channel mapping)
- Bundle metadata (version, url, manifest, checksums)
- Plan usage (MAU, bandwidth for paid tiers)
- Error tracking (download_fail, install_fail, etc.)

Would you like me to show you example implementations for any of these endpoints, or details on how to structure your database schema?

Perfect! Let me explain the two modes clearly with examples and use cases:

---

## 🔄 Two Update Modes: Auto vs Manual

There are **two fundamentally different ways** the Capacitor Updater plugin works:

### **Mode 1: AUTO UPDATE = `true`** (Default)

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "autoUpdate": true
    }
  }
}
```

**What happens automatically:**

```
1. App launches
2. Plugin checks for updates in background (no user interaction needed)
3. If new version found, downloads it
4. On next background/app kill → automatically installs
5. User gets update seamlessly

```

**Timeline:**

```
App Foreground      → Plugin checks for updates (POST /updates)
                      ↓
                    Downloads new bundle in background
                      ↓
User backgrounds app → Installs new version
                      ↓
User opens app       → Shows new version automatically

```

**Configuration for Auto Mode:**

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "autoUpdate": true,
      "periodCheckDelay": 3600, // Check every hour
      "autoDeleteFailed": true, // Clean up failed bundles
      "autoDeletePrevious": true, // Remove old versions
      "directUpdate": false, // Download at start, install on background
      // OR
      "directUpdate": "always" // Install immediately (needs splashscreen)
    }
  }
}
```

---

### **Mode 2: AUTO UPDATE = `false`** (Manual Control)

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "autoUpdate": false
    }
  }
}
```

**What you must do manually:**

```
1. You check for updates:  await CapacitorUpdater.getLatest()
2. You download the bundle: await CapacitorUpdater.download(url)
3. You prompt user:  "Update available, install now?"
4. User approves → You install:  await CapacitorUpdater. next(bundleId)
5. User backgrounds app → Installs

```

**Timeline:**

```
App launches
   ↓
Your code calls getLatest()
   ↓
Show "Update Available" dialog to user
   ↓
User taps "Update"
   ↓
Download bundle
   ↓
Set as next version
   ↓
User backgrounds app (or manually reload)
   ↓
New version loads

```

**When you'd use Manual Mode:**

```tsx
// Check if auto-update is enabled
const { enabled } = await CapacitorUpdater.isAutoUpdateEnabled();

if (enabled) {
  // Auto mode - plugin handles everything
  console.log("Plugin is auto-updating");
} else {
  // Manual mode - you handle updates
  await checkForUpdatesManually();
}

// Your manual update flow
async function checkForUpdatesManually() {
  try {
    const latest = await CapacitorUpdater.getLatest();

    // Show in-app notification/dialog
    showUpdateDialog(latest.version);

    // User taps "Update"
    const bundle = await CapacitorUpdater.download({
      url: latest.url,
      version: latest.version,
    });

    // Queue for next background
    await CapacitorUpdater.next({ id: bundle.id });
  } catch (error) {
    if (error.message === "No new version available") {
      // Already up to date
      console.log("App is current");
    }
  }
}
```

---

## 📊 Comparison Table

| Feature               | **AUTO = true**                 | **AUTO = false**                 |
| --------------------- | ------------------------------- | -------------------------------- |
| **Check for updates** | Plugin does it                  | You call `getLatest()`           |
| **Show update UI**    | No UI built-in                  | You show dialog                  |
| **User decision**     | User doesn't see it             | User approves in dialog          |
| **Download**          | Automatic                       | You call `download()`            |
| **Installation**      | Automatic on background         | You call `next()`                |
| **Timing**            | Plugin controls                 | You control                      |
| **User Experience**   | Silent updates (best for users) | User controls (best for testing) |
| **Network friendly**  | Downloads in background         | You control WiFi-only, etc       |
| **Battery friendly**  | Checks periodically             | You control check timing         |
| **Default interval**  | Every 1 hour                    | You decide when to check         |

---

## ✅ Which One is Better?

### **Use `autoUpdate: true` (Auto Mode) IF:**

✅ **Production app** - Most users want silent updates

✅ **B2C app** - Users don't want to manage updates manually

✅ **Business critical app** - Need to push security fixes fast

✅ **App has 1000+ users** - Want updates to reach everyone automatically

✅ **Low bandwidth concerns** - Not worried about automatic downloads

**Example apps:** Banking app, E-commerce, Social media, Productivity tools

---

### **Use `autoUpdate: false` (Manual Mode) IF:**

✅ **Development/Testing** - Want to test specific versions

✅ **Large app (>20MB)** - Want user control over download

✅ **Enterprise app** - IT dept wants update approval

✅ **Metered network app** - Want users to choose WiFi-only

✅ **A/B testing** - Need to control which users get which versions

✅ **Staged rollout** - Want to gradually release to percentage of users

**Example apps:** Heavy game, Large enterprise suite, Beta tester app

---

## 🎯 Real-World Example: Auto Mode

**User experience with AUTO = true:**

```
Monday 10:00 AM
  └─ User opens your banking app
  └─ Plugin silently checks for updates (no notification)
  └─ New version 1.2.0 found, starts downloading
  └─ Download completes in background

Monday 10:30 AM
  └─ User switches to other app (banking backgrounded)
  └─ Plugin auto-installs new version silently

Monday 10:35 AM
  └─ User opens banking app again
  └─ New version 1.2.0 loaded automatically
  └─ User never knew anything happened ✨

```

---

## 🎯 Real-World Example: Manual Mode

**Developer experience with AUTO = false:**

```
// In your app component
onMounted(async () => {
  const isAutoUpdateEnabled = await CapacitorUpdater.isAutoUpdateEnabled();

  if (! isAutoUpdateEnabled) {
    // Manual mode - check for updates
    checkForUpdates();
  }
});

async function checkForUpdates() {
  try {
    const latest = await CapacitorUpdater. getLatest();

    // Show banner/dialog to user
    showUpdateBanner(latest.version);

  } catch (error) {
    if (error.message === 'No new version available') {
      console.log('App is up to date');
    }
  }
}

// User taps "Update" button
async function downloadAndInstallUpdate() {
  const latest = await CapacitorUpdater.getLatest();

  const bundle = await CapacitorUpdater.download({
    url: latest.url,
    version: latest.version
  });

  // Show "Update ready, restart to apply"
  await CapacitorUpdater.next({ id: bundle.id });

  // OR restart immediately
  // await CapacitorUpdater. set({ id: bundle.id });
}

```

---

## 🚀 My Recommendation for YOUR Custom Backend

**For a backend you're building from scratch:**

### **Start with AUTO = true** because:

1. ✅ **Simpler to implement** - You just return bundle URL on `/updates`
2. ✅ **Better user retention** - Users always on latest version
3. ✅ **Security** - Security fixes deployed instantly
4. ✅ **Less maintenance** - Users can't get stuck on broken version
5. ✅ **Lower support costs** - Everyone has same version

### **Configuration I'd recommend:**

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "autoUpdate": true,
      "directUpdate": "atInstall", // Only direct update on install
      "periodCheckDelay": 3600, // Check every 1 hour
      "autoDeleteFailed": true, // Clean up failures
      "autoDeletePrevious": true, // Don't waste storage
      "appReadyTimeout": 10000, // 10 seconds to call notifyAppReady
      "autoSplashscreen": true, // Show splashscreen during update
      "resetWhenUpdate": true // Clean old bundles on native update
    }
  }
}
```

---

## 📋 Summary

| Aspect                           | Auto Mode         | Manual Mode        |
| -------------------------------- | ----------------- | ------------------ |
| **User sees "Update available"** | No                | Yes                |
| **User decides when to update**  | No (happens auto) | Yes                |
| **Good for**                     | Production apps   | Testing/Enterprise |
| **Implementation complexity**    | Lower             | Higher             |
| **Best user experience**         | Better (silent)   | Control (explicit) |

**Which to choose?**

- **95% of the time:** Use `autoUpdate: true`
- **Only use `autoUpdate: false` if:** Testing, staged rollout, large app, or enterprise requirements

Perfect! Now let me give you a comprehensive guide on **encryption, sessionKey, checksum, and the database schema** with all the details:

---

## 🔐 Complete Encryption Flow Explained

### \*What is Encryption & Why? \*\*

The Capgo system uses **end-to-end encryption** to protect your bundles from being intercepted or modified during download. Here's the security model:

```
Developer's Server
    ↓
Bundle (unencrypted) → [CLI encrypts] → Encrypted Bundle + SessionKey + Checksum
    ↓
Upload to Server
    ↓
Phone Downloads Encrypted Bundle
    ↓
[Phone decrypts using SessionKey] → Verify Checksum → Use Bundle

```

---

## 🔑 The Three Encryption Components

### **1. PublicKey & PrivateKey**

- **PrivateKey**: Stored on developer's machine (`.capgo_key_v2`)
- **PublicKey**: Stored in plugin config, sent with phone requests
- **Algorithm**: RSA-2048 (asymmetric encryption)
- **Purpose**: Encrypt the AES key (sessionKey) so only authorized apps can decrypt

### **2. SessionKey (IV: EncryptedAESKey)**

Format: `"<IV>:<BASE64_ENCRYPTED_AES_KEY>"`

```
SessionKey = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0="
              ↑                              ↑
              IV (Initialization Vector)    RSA-encrypted AES key (base64)

```

**What it does:**

- `IV`: Random 16 bytes (prevents pattern attacks)
- `Encrypted AES Key`: 16-byte AES key encrypted with RSA public key
- Phone decrypts the AES key, then uses it to decrypt the bundle

### **3. Checksum**

- **Algorithm**: SHA-256 (produces 32 bytes = 64 hex characters)
- **Encrypted with**: RSA private key (on server)
- **Stored in DB as**: Base64 encoded encrypted checksum
- **Verification**: Phone decrypts checksum, calculates bundle's SHA-256, compares

---

## 📊 How It Works: Step by Step

### **DEVELOPER SIDE: Creating Encrypted Bundle**

```
1. Developer writes code → build app → dist. zip (1MB bundle)

2. CLI Command:
   npx @capgo/cli@latest bundle upload \\
     --bundle-path dist. zip \\
     --version 1.0.0 \\
     --encrypt \\
     --key . capgo_key_v2

3. CLI Process:
   a) Read bundle file:  dist.zip
   b) Generate AES key: random 16 bytes
   c) Encrypt bundle with AES-256-GCM using that key
      Encrypted bundle: dist.zip.encrypted (1MB → 1. 001MB)
   d) Generate IV: random 16 bytes
   e) Encrypt AES key with RSA public key:
      Encrypted AES Key = RSA_Encrypt(AES_Key, PublicKey)
   f) SessionKey = IV + ":" + Base64(Encrypted AES Key)
      Example: "a1b2c3d4e5f6g7h8:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0="
   g) Calculate checksum: SHA256(encrypted bundle) = 64 hex chars
   h) Encrypt checksum:  Encrypted_Checksum = RSA_Encrypt(SHA256, PrivateKey)
   i) Upload to server with:
      - encrypted bundle
      - sessionKey
      - encrypted checksum
      - version

```

**Example Values:**

```
AES Key (hex):           "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
IV (hex):                "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1"
SessionKey:               "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0="
Checksum (SHA-256 hex):  "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a"

```

---

### **BACKEND SIDE: Storing in Database**

```tsx
// What gets stored in database:
{
  app_id: "com.example.app",
  version: "1.0.0",
  external_url: "<https://storage.example.com/bundles/1>. 0.0.zip",
  checksum: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",  // Encrypted SHA256
  session_key: "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0=",
  storage_provider: "external",
  r2_path: "orgs/org-123/bundles/1.0.0.zip"
}

```

---

### **PHONE SIDE: Download & Decrypt**

```
1. Phone calls:  CapacitorUpdater.getLatest()
   ↓
2. Backend returns:
   {
     "url": "<https://storage.example.com/bundles/1.0.0.zip>",
     "version": "1.0.0",
     "sessionKey": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0=",
     "checksum": "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a"
   }
   ↓
3. Phone downloads encrypted bundle from URL
   Encrypted_Bundle = download(url)
   ↓
4. Phone parses sessionKey:
   IV = "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1"
   Encrypted_AES_Key = "xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0="
   ↓
5. Phone RSA-decrypts using publicKey (from capacitor. config.json):
   AES_Key = RSA_Decrypt(Base64_Decode(Encrypted_AES_Key), PublicKey)
   AES_Key = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
   ↓
6. Phone AES-decrypts bundle using IV + AES_Key:
   Bundle_Data = AES_Decrypt(Encrypted_Bundle, AES_Key, IV)
   ↓
7. Phone verifies checksum:
   a) RSA-decrypt the checksum:
      Expected_Checksum = RSA_Decrypt(checksum_from_server, PublicKey)
      = "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a"
   b) Calculate SHA-256 of decrypted bundle:
      Calculated_Checksum = SHA256(Bundle_Data)
   c) Compare:
      if Expected_Checksum == Calculated_Checksum → OK ✅
      else → FAIL ❌ (bundle corrupted/modified)
   ↓
8. Extract decrypted bundle → use it

```

---

## 💾 Database Schema

Here's the complete schema for storing bundles and update info:

### **Table: `app_versions`** (Bundles)

```sql
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,          -- e.g., "com.example. app"
  name VARCHAR(50) NOT NULL,              -- e.g., "1.0.0"
  external_url VARCHAR(500),              -- URL to download from
  checksum VARCHAR(255),                  -- Encrypted SHA-256 (if encrypted)
  session_key VARCHAR(500),               -- "IV:EncryptedAESKey" (if encrypted)
  storage_provider VARCHAR(50),           -- "external", "r2" (Cloudflare R2)
  r2_path VARCHAR(500),                   -- Internal R2 storage path

  -- Metadata
  owner_org UUID NOT NULL,
  user_id UUID,                           -- Who uploaded this
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted BOOLEAN DEFAULT FALSE,

  -- Security & Verification
  min_update_version VARCHAR(50),         -- Min version required to update
  manifest JSONB,                         -- Multi-file download manifest

  FOREIGN KEY (app_id) REFERENCES apps(app_id),
  UNIQUE(app_id, name)
);

```

### **Table: `channels`** (Update Channels)

```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,             -- "production", "beta", "staging"
  version UUID NOT NULL,                  -- Current version in this channel

  -- Channel Settings
  public BOOLEAN DEFAULT FALSE,           -- Public or private channel
  allow_device_self_set BOOLEAN DEFAULT FALSE,  -- Can devices self-assign?
  allow_dev BOOLEAN DEFAULT FALSE,        -- Allow dev builds?
  allow_emulator BOOLEAN DEFAULT FALSE,   -- Allow emulator devices?

  -- Platform & Update Control
  ios BOOLEAN DEFAULT TRUE,               -- Enabled for iOS?
  android BOOLEAN DEFAULT TRUE,           -- Enabled for Android?
  disable_auto_update VARCHAR(50),        -- "major", "minor", "patch", "version_number", "none"
  disable_auto_update_under_native BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (app_id) REFERENCES apps(app_id),
  FOREIGN KEY (version) REFERENCES app_versions(id),
  UNIQUE(app_id, name)
);

```

### **Table: `devices`** (Phone Devices)

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL,        -- UUID of phone
  app_id VARCHAR(255) NOT NULL,

  -- Device Info
  custom_id VARCHAR(255),                 -- Custom identifier (user ID, etc.)
  platform VARCHAR(20),                   -- "ios", "android"
  is_prod BOOLEAN DEFAULT TRUE,
  is_emulator BOOLEAN DEFAULT FALSE,

  -- Versions
  version_name VARCHAR(50),               -- Current bundle version
  version_build VARCHAR(50),              -- Build number
  version_os VARCHAR(50),                 -- OS version

  -- Channel Assignment
  channel_id UUID,                        -- Current channel

  -- Activity
  last_seen TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (app_id) REFERENCES apps(app_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  UNIQUE(app_id, device_id)
);

```

### **Table: `stats_version`** (Download & Install Stats)

```sql
CREATE TABLE stats_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255) NOT NULL,
  version_id UUID NOT NULL,

  -- Actions
  get_count INT DEFAULT 0,                -- "get" action count
  set_count INT DEFAULT 0,                -- "set" action count
  fail_count INT DEFAULT 0,               -- "fail" action count

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (app_id) REFERENCES apps(app_id),
  FOREIGN KEY (version_id) REFERENCES app_versions(id)
);

```

### **Table: `stats_devices`** (Device Activity)

```sql
CREATE TABLE stats_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL,
  app_id VARCHAR(255) NOT NULL,

  -- Tracking
  action VARCHAR(100),                    -- "app_moved_to_foreground", "download_complete", etc.
  version_name VARCHAR(50),

  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (app_id) REFERENCES apps(app_id)
);

```

---

## 🔄 Complete End-to-End Example

### **Scenario: Encrypted Bundle Upload & Download**

**Step 1: Developer Encrypts & Uploads**

```bash
# Generate keys (once)
npx @capgo/cli@latest key create

# Output:
# ✅ Keys created:
# - Private key: . capgo_key_v2
# - Public key: .capgo_key_v2.pub
# - Config: Add to capacitor.config.json

# Upload encrypted bundle
npx @capgo/cli@latest bundle upload \\
  --bundle-path ./dist.zip \\
  --version 1.0.0 \\
  --app-id com.example.app \\
  --encrypt

```

**CLI Process:**

```tsx
// Internally in CLI:
const bundle = readFileSync("dist.zip");
const aesKey = crypto.randomBytes(16); // Random 16 bytes for AES

// Encrypt bundle
const encrypted = aes256gcm.encrypt(bundle, aesKey);

// Create sessionKey
const iv = crypto.randomBytes(16);
const encryptedAesKey = rsa.encrypt(aesKey, publicKey);
const sessionKey = `${iv.toString("hex")}:${encryptedAesKey.toString(
  "base64"
)}`;

// Create checksum
const checksum = sha256(encrypted);
const encryptedChecksum = rsa.encrypt(Buffer.from(checksum, "hex"), publicKey);

// Upload
upload({
  checksum: encryptedChecksum.toString("base64"),
  session_key: sessionKey,
  external_url: "s3://bucket/bundle.zip",
});
```

**Database After Upload:**

```
app_versions:
{
  id: "uuid-123",
  app_id:  "com.example.app",
  name: "1.0.0",
  external_url:  "<https://s3.amazonaws.com/bundles/1.0.0.zip>",
  checksum: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
  session_key: "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0="
}

```

**Step 2: Backend Returns Update Info**

```tsx
// POST /updates
const response = {
  version: "1.0.0",
  url: "<https://s3.amazonaws.com/bundles/1.0.0.zip>",
  checksum: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
  sessionKey:
    "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6a1:xY2+KmL9oP8nJvW5qR3tU1sV6wX4yZ0=",
};
```

**Step 3: Phone Decrypts**

```java
// Android CryptoCipher. java
public static void decryptFile(File file, String publicKey, String sessionKey) {
  // Parse sessionKey:  "IV:EncryptedAESKey"
  String[] parts = sessionKey.split(":");
  byte[] iv = hexToBytes(parts[0]);
  byte[] encryptedAesKey = base64ToBytes(parts[1]);

  // Decrypt AES key using RSA
  PublicKey pubKey = stringToPublicKey(publicKey);
  byte[] aesKey = decryptRSA(encryptedAesKey, pubKey);  // 16 bytes

  // Decrypt file using AES
  Cipher cipher = Cipher. getInstance("AES/GCM/NoPadding");
  cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey, 0, aesKey.length, "AES"), new GCMParameterSpec(128, iv));
  byte[] decrypted = cipher.doFinal(readFileBytes(file));

  // Write decrypted file
  writeFileBytes(file, decrypted);
}

```

**Step 4: Phone Verifies Checksum**

```java
// After decryption, verify
String calculatedChecksum = calcChecksum(decryptedBundle);  // SHA-256
String expectedChecksum = decryptChecksum(checksumFromServer, publicKey);

if (!calculatedChecksum.equals(expectedChecksum)) {
  throw new IOException("Checksum verification failed!");
}

```

---

## ⚙️ Configuration in App

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "appId": "com. example.app",
      "updateUrl": "<https://api.example.com/updates>",
      "publicKey": "-----BEGIN RSA PUBLIC KEY-----\\nMIGfMA0GCSqGS.. .\\n-----END RSA PUBLIC KEY-----",
      "autoUpdate": true
    }
  }
}
```

---

## 🚀 For Your Custom Backend Implementation

**Minimal API Response (encrypted bundle):**

```tsx
// POST /updates
{
  version: "1.0.0",
  url: "<https://your-s3-bucket.com/bundles/v1.0.0.zip>",
  checksum: "3a4b5c.. .(encrypted)",  // RSA-encrypted SHA256
  sessionKey: "b2c3d4...: xY2+KmL9..."  // IV:RSA-encrypted AES key
}

```

**Minimal API Response (unencrypted):**

```tsx
// POST /updates
{
  version: "1.0.0",
  url: "<https://your-s3-bucket.com/bundles/v1.0.0.zip>",
  checksum: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a"
  // No sessionKey when not encrypted
}

```

The phone will automatically skip decryption if no sessionKey is provided!

Yes, **absolutely it will work! ** You can name your endpoint whatever you want. The plugin doesn't care about the endpoint name - it only cares about the **URL you configure** in `capacitor.config.json`.

Let me explain:

---

## ✅ How the Plugin Finds Your Endpoint

The plugin uses the **URL you provide in the config**, not a hardcoded endpoint name.

### **Your Custom Setup:**

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "appId": "com. example.app",
      "updateUrl": "https://your-api.com/plugin_updates", // YOUR custom path
      "statsUrl": "https://your-api.com/plugin_stats", // YOUR custom path
      "channelUrl": "https://your-api.com/plugin_channels", // YOUR custom path
      "autoUpdate": true
    }
  }
}
```

**What happens:**

```
Phone calls:   POST https://your-api.com/plugin_updates
                    ↓
Your backend receives it and responds
                    ↓
Plugin uses the response
```

---

## 📋 You Can Name Them Anything:

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "updateUrl": "https://api.example.com/v1/check-update",
      "statsUrl": "https://api.example.com/v1/send-analytics",
      "channelUrl": "https://api.example.com/v1/device-channel"
    }
  }
}
```

Or even:

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "updateUrl": "https://api.example.com/my-custom-update-endpoint",
      "statsUrl": "https://api.example.com/analytics",
      "channelUrl": "https://api.example.com/channels"
    }
  }
}
```

**All of these work! ** The endpoint names are completely up to you.

---

## 🎯 Real Example: Custom Backend

### **Your Backend Code:**

```typescript
// custom-api/routes/plugin_updates.ts
app.post("/plugin_updates", async (req, res) => {
  const { app_id, device_id, version_name, platform } = req.body;

  // Your logic here
  const latestVersion = await getLatestVersion(app_id);

  res.json({
    version: latestVersion.name,
    url: latestVersion.download_url,
    checksum: latestVersion.checksum,
  });
});

app.post("/my_custom_stats", async (req, res) => {
  const { app_id, action, device_id } = req.body;

  // Track stats
  await saveStats(app_id, device_id, action);

  res.json({ status: "ok" });
});

app.post("/channels_api", async (req, res) => {
  const { app_id, device_id, channel } = req.body;

  // Handle channels
  await setDeviceChannel(device_id, channel);

  res.json({ channel, status: "ok" });
});
```

### **Your Capacitor Config:**

```json
{
  "plugins": {
    "CapacitorUpdater": {
      "appId": "com.example.app",
      "updateUrl": "https://your-api.com/plugin_updates",
      "statsUrl": "https://your-api.com/my_custom_stats",
      "channelUrl": "https://your-api.com/channels_api",
      "autoUpdate": true
    }
  }
}
```

**Result:** ✅ **Works perfectly!**

```
Phone:   POST https://your-api.com/plugin_updates
          ↓
Backend:  Receives and responds
          ↓
Phone:  Uses response
```

---

## 🔄 How It Works Internally

```typescript
// Inside the plugin code (simplified):
export class CapacitorUpdater {
  updateUrl = "https://your-api.com/plugin_updates";  // From config
  statsUrl = "https://your-api.com/my_custom_stats";
  channelUrl = "https://your-api.com/channels_api";

  async getLatest() {
    // Uses the URL from config, doesn't care about the path
    const response = await fetch(this.updateUrl, {
      method: 'POST',
      body: JSON.stringify({... })
    });
    return response. json();
  }

  async sendStats(action) {
    const response = await fetch(this.statsUrl, {  // Uses YOUR URL
      method: 'POST',
      body: JSON.stringify({... })
    });
    return response.json();
  }
}
```

The plugin **reads the URL from config** and makes the request to **exactly that URL**. No hardcoding, no path detection - it just uses what you tell it to use.

---

## ✨ Benefits of Custom Paths

You can organize your API however you want:

```json
{
  "plugins": {
    "CapacitorUpdater": {
      // Option 1: Separate domains
      "updateUrl": "https://updates.company.com/check",
      "statsUrl": "https://analytics.company.com/track",
      "channelUrl": "https://channels.company.com/manage",

      // Option 2: Nested paths
      "updateUrl": "https://api.company.com/mobile/updates",
      "statsUrl": "https://api.company.com/mobile/analytics",
      "channelUrl": "https://api.company.com/mobile/channels",

      // Option 3: Versioned API
      "updateUrl": "https://api.company.com/v2/plugin/updates",
      "statsUrl": "https://api.company.com/v2/plugin/stats",
      "channelUrl": "https://api.company.com/v2/plugin/channels"
    }
  }
}
```

All work exactly the same! ✅

---

## ⚠️ Important: Request Format Stays the Same

**The endpoint name doesn't matter, but the request/response format MUST stay the same:**

```typescript
// Your /plugin_updates endpoint MUST handle:
POST /plugin_updates
Content-Type: application/json

{
  app_id: "com.example. app",
  device_id:  "uuid-.. .",
  version_name: "1.0.0",
  version_build: "100",
  platform: "ios",
  is_emulator: false,
  is_prod: true
}

// And return:
{
  version: "1.1.0",
  url: "https://...",
  checksum: ".. .",
  sessionKey?:  "..." // optional
}
```

The request body and response format are **fixed by the plugin** - you can't change those. But the URL path is **100% customizable**.

---

## 🎉 TL;DR

| Aspect                      | Default                             | Your Custom                           |
| --------------------------- | ----------------------------------- | ------------------------------------- |
| Update URL                  | `https://plugin. capgo.app/updates` | `https://your-api.com/plugin_updates` |
| Can you change it?          | ✅ Yes                              | ✅ Yes                                |
| Does endpoint name matter?  | ❌ No                               | ❌ No                                 |
| Does URL path matter?       | ✅ Yes (must match config)          | ✅ Yes (must match config)            |
| Does request format change? | ❌ No                               | ❌ No                                 |

**So yes, use `/plugin_updates` if you want! ** 🚀
