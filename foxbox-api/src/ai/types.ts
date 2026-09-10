export interface AIImageProvider {
  /** Whether this provider supports image-to-image generation with reference images */
  readonly supportsImageReference: boolean;

  generateImage(options: {
    prompt: string;
    /** URLs of reference images for image-to-image generation */
    referenceImages?: string[];
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    model?: string;
    /** Aspect ratio for providers that support it (e.g., FLUX Kontext) */
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '9:21';
    /** AbortSignal for request timeout */
    signal?: AbortSignal;
  }): Promise<{ url: string; revisedPrompt?: string }>;
}

export interface AITextProvider {
  generateText(options: {
    prompt: string;
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{ text: string; model?: string }>;
}

export interface AIImageAnalysisProvider {
  analyzeImage(options: {
    imageUrl: string;
    prompt: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{ text: string }>;
}
