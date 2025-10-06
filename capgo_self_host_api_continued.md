# Capgo Self-Hosted API — Continued (Implementation & Operational Details)

This document continues and extends the main API doc (Capgo-self-host-api). It provides implementation-ready details (DB schemas, request/response examples, full manifest examples, checksum/encryption guidance, operational checklist, troubleshooting, and mapping to plugin states) so you can implement and operate a Node backend compatible with the Cap-go capacitor-updater plugin.

> **Note:** This is NOT server code. It is a full implementation and operations guide to help you design your Node backend and infrastructure.

---

## Table of contents (continued)
- A. Bundle / bundle metadata full schema
- B. Manifest — extended example and recommended fields
- C. Device & channel DB schema (suggested)
- D. Updates DB schema (suggested)
- E. Stats / telemetry DB schema (suggested)
- F. Download flow (step-by-step, including plugin side expectations)
- G. Checksum and encryption details (recommended algorithms & edge cases)
- H. HTTP headers, content-type, CORS and caching recommendations
- I. Security & authentication (recommended approaches)
- J. Monitoring, logging & observability
- K. Testing checklist (manual & automated tests)
- L. Troubleshooting & common error scenarios
- M. Mapping plugin events to server-side actions / logs

---

## A. Bundle / bundle metadata — full schema (server-side representation)
This is the full shape you should persist for each published bundle/version on the server. The plugin expects `version`/`version_name` and `url` + optional `checksum` and `session_key`.

```yaml
BundleRecord:
  id: string                  # internal DB id (uuid or numeric)
  version: string             # semantic version or internal version string
  version_name: string        # same as version or human label
  channel: string             # channel id (stable, beta, etc.)
  url: string                 # public URL to ZIP file or manifest
  manifest_url?: string       # optional URL that returns manifest array
  manifest?: array            # optional embedded manifest entries
  checksum?: string           # sha256 hex of file
  session_key?: string        # base64 session key if encrypted
  public_key_id?: string      # identifier for server key used for encryption
  created_at: timestamp
  published_at: timestamp
  size_bytes?: integer
  metadata?: object           # arbitrary metadata (release notes, required os, etc.)
  release_notes?: string
  active: boolean
```

**Notes:**
- `url` should be a stable CDN URL or object storage location served over HTTPS.
- If you use `manifest_url` provide a JSON array compatible with the manifest schema below.

---

## B. Manifest — extended example and recommended fields
A manifest allows per-file delivery instead of bundling everything in a single ZIP. The plugin will accept a manifest array; make sure each entry contains at least `path` and `url`.

Recommended manifest entry fields:
```yaml
ManifestEntry:
  path: string          # file path in final bundle (e.g. index.html)
  url: string           # downloadable URL
  checksum?: string     # sha256 hex (optional but recommended)
  content_type?: string # MIME type (optional)
  size?: integer        # file size in bytes (optional)
  headers?: object      # optional headers to instruct client, e.g. cache-control
```

Full example manifest (JSON):
```json
[
  { "path": "index.html", "url": "https://cdn.example.com/bundles/v1/index.html", "checksum": "..." },
  { "path": "assets/main.js", "url": "https://cdn.example.com/bundles/v1/main.js", "checksum": "..." },
  { "path": "assets/style.css", "url": "https://cdn.example.com/bundles/v1/style.css" }
]
```

**Behavioral notes:**
- When manifest is present the plugin sets `isManifest=true` and the download worker will use the manifest to fetch assets individually.
- Providing per-file `checksum` improves integrity checks and troubleshooting.

---

## C. Device & channel DB schema (suggested)
A minimal schema to map `device_id` (or `custom_id`) to channel and store metadata.

### SQL (relational) suggested tables (conceptual)
```sql
-- devices table
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  custom_id VARCHAR(255),
  app_id VARCHAR(255) NOT NULL,
  last_seen TIMESTAMP,
  last_version_name VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

-- channels table
CREATE TABLE channels (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128),
  public BOOLEAN DEFAULT TRUE,
  allow_self_set BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

-- device_channel mapping
CREATE TABLE device_channels (
  id SERIAL PRIMARY KEY,
  device_id_fk INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  channel_id VARCHAR(64) REFERENCES channels(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(device_id_fk)
);
```

**NoSQL variant:** store each device doc with a `channel` field and device metadata. Channels can be a separate collection.

---

