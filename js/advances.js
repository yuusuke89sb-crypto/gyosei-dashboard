/**
 * 立替金・売掛金 消し込み＆回収管理モジュール
 */
const Advances = {
  selectedClientId: '',
  filterCycle: 'all', // all | current | month1 | month2 | overdue
  filterDealer: 'all', // all | toyota | fuso | nissan | other | unassigned
  filterCaseStatus: 'done', // done (完了案件のみ/請求売掛対象) | all (全案件/進行中含む見込)
  searchQuery: '',

  setCaseStatusFilter(status) {
    this.filterCaseStatus = status;
    if (typeof App !== 'undefined') App.refreshView();
  },

  setDealerFilter(groupKey) {
    this.filterDealer = groupKey;
    if (typeof App !== 'undefined') App.refreshView();
  },

  getDealerGroup(cs) {
    if (cs.clientId === 'unassigned') return 'unassigned';
    const combined = ((cs.companyName || '') + ' ' + (cs.name || '')).toUpperCase();
    if (combined.includes('トヨタ') || combined.includes('WEST') || combined.includes('キャラット')) {
      return 'toyota';
    }
    if (combined.includes('三菱') || combined.includes('ふそう') || combined.includes('FUSO')) {
      return 'fuso';
    }
    if (combined.includes('日産') || combined.includes('NISSAN')) {
      return 'nissan';
    }
    return 'other';
  },

  calcDealerGroups(clientSummaries) {
    const groups = {
      toyota:     { key: 'toyota',     name: '愛知トヨタWEST', icon: '🏢', count: 0, cases: 0, fee: 0, adv: 0, total: 0 },
      fuso:       { key: 'fuso',       name: '三菱ふそう',     icon: '🚚', count: 0, cases: 0, fee: 0, adv: 0, total: 0 },
      nissan:     { key: 'nissan',     name: '日産愛知',       icon: '🚗', count: 0, cases: 0, fee: 0, adv: 0, total: 0 },
      other:      { key: 'other',      name: 'その他・一般',   icon: '💼', count: 0, cases: 0, fee: 0, adv: 0, total: 0 },
      unassigned: { key: 'unassigned', name: '得意先未入力',   icon: '⚠️', count: 0, cases: 0, fee: 0, adv: 0, total: 0 }
    };
    (clientSummaries || []).forEach(cs => {
      const gKey = this.getDealerGroup(cs);
      const g = groups[gKey] || groups.other;
      g.count++;
      g.cases += (cs.unpaidCount || 0);
      g.fee += (cs.totalUnpaidFee || 0);
      g.adv += (cs.totalUnpaidAdvance || 0);
      g.total += ((cs.totalUnpaidFee || 0) + (cs.totalUnpaidAdvance || 0));
    });
    return groups;
  },

  render() {
    const cases = Store.getCases();
    const clients = Store.getClients();

    // 取引先ごとの未決済サマリー計算
    const clientSummaries = this.calcClientSummaries(cases, clients);

    // 現在選択中の取引先の案件リスト（未入力案件の救済＋ステータス連動）
    const targetCases = this.selectedClientId
      ? cases.filter(c => {
          if (c.status === 'deleted') return false;
          if (this.filterCaseStatus === 'done' && c.status !== 'done') return false;
          if (this.selectedClientId === 'unassigned') {
            return !c.clientId || !clients.some(cl => String(cl.id) === String(c.clientId));
          }
          return String(c.clientId) === String(this.selectedClientId);
        })
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

        <!-- 全体サマリーメーター ＆ ディーラーグループ別合算 -->
        ${this.renderMetrics(cases, clientSummaries)}

        <div style="display:grid; grid-template-columns: 320px 1fr; gap:16px; margin-top:20px;">
          <!-- 左カラム：取引先リスト＆未回収残高 -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="margin:0; font-size:0.95rem;">🏢 取引先別 未回収残高</h3>
              <span class="badge" style="background:var(--bg-gray); color:var(--text-muted);">${(() => {
                const filtered = this.filterDealer !== 'all' ? clientSummaries.filter(cs => this.getDealerGroup(cs) === this.filterDealer) : clientSummaries;
                return `${filtered.length}社${this.filterDealer !== 'all' ? ' (絞込)' : ''}`;
              })()}</span>
            </div>
            <input type="text" class="search-input" placeholder="🔍 取引先名で検索..." 
              value="${this.searchQuery}" oninput="Advances.onSearchClient(this.value)" style="margin-bottom:12px; font-size:0.85rem;">
            
            <div style="max-height:550px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
              ${(() => {
                const list = this.filterDealer !== 'all' ? clientSummaries.filter(cs => this.getDealerGroup(cs) === this.filterDealer) : clientSummaries;
                if (list.length === 0) {
                  return '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px 0;">該当する取引先はありません</p>';
                }
                return list.map(cs => this.renderClientRow(cs)).join('');
              })()}
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

  // サマリー計算（完了案件のみ／全案件の切り替え対応）
  calcClientSummaries(cases, clients) {
    const map = {};

    const filteredCases = cases.filter(c => {
      if (c.status === 'deleted') return false;
      if (this.filterCaseStatus === 'done') return c.status === 'done';
      return true;
    });

    filteredCases.forEach(c => {
      const hasClient = c.clientId && clients.some(cl => String(cl.id) === String(c.clientId));
      const clientId = hasClient ? String(c.clientId) : 'unassigned';
      if (!map[clientId]) {
        const client = hasClient ? clients.find(cl => String(cl.id) === String(clientId)) : null;
        map[clientId] = {
          clientId,
          name: client ? client.name : '（取引先未設定）',
          companyName: client ? client.companyName : '⚠️ 得意先未入力',
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

      const isPaid = !!c.isPaid;
      const isAdvancePaid = !!c.isAdvancePaid;

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

    // 未回収合計が高い順（得意先未入力は注意喚起のため最上位に配置）
    list.sort((a, b) => {
      if (a.clientId === 'unassigned') return -1;
      if (b.clientId === 'unassigned') return 1;
      return (b.totalUnpaidFee + b.totalUnpaidAdvance) - (a.totalUnpaidFee + a.totalUnpaidAdvance);
    });
    return list;
  },

  renderMetrics(cases, clientSummaries) {
    let totalUnpaidFee = 0;
    let totalUnpaidAdvance = 0;
    let overdueCount = 0;

    const now = new Date();

    const filteredCases = cases.filter(c => {
      if (c.status === 'deleted') return false;
      if (this.filterCaseStatus === 'done') return c.status === 'done';
      return true;
    });

    filteredCases.forEach(c => {
      const advanceSum = (c.advances || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const feeSum = Number(c.fee || 0);

      const isPaid = !!c.isPaid;
      const isAdvancePaid = !!c.isAdvancePaid;

      if (!isPaid) totalUnpaidFee += feeSum;
      if (!isAdvancePaid) totalUnpaidAdvance += advanceSum;

      // 滞留チェック（作成から45日以上経過して未回収）
      if ((!isPaid || !isAdvancePaid) && c.createdAt) {
        const created = new Date(c.createdAt);
        const diffDays = (now - created) / (1000 * 60 * 60 * 24);
        if (diffDays > 45) overdueCount++;
      }
    });

    const groups = this.calcDealerGroups(clientSummaries || []);
    const doneCount = cases.filter(c => c.status === 'done').length;
    const allCount = cases.filter(c => c.status !== 'deleted').length;

    const renderGroupCard = (g, isWarning = false) => {
      const isCurrent = this.filterDealer === g.key;
      const borderColor = isWarning ? '#ef4444' : (isCurrent ? 'var(--accent-blue, #38bdf8)' : 'var(--border-color, #334155)');
      const bg = isWarning ? 'rgba(239,68,68,0.08)' : (isCurrent ? 'rgba(56,189,248,0.14)' : 'var(--card-bg, #1e293b)');
      return `
        <div onclick="Advances.setDealerFilter('${isCurrent ? 'all' : g.key}')" style="
          background: ${bg};
          border: 1.5px solid ${borderColor};
          border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: all 0.15s ease;
          box-shadow: ${isCurrent ? '0 0 10px rgba(56,189,248,0.25)' : 'none'};
        " title="クリックで左の店舗一覧をこのグループのみに絞り込み（再クリックで解除）">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:700; font-size:0.85rem; color:${isWarning ? '#f87171' : (isCurrent ? 'var(--accent-blue, #38bdf8)' : 'var(--text-primary)')};">
              ${g.icon} ${g.name}
            </span>
            <span style="font-size:0.72rem; color:${isWarning ? '#f87171' : 'var(--text-muted)'}; font-weight:${isWarning ? '700' : 'normal'};">${g.cases}件</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">合算未回収計</span>
            <span style="font-size:1.15rem; font-weight:800; color:var(--accent-gold, #f59e0b);">
              ¥${g.total.toLocaleString()}
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); border-top:1px dashed var(--border-color, #334155); padding-top:4px; margin-top:4px;">
            <span>報酬(売掛): ¥${g.fee.toLocaleString()}</span>
            <span>立替実費: ¥${g.adv.toLocaleString()}</span>
          </div>
        </div>
      `;
    };

    return `
      <!-- 請求対象（完了案件のみ）vs 全案件（進行中含む） 切り替えスイッチ -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:14px; padding:10px 14px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700; font-size:0.85rem; color:var(--text-color);">集計対象案件:</span>
          <div class="period-mode-toggle" style="display:inline-flex; border-radius:6px; overflow:hidden; border:1px solid var(--border-color); background:rgba(0,0,0,0.25);">
            <button type="button" class="btn btn-small" style="font-size:0.78rem; padding:4px 12px; border:none; border-radius:0; ${this.filterCaseStatus === 'done' ? 'background:#10b981; color:#fff; font-weight:700;' : 'background:transparent; color:var(--text-muted); cursor:pointer;'}" onclick="Advances.setCaseStatusFilter('done')" title="請求・回収対象となる完了・納品案件のみを集計（帳簿の売掛金と完全一致）">✅ 完了案件のみ（請求対象: ${doneCount}件）</button>
            <button type="button" class="btn btn-small" style="font-size:0.78rem; padding:4px 12px; border:none; border-radius:0; ${this.filterCaseStatus === 'all' ? 'background:#2563eb; color:#fff; font-weight:700;' : 'background:transparent; color:var(--text-muted); cursor:pointer;'}" onclick="Advances.setCaseStatusFilter('all')" title="受付・申請中など進行中を含む全案件を集計（見込み含む）">📋 全案件（進行中含む見込: ${allCount}件）</button>
          </div>
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted);">
          ${this.filterCaseStatus === 'done' ? '✨ 帳簿・試算表の売掛金残高と完全一致しています' : '⚠️ 進行中（未完了）の案件報酬も含まれます'}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:12px;">
        <div class="stat-card" style="border-left:4px solid var(--accent-gold);">
          <div class="stat-label">未回収 立替金 総額 ${this.filterCaseStatus === 'done' ? '(完了分)' : '(全件)'}</div>
          <div class="stat-number" style="color:var(--accent-gold);">¥${totalUnpaidAdvance.toLocaleString()}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">証紙・ナンバー・税金等の未回収実費</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--primary-color);">
          <div class="stat-label">未回収 報酬額 総額 ${this.filterCaseStatus === 'done' ? '(完了売掛金)' : '(全件見込)'}</div>
          <div class="stat-number">¥${totalUnpaidFee.toLocaleString()}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${this.filterCaseStatus === 'done' ? '帳簿売掛金と一致（完了・納品済）' : '進行中を含む事務所報酬計'}</div>
        </div>
        <div class="stat-card" style="border-left:4px solid #ef4444;">
          <div class="stat-label">滞留（回収遅延）案件</div>
          <div class="stat-number" style="color:#ef4444;">${overdueCount} <span style="font-size:0.9rem;">件</span></div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">45日以上未回収の注意案件</div>
        </div>
      </div>

      <!-- ディーラーグループ別 未回収合算サマリー（9月決算・売掛金仕訳用） -->
      <div class="card" style="margin-top:14px; padding:14px 16px; background:var(--card-bg); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:0.9rem; font-weight:700; color:var(--accent-gold); display:flex; align-items:center; gap:6px;">
            <span>🏢 ディーラーグループ別 未回収合算サマリー（トヨタ・三菱・日産）</span>
          </div>
          ${this.filterDealer !== 'all' ? `
            <button class="btn btn-secondary btn-small" style="font-size:0.75rem; padding:2px 10px; border-color:var(--accent-blue, #38bdf8); color:var(--accent-blue, #38bdf8); font-weight:bold;" onclick="Advances.setDealerFilter('all')">
              ✕ 絞り込み解除（全店舗表示に戻す）
            </button>` : ''}
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
          ${renderGroupCard(groups.toyota)}
          ${renderGroupCard(groups.fuso)}
          ${renderGroupCard(groups.nissan)}
          ${renderGroupCard(groups.other)}
          ${groups.unassigned && groups.unassigned.cases > 0 ? renderGroupCard(groups.unassigned, true) : ''}
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

    const isUnassigned = this.selectedClientId === 'unassigned';
    const client = !isUnassigned ? clients.find(cl => String(cl.id) === String(this.selectedClientId)) : null;
    const clientName = isUnassigned ? '⚠️ 得意先未入力の案件' : (client ? (client.companyName || client.name) : '取引先');

    // 案件リスト
    const activeCases = targetCases.filter(c => c.status !== 'done');
    const doneCases = targetCases.filter(c => c.status === 'done');

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
          <div>
            <h2 style="margin:0; font-size:1.15rem; color:${isUnassigned ? '#ef4444' : 'inherit'};">🏢 ${clientName}</h2>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
              対象案件数: ${targetCases.length}件 （完了済: ${doneCases.length}件 / 未完了: ${activeCases.length}件）
            </div>
          </div>
          ${!isUnassigned ? `
            <button class="btn btn-primary btn-small" onclick="Advances.showBulkPaymentModal('${this.selectedClientId}')">
              💳 この取引先を一括消し込み
            </button>
          ` : `
            <span style="font-size:0.75rem; color:#f87171; background:rgba(239,68,68,0.1); padding:4px 8px; border-radius:4px; font-weight:600;">
              ※下の表のプルダウンから取引先（店舗）を設定できます
            </span>
          `}
        </div>

        ${isUnassigned ? `
          <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:6px; padding:10px 12px; margin-bottom:14px; font-size:0.825rem; color:#f87171;">
            💡 <strong>得意先（店舗）が未設定の案件一覧です</strong><br>
            各行の「取引先を設定」から店舗を選択すると、該当のディーラーグループ（愛知トヨタや三菱ふそう等）へ即時自動分類・合算されます。
          </div>
        ` : ''}

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

    // 個別フラグの判定（入金消し込みフラグに基づく）
    const isFeePaid = !!(c.isPaid);
    const isAdvPaid = !!(c.isAdvancePaid);
    const isAllDone = isFeePaid && isAdvPaid;

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
          ${!c.clientId || this.selectedClientId === 'unassigned' ? `
            <div style="margin-top:6px;">
              <select class="form-control" style="font-size:0.75rem; padding:3px 6px; height:auto; background:rgba(245,158,11,0.15); border:1.5px solid #f59e0b; color:var(--text-color); font-weight:600;" onchange="Store.updateCase('${c.id}', { clientId: this.value }); App.refreshView(); App.showToast('✅ 取引先を設定しました！');">
                <option value="">— 店舗・取引先を設定 —</option>
                ${Store.getClients().map(cl => `<option value="${cl.id}">${cl.companyName || cl.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}
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
    App.refreshView();
  },

  onSearchClient(query) {
    this.searchQuery = query;
    App.refreshView();
  },

  toggleAdvancePaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    const newVal = !c.isAdvancePaid;
    Store.updateCase(caseId, { isAdvancePaid: newVal });
    App.showToast(newVal ? '💰 立替金を消し込みました' : '🔄 立替金を未回収に戻しました');
    App.refreshView();
  },

  toggleFeePaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    const newVal = !c.isPaid;
    Store.updateCase(caseId, { isPaid: newVal });
    App.showToast(newVal ? '📋 報酬を消し込みました' : '🔄 報酬を未回収に戻しました');
    App.refreshView();
  },

  toggleFullPaid(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    Store.updateCase(caseId, {
      isPaid: true,
      isAdvancePaid: true,
      paidAt: new Date().toISOString(),
    });
    App.showToast('✅ 報酬＋立替金を全額消し込みました');
    App.refreshView();
  },

  resetPayment(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return;
    Store.updateCase(caseId, {
      isPaid: false,
      isAdvancePaid: false,
    });
    App.showToast('🔄 未回収ステータスに戻しました');
    App.refreshView();
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

    // 全額済み（isPaid && isAdvancePaid 両方true）以外を表示
    const cases = Store.getCasesByClient(clientId).filter(c => {
      const allDone = c.isPaid && c.isAdvancePaid;
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
        Store.updateCase(caseId, { isAdvancePaid: true });
      } else if (payType === 'fee_only') {
        // 報酬のみ消し込み
        Store.updateCase(caseId, { isPaid: true });
      } else {
        // 全額消し込み
        Store.updateCase(caseId, {
          isPaid: true,
          isAdvancePaid: true,
          paidAt: `${date}T12:00:00.000Z`,
        });
      }
      count++;
    });

    const label = payType === 'advance_only' ? '立替金' : payType === 'fee_only' ? '報酬' : '全額';
    document.getElementById('bulkPaymentModal').remove();
    App.showToast(`🎉 ${count}件の案件の${label}を一括消し込みしました！`);
    App.refreshView();
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
