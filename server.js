import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const NEWSPULSE_API_URL = process.env.NEWSPULSE_API_URL || 'http://localhost:3000/api';

// ─── Background Logs Buffer ──────────────────────────────────────────────
const logs = [];
function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift({ timestamp, message });
  if (logs.length > 200) logs.pop();
  console.log(`[Monitor Log] ${timestamp} - ${message}`);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── RSS Feed Sources Database ──────────────────────────────────────────
const FEED_SOURCES = {
  world: [
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'Al Jazeera World', url: 'https://www.aljazeera.com/xml/rss/all.xml' }
  ],
  technology: [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
  ],
  business: [
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' }
  ],
  science: [
    { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml' }
  ],
  sports: [
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }
  ]
};

// ─── Helper to parse XML tags via Regex (no external dependencies) ──────
function parseTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  if (!match) return '';
  let content = match[1];
  // Clean CDATA wrappers if present
  if (content.startsWith('<![CDATA[')) {
    content = content.substring(9, content.length - 3);
  }
  return content.trim();
}

function parseLink(xml) {
  // Try <link href="url" /> (Atom style)
  const hrefMatch = xml.match(/<link\s+[^>]*href=["']([^"']+)["']/i);
  if (hrefMatch) return hrefMatch[1];
  // Try standard <link>url</link>
  return parseTag(xml, 'link');
}

function parseFeedXml(xmlText, sourceName, category) {
  if (!xmlText) return [];
  const stories = [];
  
  // Split into individual items or entries
  const items = xmlText.split(/<item>|<entry>/i).slice(1);
  
  for (const item of items) {
    const title = parseTag(item, 'title');
    // Read description (RSS) or summary/content (Atom)
    let description = parseTag(item, 'description') || parseTag(item, 'summary') || parseTag(item, 'content');
    
    // Clean HTML tags and entities
    description = description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const link = parseLink(item);
    const pubDate = parseTag(item, 'pubDate') || parseTag(item, 'published') || parseTag(item, 'updated');

    if (title && description.length > 20) {
      // Limit description length to a reasonable size
      const summary = description.length > 280 ? description.substring(0, 280) + '...' : description;
      
      stories.push({
        id: `pending-${Buffer.from(link).toString('base64').substring(0, 16)}`,
        originalHeadline: title,
        originalSummary: summary,
        source: sourceName,
        link: link.startsWith('http') ? link : `https://${link}`,
        category,
        pubDate: pubDate || new Date().toISOString()
      });
    }
  }
  
  return stories;
}

// ─── GET /api/pending - Fetch live RSS feed items ───────────────────────
app.get('/api/pending', async (req, res) => {
  const { category = 'world' } = req.query;
  const sources = FEED_SOURCES[category] || FEED_SOURCES['world'];
  
  logEvent(`RSS Scan: Fetching live channels for category "${category}"`);
  const allStories = [];
  
  for (const source of sources) {
    try {
      console.log(`Fetching feed: ${source.name} (${source.url})`);
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      
      const xmlText = await response.text();
      const parsed = parseFeedXml(xmlText, source.name, category);
      allStories.push(...parsed);
    } catch (e) {
      logEvent(`RSS Error: Failed to pull feed from ${source.name} (${e.message})`);
      console.error(`Failed to fetch/parse ${source.name}:`, e.message);
    }
  }

  // Sort by date (descending)
  allStories.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  logEvent(`RSS Complete: Loaded ${allStories.length} pending articles for "${category}"`);
  res.json(allStories);
});

