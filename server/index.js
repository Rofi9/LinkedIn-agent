// Run Studio as a normal Node server (Docker, a VPS, or locally).
// On Vercel, api/index.js serves the same app instead.
import app, { ensureSetup } from "./app.js";
import { driver } from "./db.js";
import { aiConfigured, aiModel, provider } from "./ai.js";

const PORT = Number(process.env.PORT || 3000);
await ensureSetup();
app.listen(PORT, () => console.log(`Darman Studio on http://0.0.0.0:${PORT} (storage: ${driver}; AI: ${provider}, model ${aiModel}, ${aiConfigured() ? "ready" : "NOT configured"})`));
