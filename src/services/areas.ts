import pb from '@/lib/pocketbase/client'
import { Area } from '@/types/nps'

export async function getAreas(): Promise<Area[]> {
  const records = await pb.collection('areas').getFullList<Area>({
    sort: 'nome',
  })
  return records
}

/** Quantidade de campanhas vinculadas a cada área (mapa areaId -> total). */
export async function countCampaignsByArea(): Promise<Record<string, number>> {
  const campaigns = await pb.collection('campaigns').getFullList<{
    id: string
    area_id: string
  }>({
    fields: 'id,area_id',
  })
  const contagem: Record<string, number> = {}
  for (const camp of campaigns) {
    if (camp.area_id) {
      contagem[camp.area_id] = (contagem[camp.area_id] || 0) + 1
    }
  }
  return contagem
}

export async function createArea(data: { nome: string; ativa: boolean }): Promise<Area> {
  const record = await pb.collection('areas').create<Area>(data)
  return record
}

export async function updateArea(
  id: string,
  data: Partial<{ nome: string; ativa: boolean }>,
): Promise<Area> {
  const record = await pb.collection('areas').update<Area>(id, data)
  return record
}

export async function toggleAreaStatus(id: string, currentStatus: boolean): Promise<Area> {
  const record = await pb.collection('areas').update<Area>(id, {
    ativa: !currentStatus,
  })
  return record
}

export async function deleteArea(id: string): Promise<void> {
  await pb.collection('areas').delete(id)
}

/** Nome de área já existe (ignorando um id, na edição)? */
export function areaNameInUse(areas: Area[], nome: string, ignoreId?: string): boolean {
  const alvo = nome.trim().toLowerCase()
  if (!alvo) return false
  return areas.some((a) => a.id !== ignoreId && a.nome.trim().toLowerCase() === alvo)
}
