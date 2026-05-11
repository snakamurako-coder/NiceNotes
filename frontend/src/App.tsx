import './App.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskApp } from './TaskApp'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TaskApp />
    </QueryClientProvider>
  )
}
