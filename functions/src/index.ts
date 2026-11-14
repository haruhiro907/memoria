/**
 * Memoria Cloud Functions（docs/phase4-spec.md §7）
 *
 * 本人アカウントの発行・参加・復旧は「信頼できるサーバー側」でのみ行う。
 * クライアントは Security Rules で inviteCodes 等に一切触れない（Admin SDK が操作する）。
 *
 * エラーは HttpsError の message に機械可読キー（例: "person-exists"）を入れて返す。
 * クライアント（src/lib/functions/personAccounts.ts）がキーから案内文へ変換する。
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const auth = getAuth();

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const JOIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_JOIN_FAILURES = 5;

/* ---------------- 共通ヘルパー ---------------- */

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "signin-required");
  return uid;
}

/** 呼び出し元の所属家族 ID（未参加なら null） */
async function callerFamilyId(uid: string): Promise<string | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const fid = snap.get("familyId") as string | null | undefined;
  return fid ?? null;
}

/** family ロールであることを確認し、家族 ID を返す */
async function requireFamilyRole(uid: string): Promise<string> {
  const fid = await callerFamilyId(uid);
  if (!fid) throw new HttpsError("failed-precondition", "no-family");
  const member = await db.doc(`families/${fid}/members/${uid}`).get();
  if (!member.exists || member.get("role") !== "family") {
    throw new HttpsError("permission-denied", "family-role-required");
  }
  return fid;
}

/** 自家族の person メンバーの uid（いなければ null） */
async function findPersonMemberUid(fid: string): Promise<string | null> {
  const q = await db
    .collection(`families/${fid}/members`)
    .where("role", "==", "person")
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

const BLOCKED_TLDS = new Set(["local", "invalid", "test", "example", "localhost", "internal", "lan", "home"]);

/** 実在可能なメール形式か（RFC 的に妥当で、架空ドメインでないこと） */
function isPlausibleEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const e = email.trim();
  if (e.length < 3 || e.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const domain = e.split("@")[1].toLowerCase();
  const tld = domain.split(".").pop() ?? "";
  return !BLOCKED_TLDS.has(tld);
}

function validDisplayName(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 30;
}

/* ---------------- createPersonAccount ---------------- */

/**
 * 本人アカウントの発行（family ロール限定）。
 * Admin SDK で Auth ユーザーを作り、15 分有効の参加コードを発行する。
 * 呼び出し元（家族）のセッションは保持される（Admin SDK は別経路）。
 */
export const createPersonAccount = onCall(async (request) => {
  const callerUid = requireUid(request);
  const fid = await requireFamilyRole(callerUid);

  const { email, password, displayName } = (request.data ?? {}) as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
  };
  if (!isPlausibleEmail(email)) throw new HttpsError("invalid-argument", "invalid-email");
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpsError("invalid-argument", "weak-password");
  }
  if (!validDisplayName(displayName)) {
    throw new HttpsError("invalid-argument", "invalid-display-name");
  }
  const name = (displayName as string).trim();

  /* 同一家族の person メンバーは最大 1 名（再発行は既存を削除してから） */
  if ((await findPersonMemberUid(fid)) !== null) {
    throw new HttpsError("failed-precondition", "person-exists");
  }

  let newUid: string;
  try {
    const user = await auth.createUser({ email, password, displayName: name });
    newUid = user.uid;
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "email-in-use");
    if (code === "auth/invalid-email") throw new HttpsError("invalid-argument", "invalid-email");
    if (code === "auth/invalid-password") throw new HttpsError("invalid-argument", "weak-password");
    throw new HttpsError("internal", "create-failed");
  }

  /* 本人アカウントの users ドキュメント（未参加状態） */
  await db.doc(`users/${newUid}`).set({
    uid: newUid,
    familyId: null,
    createdAt: Date.now(),
  });

  /* 参加コード（6 桁・15 分・未使用のものと衝突しない） */
  const now = Date.now();
  const expiresAtMs = now + CODE_TTL_MS;
  let code: string | null = null;
  for (let i = 0; i < 10 && code === null; i++) {
    const candidate = String(100000 + Math.floor(Math.random() * 900000));
    const clash = await db.collectionGroup("inviteCodes").where("code", "==", candidate).get();
    const active = clash.docs.some((d) => {
      const usedBy = d.get("usedByUid") as string | null;
      const exp = d.get("expiresAt") as Timestamp | undefined;
      return usedBy == null && exp !== undefined && exp.toMillis() > now;
    });
    if (!active) code = candidate;
  }
  if (code === null) throw new HttpsError("internal", "code-generation-failed");

  await db.doc(`families/${fid}/inviteCodes/${code}`).set({
    kind: "person",
    code,
    personUid: newUid,
    displayName: name,
    /* 本人の登録メール。参加時に members へ引き継ぎ、設定画面で現アドレスを表示する */
    email: (email as string).trim(),
    createdByUid: callerUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    usedByUid: null,
    usedAt: null,
    attempts: 0,
  });

  return { uid: newUid, code, expiresAt: expiresAtMs };
});

