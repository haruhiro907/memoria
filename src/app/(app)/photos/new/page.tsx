"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { addPhoto, reservePhotoId } from "@/lib/firestore/photo";
import { uploadPhotoFile } from "@/lib/firebase/upload";
import { useSession } from "@/lib/auth/session";
import { BigButton } from "@/components/ui/BigButton";
import { AlertIcon, CameraIcon, HomeIcon, ImagesIcon } from "@/components/ui/icons";

/*
 * 写真を追加（本人目線で最短）
 *
 *  - 選んだその瞬間から追加処理が始まり、名前や日付は一切求めない。
 *  - 先に Storage へアップロード、成功後に写真ドキュメントを 1 回で作成する。
 *    （失敗したファイルより不完全なドキュメントが残らない）
 *  - 失敗時は「もう一度」と「別の写真を選ぶ」で回収する。
 */

type Stage = "choose" | "adding" | "done" | "error" | "batch";

type BatchItemStatus = "waiting" | "adding" | "done" | "error";
interface BatchItem {
  file: File;
  preview: string;
  status: BatchItemStatus;
  error?: string;
}

export default function PhotoNewPage() {
  const router = useRouter();
  const { uid, role, familyId } = useSession();

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("choose");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  /* 1 枚分のアップロード本体（単体フローと一括フローの共用） */
  const uploadOne = useCallback(
    async (file: File): Promise<string> => {
      if (!familyId || !uid) throw new Error("no-family");
      const up = await uploadPhotoFile(familyId, await reservePhotoId(familyId), file);
      return addPhoto(familyId, {
        storagePath: up.storagePath,
        downloadURL: up.downloadURL,
        width: up.width,
        height: up.height,
        addedByUid: uid,
        addedByRole: role ?? "family",
      });
    },
    [familyId, uid, role],
  );

  const beginUpload = useCallback(
    async (file: File) => {
      if (!familyId || !uid) return;
      setPickedFile(file);
      setPreviewURL(URL.createObjectURL(file));
      setErrorText(null);
      setStage("adding");
      try {
        const photoId = await uploadOne(file);
        setCreatedId(photoId);
        setStage("done");
      } catch (err) {
        setErrorText(friendlyUploadError(err));
        setStage("error");
      }
    },
    [familyId, uid, uploadOne],
  );

  /* ---------- 一括追加（家族のまとめ入れ用。1 枚だけの体験は従来どおり） ---------- */
  const [batch, setBatch] = useState<BatchItem[] | null>(null);
  const batchRunning = useRef(false);

  const runBatch = useCallback(
    async (initial: BatchItem[]) => {
      if (batchRunning.current) return;
      batchRunning.current = true;
      let items = initial;
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === "done") continue;
        items = items.map((it, j) => (j === i ? { ...it, status: "adding" as const, error: undefined } : it));
        setBatch(items);
        try {
          await uploadOne(items[i].file);
          items = items.map((it, j) => (j === i ? { ...it, status: "done" as const } : it));
        } catch (err) {
          items = items.map((it, j) =>
            j === i ? { ...it, status: "error" as const, error: friendlyUploadError(err) } : it,
          );
        }
        setBatch(items);
      }
      batchRunning.current = false;
    },
    [uploadOne],
  );

  const beginBatch = useCallback(
    (files: File[]) => {
      const items: BatchItem[] = files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: "waiting",
      }));
      setBatch(items);
      setStage("batch");
      void runBatch(items);
    },
    [runBatch],
  );

  const reselect = () => {
    setStage("choose");
    setPickedFile(null);
    setPreviewURL(null);
    setCreatedId(null);
    setErrorText(null);
    setBatch(null);
  };

  const batchDoneCount = batch?.filter((i) => i.status === "done").length ?? 0;
  const batchSettled = batch !== null && batch.every((i) => i.status === "done" || i.status === "error");

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-bold">写真を追加</h2>

      {stage === "choose" && (
        <div className="mt-8">
          {familyId ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <BigButton tone="go" wide icon={<CameraIcon size={40} />} onClick={() => cameraInputRef.current?.click()}>
                  カメラで撮る
                </BigButton>
                <BigButton tone="go" wide icon={<ImagesIcon size={40} />} onClick={() => galleryInputRef.current?.click()}>
                  写真を選ぶ
                </BigButton>
              </div>
              <p className="mt-8 text-xl text-ink-soft">
                写真を選ぶだけで追加が完了します。名前や日付は入力しなくて大丈夫です。
                何枚かまとめて選ぶこともできます。
              </p>
            </>
          ) : (
            <p className="mt-8 rounded-card border-2 border-line bg-surface-accent p-6 text-2xl">
              家族の準備がまだのようです。ホーム画面で確認してください。
            </p>
          )}
        </div>
      )}

      {stage === "adding" && (
        <div className="mt-8" aria-live="polite">
          {previewURL && (
            <img src={previewURL} alt="選んだ写真" className="mx-auto max-h-96 rounded-card object-contain" />
          )}
          <p className="mt-6 text-center text-2xl text-ink-soft">写真を入れています…おまちください</p>
        </div>
      )}

      {stage === "done" && (
        <div className="mt-10 rounded-card border-2 border-line bg-surface p-8 text-center">
          {previewURL && (
            <img src={previewURL} alt="追加した写真" className="mx-auto max-h-80 rounded-xl object-contain" />
          )}
          <p className="mt-6 text-3xl font-bold text-go-deep">写真が家族のアルバムに入りました</p>
          <p className="mt-2 text-xl text-ink-soft">名前や日付は、家族があとから写真に書き込めます。</p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <BigButton tone="go" wide icon={<CameraIcon size={36} />} onClick={reselect}>
              もう一枚追加する
            </BigButton>
            <BigButton
              tone="primary"
              wide
              icon={<ImagesIcon size={36} />}
              onClick={() => createdId && router.push(`/photos/${createdId}`)}
            >
              追加した写真を見る
            </BigButton>
          </div>
          <div className="mt-8 flex justify-center">
            <BigButton tone="quiet" icon={<HomeIcon size={22} />} onClick={() => router.push("/home")}>
              ホームへ
            </BigButton>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="mt-10 rounded-card border-2 border-danger bg-danger-soft p-8 text-center">
          <p className="flex items-center justify-center gap-3 text-2xl font-bold text-danger">
            <AlertIcon size={30} />
            追加できませんでした
          </p>
          <p className="mt-3 text-2xl">{errorText}</p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <BigButton tone="go" wide onClick={() => pickedFile && void beginUpload(pickedFile)}>
              もう一度ためす
            </BigButton>
            <BigButton tone="quiet" wide onClick={reselect}>
              別の写真を選ぶ
            </BigButton>
          </div>
        </div>
      )}

      {stage === "batch" && batch && (
        <div className="mt-8">
          <p className="text-center text-2xl" aria-live="polite">
            {batchSettled ? (
              <>
                <span className="font-bold">{batchDoneCount} / {batch.length} 枚</span> 入りました
              </>
            ) : (
              <>
                写真を入れています…（<span className="font-bold">{batchDoneCount} / {batch.length} 枚</span>）
                <span className="mt-1 block text-lg text-ink-soft">終わるまで、この画面のままにしてください。</span>
              </>
            )}
          </p>

          <ul className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4">
            {batch.map((item, i) => (
              <li key={i} className="rounded-card bg-surface p-2 ring-2 ring-inset ring-line">
                <img src={item.preview} alt={`選んだ写真 ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                <p className="px-1 pb-1 pt-2 text-center text-lg font-semibold">
                  {item.status === "waiting" && "待機中"}
                  {item.status === "adding" && "入れています…"}
                  {item.status === "done" && <span className="text-go-deep">入りました</span>}
                  {item.status === "error" && <span className="text-danger">入れられませんでした</span>}
                </p>
                {item.status === "error" && (
                  <>
                    <p className="px-1 text-center text-base text-ink-soft">{item.error}</p>
                    <button
                      type="button"
                      onClick={() => batch && void runBatch(batch)}
                      className="mt-1 w-full rounded-btn bg-back-soft px-3 py-2 text-lg font-bold text-ink underline decoration-2 underline-offset-4"
                    >
                      もう一度ためす
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {batchSettled && (
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <BigButton tone="go" wide icon={<ImagesIcon size={36} />} onClick={reselect}>
                もっと追加する
              </BigButton>
              <BigButton tone="quiet" wide icon={<HomeIcon size={22} />} onClick={() => router.push("/home")}>
                ホームへ
              </BigButton>
            </div>
          )}
        </div>
      )}

      {/* 隠し入力: ギャラリーとカメラ */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length === 1) void beginUpload(files[0]);
          else if (files.length > 1) beginBatch(files);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void beginUpload(file);
        }}
      />
    </div>
  );
}

function friendlyUploadError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code.includes("unauthorized") || code.includes("permission-denied")) {
    return "保存の権限がありません。もう一度ログインし直してみてください。";
  }
  if (code.includes("network") || code.includes("retry") || code.includes("canceled")) {
    return "通信が途中で切れたようです。Wi-Fi や回線を確認して、もう一度ためしてください。";
  }
  return "うまく保存できませんでした。もう一度ためしてみてください。";
}
