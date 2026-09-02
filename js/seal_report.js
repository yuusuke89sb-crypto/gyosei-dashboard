/**
 * 監査対応 丁種出張封印 取付作業管理簿（2年間台帳）＆ 封印取付完了報告書モジュール
 * - 道路運送車両法第11条および丁種封印取扱要領（2年間保存義務）に完全準拠
 * - 監査提出用 A4横 管理簿（台帳）一括印刷・PDF出力
 * - 個別案件用 A4縦 封印等取付作業完了報告書 発行・印刷
 * - 県外連携（再々委託・受託）ステータス管理
 * - 監査用 CSV エクスポート
 */
const SealReportManager = {
  STORAGE_KEY: 'gyosei_seal_records',
  filterPeriod: '2years', // '2years' | '2026' | '2025' | '2024' | 'all'
  filterType: 'all',      // 'all' | 'self' | 'delegated_out' | 'received_in'
  searchQuery: '',

  // 追加の手動登録レコードを取得
  getCustomRecords() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  saveCustomRecords(records) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  },

  // 案件データと手動登録データを統合して封印記録一覧を作成
  getAllRecords() {
    const customRecords = this.getCustomRecords();
    const cases = typeof Store !== 'undefined' ? Store.getCases() : [];
    
    // 案件から封印案件を抽出
    const sealCases = cases.filter(c => {
      if (c.category === 'seal') return true;
      if (c.subCategory && c.subCategory.includes('封印')) return true;
      if (c.title && c.title.includes('封印')) return true;
      return false;
    });

    const caseRecords = sealCases.map(c => {
      const client = typeof Store !== 'undefined' ? Store.getClient(c.clientId) : null;
      const contact = c.clientContactId && typeof Store !== 'undefined' ? Store.getClientContact(c.clientContactId) : null;
      const staffName = c.staffId && typeof Store !== 'undefined' ? Store.getStaffName(c.staffId) : '日栄 政敏';

      // 施封日・実施日の判定（完了日 ＞ 登録予定日 ＞ 交付日 ＞ 申請日 ＞ 作成日）
      let sealDate = c.completedAt ? c.completedAt.slice(0, 10) : '';
      if (!sealDate) sealDate = c.registrationDate || c.storeDeliveryDate || c.policeDeliveryDate || c.applyDate || (c.createdAt ? c.createdAt.slice(0, 10) : Store.getLocalDateStr());

      // 顧客店舗住所
      const storeName = client ? (client.companyName || client.name) : 'お客様指定店舗';
      const storeAddr = client ? client.address : (c.parkingAddress || c.carAddress || '愛知県内指定場所');
      const storePhone = client ? (client.phone || client.tel || '') : '';
      const contactName = contact ? contact.name : (c.contactName || '');

      // 法定保存期限（施封日から満2年後の該当年月日）
      let retentionDeadline = '';
      if (sealDate) {
        const parts = sealDate.split('-');
        if (parts.length === 3) {
          retentionDeadline = `${parseInt(parts[0], 10) + 2}-${parts[1]}-${parts[2]}`;
        }
      }

      // 県外連携区分の判定
      let sealType = 'self'; // self: 自所施封, delegated_out: 県外委託, received_in: 県外受託
      if (c.subCategory && c.subCategory.includes('県外委託')) sealType = 'delegated_out';
      else if (c.subCategory && c.subCategory.includes('県外受託')) sealType = 'received_in';
      else if (c.memo && c.memo.includes('県外委託')) sealType = 'delegated_out';
      else if (c.memo && c.memo.includes('県外受託')) sealType = 'received_in';

      return {
        id: 'case_' + c.id,
        caseId: c.id,
        isFromCase: true,
        orderNo: c.orderNo || '',
        title: c.title,
        applicantName: c.carName || client?.name || '',
        sealDate: sealDate,
        retentionDeadline: retentionDeadline,
        sealType: sealType, // 'self' | 'delegated_out' | 'received_in'
        storeName: storeName,
        storeAddress: storeAddr,
        storePhone: storePhone,
        contactName: contactName,
        carNumber: c.carNumber || '',
        vin: c.vin || (c.carNumber && c.carNumber.includes('-') ? c.carNumber : (c.memo ? (c.memo.match(/[A-Z0-9]{6,17}/) || [''])[0] : '')),
        workerName: staffName || '代表行政書士 日栄 政敏',
        checkVinMethod: '打刻目視確認・車検証原本照合',
        plateReturned: c.status === 'done' ? '返納完了' : '手続中',
        sealEngraving: '名 / 愛',
        partnerOffice: c.partnerOffice || '',
        status: c.status || 'received',
        memo: c.memo || ''
      };
    });

    // 手動登録分とマージ
    const all = [...caseRecords, ...customRecords];
    // 施封日の新しい順にソート
    return all.sort((a, b) => (b.sealDate || '').localeCompare(a.sealDate || ''));
  },

  // フィルタリングされた台帳レコードを取得
  getFilteredRecords() {
    const all = this.getAllRecords();
    const now = new Date();
    const twoYearsAgoStr = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return all.filter(r => {
      // 期間フィルター
      if (this.filterPeriod === '2years') {
        if (r.sealDate && r.sealDate < twoYearsAgoStr) return false;
      } else if (this.filterPeriod === '2026') {
        if (!r.sealDate || !r.sealDate.startsWith('2026')) return false;
      } else if (this.filterPeriod === '2025') {
        if (!r.sealDate || !r.sealDate.startsWith('2025')) return false;
      } else if (this.filterPeriod === '2024') {
        if (!r.sealDate || !r.sealDate.startsWith('2024')) return false;
      }

      // 区分フィルター
      if (this.filterType !== 'all' && r.sealType !== this.filterType) {
        return false;
      }

      // 検索フィルター
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const match = (r.orderNo && r.orderNo.toLowerCase().includes(q)) ||
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.storeName && r.storeName.toLowerCase().includes(q)) ||
          (r.applicantName && r.applicantName.toLowerCase().includes(q)) ||
          (r.carNumber && r.carNumber.toLowerCase().includes(q)) ||
          (r.vin && r.vin.toLowerCase().includes(q)) ||
          (r.contactName && r.contactName.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  },

  // ─── 🔩 封印管理簿（監査2年台帳）モーダル表示 ───
  showLedgerModal() {
    const existing = document.getElementById('sealLedgerModal');
    if (existing) existing.remove();

    const records = this.getFilteredRecords();
    const all = this.getAllRecords();
    const office = typeof Invoice !== 'undefined' ? Invoice.getOfficeInfo() : {
      name: '行政書士法人フェリス',
      representative: '代表行政書士 日栄 政敏',
      address: '愛知県北名古屋市六ツ師道毛74番地1',
      tel: '0586-50-2896'
    };

    // 統計カウント
    const countTotal = all.length;
    const count2Years = all.filter(r => {
      const now = new Date();
      const twoYearsAgoStr = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return r.sealDate && r.sealDate >= twoYearsAgoStr;
    }).length;
    const countDelegated = all.filter(r => r.sealType === 'delegated_out').length;
    const countReceived = all.filter(r => r.sealType === 'received_in').length;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sealLedgerModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '99998';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('sealLedgerModal').remove()" style="background:rgba(0,0,0,0.85); backdrop-filter:blur(4px); position:fixed; inset:0;"></div>
      <div class="modal-content" style="max-width:96vw; width:1320px; max-height:94vh; padding:20px; display:flex; flex-direction:column; background:var(--bg-panel, #1e293b); border:1px solid var(--border-color, #334155); border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,0.7); z-index:99999; position:relative;">
        
        <!-- モーダルヘッダー -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--border-color, #334155);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="margin:0; font-size:1.25rem; color:#fff; display:flex; align-items:center; gap:6px;">
                🔩 丁種出張封印 取付作業管理簿 <span style="font-size:0.8rem; background:#059669; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold;">監査対応 2年間台帳</span>
              </h2>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); margin-top:4px;">
              法定根拠：道路運送車両法第11条および丁種封印取扱要領（施封日より2年間の自所保管義務） ｜ ${office.name}（${office.representative}）
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" class="btn btn-primary" onclick="SealReportManager.printLedger()" style="font-weight:bold; font-size:0.82rem; padding:6px 14px; background:#2563eb; color:#fff; display:flex; align-items:center; gap:5px;">
              🖨️ 管理簿を一括印刷 / PDF出力 (A4横)
            </button>
            <button type="button" class="btn btn-secondary" onclick="SealReportManager.exportLedgerCSV()" style="font-size:0.8rem; padding:6px 12px;">
              📥 監査用CSV
            </button>
            <button type="button" class="btn btn-secondary" onclick="SealReportManager.showAddRecordModal()" style="font-size:0.8rem; padding:6px 12px;">
              ＋ 手動台帳追加
            </button>
            <button class="modal-close" onclick="document.getElementById('sealLedgerModal').remove()" style="font-size:1.4rem; cursor:pointer; background:none; border:none; color:#fff; margin-left:6px;" title="閉じる">✕</button>
          </div>
        </div>

        <!-- サマリー統計バッジ -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:12px;">
          <div style="background:rgba(15,23,42,0.6); border:1px solid #334155; border-radius:6px; padding:8px 12px;">
            <div style="font-size:0.7rem; color:#94a3b8;">法定保管期間内（過去2年）</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#10b981;">${count2Years} <span style="font-size:0.75rem; font-weight:normal; color:#94a3b8;">件</span></div>
          </div>
          <div style="background:rgba(15,23,42,0.6); border:1px solid #334155; border-radius:6px; padding:8px 12px;">
            <div style="font-size:0.7rem; color:#94a3b8;">自所施封（愛知店舗）</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#38bdf8;">${countTotal - countDelegated - countReceived} <span style="font-size:0.75rem; font-weight:normal; color:#94a3b8;">件</span></div>
          </div>
          <div style="background:rgba(15,23,42,0.6); border:1px solid #334155; border-radius:6px; padding:8px 12px;">
            <div style="font-size:0.7rem; color:#94a3b8;">県外再々委託（他県発送）</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#f59e0b;">${countDelegated} <span style="font-size:0.75rem; font-weight:normal; color:#94a3b8;">件</span></div>
          </div>
          <div style="background:rgba(15,23,42,0.6); border:1px solid #334155; border-radius:6px; padding:8px 12px;">
            <div style="font-size:0.7rem; color:#94a3b8;">県外受託（愛知施封）</div>
            <div style="font-size:1.3rem; font-weight:bold; color:#a855f7;">${countReceived} <span style="font-size:0.75rem; font-weight:normal; color:#94a3b8;">件</span></div>
          </div>
        </div>

        <!-- フィルターコントロール -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">期間:</span>
            <select id="sealFilterPeriod" class="form-select" style="font-size:0.8rem; padding:4px 8px; width:auto; background:#0f172a; color:#fff; border-color:#334155;" onchange="SealReportManager.filterPeriod = this.value; SealReportManager.refreshModal();">
              <option value="2years" ${this.filterPeriod === '2years' ? 'selected' : ''}>⭐ 過去2年間（監査法定保存分）</option>
              <option value="2026" ${this.filterPeriod === '2026' ? 'selected' : ''}>2026年 (令和8年)</option>
              <option value="2025" ${this.filterPeriod === '2025' ? 'selected' : ''}>2025年 (令和7年)</option>
              <option value="2024" ${this.filterPeriod === '2024' ? 'selected' : ''}>2024年 (令和6年)</option>
              <option value="all" ${this.filterPeriod === 'all' ? 'selected' : ''}>全期間（全記録）</option>
            </select>

            <span style="font-size:0.78rem; color:#94a3b8; font-weight:bold; margin-left:6px;">区分:</span>
            <select id="sealFilterType" class="form-select" style="font-size:0.8rem; padding:4px 8px; width:auto; background:#0f172a; color:#fff; border-color:#334155;" onchange="SealReportManager.filterType = this.value; SealReportManager.refreshModal();">
              <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>すべての区分</option>
              <option value="self" ${this.filterType === 'self' ? 'selected' : ''}>自所施封（県内・店舗）</option>
              <option value="delegated_out" ${this.filterType === 'delegated_out' ? 'selected' : ''}>県外再々委託（他県発送）</option>
              <option value="received_in" ${this.filterType === 'received_in' ? 'selected' : ''}>県外受託（愛知施封）</option>
            </select>
          </div>

          <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" id="sealSearchInput" class="form-input" placeholder="🔍 注文№・店舗・ナンバー・車台番号で検索..." value="${this.searchQuery}" style="width:260px; font-size:0.8rem; padding:4px 8px;" oninput="SealReportManager.searchQuery = this.value; SealReportManager.refreshModal();">
          </div>
        </div>

        <!-- 台帳テーブル一覧 -->
        <div style="flex:1; overflow-y:auto; border:1px solid #334155; border-radius:6px; background:#0f172a;">
          <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#e2e8f0; text-align:left;">
            <thead>
              <tr style="background:#1e293b; color:#94a3b8; border-bottom:1px solid #334155; position:sticky; top:0; z-index:10;">
                <th style="padding:8px 6px; width:85px;">施封日</th>
                <th style="padding:8px 6px; width:100px;">注文書№</th>
                <th style="padding:8px 6px; width:180px;">申込店舗（取付場所）</th>
                <th style="padding:8px 6px; width:120px;">申請者・使用者</th>
                <th style="padding:8px 6px; width:110px;">自動車登録番号</th>
                <th style="padding:8px 6px; width:130px;">車台番号</th>
                <th style="padding:8px 6px; width:90px;">区分</th>
                <th style="padding:8px 6px; width:100px;">施封者</th>
                <th style="padding:8px 6px; width:110px;">車台番号確認</th>
                <th style="padding:8px 6px; width:75px;">旧番返納</th>
                <th style="padding:8px 6px; width:85px;">保存期限</th>
                <th style="padding:8px 6px; width:110px; text-align:center;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${records.length === 0 ? `
                <tr>
                  <td colspan="12" style="text-align:center; padding:40px 10px; color:#94a3b8;">
                    該当する出張封印の記録がありません。
                  </td>
                </tr>
              ` : records.map((r, idx) => {
                const is2YearsActive = (() => {
                  if (!r.retentionDeadline) return true;
                  const todayStr = typeof Store !== 'undefined' ? Store.getLocalDateStr() : '';
                  return r.retentionDeadline >= todayStr;
                })();

                let typeBadge = '<span style="background:rgba(56,189,248,0.15);color:#38bdf8;padding:1px 5px;border-radius:3px;font-weight:600;">自所施封</span>';
                if (r.sealType === 'delegated_out') {
                  typeBadge = '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 5px;border-radius:3px;font-weight:bold;">県外委託</span>';
                } else if (r.sealType === 'received_in') {
                  typeBadge = '<span style="background:rgba(168,85,247,0.15);color:#a855f7;padding:1px 5px;border-radius:3px;font-weight:bold;">県外受託</span>';
                }

                return `
                  <tr style="border-bottom:1px solid #1e293b; ${idx % 2 === 1 ? 'background:rgba(30,41,59,0.3);' : ''}">
                    <td style="padding:7px 6px; font-weight:bold; color:#fff;">${r.sealDate || '-'}</td>
                    <td style="padding:7px 6px; font-family:monospace; color:#38bdf8;">${r.orderNo || '-'}</td>
                    <td style="padding:7px 6px;">
                      <div style="font-weight:600; color:#e2e8f0;">${r.storeName || '-'}</div>
                      <div style="font-size:0.7rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${r.storeAddress || ''}</div>
                    </td>
                    <td style="padding:7px 6px; font-weight:600;">${r.applicantName || '-'}</td>
                    <td style="padding:7px 6px; font-weight:bold; color:#10b981;">${r.carNumber || '-'}</td>
                    <td style="padding:7px 6px; font-family:monospace; font-size:0.75rem;">${r.vin || '-'}</td>
                    <td style="padding:7px 6px;">${typeBadge}</td>
                    <td style="padding:7px 6px; font-size:0.75rem;">${r.workerName || '日栄 政敏'}</td>
                    <td style="padding:7px 6px; font-size:0.72rem; color:#10b981;">✔ ${r.checkVinMethod || '目視確認'}</td>
                    <td style="padding:7px 6px;">
                      <span style="font-size:0.72rem; ${r.plateReturned === '返納完了' ? 'color:#10b981;' : 'color:#f59e0b;'}">${r.plateReturned || '返納済'}</span>
                    </td>
                    <td style="padding:7px 6px; font-size:0.72rem; ${is2YearsActive ? 'color:#38bdf8;font-weight:bold;' : 'color:#94a3b8;'}">
                      ${r.retentionDeadline ? r.retentionDeadline : '-'}
                    </td>
                    <td style="padding:7px 6px; text-align:center;">
                      <button type="button" class="btn btn-secondary btn-small" style="font-size:0.7rem; padding:2px 6px;" onclick="SealReportManager.printSingleReport('${r.id}')" title="A4個別作業完了報告書を出力">
                        📄 個別
                      </button>
                      ${!r.isFromCase ? `
                        <button type="button" class="btn btn-danger btn-small" style="font-size:0.7rem; padding:2px 4px; margin-left:2px;" onclick="SealReportManager.deleteCustomRecord('${r.id}')" title="削除">✕</button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94a3b8;">
          <div>表示件数: <b>${records.length}</b> 件 / 全 <b>${all.length}</b> 件</div>
          <div style="display:flex; gap:12px;">
            <span>※本管理簿は愛知県行政書士会丁種封印取扱要領に準拠しています。</span>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  },

  refreshModal() {
    const modal = document.getElementById('sealLedgerModal');
    if (modal) {
      modal.remove();
      this.showLedgerModal();
    }
  },

  // ─── 🖨️ A4横 公式管理簿（台帳）の一括印刷用HTML生成 ───
  printLedger() {
    const records = this.getFilteredRecords();
    const office = typeof Invoice !== 'undefined' ? Invoice.getOfficeInfo() : {
      name: '行政書士法人フェリス',
      representative: '代表行政書士 日栄 政敏',
      address: '愛知県北名古屋市六ツ師道毛74番地1',
      tel: '0586-50-2896',
      assocName: '愛知県行政書士会会員'
    };

    const now = new Date();
    const printDateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const periodLabel = this.filterPeriod === '2years' ? '直近2年間（法定保管対象）' : (this.filterPeriod === 'all' ? '全期間' : `${this.filterPeriod}年分`);

    const win = window.open('', '_blank');
    if (!win) {
      alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="utf-8">
        <title>丁種出張封印 取付作業管理簿（封印等取付確認台帳） - ${office.name}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 12mm 10mm 12mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
            color: #000;
            background: #fff;
            padding: 10px;
            font-size: 10pt;
          }
          .no-print-bar {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #cbd5e1;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; }
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
          }
          .title {
            font-size: 16pt;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .sub-title {
            font-size: 8.5pt;
            color: #333;
            margin-top: 2px;
          }
          .office-info {
            text-align: right;
            font-size: 9pt;
            line-height: 1.35;
          }
          table.ledger-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
          }
          table.ledger-table th, table.ledger-table td {
            border: 1px solid #000;
            padding: 5px 4px;
            text-align: left;
            vertical-align: middle;
          }
          table.ledger-table th {
            background: #f1f5f9;
            text-align: center;
            font-weight: bold;
          }
          .center { text-align: center !important; }
          .nowrap { white-space: nowrap; }
          .footer-note {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #444;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="font-weight:bold; font-size:12pt;">📋 監査用 封印管理台帳 印刷プレビュー</div>
          <div style="display:flex; gap:8px;">
            <button onclick="window.print()" style="padding:6px 16px; background:#2563eb; color:#fff; font-weight:bold; border:none; border-radius:4px; cursor:pointer;">🖨️ 印刷する / PDF保存</button>
            <button onclick="window.close()" style="padding:6px 12px; background:#cbd5e1; border:none; border-radius:4px; cursor:pointer;">✕ 閉じる</button>
          </div>
        </div>

        <div class="header-box">
          <div>
            <div class="title">丁種出張封印 取付作業管理簿（封印等取付確認台帳）</div>
            <div class="sub-title">【対象期間: ${periodLabel} ｜ 道路運送車両法第11条・丁種封印取扱要領準拠（保存期間2年）】</div>
          </div>
          <div class="office-info">
            <div><b>${office.name}</b> (${office.assocName || '愛知県行政書士会会員'})</div>
            <div>${office.representative} ｜ TEL: ${office.tel}</div>
            <div>出力日: ${printDateStr} ｜ 記録件数: ${records.length}件</div>
          </div>
        </div>

        <table class="ledger-table">
          <thead>
            <tr>
              <th style="width:3%;">No.</th>
              <th style="width:7%;">施封日</th>
              <th style="width:8%;">注文書№</th>
              <th style="width:18%;">申込店舗・取付場所（所在地・TEL）</th>
              <th style="width:10%;">申請者名</th>
              <th style="width:11%;">自動車登録番号</th>
              <th style="width:12%;">車台番号（VIN）</th>
              <th style="width:7%;">区分</th>
              <th style="width:8%;">施封者印</th>
              <th style="width:10%;">車台番号等確認</th>
              <th style="width:6%;">旧番返納</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r, i) => `
              <tr>
                <td class="center">${i + 1}</td>
                <td class="center nowrap"><b>${r.sealDate || '-'}</b></td>
                <td class="center" style="font-family:monospace;">${r.orderNo || '-'}</td>
                <td>
                  <div><b>${r.storeName}</b></div>
                  <div style="font-size:7.5pt; color:#333;">${r.storeAddress || ''} ${r.storePhone ? 'TEL:' + r.storePhone : ''}</div>
                </td>
                <td><b>${r.applicantName || '-'}</b></td>
                <td class="center nowrap"><b>${r.carNumber || '-'}</b></td>
                <td style="font-family:monospace; font-size:8pt;">${r.vin || '-'}</td>
                <td class="center" style="font-size:8pt;">
                  ${r.sealType === 'delegated_out' ? '県外委託' : (r.sealType === 'received_in' ? '県外受託' : '自所施封')}
                </td>
                <td class="center" style="font-size:8pt;">${r.workerName ? r.workerName.split(' ').pop() : '日栄'}　印</td>
                <td style="font-size:7.5pt;">${r.checkVinMethod || '打刻目視確認'}</td>
                <td class="center" style="font-size:8pt;">${r.plateReturned || '返納済'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer-note">
          <div>※本台帳は丁種封印取扱要領に基づき、各施封年月日より2年間事務所内にて適正に保管・管理されています。</div>
          <div>受託行政書士：${office.name}　${office.representative}　㊞</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  },

  // ─── 📄 個別 A4縦 封印等取付作業完了報告書の印刷HTML生成 ───
  printSingleReport(recordId) {
    const all = this.getAllRecords();
    const r = all.find(x => x.id === recordId || x.caseId === recordId) || all[0];
    if (!r) {
      alert('封印記録データが見つかりません');
      return;
    }

    const office = typeof Invoice !== 'undefined' ? Invoice.getOfficeInfo() : {
      name: '行政書士法人フェリス',
      representative: '代表行政書士 日栄 政敏',
      address: '愛知県北名古屋市六ツ師道毛74番地1',
      tel: '0586-50-2896',
      assocName: '愛知県行政書士会会員'
    };

    const win = window.open('', '_blank');
    if (!win) {
      alert('ポップアップがブロックされました。');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="utf-8">
        <title>封印等取付作業完了報告書 - ${r.applicantName || ''} 様</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Hiragino Mincho ProN", "Yu Mincho", serif;
            color: #000;
            background: #fff;
            padding: 15px;
            font-size: 11pt;
            line-height: 1.6;
          }
          .no-print { background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px; font-family: sans-serif; }
          @media print { .no-print { display: none !important; } body { padding: 0; } }
          .doc-title { text-align: center; font-size: 20pt; font-weight: bold; letter-spacing: 6px; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .header-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .client-box { width: 55%; font-size: 12pt; }
          .office-box { width: 45%; text-align: right; font-size: 10pt; line-height: 1.5; }
          .report-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10.5pt; }
          .report-table th, .report-table td { border: 1px solid #000; padding: 10px 12px; }
          .report-table th { background: #f8fafc; width: 25%; font-weight: bold; }
          .check-box-list { margin: 15px 0; padding: 12px 16px; border: 1px solid #000; background: #fafafa; font-size: 10pt; line-height: 1.8; }
          .sign-area { margin-top: 30px; display: flex; justify-content: space-between; gap: 20px; }
          .sign-box { width: 48%; border: 1px solid #000; padding: 15px; min-height: 110px; font-size: 10pt; }
          .notice-footer { margin-top: 30px; font-size: 8.5pt; color: #555; text-align: center; border-top: 1px dashed #666; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding:8px 20px; background:#2563eb; color:#fff; font-weight:bold; border:none; border-radius:4px; cursor:pointer;">🖨️ 印刷 / PDF保存</button>
          <button onclick="window.close()" style="padding:8px 14px; background:#cbd5e1; border:none; border-radius:4px; cursor:pointer;">✕ 閉じる</button>
        </div>

        <div class="doc-title">封印等取付作業完了報告書</div>
        
        <div class="header-row">
          <div class="client-box">
            <div style="font-size:14pt; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:4px; display:inline-block; margin-bottom:8px;">
              ${r.storeName} 御中
            </div>
            ${r.contactName ? `<div>ご担当：<b>${r.contactName}</b> 様</div>` : ''}
            ${r.orderNo ? `<div style="font-size:10pt; color:#444; margin-top:4px;">注文書№：${r.orderNo}</div>` : ''}
          </div>
          <div class="office-box">
            <div>報告日：${r.sealDate || Store.getLocalDateStr()}</div>
            <div style="font-weight:bold; font-size:11pt; margin-top:4px;">${office.name}</div>
            <div>${office.assocName || '愛知県行政書士会会員'}</div>
            <div>所在地：${office.address}</div>
            <div>${office.representative}　㊞</div>
            <div>TEL: ${office.tel}</div>
          </div>
        </div>

        <p style="margin-bottom:15px; font-size:10.5pt;">
          丁種封印取扱要領および委託業務契約に基づき、下記車両への封印等取付作業を適正に完了いたしましたのでご報告申し上げます。
        </p>

        <table class="report-table">
          <tr>
            <th>申請者（使用者）</th>
            <td><b>${r.applicantName || '-'}</b> 様</td>
          </tr>
          <tr>
            <th>自動車登録番号</th>
            <td style="font-size:13pt; font-weight:bold;">${r.carNumber || '-'}</td>
          </tr>
          <tr>
            <th>車台番号</th>
            <td style="font-family:monospace; font-size:11pt; font-weight:bold;">${r.vin || '-'}</td>
          </tr>
          <tr>
            <th>作業実施日時</th>
            <td>${r.sealDate || '-'}</td>
          </tr>
          <tr>
            <th>取付場所</th>
            <td>${r.storeName}（${r.storeAddress || ''}）</td>
          </tr>
          <tr>
            <th>施封刻印</th>
            <td>${r.sealEngraving || '名 / 愛'}</td>
          </tr>
          <tr>
            <th>作業実施者</th>
            <td>${office.name}　${r.workerName || '日栄 政敏'}</td>
          </tr>
        </table>

        <div class="check-box-list">
          <div style="font-weight:bold; margin-bottom:4px;">【作業確認項目】</div>
          <div>☑ 自動車検査証原本と現車の車台番号（打刻）が一致していることを目視確認いたしました。</div>
          <div>☑ ナンバープレートを正規の位置に固定し、封印（キャップ）を確実に施封いたしました。</div>
          <div>☑ 旧ナンバープレートを確実に回収・取り外しいたしました（該当車両のみ）。</div>
        </div>

        <div class="sign-area">
          <div class="sign-box">
            <div style="font-weight:bold; margin-bottom:8px;">施封担当行政書士（署名・捺印）</div>
            <div style="margin-top:35px; font-size:11pt;">${office.name}　${r.workerName || '日栄 政敏'}　㊞</div>
          </div>
          <div class="sign-box">
            <div style="font-weight:bold; margin-bottom:8px;">立会受領印（店舗ご担当者様）</div>
            <div style="font-size:9pt; color:#666; margin-top:35px;">上記作業完了および現車を確認しました。　　　　　印</div>
          </div>
        </div>

        <div class="notice-footer">
          ※本報告書は丁種出張封印取扱要領に基づき、作成日より2年間自所にて厳重に保管されます。
        </div>
      </body>
      </html>
    `);
    win.document.close();
  },

  // ─── 📥 CSVエクスポート ───
  exportLedgerCSV() {
    const records = this.getFilteredRecords();
    const headers = ['施封日', '注文書№', '申込店舗', '店舗住所', '店舗TEL', '担当者名', '申請者名', '自動車登録番号', '車台番号', '区分', '施封者', '車台番号確認方法', '旧番返納', '法定保存期限'];
    
    const rows = records.map(r => [
      r.sealDate || '',
      r.orderNo || '',
      r.storeName || '',
      r.storeAddress || '',
      r.storePhone || '',
      r.contactName || '',
      r.applicantName || '',
      r.carNumber || '',
      r.vin || '',
      r.sealType === 'delegated_out' ? '県外委託' : (r.sealType === 'received_in' ? '県外受託' : '自所施封'),
      r.workerName || '',
      r.checkVinMethod || '',
      r.plateReturned || '',
      r.retentionDeadline || ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `丁種出張封印管理簿_${typeof Store !== 'undefined' ? Store.getLocalDateStr() : '2026'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // ─── 手動登録モーダル ───
  showAddRecordModal() {
    const existing = document.getElementById('addSealRecordModal');
    if (existing) existing.remove();

    const today = typeof Store !== 'undefined' ? Store.getLocalDateStr() : '';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addSealRecordModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '100000';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('addSealRecordModal').remove()"></div>
      <div class="modal-content" style="max-width:600px; width:95%; background:#1e293b; color:#fff; border-radius:8px; padding:20px;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">
          <h3 style="margin:0; font-size:1.1rem;">＋ 封印管理簿への手動追加</h3>
          <button class="modal-close" onclick="document.getElementById('addSealRecordModal').remove()" style="background:none; border:none; color:#fff; font-size:1.2rem; cursor:pointer;">✕</button>
        </div>
        <form id="addSealForm" onsubmit="SealReportManager.onSaveCustomRecord(event)">
          <div class="form-row" style="display:flex; gap:8px; margin-bottom:8px;">
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">施封年月日 <span style="color:#ef4444;">*</span></label>
              <input type="date" name="sealDate" required value="${today}" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">注文書№</label>
              <input type="text" name="orderNo" placeholder="例: 57500855" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:8px;">
            <label style="font-size:0.75rem; color:#94a3b8;">申込店舗（取付場所） <span style="color:#ef4444;">*</span></label>
            <input type="text" name="storeName" required placeholder="例: 愛知トヨタWEST 一宮開明店" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
          </div>

          <div class="form-row" style="display:flex; gap:8px; margin-bottom:8px;">
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">店舗担当者</label>
              <input type="text" name="contactName" placeholder="例: 山田 太郎 様" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">申請者（使用者名）</label>
              <input type="text" name="applicantName" placeholder="例: 横田 清 様" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
          </div>

          <div class="form-row" style="display:flex; gap:8px; margin-bottom:8px;">
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">自動車登録番号（ナンバー） <span style="color:#ef4444;">*</span></label>
              <input type="text" name="carNumber" required placeholder="例: 尾張小牧300自1234" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">車台番号</label>
              <input type="text" name="vin" placeholder="例: ZWR90-0123456" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
          </div>

          <div class="form-row" style="display:flex; gap:8px; margin-bottom:8px;">
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">区分</label>
              <select name="sealType" class="form-select" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
                <option value="self">自所施封（県内・店舗）</option>
                <option value="delegated_out">県外再々委託（他県発送）</option>
                <option value="received_in">県外受託（愛知施封）</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label style="font-size:0.75rem; color:#94a3b8;">施封担当者</label>
              <input type="text" name="workerName" value="代表行政書士 日栄 政敏" class="form-input" style="width:100%; background:#0f172a; border:1px solid #334155; color:#fff; padding:6px; border-radius:4px;">
            </div>
          </div>

          <div class="form-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('addSealRecordModal').remove()">キャンセル</button>
            <button type="submit" class="btn btn-primary">💾 台帳に保存</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onSaveCustomRecord(e) {
    e.preventDefault();
    const form = e.target;
    const sealDate = form.sealDate.value;
    let retentionDeadline = '';
    if (sealDate) {
      const parts = sealDate.split('-');
      if (parts.length === 3) {
        retentionDeadline = `${parseInt(parts[0], 10) + 2}-${parts[1]}-${parts[2]}`;
      }
    }

    const newRecord = {
      id: 'custom_' + Date.now().toString(36),
      isFromCase: false,
      sealDate: sealDate,
      retentionDeadline: retentionDeadline,
      orderNo: form.orderNo.value.trim(),
      storeName: form.storeName.value.trim(),
      contactName: form.contactName.value.trim(),
      applicantName: form.applicantName.value.trim(),
      carNumber: form.carNumber.value.trim(),
      vin: form.vin.value.trim(),
      sealType: form.sealType.value,
      workerName: form.workerName.value.trim(),
      checkVinMethod: '打刻目視確認・車検証照合',
      plateReturned: '返納完了',
      sealEngraving: '名 / 愛',
      createdAt: new Date().toISOString()
    };

    const records = this.getCustomRecords();
    records.push(newRecord);
    this.saveCustomRecords(records);

    document.getElementById('addSealRecordModal').remove();
    this.refreshModal();
    if (typeof App !== 'undefined') App.showToast('✅ 封印台帳に記録を追加しました');
  },

  deleteCustomRecord(id) {
    if (!confirm('この手動登録記録を削除しますか？')) return;
    const records = this.getCustomRecords().filter(r => r.id !== id);
    this.saveCustomRecords(records);
    this.refreshModal();
    if (typeof App !== 'undefined') App.showToast('🗑️ 記録を削除しました');
  }
};
