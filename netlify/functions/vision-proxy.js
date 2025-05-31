// File: netlify/functions/vision-proxy.js

const vision = require('@google-cloud/vision');
const Busboy = require('busboy');

exports.handler = async (event, context) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // We return a Promise because Busboy is callback-based
  return new Promise((resolve, reject) => {
    // Reconstruct the raw buffer from event.body (base64 or binary)
    const buffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    // Busboy expects actual HTTP headers, so pull them from event.headers:
    const bb = new Busboy({ headers: event.headers });

    let fileBuffer = Buffer.alloc(0);

    // When Busboy parses the file field, accumulate the chunks into fileBuffer
    bb.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
      fileStream.on('data', (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    // When parsing is finished, call Vision API
    bb.on('finish', async () => {
      try {
        // Instantiate a Vision client using the environment variables
        // Make sure you have set the following in Netlify UI (or via CLI):
        //   GCP_PROJECT_ID
        //   GOOGLE_CLIENT_EMAIL
        //   GOOGLE_PRIVATE_KEY  (with newline characters encoded as actual \n)
        const client = new vision.ImageAnnotatorClient({
          projectId: process.env.GCP_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
        });

        // Call labelDetection (you can swap to faceDetection, textDetection, etc. as desired)
        const [result] = await client.labelDetection({ image: { content: fileBuffer } });

        // Build a simple JSON response containing the top 5 labels
        const labels = (result.labelAnnotations || [])
          .slice(0, 5)
          .map((annotation) => annotation.description);

        return resolve({
          statusCode: 200,
          body: JSON.stringify({ labels }),
        });
      } catch (err) {
        console.error('Vision API error', err);
        return resolve({
          statusCode: 500,
          body: JSON.stringify({ error: err.message || 'Vision failed' }),
        });
      }
    });

    // Kick off Busboy parsing by writing the raw buffer
    bb.end(buffer);
  });
};


