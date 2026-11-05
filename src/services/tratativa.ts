// Tratativa de detratores: persiste o status na collection survey_responses
// (campos tratado/nota_interna/tratado_em/tratado_por — migration 0007).
// O create/update desses campos é permitido pela regra de update (ADMIN/GESTOR).
import pb from '@/lib/pocketbase/client'
import type { SurveyResponse } from '@/types/nps'

export async function marcarTratado(id: string, notaInterna: string): Promise<SurveyResponse> {
  const user = pb.authStore.record
  return await pb.collection('survey_responses').update<SurveyResponse>(id, {
    tratado: true,
    nota_interna: notaInterna || '',
    tratado_em: new Date().toISOString(),
    tratado_por: (user?.name as string) || (user?.email as string) || '',
  })
}

export async function desmarcarTratado(id: string): Promise<void> {
  await pb.collection('survey_responses').update(id, {
    tratado: false,
    nota_interna: '',
    tratado_em: '',
    tratado_por: '',
  })
}

// Marca/desmarca localmente após a gravação (o componente também recarrega).
export function aplicarLocalmente(
  respostas: SurveyResponse[],
  id: string,
  patch: Partial<SurveyResponse>,
): SurveyResponse[] {
  return respostas.map((r) => (r.id === id ? { ...r, ...patch } : r))
}
