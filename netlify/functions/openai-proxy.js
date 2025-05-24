// netlify/functions/openai-proxy.js

const { Configuration, OpenAIApi } = require("openai");
const fetch = require("node-fetch");
const Busboy = require("busboy");

exports.handler = async (event) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const config = new Configuration({ apiKey: OPENAI_API_KEY });
  const openai = new OpenAIApi(config);

  // Handle image uploads
  if (
    event.httpMethod === "POST" &&
    event.headers["content-type"]?.startsWith("multipart/form-data")
  ) {
    const bb = Busboy({ headers: event.headers });
    let fileBuffer = null;

    bb.on("file", (_fieldname, fileStream) => {
      const chunks = [];
      fileStream.on("data", (chunk) => chunks.push(chunk));
      fileStream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    await new Promise((resolve, reject) =>
      bb.on("finish", resolve)
        .on("error", reject)
        .end(
          event.isBase64Encoded
            ? Buffer.from(event.body, "base64")
            : event.body
        )
    );

    if (!fileBuffer) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No file received." }),
      };
    }

    // Replace with actual OpenAI image classification call
    const visionRes = await openai.createImageClassification({
      model: "vision-alpha",
      file: fileBuffer,
    });

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

  // Handle chat completions
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

  // Method not allowed
  return {
    statusCode: 405,
    headers: { Allow: "POST" },
    body: "Method Not Allowed",
  };
};
