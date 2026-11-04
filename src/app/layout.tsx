import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";

const rounded = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  weight: ["400", "500", "700"],
  subsets: [],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memoria|写真から、人生をたどる",
  description:
    "本人と家族が写真を追加し、思い出をいっしょにたどることができるアプリです。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // タブレットのピンチズームを許可する（拡大して見たい本人がいるため）
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${rounded.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
