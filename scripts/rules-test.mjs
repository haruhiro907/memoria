/*
 * Firestore Security Rules の自動検証（Phase 3〜4 / エミュレータ用）
 *
 * 実行前提:
 *   $env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jre-21.0.13.9-hotspot"
 *   npm run emulators          （firestore が 127.0.0.1:8080 で起動していること）
 *   node scripts/rules-test.mjs
 *
 * 検証内容:
 *   A. photoReactions（photo_viewed）: action / method ホワイトリスト・uid 一致・
 *      自家族写真の実在・update/delete 全面拒否
 *   B. events v2: 精度付き日付の整合（value と precision の一致・endDate は
 *      startDate 前提で同精度・eraLabel は 30 文字まで）
 *   C. 家族分離 / role 区分（family 以外は events を作れない・他家族のデータは読めない）
 *   D. inviteCodes: クライアントからの読み書きを全面拒否（生成・消費は Cloud Functions のみ）
 *   E. 本人（person）ロールの編集拒否の残り（写真の更新・削除 / links / people / events 削除。
 *      写真の追加は本人もできることの確認を含む）
 *   F. Storage の家族分離（自家族の写真ファイルだけ読み書きできる。削除は家族ロールのみ）
 *
 *   ※ Storage（F）の検証には storage エミュレータ（127.0.0.1:9199）も起動しておくこと。
 */
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, deleteDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const PROJECT_ID = "demo-memoria";
const rules = fs.readFileSync("firestore.rules", "utf8");
const storageRules = fs.readFileSync("storage.rules", "utf8");

const FAM_A = "fam-a";
const FAM_B = "fam-b";
const UID_FAMILY = "uid-family-a";
const UID_PERSON = "uid-person-a";
const UID_FAMILY_B = "uid-family-b";

let testEnv;
let storageTestEnv;

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

/* ---------- シード ---------- */

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.fromDate(new Date());
    /* users */
    for (const [uid, fid] of [
      [UID_FAMILY, FAM_A],
      [UID_PERSON, FAM_A],
      [UID_FAMILY_B, FAM_B],
    ]) {
      await setDoc(doc(db, "users", uid), { uid, familyId: fid, displayName: "n" });
    }
    /* families + members */
    const fams = [
      [FAM_A, [
        [UID_FAMILY, "family"],
        [UID_PERSON, "person"],
      ]],
      [FAM_B, [[UID_FAMILY_B, "family"]]],
    ];
    for (const [fid, members] of fams) {
      await setDoc(doc(db, "families", fid), { createdByUid: members[0][0], name: "family" });
      for (const [uid, role] of members) {
        await setDoc(doc(db, "families", fid, "members", uid), { uid, role, displayName: "n" });
      }
    }
    /* photos: photo-1 は FAM_A にある。photo-999 は存在しない */
    await setDoc(doc(db, "families", FAM_A, "photos", "photo-1"), {
      storagePath: "fam-a/photo-1.jpg",
      downloadURL: "https://example.com/photo-1.jpg",
      width: null,
      height: null,
      addedByUid: UID_FAMILY,
      addedByRole: "family",
      description: null,
      takenDate: null,
      personRefs: [],
      eventRefs: [],
      createdAt: now,
      updatedAt: now,
    });
  });
}

/** 接続ロール別の db */
function dbFor(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

const reaction = (uid, method = "swipe") => ({
  uid,
  photoId: "photo-1",
  action: "photo_viewed",
  method,
  createdAt: serverTimestamp(),
});

/* テストごとに unique な記録 ID（同一 ID の二度書きは update 扱いになるため） */
let reactionSeq = 0;
const rid = (prefix = "r") => `${prefix}-${++reactionSeq}`;

/* ---------- A. photoReactions ---------- */

for (const method of ["initial", "swipe", "button", "direct"]) {
  test(`A1 本人の正しい photo_viewed を記録できる（method: ${method}・family）`, async () => {
    
    await assertSucceeds(
      setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), reaction(UID_FAMILY, method)),
    );
  });
  test(`A1 本人の正しい photo_viewed を記録できる（method: ${method}・person）`, async () => {
    
    await assertSucceeds(
      setDoc(doc(dbFor(UID_PERSON), "families", FAM_A, "photoReactions", rid()), reaction(UID_PERSON, method)),
    );
  });
}

