import pb from '@/lib/pocketbase/client'
import { Area } from '@/types/nps'

export async function getAreas(): Promise<Area[]> {
  const records = await pb.collection('areas').getFullList<Area>({
    sort: 'nome',
  })
  return records
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