/* ---------------- joinFamilyWithCode ---------------- */

async function readJoinFailures(uid: string): Promise<{ count: number; windowStartMs: number }> {
  const snap = await db.doc(`joinAttempts/${uid}`).get();
  if (!snap.exists) return { count: 0, windowStartMs: 0 };
  return {
    count: (snap.get("count") as number | undefined) ?? 0,
    windowStartMs: (snap.get("windowStartMs") as number | undefined) ?? 0,
  };
}

async function recordJoinFailure(uid: string): Promise<void> {
  const now = Date.now();
  const cur = await readJoinFailures(uid);
  if (now - cur.windowStartMs > JOIN_WINDOW_MS) {
    await db.doc(`joinAttempts/${uid}`).set({ count: 1, windowStartMs: now, updatedAt: now });
  } else {
    await db.doc(`joinAttempts/${uid}`).set({
      count: cur.count + 1,
      windowStartMs: cur.windowStartMs,
      updatedAt: now,
    });
  }
}

/**
 * 参加コードによる家族参加（本人アカウント本人のみ）。
 * コードの検証・消費、members(person) 作成、users.familyId 更新を
 * 1 つのトランザクションで行い、二重使用を構造的に不可能にする。
 */
export const joinFamilyWithCode = onCall(async (request) => {
  const uid = requireUid(request);
  const { code } = (request.data ?? {}) as { code?: unknown };
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "invalid-code");
  }

  /* レート制限: 同一 uid の 15 分あたり 5 失敗で一時ブロック */
  const failures = await readJoinFailures(uid);
  if (Date.now() - failures.windowStartMs <= JOIN_WINDOW_MS && failures.count >= MAX_JOIN_FAILURES) {
    throw new HttpsError("resource-exhausted", "rate-limited");
  }

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentFamily = userSnap.exists ? ((userSnap.get("familyId") as string | null) ?? null) : null;
  if (currentFamily) throw new HttpsError("failed-precondition", "already-joined");

  /* コードの所在（家族）をコード値から引く。
     発行対象（personUid）が本人のコードを優先し、なければ有効なコード 1 件に限る
     （§1.3 のコードドキュメントはアカウントを固定しない設計。有効期限・
       未使用・試行回数の検証は下のトランザクションで原子的に行う） */
  const found = await db.collectionGroup("inviteCodes").where("code", "==", code).limit(10).get();
  const nowMs = Date.now();
  const active = found.docs.filter((d) => {
    const usedBy = d.get("usedByUid") as string | null;
    const exp = d.get("expiresAt") as Timestamp | undefined;
    return usedBy == null && exp !== undefined && exp.toMillis() > nowMs;
  });
  const target = active.find((d) => d.get("personUid") === uid) ?? (active.length === 1 ? active[0] : undefined);
  if (!target) {
    await recordJoinFailure(uid);
    throw new HttpsError("invalid-argument", "invalid-code");
  }
  const codeRef = target.ref;
  const fid = codeRef.parent.parent?.id;
  if (!fid) throw new HttpsError("internal", "code-family-missing");
  const memberRef = db.doc(`families/${fid}/members/${uid}`);

  type JoinStatus = "ok" | "used" | "expired" | "locked" | "already-joined";
  const status = await db.runTransaction<JoinStatus>(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    const userInTx = await tx.get(userRef);
    if (!codeSnap.exists) return "used";
    /* すでに家族に参加済みなら、コードの状態とは切り分けて伝える */
    if (((userInTx.get("familyId") as string | null) ?? null) !== null) return "already-joined";
    const usedBy = codeSnap.get("usedByUid") as string | null;
    const attempts = (codeSnap.get("attempts") as number | undefined) ?? 0;
    const exp = codeSnap.get("expiresAt") as Timestamp | undefined;
    if (usedBy != null) {
      /* 失敗した検証はコード側の attempts にも数える（§1.3: 5 回失敗で無効化） */
      tx.update(codeRef, { attempts: attempts + 1 });
      return "used";
    }
    if (attempts >= MAX_CODE_ATTEMPTS) {
      return "locked";
    }
    if (exp === undefined || exp.toMillis() <= Date.now()) {
      tx.update(codeRef, { attempts: attempts + 1 });
      return "expired";
    }
    tx.update(codeRef, { usedByUid: uid, usedAt: FieldValue.serverTimestamp() });
    tx.set(memberRef, {
      uid,
      displayName:
        (codeSnap.get("displayName") as string | undefined) ?? "本人",
      /* 発行時の登録メールを引き継ぐ（設定画面の現アドレス表示・復旧用） */
      email: (codeSnap.get("email") as string | undefined) ?? null,
      role: "person",
      issuedByUid: (codeSnap.get("createdByUid") as string | undefined) ?? null,
      createdAt: Date.now(),
    });
    tx.update(userRef, { familyId: fid });
    return "ok";
  });

  if (status !== "ok") {
    if (status === "already-joined") {
      throw new HttpsError("failed-precondition", "already-joined");
    }
    await recordJoinFailure(uid);
    if (status === "used") throw new HttpsError("failed-precondition", "code-used");
    if (status === "expired") throw new HttpsError("failed-precondition", "code-expired");
    throw new HttpsError("failed-precondition", "code-locked");
  }

  /* 成功したら失敗カウントをリセット */
  await db.doc(`joinAttempts/${uid}`).delete().catch(() => undefined);
  return { familyId: fid };
});

