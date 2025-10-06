import crypto from "crypto";

/**
 * Calculate SHA256 checksum for a buffer
 */
export function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate a random bundle ID
 */
export function generateBundleId(): string {
  return `bundle-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/**
 * Validate semantic version format
 */
export function isValidSemver(version: string): boolean {
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}
