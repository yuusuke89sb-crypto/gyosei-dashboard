// 電話相談用 問い合わせフローデータ
const INQUIRY_FLOWS = {
  categories: [
    { id: 'construction', name: '建設業許可', icon: '🏗️', color: '#059669' },
    { id: 'inheritance', name: '相続・遺言', icon: '📜', color: '#DC2626' },
    { id: 'company', name: '会社設立', icon: '🏢', color: '#D97706' },
    { id: 'food', name: '飲食店営業許可', icon: '🍽️', color: '#EA580C' },
    { id: 'immigration', name: '在留資格', icon: '🌍', color: '#7C3AED' },
    { id: 'vehicle', name: '車庫証明', icon: '🚗', color: '#2563EB' },
    { id: 'contract', name: '契約書・内容証明', icon: '📝', color: '#0891B2' },
    { id: 'waste', name: '産業廃棄物', icon: '♻️', color: '#65A30D' },
    { id: 'transport', name: '運送業許可', icon: '🚛', color: '#BE185D' },
    { id: 'agriculture', name: '農地転用', icon: '🌾', color: '#854D0E' }
  ],

  flows: {
    // ===== 建設業許可 =====
    construction: {
      title: '建設業許可 確認フロー',
      steps: [
        {
          id: 'type',
          question: '申請の種類を教えてください',
          type: 'choice',
          choices: [
            { label: '新規申請', value: 'new', next: 'license_type', icon: '🆕' },
            { label: '更新申請', value: 'renewal', next: 'renewal_check', icon: '🔄' },
            { label: '業種追加', value: 'addition', next: 'license_type', icon: '➕' }
          ]
        },
        {
          id: 'renewal_check',
          question: '毎年の決算変更届（事業年度終了届）は提出済みですか？',
          type: 'yesno',
          yes: { next: 'renewal_expiry', note: '✅ 決算変更届は提出済み' },
          no: { next: 'renewal_expiry', note: '⚠️ 決算変更届が未提出 → 先に提出が必要' }
        },
        {
          id: 'renewal_expiry',
          question: '許可の有効期限まで30日以上ありますか？',
          type: 'yesno',
          yes: { next: 'manager_check', note: '✅ 期限に余裕あり' },
          no: { next: 'manager_check', note: '⚠️ 期限切迫 → 至急対応が必要。期限切れの場合は新規申請になります' }
        },
        {
          id: 'license_type',
          question: '許可の種類はどちらですか？',
          type: 'choice',
          choices: [
            { label: '知事許可（1つの都道府県に営業所）', value: 'governor', next: 'general_or_special', icon: '🏛️' },
            { label: '大臣許可（2つ以上の都道府県に営業所）', value: 'minister', next: 'general_or_special', icon: '🏢' }
          ]
        },
        {
          id: 'general_or_special',
          question: '一般建設業と特定建設業のどちらですか？',
          type: 'choice',
          info: '下請に出す金額が4,500万円以上（建築一式は7,000万円以上）の場合は特定建設業が必要です',
          choices: [
            { label: '一般建設業', value: 'general', next: 'manager_check', icon: '📋' },
            { label: '特定建設業', value: 'special', next: 'manager_check', icon: '⭐' },
            { label: 'わからない', value: 'unknown', next: 'subcontract_amount', icon: '❓' }
          ]
        },
        {
          id: 'subcontract_amount',
          question: '下請に出す工事金額はいくら位ですか？',
          type: 'choice',
          choices: [
            { label: '4,500万円未満', value: 'under', next: 'manager_check', note: '→ 一般建設業で可', icon: '📋' },
            { label: '4,500万円以上', value: 'over', next: 'manager_check', note: '→ 特定建設業が必要', icon: '⭐' },
            { label: '下請には出さない（自社施工のみ）', value: 'none', next: 'manager_check', note: '→ 一般建設業で可', icon: '🔧' }
          ]
        },
        {
          id: 'manager_check',
          question: '経営業務の管理責任者（経管）となれる方はいますか？',
          type: 'yesno',
          info: '建設業に関して5年以上の経営業務経験、又は5年以上補佐した経験がある方',
          yes: { next: 'tech_check', note: '✅ 経管候補あり' },
          no: { next: 'tech_check', note: '⚠️ 経管候補なし → 要件を満たす方の確保が必要' }
        },
        {
          id: 'tech_check',
          question: '専任技術者となれる方はいますか？',
          type: 'yesno',
          info: '施工管理技士等の資格保有者、又は10年以上の実務経験者',
          yes: { next: 'finance_check', note: '✅ 専任技術者候補あり' },
          no: { next: 'finance_check', note: '⚠️ 専任技術者候補なし → 資格取得or実務経験の確認が必要' }
        },
        {
          id: 'finance_check',
          question: '財産的基礎の要件を満たしていますか？',
          type: 'yesno',
          info: '一般：自己資本500万円以上 又は 500万円以上の資金調達能力\n特定：資本金2,000万円以上 、自己資本4,000万円以上 等',
          yes: { next: 'disqualification_check', note: '✅ 財産要件クリア' },
          no: { next: 'disqualification_check', note: '⚠️ 財産要件未達 → 要検討' }
        },
        {
          id: 'disqualification_check',
          question: '欠格要件に該当する事項はありませんか？',
          type: 'yesno',
          info: '破産者で復権を得ない者、禁錮以上の刑（執行後5年未満）等に該当しないこと',
          yes: { next: null, note: '✅ 欠格要件なし' },
          no: { next: null, note: '⚠️ 欠格要件に該当の可能性あり → 詳細確認が必要' }
        }
      ],
      summary: {
        title: '建設業許可 確認結果',
        documents: [
          '登記事項証明書',
          '身分証明書（本籍地の市区町村）',
          '略歴書',
          '財務諸表（直近事業年度分）',
          '工事経歴書',
          '技術者の資格証明書',
          '健康保険・厚生年金・雇用保険の加入証明書',
          '営業所の写真',
          '事務所の賃貸借契約書（賃貸の場合）'
        ],
        fees: {
          governor: { label: '知事許可', new: '9万円', renewal: '5万円' },
          minister: { label: '大臣許可', new: '15万円', renewal: '5万円' }
        },
        processing: '知事許可：約30日 / 大臣許可：約120日'
      }
    },

    // ===== 相続・遺言 =====
    inheritance: {
      title: '相続・遺言 確認フロー',
      steps: [
        {
          id: 'purpose',
          question: '相談の内容はどちらですか？',
          type: 'choice',
          choices: [
            { label: '相続手続き（亡くなった方がいる）', value: 'succession', next: 'death_date', icon: '📋' },
            { label: '遺言書の作成', value: 'will', next: 'will_type', icon: '📜' },
            { label: '生前対策の相談', value: 'planning', next: 'planning_type', icon: '💡' }
          ]
        },
        {
          id: 'death_date',
          question: 'お亡くなりになったのはいつ頃ですか？',
          type: 'choice',
          info: '相続放棄は3ヶ月以内、準確定申告は4ヶ月以内、相続税申告は10ヶ月以内の期限があります',
          choices: [
            { label: '1ヶ月以内', value: 'within1m', next: 'will_exists', note: '⚠️ 相続放棄期限まで約2ヶ月', icon: '🔴' },
            { label: '1〜3ヶ月前', value: 'within3m', next: 'will_exists', note: '⚠️ 相続放棄期限が迫っています', icon: '🟡' },
            { label: '3ヶ月〜10ヶ月前', value: 'within10m', next: 'will_exists', note: '⚠️ 相続税申告期限にご注意', icon: '🟠' },
            { label: '10ヶ月以上前', value: 'over10m', next: 'will_exists', note: '⚠️ 相続税の申告期限超過の可能性', icon: '🔵' }
          ]
        },
        {
          id: 'will_exists',
          question: '遺言書はありますか？',
          type: 'choice',
          choices: [
            { label: 'あり（公正証書遺言）', value: 'notarized', next: 'heirs_check', note: '✅ 検認不要。遺言内容に従って手続き', icon: '📄' },
            { label: 'あり（自筆証書遺言）', value: 'holographic', next: 'heirs_check', note: '⚠️ 家庭裁判所での検認が必要（法務局保管の場合は不要）', icon: '✏️' },
            { label: 'なし・不明', value: 'none', next: 'heirs_check', note: '→ 法定相続or遺産分割協議で対応', icon: '❓' }
          ]
        },
        {
          id: 'heirs_check',
          question: '相続人は把握できていますか？',
          type: 'yesno',
          info: '被相続人の出生から死亡までの連続した戸籍謄本が必要です',
          yes: { next: 'estate_check', note: '✅ 相続人把握済み（戸籍での確認をお勧めします）' },
          no: { next: 'estate_check', note: '⚠️ 相続人調査が必要 → 戸籍謄本の収集から開始' }
        },
        {
          id: 'estate_check',
          question: '相続財産の内容は把握できていますか？',
          type: 'choice',
          choices: [
            { label: 'おおよそ把握している', value: 'known', next: 'estate_type', note: '✅ 財産内容把握済み', icon: '✅' },
            { label: '一部のみ把握', value: 'partial', next: 'estate_type', note: '⚠️ 財産調査が必要（預貯金・不動産・有価証券等）', icon: '🔍' },
            { label: 'わからない', value: 'unknown', next: 'estate_type', note: '⚠️ 包括的な財産調査が必要', icon: '❓' }
          ]
        },
        {
          id: 'estate_type',
          question: '相続財産にはどのようなものがありますか？（複数確認）',
          type: 'checklist',
          items: [
            { label: '預貯金', key: 'deposits' },
            { label: '不動産（土地・建物）', key: 'realestate' },
            { label: '有価証券（株式・投資信託等）', key: 'securities' },
            { label: '自動車', key: 'vehicle' },
            { label: '生命保険金', key: 'insurance' },
            { label: '借入金・ローン（負の財産）', key: 'debt' },
            { label: 'その他（貴金属・骨董品等）', key: 'others' }
          ],
          next: 'dispute_check'
        },
        {
          id: 'dispute_check',
          question: '相続人間で争いはありますか？',
          type: 'yesno',
          yes: { next: null, note: '⚠️ 紛争あり → 弁護士への相談をお勧めします。行政書士は書類作成のサポートが可能です' },
          no: { next: null, note: '✅ 円満相続 → 遺産分割協議書の作成に進めます' }
        },
        // 遺言書作成フロー
        {
          id: 'will_type',
          question: 'どのような遺言書をご希望ですか？',
          type: 'choice',
          choices: [
            { label: '公正証書遺言（おすすめ）', value: 'notarized', next: 'will_contents', note: '✅ 安全性が高く、検認不要', icon: '⭐' },
            { label: '自筆証書遺言', value: 'holographic', next: 'will_contents', note: 'コストを抑えたい場合。法務局保管制度の利用をお勧め', icon: '✏️' },
            { label: 'まだ決めていない', value: 'undecided', next: 'will_contents', note: '→ 状況に応じてご提案します', icon: '❓' }
          ]
        },
        {
          id: 'will_contents',
          question: '遺言書に記載したい内容を確認します',
          type: 'checklist',
          items: [
            { label: '財産の分配方法', key: 'distribution' },
            { label: '特定の人への遺贈', key: 'bequest' },
            { label: '遺言執行者の指定', key: 'executor' },
            { label: '認知', key: 'acknowledgment' },
            { label: '付言事項（家族へのメッセージ）', key: 'appendix' }
          ],
          next: null
        },
        // 生前対策フロー
        {
          id: 'planning_type',
          question: 'どのような対策をお考えですか？',
          type: 'choice',
          choices: [
            { label: '遺言書の作成', value: 'will', next: 'will_type', icon: '📜' },
            { label: '任意後見契約', value: 'guardianship', next: null, note: '→ 公正証書による任意後見契約の作成をサポートします', icon: '🤝' },
            { label: '家族信託', value: 'trust', next: null, note: '→ 信託契約書の作成をサポートします。司法書士との連携が必要な場合もあります', icon: '🏠' },
            { label: '相続税対策の相談', value: 'tax', next: null, note: '→ 税理士をご紹介します。財産目録の作成は行政書士が対応可能です', icon: '💰' }
          ]
        }
      ],
      summary: {
        title: '相続・遺言 確認結果',
        documents: [
          '被相続人の出生から死亡までの戸籍謄本',
          '相続人全員の戸籍謄本',
          '相続人全員の住民票',
          '被相続人の住民票の除票',
          '固定資産評価証明書（不動産がある場合）',
          '預貯金の残高証明書',
          '不動産の登記事項証明書'
        ]
      }
    },

    // ===== 会社設立 =====
    company: {
      title: '会社設立 確認フロー',
      steps: [
        {
          id: 'company_type',
          question: '設立する会社の種類はどちらですか？',
          type: 'choice',
          choices: [
            { label: '株式会社', value: 'kabushiki', next: 'basic_info', icon: '🏢' },
            { label: '合同会社（LLC）', value: 'godo', next: 'basic_info', icon: '🏠' },
            { label: 'まだ決めていない', value: 'undecided', next: 'company_compare', icon: '❓' }
          ]
        },
        {
          id: 'company_compare',
          question: '事業の規模や目的を教えてください',
          type: 'choice',
          info: '株式会社：社会的信用が高い、上場可能。合同会社：設立費用が安い、経営の自由度が高い',
          choices: [
            { label: '小規模・少人数で費用を抑えたい', value: 'small', next: 'basic_info', note: '→ 合同会社がおすすめ', icon: '📦' },
            { label: '社会的信用を重視したい', value: 'trust', next: 'basic_info', note: '→ 株式会社がおすすめ', icon: '🏢' },
            { label: '将来的に上場や増資を考えている', value: 'growth', next: 'basic_info', note: '→ 株式会社が必須', icon: '📈' }
          ]
        },
        {
          id: 'basic_info',
          question: '基本事項を確認します',
          type: 'checklist',
          items: [
            { label: '商号（会社名）は決まっている', key: 'name' },
            { label: '事業目的は決まっている', key: 'purpose' },
            { label: '本店所在地は決まっている', key: 'address' },
            { label: '資本金額は決まっている', key: 'capital' },
            { label: '役員構成は決まっている', key: 'officers' },
            { label: '事業年度は決まっている', key: 'fiscal_year' }
          ],
          next: 'capital_amount'
        },
        {
          id: 'capital_amount',
          question: '資本金はいくらの予定ですか？',
          type: 'choice',
          info: '資本金1円から設立可能ですが、取引先の信用や融資の観点から一定額をお勧めします',
          choices: [
            { label: '100万円未満', value: 'under100', next: 'purpose_check', note: '定款認証手数料：3万円', icon: '💴' },
            { label: '100万〜300万円', value: 'under300', next: 'purpose_check', note: '定款認証手数料：4万円', icon: '💴' },
            { label: '300万円以上', value: 'over300', next: 'purpose_check', note: '定款認証手数料：5万円', icon: '💴' }
          ]
        },
        {
          id: 'purpose_check',
          question: '事業目的に許認可が必要な業種は含まれますか？',
          type: 'choice',
          choices: [
            { label: 'はい（建設業、飲食業、運送業等）', value: 'yes', next: 'electronic_articles', note: '⚠️ 定款の事業目的に許認可申請に適した表現を入れる必要があります', icon: '📋' },
            { label: 'いいえ', value: 'no', next: 'electronic_articles', note: '✅ 特別な対応不要', icon: '✅' },
            { label: 'わからない', value: 'unknown', next: 'electronic_articles', note: '→ 事業内容を詳しくお聞きして判断します', icon: '❓' }
          ]
        },
        {
          id: 'electronic_articles',
          question: '電子定款を利用しますか？',
          type: 'yesno',
          info: '電子定款の場合、収入印紙代4万円が不要になります',
          yes: { next: null, note: '✅ 電子定款 → 印紙代4万円が節約できます' },
          no: { next: null, note: '紙定款 → 収入印紙代4万円が必要です' }
        }
      ],
      summary: {
        title: '会社設立 確認結果',
        documents: [
          '発起人の印鑑証明書',
          '発起人の本人確認書類',
          '会社実印用の印鑑',
          '資本金の払込みを証する書面',
          '定款（行政書士が作成）'
        ],
        fees: {
          kabushiki: { label: '株式会社', total: '約20〜25万円（電子定款の場合）' },
          godo: { label: '合同会社', total: '約6〜10万円' }
        }
      }
    },

    // ===== 飲食店営業許可 =====
    food: {
      title: '飲食店営業許可 確認フロー',
      steps: [
        {
          id: 'business_type',
          question: 'お店の業態を教えてください',
          type: 'choice',
          choices: [
            { label: 'レストラン・食堂', value: 'restaurant', next: 'location_check', icon: '🍽️' },
            { label: 'カフェ・喫茶店', value: 'cafe', next: 'location_check', icon: '☕' },
            { label: '居酒屋・バー', value: 'bar', next: 'bar_type', icon: '🍺' },
            { label: 'テイクアウト・デリバリー専門', value: 'takeout', next: 'location_check', icon: '🥡' },
            { label: 'その他', value: 'other', next: 'location_check', icon: '🏪' }
          ]
        },
        {
          id: 'bar_type',
          question: '深夜0時以降も酒類を提供しますか？',
          type: 'yesno',
          info: '深夜0時以降のアルコール提供には「深夜酒類提供飲食店営業」の届出が必要です',
          yes: { next: 'location_check', note: '⚠️ 深夜酒類提供飲食店営業の届出が必要（警察署へ）' },
          no: { next: 'location_check', note: '✅ 飲食店営業許可のみで可' }
        },
        {
          id: 'location_check',
          question: '店舗物件は決まっていますか？',
          type: 'yesno',
          yes: { next: 'facility_check', note: '✅ 物件確定済み → 保健所への事前相談をお勧めします' },
          no: { next: 'facility_check', note: '→ 物件を探す段階で保健所への事前相談をお勧めします' }
        },
        {
          id: 'facility_check',
          question: '施設基準の確認をします',
          type: 'checklist',
          items: [
            { label: '2槽以上のシンク', key: 'sink' },
            { label: '手洗い設備（レバー式・センサー式等）', key: 'handwash' },
            { label: '十分な換気設備', key: 'ventilation' },
            { label: '防虫・防鼠設備（網戸等）', key: 'pest' },
            { label: '食品・器具の保管設備', key: 'storage' },
            { label: '冷蔵・冷凍設備（温度計付き）', key: 'refrigeration' },
            { label: 'トイレ（調理場と区画）', key: 'restroom' }
          ],
          next: 'responsible_person'
        },
        {
          id: 'responsible_person',
          question: '食品衛生責任者の資格はお持ちですか？',
          type: 'choice',
          choices: [
            { label: '調理師免許あり', value: 'chef', next: null, note: '✅ 食品衛生責任者としてそのまま適任', icon: '👨‍🍳' },
            { label: '栄養士免許あり', value: 'dietitian', next: null, note: '✅ 食品衛生責任者としてそのまま適任', icon: '🍎' },
            { label: '食品衛生責任者養成講習会を修了', value: 'trained', next: null, note: '✅ 食品衛生責任者として適任', icon: '📝' },
            { label: '資格なし', value: 'none', next: null, note: '⚠️ 食品衛生責任者養成講習会の受講が必要（約1日・約1万円）', icon: '❌' }
          ]
        }
      ],
      summary: {
        title: '飲食店営業許可 確認結果',
        documents: [
          '営業許可申請書',
          '施設の構造・設備を示す図面',
          '食品衛生責任者の資格証明書',
          '水質検査成績書（必要な場合）',
          '登記事項証明書（法人の場合）'
        ],
        fees: { license: '約16,000〜19,000円（都道府県により異なる）' },
        processing: '申請から許可まで約2〜3週間'
      }
    },

    // ===== 在留資格 =====
    immigration: {
      title: '在留資格 確認フロー',
      steps: [
        {
          id: 'purpose',
          question: '手続きの内容を教えてください',
          type: 'choice',
          choices: [
            { label: '新規で日本に呼び寄せたい（在留資格認定証明書）', value: 'coe', next: 'visa_type', icon: '✈️' },
            { label: '在留資格を変更したい', value: 'change', next: 'visa_type', icon: '🔄' },
            { label: '在留期間を更新したい', value: 'extension', next: 'extension_check', icon: '📅' },
            { label: '永住許可を申請したい', value: 'permanent', next: 'permanent_check', icon: '🏠' }
          ]
        },
        {
          id: 'visa_type',
          question: 'どのような在留資格ですか？',
          type: 'choice',
          choices: [
            { label: '就労系（技人国、技能など）', value: 'work', next: 'work_detail', icon: '💼' },
            { label: '身分系（配偶者、定住者など）', value: 'status', next: 'status_detail', icon: '👨‍👩‍👧' },
            { label: '経営・管理', value: 'business', next: 'business_check', icon: '🏢' },
            { label: '特定技能', value: 'specific', next: 'specific_check', icon: '🔧' },
            { label: 'その他・わからない', value: 'other', next: null, note: '→ 詳しい状況をお聞きして適切な在留資格をご提案します', icon: '❓' }
          ]
        },
        {
          id: 'work_detail',
          question: '申請者の学歴・職歴を確認します',
          type: 'checklist',
          items: [
            { label: '大学卒業（学士以上）又は日本の専門学校卒業', key: 'education' },
            { label: '業務に関連する専攻', key: 'major' },
            { label: '10年以上の実務経験（学歴がない場合）', key: 'experience' },
            { label: '雇用先の企業が確定している', key: 'employer' },
            { label: '雇用契約書がある', key: 'contract' }
          ],
          next: null
        },
        {
          id: 'status_detail',
          question: '具体的な在留資格はどれですか？',
          type: 'choice',
          choices: [
            { label: '日本人の配偶者等', value: 'spouse_jp', next: null, note: '→ 婚姻届受理証明書、交際経緯書等が必要', icon: '💑' },
            { label: '永住者の配偶者等', value: 'spouse_pr', next: null, note: '→ 永住者の在留カード、婚姻証明書等が必要', icon: '💑' },
            { label: '定住者', value: 'long_term', next: null, note: '→ 日系人等。身分を証する文書が必要', icon: '🏠' }
          ]
        },
        {
          id: 'business_check',
          question: '経営・管理ビザの要件を確認します',
          type: 'checklist',
          items: [
            { label: '事業所（オフィス）が確保されている', key: 'office' },
            { label: '資本金500万円以上 又は 常勤職員2名以上', key: 'capital' },
            { label: '事業計画書が作成されている', key: 'business_plan' },
            { label: '事業の継続性・安定性がある', key: 'stability' }
          ],
          next: null
        },
        {
          id: 'specific_check',
          question: '特定技能の確認事項です',
          type: 'checklist',
          items: [
            { label: '対象分野の技能試験に合格している', key: 'skill_test' },
            { label: '日本語能力試験N4以上に合格している', key: 'japanese_test' },
            { label: '受入れ企業が決まっている', key: 'employer' },
            { label: '特定技能雇用契約が締結されている', key: 'contract' },
            { label: '登録支援機関が確定している（1号の場合）', key: 'support' }
          ],
          next: null
        },
        {
          id: 'extension_check',
          question: '在留期間更新の確認事項です',
          type: 'checklist',
          items: [
            { label: '在留期限の3ヶ月前から申請可能', key: 'timing' },
            { label: '現在の在留資格の活動を継続している', key: 'activity' },
            { label: '税金・年金・健康保険を納付している', key: 'obligations' },
            { label: '届出義務を履行している', key: 'notifications' },
            { label: '在留カードの有効期限を確認した', key: 'card' }
          ],
          next: null
        },
        {
          id: 'permanent_check',
          question: '永住許可の要件を確認します',
          type: 'checklist',
          items: [
            { label: '引き続き10年以上日本に在留（特例あり）', key: 'residence' },
            { label: 'うち5年以上就労資格で在留', key: 'work_years' },
            { label: '最長の在留期間（5年）を持っている', key: 'max_period' },
            { label: '年収300万円以上（扶養家族により加算）', key: 'income' },
            { label: '税金・年金・健康保険をすべて納付している', key: 'taxes' },
            { label: '交通違反等がない（素行善良）', key: 'conduct' }
          ],
          next: null
        }
      ],
      summary: {
        title: '在留資格 確認結果',
        documents: [
          '在留資格認定証明書交付申請書 又は 変更・更新申請書',
          'パスポートのコピー',
          '在留カードのコピー',
          '証明写真（4cm×3cm）',
          '雇用契約書（就労系の場合）',
          '会社の登記事項証明書',
          '会社の決算報告書',
          '理由書'
        ]
      }
    },

    // ===== 車庫証明 =====
    vehicle: {
      title: '車庫証明 確認フロー',
      steps: [
        {
          id: 'vehicle_type',
          question: '車両の種類を教えてください',
          type: 'choice',
          choices: [
            { label: '普通自動車', value: 'regular', next: 'reason', icon: '🚗' },
            { label: '軽自動車', value: 'kei', next: 'kei_area', icon: '🚙' }
          ]
        },
        {
          id: 'kei_area',
          question: '届出が必要な地域にお住まいですか？',
          type: 'yesno',
          info: '軽自動車は一部の地域のみ届出が必要です（概ね人口10万人以上の市など）',
          yes: { next: 'reason', note: '→ 軽自動車の保管場所届出が必要' },
          no: { next: null, note: '✅ 届出不要の地域です' }
        },
        {
          id: 'reason',
          question: '申請の理由は何ですか？',
          type: 'choice',
          choices: [
            { label: '新車購入', value: 'new', next: 'parking_type', icon: '🆕' },
            { label: '中古車購入', value: 'used', next: 'parking_type', icon: '🔄' },
            { label: '名義変更', value: 'transfer', next: 'parking_type', icon: '📋' },
            { label: '引越し（転居）', value: 'move', next: 'parking_type', icon: '🏠' }
          ]
        },
        {
          id: 'parking_type',
          question: '駐車場は自己所有ですか？賃貸ですか？',
          type: 'choice',
          choices: [
            { label: '自己所有', value: 'own', next: 'distance_check', note: '→ 自認書が必要', icon: '🏠' },
            { label: '賃貸（月極駐車場）', value: 'rental', next: 'distance_check', note: '→ 保管場所使用承諾証明書 又は 賃貸借契約書のコピーが必要', icon: '🅿️' },
            { label: '親族・知人所有の土地', value: 'relative', next: 'distance_check', note: '→ 保管場所使用承諾証明書が必要', icon: '👨‍👩‍👧' }
          ]
        },
        {
          id: 'distance_check',
          question: '駐車場は自宅（使用の本拠）から直線距離2km以内ですか？',
          type: 'yesno',
          info: '自動車の保管場所は使用の本拠の位置から直線距離で2km以内でなければなりません',
          yes: { next: 'size_check', note: '✅ 距離要件クリア' },
          no: { next: 'size_check', note: '⚠️ 距離要件を満たしません → 別の駐車場を検討してください' }
        },
        {
          id: 'size_check',
          question: '駐車場は車両全体を収容できる広さがありますか？',
          type: 'yesno',
          yes: { next: null, note: '✅ サイズ要件クリア' },
          no: { next: null, note: '⚠️ サイズ要件を満たしません → 別の駐車場を検討してください' }
        }
      ],
      summary: {
        title: '車庫証明 確認結果',
        documents: [
          '自動車保管場所証明申請書（2通）',
          '保管場所標章交付申請書（2通）',
          '保管場所の所在図・配置図',
          '自認書（自己所有の場合）',
          '保管場所使用承諾証明書 又は 賃貸借契約書（賃貸の場合）',
          '車検証のコピー'
        ],
        fees: { application: '約2,100円', seal: '約500円' },
        processing: '申請から約3〜7営業日'
      }
    },

    // ===== 契約書・内容証明 =====
    contract: {
      title: '契約書・内容証明 確認フロー',
      steps: [
        {
          id: 'purpose',
          question: 'どのようなご相談ですか？',
          type: 'choice',
          choices: [
            { label: '契約書の作成', value: 'create', next: 'contract_type', icon: '📝' },
            { label: '契約書のチェック・修正', value: 'review', next: 'review_detail', icon: '🔍' },
            { label: '内容証明郵便の作成', value: 'certified', next: 'certified_purpose', icon: '✉️' }
          ]
        },
        {
          id: 'contract_type',
          question: '契約の種類はどれですか？',
          type: 'choice',
          choices: [
            { label: '売買契約書', value: 'sales', next: 'contract_checklist', icon: '🤝' },
            { label: '賃貸借契約書', value: 'lease', next: 'contract_checklist', icon: '🏠' },
            { label: '業務委託契約書', value: 'outsource', next: 'contract_checklist', icon: '💼' },
            { label: '請負契約書', value: 'subcontract', next: 'contract_checklist', icon: '🔧' },
            { label: '秘密保持契約書（NDA）', value: 'nda', next: 'contract_checklist', icon: '🔒' },
            { label: 'その他', value: 'other', next: 'contract_checklist', icon: '📋' }
          ]
        },
        {
          id: 'contract_checklist',
          question: '契約書作成に必要な情報を確認します',
          type: 'checklist',
          items: [
            { label: '契約当事者の情報（名称・住所等）', key: 'parties' },
            { label: '契約の対象・目的', key: 'subject' },
            { label: '報酬・対価', key: 'payment' },
            { label: '契約期間', key: 'period' },
            { label: '解除条件', key: 'termination' },
            { label: '反社会的勢力排除条項', key: 'antisocial' }
          ],
          next: null
        },
        {
          id: 'review_detail',
          question: '契約書チェックの確認事項です',
          type: 'checklist',
          items: [
            { label: 'チェックする契約書が手元にある', key: 'document' },
            { label: '特に気になる点がある', key: 'concerns' },
            { label: '契約相手方との交渉段階', key: 'negotiation' }
          ],
          next: null
        },
        {
          id: 'certified_purpose',
          question: '内容証明郵便の目的は何ですか？',
          type: 'choice',
          choices: [
            { label: '未払い代金の催告（督促）', value: 'demand', next: 'certified_checklist', icon: '💰' },
            { label: '契約解除通知', value: 'terminate', next: 'certified_checklist', icon: '✂️' },
            { label: 'クーリングオフ', value: 'cooling_off', next: 'certified_checklist', icon: '🔙' },
            { label: '損害賠償請求', value: 'damage', next: 'certified_checklist', note: '⚠️ 弁護士法に抵触しない範囲での書類作成', icon: '⚠️' },
            { label: 'その他', value: 'other', next: 'certified_checklist', icon: '📋' }
          ]
        },
        {
          id: 'certified_checklist',
          question: '内容証明郵便の送付に必要な情報を確認します',
          type: 'checklist',
          items: [
            { label: '差出人の情報（氏名・住所）', key: 'sender' },
            { label: '相手方の情報（氏名・住所）', key: 'recipient' },
            { label: '請求の根拠となる事実', key: 'facts' },
            { label: '具体的な請求内容', key: 'demand' },
            { label: '回答期限', key: 'deadline' }
          ],
          next: null
        }
      ],
      summary: {
        title: '契約書・内容証明 確認結果',
        documents: []
      }
    },

    // ===== 産業廃棄物 =====
    waste: {
      title: '産業廃棄物許可 確認フロー',
      steps: [
        {
          id: 'permit_type',
          question: '許可の種類はどれですか？',
          type: 'choice',
          choices: [
            { label: '収集運搬業', value: 'transport', next: 'transport_check', icon: '🚛' },
            { label: '中間処理業', value: 'processing', next: null, note: '→ 施設の設置許可等の詳細確認が必要です', icon: '🏭' },
            { label: '最終処分業', value: 'disposal', next: null, note: '→ 施設の設置許可等の詳細確認が必要です', icon: '🏗️' }
          ]
        },
        {
          id: 'transport_check',
          question: '収集運搬業許可の要件を確認します',
          type: 'checklist',
          items: [
            { label: '講習会を修了している（又は受講予定）', key: 'training' },
            { label: '収集運搬用の車両がある', key: 'vehicle' },
            { label: '適切な容器・収容設備がある', key: 'equipment' },
            { label: '経理的基礎がある（決算書で確認）', key: 'finance' },
            { label: '欠格要件に該当しない', key: 'disqualification' }
          ],
          next: 'storage_check'
        },
        {
          id: 'storage_check',
          question: '積替え保管を行いますか？',
          type: 'yesno',
          yes: { next: null, note: '⚠️ 積替え保管ありの場合、別途の申請・施設基準への適合が必要' },
          no: { next: null, note: '✅ 積替え保管なし → 通常の収集運搬業許可で対応可能' }
        }
      ],
      summary: {
        title: '産業廃棄物許可 確認結果',
        documents: [
          '許可申請書',
          '事業計画書',
          '講習会修了証のコピー',
          '車両写真・車検証のコピー',
          '直近3年分の財務諸表（法人）',
          '登記事項証明書',
          '住民票・身分証明書',
          '誓約書'
        ],
        fees: { new: '81,000円', renewal: '73,000円' },
        processing: '有効期間：5年（優良認定は7年）'
      }
    },

    // ===== 運送業許可 =====
    transport: {
      title: '運送業許可 確認フロー',
      steps: [
        {
          id: 'transport_type',
          question: '運送業の種類はどれですか？',
          type: 'choice',
          choices: [
            { label: '一般貨物自動車運送事業（トラック）', value: 'freight', next: 'freight_check', icon: '🚛' },
            { label: '貨物軽自動車運送事業（軽貨物）', value: 'light', next: 'light_check', icon: '🚐' },
            { label: '一般旅客自動車運送事業（タクシー・バス）', value: 'passenger', next: null, note: '→ 詳細な要件確認が必要です', icon: '🚌' }
          ]
        },
        {
          id: 'freight_check',
          question: '一般貨物の要件を確認します',
          type: 'checklist',
          items: [
            { label: '事業用自動車5台以上を確保できる', key: 'vehicles' },
            { label: '営業所が確保されている', key: 'office' },
            { label: '車庫が確保されている（営業所から10km以内）', key: 'garage' },
            { label: '運行管理者資格者がいる', key: 'manager' },
            { label: '整備管理者がいる', key: 'mechanic' },
            { label: '自己資金1,500万〜2,500万円以上がある', key: 'capital' }
          ],
          next: null
        },
        {
          id: 'light_check',
          question: '軽貨物の要件を確認します',
          type: 'checklist',
          items: [
            { label: '軽自動車（貨物用）がある', key: 'vehicle' },
            { label: '営業所が確保されている', key: 'office' },
            { label: '車庫が確保されている', key: 'garage' }
          ],
          next: null
        }
      ],
      summary: {
        title: '運送業許可 確認結果',
        documents: [],
        fees: { registration_tax: '120,000円（一般貨物）' },
        processing: '一般貨物：3〜6ヶ月 / 軽貨物：届出制（即日〜数日）'
      }
    },

    // ===== 農地転用 =====
    agriculture: {
      title: '農地転用 確認フロー',
      steps: [
        {
          id: 'conversion_type',
          question: '農地転用の種類はどれですか？',
          type: 'choice',
          info: '4条：自分の農地を転用、5条：他人の農地を買って（借りて）転用',
          choices: [
            { label: '4条（自己所有農地の転用）', value: 'art4', next: 'zone_check', icon: '🏠' },
            { label: '5条（転用目的の権利移動）', value: 'art5', next: 'zone_check', icon: '🤝' },
            { label: '3条（農地のまま権利移動）', value: 'art3', next: null, note: '→ 農業委員会への許可申請が必要', icon: '🌾' },
            { label: 'わからない', value: 'unknown', next: 'zone_check', note: '→ 状況を詳しくお聞きします', icon: '❓' }
          ]
        },
        {
          id: 'zone_check',
          question: '農地の区分を確認してください',
          type: 'choice',
          choices: [
            { label: '農用地区域内農地（青地）', value: 'blue', next: 'purpose_check', note: '⚠️ 原則不許可。除外手続きが必要', icon: '🔵' },
            { label: '第1種農地', value: 'type1', next: 'purpose_check', note: '⚠️ 原則不許可（例外あり）', icon: '🟢' },
            { label: '第2種農地', value: 'type2', next: 'purpose_check', note: '代替地がなければ許可の可能性あり', icon: '🟡' },
            { label: '第3種農地', value: 'type3', next: 'purpose_check', note: '✅ 原則許可', icon: '⭐' },
            { label: 'わからない', value: 'unknown', next: 'purpose_check', note: '→ 農業委員会等で確認が必要', icon: '❓' }
          ]
        },
        {
          id: 'purpose_check',
          question: '転用の目的を教えてください',
          type: 'choice',
          choices: [
            { label: '住宅の建設', value: 'housing', next: 'area_check', icon: '🏠' },
            { label: '事業用施設の建設', value: 'business', next: 'area_check', icon: '🏢' },
            { label: '太陽光発電設備の設置', value: 'solar', next: 'area_check', icon: '☀️' },
            { label: '駐車場', value: 'parking', next: 'area_check', icon: '🅿️' },
            { label: 'その他', value: 'other', next: 'area_check', icon: '📋' }
          ]
        },
        {
          id: 'area_check',
          question: '市街化区域の農地ですか？',
          type: 'yesno',
          info: '市街化区域内の農地は「届出」のみで転用可能です',
          yes: { next: null, note: '✅ 市街化区域 → 届出制（許可不要）で手続き可能' },
          no: { next: null, note: '→ 農業委員会を経由した都道府県知事等への許可申請が必要' }
        }
      ],
      summary: {
        title: '農地転用 確認結果',
        documents: [
          '農地転用許可申請書',
          '土地の登記事項証明書',
          '公図',
          '位置図・現況図',
          '事業計画書',
          '資金計画書・残高証明書',
          '建物の設計図面（建設の場合）',
          '土地利用計画図'
        ],
        processing: '許可まで約1〜3ヶ月（農業委員会の総会日程による）'
      }
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = INQUIRY_FLOWS;
}