/* ---------------- sendPersonPasswordReset ---------------- */

/**
 * 本人アカウントのパスワード再設定の前段確認（family ロール限定）。
 * 入力メールが自家族 person メンバーの登録メールと一致することを確認し、
 * 確認済みメールを返す。実際の再設定メール送信はクライアント SDK
 * （sendPasswordResetEmail）が Firebase Auth 経由で行う（仕様 §1.5）。
 */
export const sendPersonPasswordReset = onCall(async (request) => {
  const callerUid = requireUid(request);
  const fid = await requireFamilyRole(callerUid);
  const { email } = (request.data ?? {}) as { email?: unknown };
  if (!isPlausibleEmail(email)) throw new HttpsError("invalid-argument", "invalid-email");

  const personUid = await findPersonMemberUid(fid);
  if (personUid === null) throw new HttpsError("not-found", "person-not-found");
  const user = await auth.getUser(personUid);
  if (!user.email) throw new HttpsError("internal", "person-email-missing");
  if (user.email.toLowerCase() !== (email as string).trim().toLowerCase()) {
    throw new HttpsError("not-found", "email-mismatch");
  }
  return { email: user.email };
});

/* ---------------- updatePersonEmail ---------------- */

/** 本人アカウントのメールアドレス訂正（family ロール限定・Admin SDK） */
export const updatePersonEmail = onCall(async (request) => {
  const callerUid = requireUid(request);
  const fid = await requireFamilyRole(callerUid);
  const { personUid, newEmail } = (request.data ?? {}) as {
    personUid?: unknown;
    newEmail?: unknown;
  };
  if (typeof personUid !== "string" || personUid.length === 0) {
    throw new HttpsError("invalid-argument", "invalid-person");
  }
  if (!isPlausibleEmail(newEmail)) throw new HttpsError("invalid-argument", "invalid-email");

  const member = await db.doc(`families/${fid}/members/${personUid}`).get();
  if (!member.exists || member.get("role") !== "person") {
    throw new HttpsError("not-found", "person-not-found");
  }
  try {
    await auth.updateUser(personUid, { email: (newEmail as string).trim() });
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "email-in-use");
    if (code === "auth/invalid-email") throw new HttpsError("invalid-argument", "invalid-email");
    throw new HttpsError("internal", "update-failed");
  }
  /* 設定画面の現アドレス表示も追随させる */
  await member.ref.update({ email: (newEmail as string).trim() });
  return { email: (newEmail as string).trim() };
});

/* ---------------- removePersonMember ---------------- */

/**
 * 本人を家族から外す（family ロール限定）。
 * members の削除と users.familyId の解除を同一トランザクションで行う。
 * 旧 UID の photos・photoReactions は履歴として残す（仕様 §1.5）。
 */
export const removePersonMember = onCall(async (request) => {
  const callerUid = requireUid(request);
  const fid = await requireFamilyRole(callerUid);
  const { personUid } = (request.data ?? {}) as { personUid?: unknown };
  if (typeof personUid !== "string" || personUid.length === 0) {
    throw new HttpsError("invalid-argument", "invalid-person");
  }
  const memberRef = db.doc(`families/${fid}/members/${personUid}`);
  const member = await memberRef.get();
  if (!member.exists || member.get("role") !== "person") {
    throw new HttpsError("not-found", "person-not-found");
  }
  const personUserRef = db.doc(`users/${personUid}`);
  await db.runTransaction(async (tx) => {
    tx.delete(memberRef);
    tx.update(personUserRef, { familyId: null });
  });
  return { ok: true };
});
