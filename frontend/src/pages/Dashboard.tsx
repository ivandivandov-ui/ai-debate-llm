import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, MessageSquare, Users, Zap, AlertCircle, Paperclip, X } from 'lucide-react'

const Dashboard = () => {
  const [query, setQuery] = useState('')
  const [protocol, setProtocol] = useState('socratic')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInteractive, setIsInteractive] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const navigate = useNavigate()

  const handleStartDebate = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/debates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          preferences: {
            protocols: [protocol],
            interactive: isInteractive,
          },
          attachments: attachments,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start debate')
      }

      const data = await response.json()
      if (data.id) {
        navigate(`/debate/${data.id}`)
      } else {
        throw new Error('No debate ID returned')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start debate'
      setError(errorMessage)
      console.error('Debate error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1]
        setAttachments(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const protocols = [
    { id: 'socratic', name: 'Socratic', description: 'Question-based exploration' },
    { id: 'adversarial', name: 'Adversarial', description: 'Opposing viewpoints' },
    { id: 'red-team', name: 'Red Team', description: 'Critical analysis' },
    { id: 'consensus', name: 'Consensus', description: 'Agreement seeking' },
  ]

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Multi-Agent Debate System
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Harness the power of multiple AI agents to explore complex topics through
          structured debate and collaborative reasoning.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">5</p>
              <p className="text-slate-600">Specialized Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-8 w-8 text-primary-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">4</p>
              <p className="text-slate-600">Debate Protocols</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <Zap className="h-8 w-8 text-primary-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">Real-time</p>
              <p className="text-slate-600">Live Updates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">Error Starting Debate</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Debate Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Start a New Debate</h2>

        <div className="space-y-6">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-slate-700 mb-2">
              Debate Topic
            </label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your debate topic or question..."
              className="w-full h-32 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Attachments (Images or Documents)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-200">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{a.name}</span>
                  <button onClick={() => removeAttachment(a.id)} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all group">
              <Paperclip className="h-5 w-5 text-slate-400 group-hover:text-indigo-500" />
              <span className="text-sm text-slate-500 group-hover:text-indigo-600">Upload context files or images</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Debate Protocol
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {protocols.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setProtocol(p.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    protocol === p.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <h3 className="font-medium text-slate-900">{p.name}</h3>
                  <p className="text-sm text-slate-600">{p.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              id="interactive"
              checked={isInteractive}
              onChange={(e) => setIsInteractive(e.target.checked)}
              className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-slate-300 rounded cursor-pointer"
            />
            <label htmlFor="interactive" className="text-sm font-medium text-slate-700 cursor-pointer">
              <span className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-slate-500" />
                <span>Interactive Mode (Pause for Human Input)</span>
              </span>
              <p className="text-xs text-slate-500 mt-1">
                The debate will pause before the final synthesis to allow you to provide feedback or steering.
              </p>
            </label>
          </div>

          <button
            onClick={handleStartDebate}
            disabled={!query.trim() || isLoading}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-5 w-5" />
            <span>{isLoading ? 'Starting Debate...' : 'Start Debate'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
