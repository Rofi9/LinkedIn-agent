// AI calls for Studio. The page sends a complete prompt (instructions, voice
// profile, research and the JSON shape it wants); the server asks the model
// and returns the reply parsed as JSON. API keys never reach the browser.
//
// Works with either provider:
//   ANTHROPIC_API_KEY -> Claude (default model claude-opus-5)
//   OPENAI_API_KEY    -> OpenAI (set OPENAI_MODEL; `node manage.js models` lists what your key can use)
// If both keys are set, AI_PROVIDER=anthropic|openai picks one (default anthropic).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const provider = (() => {
  const want = (process.env.AI_PROVIDER || "").toLowerCase();
  if (want === "openai" || want === "anthropic") return want;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
})();

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
// Server-side refusal fallbacks are on by default; CLAUDE_FALLBACKS=off disables them.
const CLAUDE_FALLBACKS = process.env.CLAUDE_FALLBACKS !== "off";
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "").trim();

export const aiModel = provider === "openai" ? OPENAI_MODEL || "(OPENAI_MODEL not set)" : provider === "anthropic" ? CLAUDE_MODEL : "none";
export const aiConfigured = () =>
  (provider === "anthropic" && !!process.env.ANTHROPIC_API_KEY) ||
  (provider === "openai" && !!process.env.OPENAI_API_KEY && !!OPENAI_MODEL);

let anthropic, openai;
const anthropicClient = () => (anthropic ||= new Anthropic()); // reads ANTHROPIC_API_KEY
const openaiClient = () => (openai ||= new OpenAI());          // reads OPENAI_API_KEY

export class AiError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}

/* Read the reply tolerantly: whole text, a ```json fence, or the span from
   the first { or [ to the last } or ]. */
function parseJson(text) {
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
  let v = tryParse(text.trim());
  if (v !== undefined) return v;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { v = tryParse(fence[1].trim()); if (v !== undefined) return v; }
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  if (starts.length) {
    const s = Math.min(...starts);
    const e = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (e > s) { v = tryParse(text.slice(s, e + 1)); if (v !== undefined) return v; }
  }
  return undefined;
}

const JSON_ONLY = "\n\nYour reply is parsed by a program: reply with only the JSON value, no other text.";

async function askClaude(prompt) {
  let response;
  try {
    const request = { model: CLAUDE_MODEL, max_tokens: 16000, messages: [{ role: "user", content: prompt + JSON_ONLY }] };
    response = CLAUDE_FALLBACKS
      // If Claude's safety classifiers decline a request, re-run it on
      // Anthropic's recommended fallback model instead of failing.
      ? await anthropicClient().beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await anthropicClient().messages.create(request);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("config", "The server's Anthropic API key is missing or invalid.", 500);
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI is busy. Try again in a minute.", 429);
    if (err instanceof Anthropic.BadRequestError) throw new AiError("invalid_request", err.message, 400);
    if (err instanceof Anthropic.APIError) throw new AiError("upstream_error", `AI service error ${err.status ?? ""}`.trim(), 502);
    throw new AiError("upstream_error", "Couldn't reach the AI service.", 502);
  }
  if (response.stop_reason === "refusal") throw new AiError("refused", "The AI declined this request.", 422);
  if (response.stop_reason === "max_tokens") throw new AiError("invalid_json", "The answer was too long and got cut off.", 502);
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function askOpenAI(prompt) {
  let completion;
  try {
    completion = await openaiClient().chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: 16000,
      messages: [{ role: "user", content: prompt + JSON_ONLY }],
    });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) throw new AiError("config", "The server's OpenAI API key is missing or invalid.", 500);
    if (err instanceof OpenAI.APIError) console.error(`OpenAI error ${err.status ?? ""} ${err.code ?? ""}: ${err.message}`);
    if (err instanceof OpenAI.RateLimitError) {
      if (err.code === "insufficient_quota") throw new AiError("no_credit", "The OpenAI account has no credit left. Add credit at platform.openai.com → Settings → Billing, then try again.", 402);
      throw new AiError("rate_limited", `OpenAI's rate limit was reached for this account (${err.message}). Wait a minute and try again. New OpenAI accounts have low limits that rise after the first payments.`, 429);
    }
    if (err instanceof OpenAI.NotFoundError) throw new AiError("config", `OpenAI doesn't recognize the model "${OPENAI_MODEL}". Check the exact model name in OPENAI_MODEL.`, 500);
    if (err instanceof OpenAI.BadRequestError) throw new AiError("invalid_request", err.message, 400);
    if (err instanceof OpenAI.APIError) throw new AiError("upstream_error", `AI service error ${err.status ?? ""}`.trim(), 502);
    throw new AiError("upstream_error", "Couldn't reach the AI service.", 502);
  }
  const choice = completion.choices?.[0];
  if (choice?.message?.refusal) throw new AiError("refused", "The AI declined this request.", 422);
  if (choice?.finish_reason === "length") throw new AiError("invalid_json", "The answer was too long and got cut off.", 502);
  return choice?.message?.content || "";
}

export async function askJson(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new AiError("invalid_request", "Empty prompt", 400);
  if (prompt.length > 120_000) throw new AiError("prompt_too_large", "Prompt too large", 413);
  if (!aiConfigured()) throw new AiError("config", provider === "openai" ? "OPENAI_MODEL isn't set. Add it to the server's environment variables (on Vercel: Settings > Environment Variables), then redeploy." : "No AI key is set. Add OPENAI_API_KEY and OPENAI_MODEL (or ANTHROPIC_API_KEY) to the server's environment variables (on Vercel: Settings > Environment Variables), then redeploy.", 503);
  const text = provider === "openai" ? await askOpenAI(prompt) : await askClaude(prompt);
  const value = parseJson(text);
  if (value === undefined) throw new AiError("invalid_json", "The AI's answer wasn't valid JSON.", 502);
  return value;
}

