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
  status: 'ativa' | 'encerrada'
  vigencia_fim?: string
  justificativa_detrator: 'obrigatoria' | 'geral' | 'nenhuma'
  texto_geral?: string
  slug: string
  created: string
  updated: string
  expand?: {
    area_id?: Area
  }
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
