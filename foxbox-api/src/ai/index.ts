import type { AIImageProvider, AITextProvider } from './types';
import { createOpenAIImageProvider, createOpenAITextProvider } from './openai';
import { createFLUXKontextProvider } from './flux-kontext';

export type { AIImageProvider, AITextProvider };

export type ImageProviderName = 'flux-kontext' | 'openai';

export function createImageProvider(
  env: { OPENAI_API_KEY?: string; FLUX_KONTEXT_API_KEY?: string },
  preferredProvider?: ImageProviderName,
): AIImageProvider {
  // Explicit preference takes priority
  if (preferredProvider === 'flux-kontext' && env.FLUX_KONTEXT_API_KEY) {
    return createFLUXKontextProvider(env);
  }
  if (preferredProvider === 'openai' && env.OPENAI_API_KEY) {
    return createOpenAIImageProvider(env);
  }

  // Auto-detect: prefer FLUX Kontext for image-to-image (product reference),
  // fall back to OpenAI for text-to-image
  if (env.FLUX_KONTEXT_API_KEY) return createFLUXKontextProvider(env);
  if (env.OPENAI_API_KEY) return createOpenAIImageProvider(env);
  return createStubImageProvider();
}

export function createTextProvider(
  env: { OPENAI_API_KEY?: string },
): AITextProvider {
  if (env.OPENAI_API_KEY) return createOpenAITextProvider(env);
  return createStubTextProvider();
}

function createStubImageProvider(): AIImageProvider {
  return {
    supportsImageReference: false,
    async generateImage() {
      throw new Error(
        'AI image provider is not configured. Set FLUX_KONTEXT_API_KEY or OPENAI_API_KEY in your environment.',
      );
    },
  };
}

function createStubTextProvider(): AITextProvider {
  return {
    async generateText() {
      throw new Error('AI text provider is not configured. Set OPENAI_API_KEY in your environment.');
    },
  };
}
