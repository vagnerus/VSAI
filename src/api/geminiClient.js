/**
 * GeminiClient — REST Wrapper for the Google Gemini API.
 * Emulates the Anthropic stream event format to maintain compatibility.
 *
 * B1 Fix: Iterates ALL parts for functionCall detection
 * B2 Fix: Unified tool_result formatting (no duplicates)
 * Added: Retry logic with exponential backoff
 */

export class GeminiClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.model || 'gemini-2.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      console.warn('[GeminiClient] No API key configured. Set GEMINI_API_KEY in .env');
    }
  }

  isConfigured() {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  getAvailableModels() {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest and most capable flash model' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and versatile' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable model' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Lightweight and fast' }
    ];
  }

  /**
   * Translates messages from the internal format (Anthropic-like) to Gemini format.
   * B2 Fix: Unified handling — tool_result messages are processed once, not duplicated.
   */
  _translateMessages(messages) {
    const contents = [];
    
    messages.forEach(msg => {
      let role = msg.role === 'assistant' ? 'model' : 'user';
      let parts = [];

      // Handle tool_result messages first (B2 Fix: single code path)
      if (msg.type === 'tool_result') {
        role = 'user';
        parts.push({
          functionResponse: {
            name: msg.toolName || msg.name || 'unknown_tool',
            response: { content: msg.content }
          }
        });
      } else if (typeof msg.content === 'string') {
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
                name: c.name || c.toolName || 'unknown_tool',
                response: { content: c.content }
              }
            });
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
    let targetModel = model || this.defaultModel;
    
    // gemini-2.5-flash is now GA — no mapping needed

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

    // Retry logic with exponential backoff
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
          console.log(`[GeminiClient] Retry attempt ${attempt}/${this.maxRetries} after ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errText = await response.text();
          const error = new Error(`Gemini Error ${response.status}: ${errText}`);
          error.status = response.status;
          
          // Only retry on retryable errors
          const isRetryable = response.status === 429 || response.status === 503 || response.status === 500;
          if (isRetryable && attempt < this.maxRetries) {
            lastError = error;
            continue;
          }
          throw error;
        }

        yield* this._consumeStream(response);
        return; // Success — exit retry loop

      } catch (error) {
        lastError = error;
        const isRetryable = error.status === 429 || error.status === 503 || error.status === 500;
        if (!isRetryable || attempt >= this.maxRetries) {
          throw error;
        }
      }
    }

    if (lastError) throw lastError;
  }

  /**
   * Consume the SSE stream from the Gemini API response.
   */
  async *_consumeStream(response) {
    const bodyReader = (response.body && response.body.getReader) ? response.body.getReader() : null;
    const nodeStream = !bodyReader ? (response.body || null) : null;
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

    // Process any remaining buffer
    if (buffer.trim()) {
      yield* this._processSSELine(buffer);
    }
  }

  /**
   * Helper to process a single SSE line and yield events.
   * B1 Fix: Iterates ALL parts of the candidate, not just the first.
   */
  *_processSSELine(line) {
    const cleanLine = line.replace(/^data: /, '').trim();
    if (!cleanLine) return;

    try {
      const data = JSON.parse(cleanLine);
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let hasText = false;
      let hasFunctionCall = false;

      // B1 Fix: Iterate ALL parts instead of just parts[0]
      for (const part of parts) {
        if (part?.text) {
          hasText = true;
          yield { 
            type: 'content_block_delta', 
            delta: { type: 'text_delta', text: part.text } 
          };
        }

        if (part?.functionCall) {
          hasFunctionCall = true;
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
              partial_json: JSON.stringify(part.functionCall.args || {}) 
            } 
          };
        }
      }

      // Determine stop_reason based on finishReason AND whether we saw function calls
      if (candidate?.finishReason) {
        if (candidate.finishReason === 'FUNCTION_CALL' || hasFunctionCall) {
          yield {
            type: 'message_delta',
            delta: { stop_reason: 'tool_use' }
          };
        } else if (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS') {
          yield {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn' }
          };
        }
      }

      if (data.usageMetadata) {
        yield {
          type: 'message_delta',
          delta: {},
          usage: {
            input_tokens: data.usageMetadata.promptTokenCount,
            output_tokens: data.usageMetadata.candidatesTokenCount
          }
        };
      }
    } catch (e) {
      // Incomplete JSON or other parsing error — skip silently
    }
  }
}