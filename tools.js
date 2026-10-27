/* ==========================================================================
   THE NARAYANGANJ - TOOLS SCRIPT (MFS CALCULATOR & LIMITS)
   ========================================================================== */

// নিরাপদ ডিজিট কনভার্টার গার্ড (যাতে app.js এর ওপর শতভাগ নির্ভর না করে ক্র্যাশ এড়ানো যায়)
const safeEnDigits = (val) => {
  if (val === null || val === undefined) return '';
  const bnToEn = {'০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9'};
  return val.toString().trim().replace(/[০-৯]/g, d => bnToEn[d]);
};

const safeBnDigits = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof toBanglaNumber === 'function') return toBanglaNumber(val);
  const enToBn = {'0':'০', '1':'১', '2':'২', '3':'৩', '4':'৪', '5':'৫', '6':'৬', '7':'৭', '8':'৮', '9':'৯'};
  return val.toString().replace(/\d/g, d => enToBn[d]);
};

// এমএফএস চার্জের বিস্তারিত ডেটাবেজ (ভ্যাটসহ কার্যকর রেট)
const MFS_RATES = {
  bkash: {
    name: 'বিকাশ (bKash)',
    color: '#E2136E',
    bg: '#FDF2F8',
    border: '#FBCFE8',
    icon: 'fa-solid fa-wallet',
    rates: {
      app: 18.50,         // প্রতি হাজারে ১৮.৫০ টাকা
      priyo_app: 13.95,   // প্রিয় এজেন্টে ১৩.৯৫ টাকা
      ussd: 18.50,        // ডায়াল কোডে ১৮.৫০ টাকা
      atm: 14.90          // ব্র্যাক ব্যাংক এটিএম
    }
  },
  nagad: {
    name: 'নগদ (Nagad)',
    color: '#F7941D',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: 'fa-solid fa-coins',
    rates: {
      app: 15.00,         // ভ্যাটসহ ১৫ টাকা
      ussd: 15.00,        // ডায়াল কোডে ভ্যাটসহ ১৫ টাকা (*167#)
      atm: null           // নগদ এটিএম ক্যাশআউট সাপোর্ট করে না
    }
  },
  rocket: {
    name: 'রকেট (Rocket)',
    color: '#8C3494',
    bg: '#FAF5FF',
    border: '#F3E8FF',
    icon: 'fa-solid fa-building-columns',
    rates: {
      app: 16.70,         // অ্যাপ দিয়ে ১.৬৭%
      ussd: 18.00,        // ইউএসএসডি ১.৮%
      atm: 9.00           // ডাচ-বাংলা ব্যাংক এটিএম মাত্র ০৯ টাকা
    }
  },
  upay: {
    name: 'উপায় (Upay)',
    color: '#0072CE',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    icon: 'fa-solid fa-mobile-screen',
    rates: {
      app: 14.00,         // অ্যাপে ১৪ টাকা
      ussd: 14.00,        // ইউএসএসডিতে ১৪ টাকা
      atm: 8.00           // ইউসিবি এটিএম মাত্র ০৮ টাকা
    }
  }
};

let selectedMfsFilter = 'সব';

// ১. ক্যালকুলেটর পেজ ওপেন ও ক্লোজ ফাংশন
function openMfsCalculator(defaultBrand = null) {
  const page = document.getElementById('mfsCalculatorPage');
  if (!page) return;

  const input = document.getElementById('mfsAmountInput');
  if (input && (!input.value || input.value.trim() === '')) {
    input.value = '1000'; // type="number" এর জন্য নিরাপদ মান
  }

  // ফিল্টার চিপস সেট করা
  selectedMfsFilter = defaultBrand ? defaultBrand.toLowerCase() : 'সব';
  const chipsBar = document.getElementById('mfsBrandChips');
  if (chipsBar) {
    chipsBar.querySelectorAll('.area-chip').forEach(c => {
      c.classList.remove('active');
      if (c.getAttribute('data-brand') === selectedMfsFilter) {
        c.classList.add('active');
      }
    });
  }

  calculateMfsCharges();

  page.classList.add('open');
  page.scrollTop = 0;
  window.history.pushState({ page: 'mfsCalc' }, '');
}

function closeMfsCalculator() {
  const page = document.getElementById('mfsCalculatorPage');
  if (page) page.classList.remove('open');
}

