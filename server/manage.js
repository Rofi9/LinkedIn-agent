// Command-line admin for Darman Studio (Docker/VPS, or locally with DATABASE_URL set to reach a hosted database).
//   node manage.js add-user <email> <name> [--admin]
//   node manage.js reset-password <email>
//   node manage.js list-users
//   node manage.js remove-user <email>
//   node manage.js export [file]        (all documents and the user list, as JSON)
//   node manage.js models               (model IDs your AI key can use)
import fs from "node:fs";
import { init, createUser, findUserByEmail, setPassword, listUsers, deleteUser, randomPassword, exportAll } from "./db.js";

const [cmd, ...args] = process.argv.slice(2);
const admin = args.includes("--admin");
const rest = args.filter((a) => a !== "--admin");
await init();

switch (cmd) {
  case "add-user": {
    const [email, ...nameParts] = rest;
    if (!email) { console.log("Usage: node manage.js add-user <email> <name> [--admin]"); process.exit(1); }
    if (await findUserByEmail(email)) { console.log(`${email} already exists.`); process.exit(1); }
    const password = randomPassword();
    await createUser({ email, name: nameParts.join(" ") || email.split("@")[0], password, isAdmin: admin });
    console.log(`Created ${admin ? "admin " : ""}${email}\nTemporary password: ${password}\nAsk them to change it after signing in.`);
    break;
  }
  case "reset-password": {
    const user = rest[0] && (await findUserByEmail(rest[0]));
    if (!user) { console.log("No such user."); process.exit(1); }
    const password = randomPassword();
    await setPassword(user.id, password);
    console.log(`New password for ${user.email}: ${password}`);
    break;
  }
  case "list-users":
    for (const u of await listUsers()) console.log(`${u.isAdmin ? "admin " : "      "} ${u.email}  (${u.name})`);
    break;
  case "remove-user": {
    const user = rest[0] && (await findUserByEmail(rest[0]));
    if (!user) { console.log("No such user."); process.exit(1); }
    await deleteUser(user.id);
    console.log(`Removed ${user.email}`);
    break;
  }
  case "export": {
    const file = rest[0] || `studio-export-${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(file, JSON.stringify(await exportAll(), null, 1));
    console.log(`Exported to ${file}`);
    break;
  }
  case "models": {
    const { listModels, provider } = await import("./ai.js");
    if (provider === "none") { console.log("No AI key set. Add OPENAI_API_KEY or ANTHROPIC_API_KEY."); process.exit(1); }
    try { for (const id of await listModels()) console.log(id); }
    catch (e) { console.log(`Couldn't list models: ${e.message}`); process.exit(1); }
    break;
  }
  default:
    console.log("Commands: add-user <email> <name> [--admin] | reset-password <email> | list-users | remove-user <email> | export [file] | models");
}
process.exit(0);