## D. Updates DB schema (suggested)
A simple table to store published bundles and their assignment to channels.

```sql
CREATE TABLE bundles (
  id SERIAL PRIMARY KEY,
  version VARCHAR(64) NOT NULL,
  version_name VARCHAR(128),
  channel_id VARCHAR(64) REFERENCES channels(id),
  url TEXT NOT NULL,
  manifest_url TEXT,
  checksum VARCHAR(128),
  session_key TEXT,
  size_bytes BIGINT,
  published_at TIMESTAMP DEFAULT now(),
  release_notes TEXT,
  active BOOLEAN DEFAULT true
);
```

**Indexes:** add indexes on `(channel_id, version)` and `(app_id, published_at)` if you support multi-app hosting.

---

## E. Stats / telemetry DB schema (suggested)
Server should accept records posted to `statsUrl`. Persist minimally for analytics and debugging.

```sql
CREATE TABLE stats (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255),
  app_id VARCHAR(255),
  action VARCHAR(128),
  version_name VARCHAR(128),
  old_version_name VARCHAR(128),
  created_at TIMESTAMP DEFAULT now(),
  details JSONB
);
```

**Retention:** consider rolling up or deleting old stats after a retention period to save space.

---

## F. Download flow — step-by-step
This sequence describes the round trip and what the server should do/return. It mirrors plugin behavior.

1. **Device -> `updateUrl` POST** with `InfoObject` (device/app metadata). Optionally includes `defaultChannel`.
2. **Server logic**:
   - Determine device channel: lookup device mapping or use default channel.
   - Find latest active bundle for that app & channel newer than `version_name` in `InfoObject`.
   - If no update -> return either `{ "message": "no_update" }` or `200 {}` with no update fields.
   - If update -> decide `url` (ZIP) or `manifest`.
   - If encrypted: generate `session_key` and store mapping to allow client to decrypt via plugin's `CryptoCipher`. Also set `checksum`.
3. **Plugin** receives update response and validates fields.
4. **Plugin** performs `GET` to `url` and downloads `zip` OR fetches manifest entries.
5. If `session_key` present plugin decrypts and validates `checksum`.
6. Plugin unzips/arranges files and sets as next bundle.
7. Plugin calls `sendStats` with `action` values during lifecycle events (download, set, reset, checksum_fail, finish_download).

---

## G. Checksum and encryption details

### Checksum
- **Algorithm:** Use SHA-256 (hex string). Example size: 64 hex characters.
- **Field name:** `checksum` in update response.
- **Behavior:** Plugin computes `CryptoCipher.calcChecksum(downloaded)` and compares to supplied `checksum`. If mismatch: send `checksum_fail` and abort.

### Session key / encryption
- **Field name:** `session_key` (base64-encoded string returned in update JSON).
- **Behavior:** Plugin uses `CryptoCipher.decryptFile(downloaded, publicKey, sessionKey)` where `publicKey` is configured in the plugin. On server-side, you can encrypt the bundle with a symmetric key and encrypt that key with the plugin public key (or whichever cryptographic scheme you choose) and return the encrypted symmetric key as `session_key`.
- **Important:** If the plugin has a `publicKey` configured and `checksum` is missing, the plugin will refuse the download. Provide both `session_key` and `checksum` when using encryption.

**Server tasks when using encryption:**
- Generate a symmetric key per bundle; encrypt ZIP with that key.
- Encrypt symmetric key using plugin public key (or chosen asymmetric key) and return it as `session_key` in base64.
- Provide `checksum` of the encrypted file (or the final file as plugin expects — confirm which the plugin computes). In the Android code the plugin computes checksum after potential decryption step; ensure the checksum you provide matches the plugin's `CryptoCipher.calcChecksum` output for the decrypted file if the plugin expects decrypted checksum.

---

## H. HTTP headers, content-type, CORS and caching recommendations
- **CORS:** If your web app (JS part) calls `updateUrl` from browser context, ensure `Access-Control-Allow-Origin` is set properly. Native plugin calls do not require browser CORS but if you implement UI testing via browsers add CORS.
- **Content-Type:** always return `application/json` for JSON endpoints. Serve bundle files (`.zip`) with `application/zip`.
- **Cache control:**
  - `updateUrl`, `channelUrl`, and `statsUrl` should not be aggressively cached by proxies; use `Cache-Control: no-store` or a short TTL.
  - Bundle files (ZIP, assets) can be cached by CDN. Add `Cache-Control` based on your release policy (long TTL for immutable filenames).