test("A2 action を photo_viewed 以外にすると拒否される", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), {
      ...reaction(UID_FAMILY),
      action: "swipe_next",
    }),
  );
});

test("A3 method をホワイトリスト外にすると拒否される", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), {
      ...reaction(UID_FAMILY),
      method: "next",
    }),
  );
});

test("A4 家族セッションで本人 uid の記録を作るのは拒否される（uid != auth.uid）", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), reaction(UID_PERSON)),
  );
});

test("A5 存在しない写真の photoId は拒否される", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), {
      ...reaction(UID_FAMILY),
      photoId: "photo-999",
    }),
  );
});

test("A6 他家族のメンバーが記録するのは拒否される", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY_B), "families", FAM_A, "photoReactions", rid()), reaction(UID_FAMILY_B)),
  );
});

test("A7 記録の更新・削除は全面拒否される", async () => {
  
  const myId = rid();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "photoReactions", myId),
      { ...reaction(UID_FAMILY), createdAt: Timestamp.fromDate(new Date()) });
  });
  await assertFails(setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", myId), reaction(UID_FAMILY)));
  await assertFails(deleteDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", myId)));
});

test("A8 createdAt をクライアント時刻で偽装すると拒否される（serverTimestamp のみ許可）", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "photoReactions", rid()), {
      ...reaction(UID_FAMILY),
      createdAt: Timestamp.fromMillis(1700000000000),
    }),
  );
});

/* ---------- B. events v2 ---------- */

const evBase = {
  title: "出来事",
  description: null,
  startDate: null,
  endDate: null,
  eraLabel: null,
  icon: null,
  personRefs: [],
};

const evOk = (uid, id, patch) => assertSucceeds(setDoc(doc(dbFor(uid), "families", FAM_A, "events", id), { ...evBase, ...patch }));
const evFail = (uid, id, patch) => assertFails(setDoc(doc(dbFor(uid), "families", FAM_A, "events", id), { ...evBase, ...patch }));

test("B1 日精度の start／同精度の end で登録できる", async () => {
  await evOk(UID_FAMILY, "e-1", {
    startDate: { value: "2020-03-15", precision: "day" },
    endDate: { value: "2020-03-20", precision: "day" },
  });
});

test("B1 月・年精度も登録できる", async () => {
  await evOk(UID_FAMILY, "e-2", { startDate: { value: "2020-03", precision: "month" } });
  await evOk(UID_FAMILY, "e-3", { startDate: { value: "2020", precision: "year" } });
});

test("B1 eraLabel のみの出来事を登録できる", async () => {
  await evOk(UID_FAMILY, "e-4", { eraLabel: "子どもの頃" });
});

test("B2 value と precision が不一致なら拒否される", async () => {
  await evFail(UID_FAMILY, "e-10", { startDate: { value: "2020-03-15", precision: "month" } });
  await evFail(UID_FAMILY, "e-11", { startDate: { value: "2020-03", precision: "year" } });
});

test("B2 月の範囲外・桁まる抜けは拒否される", async () => {
  await evFail(UID_FAMILY, "e-12", { startDate: { value: "2020-13", precision: "month" } });
  await evFail(UID_FAMILY, "e-13", { startDate: { value: "2020-3", precision: "month" } });
});

test("B3 endDate のみ（startDate なし）は拒否される", async () => {
  await evFail(UID_FAMILY, "e-14", { endDate: { value: "2020-03-20", precision: "day" } });
});

test("B4 endDate の精度が startDate と違えば拒否される", async () => {
  await evFail(UID_FAMILY, "e-15", {
    startDate: { value: "2020-03", precision: "month" },
    endDate: { value: "2020-03-20", precision: "day" },
  });
});

