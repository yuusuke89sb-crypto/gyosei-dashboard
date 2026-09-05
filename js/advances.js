/**
 * 立替金・売掛金 消し込み＆回収管理モジュール
 */
const Advances = {
  selectedClientId: '',
  filterCycle: 'all', // all | current | month1 | month2 | overdue
  searchQuery: '',

  render() {
    const cases = Store.getCases();
    const clients = Store.getClients();

    // 取引先ごとの未決済サマリー計算
    const clientSummaries = this.calcClientSummaries(cases, clients);

    // 現在選択中の取引先の案件リスト
    const targetCases = this.selectedClientId
      ? cases.filter(c => c.clientId == this.selectedClientId && c.status !== 'deleted')
      : [];

    return `
      <div class="advances-page" style="padding-bottom: 80px;">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <h1>💰 立替金・一括消し込み管理</h1>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:4px 0 0 0;">
              月300件の案件から、顧客別の「報酬＋立替金」の一括回収・消し込みをスムーズに行います。
            </p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" onclick="Advances.exportSummaryCSV()">📊 回収まとめCSV出力</button>
            <button class="btn btn-primary" onclick="Advances.showBulkPaymentModal()">💳 振込一括消し込み</button>
          </div>
        </div>

        <!-- 3大質問解決・運用ナビゲーションカード -->
        <div class="card" style="margin-top:16px; background:linear-gradient(135deg, rgba(23,63,102,0.05), rgba(245,158,11,0.05)); border:1px solid rgba(23,63,102,0.15); padding:16px;">
          <h3 style="margin:0 0 8px 0; font-size:0.95rem; color:var(--accent-color); display:flex; align-items:center; gap:6px;">
            💡 現場の立ち替え＆高速代・小口現金 運用ルール
          </h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px; font-size:0.825rem; color:var(--text-color);">
            <div style="background:var(--card-bg); padding:10px; border-radius:6px; border:1px solid var(--border-color);">
              <strong>💳 原則：カード・キャッシュレス支払</strong><br>
              法人カード等で支払えばMF会計に明細が自動連動。手入力がゼロになり一番楽です。
            </div>
            <div style="background:var(--card-bg); padding:10px; border-radius:6px; border:1px solid var(--border-color);">
              <strong>💵 現金払いオンリー（警察署の証紙代等）</strong><br>
              「小口現金財布（例5万円）」を用意。ダッシュボードの案件入力時に「証紙代 2,600円」と入力すれば請求書に反映されます。
            </div>
            <div style="background:var(--card-bg); padding:10px; border-radius:6px; border:1px solid var(--border-color);">
              <strong>🚗 高速代（実費請求 vs 自社経費）</strong><br>
              顧客へ請求する高速代は案件の「立替金内訳」に入力。請求しない自社高速代はそのままETC明細の旅費交通費でOKです。
            </div>
          </div>
        </div>

        <!-- 全体サマリーメーター -->
        ${this.renderMetrics(cases)}

        <div style="display:grid; grid-template-columns: 320px 1fr; gap:16px; margin-top:20px;">
          <!-- 左カラム：取引先リスト＆未回収残高 -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="margin:0; font-size:0.95rem;">🏢 取引先別 未回収残高</h3>
              <span class="badge" style="background:var(--bg-gray); color:var(--text-muted);">${clientSummaries.length}社</span>
            </div>
            <input type="text" class="search-input" placeholder="🔍 取引先名で検索..." 
              value="${this.searchQuery}" oninput="Advances.onSearchClient(this.value)" style="margin-bottom:12px; font-size:0.85rem;">
            
            <div style="max-height:550px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
              ${clientSummaries.length === 0 
                ? '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px 0;">該当する取引先はありません</p>'
                : clientSummaries.map(cs => this.renderClientRow(cs)).join('')
              }
            </div>
          </div>

          <!-- 右カラム：選択中取引先の消し込み＆案件一覧 -->
          <div class="card" style="padding:16px;">
            ${this.renderDetailArea(targetCases, clients)}
          </div>
        </div>
      </div>

      ${this.renderModals(clients)}
    `;
  },

  // サマリー計算
  calcClientSummaries(cases, clients) {
    const map = {};

    cases.forEach(c => {
      if (c.status === 'deleted') return;
      const clientId = c.clientId || 'unassigned';
      if (!map[clientId]) {
        const client = clients.find(cl => cl.id == clientId);
        map[clientId] = {
          clientId,
          name: client ? client.name : '（取引先未設定）',
          companyName: client ? client.companyName : '',
          cycle: client ? (client.paymentCycle || 'month1') : 'month1', // current | month1 | month2
          totalUnpaidFee: 0,
          totalUnpaidAdvance: 0,
          unpaidCount: 0,
          cases: [],
        };
      }

      // 立替金合計
      const advanceSum = (c.advances || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const feeSum = Number(c.fee || 0);

      const isPaid = c.isPaid || c.status === 'done';
      const isAdvancePaid = c.isAdvancePaid || isPaid;

      if (!isPaid || !isAdvancePaid) {
        map[clientId].unpaidCount++;
        if (!isPaid) map[clientId].totalUnpaidFee += feeSum;
        if (!isAdvancePaid) map[clientId].totalUnpaidAdvance += advanceSum;
      }
      map[clientId].cases.push(c);
    });

    let list = Object.values(map);

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(cs => cs.name.toLowerCase().includes(q) || (cs.companyName && cs.companyName.toLowerCase().includes(q)));
    }

    // 未回収合計が高い順
    list.sort((a, b) => (b.totalUnpaidFee + b.totalUnpaidAdvance) - (a.totalUnpaidFee + a.totalUnpaidAdvance));
    return list;
  },

  renderMetrics(cases) {
    let totalUnpaidFee = 0;
    let totalUnpaidAdvance = 0;
    let overdueCount = 0;

    const now = new Date();

    cases.forEach(c => {
      if (c.status === 'deleted') return;
      const advanceSum = (c.advances || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const feeSum = Number(c.fee || 0);

      const isPaid = c.isPaid || c.status === 'done';
      const isAdvancePaid = c.isAdvancePaid || isPaid;

      if (!isPaid) totalUnpaidFee += feeSum;
      if (!isAdvancePaid) totalUnpaidAdvance += advanceSum;

      // 滞留チェック（作成から45日以上経過して未回収）
      if ((!isPaid || !isAdvancePaid) && c.createdAt) {
        const created = new Date(c.createdAt);
        const diffDays = (now - created) / (1000 * 60 * 60 * 24);
        if (diffDays > 45) overdueCount++;
      }
    });

    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:16px;">
        <div class="stat-card" style="border-left:4px solid var(--accent-gold);">
          <div class="stat-label">未回収 立替金 総額</div>
          <div class="stat-number" style="color:var(--accent-gold);">¥${totalUnpaidAdvance.toLocaleString()}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">証紙・ナンバー・税金等の未回収実費</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--primary-color);">
          <div class="stat-label">未回収 報酬額 総額</div>
          <div class="stat-number">¥${totalUnpaidFee.toLocaleString()}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">事務所の未回収報酬</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #ef4444;">
          <div class="stat-label">滞留（回収遅延）案件</div>
          <div class="stat-number" style="color:#ef4444;">${overdueCount} <span style="font-size:0.9rem;">件</span></div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">45日以上未回収の注意案件</div>
        </div>
      </div>
    `;
  },

  renderClientRow(cs) {
    const isSelected = cs.clientId == this.selectedClientId;
    const totalUnpaid = cs.totalUnpaidFee + cs.totalUnpaidAdvance;

    let cycleBadge = '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem;">翌月25日払</span>';
    if (cs.cycle === 'current') cycleBadge = '<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.7rem;">当月回収</span>';
    if (cs.cycle === 'month2') cycleBadge = '<span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.7rem;">翌々月25日払</span>';

    return `
      <div onclick="Advances.selectClient('${cs.clientId}')" style="
        padding:12px; border-radius:8px; cursor:pointer; transition:all 0.15s;
        border:1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
        background:${isSelected ? 'rgba(23,63,102,0.06)' : 'var(--card-bg)'};
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div style="font-weight:600; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">
            ${cs.companyName || cs.name}
          </div>
          ${cycleBadge}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-top:6px;">
          <span style="color:var(--text-muted);">未回収: ${cs.unpaidCount}件</span>
          <span style="font-weight:700; color:${totalUnpaid > 0 ? 'var(--accent-gold)' : 'var(--text-muted)'};">
            ¥${totalUnpaid.toLocaleString()}
          </span>
        </div>
      </div>
    `;
  },

  renderDetailArea(targetCases, clients) {
    if (!this.selectedClientId) {
      return `
        <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:12px;">🏢</div>
          <h3>左側のリストから取引先を選択してください</h3>
          <p style="font-size:0.875rem;">取引先ごとの「報酬＋立替金」の一括振込消し込みや未決済案件の確認ができます。</p>
        </div>
      `;
    }

    const client = clients.find(cl => cl.id == this.selectedClientId);
    const clientName = client ? (client.companyName || client.name) : '取引先';

    // 案件リスト
    const activeCases = targetCases.filter(c => c.status !== 'done');
    const doneCases = targetCases.filter(c => c.status === 'done');

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border-color);">
          <div>
            <h2 style="margin:0; font-size:1.15rem;">🏢 ${clientName}</h2>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
              登録案件数: ${targetCases.length}件 （未処理: ${activeCases.length}件）
            </div>
          </div>
          <button class="btn btn-primary btn-small" onclick="Advances.showBulkPaymentModal('${this.selectedClientId}')">
            💳 この取引先を一括消し込み
          </button>
        </div>

        <div class="table-container">
          <table class="data-table" style="font-size:0.825rem;">
            <thead>
              <tr>
                <th>受任日/No</th>
                <th>案件名/車名</th>
                <th>報酬額</th>
                <th>立替金内訳</th>
                <th>合計請求額</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${targetCases.length === 0 
                ? '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">この取引先の案件はありません</td></tr>'
                : targetCases.map(c => this.renderCaseTableRow(c)).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderCaseTableRow(c) {
    const advanceSum = (c.advances || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const fee = Number(c.fee || 0);
    const grandTotal = fee + advanceSum;

    // 個別フラグの判定（status==='done' は従来互換で全額済み扱い）
    const isFeePaid = !!(c.isPaid);
    const isAdvPaid = !!(c.isAdvancePaid);
    const isAllDone = (isFeePaid && isAdvPaid) || c.status === 'done';

    // ステータスバッジの4段階表示
    let statusBadge;
    if (isAllDone) {
      statusBadge = '<span class="badge" style="background:#dcfce7; color:#15803d;">✅ 全額済</span>';
    } else if (isFeePaid && !isAdvPaid) {
      statusBadge = '<span class="badge" style="background:#e0f2fe; color:#0369a1;">報酬のみ済</span>';
    } else if (!isFeePaid && isAdvPaid) {
      statusBadge = '<span class="badge" style="background:#fef3c7; color:#92400e;">立替のみ済</span>';
    } else {
      statusBadge = '<span class="badge" style="background:#fee2e2; color:#b91c1c;">未回収</span>';
    }

    // 操作ボタン群
    let actionButtons;
    if (isAllDone) {
      actionButtons = `<button class="btn btn-secondary btn-small" onclick="Advances.resetPayment('${c.id}')" style="font-size:0.72rem;">未回収に戻す</button>`;
    } else {
      const btns = [];
      if (advanceSum > 0 && !isAdvPaid) {
        btns.push(`<button class="btn btn-secondary btn-small" onclick="Advances.toggleAdvancePaid('${c.id}')" style="font-size:0.72rem;">💰 立替のみ</button>`);
      }
      if (fee > 0 && !isFeePaid) {
        btns.push(`<button class="btn btn-secondary btn-small" onclick="Advances.toggleFeePaid('${c.id}')" style="font-size:0.72rem;">📋 報酬のみ</button>`);
      }
      btns.push(`<button class="btn btn-primary btn-small" onclick="Advances.toggleFullPaid('${c.id}')" style="font-size:0.72rem;">✅ 全額</button>`);
      actionButtons = `<div style="display:flex; gap:4px; flex-wrap:wrap;">${btns.join('')}</div>`;
    }

    // 立替金内訳テキスト
    const advanceDetails = (c.advances || []).map(a => `${a.label}: ¥${Number(a.amount).toLocaleString()}`).join(', ') || 'なし';

    // 報酬欄・立替金欄に消し込み済みの打ち消し線
    const feeStyle = isFeePaid && !isAllDone ? 'text-decoration:line-through; opacity:0.5;' : '';
    const advStyle = isAdvPaid && !isAllDone ? 'text-decoration:line-through; opacity:0.5;' : '';

    return `
      <tr>
        <td>
          <div>${c.applyDate || (c.createdAt ? c.createdAt.slice(0,10) : '-')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${c.id}</div>
        </td>
        <td>
          <div style="font-weight:600;">${c.title}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${c.category || ''}</div>
        </td>
        <td style="${feeStyle}">¥${fee.toLocaleString()}</td>
        <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${advStyle}" title="${advanceDetails}">
          <span style="color:var(--accent-gold); font-weight:600;">¥${advanceSum.toLocaleString()}</span>
          <div style="font-size:0.72rem; color:var(--text-muted);">${advanceDetails}</div>
        </td>
        <td style="font-weight:700;">¥${grandTotal.toLocaleString()}</td>
        <td>${statusBadge}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  },

  // 選択・アクション
  selectClient(id) {
    this.selectedClientId = id;
    App.refresh();
  },

  onSearchClient(query) {
    this.searchQuery = query;
    App.refresh();
  },

  toggleAdvancePaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    const newVal = !c.isAdvancePaid;
    const updates = { isAdvancePaid: newVal };
    // 両方済みになったら自動的に完了ステータスにする
    if (newVal && c.isPaid) {
      updates.status = 'done';
      updates.completedAt = new Date().toISOString();
    }
    Store.updateCase(caseId, updates);
    App.showToast(newVal ? '💰 立替金を消し込みました' : '🔄 立替金を未回収に戻しました');
    App.refresh();
  },

  toggleFeePaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    const newVal = !c.isPaid;
    const updates = { isPaid: newVal };
    // 両方済みになったら自動的に完了ステータスにする
    if (newVal && c.isAdvancePaid) {
      updates.status = 'done';
      updates.completedAt = new Date().toISOString();
    }
    Store.updateCase(caseId, updates);
    App.showToast(newVal ? '📋 報酬を消し込みました' : '🔄 報酬を未回収に戻しました');
    App.refresh();
  },

  toggleFullPaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    Store.updateCase(caseId, {
      isPaid: true,
      isAdvancePaid: true,
      status: 'done',
      completedAt: new Date().toISOString(),
    });
    App.showToast('✅ 報酬＋立替金を全額消し込みました');
    App.refresh();
  },

  resetPayment(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    Store.updateCase(caseId, {
      isPaid: false,
      isAdvancePaid: false,
      status: 'delivery',
      completedAt: null,
    });
    App.showToast('🔄 未回収ステータスに戻しました');
    App.refresh();
  },

  // モーダル・一括消し込み
  showBulkPaymentModal(defaultClientId = '') {
    const clients = Store.getClients();
    const targetClientId = defaultClientId || this.selectedClientId || (clients[0] ? clients[0].id : '');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'bulkPaymentModal';

    modal.innerHTML = `
      <div class="modal-content" style="max-width:640px;">
        <div class="modal-header">
          <h2>💳 取引先一括振込 消し込み</h2>
          <button class="modal-close" onclick="document.getElementById('bulkPaymentModal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>対象の取引先</label>
            <select id="bpm_clientId" class="form-control" onchange="Advances.onBulkClientChange(this.value)">
              ${clients.map(cl => `<option value="${cl.id}" ${cl.id == targetClientId ? 'selected' : ''}>${cl.companyName || cl.name}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
            <div class="form-group">
              <label>入金日（振込日）</label>
              <input type="date" id="bpm_date" class="form-control" value="${Store.getLocalDateStr()}">
            </div>
            <div class="form-group">
              <label>実際の振込金額（税込総額）</label>
              <input type="number" id="bpm_amount" class="form-control" placeholder="例: 250000" oninput="Advances.calcBulkDiff()">
            </div>
            <div class="form-group">
              <label>消し込み対象</label>
              <select id="bpm_payType" class="form-control" onchange="Advances.calcBulkDiff()">
                <option value="full">全額（報酬＋立替金）</option>
                <option value="advance_only">立替金のみ</option>
                <option value="fee_only">報酬のみ</option>
              </select>
            </div>
          </div>

          <div style="margin-top:16px;">
            <label style="font-weight:600; font-size:0.9rem;">未消し込み案件の選択</label>
            <div id="bpm_casesList" style="max-height:240px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; padding:8px; margin-top:6px;">
              <!-- 動的生成 -->
            </div>
          </div>

          <div id="bpm_summaryArea" style="margin-top:12px; padding:12px; background:var(--bg-gray); border-radius:6px; font-size:0.875rem;">
            <!-- 金額一致チェック表示 -->
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('bulkPaymentModal').remove()">キャンセル</button>
          <button class="btn btn-primary" onclick="Advances.executeBulkPayment()">一括消し込みを実行</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.onBulkClientChange(targetClientId);
  },

  onBulkClientChange(clientId) {
    const listArea = document.getElementById('bpm_casesList');
    if (!listArea) return;

    // 全額済み（isPaid && isAdvancePaid 両方true、またはstatus===done）以外を表示
    const cases = Store.getCasesByClient(clientId).filter(c => {
      const allDone = (c.isPaid && c.isAdvancePaid) || c.status === 'done';
      return !allDone;
    });

    if (cases.length === 0) {
      listArea.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:16px 0; margin:0;">未決済の案件はありません</p>';
      this.calcBulkDiff();
      return;
    }

    listArea.innerHTML = cases.map(c => {
      const advanceSum = (c.advances || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const fee = Number(c.fee || 0);
      const total = fee + advanceSum;
      // 部分消し込み済みのバッジ
      let partialBadge = '';
      if (c.isAdvancePaid && !c.isPaid) partialBadge = '<span style="background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:3px; font-size:0.68rem; font-weight:600; margin-left:4px;">立替済</span>';
      if (c.isPaid && !c.isAdvancePaid) partialBadge = '<span style="background:#e0f2fe; color:#0369a1; padding:1px 6px; border-radius:3px; font-size:0.68rem; font-weight:600; margin-left:4px;">報酬済</span>';
      return `
        <label style="display:flex; align-items:center; justify-content:space-between; padding:8px; border-bottom:1px solid var(--border-color); cursor:pointer;">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="bpm-case-cb" value="${c.id}" data-fee="${fee}" data-advance="${advanceSum}" data-total="${total}" checked onchange="Advances.calcBulkDiff()">
            <div>
              <div style="font-weight:600; font-size:0.85rem;">${c.title}${partialBadge}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${c.applyDate || (c.createdAt ? c.createdAt.slice(0,10) : '-')}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:0.85rem;">¥${total.toLocaleString()}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">報酬¥${fee.toLocaleString()} + 立替¥${advanceSum.toLocaleString()}</div>
          </div>
        </label>
      `;
    }).join('');

    this.calcBulkDiff();
  },

  calcBulkDiff() {
    const sumArea = document.getElementById('bpm_summaryArea');
    const amountInput = document.getElementById('bpm_amount');
    const payTypeEl = document.getElementById('bpm_payType');
    if (!sumArea) return;

    const payType = payTypeEl ? payTypeEl.value : 'full';
    const checkboxes = document.querySelectorAll('.bpm-case-cb:checked');
    let selectedSum = 0;
    checkboxes.forEach(cb => {
      if (payType === 'advance_only') {
        selectedSum += Number(cb.getAttribute('data-advance') || 0);
      } else if (payType === 'fee_only') {
        selectedSum += Number(cb.getAttribute('data-fee') || 0);
      } else {
        selectedSum += Number(cb.getAttribute('data-total') || 0);
      }
    });

    const enteredAmount = Number(amountInput ? amountInput.value : 0);
    const diff = enteredAmount - selectedSum;

    const payLabel = payType === 'advance_only' ? '立替金合計' : payType === 'fee_only' ? '報酬合計' : '合計請求額';

    let statusText = '';
    if (enteredAmount > 0) {
      if (diff === 0) {
        statusText = '<span style="color:#15803d; font-weight:700;">✅ 振込額と選択案件の合計がピッタリ一致しています！</span>';
      } else if (diff < 0) {
        statusText = `<span style="color:#b91c1c; font-weight:700;">⚠️ 振込額が 選択合計より ¥${Math.abs(diff).toLocaleString()} 不足しています（振込手数料等を確認してください）</span>`;
      } else {
        statusText = `<span style="color:#b45309; font-weight:700;">ℹ️ 振込額が 選択合計より ¥${diff.toLocaleString()} 多いです（過剰入金・他案件分）</span>`;
      }
    }

    sumArea.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>選択された案件の${payLabel}:</span>
        <span style="font-weight:700; font-size:1rem;">¥${selectedSum.toLocaleString()}</span>
      </div>
      ${statusText ? `<div style="margin-top:6px;">${statusText}</div>` : ''}
    `;
  },

  executeBulkPayment() {
    const checkboxes = document.querySelectorAll('.bpm-case-cb:checked');
    if (checkboxes.length === 0) {
      alert('消し込みを行う案件を1つ以上選択してください');
      return;
    }

    const date = document.getElementById('bpm_date').value || Store.getLocalDateStr();
    const payTypeEl = document.getElementById('bpm_payType');
    const payType = payTypeEl ? payTypeEl.value : 'full';
    let count = 0;

    checkboxes.forEach(cb => {
      const caseId = cb.value;
      const existing = Store.getCase(caseId);
      if (!existing) return;

      if (payType === 'advance_only') {
        // 立替金のみ消し込み
        const updates = { isAdvancePaid: true };
        if (existing.isPaid) {
          updates.status = 'done';
          updates.completedAt = `${date}T12:00:00.000Z`;
        }
        Store.updateCase(caseId, updates);
      } else if (payType === 'fee_only') {
        // 報酬のみ消し込み
        const updates = { isPaid: true };
        if (existing.isAdvancePaid) {
          updates.status = 'done';
          updates.completedAt = `${date}T12:00:00.000Z`;
        }
        Store.updateCase(caseId, updates);
      } else {
        // 全額消し込み
        Store.updateCase(caseId, {
          isPaid: true,
          isAdvancePaid: true,
          status: 'done',
          completedAt: `${date}T12:00:00.000Z`,
        });
      }
      count++;
    });

    const label = payType === 'advance_only' ? '立替金' : payType === 'fee_only' ? '報酬' : '全額';
    document.getElementById('bulkPaymentModal').remove();
    App.showToast(`🎉 ${count}件の案件の${label}を一括消し込みしました！`);
    App.refresh();
  },

  exportSummaryCSV() {
    const cases = Store.getCases();
    const clients = Store.getClients();

    const headers = ['取引先名', '回収サイクル', '未回収件数', '未回収報酬額', '未回収立替金額', '未回収総額'];
    const summaries = this.calcClientSummaries(cases, clients);

    const rows = [headers];
    summaries.forEach(s => {
      rows.push([
        s.companyName || s.name,
        s.cycle === 'current' ? '当月' : s.cycle === 'month2' ? '翌々月' : '翌月',
        s.unpaidCount,
        s.totalUnpaidFee,
        s.totalUnpaidAdvance,
        s.totalUnpaidFee + s.totalUnpaidAdvance
      ]);
    });

    const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `立替金・売掛金回収管理表_${Store.getLocalDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('📥 立替金回収管理表CSVを出力しました');
  },

  renderModals() {
    return '';
  }
};
