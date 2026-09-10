import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { createImageProvider, createTextProvider } from '../ai';

const landingPages = new Hono<{ Bindings: Env }>();

// ─── Helpers ─────────────────────────────────────────────────

async function verifyPageOwnership(c: { env: Env }, pageId: string, userId: string) {
  const page = await queryOne(c.env, 'SELECT * FROM landing_pages WHERE id = ? AND user_id = ?', [pageId, userId]);
  return page || null;
}

async function verifySectionOwnership(c: { env: Env }, sectionId: string, userId: string) {
  const section = await queryOne(c.env, 'SELECT * FROM landing_page_sections WHERE id = ?', [sectionId]);
  if (!section) return null;
  const pageId = (section as Record<string, unknown>).page_id as string;
  const page = await queryOne(c.env, 'SELECT id FROM landing_pages WHERE id = ? AND user_id = ?', [pageId, userId]);
  if (!page) return null;
  return { section, page };
}

// ─── GET /api/landing-pages ──────────────────────────────────
landingPages.get('/landing-pages', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const pages = await query(c.env,
    `SELECT * FROM landing_pages WHERE user_id = ? ORDER BY updated_at DESC`,
    [authResult.auth!.user.sub]
  );
  return successResponse(pages);
});

// ─── POST /api/landing-pages ─────────────────────────────────
landingPages.post('/landing-pages', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const body = await c.req.json();
  const id = 'lp-' + generateId();
  const now = nowISO();
  const userId = authResult.auth!.user.sub;

  await execute(c.env,
    `INSERT INTO landing_pages (id, user_id, name, product_name, product_description,
     product_price, promotional_price, main_benefits, product_features, target_audience,
     target_market, language, brand_name, brand_colors, payment_method, delivery_info,
     guarantee_info, marketing_notes, product_image_url, additional_images, visual_style,
     custom_colors, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, userId,
      body.name || 'Untitled Landing Page',
      body.productName || '', body.productDescription || '',
      body.productPrice || '', body.promotionalPrice || '',
      JSON.stringify(body.mainBenefits || []),
      JSON.stringify(body.productFeatures || []),
      body.targetAudience || '', body.targetMarket || 'Algeria',
      body.language || 'darija',
      body.brandName || '', JSON.stringify(body.brandColors || {}),
      body.paymentMethod || 'COD',
      body.deliveryInfo || '', body.guaranteeInfo || '',
      body.marketingNotes || '', body.productImageUrl || '',
      JSON.stringify(body.additionalImages || []),
      body.visualStyle || 'luxury',
      JSON.stringify(body.customColors || {}),
      'draft', now, now,
    ]
  );

  // Create default sections
  const defaultSections = [
    'hero', 'trust_bar', 'problem', 'benefits', 'how_it_works',
    'social_proof', 'offer', 'faq', 'final_cta', 'footer',
  ];
  for (let i = 0; i < defaultSections.length; i++) {
    await execute(c.env,
      `INSERT INTO landing_page_sections (id, page_id, section_type, sort_order, enabled, content, visual_config, text_layers, generation_status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'lps-' + generateId(), id, defaultSections[i], i, 1,
        '{}', '{}', '[]', 'idle', now, now,
      ]
    );
  }

  const page = await queryOne(c.env, 'SELECT * FROM landing_pages WHERE id = ?', [id]);
  const sections = await query(c.env,
    'SELECT * FROM landing_page_sections WHERE page_id = ? ORDER BY sort_order ASC', [id]
  );

  return successResponse({ ...page, sections });
});

// ─── GET /api/landing-pages/:id ──────────────────────────────
landingPages.get('/landing-pages/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const page = await verifyPageOwnership(c, id, authResult.auth!.user.sub);
  if (!page) return errorResponse('Landing page not found', 404);

  const sections = await query(c.env,
    'SELECT * FROM landing_page_sections WHERE page_id = ? ORDER BY sort_order ASC', [id]
  );

  return successResponse({ ...page, sections });
});

