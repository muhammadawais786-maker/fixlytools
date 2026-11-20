// Fixlytools - Cloudflare Worker.
// Static files are served by Workers Static Assets. Only /api/* runs this code (see wrangler.jsonc).
// /api/translate sends text to Google Cloud Translation (only if the secret GOOGLE_TRANSLATE_KEY is set) or to Cloudflare Workers AI (binding "AI"), only to translate it.
// Workers AI pairs that do not include English are translated in two steps (source -> English -> target), which is more accurate. Nothing is stored or logged.

const MODEL = '@cf/meta/m2m100-1.2b';
const MAX_CHARS = 2000;
const LANG = /^[a-z]{2,3}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function ai(env, text, source, target) {
  const out = await env.AI.run(MODEL, { text: text, source_lang: source, target_lang: target });
  const t = out && (out.translated_text || (out.response && out.response.translated_text) || out.translation);
  return t && typeof t === 'string' ? t : '';
}

async function google(text, source, target, key) {
  const r = await fetch('https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: source, target: target, format: 'text' })
  });
  if (!r.ok) throw new Error('google ' + r.status);
  const d = await r.json();
  const t = d && d.data && d.data.translations && d.data.translations[0] && d.data.translations[0].translatedText;
  return typeof t === 'string' ? t : '';
}

async function translate(request, env) {
  // only our own pages may call this endpoint
  const origin = request.headers.get('Origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403); }
    catch (e) { return json({ error: 'forbidden' }, 403); }
  }
  if (!env || (!env.AI && !env.GOOGLE_TRANSLATE_KEY)) return json({ error: 'not_configured' }, 503);

  let data;
  try { data = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const text = data && typeof data.text === 'string' ? data.text : '';
  const source = data && typeof data.source === 'string' ? data.source.toLowerCase() : '';
  const target = data && typeof data.target === 'string' ? data.target.toLowerCase() : '';
  if (!text.trim() || text.length > MAX_CHARS) return json({ error: 'bad_text' }, 400);
  if (!LANG.test(source) || !LANG.test(target) || source === target) return json({ error: 'bad_language' }, 400);

  try {
    if (env.GOOGLE_TRANSLATE_KEY) {
      try {
        const g = await google(text, source, target, env.GOOGLE_TRANSLATE_KEY);
        if (g) return json({ translation: g, engine: 'google' });
      } catch (e) { /* fall back to Workers AI */ }
    }
    if (!env.AI) return json({ error: 'upstream' }, 502);
    let t, engine = 'cloudflare';
    if (source !== 'en' && target !== 'en') {
      const mid = await ai(env, text, source, 'en');
      t = await ai(env, mid, 'en', target);
      engine = 'cloudflare-pivot';
    } else {
      t = await ai(env, text, source, target);
    }
    if (!t) return json({ error: 'empty' }, 502);
    return json({ translation: t, engine: engine });
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/translate') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return translate(request, env);
    }
    if (url.pathname.indexOf('/api/') === 0) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
