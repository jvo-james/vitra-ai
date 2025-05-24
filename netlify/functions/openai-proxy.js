// netlify/functions/openai-proxy.js

const { Configuration, OpenAIApi } = require("openai");
const Busboy = require("busboy");

exports.handler = async (event) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing OpenAI API key in environment." }),
    };
  }

  const config = new Configuration({ apiKey: OPENAI_API_KEY });
  const openai = new OpenAIApi(config);

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // === IMAGE PATH ===
  if (
    event.httpMethod === "POST" &&
    event.headers["content-type"]?.startsWith("multipart/form-data")
  ) {
    const busboy = Busboy({ headers: event.headers });
    let fileBuffer = null;

    busboy.on("file", (_fieldname, fileStream) => {
      const chunks = [];
      fileStream.on("data", (chunk) => chunks.push(chunk));
      fileStream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    await new Promise((resolve, reject) =>
      busboy.on("finish", resolve).on("error", reject).end(
        event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body
      )
    );

    if (!fileBuffer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file uploaded." }),
      };
    }

    const base64Image = fileBuffer.toString("base64");

    try {
      const visionRes = await openai.createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image in detail." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          response: visionRes.data.choices[0].message.content,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Vision API error", details: err.message }),
      };
    }
  }

  // === CHAT COMPLETION PATH ===
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "`messages` array is required." }),
      };
    }

    try {
      const chatRes = await openai.createChatCompletion({
        model: "gpt-4o",
        messages,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          response: chatRes.data.choices[0].message.content,
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Chat API error", details: err.message }),
      };
    }
  }

  // === METHOD NOT ALLOWED ===
  return {
    statusCode: 405,
    headers: { ...headers, Allow: "POST" },
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
