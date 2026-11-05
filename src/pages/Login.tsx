import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, Mail } from 'lucide-react'

export default function Login() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsLoading(true)

    const res = await signIn(email, password)
    setIsLoading(false)

    if (res.error) {
      // Mensagem genérica de erro: não revela se o e-mail existe.
      setErrorMsg('E-mail ou senha incorretos. Verifique suas credenciais de acesso.')
    } else {
      // ProtectedRoute redireciona para a troca de senha, se for primeiro acesso.
      navigate('/admin', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-800 via-sky-700 to-sky-600">
      {/* Faixa institucional */}
      <div className="bg-sky-900 py-3 px-4 text-center">
        <p className="text-sky-100 text-xs font-medium tracking-wide">
          Fundação Universidade Empresa de Tecnologia e Ciências
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white text-sky-800 font-black text-2xl shadow-md mb-3">
              F
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Fundatec NPS</h1>
            <p className="text-sm text-sky-100/90 mt-1">
              Sistema de Avaliação e Gestão de Net Promoter Score
            </p>
          </div>

          <Card className="border-slate-200 shadow-lg bg-white">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800">
                Acesso ao Painel Administrativo
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Entre com suas credenciais institucionais para gerenciar campanhas e indicadores.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {errorMsg && (
                  <Alert variant="destructive" className="py-2 text-xs">
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                    E-mail institucional
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@fundatec.org.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9 text-sm"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-700">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-9 text-sm"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-sky-700 hover:bg-sky-800"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar no Sistema'
                  )}
                </Button>
                <p className="text-[11px] text-slate-400 text-center">
                  Se você não possui credenciais, procure o administrador do sistema.
                </p>
              </CardFooter>
            </form>
          </Card>

          <p className="text-center text-xs text-sky-100/70 mt-6">
            Fundatec &copy; {new Date().getFullYear()} &bull; Painel de Gestão da Qualidade
          </p>
        </div>
      </div>
    </div>
  )
}