// ─── PUT /api/landing-pages/:id ──────────────────────────────
landingPages.put('/landing-pages/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const body = await c.req.json();
  const now = nowISO();

  const existing = await verifyPageOwnership(c, id, authResult.auth!.user.sub);
  if (!existing) return errorResponse('Landing page not found', 404);

  const updates: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  const fields: Record<string, string> = {
    name: 'name', productName: 'product_name', productDescription: 'product_description',
    productPrice: 'product_price', promotionalPrice: 'promotional_price',
    targetAudience: 'target_audience', targetMarket: 'target_market',
    language: 'language', brandName: 'brand_name', paymentMethod: 'payment_method',
    deliveryInfo: 'delivery_info', guaranteeInfo: 'guarantee_info',
    marketingNotes: 'marketing_notes', productImageUrl: 'product_image_url',
    visualStyle: 'visual_style', status: 'status',
  };

  for (const [camel, snake] of Object.entries(fields)) {
    if (body[camel] !== undefined) {
      updates.push(`${snake} = ?`);
      values.push(body[camel]);
    }
  }

  const jsonFields: Record<string, string> = {
    mainBenefits: 'main_benefits', productFeatures: 'product_features',
    brandColors: 'brand_colors', customColors: 'custom_colors',
    additionalImages: 'additional_images',
  };

  for (const [camel, snake] of Object.entries(jsonFields)) {
    if (body[camel] !== undefined) {
      updates.push(`${snake} = ?`);
      values.push(JSON.stringify(body[camel]));
    }
  }

  values.push(id);
  await execute(c.env, `UPDATE landing_pages SET ${updates.join(', ')} WHERE id = ?`, values);

  const page = await queryOne(c.env, 'SELECT * FROM landing_pages WHERE id = ?', [id]);
  const sections = await query(c.env,
    'SELECT * FROM landing_page_sections WHERE page_id = ? ORDER BY sort_order ASC', [id]
  );

  return successResponse({ ...page, sections });
});

// ─── DELETE /api/landing-pages/:id ───────────────────────────
landingPages.delete('/landing-pages/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const existing = await verifyPageOwnership(c, id, authResult.auth!.user.sub);
  if (!existing) return errorResponse('Landing page not found', 404);

  await execute(c.env, 'DELETE FROM landing_page_sections WHERE page_id = ?', [id]);
  await execute(c.env, 'DELETE FROM landing_pages WHERE id = ? AND user_id = ?', [id, authResult.auth!.user.sub]);

  return successResponse(null, 'Landing page deleted');
});

// ─── PUT /api/landing-pages/:id/sections/reorder ─────────────
landingPages.put('/landing-pages/:id/sections/reorder', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const existing = await verifyPageOwnership(c, id, authResult.auth!.user.sub);
  if (!existing) return errorResponse('Landing page not found', 404);

  const { sectionIds } = await c.req.json() as { sectionIds: string[] };

  if (!Array.isArray(sectionIds)) return errorResponse('sectionIds must be an array', 400);

  for (let i = 0; i < sectionIds.length; i++) {
    await execute(c.env,
      'UPDATE landing_page_sections SET sort_order = ?, updated_at = ? WHERE id = ? AND page_id = ?',
      [i, nowISO(), sectionIds[i], id]
    );
  }

  const sections = await query(c.env,
    'SELECT * FROM landing_page_sections WHERE page_id = ? ORDER BY sort_order ASC', [id]
  );

  return successResponse(sections);
});

// ─── PUT /api/landing-pages/sections/:sectionId ──────────────
landingPages.put('/landing-pages/sections/:sectionId', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { sectionId } = c.req.param();
  const ownership = await verifySectionOwnership(c, sectionId, authResult.auth!.user.sub);
  if (!ownership) return errorResponse('Section not found', 404);

  const body = await c.req.json();
  const now = nowISO();

  const updates: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (body.enabled !== undefined) { updates.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
  if (body.content !== undefined) { updates.push('content = ?'); values.push(JSON.stringify(body.content)); }
  if (body.visualConfig !== undefined) { updates.push('visual_config = ?'); values.push(JSON.stringify(body.visualConfig)); }
  if (body.textLayers !== undefined) { updates.push('text_layers = ?'); values.push(JSON.stringify(body.textLayers)); }
  if (body.assetUrl !== undefined) { updates.push('asset_url = ?'); values.push(body.assetUrl); }
  if (body.generationStatus !== undefined) { updates.push('generation_status = ?'); values.push(body.generationStatus); }
  if (body.errorMessage !== undefined) { updates.push('error_message = ?'); values.push(body.errorMessage); }

  values.push(sectionId);
  await execute(c.env, `UPDATE landing_page_sections SET ${updates.join(', ')} WHERE id = ?`, values);

  const section = await queryOne(c.env, 'SELECT * FROM landing_page_sections WHERE id = ?', [sectionId]);
  return successResponse(section);
});

