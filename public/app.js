// Global states
let pendingStories = [];
let selectedStory = null;
let enhancedData = null;
const logs = [];

// Local Storage configurations
const getApiUrl = () => localStorage.getItem('MONITOR_API_URL') || 'http://localhost:3000/api';
const setApiUrl = (val) => localStorage.setItem('MONITOR_API_URL', val);

// DOM Elements
const newsPulseStatus = document.getElementById('newspulse-status');
const categorySelector = document.getElementById('category-selector');
const feedLoading = document.getElementById('feed-loading');
const feedEmpty = document.getElementById('feed-empty');
const feedList = document.getElementById('feed-list');

const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');
const articleSource = document.getElementById('article-source');
const articleCategory = document.getElementById('article-category');
const articleLink = document.getElementById('article-link');
const articleTitle = document.getElementById('article-title');
const articleDescription = document.getElementById('article-description');

const btnEnhance = document.getElementById('btn-enhance');
const aiLoading = document.getElementById('ai-loading');
const editorSection = document.getElementById('editor-section');
const enhanceForm = document.getElementById('enhance-form');

const btnDisapprove = document.getElementById('btn-disapprove');

// Form inputs
const inputHeadline = document.getElementById('input-headline');
const inputSummary = document.getElementById('input-summary');
const inputExtended = document.getElementById('input-extended');
const inputHindiHeadline = document.getElementById('input-hindi-headline');
const inputHindiSummary = document.getElementById('input-hindi-summary');
const inputHindiExtended = document.getElementById('input-hindi-extended');
const inputSource = document.getElementById('input-source');
const inputRegions = document.getElementById('input-regions');

// Published analytics elements
const publishedEmpty = document.getElementById('published-empty');
const publishedList = document.getElementById('published-list');
const btnRefreshPublished = document.getElementById('btn-refresh-published');
const consoleLogs = document.getElementById('console-logs');
const monitorApiInput = document.getElementById('monitor-api-input');

// RSS feed sources
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

// Logger utility
function logEvent(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift({ timestamp, message, type });
  if (logs.length > 100) logs.pop();
  renderLogs();
}

function renderLogs() {
  consoleLogs.innerHTML = '';
  if (logs.length === 0) {
    consoleLogs.innerHTML = '<div class="log-row info">&gt; Listening for background operations...</div>';
    return;
  }
  logs.forEach(log => {
    const row = document.createElement('div');
    row.className = `log-row ${log.type}`;
    row.innerHTML = `<span class="log-time">[${escapeHtml(log.timestamp)}]</span> &gt; ${escapeHtml(log.message)}`;
    consoleLogs.appendChild(row);
  });
}

// Check NewsPulse Status
async function checkNewsPulseStatus() {
  const apiUrl = getApiUrl();
  try {
    const response = await fetch(apiUrl + '/stories', { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      newsPulseStatus.className = 'status-badge online';
      newsPulseStatus.querySelector('.status-label').textContent = 'Connected';
    } else {
      newsPulseStatus.className = 'status-badge offline';
      newsPulseStatus.querySelector('.status-label').textContent = 'Offline';
    }
  } catch (e) {
    newsPulseStatus.className = 'status-badge offline';
    newsPulseStatus.querySelector('.status-label').textContent = 'Offline';
  }
}

// Fetch Feed via CORS Proxy
async function fetchFeed(url) {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error();
    return await res.text();
  } catch (e) {
    const backupProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(backupProxy);
    if (!res.ok) throw new Error('CORS proxies failed');
    return await res.text();
  }
}

// Parse feed xml
function parseFeedXml(xmlText, sourceName, category) {
  if (!xmlText) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = doc.querySelectorAll('item, entry');
  const stories = [];
  
  items.forEach(item => {
    const title = item.querySelector('title')?.textContent?.trim() || '';
    let description = item.querySelector('description, summary, content')?.textContent || '';
    description = description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    
    let link = item.querySelector('link')?.textContent?.trim() || '';
    if (!link) {
      const linkEl = item.querySelector('link');
      if (linkEl) {
        link = linkEl.getAttribute('href') || '';
      }
    }
    
    const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';
    
    if (title && description.length > 20) {
      const summary = description.length > 280 ? description.substring(0, 280) + '...' : description;
      const cleanLink = link.startsWith('http') ? link : `https://${link}`;
      
      stories.push({
        id: `pending-${btoa(cleanLink).substring(0, 16)}`,
        originalHeadline: title,
        originalSummary: summary,
        source: sourceName,
        link: cleanLink,
        category,
        pubDate: pubDate || new Date().toISOString()
      });
    }
  });
  
  return stories;
}

