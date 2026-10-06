/**
 * 請求書・請求明細・入金の全端末共有（2026-10 追加）
 * 設計書: invoice_sync_design.md
 *
 * - 請求の「正」はスプレッドシート（請求書・請求明細・入金シート）
 * - 発行・取消・入金消込は必ず GAS 経由（オフライン時は発行できない）
 * - 案件の invoiceNo / invoiceLocked 等は、シートの請求明細から毎回組み立て直す
 */
const InvoiceSync = {
  STATE_KEY: 'gyosei_inv_state',
  DEVICE_KEY: 'gyosei_device_name',
  STAFF_KEY: 'gyosei_device_staff',

  // ---------------- 端末名 ----------------
  getDeviceName() {
    return (localStorage.getItem(this.DEVICE_KEY) || '').trim();
  },
  setDeviceName(name) {
    localStorage.setItem(this.DEVICE_KEY, String(name || '').trim());
    if (typeof CaseSync !== 'undefined') CaseSync.renderBadge();
  },
  /** 未設定なら入力を求める。キャンセル時は '' */
  ensureDeviceName() {
    let name = this.getDeviceName();
    if (name) return name;
    name = (prompt('この端末の名前を入力してください（例：事務所PC1、代表ノート）\n※請求書の発行履歴に残ります。最初の1回だけです。') || '').trim();
    if (name) this.setDeviceName(name);
    return name;
  },
  operatorName() {
    try {
      if (typeof Auth !== 'undefined' && typeof Auth.isAdmin === 'function' && Auth.isAdmin()) return '管理者';
    } catch (e) { /* noop */ }
    return '';
  },

  // ---------------- 状態 ----------------
  getState() {
    try {
      const s = JSON.parse(localStorage.getItem(this.STATE_KEY)) || {};
      return {
        invoices: Array.isArray(s.invoices) ? s.invoices.filter(v => v && v.invoiceNo) : [],
        items: Array.isArray(s.items) ? s.items.filter(it => it && it.invoiceNo) : [],
        payments: Array.isArray(s.payments) ? s.payments.filter(p => p && p.invoiceNo) : [],
        loadedAt: s.loadedAt || null,
      };
    } catch (e) {
      return { invoices: [], items: [], payments: [] };
    }
  },
  saveState(s) {
    if (!s) return;
    const clean = {
      invoices: Array.isArray(s.invoices) ? s.invoices.filter(v => v && v.invoiceNo) : [],
      items: Array.isArray(s.items) ? s.items.filter(it => it && it.invoiceNo) : [],
      payments: Array.isArray(s.payments) ? s.payments.filter(p => p && p.invoiceNo) : [],
      loadedAt: s.loadedAt || new Date().toISOString(),
    };
    localStorage.setItem(this.STATE_KEY, JSON.stringify(clean));
  },
  /** シートから請求データを一度でも取得できているか（発行の前提条件） */
  isReady() {
    return !!this.getState().loadedAt;
  },
  getInvoice(invoiceNo) {
    return this.getState().invoices.find(v => v && v.invoiceNo === invoiceNo) || null;
  },
  activeItemByCase() {
    const m = {};
    this.getState().items.forEach(it => { if (it && it.status === '有効') m[it.caseId] = it; });
    return m;
  },

  // ---------------- 取得・反映 ----------------
  applyRemote(inv) {
    if (!inv || !Array.isArray(inv.invoices)) return;
    const s = {
      invoices: (inv.invoices || []).filter(v => v && v.invoiceNo),
      items: (inv.items || []).filter(it => it && it.invoiceNo),
      payments: (inv.payments || []).filter(p => p && p.invoiceNo),
      loadedAt: new Date().toISOString()
    };
    this.saveState(s);
    this.reconcileCases();
    this.rebuildPayments();
  },

  async refresh() {
    const url = SpreadsheetSync.getGasUrl();
    const sep = url.includes('?') ? '&' : '?';
    const r = await fetch(url + sep + 'type=invoices&t=' + Date.now());
    if (!r.ok) throw new Error('通信エラー: ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    if (!d.invoices) throw new Error('請求データを取得できませんでした（GASが未更新の可能性）');
    this.applyRemote(d.invoices);
  },

  /** 請求明細 → 案件の請求フィールドへ反映（同期の対象外なので _fieldTs は触らない） */
  reconcileCases() {
    const s = this.getState();
    const invMap = {};
    (s.invoices || []).forEach(v => { if (v && v.invoiceNo) invMap[v.invoiceNo] = v; });
    const active = this.activeItemByCase();
    const cases = Store.getCases();
    let changed = 0;
    cases.forEach(c => {
      if (!c) return;
      const it = active[c.id];
      let want;
      if (it) {
        let adv = it.lockedAdvancesJson;
        if (typeof adv === 'string') { try { adv = JSON.parse(adv || '[]'); } catch (e) { adv = []; } }
        want = {
          invoiceNo: it.invoiceNo, invoiceLocked: true,
          invoiceLockedAt: (invMap[it.invoiceNo] && invMap[it.invoiceNo].issuedAt) || '',
          invoiceLockedFee: Number(it.lockedFee || 0), invoiceLockedAdvances: Array.isArray(adv) ? adv : [],
        };
      } else if (c.invoiceNo || c.invoiceLocked) {
        want = { invoiceNo: '', invoiceLocked: false, invoiceLockedAt: '', invoiceLockedFee: '', invoiceLockedAdvances: [] };
      } else {
        return;
      }
      const diff = Object.keys(want).some(k => JSON.stringify(c[k]) !== JSON.stringify(want[k]));
      if (diff) { Object.assign(c, want); changed++; }
    });
    if (changed) Store._set(Store.KEYS.CASES, cases);
    return changed;
  },

  /** 入金シート → 既存の入金管理画面用データ（gyosei_payments）を作り直す */
  rebuildPayments() {
    if (typeof Payments === 'undefined') return;
    const s = this.getState();
    const invMap = {};
    (s.invoices || []).forEach(v => { if (v && v.invoiceNo) invMap[v.invoiceNo] = v; });
    const list = (s.payments || []).filter(p => p && p.status !== '取消').map(p => ({
      id: p.paymentId,
      invoiceNo: p.invoiceNo,
      clientId: p.customerId,
      amount: Number(p.amount || 0),
      dueDate: p.dueDate || '',
      taxRate: 10,
      status: p.status === '入金済' ? 'paid' : 'unpaid',
      paidAt: p.paidDate || null,
      paidAmount: Number(p.paidAmount || 0),
      method: p.method || '',
      createdAt: (invMap[p.invoiceNo] && invMap[p.invoiceNo].issuedAt) || '',
    }));
    localStorage.setItem(Payments.STORAGE_KEY, JSON.stringify(list));
  },

  // ---------------- API 呼び出し ----------------
  async call(action, data) {
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) throw new Error('スプレッドシート連携が設定されていません');
    const res = await SpreadsheetSync.push(action, data);
    if (!res) throw new Error('スプレッドシートに接続できませんでした。ネットワークを確認して、もう一度お試しください。');
    if (res.error) {
      const err = new Error(res.error);
      Object.assign(err, res);
      throw err;
    }
    return res;
  },

  /**
   * 発行
   * @returns {Promise<{invoiceNo:string, invoice:object}>}
   */
  async issue({ clientId, year, month, issueDate, dueDate, cases, taxRate, templateType, note, period }) {
    if (!this.isReady()) throw new Error('請求データをまだ取得できていません。「🔄 同期」してから発行してください。');
    const device = this.ensureDeviceName();
    if (!device) throw new Error('端末名が未設定のため発行を中止しました');
    const client = Store.getClient(clientId) || {};
    const items = cases.map(c => ({
      caseId: c.id,
      fee: c.isPaid ? 0 : Number(c.fee || 0),
      advances: c.isAdvancePaid ? [] : (c.advances || []).map(a => Object.assign({}, a, { amount: Number(a.amount || 0) })),
    }));
    const feeExTax = items.reduce((s, it) => s + it.fee, 0);
    const advanceTotal = items.reduce((s, it) => s + it.advances.reduce((t, a) => t + a.amount, 0), 0);
    const tax = Math.floor(feeExTax * (taxRate || 10) / 100);
    const p = period || (typeof Store.getBillingPeriod === 'function' ? Store.getBillingPeriod(year, month) : {});
    const res = await this.call('issueInvoice', {
      yyyymm: `${year}${String(month).padStart(2, '0')}`,
      customerId: clientId,
      customerName: client.companyName || client.name || '',
      periodFrom: (p && p.startDate) || '', periodTo: (p && p.endDate) || '',
      issueDate: issueDate || Store.getLocalDateStr(), dueDate: dueDate || '',
      feeExTax, tax, advanceTotal, grandTotal: feeExTax + tax + advanceTotal,
      template: templateType || '', note: note || '',
      issuedBy: this.operatorName(), issuedDevice: device,
      items,
    });
    if (!res || !res.invoiceNo) {
      throw new Error('スプレッドシートから有効な請求番号が取得できませんでした。スプレッドシートのデプロイ状態を確認してください。');
    }
    // 手元の状態にも即時反映（null / undefined の混入を完全に防止）
    const s = this.getState();
    if (res.invoice) s.invoices.push(res.invoice);
    if (Array.isArray(res.items)) s.items.push(...res.items);
    if (res.payment) s.payments.push(res.payment);
    this.saveState(s);
    this.reconcileCases();
    this.rebuildPayments();
    if (typeof ActivityLog !== 'undefined' && ActivityLog.add) {
      try { ActivityLog.add('invoice', res.invoiceNo, `請求書 ${res.invoiceNo} 発行（${cases.length}件・${device}）`); } catch (e) { /* noop */ }
    }
    return res;
  },

  async cancel(invoiceNo, reason) {
    const device = this.ensureDeviceName() || '未設定';
    const res = await this.call('cancelInvoice', { invoiceNo, canceledBy: this.operatorName(), canceledDevice: device, reason: reason || '' });
    // ローカル状態に即時反映（重い refresh() による画面ブロッキングを回避）
    const s = this.getState();
    const inv = (s.invoices || []).find(v => v.invoiceNo === invoiceNo);
    if (inv) {
      inv.status = '取消';
      inv.canceledBy = this.operatorName();
      inv.canceledDevice = device;
      inv.canceledAt = new Date().toISOString();
      inv.cancelReason = reason || '';
    }
    (s.items || []).forEach(it => {
      if (it.invoiceNo === invoiceNo) it.status = '取消';
    });
    (s.payments || []).forEach(p => {
      if (p.invoiceNo === invoiceNo) p.status = '取消';
    });
    this.saveState(s);
    this.reconcileCases();
    this.rebuildPayments();
    // バックグラウンドで静かに再同期（画面を待たせない）
    this.refresh().catch(() => {});
    return res;
  },

  async cancelCase(invoiceNo, caseId, reason) {
    const device = this.ensureDeviceName() || '未設定';
    const res = await this.call('cancelInvoiceCase', { invoiceNo, caseId, canceledBy: this.operatorName(), canceledDevice: device, reason: reason || '' });
    if (res && res.invoice) {
      const s = this.getState();
      const idx = (s.invoices || []).findIndex(v => v.invoiceNo === invoiceNo);
      if (idx !== -1) s.invoices[idx] = res.invoice;
      (s.items || []).forEach(it => {
        if (it.invoiceNo === invoiceNo && String(it.caseId) === String(caseId)) it.status = '取消';
      });
      (s.payments || []).forEach(p => {
        if (p.invoiceNo === invoiceNo && p.status !== '取消') p.amount = res.invoice.grandTotal;
      });
      this.saveState(s);
      this.reconcileCases();
      this.rebuildPayments();
    }
    this.refresh().catch(() => {});
    return res;
  },

  async markPaid(invoiceNo, method, paidDate, paidAmount) {
    const res = await this.call('markInvoicePaid', {
      invoiceNo, method: method || '振込', paidDate: paidDate || Store.getLocalDateStr(),
      paidAmount: paidAmount, updatedBy: this.getDeviceName(),
    });
    if (res && res.payment) {
      const s = this.getState();
      const idx = (s.payments || []).findIndex(p => p.invoiceNo === invoiceNo && p.status !== '取消');
      if (idx !== -1) s.payments[idx] = res.payment;
      else (s.payments || []).push(res.payment);
      this.saveState(s);
      this.rebuildPayments();
    }
    this.refresh().catch(() => {});
    return res;
  },

  async unmarkPaid(invoiceNo) {
    const res = await this.call('unmarkInvoicePaid', { invoiceNo, updatedBy: this.getDeviceName() });
    if (res && res.payment) {
      const s = this.getState();
      const idx = (s.payments || []).findIndex(p => p.invoiceNo === invoiceNo);
      if (idx !== -1) s.payments[idx] = res.payment;
      this.saveState(s);
      this.rebuildPayments();
    }
    this.refresh().catch(() => {});
    return res;
  },

  /** 二重請求エラーの表示用 */
  describeError(err) {
    if (err && err.code === 'ALREADY_BILLED' && Array.isArray(err.conflicts)) {
      const lines = err.conflicts.slice(0, 10).map(cf => {
        const c = Store.getCase(cf.caseId);
        return `・${c ? c.title : cf.caseId} → ${cf.invoiceNo}（${cf.issuedDevice || '端末不明'} ${String(cf.issuedAt || '').slice(0, 16).replace('T', ' ')}）`;
      });
      return `次の案件はすでに他の請求書で請求済みです。\n\n${lines.join('\n')}${err.conflicts.length > 10 ? `\n…ほか${err.conflicts.length - 10}件` : ''}\n\n最新の状態に更新しました。案件を選び直してください。`;
    }
    return (err && err.message) || String(err);
  },
};

