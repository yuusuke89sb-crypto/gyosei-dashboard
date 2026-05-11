// 報酬シミュレーター用データ
// 各カテゴリの条件と概算報酬を定義

const FEE_DATA = {

  // ============================================================
  // 建設業許可
  // ============================================================
  construction: {
    title: '建設業許可 報酬シミュレーター',
    icon: '🏗️',
    steps: [
      {
        id: 'type',
        question: '申請の種類は？',
        type: 'select',
        options: [
          { label: '新規申請', value: 'new' },
          { label: '更新申請', value: 'renew' },
          { label: '業種追加', value: 'add' },
          { label: '般特新規', value: 'upgrade' },
          { label: '変更届', value: 'change' },
          { label: '決算変届', value: 'financial' }
        ]
      },
      {
        id: 'scope',
        question: '許可の区分は？',
        type: 'select',
        showIf: { type: ['new', 'renew', 'add', 'upgrade'] },
        options: [
          { label: '知事許可', value: 'prefectural' },
          { label: '大臣許可', value: 'minister' }
        ]
      },
      {
        id: 'class',
        question: '許可の種類は？',
        type: 'select',
        showIf: { type: ['new', 'renew', 'add', 'upgrade'] },
        options: [
          { label: '一般建設業', value: 'general' },
          { label: '特定建設業', value: 'special' }
        ]
      },
      {
        id: 'gyoshu',
        question: '申請する業種の数は？',
        type: 'select',
        showIf: { type: ['new', 'renew', 'add'] },
        options: [
          { label: '1業種', value: '1' },
          { label: '2業種', value: '2' },
          { label: '3業種以上', value: '3plus' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'new') {
        results.officialFee = answers.scope === 'minister' ? 150000 : 90000;
        let base = answers.scope === 'minister' ? 180000 : 120000;
        if (answers.class === 'special') base += 30000;
        if (answers.gyoshu === '2') base += 20000;
        if (answers.gyoshu === '3plus') base += 40000;
        results.reward = base;
        results.items.push({ label: '新規申請 報酬', amount: base });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
        results.notes.push('初回は戸籍等の取得費用が別途かかる場合があります');
      } else if (answers.type === 'renew') {
        results.officialFee = 50000;
        let base = answers.scope === 'minister' ? 100000 : 70000;
        if (answers.class === 'special') base += 20000;
        results.reward = base;
        results.items.push({ label: '更新申請 報酬', amount: base });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
      } else if (answers.type === 'add') {
        results.officialFee = 50000;
        let base = 80000;
        if (answers.gyoshu === '2') base += 15000;
        if (answers.gyoshu === '3plus') base += 30000;
        results.reward = base;
        results.items.push({ label: '業種追加 報酬', amount: base });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
      } else if (answers.type === 'upgrade') {
        results.officialFee = answers.scope === 'minister' ? 150000 : 90000;
        results.reward = 150000;
        results.items.push({ label: '般特新規 報酬', amount: 150000 });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
      } else if (answers.type === 'change') {
        results.officialFee = 0;
        results.reward = 30000;
        results.items.push({ label: '変更届 報酬', amount: 30000 });
        results.notes.push('変更内容により報酬が異なります。複数変更の場合は加算あり。');
      } else if (answers.type === 'financial') {
        results.officialFee = 0;
        results.reward = 40000;
        results.items.push({ label: '決算変更届 報酬', amount: 40000 });
        results.notes.push('決算期ごとに毎年必要な届出です。年間契約も承ります。');
      }

      return results;
    }
  },

  // ============================================================
  // 相続・遺言
  // ============================================================
  inheritance: {
    title: '相続・遺言 報酬シミュレーター',
    icon: '📜',
    steps: [
      {
        id: 'type',
        question: 'どの手続きですか？',
        type: 'select',
        options: [
          { label: '遺産分割協議書の作成', value: 'agreement' },
          { label: '相続手続き一式サポート', value: 'full' },
          { label: '遺言書の作成支援', value: 'will' },
          { label: '相続関係説明図の作成', value: 'chart' },
          { label: '戸籍収集のみ', value: 'koseki' }
        ]
      },
      {
        id: 'heirs',
        question: '相続人の人数は？',
        type: 'select',
        showIf: { type: ['agreement', 'full'] },
        options: [
          { label: '2〜3人', value: 'few' },
          { label: '4〜6人', value: 'mid' },
          { label: '7人以上', value: 'many' }
        ]
      },
      {
        id: 'willType',
        question: '遺言書の種類は？',
        type: 'select',
        showIf: { type: ['will'] },
        options: [
          { label: '公正証書遺言', value: 'notarized' },
          { label: '自筆証書遺言', value: 'handwritten' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'agreement') {
        let base = 50000;
        if (answers.heirs === 'mid') base = 70000;
        if (answers.heirs === 'many') base = 100000;
        results.reward = base;
        results.items.push({ label: '遺産分割協議書 作成', amount: base });
        results.notes.push('不動産の登記は提携司法書士にて対応（別途費用）');
      } else if (answers.type === 'full') {
        let base = 150000;
        if (answers.heirs === 'mid') base = 200000;
        if (answers.heirs === 'many') base = 280000;
        results.reward = base;
        results.items.push({ label: '相続手続き一式サポート', amount: base });
        results.notes.push('戸籍収集、財産調査、遺産分割協議書作成、金融機関手続きを含む');
        results.notes.push('相続税の申告が必要な場合は提携税理士をご紹介');
      } else if (answers.type === 'will') {
        if (answers.willType === 'notarized') {
          results.reward = 80000;
          results.officialFee = 30000;
          results.items.push({ label: '公正証書遺言 作成支援', amount: 80000 });
          results.items.push({ label: '公証役場 手数料（目安）', amount: 30000, type: 'official' });
          results.notes.push('公証役場手数料は財産額により変動します');
          results.notes.push('証人2名の手配も含みます');
        } else {
          results.reward = 50000;
          results.items.push({ label: '自筆証書遺言 作成支援', amount: 50000 });
          results.notes.push('法務局の保管制度利用の場合、手数料3,900円が別途必要');
        }
      } else if (answers.type === 'chart') {
        results.reward = 30000;
        results.items.push({ label: '相続関係説明図 作成', amount: 30000 });
        results.notes.push('戸籍の取得費用は実費別途');
      } else if (answers.type === 'koseki') {
        results.reward = 25000;
        results.items.push({ label: '戸籍収集', amount: 25000 });
        results.notes.push('取得通数により加算あり（1通超過につき2,000円）');
      }

      return results;
    }
  },

  // ============================================================
  // 会社設立
  // ============================================================
  company: {
    title: '会社設立 報酬シミュレーター',
    icon: '🏢',
    steps: [
      {
        id: 'type',
        question: '会社の種類は？',
        type: 'select',
        options: [
          { label: '株式会社', value: 'kabushiki' },
          { label: '合同会社（LLC）', value: 'godo' },
          { label: '一般社団法人', value: 'shadan' },
          { label: 'NPO法人', value: 'npo' }
        ]
      },
      {
        id: 'options',
        question: '追加オプション',
        type: 'multi',
        options: [
          { label: '許認可の同時申請', value: 'permit', fee: 50000 },
          { label: '届出書類一式（税務署等）', value: 'filings', fee: 30000 },
          { label: '会社印鑑セット手配', value: 'seal', fee: 15000 }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'kabushiki') {
        results.officialFee = 202000;
        results.reward = 80000;
        results.items.push({ label: '株式会社 設立手続き報酬', amount: 80000 });
        results.items.push({ label: '定款認証手数料', amount: 52000, type: 'official' });
        results.items.push({ label: '登録免許税', amount: 150000, type: 'official' });
        results.notes.push('電子定款のため印紙代4万円が不要');
        results.notes.push('登記は提携司法書士が対応');
      } else if (answers.type === 'godo') {
        results.officialFee = 60000;
        results.reward = 60000;
        results.items.push({ label: '合同会社 設立手続き報酬', amount: 60000 });
        results.items.push({ label: '登録免許税', amount: 60000, type: 'official' });
        results.notes.push('定款認証不要・コストを抑えた設立が可能');
      } else if (answers.type === 'shadan') {
        results.officialFee = 110000;
        results.reward = 100000;
        results.items.push({ label: '一般社団法人 設立報酬', amount: 100000 });
        results.items.push({ label: '登録免許税', amount: 60000, type: 'official' });
        results.items.push({ label: '定款認証手数料', amount: 50000, type: 'official' });
      } else if (answers.type === 'npo') {
        results.officialFee = 0;
        results.reward = 150000;
        results.items.push({ label: 'NPO法人 設立報酬', amount: 150000 });
        results.notes.push('設立認証まで約4ヶ月かかります');
        results.notes.push('登録免許税は非課税');
      }

      // オプション
      if (answers.options && Array.isArray(answers.options)) {
        const optionDefs = { permit: '許認可同時申請', filings: '届出書類一式', seal: '会社印鑑セット手配' };
        const optionFees = { permit: 50000, filings: 30000, seal: 15000 };
        answers.options.forEach(opt => {
          results.reward += optionFees[opt];
          results.items.push({ label: optionDefs[opt], amount: optionFees[opt] });
        });
      }

      return results;
    }
  },

  // ============================================================
  // 飲食店営業許可
  // ============================================================
  food: {
    title: '飲食店営業許可 報酬シミュレーター',
    icon: '🍽️',
    steps: [
      {
        id: 'type',
        question: '申請の種類は？',
        type: 'select',
        options: [
          { label: '新規の営業許可申請', value: 'new' },
          { label: '営業許可の更新', value: 'renew' },
          { label: '変更届', value: 'change' }
        ]
      },
      {
        id: 'extras',
        question: '追加で必要な届出は？',
        type: 'multi',
        showIf: { type: ['new'] },
        options: [
          { label: '深夜酒類提供飲食店 届出', value: 'late_night', fee: 80000 },
          { label: '風俗営業許可（スナック等）', value: 'fuzoku', fee: 150000 },
          { label: '菓子製造業許可', value: 'confection', fee: 30000 }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'new') {
        results.officialFee = 16000;
        results.reward = 50000;
        results.items.push({ label: '飲食店営業許可 申請報酬', amount: 50000 });
        results.items.push({ label: '保健所 申請手数料', amount: 16000, type: 'official' });
        results.notes.push('食品衛生責任者の講習会受講費は別途');
      } else if (answers.type === 'renew') {
        results.officialFee = 8000;
        results.reward = 30000;
        results.items.push({ label: '営業許可 更新報酬', amount: 30000 });
        results.items.push({ label: '保健所 更新手数料', amount: 8000, type: 'official' });
      } else if (answers.type === 'change') {
        results.reward = 20000;
        results.items.push({ label: '変更届 報酬', amount: 20000 });
      }

      if (answers.extras && Array.isArray(answers.extras)) {
        const defs = { late_night: '深夜酒類提供飲食店 届出', fuzoku: '風俗営業許可', confection: '菓子製造業許可' };
        const fees = { late_night: 80000, fuzoku: 150000, confection: 30000 };
        const officialFees = { late_night: 0, fuzoku: 24000, confection: 16000 };
        answers.extras.forEach(e => {
          results.reward += fees[e];
          results.items.push({ label: defs[e], amount: fees[e] });
          if (officialFees[e]) {
            results.officialFee += officialFees[e];
            results.items.push({ label: defs[e] + ' 手数料', amount: officialFees[e], type: 'official' });
          }
        });
      }

      return results;
    }
  },

  // ============================================================
  // 在留資格
  // ============================================================
  immigration: {
    title: '在留資格 報酬シミュレーター',
    icon: '🌏',
    steps: [
      {
        id: 'type',
        question: '手続きの種類は？',
        type: 'select',
        options: [
          { label: '在留資格認定証明書交付申請（新規）', value: 'coe' },
          { label: '在留資格変更許可申請', value: 'change' },
          { label: '在留期間更新許可申請', value: 'renew' },
          { label: '永住許可申請', value: 'permanent' },
          { label: '帰化申請', value: 'naturalize' }
        ]
      },
      {
        id: 'visaType',
        question: '在留資格の種類は？',
        type: 'select',
        showIf: { type: ['coe', 'change', 'renew'] },
        options: [
          { label: '就労ビザ（技人国等）', value: 'work' },
          { label: '配偶者ビザ', value: 'spouse' },
          { label: '経営管理ビザ', value: 'business' },
          { label: '家族滞在', value: 'family' },
          { label: 'その他', value: 'other' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'coe') {
        const fees = { work: 100000, spouse: 100000, business: 150000, family: 80000, other: 100000 };
        results.reward = fees[answers.visaType] || 100000;
        results.items.push({ label: '認定証明書交付申請 報酬', amount: results.reward });
        results.notes.push('認定証明書の交付に手数料はかかりません');
      } else if (answers.type === 'change') {
        const fees = { work: 100000, spouse: 100000, business: 150000, family: 80000, other: 100000 };
        results.officialFee = 4000;
        results.reward = fees[answers.visaType] || 100000;
        results.items.push({ label: '在留資格変更 報酬', amount: results.reward });
        results.items.push({ label: '収入印紙', amount: 4000, type: 'official' });
      } else if (answers.type === 'renew') {
        const fees = { work: 50000, spouse: 50000, business: 80000, family: 40000, other: 50000 };
        results.officialFee = 4000;
        results.reward = fees[answers.visaType] || 50000;
        results.items.push({ label: '在留期間更新 報酬', amount: results.reward });
        results.items.push({ label: '収入印紙', amount: 4000, type: 'official' });
        results.notes.push('スムーズな更新は報酬を割引きする場合あり');
      } else if (answers.type === 'permanent') {
        results.officialFee = 8000;
        results.reward = 120000;
        results.items.push({ label: '永住許可申請 報酬', amount: 120000 });
        results.items.push({ label: '収入印紙', amount: 8000, type: 'official' });
      } else if (answers.type === 'naturalize') {
        results.reward = 200000;
        results.items.push({ label: '帰化申請 報酬', amount: 200000 });
        results.notes.push('家族同時申請の場合、2人目以降は割引あり');
        results.notes.push('申請から許可まで約10〜12ヶ月かかります');
      }

      return results;
    }
  },

  // ============================================================
  // 車庫証明
  // ============================================================
  vehicle: {
    title: '車庫証明 報酬シミュレーター',
    icon: '🚗',
    steps: [
      {
        id: 'type',
        question: '車両の種類は？',
        type: 'select',
        options: [
          { label: '普通自動車', value: 'normal' },
          { label: '軽自動車', value: 'light' }
        ]
      },
      {
        id: 'parkType',
        question: '駐車場の種類は？',
        type: 'select',
        options: [
          { label: '自己所有の土地', value: 'own' },
          { label: '賃貸駐車場', value: 'rent' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'normal') {
        results.officialFee = 2600;
        results.reward = 8000;
        results.items.push({ label: '車庫証明 申請報酬', amount: 8000 });
        results.items.push({ label: '印紙代', amount: 2600, type: 'official' });
        if (answers.parkType === 'rent') {
          results.notes.push('賃貸借契約書のコピーまたは使用承諾証明書が必要');
        }
      } else {
        results.officialFee = 500;
        results.reward = 5000;
        results.items.push({ label: '軽自動車 届出報酬', amount: 5000 });
        results.items.push({ label: '印紙代', amount: 500, type: 'official' });
        results.notes.push('地域によっては届出不要の場合あり');
      }

      results.notes.push('ディーラー様は継続ご依頼で割引あり');
      return results;
    }
  },

  // ============================================================
  // 契約書・内容証明
  // ============================================================
  contract: {
    title: '契約書・内容証明 報酬シミュレーター',
    icon: '📑',
    steps: [
      {
        id: 'type',
        question: '依頼内容は？',
        type: 'select',
        options: [
          { label: '契約書の新規作成', value: 'new' },
          { label: '契約書のチェック（リーガルチェック）', value: 'check' },
          { label: '内容証明郵便の作成', value: 'naiyou' },
          { label: '示談書・和解書の作成', value: 'settlement' }
        ]
      },
      {
        id: 'complexity',
        question: '内容の複雑さは？',
        type: 'select',
        showIf: { type: ['new'] },
        options: [
          { label: '定型的な契約（売買、賃貸等）', value: 'simple' },
          { label: 'やや複雑（業務委託、合意書等）', value: 'mid' },
          { label: '複雑（M&A関連、共同事業等）', value: 'complex' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'new') {
        const fees = { simple: 30000, mid: 50000, complex: 100000 };
        results.reward = fees[answers.complexity] || 50000;
        results.items.push({ label: '契約書作成 報酬', amount: results.reward });
      } else if (answers.type === 'check') {
        results.reward = 20000;
        results.items.push({ label: 'リーガルチェック 報酬', amount: 20000 });
        results.notes.push('修正提案付き。軽微な修正は無料対応');
      } else if (answers.type === 'naiyou') {
        results.reward = 40000;
        results.officialFee = 1500;
        results.items.push({ label: '内容証明 作成報酬', amount: 40000 });
        results.items.push({ label: '郵便料金（目安）', amount: 1500, type: 'official' });
      } else if (answers.type === 'settlement') {
        results.reward = 50000;
        results.items.push({ label: '示談書・和解書 作成', amount: 50000 });
      }

      return results;
    }
  },

  // ============================================================
  // 産業廃棄物
  // ============================================================
  waste: {
    title: '産業廃棄物 報酬シミュレーター',
    icon: '♻️',
    steps: [
      {
        id: 'type',
        question: '許可の種類は？',
        type: 'select',
        options: [
          { label: '収集運搬業（新規）', value: 'collect_new' },
          { label: '収集運搬業（更新）', value: 'collect_renew' },
          { label: '処分業（新規）', value: 'dispose_new' },
          { label: '処分業（更新）', value: 'dispose_renew' }
        ]
      },
      {
        id: 'pref',
        question: '申請する都道府県の数は？',
        type: 'select',
        showIf: { type: ['collect_new', 'collect_renew'] },
        options: [
          { label: '1県', value: '1' },
          { label: '2県', value: '2' },
          { label: '3県以上', value: '3plus' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'collect_new') {
        results.officialFee = 81000;
        results.reward = 100000;
        const prefCount = answers.pref === '1' ? 1 : answers.pref === '2' ? 2 : 3;
        if (prefCount >= 2) {
          results.reward += 70000 * (prefCount - 1);
          results.officialFee = 81000 * prefCount;
          results.notes.push(`${prefCount}県分の申請です。追加県は割引適用`);
        }
        results.items.push({ label: '収集運搬業（新規）報酬', amount: results.reward });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
      } else if (answers.type === 'collect_renew') {
        results.officialFee = 73000;
        results.reward = 70000;
        const prefCount = answers.pref === '1' ? 1 : answers.pref === '2' ? 2 : 3;
        if (prefCount >= 2) {
          results.reward += 50000 * (prefCount - 1);
          results.officialFee = 73000 * prefCount;
        }
        results.items.push({ label: '収集運搬業（更新）報酬', amount: results.reward });
        results.items.push({ label: '行政庁 手数料', amount: results.officialFee, type: 'official' });
      } else if (answers.type === 'dispose_new') {
        results.officialFee = 100000;
        results.reward = 200000;
        results.items.push({ label: '処分業（新規）報酬', amount: 200000 });
        results.items.push({ label: '行政庁 手数料', amount: 100000, type: 'official' });
      } else if (answers.type === 'dispose_renew') {
        results.officialFee = 94000;
        results.reward = 120000;
        results.items.push({ label: '処分業（更新）報酬', amount: 120000 });
        results.items.push({ label: '行政庁 手数料', amount: 94000, type: 'official' });
      }

      results.notes.push('講習会の受講が許可要件です（受講費別途）');
      return results;
    }
  },

  // ============================================================
  // 運送業許可
  // ============================================================
  transport: {
    title: '運送業許可 報酬シミュレーター',
    icon: '🚛',
    steps: [
      {
        id: 'type',
        question: '許可の種類は？',
        type: 'select',
        options: [
          { label: '一般貨物自動車運送事業（新規）', value: 'freight_new' },
          { label: '一般貨物（変更認可）', value: 'freight_change' },
          { label: '貨物軽自動車運送事業（届出）', value: 'light' },
          { label: '第一種利用運送事業（登録）', value: 'forwarding' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === 'freight_new') {
        results.officialFee = 120000;
        results.reward = 400000;
        results.items.push({ label: '一般貨物 新規許可 報酬', amount: 400000 });
        results.items.push({ label: '登録免許税', amount: 120000, type: 'official' });
        results.notes.push('申請から許可まで4〜6ヶ月かかります');
        results.notes.push('法令試験対策のサポート含む');
        results.notes.push('車両5台以上が必要です');
      } else if (answers.type === 'freight_change') {
        results.reward = 100000;
        results.items.push({ label: '変更認可申請 報酬', amount: 100000 });
        results.notes.push('営業所・車庫の変更等');
      } else if (answers.type === 'light') {
        results.reward = 30000;
        results.items.push({ label: '軽貨物 届出報酬', amount: 30000 });
        results.notes.push('届出のため比較的スピーディに開始可能');
      } else if (answers.type === 'forwarding') {
        results.officialFee = 90000;
        results.reward = 150000;
        results.items.push({ label: '利用運送 登録報酬', amount: 150000 });
        results.items.push({ label: '登録免許税', amount: 90000, type: 'official' });
      }

      return results;
    }
  },

  // ============================================================
  // 農地転用
  // ============================================================
  agriculture: {
    title: '農地転用 報酬シミュレーター',
    icon: '🌾',
    steps: [
      {
        id: 'type',
        question: '手続きの種類は？',
        type: 'select',
        options: [
          { label: '4条許可（自分の農地を転用）', value: '4jou' },
          { label: '5条許可（他人の農地を取得して転用）', value: '5jou' },
          { label: '4条届出（市街化区域）', value: '4todoke' },
          { label: '5条届出（市街化区域）', value: '5todoke' }
        ]
      },
      {
        id: 'area',
        question: '農地の面積は？',
        type: 'select',
        showIf: { type: ['4jou', '5jou'] },
        options: [
          { label: '500㎡未満', value: 'small' },
          { label: '500〜1000㎡', value: 'mid' },
          { label: '1000㎡以上', value: 'large' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      if (answers.type === '4jou' || answers.type === '5jou') {
        const label = answers.type === '4jou' ? '4条許可申請' : '5条許可申請';
        const fees = { small: 80000, mid: 100000, large: 130000 };
        results.reward = fees[answers.area] || 100000;
        results.items.push({ label: label + ' 報酬', amount: results.reward });
        results.notes.push('農業委員会の審査（月1回）があるため、申請タイミングが重要');
        results.notes.push('土地改良区の意見書が必要な場合あり（決済金別途）');
      } else {
        const label = answers.type === '4todoke' ? '4条届出' : '5条届出';
        results.reward = 40000;
        results.items.push({ label: label + ' 報酬', amount: 40000 });
        results.notes.push('市街化区域のため届出で対応可能');
      }

      return results;
    }
  },

  // ============================================================
  // 補助金・助成金
  // ============================================================
  subsidy: {
    title: '補助金・助成金 報酬シミュレーター',
    icon: '💰',
    steps: [
      {
        id: 'type',
        question: '補助金の種類は？',
        type: 'select',
        options: [
          { label: '小規模事業者持続化補助金', value: 'jizokuka' },
          { label: 'ものづくり補助金', value: 'monozukuri' },
          { label: 'IT導入補助金', value: 'it' },
          { label: '事業再構築補助金', value: 'saikouchiku' },
          { label: 'その他の補助金', value: 'other' }
        ]
      },
      {
        id: 'service',
        question: '依頼内容は？',
        type: 'select',
        options: [
          { label: '事業計画書の作成支援 + 申請', value: 'full' },
          { label: '事業計画書の作成支援のみ', value: 'plan_only' },
          { label: '交付申請・実績報告のみ', value: 'report' }
        ]
      }
    ],
    calculate: (answers) => {
      const results = { items: [], officialFee: 0, reward: 0, notes: [] };

      const baseRewards = {
        jizokuka: { full: 80000, plan_only: 50000, report: 40000 },
        monozukuri: { full: 150000, plan_only: 100000, report: 60000 },
        it: { full: 80000, plan_only: 50000, report: 30000 },
        saikouchiku: { full: 200000, plan_only: 150000, report: 80000 },
        other: { full: 100000, plan_only: 70000, report: 50000 }
      };

      const typeLabels = {
        jizokuka: '小規模事業者持続化補助金',
        monozukuri: 'ものづくり補助金',
        it: 'IT導入補助金',
        saikouchiku: '事業再構築補助金',
        other: 'その他の補助金'
      };

      const serviceLabels = {
        full: '計画作成＋申請代行',
        plan_only: '計画書作成支援',
        report: '交付申請・実績報告'
      };

      const base = baseRewards[answers.type]?.[answers.service] || 100000;
      results.reward = base;
      results.items.push({
        label: `${typeLabels[answers.type]} ${serviceLabels[answers.service]}`,
        amount: base
      });

      // 成功報酬の説明
      if (answers.service === 'full') {
        const successFeeRate = answers.type === 'jizokuka' ? '5〜10%' : '5〜8%';
        results.notes.push(`採択時の成功報酬：補助金額の${successFeeRate}（別途）`);
      }

      results.notes.push('gBizIDプライムの取得がまだの方は、早めの申請を推奨');
      results.notes.push('補助金は後払い（精算払い）です。先に自己資金での支出が必要');

      if (answers.type === 'monozukuri' || answers.type === 'saikouchiku') {
        results.notes.push('認定経営革新等支援機関の確認書が必要です');
      }

      return results;
    }
  }
};
