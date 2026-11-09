# 匠工業サイトのチャットと問い合わせの受け口

ホームページ(GitHub Pages)から呼ぶ、Cloudflare Workers 上の小さなサーバー。

| 入口 | 役目 |
|---|---|
| `POST /chat` | AIの受付。事実(`src/facts.js`)に書いてあることだけ答え、連絡先が揃ったら問い合わせとして保存して通知 |
| `POST /inquiry` | フォーム。保存して通知 |
| `GET /admin/inquiries` / `POST /admin/inquiries` | 新右衛門(PC)が受信箱を取りに来る。合言葉(NOTIFY_TOKEN)が必要 |

守っていること
- PCへ外から入る口は作らない。PCがこちらへ取りに来る。
- 秘密はコードに書かない。Cloudflare の「変数とシークレット」に入れる。
- 1時間にIPごと20回、1日に全体で300回まで(`wrangler.toml` で変えられる)。
- 価格・日程・対応可否は、`facts.js` に書いてあるときだけ答える。書いてなければ受け付けて担当に回す。
- フォームの隠し欄(`website`)に値が入っていたらボットとみなして捨てる。

## 公開の手順(康さんがやる分は ★)
1. ★ Cloudflare のアカウントを無料で作る。
2. ★ Anthropic Console で、**チャット専用の新しいAPIキー**を作り、月の使用上限を付ける(新右衛門本体のキーは使わない)。
3. `npx wrangler login`、`npx wrangler kv namespace create KV`、出てきた id を `wrangler.toml` に入れる。
4. `npx wrangler secret put ANTHROPIC_API_KEY`(★ キーは康さんが貼る。画面にもログにも出さない)、`NOTIFY_TOKEN`。
5. `npx wrangler deploy` で公開。出てきたアドレスを `index.html` の `WORKER_URL` に入れて、PR にする。
6. (任意)Gmail通知は `RESEND_API_KEY`、LINE通知は `LINE_CHANNEL_TOKEN` と `LINE_USER_ID`。

## テスト
`npm test`(Node 20以上。外への通信は使わない)
