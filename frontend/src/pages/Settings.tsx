import { useState, useEffect } from 'react'
import { Save, Key, Server, AlertCircle, CheckCircle, Users, FileText, Database, Plus, Trash2, Edit2, Info, HelpCircle } from 'lucide-react'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('providers')
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
    openrouter: '',
    groq: '',
    mistral: '',
    cohere: '',
    together: '',
    perplexity: '',
  })

  const [serverSettings, setServerSettings] = useState({
    port: '3000',
    host: 'localhost',
    maxRounds: '10',
    timeout: '300',
  })

  const [dbApiKeys, setDbApiKeys] = useState<Record<string, { status: string, updatedAt: number }>>({})
  const [roles, setRoles] = useState<any[]>([])
  const [protocols, setProtocols] = useState<any[]>([])
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [showMcpForm, setShowMcpForm] = useState(false)
  const [newMcp, setNewMcp] = useState({ id: '', name: '', type: 'stdio', command: '', args: '', baseUrl: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [editingRole, setEditingRole] = useState<any | null>(null)
  const [showRoleForm, setShowRoleForm] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [settingsRes, rolesRes, protocolsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/roles'),
          fetch('/api/protocols')
        ])

        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (settings.apiKeys) setApiKeys(settings.apiKeys)
          if (settings.dbApiKeys) setDbApiKeys(settings.dbApiKeys)
          if (settings.serverSettings) setServerSettings(settings.serverSettings)
        }

        if (rolesRes.ok) {
          const data = await rolesRes.json()
          setRoles(data.roles || [])
        }

        if (protocolsRes.ok) {
          const data = await protocolsRes.json()
          setProtocols(data.protocols || [])
        }

        const mcpRes = await fetch('/api/mcp/servers')
        if (mcpRes.ok) {
          const data = await mcpRes.json()
          setMcpServers(data.servers || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setIsLoading(false)
      }
    }

    loadAll()
  }, [])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys, serverSettings }),
      })
      if (!response.ok) throw new Error('Failed to save settings')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      
      // Refresh provider status
      const settingsRes = await fetch('/api/settings')
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        if (settings.dbApiKeys) setDbApiKeys(settings.dbApiKeys)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveRole = async (role: any) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      })
      if (!response.ok) throw new Error('Failed to save role')
      
      // Refresh roles
      const rolesRes = await fetch('/api/roles')
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.roles || [])
      }
      
      setShowRoleForm(false)
      setEditingRole(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return
    try {
      const response = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete role')
      setRoles(roles.filter(r => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role')
    }
  }

  const handleAddMcpServer = async () => {
    setIsSaving(true)
    try {
      const payload = {
        ...newMcp,
        args: newMcp.args ? newMcp.args.split(',').map(s => s.trim()) : []
      }
      const response = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Failed to register MCP server')
      
      const mcpRes = await fetch('/api/mcp/servers')
      if (mcpRes.ok) {
        const data = await mcpRes.json()
        setMcpServers(data.servers || [])
      }
      setShowMcpForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add MCP server')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-400 font-medium animate-pulse">Synchronizing system settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
            Control Center
          </h1>
          <p className="text-slate-400 mt-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            Synthesis Engine v1.2 • Configuration & Governance
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {success && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20 animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Synchronized</span>
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl font-bold transition-all shadow-2xl ${
              isSaving 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/40 active:scale-95 border border-blue-400/30'
            }`}
          >
            {isSaving ? (
              <div className="w-5 h-5 border-3 border-slate-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? 'UPDATING...' : 'SAVE ALL CHANGES'}
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex p-1 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'providers', label: 'API Providers', icon: Key },
          { id: 'roles', label: 'Agent Roles', icon: Users },
          { id: 'mcp', label: 'MCP Tools', icon: Database },
          { id: 'docs', label: 'Protocol Documentation', icon: FileText },
          { id: 'server', label: 'Engine Config', icon: Server },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-600'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-red-500/5">
          <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="font-black uppercase text-xs tracking-widest text-red-500">System Error</h3>
            <p className="text-sm font-medium leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {activeTab === 'providers' && (
          <section className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl">
                <Key className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Access Gateways</h2>
                <p className="text-slate-400 text-sm">Secure your neural network entry points</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(apiKeys).map(([provider, value]) => (
                <div key={provider} className="group bg-slate-900/50 border border-slate-700/50 p-5 rounded-2xl space-y-4 hover:border-blue-500/50 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-400 transition-colors">
                      {provider}
                    </label>
                    {dbApiKeys[provider] && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        <CheckCircle className="w-3 h-3" /> ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={value}
                      onChange={(e) => setApiKeys({ ...apiKeys, [provider]: e.target.value })}
                      placeholder="ENTER TOKEN..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'roles' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-slate-800/30 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-2xl">
                  <Users className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Agent Archetypes</h2>
                  <p className="text-slate-400 text-sm">Define and modulate agent personalities</p>
                </div>
              </div>
              <button 
                onClick={() => { setEditingRole({ id: `role_${Date.now()}`, name: '', system_prompt: '', preferred_provider: 'google', preferred_model: 'gemini-pro' }); setShowRoleForm(true); }}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-5 h-5" /> NEW ROLE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roles.map((role) => (
                <div key={role.id} className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl space-y-4 hover:border-purple-500/30 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-slate-100">{role.name}</h3>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500 px-2 py-0.5 bg-slate-900 rounded-md border border-slate-700">
                        ID: {role.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setEditingRole(role); setShowRoleForm(true); }}
                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3 italic leading-relaxed">
                    "{role.system_prompt}"
                  </p>
                  <div className="pt-4 border-t border-slate-700/50 flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Database className="w-3.5 h-3.5" />
                      {role.preferred_provider}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Info className="w-3.5 h-3.5" />
                      {role.preferred_model}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showRoleForm && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-xl font-black text-slate-100 uppercase">
                      {editingRole?.id ? 'Adjust Archetype' : 'Forge New Role'}
                    </h3>
                    <button onClick={() => setShowRoleForm(false)} className="text-slate-500 hover:text-white">×</button>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                        <input 
                          type="text" 
                          value={editingRole.name} 
                          onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/30 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Internal ID</label>
                        <input 
                          type="text" 
                          value={editingRole.id} 
                          onChange={e => setEditingRole({...editingRole, id: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/30 outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Neural Directives (System Prompt)</label>
                      <textarea 
                        rows={5}
                        value={editingRole.system_prompt} 
                        onChange={e => setEditingRole({...editingRole, system_prompt: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/30 outline-none resize-none"
                        placeholder="Define the core behavioral logic..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Target Provider</label>
                        <select 
                          value={editingRole.preferred_provider}
                          onChange={e => setEditingRole({...editingRole, preferred_provider: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/30 outline-none"
                        >
                          <option value="google">Google Gemini</option>
                          <option value="groq">Groq (Llama-3)</option>
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic Claude</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Specific Model</label>
                        <input 
                          type="text" 
                          value={editingRole.preferred_model} 
                          onChange={e => setEditingRole({...editingRole, preferred_model: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/30 outline-none"
                          placeholder="e.g. gemini-pro, llama3-70b..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={() => setShowRoleForm(false)} className="px-6 py-2.5 font-bold text-slate-400 hover:text-white transition-colors">CANCEL</button>
                    <button 
                      onClick={() => handleSaveRole(editingRole)}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-2.5 rounded-xl font-black shadow-xl shadow-purple-500/20"
                    >
                      COMMIT CHANGES
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'mcp' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-slate-800/30 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-2xl">
                  <Database className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">MCP Connectors</h2>
                  <p className="text-slate-400 text-sm">Bridge agents to local files, databases, and APIs</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowMcpForm(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-5 h-5" /> ADD CONNECTOR
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mcpServers.map((server) => (
                <div key={server.id} className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-slate-100">{server.name}</h3>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500 px-2 py-0.5 bg-slate-900 rounded-md border border-slate-700">
                        {server.type.toUpperCase()} • {server.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-green-500">CONNECTED</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 overflow-hidden text-ellipsis">
                    {server.type === 'stdio' ? `${server.command} ${server.args?.join(' ') || ''}` : server.baseUrl}
                  </div>
                </div>
              ))}
              {mcpServers.length === 0 && (
                <div className="col-span-full text-center py-16 border-2 border-dashed border-slate-700/50 rounded-3xl">
                  <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 italic">No MCP connectors configured. Bridge your system to external data.</p>
                </div>
              )}
            </div>

            {showMcpForm && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-xl font-black text-slate-100 uppercase">New MCP Connector</h3>
                    <button onClick={() => setShowMcpForm(false)} className="text-slate-500 hover:text-white">×</button>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Unique ID</label>
                        <input 
                          type="text" 
                          value={newMcp.id} 
                          onChange={e => setNewMcp({...newMcp, id: e.target.value})}
                          placeholder="e.g. filesystem_local"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                        <input 
                          type="text" 
                          value={newMcp.name} 
                          onChange={e => setNewMcp({...newMcp, name: e.target.value})}
                          placeholder="e.g. Local Files"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Connection Type</label>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setNewMcp({...newMcp, type: 'stdio'})}
                          className={`flex-1 py-3 rounded-xl font-bold border transition-all ${newMcp.type === 'stdio' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                        >
                          STDIO (Local)
                        </button>
                        <button 
                          onClick={() => setNewMcp({...newMcp, type: 'http'})}
                          className={`flex-1 py-3 rounded-xl font-bold border transition-all ${newMcp.type === 'http' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                        >
                          HTTP (Remote)
                        </button>
                      </div>
                    </div>

                    {newMcp.type === 'stdio' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Command</label>
                          <input 
                            type="text" 
                            value={newMcp.command} 
                            onChange={e => setNewMcp({...newMcp, command: e.target.value})}
                            placeholder="e.g. npx"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Arguments (comma separated)</label>
                          <input 
                            type="text" 
                            value={newMcp.args} 
                            onChange={e => setNewMcp({...newMcp, args: e.target.value})}
                            placeholder="e.g. -y, @modelcontextprotocol/server-filesystem, /path/to/docs"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Base URL</label>
                        <input 
                          type="text" 
                          value={newMcp.baseUrl} 
                          onChange={e => setNewMcp({...newMcp, baseUrl: e.target.value})}
                          placeholder="https://mcp.example.com/api"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={() => setShowMcpForm(false)} className="px-6 py-2.5 font-bold text-slate-400 hover:text-white transition-colors">CANCEL</button>
                    <button 
                      onClick={handleAddMcpServer}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black shadow-xl shadow-blue-500/20"
                    >
                      INITIALIZE CONNECTOR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'docs' && (
          <section className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Intelligence Protocols</h2>
                <p className="text-slate-400 text-sm">Documentation for logic flow & debate structures</p>
              </div>
            </div>

            <div className="space-y-6">
              {protocols.map((protocol) => (
                <div key={protocol.id} className="bg-slate-900/50 border border-slate-700/50 p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-blue-400">{protocol.name}</h3>
                    <span className="text-xs font-black bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30 tracking-widest uppercase">
                      READY
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic border-l-4 border-blue-500/30 pl-4 py-1">
                    {protocol.description}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Max Rounds</div>
                      <div className="text-lg font-bold text-slate-200">6</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Stability</div>
                      <div className="text-lg font-bold text-green-400">99%</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Complexity</div>
                      <div className="text-lg font-bold text-orange-400">High</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Sync Type</div>
                      <div className="text-lg font-bold text-blue-400">Parallel</div>
                    </div>
                  </div>
                </div>
              ))}
              {protocols.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-700/50 rounded-3xl">
                  <p className="text-slate-500 italic">No protocols discovered in registry.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'server' && (
          <section className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <Server className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Core Hydraulics</h2>
                <p className="text-slate-400 text-sm">Fine-tune the underlying execution engine</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Network Interface (Host)</label>
                  <input 
                    type="text" 
                    value={serverSettings.host} 
                    onChange={e => setServerSettings({...serverSettings, host: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/30 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Access Port</label>
                  <input 
                    type="text" 
                    value={serverSettings.port} 
                    onChange={e => setServerSettings({...serverSettings, port: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/30 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Global Max Rounds</label>
                  <input 
                    type="number" 
                    value={serverSettings.maxRounds} 
                    onChange={e => setServerSettings({...serverSettings, maxRounds: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/30 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Execution Timeout (ms)</label>
                  <input 
                    type="number" 
                    value={serverSettings.timeout} 
                    onChange={e => setServerSettings({...serverSettings, timeout: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/30 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-xl h-fit">
                <HelpCircle className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-200">Optimization Tip</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Lower timeouts improve responsiveness but may cause premature terminations on complex reasoning tasks. 
                  We recommend 30,000ms for Llama-3 based flows.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      <footer className="text-center pt-8 border-t border-slate-800/50 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-slate-600">
          <Database className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Synthesis Neural Core • 2024</span>
        </div>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest italic font-medium opacity-50">
          "The clash of ideas is the spark of progress"
        </p>
      </footer>
    </div>
  )
}

export default Settings