// ─── POST /api/enhance - Rewrite/Enhance with AI ────────────────────────
app.post('/api/enhance', async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  logEvent(`AI Process: Commencing summary and translations for "${title.substring(0, 35)}..."`);

  const prompt = `You must rewrite the following news article title and description into a JSON structure.
IMPORTANT: You must return ONLY a valid JSON object. Do not wrap key names in any way other than standard JSON quotes. Escape any internal double quotes inside the JSON string values (use \\").
Required JSON format:
{
  "headline": "catchy English headline",
  "summary": "comprehensive 4-5 sentence English summary paragraph loaded with facts/figures",
  "extendedSummary": ["key bullet 1", "key bullet 2", "key bullet 3"],
  "hindiHeadline": "Hindi translation of the headline",
  "hindiSummary": "Hindi translation of the summary paragraph",
  "hindiExtendedSummary": ["Hindi bullet 1", "Hindi bullet 2", "Hindi bullet 3"]
}
Do not include any other markdown, introductory text, explanations, or code blocks. Just return raw JSON.
Title: ${title}
Description: ${description}`;

  try {
    const aiResponse = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(15000)
    });

    if (!aiResponse.ok) {
      throw new Error(`AI service returned HTTP ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    if (!data || !data.response) {
      throw new Error('Invalid response structure from AI service');
    }

    let parsed = null;
    if (typeof data.response === 'object' && data.response !== null) {
      parsed = data.response;
    } else if (typeof data.response === 'string') {
      const text = data.response.trim();
      try {
        // Find the JSON block if wrapped in other text
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonText = text.substring(firstBrace, lastBrace + 1);
          parsed = JSON.parse(jsonText);
        } else {
          parsed = JSON.parse(text);
        }
      } catch (e) {
        // Try cleaning markdown backticks as a backup
        try {
          const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleanedText);
        } catch (e2) {
          throw new Error('Failed to parse AI JSON response: ' + e.message);
        }
      }
    } else {
      throw new Error('Unsupported AI response format');
    }

    logEvent(`AI Success: Summaries and Devanagari Hindi text ready for "${title.substring(0, 35)}..."`);
    res.json(parsed);
  } catch (error) {
    logEvent(`AI Fail: Generation failed for "${title.substring(0, 35)}..." (${error.message})`);
    console.error('AI Enhancement failed:', error.message);
    res.status(500).json({ error: 'AI enhancement failed: ' + error.message });
  }
});

// ─── POST /api/approve - Upload story to NewsPulse ─────────────────────
app.post('/api/approve', async (req, res) => {
  const storyData = req.body;
  logEvent(`Upload: Approving and posting story "${storyData.headline.substring(0, 35)}..." to NewsPulse`);
  
  try {
    const response = await fetch(`${NEWSPULSE_API_URL}/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin123'
      },
      body: JSON.stringify({
        ...storyData,
        status: 'approved',
        regions: storyData.regions || ['global']
      })
    });

    const result = await response.json();
    if (!response.ok) {
      logEvent(`Upload Error: NewsPulse rejected approval (${response.status})`);
      return res.status(response.status).json(result);
    }

    logEvent(`Upload Success: Published story successfully to NewsPulse (ID: ${storyData.id})`);
    res.status(201).json({
      message: 'Story successfully approved and uploaded to NewsPulse!',
      data: result
    });
  } catch (e) {
    logEvent(`Upload Error: Connection to NewsPulse server failed (${e.message})`);
    console.error('Failed to post story to NewsPulse:', e.message);
    res.status(500).json({ error: 'Connection to NewsPulse server failed: ' + e.message });
  }
});

// ─── GET /api/newspulse-status - Check NewsPulse Status ───────────────
app.get('/api/newspulse-status', async (req, res) => {
  try {
    const response = await fetch(NEWSPULSE_API_URL + '/../', { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      res.json({ online: true });
    } else {
      res.json({ online: false, status: response.status });
    }
  } catch (e) {
    res.json({ online: false, error: e.message });
  }
});

// ─── GET /api/logs - Fetch background logs ───────────────────────────
app.get('/api/logs', (req, res) => {
  res.json(logs);
});

// ─── GET /api/published - Fetch published stories with counts ────────
app.get('/api/published', async (req, res) => {
  try {
    const response = await fetch(`${NEWSPULSE_API_URL}/stories/admin?status=approved`, {
      headers: { 'Authorization': 'Bearer admin123' }
    });
    if (!response.ok) {
      throw new Error(`Failed fetching published stories: status ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/published/:id - Delete a story from NewsPulse ────────
app.delete('/api/published/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetch(`${NEWSPULSE_API_URL}/stories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer admin123' }
    });
    const data = await response.json();
    logEvent(`Delete Action: Removed story ${id} from NewsPulse database`);
    res.json(data);
  } catch (e) {
    logEvent(`Delete Action Fail: Failed to remove story ${id} (${e.message})`);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📺 Monitoring Dashboard server running on http://localhost:${PORT}`);
  console.log(`🔗 Cross-connecting with NewsPulse API at ${NEWSPULSE_API_URL}\n`);
});
