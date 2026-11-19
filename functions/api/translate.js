// Fixlytools - Translate API (Cloudflare Pages Function).
// Needs a Workers AI binding named "AI" (Pages project > Settings > Bindings > Add > Workers AI).
// Nothing is stored or logged by this function; the text is sent to Cloudflare Workers AI only to be translated.

const MODEL = '@cf/meta/m2m100-1.2b';
const MAX_CHARS = 2000;
const LANG = /^[a-z]{2,3}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // only our own pages may call this endpoint
  const origin = request.headers.get('Origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403); }
    catch (e) { return json({ error: 'forbidden' }, 403); }
  }

  if (!env || !env.AI) return json({ error: 'not_configured' }, 503);

  let data;
  try { data = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const text = data && typeof data.text === 'string' ? data.text : '';
  const source = data && typeof data.source === 'string' ? data.source.toLowerCase() : '';
  const target = data && typeof data.target === 'string' ? data.target.toLowerCase() : '';
  if (!text.trim() || text.length > MAX_CHARS) return json({ error: 'bad_text' }, 400);
  if (!LANG.test(source) || !LANG.test(target) || source === target) return json({ error: 'bad_language' }, 400);

  try {
    const out = await env.AI.run(MODEL, { text: text, source_lang: source, target_lang: target });
    const t = out && (out.translated_text || (out.response && out.response.translated_text) || out.translation);
    if (!t || typeof t !== 'string') return json({ error: 'empty' }, 502);
    return json({ translation: t });
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
}

export async function onRequest() {
  return json({ error: 'method_not_allowed' }, 405);
}
