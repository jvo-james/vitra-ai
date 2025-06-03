
const Busboy = require('busboy')         // this must point at the actual constructor
const { Storage } = require('@google-cloud/storage')  // if you’re using GCS
const vision = require('@google-cloud/vision')        // or whichever Vision SDK you use

exports.handler = async function(event, context) {
  return new Promise((resolve, reject) => {
    try {
      // 2) Parse the multipart/form-data with Busboy
      //    Netlify passes you event.headers and event.body (base64 if isBase64Encoded is true)
      const headers = event.headers || {}
      const busboy = new Busboy({ headers })
      let fileBuffer = Buffer.alloc(0)

      // When Busboy sees a file field, accumulate its data into a Buffer
      busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
        fileStream.on('data', (chunk) => {
          fileBuffer = Buffer.concat([fileBuffer, chunk])
        })
      })

      // When Busboy is done parsing, call Vision API on the Buffer
      busboy.on('finish', async () => {
        try {
          if (!fileBuffer || fileBuffer.length === 0) {
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: 'No file uploaded.' })
            })
            return
          }

          // 3) Example: call Google Cloud Vision to label the image
          //    (Replace this with your own “identify herb” logic)
          const client = new vision.ImageAnnotatorClient()
          const [result] = await client.labelDetection({ image: { content: fileBuffer } })

          // For illustration, we just pick the top label as “name”:
          const labels = result.labelAnnotations || []
          const name = labels.length ? labels[0].description : 'Unknown Plant'

          // Return a JSON payload that your front end code can consume:
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              uses: 'Example uses go here',
              cautions: 'Example cautions go here',
              regions: ['Region A', 'Region B']
            })
          })
        } catch (visionErr) {
       
                    resolve({
            statusCode: 500,
            body: JSON.stringify({ error: visionErr.message || visionErr.toString() })
          })
        }
      })

      // 4) Netlify gives you event.body as a string; if base64‐encoded, convert first
      const encoding = event.isBase64Encoded ? 'base64' : 'binary'
      const rawBody = Buffer.from(event.body || '', encoding)
      busboy.end(rawBody)
    } catch (outerErr) {
      reject(outerErr)
    }
  })
}
