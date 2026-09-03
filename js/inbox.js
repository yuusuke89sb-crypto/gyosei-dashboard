/**
 * 登録前BOX（受信インボックス ＆ FAX管理）モジュール
 */
const InboxManager = {
  activeTab: sessionStorage.getItem('gyosei_inbox_tab') || 'inbox', // 'inbox' | 'send' | 'history'
  searchQuery: sessionStorage.getItem('gyosei_inbox_search') || '',
  historySearchQuery: sessionStorage.getItem('gyosei_inbox_hist_search') || '',
  filterType: sessionStorage.getItem('gyosei_inbox_filter') || 'all', // 'all' | 'FAX' | 'メール'
  historyFilterType: sessionStorage.getItem('gyosei_inbox_hist_filter') || 'all',
  statusFilter: sessionStorage.getItem('gyosei_inbox_status') || 'all_active', // 'all_active' | 'unhandled' | 'hold'

  render() {
    return `
      <div class="inbox-page" style="display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px;">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="font-size:2rem">📥</span>
            <h1 style="margin:0">登録前BOX</h1>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btn-secondary" onclick="InboxManager.checkIncomingInbox()" id="inboxCheckBtn">
              🔄 受信チェック
            </button>
          </div>
        </div>

        <!-- タブナビゲーション -->
        <div class="tabs" style="display:flex; border-bottom:2px solid var(--border-color); gap:16px; margin-bottom:10px">
          <button class="tab-btn ${this.activeTab === 'inbox' ? 'active' : ''}" onclick="InboxManager.switchTab('inbox')" 
            style="background:none; border:none; padding:10px 16px; font-size:0.95rem; font-weight:600; cursor:pointer; color:${this.activeTab === 'inbox' ? 'var(--primary-color)' : 'var(--text-secondary)'}; border-bottom:3px solid ${this.activeTab === 'inbox' ? 'var(--primary-color)' : 'transparent'}; transition: all 0.2s">
            📥 受信BOX
          </button>
          <button class="tab-btn ${this.activeTab === 'send' ? 'active' : ''}" onclick="InboxManager.switchTab('send')"
            style="background:none; border:none; padding:10px 16px; font-size:0.95rem; font-weight:600; cursor:pointer; color:${this.activeTab === 'send' ? 'var(--primary-color)' : 'var(--text-secondary)'}; border-bottom:3px solid ${this.activeTab === 'send' ? 'var(--primary-color)' : 'transparent'}; transition: all 0.2s">
            📤 FAX送信
          </button>
          <button class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}" onclick="InboxManager.switchTab('history')"
            style="background:none; border:none; padding:10px 16px; font-size:0.95rem; font-weight:600; cursor:pointer; color:${this.activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-secondary)'}; border-bottom:3px solid ${this.activeTab === 'history' ? 'var(--primary-color)' : 'transparent'}; transition: all 0.2s">
            📜 すべての履歴
          </button>
        </div>

        <!-- タブコンテンツ -->
        <div class="tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  },

  renderTabContent() {
    switch (this.activeTab) {
      case 'inbox': return this.renderInboxTab();
      case 'send': return this.renderSendTab();
      case 'history': return this.renderHistoryTab();
      default: return '';
    }
  },

  // ─── 📥 受信BOX タブ ──────────────────────────────────────────
  renderInboxTab() {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    
    // カウントの集計
    const allActiveCount = inbox.filter(i => i.status === '未対応' || i.status === '保留').length;
    const unhandledCount = inbox.filter(i => i.status === '未対応').length;
    const holdCount = inbox.filter(i => i.status === '保留').length;
    const faxCount = inbox.filter(i => (i.status === '未対応' || i.status === '保留') && i.type === 'FAX').length;
    const mailCount = inbox.filter(i => (i.status === '未対応' || i.status === '保留') && i.type === 'メール').length;

    // ステータス絞り込み
    let filtered = [];
    if (this.statusFilter === 'unhandled') {
      filtered = inbox.filter(item => item.status === '未対応');
    } else if (this.statusFilter === 'hold') {
      filtered = inbox.filter(item => item.status === '保留');
    } else {
      filtered = inbox.filter(item => item.status === '未対応' || item.status === '保留');
    }

    // フィルタ種別
    if (this.filterType !== 'all') {
      filtered = filtered.filter(item => item.type === this.filterType);
    }

    // 検索ワード
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        (item.sender && item.sender.toLowerCase().includes(q)) || 
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.body && item.body.toLowerCase().includes(q))
      );
    }

    // ソート（新しい順）
    filtered.sort((a, b) => {
      const ta = a.date ? new Date(String(a.date).includes('-') && !String(a.date).includes('T') ? String(a.date).replace(/-/g, '/') : a.date).getTime() : 0;
      const tb = b.date ? new Date(String(b.date).includes('-') && !String(b.date).includes('T') ? String(b.date).replace(/-/g, '/') : b.date).getTime() : 0;
      return tb - ta;
    });

    return `
      <div>
        <!-- 検索・フィルターバー -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; background:var(--bg-secondary); padding:12px; border-radius:8px">
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <button class="btn btn-small ${this.statusFilter === 'all_active' && this.filterType === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setStatusFilter('all_active', 'all')">📥 すべて (${allActiveCount})</button>
            <button class="btn btn-small ${this.statusFilter === 'unhandled' && this.filterType === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setStatusFilter('unhandled', 'all')">🆕 未対応のみ (${unhandledCount})</button>
            <button class="btn btn-small" style="${this.statusFilter === 'hold' ? 'background:#d97706;border-color:#d97706;color:#fff;font-weight:bold;' : 'color:#d97706;border-color:rgba(217,119,6,0.5);background:rgba(217,119,6,0.06);font-weight:600;'}" onclick="InboxManager.setStatusFilter('hold', 'all')">⏸️ 保留中 (${holdCount})</button>
            <div style="width:1px; height:20px; background:var(--border-color); margin:0 4px;"></div>
            <button class="btn btn-small ${this.filterType === 'FAX' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setStatusFilter('all_active', 'FAX')">📠 FAX (${faxCount})</button>
            <button class="btn btn-small ${this.filterType === 'メール' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setStatusFilter('all_active', 'メール')">📧 メール (${mailCount})</button>
          </div>
          <div style="flex-grow:1; max-width:400px; display:flex; gap:6px">
            <input type="text" id="inboxSearchInput" class="search-input" style="width:100%; margin:0" placeholder="🔍 送信元・件名・本文で検索..." 
              value="${this.searchQuery}" onkeyup="if(event.key==='Enter') InboxManager.search(this.value)" onblur="InboxManager.search(this.value)">
            <button class="btn btn-secondary" onclick="InboxManager.search(document.getElementById('inboxSearchInput').value)">検索</button>
          </div>
        </div>

        <!-- インボックスカードリスト -->
        ${filtered.length === 0 
          ? `
            <div style="text-align:center; padding:60px 20px; background:var(--bg-secondary); border-radius:8px; border:2px dashed var(--border-color); margin-top:10px">
              <span style="font-size:3.5rem; display:block; margin-bottom:12px">📥</span>
              <h3 style="margin:0 0 6px 0; color:var(--text-secondary)">該当するデータはありません</h3>
              <p style="margin:0; font-size:0.85rem; color:var(--text-muted)">受信チェックを行うか、別のフィルターを選択してください</p>
            </div>
          `
          : `
            <div style="display:grid; grid-template-columns: 1fr; gap:16px;">
              ${filtered.map(item => this.renderInboxCard(item)).join('')}
            </div>
          `
        }
      </div>
    `;
  },

  formatDate(dateVal) {
    if (!dateVal) return '—';
    const str = String(dateVal).trim();
    const d = new Date(str.includes('-') && !str.includes('T') ? str.replace(/-/g, '/') : str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  },

  renderInboxCard(item) {
    const isFax = item.type === 'FAX';
    const isHold = item.status === '保留';
    const typeBadgeBg = isFax ? '#10b981' : '#3b82f6'; // Green for FAX, Blue for Mail
    const formattedDate = this.formatDate(item.date);
    const holdCardStyle = isHold ? 'border-left:5px solid #f59e0b; background:rgba(245,158,11,0.02);' : '';

    // 添付ファイルのパース
    let attachments = [];
    if (item.attachments) {
      try {
        attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
      } catch (e) {
        attachments = [];
      }
    }

    // 自動顧客マッチング
    const matchedClient = this.matchClient(item);
    const matchAlertHtml = matchedClient 
      ? `<div style="background:#e8f5e9; color:#2e7d32; border:1px solid #c8e6c9; padding:6px 12px; border-radius:4px; font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; margin-bottom:8px">
          👤 登録済みの顧客とマッチしました: <strong>${matchedClient.name}</strong> (${matchedClient.companyName || '個人'})
         </div>`
      : '';

    return `
      <div class="inbox-card" style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.15s, box-shadow 0.15s; cursor:default; display:flex; flex-direction:column; gap:10px; ${holdCardStyle}"
        onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.08)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="background:${typeBadgeBg}; color:#fff; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:4px; text-transform:uppercase">${item.type}</span>
            ${isHold ? `<span style="background:#fef3c7; color:#b45309; font-size:0.72rem; font-weight:bold; padding:2px 8px; border-radius:4px; border:1px solid #fde68a;">⏸️ 登録保留中</span>` : ''}
            <span style="font-size:0.8rem; color:var(--text-muted)">${formattedDate}</span>
          </div>
          <span style="font-size:0.8rem; font-weight:bold; color:var(--text-secondary)">ID: ${item.id}</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px">
          <h3 style="margin:0; font-size:1rem; color:var(--text-primary)">${item.subject || '（無題）'}</h3>
          <div style="font-size:0.85rem; color:var(--text-secondary)">
            <strong>差出人:</strong> <span style="font-family:monospace">${item.sender || '不明'}</span>
          </div>
        </div>

        ${matchAlertHtml}

        <div style="font-size:0.85rem; color:var(--text-secondary); background:var(--bg-secondary); padding:10px; border-radius:6px; max-height:120px; overflow-y:auto; white-space:pre-wrap; font-family:var(--font-mono)">${item.body || '本文なし'}</div>

        <!-- 添付ファイル -->
        ${attachments && attachments.length > 0 
          ? `
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px">
              <span style="font-size:0.75rem; font-weight:bold; color:var(--text-muted)">📎 添付ファイル:</span>
              <div style="display:flex; flex-wrap:wrap; gap:6px">
                ${attachments.map(att => `
                  <a href="${att.url}" target="_blank" class="btn btn-secondary btn-small" style="font-size:0.75rem; padding:4px 8px; text-decoration:none; display:inline-flex; align-items:center; gap:4px">
                    📄 ${att.name || '添付ファイル'}
                  </a>
                `).join('')}
              </div>
            </div>
          `
          : ''
        }

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px; flex-wrap:wrap">
          <button class="btn btn-secondary btn-small" style="color:var(--accent-red,#ef4444); border-color:var(--accent-red,#ef4444)" onclick="InboxManager.ignoreItem('${item.id}')">
            🚫 対象外にする
          </button>
          ${isHold 
            ? `<button class="btn btn-secondary btn-small" style="color:#059669; border-color:#059669; font-weight:600; background:rgba(5,150,105,0.06)" onclick="InboxManager.unholdItem('${item.id}')" title="保留を解除して未対応に戻します">▶️ 保留解除</button>`
            : `<button class="btn btn-secondary btn-small" style="color:#d97706; border-color:rgba(217,119,6,0.6); font-weight:600; background:rgba(217,119,6,0.06)" onclick="InboxManager.holdItem('${item.id}')" title="登録を一時的に保留（保留中）にします">⏸️ 保留にする</button>`
          }
          <button class="btn btn-secondary btn-small" style="color:#3b82f6; border-color:rgba(59,130,246,0.6); font-weight:600; background:rgba(59,130,246,0.06)" onclick="InboxManager.showAttachToCaseModal('${item.id}')" title="すでに登録済みの案件にこの書類・FAXを追加合流します">
            🔗 既存案件に書類追加
          </button>
          <button class="btn btn-secondary btn-small" style="color:var(--accent-gold,#f59e0b); border-color:rgba(245,158,11,0.6); font-weight:bold; background:rgba(245,158,11,0.08)" onclick="InboxManager.ocrAndRegisterCase('${item.id}')">
            ⚡ OCR解析して登録
          </button>
          <button class="btn btn-primary btn-small" onclick="InboxManager.registerCase('${item.id}')">
            ➕ 案件として登録
          </button>
        </div>
      </div>
    `;
  },

  // ─── 📤 FAX送信 タブ ──────────────────────────────────────────
  renderSendTab() {
    const clients = Store.getClients();
    const clientOptions = clients.map(c =>
      `<option value="${c.name}">${c.name} ${c.companyName ? `(${c.companyName})` : ''}</option>`
    ).join('');

    return `
      <div style="max-width:600px; margin: 0 auto; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05)">
        <h2 style="margin:0 0 16px 0; font-size:1.15rem; border-bottom:1px solid var(--border-color); padding-bottom:8px">📤 FAX送信</h2>
        <form id="faxSendForm" onsubmit="InboxManager.onSend(event)">
          <div class="form-row" style="margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label>FAX番号 <span class="required" style="color:#ef4444">*</span></label>
              <input type="tel" name="faxNumber" id="faxNumber" required
                placeholder="例：0312345678" pattern="[0-9\\-]+"
                style="width:100%">
            </div>
            <div class="form-group" style="flex:1">
              <label>顧客（履歴紐付け用）</label>
              <select name="clientName" id="faxClientName" style="width:100%">
                <option value="">— 選択 —</option>
                ${clientOptions}
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>件名（カバーページ）</label>
            <input type="text" name="subject" id="faxSubject"
              placeholder="例：車庫証明申請書の送付" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>本文（カバーページ内容）</label>
            <textarea name="body" id="faxBody" rows="4" style="width:100%"
              placeholder="いつもお世話になっております。&#10;下記の書類を送付いたします。"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>PDF添付</label>
            <input type="file" id="faxFile" accept=".pdf"
              onchange="InboxManager.onFileSelect(event)">
            <small style="color:var(--text-muted); display:block; margin-top:2px">※ PDFファイルのみ添付可能です</small>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px">
            <button type="submit" class="btn btn-primary" style="width:100%">📠 FAXを送信する</button>
          </div>
        </form>
      </div>
    `;
  },

  // ─── 📜 すべての履歴 タブ ──────────────────────────────────────
  renderHistoryTab() {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const cases = Store.getCases();
    const faxLogs = JSON.parse(localStorage.getItem('gyosei_fax_logs') || '[]');
            <input type="text" id="historySearchInput" class="search-input" style="width:100%; margin:0" placeholder="🔍 送信元・件名・案件名で検索..." 
              value="${this.historySearchQuery || ''}" oninput="InboxManager.searchHistory(this.value)">
            ${this.historySearchQuery ? `<button class="btn btn-secondary btn-small" onclick="InboxManager.searchHistory('')">クリア</button>` : ''}
          </div>
        </div>

        <div style="overflow-x:auto; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px">
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem">
            <thead>
              <tr style="background:var(--bg-secondary); text-align:left">
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">日時</th>
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">種別</th>
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">番号/宛先</th>
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">件名</th>
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">処理状態</th>
                <th style="padding:12px; border-bottom:1px solid var(--border-color)">対応内容</th>
              </tr>
            </thead>
            <tbody>
              ${histories.length === 0 
                ? `<tr><td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted)">該当する送受信履歴はありません</td></tr>`
                : histories.map(h => {
                    let statusHtml = '';
                    let actionHtml = '';

                    if (h.direction === '送信') {
                      statusHtml = `<span style="color:var(--text-muted)">送信完了</span>`;
                      actionHtml = `<span style="color:var(--text-muted)">顧客: ${h.caseTitle}</span>`;
                    } else {
                      if (h.status === '対応済') {
                        statusHtml = `<span style="color:#16a34a; font-weight:600">✅ 処理済</span>`;
                        if (h.caseId) {
                          actionHtml = `
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
                              <a href="#" onclick="event.preventDefault(); Cases.showEditModal('${h.caseId}', 'inbox', 'history')" style="font-weight:600; color:var(--primary-color)">📋 案件: ${h.caseTitle}</a>
                              <button class="btn btn-secondary btn-small" style="font-size:0.75rem; padding:2px 8px; color:var(--accent-gold,#f59e0b); border-color:rgba(245,158,11,0.5)" onclick="InboxManager.registerCase('${h.id}')" title="同じFAX/メールから別の案件を新規登録">📑 別案件を追加登録</button>
                            </div>
                          `;
                        } else {
                          actionHtml = `
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
                              <span style="color:var(--text-muted)">手動対応済</span>
                              <button class="btn btn-secondary btn-small" style="font-size:0.75rem; padding:2px 8px; color:var(--accent-gold,#f59e0b); border-color:rgba(245,158,11,0.5)" onclick="InboxManager.registerCase('${h.id}')" title="同じFAX/メールから別の案件を新規登録">📑 別案件を追加登録</button>
                            </div>
                          `;
                        }
                      } else if (h.status === '除外') {
                        statusHtml = `<span style="color:var(--text-muted)">🚫 除外</span>`;
                        actionHtml = `
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
                            <button type="button" class="btn btn-secondary btn-small" onclick="InboxManager.restoreItem('${h.id}')">復元</button>
                            <button type="button" class="btn btn-primary btn-small" onclick="InboxManager.registerCase('${h.id}')">➕ 案件登録</button>
                          </div>
                        `;
                      } else if (h.status === '保留') {
                        statusHtml = `<span style="color:#d97706; font-weight:bold">⏸️ 保留中</span>`;
                        actionHtml = `
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
                            <button type="button" class="btn btn-secondary btn-small" style="color:#059669; border-color:#059669;" onclick="InboxManager.unholdItem('${h.id}')">▶️ 保留解除</button>
                            <button type="button" class="btn btn-primary btn-small" onclick="InboxManager.registerCase('${h.id}')">➕ 案件登録</button>
                          </div>
                        `;
                      } else {
                        statusHtml = `<span style="color:#d97706; font-weight:600">⏳ 未対応</span>`;
                        actionHtml = `
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
                            <button type="button" class="btn btn-secondary btn-small" style="color:#d97706; border-color:rgba(217,119,6,0.6);" onclick="InboxManager.holdItem('${h.id}')">⏸️ 保留</button>
                            <button type="button" class="btn btn-primary btn-small" onclick="InboxManager.registerCase('${h.id}')">➕ 案件登録</button>
                          </div>
                        `;
                      }
                    }
                  const directionBadge = h.direction === '送信' 
                    ? `<span style="background:#dbeafe; color:#2563eb; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px">送信 ${h.type}</span>`
                    : `<span style="background:#dcfce7; color:#16a34a; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px">受信 ${h.type}</span>`;

                  return `
                    <tr style="border-bottom:1px solid var(--border-color)">
                      <td style="padding:10px 12px; white-space:nowrap">${this.formatDate(h.date)}</td>
                      <td style="padding:10px 12px">${directionBadge}</td>
                      <td style="padding:10px 12px; font-family:monospace">${h.sender || '—'}</td>
                      <td style="padding:10px 12px">${h.subject || '（無題）'}</td>
                      <td style="padding:10px 12px">${statusHtml}</td>
                      <td style="padding:10px 12px">${actionHtml}</td>
                    </tr>
                  `;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  // ─── アクション・イベントハンドラ ────────────────────────────────
  switchTab(tab) {
    this.activeTab = tab;
    App.refreshView();
  },

  setFilterType(type) {
    this.filterType = type;
    App.refreshView();
  },

  setStatusFilter(statusFilter, filterType = 'all') {
    this.statusFilter = statusFilter;
    this.filterType = filterType;
    App.refreshView();
  },

  search(val) {
    this.searchQuery = val;
    App.refreshView();
  },

  // 1. メール・FAX受信チェック
  async checkIncomingInbox() {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      App.showToast('⚙️ スプレッドシート連携を設定してください');
      return;
    }

    const btn = document.getElementById('inboxCheckBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ チェック中...';
    }

    App.showToast('📥 新規メールおよびFAXをスキャン中...');

    try {
      // GAS側でGmail検索とインボックス書込を実行
      const result = await SpreadsheetSync.pushCalendarEvent('checkInbox', {});

      if (result && result.success) {
        // GASからローカルストレージへデータをプル
        const syncResult = await SpreadsheetSync.pull();
        
        // 旧FAXログのロード (互換用)
        if (typeof SpreadsheetSync.getGasUrl === 'function') {
          const url = SpreadsheetSync.getGasUrl();
          const response = await fetch(url + '?type=faxLog');
          const logData = await response.json();
          if (logData.faxLog) {
            localStorage.setItem('gyosei_fax_logs', JSON.stringify(logData.faxLog));
          }
        }

        App.refreshView();
        App.showToast(`✅ スキャン完了！ 新規に ${result.saved} 件を取り込みました`);
      } else if (result && result.error) {
        App.showToast('❌ 取り込みエラー: ' + result.error);
      }
    } catch (err) {
      App.showToast('❌ 通信エラー: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 受信チェック';
      }
    }
  },

  // ─── 送信元文字列から店舗名・担当者名・メールアドレスを高度に自動抽出 ───
  parseDealerSender(senderStr) {
    if (!senderStr) return { raw: '', cleanName: '', contactName: '', storeName: '', rawStoreName: '', email: '' };

    // 1. メールアドレスの抽出 (<...> または raw string)
    let email = '';
    const emailMatch = senderStr.match(/<([^>]+)>/) || senderStr.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      email = (emailMatch[1] || emailMatch[0]).trim().toLowerCase();
    }

    // 2. 表示名からメールアドレス・記号を除去
    let cleanName = senderStr.replace(/<[^>]+>/g, '').replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '').trim();
    // 引用符などをトリム
    cleanName = cleanName.replace(/^["'「『]+|["'」』]+$/g, '').trim();

    let contactName = '';
    let storeName = '';

    // パターンA: スラッシュ区切り 「山田 / ATW 一宮店」 「愛知トヨタ 一宮店 / 佐藤」
    if (cleanName.includes('/') || cleanName.includes('／')) {
      const parts = cleanName.split(/[\/／]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const storeKeywords = ['店', '営業所', '支店', 'センター', 'ATW', 'atw', 'AT', 'at', 'WEST', 'west', 'トヨタ', 'ふそう', '日産', 'ホンダ', 'ダイハツ', 'スズキ', 'マツダ', 'スバル', '本社', '支社'];
        const p0IsStore = storeKeywords.some(kw => parts[0].includes(kw));
        const p1IsStore = storeKeywords.some(kw => parts[1].includes(kw));

        if (p0IsStore && !p1IsStore) {
          storeName = parts[0];
          contactName = parts[1];
        } else {
          contactName = parts[0];
          storeName = parts[1];
        }
      }
    } else if (cleanName.includes(' ') || cleanName.includes('　')) {
      // パターンB: スペース区切り 「ATW 一宮店 山田」 「山田 愛知トヨタ 一宮店」
      const parts = cleanName.split(/[\s　]+/).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');
        if (['店', '営業所', '支店', 'センター'].some(kw => first.includes(kw))) {
          storeName = first;
          contactName = last;
        } else {
          contactName = parts[0];
          storeName = parts.slice(1).join(' ');
        }
      }
    } else {
      contactName = cleanName;
    }

    const rawStoreName = storeName.trim();

    // 3. ディーラー略称の正規化 (ATW -> 愛知トヨタWEST, AT -> 愛知トヨタ, MFTBC -> 三菱ふそう 等)
    let normalizedStore = rawStoreName;
    if (/^ATW[\s　_-]*/i.test(normalizedStore)) {
      normalizedStore = normalizedStore.replace(/^ATW[\s　_-]*/i, '愛知トヨタWEST ');
    } else if (/^AT[\s　_-]*/i.test(normalizedStore)) {
      normalizedStore = normalizedStore.replace(/^AT[\s　_-]*/i, '愛知トヨタ ');
    } else if (/^MFTBC[\s　_-]*/i.test(normalizedStore)) {
      normalizedStore = normalizedStore.replace(/^MFTBC[\s　_-]*/i, '三菱ふそう ');
    } else if (/^NISSAN[\s　_-]*/i.test(normalizedStore)) {
      normalizedStore = normalizedStore.replace(/^NISSAN[\s　_-]*/i, '日産愛知 ');
    }

    return {
      raw: senderStr,
      cleanName,
      contactName: contactName.replace(/(様|さん|氏|係|担当)$/, '').trim(),
      storeName: (normalizedStore.trim() || rawStoreName),
      rawStoreName,
      email
    };
  },

  // 2. 顧客データベースとのマッチングロジック（複数メールアドレス・店舗略称対応）
  matchClient(item) {
    if (!item.sender) return null;
    const clients = Store.getClients();
    const parsed = this.parseDealerSender(item.sender);
    const cleanSender = item.sender.replace(/[^a-zA-Z0-9@\.]/g, '').toLowerCase();

    for (const client of clients) {
      // 1. 電話番号/FAX番号でのマッチング (FAXの場合)
      if (item.type === 'FAX') {
        const cleanFax = cleanSender.replace(/[^0-9]/g, '');
        if (client.fax) {
          const cleanClientFax = client.fax.replace(/[^0-9]/g, '');
          if (cleanClientFax && cleanFax && (cleanClientFax === cleanFax || cleanClientFax.includes(cleanFax) || cleanFax.includes(cleanClientFax))) {
            return client;
          }
        }
        if (client.phone) {
          const cleanPhone = client.phone.replace(/[^0-9]/g, '');
          if (cleanPhone && cleanFax && (cleanPhone === cleanFax || cleanPhone.includes(cleanFax) || cleanFax.includes(cleanPhone))) {
            return client;
          }
        }
      }
      
      // 2. メールアドレスでのマッチング (カンマ・セミコロン・改行区切りの複数メール対応 ＋ 担当者メール対応)
      if (item.type === 'メール' || parsed.email) {
        const clientEmailStr = (client.email || '').toLowerCase();
        // 顧客マスターの全メールアドレスを配列化
        const clientEmails = clientEmailStr.split(/[\s,;\n]+/).map(e => e.trim()).filter(Boolean);
        
        // 顧客担当者マスターの全メールアドレスも取得
        let contactEmails = [];
        if (typeof Store.getClientContacts === 'function') {
          contactEmails = Store.getClientContacts(client.id)
            .map(c => (c.email || '').toLowerCase().trim())
            .filter(Boolean);
        }
        const allTargetEmails = [...clientEmails, ...contactEmails];

        if (parsed.email && allTargetEmails.some(e => e === parsed.email || parsed.email.includes(e) || e.includes(parsed.email))) {
          return client;
        }
        if (cleanSender && allTargetEmails.some(e => cleanSender.includes(e))) {
          return client;
        }
      }

      // 3. 店舗名・ディーラー略称での高精度マッチング (「ATW 一宮店」 -> 「愛知トヨタWEST 一宮店」)
      const cName = (client.name || '').toLowerCase();
      const cCompany = (client.companyName || '').toLowerCase();
      const storeTarget = (parsed.storeName || parsed.rawStoreName || '').toLowerCase();

      if (storeTarget) {
        // 完全一致または相互含有
        if (cName && (cName === storeTarget || cName.includes(storeTarget) || storeTarget.includes(cName))) return client;
        if (cCompany && (cCompany === storeTarget || cCompany.includes(storeTarget) || storeTarget.includes(cCompany))) return client;

        // 店舗部分（例: "一宮店"）とディーラーブランド（例: "愛知トヨタ", "WEST"）の両方を含むか判定
        const storeMatch = storeTarget.match(/([^\s]+店|[^\s]+営業所|[^\s]+支店)/);
        if (storeMatch) {
          const branchName = storeMatch[1];
          if ((cName.includes(branchName) || cCompany.includes(branchName))) {
            // ブランドチェック
            if ((storeTarget.includes('west') || storeTarget.includes('atw')) && (cName.includes('west') || cCompany.includes('west') || cName.includes('愛知トヨタ') || cCompany.includes('愛知トヨタ'))) {
              return client;
            }
            if ((storeTarget.includes('愛知トヨタ') || storeTarget.includes('at')) && (cName.includes('愛知トヨタ') || cCompany.includes('愛知トヨタ'))) {
              return client;
            }
            if ((storeTarget.includes('ふそう') || storeTarget.includes('mftbc')) && (cName.includes('ふそう') || cCompany.includes('ふそう'))) {
              return client;
            }
            if ((storeTarget.includes('日産') || storeTarget.includes('nissan')) && (cName.includes('日産') || cCompany.includes('日産'))) {
              return client;
            }
          }
        }
      }

      // 4. 名前や法人名が件名/本文に含まれているか (緩いマッチング)
      if (item.subject) {
        if (client.name && item.subject.includes(client.name)) return client;
        if (client.companyName && item.subject.includes(client.companyName)) return client;
      }
    }
    return null;
  },

  // 3. インボックスから案件登録モーダルへ展開
  registerCase(itemId) {
    try {
      const inbox = Store.getInbox ? Store.getInbox() : [];
      let item = inbox.find(i => String(i.id) === String(itemId));

      // フォールバック: faxLogs
      if (!item) {
        const faxLogs = JSON.parse(localStorage.getItem('gyosei_fax_logs') || '[]');
        const foundLog = faxLogs.find(l => String(l.id) === String(itemId) || String(l.faxId) === String(itemId));
        if (foundLog) {
          item = {
            id: foundLog.id || foundLog.faxId || itemId,
            type: 'FAX',
            sender: foundLog.fromNumber || foundLog.number || 'FAX',
            subject: foundLog.subject || '受信FAX',
            body: foundLog.body || '',
            date: foundLog.date || foundLog.createdAt || '',
            attachments: foundLog.attachments || (foundLog.pdfUrl ? [{ name: 'FAX.pdf', url: foundLog.pdfUrl }] : []),
            status: foundLog.status || '未対応'
          };
        }
      }

      if (!item) {
        console.warn('受信アイテムが見つかりませんでした: ' + itemId);
        alert('⚠️ 該当する受信データが見つかりませんでした');
        return;
      }

      // ディーラー差出人解析・顧客自動マッチング
      let parsed = null;
      if (typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.parse) {
        try {
          parsed = DealerDocumentParser.parse(item.body || item.subject || '', item);
        } catch (e) {
          console.warn('DealerDocumentParser.parse error:', e);
        }
      }
      const client = this.matchClient(item);

      // 添付ファイルのテキストリスト作成
      let attachments = [];
      if (item.attachments) {
        try {
          attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
        } catch (e) { attachments = []; }
      }

      // カテゴリ自動予測 (件名・解析結果から判定)
      let category = 'garage_paper'; // デフォルトは紙の車庫証明
      const subject = item.subject || '';
      if ((parsed && parsed.isOss) || subject.includes('OSS') || subject.toLowerCase().includes('oss')) {
        category = 'garage_oss';
      } else if (subject.includes('相続') || subject.includes('遺産')) {
        category = 'inheritance';
      } else if (subject.includes('封印') || subject.includes('ナンバー')) {
        category = 'seal';
      }

      const prefills = {
        title: (parsed && parsed.suggestedTitle) ? parsed.suggestedTitle : `${item.type === 'FAX' ? 'FAX' : 'メール'}依頼: ${item.subject || '無題案件'}`,
        clientId: (client ? client.id : '') || (parsed ? parsed.matchedClientId : ''),
        category: category,
        orderNo: parsed ? parsed.orderNo : '',
        applicantName: parsed ? parsed.applicantName : '',
        applicantAddress: parsed ? parsed.applicantAddress : '',
        memo: '',
        inboxId: item.id,
        faxId: item.type === 'FAX' ? item.id : '',
        attachments: attachments,
        inboxItem: item
      };

      // 案件管理画面へ遷移してモーダルを開く
      if (typeof App !== 'undefined' && App.navigate) {
        App.navigate('cases');
      }
      setTimeout(() => {
        if (typeof Cases !== 'undefined' && typeof Cases.showAddModal === 'function') {
          Cases.showAddModal(prefills);
        }
      }, 50);
    } catch (err) {
      console.error('registerCase error:', err);
      alert('⚠️ 案件登録の起動中にエラーが発生しました: ' + err.message);
    }
  },

  // ─── 🔄 OCR解析用ローディングモーダル ───
  showLoadingModal(msg = '添付ファイル（FAX/依頼書）をAI OCR解析しています...') {
    let el = document.getElementById('inbox-ocr-loading-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'inbox-ocr-loading-modal';
      document.body.appendChild(el);
    }
    el.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(6px);';
    el.innerHTML = `
      <div style="background:var(--card-bg, #1e293b); border:1px solid rgba(245,158,11,0.4); border-radius:16px; padding:32px; max-width:440px; width:90%; text-align:center; color:#fff; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
        <div class="spinner" style="width:48px; height:48px; border:4px solid rgba(245,158,11,0.2); border-top-color:#f59e0b; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 20px;"></div>
        <h3 style="font-size:1.15rem; font-weight:700; margin:0 0 8px 0; color:#f59e0b;">🤖 AI OCR 解析中</h3>
        <p id="inbox-ocr-loading-status" style="font-size:0.85rem; color:#94a3b8; line-height:1.5; margin:0 0 16px 0;">${msg}</p>
        <div style="font-size:0.75rem; color:#64748b;">※TIFF展開・Gemini高精度解析には約3〜8秒かかります</div>
      </div>
    `;
  },

  updateLoadingStatus(msg) {
    const el = document.getElementById('inbox-ocr-loading-status');
    if (el) el.innerText = msg;
  },

  hideLoadingModal() {
    const el = document.getElementById('inbox-ocr-loading-modal');
    if (el) el.remove();
  },

  // 3-B. 添付ファイルや本文をOCR解析して案件登録
  async ocrAndRegisterCase(itemId) {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const item = inbox.find(i => i.id === itemId);
    if (!item) return;

    this.showLoadingModal('添付ファイル（FAX/依頼書）を確認中...');

    try {
      let attachments = [];
      if (item.attachments) {
        try {
          attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
        } catch (e) { attachments = []; }
      }

      let extractedText = [item.subject, item.body, item.sender].filter(Boolean).join('\n');

      if (attachments.length > 0) {
        const firstAtt = attachments[0];
        const gasUrl = typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.getGasUrl ? SpreadsheetSync.getGasUrl() : '';
        const geminiKey = localStorage.getItem('gyosei_gemini_api_key') || '';

        if (gasUrl && firstAtt.url) {
          this.updateLoadingStatus('Driveから添付ファイルを取得し、TIFF変換＆Gemini解析中...');

          // 1. クライアント側Base64取得 & TIFF瞬時変換 & Gemini直接呼び出し（最速・確実）
          try {
            const b64Res = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({
                action: 'getFileBase64',
                fileUrl: firstAtt.url
              })
            });
            const b64Data = await b64Res.json();
            if (b64Data && b64Data.success && b64Data.base64) {
              this.updateLoadingStatus('Gemini 2.0 で書類項目（注文No・申請者・車両情報）を抽出中...');
              const geminiParsed = await DealerDocumentParser.parseWithGemini(b64Data.base64, b64Data.mimeType, item);
              if (geminiParsed && (geminiParsed.orderNo || geminiParsed.applicantName || geminiParsed.storeFullName || geminiParsed.vin || geminiParsed.applicantAddress)) {
                // TIFFマルチページを個別ページに展開（複数案件切り出し用）
                const isTiffData = (b64Data.mimeType || '').includes('tif') || (firstAtt.name && firstAtt.name.match(/\.tiff?$/i)) || b64Data.base64.startsWith('SUkq') || b64Data.base64.startsWith('TU0A');
                if (isTiffData && typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.convertTiffToPages) {
                  const tiffPages = DealerDocumentParser.convertTiffToPages(b64Data.base64);
                  if (tiffPages && tiffPages.length > 1) {
                    geminiParsed.attachments = tiffPages.map((p, idx) => ({
                      name: `FAX原本_P${idx + 1}.jpg`,
                      dataUrl: p.dataUrl,
                      pageNumber: idx + 1,
                      mimeType: 'image/jpeg'
                    }));
                  }
                }
                this.hideLoadingModal();
                DealerDocumentParser.showOcrResultModal(geminiParsed, firstAtt.url);
                return;
              }
            } else if (b64Data && b64Data.error) {
              console.warn('getFileBase64 error:', b64Data.error);
            }
          } catch (b64Err) {
            console.warn('Client-side Gemini OCR failed:', b64Err);
          }

          // 2. サーバー側 GAS Gemini OCR（フォールバック）
          if (geminiKey) {
            try {
              this.updateLoadingStatus('サーバー経由でGemini OCR解析を実行中...');
              const geminiRes = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                  action: 'geminiOcr',
                  fileUrl: firstAtt.url,
                  apiKey: geminiKey
                })
              });
              const geminiData = await geminiRes.json();
              if (geminiData && geminiData.success && geminiData.parsed) {
                this.hideLoadingModal();
                const p = geminiData.parsed;
                p.suggestedTitle = `${p.storeFullName || p.dealerName || 'ディーラー'} - ${p.applicantName || '案件'} 様 (${p.applicationType || (p.isOss ? 'OSS' : '車庫証明')})`;
                DealerDocumentParser.showOcrResultModal(p, firstAtt.url);
                return;
              } else if (geminiData && geminiData.error) {
                console.warn('GAS geminiOcr error:', geminiData.error);
              }
            } catch (gasGeminiErr) {
              console.warn('GAS Gemini OCR failed:', gasGeminiErr);
            }
          } else {
            console.warn('Gemini API key is not set in localStorage');
          }
        }

        // フォールバック（添付ファイルのテキストまたは本文から推測）
        this.hideLoadingModal();
        if (!geminiKey && (!localStorage.getItem('gyosei_gemini_api_key'))) {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('⚠️ Gemini APIキーが設定されていません。同期設定から入力してください');
          }
        }
        const parsed = (typeof DealerDocumentParser !== 'undefined') ? DealerDocumentParser.parse(extractedText, item) : {};
        if (typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.showOcrResultModal) {
          DealerDocumentParser.showOcrResultModal(parsed, firstAtt ? firstAtt.url : '');
        }
      } else {
        // 添付がない場合
        this.hideLoadingModal();
        const parsed = (typeof DealerDocumentParser !== 'undefined') ? DealerDocumentParser.parse(extractedText, item) : {};
        if (typeof DealerDocumentParser !== 'undefined' && DealerDocumentParser.showOcrResultModal) {
          DealerDocumentParser.showOcrResultModal(parsed);
        }
      }
    } catch (err) {
      this.hideLoadingModal();
      console.error('OCR処理全体エラー:', err);
      alert('⚠️ OCR解析中にエラーが発生しました:\n' + err.message + '\n\n手元のTIF/PDFファイルを画面から直接選択して解析することも可能です。');
    }
  },

  // 4. 不要レコードの除外
  ignoreItem(itemId) {
    if (confirm('この受信データを登録前BOXから除外（非表示）にしますか？\n（履歴タブからいつでも復元できます）')) {
      Store.updateInboxStatus(itemId, '除外');
      App.refreshView();
      App.showToast('データをインボックスから除外しました');
    }
  },

  // 4-B. レコードの保留
  holdItem(itemId) {
    Store.updateInboxStatus(itemId, '保留');
    App.refreshView();
    App.showToast('⏸️ データを「保留中」に設定しました');
  },

  // 4-C. 保留の解除
  unholdItem(itemId) {
    Store.updateInboxStatus(itemId, '未対応');
    App.refreshView();
    App.showToast('▶️ 保留を解除し「未対応」に戻しました');
  },

  // 5. レコードの復元
  restoreItem(itemId) {
    Store.updateInboxStatus(itemId, '未対応');
    App.refreshView();
    App.showToast('データをインボックスに復元しました');
  },

  // ─── 🔗 既存案件への書類合流モーダル ──────────────────────────
  showAttachToCaseModal(itemId) {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const item = inbox.find(i => i.id === itemId);
    if (!item) return;

    let attachments = [];
    if (item.attachments) {
      try {
        attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
      } catch (e) { attachments = []; }
    }

    const cases = Store.getCases ? Store.getCases() : [];
    const client = this.matchClient(item);
    const matchedClientId = client ? client.id : '';

    // 進行中の案件を優先し、送信元顧客に一致する案件を最上位にソート
    const sortedCases = [...cases].sort((a, b) => {
      const aMatch = (matchedClientId && a.clientId === matchedClientId) ? 1 : 0;
      const bMatch = (matchedClientId && b.clientId === matchedClientId) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    const modalId = 'attach-to-case-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = modalId;
      document.body.appendChild(modalEl);
    }

    modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';

    const renderCaseList = (filterText = '') => {
      const q = filterText.toLowerCase().trim();
      const filtered = sortedCases.filter(c => {
        if (!q) return true;
        const cl = Store.getClient ? Store.getClient(c.clientId) : null;
        const cName = cl ? (cl.name + ' ' + (cl.companyName || '')) : '';
        return (c.title && c.title.toLowerCase().includes(q)) ||
               (c.applicantName && c.applicantName.toLowerCase().includes(q)) ||
               (c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
               (c.carNumber && c.carNumber.toLowerCase().includes(q)) ||
               (c.carName && c.carName.toLowerCase().includes(q)) ||
               cName.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        return `<div style="text-align:center; padding:30px; color:var(--text-muted);">該当する案件が見つかりません</div>`;
      }

      return filtered.map(c => {
        const cl = Store.getClient ? Store.getClient(c.clientId) : null;
        const isClientMatch = matchedClientId && c.clientId === matchedClientId;
        const isDone = c.status === 'done';
        const docCount = (c.docs && Array.isArray(c.docs)) ? c.docs.length : 0;

        return `
          <div class="attach-case-card" style="background:var(--bg-secondary); border:1px solid ${isClientMatch ? 'var(--primary-color)' : 'var(--border-color)'}; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:12px; transition:all 0.15s; margin-bottom:8px; ${isDone ? 'opacity:0.6;' : ''}">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap;">
                ${isClientMatch ? `<span style="background:rgba(59,130,246,0.2); color:#38bdf8; font-size:0.7rem; font-weight:bold; padding:1px 6px; border-radius:4px;">⭐ 送信元と一致</span>` : ''}
                <span style="font-size:0.72rem; padding:1px 6px; border-radius:4px; font-weight:bold; background:${isDone ? '#334155' : '#16a34a'}; color:#fff;">${c.status || '進行中'}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${c.category || '車庫証明'}</span>
                ${c.orderNo ? `<span style="font-size:0.75rem; font-family:monospace; color:var(--accent-gold,#f59e0b);">No:${c.orderNo}</span>` : ''}
              </div>
              <h4 style="margin:0 0 4px 0; font-size:0.95rem; font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.title}</h4>
              <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; gap:12px; flex-wrap:wrap;">
                ${cl ? `<span>🏢 ${cl.companyName || cl.name}</span>` : ''}
                ${c.applicantName ? `<span>👤 申請者: ${c.applicantName} 様</span>` : ''}
                ${c.carName || c.carModel ? `<span>🚗 ${c.carName || ''} ${c.carModel || ''}</span>` : ''}
                <span>📎 書類: ${docCount}件</span>
              </div>
            </div>
            <button class="btn btn-primary btn-small" style="white-space:nowrap; padding:6px 14px; font-weight:bold;" onclick="InboxManager.attachToCase('${item.id}', '${c.id}')">
              ➕ この案件に合流
            </button>
          </div>
        `;
      }).join('');
    };

    modalEl.innerHTML = `
      <div style="background:var(--card-bg, #1e293b); border:1px solid var(--border-color); border-radius:14px; max-width:760px; width:92%; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); color:var(--text-color, #fff); overflow:hidden;">
        
        <!-- ヘッダー -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.4rem;">🔗</span>
            <h3 style="margin:0; font-size:1.1rem; font-weight:700;">既存案件に書類・添付ファイルを追加（合流）</h3>
          </div>
          <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()" style="font-size:1.4rem; line-height:1; cursor:pointer; background:none; border:none; color:inherit;">×</button>
        </div>

        <!-- 追送データ情報 -->
        <div style="padding:12px 20px; background:rgba(59,130,246,0.08); border-bottom:1px solid rgba(59,130,246,0.2); font-size:0.85rem; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="color:#93c5fd; font-weight:bold;">📥 追送されたデータ (${item.type}):</span>
            <span style="color:var(--text-muted); font-size:0.78rem;">${this.formatDate(item.date)}</span>
          </div>
          <div style="font-weight:600; color:#fff;">${item.subject || '（無題）'} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary);">— ${item.sender || '差出人不明'}</span></div>
          ${attachments && attachments.length > 0 ? `
            <div style="display:flex; gap:6px; align-items:center; margin-top:2px; flex-wrap:wrap;">
              <span style="font-size:0.75rem; color:#93c5fd;">📎 合流されるファイル:</span>
              ${attachments.map(a => `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.75rem;">📄 ${a.name || '添付ファイル'}</span>`).join('')}
            </div>
          ` : '<div style="font-size:0.75rem; color:var(--text-muted);">※本文のメモ追記のみ合流されます</div>'}
        </div>

        <!-- 案件検索 & リスト -->
        <div style="padding:14px 20px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
          <div>
            <input type="text" id="attach-case-search" class="search-input" style="width:100%; box-sizing:border-box; background:var(--bg-secondary); border:1px solid var(--border-color); color:#fff; border-radius:6px; padding:8px 12px; font-size:0.9rem;"
              placeholder="🔍 合流先の案件を検索（案件名・顧客名・申請者名・車番・注文Noなど）..."
              oninput="document.getElementById('attach-case-list').innerHTML = InboxManager._renderAttachCaseList('${item.id}', this.value)">
          </div>

          <div id="attach-case-list" style="overflow-y:auto; max-height:420px; padding-right:4px;">
            ${renderCaseList()}
          </div>
        </div>

        <!-- フッター -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-top:1px solid var(--border-color); background:rgba(255,255,255,0.02); font-size:0.8rem; color:var(--text-muted);">
          <span>※合流すると、この受信データは自動的に「対応済」になります</span>
          <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">キャンセル</button>
        </div>
      </div>
    `;

    // 検索用内部ヘルパー
    this._renderAttachCaseList = (itId, q) => renderCaseList(q);
  },

  // ─── 確定：既存案件へ合流実行 ─────────────────────────────
  attachToCase(itemId, targetCaseId) {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const item = inbox.find(i => i.id === itemId);
    const targetCase = Store.getCase ? Store.getCase(targetCaseId) : null;
    if (!item || !targetCase) return;

    let newAttachments = [];
    if (item.attachments) {
      try {
        newAttachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
      } catch (e) { newAttachments = []; }
    }

    // 既存のdocs配列に新ファイルをマージ（重複除外）
    const existingDocs = Array.isArray(targetCase.docs) ? [...targetCase.docs] : [];
    const existingUrls = new Set(existingDocs.map(d => d.url || d.name));
    
    newAttachments.forEach(att => {
      if (!existingUrls.has(att.url || att.name)) {
        existingDocs.push({
          name: att.name || '追送書類.pdf',
          url: att.url || '',
          source: 'inbox_merge',
          mergedAt: new Date().toISOString()
        });
      }
    });

    // メモ欄に追送合流履歴を追記
    const nowStr = new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fileNames = newAttachments.map(a => a.name || '添付ファイル').join(', ');
    const auditText = `\n\n【📎 追送書類合流 (${nowStr})】\n${item.type}（${item.sender || '差出人'}）より合流：\n件名: ${item.subject || '（無題）'}\n${fileNames ? `添付: ${fileNames}` : ''}`;
    
    const updatedMemo = (targetCase.memo || '') + auditText;

    // 案件更新
    Store.updateCase(targetCase.id, {
      docs: existingDocs,
      memo: updatedMemo
    });

    // インボックスステータスを対応済に更新
    Store.updateInboxStatus(item.id, '対応済', targetCase.id);

    // モーダルを閉じる
    const modalEl = document.getElementById('attach-to-case-modal');
    if (modalEl) modalEl.remove();

    App.refreshView();
    App.showToast(`✅ 案件「${targetCase.title}」に書類を合流しました！`);
  },

  // ─── FAX送信関連処理 ──────────────────────────────────────
  selectedPdfBase64: null,
  selectedPdfName: null,

  onFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      this.selectedPdfBase64 = base64;
      this.selectedPdfName = file.name;
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
        
        // 履歴をリフレッシュ
        if (typeof SpreadsheetSync.getGasUrl === 'function') {
          const url = SpreadsheetSync.getGasUrl();
          const response = await fetch(url + '?type=faxLog');
          const logData = await response.json();
          if (logData.faxLog) {
            localStorage.setItem('gyosei_fax_logs', JSON.stringify(logData.faxLog));
          }
        }
        
        document.getElementById('faxSendForm').reset();
        this.switchTab('history');
      } else if (result && result.error) {
        App.showToast('❌ ' + result.error);
      } else {
        App.showToast('❌ FAX送信に失敗しました');
      }

    } catch (err) {
      App.showToast('❌ 通信エラー: ' + err.message);
    }
  }
};
