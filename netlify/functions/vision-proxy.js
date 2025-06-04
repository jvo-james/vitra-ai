

let BusboyPkg = require('busboy');
const Busboy = (BusboyPkg && BusboyPkg.default) ? BusboyPkg.default : BusboyPkg;

const vision = require('@google-cloud/vision');

exports.handler = async function(event, context) {
  return new Promise((resolve, reject) => {
    try {
      const headers = event.headers || {};

           const busboy = new Busboy({ headers });

      let fileBuffer = Buffer.alloc(0);

      busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
        fileStream.on('data', (chunk) => {
          fileBuffer = Buffer.concat([fileBuffer, chunk]);
        });
      });

      busboy.on('finish', async () => {
        try {
          if (!fileBuffer || fileBuffer.length === 0) {
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: 'No file uploaded.' })
            });
            return;
          }

             const client = new vision.ImageAnnotatorClient();
          const [result] = await client.labelDetection({ image: { content: fileBuffer } });
          const labels = result.labelAnnotations || [];
          const name = labels.length ? labels[0].description : 'Unknown Plant';

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
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: visionErr.message || visionErr.toString() })
          });
        }
      });

          const encoding = event.isBase64Encoded ? 'base64' : 'binary';
      const rawBody = Buffer.from(event.body || '', encoding);
      busboy.end(rawBody);
    } catch (outerErr) {
      reject(outerErr);
    }
  });
};

            
