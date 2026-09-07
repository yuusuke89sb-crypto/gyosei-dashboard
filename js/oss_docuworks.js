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
    const rawDealer = client ? (client.companyName || client.name) : '愛知トヨタ 西春店';
    const dealerName = (rawDealer || '').replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '').trim();
    const dealerTel = ''; // 元の配置図の仕様に合わせ電話番号なし（店舗名のみ）
    const contactName = contact ? contact.name : (c.contactName || '');
    const regNo = c.carNumber || (c.regType === '増車' ? '増　　　車' : (c.regType || '増　　　車'));
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
      attachments: (c.attachments && c.attachments.length > 0) ? c.attachments : [],
      driveFolderUrl: c.driveFolderUrl || ''
    };
  },

  // 3-A. 書類確認書（原本Excel完全再現）のCanvas描画（300DPI超高精細）
  renderConfirmationCanvas(payload) {
    const W = 3508;
    const H = 2480;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 背景（純白）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const ml = 240;
    const mt = 130;
    const tableW = 3040;

    const colUnits = [5.625, 15.625, 3.625, 13.0, 5.625, 20.625, 3.625, 5.625, 17.625, 9.625, 13.0, 30.625];
    const sumUnits = colUnits.reduce((a, b) => a + b, 0);
    const colW = colUnits.map(u => (u / sumUnits) * tableW);
    const colX = [ml];
    for (let i = 0; i < colW.length; i++) {
      colX.push(colX[i] + colW[i]);
    }

    const rowH = [
      110, // 1: Title
      40,  // 2: Spacer / K2 Msg header
      90,  // 3: Dealer
      35,  // 4: Gap
      75,  // 5: Notice 1
      75,  // 6: Notice 2
      80,  // 7: Date
      45,  // 8: Gap
      98,  // 9: 注文書番号
      98,  // 10: 使用の本拠
      98,  // 11: 保管場所
      98,  // 12: 申請者 〒
      98,  // 13: 申請者 住所
      98,  // 14: 申請者 氏名
      98,  // 15: 配置図 / 標章交付注記
      50,  // 16: 所在図上 / 作成担当見出
      50,  // 17: 所在図下 / 田中
      98,  // 18: 承諾書
      30,  // 19: Gap
      55,  // 20: 行政書士法人 フェリス
      55,  // 21: TEL
      55   // 22: FAX
    ];

    const rowY = [mt];
    for (let i = 0; i < rowH.length; i++) {
      rowY.push(rowY[i] + rowH[i]);
    }

    const fFamily = '"MS PGothic", "ＭＳ Ｐゴシック", "Yu Gothic", sans-serif';

    // 1. タイトル
    ctx.fillStyle = '#000000';
    ctx.font = '66px ' + fFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OSS申請　書類確認書（車庫証明）', ml + tableW * 0.42, rowY[0] + rowH[0] / 2);

    // 2. 店舗名 + 御中
    ctx.textAlign = 'left';
    ctx.font = '60px ' + fFamily;
    const cleanDealer = (payload.dealerName || '').replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '').replace(/[\s\u3000]*御中\s*$/, '').trim() || '愛知トヨタ 西春店';
    ctx.fillText(cleanDealer, colX[0], rowY[2] + rowH[2] * 0.65);
    ctx.font = '54px ' + fFamily;
    ctx.fillText('御中', colX[5] + 20, rowY[2] + rowH[2] * 0.65);

    // 3. ご案内文
    ctx.font = '38px ' + fFamily;
    ctx.fillText('ご依頼のありました車庫証明関係書類を下記の通り確認させて頂きましたのでご査収下さい。', colX[0], rowY[4] + rowH[4] * 0.6);
    ctx.fillText('なお、不備のある書類につきましては、担当者と連絡を取り補正等の対応を致しました。', colX[0], rowY[5] + rowH[5] * 0.6);

    // 4. 日付（令和）
    const now = new Date();
    const reiwaYear = now.getFullYear() - 2018;
    const dateStr = payload.dateStr || `令　和　${reiwaYear}　年　${now.getMonth() + 1}　月　${now.getDate()}　日`;
    ctx.font = '36px ' + fFamily;
    ctx.fillText(dateStr, colX[0], rowY[6] + rowH[6] * 0.6);

    // 5. 連絡事項・メッセージ枠（K列〜L列、行2〜行14）
    const mbLeft = colX[10];
    const mbRight = colX[12];
    const mbTop = rowY[1];
    const mbBottom = rowY[14];
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(mbLeft, mbTop, mbRight - mbLeft, mbBottom - mbTop);

    const mbHLineY = rowY[1] + 50;
    ctx.beginPath();
    ctx.moveTo(mbLeft, mbHLineY);
    ctx.lineTo(mbRight, mbHLineY);
    ctx.stroke();

    ctx.font = '34px ' + fFamily;
    ctx.textAlign = 'center';
    ctx.fillText('連絡事項・メッセージ', (mbLeft + mbRight) / 2, (mbTop + mbHLineY) / 2 + 3);

    // 6. メイン確認表（行9〜行18、A列〜J列）
    const tLeft = colX[0];
    const tRight = colX[10];
    const tTop = rowY[8];
    const tBottom = rowY[18];

    const line = (x1, y1, x2, y2, width = 2, dashed = false) => {
      ctx.save();
      ctx.lineWidth = width;
      ctx.strokeStyle = '#000000';
      if (dashed) ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const drawCellText = (text, x, y, w, h, align = 'center', font = '35px ' + fFamily, bold = false) => {
      if (!text && text !== 0) return;
      ctx.save();
      ctx.font = (bold ? 'bold ' : '') + font;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'middle';
      if (align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(String(text), x + w / 2, y + h / 2);
      } else if (align === 'left') {
        ctx.textAlign = 'left';
        ctx.fillText(String(text), x + 16, y + h / 2);
      } else if (align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(String(text), x + w - 16, y + h / 2);
      }
      ctx.restore();
    };

    // 外枠（太線）
    ctx.lineWidth = 4;
    ctx.strokeRect(tLeft, tTop, tRight - tLeft, tBottom - tTop);

    // 横罫線
    line(tLeft, rowY[9], tRight, rowY[9], 4);
    line(tLeft, rowY[10], tRight, rowY[10], 4);
    line(tLeft, rowY[11], tRight, rowY[11], 4);
    line(colX[2], rowY[12], colX[10], rowY[12], 2, true); // 〒の下（破線）
    line(colX[1], rowY[13], colX[10], rowY[13], 2);       // 住所と氏名の間（細線）
    line(tLeft, rowY[14], tRight, rowY[14], 4);
    line(tLeft, rowY[15], tRight, rowY[15], 2);
    line(tLeft, rowY[17], tRight, rowY[17], 2);

    // 縦罫線
    line(colX[2], rowY[8], colX[2], rowY[11], 4);
    line(colX[1], rowY[11], colX[1], rowY[14], 2);
    line(colX[2], rowY[11], colX[2], rowY[14], 4);
    line(colX[2], rowY[14], colX[2], rowY[18], 4);

    line(colX[6], rowY[8], colX[6], rowY[9], 2);
    line(colX[8], rowY[8], colX[8], rowY[9], 2);
    line(colX[9], rowY[8], colX[9], rowY[9], 2);

    line(colX[4], rowY[14], colX[4], rowY[18], 4);
    line(colX[5], rowY[14], colX[5], rowY[18], 2);
    line(colX[7], rowY[14], colX[7], rowY[18], 4);
    line(colX[8], rowY[14], colX[8], rowY[18], 2);

    line(colX[3], rowY[11], colX[3], rowY[12], 2, true);
    line(colX[5], rowY[11], colX[5], rowY[12], 2, true);

    // セル文字列描画
    drawCellText('注文書番号', colX[0], rowY[8], colX[2] - colX[0], rowH[8]);
    drawCellText(payload.orderNo || '58280', colX[2], rowY[8], colX[6] - colX[2], rowH[8], 'center', '38px ' + fFamily);
    drawCellText('担当者', colX[6], rowY[8], colX[8] - colX[6], rowH[8]);
    drawCellText(payload.contactName ? payload.contactName.replace(/様$/, '') : '', colX[8], rowY[8], colX[9] - colX[8], rowH[8], 'center', '38px ' + fFamily);
    drawCellText('様', colX[9], rowY[8], colX[10] - colX[9], rowH[8]);

    drawCellText('使用の本拠の位置', colX[0], rowY[9], colX[2] - colX[0], rowH[9]);
    drawCellText('申請者に同じ', colX[2], rowY[9], colX[10] - colX[2], rowH[9], 'left');

    drawCellText('保管場所の位置', colX[0], rowY[10], colX[2] - colX[0], rowH[10]);
    drawCellText(payload.parkingAddress || '同上', colX[2], rowY[10], colX[10] - colX[2], rowH[10], 'left');

    drawCellText('申請者', colX[0], rowY[11], colX[1] - colX[0], rowH[11] + rowH[12] + rowH[13]);
    drawCellText('住　　所', colX[1], rowY[11], colX[2] - colX[1], rowH[11] + rowH[12]);
    drawCellText('〒 （', colX[2], rowY[11], colX[3] - colX[2], rowH[11], 'center', '32px ' + fFamily);
    drawCellText(payload.zip || '', colX[3], rowY[11], colX[5] - colX[3], rowH[11], 'center', '36px ' + fFamily);
    drawCellText('）', colX[5], rowY[11], 50, rowH[11], 'left', '32px ' + fFamily);
    drawCellText(payload.carAddress || '', colX[2], rowY[12], colX[10] - colX[2], rowH[12], 'left');

    drawCellText('氏　　名', colX[1], rowY[13], colX[2] - colX[1], rowH[13]);
    drawCellText(payload.applicantName || '', colX[2], rowY[13], colX[10] - colX[2], rowH[13], 'left');

    drawCellText('配　置　図', colX[0], rowY[14], colX[2] - colX[0], rowH[14]);
    drawCellText('有', colX[2], rowY[14], colX[4] - colX[2], rowH[14]);
    drawCellText('配置図作成', colX[5], rowY[14], colX[7] - colX[5], rowH[14]);
    drawCellText('現地調査', colX[8], rowY[14], colX[10] - colX[8], rowH[14]);

    drawCellText('所　在　図', colX[0], rowY[15], colX[2] - colX[0], rowH[15] + rowH[16]);
    drawCellText('有', colX[2], rowY[15], colX[4] - colX[2], rowH[15] + rowH[16]);
    drawCellText('所在図作成', colX[5], rowY[15], colX[7] - colX[5], rowH[15] + rowH[16]);
    drawCellText('現地調査', colX[8], rowY[15], colX[10] - colX[8], rowH[15] + rowH[16]);

    drawCellText('承諾書（自認書）', colX[0], rowY[17], colX[2] - colX[0], rowH[17]);
    drawCellText('有', colX[2], rowY[17], colX[4] - colX[2], rowH[17]);
    drawCellText('不備あるものは承諾書に追記いただきました', colX[5], rowY[17], colX[7] - colX[5], rowH[17], 'center', '26px ' + fFamily);
    drawCellText('承諾書取得', colX[8], rowY[17], colX[10] - colX[8], rowH[17]);

    // 7. 右下注記・担当枠（行15〜行18、K列〜L列）
    line(colX[10], rowY[14], colX[12], rowY[14], 4);
    line(colX[10], rowY[15], colX[12], rowY[15], 4);
    line(colX[10], rowY[14], colX[10], rowY[18], 4);
    line(colX[12], rowY[14], colX[12], rowY[18], 4);
    line(colX[10], rowY[18], colX[12], rowY[18], 4);
    drawCellText('※標章交付の際には下記へ記入の上ご依頼下さい。', colX[10], rowY[14], colX[12] - colX[10], rowH[14], 'left', '30px ' + fFamily);

    line(colX[11], rowY[15], colX[11], rowY[18], 4);
    line(colX[10], rowY[16], colX[12], rowY[16], 4);
    drawCellText('作成担当', colX[10], rowY[15], colX[11] - colX[10], rowH[15], 'center', '32px ' + fFamily);
    drawCellText('標章交付番号（警察内管理番号）', colX[11], rowY[15], colX[12] - colX[11], rowH[15], 'center', '32px ' + fFamily);
    drawCellText(payload.staffName || '田中', colX[10], rowY[16], colX[11] - colX[10], rowH[16] + rowH[17], 'center', '36px ' + fFamily);

    // 8. 事務所情報
    ctx.textAlign = 'right';
    ctx.font = '36px ' + fFamily;
    ctx.fillText('行政書士法人　フェリス', colX[12], rowY[19] + rowH[19] * 0.7);
    ctx.fillText('TEL　０５８６－５０－２８９６', colX[12], rowY[20] + rowH[20] * 0.7);
    ctx.fillText('FAX　０５８６－８７－６６８７', colX[12], rowY[21] + rowH[21] * 0.7);

    return canvas;
  },

  // 3-B. 書類確認書（原本Excel完全再現）のPDF Blob生成
  async generateConfirmationPdfBlob(payload) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDFLibライブラリが読み込まれていません');
    }
    const { PDFDocument } = PDFLib;
    const canvas = this.renderConfirmationCanvas(payload);
    const dataUrl = canvas.toDataURL('image/png');
    const pngBytes = this._dataUrlToUint8Array(dataUrl);

    const doc = await PDFDocument.create();
    const page = doc.addPage([841.89, 595.28]); // A4 Landscape
    const embeddedImg = await doc.embedPng(pngBytes);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 841.89,
      height: 595.28
    });

    const pdfBytes = await doc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  },

  // 3-C. 完全フルパックPDF（1P:確認書 + 2P:所在図 + 3P:配置図 + 4P:FAX添付耳削除）の生成
  async generateFullPackPdfBlob(payload, options = {}) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('PDFLibライブラリが読み込まれていません');
    }
    const { PDFDocument } = PDFLib;
    const targetDoc = await PDFDocument.create();

    // ─── 1ページ目: 書類確認書（表紙） ───
    const kakuninCanvas = this.renderConfirmationCanvas(payload);
    const kakuninBytes = this._dataUrlToUint8Array(kakuninCanvas.toDataURL('image/png'));
    const kakuninImg = await targetDoc.embedPng(kakuninBytes);
    const p1 = targetDoc.addPage([841.89, 595.28]);
    p1.drawImage(kakuninImg, { x: 0, y: 0, width: 841.89, height: 595.28 });

    // ─── 2ページ目: 所在図 ＆ 3ページ目: 配置図 ───
    const mapPdfBlob = await this.generatePdfBlob(payload);
    const mapPdfBytes = await mapPdfBlob.arrayBuffer();
    const mapDoc = await PDFDocument.load(mapPdfBytes);
    const mapPageCount = mapDoc.getPageCount();
    for (let i = 0; i < mapPageCount; i++) {
      const [cp] = await targetDoc.copyPages(mapDoc, [i]);
      targetDoc.addPage(cp);
    }

    // ─── 4ページ目: FAX添付書類（指定ページ・耳削除済み） ───
    if (options.includeFax !== false) {
      const faxSource = options.customFaxSource || this._getCaseFaxSource(payload, options.faxPageIndex || 0);
      if (faxSource) {
        await this._embedFaxPage(targetDoc, faxSource, options);
      }
    }

    const fullBytes = await targetDoc.save();
    return new Blob([fullBytes], { type: 'application/pdf' });
  },

  _getCaseFaxSource(payload, pageIndex = 0) {
    if (payload.attachments && payload.attachments.length > 0) {
      return payload.attachments[pageIndex] || payload.attachments[0];
    }
    if (!payload.caseId) return null;
    const c = typeof Store !== 'undefined' ? Store.getCase(payload.caseId) : null;
    if (!c || !c.attachments || c.attachments.length === 0) return null;
    return c.attachments[pageIndex] || c.attachments[0];
  },

  async _embedFaxPage(targetDoc, faxSource, options = {}) {
    const { rgb } = PDFLib;
    const eraseEar = options.eraseEar !== false;
    const earPercent = parseFloat(options.earWidthPercent) || 0.02; // デフォルト2.0%

    // 1. PDFの場合
    const isPdf = (faxSource.file && faxSource.file.type === 'application/pdf') ||
                  (faxSource.name && faxSource.name.match(/\.pdf$/i)) ||
                  (faxSource.url && faxSource.url.match(/\.pdf(\?|$)/i)) ||
                  (faxSource.dataUrl && faxSource.dataUrl.startsWith('data:application/pdf'));

    if (isPdf) {
      try {
        let pdfBytes = null;
        if (faxSource.file) {
          pdfBytes = await faxSource.file.arrayBuffer();
        } else if (faxSource.dataUrl) {
          pdfBytes = this._dataUrlToUint8Array(faxSource.dataUrl);
        } else if (faxSource.url) {
          pdfBytes = await fetch(faxSource.url).then(r => r.arrayBuffer());
        }
        if (pdfBytes) {
          const srcDoc = await PDFLib.PDFDocument.load(pdfBytes);
          const total = srcDoc.getPageCount();
          const pIdx = Math.min(Math.max(0, options.faxPageIndex || 0), total - 1);
          const [copiedPage] = await targetDoc.copyPages(srcDoc, [pIdx]);
          targetDoc.addPage(copiedPage);

          if (eraseEar) {
            const { width, height } = copiedPage.getSize();
            copiedPage.drawRectangle({
              x: 0,
              y: 0,
              width: width * earPercent,
              height: height,
              color: rgb(1, 1, 1)
            });
          }
          return;
        }
      } catch (err) {
        console.warn('_embedFaxPage PDF embedding error:', err);
      }
    }

    // 2. 画像（DataURL / TIFF / JPEG / PNG）の場合
    let dataUrl = faxSource.dataUrl || (typeof faxSource === 'string' && faxSource.startsWith('data:') ? faxSource : null);
    if (!dataUrl && faxSource.url) {
      dataUrl = faxSource.url;
    } else if (!dataUrl && faxSource.file) {
      dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(faxSource.file);
      });
    }

    if (dataUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = dataUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        if (img.width && img.height) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // 左端FAX耳白消し
          if (eraseEar) {
            ctx.fillStyle = '#FFFFFF';
            const earW = Math.round(canvas.width * earPercent);
            ctx.fillRect(0, 0, earW, canvas.height);
          }

          const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.94);
          const imgBytes = this._dataUrlToUint8Array(cleanDataUrl);
          const embeddedImg = await targetDoc.embedJpg(imgBytes);

          // 縦横判定（A4 縦 or 横）
          const isLandscape = img.width > img.height;
          const pageW = isLandscape ? 841.89 : 595.28;
          const pageH = isLandscape ? 595.28 : 841.89;

          const newPage = targetDoc.addPage([pageW, pageH]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: pageW,
            height: pageH
          });
        }
      } catch (err) {
        console.warn('_embedFaxPage image embedding error:', err);
      }
    }
  },

  // 3-D. Excel 書類確認書の生成（Blob） - 原本Excelの書式・罫線・フォント・行高・印刷設定を100%完全保持
  async generateExcelBlob(payload) {
    if (typeof ExcelJS !== 'undefined') {
      const resp = await fetch(this.TPL_EXCEL);
      const ab = await resp.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);

      // サンプルと完全一致の「編集」シートを取得
      const ws = workbook.getWorksheet('編集') || workbook.worksheets[0];

      // 1. 店舗名（F3セルに「御中」が固定配置されているため、店舗名のみ設定）
      const cleanDealer = (payload.dealerName || '').replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '').replace(/[\s\u3000]*御中\s*$/, '').trim();
      if (cleanDealer) ws.getCell('A3').value = cleanDealer;

      // 2. 令和日付（サンプル準拠: 令　和　X　年　X　月X日　）
      const now = new Date();
      const reiwaYear = now.getFullYear() - 2018;
      const dateStr = `令　和　${reiwaYear}　年　${now.getMonth() + 1}　月${now.getDate()}日　`;
      ws.getCell('A7').value = dateStr;

      // 3. 注文書番号
      if (payload.orderNo) ws.getCell('F9').value = payload.orderNo;

      // 4. 担当者名（J9セルに「様」があるため名前のみ）
      if (payload.contactName) {
        ws.getCell('I9').value = payload.contactName.replace(/様$/, '').trim();
      }

      // 5. 使用の本拠の位置・保管場所
      ws.getCell('D10').value = '申請者に同じ';
      if (payload.parkingAddress) ws.getCell('D11').value = payload.parkingAddress;

      // 6. 郵便番号
      const rawZip = String(payload.zip || '').replace(/[^0-9]/g, '');
      if (rawZip) {
        ws.getCell('D12').value = Number(rawZip) || rawZip;
      }

      // 7. 申請者住所 & 氏名
      if (payload.carAddress) ws.getCell('D13').value = payload.carAddress;
      if (payload.applicantName) ws.getCell('D14').value = payload.applicantName;

      // 8. 作成担当者
      if (payload.staffName) ws.getCell('K17').value = payload.staffName;

      // 「編集」シートを開いた際のアクティブ表示に設定
      const activeIdx = workbook.worksheets.findIndex(w => w.name === ws.name);
      workbook.views = [
        {
          x: 0, y: 0, width: 10000, height: 20000,
          firstSheet: 0, activeTab: activeIdx >= 0 ? activeIdx : 0, visibility: 'visible'
        }
      ];

      const outBuffer = await workbook.xlsx.writeBuffer();
      return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // フォールバック（万が一ExcelJS未ロード時のSheetJS）
    if (typeof XLSX !== 'undefined') {
      const resp = await fetch(this.TPL_EXCEL);
      const ab = await resp.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const wsName = wb.SheetNames.includes('編集') ? '編集' : wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const setCell = (cellRef, val) => {
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].v = val;
        ws[cellRef].t = typeof val === 'number' ? 'n' : 's';
      };
      const cleanDealer = (payload.dealerName || '').replace(/[\s\u3000]*御中\s*$/, '').trim();
      setCell('A3', cleanDealer);
      const now = new Date();
      const reiwaYear = now.getFullYear() - 2018;
      const dateStr = `令　和　${reiwaYear}　年　${now.getMonth() + 1}　月${now.getDate()}日　`;
      setCell('A7', dateStr);
      setCell('F9', payload.orderNo || '');
      setCell('I9', (payload.contactName || '').replace(/様$/, '').trim());
      setCell('D10', '申請者に同じ');
      setCell('D11', payload.parkingAddress || '同上');
      const rawZip = String(payload.zip || '').replace(/[^0-9]/g, '');
      if (rawZip) setCell('D12', Number(rawZip) || rawZip);
      setCell('D13', payload.carAddress || '');
      setCell('D14', payload.applicantName || '');
      setCell('K17', payload.staffName || '田中');
      const outBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([outBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    throw new Error('Excel生成ライブラリ（ExcelJS）が読み込まれていません');
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

    // Embed Dealer Info overlay (Dealer name only, no phone) - 原本公式フォントサイズ（8pt）に完全適正化
    try {
      const dealerPng = this._renderDealerInfoPng(payload.dealerName, payload.dealerTel);
      if (dealerPng) {
        const dealerImg = await targetDoc.embedPng(this._dataUrlToUint8Array(dealerPng));
        haichiPage.drawImage(dealerImg, {
          x: 576.0,
          y: 57.5,
          width: 205.0,
          height: 12.0
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

  // Helper: 店舗名のみの鮮明画像生成（原本公式サイズ8pt準拠、電話番号なし）
  _renderDealerInfoPng(dealerName, dealerTel) {
    const scale = 3;
    const w = 205 * scale;
    const h = 12 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 原本マスターの「連絡先」や「備考」のフォント（明朝体）に完全一致させる
    ctx.font = '8.5pt "MS Mincho", "ＭＳ 明朝", "Yu Mincho", "游明朝", "Hiragino Mincho ProN", serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';

    // 元の配置図の仕様に合わせ、電話番号は完全除去して店舗名のみ描画
    const cleanName = (dealerName || '')
      .replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '')
      .replace(/[\s\u3000]*御中\s*$/, '')
      .trim();

    ctx.fillText(cleanName, 2, 6.0);

    return canvas.toDataURL('image/png');
  },

  // Helper: 登録番号（車番・増車）の鮮明画像生成（原本公式サイズ9pt bold準拠・中央揃え）
  _renderRegNoPng(regNo) {
    const scale = 3;
    const w = 146 * scale;
    const h = 14 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.font = 'bold 9.5pt "MS Gothic", "Meiryo", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let disp = String(regNo || '増　　　車').trim();
    if (disp === '増車') disp = '増　　　車';

    ctx.fillText(disp, 146 / 2, 7.0);

    return canvas.toDataURL('image/png');
  },

  // 5. ダウンロード実行
  async generateAndDownload(caseId, type, options = {}) {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    try {
      App.showToast('⏳ 書類を生成中...');
      const cleanApplicant = payload.applicantName.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);

      if (type === 'fullpack') {
        const blob = await this.generateFullPackPdfBlob(payload, options);
        const fileName = `【${payload.orderNo}】${cleanApplicant}_完全フルパック.pdf`;
        this._downloadBlob(blob, fileName);
        App.showToast(`✅ 「${fileName}」をダウンロードしました（確認書＋地図＋FAX耳消し）`);
      } else if (type === 'kakunin_pdf') {
        const blob = await this.generateConfirmationPdfBlob(payload);
        const fileName = `書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}_${cleanApplicant}.pdf`;
        this._downloadBlob(blob, fileName);
        App.showToast(`✅ 「${fileName}」をダウンロードしました`);
      } else if (type === 'excel') {
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
  async saveAllToDrive(caseId, options = {}) {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) {
      alert('⚠️ Google スプレッドシート/Drive連携が設定されていません');
      return;
    }

    App.showToast('☁️ Google Drive案件フォルダへ一括保管中...');
    const cleanApplicant = payload.applicantName.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);

    try {
      // 1. 完全フルパックPDF
      const fullpackBlob = await this.generateFullPackPdfBlob(payload, options);
      const fullpackB64 = await this._blobToBase64(fullpackBlob);
      await SpreadsheetSync.push('saveCaseDocument', {
        caseId: payload.caseId,
        fileName: `【${payload.orderNo}】${cleanApplicant}_完全フルパック.pdf`,
        mimeType: 'application/pdf',
        base64Data: fullpackB64
      });

      // 2. 単体 書類確認書PDF
      const kakuninBlob = await this.generateConfirmationPdfBlob(payload);
      const kakuninB64 = await this._blobToBase64(kakuninBlob);
      await SpreadsheetSync.push('saveCaseDocument', {
        caseId: payload.caseId,
        fileName: `書類確認書（OSS）_${payload.dealerName.replace(/\s+/g, '_')}_${payload.orderNo}.pdf`,
        mimeType: 'application/pdf',
        base64Data: kakuninB64
      });

      // 3. 所在図配置図PDF
      const pdfBlob = await this.generatePdfBlob(payload);
      const pdfB64 = await this._blobToBase64(pdfBlob);
      await SpreadsheetSync.push('saveCaseDocument', {
        caseId: payload.caseId,
        fileName: `【${payload.orderNo}】${cleanApplicant}_所在図配置図.pdf`,
        mimeType: 'application/pdf',
        base64Data: pdfB64
      });

      App.showToast('✅ Google DriveへフルパックPDFおよび各書類を保存しました！');
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

  // Helper: DocuWorks(.xdw)取込用ファイルのダウンロードと案内
  async generateXdwViaPython(payload) {
    try {
      const blob = await this.generatePdfBlob(payload);
      const cleanApplicant = (payload.applicantName || '申請者').replace(/[\/\\:*?"<>|]/g, '_').slice(0, 20);
      const fileName = `【${payload.orderNo}】${cleanApplicant}_所在図配置図_DW取込用.pdf`;
      this._downloadBlob(blob, fileName);
      alert(`【DocuWorks取込用ファイルをダウンロードしました】\n\nファイル名: 「${fileName}」\n\n💡 DocuWorks (.xdw) への変換方法:\nダウンロードしたファイルを【DocuWorks Desk】の画面上にそのままマウスでドラッグ＆ドロップしてください。\nDocuWorksが自動で一瞬で「.xdw」形式に変換してデスクに取り込みます！`);
    } catch(e) {
      alert('DocuWorks用ファイルの生成に失敗しました: ' + e.message);
    }
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
