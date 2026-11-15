/*
 * デモ用シード（エミュレータ専用）
 *
 *   node scripts/seed-dev.mjs
 *   （firestore / storage / auth エミュレータが起動している前提）
 *
 * 投入するもの（「サンプル家」の一生分のデモデータ）:
 *   - Auth ユーザー 2 名（家族用 / 本人用・エミュレータ REST で作成）
 *     family@memoria.example / person@memoria.example ともパスワード dev123456
 *   - families/fam-dev + members（family ロール / person ロール）
 *   - people 4 名（はな子・たろう・ゆき・さくら）
 *   - events 9 件（1965〜2015 + eraLabel のみ + 時期なし）
 *   - photos 14 件（風景イラスト風の PNG を生成して Storage エミュレータへ）
 *     説明・撮影日つき。1 枚は「今日」撮影で、ホームの「今日の思い出」に出る
 *   - 写真 ⇔ 人物 / 出来事の関連（links + 弱参照配列）
 *   - photoReactions（本人の表示記録。ふりかえり画面のデモ用。家族分は集計対象外の確認も兼ねる）
 *
 * 再実行すると同じ ID で上書きされる（冪等）。
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

/* ---------- 小さな風景イラスト PNG を作る（最小限の PNG エンコーダ＋簡易ペインタ） ---------- */

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

function encodePng(w, h, px) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0;
    raw.set(px.subarray(y * w * 3, (y + 1) * w * 3), row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* 決定的乱数（同じシードなら同じ絵になる） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function createCanvas(w, h) {
  const px = new Uint8Array(w * h * 3);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  const cv = {
    w,
    h,
    px,
    set,
    vgrad(top, bottom) {
      for (let y = 0; y < h; y++) {
        const c = mix(top, bottom, y / (h - 1));
        for (let x = 0; x < w; x++) set(x, y, c);
      }
    },
    circle(cx, cy, r, color) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, color);
    },
    ellipse(cx, cy, rx, ry, color) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, color);
    },
    rect(x0, y0, rw, rh, color) {
      for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) set(x, y, color);
    },
    tri(x0, y0, x1, y1, x2, y2, color) {
      const minX = Math.floor(Math.min(x0, x1, x2));
      const maxX = Math.ceil(Math.max(x0, x1, x2));
      const minY = Math.floor(Math.min(y0, y1, y2));
      const maxY = Math.ceil(Math.max(y0, y1, y2));
      const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const w0 = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / area;
          const w1 = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) set(x, y, color);
        }
    },
    /* 丘陵: baseY を中心にサイン波でうねる地面を下側いっぱいに塗る */
    hill(baseY, amp, phase, color) {
      for (let x = 0; x < w; x++) {
        const yTop = Math.round(baseY + Math.sin(x / 61 + phase) * amp + Math.sin(x / 23 + phase * 2) * amp * 0.35);
        for (let y = Math.max(0, yTop); y < h; y++) set(x, y, color);
      }
    },
    /* 海: y0 から下を横縞で塗る */
    sea(y0, colors) {
      for (let y = y0; y < h; y++) {
        const c = colors[Math.min(colors.length - 1, Math.floor(((y - y0) / (h - y0)) * colors.length))];
        for (let x = 0; x < w; x++) set(x, y, c);
      }
    },
    dots(n, x0, y0, x1, y1, r, colors, rand) {
      for (let i = 0; i < n; i++) {
        const cx = Math.floor(x0 + rand() * (x1 - x0));
        const cy = Math.floor(y0 + rand() * (y1 - y0));
        cv.circle(cx, cy, r, colors[Math.floor(rand() * colors.length)]);
      }
    },
    toPng() {
      return encodePng(w, h, px);
    },
  };
  return cv;
}

const W = 640;
const H = 480;

