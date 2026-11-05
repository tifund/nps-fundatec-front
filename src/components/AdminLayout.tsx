import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import {
  BarChart3,
  Layers,
  Megaphone,
  Users,
  Send,
  LogOut,
  Menu,
  ExternalLink,
  UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

interface AdminLayoutProps {
  children: React.ReactNode
}

const perfilLabel: Record<string, string> = {
  admin: 'ADMIN',
  gestor: 'GESTOR',
  leitura: 'LEITURA',
}

const perfilBadgeClass: Record<string, string> = {
  admin: 'bg-sky-50 text-sky-700 border-sky-200',
  gestor: 'bg-amber-50 text-amber-700 border-amber-200',
  leitura: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut } = useAuth()
  const { perfil, canManageAreas, canManageCampaigns, canManageUsers } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const allNavItems = [
    { title: 'Dashboard NPS', href: '/admin', icon: BarChart3, show: true },
    { title: 'Áreas de Negócio', href: '/admin/areas', icon: Layers, show: true },
    { title: 'Campanhas', href: '/admin/campanhas', icon: Megaphone, show: true },
    { title: 'Participantes', href: '/admin/participantes', icon: Users, show: true },
    { title: 'Envios de Convites', href: '/admin/envios', icon: Send, show: true },
    {
      title: 'Usuários do Sistema',
      href: '/admin/usuarios',
      icon: UserCog,
      show: canManageUsers,
    },
  ]
  const navItems = allNavItems.filter((i) => i.show)

  const handleLogout = () => {
    signOut('manual')
    navigate('/login')
  }

  const NavLinks = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sky-50 text-sky-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-500'}`} />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col bg-white border-r border-slate-200 shadow-sm shrink-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              F
            </div>
            <div>
              <h1 className="font-bold text-slate-800 tracking-tight leading-tight">
                Fundatec NPS
              </h1>
              <p className="text-[11px] text-slate-500">Gestão de Satisfação</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ${perfilBadgeClass[perfil || 'leitura'] || perfilBadgeClass.leitura}`}
          >
            {perfilLabel[perfil || 'leitura']}
          </Badge>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase text-slate-400 px-3 mb-2 tracking-wider">
            Menu Principal
          </p>
          <NavLinks />

          <div className="mt-8 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold uppercase text-slate-400 px-3 mb-2 tracking-wider">
              Acesso Rápido
            </p>
            <Link
              to="/avaliar/aberto/nps-candidatos-concursos-2025"
              target="_blank"
              className="flex items-center justify-between px-3 py-2 text-xs text-slate-600 hover:text-sky-700 hover:bg-slate-50 rounded-md transition-colors"
            >
              <span>Exemplo Pesquisa Aberta</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
            <Link
              to="/avaliar/tok_mariana_2025_fundatec"
              target="_blank"
              className="flex items-center justify-between px-3 py-2 text-xs text-slate-600 hover:text-sky-700 hover:bg-slate-50 rounded-md transition-colors"
            >
              <span>Exemplo Convite Individual</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-800 text-xs font-semibold shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="truncate text-xs">
                <p className="font-medium text-slate-800 truncate">{user?.name || 'Usuário'}</p>
                <p className="text-slate-500 truncate text-[11px]">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title="Sair do sistema"
              className="text-slate-600 hover:text-rose-600 shrink-0 gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-sky-700 flex items-center justify-center text-white font-bold text-sm">
            F
          </div>
          <span className="font-bold text-slate-800 text-sm">Fundatec NPS</span>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
                <div className="w-7 h-7 rounded bg-sky-700 flex items-center justify-center text-white font-bold text-sm">
                  F
                </div>
                <span className="font-bold text-slate-800">Fundatec NPS</span>
              </div>
              <NavLinks />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-3 truncate">{user?.email}</div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair do sistema
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
