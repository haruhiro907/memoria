/* 一時プローブ: Storage エミュレータへの書き込みを検証する */
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const AUTH = "http://127.0.0.1:9099";
const KEY = "demo-api-key";
const BUCKET = "demo-memoria.appspot.com";

const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "family@memoria.example", password: "dev123456", returnSecureToken: true }),
});
const body = await res.json();
if (!res.ok) throw new Error(`signIn: ${body.error?.message}`);
const tok = body.idToken;
process.stdout.write(`signIn OK (uid=${body.localId})\n`);
process.stdout.write(`payload: ${JSON.stringify(JSON.parse(Buffer.from(tok.split(".")[1], "base64").toString()))}\n`);

const tries = [
  ["Bearer", { Authorization: `Bearer ${tok}` }],
  ["Bearer + x-firebase-emulator", { Authorization: `Bearer ${tok}`, "x-firebase-emulator": "true" }],
];

for (const [name, headers] of tries) {
  const url = `http://127.0.0.1:9199/v0/b/${BUCKET}/o/${encodeURIComponent("families/fam-dev/photos/probe-" + name.replace(/\W+/g, "-") + ".png")}?uploadType=media&content_type=image%2Fpng`;
  const r = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "image/png" }, body: Buffer.from([1, 2, 3]) });
  const text = await r.text();
  process.stdout.write(`${name}: ${r.status} ${text.slice(0, 200)}\n`);
}

const env = await initializeTestEnvironment({ projectId: "demo-memoria", storage: undefined });
await env.cleanup();
