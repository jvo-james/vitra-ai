// netlify/functions/openai-proxy.js
const { Configuration, OpenAIApi } = require("openai");
const fetch = require("node-fetch");        // For chat endpoint
const Busboy = require("busboy");           // For multipart parsing

exports.handler = async (event) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const config = new Configuration({ apiKey: OPENAI_API_KEY });
  const openai = new OpenAIApi(config);

  // 1) IMAGE UPLOAD PATH
  if (
    event.httpMethod === "POST" &&
    event.headers["content-type"]?.startsWith("multipart/form-data")
  ) {
    // Parse the multipart body to extract the image buffer
    const bb = Busboy({ headers: event.headers });
    let fileBuffer = null;

    bb.on("file", (_fieldname, fileStream) => {
      const chunks = [];
      fileStream.on("data", (chunk) => chunks.push(chunk));
      fileStream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    // Wait for Busboy to finish parsing
    await new Promise((resolve, reject) =>
      bb.on("finish", resolve).on("error", reject).end(
        event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body
      )
    );

    if (!fileBuffer) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No file received." }),
      };
    }

    // Call OpenAI’s Vision endpoint (replace with actual model/method)
    const visionRes = await openai.createImageClassification({
      model: "vision-alpha",
      file: fileBuffer,
      // ... any other params like threshold
    });

    // Extract and return structured JSON
    return {
      statusCode: 200,
      body: JSON.stringify({
        name: visionRes.data.name,
        uses: visionRes.data.uses,
        cautions: visionRes.data.cautions,
        regions: visionRes.data.regions,
      }),
    };
  }

  // 2) CHAT COMPLETION PATH
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON" };
    }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return { statusCode: 400, body: "Missing `messages` array." };
    }

    // Forward to OpenAI chat/completions
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
      }),
    });

    const data = await resp.json();
    return {
      statusCode: resp.ok ? 200 : resp.status,
      body: JSON.stringify(data),
    };
  }

  // METHOD NOT ALLOWED
  return {
    statusCode: 405,
    headers: { Allow: "POST" },
    body: "Method Not Allowed",
  };
};
