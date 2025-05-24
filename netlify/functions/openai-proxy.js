// netlify/functions/openai-proxy.js

const { Configuration, OpenAIApi } = require("openai");
const Busboy = require("busboy");

exports.handler = async (event) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
    };
  }

  const config = new Configuration({ apiKey: OPENAI_API_KEY });
  const openai = new OpenAIApi(config);

  // Always allow POST from browser
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // ─── IMAGE UPLOAD PATH ─────────────────────
  if (
    event.httpMethod === "POST" &&
    event.headers["content-type"]?.startsWith("multipart/form-data")
  ) {
    // parse multipart body
    const busboy = Busboy({ headers: event.headers });
    let fileBuffer = null;

    busboy.on("file", (_fieldname, stream) => {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => fileBuffer = Buffer.concat(chunks));
    });

    await new Promise((resolve, reject) =>
      busboy.on("finish", resolve)
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
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "No image file received." }),
      };
    }

    // Convert to base64 data URL
    const dataUrl = `data:image/jpeg;base64,${fileBuffer.toString("base64")}`;

    try {
      // Use GPT-4o vision in Chat API
      const visionRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user",
            content: [
              { type: "text", text: "Please identify and describe this herb image." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
      });

      const description = visionRes.choices[0].message.content;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ description }),
      };

    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Vision request failed", details: err.message }),
      };
    }
  }

  // ─── CHAT COMPLETION PATH ────────────────────
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid JSON payload" }),
      };
    }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "`messages` must be an array" }),
      };
    }

    try {
      const chatRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
      });
      const reply = chatRes.choices[0].message.content;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ reply }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Chat request failed", details: err.message }),
      };
    }
  }

  // ─── METHOD NOT ALLOWED ─────────────────────
  return {
    statusCode: 405,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
