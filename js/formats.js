/**
 * 書式ライブラリ モジュール
 */
const Formats = {
  currentTab: 'templates', // 'templates', 'knowhow', 'marketing', 'alliance'
  categoryFilter: 'all',
  searchQuery: '',

  PATHS: {
    format: "../../.agents/skills/gyosei_office_knowledge/references/行政書士開業者のための、これだけで十分足りる、書式集パック（書式ファイル）/",
    format_supp: "../../.agents/skills/gyosei_office_knowledge/references/行政書士開業者のための、これだけで十分足りる、書式集パック（書式ファイル（追録））/",
    text: "../../.agents/skills/gyosei_office_knowledge/references/行政書士開業者のための、これだけで十分足りる、書式集パック（前提知識テキストファイル）/",
    text_supp: "../../.agents/skills/gyosei_office_knowledge/references/行政書士開業者のための、これだけで十分足りる、書式集パック（前提知識テキストファイル（追録））/",
    marketing: "../../.agents/skills/gyosei_office_knowledge/references/購入者特典①「費用0円でセミナー集客数を3倍にする方法（前提知識テキストファイル）」/",
    alliance: "../../.agents/skills/gyosei_office_knowledge/references/購入者特典②「他士業から仕事をもらって年収300万円アップしようよ（前提知識テキストファイル）」/"
  },

  templatesData: [
    // 1. 事務所運営・基本契約
    {
      name: "業務委託契約書",
      category: "operation",
      desc: "顧客と業務委託契約（スポット・継続）を結ぶ際の基本ひな形。免責条項や契約終了などを規定します。",
      value: "50,000円相当",
      blank: "業務委託契約書（白紙）.doc",
      example: "業務委託契約書（記入例）.doc",
      guides: [
        { title: "解説PDF①", file: "第３章　１１、業務委託契約書（※50,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第３章　１１、業務委託契約書（※50,000円相当）　②.pdf" }
      ]
    },
    {
      name: "プライバシーポリシー（個人情報保護方針）",
      category: "operation",
      desc: "事務所ウェブサイトや業務受託時に明示する必要がある個人情報保護に関する基本方針です。",
      value: "50,000円相当",
      blank: "プライバシーポリシー（個人情報保護方針）（白紙）.doc",
      example: "プライバシーポリシー（個人情報保護方針）（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　３１、プライバシー・ポリシー（個人情報保護方針）（※50,000円相当）.pdf" }
      ]
    },
    {
      name: "反社会的勢力表明・確約書",
      category: "operation",
      desc: "コンプライアンス順守のために、受託契約書とは別に取得しておくと強固な防衛策となる表明確約書です。",
      value: "5,000円相当",
      blank: "反社会的勢力ではないこと等に関する表明・確約書（白紙）.doc",
      example: "反社会的勢力ではないこと等に関する表明・確約書（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　１０、反社会的勢力ではないこと等に関する表明・確約書（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "他士業への相談依頼書",
      category: "operation",
      desc: "他士業（司法書士や税理士等）へ顧客の案件を紹介・確認相談をする際の公式書類フォーマットです。",
      value: "30,000円相当",
      blank: "他士業などへの相談依頼書（白紙）.doc",
      example: "他士業などへの相談依頼書（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　３０、他士業（司法書士など）への相談依頼書（※30,000円相当）.pdf" }
      ]
    },
    {
      name: "他士業相談への回答書",
      category: "operation",
      desc: "他士業から相談や確認依頼を受けた際に、行政書士として書面で回答を返すための様式です。",
      value: "実務用",
      blank: "他士業などへの相談依頼書の回答書（白紙）.doc",
      example: "他士業などへの相談依頼書の回答書（記入例）.doc",
      guides: []
    },
    {
      name: "許認可取得後の注意事項表",
      category: "operation",
      desc: "許認可の完了引渡し時に、更新時期や満了後の義務事項を顧客に一覧化して示すためのサービスシートです。",
      value: "3,000円相当",
      blank: "",
      example: "許認可取得後の注意事項表（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　２１、許認可取得後の注意事項表（※3,000円相当）.pdf" }
      ]
    },
    {
      name: "見積書",
      category: "operation",
      desc: "行政書士実務に適した見積書ひな形。報酬額と立替費用（証紙代等）を明確に区分できます。",
      value: "5,000円相当",
      blank: "見積書（白紙）.xls",
      example: "見積書（記入例）.xls",
      guides: [
        { title: "解説PDF", file: "第３章　２４、見積書（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "請求書",
      category: "operation",
      desc: "源泉徴収税の有無や実費立替金をすっきりと整理できる、実用的な請求書テンプレートです。",
      value: "5,000円相当",
      blank: "請求書（白紙）.xls",
      example: "請求書（記入例）.xls",
      guides: [
        { title: "解説PDF", file: "第３章　２５、請求書（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "領収書 (初期様式)",
      category: "operation",
      desc: "代金受領時に交付する領収書。※インボイス制度対応版は追録タブをご確認ください。",
      value: "5,000円相当",
      blank: "領収書（白紙）.xls",
      example: "領収書（記入例）.xls",
      guides: [
        { title: "解説PDF", file: "第３章　２６、領収書（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "ご入金のお礼",
      category: "operation",
      desc: "着手金や報酬のご入金を確認した際に、領収書に添えることで信用とホスピタリティを高めるお礼状です。",
      value: "5,000円相当",
      blank: "ご入金のお礼（白紙）.doc",
      example: "ご入金のお礼（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　２７、ご入金の御礼（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "預り証① (契約着手金・立替金用)",
      category: "operation",
      desc: "正式受託前にお金を預かる場合や、多額の実費立替金を事前に預かる場合に交付する預り証です。",
      value: "5,000円相当",
      blank: "預り証①（白紙）.doc",
      example: "預り証①（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　２８、預り証①（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "預り証② (汎用預かり用)",
      category: "operation",
      desc: "重要書類や印鑑、通帳など、金銭以外の重要物品を顧客から一時的に預かる際に発行する預り証です。",
      value: "5,000円相当",
      blank: "預り証②（白紙）.doc",
      example: "預り証②（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　２９、預り証②（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "FAX送信票",
      category: "operation",
      desc: "役所や他士業、クライアントとFAXでやり取りする際の標準送信票レイアウトです。",
      value: "3,000円相当",
      blank: "FAX送信票（白紙）.pdf",
      example: "FAX送信票（記入例）.pdf",
      guides: [
        { title: "解説PDF", file: "第３章　１９、FAX送信票（※3,000円相当）.pdf" }
      ]
    },
    {
      name: "書類送付状 (送付案内)",
      category: "operation",
      desc: "郵送や手渡しで書類を送る際に添える送付案内（カバーレター）の基本ひな形です。",
      value: "3,000円相当",
      blank: "書類送付状（白紙）.doc",
      example: "書類送付状（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　２０、書類送付状（※3,000円相当）.pdf" }
      ]
    },
    {
      name: "行政書士事件簿",
      category: "operation",
      desc: "行政書士法第9条により作成および2年間の保存義務が定められている「法定帳簿」です。",
      value: "5,000円相当",
      blank: "事件簿（白紙）.xls",
      example: "事件簿（記入例）.xls",
      guides: [
        { title: "解説PDF①", file: "第３章　２２、行政書士事件簿（※5,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第３章　２２、行政書士事件簿（※5,000円相当）　②.pdf" },
        { title: "解説PDF③", file: "第３章　２２、行政書士事件簿（※5,000円相当）　③.pdf" }
      ]
    },
    {
      name: "誓約書・始末書 (不備等謝罪用)",
      category: "operation",
      desc: "業務上のミスや役所の要請等により、誓約や顛末を示す始末書を差し入れる際の参考様式です。",
      value: "20,000円相当",
      blank: "誓約書（始末書）（白紙）.doc",
      example: "誓約書（始末書）（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　１２、始末書（※20,000円相当）.pdf" }
      ]
    },

    // 3. 申請代理・汎用委任状
    {
      name: "行政書士登録申請書",
      category: "agency",
      desc: "行政書士会に新規登録を申請する際の登録申請書類ひな形です。",
      value: "5,000円相当",
      blank: "行政書士登録申請書（白紙）.pdf",
      example: "行政書士登録申請書（記入例）.pdf",
      guides: [
        { title: "解説PDF", file: "第３章　３、行政書士登録申請書（※5,000円相当）.pdf" }
      ]
    },
    {
      name: "許認可用 委任状",
      category: "agency",
      desc: "一般的な行政許認可申請（各種届出・申請）を代理受託する際に使用する汎用委任状です。",
      value: "20,000円相当",
      blank: "許認可用委任状（白紙）.doc",
      example: "許認可用委任状（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　４、許認可用委任状（※20,000円相当）.pdf" }
      ]
    },
    {
      name: "民事法務用 委任状",
      category: "agency",
      desc: "契約書の作成代理や調査業務など、行政庁に提出しない民事法務業務に関する委任状です。",
      value: "20,000円相当",
      blank: "民事法務用委任状（白紙）.doc",
      example: "民事法務用委任状（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　５、市民（民事）法務用委任状（※20,000円相当）.pdf" }
      ]
    },
    {
      name: "復代理人選任条項入り委任状 ＆ 復委任状",
      category: "agency",
      desc: "他の行政書士へ実務を外注・再委任（復代理）することを許容する選任委任状および復委任状のセットです。",
      value: "50,000円相当",
      blank: "復代理人の選任の条項入りの委任状（白紙）.doc",
      example: "復代理人の選任の条項入りの委任状（記入例）.doc",
      guides: [
        { title: "解説PDF①", file: "第３章　６、復代理人の選任 of 条項入りの委任状+復委任状（※50,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第３章　６、復代理人の選任 of 条項入りの委任状+復委任状（※50,000円相当）　②.pdf" }
      ],
      extra_blank: "復委任状（白紙）.doc",
      extra_example: "復委任状（記入例）.doc"
    },
    {
      name: "代理権行使と委任について",
      category: "agency",
      desc: "行政書士が業務を遂行する上での、代理権の法的効力と委任関係の整理・解説書です。",
      value: "10,000円相当",
      blank: "",
      example: "",
      guides: [
        { title: "解説PDF", file: "第３章　７、代理権行使と委任について（※10,000円相当）.pdf" }
      ]
    },
    {
      name: "不動産調査用 委任状",
      category: "agency",
      desc: "役所や法務局等で土地建物の登記、道路状況、都市計画等の調査を行う際に使用する委任状です。",
      value: "10,000円相当",
      blank: "不動産調査委任状（白紙）.doc",
      example: "不動産調査委任状（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　８、不動産調査委任状（※10,000円相当）.pdf" }
      ]
    },
    {
      name: "農地調査用 委任状",
      category: "agency",
      desc: "農業委員会や現地で農地台帳、転用可能性などを調査するための専用委任状フォーマットです。",
      value: "10,000円相当",
      blank: "農地調査委任状（白紙）.doc",
      example: "農地調査委任状（記入例）.doc",
      guides: [
        { title: "解説PDF", file: "第３章　９、農地調査委任状（※10,000円相当）.pdf" }
      ]
    },
    {
      name: "登記されていないことの証明書 委任状・申請書",
      category: "agency",
      desc: "許認可役員に欠格事由がないことを証明するための、東京法務局への証明申請書および代理委任状です。",
      value: "5,000円相当",
      blank: "登記されていないことの証明書の委任状（白紙）.pdf",
      example: "登記されていないことの証明書の委任状（記入例）.pdf",
      guides: [
        { title: "解説PDF①", file: "第３章　１３、登記されていないことの証明書（※5,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第３章　１３、登記されていないことの証明書（※5,000円相当）　②.pdf" }
      ],
      extra_blank: "登記されていないことの証明申請書（白紙）.pdf",
      extra_example: "登記されていないことの証明申請書（記入例）.pdf"
    },
    {
      name: "身分証明書交付請求書・委任状",
      category: "agency",
      desc: "本籍地の市区町村長に対して「破産宣告の通知を受けていないこと」等の証明書を請求する書類および委任状です。",
      value: "5,000円相当",
      blank: "身分証明書交付請求書の委任状（白紙）.pdf",
      example: "身分証明書交付請求書の委任状（記入例）.pdf",
      guides: [
        { title: "解説PDF", file: "第３章　１５、身分証明書交付請求書（※5,000円相当）.pdf" }
      ],
      extra_blank: "身分証明書交付請求書（白紙）.pdf",
      extra_example: "身分証明書交付請求書（記入例）.pdf"
    },
    {
      name: "住民票の写し交付請求書・委任状",
      category: "agency",
      desc: "役所で本人に代わり住民票の写しを取得するための請求用紙および委任状です。",
      value: "5,000円相当",
      blank: "住民票の写し交付請求書の委任状（白紙）.pdf",
      example: "住民票の写し交付請求書の委任状（記入例）.pdf",
      guides: [
        { title: "解説PDF", file: "第３章　１４、住民票の写し交付請求書（※5,000円相当）.pdf" }
      ],
      extra_blank: "住民票の写し交付請求書（白紙）.pdf",
      extra_example: "住民票の写し交付請求書（記入例）.pdf"
    },
    {
      name: "戸籍抄本等交付請求書・委任状",
      category: "agency",
      desc: "委任を受けて本籍地役所から戸籍抄本等を取得するための請求書類と代理委任状です。",
      value: "5,000円相当",
      blank: "戸籍抄本交付請求書の委任状（白紙）.pdf",
      example: "戸籍抄本交付請求書の委任状（記入例）.pdf",
      guides: [
        { title: "解説PDF", file: "第３章　１６、戸籍抄本交付請求書（※5,000円相当）.pdf" }
      ],
      extra_blank: "戸籍抄本交付請求書（白紙）.pdf",
      extra_example: "戸籍抄本交付請求書（記入例）.pdf"
    },
    {
      name: "職務上請求書",
      category: "agency",
      desc: "戸籍謄本や住民票を職権で取得するための、行政書士専用の職務上請求書に関する実務解説・ひな形です。",
      value: "5,000円相当",
      blank: "職務上請求書（白紙）.pdf",
      example: "職務上請求書（記入例）.pdf",
      guides: [
        { title: "解説PDF①", file: "第３章　１８、職務上請求書（※5,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第３章　１８、職務上請求書（※5,000円相当）　②.pdf" }
      ]
    },

    // 4. 建設業許可申請関連
    {
      name: "建設業許可申請書",
      category: "construction",
      desc: "建設業許可申請のメイン申請書です。膨大な記入項目があり、許認可の基本となる様式です。",
      value: "150,000円相当",
      blank: "建設業許可申請書（白紙）.pdf",
      example: "建設業許可申請書（記入例）.pdf",
      guides: [
        { title: "解説PDF①", file: "第４章　１、建設業許可申請書（※150,000円相当）　①.pdf" },
        { title: "解説PDF②", file: "第４章　１、建設業許可申請書（※150,000円相当）　②.pdf" },
        { title: "解説PDF③", file: "第４章　１、建設業許可申請書（※150,000円相当）　③.pdf" },
        { title: "解説PDF④", file: "第４章　１、建設業許可申請書（※150,000円相当）　④.pdf" },
        { title: "解説PDF⑤", file: "第４章　１、建設業許可申請書（※150,000円相当）　⑤.pdf" },
        { title: "解説PDF⑥", file: "第４章　１、建設業許可申請書（※150,000円相当）　⑥.pdf" }
      ]
    },
    {
      name: "建設業許可申請書 (代理権利用様式)",
      category: "construction",
      desc: "行政書士が代理権を利用して手続きを遂行する際の様式です。",
      value: "実務用",
      blank: "建設業許可申請書（代理権利用の場合）（白紙）.pdf",
      example: "建設業許可申請書（代理権利用の場合）（記入例）.pdf",
      guides: []
    },
    {
      name: "建設業許可申請用 委任状",
      category: "construction",
      desc: "建設業許可申請手続き全般を代理するために取得する委任状です。",
      value: "実務用",
      blank: "建設業許可申請用委任状（白紙 ）.doc",
      example: "建設業許可申請用委任状（記入例).doc",
      guides: []
    },
    {
      name: "役員等の一覧表",
      category: "construction",
      desc: "申請会社の役員や顧問、株主等を一覧にして申告する申請添付書類です。",
      value: "実務用",
      blank: "役員等の一覧表（白紙）.pdf",
      example: "役員等の一覧表（記入例）.pdf",
      guides: []
    },
    {
      name: "営業所一覧表・新規",
      category: "construction",
      desc: "新規申請時に営業所の名称、所在地、電話番号等を記載し提出する書類です。",
      value: "実務用",
      blank: "営業所一覧表・新規（白紙）.pdf",
      example: "営業所一覧表・新規（記入例）.pdf",
      guides: []
    },
    {
      name: "専任技術者証明書",
      category: "construction",
      desc: "各営業所に配置する「専任技術者」の要件資格、実務経歴を証する主要な添付書面です。",
      value: "実務用",
      blank: "専任技術者証明書（白紙）.pdf",
      example: "専任技術者証明書（記入例）.pdf",
      guides: []
    },
    {
      name: "工事経歴書",
      category: "construction",
      desc: "直前1年間に施工した主な工事実績を工種別に一覧にした書類。配置技術者の照合等に使われます。",
      value: "実務用",
      blank: "工事経歴書（白紙）.pdf",
      example: "工事経歴書（記入例）.pdf",
      guides: []
    },
    {
      name: "直前３年の各事業年度における工事施工金額",
      category: "construction",
      desc: "直前3年の決算期ごとの施工金額を、元請・下請別、公共・民間別に集計して記載する書類です。",
      value: "実務用",
      blank: "直前３年の各事業年度における工事施工金額（白紙）.pdf",
      example: "直前３年の各事業年度における工事施工金額（記入例）.pdf",
      guides: []
    },
    {
      name: "使用人数",
      category: "construction",
      desc: "本社および支店ごとの役職員・技術職員・事務職員の構成人数を申告する様式です。",
      value: "実務用",
      blank: "使用人数(白紙）.pdf",
      example: "使用人数（記入例）.pdf",
      guides: []
    },
    {
      name: "誓約書 (欠格事由の非該当誓約)",
      category: "construction",
      desc: "申請者や役員が、建設業法で定める欠格事由（破産者や刑罰等）に該当しないことを誓約する書類です。",
      value: "実務用",
      blank: "誓約書（白紙）.pdf",
      example: "誓約書（記入例）.pdf",
      guides: []
    },
    {
      name: "所属建設業者団体",
      category: "construction",
      desc: "申請者が現在加盟している建設業団体を申告する様式です。",
      value: "実務用",
      blank: "所属建設業者団体（白紙）.pdf",
      example: "所属建設業者団体（記入例）.pdf",
      guides: []
    },
    {
      name: "主要取引金融機関名",
      category: "construction",
      desc: "資金調達の円滑性を証するため、主要な取引先銀行・口座情報等を記入して申告する書面です。",
      value: "実務用",
      blank: "主要取引金融機関名（白紙）.pdf",
      example: "主要取引金融機関名（記入例）.pdf",
      guides: []
    },
    {
      name: "営業所技術者等証明書",
      category: "construction",
      desc: "専任技術者以外の一般技術者や事務従事者を登録・証明するための書類です。",
      value: "実務用",
      blank: "営業所技術者等証明書（白紙）.pdf",
      example: "営業所技術者等証明書（記入例）.pdf",
      guides: []
    },
    {
      name: "営業の沿革",
      category: "construction",
      desc: "会社の設立、資本金変更、役員の変遷、過去の許可取得状況等の歴史を記述する添付様式です。",
      value: "実務用",
      blank: "営業の沿革（白紙）.pdf",
      example: "営業の沿革（記入例）.pdf",
      guides: []
    },
    {
      name: "実務経験証明書",
      category: "construction",
      desc: "専任技術者が国家資格を持たない場合に、10年以上の実務経験を具体的に記述して証明する書類です。",
      value: "実務用",
      blank: "実務経験証明書（白紙）.pdf",
      example: "実務経験証明書（記入例）.pdf",
      guides: []
    },
    {
      name: "専任技術者・専任性確認 念書",
      category: "construction",
      desc: "他社で役員等をしていないことや、二重就職でないことを専任技術者本人が誓約する確認書です。",
      value: "実務用",
      blank: "専任技術者の専任性の確認資料③（念書（専任技術者用））（白紙）.pdf",
      example: "専任技術者の専任性の確認資料③（念書（専任技術者用））（記入例）.pdf",
      guides: []
    },
    {
      name: "常勤役員等（経営業務管理責任者）確認 念書",
      category: "construction",
      desc: "常勤役員（経営業務の管理責任者など）が他社で非常勤以外の役職に就いておらず、自社に常勤していることを誓約する念書です。",
      value: "実務用",
      blank: "常勤役員等、常勤役員等を直接に補佐する者の常勤性の確認資料②（（念書（常勤役員等（経営業務の管理責任者用））））（白紙）.pdf",
      example: "常勤役員等、常勤役員等を直接に補佐する者の常勤性の確認資料②（（念書（常勤役員等（経営業務の管理責任者用））））（記入例）.pdf",
      guides: []
    },
    {
      name: "常勤役員等の略歴書",
      category: "construction",
      desc: "経営の責任者である役員の過去の職歴・取締役経験年数等を記載し、経営業務の管理責任者要件を証します。",
      value: "実務用",
      blank: "常勤役員等の略歴書（白紙）.pdf",
      example: "常勤役員等の略歴書（記入例）.pdf",
      guides: []
    },
    {
      name: "常勤役員等（経営業務の管理責任者等）証明書",
      category: "construction",
      desc: "申請者が経営責任者（経管）としての適格要件を満たしていることを証明するための基本書類です。",
      value: "実務用",
      blank: "常勤役員等（経営業務の管理責任者等）証明書（白紙）.pdf",
      example: "常勤役員等（経営業務の管理責任者等）証明書（記入例）.pdf",
      guides: []
    },
    {
      name: "許可申請者の住所、生年月日に関する調書",
      category: "construction",
      desc: "申請者（役員等全員）の氏名、住所、生年月日等を記載し、欠格事由の役所確認に供する書類です。",
      value: "実務用",
      blank: "許可申請者の住所、生年月日に関する調書（白紙）.pdf",
      example: "許可申請者の住所、生年月日に関する調書（記入例）.pdf",
      guides: []
    },
    {
      name: "申請手数料貼付用紙 (別紙三)",
      category: "construction",
      desc: "新規申請時に、都道府県の収入証紙（または収入印紙）を貼付して手数料を納付するための台紙です。",
      value: "実務用",
      blank: "申請書別紙三（申請手数料貼付用紙）（白紙）.pdf",
      example: "申請書別紙三（申請手数料貼付用紙）（記入例）.pdf",
      guides: []
    },
    {
      name: "営業所技術者等一覧表 / 専任技術者一覧表 (別紙四)",
      category: "construction",
      desc: "営業所ごとに配置されている技術職員や、専任技術者を明記するための内訳・別紙書類です。",
      value: "実務用",
      blank: "申請書別紙三（申請手数料貼付用紙）（白紙）.pdf", // corrected typo in presentation sheet blank link
      example: "申請書別紙四（営業所技術者等一覧表）（記入例）.pdf",
      guides: [],
      extra_blank: "申請書別紙四（専任技術者一覧表）（白紙）.pdf",
      extra_example: "申請書別紙四（専任技術者一覧表）（記入例）.pdf"
    },
    {
      name: "会社形態",
      category: "construction",
      desc: "申請法人または事業所の組織・資本構成を補足して説明するためのメモ様式です。",
      value: "実務用",
      blank: "会社形態.doc",
      example: "",
      guides: []
    },

    // 5. 財務諸表様式
    {
      name: "財務諸表 表紙",
      category: "financial",
      desc: "建設業財務諸表を綴る際の表紙様式。決算期や会社名を記載します。",
      value: "実務用",
      blank: "財務諸表表紙（白紙 ）.pdf",
      example: "財務諸表表紙（記入例）.pdf",
      guides: []
    },
    {
      name: "貸借対照表 (建設業様式)",
      category: "financial",
      desc: "商業登記用の決算書から、建設業独自の勘定科目に組み替えた貸借対照表（①〜③様式）です。",
      value: "実務用",
      blank: "貸借対照表①（白紙）.pdf",
      example: "貸借対照表①（記入例）.pdf",
      guides: [],
      extra_blank: "貸借対照表②（白紙）.pdf",
      extra_example: "貸借対照表②（記入例）.pdf",
      extra_blank2: "貸借対照表③（白紙）.pdf",
      extra_example2: "貸借対照表③（記入例）.pdf"
    },
    {
      name: "損益計算書 (建設業様式)",
      category: "financial",
      desc: "売上高を「完成工事高」、売上原価を「完成工事原価」等に置き換え整理した損益計算書です。",
      value: "実務用",
      blank: "損益計算書①（白紙）.pdf",
      example: "損益計算書①（記入例）.pdf",
      guides: [],
      extra_blank: "損益計算書②（白紙）.pdf",
      extra_example: "損益計算書②（記入例）.pdf"
    },
    {
      name: "完成工事原価報告書",
      category: "financial",
      desc: "建設業の製造原価明細書にあたる、材料費、労務費、外注費、経費の内訳を報告する重要書類です。",
      value: "実務用",
      blank: "完成工事原価報告書（白紙）.pdf",
      example: "完成工事原価報告書（記入例）.pdf",
      guides: []
    },
    {
      name: "株主資本等変動計算書",
      category: "financial",
      desc: "自己資本の各項目の決算期中における変動額を申告する様式です。",
      value: "実務用",
      blank: "株主資本等変動計算書（白紙）.pdf",
      example: "株主資本等変動計算書（記入例）.pdf",
      guides: []
    },
    {
      name: "注記表 (様式①〜④)",
      category: "financial",
      desc: "重要な会計方針、継続企業の前提、株主資本に関する情報等の注記項目を整理する書面です。",
      value: "実務用",
      blank: "注記表①（白紙）.pdf",
      example: "注記表①（記入例）.pdf",
      guides: [],
      extra_blank: "注記表②（白紙）.pdf",
      extra_example: "注記表②（記入例）.pdf",
      extra_blank2: "注記表③（白紙）.pdf",
      extra_example2: "注記表③（記入例）.pdf",
      extra_blank3: "注記表④（白紙）.pdf",
      extra_example3: "注記表④（記入例）.pdf"
    },
    {
      name: "株主（出資者）調書",
      category: "financial",
      desc: "法人の主要株主（出資割合の高い者）の氏名、住所、持ち株数を記載する様式です。",
      value: "実務用",
      blank: "株主（出資者）調書（白紙）.pdf",
      example: "株主（出資者）調書（記入例）.pdf",
      guides: []
    },

    // 6. 追録 (インボイス・新様式)
    {
      name: "適格請求書 (インボイス対応版)",
      category: "supp",
      desc: "登録番号、適用税率、消費税額等の記載義務を満たした、インボイス制度対応の請求書テンプレートです。",
      value: "追録追加分",
      blank: "適格請求書（インボイス）（白紙）.xls",
      example: "適格請求書（インボイス）（記入例）.xls",
      guides: [
        { title: "解説PDF①", file: "追録、適格請求書（インボイス）①.pdf", supp: true },
        { title: "解説PDF②", file: "追録、適格請求書（インボイス）②.pdf", supp: true },
        { title: "解説PDF③", file: "追録、適格請求書（インボイス）③.pdf", supp: true },
        { title: "解説PDF④", file: "追録、適格請求書（インボイス）④.pdf", supp: true }
      ],
      isSupp: true
    },
    {
      name: "領収書 (インボイス・追録新様式)",
      category: "supp",
      desc: "インボイス対応に消費税区分や登録番号欄を新設した、追録版の新領収書テンプレートです。",
      value: "追録追加分",
      blank: "領収書（白紙）.xls",
      example: "領収書（記入例）.xls",
      guides: [
        { title: "解説PDF①", file: "追録、領収書①.pdf", supp: true },
        { title: "解説PDF②", file: "追録、領収書②.pdf", supp: true },
        { title: "解説PDF③", file: "追録、領収書③.pdf", supp: true },
        { title: "解説PDF④", file: "追録、領収書④.pdf", supp: true }
      ],
      isSupp: true
    },

    // 7. 添付確認資料サンプル
    {
      name: "役員・専任技術者の住民票サンプル",
      category: "attachments",
      desc: "常勤性や専任性、住所確認書類として添付する住民票のサンプルコピーです。",
      value: "見本資料",
      blank: "",
      example: "事業主・役員等の確認資料①（住民票（鈴木　一郎））.pdf",
      guides: [],
      extra_example: "事業主・役員等の確認資料②（住民票（鈴木　二郎））.pdf"
    },
    {
      name: "健康保険・労働保険等 加入確認資料",
      category: "attachments",
      desc: "社会保険への加入状況を示す「保険料納入告知書」「労働保険料領収書」のコピー見本です。",
      value: "見本資料",
      blank: "",
      example: "健康保険等の加入状況の確認資料①（保険料納入告知書・領収済額通知書）.pdf",
      guides: [],
      extra_example: "健康保険等の加入状況の確認資料②（労働保険料等領収書）.pdf"
    },
    {
      name: "健康保険等の加入状況 (申告書様式)",
      category: "attachments",
      desc: "健康保険、厚生年金、雇用保険の加入有無や事業所整理番号を申告する様式です。",
      value: "見本資料",
      blank: "健康保険等の加入状況（白紙）.pdf",
      example: "健康保険等の加入状況（記入例）.pdf",
      guides: []
    },
    {
      name: "卒業証明書 添付見本",
      category: "attachments",
      desc: "専任技術者の学歴要件（指定学科の卒業）を証明するために添付する実物の証明書例です。",
      value: "見本資料",
      blank: "",
      example: "卒業証明書.pdf",
      guides: []
    },
    {
      name: "定款 添付見本 (全4頁)",
      category: "attachments",
      desc: "法人の事業目的に「建設業」が含まれているか等を証明するために添付する定款の写しです。",
      value: "見本資料",
      blank: "",
      example: "定款①.pdf",
      guides: [],
      extra_example: "定款②.pdf",
      extra_example2: "定款③.pdf",
      extra_example3: "定款④.pdf"
    },
    {
      name: "注文書・請書 (実務経験証明の確認資料)",
      category: "attachments",
      desc: "資格なし技術者の10年実務経験を証明するため、証拠資料として差し出す注文書の実際の様式例です。",
      value: "見本資料",
      blank: "",
      example: "実務経験証明書の確認資料（注文書）①.pdf",
      guides: [],
      extra_example: "実務経験証明書の確認資料（注文書）②.pdf",
      extra_example2: "実務経験証明書の確認資料（注文書）③.pdf",
      extra_example3: "実務経験証明書の確認資料（注文書）④.pdf",
      extra_example4: "実務経験証明書の確認資料（注文書）⑤.pdf"
    },
    {
      name: "常勤役員・経管の確認資料 (全部履歴証明 / 注文書)",
      category: "attachments",
      desc: "経営業務管理責任者の取締役としての経験年数を証明するために差し出す会社の全部事項証明書および注文書の見本です。",
      value: "見本資料",
      blank: "",
      example: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料①（履歴事項全部証明書①）.pdf",
      guides: [],
      extra_example: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料①（履歴事項全部証明書②）.pdf",
      extra_example2: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料②（注文書①）.pdf",
      extra_example3: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料②（注文書②）.pdf",
      extra_example4: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料②（注文書③）.pdf",
      extra_example5: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料②（注文書④）.pdf",
      extra_example6: "常勤役員等及び常勤役員等を直接に補佐する者の業務経験の確認資料②（注文書⑤）.pdf"
    },
    {
      name: "社会保険被保険者 標準報酬決定通知書",
      category: "attachments",
      desc: "専任技術者や役員が、その事業所で常勤雇用されているかを証明する年金事務所からの決定通知書のコピー見本です。",
      value: "見本資料",
      blank: "",
      example: "営業所技術者の専任性の確認資料②（健康保険・厚生年金被保険者標準報酬決定通知書）.pdf",
      guides: []
    },
    {
      name: "身分証明書・登記されていないことの証明書 (実物例)",
      category: "attachments",
      desc: "本人が役所等から取り出した、欠格事由に該当しないことを証する実物の「登記されていないことの証明書」「身分証明書」の見本です。",
      value: "見本資料",
      blank: "",
      example: "登記されていないことの証明書（鈴木　一郎）.pdf",
      guides: [],
      extra_example: "登記されていないことの証明書（鈴木　二郎）.pdf",
      extra_example2: "身分証明書（鈴木　一郎）.pdf",
      extra_example3: "身分証明書（鈴木　二郎）.pdf"
    },
    {
      name: "実印・職印の押印印影一覧",
      category: "attachments",
      desc: "どの箇所に「法人の実印」「個人の実印」「行政書士の職印」を捺印すべきかを示す、実印押印比較表です。",
      value: "見本資料",
      blank: "",
      example: "株式会社池袋建設の会社の実印、鈴木一郎の個人の実印、鈴木二郎の個人の実印、行政書士冨樂事務所の職印、冨樂剛志の個人の実印.pdf",
      guides: []
    },
    {
      name: "納税証明書 添付見本",
      category: "attachments",
      desc: "許可要件や法令順守の証として役所に提出する納税証明書の見本コピーです。",
      value: "見本資料",
      blank: "",
      example: "納税証明書.pdf",
      guides: []
    },
    {
      name: "財産的基礎要件 残高証明書",
      category: "attachments",
      desc: "一般建設業許可に必須となる「自己資金500万円以上」を証するための、銀行発行の残高証明書の見本コピーです。",
      value: "見本資料",
      blank: "",
      example: "財産的基礎要件の確認資料（残高証明書）.pdf",
      guides: []
    },
    {
      name: "財務諸表（決算報告書）添付見本",
      category: "attachments",
      desc: "法人の決算報告書（貸借対照表）の実物サンプルコピーです。これを見ながら建設業様式に組み替えます。",
      value: "見本資料",
      blank: "",
      example: "貸借対照表（決算報告書内 ）.pdf",
      guides: []
    }
  ],

  // ----------------------------------------------------
  // 初期化・UI構築
  // ----------------------------------------------------
  init() {
    this.currentTab = 'templates';
    this.categoryFilter = 'all';
    this.searchQuery = '';
    this.renderTemplates();
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    
    // UIのアクティブ切り替え
    document.querySelectorAll('.format-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.format-tab-content').forEach(content => {
      content.style.display = (content.id === `tab-${tabId}`) ? 'block' : 'none';
    });

    if (tabId === 'templates') {
      this.renderTemplates();
    }
  },

  setCategoryFilter(cat) {
    this.categoryFilter = cat;
    document.querySelectorAll('.format-filter-tag').forEach(tag => {
      tag.classList.toggle('active', tag.getAttribute('data-cat') === cat);
    });
    this.renderTemplates();
  },

  onSearch(val) {
    this.searchQuery = val;
    this.renderTemplates();
  },

  renderTemplates() {
    const container = document.getElementById('formats-grid-container');
    if (!container) return;

    const query = this.searchQuery.toLowerCase();
    const catFilter = this.categoryFilter;

    const filtered = this.templatesData.filter(item => {
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      
      if (query) {
        const matchName = item.name.toLowerCase().includes(query);
        const matchDesc = item.desc.toLowerCase().includes(query);
        const matchBlank = item.blank && item.blank.toLowerCase().includes(query);
        const matchExample = item.example && item.example.toLowerCase().includes(query);
        const matchGuides = item.guides && item.guides.some(g => g.file.toLowerCase().includes(query) || g.title.toLowerCase().includes(query));
        return matchName || matchDesc || matchBlank || matchExample || matchGuides;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary);">
          <span style="font-size:2rem; display:block; margin-bottom:10px">🔍</span>
          該当する書式が見つかりませんでした。別のキーワードでお試しください。
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      let blankBtn = '<span style="color:var(--text-muted);font-size:0.75rem">提供なし</span>';
      if (item.blank) {
        const folderBase = item.isSupp ? this.PATHS.format_supp : this.PATHS.format;
        const ext = item.blank.split('.').pop().toUpperCase();
        blankBtn = `<a href="${folderBase}${encodeURIComponent(item.blank)}" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 8px; flex:1; text-align:center">📥 白紙 (${ext})</a>`;
      }

      let exampleBtn = '<span style="color:var(--text-muted);font-size:0.75rem">提供なし</span>';
      if (item.example) {
        const folderBase = item.isSupp ? this.PATHS.format_supp : this.PATHS.format;
        const ext = item.example.split('.').pop().toUpperCase();
        exampleBtn = `<a href="${folderBase}${encodeURIComponent(item.example)}" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 8px; flex:1; text-align:center">📋 例 (${ext})</a>`;
      }

      let extraRow = '';
      if (item.extra_blank || item.extra_example) {
        const folderBase = item.isSupp ? this.PATHS.format_supp : this.PATHS.format;
        let eb = '';
        let ex = '';
        if (item.extra_blank) {
          eb = `<a href="${folderBase}${encodeURIComponent(item.extra_blank)}" class="btn btn-secondary" style="font-size:0.7rem; padding:2px 6px" title="${item.extra_blank}">📥 追白紙</a>`;
        }
        if (item.extra_example) {
          ex = `<a href="${folderBase}${encodeURIComponent(item.extra_example)}" class="btn btn-secondary" style="font-size:0.7rem; padding:2px 6px" title="${item.extra_example}">📋 追例</a>`;
        }
        extraRow = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; border-top:1px dotted var(--border-color); padding-top:6px">
            <span style="font-size:0.72rem; color:var(--text-secondary)">🔗 関連ファイル:</span>
            <div style="display:flex; gap:4px">${eb}${ex}</div>
          </div>
        `;
      }

      let multiExtraRow = '';
      const extras = [];
      if (item.extra_example2) extras.push({ name: '追例2', file: item.extra_example2 });
      if (item.extra_example3) extras.push({ name: '追例3', file: item.extra_example3 });
      if (item.extra_example4) extras.push({ name: '追例4', file: item.extra_example4 });
      if (item.extra_example5) extras.push({ name: '追例5', file: item.extra_example5 });
      if (item.extra_example6) extras.push({ name: '追例6', file: item.extra_example6 });

      if (extras.length > 0) {
        const folderBase = item.isSupp ? this.PATHS.format_supp : this.PATHS.format;
        const linksHtml = extras.map(ex => {
          return `<a href="${folderBase}${encodeURIComponent(ex.file)}" class="btn btn-secondary" style="font-size:0.7rem; padding:2px 6px" title="${ex.file}">📋 ${ex.name}</a>`;
        }).join('');

        multiExtraRow = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; border-top:1px dotted var(--border-color); padding-top:6px">
            <span style="font-size:0.72rem; color:var(--text-secondary)">🔗 複数見本:</span>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end">${linksHtml}</div>
          </div>
        `;
      }

      let guidesHtml = '<span style="color:var(--text-muted);font-size:0.75rem">解説なし</span>';
      if (item.guides && item.guides.length > 0) {
        guidesHtml = item.guides.map(g => {
          const textFolderBase = g.supp ? this.PATHS.text_supp : this.PATHS.text;
          return `<a href="${textFolderBase}${encodeURIComponent(g.file)}" class="btn btn-primary" target="_blank" style="font-size:0.75rem; padding:3px 8px; border-radius:4px; text-decoration:none;">📖 ${g.title}</a>`;
        }).join(' ');
      }

      const getCatLabel = (cat) => {
        switch (cat) {
          case 'operation': return '運営・契約';
          case 'agency': return '証明・委任状';
          case 'construction': return '建設業許可';
          case 'financial': return '財務諸表';
          case 'attachments': return '添付資料例';
          case 'supp': return '追録';
          default: return cat;
        }
      };

      const getBadgeClass = (cat) => {
        switch (cat) {
          case 'operation': return 'background:rgba(59,130,246,0.15); color:#60a5fa';
          case 'agency': return 'background:rgba(168,85,247,0.15); color:#c084fc';
          case 'construction': return 'background:rgba(245,158,11,0.15); color:#fbbf24';
          case 'financial': return 'background:rgba(20,184,166,0.15); color:#2dd4bf';
          case 'attachments': return 'background:rgba(156,163,175,0.15); color:#d1d5db';
          case 'supp': return 'background:rgba(236,72,153,0.15); color:#f472b6';
          default: return 'background:var(--bg-primary); color:var(--text-secondary)';
        }
      };

      return `
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; display:flex; flex-direction:column; justify-content:space-between; transition:var(--transition);" onmouseover="this.style.borderColor='var(--accent-gold)'" onmouseout="this.style.borderColor='var(--border-color)'">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <span style="font-size:0.7rem; padding:2px 8px; border-radius:4px; font-weight:600; ${getBadgeClass(item.category)}">${getCatLabel(item.category)}</span>
              <span style="font-size:0.7rem; color:var(--accent-gold); font-weight:bold">${item.value}</span>
            </div>
            <div style="font-size:0.95rem; font-weight:bold; color:var(--text-primary); margin-bottom:6px">${item.name}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5; margin-bottom:12px">${item.desc}</div>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
              <span style="font-size:0.75rem; color:var(--text-muted)">白紙様式:</span>
              <div style="display:flex; gap:4px; flex:1; justify-content:flex-end">${blankBtn}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
              <span style="font-size:0.75rem; color:var(--text-muted)">記入例:</span>
              <div style="display:flex; gap:4px; flex:1; justify-content:flex-end">${exampleBtn}</div>
            </div>
            ${extraRow}
            ${multiExtraRow}
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border-top:1px dotted var(--border-color); padding-top:6px; margin-top:4px">
              <span style="font-size:0.75rem; color:var(--text-muted)">実務解説:</span>
              <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end">${guidesHtml}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  render() {
    return `
      <div style="padding:24px; max-width:1200px; margin:0 auto; font-family:'Noto Sans JP', sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
          <div>
            <h1 style="font-size:1.5rem; font-weight:700; color:var(--text-primary); margin-bottom:4px">📂 実務書式ライブラリ</h1>
            <p style="font-size:0.8rem; color:var(--text-secondary)">開業実務ノウハウ・書式集パックの全ファイルと解説ノウハウをダッシュボード内に完全統合しました。</p>
          </div>
        </div>

        <!-- 水平タブナビゲーション -->
        <div style="display:flex; gap:8px; border-bottom:1px solid var(--border-color); padding-bottom:0; margin-bottom:20px; overflow-x:auto;">
          <button class="format-tab-btn active" data-tab="templates" style="padding:10px 16px; background:none; border:none; border-bottom:2px solid var(--accent-gold); color:var(--accent-gold); font-weight:600; cursor:pointer; font-size:0.88rem; transition:var(--transition); white-space:nowrap" onclick="Formats.switchTab('templates')">📄 書式テンプレート集</button>
          <button class="format-tab-btn" data-tab="knowhow" style="padding:10px 16px; background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; cursor:pointer; font-size:0.88rem; transition:var(--transition); white-space:nowrap" onclick="Formats.switchTab('knowhow')">📜 実務解説・心得</button>
          <button class="format-tab-btn" data-tab="marketing" style="padding:10px 16px; background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; cursor:pointer; font-size:0.88rem; transition:var(--transition); white-space:nowrap" onclick="Formats.switchTab('marketing')">📣 セミナー集客特典</button>
          <button class="format-tab-btn" data-tab="alliance" style="padding:10px 16px; background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; cursor:pointer; font-size:0.88rem; transition:var(--transition); white-space:nowrap" onclick="Formats.switchTab('alliance')">🤝 他士業連携特典</button>
        </div>

        <style>
          .format-tab-btn:hover { color: var(--text-primary) !important; }
          .format-tab-btn.active { color: var(--accent-gold) !important; border-bottom-color: var(--accent-gold) !important; }
          .format-filter-tag { padding: 4px 12px; border-radius: 20px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.78rem; font-weight: 500; cursor: pointer; transition: var(--transition); }
          .format-filter-tag:hover { color: var(--text-primary); border-color: var(--text-muted); }
          .format-filter-tag.active { background: rgba(245,158,11,0.15); border-color: var(--accent-gold); color: var(--accent-gold-light); }
          .formats-kh-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: var(--transition); }
          .formats-kh-card:hover { border-color: var(--accent-gold); }
          .kh-download-btn { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: var(--transition); }
          .kh-download-btn:hover { background: var(--bg-card-hover); border-color: var(--accent-gold); color: var(--accent-gold); }
        </style>

        <!-- ==================== タブ1: 書式テンプレート ==================== -->
        <div id="tab-templates" class="format-tab-content">
          <!-- 検索とフィルタ -->
          <div style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:16px; border-radius:var(--radius-sm); margin-bottom:20px; display:flex; flex-direction:column; gap:12px">
            <div style="position:relative">
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
              <input type="text" style="width:100%; padding:10px 16px 10px 38px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); color:var(--text-primary); outline:none;" placeholder="書類名、キーワード、解説内容からリアルタイム検索..." oninput="Formats.onSearch(this.value)">
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <span class="format-filter-tag active" data-cat="all" onclick="Formats.setCategoryFilter('all')">すべて表示</span>
              <span class="format-filter-tag" data-cat="operation" onclick="Formats.setCategoryFilter('operation')">💼 運営・契約</span>
              <span class="format-filter-tag" data-cat="agency" onclick="Formats.setCategoryFilter('agency')">📋 証明・委任状</span>
              <span class="format-filter-tag" data-cat="construction" onclick="Formats.setCategoryFilter('construction')">🏗️ 建設業許可</span>
              <span class="format-filter-tag" data-cat="financial" onclick="Formats.setCategoryFilter('financial')">📊 財務諸表</span>
              <span class="format-filter-tag" data-cat="supp" onclick="Formats.setCategoryFilter('supp')">➕ 追録</span>
              <span class="format-filter-tag" data-cat="attachments" onclick="Formats.setCategoryFilter('attachments')">📁 添付資料見本</span>
            </div>
          </div>

          <!-- カードグリッド -->
          <div id="formats-grid-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px; margin-bottom:40px;">
            <!-- JS動的表示 -->
          </div>
        </div>

        <!-- ==================== タブ2: 実務解説・心得 ==================== -->
        <div id="tab-knowhow" class="format-tab-content" style="display:none">
          <div style="display:flex; flex-direction:column; gap:20px">
            <!-- コラム -->
            <div style="background:linear-gradient(135deg, #1e1b4b, var(--bg-card)); border:1px solid var(--border-color); border-radius:var(--radius); padding:20px;">
              <h3 style="color:var(--accent-gold); font-size:1.1rem; margin-bottom:8px; display:flex; align-items:center; gap:8px">⚖️ 行政書士実務の「超」重要基本心得</h3>
              <ul style="color:var(--text-secondary); font-size:0.85rem; line-height:1.8; padding-left:20px; margin:0">
                <li><strong>本人が手続きをした証明としての署名・記名:</strong> 実印が必要な箇所（契約書、重要委任状）では「署名＋実印押印」を原則とすることで後日のトラブルを最小限に防ぎます。</li>
                <li><strong>捨印の取り扱いに関する倫理:</strong> 捨印は非常に強力な権限を与えるため、受託者である行政書士と依頼者との間の強固な信頼関係が必要です。訂正した内容は必ず依頼者へ報告することが実務上の鉄則です。</li>
                <li><strong>職印（職氏名印）の適切な利用:</strong> 行政書士の「職印」を押す箇所は公的な申請代理にかかわる部分であり、私的な契約等で不用意に使用しないよう厳密に区別します。</li>
              </ul>
            </div>

            <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px">
              <h2 style="font-size:1rem; font-weight:600; color:var(--text-primary); margin-bottom:12px">📙 実務解説・心得ファイル一覧</h2>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                
                <div class="formats-kh-card">
                  <div>
                    <div style="font-size:0.75rem; color:var(--accent-gold); margin-bottom:2px">実務心得</div>
                    <div style="font-size:0.88rem; font-weight:600; color:var(--text-primary)">共通事項解説 (全2ファイル)</div>
                  </div>
                  <div style="display:flex; gap:6px">
                    <a href="${this.PATHS.text}${encodeURIComponent('第２章　１、全ての書式に共通する事項.pdf')}" class="kh-download-btn" target="_blank">📄 共通①</a>
                    <a href="${this.PATHS.text}${encodeURIComponent('第３章　２、全ての書式（テンプレート）に共通の事項.pdf')}" class="kh-download-btn" target="_blank">📄 共通②</a>
                  </div>
                </div>

                <div class="formats-kh-card">
                  <div>
                    <div style="font-size:0.75rem; color:var(--accent-gold); margin-bottom:2px">実務心得</div>
                    <div style="font-size:0.88rem; font-weight:600; color:var(--text-primary)">受託・案件を進める解説順番</div>
                  </div>
                  <a href="${this.PATHS.text}${encodeURIComponent('第３章　１、解説順番.pdf')}" class="kh-download-btn" target="_blank">📄 PDFを開く</a>
                </div>

                <div class="formats-kh-card">
                  <div>
                    <div style="font-size:0.75rem; color:var(--accent-gold); margin-bottom:2px">実務心得</div>
                    <div style="font-size:0.88rem; font-weight:600; color:var(--text-primary)">行政書士報酬の取り方（着手金・割合の勘所）</div>
                  </div>
                  <a href="${this.PATHS.text}${encodeURIComponent('第３章　２３、報酬の取り方.pdf')}" class="kh-download-btn" target="_blank">📄 PDFを開く</a>
                </div>

                <div class="formats-kh-card">
                  <div>
                    <div style="font-size:0.75rem; color:var(--accent-gold); margin-bottom:2px">初期資料</div>
                    <div style="font-size:0.88rem; font-weight:600; color:var(--text-primary)">注意事項・表紙・教材構成概要</div>
                  </div>
                  <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end">
                    <a href="${this.PATHS.text}${encodeURIComponent('表紙（行政書士開業者のための、これだけで十分足りる、書式集パック（動画解説付き）.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">表紙</a>
                    <a href="${this.PATHS.text}${encodeURIComponent('注意事項.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">注意</a>
                    <a href="${this.PATHS.text}${encodeURIComponent('教材ページ内容 （行政書士開業者のための、これだけで十分足りる、書式集パック（動画解説付き）　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">構成①</a>
                    <a href="${this.PATHS.text}${encodeURIComponent('教材ページ内容 （行政書士開業者のための、これだけで十分足りる、書式集パック（動画解説付き）　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">構成②</a>
                    <a href="${this.PATHS.text}${encodeURIComponent('教材ページ内容 （行政書士開業者のための、これだけで十分足りる、書式集パック（動画解説付き）　③.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">構成③</a>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- ==================== タブ3: セミナー集客特典 ==================== -->
        <div id="tab-marketing" class="format-tab-content" style="display:none">
          <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; margin-bottom:20px">
            <h2 style="font-size:1rem; font-weight:600; color:var(--text-primary); margin-bottom:4px">📣 特典①：費用0円でセミナー集客数を3倍にする方法</h2>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:16px">広告費をかけずに安定して案件を獲得するための、行政書士向けのセミナー集客・営業ノウハウです。</p>
            
            <div style="display:flex; flex-direction:column; gap:20px">
              
              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第1章：セミナー営業の有利点・種類</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第1章 第1節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナー開催で一番重要なこと</div>
                    </div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第１章　１、セミナー開催で一番重要なこと.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第1章 第2節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナー営業の有利点 (全3頁)</div>
                    </div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第１章　２、セミナー営業の有利点　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第１章　２、セミナー営業の有利点　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第１章　２、セミナー営業の有利点　③.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">3</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第1章 第3節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナーの種類（自主・タイアップ）</div>
                    </div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第１章　３、セミナーの種類.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第2章：告知・チラシ・会場・本番</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第2章 第1節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">告知レター（セールスレター）作成</div>
                    </div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　１、セミナーの告知方法（セールスレター）　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">前</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　１、セミナーの告知方法（セールスレター）　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">後</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第2章 第2節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">告知チラシの作り方の勘所</div>
                    </div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　２、セミナーの告知方法（チラシ）.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第2章 第3節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナー開催業務の外注化 (全3頁)</div>
                    </div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　３、セミナー開催仕事の外注化　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　３、セミナー開催仕事の外注化　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　３、セミナー開催仕事の外注化　③.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">3</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第2章 第4節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">失敗しないセミナー会場の選び方</div>
                    </div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　４、セミナーの会場選び.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div>
                      <div style="font-size:0.72rem; color:var(--text-muted)">第2章 第5節</div>
                      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナー本番当日の動き・運営</div>
                    </div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　５、セミナー開催本番　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">前</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第２章　５、セミナー開催本番　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">後</a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第3章：Zoomオンラインセミナー実践方法</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第1節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">オンライン開催の不可避性</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１、zoom利用によるセミナー開催は無視できない.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第2節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">オンライン開催に向いているもの</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　２、オンライン開催に向いているのもの.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第3節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">オンライン開催に向いていないもの</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　３、オンライン開催に向いていないもの　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">①</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　３、オンライン開催に向いていないもの　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">②</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第4節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">オンラインセミナーの優位点</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　４、オンラインセミナーの優位点　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">①</a>
                      <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　４、オンラインセミナーの優位点　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">②</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第5節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoom利用の営業上の優位点</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　５、zoom利用の優位点.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第6節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomセミナーの注意点</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　６、zoom利用のセミナーの注意点.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第7節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomセミナーの主催類型</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　７、zoom利用のセミナーの類型.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第8節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomセミナーのスタッフ配置</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　８、zoom利用のセミナーのスタッフ利用.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第9節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">セミナーの参加費設定方法</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　９、zoom利用のセミナーの参加費設定方法など.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第10節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomセミナーの募集告知</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１０、zoom利用のセミナーの募集の告知.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第11節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomツール設定と利用法</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１１、zoomのツール利用.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第12節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">開催前のリハーサルのコツ</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１２、zoom利用のセミナーのリハーサル.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第13節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">Zoomセミナーの休憩時間</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１３、zoom利用のセミナーの途中休憩など.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第14節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">オンラインセミナーに習熟する方法</div></div>
                    <a href="${this.PATHS.marketing}${encodeURIComponent('第３章　１４、zoomに習熟するとっておきの方法.pdf')}" class="kh-download-btn" target="_blank">開く</a>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">📑 補足資料</h3>
                <div style="display:flex; gap:8px; flex-wrap:wrap">
                  <a href="${this.PATHS.marketing}${encodeURIComponent('表紙（費用0円でセミナー集客数を3倍にする方法）.pdf')}" class="kh-download-btn" target="_blank">📄 特典① 表紙</a>
                  <a href="${this.PATHS.marketing}${encodeURIComponent('注意事項.pdf')}" class="kh-download-btn" target="_blank">⚠️ 注意事項</a>
                  <a href="${this.PATHS.marketing}${encodeURIComponent('教材ページ内容（費用0円でセミナー集客数を3倍にする方法）　①.pdf')}" class="kh-download-btn" target="_blank">📄 教材概要①</a>
                  <a href="${this.PATHS.marketing}${encodeURIComponent('教材ページ内容（費用0円でセミナー集客数を3倍にする方法）　②.pdf')}" class="kh-download-btn" target="_blank">📄 教材概要②</a>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- ==================== タブ4: 他士業連携特典 ==================== -->
        <div id="tab-alliance" class="format-tab-content" style="display:none">
          <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; margin-bottom:20px">
            <h2 style="font-size:1rem; font-weight:600; color:var(--text-primary); margin-bottom:4px">🤝 特典②：他士業から仕事をもらって年収300万円アップしようよ</h2>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:16px">弁護士、司法書士、税理士、宅建業者などとお互いに強みを活かして紹介し合う、紹介営業のバイブルです。</p>

            <div style="display:flex; flex-direction:column; gap:20px">
              
              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第1章：売り込まない営業手法の基本理念</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第1章 第1節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">売り込まない営業法</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　１、売り込まない営業法　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">①</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　１、売り込まない営業法　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">②</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第1章 第2節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">なぜ他士業紹介営業が極めて有効か</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　２、なぜこの営業法が有効なのか　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">①</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　２、なぜこの営業法が有効なのか　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">②</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第1章 第3節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">すべての依頼を引き受ける必要はない</div></div>
                    <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　３、あなたが全ての依頼を引き受ける必要はない.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第1章 第4節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">紹介料（キックバック）と倫理</div></div>
                    <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　４、キックバックに寛容な士業、不寛容な士業.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第1章 第5節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">営業で有利に働く「事務所名」</div></div>
                    <a href="${this.PATHS.alliance}${encodeURIComponent('第１章　５、この営業法を実行するにあたっての、有利な事務所名.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第2章：他士業へのアプローチと関係構築</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第2章 第1節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">他士業の不満・傾向と対策</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第２章　１、他士業の傾向と対策　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">前</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第２章　１、他士業の傾向と対策　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">後</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第2章 第2節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">他士業・同業への接近方法 (全 3ファイル)</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第２章　２、他士業や他行政書士への接近方法　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">①</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第２章　２、他士業や他行政書士への接近方法　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">②</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第２章　２、他士業や他行政書士への接近方法　③.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">③</a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">第3章：士業別・提携営業の勘所</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:12px">
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第1節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">弁護士への接近・役割分担</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　１、弁護士の場合　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　１、弁護士の場合　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第2節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">司法書士とのシナジー（登記・許認可）</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　２、司法書士の場合　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　２、司法書士の場合　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第3節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">税理士からの紹介（顧問先許認可）</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　３、税理士の場合　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　３、税理士の場合　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　３、税理士の場合　③.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">3</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第4節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">土地家屋調査士との開発・転用連携</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　４、土地家屋調査士の場合　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　４、土地家屋調査士の場合　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第5節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">中小企業診断士との補助金・コンサル</div></div>
                    <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　５、中小企業診断士の場合.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第6節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">宅建士（不動産会社）との転用・開発</div></div>
                    <div style="display:flex; gap:4px">
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　６、宅建士（宅建業）の場合　①.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">1</a>
                      <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　６、宅建士（宅建業）の場合　②.pdf')}" class="kh-download-btn" style="font-size:0.7rem; padding:4px 6px" target="_blank">2</a>
                    </div>
                  </div>
                  <div class="formats-kh-card">
                    <div><div style="font-size:0.72rem; color:var(--text-muted)">第3章 第7節</div><div style="font-size:0.85rem; font-weight:600; color:var(--text-primary)">同業行政書士との棲み分け提携</div></div>
                    <a href="${this.PATHS.alliance}${encodeURIComponent('第３章　７、行政書士の場合.pdf')}" class="kh-download-btn" target="_blank">📄 開く</a>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="font-size:0.88rem; color:var(--accent-gold); margin-bottom:8px; border-left:3px solid var(--accent-gold); padding-left:8px">📑 補足資料</h3>
                <div style="display:flex; gap:8px; flex-wrap:wrap">
                  <a href="${this.PATHS.alliance}${encodeURIComponent('表紙（他士業から仕事をもらって年収300万円アップしようよ）.pdf')}" class="kh-download-btn" target="_blank">📄 特典② 表紙</a>
                  <a href="${this.PATHS.alliance}${encodeURIComponent('注意事項.pdf')}" class="kh-download-btn" target="_blank">⚠️ 注意事項</a>
                  <a href="${this.PATHS.alliance}${encodeURIComponent('教材ページ内容（他士業から仕事をもらって年収300万円アップしようよ）.pdf')}" class="kh-download-btn" target="_blank">📄 教材概要</a>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    `;
  }
};
