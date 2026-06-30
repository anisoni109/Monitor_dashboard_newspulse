import React, { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : '/api'

const ADMIN_AUTH = 'Bearer admin123'

const CATEGORIES = [
  { id: 'all', label: 'All Stories', icon: '📰' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'technology', label: 'Technology', icon: '⚡' },
  { id: 'business', label: 'Business', icon: '💼' },
  { id: 'sports', label: 'Sports', icon: '🏆' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'pending', label: 'Pending', icon: '⏳' },
]

// ─── Status Badge Component ──────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status] || styles.pending}`}>
      {status.toUpperCase()}
    </span>
  )
}

// ─── Notification Toast Component ────────────────────────────────
function NotificationToast({ message, type = 'info', onClose }) {
  const styles = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500',
    info: 'bg-blue-600 border-blue-500',
    story: 'bg-indigo-600 border-indigo-500',
  }
  
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-50 ${styles[type]} border px-4 py-3 rounded-xl shadow-2xl slide-up max-w-sm`}>
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// ─── Main App Component ──────────────────────────────────────────
export default function App() {
  // State
  const [stories, setStories] = useState([])
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState({ autoPublish: true })
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [sseConnected, setSseConnected] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [autoFetchLoading, setAutoFetchLoading] = useState(false)
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    headline: '',
    summary: '',
    category: 'world',
    source: '',
    link: '',
    status: 'approved',
    regions: ['global'],
    extendedSummary: ''
  })

  // SSE ref
  const eventSourceRef = useRef(null)

  // ─── API Helper ──────────────────────────────────────────────
  async function apiFetch(endpoint, options = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': ADMIN_AUTH, 'Content-Type': 'application/json' },
        ...options,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(error.error || `API error: ${res.status}`)
      }
      return res.json()
    } catch (error) {
      console.error('API Error:', error)
      addNotification(`Error: ${error.message}`, 'error')
      throw error
    }
  }

  // ─── Load Stories ──────────────────────────────────────────
  const loadStories = useCallback(async () => {
    try {
      setLoading(true)
      let endpoint = '/stories/admin'
      const params = new URLSearchParams()
      
      if (selectedCategory !== 'all') {
        if (['pending', 'approved', 'rejected'].includes(selectedCategory)) {
          params.set('status', selectedCategory)
        } else {
          params.set('category', selectedCategory)
        }
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`
      }
      
      const data = await apiFetch(endpoint)
      setStories(data)
    } catch (e) {
      // Error already handled in apiFetch
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, searchQuery])

  // ─── Load Stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/stats')
      setStats(data)
    } catch (e) {
      // Error already handled
    }
  }, [])

  // ─── Load Settings ──────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const data = await apiFetch('/settings')
      setSettings(data)
    } catch (e) {
      // Error already handled
    }
  }, [])

  // ─── Initial Data Load ──────────────────────────────────────
  useEffect(() => {
    loadStories()
    loadStats()
    loadSettings()
  }, [loadStories, loadStats, loadSettings])

  // ─── SSE Connection ─────────────────────────────────────────
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(`${window.location.origin}/api/sse/updates`)
    eventSourceRef.current = es

    es.onopen = () => {
      setSseConnected(true)
      addNotification('Real-time feed connected', 'info')
    }

    es.addEventListener('story', (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'new_story' || data.type === 'status_changed' || data.type === 'story_updated') {
        loadStories()
        loadStats()
        
        if (data.type === 'new_story') {
          var autoLabel = data.autoGenerated ? '🤖 Auto-generated story published!' : '📰 New story uploaded'
          addNotification(autoLabel, 'story')
        } else if (data.type === 'status_changed') {
          addNotification('Story ' + data.id + ' status → ' + data.status, 'info')
        }
      } else if (data.type === 'story_deleted' || data.type === 'bulk_action') {
        loadStories()
        loadStats()
      }
    })

    es.onerror = () => {
      setSseConnected(false)
    }

    return function cleanup() {
      es.close()
    }
  }, [loadStories, loadStats])

  // ─── Add Notification ──────────────────────────────────────
  function addNotification(message, type) {
    if (type === void 0) { type = 'info' }
    var id = Date.now()
    setNotifications(function(prev) { return prev.slice(-4).concat([{ id: id, message: message, type: type }]) })
  }

  // ─── Remove Notification ──────────────────────────────────
  function removeNotification(id) {
    setNotifications(function(prev) { return prev.filter(function(n) { return n.id !== id }) })
  }

  // ─── Handle Upload ────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault()
    setUploadStatus('uploading')
    
    try {
      var storyData = Object.assign({}, uploadForm, {
        extendedSummary: uploadForm.extendedSummary 
          ? uploadForm.extendedSummary.split('\n').filter(function(line) { return line.trim() })
          : [uploadForm.summary.substring(0, 80) + '...'],
        regions: JSON.parse(JSON.stringify(uploadForm.regions)),
      })

      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify(storyData),
      })

      addNotification('Story uploaded successfully!', 'success')
      
      setUploadForm({
        headline: '',
        summary: '',
        category: 'world',
        source: '',
        link: '',
        status: 'approved',
        regions: ['global'],
        extendedSummary: ''
      })
      setShowUploadForm(false)
      setUploadStatus('success')
      
      setTimeout(function() { setUploadStatus('') }, 2000)
    } catch (e) {
      setUploadStatus('error')
      setTimeout(function() { setUploadStatus('') }, 3000)
    }
  }

  // ─── Handle Auto-Fetch ──────────────────────────────────────
  async function handleAutoFetch() {
    setAutoFetchLoading(true)
    try {
      var data = await apiFetch('/auto-fetch', {
        method: 'POST',
        body: JSON.stringify({ autoPublish: settings.autoPublish }),
      })
      
      addNotification('Generated ' + data.totalGenerated + ' stories!', 'success')
      setAutoFetchLoading(false)
    } catch (e) {
      setAutoFetchLoading(false)
    }
  }

  // ─── Handle Update Status ──────────────────────────────────
  async function handleStatusChange(storyId, newStatus) {
    try {
      await apiFetch('/stories/' + storyId + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      
      var action = newStatus === 'approved' ? 'Approved' : newStatus === 'rejected' ? 'Rejected' : 'Moved to Pending'
      addNotification(action, 'success')
    } catch (e) {
      // Error already handled in apiFetch
    }
  }

  // ─── Handle Delete Story ──────────────────────────────────
  async function handleDeleteStory(storyId) {
    if (!confirm('Are you sure you want to delete this story?')) return
    
    try {
      await apiFetch('/stories/' + storyId, { method: 'DELETE' })
      
      setStories(function(prev) { return prev.filter(function(s) { return s.id !== storyId }) })
      addNotification('Story deleted', 'info')
      loadStats()
    } catch (e) {
      // Error already handled in apiFetch
    }
  }

  // ─── Handle Update AutoPublish Setting ──────────────────────
  async function handleUpdateSetting(key, value) {
    try {
      var settingsBody = {}
      settingsBody[key] = value
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsBody),
      })
      
      setSettings(function(prev) { 
        var newSettings = Object.assign({}, prev)
        newSettings[key] = value
        return newSettings 
      })
      var label = key === 'autoPublish' ? (value ? 'Auto-publish is now ON' : 'Auto-publish is now OFF') : key + ' updated'
      addNotification(label, 'success')
    } catch (e) {
      // Error already handled in apiFetch
    }
  }

  return React.createElement('div', { className: 'min-h-screen bg-gray-950' },
    // Notifications
    notifications.map(function(n) {
      return React.createElement(NotificationToast, {
        key: n.id,
        message: n.message,
        type: n.type,
        onClose: function() { removeNotification(n.id) }
      })
    }),

    // Header
    React.createElement('header', { className: 'bg-gray-900 border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl' },
      React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-3' },
        React.createElement('div', { className: 'flex items-center justify-between' },
          React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement('h1', { className: 'text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent' },
              '📡 NewsPulse Monitor'
            ),
            React.createElement('div', { className: 'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ' + (sseConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400') + ' border border-white/10' },
              React.createElement('div', { className: 'w-1.5 h-1.5 rounded-full ' + (sseConnected ? 'bg-green-400 live-pulse' : 'bg-red-400') }),
              sseConnected ? 'LIVE' : 'CONNECTING'
            )
          ),

          React.createElement('div', { className: 'flex items-center gap-2' },
            stats && React.createElement('div', { className: 'hidden sm:flex items-center gap-1 text-xs' },
              React.createElement('span', { className: 'px-2 py-1 rounded-lg bg-green-500/20 text-green-400 font-bold' }, stats.approvedStories),
              React.createElement('span', { className: 'px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 font-bold' }, stats.pendingStories),
              React.createElement('span', { className: 'px-2 py-1 rounded-lg bg-red-500/20 text-red-400 font-bold' }, stats.rejectedStories)
            ),

            React.createElement('button', {
              onClick: handleAutoFetch,
              disabled: autoFetchLoading,
              className: 'px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold transition-all'
            }, autoFetchLoading ? 'Generating...' : '⚡ Auto-Fetch'),

            React.createElement('button', {
              onClick: function() { setShowUploadForm(true) },
              className: 'px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-xs font-bold transition-all'
            }, '➕ Upload Story')
          )
        )
      )
    ),

    // Settings Bar
    React.createElement('div', { className: 'bg-gray-900/50 border-b border-white/5 px-4 py-2' },
      React.createElement('div', { className: 'max-w-7xl mx-auto flex items-center gap-4 text-xs' },
        React.createElement('span', { className: 'text-gray-400 font-medium' }, 'Auto-Publish:'),
        React.createElement('button', {
          onClick: function() { handleUpdateSetting('autoPublish', !settings.autoPublish) },
          className: 'w-10 h-5 rounded-full relative transition-colors ' + (settings.autoPublish ? 'bg-blue-600' : 'bg-gray-600')
        },
          React.createElement('div', { className: 'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ' + (settings.autoPublish ? 'translate-x-5' : 'translate-x-0.5') })
        ),
        React.createElement('span', { className: settings.autoPublish ? 'text-blue-400' : 'text-gray-500' + ' font-medium' },
          settings.autoPublish ? 'ON' : 'OFF'
        ),
        
        React.createElement('span', { className: 'text-gray-600' }, '|'),
        React.createElement('span', { className: 'text-gray-400' }, 'Admin API: http://localhost:3000')
      )
    ),

    // Main Content
    React.createElement('main', { className: 'max-w-7xl mx-auto px-4 py-6' },
      // Category Tabs & Search
      React.createElement('div', { className: 'mb-6 space-y-3' },
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
          CATEGORIES.map(function(cat) {
            return React.createElement('button', {
              key: cat.id,
              onClick: function() { setSelectedCategory(cat.id) },
              className: 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all ' + (
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
              )
            },
              cat.icon + ' ' + cat.label
            )
          })
        ),

        React.createElement('input', {
          type: 'text',
          placeholder: 'Search stories by headline or summary...',
          value: searchQuery,
          onChange: function(e) { setSearchQuery(e.target.value) },
          className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'
        })
      ),

      // Stories Grid
      loading ? React.createElement('div', { className: 'flex items-center justify-center py-20' },
        React.createElement('div', { className: 'text-center' },
          React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4' }),
          React.createElement('p', { className: 'text-sm text-gray-400' }, 'Loading stories...')
        )
      ) : stories.length === 0 ? React.createElement('div', { className: 'flex items-center justify-center py-20' },
        React.createElement('div', { className: 'text-center' },
          React.createElement('p', { className: 'text-6xl mb-4' }, '📭'),
          React.createElement('p', { className: 'text-lg font-bold text-gray-300' }, 'No stories found'),
          React.createElement('p', { className: 'text-sm text-gray-500 mt-1' }, 'Try a different category or upload a new story')
        )
      ) : React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
          stories.map(function(story, index) {
            return React.createElement('div', {
              key: story.id,
              className: 'bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-blue-500/20 transition-all slide-up',
              style: { animationDelay: (index * 30) + 'ms' }
            },
              React.createElement('div', { className: 'flex items-start justify-between mb-2' },
                React.createElement(StatusBadge, { status: story.status }),
                React.createElement('span', { className: 'text-[10px] text-gray-500 font-mono' }, new Date(story.createdAt).toLocaleDateString())
              ),

              React.createElement('h3', { className: 'font-bold text-sm leading-snug mb-2 line-clamp-3 hover:text-blue-400 transition-colors cursor-pointer' },
                story.headline
              ),

              React.createElement('p', { className: 'text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2' }, story.summary),

              React.createElement('div', { className: 'flex items-center justify-between mb-3' },
                React.createElement('span', { className: 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-indigo-600 to-purple-600' },
                  story.category.toUpperCase()
                ),
                story.source && React.createElement('span', { className: 'text-[10px] text-gray-500' }, story.source)
              ),

              // Actions
              React.createElement('div', { className: 'flex items-center gap-1 pt-2 border-t border-white/5' },
                story.status !== 'rejected' && React.createElement('button', {
                  onClick: function() { handleStatusChange(story.id, 'approved') },
                  className: 'px-2 py-1 rounded text-[10px] font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all'
                }, '✅ Approve'),

                story.status !== 'approved' && React.createElement('button', {
                  onClick: function() { handleStatusChange(story.id, 'rejected') },
                  className: 'px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all'
                }, '❌ Reject'),

                React.createElement('button', {
                  onClick: function() { handleDeleteStory(story.id) },
                  className: 'px-2 py-1 rounded text-[10px] font-bold bg-white/5 text-gray-400 hover:bg-red-600 hover:text-white transition-all ml-auto'
                }, '🗑️ Delete')
              )
            )
          })
        ),

      // Story Count
      !loading && stories.length > 0 && React.createElement('div', { className: 'mt-6 text-center text-xs text-gray-500' },
        'Showing ' + stories.length + ' total stories'
      )
    ),

    // Upload Modal
    showUploadForm && createUploadModal(),

    // Footer
    React.createElement('footer', { className: 'border-t border-white/5 mt-12 py-4 text-center' },
      React.createElement('p', { className: 'text-[10px] text-gray-600 font-medium' },
        'NewsPulse Monitor Dashboard • Connected to localhost:3000 • Real-time updates via SSE'
      )
    )
  )

  function createUploadModal() {
    return React.createElement('div', { className: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center' },
      React.createElement('div', { 
        className: 'absolute inset-0 bg-black/70 backdrop-blur-sm',
        onClick: function() { setShowUploadForm(false) }
      }),
      
      React.createElement('div', { className: 'relative w-full max-w-lg bg-gray-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up' },
        // Header
        React.createElement('div', { className: 'flex items-center justify-between p-4 border-b border-white/10' },
          React.createElement('h2', { className: 'text-base font-bold text-white flex items-center gap-2' },
            '➕ Upload New Story'
          ),
          React.createElement('button', { 
            onClick: function() { setShowUploadForm(false) },
            className: 'p-1.5 rounded-full hover:bg-white/10 text-gray-400 transition-colors'
          },
            React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
            )
          )
        ),

        // Upload Status
        uploadStatus && React.createElement('div', { className: 'mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-bold ' + (
          uploadStatus === 'success' ? 'bg-green-500/20 text-green-400' : 
          uploadStatus === 'error' ? 'bg-red-500/20 text-red-400' : 
          'bg-blue-500/20 text-blue-400'
        ) },
          uploadStatus === 'uploading' && '📤 Uploading story...' ||
          uploadStatus === 'success' && '✅ Story uploaded successfully!' ||
          uploadStatus === 'error' && '❌ Upload failed.'
        ),

        // Form
        React.createElement('form', { onSubmit: handleUpload, className: 'p-4 space-y-3 max-h-[60vh] overflow-y-auto' },
          React.createElement('div', null,
            React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Headline *'),
            React.createElement('input', {
              type: 'text',
              required: true,
              value: uploadForm.headline,
              onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { headline: e.target.value }) }) },
              placeholder: 'Enter story headline...',
              className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'
            })
          ),

          React.createElement('div', null,
            React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Summary *'),
            React.createElement('textarea', {
              required: true,
              rows: 3,
              value: uploadForm.summary,
              onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { summary: e.target.value }) }) },
              placeholder: 'Enter story summary...',
              className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none'
            })
          ),

          React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
            React.createElement('div', null,
              React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Category *'),
              React.createElement('select', {
                value: uploadForm.category,
                onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { category: e.target.value }) }) },
                className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500'
              },
                CATEGORIES.filter(function(c) { return c.id !== 'all' && c.id !== 'pending' }).map(function(cat) {
                  return React.createElement('option', { key: cat.id, value: cat.id }, cat.icon + ' ' + cat.label)
                })
              )
            ),

            React.createElement('div', null,
              React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Status'),
              React.createElement('select', {
                value: uploadForm.status,
                onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { status: e.target.value }) }) },
                className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500'
              },
                React.createElement('option', { value: 'approved' }, 'Approved'),
                React.createElement('option', { value: 'pending' }, 'Pending Review')
              )
            )
          ),

          React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
            React.createElement('div', null,
              React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Source'),
              React.createElement('input', {
                type: 'text',
                value: uploadForm.source,
                onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { source: e.target.value }) }) },
                placeholder: 'e.g., Reuters',
                className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'
              })
            ),

            React.createElement('div', null,
              React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Link'),
              React.createElement('input', {
                type: 'url',
                value: uploadForm.link,
                onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { link: e.target.value }) }) },
                placeholder: 'https://...',
                className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'
              })
            )
          ),

          React.createElement('div', null,
            React.createElement('label', { className: 'text-xs font-bold text-gray-300 block mb-1' }, 'Extended Summary (one point per line)'),
            React.createElement('textarea', {
              rows: 2,
              value: uploadForm.extendedSummary,
              onChange: function(e) { setUploadForm(function(prev) { return Object.assign({}, prev, { extendedSummary: e.target.value }) }) },
              placeholder: 'Key point 1\nKey point 2\nKey point 3',
              className: 'w-full bg-gray-800/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none'
            })
          ),

          // Submit Buttons
          React.createElement('div', { className: 'flex gap-2 pt-2' },
            React.createElement('button', {
              type: 'submit',
              disabled: uploadStatus === 'uploading',
              className: 'flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white text-sm font-bold disabled:opacity-50 transition-all'
            }, uploadStatus === 'uploading' ? '📤 Uploading...' : '✅ Publish Story'),

            React.createElement('button', {
              type: 'button',
              onClick: function() { setShowUploadForm(false) },
              className: 'px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-all'
            }, 'Cancel')
          )
        )
      )
    )
  }
}