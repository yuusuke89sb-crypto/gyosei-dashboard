/**
 * 簡易パスワード認証モジュール
 * ダッシュボードへのアクセスを制限する
 */
const Auth = {
  // 初期パスワード
  DEFAULT_PASSWORD: 'gyosei2026',
  STORAGE_KEY: 'gyosei_auth_hash',
  SESSION_KEY: 'gyosei_auth_session',
  SESSION_TS_KEY: 'gyosei_auth_last_active',
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30分

  // ログイン試行制限
  MAX_ATTEMPTS: 5,
  LOCKOUT_MS: 3 * 60 * 1000, // 3分
  _failCount: 0,
  _lockedUntil: 0,

  // パスワードの簡易ハッシュ生成
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  },

  getStoredHash() {
    return localStorage.getItem(this.STORAGE_KEY) || this.hashPassword(this.DEFAULT_PASSWORD);
  },

  isAuthenticated() {
    if (sessionStorage.getItem(this.SESSION_KEY) !== 'true') return false;
    // セッションタイムアウト判定
    const lastActive = parseInt(sessionStorage.getItem(this.SESSION_TS_KEY) || '0', 10);
    if (lastActive && (Date.now() - lastActive > this.SESSION_TIMEOUT_MS)) {
      this.logout();
      return false;
    }
    return true;
  },

  // 最終操作時刻を更新
  touchSession() {
    if (sessionStorage.getItem(this.SESSION_KEY) === 'true') {
      sessionStorage.setItem(this.SESSION_TS_KEY, String(Date.now()));
    }
  },

  // セッションタイムアウト監視を開始
  startSessionTimer() {
    // ユーザー操作で最終操作時刻をリセット
    const touch = () => this.touchSession();
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt =>
      document.addEventListener(evt, touch, { passive: true })
    );
    this.touchSession();
    // 1分ごとにタイムアウトチェック
    setInterval(() => {
      if (!this.isAuthenticated()) return;
      const lastActive = parseInt(sessionStorage.getItem(this.SESSION_TS_KEY) || '0', 10);
      if (lastActive && (Date.now() - lastActive > this.SESSION_TIMEOUT_MS)) {
        this.logout();
      }
    }, 60 * 1000);
  },

  isLockedOut() {
    return Date.now() < this._lockedUntil;
  },

  getRemainingLockSeconds() {
    return Math.ceil(Math.max(0, this._lockedUntil - Date.now()) / 1000);
  },

  login(password) {
    if (this.isLockedOut()) return false;
    const inputHash = this.hashPassword(password);
    const storedHash = this.getStoredHash();
    if (inputHash === storedHash) {
      this._failCount = 0;
      sessionStorage.setItem(this.SESSION_KEY, 'true');
      this.touchSession();
      return true;
    }
    this._failCount++;
    if (this._failCount >= this.MAX_ATTEMPTS) {
      this._lockedUntil = Date.now() + this.LOCKOUT_MS;
      this._failCount = 0;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  changePassword(currentPassword, newPassword) {
    const currentHash = this.hashPassword(currentPassword);
    if (currentHash !== this.getStoredHash()) {
      return { error: '現在のパスワードが正しくありません' };
    }
    if (newPassword.length < 4) {
      return { error: 'パスワードは4文字以上にしてください' };
    }
    const newHash = this.hashPassword(newPassword);
    localStorage.setItem(this.STORAGE_KEY, newHash);
    return { success: true };
  },

  // ---- ログイン画面 ----
  renderLoginScreen() {
    return `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);
        font-family:'Segoe UI','Noto Sans JP',sans-serif">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px;
          width:100%;max-width:380px;box-shadow:0 25px 50px rgba(0,0,0,0.5);text-align:center">
          <div style="font-size:48px;margin-bottom:12px">⚖️</div>
          <h1 style="color:#f1f5f9;font-size:1.3rem;margin:0 0 4px;font-weight:700">行政書士 案件管理</h1>
          <p style="color:#94a3b8;font-size:0.8rem;margin:0 0 28px">ダッシュボードにログイン</p>
          <form onsubmit="Auth.onLoginSubmit(event)">
            <input type="password" id="authPassword" placeholder="パスワードを入力"
              autocomplete="current-password"
              style="width:100%;padding:12px 16px;border:1px solid #475569;border-radius:8px;
                background:#0f172a;color:#f1f5f9;font-size:0.95rem;outline:none;
                box-sizing:border-box;margin-bottom:16px;transition:border-color .2s"
              onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#475569'">
            <button type="submit" style="width:100%;padding:12px;border:none;border-radius:8px;
              background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:0.95rem;
              font-weight:600;cursor:pointer;transition:opacity .2s"
              onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              🔑 ログイン
            </button>
          </form>
          <div id="authError" style="color:#f87171;font-size:0.8rem;margin-top:12px;display:none"></div>
        </div>
      </div>
    `;
  },

  onLoginSubmit(e) {
    e.preventDefault();
    const err = document.getElementById('authError');
    if (this.isLockedOut()) {
      const sec = this.getRemainingLockSeconds();
      err.textContent = `🔒 ログインが一時的にロックされています（残り${sec}秒）`;
      err.style.display = 'block';
      return;
    }
    const password = document.getElementById('authPassword').value;
    if (this.login(password)) {
      location.reload();
    } else {
      if (this.isLockedOut()) {
        err.textContent = `🔒 ${this.MAX_ATTEMPTS}回連続で失敗したため、${this.LOCKOUT_MS / 60000}分間ロックされました`;
      } else {
        const remaining = this.MAX_ATTEMPTS - this._failCount;
        err.textContent = `❌ パスワードが正しくありません（残り${remaining}回）`;
      }
      err.style.display = 'block';
      document.getElementById('authPassword').value = '';
      document.getElementById('authPassword').focus();
    }
  },

  // ---- パスワード変更モーダル ----
  showChangePasswordModal() {
    const existing = document.getElementById('changePasswordModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'changePasswordModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('changePasswordModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔑 パスワード変更</h2>
          <button class="modal-close" onclick="document.getElementById('changePasswordModal').remove()">✕</button>
        </div>
        <form onsubmit="Auth.onChangePassword(event)">
          <div class="form-group">
            <label>現在のパスワード <span class="required">*</span></label>
            <input type="password" id="cpCurrentPw" required>
          </div>
          <div class="form-group">
            <label>新しいパスワード <span class="required">*</span></label>
            <input type="password" id="cpNewPw" required minlength="4">
          </div>
          <div class="form-group">
            <label>新しいパスワード（確認）<span class="required">*</span></label>
            <input type="password" id="cpNewPwConfirm" required minlength="4">
          </div>
          <div id="cpError" style="color:#ef4444;font-size:0.85rem;display:none;margin-bottom:12px"></div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('changePasswordModal').remove()">キャンセル</button>
            <button type="submit" class="btn btn-primary">変更する</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onChangePassword(e) {
    e.preventDefault();
    const current = document.getElementById('cpCurrentPw').value;
    const newPw = document.getElementById('cpNewPw').value;
    const confirm = document.getElementById('cpNewPwConfirm').value;
    const errEl = document.getElementById('cpError');

    if (newPw !== confirm) {
      errEl.textContent = '新しいパスワードが一致しません';
      errEl.style.display = 'block';
      return;
    }

    const result = this.changePassword(current, newPw);
    if (result.error) {
      errEl.textContent = result.error;
      errEl.style.display = 'block';
    } else {
      document.getElementById('changePasswordModal').remove();
      if (typeof App !== 'undefined') App.showToast('🔑 パスワードを変更しました');
    }
  },
};