test("B5 eraLabel が 31 文字なら拒否される", async () => {
  await evFail(UID_FAMILY, "e-16", { eraLabel: "あ".repeat(31) });
});

test("B6 本人（person ロール）は events を作れない", async () => {
  await evFail(UID_PERSON, "e-17", {});
  await evFail(UID_PERSON, "e-18", { startDate: { value: "2020-03-15", precision: "day" } });
});

/* ---------- C. 家族分離 ---------- */

test("C1 他家族のメンバーは events を作れない", async () => {
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY_B), "families", FAM_A, "events", "e-20"), { ...evBase }),
  );
});

test("C2 他家族のメンバーは photoReactions を読めない・書けない", async () => {
  
  const myId = rid();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "photoReactions", myId),
      { ...reaction(UID_FAMILY), createdAt: Timestamp.fromDate(new Date()) });
  });
  await assertFails(getDoc(doc(dbFor(UID_FAMILY_B), "families", FAM_A, "photoReactions", myId)));
  await assertFails(
    setDoc(doc(dbFor(UID_FAMILY_B), "families", FAM_A, "photoReactions", rid()), reaction(UID_FAMILY_B)),
  );
});

/* ---------- D. inviteCodes（Phase 4: クライアント全面拒否） ---------- */

test("D1 inviteCodes は家族ロールでも読み書きできない（Functions のみ）", async () => {
  const codeRef = (uid) => doc(dbFor(uid), "families", FAM_A, "inviteCodes", "123456");
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "inviteCodes", "123456"), {
      kind: "person",
      code: "123456",
      usedByUid: null,
      attempts: 0,
    });
  });
  await assertFails(getDoc(codeRef(UID_FAMILY)));
  await assertFails(setDoc(codeRef(UID_FAMILY), { kind: "person", code: "123456" }));
  await assertFails(deleteDoc(codeRef(UID_FAMILY)));
});

test("D2 inviteCodes は本人・他家族からも読めない", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "inviteCodes", "654321"), {
      kind: "person",
      code: "654321",
      usedByUid: null,
      attempts: 0,
    });
  });
  await assertFails(getDoc(doc(dbFor(UID_PERSON), "families", FAM_A, "inviteCodes", "654321")));
  await assertFails(getDoc(doc(dbFor(UID_FAMILY_B), "families", FAM_A, "inviteCodes", "654321")));
});

/* ---------- E. 本人ロールの編集拒否（§9 T2 の残り） ---------- */

test("E1 本人は写真を更新・削除できない（家族はできる）", async () => {
  const photoRef = (uid) => doc(dbFor(uid), "families", FAM_A, "photos", "photo-1");
  await assertFails(updateDoc(photoRef(UID_PERSON), { description: "本人による書き換え" }));
  await assertFails(deleteDoc(photoRef(UID_PERSON)));
  await assertSucceeds(updateDoc(photoRef(UID_FAMILY), { description: "家族による補完" }));
});

test("E2 本人は写真を追加できる（addedByUid が自分なら許可）", async () => {
  const ref = doc(dbFor(UID_PERSON), "families", FAM_A, "photos", "photo-by-person");
  await assertSucceeds(
    setDoc(ref, {
      storagePath: "families/fam-a/photos/photo-by-person.jpg",
      downloadURL: "https://example.com/photo-by-person.jpg",
      addedByUid: UID_PERSON,
    }),
  );
  /* 他人の addedByUid を名乗る追加は拒否 */
  const spoof = doc(dbFor(UID_PERSON), "families", FAM_A, "photos", "photo-spoof");
  await assertFails(
    setDoc(spoof, {
      storagePath: "families/fam-a/photos/photo-spoof.jpg",
      downloadURL: "https://example.com/photo-spoof.jpg",
      addedByUid: UID_FAMILY,
    }),
  );
});

