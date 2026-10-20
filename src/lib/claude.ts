import Anthropic from '@anthropic-ai/sdk';
import type { ChatMsg, UserData } from './types';
import { contextForAi } from './assistant';

const SYSTEM = `Você é o JARVIS, assistente pessoal de rotina dentro de um app de organização de atividades.
Responda sempre em português do Brasil, de forma direta, amigável e curta (no máximo uns 8 parágrafos curtos ou uma lista).
Você recebe abaixo um resumo dos dados reais do usuário (atividades, metas, registros, desempenho e sono).
Sobre sono: a recomendação geral para adultos é de 7 a 9 horas por noite; você pode dar dicas de higiene do sono, mas não faça diagnósticos médicos. Use esses dados para responder perguntas como "quanto falta", "como está meu desempenho", "o que devo melhorar".
Quando der sugestões, seja concreto: cite atividades, dias e horários. Não invente dados que não estão no resumo.
Você não consegue alterar dados do app; se o usuário pedir para registrar algo, diga que ele pode tocar na atividade na tela Hoje (ou escrever "bebi água", "fui ao banheiro" etc. com a IA desligada).
Use **negrito** com moderação e listas com "•".`;

export class AiError extends Error {
  name = 'AiError';
}

/**
 * Pergunta ao Claude usando a chave de API do próprio usuário (fica salva só no aparelho).
 * `onText` recebe o texto parcial conforme ele chega.
 */
export async function askClaude(
  data: UserData,
  history: ChatMsg[],
  question: string,
  onText: (partial: string) => void,
): Promise<string> {
  const { apiKey, model } = data.settings;
  if (!apiKey.trim()) throw new AiError('Configure sua chave de API do Claude em Ajustes.');

  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history.slice(-12)) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) continue; // mantém a alternância user/assistant
    messages.push({ role: m.role, content: m.text });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: question });

  // Fallback automático no servidor caso o modelo recuse (não disponível no Haiku).
  const fallback =
    model === 'claude-haiku-5-5'
      ? {}
      : { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };

  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: `${SYSTEM}\n\n<dados_do_usuario>\n${contextForAi(data)}\n</dados_do_usuario>`,
      messages,
      ...fallback,
    });
    let text = '';
    stream.on('text', (delta) => {
      text += delta;
      onText(text);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal' && !text) throw new AiError('O modelo não quis responder essa pergunta.');
    return text.trim() || 'Não consegui gerar uma resposta agora.';
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave de API inválida. Confira em Ajustes.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('Sua chave não tem permissão para esse modelo.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso atingido. Tente de novo em alguns instantes.');
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`Pedido recusado pela API: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a internet.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da API (${e.status ?? '?'}). Tente novamente.`);
    throw new AiError('Algo deu errado ao falar com a IA.');
  }
}