// ─── POST /api/landing-pages/sections/:sectionId/generate ────
landingPages.post('/landing-pages/sections/:sectionId/generate', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { sectionId } = c.req.param();
  const body = await c.req.json();
  const now = nowISO();
  const userId = authResult.auth!.user.sub;

  const ownership = await verifySectionOwnership(c, sectionId, userId);
  if (!ownership) return errorResponse('Section not found', 404);

  const { section: sectionRow, page: pageRow } = ownership;
  const pageData = pageRow as Record<string, unknown>;
  const sectionData = sectionRow as Record<string, unknown>;

  // Preserve previous asset if regeneration fails
  const previousAssetUrl = (sectionData.asset_url as string) || '';
  const previousContent = (sectionData.content as string) || '{}';

  // Mark as generating
  await execute(c.env,
    'UPDATE landing_page_sections SET generation_status = ?, updated_at = ? WHERE id = ?',
    ['generating', now, sectionId]
  );

  // Log generation attempt
  const genId = 'gen-' + generateId();
  await execute(c.env,
    `INSERT INTO creative_generations (id, user_id, page_id, provider, type, status, prompt, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [genId, userId, pageData.id, 'openai', 'landing_image', 'processing', body.prompt || '', now]
  );

  try {
    const imgProvider = createImageProvider(c.env);
    const textProvider = createTextProvider(c.env);

    const productStyle = body.style || pageData.visual_style || 'luxury';
    const language = body.language || pageData.language || 'darija';
    const sectionType = sectionData.section_type as string;

    // ── STEP 1: Generate text copy via LLM ──
    const textPrompt = buildTextPrompt(sectionType, pageData, language, productStyle);
    let textContent: Record<string, unknown> = {};
    try {
      const textResult = await textProvider.generateText({
        prompt: textPrompt,
        systemPrompt: buildTextSystemPrompt(language),
        temperature: 0.7,
      });
      try {
        textContent = JSON.parse(textResult.text);
      } catch {
        textContent = { headline: textResult.text.slice(0, 100) };
      }
    } catch {
      textContent = {};
    }

    // ── STEP 2: Build text layers from AI copy ──
    const langDir = (language === 'darija' || language === 'arabic') ? 'rtl' : 'ltr';
    const textLayers = buildTextLayersFromContent(sectionType, textContent, langDir);

    // ── STEP 3: Generate image (background only, no text) ──
    const imagePrompt = buildImagePrompt(sectionType, pageData, productStyle, language);
    let assetUrl = '';

    try {
      const referenceImages: string[] = [];
      const productImageUrl = pageData.product_image_url as string;
      if (productImageUrl && imgProvider.supportsImageReference) {
        referenceImages.push(productImageUrl);
      }

      // Map section type to aspect ratio for FLUX Kontext
      const aspectRatio = sectionType === 'hero' ? '1:1'
        : sectionType === 'final_cta' ? '1:1'
        : '1:1';

      const imageResult = await imgProvider.generateImage({
        prompt: imagePrompt,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        size: '1024x1024',
        quality: 'hd',
        aspectRatio,
      });
      assetUrl = imageResult.url;
    } catch {
      // Image generation failed — preserve previous asset
      assetUrl = previousAssetUrl;
    }

    // ── STEP 4: Merge and save ──
    const prevParsed = JSON.parse(previousContent) as Record<string, unknown>;
    const content = { ...prevParsed, ...textContent };

    await execute(c.env,
      'UPDATE landing_page_sections SET generation_status = ?, content = ?, text_layers = ?, asset_url = ?, updated_at = ? WHERE id = ?',
      ['completed', JSON.stringify(content), JSON.stringify(textLayers), assetUrl || previousAssetUrl, now, sectionId]
    );

    await execute(c.env,
      'UPDATE creative_generations SET status = ?, asset_url = ?, completed_at = ? WHERE id = ?',
      ['completed', assetUrl || previousAssetUrl, now, genId]
    );

    const updatedSection = await queryOne(c.env, 'SELECT * FROM landing_page_sections WHERE id = ?', [sectionId]);
    return successResponse(updatedSection);
  } catch (err) {
    // On failure: preserve previous asset, mark as failed
    await execute(c.env,
      'UPDATE landing_page_sections SET generation_status = ?, error_message = ?, updated_at = ? WHERE id = ?',
      ['failed', err instanceof Error ? err.message : 'Generation failed', now, sectionId]
    );
    await execute(c.env,
      'UPDATE creative_generations SET status = ?, error = ?, completed_at = ? WHERE id = ?',
      ['failed', err instanceof Error ? err.message : 'Unknown error', now, genId]
    );
    return errorResponse(err instanceof Error ? err.message : 'Generation failed', 500);
  }
});

// ─── POST /api/landing-pages/:id/generate-all ────────────────
landingPages.post('/landing-pages/:id/generate-all', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const userId = authResult.auth!.user.sub;
  const existing = await verifyPageOwnership(c, id, userId);
  if (!existing) return errorResponse('Landing page not found', 404);

  const body = await c.req.json();

  const sections = await query(c.env,
    'SELECT * FROM landing_page_sections WHERE page_id = ? AND enabled = 1 ORDER BY sort_order ASC', [id]
  );

  await execute(c.env,
    'UPDATE landing_pages SET status = ?, updated_at = ? WHERE id = ?',
    ['generating', nowISO(), id]
  );

  const results = [];
  for (const section of sections) {
    try {
      const genRes = await fetch(`${new URL(c.req.url).origin}/api/landing-pages/sections/${(section as Record<string, unknown>).id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': c.req.header('Authorization') || '',
        },
        body: JSON.stringify(body),
      });
      const genData = await genRes.json() as { success?: boolean };
      results.push({ sectionId: (section as Record<string, unknown>).id as string, success: genData.success ?? true });
    } catch {
      results.push({ sectionId: (section as Record<string, unknown>).id as string, success: false });
    }
  }

  await execute(c.env,
    'UPDATE landing_pages SET status = ?, updated_at = ? WHERE id = ?',
    ['ready', nowISO(), id]
  );

  return successResponse({ results });
});

