# 🎨 WordPress カスタムCSS（修正版）

> WordPressの「追加CSS」では `@import` が使えません。
> 2段階で設定してください。

---

## ステップ1: Google Fonts を読み込む

**「外観 → カスタマイズ → 追加CSS」ではなく、別の方法で読み込みます。**

### 方法A: プラグインを使う（おすすめ・簡単）

1. プラグイン → 新規追加 → 「**Insert Headers and Footers**」で検索 → インストール → 有効化
2. 設定 → 「Insert Headers and Footers」（または「WPCode」）
3. 「Header」欄に以下を貼り付け → 保存：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 方法B: プラグインなしの場合

テーマの `functions.php` に追加（子テーマ推奨）：

```php
function add_google_fonts() {
  wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap', array(), null);
}
add_action('wp_enqueue_scripts', 'add_google_fonts');
```

> ⚠️ 方法Bは上級者向けです。不安な方は方法Aを使ってください。

---

## ステップ2: CSSを貼り付ける

**ロリポップのWAFが厳しいので、小分けにして貼り付けてください。**
**1つずつ追加して「公開」→ エラーが出なければ次を追加、の方式で進めます。**

> WAFをOFFにしている場合は全部まとめて貼ってもOKです。

---

### ブロック① 基本フォント（まずこれだけ貼る）

```css
body {
  font-family: 'Noto Sans JP', sans-serif !important;
  line-height: 1.85;
  letter-spacing: 0.02em;
}
```

---

### ブロック② 見出しの読みやすさ ⚠️修正版

> **前回の `color: #222` は削除してください！** 暗い背景のセクションで見えなくなっていました。
> 色は変えず、太さ・サイズ・影で視認性を上げます。

```css
h2 {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.15em;
  text-shadow: 0 1px 3px #00000033;
}

h3 {
  font-weight: 600 !important;
  text-shadow: 0 1px 2px #00000022;
}
```

---

### ブロック②-b 追従ヘッダーの修正（新規追加）

> スクロール時にヘッダーの文字が背景と被って読めない問題を修正。

```css
header,
.site-header {
  background: #fff !important;
  box-shadow: 0 2px 10px #00000015;
}

header a,
.site-header a,
.site-title a {
  color: #333 !important;
}
```

> **注意：** もしヘッダーの背景が白じゃなくて黒系のテーマの場合は、
> `background: #fff` を `background: #1a1a2e` に、
> `color: #333` を `color: #fff` に変更してください。

---

### ブロック③ ボタンのホバー効果

```css
.wp-block-button__link {
  transition: all 0.3s ease !important;
  border-radius: 8px !important;
}

.wp-block-button__link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px #00000026;
}
```

---

### ブロック④ テーブル改善

```css
table {
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
}

table th {
  font-weight: 700;
  padding: 14px 16px;
}

table td {
  padding: 12px 16px;
}
```

---

### ブロック⑤ カードのホバー

```css
.wp-block-column {
  transition: transform 0.3s ease;
}

.wp-block-column:hover {
  transform: translateY(-4px);
}
```

---

### ブロック⑥ プロフィール写真

```css
.wp-block-media-text__media img {
  border-radius: 12px;
  box-shadow: 0 4px 20px #0000001a;
}
```

---

### ブロック⑦ モバイル最適化

```css
@media (max-width: 768px) {
  body {
    font-size: 15px;
    line-height: 1.9;
  }

  h1 { font-size: 1.6rem !important; }
  h2 { font-size: 1.3rem !important; }
  h3 { font-size: 1.1rem !important; }

  .wp-block-button__link {
    padding: 14px 28px !important;
    font-size: 1rem !important;
    width: 100%;
    text-align: center;
  }
}
```

---

### ブロック⑧ LINEボタン

```css
.floating-line-btn {
  position: fixed;
  bottom: 80px;
  right: 20px;
  background: #06C755;
  color: #fff !important;
  padding: 14px 20px;
  border-radius: 50px;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none !important;
  box-shadow: 0 4px 16px #06c75566;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
}

.floating-line-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px #06c75580;
  color: #fff !important;
}
```

---

### ⚠️ WAFで弾かれる場合のチェックポイント

以下のCSS記法はロリポップWAFが攻撃と誤検知します。**使わないでください：**

| NG記法 | 理由 |
|--------|------|
| `a[href^="tel:"]` | 属性セレクタがXSS攻撃と誤認される |
| `::selection` | 疑似要素が攻撃パターンと判定 |
| `::-webkit-scrollbar` | 同上 |
| `rgba(0, 0, 0, 0.15)` | カッコ内のカンマがSQL注入と誤認されることがある |

**対処法:** `rgba(0,0,0,0.15)` → `#00000026`（16進数8桁表記）に変換済みです。

---

## ステップ3: フローティングLINEボタンのHTMLを追加

ステップ1で「Insert Headers and Footers」プラグインを入れた場合：

1. 設定 → 「Insert Headers and Footers」
2. **「Footer」欄** に以下を貼り付け → 保存：

```html
<a href="https://lin.ee/あなたのLINE_ID" class="floating-line-btn" target="_blank" rel="noopener">
  💬 LINEで無料相談
</a>
```

> ⚠️ `https://lin.ee/あなたのLINE_ID` を実際のLINE友だち追加URLに変更してください。

---

## 確認チェックリスト

- □ フォントが Noto Sans JP に変わった
- □ ボタンにホバーアニメーションがついた
- □ テーブルの角が丸くなった
- □ 右下に緑色のLINEボタンが表示された
- □ スマホで崩れていない
