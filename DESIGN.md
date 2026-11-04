---
name: Memoria
description: 写真から、人生をたどる。本人と家族が共通画面で思い出を育てる Web アプリ。
colors:
  primary: "#d9764a"
  primary-deep: "#b85c33"
  primary-soft: "#f6e3d5"
  go: "#4a8f8c"
  go-deep: "#376f6c"
  go-soft: "#dff0ee"
  back: "#8a7f70"
  back-soft: "#eee8df"
  neutral-bg: "#fbf6ee"
  surface: "#fffdf8"
  surface-accent: "#f6e3d5"
  ink: "#3f3a33"
  ink-soft: "#70665a"
  line: "#e8ddcc"
  danger: "#b3402e"
  danger-soft: "#f7e0dc"
typography:
  display:
    fontFamily: "M PLUS Rounded 1c, Hiragino Maru Gothic ProN, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "M PLUS Rounded 1c, Hiragino Maru Gothic ProN, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "M PLUS Rounded 1c, Hiragino Maru Gothic ProN, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "M PLUS Rounded 1c, Hiragino Maru Gothic ProN, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "M PLUS Rounded 1c, Hiragino Maru Gothic ProN, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  btn: "1.25rem"
  card: "1.5rem"
spacing:
  sm: "12px"
  md: "24px"
  lg: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
    padding: "16px 24px"
    height: "64px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-go:
    backgroundColor: "{colors.go-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
    padding: "20px 24px"
    height: "72px"
  button-quiet:
    backgroundColor: "{colors.back-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "12px 20px"
    height: "56px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "32px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "16px"
---

# Design System: Memoria

## Overview

**Creative North Star: "リビングのアルバム棚"**

Memoria の UI は、家族のリビングにあるアルバム棚そのもの。写真（アルバム）が棚の主であり、UI はその引き出しの把手にすぎない。把手は大きく、堅く、どこにでも手が届く。界面は飾らないが、叩けば確かに手ごたえがある。

背景は日ざしのクリーム（#fbf6ee）。その上に白いカードが、積み重ねた紙のように層をなす。基本は影を持たないフラット設計で、層は色差で表現する。影は動的な装飾ではなく状態への応答に限る。主要操作には焼き菓子テラコッタを、進む系操作には冴えた青緑を使うが、どちらも画面面積の 1 割程度に抑える（写真が主役であるため）。

**Key Characteristics:**
- 写真の面積を最大限に確保し、UI の佇まい（ボタン・ラベル）は最低限に留める
- 大きな文字（本文 1.5rem 以上）・大きなボタン（最小高 56px、主要操作 72px）・十分な余白（24px 以上）
- 色だけでは情報を伝えない。アイコン＋形状＋ラベルを常に添える
- 部品は「大きく・押し倒せる」。押し込まれる実感（active:scale）がある
- 自動遷移・自動再生なし。効果は 150ms 以内の opacity/transform に限る

## Colors

