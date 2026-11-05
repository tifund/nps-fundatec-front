export interface Area {
  id: string
  nome: string
  ativa: boolean
  created: string
  updated: string
}

export interface Campaign {
  id: string
  nome: string
  area_id: string
  pergunta_nps: string
  modo_acesso: 'convites' | 'link_aberto'
  status: 'rascunho' | 'ativa' | 'encerrada'
  vigencia_tipo: 'continua' | 'prazo'
  vigencia_fim: string
  justificativa_detrator: 'obrigatoria' | 'geral' | 'nenhuma'
  justificativa_geral: string
  texto_geral: string
  texto_email_convite: string
  slug: string
  created: string
  updated: string
  expand?: {
    area_id?: Area
  }
  area_nome?: string
}

// Dados enviados ao criar/editar uma campanha (payload da tela "Campanhas")
export interface CreateCampaignPayload {
  nome: string
  area_id: string
  pergunta_nps: string
  modo_acesso: 'convites' | 'link_aberto'
  status: 'rascunho' | 'ativa' | 'encerrada'
  vigencia_tipo: 'continua' | 'prazo'
  vigencia_fim?: string
  justificativa_detrator: 'obrigatoria' | 'geral' | 'nenhuma'
  justificativa_geral?: string
  texto_geral?: string
  texto_email_convite?: string
  slug: string
}

// Agregados por campanha para a lista (respondidos/convocados e NPS atual)
export interface CampaignStats {
  respondidos: number
  convocados: number
  respostas: number
  nps: number | null
}

// Pergunta adicional de campanha (mesma forma de Question, sem timestamps)
export interface CampaignQuestion {
  id: string
  campaign_id: string
  enunciado: string
  tipo: 'nota' | 'texto'
  obrigatoria: boolean
  ordem: number
}

export interface Question {
  id: string
  campaign_id: string
  enunciado: string
  tipo: 'nota' | 'texto'
  obrigatoria: boolean
  ordem: number
  created: string
  updated: string
}

export interface Participant {
  id: string
  campaign_id: string
  nome: string
  email: string
  token: string
  respondido: boolean
  respondido_em?: string
  created: string
  updated: string
  expand?: {
    campaign_id?: Campaign
  }
}

export interface Dispatch {
  id: string
  campaign_id: string
  participant_id?: string
  tipo: 'inicial' | 'reenvio' | 'copia_link'
  destinatario: string
  status: 'sucesso' | 'falha' | 'registrado'
  detalhe?: string
  created: string
  updated: string
  expand?: {
    campaign_id?: Campaign
    participant_id?: Participant
  }
}

export interface AdditionalAnswer {
  question_id: string
  enunciado: string
  valor: string | number
}

export interface SurveyResponse {
  id: string
  campaign_id: string
  participant_id?: string
  nota: number
  classificacao: 'promotor' | 'neutro' | 'detrator'
  comentario?: string
  justificativa_detrator?: string
  anonimo: boolean
  respostas_adicionais?: AdditionalAnswer[]
  // Tratativa de detratores (painel) — migration 0007
  tratado?: boolean
  nota_interna?: string
  tratado_em?: string
  tratado_por?: string
  created: string
  updated: string
  expand?: {
    campaign_id?: Campaign
    participant_id?: Participant
  }
}

export interface SystemLog {
  id: string
  acao: string
  detalhe?: string
  usuario?: string
  created: string
  updated: string
}

// Contexto devolvido pela rota pública /backend/v1/nps/survey-context
// (o acesso público direto a campaigns/participants/questions está fechado)
export interface SurveyContext {
  campaign: {
    id: string
    nome: string
    pergunta_nps: string
    texto_geral?: string
    justificativa_detrator: 'obrigatoria' | 'geral' | 'nenhuma'
    status: 'ativa' | 'encerrada'
    vigencia_fim?: string
    modo_acesso: 'convites' | 'link_aberto'
    area_nome: string
  }
  participant: { id: string; nome: string; respondido: boolean } | null
  questions: Pick<Question, 'id' | 'enunciado' | 'tipo' | 'obrigatoria' | 'ordem'>[]
  closed_reason: '' | 'encerrada' | 'expirada' | 'ja_respondida'
}
