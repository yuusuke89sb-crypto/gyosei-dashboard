// 行政書士AIボット - チャットエンジン
class ChatEngine {
    constructor(knowledgeBase) {
        this.kb = knowledgeBase;
        this.conversationHistory = [];
    }

    // メイン検索メソッド（同義語展開対応）
    search(query) {
        if (!query || query.trim().length === 0) return null;
        const normalizedQuery = this.normalizeText(query);
        const queryTokens = this.tokenize(normalizedQuery);

        // 同義語展開：クエリ内のキーワードを同義語で拡張
        const expandedTerms = new Set();
        const synonyms = this.kb.synonyms || {};
        for (const [term, syns] of Object.entries(synonyms)) {
            if (normalizedQuery.includes(this.normalizeText(term))) {
                syns.forEach(s => expandedTerms.add(this.normalizeText(s)));
            }
        }

        const results = [];

        for (const entry of this.kb.entries) {
            let score = 0;
            const entryText = this.normalizeText(
                entry.keywords.join(' ') + ' ' + entry.question + ' ' + entry.answer
            );
            // キーワード完全一致（高スコア）
            for (const keyword of entry.keywords) {
                if (normalizedQuery.includes(this.normalizeText(keyword))) {
                    score += 10;
                }
            }
            // 同義語によるマッチ（中スコア）
            for (const synTerm of expandedTerms) {
                for (const keyword of entry.keywords) {
                    const kw = this.normalizeText(keyword);
                    if (kw.includes(synTerm) || synTerm.includes(kw)) {
                        score += 6;
                    }
                }
                if (this.normalizeText(entry.question).includes(synTerm)) {
                    score += 4;
                }
            }
            // 質問文との類似度
            const questionNorm = this.normalizeText(entry.question);
            for (const token of queryTokens) {
                if (token.length < 2) continue;
                if (questionNorm.includes(token)) score += 5;
                if (entryText.includes(token)) score += 2;
            }
            // カテゴリ名との一致
            const cat = this.kb.categories.find(c => c.id === entry.category);
            if (cat && normalizedQuery.includes(this.normalizeText(cat.name))) {
                score += 8;
            }
            if (score > 0) {
                results.push({ entry, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.length > 0 ? results : null;
    }

    // 回答を生成
    generateResponse(query) {
        // 挨拶パターン
        if (this.isGreeting(query)) {
            return {
                type: 'greeting',
                message: this.getGreetingResponse(),
                citations: [],
                relatedQuestions: this.getSuggestedQuestions(),
                documents: [],
                checklist: null,
                feeSimulation: null
            };
        }

        const results = this.search(query);
        if (!results || results.length === 0) {
            return {
                type: 'not_found',
                message: this.getNotFoundResponse(query),
                citations: [],
                relatedQuestions: this.getSuggestedQuestions(),
                documents: [],
                checklist: null,
                feeSimulation: null
            };
        }

        const bestMatch = results[0];
        const entry = bestMatch.entry;
        // 関連質問を取得
        const related = (entry.relatedQuestions || [])
            .map(id => this.kb.entries.find(e => e.id === id))
            .filter(Boolean)
            .map(e => ({ id: e.id, question: e.question, category: e.category }));
        // 関連書類を取得
        const docs = (entry.relatedDocs || [])
            .map(id => this.kb.documentTemplates.find(d => d.id === id))
            .filter(Boolean);
        // 類似結果を追加（横断検索候補）
        const otherResults = results.slice(1, 4).map(r => ({
            id: r.entry.id,
            question: r.entry.question,
            category: r.entry.category,
            score: r.score
        }));

        // チェックリスト・報酬シミュレーション・タイムラインを取得
        const checklist = (this.kb.checklists || {})[entry.id] || null;
        const feeSimulation = (this.kb.feeSimulations || {})[entry.id] || null;
        const timeline = (this.kb.timelines || {})[entry.id] || null;

        // 会話履歴に追加
        this.conversationHistory.push({ query, entryId: entry.id, timestamp: Date.now() });

        return {
            type: 'answer',
            message: entry.answer,
            question: entry.question,
            citations: entry.citations || [],
            relatedQuestions: [...related, ...otherResults.filter(o => !related.find(r => r.id === o.id))].slice(0, 5),
            documents: docs,
            category: entry.category,
            confidence: Math.min(bestMatch.score / 30, 1),
            checklist,
            feeSimulation,
            timeline
        };
    }

    // カテゴリで検索
    searchByCategory(categoryId) {
        return this.kb.entries
            .filter(e => e.category === categoryId)
            .map(e => ({ id: e.id, question: e.question, category: e.category }));
    }

    // テキスト正規化
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[　\s]+/g, ' ')
            .replace(/[？?！!。、,. ]/g, '')
            .trim();
    }

    // トークン化
    tokenize(text) {
        const tokens = [];
        // 2〜6文字のn-gramを生成
        for (let len = 6; len >= 2; len--) {
            for (let i = 0; i <= text.length - len; i++) {
                tokens.push(text.substring(i, i + len));
            }
        }
        // スペース区切り
        const words = text.split(/\s+/).filter(w => w.length >= 2);
        tokens.push(...words);
        return [...new Set(tokens)];
    }

    // 挨拶判定
    isGreeting(text) {
        const greetings = ['こんにちは', 'こんばんは', 'おはよう', 'はじめまして', 'ありがとう',
            'よろしく', 'hello', 'hi', 'hey', 'お疲れ', 'どうも', 'すみません'];
        const norm = this.normalizeText(text);
        return greetings.some(g => norm.includes(g)) && norm.length < 20;
    }

    getGreetingResponse() {
        const responses = [
            'こんにちは！行政書士業務に関するご質問にお答えします。\n\n何かお知りになりたいことはございますか？左のカテゴリメニューから業務分野を選んでいただくか、直接ご質問ください。',
            'いらっしゃいませ！行政書士業務のエキスパートボットです。\n\n許認可申請、相続・遺言、会社設立、外国人の在留資格など、幅広い分野についてお答えいたします。お気軽にどうぞ！'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getNotFoundResponse(query) {
        return `申し訳ございません。「${query}」に関する情報が見つかりませんでした。\n\n以下のような質問をお試しください：\n- 建設業許可の取得要件は？\n- 相続手続きの流れは？\n- 飲食店の営業許可について教えて\n- 在留資格の種類は？\n\nまた、左のカテゴリメニューから業務分野を選んでいただくこともできます。`;
    }

    getSuggestedQuestions() {
        const allEntries = this.kb.entries;
        const shuffled = [...allEntries].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4).map(e => ({
            id: e.id,
            question: e.question,
            category: e.category
        }));
    }

    // カテゴリ情報を取得
    getCategories() {
        return this.kb.categories;
    }

    // 書類テンプレート取得
    getDocumentTemplate(templateId) {
        return this.kb.documentTemplates.find(d => d.id === templateId);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatEngine;
}
