

let BusboyPkg = require('busboy');
const Busboy = (BusboyPkg && BusboyPkg.default) ? BusboyPkg.default : BusboyPkg;

const vision = require('@google-cloud/vision');

exports.handler = async function(event, context) {
  return new Promise((resolve, reject) => {
    try {
      // ─── A) Pull headers from Netlify event
      const headers = event.headers || {};

      // ─── B) Instantiate Busboy using those headers
      //      (if Busboy is still not a constructor, this will blow up here again)
      const busboy = new Busboy({ headers });

      let fileBuffer = Buffer.alloc(0);

      // ─── C) When “file” fields arrive, accumulate into a single Buffer
      busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
        fileStream.on('data', (chunk) => {
          fileBuffer = Buffer.concat([fileBuffer, chunk]);
        });
      });

      // ─── D) When parsing finishes, call Vision (or your “identify‐herb” code)
      busboy.on('finish', async () => {
        try {
          if (!fileBuffer || fileBuffer.length === 0) {
            // No file was actually uploaded
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: 'No file uploaded.' })
            });
            return;
          }

          // ─── E) Example: use Google Cloud Vision to do a simple label detection.
          //      Replace with your own “herb identification” logic as needed.
          const client = new vision.ImageAnnotatorClient();
          const [result] = await client.labelDetection({ image: { content: fileBuffer } });
          const labels = result.labelAnnotations || [];
          const name = labels.length ? labels[0].description : 'Unknown Plant';

          // ─── F) Build whatever JSON the front end expects.  For example:
          const responsePayload = {
            name,
            uses: 'Example uses would go here',
            cautions: 'Example cautions would go here',
            regions: ['Region A', 'Region B']
          };

          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responsePayload)
          });
        } catch (visionErr) {
          // If Vision‐API (or your identify logic) fails, send back its message
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: visionErr.message || visionErr.toString() })
          });
        }
      });

      // ─── G) Netlify gives you event.body as a string.
      //      If isBase64Encoded is true, decode from base64; otherwise treat as binary.
      const encoding = event.isBase64Encoded ? 'base64' : 'binary';
      const rawBody = Buffer.from(event.body || '', encoding);
      // Feed all of that raw multipart body into Busboy
      busboy.end(rawBody);
    } catch (outerErr) {
      reject(outerErr);
    }
  });
};

            
