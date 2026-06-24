import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '@avl/sdk'

interface Props {
  children: React.ReactNode
}

export function AdminGuard({ children }: Props) {
  const { data, isLoading } = useCurrentUser()

  if (isLoading) return null

  const user = data?.data
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  return <>{children}</>
}
