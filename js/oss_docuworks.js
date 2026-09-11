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
    const rawStaff = Store.getStaffName(c.staffId);
    const staffName = (!rawStaff || rawStaff === '—' || rawStaff === '田中') ? '吉村' : rawStaff;

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

    // 地図画像（PNGデータURL：案件ID・注文書番号の双方から確実に検索）
    let sozaiMapPng = localStorage.getItem('gyosei_case_sozai_png_' + caseId) || '';
    if (!sozaiMapPng && orderNo) sozaiMapPng = localStorage.getItem('gyosei_case_sozai_png_' + orderNo) || '';
    if (!sozaiMapPng && c.id && c.id !== caseId) sozaiMapPng = localStorage.getItem('gyosei_case_sozai_png_' + c.id) || '';

    let haichiMapPng = localStorage.getItem('gyosei_case_haichi_png_' + caseId) || localStorage.getItem('gyosei_case_map_png_' + caseId) || '';
    if (!haichiMapPng && orderNo) haichiMapPng = localStorage.getItem('gyosei_case_haichi_png_' + orderNo) || localStorage.getItem('gyosei_case_map_png_' + orderNo) || '';
    if (!haichiMapPng && c.id && c.id !== caseId) haichiMapPng = localStorage.getItem('gyosei_case_haichi_png_' + c.id) || localStorage.getItem('gyosei_case_map_png_' + c.id) || '';

    const hasMapData = !!(sozaiMapPng || haichiMapPng || localStorage.getItem('syako_case_map_' + caseId) || (orderNo && localStorage.getItem('syako_case_map_' + orderNo)));
    const mapPng = haichiMapPng;

    // 添付原本ファイル（案件の c.docs および c.inboxId から正規に抽出）
    let attachments = [];
    if (Array.isArray(c.docs) && c.docs.length > 0) {
      attachments = c.docs.map(d => ({
        name: d.name || '添付書類',
        url: d.driveUrl || d.url || '',
        dataUrl: d.dataUrl || '',
        mimeType: d.mimeType || ''
      }));
    }

    if (attachments.length === 0 && c.inboxId && typeof Store !== 'undefined' && typeof Store.getInbox === 'function') {
      const inb = Store.getInbox().find(i => String(i.id) === String(c.inboxId));
      if (inb && Array.isArray(inb.attachments)) {
        attachments = inb.attachments.map(a => ({
          name: a.name || '受信原本',
          url: a.url || a.driveUrl || '',
          dataUrl: a.dataUrl || '',
          mimeType: a.mimeType || ''
        }));
      }
    }

    // フォールバック（安全上限10件で不要な全インボックス混入を完全防止）
    if (attachments.length === 0 && Array.isArray(c.attachments) && c.attachments.length > 0) {
      attachments = c.attachments.slice(0, 10).map(a => ({
        name: a.name || '添付原本',
        url: a.url || a.driveUrl || '',
        dataUrl: a.dataUrl || '',
        mimeType: a.mimeType || ''
      }));
    }

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
      sozaiMapPng,
      haichiMapPng,
      hasMapData,
      attachments,
      driveFolderUrl: c.driveFolderUrl || ''
    };
  },

  // 3-A. 書類確認書（原本Excel完全再現）のCanvas描画（300DPI超高精細・大判レイアウト＆チェックボックス・アンダーバー完全一致）
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

    const scaleX = W / 1024;
    const scaleY = H / 721;

    const fFamily = '"MS PGothic", "ＭＳ Ｐゴシック", "Yu Gothic", "Meiryo", sans-serif';

    // 座標（サンプル原本と完全一致）
    const x0 = Math.round(85 * scaleX);
    const x1 = Math.round(122 * scaleX);
    const x2 = Math.round(227 * scaleX);
    const x3 = Math.round(276 * scaleX);
    const x4 = Math.round(314 * scaleX);
    const x5 = Math.round(477 * scaleX);
    const x6 = Math.round(515 * scaleX);
    const x7 = Math.round(697 * scaleX);
    const x8 = Math.round(758 * scaleX);
    const x9 = Math.round(963 * scaleX);

    const x_order_start = x2;
    const x_order_end = Math.round(450 * scaleX);
    const x_staff_label_end = Math.round(512 * scaleX);
    const x_staff_name_end = Math.round(631 * scaleX);
    const x_sama_end = x7;

    const y_title = Math.round(64 * scaleY);
    const y_msg_top = Math.round(78 * scaleY);
    const y_dealer = Math.round(135 * scaleY);
    const y_greeting1 = Math.round(180 * scaleY);
    const y_greeting2 = Math.round(210 * scaleY);
    const y_date = Math.round(245 * scaleY);

    const y_r9 = Math.round(284 * scaleY);
    const y_r10 = Math.round(319 * scaleY);
    const y_r11 = Math.round(354 * scaleY);
    const y_r12 = Math.round(389 * scaleY);
    const y_r13 = Math.round(425 * scaleY);
    const y_r14 = Math.round(461 * scaleY);
    const y_r15 = Math.round(496 * scaleY);
    const y_r16 = Math.round(531 * scaleY);
    const y_r16_sub = Math.round(548 * scaleY);
    const y_r17 = Math.round(566 * scaleY);
    const y_r18 = Math.round(601 * scaleY);

    const y_office1 = Math.round(635 * scaleY);
    const y_office2 = Math.round(658 * scaleY);
    const y_office3 = Math.round(680 * scaleY);

    // 罫線描画ヘルパー
    const line = (x1, y1, x2, y2, width = 4, dashed = false) => {
      ctx.save();
      ctx.lineWidth = width;
      ctx.strokeStyle = '#000000';
      if (dashed) ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    // セル文字列描画ヘルパー
    const drawCellText = (text, x, y, w, h, align = 'center', font = '38px ' + fFamily, bold = false) => {
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
        ctx.fillText(String(text), x + 24, y + h / 2);
      } else if (align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(String(text), x + w - 24, y + h / 2);
      }
      ctx.restore();
    };

    // チェックボックス描画ヘルパー
    const drawCheckbox = (cx, cy, size = 44, checked = false) => {
      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      if (checked) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.30, cy);
        ctx.lineTo(cx - size * 0.05, cy + size * 0.32);
        ctx.lineTo(cx + size * 0.35, cy - size * 0.30);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#000000';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();
    };

    // 1. タイトル（原本サンプルの大判・太字・バランス正立配置）
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 88px ' + fFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OSS申請　書類確認書（車庫証明）', Math.round(495 * scaleX), y_title);

    // 2. 店舗名（アンダーバー付き） + 御中
    let cleanDealer = (payload.dealerName || '').replace(/(?:TEL|℡|Tel)?\s*[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}.*$/i, '').replace(/[\s\u3000]*御中\s*$/, '').trim() || '愛知トヨタ小牧南インター店';
    cleanDealer = cleanDealer.replace(/\s+/g, '');

    ctx.font = 'bold 68px ' + fFamily;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanDealer, x0, y_dealer);

    const dealerW = ctx.measureText(cleanDealer).width;
    // 顧客（店舗名）の下にアンダーバー
    line(x0, y_dealer + 40, x0 + dealerW, y_dealer + 40, 5);

    // 御中
    ctx.font = '62px ' + fFamily;
    ctx.fillText('御中', x0 + dealerW + Math.round(28 * scaleX), y_dealer);

    // 3. ご案内文（原本サンプル同様、表の右端までしっかり届く大判フォント）
    ctx.font = '50px ' + fFamily;
    ctx.fillText('ご依頼のありました車庫証明関係書類を下記の通り確認させて頂きましたのでご査収下さい。', x0, y_greeting1);
    ctx.fillText('なお、不備のある書類につきましては、担当者と連絡を取り補正等の対応を致しました。', x0, y_greeting2);

    // 4. 日付（令　　和　　X　　年　　X　　月　　X　　日：原本通りのワイドスペースと視認性）
    let dateStr = payload.dateStr;
    if (!dateStr) {
      const now = new Date();
      const reiwaYear = now.getFullYear() - 2018;
      dateStr = `令　　和　　${reiwaYear}　　年　　${now.getMonth() + 1}　　月　　${now.getDate()}　　日`;
    } else {
      const m = dateStr.match(/令[\s\u3000]*和[\s\u3000]*([0-9０-９]+)[\s\u3000]*年[\s\u3000]*([0-9０-９]+)[\s\u3000]*月[\s\u3000]*([0-9０-９]+)[\s\u3000]*日/);
      if (m) {
        dateStr = `令　　和　　${m[1]}　　年　　${m[2]}　　月　　${m[3]}　　日`;
      }
    }
    ctx.font = '48px ' + fFamily;
    ctx.fillText(dateStr, x0, y_date);

    // 5. 連絡事項・メッセージ枠（右上〜中央右）
    line(x7, y_msg_top, x9, y_msg_top, 7);
    line(x7, y_r15, x9, y_r15, 7);
    line(x7, y_msg_top, x7, y_r15, 7);
    line(x9, y_msg_top, x9, y_r15, 7);
    drawCellText('連絡事項・メッセージ', x7, y_msg_top + 16, x9 - x7, 50, 'center', '46px ' + fFamily, false);

    // 6. メイン確認表（外枠）
    line(x0, y_r9, x7, y_r9, 7);
    line(x0, y_r18, x7, y_r18, 7);
    line(x0, y_r9, x0, y_r18, 7);
    line(x7, y_r9, x7, y_r18, 7);

    // 横罫線
    line(x0, y_r10, x7, y_r10, 7);
    line(x0, y_r11, x7, y_r11, 7);
    line(x0, y_r12, x7, y_r12, 7);
    line(x2, y_r13, x7, y_r13, 3, true); // 〒の下（破線）
    line(x1, y_r14, x7, y_r14, 4);       // 住所と氏名の間（実線）
    line(x0, y_r15, x7, y_r15, 7);       // 配置図の上
    line(x0, y_r16, x7, y_r16, 4);       // 所在図の上
    line(x0, y_r17, x7, y_r17, 4);       // 承諾書の上

    // 縦罫線
    line(x2, y_r9, x2, y_r12, 7);        // 注文書〜保管場所の項目境界
    line(x1, y_r12, x1, y_r15, 4);       // 申請者 と 住所/氏名の間
    line(x2, y_r12, x2, y_r15, 7);       // 住所/氏名 と 内容の間
    line(x2, y_r15, x2, y_r18, 7);       // 図面名称 と 有の間

    // 注文書番号 行の区切り線
    line(x_order_end, y_r9, x_order_end, y_r10, 4);
    line(x_staff_label_end, y_r9, x_staff_label_end, y_r10, 4);
    line(x_staff_name_end, y_r9, x_staff_name_end, y_r10, 4);

    // 配置図・所在図・承諾書の各列の区切り線（有 | [✓] | 作成 | [ ] | 調査）
    line(x3, y_r15, x3, y_r18, 4);
    line(x4, y_r15, x4, y_r18, 4);
    line(x5, y_r15, x5, y_r18, 4);
    line(x6, y_r15, x6, y_r18, 4);

    // 7. 右下注記・担当枠（行15〜行18、K列〜L列）
    line(x7, y_r15, x9, y_r15, 7);
    line(x7, y_r16, x9, y_r16, 7);
    line(x7, y_r16_sub, x9, y_r16_sub, 7);
    line(x7, y_r18, x9, y_r18, 7);
    line(x7, y_r15, x7, y_r18, 7);
    line(x9, y_r15, x9, y_r18, 7);
    line(x8, y_r16, x8, y_r18, 7);

    // セル内容描画
    // 注文書番号
    drawCellText('注文書番号', x0, y_r9, x2 - x0, y_r10 - y_r9, 'center', '38px ' + fFamily, false);
    const spacedOrderNo = String(payload.orderNo || '58280').replace(/\s+/g, '').split('').join('  ');
    drawCellText(spacedOrderNo, x_order_start, y_r9, x_order_end - x_order_start, y_r10 - y_r9, 'center', '40px ' + fFamily, false);
    drawCellText('担当者', x_order_end, y_r9, x_staff_label_end - x_order_end, y_r10 - y_r9, 'center', '38px ' + fFamily, false);
    const contactName = (payload.contactName || '藤原').replace(/様$/, '').trim();
    drawCellText(contactName, x_staff_label_end, y_r9, x_staff_name_end - x_staff_label_end, y_r10 - y_r9, 'center', '40px ' + fFamily, false);
    drawCellText('様', x_staff_name_end, y_r9, x_sama_end - x_staff_name_end, y_r10 - y_r9, 'center', '38px ' + fFamily, false);

    // 使用の本拠の位置（[✓] 申請者に同じ）
    drawCellText('使用の本拠の位置', x0, y_r10, x2 - x0, y_r11 - y_r10, 'center', '38px ' + fFamily, false);
    drawCheckbox(x2 + 50, (y_r10 + y_r11) / 2, 44, true);
    ctx.font = '40px ' + fFamily;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText('申請者に同じ', x2 + 85, (y_r10 + y_r11) / 2);

    // 保管場所の位置（[✓] 同上）
    drawCellText('保管場所の位置', x0, y_r11, x2 - x0, y_r12 - y_r11, 'center', '38px ' + fFamily, false);
    drawCheckbox(x2 + 50, (y_r11 + y_r12) / 2, 44, true);
    ctx.font = '40px ' + fFamily;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(payload.parkingAddress || '同上', x2 + 85, (y_r11 + y_r12) / 2);

    // 申請者（縦書き 申 請 者）
    const y_app_mid = (y_r12 + y_r15) / 2;
    ctx.font = '38px ' + fFamily;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('申', (x0 + x1) / 2, y_app_mid - 80);
    ctx.fillText('請', (x0 + x1) / 2, y_app_mid);
    ctx.fillText('者', (x0 + x1) / 2, y_app_mid + 80);

    // 住所
    drawCellText('住　　所', x1, y_r12, x2 - x1, y_r14 - y_r12, 'center', '38px ' + fFamily, false);
    const cleanZip = (payload.zip || '480-0103').replace(/[^0-9-]/g, '');
    ctx.font = '38px ' + fFamily;
    ctx.textAlign = 'left';
    ctx.fillText(`〒 (  ${cleanZip}  )`, x2 + 30, (y_r12 + y_r13) / 2);
    ctx.fillText(payload.carAddress || '', x2 + 80, (y_r13 + y_r14) / 2);

    // 氏名
    drawCellText('氏　　名', x1, y_r14, x2 - x1, y_r15 - y_r14, 'center', '38px ' + fFamily, false);
    ctx.font = '40px ' + fFamily;
    ctx.fillText(payload.applicantName || '', x2 + 80, (y_r14 + y_r15) / 2);

    // 配置図 行
    drawCellText('配　置　図', x0, y_r15, x2 - x0, y_r16 - y_r15, 'center', '38px ' + fFamily, false);
    drawCellText('有', x2, y_r15, x3 - x2, y_r16 - y_r15, 'center', '38px ' + fFamily, false);
    drawCheckbox((x3 + x4) / 2, (y_r15 + y_r16) / 2, 44, true);
    drawCellText('配置図作成', x4, y_r15, x5 - x4, y_r16 - y_r15, 'center', '38px ' + fFamily, false);
    drawCheckbox((x5 + x6) / 2, (y_r15 + y_r16) / 2, 44, false);
    drawCellText('現地調査', x6, y_r15, x7 - x6, y_r16 - y_r15, 'center', '38px ' + fFamily, false);

    // 所在図 行
    drawCellText('所　在　図', x0, y_r16, x2 - x0, y_r17 - y_r16, 'center', '38px ' + fFamily, false);
    drawCellText('有', x2, y_r16, x3 - x2, y_r17 - y_r16, 'center', '38px ' + fFamily, false);
    drawCheckbox((x3 + x4) / 2, (y_r16 + y_r17) / 2, 44, true);
    drawCellText('所在図作成', x4, y_r16, x5 - x4, y_r17 - y_r16, 'center', '38px ' + fFamily, false);
    drawCheckbox((x5 + x6) / 2, (y_r16 + y_r17) / 2, 44, false);
    drawCellText('現地調査', x6, y_r16, x7 - x6, y_r17 - y_r16, 'center', '38px ' + fFamily, false);

    // 承諾書 行
    drawCellText('承諾書（自認書）', x0, y_r17, x2 - x0, y_r18 - y_r17, 'center', '36px ' + fFamily, false);
    drawCellText('有', x2, y_r17, x3 - x2, y_r18 - y_r17, 'center', '38px ' + fFamily, false);
    drawCheckbox((x3 + x4) / 2, (y_r17 + y_r18) / 2, 44, false);
    ctx.font = '28px ' + fFamily;
    ctx.textAlign = 'center';
    ctx.fillText('不備あるものは', (x4 + x5) / 2, (y_r17 + y_r18) / 2 - 18);
    ctx.fillText('承諾書に追記いただきました', (x4 + x5) / 2, (y_r17 + y_r18) / 2 + 18);
    drawCheckbox((x5 + x6) / 2, (y_r17 + y_r18) / 2, 44, false);
    drawCellText('承諾書取得', x6, y_r17, x7 - x6, y_r18 - y_r17, 'center', '38px ' + fFamily, false);

    // 右下注記・担当枠
    drawCellText('※標章交付の際には下記へ記入の上ご依頼下さい。', x7 + 5, y_r15, x9 - x7, y_r16 - y_r15, 'left', '32px ' + fFamily, false);
    drawCellText('作成担当', x7, y_r16, x8 - x7, y_r16_sub - y_r16, 'center', '32px ' + fFamily, false);
    drawCellText('標章交付番号（警察内管理番号）', x8, y_r16, x9 - x8, y_r16_sub - y_r16, 'center', '32px ' + fFamily, false);
    let displayStaff = payload.staffName;
    if (!displayStaff || displayStaff === '—' || displayStaff === '田中') {
      displayStaff = '吉村';
    }
    drawCellText(displayStaff, x7, y_r16_sub, x8 - x7, y_r18 - y_r16_sub, 'center', '44px ' + fFamily, false);

    // 8. 事務所情報
    ctx.textAlign = 'right';
    ctx.font = 'bold 42px ' + fFamily;
    ctx.fillText('行政書士法人　フェリス', x9, y_office1);
    ctx.font = '38px ' + fFamily;
    ctx.fillText('TEL  0586-50-2896', x9, y_office2);
    ctx.fillText('FAX  0586-87-6687', x9, y_office3);

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
    const faxOrientation = options.faxOrientation || 'landscape'; // 'landscape' (A4横統一・デフォルト) または 'portrait' (縦・正立270°)

    try {
      const resolved = await this._resolveFaxSourceData(faxSource, options.faxPageIndex || 0, options);
      if (!resolved) {
        console.warn('Could not resolve faxSource data:', faxSource);
        return;
      }

      // 1. PDFの場合
      if (resolved.type === 'pdf') {
        const srcDoc = await PDFLib.PDFDocument.load(resolved.bytes);
        const total = srcDoc.getPageCount();
        const pIdx = Math.min(Math.max(0, options.faxPageIndex || 0), total - 1);
        const [copiedPage] = await targetDoc.copyPages(srcDoc, [pIdx]);

        // 縦横判定と回転制御
        const origSize = copiedPage.getSize();
        if (faxOrientation === 'landscape' && origSize.width < origSize.height) {
          // 縦型PDFをA4横にする場合は90度回転
          copiedPage.setRotation(PDFLib.degrees(copiedPage.getRotation().angle + 90));
        }
        targetDoc.addPage(copiedPage);

        if (eraseEar) {
          const { width, height } = copiedPage.getSize();
          // 横向きなら上端、縦向きなら左端を白消し
          if (faxOrientation === 'landscape') {
            // PDF座標系は左下が原点(0,0)。上端は y: height * (1 - earPercent)
            copiedPage.drawRectangle({
              x: 0,
              y: height * (1 - earPercent),
              width: width,
              height: height * earPercent,
              color: rgb(1, 1, 1)
            });
          } else {
            copiedPage.drawRectangle({
              x: 0,
              y: 0,
              width: width * earPercent,
              height: height,
              color: rgb(1, 1, 1)
            });
          }
        }
        return;
      }

      // 2. 画像（JPEG / PNG / TIFF / DataURL）の場合
      if (resolved.type === 'dataUrl' && resolved.dataUrl) {
        const img = new Image();
        if (!resolved.dataUrl.startsWith('data:')) {
          img.crossOrigin = 'anonymous';
        }
        img.src = resolved.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = (e) => {
            console.warn('Image failed to load in _embedFaxPage:', e);
            resolve();
          };
        });

        if (img.width && img.height) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // FAX耳白消し（横向きの場合は上端、縦向きの場合は左端）
          if (eraseEar) {
            ctx.fillStyle = '#FFFFFF';
            if (faxOrientation === 'landscape') {
              const earH = Math.round(canvas.height * earPercent);
              ctx.fillRect(0, 0, canvas.width, earH);
            } else {
              const earW = Math.round(canvas.width * earPercent);
              ctx.fillRect(0, 0, earW, canvas.height);
            }
          }

          const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.94);
          const imgBytes = this._dataUrlToUint8Array(cleanDataUrl);
          const embeddedImg = await targetDoc.embedJpg(imgBytes);

          // 縦横判定（A4 縦 or 横）
          const isLandscape = faxOrientation === 'landscape' || (faxOrientation !== 'portrait' && canvas.width > canvas.height);
          const pageW = isLandscape ? 841.89 : 595.28;
          const pageH = isLandscape ? 595.28 : 841.89;

          const newPage = targetDoc.addPage([pageW, pageH]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: pageW,
            height: pageH
          });
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('_embedFaxPage error:', err);
      return false;
    }
  },

  // Helper: 添付ファイルのバイナリまたはDataURLを確実に取得（Google Drive / TIFF / PDF / 画像に対応）
  async _resolveFaxSourceData(faxSource, pageIndex = 0, options = {}) {
    if (!faxSource) return null;
    const faxOrientation = options.faxOrientation || 'landscape';
    const rotateUpright = faxOrientation === 'portrait';

    // 1. すでに dataUrl がある場合
    if (faxSource.dataUrl) {
      let dUrl = faxSource.dataUrl;
      if (rotateUpright) dUrl = await this._ensureRotatedUprightImage(dUrl);
      return { type: 'dataUrl', dataUrl: dUrl };
    }
    if (typeof faxSource === 'string' && faxSource.startsWith('data:')) {
      let dUrl = faxSource;
      if (rotateUpright) dUrl = await this._ensureRotatedUprightImage(dUrl);
      return { type: 'dataUrl', dataUrl: dUrl };
    }

    // 2. ブラウザの File オブジェクトの場合
    if (faxSource.file instanceof Blob) {
      const isPdf = faxSource.file.type === 'application/pdf' || (faxSource.name && faxSource.name.toLowerCase().endsWith('.pdf'));
      const isTiff = faxSource.file.type.includes('tiff') || (faxSource.name && faxSource.name.match(/\.tiff?$/i));
      if (isPdf) {
        const bytes = await faxSource.file.arrayBuffer();
        return { type: 'pdf', bytes: new Uint8Array(bytes) };
      }
      if (isTiff) {
        const bytes = await faxSource.file.arrayBuffer();
        const dataUrl = await this._convertTiffBytesToDataUrl(bytes, rotateUpright);
        if (dataUrl) return { type: 'dataUrl', dataUrl };
      }
      let dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(faxSource.file);
      });
      if (dataUrl) {
        if (rotateUpright) {
          dataUrl = await this._ensureRotatedUprightImage(dataUrl);
        }
        return { type: 'dataUrl', dataUrl };
      }
    }

    // 3. URL（Google Drive または 通常URL）の場合
    const url = faxSource.url || (typeof faxSource === 'string' ? faxSource : '');
    const fileName = faxSource.name || url;
    const isPdf = fileName.toLowerCase().includes('.pdf');
    const isTiff = fileName.toLowerCase().match(/\.tiff?(\?|$)/i);

    // Google Drive URLの場合、GAS経由でBase64取得
    const driveMatch = url.match(/[-\w]{25,}/);
    let gasUrl = '';
    try {
      const syncConf = JSON.parse(localStorage.getItem('gyosei_sync_config') || '{}');
      gasUrl = syncConf.gasUrl || localStorage.getItem('gyosei_gas_url') || (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.getGasUrl ? SpreadsheetSync.getGasUrl() : '');
    } catch(e) {}

    if (driveMatch && gasUrl) {
      try {
        const fileId = driveMatch[0];
        let postRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'getFileBase64', fileId: fileId, fileUrl: url })
        });
        let data = await postRes.json();
        if ((!data || !data.base64) && gasUrl) {
          const getRes = await fetch(`${gasUrl}?action=getFileBase64&fileId=${fileId}`);
          data = await getRes.json();
        }
        if (data && data.base64) {
          const binStr = atob(data.base64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

          // 1. PDF判定 (%PDF)
          if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
            return { type: 'pdf', bytes };
          }

          // 2. TIFF判定 (II* または MM*)
          if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A) ||
              (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[3] === 0x2A)) {
            const dataUrl = await this._convertTiffBytesToDataUrl(bytes, rotateUpright);
            if (dataUrl) return { type: 'dataUrl', dataUrl };
          }

          // 3. JPEG または 一般画像
          const mime = data.mimeType || 'image/jpeg';
          let imgSrc = data.base64.startsWith('data:') ? data.base64 : `data:${mime};base64,${data.base64}`;
          if (rotateUpright) {
            imgSrc = await this._ensureRotatedUprightImage(imgSrc);
          }
          return { type: 'dataUrl', dataUrl: imgSrc };
        }
      } catch(err) {
        console.warn('Drive getFileBase64 failed in _resolveFaxSourceData:', err);
      }
    }

    // 通常 fetch
    if (url && !url.includes('drive.google.com')) {
      try {
        const res = await fetch(url);
        const ab = await res.arrayBuffer();
        if (isPdf) return { type: 'pdf', bytes: new Uint8Array(ab) };
        if (isTiff) {
          const dataUrl = await this._convertTiffBytesToDataUrl(new Uint8Array(ab), rotateUpright);
          return { type: 'dataUrl', dataUrl };
        }
        const blob = new Blob([ab]);
        let dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(blob);
        });
        if (dataUrl && rotateUpright) {
          dataUrl = await this._ensureRotatedUprightImage(dataUrl);
        }
        return { type: 'dataUrl', dataUrl };
      } catch(e) {
        console.warn('Direct fetch failed in _resolveFaxSourceData:', e);
      }
    }

    return null;
  },

  // Helper: TIFFバイト列をJPEG DataURLに変換（rotateUprightがtrueの時のみ270度正立回転、デフォルトは元向き維持）
  async _convertTiffBytesToDataUrl(bytes, rotateUpright = false) {
    if (typeof UTIF === 'undefined') {
      try {
        await new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = 'js/utif.min.js';
          s.onload = resolve;
          s.onerror = resolve;
          document.head.appendChild(s);
        });
      } catch(e) {
        console.warn('Failed to dynamically load UTIF:', e);
      }
    }

    let dataUrl = null;
    const buffer = bytes.buffer || bytes;

    // 1. UTIF.decode を試行
    if (typeof UTIF !== 'undefined') {
      try {
        const ifds = UTIF.decode(buffer);
        if (ifds && ifds.length > 0) {
          const ifd = ifds[0];
          UTIF.decodeImage(buffer, ifd);
          const rgba = UTIF.toRGBA8(ifd);

          // 正立（縦向き）指定時のみ270度回転。横向き（そのまま）指定時は0度で元向き維持
          const autoAngle = (rotateUpright && ifd.width > ifd.height) ? 270 : 0;
          const origCanvas = document.createElement('canvas');
          origCanvas.width = ifd.width;
          origCanvas.height = ifd.height;
          const oCtx = origCanvas.getContext('2d');
          const imgData = oCtx.createImageData(ifd.width, ifd.height);
          imgData.data.set(rgba);
          oCtx.putImageData(imgData, 0, 0);

          if (autoAngle !== 0) {
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = ifd.height;
            rotCanvas.height = ifd.width;
            const rCtx = rotCanvas.getContext('2d');
            rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            rCtx.rotate((autoAngle * Math.PI) / 180);
            rCtx.drawImage(origCanvas, -origCanvas.width / 2, -origCanvas.height / 2);
            dataUrl = rotCanvas.toDataURL('image/jpeg', 0.94);
          } else {
            dataUrl = origCanvas.toDataURL('image/jpeg', 0.94);
          }
        }
      } catch(decodeErr) {
        console.warn('UTIF.decode error, trying fallback:', decodeErr);
      }
    }

    // 2. フォールバック（UTIF未対応形式やJPEG偽装TIFFなどの場合）
    if (!dataUrl) {
      try {
        const blob = new Blob([bytes]);
        const rawUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (rawUrl) {
          dataUrl = rotateUpright ? await this._ensureRotatedUprightImage(rawUrl) : rawUrl;
        }
      } catch(fbErr) {
        console.warn('Fallback DataURL conversion failed:', fbErr);
      }
    }

    return dataUrl;
  },

  // Helper: 画像が横向き（FAXスキャン特有の横長、naturalWidth > naturalHeight）の場合に270度正立回転させる
  async _ensureRotatedUprightImage(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          if (img.naturalWidth > img.naturalHeight) {
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = img.naturalHeight;
            rotCanvas.height = img.naturalWidth;
            const ctx = rotCanvas.getContext('2d');
            ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            ctx.rotate((270 * Math.PI) / 180);
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            resolve(rotCanvas.toDataURL('image/jpeg', 0.94));
          } else {
            resolve(dataUrl);
          }
        } catch(e) {
          console.warn('_ensureRotatedUprightImage error:', e);
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
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
      const staffVal = (!payload.staffName || payload.staffName === '—' || payload.staffName === '田中') ? '吉村' : payload.staffName;
      ws.getCell('K17').value = staffVal;

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
      const staffValFallback = (!payload.staffName || payload.staffName === '—' || payload.staffName === '田中') ? '吉村' : payload.staffName;
      setCell('K17', staffValFallback);
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

    // Helper to embed either PNG or JPEG safely
    const embedImageSafely = async (doc, bytes) => {
      if (!bytes || bytes.length < 4) return null;
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return await doc.embedPng(bytes);
      }
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        return await doc.embedJpg(bytes);
      }
      try {
        return await doc.embedPng(bytes);
      } catch(e) {
        try {
          return await doc.embedJpg(bytes);
        } catch(e2) {
          console.warn('Failed to embed image:', e2);
          return null;
        }
      }
    };

    // Map image embedding if available (supports separate sozai and haichi maps, or full A4 page captures)
    const sozaiPngSrc = payload.sozaiMapPng || (payload.caseId ? localStorage.getItem('gyosei_case_sozai_png_' + payload.caseId) : '') || '';
    const haichiPngSrc = payload.haichiMapPng || payload.mapPng || (payload.caseId ? (localStorage.getItem('gyosei_case_haichi_png_' + payload.caseId) || localStorage.getItem('gyosei_case_map_png_' + payload.caseId)) : '') || '';

    if (sozaiPngSrc) {
      try {
        const pngBytes = await this._srcToUint8Array(sozaiPngSrc);
        if (pngBytes) {
          const sozaiImg = await embedImageSafely(targetDoc, pngBytes);
          if (sozaiImg) {
            const ratio = sozaiImg.width / sozaiImg.height;
            if (ratio > 1.30 && ratio < 1.55) {
              // A4フルページキャプチャの場合（A4全面に美しく描画）
              sozaiPage.drawImage(sozaiImg, {
                x: 0,
                y: 0,
                width: 841.89,
                height: 595.28
              });
            } else {
              // 所在図描画エリア（マスター原紙の枠線内にぴったり収まるよう微調整：7mm拡大版）
              sozaiPage.drawImage(sozaiImg, {
                x: 61.0,
                y: 41.5,
                width: 720.0,
                height: 434.5
              });
            }
          }
        }
      } catch(e) {
        console.warn('Failed to embed sozai map image:', e);
      }
    }

    if (haichiPngSrc) {
      try {
        const pngBytes = await this._srcToUint8Array(haichiPngSrc);
        if (pngBytes) {
          const haichiImg = await embedImageSafely(targetDoc, pngBytes);
          if (haichiImg) {
            const ratio = haichiImg.width / haichiImg.height;
            if (ratio > 1.30 && ratio < 1.55) {
              // A4フルページキャプチャの場合（A4全面に美しく描画）
              haichiPage.drawImage(haichiImg, {
                x: 0,
                y: 0,
                width: 841.89,
                height: 595.28
              });
            } else {
              // 配置図描画エリア（マスター原紙の枠線内にぴったり収まるよう微調整：7mm拡大版）
              haichiPage.drawImage(haichiImg, {
                x: 61.0,
                y: 74.5,
                width: 720.0,
                height: 405.5
              });
            }
          }
        }
      } catch(e) {
        console.warn('Failed to embed haichi map image:', e);
      }
    }

    // Embed standard HelveticaBold for digits (exact coordinate matching)
    const font = await targetDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const cellW = 20.07;

    // 注文書№ 8桁の印字（所在図・配置図それぞれのセル中心・ベースラインに完全整合）
    const oNo8 = payload.orderNo8 || (payload.orderNo ? String(payload.orderNo).replace(/\D/g, '').padStart(8, '0').slice(-8) : '00000000');
    for (let i = 0; i < 8; i++) {
      const ch = oNo8[i] || '0';
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
            x: 622.0,
            y: 38.5,
            width: 156.0,
            height: 13.0
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

  // 4-B. 完全フルパックPDF & OSS一括出力モーダル（FAXページ選択・耳消し・出力）
  openExportModal(caseId, defaultAction = 'fullpack') {
    const payload = this.getCasePayload(caseId);
    if (!payload) return;

    const existing = document.getElementById('ossExportModal');
    if (existing) existing.remove();

    window._selectedCustomFaxFile = null;

    // FAXページ選択用オプションの生成（安全上限: 最大10枚）
    const atts = (payload.attachments || []).slice(0, 10);
    let faxOptionsHtml = '';
    if (atts.length > 0) {
      atts.forEach((a, i) => {
        const isFirst = i === 0;
        const attName = a.name ? ` (${a.name})` : '';
        faxOptionsHtml += `<option value="${i}" ${isFirst ? 'selected' : ''}>📄 ${i + 1}枚目${attName} ${isFirst ? '(推奨原本)' : ''}</option>`;
      });
    } else {
      for (let i = 0; i < 3; i++) {
        faxOptionsHtml += `<option value="${i}">📄 ${i + 1}ページ目 (手元ファイル選択時に適用)</option>`;
      }
    }
    faxOptionsHtml += `<option value="none">❌ FAX原本は添付しない（確認書＋地図のみ）</option>`;

    // 地図データの有無判定
    const mapWarningHtml = !payload.hasMapData ? `
      <div style="background:rgba(239,68,68,0.12); border:1px solid #ef4444; border-radius:8px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="color:#fca5a5; font-size:0.80rem; line-height:1.4;">
          ⚠️ <strong>所在図・配置図が未作成（保存前）です</strong><br>
          このまま出力すると地図枠が白紙になります。
        </div>
        <button type="button" class="btn btn-small" onclick="if(typeof Cases !== 'undefined' && Cases.openMapMaker) { Cases.openMapMaker('${caseId}'); } else { window.open('syako_map_maker.html?caseId=${caseId}&orderNo=${payload.orderNo}', '_blank'); }" style="white-space:nowrap; font-weight:bold; background:#eab308; color:#000; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.78rem;">
          🚗 作図ツールを開く
        </button>
      </div>
    ` : `
      <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:6px 12px; font-size:0.78rem; color:#34d399; display:flex; align-items:center; gap:6px;">
        <span>🗺️ 所在図・配置図: 作図データ保存済み ✅（PDFに美しく合成されます）</span>
      </div>
    `;

    const faxNoticeHtml = atts.length === 0 ? `
      <div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; border-radius:6px; padding:8px 10px; font-size:0.76rem; color:#fde68a;">
        ⚠️ 案件にFAX原本が未添付です。4ページ目を含める場合は、下の「📁 手元ファイルを選択」から原本PDF/画像/TIFFを指定してください。
      </div>
    ` : `
      <div style="font-size:0.75rem; color:#94a3b8;">
        📎 案件に ${atts.length} 件の原本ファイルが紐付いています
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'ossExportModal';
    modal.style.display = 'flex';
    modal.style.zIndex = '100001';

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('ossExportModal').remove()" style="background:rgba(0,0,0,0.8); position:fixed; inset:0;"></div>
      <div class="modal-content" style="max-width:640px; width:94%; background:var(--card-bg, #1e293b); border:1px solid var(--border-color, #334155); border-radius:12px; padding:20px; z-index:100002; display:flex; flex-direction:column; gap:14px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color, #334155); padding-bottom:10px;">
          <h2 style="margin:0; font-size:1.15rem; color:var(--text-color, #fff); display:flex; align-items:center; gap:8px;">
            📦 完全フルパックPDF出力（確認書＋所在図＋配置図＋FAX原本）
          </h2>
          <button class="modal-close" onclick="document.getElementById('ossExportModal').remove()" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">✕</button>
        </div>

        <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-color, #334155); border-radius:8px; padding:10px 14px; font-size:0.82rem; display:grid; grid-template-columns:auto 1fr; gap:6px 12px;">
          <span style="color:var(--text-muted, #94a3b8);">注文書番号:</span>
          <strong style="color:#38bdf8;">${payload.orderNo}</strong>
          <span style="color:var(--text-muted, #94a3b8);">申請者名:</span>
          <strong style="color:#fff;">${payload.applicantName} 様</strong>
          <span style="color:var(--text-muted, #94a3b8);">ディーラー店舗:</span>
          <span style="color:#fff;">${payload.dealerName}（担当: ${payload.contactName || '—'} 様）</span>
        </div>

        ${mapWarningHtml}

        <!-- 📠 FAX原本の追加設定 -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid #0284c7; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; justify-content:space-between;">
            <span>📠 FAX原本の追加ページ選択</span>
            <span style="font-size:0.72rem; color:#94a3b8;">4ページ目に自動結合</span>
          </div>

          ${faxNoticeHtml}

          <div>
            <label style="font-size:0.76rem; color:#94a3b8; margin-bottom:4px; display:block;">追加するFAX原本のページ:</label>
            <select id="ossExportFaxPageSelect" class="form-input" style="width:100%; padding:8px 10px; font-size:0.86rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; cursor:pointer;">
              ${faxOptionsHtml}
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <select id="ossExportFaxOrientation" class="form-input" style="padding:5px 8px; font-size:0.80rem; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; cursor:pointer;" title="4P（FAX原本）の出力向き">
              <option value="landscape" selected>📐 向き: 横（A4横統一・推奨）</option>
              <option value="portrait">📏 向き: 縦（270°正立）</option>
            </select>
            <label style="font-size:0.80rem; color:#e2e8f0; display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="checkbox" id="ossExportEraseEarCheck" checked style="width:16px; height:16px; accent-color:#2563eb;">
              🧹 FAX耳を自動消去
            </label>

            <div>
              <button type="button" class="btn btn-secondary btn-small" onclick="document.getElementById('ossExportCustomFileInput').click()" style="font-size:0.75rem; padding:4px 10px; background:#1e293b; border-color:#38bdf8; color:#38bdf8;">
                📁 手元ファイルを選択...
              </button>
              <input type="file" id="ossExportCustomFileInput" accept=".pdf,.tif,.tiff,.jpg,.jpeg,.png" style="display:none;" onchange="OssDocuWorks.handleCustomFaxFile(event)">
            </div>
          </div>
          <div id="ossExportCustomFileStatus" style="display:none; font-size:0.78rem; color:#34d399; font-weight:bold; background:#064e3b; padding:4px 8px; border-radius:4px;"></div>
        </div>

        <!-- 🚀 メイン出力ボタン -->
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:4px;">
          <button type="button" class="btn btn-primary" onclick="OssDocuWorks.executeExportFromModal('${caseId}', 'fullpack')" style="padding:12px; font-size:0.95rem; font-weight:bold; background:linear-gradient(135deg, #0284c7, #2563eb); color:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 4px 12px rgba(2,132,199,0.3);">
            📦 完全フルパックPDFを出力（確認書＋地図＋FAX耳消し）
          </button>
        </div>

        <!-- サブ出力アコーディオン・個別ボタン -->
        <div style="border-top:1px dashed var(--border-color, #334155); padding-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button type="button" class="btn btn-secondary btn-small" onclick="OssDocuWorks.executeExportFromModal('${caseId}', 'kakunin_pdf')" style="font-size:0.78rem; padding:8px; justify-content:center;">
            📑 書類確認書 (PDF) のみ
          </button>
          <button type="button" class="btn btn-secondary btn-small" onclick="OssDocuWorks.executeExportFromModal('${caseId}', 'excel')" style="font-size:0.78rem; padding:8px; justify-content:center;">
            📊 書類確認書 (Excel) のみ
          </button>
          <button type="button" class="btn btn-secondary btn-small" onclick="OssDocuWorks.executeExportFromModal('${caseId}', 'pdf')" style="font-size:0.78rem; padding:8px; justify-content:center;">
            📄 所在図・配置図 (PDF) のみ
          </button>
          <button type="button" class="btn btn-secondary btn-small" onclick="OssDocuWorks.executeExportFromModal('${caseId}', 'drive')" style="font-size:0.78rem; padding:8px; justify-content:center; color:#f59e0b; border-color:#f59e0b;">
            ☁️ Driveへ一括保存
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  handleCustomFaxFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    window._selectedCustomFaxFile = file;
    const statusEl = document.getElementById('ossExportCustomFileStatus');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `✅ 手元ファイル選択中: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
    const sel = document.getElementById('ossExportFaxPageSelect');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = 'custom';
      opt.textContent = `📁 選択ファイル: ${file.name}`;
      opt.selected = true;
      sel.insertBefore(opt, sel.firstChild);
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📁 手元のFAX原本ファイルを取り込みました');
    }
  },

  async executeExportFromModal(caseId, action) {
    const faxVal = document.getElementById('ossExportFaxPageSelect')?.value || '0';
    const faxOrientation = document.getElementById('ossExportFaxOrientation')?.value || 'landscape';
    const eraseEar = document.getElementById('ossExportEraseEarCheck')?.checked ?? true;
    const customFax = window._selectedCustomFaxFile ? { file: window._selectedCustomFaxFile, name: window._selectedCustomFaxFile.name } : null;

    const opts = {
      includeFax: faxVal !== 'none',
      faxPageIndex: faxVal === 'custom' ? 0 : (parseInt(faxVal, 10) || 0),
      faxOrientation: faxOrientation,
      eraseEar: eraseEar,
      earWidthPercent: 0.02,
      customFaxSource: customFax
    };

    const modal = document.getElementById('ossExportModal');
    if (modal) modal.remove();

    if (action === 'fullpack') {
      await this.generateAndDownload(caseId, 'fullpack', opts);
    } else if (action === 'kakunin_pdf') {
      await this.generateAndDownload(caseId, 'kakunin_pdf');
    } else if (action === 'excel') {
      await this.generateAndDownload(caseId, 'excel');
    } else if (action === 'pdf') {
      await this.generateAndDownload(caseId, 'pdf');
    } else if (action === 'drive') {
      await this.saveAllToDrive(caseId, opts);
    }
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
