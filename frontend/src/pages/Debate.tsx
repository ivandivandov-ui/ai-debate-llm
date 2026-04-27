import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Brain,
  CornerDownLeft,
  MessageCircle,
  Download,
  Zap
} from 'lucide-react'

interface DebateMessage {
  id: string
  agent: string
  content: string
  reasoning?: string
  timestamp: string
  type: 'argument' | 'question' | 'response' | 'conclusion' | 'critique'
}

interface DebateData {
  id: string
  query: string
  protocol: string
  status: 'running' | 'completed' | 'failed' | 'waiting_for_human'
  usedFallback?: boolean
  messages: DebateMessage[]
  agents: string[]
  startedAt: string
  completedAt?: string
  canvasContent?: string
}

const Debate = () => {
  const { id } = useParams()

  const { data: debate, isLoading, refetch } = useQuery({
    queryKey: ['debate', id],
    queryFn: async () => {
      const response = await fetch(`/api/debates/${id}`)
      if (!response.ok) throw new Error('Failed to fetch debate')
      return response.json() as Promise<DebateData>
    },
    refetchInterval: false,
  })

  useEffect(() => {
    if (!id || debate?.status !== 'running') return
    const eventSource = new EventSource(`/api/stream/${id}`)
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    eventSource.addEventListener('state', () => {
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          refetch();
          timeoutId = null;
        }, 500);
      }
    })
    
    eventSource.addEventListener('error', () => eventSource.close())
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      eventSource.close()
    }
  }, [id, debate?.status, refetch])

  const [humanInput, setHumanInput] = useState('')
  const [isResuming, setIsResuming] = useState(false)
  const [canvasContent, setCanvasContent] = useState('')
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true)

  useEffect(() => {
    if (debate?.canvasContent !== undefined && !canvasContent) {
      setCanvasContent(debate.canvasContent)
    }
  }, [debate?.canvasContent])

  const handleCanvasSave = async (content: string) => {
    if (!id) return
    try {
      await fetch(`/api/debates/${id}/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
    } catch (err) {
      console.error('Failed to save canvas:', err)
    }
  }

  const handleResume = async () => {
    if (!id || isResuming) return
    setIsResuming(true)
    try {
      const response = await fetch(`/api/debates/${id}/human-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: humanInput }),
      })
      if (!response.ok) throw new Error('Failed to send input')
      setHumanInput('')
      refetch()
    } catch (err) {
      console.error('Resume error:', err)
    } finally {
      setIsResuming(false)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>
  if (!debate) return <div className="text-center py-20"><h1 className="text-2xl font-bold">Debate Not Found</h1></div>

  const getAgentColor = (agent: string) => {
    const colors = {
      Builder: 'bg-blue-100 text-blue-800',
      Critic: 'bg-red-100 text-red-800',
      Skeptic: 'bg-yellow-100 text-yellow-800',
      Scientist: 'bg-green-100 text-green-800',
      Verifier: 'bg-purple-100 text-purple-800',
    }
    return colors[agent as keyof typeof colors] || 'bg-slate-100 text-slate-800'
  }

  return (
    <div className="space-y-6 animate-float">
      {/* Header Panel */}
      <div className="glass-card rounded-xl border border-white/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Live Debate</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${debate.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
              <span className="text-sm font-medium capitalize text-slate-600">{debate.status}</span>
            </div>
            <button
              onClick={() => window.open(`/api/debates/${id}/export/markdown`)}
              className="flex items-center space-x-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              <span>Export MD</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <MessageSquare className="h-4 w-4" />
            <span>Protocol: {debate.protocol}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <Users className="h-4 w-4" />
            <span>Agents: {debate.agents.length}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span>Started: {new Date(debate.startedAt).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <h3 className="font-bold text-slate-900 mb-1 text-sm uppercase tracking-wider">Current Topic:</h3>
          <p className="text-slate-700 leading-relaxed">{debate.query}</p>
        </div>
      </div>

      {/* Main Content Area: Split View */}
      <div className={`flex gap-6 transition-all duration-500 ${isWorkspaceOpen ? 'flex-row' : 'flex-col'}`}>
        
        {/* Transcript Panel */}
        <div className={`transition-all duration-500 ${isWorkspaceOpen ? 'w-1/2' : 'w-full'} space-y-6`}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>Neural Transcript</span>
              </h2>
              <button 
                onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100"
              >
                {isWorkspaceOpen ? 'Close Workspace' : 'Open Workspace'}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {debate.messages.map((message) => (
                <div key={message.id} className="space-y-2 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${getAgentColor(message.agent)}`}>
                      {message.agent}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${message.type === 'critique' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
                    {message.reasoning && (
                      <details className="mb-3 group">
                        <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 list-none flex items-center gap-2">
                          <Brain className="h-3 w-3 text-blue-400" />
                          THINKING PROCESS
                        </summary>
                        <div className="mt-2 text-xs text-slate-500 italic bg-white p-3 rounded-lg border border-slate-100 font-serif leading-relaxed">
                          {message.reasoning}
                        </div>
                      </details>
                    )}
                    <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {debate.messages.length === 0 && (
                <div className="text-center py-20 text-slate-300 italic">No messages yet...</div>
              )}
            </div>

            {/* Human Input at Bottom of Transcript */}
            {debate.status === 'waiting_for_human' && (
              <div className="p-4 bg-indigo-50 border-t border-indigo-100 animate-in slide-in-from-bottom-2">
                <div className="flex items-center space-x-2 mb-3 text-indigo-700">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Human Input Required</span>
                </div>
                <textarea
                  value={humanInput}
                  onChange={(e) => setHumanInput(e.target.value)}
                  placeholder="Direct the agents..."
                  className="w-full h-24 p-3 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white"
                />
                <button
                  onClick={handleResume}
                  disabled={!humanInput.trim() || isResuming}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                >
                  {isResuming ? 'Resuming...' : 'Inject & Resume'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Workspace (Canvas) Panel */}
        {isWorkspaceOpen && (
          <div className="w-1/2 bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[700px] animate-in slide-in-from-right-4">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Zap className="h-4 w-4 text-indigo-400" />
                </div>
                <h2 className="text-xs font-black text-slate-100 uppercase tracking-widest">Shared Canvas</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Synced</span>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
            
            <div className="flex-1 relative">
              <textarea
                value={canvasContent}
                onChange={(e) => {
                  setCanvasContent(e.target.value)
                  handleCanvasSave(e.target.value)
                }}
                className="absolute inset-0 w-full h-full bg-transparent p-8 text-indigo-100 font-mono text-sm leading-relaxed focus:outline-none resize-none no-scrollbar"
                placeholder="// Collaborative space..."
              />
            </div>
            
            <div className="p-3 bg-slate-900/50 border-t border-slate-800 flex justify-center">
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">End-to-End Synced Neural Workspace</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Debate
