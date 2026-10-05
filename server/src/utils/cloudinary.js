import cloudinaryPkg from 'cloudinary';
import { promisify } from 'util';

// `cloudinary`'s main export is the v2 API in most versions; some interop layers
// expose it under a `.v2` key. Support both.
const cloudinary = cloudinaryPkg.v2 || cloudinaryPkg;

/**
 * Cloudinary integration for persistent, CDN-hosted listing images.
 *
 * Historically listing images were written to Render's local `uploads/` directory,
 * which is EPHEMERAL (wiped on every deploy / instance restart). That is why
 * images showed as placeholders in production even though they worked locally.
 *
 * When Cloudinary credentials are present, uploads go to Cloudinary and the
 * stable CDN URL (`secure_url`) is what gets stored in the database. If
 * Cloudinary is NOT configured (e.g. local dev without credentials), the
 * controllers fall back to the original local-disk URL so the app still works.
 *
 * Configure via EITHER:
 *   CLOUDINARY_URL="cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
 *   or the individual variables:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function getConfig() {
  if (CLOUDINARY_URL) return { url: CLOUDINARY_URL };
  if (CLOUD_NAME && API_KEY && API_SECRET) {
    return { cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET };
  }
  return null;
}

/** True when Cloudinary credentials are available. */
export function isCloudinaryConfigured() {
  return Boolean(getConfig());
}

/**
 * Upload a local file to Cloudinary.
 * @param {string} localFilePath absolute path to the temp file on disk (from multer).
 * @param {string} [folder] Cloudinary subfolder.
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 * @throws {Error} with code CLOUDINARY_NOT_CONFIGURED when no credentials are set.
 */
export function uploadToCloudinary(localFilePath, folder = 'ke_amrach/listings') {
  const config = getConfig();
  if (!config) {
    const err = new Error('Cloudinary is not configured');
    err.code = 'CLOUDINARY_NOT_CONFIGURED';
    throw err;
  }
  cloudinary.config(config);
  const uploader = promisify(cloudinary.uploader.upload);
  return uploader(localFilePath, {
    folder,
    resource_type: 'image',
    use_filename: true,
    overwrite: true,
    transformation: [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto' }],
  });
}
