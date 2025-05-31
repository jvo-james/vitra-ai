// .netlify/functions/vision-proxy.js

/**
 * Netlify Function: vision-proxy
 *
 * 1) Expects a POST request with Content-Type: multipart/form-data (key: "file").
 * 2) Decodes the base64 GOOGLE Service Account JSON from VISION_CREDENTIALS_BASE64.
 * 3) Initializes Google Vision client, runs LABEL_DETECTION on the uploaded image buffer.
 * 4) Returns {
 *       name: "<top_label>",
 *       uses: "…",
 *       cautions: "…",
 *       regions: []
 *    }
 *
 * Before deploying, make sure:
 *  - You set the Netlify env var VISION_CREDENTIALS_BASE64 to a base64‐encoded
 *    version of your service account key file.
 */

const Busboy = require('busboy');
const vision = require('@google-cloud/vision');

exports.handler = async function (event, context) {
  try {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Allow': 'POST' },
        body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
      };
    }

    // Content-Type must be multipart/form-data
    const contentType =
      event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.startsWith('multipart/form-data')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
      };
    }

    // Decode the base64 service account JSON from environment
    const base64Creds = process.env.VISION_CREDENTIALS_BASE64;
    if (!base64Creds) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            'Server misconfiguration: missing VISION_CREDENTIALS_BASE64 environment variable.',
        }),
      };
    }
    // Convert base64 → Buffer → string → JSON
    const serviceAccountJson = JSON.parse(
      Buffer.from(base64Creds, 'base64').toString('utf8')
    );

    // Initialize Google Vision client with those credentials
    const client = new vision.ImageAnnotatorClient({
      credentials: serviceAccountJson,
    });

    // Parse multipart/form-data via Busboy to extract the uploaded file
    let fileBuffer = null;
    let fileName = null;

    // Return a promise that resolves when Busboy finishes parsing
    await new Promise((resolve, reject) => {
      const busboy = new Busboy({ headers: { 'content-type': contentType } });

      busboy.on(
        'file',
        (fieldname, fileStream, info /* { filename, mimeType } */) => {
          fileName = info.filename || 'upload';
          const chunks = [];
          fileStream.on('data', (data) => chunks.push(data));
          fileStream.on('end', () => {
            fileBuffer = Buffer.concat(chunks);
          });
        }
      );

      busboy.on('error', (err) => reject(err));
      busboy.on('finish', () => {
        if (!fileBuffer) {
          reject(new Error('No file uploaded.'));
        } else {
          resolve();
        }
      });

      // Netlify passes the body as base64, so convert back
      const decoded = Buffer.from(event.body, 'base64');
      busboy.end(decoded);
    });

    // If we reach here, fileBuffer contains the image bytes
    // Call Google Vision labelDetection
    const [visionResult] = await client.labelDetection({
      image: { content: fileBuffer },
    });

    const labels = (visionResult.labelAnnotations || []).map((label) => ({
      description: label.description,
      score: label.score,
    }));

    // Take the top‐scoring label
    const topLabel = labels.length > 0 ? labels[0].description : 'Unknown Plant';

    // Placeholder response – you can hook in your own “uses/cautions/regions” lookup.
    const out = {
      name: topLabel,
      uses: `Medicinal uses for "${topLabel}" to be populated from your database.`,
      cautions: `Cautions for "${topLabel}" to be populated from your database.`,
      regions: [], // e.g. ["West Africa", "Southeast Asia"], etc.
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
    };
  } catch (err) {
    console.error('vision-proxy error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Vision API call failed.' }),
    };
  }
};
