/*
 * 開発用シード（エミュレータ専用）
 *
 *   $env:JAVA_HOME は不要（firestore と storage エミュレータが起動している前提）
 *   node scripts/seed-dev.mjs
 *
 * 投入するもの:
 *   - Auth ユーザー 2 名（家族用 / 本人用・エミュレータ REST で作成）
 *     family@memoria.example / person@memoria.example ともパスワード dev123456
 *   - families/fam-dev + members（family ロール / person ロール）
 *   - people 2 名
 *   - events 5 件（日精度 / 月精度 / 年精度 / eraLabel のみ / 時期なし＝道に載せない確認用）
 *   - photos 6 件（色違いの小さな PNG を Storage エミュレータに置く）
 *   - 写真 ⇔ 人物 / 出来事の関連（links + 弱参照配列）
 */
import zlib from "node:zlib";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

const PROJECT_ID = "demo-memoria";
const BUCKET = "demo-memoria.appspot.com";
const STORAGE_HOST = "http://127.0.0.1:9199";
const AUTH_HOST = "http://127.0.0.1:9099";
const API_KEY = "demo-api-key";
const FID = "fam-dev";

/* ---------- Auth ユーザー（実アカウント。アプリのログイン画面で使用する） ---------- */

/** メール/パスワードで実 UID を取得（既存ユーザーは存在すればその uid を返す） */
async function ensureAuthUser(email, password) {
  const signUp = await fetch(`${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (signUp.ok) {
    const body = await signUp.json();
    process.stdout.write(`auth: ${email} を作成（${body.localId}）\n`);
    return body.localId;
  }
  /* EMAIL_EXISTS のときはサインインして uid を取る */
  const signIn = await fetch(`${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await signIn.json();
  if (!signIn.ok) throw new Error(`auth 確認失敗: ${body.error?.message}`);
  process.stdout.write(`auth: ${email} は既にあります（${body.localId}）\n`);
  return body.localId;
}

/* ---------- 小さな色付き PNG を作る（最小限の PNG エンコーダ） ---------- */

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(width, height, [r, g, b]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- Storage エミュレータへ PUT（Storage Rules に沿って認証付きで） ---------- */

const idTokens = {};
async function getIdToken(email, password) {
  if (idTokens[email]) return idTokens[email];
  const res = await fetch(`${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signIn 失敗: ${body.error?.message}`);
  idTokens[email] = body.idToken;
  return body.idToken;
}

async function uploadPhoto(storagePath, png, idToken) {
  const url = `${STORAGE_HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?uploadType=media`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "image/png" },
    body: png,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`storage PUT 失敗: ${body.error?.message ?? res.status}`);
  const token = body.downloadTokens;
  return `http://127.0.0.1:9199/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

/* ---------- main ---------- */

const FAMILY_EMAIL = "family@memoria.example";
const PERSON_EMAIL = "person@memoria.example";
const PASSWORD = "dev123456";
const UID_FAMILY = await ensureAuthUser(FAMILY_EMAIL, PASSWORD);
const UID_PERSON = await ensureAuthUser(PERSON_EMAIL, PASSWORD);

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { host: "127.0.0.1", port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const app = initializeApp({ projectId: PROJECT_ID });
  connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
  const futCase = (fid, uid, role, name = "テスト") => ({
    uid,
    role,
    displayName: name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await setDoc(doc(db, "families", FID), { createdByUid: UID_FAMILY, name: "サンプル家" });
  await setDoc(doc(db, "families", FID, "members", UID_FAMILY), futCase(FID, UID_FAMILY, "family", "みんな"));
  await setDoc(doc(db, "families", FID, "members", UID_PERSON), futCase(FID, UID_PERSON, "person", "本人さん"));
  await setDoc(doc(db, "users", UID_FAMILY), { uid: UID_FAMILY, familyId: FID, createdAt: Date.now() });
  await setDoc(doc(db, "users", UID_PERSON), { uid: UID_PERSON, familyId: FID, createdAt: Date.now() });

  /* 人物 */
  await setDoc(doc(db, "families", FID, "people", "p-hanako"), {
    name: "はな子",
    photoURL: null,
    birthday: "1963-04-08",
    note: "写真が好き。",
    addedByUid: UID_FAMILY,
    createdAt: 1000,
    updatedAt: 1000,
  });
  await setDoc(doc(db, "families", FID, "people", "p-taro"), {
    name: "たろう",
    photoURL: null,
    birthday: null,
    note: null,
    addedByUid: UID_FAMILY,
    createdAt: 900,
    updatedAt: 900,
  });

  /* 出来事 v2（精度の違い・-eraLabel・時期なし・eraLabel+写真なし） */
  const events = [
    ["ev-1972", { title: "初めての旅", description: "海へ行った。", startDate: { value: "1972-08-01", precision: "day" }, endDate: null, eraLabel: null, icon: "✈", personRefs: ["p-hanako"], createdAt: 5 }],
    ["ev-1965", { title: "運動会", description: null, startDate: { value: "1965", precision: "year" }, endDate: null, eraLabel: null, icon: "🎓", personRefs: [], createdAt: 6 }],
    ["ev-1965b", { title: "姉の入学", description: null, startDate: { value: "1965", precision: "year" }, endDate: null, eraLabel: null, icon: "🌸", personRefs: [], createdAt: 7 }],
    ["ev-1989", { title: "床屋開業", description: "商店街で開いた。", startDate: { value: "1989-04", precision: "month" }, endDate: null, eraLabel: null, icon: "🏡", personRefs: ["p-taro"], createdAt: 4 }],
    ["ev-era", { title: "子どもの頃の夏", description: null, startDate: null, endDate: null, eraLabel: "子どもの頃", icon: "🎋", personRefs: [], createdAt: 3 }],
    ["ev-none", { title: "いつの出来事か分からない", description: null, startDate: null, endDate: null, eraLabel: null, icon: "⛩", personRefs: [], createdAt: 2 }],
  ];
  for (const [id, data] of events) {
    await setDoc(doc(db, "families", FID, "events", id), {
      ...data,
      addedByUid: UID_FAMILY,
      updatedAt: data.createdAt,
    });
  }

  /* 写真（色違い PNG。ev-none にだけつなぐ写真＝時期不明写真の駅表示確認用） */
  const colors = [
    ["photo-01", [255, 127, 80], 5],
    ["photo-02", [65, 105, 225], 4],
    ["photo-03", [218, 112, 214], 3],
    ["photo-04", [46, 139, 87], 2],
    ["photo-05", [255, 215, 0], 1],
    ["photo-06", [112, 128, 144], 0],
  ];
  const familyToken = await getIdToken(FAMILY_EMAIL, PASSWORD);
  for (const [name, rgb, weight] of colors) {
    const storagePath = `families/${FID}/photos/${name}.png`;
    const downloadURL = await uploadPhoto(storagePath, makePng(320, 240, rgb), familyToken);
    await setDoc(doc(db, "families", FID, "photos", name), {
      storagePath,
      downloadURL,
      width: 320,
      height: 240,
      addedByUid: UID_FAMILY,
      addedByRole: "family",
      description: null,
      takenDate: null,
      personRefs: [],
      eventRefs: [],
      createdAt: Date.now() + weight,
      updatedAt: Date.now() + weight,
    });
  }

  /* 関連付け（links 正本 [1 階層・ID に種類と参照先を込める] + 弱参照配列） */
  const link = async (photoId, kind, refId) => {
    const photoRef = doc(db, "families", FID, "photos", photoId);
    await setDoc(doc(photoRef, "links", `${kind}_${refId}`), { kind, refId, createdAt: 1 });
    await setDoc(photoRef, {
      ...(kind === "person" ? { personRefs: [refId] } : { eventRefs: [refId] }),
      updatedAt: Date.now(),
    }, { merge: true });
  };
  await link("photo-01", "person", "p-hanako");
  await link("photo-01", "event", "ev-1972");
  await link("photo-02", "event", "ev-1972");
  await link("photo-03", "event", "ev-1965");
  await link("photo-04", "event", "ev-1989");
  await link("photo-05", "person", "p-taro");
  /* photo-05 は出来事なし（関連人物だけ）・photo-06 は何もつながっていない */
  /* ev-era に写真はつながっていない → 末尾区画は写真なしカードになる */

  await deleteApp(app);
});

process.stdout.write("シード完了: family@memoria.example / person@memoria.example（パスワード dev123456）\n");
await testEnv.cleanup();
