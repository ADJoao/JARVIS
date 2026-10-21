import Anthropic from '@anthropic-ai/sdk';
import type { ChatMsg, UserData } from './types';
import { contextForAi } from './assistant';
import { AI_TOOLS, runTool } from './aiTools';
import { store } from './storage';

const system = (userName: string) => `Você é o J.A.R.V.I.S., o assistente pessoal de ${userName}, inspirado no JARVIS do Tony Stark (Homem de Ferro).
Personalidade: educado, inteligente, leal, com um humor sutil e elegante. Você é proativo e motivador, mas nunca puxa-saco. Chame o usuário pelo nome de vez em quando.
Converse sobre QUALQUER assunto que o usuário trouxer (planos, ideias, dúvidas, estudos, negócios, desabafos), como um parceiro de conversa de verdade, e não só sobre a rotina.
Responda sempre em português do Brasil, de forma natural e curta (2 a 5 frases) a não ser que o usuário peça algo detalhado. Suas respostas podem ser lidas em voz alta, então evite tabelas e listas longas.

Você está dentro do app JARVIS, onde o usuário organiza rotina, notas, sono, finanças, pontos e metas. Abaixo há um resumo dos dados reais dele: use-os quando fizer sentido (ex.: "quanto falta", "como estou indo", metas de dinheiro) e não invente dados.
Você pode AGIR no app com as ferramentas: registrar atividades feitas, registrar dinheiro recebido ou gasto, adicionar/concluir tarefas em notas, marcar sono e criar atividades. Use uma ferramenta quando o usuário disser claramente que fez, recebeu, gastou ou pediu para anotar algo. Para valores apenas planejados ou esperados (ex.: "acho que vou ganhar 1000"), NÃO registre: comente, incentive e, se fizer sentido, ofereça registrar quando o dinheiro entrar ou ajudar a planejar.
Depois de usar uma ferramenta, confirme em uma frase o que foi feito.
Sobre saúde e sono: pode dar dicas gerais (adultos: 7 a 9h de sono), sem fazer diagnósticos.`;

export class AiError extends Error {
  name = 'AiError';
}

export interface AiReply {
  text: string;
  actions: string[];
}

/**
 * Conversa com o Claude usando a chave de API do próprio usuário (fica salva só no aparelho).
 * O Claude pode chamar ferramentas que agem no app (ver aiTools.ts); repetimos até ele terminar.
 */
export async function askClaude(data: UserData, userName: string, history: ChatMsg[], question: string): Promise<AiReply> {
  const { apiKey, model } = data.settings;
  if (!apiKey.trim()) throw new AiError('Configure sua chave de API do Claude em Ajustes.');

  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history.slice(-16)) {
    const last = messages[messages.length - 1];
    const text = m.actions?.length ? `${m.text}\n[Ações feitas no app: ${m.actions.join('; ')}]` : m.text;
    if (last && last.role === m.role) continue; // mantém a alternância user/assistant
    messages.push({ role: m.role, content: text });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: question });

  // Fallback automático no servidor caso o modelo recuse (não disponível no Haiku).
  const fallback =
    model === 'claude-haiku-5-5'
      ? {}
      : { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };

  const actions: string[] = [];
  try {
    for (let round = 0; round < 6; round++) {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        system: `${system(userName.split(' ')[0])}\n\n<dados_do_usuario>\n${contextForAi(store.get())}\n</dados_do_usuario>`,
        tools: AI_TOOLS,
        messages,
        ...fallback,
      });

      if (res.stop_reason === 'refusal') throw new AiError('O modelo não quis responder essa mensagem.');

      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !toolUses.length) {
        const text = res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
          .trim();
        return { text: text || (actions.length ? 'Feito! ✅' : 'Não consegui gerar uma resposta agora.'), actions };
      }

      // devolve o conteúdo do assistente sem alterar (inclui blocos de raciocínio) e executa as ferramentas
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
        const input = tu.input && typeof tu.input === 'object' ? (tu.input as Record<string, unknown>) : {};
        const r = runTool(tu.name, input);
        if (r.summary) actions.push(r.summary);
        return { type: 'tool_result', tool_use_id: tu.id, content: r.result, is_error: r.error || undefined };
      });
      messages.push({ role: 'user', content: results });
    }
    return { text: 'Fiz o que pude por aqui. ✅', actions };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave de API inválida. Confira em Ajustes.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('Sua chave não tem permissão para esse modelo.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso atingido. Tente de novo em alguns instantes.');
    if (e instanceof Anthropic.BadRequestError) {
      if (/credit|balance/i.test(e.message)) throw new AiError('Sua conta da Anthropic está sem créditos. Adicione créditos em console.anthropic.com.');
      throw new AiError(`Pedido recusado pela API: ${e.message}`);
    }
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a internet.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da API (${e.status ?? '?'}). Tente novamente.`);
    throw new AiError('Algo deu errado ao falar com a IA.');
  }
}

/** Testa a chave com uma chamada mínima. */
export async function testKey(apiKey: string, model: UserData['settings']['model']): Promise<string> {
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    const res = await client.messages.create({
      model,
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Diga apenas: "Sistemas online. Pronto para ajudar."' }],
    });
    const t = res.content.find((b) => b.type === 'text');
    return t && t.type === 'text' ? t.text : 'OK';
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave inválida.');
    if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) throw new AiError('Chave certa, mas a conta está sem créditos.');
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a internet.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da API (${e.status ?? '?'}): ${e.message}`);
    throw new AiError('Não foi possível testar.');
  }
}
