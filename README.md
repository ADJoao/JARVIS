# JARVIS

Seu app pessoal para organizar a rotina: atividades, agenda, relatório semanal e um assistente que responde perguntas sobre o seu dia. Tudo com visual de vidro (glassmorphism), 100% gratuito, e os dados ficam só no seu celular.

## O que ele faz

- **Login** com usuário e senha. A senha fica guardada com hash (PBKDF2). Cada conta tem os próprios dados, salvos só no aparelho.
- **Hoje**: anel com o progresso do dia, a semana em miniatura, dias seguidos ("streak") e a lista de atividades. Atividade de 1 vez você marca com ✓; atividade com meta (ex.: 8 copos de água) você vai somando com +.
- **Tempo desde o último**: cartões que mostram há quanto tempo você não faz algo (💩 banheiro, 💧 água…), e ficam vermelhos quando passa do limite definido.
- **Agenda** (botão de calendário no topo da tela Hoje): calendário mensal. A cor de cada dia mostra quanto você cumpriu. Tocando num dia passado você ainda pode marcar o que esqueceu.
- **Rotinas**: crie e edite atividades com ícone (emoji) e cor do seu jeito, agenda (todo dia, dias da semana, uma vez ou livre), horário, meta por dia, lembrete e alerta de "X horas sem fazer". Já vem com modelos prontos (banheiro, água, refeições, estudos, treino, trabalho, remédio, sono, leitura, meditação).
- **Finanças** (painel estilo gateway): saldo (começa em R$ 0 e você ajusta para o valor atual), entradas e saídas, faturamento de hoje, 7 dias e mês, gráfico por dia, meta com prazo opcional (mostrada em %, em "R$ X de R$ Y" ou nos dois) e botão de olho para esconder os valores. Ao registrar uma entrada aparece uma comemoração e chega uma notificação estilo "💸 Venda aprovada!" com frase motivacional e o progresso da meta. Também há uma frase motivacional diária ou semanal, no dia e horário que você escolher, com frases que você mesmo edita.
- **Vários horários por atividade**: ex.: remédio de 8 em 8 horas (06:20, 14:20, 22:20), com lembrete em cada horário.
- **Relatório semanal**: "8 de 10 concluídas", nota (Excelente / Muito bom / Regular / Precisa melhorar), comparação com a semana anterior, gráfico por dia, desempenho por atividade e dicas do que melhorar.
- **Assistente JARVIS**: pergunte "o que eu tenho hoje?", "quanto falta para terminar a água?", "quanto tempo estou sem ir ao banheiro?", "como está meu desempenho?", "o que devo melhorar?", "quanto eu dormi?". Ele também registra coisas quando você escreve "bebi água" ou "fui ao banheiro". Funciona **offline e de graça**.
  - Opcional: em **Ajustes**, ative o **Claude** com a sua chave de API ([console.anthropic.com](https://console.anthropic.com)) para conversar sobre qualquer assunto. A Anthropic cobra o uso da API conforme o consumo.
- **Sono**: toque em "Vou dormir" ao deitar e "Acordei" ao levantar (ou adicione a noite manualmente). O JARVIS diz se a quantidade foi boa ou ruim (o recomendado para adultos é de 7 a 9 horas), pergunta como você acordou e mostra a semana: média, noites no ideal, quanto faltou para a sua meta, horário médio de dormir e acordar, e dicas.
- **Notificações sob controle** (no app Android): lembrete no horário de cada rotina, alerta de "X horas sem fazer" e lembrete de hora de dormir. Em **Ajustes → Notificações** você liga e desliga cada uma separadamente. O **modo discreto** faz a notificação mostrar só "JARVIS: você tem um lembrete", sem dizer qual atividade é. O alerta do banheiro já vem **desligado** (aparece só dentro do app).
- **Demonstração**: na tela de login, "Ver demonstração" abre uma conta de exemplo já preenchida para você explorar.
- **Ajustes**: notificações, meta e horário de sono, 6 papéis de parede, backup (exportar/importar), trocar senha, sair e excluir conta.

## Como instalar no celular (Android), de graça

O APK é gerado automaticamente pelo **GitHub Actions** sempre que há um commit novo no repositório.

1. No GitHub, abra o repositório e vá em **Releases** (lado direito da página), ou na aba **Actions** → "Gerar APK do JARVIS" → abra a execução mais recente → **Artifacts**.
2. Pelo celular, baixe o arquivo **`JARVIS.apk`**.
3. Toque no arquivo. Se o Android pedir, permita "instalar apps desta fonte" (Chrome ou Arquivos).
4. Pronto: o ícone do **JARVIS** aparece na tela inicial. Na primeira vez que abrir, aceite as notificações para receber os lembretes.

> **Para atualizar**: baixe o APK novo e instale por cima. Todos os APKs são assinados com a mesma chave (`android/app/jarvis.keystore`), então os seus dados continuam salvos. **Não desinstale** o app antes de atualizar, porque desinstalar apaga os dados. Antes de trocar de celular, use **Ajustes → Backup → Exportar**.

### Alternativa: usar pelo navegador (PWA)

Em **Settings → Pages**, escolha *Source: GitHub Actions* e rode o workflow **"Publicar versão web"** na aba Actions. Abra o link gerado no Chrome do celular e toque em **⋮ → Adicionar à tela inicial**.

## Para desenvolvedores

```bash
npm install
npm run dev            # abre em http://localhost:5173
npm run build          # gera a versão web em dist/
npm run icons:android  # regera ícones e splash a partir de assets/logo-source.webp
npm run android:sync   # build + copia para o projeto Android (android/)
```

Para gerar o APK localmente você precisa do Android Studio/SDK: `cd android && ./gradlew assembleRelease`.

Estrutura:

- `src/screens`: telas (Login, Hoje, Agenda, Rotinas, Relatório, Assistente, Ajustes)
- `src/components`: anel de progresso, cartão de atividade, editor, painel
- `src/lib`: dados e login (`storage.ts`, `auth.ts`), cálculos e dicas (`stats.ts`), assistente local (`assistant.ts`), integração opcional com o Claude (`claude.ts`) e lembretes (`notify.ts`)
- `android/`: projeto Android (Capacitor)
- `.github/workflows/android.yml`: gera o APK de graça a cada commit
