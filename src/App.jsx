import React, { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api'

const CATEGORIES = [
  { id: 'all', label: 'All Stories', icon: '📰' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'technology', label: 'Technology', icon: '⚡' },
  { id: 'business', label: 'Business', icon: '💼' },
  { id: 'sports', label: 'Sports', icon: '🏆' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'health', label: 'Health', icon: '❤️' },
  { id: 'pending', label: 'Pending', icon: '⏳' },
]

const AI_PROVIDERS = [
  { id: 'local', label: 'Local Ollama', icon: '🖥️', desc: 'Use your own Ollama server' },
  { id: 'cloud_free', label: 'Free Cloud AI', icon: '☁️', desc: 'Cloudflare Workers free tier' },
]

// ─── Login Screen ───────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login') // login, signup, guest
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let data
      if (mode === 'guest') {
        const res = await fetch(`${API_BASE}/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else if (mode === 'login') {
        const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) })
        data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else {
        const res = await fetch(`${API_BASE}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) })
        data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">📡 Monitor Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Control Panel</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {['login', 'guest'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {m === 'guest' ? '👤 Guest' : '🔑 Login'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'guest' && (
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Username</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Enter username" className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          )}
          {mode !== 'guest' && (
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password" className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          )}
          {mode === 'guest' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-xs text-blue-300">Continue as guest with a random username. You can view and interact with stories.</p>
            </div>
          )}
          {error && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold disabled:opacity-50">
            {loading ? 'Please wait...' : mode === 'guest' ? 'Continue as Guest' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = { approved: 'bg-green-500/20 text-green-400 border-green-500/30', pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', rejected: 'bg-red-500/20 text-red-400 border-red-500/30' }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status] || styles.pending}`}>{status.toUpperCase()}</span>
}

// ─── Notification Toast ────────────────────────────────────────
function NotificationToast({ message, type = 'info', onClose }) {
  const styles = { success: 'bg-green-600 border-green-500', error: 'bg-red-600 border-red-500', info: 'bg-blue-600 border-blue-500', story: 'bg-indigo-600 border-indigo-500' }
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer) }, [onClose])
  return <div className={`fixed top-4 right-4 z-[100] ${styles[type]} border px-4 py-3 rounded-xl shadow-2xl max-w-sm`}><p className="text-sm font-medium">{message}</p></div>
}