/* ---------- Web research: recent news with verified dates ---------- */
export const NEWS_TOPICS = {
  hospitals: { label: "Hospitals adopting AI", kind: "hospital", about: "hospitals and health systems announcing, piloting or reporting results of AI in clinical work: generative AI, ambient AI scribes, chart summaries, AI training for their clinicians, AI governance, and failures, errors or lawsuits" },
  regulation: { label: "Governments and regulation", kind: "government", about: "government and regulator actions on AI in healthcare and on AI literacy for health workers: EU AI Act, UK NHS and MHRA, US FDA and HHS, WHO, UAE, Saudi Arabia, Qatar, Armenia and other countries" },
  studies: { label: "New studies", kind: "study", about: "new peer-reviewed studies and trials about AI in clinical practice and how doctors use it (NEJM AI, JAMA, The Lancet, Nature Medicine, BMJ, npj Digital Medicine and similar), including safety, accuracy, deskilling and bias" },
  education: { label: "Training doctors in AI", kind: "physician", about: "AI training and education for doctors: medical schools, residency programs, continuing medical education courses, national physician AI-literacy programs, and well-known physicians publicly writing about AI in medicine" },
  region: { label: "Armenia, the Gulf and the CIS", kind: "news", about: "AI in healthcare in Armenia, Georgia, the South Caucasus, Central Asia and the CIS, and the Gulf states (UAE, Saudi Arabia, Qatar, Kuwait, Oman, Bahrain)" },
  market: { label: "Training market and competitors", kind: "competitor", about: "companies and institutions offering AI training or AI courses for clinicians and hospitals: launches, partnerships, funding and new programs" },
};

const iso = (d) => d.toISOString().slice(0, 10);

/* Ask the model to search the web and return dated items as JSON. */
async function searchText(prompt) {
  if (provider === "openai") {
    try {
      const r = await openaiClient().responses.create({ model: OPENAI_MODEL, tools: [{ type: "web_search" }], input: prompt });
      return r.output_text || "";
    } catch (err) {
      if (err instanceof OpenAI.APIError) console.error(`OpenAI search error ${err.status ?? ""} ${err.code ?? ""}: ${err.message}`);
      if (err instanceof OpenAI.RateLimitError && err.code === "insufficient_quota") throw new AiError("no_credit", "The OpenAI account has no credit left. Add credit at platform.openai.com → Settings → Billing.", 402);
      if (err instanceof OpenAI.RateLimitError) throw new AiError("rate_limited", "OpenAI's rate limit was reached. Wait a minute and try again.", 429);
      if (err instanceof OpenAI.APIError) throw new AiError("upstream_error", `Web search failed (${err.message})`, 502);
      throw new AiError("upstream_error", "Couldn't reach the AI service.", 502);
    }
  }
  try {
    const r = await anthropicClient().messages.create({
      model: CLAUDE_MODEL, max_tokens: 16000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    });
    if (r.stop_reason === "refusal") throw new AiError("refused", "The AI declined this search.", 422);
    return r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIError) throw new AiError("upstream_error", `Web search failed (${err.message})`, 502);
    throw new AiError("upstream_error", "Couldn't reach the AI service.", 502);
  }
}

/* Returns [{title, kind, date, summary, fact, url, caution}] published on or after `since` (YYYY-MM-DD). */
export async function searchNews(topicKey, since) {
  const topic = NEWS_TOPICS[topicKey];
  if (!topic) throw new AiError("invalid_request", "Unknown topic.", 400);
  if (!aiConfigured()) throw new AiError("config", "AI isn't set up on the server yet.", 503);
  const today = iso(new Date());
  const prompt = `Today is ${today}. You research news for Darman.ai, which teaches physicians to use AI practically and responsibly. The reader has no medical background.

Search the web for ${topic.about}, PUBLISHED BETWEEN ${since} AND ${today}.

Rules:
- Only include items whose publication date you checked on the page itself and that fall between ${since} and ${today}. Skip anything older, undated, or that you only saw in a search snippet.
- Prefer primary sources (the hospital, regulator, journal or company) and reputable press.
- Never invent titles, numbers, people or quotes. Every number must appear in the source.
- Up to 6 items, most important first. If nothing qualifies, return [].

Reply with only a JSON array of objects:
{"title": string (short), "date": "YYYY-MM-DD" (publication date), "summary": string (2-3 plain-English sentences; define any medical term in brackets), "fact": string (the one most useful fact, worded as the source states it), "url": string (the page you read), "caution": string (one line: how solid it is and what not to overclaim)}`;
  const value = parseJson(await searchText(prompt + JSON_ONLY));
  if (!Array.isArray(value)) throw new AiError("invalid_json", "The AI's search results weren't in the expected format. Try again.", 502);
  return value
    .filter((x) => x && typeof x === "object" && x.title && /^https?:\/\//.test(String(x.url || "")))
    .map((x) => ({ ...x, date: String(x.date || "").slice(0, 10) }))
    // Keep only verified dates inside the window.
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date >= since && x.date <= today)
    .map((x) => ({ kind: topic.kind, title: String(x.title), date: x.date, summary: String(x.summary || ""), fact: String(x.fact || ""), url: String(x.url), caution: String(x.caution || "") }));
}

/* For `node manage.js models`: the model IDs this key can use. */
export async function listModels() {
  if (provider === "openai") { const out = []; for await (const m of openaiClient().models.list()) out.push(m.id); return out.sort(); }
  if (provider === "anthropic") { const out = []; for await (const m of anthropicClient().models.list()) out.push(m.id); return out; }
  return [];
}
