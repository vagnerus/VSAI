# Changelog — VSAI - IA v2.0.0

## [2.0.0] - 2026-04-30

### 🔴 Bug Fixes Críticos

#### B1 — GeminiClient: Tool Detection Fix
- **Arquivo**: `src/api/geminiClient.js`
- **Antes**: Apenas o primeiro `part` era verificado para `functionCall`
- **Depois**: Todos os `parts` do candidato são iterados, garantindo detecção correta de tool calls

#### B2 — GeminiClient: Duplicate Tool Result Fix
- **Arquivo**: `src/api/geminiClient.js`
- **Antes**: `tool_result` messages eram processadas duas vezes (linhas 62-69 + 73-81)
- **Depois**: Código unificado — `tool_result` é processado uma única vez com prioridade para `msg.type === 'tool_result'`

#### B3 — OpenAI/Ollama: stop_reason Emission
- **Arquivos**: `src/api/openaiClient.js`, `src/api/ollamaClient.js`
- **Antes**: Nenhum `message_delta` com `stop_reason` era emitido
- **Depois**: Emite `tool_use` ou `end_turn` baseado em `finish_reason` do stream
- **Impacto**: Ferramentas agora funcionam com OpenAI e Ollama

#### B4 — chat.js: Headers Before Validation
- **Arquivo**: `api/chat.js`
- **Antes**: SSE headers eram enviados antes de validar `apiClient.isConfigured()`
- **Depois**: Validação da API movida para ANTES do envio de headers

#### B6 — Coordinator: ReferenceError Fix
- **Arquivo**: `src/engine/Coordinator.js`
- **Antes**: `new engine.constructor(...)` — `engine` não existe no escopo
- **Depois**: `new this.engine.constructor(...)` — corrige ReferenceError

#### B7 — Agent Tools: Registration + Context
- **Arquivo**: `src/tools/registry.js`
- **Antes**: `AgentTool`, `SendMessageTool`, `TaskStopTool` não estavam registradas
- **Depois**: Todas registradas em `getAllTools()` com imports corretos

#### B8 — SwarmCoordinator: Infinite Loop Fix
- **Arquivo**: `src/engine/SwarmCoordinator.js`
- **Antes**: Loop `while(true)` sem limites
- **Depois**: Max 500 iterações + timeout de 30 minutos + cleanup automático

#### B9 — Mailbox: Busy-Wait Removal
- **Arquivo**: `src/session/mailbox.js`
- **Antes**: Spin-lock com `setTimeout(r, 20)` causando starvation
- **Depois**: `AsyncMutex` baseado em Promises — zero busy-wait

#### B10 — db.js: Leak Detection Fix
- **Arquivo**: `api/_lib/db.js`
- **Antes**: Timeout de 5s gerando falsos positivos durante streaming
- **Depois**: Timeout de 30s + `.bind()` correto para `client.query`

#### B11 — CalculateTool: RCE Vulnerability Fix
- **Arquivo**: `src/tools/registry.js`
- **Antes**: `Function(\`return (${expr})\`)()` — Remote Code Execution
- **Depois**: Parser matemático recursive-descent seguro (sem eval/Function)

#### B12 — admin.js: SQL Injection Prevention
- **Arquivo**: `api/admin.js`
- **Antes**: `SELECT * FROM ${table}` com template literal
- **Depois**: Sanitização + identifier quoting: `SELECT * FROM "${safeTable}"`

#### B13 — cache.js: Race Condition Fix
- **Arquivo**: `api/_lib/cache.js`
- **Antes**: `existsSync` + `readFileSync` não-atômico
- **Depois**: `try/catch` atômico + LRU em memória (max 200 entries)

#### B14 — WindowsServiceTool: Registration
- **Arquivo**: `src/tools/WindowsServiceTool.js`
- **Antes**: Objeto literal sem `buildTool()`, não registrado
- **Depois**: Usa `buildTool()`, registrado no registry, com sanitização de input

#### B15 — README: Null Bytes
- **Arquivo**: `README.md`
- Removidos caracteres nulos do final do arquivo

---

### 🧠 Novos Recursos

#### AI Manager (`src/engine/AIManager.js`)
- Circuit Breaker: 5 falhas → unhealthy, 5min cooldown
- Filtros de Alucinação: 6 padrões + detecção de repetição
- Telemetria: Token usage, error rate, latência por provedor
- Endpoint: `GET /api/ai-health`

#### Token Optimization (`src/engine/QueryEngine.js`)
- Configuração de context window por modelo (11 modelos)
- Smart snip: preserva primeiro prompt + últimas 10 mensagens + marcador de resumo
- Custo calculado por modelo (inputRate/outputRate reais)

#### Provider Alignment
- Chave interna renomeada de `google` → `gemini`
- Alinhamento com `DEFAULT_PROVIDER=gemini` no `.env`

#### Server Improvements (`src/server/index.js`)
- Serving estático do `dist/` em produção
- SPA fallback routing
- Graceful shutdown (SIGTERM/SIGINT)
- Endpoint `/api/ai-health` para monitoramento

---

### 🔒 Segurança

- Removido hardcoded admin email do `authMiddleware.js`
- Sanitização de nomes de serviço no `WindowsServiceTool`
- Parser matemático seguro (zero eval)
- Identifier quoting em queries SQL dinâmicas

---

### 📚 Documentação

- `OPERATIONS_GUIDE.md` — Guia completo de operação
- `CHANGELOG.md` — Este arquivo