/* 風景シーン 14 種（フラットなイラスト調） */
const scenes = {
  sunsetSea() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 166, 88], [255, 214, 150]);
    cv.circle(320, 300, 62, [255, 236, 170]);
    cv.circle(320, 300, 46, [255, 244, 200]);
    cv.sea(310, [[238, 140, 90], [214, 110, 84], [170, 90, 96], [128, 78, 102]]);
    return cv.toPng();
  },
  summerSky() {
    const cv = createCanvas(W, H);
    cv.vgrad([96, 165, 250], [196, 228, 255]);
    cv.circle(90, 84, 40, [255, 240, 160]);
    const rand = mulberry32(7);
    for (let i = 0; i < 5; i++) {
      const cx = 120 + rand() * 420;
      const cy = 70 + rand() * 110;
      cv.ellipse(cx, cy, 58, 20, [255, 255, 255]);
      cv.ellipse(cx + 34, cy + 6, 44, 16, [255, 255, 255]);
    }
    cv.hill(356, 16, 1.2, [110, 190, 110]);
    cv.hill(404, 12, 4.1, [74, 160, 84]);
    return cv.toPng();
  },
  sakura() {
    const cv = createCanvas(W, H);
    cv.vgrad([253, 231, 238], [255, 246, 240]);
    cv.rect(306, 250, 26, 190, [110, 82, 66]);
    cv.circle(320, 190, 118, [248, 187, 208]);
    cv.circle(238, 226, 72, [250, 205, 222]);
    cv.circle(404, 226, 72, [250, 205, 222]);
    cv.hill(420, 8, 2.2, [168, 208, 148]);
    const rand = mulberry32(21);
    cv.dots(90, 20, 120, 620, 440, 4, [[249, 168, 200], [252, 205, 226], [255, 255, 255]], rand);
    return cv.toPng();
  },
  riverMountains() {
    const cv = createCanvas(W, H);
    cv.vgrad([168, 216, 240], [232, 246, 255]);
    cv.tri(40, 330, 220, 120, 400, 330, [96, 158, 110]);
    cv.tri(240, 330, 430, 90, 620, 330, [74, 138, 96]);
    cv.tri(398, 138, 430, 90, 462, 138, [255, 255, 255]);
    cv.hill(330, 10, 0.6, [88, 168, 100]);
    cv.rect(0, 396, W, 84, [120, 200, 220]);
    cv.hill(430, 6, 3.3, [70, 150, 92]);
    return cv.toPng();
  },
  wedding() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 243, 224], [255, 251, 240]);
    cv.circle(540, 90, 38, [255, 226, 140]);
    cv.hill(392, 8, 1.8, [176, 214, 156]);
    /* 教会 */
    cv.rect(250, 220, 140, 170, [255, 255, 255]);
    cv.tri(236, 222, 320, 150, 404, 222, [214, 118, 90]);
    cv.rect(306, 130, 28, 70, [255, 255, 255]);
    cv.tri(298, 132, 320, 96, 342, 132, [214, 118, 90]);
    cv.rect(312, 286, 26, 104, [150, 104, 74]);
    cv.circle(320, 252, 16, [168, 205, 235]);
    const rand = mulberry32(5);
    cv.dots(46, 30, 380, 610, 452, 5, [[244, 114, 182], [251, 207, 232], [255, 255, 255]], rand);
    return cv.toPng();
  },
  shopHouse() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 214, 160], [255, 240, 214]);
    cv.circle(96, 88, 36, [255, 232, 150]);
    cv.rect(0, 398, W, 82, [196, 164, 132]);
    /* 店 */
    cv.rect(190, 208, 260, 190, [250, 240, 222]);
    cv.tri(172, 210, 320, 128, 468, 210, [164, 96, 70]);
    cv.rect(190, 262, 260, 34, [206, 84, 74]);
    for (let x = 190; x < 450; x += 36) cv.rect(x, 262, 18, 34, [250, 240, 222]);
    cv.rect(226, 316, 76, 82, [120, 88, 60]);
    cv.rect(330, 312, 88, 52, [186, 220, 238]);
    return cv.toPng();
  },
  babyRoom() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 226, 188], [255, 240, 222]);
    cv.circle(320, 196, 108, [255, 248, 226]);
    cv.circle(320, 196, 84, [255, 236, 190]);
    const rand = mulberry32(11);
    cv.dots(60, 30, 40, 610, 400, 4, [[250, 190, 120], [244, 150, 160], [170, 205, 235]], rand);
    cv.hill(398, 8, 0.9, [238, 196, 160]);
    /* ゆりかご */
    cv.ellipse(320, 386, 120, 30, [196, 140, 100]);
    cv.rect(216, 356, 208, 26, [214, 160, 116]);
    cv.circle(268, 344, 20, [255, 220, 200]);
    return cv.toPng();
  },
  kyotoTower() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 205, 150], [255, 236, 200]);
    cv.hill(330, 14, 2.6, [214, 120, 70]);
    cv.hill(392, 12, 5.2, [178, 84, 60]);
    /* 五重塔 */
    const cx = 320;
    cv.rect(cx - 12, 150, 24, 220, [96, 62, 48]);
    const roofs = [196, 238, 280, 322];
    roofs.forEach((y, i) => {
      const rw = 150 - i * 18;
      cv.tri(cx - rw / 2, y, cx, y - 30, cx + rw / 2, y, [70, 48, 40]);
      cv.rect(cx - rw / 2 + 22, y, rw - 44, 34, [120, 78, 58]);
    });
    cv.rect(cx - 3, 96, 6, 30, [70, 48, 40]);
    cv.circle(cx, 88, 6, [240, 200, 110]);
    return cv.toPng();
  },
  summerRiver() {
    const cv = createCanvas(W, H);
    cv.vgrad([80, 155, 235], [190, 226, 250]);
    cv.circle(560, 76, 38, [255, 240, 160]);
    cv.hill(300, 12, 1.4, [96, 178, 104]);
    cv.rect(0, 330, W, 150, [110, 198, 222]);
    cv.hill(348, 8, 4.4, [64, 148, 84]);
    cv.hill(436, 8, 2.9, [52, 132, 74]);
    const rand = mulberry32(31);
    cv.dots(26, 20, 336, 620, 420, 3, [[255, 255, 255], [210, 240, 255]], rand);
    return cv.toPng();
  },
  snowMountain() {
    const cv = createCanvas(W, H);
    cv.vgrad([206, 226, 244], [244, 249, 255]);
    cv.tri(90, 400, 320, 96, 550, 400, [148, 178, 205]);
    cv.tri(252, 178, 320, 96, 388, 178, [255, 255, 255]);
    cv.tri(286, 142, 320, 96, 330, 150, [255, 255, 255]);
    cv.hill(398, 8, 1.1, [232, 242, 250]);
    const rand = mulberry32(41);
    cv.dots(120, 10, 20, 630, 460, 3, [[255, 255, 255]], rand);
    return cv.toPng();
  },
  gardenFlowers() {
    const cv = createCanvas(W, H);
    cv.vgrad([140, 200, 248], [214, 240, 255]);
    cv.circle(84, 80, 36, [255, 240, 160]);
    cv.hill(268, 12, 2.0, [120, 196, 116]);
    cv.hill(330, 10, 4.8, [88, 172, 92]);
    const rand = mulberry32(51);
    cv.dots(240, 16, 336, 624, 466, 5, [[244, 114, 140], [250, 204, 60], [255, 255, 255], [186, 140, 240]], rand);
    return cv.toPng();
  },
  birthdayCake() {
    const cv = createCanvas(W, H);
    cv.vgrad([255, 228, 200], [255, 244, 228]);
    const rand = mulberry32(61);
    cv.dots(50, 20, 30, 620, 180, 4, [[244, 150, 170], [150, 200, 240], [250, 210, 110]], rand);
    cv.rect(0, 404, W, 76, [226, 188, 150]);
    /* ケーキ */
    cv.rect(200, 330, 240, 74, [255, 250, 244]);
    cv.rect(200, 330, 240, 18, [244, 150, 170]);
    cv.rect(232, 262, 176, 68, [255, 250, 244]);
    cv.rect(232, 262, 176, 16, [150, 200, 240]);
    for (const x of [262, 320, 378]) {
      cv.rect(x - 4, 216, 8, 46, [255, 236, 170]);
      cv.circle(x, 204, 10, [255, 176, 84]);
      cv.circle(x, 200, 5, [255, 226, 130]);
    }
    return cv.toPng();
  },
  morningSea() {
    const cv = createCanvas(W, H);
    cv.vgrad([190, 220, 245], [255, 238, 205]);
    cv.circle(320, 292, 44, [255, 224, 150]);
    cv.sea(300, [[170, 200, 228], [150, 184, 220], [128, 164, 208], [110, 146, 196]]);
    return cv.toPng();
  },
  fieldSunset() {
    const cv = createCanvas(W, H);
    cv.vgrad([250, 168, 100], [255, 220, 160]);
    cv.circle(480, 210, 48, [255, 232, 160]);
    cv.hill(300, 12, 1.7, [214, 150, 84]);
    cv.hill(362, 10, 3.9, [178, 118, 66]);
    cv.hill(424, 8, 5.6, [140, 92, 54]);
    return cv.toPng();
  },
};

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
  const member = (uid, role, name) => ({
    uid,
    role,
    displayName: name,
    email: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await setDoc(doc(db, "families", FID), { createdByUid: UID_FAMILY, name: "サンプル家" });
  await setDoc(doc(db, "families", FID, "members", UID_FAMILY), member(UID_FAMILY, "family", "みんな"));
  await setDoc(doc(db, "families", FID, "members", UID_PERSON), member(UID_PERSON, "person", "はな子"));
  await setDoc(doc(db, "users", UID_FAMILY), { uid: UID_FAMILY, familyId: FID, createdAt: Date.now() });
  await setDoc(doc(db, "users", UID_PERSON), { uid: UID_PERSON, familyId: FID, createdAt: Date.now() });

  /* 人物 4 名 */
  const people = [
    ["p-hanako", { name: "はな子", photoURL: null, birthday: "1963-04-08", note: "写真が好き。海の写真をよく見ている。", createdAt: 1000 }],
    ["p-taro", { name: "たろう", photoURL: null, birthday: "1960-11-23", note: "商店街で床屋を営んでいた。", createdAt: 900 }],
    ["p-yuki", { name: "ゆき", photoURL: null, birthday: "1998-06-12", note: "はな子とたろうの娘。", createdAt: 800 }],
    ["p-sakura", { name: "さくら", photoURL: null, birthday: "2018-03-25", note: "ゆきの娘。おばあちゃん子。", createdAt: 700 }],
  ];
  for (const [id, data] of people) {
    await setDoc(doc(db, "families", FID, "people", id), {
      ...data,
      addedByUid: UID_FAMILY,
      updatedAt: data.createdAt,
    });
  }

  /* 出来事 9 件（年代を分散させ、人生の地図に複数の年ブロックと末尾区画が出るように） */
  const events = [
    ["ev-1965", { title: "運動会", description: "小学校の運動会。かけっこで転んだけれど、最後まで走った。", startDate: { value: "1965", precision: "year" }, endDate: null, eraLabel: null, icon: "🎓", personRefs: ["p-hanako"], createdAt: 6 }],
    ["ev-1965b", { title: "姉の入学", description: null, startDate: { value: "1965", precision: "year" }, endDate: null, eraLabel: null, icon: "🌸", personRefs: [], createdAt: 7 }],
    ["ev-1972", { title: "初めての海旅行", description: "家族で初めて行った海。夕日がきれいだった。", startDate: { value: "1972-08-01", precision: "day" }, endDate: null, eraLabel: null, icon: "🌊", personRefs: ["p-hanako"], createdAt: 5 }],
    ["ev-1985", { title: "結婚式", description: "小さな教会で式を挙げた。", startDate: { value: "1985-04", precision: "month" }, endDate: null, eraLabel: null, icon: "💍", personRefs: ["p-hanako", "p-taro"], createdAt: 4 }],
    ["ev-1989", { title: "床屋開業", description: "商店街に自分の店を開いた。", startDate: { value: "1989-04", precision: "month" }, endDate: null, eraLabel: null, icon: "🏡", personRefs: ["p-taro"], createdAt: 3 }],
    ["ev-1998", { title: "ゆきの誕生", description: null, startDate: { value: "1998", precision: "year" }, endDate: null, eraLabel: null, icon: "👶", personRefs: ["p-yuki"], createdAt: 2 }],
    ["ev-2015", { title: "家族旅行・京都", description: "三世代で京都へ。紅葉が見事だった。", startDate: { value: "2015-05", precision: "month" }, endDate: null, eraLabel: null, icon: "⛩", personRefs: ["p-hanako", "p-taro", "p-yuki"], createdAt: 1 }],
    ["ev-era", { title: "子どもの頃の夏", description: "川で遊んだ夏休み。", startDate: null, endDate: null, eraLabel: "子どもの頃", icon: "🎋", personRefs: [], createdAt: 8 }],
    ["ev-none", { title: "いつの出来事か分からない", description: null, startDate: null, endDate: null, eraLabel: null, icon: "❓", personRefs: [], createdAt: 9 }],
  ];
  for (const [id, data] of events) {
    await setDoc(doc(db, "families", FID, "events", id), {
      ...data,
      addedByUid: UID_FAMILY,
      updatedAt: data.createdAt,
    });
  }

  /* 写真 14 件（説明・撮影日・関連付けつき。weight が大きいほど新しい） */
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const photos = [
    ["photo-01", "sunsetSea", "海の夕日。初めての旅行で見た景色。", "1972-08-01", ["p-hanako"], ["ev-1972"], 5],
    ["photo-02", "summerSky", "運動会の日の青空。", null, ["p-hanako"], ["ev-1965"], 4],
    ["photo-03", "sakura", "入学式の桜。姉のランドセルが新しかった。", null, [], ["ev-1965b"], 3],
    ["photo-04", "riverMountains", "旅行の途中で見た山と川。", "1972-08-02", ["p-hanako", "p-taro"], ["ev-1972"], 2],
    ["photo-05", "wedding", "結婚式の教会。緊張したけれど、いい日だった。", "1985-04-14", ["p-hanako", "p-taro"], ["ev-1985"], 6],
    ["photo-06", "shopHouse", "開業したばかりの床屋。看板が自慢だった。", "1989-04-03", ["p-taro"], ["ev-1989"], 1],
    ["photo-07", "babyRoom", "ゆきが生まれた頃の部屋。", null, ["p-yuki"], ["ev-1998"], 7],
    ["photo-08", "kyotoTower", "京都の塔。家族みんなで行った。", "2015-05-04", ["p-hanako", "p-taro", "p-yuki"], ["ev-2015"], 8],
    ["photo-09", "summerRiver", "子どもの頃、夏になるといつも遊んだ川。", null, [], ["ev-era"], 0],
    ["photo-10", "snowMountain", "雪の山。いつの写真かは分からない。", null, [], ["ev-none"], 9],
    ["photo-11", "gardenFlowers", "庭の花畑。今朝、さくらといっしょに見た。", todayStr, ["p-hanako", "p-sakura"], [], 13],
    ["photo-12", "birthdayCake", "はな子の誕生日のケーキ。", "2024-04-08", ["p-hanako", "p-yuki", "p-sakura"], [], 11],
    ["photo-13", "morningSea", "朝の海。たろうが好きな景色。", null, ["p-taro"], [], 10],
    ["photo-14", "fieldSunset", "畑の夕焼け。まだ整理できていない写真。", null, [], [], 12],
  ];
  const familyToken = await getIdToken(FAMILY_EMAIL, PASSWORD);
  for (const [name, scene, description, takenDate, personRefs, eventRefs, weight] of photos) {
    const storagePath = `families/${FID}/photos/${name}.png`;
    const downloadURL = await uploadPhoto(storagePath, scenes[scene](), familyToken);
    await setDoc(doc(db, "families", FID, "photos", name), {
      storagePath,
      downloadURL,
      width: W,
      height: H,
      addedByUid: UID_FAMILY,
      addedByRole: "family",
      description,
      takenDate,
      personRefs,
      eventRefs,
      createdAt: Date.now() + weight * 1000,
      updatedAt: Date.now() + weight * 1000,
    });
    /* links 正本 */
    for (const pid of personRefs) {
      await setDoc(doc(db, "families", FID, "photos", name, "links", `person_${pid}`), {
        kind: "person",
        refId: pid,
        createdAt: 1,
      });
    }
    for (const eid of eventRefs) {
      await setDoc(doc(db, "families", FID, "photos", name, "links", `event_${eid}`), {
        kind: "event",
        refId: eid,
        createdAt: 1,
      });
    }
  }

  /* 本人の表示記録（ふりかえりのデモ）: 海の夕日をよく見ている、という偏りを持たせる */
  const HOUR = 3600_000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const reactions = [];
  const addViews = (photoId, count, method, newestAgo, span) => {
    for (let i = 0; i < count; i++) {
      reactions.push({ uid: UID_PERSON, photoId, method, createdAt: now - newestAgo - Math.floor((span * i) / Math.max(1, count)) });
    }
  };
  addViews("photo-01", 9, "swipe", 2 * HOUR, 6 * DAY);
  addViews("photo-11", 6, "initial", 1 * HOUR, 3 * DAY);
  addViews("photo-03", 5, "swipe", 5 * HOUR, 5 * DAY);
  addViews("photo-08", 4, "button", 1 * DAY, 4 * DAY);
  addViews("photo-05", 3, "swipe", 2 * DAY, 3 * DAY);
  addViews("photo-13", 2, "direct", 3 * DAY, 1 * DAY);
  addViews("photo-02", 1, "initial", 4 * DAY, 0);
  /* 家族の閲覧は「本人のふりかえり」に混ざらないことの確認用 */
  reactions.push({ uid: UID_FAMILY, photoId: "photo-01", method: "direct", createdAt: now - 30 * 60_000 });
  reactions.push({ uid: UID_FAMILY, photoId: "photo-01", method: "direct", createdAt: now - 20 * 60_000 });
  reactions.push({ uid: UID_FAMILY, photoId: "photo-01", method: "direct", createdAt: now - 10 * 60_000 });

  let rx = 0;
  for (const r of reactions) {
    rx += 1;
    await setDoc(doc(db, "families", FID, "photoReactions", `rx-${String(rx).padStart(3, "0")}`), {
      uid: r.uid,
      photoId: r.photoId,
      action: "photo_viewed",
      method: r.method,
      createdAt: r.createdAt,
    });
  }

  await deleteApp(app);
});

process.stdout.write("デモシード完了: family@memoria.example / person@memoria.example（パスワード dev123456）\n");
await testEnv.cleanup();
