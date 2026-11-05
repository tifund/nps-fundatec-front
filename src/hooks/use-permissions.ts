import { useAuth, Perfil } from '@/hooks/use-auth'

/**
 * Permissões por perfil de acesso (fonte única para menus e botões).
 * O backend também bloqueia pelas regras das coleções (migration 0004) —
 * aqui é a camada de experiência: esconde o que o perfil não pode fazer.
 */
export function usePermissions() {
  const { perfil } = useAuth()

  const isAdmin = perfil === 'admin'
  const isGestor = perfil === 'gestor'
  const isLeitura = perfil === 'leitura'
  const isStaff = isAdmin || isGestor

  return {
    perfil: perfil as Perfil | null,
    isAdmin,
    isGestor,
    isLeitura,
    isStaff,
    // Áreas de negócio: criar/editar/ativar/desativar/excluir para ADMIN e GESTOR
    canManageAreas: isStaff,
    // Campanhas e perguntas: criar/editar para ADMIN e GESTOR
    canManageCampaigns: isStaff,
    // Participantes (cadastro/importação): ADMIN e GESTOR
    canManageParticipants: isStaff,
    // Envio e reenvio de convites: ADMIN e GESTOR
    canSendInvites: isStaff,
    // Gestão de usuários: somente ADMIN
    canManageUsers: isAdmin,
    // Exclusões: somente ADMIN
    canDelete: isAdmin,
    // Exportação de relatórios: todos (inclusive LEITURA)
    canExport: true,
  }
}
