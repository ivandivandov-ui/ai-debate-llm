import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Clock, MessageSquare, Users, CheckCircle, XCircle } from 'lucide-react'

interface DebateSummary {
  id: string
  query: string
  protocol: string
  status: 'completed' | 'failed' | 'running'
  agents: string[]
  messageCount: number
  usedFallback?: boolean
  startedAt: string
  completedAt?: string
  duration?: number
}

const History = () => {
  const { data: debates, isLoading } = useQuery({
    queryKey: ['debates'],
    queryFn: async () => {
      const response = await fetch('/api/debates')
      if (!response.ok) throw new Error('Failed to fetch debates')
      const data = await response.json() as { debates?: DebateSummary[] }
      return data.debates || []
    },
    refetchInterval: 5000,
  })

  const formatDuration = (durationMs: number) => {
    const seconds = Math.max(0, Math.floor(durationMs / 1000))
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'running':
        return <div className="h-4 w-4 bg-blue-500 rounded-full animate-pulse" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'running':
        return 'text-blue-600'
      default:
        return 'text-slate-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Debate History</h1>
        <p className="text-slate-600">View past and ongoing debates</p>
      </div>

      {debates && debates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No debates yet</h3>
          <p className="text-slate-600 mb-4">Start your first debate to see it here.</p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Start Debate
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {debates?.map((debate) => (
            <div key={debate.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Link
                    to={`/debate/${debate.id}`}
                    className="text-lg font-medium text-slate-900 hover:text-primary-600 transition-colors"
                  >
                    {debate.query}
                  </Link>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600">
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{debate.protocol}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{debate.agents.length} agents</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{debate.messageCount} messages</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {debate.usedFallback && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      fallback
                    </span>
                  )}
                  {getStatusIcon(debate.status)}
                  <span className={`text-sm font-medium ${getStatusColor(debate.status)}`}>
                    {debate.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Started: {new Date(debate.startedAt).toLocaleString()}</span>
                {debate.completedAt && (
                  <span>Completed: {new Date(debate.completedAt).toLocaleString()}</span>
                )}
                {debate.duration && (
                  <span>Duration: {formatDuration(debate.duration)}</span>
                )}
              </div>

              <div className="mt-4">
                <Link
                  to={`/debate/${debate.id}`}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 transition-colors"
                >
                  View Debate
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default History
