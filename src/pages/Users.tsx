import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Loader2, KeyRound, RefreshCw } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  name: string
  perfil: string
  precisa_trocar_senha: boolean
  verified: boolean
  created: string
}

const perfis = [
  { value: 'admin', label: 'ADMIN — acesso total, inclusive usuários' },
  { value: 'gestor', label: 'GESTOR — campanhas, participantes e envios' },
  { value: 'leitura', label: 'LEITURA — somente consulta e exportação' },
]

const formSchema = z.object({
  name: z.string().min(2, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  perfil: z.enum(['admin', 'gestor', 'leitura']),
  password: z
    .string()
    .min(10, 'Mínimo de 10 caracteres')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
    .regex(/[a-z]/, 'Inclua uma letra minúscula')
    .regex(/[0-9]/, 'Inclua um número')
    .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo'),
})

type FormData = z.infer<typeof formSchema>

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [perfilDialog, setPerfilDialog] = useState<UserRow | null>(null)
  const [novoPerfil, setNovoPerfil] = useState<string>('')
  const [resetDialog, setResetDialog] = useState<UserRow | null>(null)
  const [savingPerfil, setSavingPerfil] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', perfil: 'leitura', password: '' },
  })

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const rows = await pb.collection('users').getFullList({
        sort: 'created',
      })
      setUsers(rows as unknown as UserRow[])
    } catch {
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível obter a lista de usuários do sistema.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreate = async (data: FormData) => {
    try {
      await pb.collection('users').create({
        name: data.name,
        email: data.email.toLowerCase(),
        perfil: data.perfil,
        password: data.password,
        passwordConfirm: data.password,
        precisa_trocar_senha: true,
      })
      toast({
        title: 'Usuário criado',
        description: `${data.email} foi criado com perfil ${data.perfil.toUpperCase()}. A troca de senha será exigida no primeiro acesso.`,
      })
      form.reset({ name: '', email: '', perfil: 'leitura', password: '' })
      setDialogOpen(false)
      loadUsers()
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, msg] of Object.entries(fieldErrors)) {
          form.setError(field as keyof FormData, { message: msg })
        }
      } else {
        toast({
          title: 'Erro ao criar usuário',
          description: getErrorMessage(err),
          variant: 'destructive',
        })
      }
    }
  }

  const handleChangePerfil = async () => {
    if (!perfilDialog || !novoPerfil) return
    setSavingPerfil(true)
    try {
      await pb.collection('users').update(perfilDialog.id, { perfil: novoPerfil })
      toast({
        title: 'Perfil atualizado',
        description: `${perfilDialog.email} agora tem perfil ${novoPerfil.toUpperCase()}.`,
      })
      setPerfilDialog(null)
      loadUsers()
    } catch {
      toast({
        title: 'Erro ao atualizar perfil',
        description: 'Não foi possível alterar o perfil deste usuário.',
        variant: 'destructive',
      })
    } finally {
      setSavingPerfil(false)
    }
  }

  const handleResetSenha = async () => {
    if (!resetDialog) return
    setSavingPerfil(true)
    try {
      // Marca a troca obrigatória; a nova senha é definida no primeiro acesso
      // via tela de troca obrigatória, usando a senha provisória informada.
      const prov = 'Fund@2025#' + Math.random().toString(36).slice(2, 8)
      await pb.collection('users').update(resetDialog.id, {
        precisa_trocar_senha: true,
        password: prov,
        passwordConfirm: prov,
      })
      toast({
        title: 'Senha redefinida',
        description: `Senha provisória de ${resetDialog.email}: ${prov} (informe-a com segurança e exija a troca no primeiro acesso).`,
        duration: 20000,
      })
      setResetDialog(null)
      loadUsers()
    } catch {
      toast({
        title: 'Erro ao redefinir senha',
        description: 'Não foi possível redefinir a senha deste usuário.',
        variant: 'destructive',
      })
    } finally {
      setSavingPerfil(false)
    }
  }

  const perfilBadge = (perfil: string) => {
    if (perfil === 'admin')
      return (
        <Badge className="bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100">ADMIN</Badge>
      )
    if (perfil === 'gestor')
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
          GESTOR
        </Badge>
      )
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">
        LEITURA
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Usuários do Sistema</h1>
          <p className="text-sm text-slate-500">
            Gerencie as contas de acesso ao painel e os perfis de permissão (ADMIN, GESTOR,
            LEITURA).
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-sky-700 hover:bg-sky-800">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo usuário
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Contas de acesso ({users.length})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            O perfil define o que cada conta pode fazer no painel e é validado também no backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">E-mail</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Perfil</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Troca de senha
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium text-slate-800">
                      {u.name || '—'}
                      {currentUser?.id === u.id && (
                        <span className="ml-2 text-[10px] text-sky-700 font-semibold">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                    <TableCell>{perfilBadge(u.perfil)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {u.precisa_trocar_senha ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                        >
                          Obrigatória no próximo acesso
                        </Badge>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-sky-700 hover:text-sky-800"
                        onClick={() => {
                          setPerfilDialog(u)
                          setNovoPerfil(u.perfil)
                        }}
                        disabled={currentUser?.id === u.id}
                      >
                        Trocar perfil
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-600 hover:text-slate-800"
                        onClick={() => setResetDialog(u)}
                        disabled={currentUser?.id === u.id}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        Redefinir senha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: novo usuário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo usuário</DialogTitle>
            <DialogDescription>
              Defina uma senha provisória forte; a troca será exigida no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Nome</Label>
              <Input {...form.register('name')} placeholder="Nome completo" className="text-sm" />
              {form.formState.errors.name && (
                <p className="text-[11px] text-rose-600">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">E-mail</Label>
              <Input
                {...form.register('email')}
                type="email"
                placeholder="nome@fundatec.org.br"
                className="text-sm"
              />
              {form.formState.errors.email && (
                <p className="text-[11px] text-rose-600">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Perfil de acesso</Label>
              <Select
                value={form.watch('perfil')}
                onValueChange={(v) => form.setValue('perfil', v as FormData['perfil'])}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Senha provisória</Label>
              <Input
                {...form.register('password')}
                type="text"
                placeholder="Ex.: Fr4s3@Longa#2025"
                className="text-sm font-mono"
              />
              {form.formState.errors.password && (
                <p className="text-[11px] text-rose-600">
                  {form.formState.errors.password.message}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                Use ao menos 10 caracteres, com maiúscula, minúscula, número e símbolo.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-sky-700 hover:bg-sky-800"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: trocar perfil */}
      <Dialog open={!!perfilDialog} onOpenChange={(o) => !o && setPerfilDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar perfil de acesso</DialogTitle>
            <DialogDescription>
              {perfilDialog?.email} — a permissão passa a valer imediatamente, inclusive no backend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={novoPerfil} onValueChange={setNovoPerfil}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o novo perfil" />
              </SelectTrigger>
              <SelectContent>
                {perfis.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangePerfil}
              className="bg-sky-700 hover:bg-sky-800"
              disabled={savingPerfil}
            >
              {savingPerfil ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Salvar perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: redefinir senha */}
      <Dialog open={!!resetDialog} onOpenChange={(o) => !o && setResetDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Uma nova senha provisória será gerada para {resetDialog?.email} e a troca será exigida
              no próximo acesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleResetSenha}
              className="bg-sky-700 hover:bg-sky-800"
              disabled={savingPerfil}
            >
              {savingPerfil ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              Gerar senha provisória
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
