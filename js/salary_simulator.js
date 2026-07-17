/**
 * 役員報酬シミュレーター (愛知県版)
 * 夫と妻の役員報酬をシミュレーションし、世帯の手残り額と法人の内部留保を最大化します。
 */
const SalarySimulator = {
  // 愛知県の社会保険料率 (2025/2026年度基準)
  HEALTH_RATE_AICHI: 0.0994,       // 健康保険料率 (9.94%)
  HEALTH_NURSING_RATE: 0.1154,    // 介護保険該当（40歳〜64歳）健康保険料率 (9.94% + 1.6% = 11.54%)
  PENSION_RATE: 0.183,            // 厚生年金保険料率 (18.3%)
  CHILDCARE_RATE: 0.0036,         // 子ども・子育て拠出金 (0.36% - 法人負担のみ)

  // 健康保険 標準報酬月額 等級テーブル
  HEALTH_GRADES: [
    58000, 68000, 78000, 88000, 98000, 104000, 110000, 118000, 126000, 134000,
    142000, 150000, 160000, 170000, 180000, 190000, 200000, 220000, 240000, 260000,
    280000, 300000, 320000, 340000, 360000, 380000, 410000, 440000, 470000, 500000,
    530000, 560000, 590000, 620000, 650000, 680000, 710000, 750000, 790000, 830000,
    880000, 930000, 980000, 1030000, 1090000, 1150000, 1210000, 1270000, 1330000, 1390000
  ],

  // 厚生年金 標準報酬月額 等級テーブル
  PENSION_GRADES: [
    88000, 98000, 104000, 110000, 118000, 126000, 134000, 142000, 150000, 160000,
    170000, 180000, 190000, 200000, 220000, 240000, 260000, 280000, 300000, 320000,
    340000, 360000, 380000, 410000, 440000, 470000, 500000, 530000, 560000, 590000,
    620000, 650000
  ],

  // 標準報酬月額の算出 (健康保険)
  getHealthRemuneration(m) {
    if (m < 63000) return 58000;
    if (m >= 1355000) return 1390000;
    const grades = this.HEALTH_GRADES;
    for (let i = 1; i < grades.length - 1; i++) {
      const prev = grades[i - 1];
      const curr = grades[i];
      const next = grades[i + 1];
      const lower = (prev + curr) / 2;
      const upper = (curr + next) / 2;
      if (m > lower && m <= upper) return curr;
    }
    return grades[grades.length - 1];
  },

  // 標準報酬月額の算出 (厚生年金)
  getPensionRemuneration(m) {
    if (m < 93000) return 88000;
    if (m >= 635000) return 650000;
    const grades = this.PENSION_GRADES;
    for (let i = 1; i < grades.length - 1; i++) {
      const prev = grades[i - 1];
      const curr = grades[i];
      const next = grades[i + 1];
      const lower = (prev + curr) / 2;
      const upper = (curr + next) / 2;
      if (m > lower && m <= upper) return curr;
    }
    return grades[grades.length - 1];
  },

  // 給与所得控除の計算
  getEmploymentIncomeDeduction(salary) {
    if (salary <= 0) return 0;
    if (salary <= 1625000) return 550000;
    if (salary <= 1800000) return Math.floor(salary * 0.40 - 100000);
    if (salary <= 3600000) return Math.floor(salary * 0.30 + 80000);
    if (salary <= 6600000) return Math.floor(salary * 0.20 + 440000);
    if (salary <= 8500000) return Math.floor(salary * 0.10 + 1100000);
    return 1950000;
  },

  // 社会保険料の計算
  getSocialInsurance(salary, isNursing) {
    if (salary <= 0) return { employee: 0, employer: 0 };
    const m = salary / 12;
    const baseHealth = this.getHealthRemuneration(m);
    const basePension = this.getPensionRemuneration(m);
    const healthRate = isNursing ? this.HEALTH_NURSING_RATE : this.HEALTH_RATE_AICHI;

    // 折半
    const healthEmp = Math.floor(baseHealth * (healthRate / 2));
    const healthCorp = Math.floor(baseHealth * (healthRate / 2));

    const pensionEmp = Math.floor(basePension * (this.PENSION_RATE / 2));
    const pensionCorp = Math.floor(basePension * (this.PENSION_RATE / 2));

    const childcare = Math.floor(basePension * this.CHILDCARE_RATE); // 全額会社負担

    return {
      employee: (healthEmp + pensionEmp) * 12,
      employer: (healthCorp + pensionCorp + childcare) * 12
    };
  },

  // 配偶者控除・配偶者特別控除の計算 (mainIncome, spouseIncome は給与所得控除後の金額)
  getSpouseDeduction(mainIncome, spouseIncome) {
    if (mainIncome > 10000000) return { incomeTax: 0, inhabitantTax: 0 };

    let mainLevel = 0; // 0: <= 9M, 1: 9M - 9.5M, 2: 9.5M - 10M
    if (mainIncome <= 9000000) {
      mainLevel = 0;
    } else if (mainIncome <= 9500000) {
      mainLevel = 1;
    } else {
      mainLevel = 2;
    }

    if (spouseIncome <= 480000) {
      // 配偶者控除
      const table = [
        { income: 380000, inhabitant: 330000 },
        { income: 260000, inhabitant: 220000 },
        { income: 130000, inhabitant: 110000 }
      ];
      return { incomeTax: table[mainLevel].income, inhabitantTax: table[mainLevel].inhabitant };
    } else if (spouseIncome <= 1330000) {
      // 配偶者特別控除
      const specialTable = [
        { maxSpouseIncome: 950000, deductions: [{ income: 380000, inhabitant: 330000 }, { income: 260000, inhabitant: 220000 }, { income: 130000, inhabitant: 110000 }] },
        { maxSpouseIncome: 1000000, deductions: [{ income: 360000, inhabitant: 310000 }, { income: 240000, inhabitant: 210000 }, { income: 120000, inhabitant: 110000 }] },
        { maxSpouseIncome: 1050000, deductions: [{ income: 310000, inhabitant: 260000 }, { income: 210000, inhabitant: 180000 }, { income: 110000, inhabitant: 90000 }] },
        { maxSpouseIncome: 1100000, deductions: [{ income: 260000, inhabitant: 210000 }, { income: 180000, inhabitant: 150000 }, { income: 90000, inhabitant: 80000 }] },
        { maxSpouseIncome: 1150000, deductions: [{ income: 210000, inhabitant: 160000 }, { income: 140000, inhabitant: 110000 }, { income: 70000, inhabitant: 60000 }] },
        { maxSpouseIncome: 1200000, deductions: [{ income: 160000, inhabitant: 110000 }, { income: 110000, inhabitant: 80000 }, { income: 60000, inhabitant: 40000 }] },
        { maxSpouseIncome: 1250000, deductions: [{ income: 110000, inhabitant: 60000 }, { income: 80000, inhabitant: 50000 }, { income: 40000, inhabitant: 30000 }] },
        { maxSpouseIncome: 1300000, deductions: [{ income: 60000, inhabitant: 30000 }, { income: 40000, inhabitant: 30000 }, { income: 20000, inhabitant: 20000 }] },
        { maxSpouseIncome: 1330000, deductions: [{ income: 30000, inhabitant: 10000 }, { income: 20000, inhabitant: 10000 }, { income: 10000, inhabitant: 10000 }] }
      ];
      for (const row of specialTable) {
        if (spouseIncome <= row.maxSpouseIncome) {
          return {
            incomeTax: row.deductions[mainLevel].income,
            inhabitantTax: row.deductions[mainLevel].inhabitant
          };
        }
      }
    }
    return { incomeTax: 0, inhabitantTax: 0 };
  },

  // 所得税額の計算 (累進課税 + 復興特別所得税 2.1%)
  getIncomeTax(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    let baseTax = 0;
    if (taxableIncome <= 1950000) {
      baseTax = taxableIncome * 0.05;
    } else if (taxableIncome <= 3300000) {
      baseTax = taxableIncome * 0.10 - 97500;
    } else if (taxableIncome <= 6950000) {
      baseTax = taxableIncome * 0.20 - 427500;
    } else if (taxableIncome <= 9000000) {
      baseTax = taxableIncome * 0.23 - 636000;
    } else if (taxableIncome <= 18000000) {
      baseTax = taxableIncome * 0.33 - 1536000;
    } else if (taxableIncome <= 40000000) {
      baseTax = taxableIncome * 0.40 - 2796000;
    } else {
      baseTax = taxableIncome * 0.45 - 4796000;
    }
    return Math.floor(baseTax * 1.021); // 復興特別所得税を含む
  },

  // 1人の税金・社会保険のフル計算
  calculateIndividual(salary, isNursing, siPaid, spouseDeductions) {
    if (salary <= 0) {
      return {
        salary: 0,
        empDeduction: 0,
        taxableIncome: 0,
        taxableInhabitant: 0,
        incomeTax: 0,
        inhabitantTax: 0,
        netCash: 0
      };
    }

    const empDeduction = this.getEmploymentIncomeDeduction(salary);
    const grossIncome = salary - empDeduction;

    // 基礎控除額 (高所得時の段階的減少に対応)
    let basicDeductionIncome = 480000;
    let basicDeductionInhabitant = 430000;
    if (grossIncome > 24000000) {
      basicDeductionIncome = 320000;
      basicDeductionInhabitant = 290000;
    }
    if (grossIncome > 24500000) {
      basicDeductionIncome = 160000;
      basicDeductionInhabitant = 145000;
    }
    if (grossIncome > 25000000) {
      basicDeductionIncome = 0;
      basicDeductionInhabitant = 0;
    }

    // 所得税の課税所得
    const taxableIncome = Math.max(0, salary - empDeduction - siPaid - basicDeductionIncome - (spouseDeductions.incomeTax || 0));
    const incomeTax = this.getIncomeTax(taxableIncome);

    // 住民税の課税所得 (所得割10% + 均等割5000円)
    const taxableInhabitant = Math.max(0, salary - empDeduction - siPaid - basicDeductionInhabitant - (spouseDeductions.inhabitantTax || 0));
    const inhabitantTax = Math.floor(taxableInhabitant * 0.10) + 5000;

    const netCash = salary - siPaid - incomeTax - inhabitantTax;

    return {
      salary,
      empDeduction,
      taxableIncome,
      taxableInhabitant,
      incomeTax,
      inhabitantTax,
      netCash
    };
  },

  // 世帯 + 法人の全体の収支・税額を算出するメイン関数
  calculateScenario(grossProfit, corpExpenses, sh, sw, isNursingH, isNursingW) {
    const siH = this.getSocialInsurance(sh, isNursingH);
    const siW = this.getSocialInsurance(sw, isNursingW);

    // 配偶者控除のための仮計算 (所得税基準の給与所得控除後の額)
    const incomeH = Math.max(0, sh - this.getEmploymentIncomeDeduction(sh));
    const incomeW = Math.max(0, sw - this.getEmploymentIncomeDeduction(sw));

    let spouseDeductionH = { incomeTax: 0, inhabitantTax: 0 };
    let spouseDeductionW = { incomeTax: 0, inhabitantTax: 0 };

    if (sh > 0 && sw > 0) {
      if (sh >= sw) {
        spouseDeductionH = this.getSpouseDeduction(incomeH, incomeW);
      } else {
        spouseDeductionW = this.getSpouseDeduction(incomeW, incomeH);
      }
    } else if (sh > 0 && sw === 0) {
      spouseDeductionH = this.getSpouseDeduction(incomeH, 0);
    } else if (sw > 0 && sh === 0) {
      spouseDeductionW = this.getSpouseDeduction(incomeW, 0);
    }

    const indH = this.calculateIndividual(sh, isNursingH, siH.employee, spouseDeductionH);
    const indW = this.calculateIndividual(sw, isNursingW, siW.employee, spouseDeductionW);

    // 法人計算
    const totalCorpSI = siH.employer + siW.employer;
    const corpTaxableIncome = grossProfit - (sh + sw) - totalCorpSI - corpExpenses;

    let corpTaxes = 70000; // 赤字でも発生する均等割
    if (corpTaxableIncome > 0) {
      if (corpTaxableIncome <= 8000000) {
        corpTaxes += Math.floor(corpTaxableIncome * 0.23); // 実効税率約23%
      } else {
        corpTaxes += Math.floor(8000000 * 0.23 + (corpTaxableIncome - 8000000) * 0.34); // 800万円超の部分は34%
      }
    }

    const corpRetained = corpTaxableIncome - corpTaxes; // 内部留保額 (税金引き後)

    const householdNet = indH.netCash + indW.netCash;
    const combinedTotal = householdNet + corpRetained;

    const totalTaxes = indH.incomeTax + indH.inhabitantTax + indW.incomeTax + indW.inhabitantTax + corpTaxes;
    const totalSI = siH.employee + siH.employer + siW.employee + siW.employer;

    return {
      grossProfit,
      corpExpenses,
      sh,
      sw,
      siH,
      siW,
      indH,
      indW,
      corpTaxableIncome,
      corpTaxes,
      corpRetained,
      householdNet,
      combinedTotal,
      totalTaxes,
      totalSI
    };
  },

  // 自動最適化ロジック (全パターングリッドサーチ)
  optimize(grossProfit, corpExpenses, isNursingH, isNursingW) {
    let bestCombined = -Infinity;
    let bestSh = 0;
    let bestSw = 0;
    let bestResult = null;

    // 粗利額によって走査ステップ幅を動的に設定し、パフォーマンスを確保する
    let step = 100000; // 基本は10万円単位
    if (grossProfit > 15000000) step = 200000; // 1,500万円超は20万円単位
    if (grossProfit > 30000000) step = 500000; // 3,000万円超は50万円単位

    // 夫と妻の報酬の組み合わせを総当りで検証 (想定粗利の範囲内)
    for (let sh = 0; sh <= grossProfit; sh += step) {
      for (let sw = 0; sw <= grossProfit - sh; sw += step) {
        // 社会保険料(会社負担分)と salaries の合計が粗利内に収まる組み合わせをベースにする
        // (一時的な赤字許容は別途計算できるが、実務上の基本安全圏をベースにする)
        const result = this.calculateScenario(grossProfit, corpExpenses, sh, sw, isNursingH, isNursingW);
        if (result.combinedTotal > bestCombined) {
          bestCombined = result.combinedTotal;
          bestSh = sh;
          bestSw = sw;
          bestResult = result;
        }
      }
    }

    return {
      sh: bestSh,
      sw: bestSw,
      result: bestResult
    };
  },

  // モーダルの表示
  show() {
    const existing = document.getElementById('salarySimulatorModal');
    if (existing) existing.remove();

    // デフォルト値
    const defaultGross = 10000000;
    const defaultExpenses = 1000000;
    const defaultSh = 5000000;
    const defaultSw = 3000000;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'salarySimulatorModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('salarySimulatorModal').remove()"></div>
      <div class="modal-content modal-large" style="max-width: 960px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        
        <!-- ヘッダー -->
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 0;">
          <h2 style="display:flex; align-items:center; gap:8px;">⚖️ 役員報酬シミュレーター <span style="font-size:0.75rem; background:rgba(245,158,11,0.15); color:var(--accent-gold); padding:2px 8px; border-radius:4px; border:1px solid rgba(245,158,11,0.3)">愛知県支部料率基準</span></h2>
          <button class="modal-close" onclick="document.getElementById('salarySimulatorModal').remove()">✕</button>
        </div>

        <!-- 2カラムコンテンツ -->
        <div class="simulator-layout" style="display: grid; grid-template-columns: 350px 1fr; gap: 24px; min-height: 520px;">
          
          <!-- 左カラム: パラメータ設定 -->
          <div class="sim-inputs-card" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); border-left: 3px solid var(--accent-gold); padding-left: 8px;">📊 シミュレーション条件</h3>
            
            <!-- 粗利入力 -->
            <div class="sim-form-group">
              <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">想定年間粗利</label>
                <span class="val-display" id="val_gross" style="font-weight:700; color:var(--accent-gold);">10,000,000円</span>
              </div>
              <input type="range" id="sim_gross" min="2000000" max="30000000" step="500000" value="${defaultGross}" style="width:100%;">
              <input type="number" id="num_gross" value="${defaultGross}" step="100000" style="width:100%; margin-top:6px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:4px; color:#fff; padding:4px 8px; font-size:0.85rem;">
            </div>

            <!-- その他経費入力 -->
            <div class="sim-form-group">
              <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">その他の経費 (報酬除く)</label>
                <span class="val-display" id="val_expenses" style="font-weight:700; color:var(--text-primary);">1,000,000円</span>
              </div>
              <input type="range" id="sim_expenses" min="0" max="10000000" step="100000" value="${defaultExpenses}" style="width:100%;">
              <input type="number" id="num_expenses" value="${defaultExpenses}" step="50000" style="width:100%; margin-top:6px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:4px; color:#fff; padding:4px 8px; font-size:0.85rem;">
            </div>

            <hr style="border:none; border-top:1px solid var(--border-color); margin: 4px 0;">

            <!-- 夫の年齢トグル -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size: 0.82rem;">
              <span style="color:var(--text-secondary)">夫の介護保険 (40歳〜64歳)</span>
              <label class="switch-toggle" style="position:relative; display:inline-block; width:44px; height:22px;">
                <input type="checkbox" id="sim_nursing_h" style="opacity:0; width:0; height:0;">
                <span class="slider-toggle" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#4b5563; transition:.2s; border-radius:34px;"></span>
              </label>
            </div>

            <!-- 夫の役員報酬 -->
            <div class="sim-form-group">
              <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">夫の年間役員報酬</label>
                <span class="val-display" id="val_sh" style="font-weight:700; color:var(--accent-blue);">5,000,000円</span>
              </div>
              <input type="range" id="sim_sh" min="0" max="20000000" step="100000" value="${defaultSh}" style="width:100%;">
              <input type="number" id="num_sh" value="${defaultSh}" step="100000" style="width:100%; margin-top:6px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:4px; color:#fff; padding:4px 8px; font-size:0.85rem;">
            </div>

            <hr style="border:none; border-top:1px solid var(--border-color); margin: 4px 0;">

            <!-- 妻の年齢トグル -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size: 0.82rem;">
              <span style="color:var(--text-secondary)">妻の介護保険 (40歳〜64歳)</span>
              <label class="switch-toggle" style="position:relative; display:inline-block; width:44px; height:22px;">
                <input type="checkbox" id="sim_nursing_w" style="opacity:0; width:0; height:0;">
                <span class="slider-toggle" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#4b5563; transition:.2s; border-radius:34px;"></span>
              </label>
            </div>

            <!-- 妻の役員報酬 -->
            <div class="sim-form-group">
              <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">妻の年間役員報酬</label>
                <span class="val-display" id="val_sw" style="font-weight:700; color:var(--accent-purple);">3,000,000円</span>
              </div>
              <input type="range" id="sim_sw" min="0" max="20000000" step="100000" value="${defaultSw}" style="width:100%;">
              <input type="number" id="num_sw" value="${defaultSw}" step="100000" style="width:100%; margin-top:6px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:4px; color:#fff; padding:4px 8px; font-size:0.85rem;">
            </div>

            <!-- 自動最適化ボタン -->
            <button class="btn btn-primary" id="btn_optimize" style="justify-content:center; padding:12px; font-weight:700; font-size:0.95rem; margin-top: 6px; box-shadow: 0 4px 12px rgba(245,158,11,0.2);">
              ⚡ 最適な報酬配分を自動計算
            </button>
          </div>

          <!-- 右カラム: シミュレーション結果 -->
          <div class="sim-results-card" style="display: flex; flex-direction: column; gap: 16px; overflow-y:auto; padding-right:4px;">
            
            <!-- 最適配分サマリー (目玉パネル) -->
            <div id="optimization_banner" style="display:none; background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(16,185,129,0.08)); border: 1px dashed var(--accent-gold); border-radius: var(--radius); padding: 14px 18px;">
              <h4 style="color: var(--accent-gold); font-size: 0.88rem; margin-bottom:4px; display:flex; align-items:center; gap:6px;">💡 シミュレーターからの最適化提案</h4>
              <p id="optimization_advice" style="font-size:0.85rem; line-height:1.45; color:var(--text-primary);"></p>
            </div>

            <!-- グラフ・手残りサマリー -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
              <!-- 資金の配分サマリー -->
              <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; justify-content:center;">
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">世帯手残り（個人正味手取り合計）</div>
                <div id="summary_household_net" style="font-size:1.6rem; font-weight:700; color:#2dd4a8;">¥0</div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:10px; margin-bottom:4px;">法人内部留保（税引後利益）</div>
                <div id="summary_corp_retained" style="font-size:1.25rem; font-weight:700; color:var(--accent-gold);">¥0</div>
              </div>

              <!-- 全体手残り総額 -->
              <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; justify-content:center; border-left:4px solid #10b981;">
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">世帯＋法人 キャッシュ留保総額</div>
                <div id="summary_combined_total" style="font-size:1.8rem; font-weight:800; color:#10b981;">¥0</div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px;">
                  税金・社会保険料等による流出総額: <span id="summary_drain" style="font-weight:600; color:var(--accent-red)">¥0</span>
                </div>
              </div>
            </div>

            <!-- 視覚的バーチャート (手残り vs 流出) -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding:16px;">
              <h4 style="font-size:0.85rem; margin-bottom:12px; color:var(--text-secondary);">💵 キャッシュフロー構造図</h4>
              <div class="chart-bars" style="gap:14px;">
                <!-- 手残り部分 -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span>🟢 世帯手残り + 法人内部留保 (実質手残り)</span>
                    <span id="chart_txt_retained" style="font-weight:700;">0%</span>
                  </div>
                  <div style="height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; display:flex;">
                    <div id="chart_bar_household" style="width: 0%; height:100%; background: #2dd4a8; transition: width 0.3s ease;"></div>
                    <div id="chart_bar_corp" style="width: 0%; height:100%; background: #f59e0b; transition: width 0.3s ease;"></div>
                  </div>
                </div>
                <!-- 流出部分 -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span>🔴 税金・社会保険料 (流出コスト)</span>
                    <span id="chart_txt_drain" style="font-weight:700; color:var(--accent-red)">0%</span>
                  </div>
                  <div style="height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; display:flex;">
                    <div id="chart_bar_drain" style="width: 0%; height:100%; background: #ef4444; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 明細テーブル -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); overflow:hidden;">
              <table class="acc-table" style="font-size:0.82rem; margin-bottom:0;">
                <thead>
                  <tr style="background:rgba(255,255,255,0.02)">
                    <th>項目</th>
                    <th style="color:var(--accent-blue); text-align:right;">夫 (個人)</th>
                    <th style="color:var(--accent-purple); text-align:right;">妻 (個人)</th>
                    <th style="color:var(--accent-gold); text-align:right;">法人 (会社)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>役員報酬 / 粗利</b></td>
                    <td id="tbl_sh" style="text-align:right; font-weight:600;">¥0</td>
                    <td id="tbl_sw" style="text-align:right; font-weight:600;">¥0</td>
                    <td id="tbl_gross" style="text-align:right; color:var(--text-secondary);">¥0</td>
                  </tr>
                  <tr>
                    <td>給与所得控除</td>
                    <td id="tbl_deduct_h" style="text-align:right; color:var(--text-muted);">¥0</td>
                    <td id="tbl_deduct_w" style="text-align:right; color:var(--text-muted);">¥0</td>
                    <td style="text-align:right; color:var(--text-muted);">—</td>
                  </tr>
                  <tr>
                    <td>社会保険料 (個人/会社負担)</td>
                    <td id="tbl_si_h" style="text-align:right; color:var(--accent-red);">¥0</td>
                    <td id="tbl_si_w" style="text-align:right; color:var(--accent-red);">¥0</td>
                    <td id="tbl_si_corp" style="text-align:right; color:var(--accent-red);">¥0</td>
                  </tr>
                  <tr>
                    <td>所得税 (復興特別所得税含)</td>
                    <td id="tbl_itax_h" style="text-align:right; color:var(--accent-orange);">¥0</td>
                    <td id="tbl_itax_w" style="text-align:right; color:var(--accent-orange);">¥0</td>
                    <td style="text-align:right; color:var(--text-muted); font-size:0.75rem">課税所得：<span id="tbl_corp_income">¥0</span></td>
                  </tr>
                  <tr>
                    <td>住民税 (個人/法人住民税)</td>
                    <td id="tbl_ztax_h" style="text-align:right; color:var(--accent-orange);">¥0</td>
                    <td id="tbl_ztax_w" style="text-align:right; color:var(--accent-orange);">¥0</td>
                    <td id="tbl_corp_tax" style="text-align:right; color:var(--accent-orange); font-weight:600;">¥0</td>
                  </tr>
                  <tr style="background:rgba(255,255,255,0.01); border-top: 2px solid var(--border-color); font-weight:700;">
                    <td><b>差引手残り額</b></td>
                    <td id="tbl_net_h" style="text-align:right; color:#2dd4a8;">¥0</td>
                    <td id="tbl_net_w" style="text-align:right; color:#2dd4a8;">¥0</td>
                    <td id="tbl_net_corp" style="text-align:right; color:var(--accent-gold);">¥0</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // CSSスタイルの追加 (トグルスイッチ用およびスライダーカスタム)
    const styleId = 'salary-simulator-custom-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        /* スライダーコンテナ */
        .sim-form-group input[type="range"] {
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: var(--border-color);
          outline: none;
        }
        .sim-form-group input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent-gold);
          cursor: pointer;
          transition: transform 0.1s;
        }
        .sim-form-group input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        
        /* トグルスイッチ */
        .switch-toggle input:checked + .slider-toggle {
          background-color: var(--accent-green);
        }
        .slider-toggle:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        .switch-toggle input:checked + .slider-toggle:before {
          transform: translateX(22px);
        }
      `;
      document.head.appendChild(style);
    }

    // イベント登録
    this.initEvents();
    // 初期計算
    this.updateCalculation();
  },

  // イベントハンドラの紐づけ
  initEvents() {
    const ids = [
      { r: 'sim_gross', n: 'num_gross' },
      { r: 'sim_expenses', n: 'num_expenses' },
      { r: 'sim_sh', n: 'num_sh' },
      { r: 'sim_sw', n: 'num_sw' }
    ];

    ids.forEach(pair => {
      const rangeEl = document.getElementById(pair.r);
      const numEl = document.getElementById(pair.n);

      if (rangeEl && numEl) {
        // レンジが動いたら数値を更新
        rangeEl.addEventListener('input', (e) => {
          numEl.value = e.target.value;
          this.updateCalculation();
        });
        // 数値が変更されたらレンジを更新
        numEl.addEventListener('change', (e) => {
          let val = Number(e.target.value);
          const min = Number(rangeEl.min);
          const max = Number(rangeEl.max);
          if (val < min) val = min;
          if (val > max) val = max;
          numEl.value = val;
          rangeEl.value = val;
          this.updateCalculation();
        });
      }
    });

    const toggles = ['sim_nursing_h', 'sim_nursing_w'];
    toggles.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.updateCalculation());
      }
    });

    // 最適化ボタン
    const btnOpt = document.getElementById('btn_optimize');
    if (btnOpt) {
      btnOpt.addEventListener('click', () => this.runOptimization());
    }
  },

  // 計算の実行と表示の更新
  updateCalculation() {
    const gross = Number(document.getElementById('sim_gross').value);
    const expenses = Number(document.getElementById('sim_expenses').value);
    const sh = Number(document.getElementById('sim_sh').value);
    const sw = Number(document.getElementById('sim_sw').value);
    const nursingH = document.getElementById('sim_nursing_h').checked;
    const nursingW = document.getElementById('sim_nursing_w').checked;

    // ラベル更新
    document.getElementById('val_gross').textContent = `${gross.toLocaleString()}円`;
    document.getElementById('val_expenses').textContent = `${expenses.toLocaleString()}円`;
    document.getElementById('val_sh').textContent = `${sh.toLocaleString()}円`;
    document.getElementById('val_sw').textContent = `${sw.toLocaleString()}円`;

    // 計算実行
    const data = this.calculateScenario(gross, expenses, sh, sw, nursingH, nursingW);

    // サマリー値の更新
    document.getElementById('summary_household_net').textContent = `¥${data.householdNet.toLocaleString()}`;
    document.getElementById('summary_corp_retained').textContent = `¥${data.corpRetained.toLocaleString()}`;
    document.getElementById('summary_combined_total').textContent = `¥${data.combinedTotal.toLocaleString()}`;
    
    const drainTotal = data.totalTaxes + data.totalSI;
    document.getElementById('summary_drain').textContent = `¥${drainTotal.toLocaleString()}`;

    // バーチャートの更新
    const totalAmount = gross; // 全体資金ベース
    const householdPct = Math.max(0, (data.householdNet / totalAmount) * 100);
    const corpPct = Math.max(0, (data.corpRetained / totalAmount) * 100);
    const drainPct = Math.max(0, (drainTotal / totalAmount) * 100);

    document.getElementById('chart_bar_household').style.width = `${householdPct}%`;
    document.getElementById('chart_bar_corp').style.width = `${corpPct}%`;
    document.getElementById('chart_bar_drain').style.width = `${drainPct}%`;

    const retainedTotalPct = Math.round(householdPct + corpPct);
    const drainTotalPct = Math.round(drainPct);
    document.getElementById('chart_txt_retained').textContent = `${retainedTotalPct}% (¥${(data.householdNet + data.corpRetained).toLocaleString()})`;
    document.getElementById('chart_txt_drain').textContent = `${drainTotalPct}% (¥${drainTotal.toLocaleString()})`;

    // テーブル明細更新
    document.getElementById('tbl_sh').textContent = `¥${sh.toLocaleString()}`;
    document.getElementById('tbl_sw').textContent = `¥${sw.toLocaleString()}`;
    document.getElementById('tbl_gross').textContent = `¥${gross.toLocaleString()}`;

    document.getElementById('tbl_deduct_h').textContent = `¥${data.indH.empDeduction.toLocaleString()}`;
    document.getElementById('tbl_deduct_w').textContent = `¥${data.indW.empDeduction.toLocaleString()}`;

    document.getElementById('tbl_si_h').textContent = `¥${data.siH.employee.toLocaleString()}`;
    document.getElementById('tbl_si_w').textContent = `¥${data.siW.employee.toLocaleString()}`;
    document.getElementById('tbl_si_corp').textContent = `¥${(data.siH.employer + data.siW.employer).toLocaleString()}`;

    document.getElementById('tbl_itax_h').textContent = `¥${data.indH.incomeTax.toLocaleString()}`;
    document.getElementById('tbl_itax_w').textContent = `¥${data.indW.incomeTax.toLocaleString()}`;
    document.getElementById('tbl_corp_income').textContent = `¥${Math.max(0, data.corpTaxableIncome).toLocaleString()}`;

    document.getElementById('tbl_ztax_h').textContent = `¥${data.indH.inhabitantTax.toLocaleString()}`;
    document.getElementById('tbl_ztax_w').textContent = `¥${data.indW.inhabitantTax.toLocaleString()}`;
    document.getElementById('tbl_corp_tax').textContent = `¥${data.corpTaxes.toLocaleString()}`;

    document.getElementById('tbl_net_h').textContent = `¥${data.indH.netCash.toLocaleString()}`;
    document.getElementById('tbl_net_w').textContent = `¥${data.indW.netCash.toLocaleString()}`;
    document.getElementById('tbl_net_corp').textContent = `¥${data.corpRetained.toLocaleString()}`;
  },

  // 自動最適化の実行
  runOptimization() {
    const gross = Number(document.getElementById('sim_gross').value);
    const expenses = Number(document.getElementById('sim_expenses').value);
    const nursingH = document.getElementById('sim_nursing_h').checked;
    const nursingW = document.getElementById('sim_nursing_w').checked;

    // 現在の設定情報
    const currSh = Number(document.getElementById('sim_sh').value);
    const currSw = Number(document.getElementById('sim_sw').value);
    const currentData = this.calculateScenario(gross, expenses, currSh, currSw, nursingH, nursingW);

    // 最適化走査
    const opt = this.optimize(gross, expenses, nursingH, nursingW);

    // 画面スライダー値を最適値に更新
    document.getElementById('sim_sh').value = opt.sh;
    document.getElementById('num_sh').value = opt.sh;
    document.getElementById('sim_sw').value = opt.sw;
    document.getElementById('num_sw').value = opt.sw;

    // 再計算
    this.updateCalculation();

    // 差額とアドバイスの提示
    const diff = opt.result.combinedTotal - currentData.combinedTotal;
    const banner = document.getElementById('optimization_banner');
    const advice = document.getElementById('optimization_advice');

    banner.style.display = 'block';

    let adviceHtml = '';
    if (diff > 10000) {
      adviceHtml = `現在の設定（夫 ${currSh/10000}万円 / 妻 ${currSw/10000}万円）と比較して、最適な配分は <b>夫 ${opt.sh/10000}万円 / 妻 ${opt.sw/10000}万円</b> です。<br>` +
                   `これにより、世帯と法人に残る合計キャッシュが年間で <b>¥${diff.toLocaleString()}</b> 改善（節税および社会保険料の削減）されます！<br><br>` +
                   `<b>💡 改善の理由:</b><br>` +
                   `1. <b>給与所得控除のダブル活用:</b> 夫婦それぞれに報酬を分散することで、給与所得控除（最低55万円×2）が最大限適用され、世帯全体の課税対象所得が下がります。<br>` +
                   `2. <b>所得税の超過累進税率の回避:</b> 1人に報酬を集中させると高い所得税率（10%〜23%以上）が適用されますが、夫婦で均等化することで低い税率（5%〜10%）のレンジに留めやすくなります。<br>` +
                   `3. <b>社会保険料の抑制:</b> 愛知県の社会保険料（健康保険9.94%・厚生年金18.3%）を考慮し、法人の実効税率（23%〜34%）とのバランスを考慮した最適値となっています。`;
    } else {
      adviceHtml = `お見事です！現在の設定（夫 ${currSh/10000}万円 / 妻 ${currSw/10000}万円）は、ほぼ理論上の最適配分（合計留保最大化）になっています！<br><br>` +
                   `<b>最適な配分:</b> 夫 ${opt.sh/10000}万円 / 妻 ${opt.sw/10000}万円 (世帯＋法人留保: ¥${opt.result.combinedTotal.toLocaleString()})<br>` +
                   `夫婦で報酬を分散させることで、給与所得控除のダブル適用と所得税の累進負担が効果的に抑制されています。法人化の準備はバッチリです！`;
    }

    advice.innerHTML = adviceHtml;
    App.showToast('⚡ 最適な役員報酬の配分を計算・適用しました');
  }
};
