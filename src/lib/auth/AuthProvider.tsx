"use client";

import { useEffect, useRef } from "react";
import { setDoc, getDoc, onSnapshot, doc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { useSession, type SessionState } from "@/lib/auth/session";
import type { MemberRole } from "@/types/models";

/**
 * 認証状態と家族メンバーシップの監視（Phase 4 / docs/phase4-spec.md §1.6）
 *
 * - users/{uid}                … uid がどの家族に属するか（家族ポインタ）
 * - families/{fid}             … 家族名
 * - families/{fid}/members/{uid} … 役割（role の正本）
 *
 * - ログインしただけでは家族を自動作成しない。家族づくりは登録画面の
 *   「家族として始める」で明示的に行い、本人アカウントは参加コードで入る。
 * - users/{uid} は onSnapshot で監視し、familyId の変化（家族作成・
 *   コード参加・メンバー解除）に追随する。
 * - 未ログインや途中でエラーが起きても落ちないことを重視（本人が使うため）。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSession((s) => s.setSession);
  /** 破棄後のコールバックを無効化するフラグ */
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    const { auth, db } = getFirebase();

    let unsubUser: (() => void) | undefined;
    let unsubMember: (() => void) | undefined;
    let unsubFamily: (() => void) | undefined;
    let currentUid: string | null = null;
    let currentFamilyId: string | null = null;
    let membershipActive = false;

    const teardownMembership = () => {
      unsubMember?.();
      unsubFamily?.();
      unsubMember = undefined;
      unsubFamily = undefined;
      membershipActive = false;
    };

    const subscribeMembership = (user: User, familyId: string | null) => {
      teardownMembership();
      currentFamilyId = familyId;
      membershipActive = true;
      const base: SessionState = {
        status: "authenticated",
        uid: user.uid,
        email: user.email ?? null,
        familyId,
        familyName: null,
        role: null,
        displayName: null,
      };
      setSession(base);
      if (!familyId) return;

      unsubFamily = onSnapshot(doc(db, "families", familyId), (snap) => {
        if (disposedRef.current || currentUid !== user.uid) return;
        useSession.setState({
          familyName: (snap.data()?.name as string | undefined) ?? null,
        });
      });

      unsubMember = onSnapshot(doc(db, "families", familyId, "members", user.uid), (snap) => {
        if (disposedRef.current || currentUid !== user.uid) return;
        const data = snap.data() as { role?: MemberRole; displayName?: string } | undefined;
        useSession.setState({
          role: data?.role ?? null,
          displayName: data?.displayName ?? null,
        });
      });
    };

    const onAuthChange = async (user: User | null) => {
      unsubUser?.();
      unsubUser = undefined;
      teardownMembership();
      currentFamilyId = null;

      if (!user) {
        currentUid = null;
        if (disposedRef.current) return;
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

      /* users/{uid} が無い場合は未参加として作成する（家族は作らない） */
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
      if (disposedRef.current || currentUid !== user.uid) return;
      subscribeMembership(user, familyId);

      /* familyId の後からの変化（家族作成・参加・解除）に追随する */
      unsubUser = onSnapshot(
        userRef,
        (snap) => {
          if (disposedRef.current || currentUid !== user.uid) return;
          const fid = (snap.data()?.familyId as string | null) ?? null;
          if (!membershipActive || fid !== currentFamilyId) {
            subscribeMembership(user, fid);
          }
        },
        () => {
          /* 購読に失敗しても、確定済みのセッションは維持する */
        },
      );
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      void onAuthChange(user).catch(() => {
        /* 認証後のメンバーシップ取得に失敗しても、最低限のログイン状態は出す */
      });
    });

    return () => {
      disposedRef.current = true;
      unsubAuth();
      unsubUser?.();
      teardownMembership();
    };
  }, [setSession]);

  return <>{children}</>;
}
