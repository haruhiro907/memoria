import Link from "next/link";

/*
 * 使い方・こまったとき（ヘルプ）
 * - 本人と家族の両方が読む。専門用語なし、することベースで書く。
 * - 「できない」ではなく「家族に聞く」へつなぐ（本人を詰まらせない）。
 */
export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-3xl font-bold">使い方・こまったとき</h2>
      <p className="mt-3 text-xl leading-relaxed text-ink-soft">
        Memoria は、写真から思い出をたどるための場所です。むずかしい操作はありません。
      </p>

      <section className="mt-10" aria-labelledby="help-do-heading">
        <h3 id="help-do-heading" className="text-2xl font-bold">
          できること
        </h3>
        <ul className="mt-4 space-y-4">
          <HelpItem title="思い出を探す">
            ホームの「思い出を探す」を押すと、写真が 1 枚ずつ大きく出ます。「もっと見る」で次の写真へ、「おわる」でホームに戻ります。
          </HelpItem>
          <HelpItem title="写真を追加する">
            ホームの「写真を追加」から、端末の中の写真を選ぶだけです。名前や日付が分からなくても、そのまま追加できます。
          </HelpItem>
          <HelpItem title="人物・出来事から探す">
            ホームの「ほかの探し方」にあります。人や出来事を選ぶと、それにまつわる写真が出ます。
          </HelpItem>
          <HelpItem title="人生の地図">
            出来事が道のように並んだ画面です。古い出来事から順にたどれます。
          </HelpItem>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="help-trouble-heading">
        <h3 id="help-trouble-heading" className="text-2xl font-bold">
          こまったとき
        </h3>
        <ul className="mt-4 space-y-4">
          <HelpItem title="ホームに戻りたい">
            画面の右上にある「ホーム」を押すと、いつでも最初の画面に戻れます。
          </HelpItem>
          <HelpItem title="間違えてログアウトしてしまった">
            あわてなくて大丈夫です。家族の方に連絡して、もう一度ログインしてもらってください。写真や記録は消えていません。
          </HelpItem>
          <HelpItem title="写真が追加できない">
            通信が弱い場所では追加できないことがあります。場所を変えて、もう一度ためしてください。それでもできないときは家族の方に相談してください。
          </HelpItem>
          <HelpItem title="まちがった写真を消したい">
            写真を消す操作は家族の方だけができます。家族の方に相談してください。
          </HelpItem>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="help-family-heading">
        <h3 id="help-family-heading" className="text-2xl font-bold">
          家族の方へ
        </h3>
        <ul className="mt-4 space-y-4">
          <HelpItem title="本人のアカウント">
            発行・メールの変更・パスワードの再設定は
            <Link href="/settings" className="font-semibold underline decoration-2 underline-offset-4">
              家族の設定
            </Link>
            から行えます。本人がログアウトしてしまったときも、ここから再発行できます。
          </HelpItem>
          <HelpItem title="ふりかえり">
            本人がよく見ている写真や時代は、写真一覧の右上「ふりかえり」から確認できます（家族だけが見られます）。
          </HelpItem>
          <HelpItem title="記録の持ち出し">
            人物・出来事・写真の記録は、家族の設定から JSON ファイルでダウンロードできます。
          </HelpItem>
        </ul>
      </section>
    </div>
  );
}

function HelpItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-card bg-surface p-6 ring-2 ring-inset ring-line">
      <p className="text-2xl font-bold">{title}</p>
      <p className="mt-2 text-xl leading-relaxed">{children}</p>
    </li>
  );
}
