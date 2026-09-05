/**
 * 場所マスター管理（モーダル形式）
 */
const LocationManager = {
  editingId: null,

  show() {
    // 既存モーダルを削除
    const existing = document.getElementById('locationManagerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'locationManagerModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = this._renderModalContent();
    document.body.appendChild(modal);
  },

  close() {
    const modal = document.getElementById('locationManagerModal');
    if (modal) modal.remove();
    this.editingId = null;
  },

  _renderModalContent() {
    const locations = Store.getLocations();
    return `
      <div class="modal-overlay" onclick="LocationManager.close()"></div>
      <div class="modal-content modal-large" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>📍 場所マスター管理</h2>
          <button class="modal-close" onclick="LocationManager.close()">✕</button>
        </div>
        <div style="margin-bottom:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="LocationManager.showAddForm()">
            <span class="btn-icon">＋</span> 場所を追加
          </button>
          <button class="btn btn-secondary" onclick="Cases.promptApplyLatestPoliceFees()" style="font-size:0.85rem;" title="登録済みの車庫証明案件に、警察署マスタの最新報酬額を一括適用します">
            📍 登録案件に最新報酬を一括適用
          </button>
        </div>
        <div id="locationFormArea"></div>
        <div id="locationList">
          ${this._renderList(locations)}
        </div>
      </div>
    `;
  },

  _renderList(locations) {
    if (locations.length === 0) {
      return '<p style="color:var(--text-muted);font-size:0.9rem">登録された場所はありません</p>';
    }
    return `
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color);text-align:left">
            <th style="padding:8px 12px">場所名</th>
            <th style="padding:8px 12px">車庫報酬(一般)</th>
            <th style="padding:8px 12px">住所</th>
            <th style="padding:8px 12px">メモ</th>
            <th style="padding:8px 12px;width:80px"></th>
          </tr>
        </thead>
        <tbody>
          ${locations.map(loc => `
            <tr style="border-bottom:1px solid var(--border-color)" id="loc-row-${loc.id}">
              <td style="padding:8px 12px;font-weight:600">📍 ${loc.name}</td>
              <td style="padding:8px 12px;color:var(--accent-gold, #f59e0b);font-weight:600">
                ${(loc.syakoFee && Number(loc.syakoFee) > 0) ? `¥${Number(loc.syakoFee).toLocaleString()}` : '<span style="color:var(--text-muted);font-weight:normal">—</span>'}
              </td>
              <td style="padding:8px 12px;color:var(--text-muted)">${loc.address || '—'}</td>
              <td style="padding:8px 12px;color:var(--text-muted)">${loc.memo || '—'}</td>
              <td style="padding:8px 12px;white-space:nowrap">
                <button class="btn btn-secondary btn-small" onclick="LocationManager.showEditForm('${loc.id}')">✏️</button>
                <button class="btn btn-danger btn-small" onclick="LocationManager.onDelete('${loc.id}')" style="margin-left:4px">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  _refreshList() {
    const listEl = document.getElementById('locationList');
    if (listEl) listEl.innerHTML = this._renderList(Store.getLocations());
  },

  showAddForm() {
    this.editingId = null;
    const area = document.getElementById('locationFormArea');
    if (!area) return;
    area.innerHTML = this._renderForm(null);
  },

  showEditForm(id) {
    this.editingId = id;
    const loc = Store.getLocation(id);
    if (!loc) return;
    const area = document.getElementById('locationFormArea');
    if (!area) return;
    area.innerHTML = this._renderForm(loc);
  },

  _renderForm(loc) {
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:12px">${loc ? '場所を編集' : '場所を追加'}</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>場所名 <span class="required">*</span></label>
            <input type="text" id="lf_name" value="${loc ? loc.name : ''}" placeholder="例：一宮警察署、小牧警察署">
          </div>
          <div class="form-group" style="flex:1">
            <label>車庫証明 一般報酬（円） <span style="font-size:0.75rem;color:var(--text-muted)">※警察署</span></label>
            <input type="number" id="lf_syakoFee" value="${loc && loc.syakoFee ? loc.syakoFee : ''}" placeholder="例：4000" min="0" step="100">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>住所</label>
            <input type="text" id="lf_address" value="${loc ? (loc.address || '') : ''}" placeholder="例：一宮市本町1-6-20">
          </div>
          <div class="form-group" style="flex:1">
            <label>メモ</label>
            <input type="text" id="lf_memo" value="${loc ? (loc.memo || '') : ''}" placeholder="例：愛知県警、管轄区域など">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary" onclick="LocationManager.cancelForm()">キャンセル</button>
          <button class="btn btn-primary" onclick="LocationManager.onSubmit()">保存</button>
        </div>
      </div>
    `;
  },

  cancelForm() {
    const area = document.getElementById('locationFormArea');
    if (area) area.innerHTML = '';
    this.editingId = null;
  },

  onSubmit() {
    const name = (document.getElementById('lf_name')?.value || '').trim();
    if (!name) { App.showToast('場所名を入力してください'); return; }
    const syakoFeeVal = document.getElementById('lf_syakoFee')?.value;
    const syakoFee = (syakoFeeVal !== undefined && syakoFeeVal !== '' && syakoFeeVal !== null) ? Number(syakoFeeVal) : null;
    const data = {
      name,
      syakoFee,
      address: (document.getElementById('lf_address')?.value || '').trim(),
      memo: (document.getElementById('lf_memo')?.value || '').trim(),
    };
    if (this.editingId) {
      Store.updateLocation(this.editingId, data);
      App.showToast('場所を更新しました');
    } else {
      Store.addLocation(data);
      App.showToast('場所を追加しました');
    }
    this.cancelForm();
    this._refreshList();
  },

  onDelete(id) {
    const loc = Store.getLocation(id);
    if (!loc) return;
    if (confirm(`「${loc.name}」を削除しますか？`)) {
      Store.deleteLocation(id);
      this._refreshList();
      App.showToast('場所を削除しました');
    }
  },
};
