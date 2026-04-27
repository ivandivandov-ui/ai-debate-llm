import { useState } from 'react'
import { Play, Send, Zap, Brain, MessageSquare, Save } from 'lucide-react'

const Playground = () => {
  const [role, setRole] = useState('builder')
  const [prompt, setPrompt] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const roles = [
    { id: 'builder', name: 'Builder', icon: Zap },
    { id: 'critic', name: 'Critic', icon: MessageSquare },
    { id: 'skeptic', name: 'Skeptic', icon: Brain },
    { id: 'scientist', name: 'Scientist', icon: Send },
  ]

  const handleRun = async () => {
    if (!prompt || !query) return
    setIsLoading(true)
    try {
      const response = await fetch('/api/prompts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, prompt, query }),
      })
      const data = await response.json()
      setResult(data)
    } catch (err) {
      console.error('Playground error:', err)
      alert('Failed to run prompt test')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
          Prompt Playground
        </h1>
        <p className="text-slate-400 mt-2">Test and modulate agent neural directives in a sandbox environment.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-slate-700/50 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Agent Role</label>
              <div className="flex gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                      role === r.id 
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <r.icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">System Prompt (Neural Directives)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter system prompt instructions..."
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500/30 outline-none resize-none font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">User Query (Test Case)</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter what the user would ask..."
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500/30 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleRun}
              disabled={isLoading || !prompt || !query}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              {isLoading ? 'PROCESSING...' : 'RUN NEURAL TEST'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-slate-700/50 min-h-[500px] flex flex-col">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Output Log</h3>
            
            {!result && !isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic">
                <Brain className="w-12 h-12 mb-4 opacity-20" />
                <p>Awaiting neural execution...</p>
              </div>
            )}

            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="animate-pulse font-bold tracking-widest text-xs uppercase">Synthesizing response...</p>
              </div>
            )}

            {result && !isLoading && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {result.reasoning && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Internal Reasoning</span>
                    <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl text-xs text-indigo-300 italic font-serif leading-relaxed">
                      {result.reasoning}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Response</span>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {result.output}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                    <div className="text-[10px] font-black text-slate-500 uppercase">Latency</div>
                    <div className="text-sm font-bold text-slate-300">{result.metrics?.latencyMs}ms</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                    <div className="text-[10px] font-black text-slate-500 uppercase">Provider</div>
                    <div className="text-sm font-bold text-slate-300">{result.metrics?.provider}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Playground