// ─── AI Settings Modal ─────────────────────────────────────────
function AISettingsModal({ isOpen, onClose, aiProvider, setAiProvider, ollamaUrl, setOllamaUrl, ollamaModel, setOllamaModel }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">🤖 AI Model Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400">✕</button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-2">AI Provider</label>
            <div className="space-y-2">
              {AI_PROVIDERS.map(provider => (
                <button key={provider.id} onClick={() => { setAiProvider(provider.id); localStorage.setItem('AI_PROVIDER', provider.id) }} className={`w-full p-3 rounded-xl border transition-all text-left ${aiProvider === provider.id ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30' : 'border-white/5 bg-gray-800/40 hover:bg-gray-700/40'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{provider.icon}</span>
                    <div className="flex-1"><p className="text-sm font-bold text-white">{provider.label}</p><p className="text-[10px] text-gray-400">{provider.desc}</p></div>
                    {aiProvider === provider.id && <span className="text-blue-400">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {aiProvider === 'local' && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Ollama Model Name</label>
                <input type="text" value={ollamaModel} onChange={e => { setOllamaModel(e.target.value); localStorage.setItem('OLLAMA_MODEL', e.target.value) }} placeholder="qwen3.5:latest" className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Ollama Server Address</label>
                <input type="text" value={ollamaUrl} onChange={e => { setOllamaUrl(e.target.value); localStorage.setItem('OLLAMA_URL', e.target.value) }} placeholder="localhost:11434" className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </>
          )}
          {aiProvider === 'cloud_free' && (
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Cloud AI Endpoint</label>
              <input type="text" value="https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate" disabled className="w-full bg-gray-800/30 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
              <p className="text-[10px] text-gray-500 mt-1">Cloud AI is pre-configured and free to use</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold">Apply Settings</button>
        </div>
      </div>
    </div>
  )
}

// ─── Research Chat Modal ───────────────────────────────────────
function ResearchModal({ isOpen, onClose, aiProvider, ollamaModel, ollamaUrl }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  async function askQuestion(e) {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    const userQuestion = question
    setHistory(prev => [...prev, { q: userQuestion, a: '' }])
    setQuestion('')
    try {
      const res = await fetch(`${API_BASE}/research/ask`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer admin123', 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, aiProvider, ollamaModel, ollamaUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHistory(prev => prev.map((h, i) => i === prev.length - 1 ? { ...h, a: data.answer } : h))
    } catch (err) {
      setHistory(prev => prev.map((h, i) => i === prev.length - 1 ? { ...h, a: 'Error: ' + err.message } : h))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gray-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">🔬 Research Assistant</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Ask anything — powered by your Ollama model</p>}
          {history.map((h, i) => (
            <div key={i} className="space-y-2">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3"><p className="text-xs font-bold text-blue-300 mb-1">You</p><p className="text-sm text-white">{h.q}</p></div>
              {h.a && <div className="bg-gray-800/50 border border-white/5 rounded-xl p-3"><p className="text-xs font-bold text-gray-400 mb-1">AI</p><p className="text-sm text-gray-200 whitespace-pre-wrap">{h.a}</p></div>}
            </div>
          ))}
          {loading && <div className="text-center text-xs text-gray-500">Thinking...</div>}
        </div>
        <form onSubmit={askQuestion} className="p-4 border-t border-white/10 flex gap-2">
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question..." className="flex-1 bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <button type="submit" disabled={loading || !question.trim()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">Send</button>
        </form>
      </div>
    </div>
  )
}

// ─── Upload Modal ──────────────────────────────────────────────
function UploadModal({ isOpen, onClose, onUpload }) {
  const [form, setForm] = useState({ headline: '', summary: '', category: 'world', source: '', link: '', status: 'approved', regions: ['global'], extendedSummary: '' })
  const [status, setStatus] = useState('')
  if (!isOpen) return null
  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('uploading')
    try { await onUpload(form); setStatus('success'); setForm({ headline: '', summary: '', category: 'world', source: '', link: '', status: 'approved', regions: ['global'], extendedSummary: '' }); setTimeout(() => { setStatus(''); onClose() }, 1000) }
    catch (e) { setStatus('error'); setTimeout(() => setStatus(''), 3000) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">➕ Upload New Story</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400">✕</button>
        </div>
        {status && <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-bold ${status === 'success' ? 'bg-green-500/20 text-green-400' : status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{status === 'uploading' ? 'Uploading...' : status === 'success' ? 'Uploaded!' : 'Failed.'}</div>}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div><label className="text-xs font-bold text-gray-300 block mb-1">Headline *</label><input type="text" required value={form.headline} onChange={e => setForm(p => ({...p, headline: e.target.value}))} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" /></div>
          <div><label className="text-xs font-bold text-gray-300 block mb-1">Summary *</label><textarea required rows={3} value={form.summary} onChange={e => setForm(p => ({...p, summary: e.target.value}))} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-300 block mb-1">Category *</label><select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">{CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'pending').map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-300 block mb-1">Status</label><select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"><option value="approved">Approved</option><option value="pending">Pending Review</option></select></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold">Publish Story</button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('MONITOR_USER')
    return saved ? JSON.parse(saved) : null
  })
  const [stories, setStories] = useState([])
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState({ autoPublish: true })
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [sseConnected, setSseConnected] = useState(false)
  const [autoFetchLoading, setAutoFetchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stories') // stories, research
  const [selectedStories, setSelectedStories] = useState(new Set())
  
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('AI_PROVIDER') || 'local')
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('OLLAMA_URL') || 'localhost:11434')
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('OLLAMA_MODEL') || 'qwen3.5:latest')
  const [showAISettingsModal, setShowAISettingsModal] = useState(false)
  const [showResearchModal, setShowResearchModal] = useState(false)

  const eventSourceRef = useRef(null)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  async function apiFetch(endpoint, options = {}) {
    const u = userRef.current
    if (!u) throw new Error('Not authenticated')
    const headers = { 'Content-Type': 'application/json', ...options.headers }
    if (u.role === 'admin') headers['Authorization'] = 'Bearer admin123'
    else headers['Authorization'] = `Bearer ${u.token}`
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
      if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || `API error: ${res.status}`) }
      return res.json()
    } catch (error) { console.error('API Error:', error); addNotification('Error: ' + error.message, 'error'); throw error }
  }

  const loadStories = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      let endpoint = user.role === 'admin' ? '/stories/admin' : '/stories'
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        if (['pending', 'approved', 'rejected'].includes(selectedCategory)) params.set('status', selectedCategory)
        else params.set('category', selectedCategory)
      }
      if (searchQuery) params.set('search', searchQuery)
      if (params.toString()) endpoint += '?' + params.toString()
      const data = await apiFetch(endpoint)
      setStories(data)
    } catch (e) {} finally { setLoading(false) }
  }, [selectedCategory, searchQuery, user])

  const loadStats = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    try { const data = await apiFetch('/stats'); setStats(data) } catch (e) {}
  }, [user])

  const loadSettings = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    try { const data = await apiFetch('/settings'); setSettings(data) } catch (e) {}
  }, [user])

  useEffect(() => { loadStories(); loadStats(); loadSettings() }, [loadStories, loadStats, loadSettings])

  // SSE Connection
  useEffect(() => {
    if (!user) return
    if (eventSourceRef.current) eventSourceRef.current.close()
    const es = new EventSource(window.location.origin + '/api/sse/updates')
    eventSourceRef.current = es
    es.onopen = () => setSseConnected(true)
    es.addEventListener('story', (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'new_story' || data.type === 'status_changed' || data.type === 'story_updated') { loadStories(); loadStats(); addNotification(data.type === 'new_story' ? '🤖 New story published!' : 'Story updated', 'story') }
      else if (data.type === 'story_deleted' || data.type === 'bulk_action') { loadStories(); loadStats() }
    })
    es.onerror = () => setSseConnected(false)
    return () => es.close()
  }, [loadStories, loadStats, user])

  function addNotification(message, type = 'info') { setNotifications(prev => prev.slice(-4).concat([{ id: Date.now(), message, type }])) }
  function removeNotification(id) { setNotifications(prev => prev.filter(n => n.id !== id)) }
  function getAIConfigString() { if (aiProvider !== 'local') return 'Cloud Free'; return (ollamaModel || '') + (ollamaUrl ? ' @ ' + ollamaUrl : '') }
  const aiProviderLabel = aiProvider === 'local' ? ('🖥️ ' + getAIConfigString()) : '☁️ Free Cloud'

  async function handleUpload(form) {
    await apiFetch('/stories', { method: 'POST', body: JSON.stringify(form) })
    addNotification('Story uploaded!', 'success'); loadStories(); loadStats()
  }

  async function handleAutoFetch() {
    setAutoFetchLoading(true)
    try {
      const data = await apiFetch('/auto-fetch-rss', {
        method: 'POST',
        body: JSON.stringify({ autoPublish: settings.autoPublish, aiProvider, ollamaModel, ollamaUrl: aiProvider === 'local' ? ollamaUrl : undefined })
      })
      addNotification(`Generated ${data.totalGenerated} stories!`, 'success')
      loadStories(); loadStats()
    } catch (e) { addNotification('Auto-fetch failed', 'error') } finally { setAutoFetchLoading(false) }
  }

  async function handleStatusChange(storyId, newStatus) {
    try {
      await apiFetch(`/stories/${storyId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      addNotification(newStatus === 'approved' ? 'Approved' : newStatus === 'rejected' ? 'Rejected' : 'Moved to Pending', 'success')
      setSelectedStories(prev => { const next = new Set(prev); next.delete(storyId); return next })
      loadStories(); loadStats()
    } catch (e) {}
  }

  function toggleStorySelection(storyId) {
    setSelectedStories(prev => {
      const next = new Set(prev)
      if (next.has(storyId)) next.delete(storyId)
      else next.add(storyId)
      return next
    })
  }

  function selectAllVisible() {
    const allIds = new Set(stories.map(s => s.id))
    setSelectedStories(allIds)
  }

  function clearSelection() {
    setSelectedStories(new Set())
  }

  async function handleBulkAction(action) {
    if (selectedStories.size === 0) return
    if (!confirm(`Bulk ${action} ${selectedStories.size} stories?`)) return
    try {
      await apiFetch('/stories/bulk', { method: 'POST', body: JSON.stringify({ storyIds: Array.from(selectedStories), action }) })
      addNotification(`Bulk ${action} completed for ${selectedStories.size} stories`, 'success')
      setSelectedStories(new Set())
      loadStories(); loadStats()
    } catch (e) { addNotification('Bulk action failed', 'error') }
  }

  async function handleDeleteStory(storyId) {
    if (!confirm('Delete this story?')) return
    try { await apiFetch(`/stories/${storyId}`, { method: 'DELETE' }); setStories(prev => prev.filter(s => s.id !== storyId)); addNotification('Story deleted', 'info'); loadStats() } catch (e) {}
  }

  async function handleUpdateSetting(key, value) {
    try {
      await apiFetch('/settings', { method: 'PUT', body: JSON.stringify({ [key]: value }) })
      setSettings(prev => ({...prev, [key]: value}))
      addNotification(key === 'autoPublish' ? (value ? 'Auto-publish ON' : 'Auto-publish OFF') : 'Setting updated', 'success')
    } catch (e) {}
  }

  function logout() { setUser(null); localStorage.removeItem('MONITOR_USER') }

  // If not logged in, show login screen
  if (!user) {
    return <LoginScreen onLogin={data => { setUser(data); localStorage.setItem('MONITOR_USER', JSON.stringify(data)) }} />
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {notifications.map(n => <NotificationToast key={n.id} message={n.message} type={n.type} onClose={() => removeNotification(n.id)} />)}
      
      {/* Header */}
      <header className="bg-gray-900 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">📡 Monitor Dashboard</h1>
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${sseConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-red-400'}`} />{sseConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{user?.name} {user?.role === 'admin' ? '(Admin)' : ''}</span>
            <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold">Logout</button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-gray-900/50 border-b border-white/5 px-4">
        <div className="max-w-7xl mx-auto flex gap-2">
          {['stories', 'research'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-xs font-bold transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'stories' ? '📰 Stories' : '🔬 Research'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'stories' ? (
        <>
          {/* Admin Controls */}
          {user.role === 'admin' && (
            <div className="bg-gray-900/50 border-b border-white/5 px-4 py-3">
              <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
                <button onClick={handleAutoFetch} disabled={autoFetchLoading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold">
                  {autoFetchLoading ? '⏳ Fetching...' : '⚡ Fetch RSS Stories'}
                </button>
                <button onClick={() => setShowUploadForm(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-xs font-bold">+ Upload Story</button>
                <button onClick={() => setShowAISettingsModal(true)} className="px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold">🤖 {aiProviderLabel}</button>
                <button onClick={() => setShowResearchModal(true)} className="px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold">🔬 Research</button>
                {stats && (
                  <span className="hidden sm:flex text-xs gap-1 items-center ml-auto">
                    <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 font-bold">{stats.approvedStories || 0}</span>
                    <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 font-bold">{stats.pendingStories || 0}</span>
                    <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 font-bold">{stats.rejectedStories || 0}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Settings Bar */}
          {user.role === 'admin' && (
            <div className="bg-gray-900/50 border-b border-white/5 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar max-w-7xl mx-auto">
              <span>Auto-Publish:</span>
              <button onClick={() => handleUpdateSetting('autoPublish', !settings.autoPublish)} className={`w-10 h-5 rounded-full relative transition-colors ${settings.autoPublish ? 'bg-blue-600' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoPublish ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span>{settings.autoPublish ? 'ON' : 'OFF'}</span>
            </div>
          )}

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 py-6">
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'}`}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Search stories..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="block w-8 h-8 border-b-2 border-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : stories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-gray-400">📭 No stories found</p>
                {user.role === 'admin' && <button onClick={handleAutoFetch} disabled={autoFetchLoading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">⚡ Fetch RSS Stories</button>}
              </div>
            ) : (
              <>
                {/* Bulk Actions Bar */}
                {user.role === 'admin' && selectedStories.size > 0 && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                    <span className="text-xs font-bold text-blue-300">{selectedStories.size} selected</span>
                    <button onClick={() => handleBulkAction('approve')} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold">✅ Approve All</button>
                    <button onClick={() => handleBulkAction('reject')} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold">❌ Reject All</button>
                    <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold">🗑️ Delete All</button>
                    <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold ml-auto">Clear</button>
                  </div>
                )}
                
                {user.role === 'admin' && stories.length > 0 && (
                  <div className="mb-3 flex gap-2">
                    <button onClick={selectAllVisible} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold">Select All</button>
                    <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold">Clear Selection</button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stories.map(story => {
                    const isSelected = selectedStories.has(story.id)
                    return (
                      <div key={story.id} className={`bg-gray-900/50 border rounded-xl p-4 hover:border-blue-500/20 transition-all ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-white/5'}`}>
                        <div className="flex items-start gap-2 mb-2">
                          {user.role === 'admin' && (
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleStorySelection(story.id)}
                              className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <StatusBadge status={story.status} />
                              <span className="text-[10px] text-gray-500 font-mono">{new Date(story.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-3 hover:text-blue-400 transition-colors cursor-pointer">{story.headline}</h3>
                            <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{story.summary}</p>
                            <div className="flex items-center justify-between mb-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-indigo-600 to-purple-600">{story.category.toUpperCase()}</span>
                              {story.source && <span className="text-[10px] text-gray-500">{story.source}</span>}
                            </div>
                          </div>
                        </div>
                        {user.role === 'admin' && (
                          <div className="flex items-center gap-1 pt-2 border-t border-white/5">
                            {story.status !== 'rejected' && <button onClick={() => handleStatusChange(story.id, 'approved')} className="px-2 py-1 rounded text-[10px] font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30">✅ Approve</button>}
                            {story.status !== 'approved' && <button onClick={() => handleStatusChange(story.id, 'rejected')} className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30">❌ Reject</button>}
                            <button onClick={() => handleDeleteStory(story.id)} className="px-2 py-1 rounded text-[10px] font-bold bg-white/5 text-gray-400 hover:bg-red-600 hover:text-white ml-auto">🗑️</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {!loading && stories.length > 0 && <p className="text-center text-xs text-gray-500 mt-6">Showing {stories.length} total stories</p>}
          </main>
        </>
      ) : (
        /* Research Tab */
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">🔬 AI Research Assistant</h2>
            <p className="text-xs text-gray-400 mb-4">Ask any question and get detailed answers from your Ollama model.</p>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="Type your question here..." className="flex-1 bg-gray-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" onKeyDown={e => { if (e.key === 'Enter') { setShowResearchModal(true); } }} />
              <button onClick={() => setShowResearchModal(true)} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold">Ask AI</button>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-[10px] text-blue-300">💡 Uses your configured Ollama model: <strong>{getAIConfigString()}</strong></p>
            </div>
          </div>
        </main>
      )}

      {/* Modals */}
      {showUploadForm && <UploadModal isOpen={showUploadForm} onClose={() => setShowUploadForm(false)} onUpload={handleUpload} />}
      <AISettingsModal isOpen={showAISettingsModal} onClose={() => setShowAISettingsModal(false)} aiProvider={aiProvider} setAiProvider={setAiProvider} ollamaUrl={ollamaUrl} setOllamaUrl={setOllamaUrl} ollamaModel={ollamaModel} setOllamaModel={setOllamaModel} />
      <ResearchModal isOpen={showResearchModal} onClose={() => setShowResearchModal(false)} aiProvider={aiProvider} ollamaModel={ollamaModel} ollamaUrl={ollamaUrl} />

      <footer className="border-t border-white/5 mt-12 py-4 text-center">
        <p className="text-[10px] text-gray-600">NewsPulse Monitor v2 • User: {user?.name} • SSE: {sseConnected ? 'connected' : 'disconnected'}</p>
      </footer>
    </div>
  )
}