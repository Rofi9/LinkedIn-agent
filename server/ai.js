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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "";

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
    if (err instanceof OpenAI.RateLimitError) throw new AiError("rate_limited", "The AI is busy or the OpenAI account is out of credit. Try again later.", 429);
    if (err instanceof OpenAI.NotFoundError) throw new AiError("config", `OpenAI doesn't recognize the model "${OPENAI_MODEL}". Run: node manage.js models`, 500);
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
  if (!aiConfigured()) throw new AiError("config", provider === "openai" ? "Set OPENAI_MODEL in .env (run: node manage.js models to see options)." : "No AI key is set on the server. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.", 503);
  const text = provider === "openai" ? await askOpenAI(prompt) : await askClaude(prompt);
  const value = parseJson(text);
  if (value === undefined) throw new AiError("invalid_json", "The AI's answer wasn't valid JSON.", 502);
  return value;
}

/* For `node manage.js models`: the model IDs this key can use. */
export async function listModels() {
  if (provider === "openai") { const out = []; for await (const m of openaiClient().models.list()) out.push(m.id); return out.sort(); }
  if (provider === "anthropic") { const out = []; for await (const m of anthropicClient().models.list()) out.push(m.id); return out; }
  return [];
}
