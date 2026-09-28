// Command-line admin for Darman Studio.
//   node manage.js add-user <email> <name> [--admin]
//   node manage.js reset-password <email>
//   node manage.js list-users
//   node manage.js remove-user <email>
//   node manage.js backup [file]        (safe while the app is running)
//   node manage.js models               (model IDs your AI key can use)
import { db, createUser, findUserByEmail, setPassword, listUsers, deleteUser, randomPassword } from "./db.js";
import path from "node:path";

const [cmd, ...args] = process.argv.slice(2);
const admin = args.includes("--admin");
const rest = args.filter((a) => a !== "--admin");

switch (cmd) {
  case "add-user": {
    const [email, ...nameParts] = rest;
    if (!email) { console.log("Usage: node manage.js add-user <email> <name> [--admin]"); process.exit(1); }
    if (findUserByEmail(email)) { console.log(`${email} already exists.`); process.exit(1); }
    const password = randomPassword();
    createUser({ email, name: nameParts.join(" ") || email.split("@")[0], password, isAdmin: admin });
    console.log(`Created ${admin ? "admin " : ""}${email}\nTemporary password: ${password}\nAsk them to change it after signing in.`);
    break;
  }
  case "reset-password": {
    const user = rest[0] && findUserByEmail(rest[0]);
    if (!user) { console.log("No such user."); process.exit(1); }
    const password = randomPassword();
    setPassword(user.id, password);
    console.log(`New password for ${user.email}: ${password}`);
    break;
  }
  case "list-users":
    for (const u of listUsers()) console.log(`${u.isAdmin ? "admin " : "      "} ${u.email}  (${u.name})`);
    break;
  case "remove-user": {
    const user = rest[0] && findUserByEmail(rest[0]);
    if (!user) { console.log("No such user."); process.exit(1); }
    deleteUser(user.id);
    console.log(`Removed ${user.email}`);
    break;
  }
  case "backup": {
    const file = rest[0] || path.join(process.env.DATA_DIR || "data", `backup-${new Date().toISOString().slice(0, 10)}.db`);
    await db.backup(file);
    console.log(`Backed up to ${file}`);
    break;
  }
  case "models": {
    const { listModels, provider } = await import("./ai.js");
    if (provider === "none") { console.log("No AI key set. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env."); process.exit(1); }
    try { for (const id of await listModels()) console.log(id); }
    catch (e) { console.log(`Couldn't list models: ${e.message}`); process.exit(1); }
    break;
  }
  default:
    console.log("Commands: add-user <email> <name> [--admin] | reset-password <email> | list-users | remove-user <email> | backup [file] | models");
}
