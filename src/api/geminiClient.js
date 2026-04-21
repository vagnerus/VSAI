/**
 * GeminiClient — REST Wrapper for the Google Gemini API.
 * Emulates the Anthropic stream event format to maintain compatibility with QueryEngine.
 */

export class GeminiClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.model || 'gemini-2.5-flash';
    this.maxRetries = config.maxRetries || 3;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    if (!this.apiKey) {
      console.warn('[GeminiClient] No API key configured. Set GEMINI_API_KEY in .env');
    }
  }

  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  getAvailableModels() {
    return [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Powerful and capable' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and cost-effective' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Standard flash model' }
    ];
  }

  /**
   * Translates Anthropic messages to Gemini format.
   */
  _translateMessages(messages) {
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let parts = [];
      
      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input || {}
              }
            });
          } else if (block.type === 'tool_result') {
            // CRITICAL FIX: Gemini expects the function NAME, not a tool_use_id.
            // We use msg.toolName which should be populated by QueryEngine.
            parts.push({
              functionResponse: {
                name: msg.toolName || block.name || "unknown_tool",
                response: typeof block.content === 'string' ? { result: block.content } : block.content
              }
            });
          }
        }
      }
      return { role, parts };
    });
  }

  _translateTools(tools) {
    if (!tools || tools.length === 0) return undefined;
    return [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || t.input_schema || { type: 'object', properties: {} }
      }))
    }];
  }

  async *stream({ model, max_tokens, system, messages, tools }) {
    let targetModel = model || this.defaultModel;
    if (targetModel.startsWith('claude') || targetModel.startsWith('gpt')) {
      targetModel = this.defaultModel;
    }
    const url = `${this.baseUrl}/${targetModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    
    const body = {
      contents: this._translateMessages(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 8192
      }
    };

    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
    
    const geminiTools = this._translateTools(tools);
    if (geminiTools) {
      body.tools = geminiTools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GeminiClient] API Error ${response.status}:`, errText);
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      let parts = buffer.split('\ndata: ');
      if (parts.length < 2 && !buffer.startsWith('data: ')) continue;
      
      buffer = parts.pop();
      
      for (let part of parts) {
        let cleanPart = part.replace(/^data:\s*/, '').trim();
        if (!cleanPart || cleanPart === '[' || cleanPart === ',') continue;
        
        if (cleanPart.startsWith('[')) cleanPart = cleanPart.substring(1);
        if (cleanPart.endsWith(']')) cleanPart = cleanPart.substring(0, cleanPart.length - 1);
        
        try {
          const data = JSON.parse(cleanPart);
          yield* this._processGeminiData(data);
        } catch (e) {
          buffer = part + '\ndata: ' + buffer; 
        }
      }
    }
    
    if (buffer) {
       let cleanPart = buffer.replace(/^data:\s*/, '').trim();
       if (cleanPart.startsWith('[')) cleanPart = cleanPart.substring(1);
       if (cleanPart.endsWith(']')) cleanPart = cleanPart.substring(0, cleanPart.length - 1);
       try {
         const data = JSON.parse(cleanPart);
         yield* this._processGeminiData(data);
       } catch(e) {}
    }
  }

  *_processGeminiData(data) {
    if (data.candidates && data.candidates.length > 0) {
      const parts = data.candidates[0].content?.parts || [];
      
      for (const part of parts) {
        if (part.text) {
          yield { 
            type: 'content_block_delta', 
            delta: { type: 'text_delta', text: part.text } 
          };
        } else if (part.functionCall) {
          const id = `call_${Date.now()}_${part.functionCall.name}`;
          yield { 
            type: 'content_block_start', 
            content_block: { type: 'tool_use', id, name: part.functionCall.name } 
          };
          yield { 
            type: 'content_block_delta', 
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(part.functionCall.args || {}) } 
          };
        }
      }
      
      if (data.candidates[0].finishReason || data.usageMetadata) {
        let stopReason = 'end_turn';
        if (parts.some(p => p.functionCall)) stopReason = 'tool_use';
        
        yield { 
          type: 'message_delta', 
          delta: { stop_reason: stopReason },
          usage: { 
            input_tokens: data.usageMetadata?.promptTokenCount || 0,
            output_tokens: data.usageMetadata?.candidatesTokenCount || 0
          }
        };
      }
    }
  }
}
