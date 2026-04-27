import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Debate from './pages/Debate'
import Settings from './pages/Settings'
import History from './pages/History'
import Playground from './pages/Playground'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/debate/:id" element={<Debate />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/playground" element={<Playground />} />
        </Routes>
      </Layout>
    </QueryClientProvider>
  )
}

export default App