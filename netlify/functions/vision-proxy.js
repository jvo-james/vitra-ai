// netlify/functions/vision-proxy.js

/**
 * A Netlify Function that accepts an HTTP POST with a single image file (multipart/form-data),
 * runs Google Cloud Vision API’s textDetection on it, and returns the detected text.
 *
 * This version uses Busboy to parse out the uploaded file buffer entirely in memory,
 * then feeds it directly to @google-cloud/vision. No @google-cloud/storage is required.
 */

const Busboy = require('busboy').default || require('busboy');
const vision = require('@google-cloud/vision');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Allow": "POST" },
      body: "Method Not Allowed. Use POST with multipart/form-data.",
    };
  }

  try {
    // event.headers contains content-type like "multipart/form-data; boundary=----WebKitFormBoundary..."
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.startsWith("multipart/form-data")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid Content-Type. Use multipart/form-data" }),
      };
    }

    // Busboy requires raw headers and a Buffer of the full body. Netlify Functions
    // base64-encodes incoming binary/multipart data, so event.isBase64Encoded is true.
    const bb = new Busboy({ headers: { "content-type": contentType } });

    // We'll collect all data chunks from the file field into this array
    const bufferChunks = [];

    // Convert the base64-encoded body back into a Buffer
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

    // Wrap parsing in a Promise so we can await it easily
    const filePromise = new Promise((resolve, reject) => {
      // When Busboy emits a 'file' event, we get the file stream
      bb.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
        // Only process the first file field; ignore any others
        fileStream.on('data', (chunk) => {
          bufferChunks.push(chunk);
        });
        fileStream.on('end', () => {
          // once file is fully read, continue
        });
      });

      bb.on('error', (err) => {
        reject(err);
      });

      bb.on('finish', () => {
        // All fields/file streams have been processed
        if (bufferChunks.length === 0) {
          return reject(new Error("No file data received"));
        }
        // Combine all buffered chunks into a single Buffer
        const fileBuffer = Buffer.concat(bufferChunks);
        resolve(fileBuffer);
      });

      // Feed the raw buffer into Busboy to start parsing
      bb.end(bodyBuffer);
    });

    // Wait for Busboy to finish reading the file into a Buffer
    const imageBuffer = await filePromise;

    // Instantiate a Vision client
    const client = new vision.ImageAnnotatorClient();

    // Call textDetection (you could choose labelDetection, objectLocalization, etc. if you prefer)
    const [visionResult] = await client.textDetection({
      image: { content: imageBuffer }
    });

    // visionResult.textAnnotations is an array; return the full array as JSON
    return {
      statusCode: 200,
      body: JSON.stringify({
        textAnnotations: visionResult.textAnnotations || [],
        fullText: visionResult.fullTextAnnotation ? visionResult.fullTextAnnotation.text : ""
      })
    };
  } catch (err) {
    // If anything goes wrong—Busboy parse error, Vision error, etc.—return a 500 with details
    return {
      statusCode: 500,
      body: JSON.stringify({
        errorType: err.name,
        errorMessage: err.message || "Unknown error",
        stack: err.stack || null
      })
    };
  }
};

