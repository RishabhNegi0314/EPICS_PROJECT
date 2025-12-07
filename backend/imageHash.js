// imageHash.js (uses sharp)
const sharp = require('sharp');
const axios = require('axios');

/**
 * computeImageHash(imageUrl)
 * - fetches image bytes (axios)
 * - resizes to 8x8 grayscale using sharp
 * - computes average hash (64 bits) and returns hex string (16 hex chars)
 */
async function computeImageHash(imageUrl) {
  try {
    // fetch remote image as arraybuffer
    const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const buffer = Buffer.from(resp.data, 'binary');

    // use sharp to resize to 8x8 and get greyscale raw pixels
    // ensure format is greyscale 8-bit, 8x8, single channel
    const img = sharp(buffer).resize(8, 8, { fit: 'fill' }).grayscale().raw();
    const { data, info } = await img.toBuffer({ resolveWithObject: true });

    // data is Uint8Array length 64 (one byte per pixel)
    if (!data || data.length < 64) {
      throw new Error('Invalid image buffer/size');
    }

    // compute average luminance
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;

    // build 64-bit binary string (1 if > avg)
    let bits = '';
    for (let i = 0; i < data.length; i++) {
      bits += data[i] > avg ? '1' : '0';
    }

    // convert binary to hex (pad to 16 hex chars)
    const hex = BigInt('0b' + bits).toString(16).padStart(16, '0');
    return hex;
  } catch (err) {
    throw new Error('computeImageHash error: ' + (err.message || err));
  }
}

module.exports = { computeImageHash };
