"use client";

import { useEffect, useRef } from "react";
import { setDoc, getDoc, onSnapshot, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { useSession, type SessionState } from "@/lib/auth/session";
import { ensureUserFamily } from "@/lib/auth/family";

/**
 * 認証状態と家族メンバーシップの監視
 *
 * - users/{uid}                … uid がどの家族に属するか（家族ポインタ）
 * - families/{fid}             … 家族名
 * - families/{fid}/members/{uid} … 役割（role の正本）
 *
 * 未ログインや途中でエラーが起きても落ちないことを重視（本人が使うため）。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSession((s) => s.setSession);
  /** リスナー解除を收到了部位からの多重購読を防ぐフラグ */
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    const { auth, db } = getFirebase();

    let unsubMember: (() => void) | undefined;
    let unsubFamily: (() => void) | undefined;
    let currentUid: string | null = null;

    const onAuthChange = async (user: import("firebase/auth").User | null) => {
      if (disposedRef.current) return;

      if (!user) {
        unsubMember?.();
        unsubFamily?.();
        setSession({
          status: "unauthenticated",
          uid: null,
          email: null,
          familyId: null,
          familyName: null,
          role: null,
          displayName: null,
        });
        return;
      }

      currentUid = user.uid;

      /* users/{uid} が無い場合は家族未参加として作成（家族づくりは家族設定画面で行う） */
      const userRef = doc(db, "users", user.uid);
      let familyId: string | null = null;
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            familyId: null,
            createdAt: Date.now(),
          });
        } else {
          familyId = (userSnap.data()?.familyId as string | null) ?? null;
        }
      } catch {
        // 読み取りに失敗してもログイン状態だけは確定させておく
      }

      /*
        家族が未作成なら簡易セットアップ（Phase 3 方針）:
        自分の家族グループを作り、family ロールで参加する。
      */
      if (!familyId) {
        try {
          familyId = await ensureUserFamily(user.uid, user.displayName);
        } catch {
          // 作成に失敗した場合は家族なし状態で続行（画面に案内が出る）
        }
      }

      const userSnap = await getDoc(userRef);
      const verifiedFamilyId = (userSnap.data()?.familyId as string | null) ?? familyId;

      const base: SessionState = {
        status: "authenticated",
        uid: user.uid,
        email: user.email ?? null,
        familyId: verifiedFamilyId,
        familyName: null,
        role: null,
        displayName: null,
      };
      if (disposedRef.current || currentUid !== user.uid) return;
      setSession(base);

      if (!familyId) return;

      unsubFamily = onSnapshot(doc(db, "families", familyId), (snap) => {
        const name = (snap.data()?.name as string | undefined) ?? null;
        if (currentUid !== user.uid || disposedRef.current) return;
        useSession.setState({ familyName: name });
      });

      unsubMember = onSnapshot(doc(db, "families", familyId, "members", user.uid), (snap) => {
        const data = snap.data() as
          | { role: import("@/types/models").MemberRole | undefined; displayName: string | undefined }
          | undefined;
        if (currentUid !== user.uid || disposedRef.current) return;
        useSession.setState({
          role: data?.role ?? null,
          displayName: data?.displayName ?? null,
        });
      });
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      void onAuthChange(user).catch(() => {
        /* 認証後のメンバーシップ取得に失敗しても、最低限のログイン状態は出す */
      });
    });

    return () => {
      disposedRef.current = true;
      unsubAuth();
      unsubMember?.();
      unsubFamily?.();
    };
  }, [setSession]);

  return <>{children}</>;
}
