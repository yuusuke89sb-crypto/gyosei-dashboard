/**
 * 立替金・売掛金 消し込み＆回収管理モジュール
 */
const Advances = {
  selectedClientId: '',
  filterCycle: 'all', // all | current | month1 | month2 | overdue
  filterDealer: 'all', // all | toyota | fuso | nissan | other | unassigned
  filterCaseStatus: 'done', // done (完了案件のみ/請求売掛対象) | all (全案件/進行中含む見込)
  searchQuery: '',
  filterMonth: null, // 'YYYY-MM'（請求月）| 'all'。2026-10-28 追加

  // ---- 請求月フィルタ ----
  getFilterMonth() {
    if (!this.filterMonth) {
      let saved = '';
      try { saved = sessionStorage.getItem('gyosei_adv_month') || ''; } catch (e) { /* noop */ }
      this.filterMonth = saved || Store.getDefaultReviewMonth();
    }
    return this.filterMonth;
  },

  setFilterMonth(v) {
    this.filterMonth = v || 'all';
    try { sessionStorage.setItem('gyosei_adv_month', this.filterMonth); } catch (e) { /* noop */ }
    if (typeof App !== 'undefined') App.refreshView();
  },

  shiftFilterMonth(delta) {
    let ym = this.getFilterMonth();
    if (ym === 'all') ym = Store.getDefaultReviewMonth();
    let y = Number(ym.slice(0, 4));
    let m = Number(ym.slice(5, 7)) + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    this.setFilterMonth(`${y}-${String(m).padStart(2, '0')}`);
  },

  /** 選択中の請求月の案件だけに絞る（前処理は1回だけ） */
  applyMonthFilter(cases) {
    const ym = this.getFilterMonth();
    if (ym === 'all') return cases;
    const ctx = Store.buildBillingContext();
    return cases.filter(c => Store.getCaseBillingMonth(c, ctx) === ym);
  },

  renderMonthSelector() {
    const cur = this.getFilterMonth();
    const months = Store.listBillingMonths();
    if (cur !== 'all' && !months.includes(cur)) months.push(cur);
    const opts = months.map(ym => `<option value="${ym}" ${ym === cur ? 'selected' : ''}>${Store.billingMonthLabel(ym)}</option>`).join('');
    return `
      <div style="display:flex; align-items:center; gap:4px;" title="請求月ごとに集計（請求済み＝請求書の対象月、未請求＝完了日等と取引先の締め日で判定）">
        <button class="btn btn-secondary btn-small" onclick="Advances.shiftFilterMonth(-1)" style="padding:4px 10px;">◀</button>
        <select id="advMonthSelect" class="form-control" onchange="Advances.setFilterMonth(this.value)" style="width:auto; font-weight:700; padding:4px 8px;">
          ${opts}
          <option value="all" ${cur === 'all' ? 'selected' : ''}>全期間</option>
        </select>
        <button class="btn btn-secondary btn-small" onclick="Advances.shiftFilterMonth(1)" style="padding:4px 10px;">▶</button>
      </div>`;
  },

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
    const cases = this.applyMonthFilter(Store.getCases());
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
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            ${this.renderMonthSelector()}
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
            <input type="text" id="advancesClientSearch" class="search-input" placeholder="🔍 取引先名で検索..." 
              value="${this.searchQuery}" oninput="Advances.onSearchClient(this.value)" autocomplete="off" spellcheck="false" style="margin-bottom:12px; font-size:0.85rem;">
            
            <div id="advancesClientListContainer" style="max-height:550px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
              ${this.renderClientListItems(clientSummaries)}
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

  renderClientListItems(clientSummaries) {
    const list = this.filterDealer !== 'all' ? clientSummaries.filter(cs => this.getDealerGroup(cs) === this.filterDealer) : clientSummaries;
    if (list.length === 0) {
      return '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:20px 0;">該当する取引先はありません</p>';
    }
    return list.map(cs => this.renderClientRow(cs)).join('');
  },

  onSearchClient(query) {
    this.searchQuery = query;
    const container = document.getElementById('advancesClientListContainer');
    if (container) {
      const cases = this.applyMonthFilter(Store.getCases());
      const clients = Store.getClients();
      const clientSummaries = this.calcClientSummaries(cases, clients);
      container.innerHTML = this.renderClientListItems(clientSummaries);
    } else {
      App.refreshView();
    }
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
  // ─── 一括振込の消し込み（2026-10-28 改修） ──────────────────────────────
  // ・入金額は「報酬＋消費税＋立替金」の税込総額なので、照合も税込で行う（以前は税抜で比べていたため一致しなかった）
  // ・発行済み請求書は1枚＝1単位（請求書の金額そのまま）、請求書の無い案件は1件＝1単位（1件ごとに消費税を切り捨て）
  // ・振込額を入れると、未入金の単位から合計がぴったり合う組み合わせを自動で探す
  TAX_RATE: 10,
  _bpmUnits: [],
  _bpmTimer: null,

  _tax(fee) {
    return Math.floor(Number(fee || 0) * this.TAX_RATE / 100);
  },

  _escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  },

  /** 取引先の未入金「請求単位」一覧（古い順） */
  buildPaymentUnits(clientId) {
    const cases = Store.getCasesByClient(clientId).filter(c => c && !(c.isPaid && c.isAdvancePaid));
    const caseById = new Map(cases.map(c => [String(c.id), c]));
    const ctx = Store.buildBillingContext();
    const units = [];
    const covered = new Set(); // 請求書側で扱う案件
    const advSum = list => (Array.isArray(list) ? list : []).reduce((s, a) => s + Number((a && a.amount) || 0), 0);

    if (typeof InvoiceSync !== 'undefined' && InvoiceSync.getState) {
      const s = InvoiceSync.getState();
      const payByInv = {};
      (s.payments || []).forEach(p => { if (p && p.status !== '取消') payByInv[p.invoiceNo] = p; });
      const idsByInv = {};
      (s.items || []).forEach(it => {
        if (!it || it.status !== '有効') return;
        (idsByInv[it.invoiceNo] = idsByInv[it.invoiceNo] || []).push(String(it.caseId));
      });
      (s.invoices || []).forEach(inv => {
        if (!inv || inv.status === '取消' || String(inv.customerId) !== String(clientId)) return;
        const allIds = idsByInv[inv.invoiceNo] || [];
        allIds.forEach(id => covered.add(id));
        const pay = payByInv[inv.invoiceNo];
        if (pay && pay.status === '入金済') return;
        const ids = allIds.filter(id => caseById.has(id));
        if (ids.length === 0) return; // 案件側はすべて消込済み
        const fee = Number(inv.feeExTax || 0);
        const tax = Number(inv.tax || 0);
        const adv = Number(inv.advanceTotal || 0);
        const total = Number(inv.grandTotal || 0) || (fee + tax + adv);
        const date = Store.toLocalDateStr(inv.issueDate) || Store.toLocalDateStr(inv.periodTo) || '';
        const first = caseById.get(ids[0]);
        const individual = ids.length === 1 && first && first.billingMode === 'individual';
        units.push({
          key: 'inv_' + inv.invoiceNo, type: 'invoice', invoiceNo: inv.invoiceNo, caseIds: ids,
          date, fee, tax, adv, total, individual, done: true,
          month: Store.toLocalDateStr(inv.periodTo || inv.issueDate).slice(0, 7),
          title: `請求書 ${inv.invoiceNo}（${ids.length}件）`,
          sub: `${inv.periodFrom ? Store.toLocalDateStr(inv.periodFrom).slice(5).replace('-', '/') + '〜' + Store.toLocalDateStr(inv.periodTo).slice(5).replace('-', '/') : ''} 発行 ${date.slice(5).replace('-', '/')}`,
        });
      });
    }

    cases.forEach(c => {
      const id = String(c.id);
      if (covered.has(id)) return;
      const locked = !!c.invoiceLocked;
      const feeBase = locked ? Number(c.invoiceLockedFee || 0) : Number(c.fee || 0);
      const advBase = advSum(locked && Array.isArray(c.invoiceLockedAdvances) ? c.invoiceLockedAdvances : c.advances);
      const fee = c.isPaid ? 0 : feeBase;
      const adv = c.isAdvancePaid ? 0 : advBase;
      if (fee + adv <= 0) return;
      const tax = this._tax(fee);
      const individual = c.billingMode === 'individual';
      const baseDate = Store.getCaseBaseDate(c);
      const date = (individual && Store.toLocalDateStr(c.individualBilledAt)) || baseDate;
      units.push({
        key: 'case_' + id, type: 'case', caseIds: [id],
        date, fee, tax, adv, total: fee + tax + adv, individual, done: c.status === 'done',
        month: Store.getCaseBillingMonth(c, ctx),
        title: (c.orderNo ? `№${c.orderNo} ` : '') + (c.carName ? `${c.carName} 様` : (c.title || '')),
        sub: `${individual ? '都度請求 ' : ''}${date ? date.slice(5).replace('-', '/') : '-'}${c.status !== 'done' ? '（未完了）' : ''}`,
      });
    });

    units.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.key.localeCompare(b.key));
    return units;
  },

  _unitAmount(u, payType) {
    if (payType === 'advance_only') return u.adv;
    if (payType === 'fee_only') return u.fee + u.tax;
    return u.total;
  },

  /** 選んだ単位の合計（1件ごとに税を切り捨てた額 / 請求書のない案件の報酬をまとめて税計算した額） */
  _setTotals(list, payType) {
    let perUnit = 0, invPart = 0, caseFee = 0, caseAdv = 0;
    list.forEach(u => {
      perUnit += this._unitAmount(u, payType);
      if (u.type === 'invoice') invPart += this._unitAmount(u, payType);
      else { caseFee += u.fee; caseAdv += u.adv; }
    });
    let combined;
    if (payType === 'advance_only') combined = invPart + caseAdv;
    else if (payType === 'fee_only') combined = invPart + caseFee + this._tax(caseFee);
    else combined = invPart + caseFee + this._tax(caseFee) + caseAdv;
    return { perUnit, combined };
  },

  _matchMode(list, target, payType) {
    const t = this._setTotals(list, payType);
    if (t.perUnit === target) return 'perUnit';
    if (t.combined === target) return 'combined';
    return '';
  },

  /** 振込額にぴったり合う組み合わせ候補を探す（優先度順・最大5件） */
  findPaymentMatches(units, target, payType) {
    const results = [];
    const seen = new Set();
    if (!(target > 0)) return results;
    const pool = units.filter(u => this._unitAmount(u, payType) > 0 && (u.done || u.individual));
    const add = (list, label, priority) => {
      if (!list.length) return;
      const key = list.map(u => u.key).sort().join('|');
      if (seen.has(key)) return;
      const mode = this._matchMode(list, target, payType);
      if (!mode) return;
      seen.add(key);
      results.push({ keys: list.map(u => u.key), label, priority, mode, count: list.length });
    };
    const range = list => {
      const ds = list.map(u => u.date).filter(Boolean).sort();
      return ds.length ? `${ds[0].slice(5).replace('-', '/')}〜${ds[ds.length - 1].slice(5).replace('-', '/')}` : '';
    };

    // 1) 1枚（1件）でぴったり
    pool.forEach(u => add([u], u.type === 'invoice' ? `${u.title}` : `1件：${u.title}`, 1));

    // 2) 月ごとのまとまり（締め分・都度分・全部）
    const byMonth = {};
    pool.forEach(u => { (byMonth[u.month || '-'] = byMonth[u.month || '-'] || []).push(u); });
    Object.keys(byMonth).sort().forEach(m => {
      const list = byMonth[m];
      const label = m === '-' ? '月不明' : Store.billingMonthLabel(m);
      add(list.filter(u => !u.individual), `${label}の締め請求分（${list.filter(u => !u.individual).length}件）`, 2);
      add(list.filter(u => u.individual), `${label}の都度請求分（${list.filter(u => u.individual).length}件）`, 2);
      add(list, `${label}の全部（${list.length}件）`, 3);
    });
    // 都度請求分を「暦月」「25日締め」でまとめる（翌25日にまとめて入金する店舗向け）
    const ind = pool.filter(u => u.individual && u.date);
    const groupBy = (fn, suffix) => {
      const g = {};
      ind.forEach(u => { const k = fn(u.date); (g[k] = g[k] || []).push(u); });
      Object.keys(g).sort().forEach(k => add(g[k], `${Store.billingMonthLabel(k)}の都度請求分・${suffix}（${g[k].length}件 ${range(g[k])}）`, 2));
    };
    groupBy(d => d.slice(0, 7), '1日〜末日');
    groupBy(d => Store.billingMonthOfDate(d, 25), '26日〜25日');

    // 3) 古い順に連続したまとまり（全体・都度のみ・締めのみ）
    const windows = (list, label, priority) => {
      for (let i = 0; i < list.length; i++) {
        let sum = 0;
        for (let j = i; j < list.length; j++) {
          sum += this._unitAmount(list[j], payType);
          if (sum > target + list.length) break; // 税の端数差を見込んでも超えたら打ち切り
          if (j > i) add(list.slice(i, j + 1), `${label}（${j - i + 1}件 ${range(list.slice(i, j + 1))}）`, priority);
          if (results.length >= 12) return;
        }
      }
    };
    windows(ind, '都度請求分を古い順に', 4);
    windows(pool.filter(u => !u.individual), '締め請求分を古い順に', 4);
    windows(pool, '古い順に', 5);

    // 4) それでも無ければ、自由な組み合わせを探索（件数が多すぎる時は打ち切り）
    if (results.length === 0 && pool.length <= 60) {
      const list = pool.slice();
      const amounts = list.map(u => this._unitAmount(u, payType));
      const suffix = new Array(list.length + 1).fill(0);
      for (let i = list.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + amounts[i];
      let budget = 200000;
      const picked = [];
      const dfs = (i, sum) => {
        if (budget-- <= 0 || results.length >= 3) return;
        if (sum >= target - picked.length && sum <= target && picked.length) {
          add(picked.map(k => list[k]), `組み合わせ（${picked.length}件 ${range(picked.map(k => list[k]))}）`, 6);
        }
        if (i >= list.length || sum > target) return;
        if (sum + suffix[i] < target - list.length) return;
        picked.push(i);
        dfs(i + 1, sum + amounts[i]);
        picked.pop();
        dfs(i + 1, sum);
      };
      dfs(0, 0);
    }

    results.sort((a, b) => a.priority - b.priority || a.count - b.count);
    return results.slice(0, 5);
  },

  showBulkPaymentModal(defaultClientId = '') {
    const clients = Store.getClients();
    const targetClientId = defaultClientId || this.selectedClientId || (clients[0] ? clients[0].id : '');
    const old = document.getElementById('bulkPaymentModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'bulkPaymentModal';

    modal.innerHTML = `
      <div class="modal-content" style="max-width:760px;">
        <div class="modal-header">
          <h2>💳 入金の消し込み（振込額から自動で当てはめ）</h2>
          <button class="modal-close" onclick="document.getElementById('bulkPaymentModal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>対象の取引先</label>
            <select id="bpm_clientId" class="form-control" onchange="Advances.onBulkClientChange(this.value)">
              ${clients.map(cl => `<option value="${cl.id}" ${cl.id == targetClientId ? 'selected' : ''}>${this._escape(cl.companyName || cl.name)}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
            <div class="form-group">
              <label>入金日（振込日）</label>
              <input type="date" id="bpm_date" class="form-control" value="${Store.getLocalDateStr()}">
            </div>
            <div class="form-group">
              <label>振込金額（税込・立替金込み）</label>
              <input type="number" id="bpm_amount" class="form-control" placeholder="例: 250000" oninput="Advances.onBulkAmountInput()">
            </div>
            <div class="form-group">
              <label>消し込み対象</label>
              <select id="bpm_payType" class="form-control" onchange="Advances.onBulkAmountInput()">
                <option value="full">全額（報酬＋税＋立替金）</option>
                <option value="advance_only">立替金のみ</option>
                <option value="fee_only">報酬（税込）のみ</option>
              </select>
            </div>
          </div>

          <div id="bpm_matchArea" style="margin-top:4px;"></div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <label style="font-weight:600; font-size:0.9rem; margin:0;">未入金の請求（古い順）</label>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-secondary btn-small" onclick="Advances.bulkSelectAll(true)">全選択</button>
              <button type="button" class="btn btn-secondary btn-small" onclick="Advances.bulkSelectAll(false)">全解除</button>
            </div>
          </div>
          <div id="bpm_casesList" style="max-height:300px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; padding:4px 8px; margin-top:6px;"></div>

          <div id="bpm_summaryArea" style="margin-top:12px; padding:12px; background:var(--bg-gray); border-radius:6px; font-size:0.875rem;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('bulkPaymentModal').remove()">キャンセル</button>
          <button class="btn btn-primary" onclick="Advances.executeBulkPayment()">消し込みを実行</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.onBulkClientChange(targetClientId);
  },

  onBulkClientChange(clientId) {
    const listArea = document.getElementById('bpm_casesList');
    if (!listArea) return;
    this._bpmUnits = this.buildPaymentUnits(clientId);
    const units = this._bpmUnits;

    if (units.length === 0) {
      listArea.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:16px 0; margin:0;">未入金の請求はありません</p>';
      this.onBulkAmountInput();
      return;
    }

    const badge = (text, bg, fg) => `<span style="background:${bg}; color:${fg}; padding:1px 6px; border-radius:3px; font-size:0.68rem; font-weight:600; white-space:nowrap;">${text}</span>`;
    listArea.innerHTML = units.map(u => {
      const typeBadge = u.type === 'invoice'
        ? badge('🧾 請求書', 'rgba(16,185,129,0.15)', '#10b981')
        : u.individual ? badge('📄 都度', 'rgba(168,85,247,0.15)', '#a855f7')
          : badge(u.done ? '締め（未請求書）' : '未完了', 'rgba(100,116,139,0.15)', 'var(--text-muted)');
      const monthBadge = u.month ? badge(Store.billingMonthLabel(u.month), 'rgba(59,130,246,0.12)', '#3b82f6') : '';
      return `
        <label style="display:flex; align-items:center; justify-content:space-between; padding:7px 4px; border-bottom:1px solid var(--border-color); cursor:pointer; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            <input type="checkbox" class="bpm-case-cb" value="${u.key}" onchange="Advances.calcBulkDiff()">
            <div style="min-width:0;">
              <div style="font-weight:600; font-size:0.84rem; display:flex; gap:5px; align-items:center; flex-wrap:wrap;">${typeBadge}${monthBadge}<span>${this._escape(u.title)}</span></div>
              <div style="font-size:0.74rem; color:var(--text-muted);">${this._escape(u.sub)}</div>
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-weight:700; font-size:0.86rem;">¥${u.total.toLocaleString()}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">報酬¥${u.fee.toLocaleString()} + 税¥${u.tax.toLocaleString()} + 立替¥${u.adv.toLocaleString()}</div>
          </div>
        </label>`;
    }).join('');

    this.onBulkAmountInput();
  },

  bulkSelectAll(on) {
    document.querySelectorAll('.bpm-case-cb').forEach(cb => { cb.checked = !!on; });
    this.calcBulkDiff();
  },

  /** 振込額の入力に合わせて候補を探す（入力中は少し待ってから実行） */
  onBulkAmountInput() {
    clearTimeout(this._bpmTimer);
    this._bpmTimer = setTimeout(() => this.renderBulkMatches(), 250);
    this.calcBulkDiff();
  },

  renderBulkMatches() {
    const area = document.getElementById('bpm_matchArea');
    if (!area) return;
    const target = Number((document.getElementById('bpm_amount') || {}).value || 0);
    const payType = (document.getElementById('bpm_payType') || {}).value || 'full';
    if (!(target > 0)) { area.innerHTML = ''; this._bpmMatches = []; return; }
    const matches = this.findPaymentMatches(this._bpmUnits || [], target, payType);
    this._bpmMatches = matches;
    if (matches.length === 0) {
      area.innerHTML = `<div style="padding:8px 12px; border-radius:6px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.35); color:#b45309; font-size:0.82rem;">🔍 ぴったり合う組み合わせが見つかりませんでした。下の一覧から手で選んでください（報酬額・立替金の入力漏れや、他の取引先分が混ざっていないかもご確認ください）。</div>`;
      return;
    }
    area.innerHTML = `
      <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">🔍 ¥${target.toLocaleString()} にぴったり合う候補（クリックで選択）</div>
      ${matches.map((m, i) => `
        <button type="button" class="btn btn-secondary btn-small" style="display:block; width:100%; text-align:left; margin-bottom:4px; border-color:rgba(16,185,129,0.45);" onclick="Advances.applyBulkMatch(${i})">
          ✅ ${this._escape(m.label)}${m.mode === 'combined' ? ' <span style="font-size:0.72rem; color:var(--text-muted);">（消費税をまとめて計算した場合に一致）</span>' : ''}
        </button>`).join('')}
    `;
    // 候補が1つだけなら自動で選択しておく
    if (matches.length === 1) this.applyBulkMatch(0);
  },

  applyBulkMatch(idx) {
    const m = (this._bpmMatches || [])[idx];
    if (!m) return;
    const keys = new Set(m.keys);
    document.querySelectorAll('.bpm-case-cb').forEach(cb => { cb.checked = keys.has(cb.value); });
    this.calcBulkDiff();
  },

  _selectedBulkUnits() {
    const keys = new Set(Array.from(document.querySelectorAll('.bpm-case-cb:checked')).map(cb => cb.value));
    return (this._bpmUnits || []).filter(u => keys.has(u.key));
  },

  calcBulkDiff() {
    const sumArea = document.getElementById('bpm_summaryArea');
    if (!sumArea) return;
    const payType = (document.getElementById('bpm_payType') || {}).value || 'full';
    const selected = this._selectedBulkUnits();
    const t = this._setTotals(selected, payType);
    const enteredAmount = Number((document.getElementById('bpm_amount') || {}).value || 0);
    const payLabel = payType === 'advance_only' ? '立替金合計' : payType === 'fee_only' ? '報酬（税込）合計' : '請求額合計（税込）';

    let statusText = '';
    if (enteredAmount > 0 && selected.length > 0) {
      if (t.perUnit === enteredAmount) {
        statusText = '<span style="color:#15803d; font-weight:700;">✅ 振込額と選択した請求の合計がぴったり一致しています</span>';
      } else if (t.combined === enteredAmount) {
        statusText = '<span style="color:#15803d; font-weight:700;">✅ 一致しています（請求書のない案件の消費税をまとめて計算した場合）</span>';
      } else {
        const diff = enteredAmount - t.perUnit;
        statusText = diff < 0
          ? `<span style="color:#b91c1c; font-weight:700;">⚠️ 振込額が選択合計より ¥${Math.abs(diff).toLocaleString()} 少ないです</span>`
          : `<span style="color:#b45309; font-weight:700;">ℹ️ 振込額が選択合計より ¥${diff.toLocaleString()} 多いです（他の請求分が含まれている可能性）</span>`;
      }
    }
    const showCombined = t.combined !== t.perUnit;
    sumArea.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>選択した ${selected.length}件の${payLabel}:</span>
        <span style="font-weight:700; font-size:1rem;">¥${t.perUnit.toLocaleString()}${showCombined ? ` <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">（税まとめ計算 ¥${t.combined.toLocaleString()}）</span>` : ''}</span>
      </div>
      ${statusText ? `<div style="margin-top:6px;">${statusText}</div>` : ''}
    `;
  },

  executeBulkPayment() {
    const selected = this._selectedBulkUnits();
    if (selected.length === 0) {
      alert('消し込みを行う請求を1つ以上選択してください');
      return;
    }
    const date = (document.getElementById('bpm_date') || {}).value || Store.getLocalDateStr();
    const payType = (document.getElementById('bpm_payType') || {}).value || 'full';
    let count = 0;
    const invoiceNos = [];

    selected.forEach(u => {
      u.caseIds.forEach(caseId => {
        const existing = Store.getCase(caseId);
        if (!existing) return;
        if (payType === 'advance_only') {
          Store.updateCase(caseId, { isAdvancePaid: true });
        } else if (payType === 'fee_only') {
          Store.updateCase(caseId, { isPaid: true });
        } else {
          Store.updateCase(caseId, { isPaid: true, isAdvancePaid: true, paidAt: `${date}T12:00:00.000Z` });
        }
        count++;
      });
      if (u.type === 'invoice' && payType === 'full') invoiceNos.push({ no: u.invoiceNo, amount: u.total });
    });

    // 請求書単位で全額入金された分は、請求書の入金状態も「入金済」にする（裏で送信）
    if (invoiceNos.length && typeof InvoiceSync !== 'undefined' && InvoiceSync.markPaid) {
      invoiceNos.forEach(x => {
        InvoiceSync.markPaid(x.no, '振込', date, x.amount).catch(e => console.warn('[Advances] 請求書の入金登録に失敗:', x.no, e));
      });
    }

    const label = payType === 'advance_only' ? '立替金' : payType === 'fee_only' ? '報酬' : '全額';
    document.getElementById('bulkPaymentModal').remove();
    App.showToast(`🎉 ${count}件の案件の${label}を消し込みしました${invoiceNos.length ? `（請求書${invoiceNos.length}枚を入金済に）` : ''}`);
    App.refreshView();
  },

  exportSummaryCSV() {
    const cases = this.applyMonthFilter(Store.getCases());
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