// ---------------- 既存の入金管理（Payments）を共有方式に切替え ----------------
(function patchPayments() {
  if (typeof Payments === 'undefined') return;
  const orig = {
    createFromInvoice: Payments.createFromInvoice.bind(Payments),
    deleteByInvoiceNo: Payments.deleteByInvoiceNo.bind(Payments),
  };
  // 発行・取消時の入金予定は GAS が作る／消す
  Payments.createFromInvoice = function (...args) {
    if (InvoiceSync.isReady()) return;
    return orig.createFromInvoice(...args);
  };
  Payments.deleteByInvoiceNo = function (...args) {
    if (InvoiceSync.isReady()) return;
    return orig.deleteByInvoiceNo(...args);
  };
  // 入金消込は GAS 経由（入金仕訳は固定IDでシートに作成される）
  Payments.confirmPaid = async function (id) {
    const p = this.getAll().find(x => x.id === id);
    if (!p) return;
    const dateStr = prompt(`入金日を入力してください（${p.invoiceNo} / ¥${Number(p.amount || 0).toLocaleString()}）`, Store.getLocalDateStr());
    if (dateStr === null) return;
    try {
      await InvoiceSync.markPaid(p.invoiceNo, '振込', (dateStr || '').trim() || Store.getLocalDateStr());
      const m = document.getElementById('paymentModal');
      if (m) m.remove();
      this.showPaymentList();
      App.showToast('入金を記録しました（全端末に共有されます）');
    } catch (e) {
      alert('入金の記録に失敗しました。\n' + (e.message || e));
    }
  };
  Payments.markPaid = function (id, method) {
    const p = this.getAll().find(x => x.id === id);
    if (!p) return;
    return InvoiceSync.markPaid(p.invoiceNo, method || '振込');
  };
})();
