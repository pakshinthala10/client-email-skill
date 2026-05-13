export default async function handler(req, res) {

  // Allow the browser to talk to this function
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight check
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, clientPageId, prompt } = req.body;

  // Notion request headers — token stays secret on the server
  const notionHeaders = {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {

    // ── Action 1: Load all clients from Notion ──────────────────
    if (action === 'getClients') {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${process.env.CLIENTS_DB_ID}/query`,
        {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            sorts: [{ property: 'Client Name', direction: 'ascending' }]
          })
        }
      );
      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Action 2: Load tasks for a specific client ──────────────
    if (action === 'getTasks') {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${process.env.TASKS_DB_ID}/query`,
        {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            filter: {
              property: 'Client',
              relation: { contains: clientPageId }
            }
          })
        }
      );
      const data = await response.json();
      return res.status(200).json(data);
    }

    // ── Action 3: Generate email via Claude ─────────────────────
    if (action === 'generateEmail') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();

      // Surface the real Anthropic error so it shows in the UI
      if (!response.ok || data.error) {
        const errMsg = data.error?.message || JSON.stringify(data);
        return res.status(200).json({
          error: `Anthropic error (${response.status}): ${errMsg}`
        });
      }

      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
