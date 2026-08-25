/**
 * FAX送受信管理モジュール（eFax連携）
 */
const FaxManager = {

  render() {
    return `
      <div class="fax-page">
        <div class="page-header">
          <h1>📠 FAX管理</h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="FaxManager.showSendModal()">
              📤 FAX送信
            </button>
            <button class="btn btn-secondary btn-small" onclick="FaxManager.checkIncoming()">
              📥 受信チェック
            </button>
            <button class="btn btn-secondary btn-small" onclick="FaxManager.loadLog()">
              🔄 履歴更新
            </button>
          </div>
        </div>

        <div id="faxLog" class="fax-log">
          <p class="empty-message">📋 「履歴更新」ボタンで送受信履歴を読み込みます</p>
        </div>
      </div>
      ${this.renderSendModal()}
    `;
  },

  // ---- 送信モーダル ----
  renderSendModal() {
    const clients = Store.getClients();
    const clientOptions = clients.map(c =>
      `<option value="${c.name}">${c.name}</option>`
    ).join('');

    return `
      <div id="faxSendModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="FaxManager.closeSendModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2>📤 FAX送信</h2>
            <button class="modal-close" onclick="FaxManager.closeSendModal()">✕</button>
          </div>
          <form id="faxSendForm" onsubmit="FaxManager.onSend(event)">
            <div class="form-row">
              <div class="form-group">
                <label>FAX番号 <span class="required">*</span></label>
                <input type="tel" name="faxNumber" id="faxNumber" required
                  placeholder="例：0312345678" pattern="[0-9\\-]+"
                  style="width:100%">
              </div>
              <div class="form-group">
                <label>顧客（記録用）</label>
                <select name="clientName" id="faxClientName">
                  <option value="">— 選択 —</option>
                  ${clientOptions}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>件名（カバーページ）</label>
              <input type="text" name="subject" id="faxSubject"
                placeholder="例：車庫証明申請書の送付" style="width:100%">
            </div>
            <div class="form-group">
              <label>本文（カバーページ内容）</label>
              <textarea name="body" id="faxBody" rows="3"
                placeholder="いつもお世話になっております。&#10;下記の書類を送付いたします。"></textarea>
            </div>
            <div class="form-group">
              <label>PDF添付</label>
              <input type="file" id="faxFile" accept=".pdf"
                onchange="FaxManager.onFileSelect(event)">
              <small style="color:var(--text-muted)">PDF形式のみ対応</small>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="FaxManager.closeSendModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">📠 送信</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  showSendModal() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚙️ スプレッドシート連携を設定してください');
      return;
    }
    document.getElementById('faxSendModal').style.display = 'flex';
  },

  closeSendModal() {
    document.getElementById('faxSendModal').style.display = 'none';
  },

  selectedPdfBase64: null,
  selectedPdfName: null,

  onFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      // data:application/pdf;base64,XXXX → base64部分だけ取り出す
      const base64 = reader.result.split(',')[1];
      FaxManager.selectedPdfBase64 = base64;
      FaxManager.selectedPdfName = file.name;
    };
    reader.readAsDataURL(file);
  },

  async onSend(e) {
    e.preventDefault();

    const faxNumber = document.getElementById('faxNumber').value.trim();
    const subject = document.getElementById('faxSubject').value.trim();
    const body = document.getElementById('faxBody').value.trim();
    const clientName = document.getElementById('faxClientName').value;

    if (!faxNumber) {
      App.showToast('FAX番号を入力してください');
      return;
    }

    App.showToast('📠 FAX送信中...');
    this.closeSendModal();

    try {
      const data = {
        faxNumber,
        subject: subject || 'FAX送信',
        body,
        clientName,
      };

      if (this.selectedPdfBase64) {
        data.pdfBase64 = this.selectedPdfBase64;
        data.pdfName = this.selectedPdfName;
      }

      const result = await SpreadsheetSync.pushCalendarEvent('sendFax', data);

      if (result && result.success) {
        App.showToast('✅ ' + result.message);
        this.selectedPdfBase64 = null;
        this.selectedPdfName = null;
        this.loadLog();
      } else if (result && result.error) {
        App.showToast('❌ ' + result.error);
      } else {
        App.showToast('❌ FAX送信に失敗しました');
      }

    } catch (err) {
      App.showToast('❌ 通信エラー: ' + err.message);
    }
  },

  // ---- 受信チェック ----
  async checkIncoming() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚙️ スプレッドシート連携を設定してください');
      return;
    }

    App.showToast('📥 受信FAXをチェック中...');

    try {
      const result = await SpreadsheetSync.pushCalendarEvent('checkFax', {});

      if (result && result.success) {
        App.showToast(`📥 ${result.saved}件の受信FAXを保存しました`);
        this.loadLog();
      } else if (result && result.error) {
        App.showToast('❌ ' + result.error);
      }

    } catch (err) {
      App.showToast('❌ 通信エラー: ' + err.message);
    }
  },

  // ---- 送受信ログ ----
  async loadLog() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚙️ スプレッドシート連携を設定してください');
      return;
    }

    App.showToast('📋 履歴を読み込み中...');

    try {
      const url = SpreadsheetSync.getGasUrl();
      const response = await fetch(url + '?type=faxLog');
      const data = await response.json();

      if (data.error) {
        App.showToast('❌ ' + data.error);
        return;
      }

      const logs = data.faxLog || [];
      // ローカルストレージにキャッシュして他画面でも参照可能に
      localStorage.setItem('gyosei_fax_logs', JSON.stringify(logs));
      const logEl = document.getElementById('faxLog');

      if (logs.length === 0) {
        logEl.innerHTML = '<p class="empty-message">送受信履歴はありません</p>';
        return;
      }

      const cases = Store.getCases();

      logEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary);text-align:left">
              <th style="padding:10px 12px">日時</th>
              <th style="padding:10px 12px">種別</th>
              <th style="padding:10px 12px">番号/送信元</th>
              <th style="padding:10px 12px">件名</th>
              <th style="padding:10px 12px">顧客</th>
              <th style="padding:10px 12px;text-align:center">対応ステータス</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => {
              const faxId = l.id || (l.date + '_' + l.number);
              const linkedCase = cases.find(c => c.faxId === faxId);
              
              let actionHtml = '';
              if (l.direction === '受信') {
                if (linkedCase) {
                  actionHtml = `<span style="color:var(--accent-green);font-weight:600;cursor:pointer" onclick="App.navigate('cases'); setTimeout(() => Cases.showEditModal('${linkedCase.id}'), 100)">✅ 案件登録済</span>`;
                } else {
                  actionHtml = `<button class="btn btn-secondary btn-small" onclick="FaxManager.createCase('${l.date}', '${l.number}', '${l.subject}', '${l.clientName || ''}')">➕ 案件登録</button>`;
                }
              } else {
                actionHtml = '<span style="color:var(--text-muted)">—</span>';
              }

              return `
                <tr style="border-bottom:1px solid var(--border-color)">
                  <td style="padding:8px 12px;white-space:nowrap">${l.date}</td>
                  <td style="padding:8px 12px">
                    <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;
                      ${l.direction === '送信' ? 'background:#dbeafe;color:#2563eb' : 'background:#dcfce7;color:#16a34a'}">
                      ${l.direction === '送信' ? '📤 送信' : '📥 受信'}
                    </span>
                  </td>
                  <td style="padding:8px 12px">${l.number}</td>
                  <td style="padding:8px 12px">${l.subject}</td>
                  <td style="padding:8px 12px">${l.clientName || '—'}</td>
                  <td style="padding:8px 12px;text-align:center">${actionHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      App.showToast(`📋 ${logs.length}件の履歴を表示`);

    } catch (err) {
      App.showToast('❌ 通信エラー: ' + err.message);
    }
  },

  // 受信FAXから案件を登録し、自動で紐付ける
  createCase(date, number, subject, clientName) {
    const faxId = date + '_' + number;
    const clients = Store.getClients();
    const client = clients.find(c => c.name === clientName || c.companyName === clientName);
    
    const prefills = {
      title: `${clientName ? clientName + '様' : ''} FAX依頼件（${date}）`,
      clientId: client ? client.id : '',
      category: 'garage_paper',
      memo: '',
      faxId: faxId
    };
    
    App.navigate('cases');
    setTimeout(() => {
      Cases.showAddModal(prefills);
    }, 100);
  },

  // 未対応の受信FAXを抽出する
  getUnprocessedFaxes() {
    const logs = JSON.parse(localStorage.getItem('gyosei_fax_logs') || '[]');
    const cases = Store.getCases();
    
    return logs.filter(l => {
      if (l.direction !== '受信') return false;
      const faxId = l.id || (l.date + '_' + l.number);
      const linked = cases.some(c => c.faxId === faxId);
      return !linked;
    });
  },
};
