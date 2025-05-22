import fetch from 'node-fetch'

export async function handler(event) {
  const { OPENAI_API_KEY } = process.env
  const { messages } = JSON.parse(event.body)

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${OPENAI_API_KEY}\`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages
    }),
  })

  const data = await resp.json()
  return {
    statusCode: resp.ok ? 200 : 500,
    body: JSON.stringify(data),
  }
}
