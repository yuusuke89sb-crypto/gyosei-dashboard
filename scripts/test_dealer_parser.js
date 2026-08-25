const DealerDocumentParser = require('./js/dealer_parser.js');

const sample1_text = `
2026年 8月25日 13時33分 愛知トヨタWEST 一宮店 NO.7766 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 一宮店
提出日 R8 年 8 月 22 日
注文NO 57360875
担当者名 伊藤 弘騎
連絡先 090-4212-1350
希望日 月 日 時迄
申請者 氏名 陸田 正明 フリガナ ムツダ マサアキ
住所 〒491-0924 一宮市大和町於保字二之宮42-1
電話番号 090-3933-6214 生年月日 S38 年 7 月 13 日
使用の本拠の位置 同上
保管場所の位置 同上
車両概要 トヨタ 6AA-MXPL10G 車台番号 MXPL10-
代替有 ウィッシュ (登録番号) 一宮 530そ1037
届出先 店舗
登録 9/10
`;

const sample2_text = `
26-08-25:01:40PM; 愛知トヨタ 一宮三条店 -> 田中さん(日来行政書士事務所) ; 0586615556 # 1/ 4
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☐ OSS ・ ☑ 一般
会社名 愛知トヨタWEST株式会社
店名 一宮三条店
提出日 2026 年 8 月 25 日
注文NO 57680161
担当者名 関 凌太朗
連絡先 080-5013-1474
申請者 氏名 西濃建設 株式会社 代表取締役社長 宗宮 郷 フリガナ セイノウケンセツ(カブ)
住所 〒501-0618 揖斐郡揖斐川町上三野128番地
電話番号 0585-22-1221
使用の本拠の位置 同上
保管場所の位置 同上
車両概要 トヨタ 3BE-NCP165V 車台番号 NCP165- 新規
`;

const sample3_text = `
2026年 8月25日 14時38分 オートステージM NO.2861 P. 1
FAX送付のご案内
有限会社 オートステージM
TEL 0584-821655 FAX 0584-81-817
田中様
児玉 様ご依頼の
車種 ハイゼットT 4WD CVT ジャンボスタンダード
車検証をFAXさせて頂きました
手続きの方よろしくお願いします。
納車日は 9/4 午前を予定しております。

自動車検査証記録事項
車両番号 岐阜 483 い 9829
車台番号 S510P-0705500
使用者の氏名又は名称 児玉 一男
使用者の住所 岐阜県安八郡神戸町丈六道406
車名 ダイハツ 型式 3BD-S510P
`;

const sample4_text = `
2026年 8月25日 14時29分 愛知トヨタ 小牧村中店 NO.1718 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 小牧村中店
提出日 8 年 8 月 25 日
注文NO 56273129
担当者名 纐纈 健人
申請者 氏名 寺澤 僚 フリガナ テラザワ リョウ
住所 〒483-8044 江南市宮後町向エ80番地
電話番号 080-4962-8425 生年月日 H7 年 3 月 21 日
使用の本拠の位置 同上
保管場所の位置 同上
車両概要 トヨタ 6AA-ZWR90W 車台番号 ZWR90-
代替有 フィット (登録番号) 尾張小牧503た4903
`;

const sample5_text = `
2026年 8月25日 14時48分 愛知トヨタ 西春店 NO.3873 P. 1
車庫証明申請手続き依頼書（行政書士依頼書）
日来行政書士事務所 御中 ATgroup
申請区分 ☑ OSS ・ ☐ 一般
会社名 愛知トヨタWEST株式会社
店名 西春店
注文NO 56695279
担当者名 中村 優貴
連絡先 090-7434-2989
申請者 氏名 渡邉 尚枝 フリガナ ワタナベ ナオエ
住所 〒481-0041 北名古屋市九之坪東ノ川20
電話番号 080-1558-1570 生年月日 S38 年 11 月 19 日
使用の本拠の位置 同上
保管場所の位置 同上
車両概要 トヨタ 6AA-MXPJ10 車台番号 MXPJ10-
代替有 RAIZE (登録番号) 尾張小牧503の4356
`;

const samples = [
  { name: 'Sample 1 (陸田様 / 一宮店 / OSS)', text: sample1_text },
  { name: 'Sample 2 (西濃建設様 / 一宮三条店 / 一般)', text: sample2_text },
  { name: 'Sample 3 (児玉様 / オートステージM / 送付状+車検証)', text: sample3_text },
  { name: 'Sample 4 (寺澤様 / 小牧村中店 / OSS)', text: sample4_text },
  { name: 'Sample 5 (渡邉様 / 西春店 / OSS)', text: sample5_text }
];

console.log('==============================================');
console.log('🚀 Testing DealerDocumentParser with 5 Samples');
console.log('==============================================\n');

samples.forEach((s, idx) => {
  console.log(`--- [Test ${idx + 1}] ${s.name} ---`);
  const parsed = DealerDocumentParser.parse(s.text);
  console.log(`店舗・会社名:   ${parsed.storeFullName || parsed.dealerName}`);
  console.log(`担当者名:       ${parsed.staffName} (${parsed.staffPhone || 'なし'})`);
  console.log(`申請区分:       ${parsed.applicationType} (isOss: ${parsed.isOss})`);
  console.log(`注文No:         ${parsed.orderNo || 'なし'}`);
  console.log(`受付日:         ${parsed.receivedDate || 'なし'}`);
  console.log(`申請者名:       ${parsed.applicantName}`);
  console.log(`住所:           〒${parsed.applicantPostal || ''} ${parsed.applicantAddress}`);
  console.log(`車両:           ${parsed.carName} ${parsed.carModel} (車台: ${parsed.vin || 'なし'})`);
  console.log(`推奨タイトル:   ${parsed.suggestedTitle}`);
  console.log('----------------------------------------------\n');
});
