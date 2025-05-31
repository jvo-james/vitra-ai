import Busboy from "busboy";
import { Storage } from "@google-cloud/storage";
import { Vision } from "@google-cloud/vision";

export async function handler(event, context) {
  // 1) Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
    };
  }

  // 2) Check credentials env var
  const base64Key = process.env.VISION_CREDENTIALS_BASE64;
  if (!base64Key) {
    console.error("Missing VISION_CREDENTIALS_BASE64");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing VISION_CREDENTIALS_BASE64 env var." }),
    };
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(base64Key, "base64").toString("utf-8"));
  } catch (e) {
    console.error("Invalid base64 JSON for credentials:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON in VISION_CREDENTIALS_BASE64." }),
    };
  }

  // 3) Initialize Google Cloud clients
  const storage = new Storage({ credentials });
  const vision = new Vision({ credentials });

  return new Promise((resolve) => {
    const busboy = new Busboy({ headers: event.headers });

    let uploadFileBuffer = null;
    let uploadFileName = null;

    // 4) Listen for the “file” field
    busboy.on("file", (fieldname, fileStream, filename, encoding, mimetype) => {
      if (fieldname !== "file") {
        // Skip any unexpected fields
        fileStream.resume();
        return;
      }
      uploadFileName = filename;
      const chunks = [];
      fileStream.on("data", (chunk) => {
        chunks.push(chunk);
      });
      fileStream.on("end", () => {
        uploadFileBuffer = Buffer.concat(chunks);
      });
    });

    // 5) Handle Busboy errors
    busboy.on("error", (err) => {
      console.error("Busboy parsing error:", err);
      resolve({
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid multipart/form-data." }),
      });
    });

    // 6) When Busboy finishes parsing
    busboy.on("finish", async () => {
      if (!uploadFileBuffer) {
        console.error("No file uploaded under field 'file'");
        resolve({
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "No file uploaded under field ‘file’." }),
        });
        return;
      }

      try {
        // 7) Ensure a bucket exists (use project_id + "-vision-temp")
        const bucketName = `${credentials.project_id}-vision-temp`;
        const bucket = storage.bucket(bucketName);

        // Check if bucket exists; if not, create it
        const [exists] = await bucket.exists();
        if (!exists) {
          await storage.createBucket(bucketName);
        }

        // 8) Upload the buffer into a temporary file
        const timestamp = Date.now();
        const tempFilePath = `uploads/${timestamp}-${uploadFileName}`;
        const tempFile = bucket.file(tempFilePath);
        await tempFile.save(uploadFileBuffer);

        // 9) Call Vision API (we do a simple labelDetection demo)
        const [labelResult] = await vision.labelDetection({
          source: { imageUri: `gs://${bucketName}/${tempFilePath}` },
        });

        // 10) Parse labels into name/uses/cautions/regions
        const labels = (labelResult.labelAnnotations || []).map((l) => l.description);
        const name = labels[0] || "Unknown Plant";
        const uses = labels.slice(1, 4).join(", ") || "N/A";
        const cautions = labels.slice(4, 7).join(", ") || "N/A";
        const regions = []; // or you could try a regionDetection request

        // 11) Clean up: delete the temp file from bucket
        await tempFile.delete().catch((err) => {
          console.warn("Could not delete temp file:", err);
        });

        // 12) Return success JSON
        resolve({
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, uses, cautions, regions }),
        });
      } catch (e) {
        console.error("Vision or Storage error:", e);
        resolve({
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Vision API request failed: " + e.message }),
        });
      }
    });

    // 13) Kick off Busboy with the raw body
    busboy.end(
      Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
    );
  });
}

// EOF
