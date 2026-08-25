/**
 * 登録前BOX（受信インボックス ＆ FAX管理）モジュール
 */
const InboxManager = {
  activeTab: 'inbox', // 'inbox' | 'send' | 'history'
  searchQuery: '',
  filterType: 'all', // 'all' | 'FAX' | 'メール'

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
    // 未対応のみ表示
    let filtered = inbox.filter(item => item.status === '未対応');

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
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    return `
      <div>
        <!-- 検索・フィルターバー -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; background:var(--bg-secondary); padding:12px; border-radius:8px">
          <div style="display:flex; gap:8px">
            <button class="btn btn-small ${this.filterType === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setFilterType('all')">すべて</button>
            <button class="btn btn-small ${this.filterType === 'FAX' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setFilterType('FAX')">📠 FAX</button>
            <button class="btn btn-small ${this.filterType === 'メール' ? 'btn-primary' : 'btn-secondary'}" onclick="InboxManager.setFilterType('メール')">📧 メール</button>
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
              <h3 style="margin:0 0 6px 0; color:var(--text-secondary)">登録前BOXは空です</h3>
              <p style="margin:0; font-size:0.85rem; color:var(--text-muted)">受信チェックを行うか、新しいFAX・メールが届くまでお待ちください</p>
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

  renderInboxCard(item) {
    const isFax = item.type === 'FAX';
    const typeBadgeBg = isFax ? '#10b981' : '#3b82f6'; // Green for FAX, Blue for Mail
    const formattedDate = new Date(item.date).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });

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
      <div class="inbox-card" style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.15s, box-shadow 0.15s; cursor:default; display:flex; flex-direction:column; gap:10px"
        onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.08)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="background:${typeBadgeBg}; color:#fff; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:4px; text-transform:uppercase">${item.type}</span>
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

    // 履歴データ構築
    const histories = [];

    // 1. インボックスデータ追加 (受信FAX & 受信メール)
    inbox.forEach(item => {
      let linkedCase = null;
      if (item.caseId) {
        linkedCase = cases.find(c => c.id === item.caseId);
      } else {
        // IDや日付で案件と紐付ける (フォールバック)
        linkedCase = cases.find(c => c.inboxId === item.id || c.faxId === item.id);
      }

      histories.push({
        id: item.id,
        date: item.date,
        direction: '受信',
        type: item.type,
        sender: item.sender,
        subject: item.subject,
        status: item.status,
        caseId: linkedCase ? linkedCase.id : '',
        caseTitle: linkedCase ? linkedCase.title : '',
      });
    });

    // 2. 送信FAXを追加 (faxLogsから送信のもの)
    faxLogs.forEach((l, i) => {
      if (l.direction === '送信') {
        histories.push({
          id: 'SENT-FAX-' + i,
          date: l.date,
          direction: '送信',
          type: 'FAX',
          sender: l.number, // 送信先番号
          subject: l.subject,
          status: '対応済',
          caseId: '',
          caseTitle: l.clientName || '—',
        });
      }
    });

    // ソート (日付新しい順)
    histories.sort((a, b) => new Date(b.date) - new Date(a.date));

    return `
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
              ? `<tr><td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted)">送受信履歴はありません</td></tr>`
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
                        actionHtml = `<a href="#" onclick="event.preventDefault(); App.navigate('cases'); setTimeout(() => Cases.showEditModal('${h.caseId}'), 100)" style="font-weight:600; color:var(--primary-color)">📋 案件: ${h.caseTitle}</a>`;
                      } else {
                        actionHtml = `<span style="color:var(--text-muted)">手動対応済</span>`;
                      }
                    } else if (h.status === '除外') {
                      statusHtml = `<span style="color:var(--text-muted)">🚫 除外</span>`;
                      actionHtml = `<button class="btn btn-secondary btn-small" onclick="InboxManager.restoreItem('${h.id}')">復元</button>`;
                    } else {
                      statusHtml = `<span style="color:#d97706; font-weight:600">⏳ 未対応</span>`;
                      actionHtml = `<button class="btn btn-primary btn-small" onclick="InboxManager.registerCase('${h.id}')">➕ 案件登録</button>`;
                    }
                  }

                  const directionBadge = h.direction === '送信' 
                    ? `<span style="background:#dbeafe; color:#2563eb; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px">送信 ${h.type}</span>`
                    : `<span style="background:#dcfce7; color:#16a34a; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px">受信 ${h.type}</span>`;

                  return `
                    <tr style="border-bottom:1px solid var(--border-color)">
                      <td style="padding:10px 12px; white-space:nowrap">${h.date}</td>
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
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const item = inbox.find(i => i.id === itemId);
    if (!item) return;

    // ディーラー差出人解析・顧客自動マッチング
    let parsed = null;
    if (typeof DealerDocumentParser !== 'undefined') {
      parsed = DealerDocumentParser.parse(item.body || item.subject || '', item);
    }
    const client = this.matchClient(item);

    // 添付ファイルのテキストリスト作成
    let attachments = [];
    if (item.attachments) {
      try {
        attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
      } catch (e) { attachments = []; }
    }
    const attachmentText = attachments.length > 0 
      ? `\n\n【添付書類】\n` + attachments.map(a => `・${a.name}: ${a.url}`).join('\n')
      : '';

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
      memo: (parsed && parsed.orderNo) 
        ? (DealerDocumentParser.toCasePrefill(parsed).memo + `\n\n【受信日時】: ${new Date(item.date).toLocaleString('ja-JP')}\n【送信元】: ${item.sender}${attachmentText}`)
        : `【受信日時】: ${new Date(item.date).toLocaleString('ja-JP')}\n【送信元】: ${item.sender}\n【本文概要】:\n${item.body || 'なし'}${attachmentText}`,
      inboxId: item.id,
      faxId: item.type === 'FAX' ? item.id : '' // FAXログ互換用
    };

    // 案件管理画面へ遷移し、モーダルを開く
    App.navigate('cases');
    setTimeout(() => {
      Cases.showAddModal(prefills);
    }, 100);
  },

  // 3-B. 添付ファイルや本文をOCR解析して案件登録
  async ocrAndRegisterCase(itemId) {
    const inbox = Store.getInbox ? Store.getInbox() : [];
    const item = inbox.find(i => i.id === itemId);
    if (!item) return;

    let attachments = [];
    if (item.attachments) {
      try {
        attachments = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
      } catch (e) { attachments = []; }
    }

    let extractedText = [item.subject, item.body, item.sender].filter(Boolean).join('\n');

    // 添付ファイルがある場合
    if (attachments.length > 0) {
      const firstAtt = attachments[0];
      App.showToast('🔍 添付ファイル（FAX/依頼書）をAI OCR解析中...');
      
      try {
        const gasUrl = typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.getGasUrl ? SpreadsheetSync.getGasUrl() : '';
        if (gasUrl && firstAtt.url) {
          // 1. ファイルのBase64を取得
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
            // 2. Gemini APIキーがある場合は直接Gemini Visionで超高精度AI解析
            if (DealerDocumentParser.parseWithGemini) {
              const geminiParsed = await DealerDocumentParser.parseWithGemini(b64Data.base64, b64Data.mimeType, item);
              if (geminiParsed && geminiParsed.orderNo) {
                DealerDocumentParser.showOcrResultModal(geminiParsed, firstAtt.url);
                return;
              }
            }
          }

          // 3. フォールバック: GAS Drive OCR
          const res = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'ocr',
              fileUrl: firstAtt.url
            })
          });
          const resData = await res.json();
          if (resData.success && resData.text) {
            extractedText = resData.text + '\n\n' + extractedText;
          }
        }
      } catch (ocrErr) {
        console.error('AI OCR解析エラー:', ocrErr);
      }

      // テキスト解析
      const parsed = DealerDocumentParser.parse(extractedText, item);
      DealerDocumentParser.showOcrResultModal(parsed, firstAtt.url);
    } else {
      // 添付がない場合も本文・件名を解析
      const parsed = DealerDocumentParser.parse(extractedText, item);
      DealerDocumentParser.showOcrResultModal(parsed);
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

  // 5. レコードの復元
  restoreItem(itemId) {
    Store.updateInboxStatus(itemId, '未対応');
    App.refreshView();
    App.showToast('データをインボックスに復元しました');
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
