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
import { Loader2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function ChangePassword() {
  const { user, changePassword, signOut } = useAuth()
  const navigate = useNavigate()

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const senhaForte =
    nova.length >= 10 &&
    /[a-z]/.test(nova) &&
    /[A-Z]/.test(nova) &&
    /[0-9]/.test(nova) &&
    /[^A-Za-z0-9]/.test(nova)

  const requisitos = [
    { ok: nova.length >= 10, label: 'Mínimo de 10 caracteres' },
    { ok: /[A-Z]/.test(nova), label: 'Uma letra maiúscula' },
    { ok: /[a-z]/.test(nova), label: 'Uma letra minúscula' },
    { ok: /[0-9]/.test(nova), label: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(nova), label: 'Um símbolo (ex.: !@#$%)' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (nova !== confirmacao) {
      setErro('A confirmação da nova senha não corresponde à nova senha informada.')
      return
    }
    if (!senhaForte) {
      setErro('A nova senha não atende aos requisitos mínimos de segurança.')
      return
    }
    if (nova === atual) {
      setErro('A nova senha deve ser diferente da senha atual.')
      return
    }

    setIsLoading(true)
    const res = await changePassword(atual, nova)
    setIsLoading(false)

    if (res.error) {
      setErro('Não foi possível alterar a senha. Verifique a senha atual e tente novamente.')
      return
    }

    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-700 text-white font-black text-xl shadow-md mb-3">
            F
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Fundatec NPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Primeiro acesso — troca de senha obrigatória
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600" />
              Defina sua nova senha
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {user?.email ? `Conta: ${user.email}` : ''} Por segurança, esta etapa é obrigatória
              antes de acessar o painel.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {erro && (
                <Alert variant="destructive" className="py-2 text-xs">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="atual" className="text-xs font-medium text-slate-700">
                  Senha atual (provisória)
                </Label>
                <Input
                  id="atual"
                  type="password"
                  value={atual}
                  onChange={(e) => setAtual(e.target.value)}
                  required
                  className="text-sm"
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nova" className="text-xs font-medium text-slate-700">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="nova"
                    type={mostrar ? 'text' : 'password'}
                    value={nova}
                    onChange={(e) => setNova(e.target.value)}
                    required
                    className="pl-9 pr-9 text-sm"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {requisitos.map((r) => (
                    <li
                      key={r.label}
                      className={`text-[11px] flex items-center gap-1.5 ${
                        r.ok ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full inline-block ${
                          r.ok ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmacao" className="text-xs font-medium text-slate-700">
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirmacao"
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  required
                  className="text-sm"
                  autoComplete="new-password"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                className="w-full bg-sky-700 hover:bg-sky-800"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar nova senha e continuar'
                )}
              </Button>
              <button
                type="button"
                onClick={() => {
                  signOut('manual')
                  navigate('/login', { replace: true })
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Sair (voltar ao login)
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