// Load Pending RSS stories
async function loadPendingStories() {
  const cat = categorySelector.value;
  feedList.innerHTML = '';
  feedLoading.classList.remove('hidden');
  feedEmpty.classList.add('hidden');
  closeDetailPanel();
  
  logEvent(`RSS Scan: Fetching channels for "${cat}"`, 'warn');
  pendingStories = [];
  
  const sources = FEED_SOURCES[cat] || FEED_SOURCES['world'];
  for (const source of sources) {
    try {
      const xmlText = await fetchFeed(source.url);
      const parsed = parseFeedXml(xmlText, source.name, cat);
      pendingStories.push(...parsed);
    } catch (e) {
      logEvent(`RSS Error: Failed to pull feed from ${source.name} (${e.message})`, 'danger');
    }
  }

  feedLoading.classList.add('hidden');
  
  if (pendingStories.length === 0) {
    feedEmpty.classList.remove('hidden');
    return;
  }

  // Sort by date
  pendingStories.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  logEvent(`RSS Success: Loaded ${pendingStories.length} pending stories for "${cat}"`, 'success');
  loadPendingStoriesFromState();
}

function loadPendingStoriesFromState() {
  feedList.innerHTML = '';
  if (pendingStories.length === 0) {
    feedEmpty.classList.remove('hidden');
    return;
  }
  
  pendingStories.forEach(story => {
    const li = document.createElement('li');
    li.className = 'feed-item';
    li.innerHTML = `
      <h4>${escapeHtml(story.originalHeadline)}</h4>
      <p>${escapeHtml(story.originalSummary)}</p>
      <div class="item-footer">
        <span class="source-tag">${escapeHtml(story.source)}</span>
        <span>${formatTime(story.pubDate)}</span>
      </div>
    `;
    li.addEventListener('click', () => selectArticle(story, li));
    feedList.appendChild(li);
  });
}

function selectArticle(story, element) {
  // Deselect active items
  document.querySelectorAll('.feed-item').forEach(item => item.classList.remove('active'));
  element.classList.add('active');
  
  selectedStory = story;
  enhancedData = null;
  
  // Update view fields
  articleSource.textContent = story.source;
  articleCategory.textContent = story.category;
  articleLink.href = story.link;
  articleTitle.textContent = story.originalHeadline;
  articleDescription.textContent = story.originalSummary;
  
  // Show configurations
  detailEmpty.classList.add('hidden');
  detailContent.classList.remove('hidden');
  
  // Hide editor editor section till AI runs
  editorSection.classList.add('hidden');
}

// Run AI Enhancement calling DevToolbox llama worker directly from browser
async function runAiEnhancement() {
  if (!selectedStory) return;
  
  btnEnhance.disabled = true;
  aiLoading.classList.remove('hidden');
  editorSection.classList.add('hidden');
  
  logEvent(`AI Process: Calling Llama rewriter for "${selectedStory.originalHeadline.substring(0, 30)}..."`, 'warn');
  
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
Title: ${selectedStory.originalHeadline}
Description: ${selectedStory.originalSummary}`;

  try {
    const res = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(20000)
    });
    
    if (!res.ok) throw new Error(`AI service returned HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.response) throw new Error('Invalid response structure');
    
    let parsed = null;
    if (typeof data.response === 'object' && data.response !== null) {
      parsed = data.response;
    } else if (typeof data.response === 'string') {
      const text = data.response.trim();
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(text);
      }
    }
    
    enhancedData = parsed;
    logEvent(`AI Success: Enhancement completed for "${selectedStory.originalHeadline.substring(0, 30)}..."`, 'success');
    
    // Populate form
    inputHeadline.value = parsed.headline || '';
    inputSummary.value = parsed.summary || '';
    inputExtended.value = (parsed.extendedSummary || []).join('\n');
    inputHindiHeadline.value = parsed.hindiHeadline || '';
    inputHindiSummary.value = parsed.hindiSummary || '';
    inputHindiExtended.value = (parsed.hindiExtendedSummary || []).join('\n');
    inputSource.value = selectedStory.source;
    
    aiLoading.classList.add('hidden');
    editorSection.classList.remove('hidden');
    editorSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    aiLoading.classList.add('hidden');
    logEvent(`AI Fail: Generation failed (${err.message})`, 'danger');
    alert('AI enhancement failed: ' + err.message);
  } finally {
    btnEnhance.disabled = false;
  }
}

function disapproveStory() {
  if (!selectedStory) return;
  logEvent(`Disapprove: Story "${selectedStory.originalHeadline.substring(0, 30)}..." hidden`, 'info');
  pendingStories = pendingStories.filter(s => s.id !== selectedStory.id);
  loadPendingStoriesFromState();
  closeDetailPanel();
}

