import axios, { AxiosError } from 'axios'
import { DebateData, DebateSummary, CreateDebateRequest } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 seconds for debates
})

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        const message = error.response.data?.error || error.response.data?.message || `Error: ${error.response.status}`
        console.error('API Error:', message, error.response.data)
      } else if (error.request) {
        // Request made but no response
        console.error('No response received:', error.request)
      } else {
        // Error in request setup
        console.error('Request setup error:', error.message)
      }
    }
    return Promise.reject(error)
  }
)

export const debateApi = {
  // Get all debates
  getDebates: async (limit = 50, offset = 0): Promise<DebateSummary[]> => {
    try {
      const response = await api.get('/debates', {
        params: { limit, offset },
      })
      return response.data.debates || []
    } catch (error) {
      console.error('Failed to fetch debates:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to fetch debates')
    }
  },

  // Get specific debate
  getDebate: async (id: string): Promise<DebateData> => {
    try {
      const response = await api.get(`/debates/${id}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch debate:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to fetch debate')
    }
  },

  // Create new debate
  createDebate: async (data: CreateDebateRequest): Promise<{ id: string }> => {
    try {
      const response = await api.post('/debates', data)
      return response.data
    } catch (error) {
      console.error('Failed to create debate:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to create debate')
    }
  },

  // Get debate status
  getDebateStatus: async (id: string): Promise<{ status: string }> => {
    try {
      const response = await api.get(`/debates/${id}/status`)
      return response.data
    } catch (error) {
      console.error('Failed to get debate status:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to get debate status')
    }
  },

  // Get/Save settings
  getSettings: async (): Promise<Record<string, unknown>> => {
    try {
      const response = await api.get('/settings')
      return response.data
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to fetch settings')
    }
  },

  saveSettings: async (settings: Record<string, unknown>): Promise<{ message: string }> => {
    try {
      const response = await api.post('/settings', settings)
      return response.data
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw new Error(error instanceof AxiosError ? error.response?.data?.error : 'Failed to save settings')
    }
  },

  // Health check
  healthCheck: async (): Promise<{ status: string }> => {
    try {
      const response = await api.get('/health')
      return response.data
    } catch (error) {
      console.error('Health check failed:', error)
      throw new Error('Backend is not available')
    }
  },
}

export default api