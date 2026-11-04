"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { UploadResult } from "firebase/storage";
import { getFirebase } from "@/lib/firebase/client";

/*
 * 写真ファイルのアップロード（Storage）
 *
 * - パスは families/{familyId}/photos/{photoId}/{uuid}_{safe-name}。
 *   Security Rules がこの配下を家族メンバーに限定する。
 * - 元画像のまま保存する（仕様決定済み。リサイズは将来対応）。
 */

export interface UploadedPhoto {
  storagePath: string;
  downloadURL: string;
  width: number | null;
  height: number | null;
}

const IMAGE_EXTENSION_RE = /\.[a-z0-9]{1,5}$/i;

function safeFileName(file: File): string {
  const base =
    file.name.replace(IMAGE_EXTENSION_RE, "").replace(/[^\w\-]/g, "_").slice(0, 60) ||
    "photo";
  const ext = file.type === "image/jpeg" ? ".jpg" : file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : (file.name.match(IMAGE_EXTENSION_RE)?.[0] ?? "");
  return `${base}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

export async function uploadPhotoFile(
  familyId: string,
  photoId: string,
  file: File,
): Promise<UploadedPhoto> {
  const { storage } = getFirebase();
  const fileName = photoId + "-" + safeFileName(file);
  const path = `families/${familyId}/photos/${photoId}/${fileName}`;
  const storageRef = ref(storage, path);

  const result: UploadResult = await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  const downloadURL = await getDownloadURL(result.ref);
  const dimensions = await readImageDimensions(downloadURL);

  return {
    storagePath: path,
    downloadURL,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/** 人物の顔写真も同じ families/{fid}/photos/ 配下に保存する（Rules で保護される） */
export async function uploadPersonPhoto(familyId: string, file: File): Promise<string> {
  const { storage } = getFirebase();
  const uuid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  const fileName = safeFileName(file);
  const path = `families/${familyId}/photos/people/${uuid}-${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/** 元写真の表示崩れ防止のための寸法取得（失敗してもアップロードは失敗扱いにしない） */
function readImageDimensions(url: string): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      img.onerror = () => resolve({ width: null, height: null });
      img.src = url;
    } catch {
      resolve({ width: null, height: null });
    }
  });
}