### Primary
- **焼き菓子テラコッタ** (#d9764a): ホームへ戻るボタンのように、手が自然に伸びる主要操作に使う。1 画面で最も目立つ HTML 要素は 1 つに限る。

### Secondary
- **冴えた青緑** (#4a8f8c): 「進む・確定」系の操作（写真を追加、次へ）。テラコッタと場面が異なれば混在してよいが、同画面では 2 色まで。
- **静かな灰茶** (#8a7f70): 「戻る」系・低優先度の操作（ログアウトなど）。背景色 #eee8df とセットで静かなボタンを構成。

### Neutral
- **日ざしのクリーム** (#fbf6ee): 全画面の背景。この色の上なら写真がいつも主役に見える。
- **白いカード** (#fffdf8): 写真や情報を載せる面。クリームの上に重ねて層を作る。
- **強調用のカード台** (#f6e3d5): 注意・説明など静かに語る領域の背景。
- **濃い茶（文字）** (#3f3a33): すべての本文・見出し。純黒は使わない。
- **淡茶（補助文字）** (#70665a): 補足説明・空状態の文言のみ。
- **やわらかな枠線** (#e8ddcc): カード部品や入力欄の縁。

### 通知色
- **落ち着いた赤** (#b3402e): エラー・警告のみ。背景 #f7e0dc とセット。形状（！）＋文字を必ず併載。

### Named Rules
**The One Focus Rule.** 1 画面に「一番目立つもの」は写真 1 枚か主要ボタン 1 つ。2 番目以降の要素はトーンで引く。
**The No-Color-Only Rule.** 状態・種別を色だけで伝えない。ラベルと形状を必ず併載する。

## Typography

**Display Font:** M PLUS Rounded 1c（Hiragino Maru Gothic / system フォールバック）
**Body Font:** 同上（単一のフォントファミリー＋丸ゴ）

**Character:** 丸ゴシック一冊。手書きの温かさと、拡大して読めても崩れない堅さを両立する。複数ファミリーの競合は禁止（写真が主役）。

### Hierarchy
- **Display** (700, 3rem, 1.2): ログイン画面のアプリ名・特大見出しのみ。
- **Headline** (700, 1.875rem, 1.3): 画面見出し・家族名。
- **Title** (700, 1.5rem, 1.4): セクション見出し・メニューボタンのラベル。
- **Body** (400, 1.5rem, 1.55): 本文。1 行が長くなりすぎない。
- **Label** (400, 1.25rem, 1.5): 補助テキスト・説明文。本人向け画面の基準。家族向けの高密度画面では下限 1rem（16px）まで縮めてよい。

### Named Rules
**The No-Shrink Rule.** 本人が主に見る画面（写真一覧・詳細・思い出を探す・人生の地図）の文字は、Body 1.5rem / Label 1.25rem 以上で統一する。家族向けの情報密度が高い場面（設定・整理・一覧の管理操作）では、視認性と密度の両立のため Label の縮小を許容する。ただし下限は 1rem（16px）とし、縮めた対象には常に十分なコントラストと確実なタップ領域（44px 以上）を保つ。最小値を全画面へ機械的に適用するのではなく、画面の使われ方に応じて判断する。

## Layout

- ベースグリッドなし。余白は 24px 以上。タブレット横向きが基準。
- コンテナ: max-w-5xl（64rem）中心。写真詳細・探すなど没入画面はフルブリード（背景まで写真で満たす）。
- メニューグリッド: ホームの主操作は 1〜3 列（sm: 2 列、lg:3 列）。1 辺 128px 以上の大きさが保証される。
- 一覧: 写真グリッドは 2〜4 列で可変。間隔 24px。

## Elevation & Depth

**フラット＋トーン重ね**。基本は影を持たない。層の表現は色差（クリーム #fbf6ee に白 #fffdf8 を重ねる）と枠線 #e8ddcc で行う。積んだ紙のように直に重ねる。影は基本的に使わない。使うとしても状態の応答に限る（例: hover 時の面一層）。

### Named Rules
**The Paper Stack Rule.** 深さは色差で。影は応答のみ。

## Shapes

- ボタン: 1.25rem の大きな丸角（rounded-btn）。押し込みは active:scale(transform) のみ。
- カード: 1.5rem の丸角（rounded-card）。写真は角を切りすぎない。
- 枠線: 2px〜4px の直線。白い枠で写真を包む。ボーダーは識別を色ではなくトーン差で行う。
- 入力欄: 角丸大・白背景・2px 枠。フォーカスは 5px 外輪郭 + offset 3px。

## Components

### Buttons
- **Shape:** 大きい丸角（1.25rem）。最小高 56px、主要操作 64〜72px。
- **Primary（主要操作）:** テラコッタ (#d9764a) 背景 + 白文字、16/24px パディング。アイコン＋ラベル併載。
- **Hover/Active:** hover は色深化（#b85c33）、active は scale(0.98〜0.99) の押し込み。
- **Go（進む・確定）:** 冴えた青緑の深色 (#376f6c) 背景 + 白文字。高さ 72px。
- **Quiet（戻る・低優先度）:** #eee8df 背景 + 濃茶文字 + 2px 下線装飾。高さ 56px。

### Cards / Containers
- **Shape:** 1.5rem 丸角。
- **Background:** 白 (#fffdf8) または強調台 (#f6e3d5)。枠線 2px #e8ddcc。
- **Shadow:** なし（Paper Stack Rule）。
- **Internal Padding:** 24〜32px。

### Inputs / Fields
- **Style:** 白背景、2px 枠 #e8ddcc、丸角大、内側 16px、文字 1.5rem。
- **Focus:** 5px テラコッタ外輪郭 + offset 3px（形状でフォーカスを一目で表す）。
- **Error:** 2px 枠赤 + #f7e0dc 背景 + 形状（！）＋文字。色だけでは伝えない。

### Navigation (AppShell)
- トップバー: 左に大き目の「ホームへ戻る」（テラコッタ・アイコン付き・64px 高）、右に表示名・役割・「やめる（ログアウト）」quiet ボタン。
- どの画面からもホームに戻れる。自動縮小・自動露出はしない。

### 写真グリッド（主要予定部品）
- 白枠で写真を包み、丸角大。下に固有のラベル（誰か・いつか）は任意に載せる。
- 間隔 24px。タップ領域 128px 以上。

## Do's and Don'ts

### Do:
- **Do** 写真の周りに白紙の台紙（枠）を添える。写真が主役のまま余白を持たせる。
- **Do** 操作ボタンにアイコン＋日本語ラベルを必ず併載。1.5rem 以上の文字。
- **Do** 層は色差で。クリーム → 白 → 強調台の順序を守る。
- **Do** 進む系の青緑・戻る系の灰茶を、動線の約束として使い分ける。

### Don't:
- **Don't** 純黒や高飽和の色を使わない。色はあたたかく。
- **Don't** 色だけで状態を伝えない（ラベル・形状併載）。
- **Don't** 影を動的装飾として積む（Paper Stack Rule）。
- **Don't** 写真の上に常時オーバーレイを張る。位置情報は下部に静かに載せる。
- **Don't** 自動遷移・自動再生・長いアニメーション。効果は 150ms 以内の opacity/transform のみ。
