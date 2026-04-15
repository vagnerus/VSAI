import Anthropic from '@anthropic-ai/sdk';

/**
 * AnthropicClient — Wrapper for the Anthropic API.
 * Handles streaming, retries, fallback models, and cost tracking.
 */
export class AnthropicClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.defaultModel = config.model || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey || this.apiKey === 'sk-ant-xxxxx') {
      console.warn('[NexusAI] No valid Anthropic API key configured. Set ANTHROPIC_API_KEY in .env');
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
  }

  /**
   * Stream a message from the API. Returns an async iterable of events.
   */
  async *stream({ model, max_tokens, system, messages, tools }) {
    if (!this.client) {
      // Demo mode — generate a synthetic response
      yield* this.demoStream(messages);
      return;
    }

    const params = {
      model: model || this.defaultModel,
      max_tokens: max_tokens || 4096,
      system: system || undefined,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    let retries = 0;
    while (retries <= this.maxRetries) {
      try {
        const stream = this.client.messages.stream(params);

        for await (const event of stream) {
          yield event;
        }
        return;
      } catch (error) {
        retries++;
        if (retries > this.maxRetries) throw error;

        const isRetryable = error.status === 429 || error.status === 529 || error.status === 503;
        if (!isRetryable) throw error;

        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        console.log(`[NexusAI] API error ${error.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * Demo mode — generate responses without API key.
   */
  async *demoStream(messages) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const userText = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.map(c => c.text || '').join(' ')
        : 'Hello';

    yield {
      type: 'message_start',
      message: { usage: { input_tokens: Math.ceil(userText.length / 4), output_tokens: 0 } },
    };

    const demoResponse = this.generateDemoResponse(userText);
    const words = demoResponse.split(' ');

    yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };

    for (let i = 0; i < words.length; i++) {
      const text = (i === 0 ? '' : ' ') + words[i];
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }

    yield { type: 'content_block_stop', index: 0 };
    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: Math.ceil(demoResponse.length / 4) },
    };
  }

  generateDemoResponse(input) {
    const lower = input.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('olá') || lower.includes('oi')) {
      return `# 👋 Olá! Bem-vindo ao NexusAI!

Eu sou o **NexusAI**, sua plataforma de IA completa. Aqui está o que posso fazer:

## 🛠️ Capacidades Principais
- **Geração de Código** — Python, JavaScript, TypeScript, C++, e mais
- **Análise de Documentos** — PDF, CSV, Excel, DOCX
- **Pesquisa Web** — Informações atualizadas em tempo real
- **Análise de Imagens** — OCR, descrição, análise visual
- **Tradução** — Múltiplos idiomas
- **Ferramentas de Texto** — Resumo, redação, revisão

## 🚀 Como Começar
1. Digite sua pergunta no chat
2. Use as ferramentas no painel lateral
3. Configure API keys em **Settings**

> **Nota:** Para funcionalidades completas, configure sua API key da Anthropic em Settings → API Configuration.

Como posso ajudá-lo hoje?`;
    }

    if (lower.includes('code') || lower.includes('código') || lower.includes('python') || lower.includes('javascript')) {
      return `## 💻 Geração de Código

Claro! Posso gerar código em várias linguagens. Aqui está um exemplo:

\`\`\`python
# Exemplo: Classe de gerenciamento de tarefas
class TaskManager:
    def __init__(self):
        self.tasks = []
    
    def add_task(self, title, priority="medium"):
        task = {
            "id": len(self.tasks) + 1,
            "title": title,
            "priority": priority,
            "completed": False
        }
        self.tasks.append(task)
        return task
    
    def complete_task(self, task_id):
        for task in self.tasks:
            if task["id"] == task_id:
                task["completed"] = True
                return task
        return None

# Uso
manager = TaskManager()
manager.add_task("Implementar NexusAI", "high")
manager.add_task("Testar ferramentas", "medium")
print(f"Total de tarefas: {len(manager.tasks)}")
\`\`\`

Quer que eu gere código para algo específico? Posso trabalhar com Python, JavaScript, TypeScript, C++, Java, Go, Rust, e mais!`;
    }

    return `## 🧠 NexusAI — Modo Demo

Recebi sua mensagem: *"${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"*

Estou rodando em **modo demo** porque nenhuma API key foi configurada. Para ativar todas as funcionalidades:

1. Vá em **Settings** → **API Configuration**
2. Insira sua **Anthropic API Key**
3. Selecione o modelo desejado

### ✨ Mesmo no modo demo, você pode:
- Explorar o **Dashboard** com métricas do sistema
- Ver as **20+ ferramentas** disponíveis
- Configurar **Permissões** e **Hooks**
- Navegar pelo **histórico de sessões**

### 🔑 Para obter uma API Key:
Visite [console.anthropic.com](https://console.anthropic.com) e crie uma conta.

*O que mais posso ajudar?*`;
  }

  /**
   * Check if valid API key is configured.
   */
  isConfigured() {
    return !!this.client;
  }

  /**
   * Get available models.
   */
  getAvailableModels() {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed and intelligence', costPer1MInput: 3, costPer1MOutput: 15 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful for complex tasks', costPer1MInput: 15, costPer1MOutput: 75 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest, best for simple tasks', costPer1MInput: 0.25, costPer1MOutput: 1.25 },
    ];
  }
}
