/**
 * Geração de senha provisória para redefinição pelo painel.
 * A senha existe apenas em memória no navegador (nunca é gravada em
 * coleção nem impressa em console) — cabe ao admin copiá-la e comunicá-la
 * ao usuário por um canal seguro.
 */

const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz' // sem 'l' para evitar confusão
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem 'I' e 'O' para evitar confusão
const DIGITOS = '0123456789'
const SIMBOLOS = '!@#$%&*?-_+'
const TODOS = MINUSCULAS + MAIUSCULAS + DIGITOS + SIMBOLOS

/** Sorteia um índice aleatório criptográfico no intervalo [0, max). */
function indiceAleatorio(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

/**
 * Gera uma senha provisória aleatória e forte (padrão: 16 caracteres,
 * com ao menos uma minúscula, uma maiúscula, um dígito e um símbolo).
 */
export function gerarSenhaProvisoria(tamanho = 16): string {
  if (tamanho < 8) tamanho = 8

  // Garante pelo menos um caractere de cada classe exigida.
  const obrigatorios = [
    MINUSCULAS[indiceAleatorio(MINUSCULAS.length)],
    MAIUSCULAS[indiceAleatorio(MAIUSCULAS.length)],
    DIGITOS[indiceAleatorio(DIGITOS.length)],
    SIMBOLOS[indiceAleatorio(SIMBOLOS.length)],
  ]

  const caracteres = [...obrigatorios]
  while (caracteres.length < tamanho) {
    caracteres.push(TODOS[indiceAleatorio(TODOS.length)])
  }

  // Embaralhamento Fisher–Yates para não prever a posição das classes.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = indiceAleatorio(i + 1)
    ;[caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]]
  }

  return caracteres.join('')
}

/**
 * Copia um texto para a área de transferência. Usa a API moderna quando
 * disponível e cai para o método legado (área de transferência pode estar
 * bloqueada em contextos não seguros).
 */
export async function copiarParaAreaTransferencia(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // cai para o fallback abaixo
  }
  try {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
