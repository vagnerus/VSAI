# VSAI - IA — Guia de Operação

## 📋 Visão Geral da Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  API Layer   │────▶│   AI Providers  │
│  (React/Vite)│     │(Express/Vercel)│    │ Gemini/Claude/  │
│              │     │              │     │ OpenAI/Ollama   │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL  │
                    │  + Cache     │
                    └──────────────┘
```

---

## 🔧 Configuração de Provedores de IA

### Google Gemini (Recomendado)
```env
DEFAULT_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...sua_chave
GEMINI_MODEL=gemini-1.5-flash
```

### Anthropic Claude
```env
DEFAULT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...sua_chave
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### OpenAI
```env
OPENAI_API_KEY=sk-...sua_chave
```

### Ollama (Local)
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b
```

---

## 🧠 AI Manager — Orquestração Inteligente

O `AIManager` é o núcleo de orquestração que gerencia:

### Circuit Breaker
- Após **5 falhas consecutivas**, o provedor é marcado como `unhealthy`
- Cooldown automático de **5 minutos**
- Fallback automático para provedor secundário via `GatewayClient`

### Filtros de Alucinação
- Detecção de padrões conhecidos (ex: "como modelo de linguagem")
- Análise de repetição excessiva (>50% de sentenças duplicadas)
- URLs fabricadas (example.com, placeholder.org)
- Eventos `guardrail` enviados ao frontend quando detectados

### Telemetria
- Acesse `GET /api/ai-health` para ver:
  - Status de cada provedor (healthy/unhealthy/recovering)
  - Contagem de falhas e último erro
  - Total de tokens consumidos
  - Taxa de erro global

---

## 🔑 Endpoints Principais

| Endpoint | Método | Auth | Descrição |
|----------|--------|------|-----------|
| `/api/chat` | POST | JWT | Chat SSE streaming |
| `/api/auth?action=login` | POST | — | Login com email |
| `/api/auth?action=register` | POST | — | Registro |
| `/api/auth?action=google` | POST | — | Login Google |
| `/api/sessions` | GET | JWT | Listar sessões |
| `/api/agents` | GET/POST | JWT | CRUD de agentes |
| `/api/ai-health` | GET | — | Saúde dos provedores |
| `/health` | GET | — | Health check do servidor |
| `/api/system?route=dashboard` | GET | JWT | Dashboard stats |

---

## 🛠️ Ferramentas Disponíveis

### Serverless (Vercel-safe)
| Ferramenta | Descrição |
|-----------|-----------|
| `web_search` | Busca na web (requer TAVILY_API_KEY) |
| `web_fetch` | Fetch de URL |
| `calculate` | Calculadora matemática segura |
| `code_generate` | Geração de código |
| `translate` | Tradução |
| `summarize` | Resumo de textos |
| `analyze_sentiment` | Análise de sentimento |
| `seo_analyze` | Análise SEO |
| `compose_email` | Composição de emails |
| `format_data` | Conversão de formatos |
| `regex` | Teste de regex |
| `calculate_tokens` | Estimativa de tokens/custo |

### Apenas Ambiente Local
| Ferramenta | Descrição |
|-----------|-----------|
| `bash` | Execução de comandos shell |
| `file_read` | Leitura de arquivos |
| `file_write` | Escrita de arquivos |
| `file_patch` | Edição cirúrgica de arquivos |
| `windows_service_manager` | Gerenciamento de serviços Windows |

### Multi-Agente
| Ferramenta | Descrição |
|-----------|-----------|
| `Agent` | Spawn de sub-agente worker |
| `SendMessage` | Enviar mensagem a worker |
| `TaskStop` | Terminar worker |

---

## 📊 Monitoramento

### Logs do Servidor
```bash
# PM2
npm run pm2:logs

# Docker
docker-compose logs -f

# Desenvolvimento
npm run dev:server
```

### Métricas Importantes
- `[AIManager] Circuit breaker OPEN` — Provedor com falhas
- `[SemanticCache] Hit` — Cache ativo e economizando tokens
- `[QueryEngine] Smart snip` — Contexto foi otimizado
- `[RateLimiter]` — Limites de uso atingidos

---

## 🔒 Segurança

1. **JWT** — Tokens com expiração de 7 dias
2. **Rate Limiting** — Por usuário/plano (free: 20/dia, pro: 200/dia)
3. **Guardrails** — Detecção de prompt injection
4. **SQL Injection** — Queries parametrizadas + allowlist de tabelas
5. **RCE Prevention** — Calculadora usa parser seguro (sem eval/Function)
6. **Circuit Breaker** — Previne cascata de falhas entre provedores

---

## 🚀 Troubleshooting

### "API not configured"
- Verifique que `GEMINI_API_KEY` está no `.env`
- Confirme que a chave é válida e tem créditos

### Ferramentas não executam
- Verifique se `stop_reason` está sendo emitido (logs do client)
- Para OpenAI/Ollama, certifique-se de que os modelos suportam tool calling

### Cache não funciona
- Diretório `data/cache` precisa ter permissão de escrita
- No Vercel, o cache usa `/tmp` (efêmero por deploy)

### Worker agents crasham
- Verifique logs para `[Swarm]` messages
- Max 500 iterações / 30 minutos por agent

---

**Versão**: 2.0.0 — Refatorado em Abril 2026
