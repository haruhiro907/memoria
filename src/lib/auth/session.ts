"use client";

/**
 * 認証・家族メンバーシップの状態管理（zustand）
 *
 * 役割は families/{familyId}/members/{uid}.role を正本とし、
 * クライアント側の状態は表示の制御にのみ使う。
 * 実際の権限強制は Firestore / Storage の Security Rules で行う（設定書の原則）。
 */
import { create } from "zustand";
import type { MemberRole } from "@/types/models";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

export interface SessionState {
  status: AuthStatus;
  uid: string | null;
  email: string | null;
  /** 所属家族。未参加なら null（家族を作る/コードで参加する画面へ誘導する） */
  familyId: string | null;
  /** 家族名（families/{familyId}.name） */
  familyName: string | null;
  role: MemberRole | null;
  displayName: string | null;
}

interface MemoriaSessionStore extends SessionState {
  setSession: (session: SessionState) => void;
  clearSession: () => void;
}

const initial: SessionState = {
  status: "loading",
  uid: null,
  email: null,
  familyId: null,
  familyName: null,
  role: null,
  displayName: null,
};

export const useSession = create<MemoriaSessionStore>((set) => ({
  ...initial,
  setSession: (session) => set(session),
  clearSession: () => set({ ...initial, status: "unauthenticated" }),
}));

/* 表示の便宜のための派生セレクタ */
export const useIsFamily = () => useSession((s) => s.status === "authenticated" && s.role === "family");
export const useIsPerson = () => useSession((s) => s.status === "authenticated" && s.role === "person");
