/**
 * OllamaClient — Wrapper for the Ollama API (OpenAI-compatible).
 * Emulates the Anthropic stream event format to maintain compatibility.
 */

export class OllamaClient {
  constructor(config = {}) {
    // Default to localhost if no host is provided
    this.host = config.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel = config.model || 'llama3:8b';
    this.baseUrl = `${this.host}/v1/chat/completions`;

    console.log(`[OllamaClient] Initialized with host: ${this.host}`);
  }

  isConfigured() {
    // Ollama is considered configured if we have a host. 
    // We'll validate connectivity during the first request or via a health check if needed.
    return !!this.host;
  }

  getAvailableModels() {
    // In a real scenario, we could fetch these from /api/tags
    return [
      { id: 'llama3:8b', name: 'Llama 3 (8B)', description: 'Ollama local model' },
      { id: 'mistral:latest', name: 'Mistral', description: 'Mistral local model' },
      { id: 'phi3:latest', name: 'Phi-3', description: 'Microsoft local model' },
      { id: 'codellama:latest', name: 'CodeLlama', description: 'Optimized for code' }
    ];
  }

  _translateMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'assistant' && msg.toolCalls?.length > 0) {
        return {
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.input) }
          }))
        };
      }
      
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        return {
          role: 'user',
          content: msg.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            if (c.type === 'image_url') return { type: 'image_url', image_url: { url: c.image_url.url } };
            return null;
          }).filter(Boolean)
        };
      }

      if (msg.type === 'tool_result' || (msg.role === 'user' && msg.content?.[0]?.type === 'tool_result')) {
        const result = Array.isArray(msg.content) ? msg.content[0] : msg;
        return {
          role: 'tool',
          tool_call_id: result.toolUseId || result.id,
          content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        };
      }

      return { role: msg.role, content: msg.content };
    });
  }

  _translateTools(tools) {
    if (!tools || tools.length === 0) return undefined;
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || t.input_schema || { type: 'object', properties: {} }
      }
    }));
  }

  async *stream({ model, max_tokens, system, messages, tools }) {
    let targetModel = model || this.defaultModel;
    
    const body = {
      model: targetModel,
      messages: [],
      stream: true,
      max_tokens: max_tokens || 4096
    };

    if (system) {
      body.messages.push({ role: 'system', content: system });
    }
    
    body.messages.push(...this._translateMessages(messages));

    const ollamaTools = this._translateTools(tools);
    if (ollamaTools) {
      // Note: Not all Ollama models support tools well, but we pass them anyway
      body.tools = ollamaTools;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const cleanLine = line.replace(/^data: /, '').trim();
        if (!cleanLine || cleanLine === '[DONE]') continue;

        try {
          const data = JSON.parse(cleanLine);
          const choice = data.choices?.[0];
          
          if (choice?.delta?.content) {
            yield { 
              type: 'content_block_delta', 
              delta: { type: 'text_delta', text: choice.delta.content } 
            };
          }

          if (choice?.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.function?.name) {
                yield { 
                  type: 'content_block_start', 
                  content_block: { type: 'tool_use', id: tc.id || `call_${Math.random().toString(36).substring(2, 11)}`, name: tc.function.name } 
                };
              }
              if (tc.function?.arguments) {
                yield { 
                  type: 'content_block_delta', 
                  delta: { type: 'input_json_delta', partial_json: tc.function.arguments } 
                };
              }
            }
          }

          // B3 Fix: Emit stop_reason so QueryEngine can detect tool calls
          if (choice?.finish_reason) {
            const stopReason = (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'function_call')
              ? 'tool_use'
              : 'end_turn';
            yield {
              type: 'message_delta',
              delta: { stop_reason: stopReason }
            };
          }

          if (data.usage) {
            yield {
              type: 'message_delta',
              usage: {
                input_tokens: data.usage.prompt_tokens,
                output_tokens: data.usage.completion_tokens
              }
            };
          }
        } catch (e) {
          // Incomplete JSON
        }
      }
    }
  }
}