test("E3 本人は links（関連付け）を作れない", async () => {
  const linkRef = (uid) => doc(dbFor(uid), "families", FAM_A, "photos", "photo-1", "links", "person_p1");
  await assertFails(setDoc(linkRef(UID_PERSON), { type: "person", targetId: "p1" }));
  await assertSucceeds(setDoc(linkRef(UID_FAMILY), { type: "person", targetId: "p1" }));
});

test("E4 本人は people を作成・更新・削除できない", async () => {
  const personRef = (uid) => doc(dbFor(uid), "families", FAM_A, "people", "person-1");
  await assertFails(setDoc(personRef(UID_PERSON), { name: "だれか" }));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "people", "person-1"), { name: "家族の人" });
  });
  await assertFails(updateDoc(personRef(UID_PERSON), { name: "書き換え" }));
  await assertFails(deleteDoc(personRef(UID_PERSON)));
});

test("E5 本人は events を削除できない（作成は B6 で確認済み）", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "families", FAM_A, "events", "event-1"), { ...evBase });
  });
  await assertFails(deleteDoc(doc(dbFor(UID_PERSON), "families", FAM_A, "events", "event-1")));
  await assertSucceeds(deleteDoc(doc(dbFor(UID_FAMILY), "families", FAM_A, "events", "event-1")));
});

/* ---------- F. Storage の家族分離（§9 T3 の Storage 側） ---------- */

const storageFor = (uid) =>
  uid
    ? storageTestEnv.authenticatedContext(uid).storage()
    : storageTestEnv.unauthenticatedContext().storage();

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("F1 家族メンバーは自家族の写真ファイルを読み書きできる", async () => {
  await storageTestEnv.clearStorage();
  const path = `families/${FAM_A}/photos/f1.png`;
  await assertSucceeds(uploadBytes(storageRef(storageFor(UID_FAMILY), path), PNG_BYTES));
  await assertSucceeds(getBytes(storageRef(storageFor(UID_PERSON), path)));
});

test("F2 他家族のユーザーは読み書きできない", async () => {
  await storageTestEnv.clearStorage();
  const path = `families/${FAM_A}/photos/f2.png`;
  await storageTestEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(storageRef(ctx.storage(), path), PNG_BYTES);
  });
  await assertFails(getBytes(storageRef(storageFor(UID_FAMILY_B), path)));
  await assertFails(uploadBytes(storageRef(storageFor(UID_FAMILY_B), path), PNG_BYTES));
});

test("F3 本人は追加できるが削除はできない（削除は家族のみ）", async () => {
  await storageTestEnv.clearStorage();
  const path = `families/${FAM_A}/photos/f3.png`;
  await assertSucceeds(uploadBytes(storageRef(storageFor(UID_PERSON), path), PNG_BYTES));
  await assertFails(deleteObject(storageRef(storageFor(UID_PERSON), path)));
  await assertSucceeds(deleteObject(storageRef(storageFor(UID_FAMILY), path)));
});

test("F4 未ログインでは読めない", async () => {
  await storageTestEnv.clearStorage();
  const path = `families/${FAM_A}/photos/f4.png`;
  await storageTestEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(storageRef(ctx.storage(), path), PNG_BYTES);
  });
  await assertFails(getBytes(storageRef(storageFor(null), path)));
});

/* ---------- runner ---------- */

testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules, host: "127.0.0.1", port: 8080 },
});

storageTestEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  storage: { rules: storageRules, host: "127.0.0.1", port: 9199 },
});

let passed = 0;
const failures = [];

for (const [name, fn] of tests) {
  try {
    await testEnv.clearFirestore();
    await seed();
    await fn();
    passed += 1;
    process.stdout.write(`ok    ${name}\n`);
  } catch (err) {
    failures.push([name, err]);
    process.stdout.write(`FAIL  ${name}\n    ${err?.message?.split("\n")[0] ?? err}\n`);
  }
}

process.stdout.write(`\n${passed}/${tests.length} 件が Rules どおりに動きました。\n`);

try {
  await testEnv.cleanup();
  await storageTestEnv.cleanup();
} catch {
  /* クリーンアップの失敗は結果に影響させない */
}

if (failures.length > 0) process.exit(1);