- **Range requests:** support `Accept-Ranges` / `Content-Range` if you want resumable downloads.
- **Compression:** Avoid serving ZIP with gzip - keep zip raw. Do not double-compress.

---

## I. Security & authentication (recommended approaches)
The plugin itself does not mandate authentication. Options:

1. **Open access (no auth):** simplest for internal or small-scale use — rely on obscurity of URLs and HTTPS.
2. **API key header:** require `x-api-key: <key>` for `updateUrl` and `channelUrl`. Store keys per-app.
3. **HMAC signed requests:** verify payload signatures if devices embed client secret.
4. **JWT tokens:** devices receive JWT during app provisioning; plugin includes token in Authorization header.

**Important:** If you add auth, document how to configure the plugin to send auth headers (native side might need updating). If you cannot change plugin headers, you can put authentication at CDN edge (signed URLs) or use IP restrictions.

---

## J. Monitoring, logging & observability
- **Log every `update` request** with: device_id, app_id, current version_name, chosen channel, result (no_update / update returned), bundle_id.
- **Log downloads and checksum results**; have metrics for `download_success`, `download_fail`, `checksum_fail`, `decryption_fail`.
- **Expose metrics (Prometheus)**: counts of update checks, downloads served, errors per type.
- **Sentry / error tracking:** capture unexpected errors parsing plugin requests.

---

## K. Testing checklist (manual & automated tests)
- [ ] `updateUrl` with older `version_name` returns update metadata (url + checksum + session_key optional).
- [ ] `updateUrl` with latest `version_name` returns no-update response.
- [ ] `channelUrl` GET returns channel list; PUT returns device channel; POST sets mapping; DELETE unsets mapping.
- [ ] Stats endpoint accepts events and persists them.
- [ ] ZIP file served is downloadable and has correct content-type.
- [ ] If `session_key` used: client decrypts and checksum validates.
- [ ] Manifest-mode works: `manifest` in update response points to per-file URLs and client can fetch them.
- [ ] Simulate bad checksum and verify plugin reports `checksum_fail` via stats.
- [ ] Simulate `channel_not_found` (HTTP 400 with that string) and test plugin fallback to `defaultChannel`.

---

## L. Troubleshooting & common error scenarios
- **Plugin reports `parse_error`**: server returned invalid JSON or non-JSON; check logs and ensure `Content-Type: application/json`.
- **`response_error`**: non-2xx status code. Check server runtime errors and return proper JSON error body.
- **`server_error` (JSON with `error` key)**: plugin found `error` property in JSON. Make sure your success responses do not include `error` field.
- **`checksum_fail`**: Ensure your checksum algorithm matches plugin's `CryptoCipher.calcChecksum` — SHA-256 hex is recommended. Verify whether checksum must match the decrypted content or encrypted content depending on plugin expectations.
- **`channel_not_found` handling**: to trigger plugin fallback to `defaultChannel`, return HTTP 400 with response body containing the string `channel_not_found`.
- **Large zip download issues**: enable `Accept-Ranges`, ensure your CDN supports large file delivery, and test downloads on slow networks.

---

## M. Mapping plugin events to server-side actions / logs
The plugin calls `sendStats(action, versionName, oldVersionName)` for many events. Capture and map these actions to server logs/metrics.

Common `action` values to log and their meaning (observed in plugin code / typical flows):
- `download` — download started
- `finish_download` — download finished (and installed)
- `set` — plugin set next bundle
- `reset` — plugin reset to builtin
- `checksum_fail` — checksum mismatch
- `download_fail` — generic download failure
- `finish_download_fail` — failure when finishing install
- `delete` — deletion of a bundle requested by plugin

When you receive these actions on `statsUrl`, store them with timestamps and device identifiers for auditing.

---

## Final notes & next deliverables
This continuation contains the operational, DB, manifest, checksum/encryption, testing, and troubleshooting guidance you asked for. It completes the documentation so you can implement both API and supporting infrastructure.

If you want I can now:
- export this `.md` as a downloadable file in the canvas, or
- generate a `capgo-api.yaml` OpenAPI file downloadable inside the canvas (separate file), or
- produce Postman/Insomnia collection JSON (requests only, no server code) you can import to test the API.

Which do you want next?

