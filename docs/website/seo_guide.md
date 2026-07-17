# 🔍 SEO強化ガイド

## 1. 必須プラグインのインストール

### Yoast SEO（または All in One SEO）
1. プラグイン → 新規追加
2. 「Yoast SEO」で検索 → インストール → 有効化
3. 設定ウィザードを実行して基本設定

**やること：**
- 各ページ・記事にメタディスクリプションを設定
- XMLサイトマップの自動生成（Yoastが自動で作ってくれる）
- SNSシェア用のOGP画像を設定

---

## 2. Google Search Console に登録

1. [Google Search Console](https://search.google.com/search-console/) にアクセス
2. 「プロパティを追加」→ URL プレフィックス → `https://keen-akune-3176.pupu.jp/wordpress/`
3. 所有権の確認方法 → 「HTMLタグ」を選択
4. 表示されたmetaタグをコピー
5. WordPress → Yoast SEO → 一般 → ウェブマスターツール → Google に貼り付け
6. Search Console で「確認」をクリック
7. サイトマップ → `sitemap.xml` を送信

---

## 3. Google ビジネスプロフィール に登録

**ローカルSEO（「一宮市 行政書士」で検索されるために）の最重要施策です。**

1. [Google ビジネスプロフィール](https://business.google.com/) にアクセス
2. ビジネス名：「行政書士法人Felis」
3. カテゴリ：「行政書士」「法律事務所」
4. 住所・電話番号・営業時間を正確に入力
5. ウェブサイトURL を設定
6. 写真をアップロード（事務所の外観・内観・代表者写真）
7. 投稿機能でお知らせを定期更新

---

## 4. 構造化データ（JSON-LD）

以下のコードを WordPress の `<head>` 内に追加すると、Google検索結果にリッチスニペット（星評価・住所等）が表示されやすくなります。

**設置方法：** 「Insert Headers and Footers」プラグイン → ヘッダーに貼り付け

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LegalService",
  "name": "行政書士法人Felis",
  "description": "愛知県一宮市の行政書士事務所。相続手続き、麻雀店営業許可、車庫証明の申請代行。",
  "url": "https://keen-akune-3176.pupu.jp/wordpress/",
  "telephone": "0586-XX-XXXX",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "一宮市",
    "addressRegion": "愛知県",
    "addressCountry": "JP"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "35.3038",
    "longitude": "136.8029"
  },
  "openingHours": "Mo-Fr 09:00-18:00",
  "priceRange": "¥8,800〜",
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": "35.3038",
      "longitude": "136.8029"
    },
    "geoRadius": "30000"
  },
  "founder": {
    "@type": "Person",
    "name": "吉村悠佑",
    "jobTitle": "行政書士"
  },
  "sameAs": []
}
</script>
```

> ⚠️ `telephone` の `0586-XX-XXXX` は実際の電話番号に、`latitude`/`longitude` は実際の事務所の座標に変更してください。

---

## 5. ページごとのSEO設定（Yoast SEO使用時）

各ページの Yoast SEO で以下を設定してください：

### トップページ
- **SEOタイトル**: 行政書士法人Felis | 一宮市の相続・麻雀営業許可・車庫証明
- **メタディスクリプション**: 愛知県一宮市の行政書士法人Felis。相続手続き、麻雀店営業許可（風営法）、車庫証明の申請代行を承ります。初回相談無料。

### 麻雀店営業許可ページ
- **SEOタイトル**: 麻雀店営業許可申請 | 麻雀プロの行政書士がサポート | 行政書士法人Felis
- **メタディスクリプション**: 麻雀店の開業を検討中の方へ。WROTL2024世界王者の麻雀プロ行政書士が、風営法に基づく営業許可申請を物件選びからトータルサポート。初回相談無料。

### 相続手続きページ
- **SEOタイトル**: 相続手続き・遺言 | 家族の絆を守るサポート | 行政書士法人Felis
- **メタディスクリプション**: 相続手続きでお困りの方へ。戸籍収集から遺産分割協議書の作成まで、丁寧にサポート。家族の絆を守ることを大切にする行政書士事務所です。初回相談無料。

### 車庫証明ページ
- **SEOタイトル**: 車庫証明の申請代行 | 一宮市8,800円〜 | 行政書士法人Felis
- **メタディスクリプション**: 一宮市・稲沢市・江南市の車庫証明申請を代行。平日に警察署へ行けない方、ディーラー様からのまとめ依頼も歓迎。迅速・丁寧に対応します。

---

## 6. 今後のSEO対策タスク

| 頻度 | タスク | 目的 |
|------|--------|------|
| 週1回 | ブログ記事を投稿 | 検索流入を増やす |
| 月1回 | Googleビジネスプロフィールに投稿 | ローカルSEO強化 |
| 月1回 | Search Console でキーワードを確認 | 検索キーワードの把握 |
| 3ヶ月ごと | 各ページのメタ情報を見直し | SEO最適化 |
| 随時 | お客様にGoogleレビューをお願いする | 信頼性向上 |
