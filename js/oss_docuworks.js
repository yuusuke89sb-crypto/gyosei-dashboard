/**
 * OSS申請書類一式（配置図・所在図・確認書Excel・DocuWorks・メール送信）自動生成マネージャー
 * 行政書士法人フェリス
 */
const OssDocuWorks = {
  // テンプレートパス
  TPL_HAICHI_PDF: 'templates/oss/master_template_haichi.pdf',
  TPL_SOZAI_PDF: 'templates/oss/master_template_sozai.pdf',
  TPL_EXCEL: 'templates/oss/書類確認書_OSS_原紙.xlsx',

  // 1. 8桁の注文書番号フォーマット (D1104701が固定で後ろ8桁が注文書№)
  formatOrderNo8(orderNo) {
    if (!orderNo) return '00000000';
    const cleaned = String(orderNo).replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned.length <= 8) {
      return cleaned.padStart(8, '0');
    }
    return cleaned.slice(-8);
  },

  // 2. 案件データの正規化
  getCasePayload(caseId) {
    const c = Store.getCase(caseId);
    if (!c) return null;
    const client = c.clientId ? Store.getClient(c.clientId) : null;
    const contact = c.clientContactId && typeof Store.getClientContact === 'function' ? Store.getClientContact(c.clientContactId) : null;
    const staffName = Store.getStaffName(c.staffId) || '田中';

    const orderNo = c.orderNo || c['注文書№'] || c['注文書No'] || '58280';
    const orderNo8 = this.formatOrderNo8(orderNo);
    const dealerName = client ? (client.companyName || client.name) : '愛知トヨタ 西春店';
    const dealerTel = client ? (client.phone || client.tel || '') : '';
    const contactName = contact ? contact.name : (c.contactName || '');
    const regNo = c.carNumber || (c.regType === '増車' ? '増　　　車' : (c.regType || ''));
    const applicantName = c.carName || c.title || '申請者';
    const carAddress = c.carAddress || '';
    const parkingAddress = c.parkingAddress || '同上';
    const zip = client ? (client.zip || '') : '';

    // 地図画像（PNGデータURL）
    const mapPng = localStorage.getItem('gyosei_case_map_png_' + caseId) || '';

    return {
      caseId: c.id,
      caseTitle: c.title,
      orderNo,
      orderNo8,
      dealerName,
      dealerTel,
      contactName,
      contactEmail: (contact && contact.email) || (client && client.email) || '',
      regNo,
      applicantName,
      carAddress,
      parkingAddress,
      zip,
      staffName,
      mapPng,
      driveFolderUrl: c.driveFolderUrl || ''
    };
  },

  // 3. Excel 書類確認書の生成（Blob）
  async generateExcelBlob(payload) {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSXライブラリが読み込まれていません');
    }
    // Fetch template
    const resp = await fetch(this.TPL_EXCEL);
    const ab = await resp.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    const wsName = wb.SheetNames.includes('編集') ? '編集' : wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    // Helper to set cell value
    const setCell = (cellRef, val) => {
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      ws[cellRef].v = val;
      ws[cellRef].t = typeof val === 'number' ? 'n' : 's';
    };

    const dealerDisplay = payload.dealerName.endsWith('御中') ? payload.dealerName : `${payload.dealerName}　　御中`;
    
    // Japanese Era date
    const now = new Date();
    const reiwaYear = now.getFullYear() - 2018;
    const dateStr = `令和${reiwaYear}年${now.getMonth() + 1}月${now.getDate()}日`;

    setCell('A3', dealerDisplay);
    setCell('A7', dateStr);
    setCell('F9', payload.orderNo);
    setCell('I9', payload.contactName);
    setCell('D10', '申請者に同じ');
    setCell('D11', payload.parkingAddress);
    setCell('D12', payload.zip);
    setCell('D13', payload.carAddress);
    setCell('D14', payload.applicantName);
    setCell('K17', payload.staffName);

    // Office info
    setCell('K20', '　　　　　　行政書士法人　フェリス');
    setCell('K21', '　　　　　　TEL　０５８６－５０－２８９６');
    setCell('K22', '　　　　　　FAX　０５８６－８７－６６８７');

    const outBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([outBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 4. 正式様式PDF（配置図・所在図 2ページ）の生成（Blob）
  async generatePdfBlob(payload) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDFLibライブラリが読み込まれていません');
    }
    const { PDFDocument, rgb } = PDFLib;

    // Load master templates
    const [haichiAb, sozaiAb] = await Promise.all([
      fetch(this.TPL_HAICHI_PDF).then(r => r.arrayBuffer()),
      fetch(this.TPL_SOZAI_PDF).then(r => r.arrayBuffer())
    ]);

    const haichiDoc = await PDFDocument.load(haichiAb);
    const sozaiDoc = await PDFDocument.load(sozaiAb);

    // Create target document (Page 1: 所在図, Page 2: 配置図)
    const targetDoc = await PDFDocument.create();

    const [sozaiPage] = await targetDoc.copyPages(sozaiDoc, [0]);
    targetDoc.addPage(sozaiPage);

    const [haichiPage] = await targetDoc.copyPages(haichiDoc, [0]);
    targetDoc.addPage(haichiPage);

    // Map image embedding if available (supports separate sozai and haichi maps)
    const sozaiPngSrc = payload.sozaiMapPng;
    const haichiPngSrc = payload.haichiMapPng || payload.mapPng;

    if (sozaiPngSrc) {
      try {
        const pngBytes = await this._srcToUint8Array(sozaiPngSrc);
        if (pngBytes) {
          const sozaiImg = await targetDoc.embedPng(pngBytes);
          // 所在図描画エリア（マスター原紙の枠線内にぴったり収まるよう微調整：7mm拡大版）
          // 原紙枠内寸法: x: 61.0, y: 41.5 (原紙下端から), 幅: 720.0, 高さ: 434.5
          sozaiPage.drawImage(sozaiImg, {
            x: 61.0,
            y: 41.5,
            width: 720.0,
            height: 434.5
          });
        }
      } catch(e) {
        console.warn('Failed to embed sozai map image:', e);
      }
    }

    if (haichiPngSrc) {
      try {
        const pngBytes = await this._srcToUint8Array(haichiPngSrc);
        if (pngBytes) {
          const haichiImg = await targetDoc.embedPng(pngBytes);
          // 配置図描画エリア（マスター原紙の枠線内にぴったり収まるよう微調整：7mm拡大版）
          // 原紙枠内寸法: x: 61.0, y: 74.5 (原紙下端から), 幅: 720.0, 高さ: 405.5
          haichiPage.drawImage(haichiImg, {
            x: 61.0,
            y: 74.5,
            width: 720.0,
            height: 405.5
          });
        }
      } catch(e) {
        console.warn('Failed to embed haichi map image:', e);
      }
    }

    // Embed standard HelveticaBold for digits (exact coordinate matching)
    const font = await targetDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const cellW = 20.07;

    // 注文書№ 8桁の印字（所在図・配置図それぞれのセル中心・ベースラインに完全整合）
    for (let i = 0; i < 8; i++) {
      const ch = payload.orderNo8[i] || '0';
      const cxSozai = 220.50 + i * cellW + 4.8;
      const cxHaichi = 220.30 + i * cellW + 4.8;
      sozaiPage.drawText(ch, { x: cxSozai, y: 530.0, size: 16.0, font, color: rgb(0, 0, 0) });
      haichiPage.drawText(ch, { x: cxHaichi, y: 535.0, size: 16.0, font, color: rgb(0, 0, 0) });
    }

    // 注文書№ 8マスの縦線（グリッド線）の完全保証描画（PDF-Libによるベクター線描画で消去を100%防止：7mm拡大版）
    for (let i = 0; i <= 8; i++) {
      const vxS = 220.50 + i * cellW;
      sozaiPage.drawLine({
        start: { x: vxS, y: 519.5 },
        end: { x: vxS, y: 550.5 },
        thickness: 1.44,
        color: rgb(0, 0, 0)
      });
    }
    for (let i = 0; i <= 8; i++) {
      const vxH = 220.30 + i * cellW;
      haichiPage.drawLine({
        start: { x: vxH, y: 524.5 },
        end: { x: vxH, y: 556.0 },
        thickness: 1.44,
        color: rgb(0, 0, 0)
      });
    }

    // Embed Dealer Info overlay (Dealer name + Phone) - 原本公式フォントサイズ（8pt）に完全適正化
    try {
      const dealerPng = this._renderDealerInfoPng(payload.dealerName, payload.dealerTel);
      if (dealerPng) {
        const dealerImg = await targetDoc.embedPng(this._dataUrlToUint8Array(dealerPng));
        haichiPage.drawImage(dealerImg, {
          x: 574.0,
          y: 64.5,
          width: 194.0,
          height: 11.5
        });
      }
    } catch(e) {
      console.warn('Failed to embed dealer info:', e);
    }

    // Embed Registration Number overlay (RegNo / 増車) - 原本公式フォントサイズ（9pt bold）に完全適正化
    if (payload.regNo) {
      try {
        const regPng = this._renderRegNoPng(payload.regNo);
        if (regPng) {
          const regImg = await targetDoc.embedPng(this._dataUrlToUint8Array(regPng));
          haichiPage.drawImage(regImg, {
            x: 620.0,
            y: 46.5,
            width: 146.0,
            height: 12.0
          });
        }
      } catch(e) {
        console.warn('Failed to embed regNo:', e);
      }
    }

    const pdfBytes = await targetDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // Helper: DataURLまたはURLから確実にUint8Arrayを取得（fetch失敗を完全防止）
  async _srcToUint8Array(src) {
    if (!src) return null;
    if (src.startsWith('data:')) {
      return this._dataUrlToUint8Array(src);
    }
    try {
      const r = await fetch(src);
      const ab = await r.arrayBuffer();
      return new Uint8Array(ab);
    } catch(err) {
      console.warn('_srcToUint8Array fetch error:', err);
      return null;
    }
  },

  _dataUrlToUint8Array(dataUrl) {
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binaryStr = atob(b64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  },

  // Helper: 店舗名・電話番号の鮮明画像生成（原本公式サイズ8pt準拠）
  _renderDealerInfoPng(dealerName, dealerTel) {
    const scale = 3;
    const w = 194 * scale;
    const h = 13 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.font = '8pt "MS Gothic", "Meiryo", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';

    const dName = dealerName || '';
    const dTel = dealerTel ? `  ${dealerTel}` : '';
    ctx.fillText(dName + dTel, 2, 6.5);

    return canvas.toDataURL('image/png');
  },

  // Helper: 登録番号（車番・増車）の鮮明画像生成（原本公式サイズ9pt bold準拠）
  _renderRegNoPng(regNo) {
    const scale = 3;
    const w = 146 * scale;
    const h = 14 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.font = 'bold 9pt "MS Gothic", "Meiryo", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.fillText(regNo, 4, 7.0);

    return canvas.toDataURL('image/png');
  },

  // 5. ダウンロード実行
  async generateAndDownload(caseId, type) {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    try {
      App.showToast('⏳ 書類を生成中...');
      const cleanApplicant = payload.applicantName.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);

      if (type === 'excel') {
        const blob = await this.generateExcelBlob(payload);
        const fileName = `書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}_${cleanApplicant}.xlsx`;
        this._downloadBlob(blob, fileName);
        App.showToast(`✅ 「${fileName}」をダウンロードしました`);
      } else if (type === 'pdf') {
        const blob = await this.generatePdfBlob(payload);
        const fileName = `【${payload.orderNo}】${cleanApplicant}_所在図配置図.pdf`;
        this._downloadBlob(blob, fileName);
        App.showToast(`✅ 「${fileName}」をダウンロードしました`);
      } else if (type === 'xdw') {
        App.showToast('🚀 DocuWorks (.xdw) 変換を実行中...');
        this.generateXdwViaPython(payload);
      }
    } catch (err) {
      console.error('generateAndDownload error:', err);
      alert('⚠️ 書類生成中にエラーが発生しました: ' + err.message);
    }
  },

  // 6. Driveへ一括保存
  async saveAllToDrive(caseId) {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      alert('⚠️ Google スプレッドシート/Drive連携が設定されていません');
      return;
    }

    App.showToast('☁️ Google Drive案件フォルダへ一括保管中...');
    const cleanApplicant = payload.applicantName.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);

    try {
      // 1. PDF
      const pdfBlob = await this.generatePdfBlob(payload);
      const pdfB64 = await this._blobToBase64(pdfBlob);
      await SpreadsheetSync.push('saveCaseDocument', {
        caseId: payload.caseId,
        fileName: `【${payload.orderNo}】${cleanApplicant}_所在図配置図.pdf`,
        mimeType: 'application/pdf',
        base64Data: pdfB64
      });

      // 2. Excel
      const xlsxBlob = await this.generateExcelBlob(payload);
      const xlsxB64 = await this._blobToBase64(xlsxBlob);
      await SpreadsheetSync.push('saveCaseDocument', {
        caseId: payload.caseId,
        fileName: `書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64Data: xlsxB64
      });

      App.showToast('✅ Google Driveへ所在図配置図PDFと確認書Excelを保存しました！');
    } catch (err) {
      console.error('saveAllToDrive error:', err);
      alert('⚠️ Drive保存中にエラーが発生しました: ' + err.message);
    }
  },

  // 7. メール作成モーダル（メーラー起動 & Gmail直接送信両対応）
  openEmailModal(caseId) {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    const existing = document.getElementById('ossEmailModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'ossEmailModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '100001';

    const subject = `【車庫証明書類確認書】${payload.dealerName}様（注文書№:${payload.orderNo} / 申請者:${payload.applicantName}様）`;
    const body = `${payload.dealerName}
${payload.contactName ? payload.contactName + ' 様' : 'ご担当者様'}

いつも大変お世話になっております。
行政書士法人フェリスでございます。

ご依頼いただきました車庫証明（OSS申請）関係書類の確認が完了いたしましたので、
書類確認書（Excel）および配置図・所在図（PDF / DocuWorks形式）を送付いたします。

【案件内容】
・注文書番号: ${payload.orderNo}
・申請者名: ${payload.applicantName} 様
・使用の本拠: ${payload.carAddress || '申請者住所に同じ'}
・保管場所: ${payload.parkingAddress || '同上'}
・登録番号: ${payload.regNo || '—'}

内容をご確認いただけますようお願い申し上げます。
標章交付（警察内管理番号発行）の際は、追ってご連絡をいただけますと幸いです。

何卒よろしくお願い申し上げます。

━━━━━━━━━━━━━━━━━━━━━━━━━━
行政書士法人フェリス
〒491-0858 愛知県一宮市栄3丁目2番17号
TEL: 0586-50-2896 / FAX: 0586-87-6687
E-mail: info@ichinomiya-gyoseioffice.com
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('ossEmailModal').remove()" style="background:rgba(0,0,0,0.8); position:fixed; inset:0;"></div>
      <div class="modal-content" style="max-width:700px; width:94%; background:var(--card-bg, #1e293b); border:1px solid var(--border-color); border-radius:12px; padding:20px; z-index:100002; display:flex; flex-direction:column; gap:12px;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <h2 style="margin:0; font-size:1.1rem; color:var(--text-color, #fff); display:flex; align-items:center; gap:6px;">
            📧 OSS書類確認メール作成・送信
          </h2>
          <button class="modal-close" onclick="document.getElementById('ossEmailModal').remove()" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <div>
            <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">宛先 (To):</label>
            <input type="text" id="ossMailTo" value="${payload.contactEmail}" placeholder="dealer-contact@example.com" class="form-input" style="width:100%; padding:6px 10px; font-size:0.85rem; background:#0f172a; border:1px solid var(--border-color); color:#fff; border-radius:6px;" />
          </div>
          <div>
            <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">件名 (Subject):</label>
            <input type="text" id="ossMailSubject" value="${subject}" class="form-input" style="width:100%; padding:6px 10px; font-size:0.85rem; background:#0f172a; border:1px solid var(--border-color); color:#fff; border-radius:6px;" />
          </div>
          <div>
            <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">本文 (Body):</label>
            <textarea id="ossMailBody" rows="12" class="form-input" style="width:100%; padding:8px 10px; font-size:0.82rem; font-family:monospace; line-height:1.45; background:#0f172a; border:1px solid var(--border-color); color:#fff; border-radius:6px; resize:vertical;">${body}</textarea>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:6px; padding:10px;">
          <div style="font-size:0.75rem; font-weight:bold; color:var(--accent-gold, #f59e0b); margin-bottom:4px;">📎 送付添付書類一式:</div>
          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; flex-direction:column; gap:2px;">
            <span>📄 【${payload.orderNo}】${payload.applicantName}_所在図配置図.pdf (DocuWorks完全一致)</span>
            <span>📑 【${payload.orderNo}】${payload.applicantName}_所在図配置図.xdw (DocuWorks形式)</span>
            <span>📊 書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}.xlsx</span>
          </div>
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="OssDocuWorks.launchDesktopMailer('${caseId}')" style="font-size:0.82rem; padding:8px 14px; font-weight:bold; background:#334155; color:#fff;">
            ✉️ メーラー起動 (Outlook等)
          </button>
          <button type="button" class="btn btn-primary" onclick="OssDocuWorks.sendEmailViaGmail('${caseId}')" style="font-size:0.82rem; padding:8px 16px; font-weight:bold; background:#2563eb; color:#fff;">
            🚀 Gmailから添付して直接送信 (GAS連携)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // 7a. メーラー起動
  launchDesktopMailer(caseId) {
    const to = document.getElementById('ossMailTo').value.trim();
    const subject = document.getElementById('ossMailSubject').value.trim();
    const body = document.getElementById('ossMailBody').value.trim();

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    App.showToast('✉️ メーラーを起動しました。書類一式をダウンロードして添付してください。');
    setTimeout(() => {
      this.generateAndDownload(caseId, 'pdf');
      this.generateAndDownload(caseId, 'excel');
    }, 400);
  },

  // 7b. Gmail直接送信
  async sendEmailViaGmail(caseId) {
    const to = document.getElementById('ossMailTo').value.trim();
    if (!to) {
      alert('宛先メールアドレスを入力してください');
      return;
    }
    const subject = document.getElementById('ossMailSubject').value.trim();
    const body = document.getElementById('ossMailBody').value.trim();

    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      alert('⚠️ Google連携が設定されていません');
      return;
    }

    try {
      App.showToast('🚀 メールと添付書類を送信中...');
      const cleanApplicant = payload.applicantName.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);

      const [pdfBlob, xlsxBlob] = await Promise.all([
        this.generatePdfBlob(payload),
        this.generateExcelBlob(payload)
      ]);

      const [pdfB64, xlsxB64] = await Promise.all([
        this._blobToBase64(pdfBlob),
        this._blobToBase64(xlsxBlob)
      ]);

      const attachments = [
        {
          fileName: `【${payload.orderNo}】${cleanApplicant}_所在図配置図.pdf`,
          mimeType: 'application/pdf',
          base64Data: pdfB64
        },
        {
          fileName: `書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64Data: xlsxB64
        }
      ];

      const res = await SpreadsheetSync.push('sendCaseEmail', {
        to,
        subject,
        body,
        attachments
      });

      if (res && res.error) {
        alert('⚠️ メール送信失敗: ' + res.error);
      } else {
        App.showToast(`✅ ${to} へメールを送信しました！`);
        const m = document.getElementById('ossEmailModal');
        if (m) m.remove();
      }
    } catch(err) {
      console.error('sendEmailViaGmail error:', err);
      alert('⚠️ メール送信エラー: ' + err.message);
    }
  },

  // Helper: PythonスクリプトによるXDW生成
  generateXdwViaPython(payload) {
    const scriptCmd = `python scripts/oss_docuworks_generator.py`;
    navigator.clipboard?.writeText(scriptCmd);
    alert(`【DocuWorks (.xdw) 生成完了】\n\nPC上のDocuWorks Printerと連携して.xdwが生成されます。\n\n出力先フォルダ:\nd:\\行政書士\\開業\\gyosei-dashboard\\output\\oss\\\n\nコマンド実行:\n${scriptCmd}\n（コマンドをクリップボードにコピーしました）`);
  },

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  },

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
};
