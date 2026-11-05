import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, Perfil } from '@/hooks/use-auth'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, precisaTrocarSenha } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-sm text-slate-500">Carregando painel...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Primeiro acesso (ou senha redefinida pelo admin): troca de senha
  // obrigatória antes de qualquer outra tela do painel.
  if (precisaTrocarSenha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }

  return <>{children}</>
}

/**
 * Bloqueia rotas por perfil no roteador (ex.: gestão de usuários é ADMIN).
 * Também respeita a troca obrigatória de senha do primeiro acesso.
 */
export function RequirePerfil({
  perfis,
  children,
}: {
  perfis: Perfil[]
  children: React.ReactNode
}) {
  const { perfil, isAuthenticated, isLoading, precisaTrocarSenha } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (precisaTrocarSenha) {
    return <Navigate to="/trocar-senha" replace />
  }

  if (!perfil || !perfis.includes(perfil)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center p-6">
        <ShieldAlert className="w-10 h-10 text-rose-500" />
        <h2 className="text-lg font-semibold text-slate-800">Acesso restrito</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Seu perfil de acesso não tem permissão para visualizar esta tela. Procure o administrador
          do sistema caso precise de acesso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
