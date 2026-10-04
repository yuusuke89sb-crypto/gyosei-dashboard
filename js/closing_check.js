/**
 * 締め前チェック（2026-10 追加）
 * 請求の締め（毎月25日）の前に、請求漏れ・入力漏れをまとめて確認する画面
 * 各行をクリックすると案件の編集画面を開く
 */
const ClosingCheck = {
  MODAL_ID: 'closingCheckModal',
  _year: null,
  _month: null,

  STATUS_LABELS: { received: '受付', applying: '申請中', delivery: '交付待ち', in_progress: '進行中', done: '完了' },
  CATS: { garage_oss: '車庫OSS', garage_paper: '車庫一般', seal: '封印', car_reg_standard: '普通車登録', car_reg_light: '軽登録', inheritance: '相続', permit: '許認可' },
  // 立替金（証紙・印紙など）が通常発生する種別
  ADVANCE_CATS: ['garage_paper', 'car_reg_standard', 'car_reg_light'],

  _esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  caseDate(c) {
    const raw = c.completedAt || c.registrationDate || c.policeDeliveryDate || c.applyDate || (c.createdAt ? String(c.createdAt).slice(0, 10) : '') || '';
    return String(raw).slice(0, 10);
  },
  clientName(id) {
    const c = id ? Store.getClient(id) : null;
    return c ? (c.companyName || c.name || '') : '（顧客未設定）';
  },
  advTotal(c) {
    return (Array.isArray(c.advances) ? c.advances : []).reduce((s, a) => s + Number(a.amount || 0), 0);
  },

  show(year, month) {
    if (!year || !month) {
      const cur = Store.getCurrentBillingPeriod(new Date());
      year = cur.year; month = cur.month;
    }
    this._year = Number(year); this._month = Number(month);
    const old = document.getElementById(this.MODAL_ID);
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = this.MODAL_ID;
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="ClosingCheck.close()"></div>
      <div class="modal-content" style="max-width:900px;width:95vw;max-height:90vh;overflow:auto;">
        <div class="modal-header">
          <h2>📋 締め前チェック</h2>
          <button class="modal-close" onclick="ClosingCheck.close()">✕</button>
        </div>
        <div id="closingCheckBody" style="font-size:0.85rem;padding-bottom:12px;"></div>
      </div>`;
    document.body.appendChild(modal);
    this.render();
  },

  close() {
    const m = document.getElementById(this.MODAL_ID);
    if (m) m.remove();
  },

  move(delta) {
    let y = this._year, m = this._month + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    this._year = y; this._month = m;
    this.render();
  },

  collect() {
    const p = Store.getBillingPeriod(this._year, this._month);
    const all = Store.getCases();
    const inPeriod = c => { const d = this.caseDate(c); return d && d >= p.startDate && d <= p.endDate; };
    const done = all.filter(c => c.status === 'done' && inPeriod(c));
    return {
      period: p,
      unbilled: done.filter(c => !c.invoiceNo && (Number(c.fee || 0) > 0 || this.advTotal(c) > 0)),
      notDone: all.filter(c => c.status !== 'done' && !c.invoiceNo && this.caseDate(c) && this.caseDate(c) <= p.endDate),
      zeroFee: done.filter(c => !c.invoiceNo && !(Number(c.fee || 0) > 0)),
      noAdvance: done.filter(c => !c.invoiceNo && this.ADVANCE_CATS.includes(c.category) && this.advTotal(c) === 0),
      pending: (typeof CaseSync !== 'undefined') ? all.filter(c => CaseSync.pendingFields(c).length) : [],
      orphans: all.filter(c => c._orphan),
    };
  },

  render() {
    const body = document.getElementById('closingCheckBody');
    if (!body) return;
    const r = this.collect();
    const p = r.period;
    const invReady = (typeof InvoiceSync === 'undefined') || InvoiceSync.isReady();
    const okCount = [r.unbilled, r.notDone, r.zeroFee, r.noAdvance, r.pending].filter(a => !a.length).length;

    const card = (n, label, color) => `
      <div style="flex:1;min-width:120px;background:rgba(148,163,184,0.08);border:1px solid ${n ? color : 'var(--border-color,#334155)'};border-radius:10px;padding:10px 12px;">
        <div style="font-size:0.72rem;color:var(--text-muted);">${label}</div>
        <div style="font-size:1.4rem;font-weight:800;color:${n ? color : '#10b981'};">${n ? n + '件' : '✓ 0'}</div>
      </div>`;

    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <button class="btn btn-ghost" onclick="ClosingCheck.move(-1)">◀</button>
        <div style="font-weight:700;font-size:1rem;flex:1;text-align:center;">${this._esc(p.label || (this._year + '年' + this._month + '月分'))}</div>
        <button class="btn btn-ghost" onclick="ClosingCheck.move(1)">▶</button>
      </div>
      ${invReady ? '' : '<div style="background:rgba(245,158,11,0.12);border:1px solid #b45309;border-radius:8px;padding:8px 10px;margin-bottom:10px;">⚠️ 請求データ（全端末共有）をまだ取得していません。「🔄 同期」後に確認してください。</div>'}
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${card(r.unbilled.length, '完了・未請求', '#f59e0b')}
        ${card(r.notDone.length, '未完了（締め日まで）', '#60a5fa')}
        ${card(r.zeroFee.length, '報酬 0円', '#f87171')}
        ${card(r.noAdvance.length, '立替金 未入力', '#f87171')}
        ${card(r.pending.length, '未送信', '#f59e0b')}
      </div>
      <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">チェック ${okCount}/5 項目クリア。行をクリックすると案件を開きます。</div>`;

    // 1. 完了・未請求（顧客別）
    if (r.unbilled.length) {
      const by = {};
      r.unbilled.forEach(c => { (by[c.clientId || ''] = by[c.clientId || ''] || []).push(c); });
      html += this.section('🧾 完了しているが未請求', '請求書の発行対象です。顧客ごとの件数と金額（税抜報酬＋立替金）。',
        Object.keys(by).sort((a, b) => by[b].length - by[a].length).map(cid => {
          const list = by[cid];
          const fee = list.reduce((s, c) => s + Number(c.fee || 0), 0);
          const adv = list.reduce((s, c) => s + this.advTotal(c), 0);
          return `<div style="margin-top:8px;"><div style="font-weight:700;">${this._esc(this.clientName(cid))} <span style="font-weight:400;color:var(--text-muted);">${list.length}件 ／ 報酬 ¥${fee.toLocaleString()} ＋ 立替 ¥${adv.toLocaleString()}</span></div>
            ${list.map(c => this.row(c, `¥${Number(c.fee || 0).toLocaleString()}${this.advTotal(c) ? ' ＋立替 ¥' + this.advTotal(c).toLocaleString() : ''}`)).join('')}</div>`;
        }).join(''));
    }
    if (r.notDone.length) {
      html += this.section('⏳ 締め日までに受け付けた未完了の案件', '完了しているのにステータスが更新されていないものがないか確認してください。',
        r.notDone.sort((a, b) => this.caseDate(a).localeCompare(this.caseDate(b))).map(c => this.row(c, this.STATUS_LABELS[c.status] || c.status || '')).join(''));
    }
    if (r.zeroFee.length) {
      html += this.section('💴 報酬が 0円・未入力の完了案件', '請求書に載せる前に報酬額を入力してください。',
        r.zeroFee.map(c => this.row(c, '報酬 未入力')).join(''));
    }
    if (r.noAdvance.length) {
      html += this.section('🧷 立替金が未入力の完了案件', '車庫一般・登録の案件で立替金（証紙・印紙など）が 0円のものです。不要な場合はそのままで構いません。',
        r.noAdvance.map(c => this.row(c, '立替金 0円')).join(''));
    }
    if (r.pending.length || r.orphans.length) {
      html += this.section('📤 同期の確認', '未送信の変更は通信が回復すると自動で送信されます。詳しくは「同期の状態」を開いてください。',
        `<div style="margin-top:6px;">未送信 ${r.pending.length}件 ／ スプレッドシートに無い案件 ${r.orphans.length}件
          <button class="btn btn-ghost" style="padding:2px 10px;font-size:0.75rem;margin-left:8px;" onclick="ClosingCheck.close();SyncPanel.show()">同期の状態を開く</button></div>`);
    }
    if (!r.unbilled.length && !r.notDone.length && !r.zeroFee.length && !r.noAdvance.length && !r.pending.length) {
      html += '<div style="margin-top:20px;text-align:center;font-size:1rem;color:#10b981;font-weight:700;">✅ この期間の確認事項はありません</div>';
    }
    body.innerHTML = html;
  },

  section(title, hint, inner) {
    return `<div style="margin-top:16px;background:rgba(148,163,184,0.06);border:1px solid var(--border-color,#334155);border-radius:10px;padding:12px 14px;">
      <div style="font-weight:800;">${title}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin:2px 0 4px;">${hint}</div>
      ${inner}
    </div>`;
  },

  row(c, right) {
    const cat = this.CATS[c.category] || c.category || '';
    return `<div onclick="ClosingCheck.open('${c.id}')" style="display:flex;gap:8px;align-items:center;padding:5px 6px;border-top:1px dashed var(--border-color,#334155);cursor:pointer;border-radius:4px;"
        onmouseover="this.style.background='rgba(96,165,250,0.08)'" onmouseout="this.style.background=''">
      <span style="font-family:monospace;color:var(--text-muted);font-size:0.75rem;width:46px;flex-shrink:0;">${this._esc(this.caseDate(c).slice(5))}</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._esc(c.title || c.id)}
        <span style="color:var(--text-muted);font-size:0.75rem;"> ${this._esc(cat)}${c.orderNo ? ' №' + this._esc(c.orderNo) : ''} ／ ${this._esc(this.clientName(c.clientId))}</span></span>
      <span style="flex-shrink:0;font-size:0.78rem;">${this._esc(right)}</span>
    </div>`;
  },

  open(id) {
    if (typeof Cases === 'undefined' || typeof Cases.showEditModal !== 'function') return;
    this.close();
    Cases.showEditModal(id);
  },
};