async function submitApproval(e) {
  e.preventDefault();
  if (!selectedStory) return;
  
  const payload = {
    id: selectedStory.id,
    headline: inputHeadline.value.trim(),
    summary: inputSummary.value.trim(),
    extendedSummary: inputExtended.value.split('\n').map(b => b.trim()).filter(b => b),
    hindiHeadline: inputHindiHeadline.value.trim(),
    hindiSummary: inputHindiSummary.value.trim(),
    hindiExtendedSummary: inputHindiExtended.value.split('\n').map(b => b.trim()).filter(b => b),
    category: selectedStory.category,
    source: inputSource.value.trim(),
    link: selectedStory.link,
    regions: inputRegions.value.split(',').map(r => r.trim()).filter(r => r),
    status: 'approved'
  };
  
  const submitBtn = document.getElementById('btn-approve');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';
  
  const apiUrl = getApiUrl();
  logEvent(`Upload: Posting story to NewsPulse API`, 'warn');
  
  try {
    const res = await fetch(`${apiUrl}/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin123'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (res.ok) {
      logEvent(`Upload Success: Published story successfully (ID: ${selectedStory.id})`, 'success');
      alert('Story successfully approved and published directly to NewsPulse!');
      pendingStories = pendingStories.filter(s => s.id !== selectedStory.id);
      loadPendingStoriesFromState();
      closeDetailPanel();
      loadPublishedStories();
    } else {
      logEvent(`Upload Error: NewsPulse API rejected upload (${result.error || 'Unknown'})`, 'danger');
      alert('Failed to upload: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    logEvent(`Upload Error: Connection to NewsPulse server failed (${err.message})`, 'danger');
    alert('Connection failure to upload: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>🚀</span> Approve & Upload to NewsPulse';
  }
}

// Load published stories analytics from NewsPulse API
async function loadPublishedStories() {
  const apiUrl = getApiUrl();
  try {
    const res = await fetch(`${apiUrl}/stories/admin?status=approved`, {
      headers: { 'Authorization': 'Bearer admin123' }
    });
    if (!res.ok) throw new Error('API server rejected request');
    const stories = await res.json();
    
    publishedList.innerHTML = '';
    if (stories.length === 0) {
      publishedEmpty.classList.remove('hidden');
      return;
    }
    
    publishedEmpty.classList.add('hidden');
    
    stories.forEach(story => {
      const tr = document.createElement('tr');
      const up = story.upvotes || 0;
      const down = story.downvotes || 0;
      const comments = story.commentsCount || 0;
      const shares = story.shares || 0;
      const serial = story.serialNo ? `#NP-${story.serialNo}` : 'Seed';
      
      tr.innerHTML = `
        <td><span class="np-id-badge">${serial}</span></td>
        <td><span class="source-tag">${escapeHtml(story.category)}</span></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${escapeHtml(story.headline)}</div>
          <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">ID: ${escapeHtml(story.id)}</div>
        </td>
        <td>
          <div class="stats-badge-group">
            <span class="stat-tag upvotes">👍 ${up}</span>
            <span class="stat-tag downvotes">👎 ${down}</span>
            <span class="stat-tag comments">💬 ${comments}</span>
            <span class="stat-tag shares">📢 ${shares}</span>
          </div>
        </td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="handleDeletePublished('${story.id}')" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;">
            🗑️ Delete
          </button>
        </td>
      `;
      publishedList.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load published stories stats:', e);
    publishedEmpty.classList.remove('hidden');
    publishedEmpty.querySelector('p').textContent = 'Failed to fetch analytics: ' + e.message;
  }
}

// Handle Delete Story
async function handleDeletePublished(id) {
  if (!confirm(`Are you sure you want to delete story ${id} from NewsPulse?`)) return;
  const apiUrl = getApiUrl();
  logEvent(`Delete: Removing story ${id} from NewsPulse...`, 'warn');
  try {
    const res = await fetch(`${apiUrl}/stories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer admin123' }
    });
    if (res.ok) {
      logEvent(`Delete Success: Story ${id} successfully removed`, 'success');
      alert('Story successfully deleted from NewsPulse.');
      loadPublishedStories();
    } else {
      const data = await res.json();
      logEvent(`Delete Error: API rejected deletion (${data.error || 'Unknown'})`, 'danger');
      alert('Delete failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    logEvent(`Delete Error: Connection failure (${err.message})`, 'danger');
    alert('Delete connection failed: ' + err.message);
  }
}

function closeDetailPanel() {
  selectedStory = null;
  enhancedData = null;
  detailContent.classList.add('hidden');
  detailEmpty.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
  } catch (e) {
    return 'Recently';
  }
}

// Make handleDeletePublished globally accessible for inline onclick attribute
window.handleDeletePublished = handleDeletePublished;

// ─── Event Listeners ───────────────────────────────────────────────────
categorySelector.addEventListener('change', loadPendingStories);
btnEnhance.addEventListener('click', runAiEnhancement);
btnDisapprove.addEventListener('click', disapproveStory);
enhanceForm.addEventListener('submit', submitApproval);
btnRefreshPublished.addEventListener('click', loadPublishedStories);

monitorApiInput.value = getApiUrl();
monitorApiInput.addEventListener('change', (e) => {
  setApiUrl(e.target.value);
  logEvent(`API Base URL updated to: ${e.target.value}`, 'info');
  checkNewsPulseStatus();
  loadPublishedStories();
});

// Initializations
logEvent("Static Dashboard Initialized. Running in Browser Mode.");
checkNewsPulseStatus();
setInterval(checkNewsPulseStatus, 5000);
loadPendingStories();
loadPublishedStories();
setInterval(loadPublishedStories, 6000);
