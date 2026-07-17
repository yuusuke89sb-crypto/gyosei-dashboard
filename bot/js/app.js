// 行政書士AIボット - メインアプリケーション
document.addEventListener('DOMContentLoaded', () => {
    const engine = new ChatEngine(KNOWLEDGE_BASE);
    const pdfGen = new PDFGenerator();

    // DOM要素
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const categoryList = document.getElementById('categoryList');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const templateGalleryBtn = document.getElementById('templateGalleryBtn');

    // 初期化
    init();

    function init() {
        renderCategories();
        showWelcomeMessage();
        setupEventListeners();
        // ダークモード初期化
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            if (darkModeBtn) darkModeBtn.textContent = '☀️';
        }
    }

    function setupEventListeners() {
        sendBtn.addEventListener('click', handleSend);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        });
        chatInput.addEventListener('input', autoResize);
        if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);
        if (darkModeBtn) darkModeBtn.addEventListener('click', toggleDarkMode);
        if (templateGalleryBtn) templateGalleryBtn.addEventListener('click', showTemplateGallery);
    }

    function autoResize() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }

    function toggleSidebar() { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); }
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        if (darkModeBtn) darkModeBtn.textContent = isDark ? '☀️' : '🌙';
    }

    // テンプレートギャラリー
    function showTemplateGallery() {
        closeSidebar();
        chatMessages.innerHTML = '';

        const gallery = document.createElement('div');
        gallery.className = 'template-gallery';

        // ヘッダー
        const header = document.createElement('div');
        header.className = 'gallery-header';
        header.innerHTML = `
            <h2>📄 書類テンプレート一覧</h2>
            <p>行政書士業務でよく使う書類テンプレートをすぐにPDF生成できます</p>
            <button class="gallery-back-btn" id="galleryBackBtn">← チャットに戻る</button>
        `;
        gallery.appendChild(header);

        // カテゴリー分類
        const categoryMap = {
            inheritance: { label: '相続・遺言', icon: '📜' },
            construction: { label: '建設業', icon: '🏗️' },
            vehicle: { label: '自動車', icon: '🚗' },
            contract: { label: '契約・通知', icon: '✉️' },
            company: { label: '会社設立', icon: '🏢' },
            office: { label: '事務所書類', icon: '💰' },
            food: { label: '飲食店・食品', icon: '🍽️' },
            transport: { label: '運送業', icon: '🚛' },
            agriculture: { label: '農地', icon: '🌾' }
        };

        const templates = KNOWLEDGE_BASE.documentTemplates || [];
        const grouped = {};
        templates.forEach(t => {
            const cat = t.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(t);
        });

        Object.entries(grouped).forEach(([catKey, items]) => {
            const catInfo = categoryMap[catKey] || { label: catKey, icon: '📁' };
            const section = document.createElement('div');
            section.className = 'gallery-section';
            section.innerHTML = `<div class="gallery-section-title">${catInfo.icon} ${catInfo.label}</div>`;

            const grid = document.createElement('div');
            grid.className = 'gallery-grid';

            items.forEach(t => {
                const card = document.createElement('div');
                card.className = 'gallery-card';
                card.innerHTML = `
                    <div class="gallery-card-icon">${catInfo.icon}</div>
                    <div class="gallery-card-body">
                        <div class="gallery-card-title">${t.name}</div>
                        <div class="gallery-card-desc">${t.description}</div>
                        <div class="gallery-card-fields">✅ ${t.fields.length}項目入力</div>
                    </div>
                    <button class="gallery-gen-btn">PDF生成</button>
                `;
                card.querySelector('.gallery-gen-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDocGen(t);
                });
                card.addEventListener('click', () => {
                    pdfGen.previewDocument(t.id, {});
                });
                grid.appendChild(card);
            });

            section.appendChild(grid);
            gallery.appendChild(section);
        });

        chatMessages.appendChild(gallery);

        // 戻るボタン
        document.getElementById('galleryBackBtn').addEventListener('click', () => {
            chatMessages.innerHTML = '';
            showWelcomeMessage();
        });
    }

    // カテゴリ描画
    function renderCategories() {
        const cats = engine.getCategories();
        categoryList.innerHTML = '';
        cats.forEach(cat => {
            const item = document.createElement('button');
            item.className = 'category-item';
            item.style.setProperty('--cat-color', cat.color);
            item.innerHTML = `<span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.name}</span>`;
            item.addEventListener('click', () => { handleCategoryClick(cat); closeSidebar(); });
            categoryList.appendChild(item);
        });
    }

    function handleCategoryClick(cat) {
        const entries = engine.searchByCategory(cat.id);
        if (entries.length === 0) return;
        addMessage('user', `${cat.icon} ${cat.name}について教えてください`);
        showTyping();
        setTimeout(() => {
            hideTyping();
            let msg = `**${cat.icon} ${cat.name}** に関する質問をお選びください：\n\n`;
            entries.forEach((e, i) => { msg += `${i + 1}. ${e.question}\n`; });
            addMessage('bot', msg, { relatedQuestions: entries });
        }, 600);
    }

    // 送信処理
    function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        showTyping();
        // 回答生成（少し遅延させてリアル感を出す）
        const delay = 400 + Math.random() * 600;
        setTimeout(() => {
            hideTyping();
            const response = engine.generateResponse(text);
            addMessage('bot', response.message, response);
        }, delay);
    }

    // メッセージ追加
    function addMessage(role, text, data = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role}`;
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}`;

        if (role === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'bot-avatar';
            avatar.innerHTML = '⚖️';
            wrapper.appendChild(avatar);
        }

        // Markdownの簡易変換
        bubble.innerHTML = simpleMarkdown(text);
        wrapper.appendChild(bubble);

        // 引用元表示
        if (data.citations && data.citations.length > 0) {
            const citBox = document.createElement('div');
            citBox.className = 'citations-box';
            citBox.innerHTML = '<div class="citations-title">📚 引用・参照</div>';
            data.citations.forEach(c => {
                const citItem = document.createElement('div');
                citItem.className = 'citation-item';
                if (c.url) {
                    citItem.innerHTML = `<a href="${c.url}" target="_blank" rel="noopener">${c.title}</a><span class="citation-source">${c.source}</span>`;
                } else {
                    citItem.innerHTML = `<span class="citation-title">${c.title}</span><span class="citation-source">${c.source}</span>`;
                }
                citBox.appendChild(citItem);
            });
            wrapper.appendChild(citBox);
        }

        // 必要書類チェックリスト
        if (data.checklist) {
            const clBox = document.createElement('div');
            clBox.className = 'checklist-box';
            const reqCount = data.checklist.items.filter(i => i.required).length;
            const totalCount = data.checklist.items.length;
            clBox.innerHTML = `<div class="checklist-title">📋 ${data.checklist.title}</div>
                <div class="checklist-progress"><span class="checklist-counter">0</span> / ${totalCount} 完了　（必須: ${reqCount}件）</div>`;
            const list = document.createElement('div');
            list.className = 'checklist-items';
            data.checklist.items.forEach((item, idx) => {
                const row = document.createElement('label');
                row.className = 'checklist-item' + (item.required ? ' required' : ' optional');
                row.innerHTML = `<input type="checkbox" data-idx="${idx}">
                    <span class="checklist-check">✓</span>
                    <span class="checklist-label">${item.label}</span>
                    <span class="checklist-badge ${item.required ? 'badge-required' : 'badge-optional'}">${item.required ? '必須' : '任意'}</span>`;
                const cb = row.querySelector('input');
                cb.addEventListener('change', () => {
                    row.classList.toggle('checked', cb.checked);
                    const checked = clBox.querySelectorAll('input:checked').length;
                    clBox.querySelector('.checklist-counter').textContent = checked;
                });
                list.appendChild(row);
            });
            clBox.appendChild(list);
            wrapper.appendChild(clBox);
        }

        // 報酬シミュレーション
        if (data.feeSimulation) {
            const feeBox = document.createElement('div');
            feeBox.className = 'fee-box';
            feeBox.innerHTML = `<div class="fee-title">💰 報酬シミュレーション：${data.feeSimulation.title}</div>`;
            const table = document.createElement('div');
            table.className = 'fee-items';
            data.feeSimulation.items.forEach(item => {
                const typeLabel = item.type === 'fee' ? '報酬' : item.type === 'official' ? '法定費用' : '実費';
                const typeClass = item.type === 'fee' ? 'fee-type-fee' : item.type === 'official' ? 'fee-type-official' : 'fee-type-misc';
                const row = document.createElement('div');
                row.className = 'fee-item';
                row.innerHTML = `<span class="fee-type-badge ${typeClass}">${typeLabel}</span>
                    <span class="fee-label">${item.label}</span>
                    <span class="fee-amount">${item.amount}</span>`;
                table.appendChild(row);
            });
            feeBox.appendChild(table);
            const total = document.createElement('div');
            total.className = 'fee-total';
            total.innerHTML = `<span>📊 合計目安</span><strong>${data.feeSimulation.totalEstimate}</strong>`;
            feeBox.appendChild(total);
            if (data.feeSimulation.note) {
                const note = document.createElement('div');
                note.className = 'fee-note';
                note.textContent = data.feeSimulation.note;
                feeBox.appendChild(note);
            }
            wrapper.appendChild(feeBox);
        }

        // タイムライン
        if (data.timeline) {
            const tlBox = document.createElement('div');
            tlBox.className = 'timeline-box';
            tlBox.innerHTML = `<div class="timeline-title">📅 ${data.timeline.title}</div>`;
            const steps = document.createElement('div');
            steps.className = 'timeline-steps';
            data.timeline.steps.forEach((step, idx) => {
                const isLast = idx === data.timeline.steps.length - 1;
                const s = document.createElement('div');
                s.className = 'timeline-step' + (isLast ? ' last' : '');
                s.innerHTML = `<div class="timeline-icon">${step.icon}</div>
                    <div class="timeline-connector"></div>
                    <div class="timeline-content">
                        <div class="timeline-step-header">
                            <span class="timeline-step-label">${step.label}</span>
                            <span class="timeline-duration">⏱ ${step.duration}</span>
                        </div>
                        <div class="timeline-desc">${step.desc}</div>
                    </div>`;
                steps.appendChild(s);
            });
            tlBox.appendChild(steps);
            wrapper.appendChild(tlBox);
        }

        // 印刷ボタン（回答が存在する場合のみ）
        if (data.type === 'answer') {
            const printBtn = document.createElement('button');
            printBtn.className = 'print-answer-btn';
            printBtn.innerHTML = '🖨️ この回答を印刷';
            printBtn.addEventListener('click', () => handlePrint(wrapper, data));
            wrapper.appendChild(printBtn);
        }

        // 書類生成ボタン
        if (data.documents && data.documents.length > 0) {
            const docBox = document.createElement('div');
            docBox.className = 'documents-box';
            docBox.innerHTML = '<div class="documents-title">📄 関連書類テンプレート</div>';
            data.documents.forEach(d => {
                const btn = document.createElement('button');
                btn.className = 'doc-gen-btn';
                btn.innerHTML = `<span class="doc-icon">📄</span><span>${d.name}</span><span class="doc-action">PDF生成</span>`;
                btn.addEventListener('click', () => handleDocGen(d));
                docBox.appendChild(btn);
            });
            wrapper.appendChild(docBox);
        }

        // 関連質問
        if (data.relatedQuestions && data.relatedQuestions.length > 0) {
            const relBox = document.createElement('div');
            relBox.className = 'related-box';
            relBox.innerHTML = '<div class="related-title">💡 関連する質問</div>';
            data.relatedQuestions.forEach(rq => {
                const btn = document.createElement('button');
                btn.className = 'related-btn';
                btn.textContent = rq.question;
                btn.addEventListener('click', () => {
                    chatInput.value = rq.question;
                    handleSend();
                });
                relBox.appendChild(btn);
            });
            wrapper.appendChild(relBox);
        }

        chatMessages.appendChild(wrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 印刷機能
    function handlePrint(wrapper, data) {
        const printWin = window.open('', '_blank');
        if (!printWin) { alert('ポップアップがブロックされました。許可してください。'); return; }
        const content = wrapper.querySelector('.message-bubble');
        const citations = wrapper.querySelector('.citations-box');
        const checklist = wrapper.querySelector('.checklist-box');
        const timeline = wrapper.querySelector('.timeline-box');
        const feeBox = wrapper.querySelector('.fee-box');
        printWin.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
            <title>${data.question || '行政書士AIボット 回答'}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI','Meiryo',sans-serif; padding: 30px 40px; color: #1E293B; line-height: 1.8; font-size: 14px; }
                .print-header { border-bottom: 3px solid #4F46E5; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .print-header h1 { font-size: 18px; color: #4F46E5; }
                .print-header .office { font-size: 12px; color: #64748B; text-align: right; }
                .print-date { font-size: 11px; color: #94A3B8; margin-bottom: 16px; }
                .print-question { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 10px 14px; margin-bottom: 16px; font-weight: 600; }
                .print-body { margin-bottom: 20px; }
                .print-body h2 { font-size: 16px; margin: 14px 0 6px; color: #1E40AF; }
                .print-body h3 { font-size: 14px; margin: 10px 0 4px; color: #4338CA; }
                .print-body ul, .print-body ol { margin-left: 20px; margin-bottom: 8px; }
                .print-body li { margin-bottom: 3px; }
                .print-body table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
                .print-body th { background: #4F46E5; color: white; padding: 6px 8px; text-align: left; }
                .print-body td { border: 1px solid #E2E8F0; padding: 5px 8px; }
                .print-body tr:nth-child(even) { background: #F8FAFC; }
                .print-section { margin: 16px 0; padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; }
                .print-section-title { font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #4F46E5; }
                .print-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #CBD5E1; font-size: 10px; color: #94A3B8; text-align: center; }
                @media print { body { padding: 15px 20px; } }
            </style></head><body>
            <div class="print-header">
                <h1>⚖️ 行政書士AIボット</h1>
                <div class="office">
                  <script>
                    var o=JSON.parse(localStorage.getItem('gyosei_office_info')||'{}');
                    document.write((o.name||'行政書士法人Felis')+'<br>TEL: '+(o.tel||'0586-50-2896')+'<br>FAX: '+(o.fax||'0586-22-9096'));
                  </script>
                </div>
            </div>
            <div class="print-date">出力日: ${new Date().toLocaleDateString('ja-JP')}</div>
            ${data.question ? `<div class="print-question">Q. ${data.question}</div>` : ''}
            <div class="print-body">${content ? content.innerHTML : ''}</div>
            ${citations ? `<div class="print-section"><div class="print-section-title">📚 引用・参照</div>${citations.innerHTML}</div>` : ''}
            <div class="print-footer">※正確性については必ず最新の法令をご確認ください。</div>
        </body></html>`);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => { printWin.print(); }, 500);
    }

    // タイピングインジケーター
    function showTyping() {
        const el = document.createElement('div');
        el.id = 'typingIndicator';
        el.className = 'message-wrapper bot';
        el.innerHTML = `<div class="bot-avatar">⚖️</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    // ウェルカムメッセージ
    function showWelcomeMessage() {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-screen';
        welcome.innerHTML = `
      <div class="welcome-icon">⚖️</div>
      <h2>行政書士AIボット</h2>
      <p>行政書士業務に関するあらゆるご質問にお答えします。<br>根拠法令つきで正確な情報をお届けします。</p>
      <div class="quick-actions">
        ${engine.getSuggestedQuestions().map(q => `<button class="quick-btn" data-q="${q.question}">${q.question}</button>`).join('')}
      </div>
    `;
        chatMessages.appendChild(welcome);
        welcome.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                welcome.remove();
                chatInput.value = btn.dataset.q;
                handleSend();
            });
        });
    }

    // 書類生成モーダル
    function handleDocGen(template) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📄 ${template.name}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">${template.description}</p>
          <form id="docForm">
            ${template.fields.map(f => `
              <div class="form-group">
                <label>${f}</label>
                <input type="text" name="${f}" placeholder="${f}を入力" />
              </div>
            `).join('')}
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary modal-cancel">キャンセル</button>
          <button class="btn-primary modal-preview">📄 プレビュー</button>
          <button class="btn-accent modal-download">🖨️ 印刷 / PDF保存</button>
        </div>
      </div>
    `;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('show'));

        const closeModal = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const getFormData = () => {
            const form = document.getElementById('docForm');
            const data = {};
            template.fields.forEach(f => { data[f] = form.querySelector(`[name="${f}"]`).value; });
            return data;
        };

        modal.querySelector('.modal-preview').addEventListener('click', async () => {
            await pdfGen.previewDocument(template.id, getFormData());
        });
        modal.querySelector('.modal-download').addEventListener('click', async () => {
            await pdfGen.generateAndPrint(template.id, getFormData());
            closeModal();
            addMessage('bot', `✅ **${template.name}** を印刷用に生成しました。ブラウザの印刷画面で「PDFに保存」を選択するとPDFとしてダウンロードできます。`);
        });
    }

    // 簡易Markdown変換
    function simpleMarkdown(text) {
        // 1. HTMLエスケープ
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 2. テーブルを先に抽出・変換（\n のまま処理）
        const tablePlaceholders = [];
        const inlineFmt = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
        text = text.replace(/((?:^|\n)\|[^\n]+\|\n\|[-|: ]+\|\n(?:\|[^\n]+\|\n?)*)/gm, (tableBlock) => {
            const rows = tableBlock.trim().split('\n').filter(r => r.trim().startsWith('|'));
            if (rows.length < 2) return tableBlock;
            let html = '<table class="md-table">';
            let headerDone = false;
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].split('|').slice(1, -1);
                if (!cells.length) continue;
                // セパレーター行検出
                if (cells.every(c => c.trim().match(/^[-:]+$/))) {
                    headerDone = true;
                    continue;
                }
                if (!headerDone) {
                    html += '<thead><tr>' + cells.map(c => `<th>${inlineFmt(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
                } else {
                    html += '<tr>' + cells.map(c => `<td>${inlineFmt(c.trim())}</td>`).join('') + '</tr>';
                }
            }
            html += '</tbody></table>';
            const placeholder = `%%TABLE_${tablePlaceholders.length}%%`;
            tablePlaceholders.push(html);
            return '\n' + placeholder + '\n';
        });

        // 3. 残りのMarkdown変換
        text = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/⚠️/g, '<span class="emoji-warn">⚠️</span>')
            .replace(/📌/g, '<span class="emoji-note">📌</span>')
            .replace(/⭐/g, '<span class="emoji-star">⭐</span>')
            .replace(/✅/g, '<span class="emoji-check">✅</span>')
            .replace(/📎/g, '<span class="emoji-clip">📎</span>')
            .replace(/📅/g, '<span class="emoji-cal">📅</span>')
            .replace(/💰/g, '<span class="emoji-money">💰</span>');

        // 4. テーブルプレースホルダーを戻す
        tablePlaceholders.forEach((html, i) => {
            text = text.replace(`%%TABLE_${i}%%`, html);
        });

        return text;
    }
});
