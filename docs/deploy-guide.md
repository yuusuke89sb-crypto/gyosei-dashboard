# Cloudflare Pages デプロイ手順ガイド

## 前提条件
- GitHubアカウント
- Cloudflareアカウント（無料で作成可）

---

## 手順 1: GitHubリポジトリの作成

1. https://github.com/new を開く
2. **Repository name**: `gyosei-dashboard`
3. **Visibility**: `Private`（推奨）
4. **「Create repository」** をクリック
5. 表示される手順に従い、ダッシュボードのファイルをPush：

```bash
cd d:\行政書士\開業\gyosei-dashboard
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/ユーザー名/gyosei-dashboard.git
git push -u origin main
```

> ⚠️ `gas/` フォルダにはGASコードが含まれるため、`.gitignore` で除外するか、Private リポジトリを必ず使用してください。

## 手順 2: Cloudflareアカウント作成

1. https://dash.cloudflare.com/sign-up を開く
2. メールアドレスとパスワードで登録（無料）

## 手順 3: Cloudflare Pagesでデプロイ

1. Cloudflareダッシュボードで **「Workers & Pages」** → **「Create」** をクリック
2. **「Pages」** タブを選択
3. **「Connect to Git」** → GitHubアカウントを接続
4. `gyosei-dashboard` リポジトリを選択
5. 設定：
   - **プロジェクト名**: `gyosei-dashboard`
   - **ビルドコマンド**: （空欄のまま）
   - **ビルド出力ディレクトリ**: （空欄のまま、または `/`）
6. **「Save and Deploy」** をクリック

## 手順 4: デプロイ完了

デプロイが完了すると、以下のような URL が発行されます：

```
https://gyosei-dashboard.pages.dev
```

この URL を補助者に共有し、初期パスワード `gyosei2026` を伝えてください。

## 手順 5: カスタムドメイン（任意）

独自ドメインがある場合：
1. **「Custom domains」** → **「Set up a domain」**
2. ドメインを入力 → DNS設定を行う

---

## 更新方法

コードを変更した場合、GitHubにPushするだけで自動的にデプロイされます：

```bash
git add .
git commit -m "変更内容の説明"
git push
```
