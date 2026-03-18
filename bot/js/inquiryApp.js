// 電話相談用 問い合わせチェックリスト - アプリケーション
document.addEventListener('DOMContentLoaded', () => {
  const categoryList = document.getElementById('categoryList');
  const mainContent = document.getElementById('mainContent');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const darkModeBtn = document.getElementById('darkModeBtn');

  let currentFlow = null;
  let currentStepIndex = 0;
  let history = []; // { stepId, answer, note }
  let checklistState = {}; // for checklist type steps

  init();

  function init() {
    renderCategories();
    showWelcome();
    setupEvents();
    createMemoButton();
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      if (darkModeBtn) darkModeBtn.textContent = '☀️';
    }
  }

  function setupEvents() {
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
    if (darkModeBtn) darkModeBtn.addEventListener('click', toggleDarkMode);
  }

  function toggleSidebar() { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); }
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    if (darkModeBtn) darkModeBtn.textContent = isDark ? '☀️' : '🌙';
  }

  // カテゴリ一覧描画
  function renderCategories() {
    categoryList.innerHTML = '';
    INQUIRY_FLOWS.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-item';
      btn.style.setProperty('--cat-color', cat.color);
      btn.innerHTML = `<span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.name}</span>`;
      btn.addEventListener('click', () => { showModeSelector(cat.id); closeSidebar(); });
      categoryList.appendChild(btn);
    });
  }

  // ウェルカム画面
  function showWelcome() {
    mainContent.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'inquiry-welcome';
    welcome.innerHTML = `
      <div class="welcome-icon">📞</div>
      <h2>問い合わせチェックリスト</h2>
      <p>電話相談を受けた際に確認すべき項目を<br>チャート形式で確認できます。トークスクリプトも利用可能です。</p>
      <div class="welcome-grid">
        ${INQUIRY_FLOWS.categories.map(cat => `
          <button class="welcome-category-card" data-id="${cat.id}" style="--cat-color: ${cat.color}">
            <span class="wcc-icon">${cat.icon}</span>
            <span class="wcc-name">${cat.name}</span>
          </button>
        `).join('')}
      </div>
    `;
    mainContent.appendChild(welcome);
    welcome.querySelectorAll('.welcome-category-card').forEach(btn => {
      btn.addEventListener('click', () => showModeSelector(btn.dataset.id));
    });
  }

  // モード選択画面
  function showModeSelector(categoryId) {
    const cat = INQUIRY_FLOWS.categories.find(c => c.id === categoryId);
    if (!cat) return;

    // サイドバーのアクティブ表示
    highlightSidebarCategory(categoryId);

    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'mode-selector-container';
    container.innerHTML = `
      <div class="mode-selector-header">
        <button class="flow-home-btn" id="modeHomeBtn" title="最初に戻る">🏠</button>
        <span class="flow-cat-badge" style="background: ${cat.color}">${cat.icon} ${cat.name}</span>
      </div>
      <h2 class="mode-selector-title">モードを選択してください</h2>
      <p class="mode-selector-desc">用途に合わせてお選びください</p>
      <div class="mode-cards">
        <button class="mode-card" id="modeChecklist">
          <div class="mode-card-icon">📋</div>
          <div class="mode-card-body">
            <h3>チェックリスト</h3>
            <p>ステップバイステップで確認項目をチェック。要件の確認漏れを防ぎます。</p>
          </div>
          <span class="mode-card-arrow">→</span>
        </button>
        <button class="mode-card talk" id="modeTalkScript">
          <div class="mode-card-icon">🎤</div>
          <div class="mode-card-body">
            <h3>トークスクリプト</h3>
            <p>初回相談で使える会話テンプレート。そのまま話すだけでOK！次の受任につなげます。</p>
          </div>
          <span class="mode-card-arrow">→</span>
        </button>
        <button class="mode-card fee" id="modeFeeSimulator">
          <div class="mode-card-icon">💰</div>
          <div class="mode-card-body">
            <h3>報酬シミュレーター</h3>
            <p>条件を選ぶだけで概算報酬を即算出。電話中にすぐ回答できます。</p>
          </div>
          <span class="mode-card-arrow">→</span>
        </button>
      </div>
    `;
    mainContent.appendChild(container);
    requestAnimationFrame(() => container.classList.add('visible'));

    document.getElementById('modeHomeBtn').addEventListener('click', showWelcome);
    document.getElementById('modeChecklist').addEventListener('click', () => startFlow(categoryId));
    document.getElementById('modeTalkScript').addEventListener('click', () => startTalkScript(categoryId));
    document.getElementById('modeFeeSimulator').addEventListener('click', () => startFeeSimulator(categoryId));
  }

  function highlightSidebarCategory(categoryId) {
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    const items = categoryList.querySelectorAll('.category-item');
    const catIdx = INQUIRY_FLOWS.categories.findIndex(c => c.id === categoryId);
    if (catIdx >= 0 && items[catIdx]) items[catIdx].classList.add('active');
  }

  // フロー開始
  function startFlow(categoryId) {
    const flowData = INQUIRY_FLOWS.flows[categoryId];
    if (!flowData) return;
    currentFlow = { id: categoryId, data: flowData };
    history = [];
    checklistState = {};
    currentStepIndex = 0;
    renderStep(flowData.steps[0].id);
    highlightSidebarCategory(categoryId);
  }

  // トークスクリプト開始
  function startTalkScript(categoryId) {
    const scriptData = TALK_SCRIPTS[categoryId];
    if (!scriptData) { alert('このカテゴリのトークスクリプトは準備中です。'); return; }
    highlightSidebarCategory(categoryId);
    renderTalkScript(categoryId, scriptData);
  }

  // トークスクリプト描画
  function renderTalkScript(categoryId, scriptData) {
    const cat = INQUIRY_FLOWS.categories.find(c => c.id === categoryId);
    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'talk-script-container';

    // ヘッダー
    container.innerHTML = `
      <div class="ts-header">
        <div class="ts-header-left">
          <button class="flow-home-btn" id="tsHomeBtn" title="最初に戻る">🏠</button>
          <span class="flow-cat-badge" style="background: ${cat.color}">${cat.icon} ${cat.name}</span>
          <span class="ts-mode-badge">🎤 トークスクリプト</span>
        </div>
        <button class="ts-print-btn" id="tsPrintBtn">🖨️ 印刷</button>
      </div>
    `;

    // フェーズ一覧（縦タイムライン）
    const timeline = document.createElement('div');
    timeline.className = 'ts-timeline';

    scriptData.steps.forEach((step, idx) => {
      const phase = document.createElement('div');
      phase.className = 'ts-phase';
      const isLast = idx === scriptData.steps.length - 1;

      phase.innerHTML = `
        <div class="ts-phase-marker">
          <div class="ts-phase-dot" style="background: ${step.color}">${step.icon}</div>
          ${!isLast ? '<div class="ts-phase-line"></div>' : ''}
        </div>
        <div class="ts-phase-content">
          <div class="ts-phase-label" style="color: ${step.color}">${step.phase}</div>
          <div class="ts-talk-card">
            <div class="ts-talk-header">
              <span class="ts-talk-icon">💬</span>
              <span class="ts-talk-label">こう話す</span>
            </div>
            <div class="ts-talk-text">${step.talk.replace(/\n/g, '<br>')}</div>
          </div>
          ${step.tips ? `
            <div class="ts-tips-card">
              <span class="ts-tips-icon">💡</span>
              <span class="ts-tips-text">${step.tips}</span>
            </div>
          ` : ''}
          ${step.hear && step.hear.length > 0 ? `
            <div class="ts-hear-card">
              <div class="ts-hear-header"><span>👂</span> ここで聞き取る</div>
              <ul class="ts-hear-list">
                ${step.hear.map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
      timeline.appendChild(phase);
    });

    container.appendChild(timeline);

    // フッターボタン
    const footer = document.createElement('div');
    footer.className = 'ts-footer';
    footer.innerHTML = `
      <button class="summary-btn print" id="tsFooterPrint">🖨️ 印刷する</button>
      <button class="summary-btn restart" id="tsBackToMode">📋 チェックリストに切替</button>
      <button class="summary-btn home" id="tsFooterHome">🏠 カテゴリ選択に戻る</button>
    `;
    container.appendChild(footer);

    mainContent.appendChild(container);
    requestAnimationFrame(() => container.classList.add('visible'));

    // イベント
    document.getElementById('tsHomeBtn').addEventListener('click', showWelcome);
    document.getElementById('tsPrintBtn').addEventListener('click', () => printTalkScript(scriptData, cat));
    document.getElementById('tsFooterPrint').addEventListener('click', () => printTalkScript(scriptData, cat));
    document.getElementById('tsBackToMode').addEventListener('click', () => startFlow(categoryId));
    document.getElementById('tsFooterHome').addEventListener('click', showWelcome);
  }

  // トークスクリプト印刷
  function printTalkScript(scriptData, cat) {
    const printWin = window.open('', '_blank');
    if (!printWin) { alert('ポップアップがブロックされました。'); return; }

    let stepsHtml = '';
    scriptData.steps.forEach((step, idx) => {
      stepsHtml += `
        <div class="phase">
          <div class="phase-head">
            <span class="phase-num">${idx + 1}</span>
            <span class="phase-name">${step.icon} ${step.phase}</span>
          </div>
          <div class="talk-box">
            <div class="talk-label">💬 こう話す</div>
            <div class="talk-text">${step.talk.replace(/\n/g, '<br>')}</div>
          </div>
          ${step.tips ? `<div class="tips-box">💡 ${step.tips}</div>` : ''}
          ${step.hear && step.hear.length > 0 ? `
            <div class="hear-box">
              <div class="hear-label">👂 ここで聞き取る</div>
              <ul>${step.hear.map(h => `<li>${h}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;
    });

    printWin.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
      <title>${scriptData.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans JP', 'Meiryo', sans-serif; padding: 24px; color: #1E293B; line-height: 1.7; font-size: 12px; }
        .header { border-bottom: 3px solid #8B5CF6; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 16px; color: #8B5CF6; }
        .header .office { font-size: 10px; color: #64748B; text-align: right; }
        .meta { font-size: 10px; color: #94A3B8; margin-bottom: 12px; }
        .phase { margin-bottom: 14px; page-break-inside: avoid; }
        .phase-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .phase-num { width: 22px; height: 22px; border-radius: 50%; background: #8B5CF6; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
        .phase-name { font-weight: 700; font-size: 13px; color: #4F46E5; }
        .talk-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px 12px; margin-bottom: 6px; }
        .talk-label { font-size: 10px; font-weight: 600; color: #16A34A; margin-bottom: 4px; }
        .talk-text { font-size: 12px; color: #1E293B; }
        .tips-box { font-size: 11px; color: #92400E; background: #FEF3C7; border-radius: 4px; padding: 6px 10px; margin-bottom: 6px; }
        .hear-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 8px 12px; }
        .hear-label { font-size: 10px; font-weight: 600; color: #2563EB; margin-bottom: 4px; }
        .hear-box ul { margin-left: 16px; }
        .hear-box li { font-size: 11px; margin-bottom: 2px; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #CBD5E1; font-size: 9px; color: #94A3B8; text-align: center; }
        @media print { body { padding: 12px; } .phase { margin-bottom: 10px; } }
      </style></head><body>
      <div class="header">
        <h1>🎤 トークスクリプト - ${cat.name}</h1>
        <div class="office">○○行政書士事務所<br>TEL: 000-0000-0000</div>
      </div>
      <div class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')}</div>
      ${stepsHtml}
      <div class="footer">このドキュメントは行政書士AIボットにより自動生成されました。</div>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  }

  // ステップ描画
  function renderStep(stepId) {
    const flow = currentFlow.data;
    const step = flow.steps.find(s => s.id === stepId);
    if (!step) { renderSummary(); return; }

    // 進捗計算
    const totalSteps = estimateTotalSteps(flow, stepId);
    const completedSteps = history.length;

    mainContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'flow-container';

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'flow-header';
    const cat = INQUIRY_FLOWS.categories.find(c => c.id === currentFlow.id);
    header.innerHTML = `
      <div class="flow-header-left">
        <button class="flow-home-btn" id="flowHomeBtn" title="最初に戻る">🏠</button>
        <div class="flow-title-area">
          <span class="flow-cat-badge" style="background: ${cat.color}">${cat.icon} ${cat.name}</span>
          <span class="flow-step-num">ステップ ${completedSteps + 1}</span>
        </div>
      </div>
      <div class="flow-progress">
        <div class="flow-progress-bar" style="width: ${Math.min((completedSteps / totalSteps) * 100, 95)}%"></div>
      </div>
    `;
    container.appendChild(header);

    // 過去の回答サマリー（コンパクト表示）
    if (history.length > 0) {
      const trail = document.createElement('div');
      trail.className = 'answer-trail';
      history.forEach((h, idx) => {
        const chip = document.createElement('div');
        chip.className = 'trail-chip';
        const isWarning = h.note && h.note.includes('⚠️');
        if (isWarning) chip.classList.add('warning');
        chip.innerHTML = `<span class="trail-num">${idx + 1}</span><span class="trail-text">${h.answerLabel}</span>`;
        chip.addEventListener('click', () => goBackTo(idx));
        trail.appendChild(chip);
      });
      container.appendChild(trail);
    }

    // メイン質問カード
    const card = document.createElement('div');
    card.className = 'flow-card';
    card.innerHTML = `
      <div class="flow-question">${step.question}</div>
      ${step.info ? `<div class="flow-info">💡 ${step.info.replace(/\n/g, '<br>')}</div>` : ''}
    `;

    // 選択肢描画
    const answersArea = document.createElement('div');
    answersArea.className = 'flow-answers';

    if (step.type === 'choice') {
      step.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'flow-choice-btn';
        btn.innerHTML = `
          <span class="choice-icon">${choice.icon || '▶'}</span>
          <span class="choice-label">${choice.label}</span>
          <span class="choice-arrow">→</span>
        `;
        btn.addEventListener('click', () => {
          history.push({
            stepId: step.id,
            answer: choice.value,
            answerLabel: choice.label,
            note: choice.note || null
          });
          if (choice.next) {
            renderStep(choice.next);
          } else {
            renderSummary();
          }
        });
        answersArea.appendChild(btn);
      });
    } else if (step.type === 'yesno') {
      const yesBtn = document.createElement('button');
      yesBtn.className = 'flow-yn-btn yes';
      yesBtn.innerHTML = '<span class="yn-icon">⭕</span><span>はい</span>';
      yesBtn.addEventListener('click', () => {
        history.push({
          stepId: step.id,
          answer: 'yes',
          answerLabel: `${step.question.substring(0, 20)}… → はい`,
          note: step.yes.note
        });
        if (step.yes.next) {
          renderStep(step.yes.next);
        } else {
          renderSummary();
        }
      });

      const noBtn = document.createElement('button');
      noBtn.className = 'flow-yn-btn no';
      noBtn.innerHTML = '<span class="yn-icon">❌</span><span>いいえ</span>';
      noBtn.addEventListener('click', () => {
        history.push({
          stepId: step.id,
          answer: 'no',
          answerLabel: `${step.question.substring(0, 20)}… → いいえ`,
          note: step.no.note
        });
        if (step.no.next) {
          renderStep(step.no.next);
        } else {
          renderSummary();
        }
      });

      answersArea.appendChild(yesBtn);
      answersArea.appendChild(noBtn);
    } else if (step.type === 'checklist') {
      const clKey = step.id;
      if (!checklistState[clKey]) {
        checklistState[clKey] = {};
        step.items.forEach(item => { checklistState[clKey][item.key] = false; });
      }
      step.items.forEach(item => {
        const row = document.createElement('label');
        row.className = 'flow-cl-item' + (checklistState[clKey][item.key] ? ' checked' : '');
        row.innerHTML = `
          <input type="checkbox" ${checklistState[clKey][item.key] ? 'checked' : ''}>
          <span class="cl-check">✓</span>
          <span class="cl-label">${item.label}</span>
        `;
        const cb = row.querySelector('input');
        cb.addEventListener('change', () => {
          checklistState[clKey][item.key] = cb.checked;
          row.classList.toggle('checked', cb.checked);
        });
        answersArea.appendChild(row);
      });

      const nextBtn = document.createElement('button');
      nextBtn.className = 'flow-next-btn';
      nextBtn.innerHTML = '次へ進む →';
      nextBtn.addEventListener('click', () => {
        const checked = Object.values(checklistState[clKey]).filter(Boolean).length;
        const total = step.items.length;
        const checkedLabels = step.items.filter(i => checklistState[clKey][i.key]).map(i => i.label);
        const uncheckedLabels = step.items.filter(i => !checklistState[clKey][i.key]).map(i => i.label);
        history.push({
          stepId: step.id,
          answer: 'checklist',
          answerLabel: `チェック ${checked}/${total}`,
          note: uncheckedLabels.length > 0 ? `⚠️ 未確認: ${uncheckedLabels.join('、')}` : '✅ 全項目確認済み',
          checkedItems: checkedLabels,
          uncheckedItems: uncheckedLabels
        });
        if (step.next) {
          renderStep(step.next);
        } else {
          renderSummary();
        }
      });
      answersArea.appendChild(nextBtn);
    }

    card.appendChild(answersArea);
    container.appendChild(card);

    // 戻るボタン
    if (history.length > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'flow-back-btn';
      backBtn.innerHTML = '← 前のステップに戻る';
      backBtn.addEventListener('click', () => goBack());
      container.appendChild(backBtn);
    }

    mainContent.appendChild(container);

    // ホームボタン
    document.getElementById('flowHomeBtn')?.addEventListener('click', showWelcome);

    // アニメーション
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  // 戻る
  function goBack() {
    if (history.length === 0) return;
    const prev = history.pop();
    renderStep(prev.stepId);
  }

  function goBackTo(idx) {
    history = history.slice(0, idx);
    const targetStepId = idx === 0 ? currentFlow.data.steps[0].id : findNextStepId(history);
    renderStep(targetStepId);
  }

  function findNextStepId(hist) {
    if (hist.length === 0) return currentFlow.data.steps[0].id;
    const last = hist[hist.length - 1];
    const step = currentFlow.data.steps.find(s => s.id === last.stepId);
    if (!step) return currentFlow.data.steps[0].id;
    if (step.type === 'choice') {
      const choice = step.choices.find(c => c.value === last.answer);
      return choice?.next || null;
    } else if (step.type === 'yesno') {
      return step[last.answer]?.next || null;
    } else if (step.type === 'checklist') {
      return step.next || null;
    }
    return null;
  }

  // ステップ総数見積もり
  function estimateTotalSteps(flow, currentId) {
    let count = 0;
    let stepId = currentId;
    const visited = new Set();
    while (stepId && !visited.has(stepId)) {
      visited.add(stepId);
      count++;
      const step = flow.steps.find(s => s.id === stepId);
      if (!step) break;
      if (step.type === 'choice' && step.choices.length > 0) {
        stepId = step.choices[0].next;
      } else if (step.type === 'yesno') {
        stepId = step.yes?.next;
      } else if (step.type === 'checklist') {
        stepId = step.next;
      } else {
        break;
      }
    }
    return Math.max(history.length + count, history.length + 1);
  }

  // 結果まとめ画面
  function renderSummary() {
    const flow = currentFlow.data;
    const cat = INQUIRY_FLOWS.categories.find(c => c.id === currentFlow.id);

    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'summary-container';

    // ヘッダー
    container.innerHTML = `
      <div class="summary-header">
        <div class="summary-icon">${cat.icon}</div>
        <h2>${flow.summary.title}</h2>
        <p>確認フローが完了しました。以下が結果のまとめです。</p>
      </div>
    `;

    // 確認結果一覧
    const resultsSection = document.createElement('div');
    resultsSection.className = 'summary-section';
    resultsSection.innerHTML = '<h3>📋 確認結果</h3>';
    const resultsList = document.createElement('div');
    resultsList.className = 'summary-results';

    history.forEach((h, idx) => {
      const step = flow.steps.find(s => s.id === h.stepId);
      const item = document.createElement('div');
      const isOk = h.note && (h.note.includes('✅') || h.note.startsWith('→'));
      const isWarn = h.note && h.note.includes('⚠️');
      item.className = `summary-result-item ${isWarn ? 'warn' : isOk ? 'ok' : ''}`;
      item.innerHTML = `
        <div class="sri-header">
          <span class="sri-num">${idx + 1}</span>
          <span class="sri-question">${step ? step.question : h.stepId}</span>
        </div>
        <div class="sri-answer">${h.answerLabel}</div>
        ${h.note ? `<div class="sri-note">${h.note}</div>` : ''}
        ${h.uncheckedItems && h.uncheckedItems.length > 0 ? `
          <div class="sri-unchecked">
            <strong>未確認項目：</strong>
            <ul>${h.uncheckedItems.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
        ` : ''}
      `;
      resultsList.appendChild(item);
    });
    resultsSection.appendChild(resultsList);
    container.appendChild(resultsSection);

    // 必要書類
    if (flow.summary.documents && flow.summary.documents.length > 0) {
      const docsSection = document.createElement('div');
      docsSection.className = 'summary-section';
      docsSection.innerHTML = `
        <h3>📄 必要書類リスト</h3>
        <div class="summary-docs">
          ${flow.summary.documents.map(d => `<div class="summary-doc-item"><span class="doc-bullet">📎</span>${d}</div>`).join('')}
        </div>
      `;
      container.appendChild(docsSection);
    }

    // 費用・処理期間
    if (flow.summary.fees || flow.summary.processing) {
      const infoSection = document.createElement('div');
      infoSection.className = 'summary-section';
      let html = '<h3>💰 費用・期間</h3><div class="summary-info-grid">';
      if (flow.summary.fees) {
        Object.entries(flow.summary.fees).forEach(([key, val]) => {
          if (typeof val === 'object') {
            html += `<div class="summary-info-card"><span class="sic-label">${val.label}</span>`;
            Object.entries(val).forEach(([k, v]) => {
              if (k !== 'label') html += `<span class="sic-value">${k}: ${v}</span>`;
            });
            html += '</div>';
          } else {
            html += `<div class="summary-info-card"><span class="sic-label">${key}</span><span class="sic-value">${val}</span></div>`;
          }
        });
      }
      if (flow.summary.processing) {
        html += `<div class="summary-info-card"><span class="sic-label">標準処理期間</span><span class="sic-value">${flow.summary.processing}</span></div>`;
      }
      html += '</div>';
      infoSection.innerHTML = html;
      container.appendChild(infoSection);
    }

    // アクションボタン
    const actions = document.createElement('div');
    actions.className = 'summary-actions';
    actions.innerHTML = `
      <button class="summary-btn print" id="summaryPrint">🖨️ 印刷する</button>
      <button class="summary-btn restart" id="summaryRestart">🔄 このカテゴリをやり直す</button>
      <button class="summary-btn home" id="summaryHome">🏠 カテゴリ選択に戻る</button>
    `;
    container.appendChild(actions);

    mainContent.appendChild(container);

    // アニメーション
    requestAnimationFrame(() => container.classList.add('visible'));

    // イベント
    document.getElementById('summaryPrint').addEventListener('click', () => printSummary(flow, cat));
    document.getElementById('summaryRestart').addEventListener('click', () => startFlow(currentFlow.id));
    document.getElementById('summaryHome').addEventListener('click', showWelcome);
  }

  // 印刷
  function printSummary(flow, cat) {
    const printWin = window.open('', '_blank');
    if (!printWin) { alert('ポップアップがブロックされました。'); return; }

    let resultsHtml = '';
    history.forEach((h, idx) => {
      const step = flow.steps.find(s => s.id === h.stepId);
      const isWarn = h.note && h.note.includes('⚠️');
      resultsHtml += `
        <div class="result-item ${isWarn ? 'warn' : ''}">
          <div class="ri-num">${idx + 1}</div>
          <div class="ri-body">
            <div class="ri-q">${step ? step.question : h.stepId}</div>
            <div class="ri-a">→ ${h.answerLabel}</div>
            ${h.note ? `<div class="ri-note">${h.note}</div>` : ''}
            ${h.uncheckedItems && h.uncheckedItems.length > 0 ? `<div class="ri-unchecked">未確認: ${h.uncheckedItems.join('、')}</div>` : ''}
          </div>
        </div>
      `;
    });

    let docsHtml = '';
    if (flow.summary.documents && flow.summary.documents.length > 0) {
      docsHtml = '<h3>📄 必要書類</h3><ul>' +
        flow.summary.documents.map(d => `<li>${d}</li>`).join('') + '</ul>';
    }

    printWin.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
      <title>${flow.summary.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans JP', 'Meiryo', sans-serif; padding: 30px; color: #1E293B; line-height: 1.7; font-size: 13px; }
        .header { border-bottom: 3px solid #4F46E5; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 18px; color: #4F46E5; }
        .header .office { font-size: 11px; color: #64748B; text-align: right; }
        .meta { font-size: 11px; color: #94A3B8; margin-bottom: 16px; }
        h2 { font-size: 15px; color: #1E293B; margin: 20px 0 12px; border-left: 4px solid #4F46E5; padding-left: 10px; }
        h3 { font-size: 14px; color: #4338CA; margin: 16px 0 8px; }
        .result-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
        .result-item.warn { background: #FEF2F2; padding: 8px; border-radius: 4px; }
        .ri-num { width: 24px; height: 24px; border-radius: 50%; background: #4F46E5; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .result-item.warn .ri-num { background: #DC2626; }
        .ri-q { font-weight: 600; font-size: 12px; }
        .ri-a { color: #4F46E5; margin: 2px 0; }
        .ri-note { font-size: 11px; color: #64748B; }
        .ri-unchecked { font-size: 11px; color: #DC2626; margin-top: 2px; }
        ul { margin-left: 20px; }
        li { margin-bottom: 3px; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #CBD5E1; font-size: 10px; color: #94A3B8; text-align: center; }
        @media print { body { padding: 15px; } }
      </style></head><body>
      <div class="header">
        <h1>⚖️ 行政書士AIボット - 問い合わせチェック</h1>
        <div class="office">○○行政書士事務所<br>TEL: 000-0000-0000</div>
      </div>
      <div class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}</div>
      <h2>${cat.icon} ${flow.summary.title}</h2>
      ${resultsHtml}
      ${docsHtml}
      <div class="footer">このドキュメントは行政書士AIボットにより自動生成されました。</div>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  }

  // ============================================================
  // 報酬シミュレーター
  // ============================================================
  function startFeeSimulator(categoryId) {
    const feeConfig = FEE_DATA[categoryId];
    if (!feeConfig) { alert('このカテゴリの報酬データは準備中です。'); return; }
    highlightSidebarCategory(categoryId);
    renderFeeSimulator(categoryId, feeConfig);
  }

  function renderFeeSimulator(categoryId, feeConfig) {
    const cat = INQUIRY_FLOWS.categories.find(c => c.id === categoryId);
    mainContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'fee-sim-container';

    container.innerHTML = `
      <div class="ts-header">
        <div class="ts-header-left">
          <button class="flow-home-btn" id="feeHomeBtn" title="最初に戻る">🏠</button>
          <span class="flow-cat-badge" style="background: ${cat.color}">${cat.icon} ${cat.name}</span>
          <span class="ts-mode-badge" style="background: linear-gradient(135deg, #F59E0B, #FBBF24)">💰 報酬シミュレーター</span>
        </div>
      </div>
      <div class="fee-sim-body">
        <div class="fee-sim-form" id="feeForm"></div>
        <div class="fee-sim-result" id="feeResult" style="display: none"></div>
      </div>
    `;
    mainContent.appendChild(container);
    requestAnimationFrame(() => container.classList.add('visible'));

    document.getElementById('feeHomeBtn').addEventListener('click', showWelcome);

    const feeAnswers = {};
    renderFeeSteps(feeConfig, feeAnswers, categoryId);
  }

  function renderFeeSteps(feeConfig, answers, categoryId) {
    const formEl = document.getElementById('feeForm');
    const resultEl = document.getElementById('feeResult');
    formEl.innerHTML = '';
    resultEl.style.display = 'none';

    feeConfig.steps.forEach(step => {
      // showIf チェック
      if (step.showIf) {
        const [key] = Object.keys(step.showIf);
        if (!step.showIf[key].includes(answers[key])) return;
      }

      const group = document.createElement('div');
      group.className = 'fee-field';
      group.innerHTML = `<label class="fee-field-label">${step.question}</label>`;

      if (step.type === 'select') {
        const btnsWrap = document.createElement('div');
        btnsWrap.className = 'fee-options';
        step.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'fee-option-btn' + (answers[step.id] === opt.value ? ' selected' : '');
          btn.textContent = opt.label;
          btn.addEventListener('click', () => {
            answers[step.id] = opt.value;
            // 依存するフィールドをクリア
            feeConfig.steps.forEach(s => {
              if (s.showIf) {
                const [k] = Object.keys(s.showIf);
                if (k === step.id) delete answers[s.id];
              }
            });
            renderFeeSteps(feeConfig, answers, categoryId);
          });
          btnsWrap.appendChild(btn);
        });
        group.appendChild(btnsWrap);
      } else if (step.type === 'multi') {
        const btnsWrap = document.createElement('div');
        btnsWrap.className = 'fee-options multi';
        if (!answers[step.id]) answers[step.id] = [];
        step.options.forEach(opt => {
          const btn = document.createElement('button');
          const isSelected = answers[step.id].includes(opt.value);
          btn.className = 'fee-option-btn' + (isSelected ? ' selected' : '');
          btn.textContent = opt.label + (opt.fee ? ` (+${(opt.fee).toLocaleString()}円)` : '');
          btn.addEventListener('click', () => {
            if (answers[step.id].includes(opt.value)) {
              answers[step.id] = answers[step.id].filter(v => v !== opt.value);
            } else {
              answers[step.id].push(opt.value);
            }
            renderFeeSteps(feeConfig, answers, categoryId);
          });
          btnsWrap.appendChild(btn);
        });
        group.appendChild(btnsWrap);
      }

      formEl.appendChild(group);
    });

    // 必須ステップがすべて回答されているか
    const requiredAnswered = feeConfig.steps.every(step => {
      if (step.showIf) {
        const [key] = Object.keys(step.showIf);
        if (!step.showIf[key].includes(answers[key])) return true; // 非表示なのでスキップ
      }
      if (step.type === 'multi') return true; // multi は任意
      return answers[step.id] !== undefined;
    });

    if (requiredAnswered) {
      showFeeResult(feeConfig, answers, categoryId);
    }
  }

  function showFeeResult(feeConfig, answers, categoryId) {
    const resultEl = document.getElementById('feeResult');
    const result = feeConfig.calculate(answers);
    const total = result.reward + result.officialFee;

    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="fee-result-header">
        <div class="fee-result-icon">📊</div>
        <h3>概算見積り</h3>
      </div>
      <div class="fee-result-items">
        ${result.items.map(item => `
          <div class="fee-result-row ${item.type === 'official' ? 'official' : 'reward'}">
            <span class="fee-row-label">${item.label}</span>
            <span class="fee-row-amount">${item.type === 'official' ? '' : ''}¥${item.amount.toLocaleString()}</span>
            <span class="fee-row-tag">${item.type === 'official' ? '実費' : '報酬'}</span>
          </div>
        `).join('')}
        <div class="fee-result-total">
          <span>合計（税別）</span>
          <span class="fee-total-amount">¥${total.toLocaleString()}</span>
        </div>
      </div>
      ${result.notes.length > 0 ? `
        <div class="fee-result-notes">
          <div class="fee-notes-title">📝 備考</div>
          <ul>${result.notes.map(n => `<li>${n}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <p class="fee-disclaimer">※ 上記は概算です。正式なお見積りは面談後にお出しします。<br>※ 消費税は別途かかります。</p>
      <div class="fee-actions">
        <button class="summary-btn print" id="feeSaveMemo">📝 相談メモに保存</button>
        <button class="summary-btn restart" id="feeReset">🔄 条件を変更</button>
        <button class="summary-btn home" id="feeHome">🏠 カテゴリ選択に戻る</button>
      </div>
    `;

    requestAnimationFrame(() => resultEl.classList.add('visible'));

    document.getElementById('feeSaveMemo').addEventListener('click', () => {
      const cat = INQUIRY_FLOWS.categories.find(c => c.id === categoryId);
      const memoText = `【報酬シミュレーション】${cat.name}\n` +
        result.items.map(i => `${i.label}: ¥${i.amount.toLocaleString()}`).join('\n') +
        `\n合計: ¥${total.toLocaleString()}（税別）` +
        (result.notes.length > 0 ? '\n\n備考:\n' + result.notes.join('\n') : '');
      openMemoPanel(cat.name, memoText);
    });
    document.getElementById('feeReset').addEventListener('click', () => {
      startFeeSimulator(categoryId);
    });
    document.getElementById('feeHome').addEventListener('click', showWelcome);
  }

  // ============================================================
  // 相談メモ（ヒアリングシート）
  // ============================================================
  function createMemoButton() {
    // フローティングメモボタン
    if (document.getElementById('memoFab')) return;
    const fab = document.createElement('button');
    fab.id = 'memoFab';
    fab.className = 'memo-fab';
    fab.innerHTML = '📝';
    fab.title = '相談メモ';
    fab.addEventListener('click', () => openMemoPanel());
    document.body.appendChild(fab);
  }

  function openMemoPanel(category, prefill) {
    // すでに開いていたら閉じる
    const existing = document.getElementById('memoPanel');
    if (existing && !prefill) { existing.remove(); return; }
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'memoPanel';
    panel.className = 'memo-panel';

    const memos = getMemos();
    const savedCount = memos.length;

    panel.innerHTML = `
      <div class="memo-panel-header">
        <h3>📝 相談メモ</h3>
        <button class="memo-close-btn" id="memoCloseBtn">✕</button>
      </div>
      <div class="memo-tabs">
        <button class="memo-tab active" data-tab="new">新規作成</button>
        <button class="memo-tab" data-tab="list">保存済み (${savedCount})</button>
      </div>
      <div class="memo-tab-content" id="memoNewTab">
        <div class="memo-form">
          <div class="memo-field">
            <label>📅 日時</label>
            <input type="text" id="memoDate" value="${new Date().toLocaleString('ja-JP')}" readonly>
          </div>
          <div class="memo-field">
            <label>👤 お名前</label>
            <input type="text" id="memoName" placeholder="相談者名">
          </div>
          <div class="memo-field">
            <label>📱 連絡先</label>
            <input type="text" id="memoContact" placeholder="電話番号・メールアドレス">
          </div>
          <div class="memo-field">
            <label>📁 カテゴリ</label>
            <input type="text" id="memoCategory" value="${category || ''}" placeholder="業務カテゴリ">
          </div>
          <div class="memo-field">
            <label>📋 相談内容・メモ</label>
            <textarea id="memoContent" rows="8" placeholder="相談内容、確認事項、次のアクションを記入…">${prefill || ''}</textarea>
          </div>
          <div class="memo-actions">
            <button class="memo-save-btn" id="memoSaveBtn">💾 保存する</button>
            <button class="memo-print-btn" id="memoPrintBtn">🖨️ 印刷</button>
          </div>
        </div>
      </div>
      <div class="memo-tab-content" id="memoListTab" style="display:none">
        <div id="memoListContent"></div>
      </div>
    `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('open'));

    // イベント
    document.getElementById('memoCloseBtn').addEventListener('click', () => {
      panel.classList.remove('open');
      setTimeout(() => panel.remove(), 300);
    });

    // タブ切り替え
    panel.querySelectorAll('.memo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.memo-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isNew = tab.dataset.tab === 'new';
        document.getElementById('memoNewTab').style.display = isNew ? 'block' : 'none';
        document.getElementById('memoListTab').style.display = isNew ? 'none' : 'block';
        if (!isNew) renderMemoList();
      });
    });

    document.getElementById('memoSaveBtn').addEventListener('click', saveMemo);
    document.getElementById('memoPrintBtn').addEventListener('click', printMemo);
  }

  function saveMemo() {
    const memo = {
      id: Date.now(),
      date: document.getElementById('memoDate').value,
      name: document.getElementById('memoName').value,
      contact: document.getElementById('memoContact').value,
      category: document.getElementById('memoCategory').value,
      content: document.getElementById('memoContent').value
    };
    if (!memo.content.trim()) { alert('内容を入力してください'); return; }
    const memos = getMemos();
    memos.unshift(memo);
    localStorage.setItem('inquiry_memos', JSON.stringify(memos));
    alert('メモを保存しました！');
    // タブのカウント更新
    const countTab = document.querySelector('.memo-tab[data-tab="list"]');
    if (countTab) countTab.textContent = `保存済み (${memos.length})`;
  }

  function getMemos() {
    try {
      return JSON.parse(localStorage.getItem('inquiry_memos') || '[]');
    } catch { return []; }
  }

  function renderMemoList() {
    const listEl = document.getElementById('memoListContent');
    const memos = getMemos();
    if (memos.length === 0) {
      listEl.innerHTML = '<p class="memo-empty">保存されたメモはありません</p>';
      return;
    }
    listEl.innerHTML = memos.map(m => `
      <div class="memo-list-item" data-id="${m.id}">
        <div class="memo-list-header">
          <span class="memo-list-date">${m.date}</span>
          <span class="memo-list-cat">${m.category || '未分類'}</span>
          <button class="memo-delete-btn" data-id="${m.id}" title="削除">🗑</button>
        </div>
        <div class="memo-list-name">${m.name || '名前未入力'}</div>
        <div class="memo-list-contact">${m.contact || ''}</div>
        <div class="memo-list-preview">${(m.content || '').substring(0, 100)}${m.content?.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');

    // 削除ボタン
    listEl.querySelectorAll('.memo-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('このメモを削除しますか？')) return;
        const id = parseInt(btn.dataset.id);
        const memos = getMemos().filter(m => m.id !== id);
        localStorage.setItem('inquiry_memos', JSON.stringify(memos));
        renderMemoList();
        const countTab = document.querySelector('.memo-tab[data-tab="list"]');
        if (countTab) countTab.textContent = `保存済み (${memos.length})`;
      });
    });

    // クリックでフォームに読み込み
    listEl.querySelectorAll('.memo-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        const memo = getMemos().find(m => m.id === id);
        if (!memo) return;
        document.getElementById('memoDate').value = memo.date;
        document.getElementById('memoName').value = memo.name || '';
        document.getElementById('memoContact').value = memo.contact || '';
        document.getElementById('memoCategory').value = memo.category || '';
        document.getElementById('memoContent').value = memo.content || '';
        // タブを切り替え
        document.querySelector('.memo-tab[data-tab="new"]').click();
      });
    });
  }

  function printMemo() {
    const printWin = window.open('', '_blank');
    if (!printWin) { alert('ポップアップがブロックされました。'); return; }
    const date = document.getElementById('memoDate').value;
    const name = document.getElementById('memoName').value;
    const contact = document.getElementById('memoContact').value;
    const category = document.getElementById('memoCategory').value;
    const content = document.getElementById('memoContent').value;

    printWin.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
      <title>相談メモ - ${name || '名前未入力'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans JP', 'Meiryo', sans-serif; padding: 24px; color: #1E293B; line-height: 1.7; font-size: 13px; }
        .header { border-bottom: 3px solid #4F46E5; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; }
        .header h1 { font-size: 16px; color: #4F46E5; }
        .header .office { font-size: 10px; color: #64748B; text-align: right; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .meta-item { padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; }
        .meta-label { font-size: 10px; color: #64748B; font-weight: 600; }
        .meta-value { font-size: 13px; }
        .content { padding: 12px; border: 1px solid #E2E8F0; border-radius: 4px; min-height: 200px; white-space: pre-wrap; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #CBD5E1; font-size: 9px; color: #94A3B8; text-align: center; }
      </style></head><body>
      <div class="header">
        <h1>📝 相談メモ</h1>
        <div class="office">○○行政書士事務所<br>TEL: 000-0000-0000</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">📅 日時</div><div class="meta-value">${date}</div></div>
        <div class="meta-item"><div class="meta-label">📁 カテゴリ</div><div class="meta-value">${category || '未分類'}</div></div>
        <div class="meta-item"><div class="meta-label">👤 お名前</div><div class="meta-value">${name || '-'}</div></div>
        <div class="meta-item"><div class="meta-label">📱 連絡先</div><div class="meta-value">${contact || '-'}</div></div>
      </div>
      <div class="content">${content}</div>
      <div class="footer">行政書士AIボット - 相談メモ</div>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  }
});
