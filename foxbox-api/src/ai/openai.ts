import type { AIImageProvider, AITextProvider } from '../types';

const DEFAULT_TIMEOUT_MS = 60_000;

function getOpenAIApiKey(env: { OPENAI_API_KEY?: string }): string {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('AI provider not configured: OPENAI_API_KEY is missing');
  return key;
}

function headers(env: { OPENAI_API_KEY?: string }) {
  return {
    'Authorization': `Bearer ${getOpenAIApiKey(env)}`,
    'Content-Type': 'application/json',
  };
}

/**
 * OpenAI DALL-E 3 image provider.
 *
 * LIMITATION: DALL-E 3 does NOT support image-to-image generation.
 * The `referenceImages` parameter is accepted but ignored.
 * To use product image references, a different provider (e.g., Flux, Stability AI) is needed.
 *
 * Supported sizes: 1024x1024, 1792x1024, 1024x1792
 * NOTE: 1080x1080 is NOT natively supported. Output is 1024x1024 for square.
 */
export function createOpenAIImageProvider(env: { OPENAI_API_KEY?: string }): AIImageProvider {
  return {
    supportsImageReference: false,

    async generateImage(options) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const signal = options.signal ?? controller.signal;

      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: headers(env),
          signal,
          body: JSON.stringify({
            model: options.model || 'dall-e-3',
            prompt: options.prompt,
            n: 1,
            size: options.size || '1024x1024',
            quality: options.quality || 'hd',
            response_format: 'url',
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(err.error?.message || `OpenAI image generation failed: HTTP ${res.status}`);
        }

        const data = await res.json() as {
          data: Array<{ url: string; revised_prompt?: string }>;
        };

        return {
          url: data.data[0].url,
          revisedPrompt: data.data[0].revised_prompt,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createOpenAITextProvider(env: { OPENAI_API_KEY?: string }): AITextProvider {
  return {
    async generateText(options) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const signal = options.signal ?? controller.signal;

      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: headers(env),
          signal,
          body: JSON.stringify({
            model: options.model || 'gpt-4o-mini',
            messages: [
              ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
              { role: 'user' as const, content: options.prompt },
            ],
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature ?? 0.7,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(err.error?.message || `OpenAI text generation failed: HTTP ${res.status}`);
        }

        const data = await res.json() as {
          choices: Array<{ message: { content: string } }>;
          model: string;
        };

        return {
          text: data.choices[0].message.content,
          model: data.model,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
