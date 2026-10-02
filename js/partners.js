/**
 * 県外・提携行政書士マスター管理モジュール
 * 自動車登録・車庫証明・出張封印の県外外注先・提携事務所を一元管理
 */
const Partners = {
  searchQuery: '',
  selectedPref: 'all',
  editingId: null,

  // 全角半角・カナかな・記号正規化ヘルパー
  normalizeText(str) {
    if (!str) return '';
    return String(str)
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[\u30A1-\u30F6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60))
      .replace(/[\s\u3000\-_－ー・/／()（）]/g, '')
      .toLowerCase();
  },

  getFilteredPartners() {
    const list = Store.getPartners();
    return list.filter(p => {
      // 都道府県フィルター
      if (this.selectedPref !== 'all') {
        if (this.selectedPref === 'その他') {
          if (['岐阜県', '三重県', '静岡県', '東京都', '神奈川県', '大阪府'].includes(p.prefecture)) {
            return false;
          }
        } else if (p.prefecture !== this.selectedPref) {
          return false;
        }
      }

      // 検索クエリフィルター
      if (!this.searchQuery || !this.searchQuery.trim()) return true;
      const qNorm = this.normalizeText(this.searchQuery);
      const fullText = [
        p.officeName, p.representative, p.prefecture, p.branches,
        p.address, p.phone, p.fax, p.mobile, p.rating, p.ratingNote,
        p.memo, p.deadlineNote, p.bankName, p.bankBranch, p.accountHolder
      ].filter(Boolean).map(s => this.normalizeText(s)).join(' ');

      return fullText.includes(qNorm);
    });
  },

  render() {
    const allPartners = Store.getPartners();
    const filtered = this.getFilteredPartners();

    // 都道府県別集計
    const prefCounts = {};
    allPartners.forEach(p => {
      const pref = p.prefecture || 'その他';
      prefCounts[pref] = (prefCounts[pref] || 0) + 1;
    });

    return `
      <div class="partners-page" style="padding: 16px 20px; max-width: 1300px; margin: 0 auto;">
        <!-- ヘッダー -->
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
          <div>
            <h1 style="font-size:1.6rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🤝</span> 県外・提携行政書士マスター
            </h1>
            <p style="color:var(--text-secondary); font-size:0.88rem; margin-top:4px;">
              県外登録・車庫証明・出張封印の外注先情報、代行料目安、送付先、振込先口座、対応評価を一元管理
            </p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-small" onclick="Partners.exportCSV()" style="font-size:0.85rem;">
              📥 CSV出力
            </button>
            <button class="btn btn-primary" onclick="Partners.showModal()" style="font-size:0.9rem; font-weight:600;">
              <span class="btn-icon">＋</span> 提携先を追加
            </button>
          </div>
        </div>

        <!-- 統計＆検索・フィルターバー -->
        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <!-- 検索窓 -->
            <div style="position:relative; flex:1; min-width:280px; max-width:480px;">
              <input type="text" id="partnerSearchInput" class="form-input" 
                placeholder="🔍 事務所名・氏名・都道府県・管轄支局・電話・メモ等で検索..." 
                value="${this.searchQuery}" 
                oninput="Partners.onSearch(this.value)"
                style="width:100%; padding:9px 36px 9px 12px; border-radius:8px; border:1.5px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:0.92rem;">
              ${this.searchQuery ? `
                <button type="button" onclick="Partners.clearSearch()" 
                  style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer;">✕</button>
              ` : ''}
            </div>

            <!-- 件数バッジ -->
            <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; gap:12px; align-items:center;">
              <span>登録提携先: <strong style="color:var(--text-primary); font-size:1.05rem;">${allPartners.length}</strong> 件</span>
              <span>表示中: <strong style="color:var(--accent-blue); font-size:1.05rem;">${filtered.length}</strong> 件</span>
            </div>
          </div>

          <!-- エリア選択ピル -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
            <span style="font-size:0.78rem; font-weight:600; color:var(--text-muted); margin-right:4px;">エリア絞込:</span>
            ${this._renderPrefPill('all', `すべて (${allPartners.length})`)}
            ${this._renderPrefPill('岐阜県', `岐阜 (${prefCounts['岐阜県'] || 0})`)}
            ${this._renderPrefPill('三重県', `三重 (${prefCounts['三重県'] || 0})`)}
            ${this._renderPrefPill('静岡県', `静岡 (${prefCounts['静岡県'] || 0})`)}
            ${this._renderPrefPill('東京都', `東京 (${prefCounts['東京都'] || 0})`)}
            ${this._renderPrefPill('神奈川県', `神奈川 (${prefCounts['神奈川県'] || 0})`)}
            ${this._renderPrefPill('大阪府', `大阪 (${prefCounts['大阪府'] || 0})`)}
            ${this._renderPrefPill('その他', `その他`)}
          </div>
        </div>

        <!-- 提携先カード一覧 -->
        <div id="partnerListContainer">
          ${this._renderCardList(filtered)}
        </div>
      </div>

      <!-- 追加・編集モーダル ホルダー -->
      <div id="partnerModalHolder"></div>
    `;
  },

  _renderPrefPill(prefKey, label) {
    const active = this.selectedPref === prefKey;
    return `
      <button type="button" onclick="Partners.setPrefFilter('${prefKey}')"
        style="padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:600; cursor:pointer; transition:var(--transition); border:1px solid ${active ? 'var(--accent-blue)' : 'var(--border-color)'}; background:${active ? 'var(--accent-blue)' : 'var(--bg-card)'}; color:${active ? '#fff' : 'var(--text-secondary)'};">
        ${label}
      </button>
    `;
  },

  _renderCardList(list) {
    if (list.length === 0) {
      return `
        <div style="text-align:center; padding:60px 20px; background:var(--bg-secondary); border-radius:var(--radius); border:1px dashed var(--border-color);">
          <div style="font-size:3rem; margin-bottom:12px; opacity:0.6;">🤝</div>
          <p style="font-size:1.05rem; font-weight:600; color:var(--text-primary); margin-bottom:6px;">該当する提携行政書士が見つかりません</p>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">検索条件を変更するか、右上のボタンから新しく追加してください</p>
          <button class="btn btn-primary" onclick="Partners.showModal()">＋ 新規提携先を追加</button>
        </div>
      `;
    }

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(390px, 1fr)); gap:18px;">
        ${list.map(p => this._renderPartnerCard(p)).join('')}
      </div>
    `;
  },

  _renderPartnerCard(p) {
    // 評価バッジカラー
    let ratingBadge = '';
    const r = p.rating || '';
    if (r.includes('◎') || r.includes('迅速') || p.ratingLevel >= 5) {
      ratingBadge = `<span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:bold;">⭐ ${p.rating || '対応◎・迅速'}</span>`;
    } else if (r.includes('丁寧') || r.includes('安心')) {
      ratingBadge = `<span style="background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:bold;">⭐ ${p.rating || '丁寧・安心'}</span>`;
    } else {
      ratingBadge = `<span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:bold;">★ ${p.rating || '標準'}</span>`;
    }

    // 関連案件（この先生に依頼中の案件数）
    let assignedCount = 0;
    if (typeof Store !== 'undefined' && Store.getCases) {
      const cases = Store.getCases();
      assignedCount = cases.filter(c => c.partnerId === p.id && c.status !== 'done').length;
    }

    return `
      <div class="partner-card" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius); padding:18px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s ease, box-shadow 0.15s ease; position:relative;">
        <div>
          <!-- 上段：都道府県 ＆ 評価 ＆ 操作 -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="background:#2563eb; color:#fff; font-size:0.78rem; font-weight:700; padding:3px 8px; border-radius:4px;">
                ${p.prefecture || '県外'}
              </span>
              ${ratingBadge}
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-ghost btn-small" onclick="Partners.showModal('${p.id}')" title="編集" style="padding:4px 8px; font-size:0.8rem;">✏️ 編集</button>
              <button class="btn btn-ghost btn-small" onclick="Partners.deletePartner('${p.id}')" title="削除" style="padding:4px 8px; font-size:0.8rem; color:#ef4444;">🗑️</button>
            </div>
          </div>

          <!-- 事務所名・代表者 -->
          <div style="margin-bottom:12px;">
            <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-bottom:2px; line-height:1.35;">
              ${p.officeName || '（事務所名未登録）'}
            </h3>
            <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; gap:10px; flex-wrap:wrap;">
              ${p.representative ? `<span>${p.representative}</span>` : ''}
              ${p.association ? `<span style="opacity:0.8;">(${p.association})</span>` : ''}
            </div>
          </div>

          <!-- 管轄運輸支局・軽検協 -->
          <div style="background:var(--bg-secondary); border-radius:6px; padding:8px 10px; margin-bottom:12px; font-size:0.82rem; border-left:3px solid var(--accent-blue);">
            <div style="color:var(--text-muted); font-size:0.72rem; font-weight:600; margin-bottom:2px;">🏛️ 管轄運輸支局・軽検協</div>
            <div style="color:var(--text-primary); font-weight:600; word-break:break-word;">
              ${p.branches || '全国・応相談'}
            </div>
          </div>

          <!-- 代行料金ボックス（最重要ハイライト） -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(59,130,246,0.3); border-radius:8px; padding:10px 12px; margin-bottom:14px;">
            <div style="font-size:0.75rem; font-weight:700; color:#38bdf8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>💰 代行料目安（外注報酬額）</span>
              ${p.feeNote ? `<span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">${p.feeNote}</span>` : ''}
            </div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px 10px; font-size:0.82rem;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary);">🚗 登録代行:</span>
                <strong style="color:var(--text-primary);">${p.feeRegistration ? `¥${Number(p.feeRegistration).toLocaleString()}` : '<span style="color:var(--text-muted);font-weight:normal;">要問合せ</span>'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary);">🚙 軽自動車:</span>
                <strong style="color:var(--text-primary);">${p.feeLight ? `¥${Number(p.feeLight).toLocaleString()}` : '<span style="color:var(--text-muted);font-weight:normal;">要問合せ</span>'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary);">🅿️ 車庫証明:</span>
                <strong style="color:var(--text-primary);">${p.feeGarage ? `¥${Number(p.feeGarage).toLocaleString()}` : '<span style="color:var(--text-muted);font-weight:normal;">要問合せ</span>'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary);">🔩 出張封印:</span>
                <strong style="color:var(--accent-gold);">${p.feeSeal ? `¥${Number(p.feeSeal).toLocaleString()}` : '<span style="color:var(--text-muted);font-weight:normal;">要問合せ</span>'}</strong>
              </div>
            </div>
          </div>

          <!-- 発送先・連絡先エリア（ワンクリックコピー対応） -->
          <div style="font-size:0.82rem; margin-bottom:12px; line-height:1.45;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600;">📭 書類送付先（レターパック等）</span>
              <button type="button" class="btn btn-ghost btn-small" onclick="Partners.copyLetterpack('${p.id}')"
                style="padding:2px 6px; font-size:0.72rem; color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:4px;">
                📋 宛名コピー
              </button>
            </div>
            <div style="color:var(--text-primary); font-size:0.82rem;">
              ${p.zip ? `〒${p.zip}<br>` : ''}
              ${p.address || '<span style="color:var(--text-muted);">住所未登録</span>'}
            </div>
            <div style="margin-top:4px; color:var(--text-secondary); display:flex; gap:12px; flex-wrap:wrap;">
              ${p.phone ? `<span>TEL: <strong style="color:var(--text-primary);">${p.phone}</strong></span>` : ''}
              ${p.fax ? `<span>FAX: ${p.fax}</span>` : ''}
              ${p.mobile ? `<span style="color:#fbbf24;">携帯: ${p.mobile}</span>` : ''}
            </div>
          </div>

          <!-- 振込先・インボイス情報（ワンクリックコピー対応） -->
          <div style="font-size:0.8rem; background:rgba(0,0,0,0.2); border-radius:6px; padding:8px 10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="color:var(--text-muted); font-size:0.72rem; font-weight:600;">🏦 振込先口座</span>
              ${p.bankName ? `
                <button type="button" class="btn btn-ghost btn-small" onclick="Partners.copyBank('${p.id}')"
                  style="padding:2px 6px; font-size:0.72rem; color:var(--accent-green); border:1px solid rgba(16,185,129,0.3); border-radius:4px;">
                  🏦 口座コピー
                </button>
              ` : ''}
            </div>
            ${p.bankName ? `
              <div style="color:var(--text-primary);">
                ${p.bankName} ${p.bankBranch || ''}（${p.accountType || '普通'}）${p.accountNumber || ''}
              </div>
              ${p.accountHolder ? `<div style="color:var(--text-muted); font-size:0.75rem;">口座名義: ${p.accountHolder}</div>` : ''}
            ` : '<div style="color:var(--text-muted); font-size:0.75rem;">口座情報未登録</div>'}
            ${p.invoiceNumber ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">適格番号: ${p.invoiceNumber}</div>` : ''}
          </div>

          <!-- 書類締切・所内対応メモ -->
          ${(p.deadlineNote || p.ratingNote || p.memo) ? `
            <div style="background:rgba(245,158,11,0.06); border:1px dashed rgba(245,158,11,0.25); border-radius:6px; padding:8px 10px; font-size:0.78rem; color:#fde68a;">
              ${p.deadlineNote ? `<div style="margin-bottom:2px;"><strong>⏰ 締切:</strong> ${p.deadlineNote}</div>` : ''}
              ${p.ratingNote ? `<div style="margin-bottom:2px;"><strong>💡 対応感:</strong> ${p.ratingNote}</div>` : ''}
              ${p.memo ? `<div style="color:var(--text-secondary); font-size:0.75rem;">${p.memo}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <!-- 下段：進行中案件バッジ -->
        <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
          <div>
            ${assignedCount > 0 ? `
              <span style="background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 8px; border-radius:12px; font-weight:bold;">
                📋 現在 ${assignedCount}件 外注進行中
              </span>
            ` : `
              <span style="color:var(--text-muted);">進行中案件なし</span>
            `}
          </div>
          <button type="button" class="btn btn-ghost btn-small" onclick="Partners.showModal('${p.id}')" style="font-size:0.75rem;">
            詳細・編集 ❯
          </button>
        </div>
      </div>
    `;
  },

  // モーダル表示（新規または編集）
  showModal(partnerId = null) {
    this.editingId = partnerId;
    const p = partnerId ? Store.getPartner(partnerId) : {
      officeName: '',
      representative: '',
      association: '',
      prefecture: '岐阜県',
      branches: '',
      rating: '対応◎・迅速',
      ratingLevel: 5,
      ratingNote: '',
      feeRegistration: 8800,
      feeLight: 7700,
      feeGarage: 6600,
      feeSeal: 11000,
      feeNote: '',
      zip: '',
      address: '',
      phone: '',
      fax: '',
      mobile: '',
      email: '',
      invoiceNumber: '',
      bankName: '',
      bankBranch: '',
      accountType: '普通',
      accountNumber: '',
      accountHolder: '',
      deadlineNote: '',
      memo: ''
    };

    const isEdit = !!partnerId;
    const html = `
      <div class="modal" id="partnerEditModal" style="display:flex; z-index:1050;">
        <div class="modal-overlay" onclick="Partners.closeModal()"></div>
        <div class="modal-content modal-large" onclick="event.stopPropagation()" style="max-width:760px; max-height:90vh; overflow-y:auto;">
          <div class="modal-header">
            <h2>${isEdit ? '✏️ 提携行政書士の編集' : '＋ 新規提携行政書士の登録'}</h2>
            <button class="modal-close" onclick="Partners.closeModal()">✕</button>
          </div>

          <form id="partnerForm" onsubmit="Partners.savePartnerForm(event)">
            <input type="hidden" name="id" value="${p.id || ''}">

            <!-- 基本情報 -->
            <div style="font-size:0.92rem; font-weight:bold; color:var(--accent-blue); margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              🏢 事務所・代表者情報
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label>事務所名 <span style="color:#ef4444;">*必須</span></label>
                <input type="text" name="officeName" class="form-input" required placeholder="例：岐阜中央行政書士事務所" value="${p.officeName || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>代表行政書士名</label>
                <input type="text" name="representative" class="form-input" placeholder="例：岐阜 太郎" value="${p.representative || ''}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>都道府県 <span style="color:#ef4444;">*</span></label>
                <select name="prefecture" class="form-select">
                  ${['岐阜県','三重県','静岡県','長野県','滋賀県','福井県','石川県','富山県','東京都','神奈川県','埼玉県','千葉県','大阪府','兵庫県','京都府','奈良県','その他'].map(pref => `
                    <option value="${pref}" ${p.prefecture === pref ? 'selected' : ''}>${pref}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group" style="flex:1;">
                <label>所属行政書士会</label>
                <input type="text" name="association" class="form-input" placeholder="例：岐阜県行政書士会" value="${p.association || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>適格請求書登録番号(インボイス)</label>
                <input type="text" name="invoiceNumber" class="form-input" placeholder="例：T1234567890123" value="${p.invoiceNumber || ''}">
              </div>
            </div>

            <div class="form-group">
              <label>管轄運輸支局・軽自動車検査協会</label>
              <input type="text" name="branches" class="form-input" placeholder="例：岐阜運輸支局、飛騨自動車検査登録事務所、軽検協岐阜事務所" value="${p.branches || ''}">
            </div>

            <!-- 代行料金目安（実務ハイライト） -->
            <div style="font-size:0.92rem; font-weight:bold; color:#38bdf8; margin:16px 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              💰 外注代行料目安（税別・税込どちらでも可）
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>🚗 普通車 登録代行料 (円)</label>
                <input type="number" name="feeRegistration" class="form-input" placeholder="8800" value="${p.feeRegistration !== null && p.feeRegistration !== undefined ? p.feeRegistration : ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>🚙 軽自動車 登録代行料 (円)</label>
                <input type="number" name="feeLight" class="form-input" placeholder="7700" value="${p.feeLight !== null && p.feeLight !== undefined ? p.feeLight : ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>🅿️ 車庫証明 代行料 (円)</label>
                <input type="number" name="feeGarage" class="form-input" placeholder="6600" value="${p.feeGarage !== null && p.feeGarage !== undefined ? p.feeGarage : ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>🔩 丁種出張封印 代行料 (円)</label>
                <input type="number" name="feeSeal" class="form-input" placeholder="11000" value="${p.feeSeal !== null && p.feeSeal !== undefined ? p.feeSeal : ''}">
              </div>
            </div>
            <div class="form-group">
              <label>料金補足・特記事項</label>
              <input type="text" name="feeNote" class="form-input" placeholder="例：出張封印の再々委託施封対応可、遠方エリアは出張費+2,200円等" value="${p.feeNote || ''}">
            </div>

            <!-- 対応評価・評判 -->
            <div style="font-size:0.92rem; font-weight:bold; color:var(--accent-gold); margin:16px 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              ⭐ 対応評価・所内評判
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>対応評価タグ</label>
                <select name="rating" class="form-select">
                  <option value="対応◎・迅速" ${p.rating === '対応◎・迅速' ? 'selected' : ''}>対応◎・迅速（超おすすめ）</option>
                  <option value="丁寧・安心" ${p.rating === '丁寧・安心' ? 'selected' : ''}>丁寧・安心（確実重視）</option>
                  <option value="標準" ${p.rating === '標準' ? 'selected' : ''}>標準（通常対応）</option>
                  <option value="要事前確認" ${p.rating === '要事前確認' ? 'selected' : ''}>要事前確認（スケジュール確認必須）</option>
                </select>
              </div>
              <div class="form-group" style="flex:2;">
                <label>評価コメント・対応の特徴</label>
                <input type="text" name="ratingNote" class="form-input" placeholder="例：急ぎの登録も快く即日対応。レスポンスが極めて早い。" value="${p.ratingNote || ''}">
              </div>
            </div>

            <!-- 書類送付先・連絡先 -->
            <div style="font-size:0.92rem; font-weight:bold; color:var(--accent-green); margin:16px 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              📭 書類送付先 ＆ 連絡先（レターパック宛先用）
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>郵便番号</label>
                <input type="text" name="zip" class="form-input" placeholder="例：500-8262" value="${p.zip || ''}">
              </div>
              <div class="form-group" style="flex:3;">
                <label>書類送付先住所</label>
                <input type="text" name="address" class="form-input" placeholder="例：岐阜県岐阜市茜部本郷2丁目88番地" value="${p.address || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>電話番号</label>
                <input type="text" name="phone" class="form-input" placeholder="例：058-271-1234" value="${p.phone || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>FAX番号</label>
                <input type="text" name="fax" class="form-input" placeholder="例：058-271-1235" value="${p.fax || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>携帯電話（緊急用）</label>
                <input type="text" name="mobile" class="form-input" placeholder="例：090-1234-5678" value="${p.mobile || ''}">
              </div>
            </div>
            <div class="form-group">
              <label>メールアドレス</label>
              <input type="email" name="email" class="form-input" placeholder="例：office@example.jp" value="${p.email || ''}">
            </div>

            <!-- 振込先口座情報 -->
            <div style="font-size:0.92rem; font-weight:bold; color:#a78bfa; margin:16px 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              🏦 振込先口座情報（外注費・立替金精算用）
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label>金融機関名</label>
                <input type="text" name="bankName" class="form-input" placeholder="例：十六銀行" value="${p.bankName || ''}">
              </div>
              <div class="form-group" style="flex:2;">
                <label>支店名</label>
                <input type="text" name="bankBranch" class="form-input" placeholder="例：本店営業部" value="${p.bankBranch || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>種別</label>
                <select name="accountType" class="form-select">
                  <option value="普通" ${p.accountType === '普通' ? 'selected' : ''}>普通</option>
                  <option value="当座" ${p.accountType === '当座' ? 'selected' : ''}>当座</option>
                </select>
              </div>
              <div class="form-group" style="flex:2;">
                <label>口座番号</label>
                <input type="text" name="accountNumber" class="form-input" placeholder="例：1234567" value="${p.accountNumber || ''}">
              </div>
            </div>
            <div class="form-group">
              <label>口座名義（カタカナ）</label>
              <input type="text" name="accountHolder" class="form-input" placeholder="例：ギフチュウオウギョウセイショシジムショ" value="${p.accountHolder || ''}">
            </div>

            <!-- 書類締切・所内メモ -->
            <div style="font-size:0.92rem; font-weight:bold; color:var(--text-muted); margin:16px 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              📝 書類締切・所内注意事項メモ
            </div>
            <div class="form-group">
              <label>書類締切・必着条件</label>
              <input type="text" name="deadlineNote" class="form-input" placeholder="例：登録希望日の前日午前中必着。当日朝の持込も事前連絡で相談可。" value="${p.deadlineNote || ''}">
            </div>
            <div class="form-group">
              <label>所内メモ・過去取引履歴</label>
              <textarea name="memo" class="form-input" rows="2" placeholder="所内共有用のメモ（連絡しやすい時間帯や注意事項など）">${p.memo || ''}</textarea>
            </div>

            <!-- アクションボタン -->
            <div class="form-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
              <button type="button" class="btn btn-secondary" onclick="Partners.closeModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary" style="padding:8px 24px;">保存する</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('partnerModalHolder').innerHTML = html;
  },

  closeModal() {
    const modal = document.getElementById('partnerEditModal');
    if (modal) modal.remove();
    this.editingId = null;
  },

  savePartnerForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      officeName: form.officeName.value.trim(),
      representative: form.representative.value.trim(),
      association: form.association.value.trim(),
      prefecture: form.prefecture.value,
      branches: form.branches.value.trim(),
      rating: form.rating.value,
      ratingNote: form.ratingNote.value.trim(),
      feeRegistration: form.feeRegistration.value,
      feeLight: form.feeLight.value,
      feeGarage: form.feeGarage.value,
      feeSeal: form.feeSeal.value,
      feeNote: form.feeNote.value.trim(),
      zip: form.zip.value.trim(),
      address: form.address.value.trim(),
      phone: form.phone.value.trim(),
      fax: form.fax.value.trim(),
      mobile: form.mobile.value.trim(),
      email: form.email.value.trim(),
      invoiceNumber: form.invoiceNumber.value.trim(),
      bankName: form.bankName.value.trim(),
      bankBranch: form.bankBranch.value.trim(),
      accountType: form.accountType.value,
      accountNumber: form.accountNumber.value.trim(),
      accountHolder: form.accountHolder.value.trim(),
      deadlineNote: form.deadlineNote.value.trim(),
      memo: form.memo.value.trim()
    };

    if (this.editingId) {
      Store.updatePartner(this.editingId, data);
      App.showToast('✅ 提携行政書士の情報を更新しました');
    } else {
      Store.addPartner(data);
      App.showToast('✅ 新規提携行政書士を登録しました');
    }

    this.closeModal();
    App.renderContent();
  },

  deletePartner(id) {
    const p = Store.getPartner(id);
    if (!p) return;
    if (!confirm(`「${p.officeName}」をマスターから削除しますか？`)) return;

    Store.deletePartner(id);
    App.showToast('🗑️ 提携先を削除しました');
    App.renderContent();
  },

  onSearch(query) {
    this.searchQuery = query;
    const container = document.getElementById('partnerListContainer');
    if (container) {
      const filtered = this.getFilteredPartners();
      container.innerHTML = this._renderCardList(filtered);
    }
  },

  clearSearch() {
    this.searchQuery = '';
    const input = document.getElementById('partnerSearchInput');
    if (input) input.value = '';
    App.renderContent();
  },

  setPrefFilter(pref) {
    this.selectedPref = pref;
    App.renderContent();
  },

  // レターパック宛名ワンクリックコピー
  copyLetterpack(partnerId) {
    const p = Store.getPartner(partnerId);
    if (!p) return;
    const lines = [
      p.zip ? `〒${p.zip}` : '',
      p.address || '',
      p.officeName || '',
      p.representative ? `${p.representative} 行` : '',
      p.phone ? `TEL: ${p.phone}` : (p.mobile ? `TEL: ${p.mobile}` : '')
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      App.showToast(`📋 ${p.officeName} の宛名をコピーしました！`);
    }).catch(() => {
      prompt('以下の宛名をコピーしてください:', lines);
    });
  },

  // 振込先口座ワンクリックコピー
  copyBank(partnerId) {
    const p = Store.getPartner(partnerId);
    if (!p || !p.bankName) return;
    const lines = [
      `金融機関: ${p.bankName} ${p.bankBranch || ''}`,
      `口座種別: ${p.accountType || '普通'}`,
      `口座番号: ${p.accountNumber || ''}`,
      `口座名義: ${p.accountHolder || ''}`
    ].join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      App.showToast(`🏦 ${p.bankName} の振込口座情報をコピーしました！`);
    }).catch(() => {
      prompt('以下の振込先口座情報をコピーしてください:', lines);
    });
  },

  // CSVエクスポート
  exportCSV() {
    const partners = Store.getPartners();
    if (partners.length === 0) {
      alert('エクスポートする提携先データがありません');
      return;
    }

    const headers = [
      'ID','事務所名','代表者名','所属会','都道府県','管轄運輸支局・軽検協',
      '評価','登録代行料','軽自動車代行料','車庫証明代行料','出張封印代行料',
      '郵便番号','住所','電話番号','FAX番号','携帯番号','メール',
      'インボイス番号','銀行名','支店名','口座種別','口座番号','口座名義','締切メモ','所内メモ'
    ];

    const rows = partners.map(p => [
      p.id, p.officeName, p.representative, p.association, p.prefecture, p.branches,
      p.rating, p.feeRegistration || '', p.feeLight || '', p.feeGarage || '', p.feeSeal || '',
      p.zip, p.address, p.phone, p.fax, p.mobile, p.email,
      p.invoiceNumber, p.bankName, p.bankBranch, p.accountType, p.accountNumber, p.accountHolder,
      p.deadlineNote, p.memo
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => 
      row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `県外提携行政書士マスター_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    App.showToast('📥 提携先マスターCSVを出力しました');
  }
};
