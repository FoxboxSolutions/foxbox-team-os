import type { AIImageProvider } from './types';

const DEFAULT_TIMEOUT_MS = 90_000;
const FAL_API_URL = 'https://fal.run/fal-ai/flux-kontext/pro';

function getApiKey(env: { FLUX_KONTEXT_API_KEY?: string }): string {
  const key = env.FLUX_KONTEXT_API_KEY;
  if (!key) throw new Error('AI provider not configured: FLUX_KONTEXT_API_KEY is missing');
  return key;
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '9:21';

const SIZE_TO_ASPECT: Record<string, AspectRatio> = {
  '1024x1024': '1:1',
  '1792x1024': '16:9',
  '1024x1792': '9:16',
};

/**
 * FLUX Kontext Pro — Black Forest Labs
 *
 * Purpose-built for image-to-image generation with product reference.
 * Takes a real product photo + text prompt → generates a new creative
 * while preserving ~95% of the product's visual identity.
 *
 * Requires: FLUX_KONTEXT_API_KEY (via fal.ai)
 * Pricing: ~$0.04/image (Pro tier)
 * Latency: ~5-6 seconds
 * Native resolution: 1024×1024 (~1MP)
 */
export function createFLUXKontextProvider(env: { FLUX_KONTEXT_API_KEY?: string }): AIImageProvider {
  return {
    supportsImageReference: true,

    async generateImage(options) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.signal ? undefined : DEFAULT_TIMEOUT_MS);
      const signal = options.signal ?? controller.signal;

      const aspectRatio: AspectRatio = options.aspectRatio
        || SIZE_TO_ASPECT[options.size || '']
        || '1:1';

      // Build the prompt with style/quality modifiers (no text instructions —
      // FLUX Kontext should NOT render text; FoxBox overlays text layers)
      const enhancedPrompt = [
        options.prompt,
        'No text, no letters, no words, no typography, no watermarks.',
        'Professional marketing photography, studio lighting, sharp focus.',
      ].join(' ');

      const body: Record<string, unknown> = {
        prompt: enhancedPrompt,
        aspect_ratio: aspectRatio,
        num_images: 1,
        safety_tolerance: 2,
      };

      // Product reference image — the core feature
      if (options.referenceImages && options.referenceImages.length > 0) {
        body.image_url = options.referenceImages[0];
      }

      try {
        const res = await fetch(FAL_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${getApiKey(env)}`,
            'Content-Type': 'application/json',
          },
          signal,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let errMsg = `FLUX Kontext generation failed: HTTP ${res.status}`;
          try {
            const errJson = JSON.parse(errText) as { detail?: string; message?: string };
            errMsg = errJson.detail || errJson.message || errMsg;
          } catch {
            errMsg = errText || errMsg;
          }
          throw new Error(errMsg);
        }

        const data = await res.json() as {
          images: Array<{ url: string; width?: number; height?: number }>;
        };

        if (!data.images || data.images.length === 0) {
          throw new Error('FLUX Kontext returned no images');
        }

        return {
          url: data.images[0].url,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