// ২. ফিল্টার চিপ হ্যান্ডলার
function setMfsFilter(brand, chipEl) {
  selectedMfsFilter = brand;
  const bar = document.getElementById('mfsBrandChips');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');
  }
  calculateMfsCharges();
}

// ৩. গণনার মূল ইঞ্জিন
function calculateMfsCharges() {
  const container = document.getElementById('mfsResultsList');
  if (!container) return;
  container.innerHTML = '';

  const input = document.getElementById('mfsAmountInput');
  let rawAmount = input ? safeEnDigits(input.value).replace(/[^\d.]/g, '') : '0';
  const amount = parseFloat(rawAmount) || 0;

  if (amount <= 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px 0;">অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন।</div>`;
    return;
  }

  const brandsToDisplay = selectedMfsFilter === 'সব' 
    ? Object.keys(MFS_RATES) 
    : [selectedMfsFilter];

  brandsToDisplay.forEach(key => {
    const data = MFS_RATES[key];
    if (!data) return;

    // চার্জ হিসেব
    const appCharge = (amount * data.rates.app) / 1000;
    const ussdCharge = (amount * data.rates.ussd) / 1000;
    const atmCharge = data.rates.atm !== null ? (amount * data.rates.atm) / 1000 : null;
    const priyoCharge = data.rates.priyo_app ? (amount * data.rates.priyo_app) / 1000 : null;

    const card = document.createElement('div');
    card.style.cssText = `background: #FFFFFF; border: 1.5px solid ${data.border}; border-radius: 12px; padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 12px;`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
        <div style="font-weight: 700; font-size: 15px; color: ${data.color}; display: flex; align-items: center; gap: 8px;">
          <i class="${data.icon}"></i> ${data.name}
        </div>
        <span style="font-size: 11px; font-weight: 600; color: #475569; background: ${data.bg}; padding: 2px 8px; border-radius: 6px;">
          মূল টাকা: ৳ ${safeBnDigits(Math.round(amount))}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px;">
        
        <!-- ১. অ্যাপ চার্জ -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 11px; color: #64748B; display: flex; justify-content: space-between;">
            <span><i class="fa-solid fa-mobile"></i> অ্যাপ ক্যাশ আউট</span>
            <strong>${safeBnDigits(data.rates.app)}৳/হাজার</strong>
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 3px;">
            ৳ ${safeBnDigits(appCharge.toFixed(2))}
          </div>
          <div style="font-size: 10px; color: #16A34A; margin-top: 2px;">
            মোট কাটবে: ৳ ${safeBnDigits((amount + appCharge).toFixed(2))}
          </div>
        </div>

        <!-- ২. ডায়াল কোড (USSD) চার্জ -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 11px; color: #64748B; display: flex; justify-content: space-between;">
            <span><i class="fa-solid fa-hashtag"></i> ডায়াল (USSD)</span>
            <strong>${safeBnDigits(data.rates.ussd)}৳/হাজার</strong>
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 3px;">
            ৳ ${safeBnDigits(ussdCharge.toFixed(2))}
          </div>
          <div style="font-size: 10px; color: #16A34A; margin-top: 2px;">
            মোট কাটবে: ৳ ${safeBnDigits((amount + ussdCharge).toFixed(2))}
          </div>
        </div>

        <!-- ৩. প্রিয় এজেন্ট (যদি থাকে) -->
        ${priyoCharge !== null ? `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 8px 10px;">
            <div style="font-size: 11px; color: #166534; display: flex; justify-content: space-between;">
              <span><i class="fa-solid fa-star"></i> প্রিয় এজেন্ট</span>
              <strong>${safeBnDigits(data.rates.priyo_app)}৳/হাজার</strong>
            </div>
            <div style="font-size: 15px; font-weight: 800; color: #15803D; margin-top: 3px;">
              ৳ ${safeBnDigits(priyoCharge.toFixed(2))}
            </div>
          </div>
        ` : ''}

        <!-- ৪. এটিএম বুথ চার্জ -->
        <div style="background: ${atmCharge !== null ? '#EFF6FF' : '#F1F5F9'}; border: 1px solid ${atmCharge !== null ? '#BFDBFE' : '#E2E8F0'}; border-radius: 8px; padding: 8px 10px; ${priyoCharge === null ? 'grid-column: span 2;' : ''}">
          <div style="font-size: 11px; color: ${atmCharge !== null ? '#1E40AF' : '#94A3B8'}; display: flex; justify-content: space-between;">
            <span><i class="fa-solid fa-money-bill-transfer"></i> এটিএম বুথ</span>
            <strong>${atmCharge !== null ? safeBnDigits(data.rates.atm) + '৳/হাজার' : 'সুবিধা নেই'}</strong>
          </div>
          <div style="font-size: 15px; font-weight: 800; color: ${atmCharge !== null ? '#1D4ED8' : '#94A3B8'}; margin-top: 3px;">
            ${atmCharge !== null ? '৳ ' + safeBnDigits(atmCharge.toFixed(2)) : 'প্রযোজ্য নয়'}
          </div>
        </div>

      </div>
    `;

    container.appendChild(card);
  });
}

/* ==========================================================================
   MFS TRANSACTION LIMIT LOGIC (BANGLADESH BANK APPROVED)
   ========================================================================== */

const MFS_LIMITS = [
  {
    service: 'ক্যাশ আউট',
    icon: 'fa-solid fa-money-bill-transfer',
    dailyCount: '১৫ বার',
    dailyAmount: '৳ ৩০,০০০',
    monthlyCount: '১২০ বার',
    monthlyAmount: '৳ ২,০০,০০০'
  },
  {
    service: 'সেন্ড মানি',
    icon: 'fa-solid fa-paper-plane',
    dailyCount: '৫০ বার',
    dailyAmount: '৳ ৫০,০০০',
    monthlyCount: '১০০ বার',
    monthlyAmount: '৳ ৩,০০,০০০'
  },
  {
    service: 'ক্যাশ ইন',
    icon: 'fa-solid fa-wallet',
    dailyCount: '১৫ বার',
    dailyAmount: '৳ ৩০,০০০',
    monthlyCount: '১০০ বার',
    monthlyAmount: '৳ ২,০০,০০০'
  },
  {
    service: 'অ্যাড মানি (ব্যাংক/কার্ড)',
    icon: 'fa-solid fa-building-columns',
    dailyCount: '২০ বার',
    dailyAmount: '৳ ৫০,০০০',
    monthlyCount: '৫০ বার',
    monthlyAmount: '৳ ৩,০০,০০০'
  },
  {
    service: 'মোবাইল রিচার্জ',
    icon: 'fa-solid fa-mobile-screen',
    dailyCount: '৫০ বার',
    dailyAmount: '৳ ১০,০০০',
    monthlyCount: '১৫০০ বার',
    monthlyAmount: '৳ ১,০০,০০০'
  }
];

let currentLimitTab = 'daily';

function renderLimitTable() {
  const tbody = document.getElementById('limitTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  MFS_LIMITS.forEach((item, idx) => {
    const row = document.createElement('tr');
    row.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

    const count = currentLimitTab === 'daily' ? item.dailyCount : item.monthlyCount;
    const amount = currentLimitTab === 'daily' ? item.dailyAmount : item.monthlyAmount;

    row.innerHTML = `
      <td>
        <div class="limit-service-title">
          <i class="${item.icon}" style="color: #7C3AED; font-size: 12px; width: 14px;"></i>
          <span>${item.service}</span>
        </div>
      </td>
      <td style="text-align: center; font-weight: 600; color: #475569;">
        ${count}
      </td>
      <td style="text-align: right; font-weight: 800; color: #0F5132; font-size: 13.5px;">
        ${amount}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function switchLimitTab(type) {
  currentLimitTab = type;
  const dBtn = document.getElementById('limitDailyBtn');
  const mBtn = document.getElementById('limitMonthlyBtn');

  if (dBtn && mBtn) {
    dBtn.classList.toggle('active', type === 'daily');
    mBtn.classList.toggle('active', type === 'monthly');
  }

  renderLimitTable();
}

function openMfsLimit() {
  const page = document.getElementById('mfsLimitPage');
  if (!page) return;
  switchLimitTab('daily');
  page.classList.add('open');
  page.scrollTop = 0;
  window.history.pushState({ page: 'mfsLimit' }, '');
}

function closeMfsLimit() {
  const page = document.getElementById('mfsLimitPage');
  if (page) page.classList.remove('open');
}