import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import { useToast } from '@/hooks/use-toast'

export type Perfil = 'admin' | 'gestor' | 'leitura'

// Expiração automática de sessão:
//  - o token do PocketBase vale 12 h (definido na migration 0004);
//  - além disso, inatividade de 30 min encerra a sessão no frontend.
const INACTIVITY_MS = 30 * 60 * 1000
const REFRESH_MS = 15 * 60 * 1000
const ACTIVITY_KEY = 'nps_fundatec_last_activity'

interface AuthContextType {
  user: RecordModel | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  perfil: Perfil | null
  precisaTrocarSenha: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: (motivo?: 'manual' | 'expirou') => void
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const lastActivityRef = useRef<number>(Date.now())
  const { toast } = useToast()

  useEffect(() => {
    const stored = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
    if (stored > 0) lastActivityRef.current = stored
    setUser(pb.authStore.record)
    setToken(pb.authStore.token)
    setIsLoading(false)

    const unsubscribe = pb.authStore.onChange((newToken, newRecord) => {
      setUser(newRecord)
      setToken(newToken)
      if (newToken) {
        lastActivityRef.current = Date.now()
        localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const doSignOut = (motivo: 'manual' | 'expirou') => {
    pb.authStore.clear()
    localStorage.removeItem(ACTIVITY_KEY)
    setUser(null)
    setToken(null)
    if (motivo === 'expirou') {
      toast({
        title: 'Sessão encerrada',
        description:
          'Sua sessão expirou por inatividade ou por validade do token. Faça login novamente.',
        variant: 'destructive',
      })
    }
  }

  // Atividade do usuário: mouse, teclado, toque e rolagem renovam a sessão.
  useEffect(() => {
    const mark = () => {
      lastActivityRef.current = Date.now()
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, mark, { passive: true }))
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, mark))
    }
  }, [])

  // Relógio de sessão: encerra por inatividade e renova o token periódicamente.
  useEffect(() => {
    const tick = () => {
      if (!pb.authStore.isValid) return
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        doSignOut('expirou')
        return
      }
      pb.collection('users')
        .authRefresh()
        .catch(() => {
          doSignOut('expirou')
        })
    }
    const inactivityTimer = window.setInterval(tick, 60 * 1000)
    const refreshTimer = window.setInterval(tick, REFRESH_MS)
    return () => {
      window.clearInterval(inactivityTimer)
      window.clearInterval(refreshTimer)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email.trim().toLowerCase(), password)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const signOut = (motivo: 'manual' | 'expirou' = 'manual') => {
    doSignOut(motivo)
  }

  const changePassword = async (senhaAtual: string, novaSenha: string) => {
    if (!user) return { error: new Error('Sessão não encontrada.') }
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: senhaAtual,
        password: novaSenha,
        passwordConfirm: novaSenha,
        precisa_trocar_senha: false,
      })
      // A troca de senha invalida o token anterior: reautentica limpo.
      await pb.collection('users').authWithPassword(user.email as string, novaSenha)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        perfil: (user?.perfil as Perfil | undefined) || null,
        precisaTrocarSenha: !!user?.precisa_trocar_senha,
        signIn,
        signOut,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
