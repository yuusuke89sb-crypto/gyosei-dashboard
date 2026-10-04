/**
 * 同期の状態パネル（2026-10 追加）
 * 画面右下の同期バッジ、またはサイドバーの「同期の状態」から開く
 */
const SyncPanel = {
  MODAL_ID: 'syncPanelModal',

  _esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  _fmt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return this._esc(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  _clientName(id) {
    const c = (typeof Store !== 'undefined' && id) ? Store.getClient(id) : null;
    return c ? (c.companyName || c.name || '') : '';
  },
  FIELD_LABELS: {
    status: 'ステータス', completedAt: '完了日', fee: '報酬', advances: '立替金', carName: '名前',
    policeDeliveryDate: '交付日', storeDeliveryDate: '店舗納品日', applyDate: '申請日', registrationDate: '登録日',
    memo: 'メモ', title: '件名', orderNo: '注文書№', carNumber: '登録番号', vin: '車台番号', docs: '添付',
  },

  show() {
    const old = document.getElementById(this.MODAL_ID);
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = this.MODAL_ID;
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="SyncPanel.close()"></div>
      <div class="modal-content" style="max-width:760px;width:94vw;max-height:88vh;overflow:auto;">
        <div class="modal-header">
          <h2>🔄 同期の状態</h2>
          <button class="modal-close" onclick="SyncPanel.close()">✕</button>
        </div>
        <div id="syncPanelBody" style="padding:4px 2px 12px;font-size:0.85rem;"></div>
      </div>`;
    document.body.appendChild(modal);
    this.refresh();
  },

  close() {
    const m = document.getElementById(this.MODAL_ID);
    if (m) m.remove();
  },

  async refresh() {
    const body = document.getElementById('syncPanelBody');
    if (!body) return;
    const s = CaseSync.getState();
    const inv = (typeof InvoiceSync !== 'undefined') ? InvoiceSync.getState() : { invoices: [] };
    const device = (typeof InvoiceSync !== 'undefined') ? InvoiceSync.getDeviceName() : '';
    const cases = Store.getCases();
    const pending = cases.filter(c => CaseSync.pendingFields(c).length);
    const orphans = cases.filter(c => c._orphan);
    const delQ = CaseSync.getDelQueue();
    const migrated = CaseSync.isMigrated();
    const activeInv = (inv.invoices || []).filter(v => v.status !== '取消').length;

    const box = 'background:rgba(148,163,184,0.08);border:1px solid var(--border-color,#334155);border-radius:10px;padding:12px 14px;margin-top:12px;';
    const row = (k, v) => `<div style="display:flex;gap:10px;padding:3px 0;"><div style="width:150px;color:var(--text-muted);flex-shrink:0;">${k}</div><div style="flex:1;">${v}</div></div>`;

    let html = `
      <div style="${box}margin-top:0;">
        ${row('この端末の名前', `<strong>${this._esc(device) || '<span style="color:#f59e0b">未設定</span>'}</strong>
            <button class="btn btn-ghost" style="padding:2px 10px;font-size:0.75rem;margin-left:8px;" onclick="SyncPanel.editDeviceName()">変更</button>`)}
        ${row('同期方式', migrated ? '🟢 項目単位の同期（新方式）' : '⏳ 切替え準備中（次の同期で自動的に切り替わります）')}
        ${row('最後に受信', this._fmt(s.lastPullAt))}
        ${row('最後に送信', this._fmt(s.lastFlushAt))}
        ${row('未送信', pending.length + delQ.length ? `<strong style="color:#f59e0b">${pending.length}件${delQ.length ? `（削除 ${delQ.length}件）` : ''}</strong>` : 'なし')}
        ${s.lastError ? row('最後のエラー', `<span style="color:#f87171">${this._esc(s.lastError)}（${this._fmt(s.lastErrorAt)}）</span><br><span style="font-size:0.75rem;color:var(--text-muted)">※未送信の変更は端末に残っており、1分ごとに自動で再送します</span>`) : ''}
        ${row('請求データ', inv.loadedAt ? `有効な請求書 ${activeInv}件（${this._fmt(inv.loadedAt)} 取得）` : '<span style="color:#f59e0b">未取得（同期すると取得します。取得前は請求書を発行できません）</span>')}
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="syncPanelNowBtn" onclick="SyncPanel.syncNow()">🔄 今すぐ同期</button>
          ${typeof ClosingCheck !== 'undefined' ? '<button class="btn btn-secondary" onclick="SyncPanel.close();ClosingCheck.show()">📋 締め前チェック</button>' : ''}
        </div>
      </div>`;

    if (pending.length) {
      html += `<div style="${box}"><div style="font-weight:700;margin-bottom:6px;">📤 未送信の案件（${pending.length}件）</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">通信できるようになると自動で送信されます。</div>
        ${pending.slice(0, 30).map(c => {
          const f = CaseSync.pendingFields(c);
          const labels = c._new ? '新規登録' : f.map(k => this.FIELD_LABELS[k] || k).slice(0, 5).join('・') + (f.length > 5 ? ` ほか${f.length - 5}項目` : '');
          return `<div style="padding:4px 0;border-top:1px dashed var(--border-color,#334155);">${this._esc(c.title || c.id)} <span style="color:var(--text-muted);font-size:0.75rem;">${this._esc(this._clientName(c.clientId))} ／ ${this._esc(labels)}</span></div>`;
        }).join('')}
        ${pending.length > 30 ? `<div style="color:var(--text-muted);font-size:0.75rem;">…ほか ${pending.length - 30}件</div>` : ''}
      </div>`;
    }

    if (orphans.length) {
      html += `<div style="${box}border-color:#b45309;"><div style="font-weight:700;margin-bottom:6px;">⚠️ スプレッドシートに無い案件（${orphans.length}件）</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">この端末にだけ残っている案件です。必要なものは「送信」、他の端末で削除済みなどで不要なものは「この端末から削除」を押してください。</div>
        ${orphans.map(c => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px dashed var(--border-color,#334155);">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;cursor:pointer;" onclick="SyncPanel.openCase('${c.id}')">${this._esc(c.title || c.id)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${this._esc(this._clientName(c.clientId))} ／ 登録 ${this._esc(String(c.createdAt || '').slice(0, 10))} ／ ${this._esc(c.status || '')}</div>
            </div>
            <button class="btn btn-secondary" style="padding:3px 10px;font-size:0.75rem;" onclick="SyncPanel.resolve('${c.id}','send')">送信</button>
            <button class="btn btn-ghost" style="padding:3px 10px;font-size:0.75rem;color:#f87171;" onclick="SyncPanel.resolve('${c.id}','drop')">この端末から削除</button>
          </div>`).join('')}
      </div>`;
    }

    html += `<div style="${box}" id="syncPanelBackups"><div style="font-weight:700;margin-bottom:6px;">💾 自動バックアップ（この端末）</div><div style="color:var(--text-muted)">読み込み中…</div></div>`;
    body.innerHTML = html;
    this.renderBackups();
  },

  async renderBackups() {
    const el = document.getElementById('syncPanelBackups');
    if (!el || typeof AutoBackup === 'undefined') return;
    const list = await AutoBackup.list();
    el.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:6px;">
        <div style="font-weight:700;flex:1;">💾 自動バックアップ（この端末・毎日1回・7日分）</div>
        <button class="btn btn-ghost" style="padding:2px 10px;font-size:0.75rem;" onclick="SyncPanel.backupNow()">今すぐ保存</button>
      </div>
      ${list.length ? list.map(b => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px dashed var(--border-color,#334155);">
          <div style="flex:1;">${this._fmt(b.id)} <span style="color:var(--text-muted);font-size:0.75rem;">${this._esc(b.reason)} ／ 案件${b.cases}件 ／ ${Math.round((b.size || 0) / 1024).toLocaleString()}KB</span></div>
          <button class="btn btn-ghost" style="padding:2px 10px;font-size:0.75rem;" onclick="AutoBackup.download('${b.id}')">⬇ ダウンロード</button>
        </div>`).join('') : '<div style="color:var(--text-muted)">まだありません（起動の数秒後に自動で保存されます）</div>'}`;
  },

  async backupNow() {
    await AutoBackup.snapshot('手動保存', true);
    this.renderBackups();
    App.showToast('この端末内に保存しました');
  },

  async syncNow() {
    const btn = document.getElementById('syncPanelNowBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 同期中…'; }
    try {
      await SpreadsheetSync.syncNow();
    } finally {
      this.refresh();
    }
  },

  editDeviceName() {
    const cur = InvoiceSync.getDeviceName();
    const name = prompt('この端末の名前（例：事務所PC1、代表ノート）', cur || '');
    if (name === null) return;
    InvoiceSync.setDeviceName(name);
    this.refresh();
  },

  resolve(id, action) {
    const c = Store.getCase(id);
    if (!c) return;
    if (action === 'drop' && !confirm(`「${c.title || id}」をこの端末から削除します。\n（スプレッドシートや他の端末には影響しません）`)) return;
    if (action === 'send' && !confirm(`「${c.title || id}」をスプレッドシートへ送信し、全端末で共有します。`)) return;
    CaseSync.resolveOrphan(id, action);
    this.refresh();
  },

  openCase(id) {
    if (typeof Cases !== 'undefined' && typeof Cases.showEditModal === 'function') {
      this.close();
      Cases.showEditModal(id);
    }
  },
};
