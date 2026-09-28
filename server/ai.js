// Claude calls for Studio. The page sends a complete prompt (instructions,
// voice profile, research and the JSON shape it wants); the server asks
// Claude and returns the reply parsed as JSON. The API key never reaches
// the browser.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
// Server-side refusal fallbacks are on by default; CLAUDE_FALLBACKS=off disables them.
const FALLBACKS = process.env.CLAUDE_FALLBACKS !== "off";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

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

export async function askJson(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new AiError("invalid_request", "Empty prompt", 400);
  if (prompt.length > 120_000) throw new AiError("prompt_too_large", "Prompt too large", 413);
  let response;
  try {
    const request = {
      model: MODEL,
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: prompt + "\n\nYour reply is parsed by a program: reply with only the JSON value, no other text.",
      }],
    };
    response = FALLBACKS
      // If Claude's safety classifiers decline a request, re-run it on
      // Anthropic's recommended fallback model instead of failing.
      ? await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(request);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("config", "The server's Anthropic API key is missing or invalid.", 500);
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "Claude is busy. Try again in a minute.", 429);
    if (err instanceof Anthropic.BadRequestError) throw new AiError("invalid_request", err.message, 400);
    if (err instanceof Anthropic.APIError) throw new AiError("upstream_error", `Claude API error ${err.status ?? ""}`.trim(), 502);
    throw new AiError("upstream_error", "Couldn't reach Claude.", 502);
  }
  if (response.stop_reason === "refusal") throw new AiError("refused", "Claude declined this request.", 422);
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (response.stop_reason === "max_tokens") throw new AiError("invalid_json", "The answer was too long and got cut off.", 502);
  const value = parseJson(text);
  if (value === undefined) throw new AiError("invalid_json", "Claude's answer wasn't valid JSON.", 502);
  return value;
}

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const aiModel = MODEL;
