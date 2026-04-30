/**
 * OpenAIClient — REST Wrapper for the OpenAI Chat API.
 * Emulates the Anthropic stream event format to maintain compatibility.
 */

export class OpenAIClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.model || 'gpt-4o';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';

    if (!this.apiKey) {
      console.warn('[OpenAIClient] No API key configured. Set OPENAI_API_KEY in .env');
    }
  }

  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  getAvailableModels() {
    return [
      { id: 'gpt-4o', name: 'GPT-4o (Omni)', description: 'Most advanced multimodal model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Powerful and reliable' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cheap' }
    ];
  }

  _translateMessages(messages) {
    return messages.map(msg => {
      // Basic translation, handles text and tool results
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
        // Handle multimodal or complex content
        return {
          role: 'user',
          content: msg.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            if (c.type === 'image_url') return { type: 'image_url', image_url: { url: c.image_url.url } };
            if (c.type === 'tool_result') {
               // OpenAI uses a separate 'tool' role for results
               return null; 
            }
            return c;
          }).filter(Boolean)
        };
      }

      // Handle tool results separately (OpenAI specific)
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
      max_tokens: max_tokens || 4096,
      stream_options: { include_usage: true }
    };

    if (system) {
      body.messages.push({ role: 'system', content: system });
    }
    
    body.messages.push(...this._translateMessages(messages));

    const openAITools = this._translateTools(tools);
    if (openAITools) {
      body.tools = openAITools;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Error ${response.status}: ${errText}`);
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
