import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/auth-context'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { queryClient } from '@/services/query-client'
import { router } from '@/routes/routes'

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}