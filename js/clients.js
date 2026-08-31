/**
 * 顧客管理画面
 */
const Clients = {
  searchQuery: '',
  editingId: null,

  render() {
    const clients = Store.getClients();
    const filtered = this.searchQuery
      ? clients.filter(c =>
        c.name.includes(this.searchQuery) ||
        c.nameKana.includes(this.searchQuery) ||
        c.phone.includes(this.searchQuery) ||
        c.email.includes(this.searchQuery)
      )
      : clients;

    const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return `
      <div class="clients-page">
        <div class="page-header">
          <h1>顧客・店舗管理</h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button class="btn btn-ghost" onclick="Clients.syncFromSpreadsheet()" title="スプレッドシートの顧客マスタを最新化" style="font-size:0.82rem;">
              🔄 最新を同期
            </button>
            <button class="btn btn-secondary btn-small" onclick="Clients.exportCSV()">📥 CSV</button>
            <button class="btn btn-primary" onclick="Clients.openMasterSheet()" title="Googleスプレッドシートで店舗マスタを追加・編集（管理者専用）">
              <span class="btn-icon">📊</span> スプレッドシートで店舗管理
            </button>
          </div>
        </div>

        <div class="search-bar">
          <input type="text" id="clientSearch" class="search-input" placeholder="🔍 名前・電話・メールで検索..."
            value="${this.searchQuery}" oninput="Clients.onSearch(this.value)">
        </div>

        <div class="client-list">
          ${sorted.length === 0
        ? '<div class="empty-state"><div class="empty-icon">👥</div><p>顧客がまだ登録されていません</p><button class="btn btn-primary" onclick="Clients.openMasterSheet()">スプレッドシートで店舗を追加</button></div>'
        : sorted.map(c => this.renderCard(c)).join('')
      }
        </div>
      </div>
      ${this.renderModal()}
    `;
  },

  // 今月完了分の請求額を計算
  getMonthlyBilling(clientId) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cases = Store.getCasesByClient(clientId);
    const completed = cases.filter(c => {
      if (c.status !== 'done' || !c.fee) return false;
      const doneDate = c.completedAt || c.updatedAt || '';
      return doneDate.startsWith(yearMonth);
    });
    const total = completed.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    return { total, cases: completed };
  },

  renderCard(client) {
    const cases = Store.getCasesByClient(client.id);
    const HIDE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const visibleCases = cases.filter(c => {
      if (c.status !== 'done' || !c.completedAt) return true;
      return (now - new Date(c.completedAt).getTime()) < HIDE_AFTER_MS;
    });
    const activeCases = visibleCases.filter(c => c.status !== 'done');
    const staffName = Store.getStaffName(client.staffId);
    const typeBadge = client.type === '法人'
      ? '<span class="badge badge-corp">法人</span>'
      : '<span class="badge badge-personal">個人</span>';
    const billing = this.getMonthlyBilling(client.id);
    return `
      <div class="client-card" onclick="Clients.showDetail('${client.id}')">
        <div class="client-card-header">
          <div class="client-avatar">${client.name.charAt(0)}</div>
          <div class="client-info">
            <div class="client-name">${typeBadge} ${client.name}</div>
            <div class="client-kana">${client.nameKana || ''}</div>
          </div>
          <div class="client-cases-badge">
            ${activeCases.length > 0
        ? `<span class="badge badge-active">${activeCases.length}件進行中</span>`
        : visibleCases.length > 0
          ? `<span class="badge badge-done">${visibleCases.length}件完了</span>`
          : `<span class="badge badge-none">案件なし</span>`}
          </div>
        </div>
        <div class="client-card-body">
          ${client.phone ? `<div class="client-detail"><span class="detail-icon">📞</span> ${client.phone}</div>` : ''}
          ${client.fax ? `<div class="client-detail"><span class="detail-icon">📠</span> ${client.fax}</div>` : ''}
          ${client.email ? `<div class="client-detail"><span class="detail-icon">✉️</span> ${client.email}</div>` : ''}
          ${client.address ? `<div class="client-detail"><span class="detail-icon">📍</span> ${client.address}</div>` : ''}
          ${client.staffId ? `<div class="client-detail"><span class="detail-icon">👤</span> 担当: ${staffName}</div>` : ''}
          ${billing.total > 0 ? `<div class="client-billing">💰 今月請求: <strong>${billing.total.toLocaleString()}円</strong> (${billing.cases.length}件)</div>` : ''}
        </div>
      </div>
    `;
  },

  renderModal() {
    const staffOptions = Store.getStaff().map(s =>
      `<option value="${s.id}">${s.name}${s.role ? ' (' + s.role + ')' : ''}</option>`
    ).join('');

    return `
      <div id="clientModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Clients.closeModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="clientModalTitle">顧客登録</h2>
            <button class="modal-close" onclick="Clients.closeModal()">✕</button>
          </div>
          <form id="clientForm" onsubmit="Clients.onSubmit(event)">
            <div class="form-row">
              <div class="form-group">
                <label>氏名 <span class="required">*</span></label>
                <input type="text" name="name" id="cf_name" required placeholder="山田 太郎">
              </div>
              <div class="form-group">
                <label>フリガナ</label>
                <input type="text" name="nameKana" id="cf_nameKana" placeholder="ヤマダ タロウ">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>区分</label>
                <select name="type" id="cf_type">
                  <option value="個人">個人</option>
                  <option value="法人">法人</option>
                </select>
              </div>
              <div class="form-group">
                <label>担当者</label>
                <select name="staffId" id="cf_staffId">
                  <option value="">— 選択 —</option>
                  ${staffOptions}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>電話番号</label>
                <input type="tel" name="phone" id="cf_phone" placeholder="090-1234-5678">
              </div>
              <div class="form-group">
                <label>FAX番号</label>
                <input type="tel" name="fax" id="cf_fax" placeholder="03-1234-5678">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>メール</label>
                <input type="email" name="email" id="cf_email" placeholder="example@mail.com">
              </div>
              <div class="form-group">
                <label>郵便番号</label>
                <input type="text" name="zip" id="cf_zip" placeholder="460-0001">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>紹介元</label>
                <input type="text" name="referral" id="cf_referral" placeholder="田中先生紹介">
              </div>
              <div class="form-group">
                <!-- 空スペース -->
              </div>
            </div>
            <div class="form-group">
              <label>住所</label>
              <input type="text" name="address" id="cf_address" placeholder="愛知県名古屋市...">
            </div>
            <div class="form-group">
              <label>メモ</label>
              <textarea name="memo" id="cf_memo" rows="3" placeholder="その他メモ..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="Clients.closeModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  onSearch(query) {
    this.searchQuery = query;
    App.refreshView();
  },

  openMasterSheet() {
    const doOpen = () => {
      const config = typeof SpreadsheetSync !== 'undefined' ? SpreadsheetSync.getConfig() : {};
      const sheetUrl = config.sheetUrl || 'https://docs.google.com/spreadsheets/d/1Xl2865N11qQ8lWv5xGZ2r19m4oM3a3X-kX4E91W5jEw/edit';
      window.open(sheetUrl, '_blank');
      App.showToast('📊 スプレッドシート（店舗マスタ）を開きました');
    };

    if (typeof Auth !== 'undefined' && typeof Auth.promptAdminPin === 'function') {
      Auth.promptAdminPin(doOpen, '店舗マスタ管理（管理者専用）');
    } else {
      doOpen();
    }
  },

  async syncFromSpreadsheet() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      alert('スプレッドシート連携（GAS URL）が設定されていません');
      return;
    }
    try {
      App.showToast('🔄 スプレッドシートから最新データを取得中...');
      const res = await SpreadsheetSync.pull();
      App.refreshView();
      App.showToast(`✅ 同期完了: 店舗 ${res.customers} 件、案件 ${res.cases} 件を更新しました`);
    } catch (e) {
      alert('同期に失敗しました: ' + e.message);
    }
  },

  showAddModal() {
    const doShow = () => {
      this.editingId = null;
      App.refreshView();
      setTimeout(() => {
        document.getElementById('clientModalTitle').textContent = '顧客・店舗登録（管理者）';
        document.getElementById('clientForm').reset();
        document.getElementById('clientModal').style.display = 'flex';
      }, 0);
    };

    if (typeof Auth !== 'undefined' && typeof Auth.promptAdminPin === 'function') {
      Auth.promptAdminPin(doShow, '店舗新規登録（管理者認証）');
    } else {
      doShow();
    }
  },

  showEditModal(id) {
    const doShow = () => {
      this.editingId = id;
      const client = Store.getClient(id);
      if (!client) return;
      App.refreshView();
      setTimeout(() => {
        document.getElementById('clientModalTitle').textContent = '顧客・店舗編集（管理者）';
        document.getElementById('cf_name').value = client.name;
        document.getElementById('cf_nameKana').value = client.nameKana || '';
        document.getElementById('cf_type').value = client.type || '個人';
        document.getElementById('cf_staffId').value = client.staffId || '';
        document.getElementById('cf_phone').value = client.phone || '';
        document.getElementById('cf_fax').value = client.fax || '';
        document.getElementById('cf_email').value = client.email || '';
        document.getElementById('cf_zip').value = client.zip || '';
        document.getElementById('cf_referral').value = client.referral || '';
        document.getElementById('cf_address').value = client.address || '';
        document.getElementById('cf_memo').value = client.memo || '';
        document.getElementById('clientModal').style.display = 'flex';
      }, 0);
    };

    if (typeof Auth !== 'undefined' && typeof Auth.promptAdminPin === 'function') {
      Auth.promptAdminPin(doShow, '店舗情報編集（管理者認証）');
    } else {
      doShow();
    }
  },

  closeModal() {
    document.getElementById('clientModal').style.display = 'none';
    this.editingId = null;
  },

  onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value.trim(),
      nameKana: form.nameKana.value.trim(),
      type: form.type.value,
      staffId: form.staffId.value,
      phone: form.phone.value.trim(),
      fax: form.fax ? form.fax.value.trim() : '',
      email: form.email.value.trim(),
      zip: form.zip.value.trim(),
      referral: form.referral.value.trim(),
      address: form.address.value.trim(),
      memo: form.memo.value.trim(),
    };
    if (this.editingId) {
      Store.updateClient(this.editingId, data);
    } else {
      Store.addClient(data);
    }
    this.closeModal();
    App.refreshView();
    App.showToast(this.editingId ? '顧客情報を更新しました' : '顧客を登録しました');
  },

  showDetail(id) {
    const client = Store.getClient(id);
    if (!client) return;
    const cases = Store.getCasesByClient(id);
    const CATEGORY_LABELS = { garage_oss: '🚗 車庫証明（OSS）', garage_paper: '📄 車庫証明（紙）', seal: '🔩 出張封印', car_reg_standard: '🚘 普通車登録', car_reg_light: '🚙 軽自動車登録' };
    const STATUS_LABELS = { received: '受付', applying: '申請中', delivery: '交付・受取', done: '完了・納品' };
    const staffName = Store.getStaffName(client.staffId);
    const typeBadge = client.type === '法人'
      ? '<span class="badge badge-corp">法人</span>'
      : '<span class="badge badge-personal">個人</span>';
    const billing = this.getMonthlyBilling(id);
    const now = new Date();
    const billingMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'clientDetailModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('clientDetailModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${typeBadge} ${client.name} の詳細</h2>
          <button class="modal-close" onclick="document.getElementById('clientDetailModal').remove()">✕</button>
        </div>
        <div class="detail-section">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">フリガナ</span><span>${client.nameKana || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">区分</span><span>${client.type || '個人'}</span></div>
            <div class="detail-item"><span class="detail-label">電話</span><span>${client.phone || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">FAX</span><span>${client.fax || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">メール</span><span>${client.email || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">郵便番号</span><span>${client.zip || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">住所</span><span>${client.address || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">担当者</span><span>${staffName}</span></div>
            <div class="detail-item"><span class="detail-label">紹介元</span><span>${client.referral || '—'}</span></div>
            ${client.type === '法人' ? `
            <div class="detail-item"><span class="detail-label">法人名</span><span>${client.companyName || '—'}</span></div>
            <div class="detail-item"><span class="detail-label">法人番号</span><span>${client.companyNumber || '—'}</span></div>
            ` : ''}
            <div class="detail-item full-width"><span class="detail-label">メモ</span><span>${client.memo || '—'}</span></div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-secondary" onclick="document.getElementById('clientDetailModal').remove(); Clients.showEditModal('${client.id}')">✏️ 編集</button>
            <button class="btn btn-primary" onclick="document.getElementById('clientDetailModal').remove(); Invoice.showSelectModal('${client.id}')">📄 請求書発行</button>
            <button class="btn btn-secondary" onclick="document.getElementById('clientDetailModal').remove(); Invoice.showSelectModal('${client.id}', 'estimate')" style="background:var(--accent-gold, #f59e0b);color:#fff;border:none">📄 見積書発行</button>
            <button class="btn btn-danger" onclick="if(confirm('この顧客と紐づく案件を全て削除しますか？')){Store.deleteClient('${client.id}'); document.getElementById('clientDetailModal').remove(); App.refreshView(); App.showToast('顧客を削除しました');}">🗑️ 削除</button>
          </div>
        </div>
        <div class="detail-section billing-section">
          <h3>💰 ${billingMonth}分 請求額</h3>
          ${billing.total > 0 ? `
            <div class="billing-total">¥${billing.total.toLocaleString()}</div>
            <div class="billing-breakdown">
              ${billing.cases.map(c => `
                <div class="billing-item">
                  <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category]}</span>
                  <span class="billing-item-title">${c.title}</span>
                  <span class="billing-item-fee">¥${Number(c.fee).toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
            <div class="billing-note">※ 完了案件のみ・月末締め</div>
          ` : '<p class="empty-message">今月の請求はありません</p>'}
        </div>
        <div class="detail-section">
          <h3>📋 案件一覧 (${cases.length}件)</h3>
          ${cases.length === 0
        ? '<p class="empty-message">紐づく案件はありません</p>'
        : `<div class="mini-case-list">${cases.map(c => `
                <div class="mini-case-item" onclick="const m=document.getElementById('clientDetailModal'); if(m) m.remove(); Cases.showEditModal('${c.id}');" style="cursor:pointer; transition:background 0.15s;" onmouseenter="this.style.background='var(--bg-gray, #f3f4f6)'" onmouseleave="this.style.background='transparent'">
                  <span class="category-tag category-${c.category}">${CATEGORY_LABELS[c.category]}</span>
                  <span class="mini-case-title">${c.title}</span>
                  ${c.fee ? `<span class="mini-case-fee">¥${Number(c.fee).toLocaleString()}</span>` : ''}
                  <span class="status-badge status-${c.status}">${STATUS_LABELS[c.status]}</span>
                  <span style="color:var(--text-muted); font-size:0.72rem; margin-left:auto;">📝 詳細 ➔</span>
                </div>`).join('')}</div>`
      }
        </div>
        <div class="detail-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0">👤 顧客担当者</h3>
            <button class="btn btn-secondary btn-small" onclick="Clients.showContactAddForm('${client.id}')">＋ 追加</button>
          </div>
          <div id="clientContactArea_${client.id}">
            ${this._renderContactList(client.id)}
          </div>
        </div>
        <div class="detail-section">
          ${typeof ActivityLog !== 'undefined' ? ActivityLog.renderWidget('client', id) : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  exportCSV() {
    const clients = Store.getClients();
    if (clients.length === 0) {
      App.showToast('エクスポートする顧客データがありません');
      return;
    }

    const headers = ['区分', '名前', 'フリガナ', '郵便番号', '住所', '電話番号', 'FAX番号', 'メールアドレス', '紹介元', '登録日', 'メモ'];
    const rows = [headers];

    clients.forEach(c => {
      rows.push([
        c.type || '個人',
        c.name || '',
        c.nameKana || '',
        c.zip || '',
        c.address || '',
        c.phone || '',
        c.fax || '',
        c.email || '',
        c.referral || '',
        c.createdAt ? c.createdAt.slice(0, 10) : '',
        c.memo || ''
      ]);
    });

    // カンマとダブルクォーテーションをエスケープ
    const csvContent = rows.map(r => r.map(v => {
      const escaped = String(v).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')).join('\n');

    // Windows Excelでの文字化け防止用にBOMを付与
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const todayStr = Store.getLocalDateStr();
    const a = document.createElement('a');
    a.href = url;
    a.download = `顧客リスト_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${clients.length}件の顧客データをCSV出力しました`);
  },

  /**
   * かんたんクラウド会計（MJS）取引先マスター インポート用CSV出力
   * 実データ準拠フォーマット: 22,"外部コード","連想","正式名称","簡略名称",1,0
   * エンコード: Shift-JIS（CP932）、ヘッダー行なし、改行CRLF
   * 連想フィールド: 半角カタカナ（全角カタカナから自動変換）
   */
  exportKantanCSV() {
    const clients = Store.getClients();
    if (clients.length === 0) {
      App.showToast('エクスポートする顧客データがありません');
      return;
    }

    const lines = [];
    const usedRenso = {}; // 連想の重複チェック用

    clients.forEach((c, idx) => {
      // 外部コード: 半角数字、ゼロ埋めなし、1始まりの連番
      const code = String(idx + 1);

      // 連想: 支店名・店名部分の半角カタカナを優先（かんたんクラウド会計の仕様）
      // nameKanaにスペースがあれば後半部分（支店名カナ）を使用
      // 重複する場合は末尾に番号を付与して一意にする
      const kana = (c.nameKana || '').trim();
      const nameParts = (c.name || '').trim().split(/[\s　]+/);
      let rawRenso;
      if (kana.includes(' ') || kana.includes('　')) {
        // カナにスペースあり → 後半（支店名部分）を使用
        const kanaParts = kana.split(/[\s　]+/);
        rawRenso = kanaParts[kanaParts.length - 1];
      } else if (nameParts.length > 1) {
        // カナにスペースなし、名前にスペースあり → 名前の後半部分をそのまま使用
        rawRenso = kana || nameParts[nameParts.length - 1];
      } else {
        // スペースなし → カナまたは名前全体
        rawRenso = kana || c.name || '';
      }
      rawRenso = rawRenso.replace(/[\s　]/g, '');
      // 半角カタカナ変換後に10文字制限（濁音は2文字に展開されるため変換後に切る）
      let renso = this._toHankakuKana(rawRenso).slice(0, 10);
      if (usedRenso[renso]) {
        usedRenso[renso]++;
        const suffix = String(usedRenso[renso]);
        renso = renso.slice(0, 10 - suffix.length) + suffix;
      } else {
        usedRenso[renso] = 1;
      }

      // 正式名称: 会社名があれば会社名、なければ顧客名
      const fullName = (c.companyName || c.name || '').slice(0, 60);

      // 簡略名称: 顧客名をそのまま使用
      const shortName = (c.name || '').slice(0, 7);

      // 実データ準拠: マスタ区分・得意先区分・仕入先区分はクォーテーションなし
      //               外部コード・連想・正式名称・簡略名称はクォーテーションあり
      const q = v => `"${String(v).replace(/"/g, '""')}"`;
      lines.push(`22,${q(code)},${q(renso)},${q(fullName)},${q(shortName)},1,0`);
    });

    const csvText = lines.join('\r\n') + '\r\n';

    // Shift-JIS (CP932) にエンコードしてダウンロード
    const sjisBytes = this._encodeShiftJIS(csvText);
    const blob = new Blob([sjisBytes], { type: 'text/csv;charset=shift_jis' });
    const url = URL.createObjectURL(blob);

    const todayStr = Store.getLocalDateStr();
    const a = document.createElement('a');
    a.href = url;
    a.download = `取引先マスタ_かんたんクラウド会計_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${clients.length}件の取引先データを会計ソフト向けCSVで出力しました`);
  },

  /**
   * 全角カタカナ → 半角カタカナ変換
   * 濁音・半濁音は2文字（基本文字＋濁点/半濁点）に分解
   */
  _toHankakuKana(str) {
    const MAP = {
      'ア':'ｱ','イ':'ｲ','ウ':'ｳ','エ':'ｴ','オ':'ｵ',
      'カ':'ｶ','キ':'ｷ','ク':'ｸ','ケ':'ｹ','コ':'ｺ',
      'サ':'ｻ','シ':'ｼ','ス':'ｽ','セ':'ｾ','ソ':'ｿ',
      'タ':'ﾀ','チ':'ﾁ','ツ':'ﾂ','テ':'ﾃ','ト':'ﾄ',
      'ナ':'ﾅ','ニ':'ﾆ','ヌ':'ﾇ','ネ':'ﾈ','ノ':'ﾉ',
      'ハ':'ﾊ','ヒ':'ﾋ','フ':'ﾌ','ヘ':'ﾍ','ホ':'ﾎ',
      'マ':'ﾏ','ミ':'ﾐ','ム':'ﾑ','メ':'ﾒ','モ':'ﾓ',
      'ヤ':'ﾔ','ユ':'ﾕ','ヨ':'ﾖ',
      'ラ':'ﾗ','リ':'ﾘ','ル':'ﾙ','レ':'ﾚ','ロ':'ﾛ',
      'ワ':'ﾜ','ヲ':'ｦ','ン':'ﾝ',
      'ァ':'ｧ','ィ':'ｨ','ゥ':'ｩ','ェ':'ｪ','ォ':'ｫ',
      'ッ':'ｯ','ャ':'ｬ','ュ':'ｭ','ョ':'ｮ',
      'ガ':'ｶﾞ','ギ':'ｷﾞ','グ':'ｸﾞ','ゲ':'ｹﾞ','ゴ':'ｺﾞ',
      'ザ':'ｻﾞ','ジ':'ｼﾞ','ズ':'ｽﾞ','ゼ':'ｾﾞ','ゾ':'ｿﾞ',
      'ダ':'ﾀﾞ','ヂ':'ﾁﾞ','ヅ':'ﾂﾞ','デ':'ﾃﾞ','ド':'ﾄﾞ',
      'バ':'ﾊﾞ','ビ':'ﾋﾞ','ブ':'ﾌﾞ','ベ':'ﾍﾞ','ボ':'ﾎﾞ',
      'パ':'ﾊﾟ','ピ':'ﾋﾟ','プ':'ﾌﾟ','ペ':'ﾍﾟ','ポ':'ﾎﾟ',
      'ヴ':'ｳﾞ','ー':'ｰ','・':'･','「':'｢','」':'｣','。':'｡','、':'､',
    };
    let result = '';
    for (const ch of str) {
      result += MAP[ch] || ch;
    }
    return result;
  },

  /**
   * 文字列をShift-JIS (CP932) のUint8Arrayに変換
   * ブラウザ標準のTextEncoderはUTF-8のみ対応のため、手動で変換テーブルを使用
   */
  _encodeShiftJIS(str) {
    // Encoding APIのencoderを利用（対応環境ではpolyfill不要）
    // フォールバック: UTF-8 BOM付きで出力
    try {
      // 方法: Blobからshift_jisへ変換するためにURLエンコード＋デコードのトリックを使用
      const encoder = new TextEncoder();
      const utf8 = encoder.encode(str);

      // Shift-JIS変換テーブルがないため、代替手段を使用:
      // 一時的にFormData+fetchでencodingを指定するか、
      // 直接マッピングテーブルを使う

      // 簡易実装: Unicode→Shift-JISのマッピングテーブルを動的生成
      // 性能上の理由で、初回呼び出し時にキャッシュ
      if (!this._sjisTable) {
        this._sjisTable = this._buildSjisTable();
      }

      const result = [];
      for (let i = 0; i < str.length; i++) {
        const cp = str.codePointAt(i);
        if (cp <= 0x7f) {
          // ASCII
          result.push(cp);
        } else if (cp === 0xFF5E) {
          // ～ (FULLWIDTH TILDE) → Shift-JIS 0x8160
          result.push(0x81, 0x60);
        } else {
          const sjis = this._sjisTable[cp];
          if (sjis !== undefined) {
            if (sjis <= 0xff) {
              result.push(sjis);
            } else {
              result.push((sjis >> 8) & 0xff, sjis & 0xff);
            }
          } else {
            // マッピングなし→?に置換
            result.push(0x3F);
          }
        }
      }
      return new Uint8Array(result);
    } catch (e) {
      // フォールバック: UTF-8 BOM付きで出力
      console.warn('Shift-JIS encoding failed, falling back to UTF-8 BOM', e);
      const bom = '\uFEFF';
      const encoder = new TextEncoder();
      return encoder.encode(bom + str);
    }
  },

  /**
   * Unicode → Shift-JIS 変換テーブルを構築
   * JIS X 0208 の主要な文字を網羅
   */
  _buildSjisTable() {
    const table = {};
    // Shift-JIS の全2バイト文字範囲をスキャンして逆引きテーブルを作成
    // 第1バイト: 0x81-0x9F, 0xE0-0xEF
    // 第2バイト: 0x40-0x7E, 0x80-0xFC
    const decoder = new TextDecoder('shift_jis', { fatal: true });
    const ranges1 = [];
    for (let b = 0x81; b <= 0x9F; b++) ranges1.push(b);
    for (let b = 0xE0; b <= 0xEF; b++) ranges1.push(b);

    for (const b1 of ranges1) {
      for (let b2 = 0x40; b2 <= 0xFC; b2++) {
        if (b2 === 0x7F) continue;
        try {
          const char = decoder.decode(new Uint8Array([b1, b2]));
          if (char && char !== '\uFFFD') {
            const cp = char.codePointAt(0);
            if (!table[cp]) {
              table[cp] = (b1 << 8) | b2;
            }
          }
        } catch (e) {
          // invalid sequence, skip
        }
      }
    }

    // 半角カナ (0xA1-0xDF)
    for (let b = 0xA1; b <= 0xDF; b++) {
      try {
        const char = decoder.decode(new Uint8Array([b]));
        if (char && char !== '\uFFFD') {
          table[char.codePointAt(0)] = b;
        }
      } catch (e) {}
    }

    return table;
  },

  // ---- 顧客担当者管理 ----
  _renderContactList(clientId) {
    const contacts = Store.getClientContacts(clientId);
    if (contacts.length === 0) {
      return '<p style="color:var(--text-muted);font-size:0.875rem;margin:0">担当者が登録されていません</p>';
    }
    return contacts.map(c => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color)">
        <span style="font-weight:600;flex:1;cursor:pointer" onclick="Clients.showContactDetail('${c.id}')">
          👤 ${c.name}
        </span>
        ${c.phone ? `<span style="font-size:0.8rem;color:var(--text-muted)">📞 ${c.phone}</span>` : ''}
        <button class="btn btn-secondary btn-small" onclick="Clients.showContactEditForm('${c.id}', '${clientId}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="Clients.onContactDelete('${c.id}', '${clientId}')">🗑️</button>
      </div>
    `).join('');
  },

  _refreshContactArea(clientId) {
    const area = document.getElementById(`clientContactArea_${clientId}`);
    if (area) area.innerHTML = this._renderContactList(clientId);
  },

  showContactDetail(id) {
    const c = Store.getClientContact(id);
    if (!c) return;
    const popup = document.createElement('div');
    popup.id = 'contactDetailPopup';
    popup.className = 'modal';
    popup.style.display = 'flex';
    popup.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('contactDetailPopup').remove()"></div>
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:380px">
        <div class="modal-header">
          <h2>👤 担当者詳細</h2>
          <button class="modal-close" onclick="document.getElementById('contactDetailPopup').remove()">✕</button>
        </div>
        <div class="detail-grid" style="gap:12px">
          <div class="detail-item"><span class="detail-label">氏名</span><span>${c.name}</span></div>
          <div class="detail-item"><span class="detail-label">電話番号</span><span>${c.phone || '—'}</span></div>
          <div class="detail-item"><span class="detail-label">メール</span><span>${c.email || '—'}</span></div>
          <div class="detail-item full-width"><span class="detail-label">メモ</span><span>${c.memo || '—'}</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
  },

  _contactFormHtml(contact, clientId, isEdit) {
    return `
      <div id="contactFormBox" style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-top:8px">
        <div style="font-weight:600;margin-bottom:10px;font-size:0.9rem">${isEdit ? '担当者を編集' : '担当者を追加'}</div>
        <div class="form-row">
          <div class="form-group">
            <label>氏名 <span class="required">*</span></label>
            <input type="text" id="ccf_name" value="${contact ? contact.name : ''}" placeholder="例：稲垣">
          </div>
          <div class="form-group">
            <label>電話番号</label>
            <input type="tel" id="ccf_phone" value="${contact ? (contact.phone || '') : ''}" placeholder="090-xxxx-xxxx">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>メール</label>
            <input type="email" id="ccf_email" value="${contact ? (contact.email || '') : ''}" placeholder="example@mail.com">
          </div>
          <div class="form-group">
            <label>メモ</label>
            <input type="text" id="ccf_memo" value="${contact ? (contact.memo || '') : ''}" placeholder="備考">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-secondary btn-small" onclick="Clients.cancelContactForm('${clientId}')">キャンセル</button>
          <button class="btn btn-primary btn-small" onclick="Clients.onContactSubmit('${isEdit ? contact.id : ''}', '${clientId}')">保存</button>
        </div>
      </div>
    `;
  },

  showContactAddForm(clientId) {
    const area = document.getElementById(`clientContactArea_${clientId}`);
    if (!area) return;
    // フォームが既にあれば閉じる
    const existing = document.getElementById('contactFormBox');
    if (existing) existing.remove();
    area.insertAdjacentHTML('beforeend', this._contactFormHtml(null, clientId, false));
  },

  showContactEditForm(contactId, clientId) {
    const contact = Store.getClientContact(contactId);
    if (!contact) return;
    const area = document.getElementById(`clientContactArea_${clientId}`);
    if (!area) return;
    const existing = document.getElementById('contactFormBox');
    if (existing) existing.remove();
    area.insertAdjacentHTML('beforeend', this._contactFormHtml(contact, clientId, true));
  },

  cancelContactForm(clientId) {
    const box = document.getElementById('contactFormBox');
    if (box) box.remove();
  },

  onContactSubmit(contactId, clientId) {
    const name = (document.getElementById('ccf_name')?.value || '').trim();
    if (!name) { App.showToast('氏名を入力してください'); return; }
    const data = {
      clientId,
      name,
      phone: (document.getElementById('ccf_phone')?.value || '').trim(),
      email: (document.getElementById('ccf_email')?.value || '').trim(),
      memo: (document.getElementById('ccf_memo')?.value || '').trim(),
    };
    let savedContact;
    if (contactId) {
      savedContact = Store.updateClientContact(contactId, data);
      App.showToast('担当者を更新しました');
    } else {
      savedContact = Store.addClientContact(data);
      App.showToast('担当者を追加しました');
    }
    // スプレッドシートへ同期
    if (savedContact) {
      SpreadsheetSync.push('upsertClientContact', savedContact).catch(e => console.warn('担当者同期エラー:', e));
    }
    this.cancelContactForm(clientId);
    this._refreshContactArea(clientId);
  },

  onContactDelete(contactId, clientId) {
    const c = Store.getClientContact(contactId);
    if (!c) return;
    if (confirm(`「${c.name}」を削除しますか？`)) {
      Store.deleteClientContact(contactId);
      // スプレッドシートからも削除
      SpreadsheetSync.push('deleteClientContact', { id: contactId }).catch(e => console.warn('担当者削除同期エラー:', e));
      this._refreshContactArea(clientId);
      App.showToast('担当者を削除しました');
    }
  },
};
