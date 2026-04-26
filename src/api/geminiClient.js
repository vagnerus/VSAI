/**
 * GeminiClient — REST Wrapper for the Google Gemini API.
 * Emulates the Anthropic stream event format to maintain compatibility.
 */

export class GeminiClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.model || 'gemini-1.5-flash';
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
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and versatile' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable model' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Lightweight and fast' }
    ];
  }

  /**
   * Translates messages from the internal format (Anthropic-like) to Gemini format.
   */
  _translateMessages(messages) {
    const contents = [];
    
    messages.forEach(msg => {
      let role = msg.role === 'assistant' ? 'model' : 'user';
      let parts = [];

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach(c => {
          if (c.type === 'text') parts.push({ text: c.text });
          if (c.type === 'image_url') {
            const base64Data = c.image_url.url.split(',')[1];
            const mimeType = c.image_url.url.split(';')[0].split(':')[1];
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          }
          if (c.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: c.name,
                args: c.input
              }
            });
          }
          if (c.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: c.name,
                response: { content: c.content }
              }
            });
          }
        });
      }

      if (msg.type === 'tool_result') {
        role = 'user';
        parts.push({
          functionResponse: {
            name: msg.toolName,
            response: { content: msg.content }
          }
        });
      }

      if (parts.length > 0) {
        const lastContent = contents[contents.length - 1];
        if (lastContent && lastContent.role === role) {
          lastContent.parts.push(...parts);
        } else {
          contents.push({ role, parts });
        }
      }
    });

    return contents;
  }

  _translateTools(tools) {
    if (!tools || tools.length === 0) return undefined;
    return [{
      function_declarations: tools.map(t => ({
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || t.input_schema || { type: 'object', properties: {} }
      }))
    }];
  }

  async *stream({ model, max_tokens, system, messages, tools, temperature, top_p }) {
    const targetModel = model || this.defaultModel;
    const url = `${this.baseUrl}/${targetModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    
    const body = {
      contents: this._translateMessages(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 4096,
        temperature: temperature ?? 0.7,
        topP: top_p ?? 0.9,
      }
    };

    if (system) {
      body.system_instruction = { parts: [{ text: system }] };
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
      throw new Error(`Gemini Error ${response.status}: ${errText}`);
    }

    const bodyReader = response.body.getReader ? response.body.getReader() : null;
    const nodeStream = !bodyReader ? response.body : null;
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    if (bodyReader) {
      while (true) {
        const { done, value } = await bodyReader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          yield* this._processSSELine(line);
        }
      }
    } else if (nodeStream) {
      for await (const chunk of nodeStream) {
        buffer += decoder.decode(chunk, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          yield* this._processSSELine(line);
        }
      }
    }
  }

  /**
   * Helper to process a single SSE line and yield events.
   */
  *_processSSELine(line) {
    const cleanLine = line.replace(/^data: /, '').trim();
    if (!cleanLine) return;

    try {
      const data = JSON.parse(cleanLine);
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      if (part?.text) {
        yield { 
          type: 'content_block_delta', 
          delta: { type: 'text_delta', text: part.text } 
        };
      }

      if (part?.functionCall) {
        yield { 
          type: 'content_block_start', 
          content_block: { 
            type: 'tool_use', 
            id: `call_${Math.random().toString(36).substring(2, 11)}`, 
            name: part.functionCall.name 
          } 
        };
        yield { 
          type: 'content_block_delta', 
          delta: { 
            type: 'input_json_delta', 
            partial_json: JSON.stringify(part.functionCall.args) 
          } 
        };
      }

      if (candidate?.finishReason === 'STOP' || candidate?.finishReason === 'MAX_TOKENS') {
        yield {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' }
        };
      } else if (candidate?.finishReason === 'FUNCTION_CALL') {
        yield {
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' }
        };
      }

      if (data.usageMetadata) {
        yield {
          type: 'message_delta',
          usage: {
            input_tokens: data.usageMetadata.promptTokenCount,
            output_tokens: data.usageMetadata.candidatesTokenCount
          }
        };
      }
    } catch (e) {
      // Incomplete JSON or other parsing error
    }
  }
  }
}