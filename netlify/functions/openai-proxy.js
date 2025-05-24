// netlify/functions/openai-proxy.js
const OpenAI = require("openai");
const Busboy = require("busboy");

exports.handler = async (event, context) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return { statusCode: 500, body: "Missing OPENAI_API_KEY" };
  }

  // instantiate V4 client
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";

  // 1) IMAGE UPLOAD
  if (event.httpMethod === "POST" && contentType.startsWith("multipart/form-data")) {
    const bb = Busboy({ headers: event.headers });
    let fileBuffer;
    bb.on("file", (_fieldname, stream) => {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => fileBuffer = Buffer.concat(chunks));
    });
    await new Promise((res, rej) =>
      bb.on("finish", res).on("error", rej).end(
        event.isBase64Encoded
          ? Buffer.from(event.body, "base64")
          : event.body
      )
    );
    if (!fileBuffer) return { statusCode: 400, body: "No file received." };

    try {
      // for now use chat to generate a description; swap in the real Vision API when released
      const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an image classifier. Describe this plant." },
          { role: "user", content: "<binary image data>" }
        ]
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ description: chat.choices[0].message.content.trim() })
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // 2) CHAT COMPLETIONS
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: "Invalid JSON" }; }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return { statusCode: 400, body: "Missing `messages` array." };
    }

    try {
      const chatRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages
      });
      return {
        statusCode: 200,
        body: JSON.stringify(chatRes)
      };
    } catch (err) {
      return {
        statusCode: err.status || 500,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: { Allow: "POST" },
    body: "Method Not Allowed"
  };
};
