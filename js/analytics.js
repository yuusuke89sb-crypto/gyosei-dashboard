/**
 * ビジュアル分析画面モジュール (SVGベースの軽量インタラクティブグラフ)
 */
const Analytics = {
  render() {
    return `
      <div class="analytics-page" style="padding: 20px; max-width: 1200px; margin: 0 auto; color: var(--text-primary);">
        <div class="page-header" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 1.8rem; margin: 0; font-weight: 700; color: var(--accent-gold);">📊 ビジュアル分析</h1>
            <p class="page-subtitle" style="margin: 4px 0 0; color: var(--text-muted); font-size: 0.88rem;">事務所の売上・経費推移と目標達成率の可視化</p>
          </div>
          <button class="btn btn-secondary" onclick="Analytics.refreshView()" style="display: flex; align-items: center; gap: 6px;">
            🔄 データを更新
          </button>
        </div>

        <!-- ターゲット達成率ゲージ -->
        <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h2 style="font-size: 1rem; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
              🎯 売上目標達成率（年間）
            </h2>
            <div id="gauge-revenue-container" style="display: flex; justify-content: center; align-items: center; height: 160px;"></div>
          </div>

          <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h2 style="font-size: 1rem; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
              📋 案件目標達成率（年間）
            </h2>
            <div id="gauge-cases-y-container" style="display: flex; justify-content: center; align-items: center; height: 160px;"></div>
          </div>

          <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h2 style="font-size: 1rem; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
              📅 案件目標達成率（今月）
            </h2>
            <div id="gauge-cases-m-container" style="display: flex; justify-content: center; align-items: center; height: 160px;"></div>
          </div>
        </div>

        <!-- 売上・利益の月別推移 -->
        <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); position: relative;">
          <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; color: var(--accent-gold); display: flex; align-items: center; justify-content: space-between;">
            <span>📈 売上・利益の12ヶ月推移</span>
            <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-muted); display: flex; gap: 12px;">
              <span style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:12px; height:12px; background:#f59e0b; border-radius:2px;"></span>売上</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:12px; height:12px; background:#10b981; border-radius:6px;"></span>利益</span>
            </span>
          </h2>
          <div id="trend-chart-container" style="width: 100%; height: 320px; position: relative;"></div>
          <!-- ツールチップ要素 -->
          <div id="chart-tooltip" style="position: absolute; display: none; background: rgba(15, 23, 42, 0.95); border: 1px solid var(--accent-gold); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.75rem; pointer-events: none; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.5); color: var(--text-primary); transition: transform 0.1s ease;"></div>
        </div>

        <!-- 経費割合・カテゴリ別売上割合 -->
        <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px;">
          <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; color: var(--accent-gold);">
              💸 経費の勘定科目割合（年間）
            </h2>
            <div id="donut-expense-container" style="display: flex; align-items: center; justify-content: center; height: 260px;"></div>
          </div>

          <div class="analytics-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; color: var(--accent-gold);">
              📁 業務カテゴリ別売上比率（全期間）
            </h2>
            <div id="donut-category-container" style="display: flex; align-items: center; justify-content: center; height: 260px;"></div>
          </div>
        </div>
      </div>
    `;
  },

  refreshView() {
    App.navigate('analytics');
    App.showToast('データを再読み込みしました');
  },

  init() {
    this.drawGauges();
    this.drawTrendChart();
    this.drawExpenseDonut();
    this.drawCategoryDonut();
  },

  // 1. 目標達成ゲージ描画
  drawGauges() {
    // 目標値の取得
    const goals = typeof GoalTracker !== 'undefined' ? GoalTracker.getGoals() : { annualRevenue: 3000000, annualCases: 50, monthlyCases: 5 };
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const yearlyIncome = journals
      .filter(j => j.date && j.date.startsWith(String(year)) && INCOME.includes(j.credit))
      .reduce((s, j) => s + (j.amount || 0), 0);

    const cases = typeof Store !== 'undefined' ? Store.getCases() : [];
    const yearlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(String(year))).length;
    
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const monthlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(ym)).length;

    // ゲージの作成
    this.renderGauge('gauge-revenue-container', yearlyIncome, goals.annualRevenue, '円', '#f59e0b', true);
    this.renderGauge('gauge-cases-y-container', yearlyCases, goals.annualCases, '件', '#3b82f6', false);
    this.renderGauge('gauge-cases-m-container', monthlyCases, goals.monthlyCases, '件', '#10b981', false);
  },

  renderGauge(containerId, value, target, unit, color, isCurrency) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    // 半円の周長 (r=80 -> r*pi = 251.3)
    const strokeDash = 251.3;
    const strokeOffset = strokeDash - (pct / 100) * strokeDash;

    const displayVal = isCurrency ? `¥${Math.round(value/10000)}万円` : `${value}${unit}`;
    const displayTgt = isCurrency ? `¥${Math.round(target/10000)}万円` : `${target}${unit}`;

    container.innerHTML = `
      <svg viewBox="0 0 200 120" style="width: 100%; height: 100%; max-width: 240px;">
        <!-- トラック背景 -->
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="14" stroke-linecap="round"></path>
        <!-- インジケーター -->
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${strokeDash} ${strokeDash}" stroke-dashoffset="${strokeOffset}" 
              style="transition: stroke-dashoffset 0.8s ease-out;"></path>
        <!-- テキスト情報 -->
        <text x="100" y="76" font-family="'Inter', sans-serif" font-weight="700" font-size="22" fill="var(--text-primary)" text-anchor="middle">${pct}%</text>
        <text x="100" y="98" font-family="sans-serif" font-size="9" fill="var(--text-muted)" text-anchor="middle">${displayVal} / 目標 ${displayTgt}</text>
      </svg>
    `;
  },

  // 2. 売上・利益の月別折れ線・棒混合グラフ
  drawTrendChart() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;

    // 過去12ヶ月の年月配列を作成
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // 勘定科目・帳簿データ取得
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = ['旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'];

    // 月別集計
    const chartData = months.map(ym => {
      const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
      let revenue = 0;
      let expenses = 0;
      filtered.forEach(j => {
        if (INCOME.includes(j.credit)) revenue += j.amount || 0;
        if (EXPENSE_ACCOUNTS.includes(j.debit)) expenses += j.amount || 0;
      });
      return {
        label: ym.split('-')[1] + '月',
        yearMonth: ym,
        revenue,
        profit: revenue - expenses
      };
    });

    // 最大値を求めてY軸のスケールを合わせる
    const maxVal = Math.max(...chartData.map(d => Math.max(d.revenue, Math.max(d.profit, 100000))));
    // 綺麗に割れる単位に丸める
    const stepCount = 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const gridMax = Math.ceil(maxVal / (magnitude / 2)) * (magnitude / 2);

    // SVG描画サイズ設定
    const svgW = 800;
    const svgH = 300;
    const paddingLeft = 60;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 40;

    const graphW = svgW - paddingLeft - paddingRight;
    const graphH = svgH - paddingTop - paddingBottom;

    // グリッド線とY軸ラベル
    let gridHtml = '';
    for (let i = 0; i <= stepCount; i++) {
      const val = (gridMax / stepCount) * i;
      const y = paddingTop + graphH - (val / gridMax) * graphH;
      gridHtml += `
        <!-- グリッド線 -->
        <line x1="${paddingLeft}" y1="${y}" x2="${svgW - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"></line>
        <!-- Y軸ラベル -->
        <text x="${paddingLeft - 8}" y="${y + 4}" font-family="sans-serif" font-size="9" fill="var(--text-muted)" text-anchor="end">¥${(val / 10000).toFixed(0)}万</text>
      `;
    }

    // X軸ラベル、売上棒グラフ、利益折れ線グラフの頂点座標を算出
    const colW = graphW / chartData.length;
    let barsHtml = '';
    let profitPoints = [];
    let hotspotsHtml = '';

    chartData.forEach((d, idx) => {
      const xCenter = paddingLeft + colW * idx + colW / 2;
      const xBarLeft = paddingLeft + colW * idx + colW * 0.2;
      const barW = colW * 0.6;

      // 売上高棒グラフ
      const barH = (d.revenue / gridMax) * graphH;
      const barY = paddingTop + graphH - barH;
      barsHtml += `
        <rect x="${xBarLeft}" y="${barY}" width="${barW}" height="${barH}" fill="#f59e0b" fill-opacity="0.8" rx="3" ry="3" style="transition: all 0.3s;"></rect>
      `;

      // 利益点
      const profitY = paddingTop + graphH - (Math.max(0, d.profit) / gridMax) * graphH;
      profitPoints.push({ x: xCenter, y: profitY });

      // X軸ラベル
      gridHtml += `
        <text x="${xCenter}" y="${svgH - 18}" font-family="sans-serif" font-size="9" fill="var(--text-muted)" text-anchor="middle">${d.label}</text>
      `;

      // ホバー感知エリア (ホットスポット)
      hotspotsHtml += `
        <rect x="${paddingLeft + colW * idx}" y="${paddingTop}" width="${colW}" height="${graphH}" fill="transparent" style="cursor: pointer;"
              onmouseover="Analytics.showTooltip(event, '${d.yearMonth}', ${d.revenue}, ${d.profit})"
              onmousemove="Analytics.moveTooltip(event)"
              onmouseout="Analytics.hideTooltip()"></rect>
      `;
    });

    // 利益折れ線の描画
    let linePath = '';
    let areaPath = `M ${profitPoints[0].x} ${paddingTop + graphH} `;
    
    profitPoints.forEach((pt, idx) => {
      if (idx === 0) {
        linePath += `M ${pt.x} ${pt.y} `;
      } else {
        linePath += `L ${pt.x} ${pt.y} `;
      }
      areaPath += `L ${pt.x} ${pt.y} `;
    });
    areaPath += `L ${profitPoints[profitPoints.length - 1].x} ${paddingTop + graphH} Z`;

    const lineHtml = `
      <!-- グラデーション定義 -->
      <defs>
        <linearGradient id="profit-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"></stop>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"></stop>
        </linearGradient>
      </defs>
      <!-- 利益エリア -->
      <path d="${areaPath}" fill="url(#profit-gradient)"></path>
      <!-- 利益折れ線 -->
      <path d="${linePath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      <!-- 利益ポイント円 -->
      ${profitPoints.map(pt => `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="var(--bg-surface)" stroke="#10b981" stroke-width="2.5"></circle>`).join('')}
    `;

    container.innerHTML = `
      <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: 100%;">
        ${gridHtml}
        ${barsHtml}
        ${lineHtml}
        <!-- 枠線 -->
        <line x1="${paddingLeft}" y1="${paddingTop + graphH}" x2="${svgW - paddingRight}" y2="${paddingTop + graphH}" stroke="var(--border-color)" stroke-width="1.5"></line>
        ${hotspotsHtml}
      </svg>
    `;
  },

  showTooltip(event, yearMonth, revenue, profit) {
    const tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) return;

    tooltip.style.display = 'block';
    tooltip.innerHTML = `
      <div style="font-weight:700; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:4px; margin-bottom:4px; color:var(--accent-gold);">${yearMonth.replace('-', '年')}月</div>
      <div>売上: <span style="font-weight:600; color:#f59e0b;">¥${revenue.toLocaleString()}</span></div>
      <div>利益: <span style="font-weight:600; color:#10b981;">¥${profit.toLocaleString()}</span></div>
    `;
    this.moveTooltip(event);
  },

  moveTooltip(event) {
    const tooltip = document.getElementById('chart-tooltip');
    const container = document.getElementById('trend-chart-container');
    if (!tooltip || !container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left + 15;
    const y = event.clientY - rect.top - 65;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  },

  hideTooltip() {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  },

  // 3. 経費のドーナツグラフ
  drawExpenseDonut() {
    const container = document.getElementById('donut-expense-container');
    if (!container) return;

    const year = new Date().getFullYear();
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const EXPENSE_ACCOUNTS = ['旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'];

    // 勘定科目ごとに集計
    const expenses = {};
    journals
      .filter(j => j.date && j.date.startsWith(String(year)) && EXPENSE_ACCOUNTS.includes(j.debit))
      .forEach(j => {
        expenses[j.debit] = (expenses[j.debit] || 0) + (j.amount || 0);
      });

    const data = Object.entries(expenses)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    this.renderDonut(container, data, '#ff6b6b');
  },

  // 4. 業務カテゴリ別のドーナツグラフ
  drawCategoryDonut() {
    const container = document.getElementById('donut-category-container');
    if (!container) return;

    const cases = typeof Store !== 'undefined' ? Store.getCases() : [];
    const CATEGORY_LABELS = { 
      garage_oss: '🚗 車庫証明(OSS)', 
      garage_paper: '🚗 車庫証明(一般)', 
      seal: '🚙 丁種封印', 
      inheritance: '📜 相続',
      realestate: '🏢 宅建業新規免許',
      antiques: '🏺 古物商許可',
      cabaret: '🍻 風俗営業1号',
      visa_work: '✈️ 就労在留資格'
    };

    const categories = {};
    cases.forEach(c => {
      // 完了案件のみ、かつ報酬額（fee）があるもの
      if (c.status === 'done' && c.fee) {
        const catLabel = CATEGORY_LABELS[c.category] || c.category;
        categories[catLabel] = (categories[catLabel] || 0) + Number(c.fee);
      }
    });

    const data = Object.entries(categories)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    this.renderDonut(container, data, '#3b82f6');
  },

  // ドーナツグラフ共通レンダー関数
  renderDonut(container, data, themeColor) {
    const total = data.reduce((s, d) => s + d.value, 0);

    if (total === 0) {
      container.innerHTML = `
        <div style="text-align:center; color:var(--text-muted); font-size:0.88rem; padding: 40px 0;">
          <span style="font-size:2rem; display:block; margin-bottom:8px;">📊</span>データがありません
        </div>
      `;
      return;
    }

    // 綺麗なカラーパレット (ネイビー/ゴールドと調和するモダンな色調)
    const colors = [
      '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', 
      '#14b8a6', '#06b6d4', '#f43f5e', '#a855f7', '#64748b'
    ];

    const r = 60;
    const circ = 2 * Math.PI * r; // 376.99
    let dashOffset = 0;

    let svgCircleHtml = '';
    let legendHtml = '';

    data.forEach((d, idx) => {
      const pct = (d.value / total) * 100;
      const strokeDash = (d.value / total) * circ;
      const color = colors[idx % colors.length];

      svgCircleHtml += `
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="16"
                stroke-dasharray="${strokeDash} ${circ}" stroke-dashoffset="-${dashOffset}"
                transform="rotate(-90 90 90)" style="transition: all 0.3s;"></circle>
      `;

      dashOffset += strokeDash;

      legendHtml += `
        <div class="legend-row" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; margin-bottom:6px; color:var(--text-secondary);">
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:10px; height:10px; background:${color}; border-radius:2px;"></span>
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${d.label}</span>
          </span>
          <span style="font-weight:600; color:var(--text-primary); margin-left:12px;">
            ¥${d.value.toLocaleString()} (${pct.toFixed(0)}%)
          </span>
        </div>
      `;
    });

    container.innerHTML = `
      <div style="display:flex; width:100%; align-items:center; justify-content:space-around; gap:16px;">
        <div style="width: 180px; height: 180px; flex-shrink: 0; position: relative;">
          <svg viewBox="0 0 180 180" style="width:100%; height:100%;">
            <!-- 背景サークル -->
            <circle cx="90" cy="90" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="16"></circle>
            ${svgCircleHtml}
          </svg>
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; pointer-events:none;">
            <div style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">合計金額</div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">¥${Math.round(total/10000).toLocaleString()}万</div>
          </div>
        </div>
        <div style="flex-grow:1; max-width:260px; overflow-y:auto; max-height:220px; padding-right:6px;">
          ${legendHtml}
        </div>
      </div>
    `;
  }
};