// ─── POST /api/landing-pages/assets ──────────────────────────
landingPages.post('/landing-pages/assets', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const body = await c.req.json();
  const id = 'asset-' + generateId();
  const userId = authResult.auth!.user.sub;

  await execute(c.env,
    `INSERT INTO creative_assets (id, user_id, generation_id, project_type, project_id,
     category, name, url, thumbnail_url, width, height, file_size, provider, model,
     prompt_version, language, style, metadata, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, userId, body.generationId || null,
      body.projectType || 'marketing_image', body.projectId || null,
      body.category || 'other', body.name || 'Untitled',
      body.url, body.thumbnailUrl || null,
      body.width || null, body.height || null, body.fileSize || null,
      body.provider || 'openai', body.model || null,
      body.promptVersion || null, body.language || null,
      body.style || null, JSON.stringify(body.metadata || {}),
      nowISO(),
    ]
  );

  return successResponse({ id });
});

// ─── GET /api/landing-pages/assets ───────────────────────────
landingPages.get('/landing-pages/assets', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const assets = await query(c.env,
    'SELECT * FROM creative_assets WHERE user_id = ? ORDER BY created_at DESC',
    [authResult.auth!.user.sub]
  );
  return successResponse(assets);
});

// ─── DELETE /api/landing-pages/assets/:id ────────────────────
landingPages.delete('/landing-pages/assets/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { id } = c.req.param();
  const userId = authResult.auth!.user.sub;

  const asset = await queryOne(c.env, 'SELECT id FROM creative_assets WHERE id = ? AND user_id = ?', [id, userId]);
  if (!asset) return errorResponse('Asset not found', 404);

  await execute(c.env, 'DELETE FROM creative_assets WHERE id = ? AND user_id = ?', [id, userId]);
  return successResponse(null, 'Asset deleted');
});

// ─── POST /api/creatives/generate ────────────────────────────
landingPages.post('/creatives/generate', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const body = await c.req.json();
  const userId = authResult.auth!.user.sub;
  const now = nowISO();
  const genId = 'gen-' + generateId();

  await execute(c.env,
    `INSERT INTO creative_generations (id, user_id, provider, type, status, prompt, metadata, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [genId, userId, 'openai', 'creative_image', 'processing', body.prompt || '',
     JSON.stringify({ category: body.category, style: body.style, dimensions: body.dimensions }), now]
  );

  try {
    const imgProvider = createImageProvider(c.env);
    const size = body.dimensions === '1080x1920' ? '1024x1792'
      : body.dimensions === '1920x1080' ? '1792x1024'
      : '1024x1024';

    const aspectRatio = body.dimensions === '1080x1920' ? '9:16'
      : body.dimensions === '1920x1080' ? '16:9'
      : '1:1';

    const referenceImages: string[] = [];
    if (body.productImageUrl && imgProvider.supportsImageReference) {
      referenceImages.push(body.productImageUrl);
    }

    const result = await imgProvider.generateImage({
      prompt: body.prompt || 'Marketing creative image',
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      size,
      quality: 'hd',
      aspectRatio,
    });

    await execute(c.env,
      'UPDATE creative_generations SET status = ?, asset_url = ?, completed_at = ? WHERE id = ?',
      ['completed', result.url, now, genId]
    );

    const assetId = 'asset-' + generateId();
    await execute(c.env,
      `INSERT INTO creative_assets (id, user_id, generation_id, project_type, category, name, url,
       provider, prompt_version, metadata, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [assetId, userId, genId, 'marketing_image', body.category || 'other',
       body.name || 'Generated Creative', result.url,
       'openai', body.promptVersion || null,
       JSON.stringify({ revisedPrompt: result.revisedPrompt, style: body.style }), now]
    );

    return successResponse({ generationId: genId, assetId, url: result.url });
  } catch (err) {
    await execute(c.env,
      'UPDATE creative_generations SET status = ?, error = ?, completed_at = ? WHERE id = ?',
      ['failed', err instanceof Error ? err.message : 'Unknown error', now, genId]
    );
    return errorResponse(err instanceof Error ? err.message : 'Generation failed', 500);
  }
});

// ─── GET /api/creatives/generations ──────────────────────────
landingPages.get('/creatives/generations', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const generations = await query(c.env,
    'SELECT * FROM creative_generations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [authResult.auth!.user.sub]
  );
  return successResponse(generations);
});

// ─── Text Prompt Helpers ─────────────────────────────────────

function buildTextSystemPrompt(language: string): string {
  const langLabel = language === 'darija' ? 'Algerian Darija (Darija)'
    : language === 'arabic' ? 'Arabic (Fusha)'
    : language === 'french' ? 'French'
    : 'English';

  return `You are a professional marketing copywriter specializing in Algerian e-commerce.
Generate concise, high-converting copy in ${langLabel}.
The copy should feel natural and commercial.
Return valid JSON only. No markdown, no explanation.`;
}

function buildTextPrompt(sectionType: string, page: Record<string, unknown>, language: string, style: string): string {
  const productName = (page.product_name as string) || 'product';
  const description = (page.product_description as string) || '';
  const price = (page.product_price as string) || '';
  const langLabel = language === 'darija' ? 'Algerian Darija' : language === 'arabic' ? 'Arabic' : language === 'french' ? 'French' : 'English';

  const sectionPrompts: Record<string, string> = {
    hero: `Generate a HERO section for "${productName}" (${description}). Price: ${price} DA. Style: ${style}. Language: ${langLabel}. Return JSON: { "headline": "...", "subheadline": "...", "cta": "...", "trustIndicator": "..." }. Headline must be short and punchy. Subheadline explains the value. CTA is a button label.`,
    trust_bar: `Generate a TRUST BAR for "${productName}". Include: customer count placeholder, rating, guarantee text, COD badge. Language: ${langLabel}. Return JSON: { "trustItems": [{ "icon": "shield/truck/credit-card/star", "text": "..." }] }. 4-5 items.`,
    problem: `Generate a PROBLEM/PAIN section for "${productName}". Describe customer frustrations this product solves. Language: ${langLabel}. Return JSON: { "headline": "...", "problems": ["...", "...", "..."] }. 3 problems max.`,
    benefits: `Generate a SOLUTION/BENEFITS section for "${productName}" (${description}). Focus on outcomes. Language: ${langLabel}. Return JSON: { "headline": "...", "benefits": [{ "title": "...", "description": "..." }] }. 3-4 benefits.`,
    how_it_works: `Generate a HOW IT WORKS section for "${productName}". 3 simple steps. Language: ${langLabel}. Return JSON: { "headline": "...", "steps": [{ "number": 1, "title": "...", "description": "..." }] }.`,
    social_proof: `Generate a SOCIAL PROOF section for "${productName}". Use placeholders, not fake testimonials. Language: ${langLabel}. Return JSON: { "headline": "...", "stats": [{ "value": "...", "label": "..." }] }.`,
    offer: `Generate an OFFER/PRICE section for "${productName}". Price: ${price} DA. Payment: COD. Language: ${langLabel}. Return JSON: { "headline": "...", "priceDisplay": "${price} DA", "originalPrice": "...", "includes": ["..."], "deliveryInfo": "...", "paymentText": "..." }.`,
    faq: `Generate FAQ for "${productName}" (${description}). 4 questions about delivery, payment, returns, warranty. Language: ${langLabel}. Return JSON: { "headline": "...", "faqs": [{ "question": "...", "answer": "..." }] }.`,
    final_cta: `Generate FINAL CTA + ORDER section for "${productName}". Price: ${price} DA. Language: ${langLabel}. Return JSON: { "headline": "...", "ctaText": "...", "urgencyText": "...", "formLabels": { "name": "...", "phone": "...", "wilaya": "...", "commune": "..." } }.`,
    footer: `Generate FOOTER for "${productName}". Minimal. Language: ${langLabel}. Return JSON: { "contact": "...", "social": ["..."], "policies": ["..."] }.`,
  };

  return sectionPrompts[sectionType] || `Generate content for a ${sectionType} section for "${productName}". Language: ${langLabel}. Return valid JSON.`;
}

function buildTextLayersFromContent(sectionType: string, content: Record<string, unknown>, dir: 'ltr' | 'rtl'): Array<Record<string, unknown>> {
  const layers: Array<Record<string, unknown>> = [];
  const textAlign = dir === 'rtl' ? 'right' : 'left';

  const makeLayer = (type: string, text: string, overrides: Record<string, unknown> = {}) => {
    if (!text || typeof text !== 'string') return;
    layers.push({
      id: `tl-${generateId()}`,
      type,
      content: text,
      direction: dir,
      textAlign,
      fontSize: 32,
      fontWeight: 700,
      color: '#FFFFFF',
      opacity: 1,
      ...overrides,
    });
  };

  switch (sectionType) {
    case 'hero':
      makeLayer('headline', content.headline as string, { fontSize: 40, fontWeight: 800 });
      makeLayer('subheadline', content.subheadline as string, { fontSize: 18, fontWeight: 400 });
      makeLayer('cta', content.cta as string, { fontSize: 16, fontWeight: 600 });
      break;
    case 'trust_bar':
      if (Array.isArray(content.trustItems)) {
        (content.trustItems as Array<{ text: string }>).forEach((item) => {
          makeLayer('badge', item.text, { fontSize: 12, fontWeight: 500 });
        });
      }
      break;
    case 'problem':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      if (Array.isArray(content.problems)) {
        (content.problems as string[]).forEach((p) => {
          makeLayer('body', p, { fontSize: 14, fontWeight: 400 });
        });
      }
      break;
    case 'benefits':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      if (Array.isArray(content.benefits)) {
        (content.benefits as Array<{ title: string; description: string }>).forEach((b) => {
          makeLayer('headline', b.title, { fontSize: 16, fontWeight: 600 });
          makeLayer('body', b.description, { fontSize: 13, fontWeight: 400 });
        });
      }
      break;
    case 'how_it_works':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      if (Array.isArray(content.steps)) {
        (content.steps as Array<{ title: string; description: string }>).forEach((s) => {
          makeLayer('headline', s.title, { fontSize: 16, fontWeight: 600 });
          makeLayer('body', s.description, { fontSize: 13, fontWeight: 400 });
        });
      }
      break;
    case 'social_proof':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      if (Array.isArray(content.stats)) {
        (content.stats as Array<{ value: string; label: string }>).forEach((s) => {
          makeLayer('headline', s.value, { fontSize: 24, fontWeight: 800 });
          makeLayer('body', s.label, { fontSize: 12, fontWeight: 400 });
        });
      }
      break;
    case 'offer':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      makeLayer('price', (content.priceDisplay as string) || '', { fontSize: 36, fontWeight: 800, color: '#FFD700' });
      if (content.originalPrice) makeLayer('badge', content.originalPrice as string, { fontSize: 16, fontWeight: 400 });
      break;
    case 'faq':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      if (Array.isArray(content.faqs)) {
        (content.faqs as Array<{ question: string; answer: string }>).forEach((f) => {
          makeLayer('headline', f.question, { fontSize: 14, fontWeight: 600 });
          makeLayer('body', f.answer, { fontSize: 13, fontWeight: 400 });
        });
      }
      break;
    case 'final_cta':
      makeLayer('headline', content.headline as string, { fontSize: 28, fontWeight: 700 });
      makeLayer('cta', (content.ctaText as string) || '', { fontSize: 18, fontWeight: 700 });
      break;
    case 'footer':
      makeLayer('body', (content.contact as string) || '', { fontSize: 12, fontWeight: 400 });
      break;
  }

  return layers;
}

// ─── Image Prompt Helpers ────────────────────────────────────

function buildImagePrompt(sectionType: string, page: Record<string, unknown>, style: string, _language: string): string {
  const productName = (page.product_name as string) || 'product';
  const styleDescriptions: Record<string, string> = {
    luxury: 'luxurious, premium, elegant dark background with gold accents, high-end product photography',
    premium: 'premium, sophisticated, modern, clean professional look',
    minimal: 'minimalist, clean, simple, elegant white space',
    modern_tech: 'modern, tech-forward, futuristic, sleek digital aesthetic',
    clean: 'clean, professional, e-commerce style, white background',
    dark_gold: 'dark theme with gold accents, premium luxury feel',
    ugc: 'user-generated content style, authentic, real-life, casual',
    cinematic: 'cinematic, dramatic lighting, movie-like quality',
    medical: 'medical, professional, clinical, trustworthy, clean',
  };

  const styleDesc = styleDescriptions[style] || styleDescriptions.luxury;

  // IMPORTANT: Prompts explicitly say NO TEXT to avoid AI rendering Arabic/french text in the image.
  // Text is handled separately by FoxBox as editable text layers.
  const sectionImagePrompts: Record<string, string> = {
    hero: `Professional product photography hero image for "${productName}". ${styleDesc}. Square composition. Product centered with dramatic lighting. NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY. Pure visual product showcase. Commercial e-commerce style.`,
    trust_bar: `Minimalist abstract background pattern. ${styleDesc}. Subtle geometric shapes suggesting trust and reliability. NO TEXT. Clean gradient background for overlay.`,
    problem: `Emotional atmospheric image evoking customer frustration. ${styleDesc}. Dark moody tones. Abstract scenario. NO TEXT. Background only.`,
    benefits: `Clean product benefit visualization background. ${styleDesc}. Abstract positive imagery. NO TEXT. Suitable for text overlay.`,
    how_it_works: `Step-by-step visual guide background. ${styleDesc}. Numbered arrows or flow elements. NO TEXT. Instructional design background.`,
    social_proof: `Social proof background texture. ${styleDesc}. Stars, review elements as abstract shapes. NO TEXT. Background for overlay.`,
    offer: `Special offer promotional background. ${styleDesc}. Urgency elements, premium sale design. NO TEXT. Price display area left empty.`,
    faq: `Clean FAQ section background. ${styleDesc}. Professional neutral background. NO TEXT. Typography area left empty.`,
    final_cta: `Call-to-action background. ${styleDesc}. Form area left empty. Order section background. NO TEXT.`,
    footer: `Minimal footer background. ${styleDesc}. Contact area left empty. NO TEXT.`,
  };

  return sectionImagePrompts[sectionType] || `Professional marketing image background for "${productName}". ${styleDesc}. Square format. NO TEXT. Product visual only.`;
}

export default landingPages;
