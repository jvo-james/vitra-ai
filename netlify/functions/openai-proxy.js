/*
  netlify/functions/openai-proxy.js
  A CommonJS Netlify Function to proxy to OpenAI Chat Completions
*/

// If you're on Node 18+ you already have fetch; otherwise install node-fetch and uncomment below
// const fetch = require("node-fetch");

exports.handler = async function(event, context) {
  try {
    const { OPENAI_API_KEY } = process.env;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const { messages } = JSON.parse(event.body);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
      }),
    });

    const data = await resp.json();
    return {
      statusCode: resp.ok ? 200 : resp.status,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
