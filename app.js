/**
 * ====================================================================
 * The Narayanganj - ডিজিটাল ডিরেক্টরি ও শিক্ষা তথ্যকোষ
 * ফাইল: app.js
 * আর্কিটেকচার: Vanilla JS Single Page Application (SPA)
 * ডেটা সোর্স: Google Sheets (OpenSheet API)
 * ====================================================================
 */

// ১. কনফিগারেশন ও গ্লোবাল স্টেট
const CONFIG = {
  // আপনার গুগল শিটের আইডি এখানে বসাবেন
  SPREADSHEET_ID: "1ctXswktft11lTCw_TiTbwoF2jgmLsHaf4Zno23QImjQ",
  STORAGE_KEY_BOOKMARKS: "narayanganj_bookmarks",
  API_BASE: "https://opensheet.elk.sh"
};

const STATE = {
  sheet1: [],          // সাধারণ প্রতিষ্ঠান ও জরুরি সেবা
  doctors: [],         // বিশেষজ্ঞ চিকিৎসক তালিকা
  education: [],       // শিক্ষা প্রতিষ্ঠান (ব্যানবেইস ২১৮টি প্রতিষ্ঠান)
  results: [],         // বোর্ড পরীক্ষার ফলাফল
  bookmarks: [],       // ফেভারিট তালিকা
  currentTab: 'home',  // বর্তমান দৃশ্যমান পেজ
  educationFilter: {
    type: 'all',
    upazila: 'all',
    search: ''
  }
};

// ২. ইউটিলিটি ফাংশনসমূহ (Helper Functions)

/**
 * বাংলা সংখ্যাকে ডায়ালার ও স্ট্যান্ডার্ড সংখ্যার জন্য ইংরেজিতে রূপান্তর
 */
function toEnglishDigits(str) {
  if (!str) return '';
  const banglaDigits = {'০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9'};
  return str.toString().replace(/[০-৯]/g, match => banglaDigits[match]);
}

/**
 * ফোন নম্বর নরমালাইজেশন (সামনে শূন্য যোগ এবং ডায়ালিং উপযোগী করা)
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = toEnglishDigits(phone).replace(/[^\d+]/g, '');
  // যদি ১১ ডিজিটের মোবাইল কিন্তু শুরুর ০ বাদ পড়ে থাকে
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Fisher-Yates র‍্যান্ডমাইজেশন (Featured আইটেম শীর্ষে রেখে বাকিগুলো এলোমেলো করা)
 */
function shuffleWithFeatured(array) {
  if (!Array.isArray(array)) return [];
  const featured = array.filter(item => (item.featured || '').toString().toLowerCase().trim() === 'yes');
  const regular = array.filter(item => (item.featured || '').toString().toLowerCase().trim() !== 'yes');

  for (let i = regular.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [regular[i], regular[j]] = [regular[j], regular[i]];
  }
  return [...featured, ...regular];
}

/**
 * টোস্ট নোটিফিকেশন প্রদর্শন
 */
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs shadow-lg z-50 transition-opacity duration-300 pointer-events-none opacity-0';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2200);
}

// ৩. লোকাল স্টোরেজ ও বুকমার্কিং সিস্টেম

function loadBookmarks() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY_BOOKMARKS);
    STATE.bookmarks = saved ? JSON.parse(saved) : [];
  } catch (e) {
    STATE.bookmarks = [];
  }
}

function toggleBookmark(id, type, title) {
  const index = STATE.bookmarks.findIndex(b => b.id === id && b.type === type);
  if (index > -1) {
    STATE.bookmarks.splice(index, 1);
    showToast(`"${title}" ফেভারিট থেকে সরানো হয়েছে`);
  } else {
    STATE.bookmarks.push({ id, type, title, savedAt: new Date().toISOString() });
    showToast(`"${title}" ফেভারিটে যুক্ত হয়েছে`);
  }
  localStorage.setItem(CONFIG.STORAGE_KEY_BOOKMARKS, JSON.stringify(STATE.bookmarks));
  updateBookmarkButtons();
}

function isBookmarked(id, type) {
  return STATE.bookmarks.some(b => b.id === id && b.type === type);
}

function updateBookmarkButtons() {
  document.querySelectorAll('[data-bookmark-id]').forEach(btn => {
    const id = btn.getAttribute('data-bookmark-id');
    const type = btn.getAttribute('data-bookmark-type');
    const icon = btn.querySelector('i');
    if (isBookmarked(id, type)) {
      btn.classList.add('text-amber-500');
      if (icon) icon.className = 'fa-solid fa-bookmark';
    } else {
      btn.classList.remove('text-amber-500');
      if (icon) icon.className = 'fa-regular fa-bookmark';
    }
  });
}

// ৪. এপিআই ডেটা লোডিং ও ক্যাশিং (On-Demand Loading)

async function fetchSheetData(tabName) {
  const url = `${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/${encodeURIComponent(tabName)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error loading tab "${tabName}":`, err);
    return [];
  }
}

// মূল অ্যাপ ডেটা ইনিশিয়ালাইজেশন
async function initAppData() {
  showLoader(true);
  try {
    // Sheet1 এবং Doctors একবারে লোড হবে
    const [sheet1Data, docData] = await Promise.all([
      fetchSheetData('Sheet1'),
      fetchSheetData('Doctors')
    ]);
    STATE.sheet1 = sheet1Data || [];
    STATE.doctors = docData || [];
    
    renderHomeScreen();
  } catch (error) {
    console.error("ইনিশিয়াল লোডিং ব্যর্থ:", error);
    showToast("ডেটা লোড করতে সমস্যা হয়েছে! ইন্টারনেট সংযোগ পরীক্ষা করুন।");
  } finally {
    showLoader(false);
  }
}

// শিক্ষা ও ফলাফল ডেটা (প্রথম ক্লিকে Lazy Load হবে)
async function ensureEducationDataLoaded() {
  if (STATE.education.length > 0) return true;

  showLoader(true);
  try {
    const [eduData, resData] = await Promise.all([
      fetchSheetData('Education'),
      fetchSheetData('Results')
    ]);
    STATE.education = eduData || [];
    STATE.results = resData || [];
    return true;
  } catch (err) {
    showToast("শিক্ষা প্রতিষ্ঠানের তথ্য লোড করা যায়নি!");
    return false;
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.toggle('hidden', !show);
  }
}

// ৫. এসপিএ রাউটিং ও ব্যাক-বাটন হ্যান্ডলিং (History Navigation)

function navigateTo(pageId, pageTitle = 'The Narayanganj', stateData = {}) {
  // হিস্ট্রি পুশ করা যাতে মোবাইলের ব্যাক বাটন চাপলে পূর্বের পেজে ফেরে
  history.pushState({ pageId, ...stateData }, pageTitle, `#${pageId}`);
  renderPage(pageId, stateData);
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.pageId) {
    renderPage(e.state.pageId, e.state, false);
  } else {
    renderPage('home', {}, false);
  }
});

function renderPage(pageId, data = {}, updateHistory = true) {
  STATE.currentTab = pageId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // সব পেজ ভিউ লুকিয়ে নির্দিষ্ট পেজ উন্মুক্ত করা
  document.querySelectorAll('.app-page').forEach(el => el.classList.add('hidden'));

  const activeElement = document.getElementById(`view-${pageId}`);
  if (activeElement) activeElement.classList.remove('hidden');

  // বটম নেভিগেশন বারের অ্যাক্টিভ ক্লাস আপডেট
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.getAttribute('data-target') === pageId) {
      item.classList.add('text-emerald-700', 'font-bold');
      item.classList.remove('text-slate-500');
    } else {
      item.classList.remove('text-emerald-700', 'font-bold');
      item.classList.add('text-slate-500');
    }
  });

  // পেজ অনুযায়ী রেন্ডার ট্রিগার
  switch (pageId) {
    case 'home':
      renderHomeScreen();
      break;
    case 'education':
      renderEducationScreen();
      break;
    case 'doctors':
      renderDoctorsScreen();
      break;
    case 'bookmarks':
      renderBookmarksScreen();
      break;
    case 'education-details':
      renderEducationDetails(data.eiin);
      break;
    case 'doctor-details':
      renderDoctorDetails(data.name);
      break;
    case 'item-details':
      renderItemDetails(data.id);
      break;
  }
}

// ৬. হোম পেজ রেন্ডারিং ও সমন্বিত সার্চ
function renderHomeScreen() {
  const container = document.getElementById('home-content');
  if (!container) return;

  // হোম পেজে ফিচারড সার্ভিসেস এবং হটলাইন গ্রিড
  const featured = shuffleWithFeatured(STATE.sheet1).slice(0, 8);

  let html = `
    <!-- সার্চ বার -->
    <div class="relative mb-4">
      <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
      <input type="text" id="home-search-input" 
        placeholder="হাসপাতাল, ডাক্তার বা শিক্ষা প্রতিষ্ঠান খুঁজুন..." 
        class="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm"
        oninput="handleHomeSearch(this.value)"
      />
    </div>

    <div id="home-search-results" class="hidden mb-6"></div>

    <!-- কুইক অ্যাকশন ক্যাটাগরি -->
    <div class="grid grid-cols-4 gap-2.5 mb-6 text-center">
      <div onclick="navigateTo('education')" class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition cursor-pointer">
        <div class="w-10 h-10 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 text-lg">
          <i class="fa-solid fa-graduation-cap"></i>
        </div>
        <span class="text-xs font-semibold text-slate-800">শিক্ষা</span>
      </div>

      <div onclick="navigateTo('doctors')" class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition cursor-pointer">
        <div class="w-10 h-10 mx-auto rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 text-lg">
          <i class="fa-solid fa-user-doctor"></i>
        </div>
        <span class="text-xs font-semibold text-slate-800">ডাক্তার</span>
      </div>

      <div onclick="filterCategory('সরকারি হাসপাতাল')" class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition cursor-pointer">
        <div class="w-10 h-10 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 text-lg">
          <i class="fa-solid fa-hospital"></i>
        </div>
        <span class="text-xs font-semibold text-slate-800">হাসপাতাল</span>
      </div>

      <div onclick="filterCategory('জরুরি সেবা')" class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition cursor-pointer">
        <div class="w-10 h-10 mx-auto rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 text-lg">
          <i class="fa-solid fa-truck-medical"></i>
        </div>
        <span class="text-xs font-semibold text-slate-800">জরুরি</span>
      </div>
    </div>

    <!-- গুরুত্বপূর্ণ প্রতিষ্ঠানসমূহ -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-slate-800 text-sm">গুরুত্বপূর্ণ প্রতিষ্ঠানসমূহ</h3>
      <span class="text-xs text-emerald-600 cursor-pointer font-medium" onclick="navigateTo('explore')">সব দেখুন</span>
    </div>

    <div class="grid grid-cols-1 gap-2.5">
      ${featured.map(item => `
        <div onclick="navigateTo('item-details', 'The Narayanganj', { id: '${item.id}' })" 
          class="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm hover:border-emerald-300 transition cursor-pointer flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-base">
              <i class="fa-solid ${getCategoryIcon(item.category)}"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">${item.name}</h4>
              <p class="text-[11px] text-slate-500">${item.category} •${item.area || 'নারায়ণগঞ্জ'}</p>
            </div>
          </div>
          ${item.phone ? `
            <a href="tel:${cleanPhoneNumber(item.phone)}" onclick="event.stopPropagation()" 
              class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
              <i class="fa-solid fa-phone"></i>
            </a>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  container.innerHTML = html;
}

function getCategoryIcon(cat) {
  if (!cat) return 'fa-location-dot';
  if (cat.includes('হাসপাতাল')) return 'fa-hospital';
  if (cat.includes('ডায়াগনস্টিক')) return 'fa-microscope';
  if (cat.includes('সংবাদপত্র')) return 'fa-newspaper';
  if (cat.includes('ডেন্টাল')) return 'fa-tooth';
  return 'fa-building-columns';
}

// ৭. শিক্ষা প্রতিষ্ঠান স্ক্রিন ও ব্যাকগ্রাউন্ড সার্চ (Education Module)

async function renderEducationScreen() {
  const container = document.getElementById('education-content');
  if (!container) return;

  container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-circle-notch fa-spin text-xl mb-2"></i><br>শিক্ষা প্রতিষ্ঠানের তথ্য লোড হচ্ছে...</div>`;
  
  const ready = await ensureEducationDataLoaded();
  if (!ready) {
    container.innerHTML = `<div class="p-6 text-center text-rose-500 text-xs">ডেটা লোড করা যায়নি। পুনরায় চেষ্টা করুন।</div>`;
    return;
  }

  // ফিল্টার হেডার
  let html = `
    <!-- শিক্ষা সার্চ বার -->
    <div class="relative mb-3">
      <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
      <input type="text" id="edu-search-input" 
        placeholder="স্কুল/কলেজের নাম বা EIIN দিয়ে খুঁজুন..." 
        value="${STATE.educationFilter.search}"
        class="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
        oninput="handleEduSearch(this.value)"
      />
    </div>

    <!-- কুইক টাইপ চিপস -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar text-xs">
      ${['all', 'স্কুল', 'কলেজ', 'স্কুল অ্যান্ড কলেজ', 'সরকারি'].map(t => `
        <button onclick="setEduTypeFilter('${t}')" 
          class="px-3 py-1.5 rounded-lg whitespace-nowrap transition font-medium ${STATE.educationFilter.type === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}">
          ${t === 'all' ? 'সকল প্রতিষ্ঠান' : t}
        </button>
      `).join('')}
    </div>

    <!-- উপজেলা ফিল্টার ড্রপডাউন -->
    <div class="flex items-center justify-between mb-3 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
      <span class="text-slate-500 font-medium"><i class="fa-solid fa-location-dot text-blue-600 mr-1.5"></i>এলাকা / উপজেলা:</span>
      <select onchange="setEduUpazilaFilter(this.value)" class="bg-transparent font-bold text-slate-800 focus:outline-none">
        <option value="all">সমগ্র নারায়ণগঞ্জ</option>
        <option value="নারায়ণগঞ্জ সদর" ${STATE.educationFilter.upazila === 'নারায়ণগঞ্জ সদর' ? 'selected' : ''}>নারায়ণগঞ্জ সদর</option>
        <option value="রূপগঞ্জ" ${STATE.educationFilter.upazila === 'রূপগঞ্জ' ? 'selected' : ''}>রূপগঞ্জ</option>
        <option value="সোনারগাঁও" ${STATE.educationFilter.upazila === 'সোনারগাঁও' ? 'selected' : ''}>সোনারগাঁও</option>
        <option value="আড়াইহাজার" ${STATE.educationFilter.upazila === 'আড়াইহাজার' ? 'selected' : ''}>আড়াইহাজার</option>
        <option value="বন্দর" ${STATE.educationFilter.upazila === 'বন্দর' ? 'selected' : ''}>বন্দর</option>
        <option value="ফতুল্লা" ${STATE.educationFilter.upazila === 'ফতুল্লা' ? 'selected' : ''}>ফতুল্লা</option>
        <option value="সিদ্ধিরগঞ্জ" ${STATE.educationFilter.upazila === 'সিদ্ধিরগঞ্জ' ? 'selected' : ''}>সিদ্ধিরগঞ্জ</option>
      </select>
    </div>

    <!-- ফলাফল কাউন্টার -->
    <div id="edu-cards-container" class="space-y-2.5"></div>
  `;

  container.innerHTML = html;
  renderFilteredEducationCards();
}

function handleEduSearch(val) {
  STATE.educationFilter.search = val.toLowerCase().trim();
  renderFilteredEducationCards();
}

function setEduTypeFilter(type) {
  STATE.educationFilter.type = type;
  renderEducationScreen();
}

function setEduUpazilaFilter(upazila) {
  STATE.educationFilter.upazila = upazila;
  renderFilteredEducationCards();
}

function renderFilteredEducationCards() {
  const container = document.getElementById('edu-cards-container');
  if (!container) return;

  const { type, upazila, search } = STATE.educationFilter;

  const filtered = STATE.education.filter(inst => {
    // ১. টাইপ ফিল্টার
    if (type === 'সরকারি' && inst.management !== 'সরকারি') return false;
    if (type !== 'all' && type !== 'সরকারি' && inst.type_file !== type) return false;

    // ২. উপজেলা ফিল্টার
    if (upazila !== 'all' && (inst.upazila || '') !== upazila) return false;

    // ৩. ব্যাকগ্রাউন্ড ট্রান্সলেশন সার্চ লজিক: বাংলা নাম, ইংরেজি নাম অথবা EIIN
    if (search) {
      const matchBn = (inst.name_bn || '').toLowerCase().includes(search);
      const matchEn = (inst.name_en || '').toLowerCase().includes(search);
      const matchEiin = (inst.eiin || '').toString().includes(search);
      if (!matchBn && !matchEn && !matchEiin) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-2xl text-center border border-slate-100 text-slate-400">
        <i class="fa-solid fa-school-circle-xmark text-3xl mb-2 text-slate-300"></i>
        <p class="text-xs">কোনো শিক্ষা প্রতিষ্ঠান পাওয়া যায়নি!</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="text-[11px] text-slate-500 font-medium px-1 mb-1">মোট ${filtered.length} টি প্রতিষ্ঠান পাওয়া গেছে</div>
    ${filtered.map(inst => `
      <div onclick="navigateTo('education-details', 'The Narayanganj', { eiin: '${inst.eiin}' })" 
        class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-300 transition cursor-pointer">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <!-- শুধুমাত্র বাংলা নাম প্রদর্শিত হবে -->
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">${inst.name_bn}</h4>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md">EIIN: ${inst.eiin}</span>
              <span class="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md">${inst.management || 'সাধারণ'}</span>
              <span class="bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0.5 rounded-md">${inst.type_file || 'প্রতিষ্ঠান'}</span>
            </div>
          </div>
          <button onclick="event.stopPropagation(); toggleBookmark('${inst.eiin}', 'education', '${inst.name_bn}')" 
            data-bookmark-id="${inst.eiin}" data-bookmark-type="education" class="text-slate-300 hover:text-amber-500 p-1">
            <i class="${isBookmarked(inst.eiin, 'education') ? 'fa-solid fa-bookmark text-amber-500' : 'fa-regular fa-bookmark'}"></i>
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-50">
          <span><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${inst.upazila || 'নারায়ণগঞ্জ'}</span>
          ${inst.mobile ? `
            <a href="tel:${cleanPhoneNumber(inst.mobile)}" onclick="event.stopPropagation()" 
              class="text-blue-600 font-semibold flex items-center gap-1 hover:underline">
              <i class="fa-solid fa-phone"></i> ${cleanPhoneNumber(inst.mobile)}
            </a>` : '<span class="text-slate-300">নম্বর নেই</span>'}
        </div>
      </div>
    `).join('')}
  `;
}

// ৮. শিক্ষা প্রতিষ্ঠানের পূর্ণাঙ্গ ৫-সেকশন ডিটেইলস ভিউ (Rich UI)

async function renderEducationDetails(eiin) {
  const container = document.getElementById('education-details-content');
  if (!container) return;

  await ensureEducationDataLoaded();
  const inst = STATE.education.find(e => e.eiin.toString() === eiin.toString());

  if (!inst) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">প্রতিষ্ঠানের বিবরণ খুঁজে পাওয়া যায়নি!</div>`;
    return;
  }

  // রেজাল্ট ট্যাবের তথ্য ফিল্টার (EIIN অথবা প্রতিষ্ঠানের নাম দিয়ে ম্যাচিং)
  const results = STATE.results.filter(r => 
    (r.eiin && r.eiin.toString() === inst.eiin.toString()) || 
    (r.institution && r.institution.trim() === inst.name_bn.trim())
  );

  const phone = cleanPhoneNumber(inst.mobile);
  const altPhone = cleanPhoneNumber(inst.mobile_alt);

  let html = `
    <!-- ব্যাক বাটন -->
    <div class="flex items-center justify-between mb-3">
      <button onclick="history.back()" class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
        <i class="fa-solid fa-arrow-left"></i> ফিরে যান
      </button>
      <button onclick="toggleBookmark('${inst.eiin}', 'education', '${inst.name_bn}')" 
        data-bookmark-id="${inst.eiin}" data-bookmark-type="education" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
        <i class="${isBookmarked(inst.eiin, 'education') ? 'fa-solid fa-bookmark text-amber-500' : 'fa-regular fa-bookmark'}"></i>
      </button>
    </div>

    <!-- সেকশন ১: আইডেন্টিটি কার্ড -->
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
      <h2 class="text-base sm:text-lg font-black text-slate-900 leading-snug mb-1.5">${inst.name_bn}</h2>
      <div class="flex flex-wrap gap-1.5">
        <span class="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg">EIIN: ${inst.eiin}</span>
        <span class="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-lg">${inst.management || 'বেসরকারি'}</span>
        <span class="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded-lg">${inst.type_file || 'স্কুল'}</span>
        <span class="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-lg">${inst.for_whom || 'সহশিক্ষা'}</span>
        ${inst.english_version === 'হ্যাঁ' ? '<span class="bg-purple-50 text-purple-700 text-[11px] font-medium px-2 py-0.5 rounded-lg">ইংরেজি ভার্সন</span>' : ''}
      </div>
    </div>

    <!-- সেকশন ২: কুইক অ্যাকশন বাটনসমূহ -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      ${phone ? `
        <a href="tel:${phone}" class="bg-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm hover:bg-emerald-700">
          <i class="fa-solid fa-phone"></i> কল করুন
        </a>` : '<div class="bg-slate-100 text-slate-400 p-2.5 rounded-xl text-center text-xs font-semibold">ফোন নেই</div>'}

      ${altPhone ? `
        <a href="tel:${altPhone}" class="bg-white border border-slate-200 text-slate-800 p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm">
          <i class="fa-solid fa-phone-volume text-blue-600"></i> বিকল্প নম্বর
        </a>` : ''}

      ${inst.email ? `
        <a href="mailto:${inst.email}" class="bg-white border border-slate-200 text-slate-800 p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm">
          <i class="fa-solid fa-envelope text-rose-500"></i> ইমেইল
        </a>` : ''}

      ${inst.website ? `
        <a href="${inst.website.startsWith('http') ? inst.website : 'http://' + inst.website}" target="_blank" class="bg-white border border-slate-200 text-slate-800 p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm">
          <i class="fa-solid fa-globe text-indigo-500"></i> ওয়েবসাইট
        </a>` : ''}
    </div>

    <!-- সেকশন ৩: প্রাতিষ্ঠানিক তথ্য গ্রিড -->
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
      <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 text-slate-400 flex items-center gap-1.5">
        <i class="fa-solid fa-circle-info text-blue-600"></i> প্রাতিষ্ঠানিক তথ্য
      </h3>
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span class="text-slate-400 block text-[10px]">শিক্ষা স্তর</span>
          <span class="font-semibold text-slate-800">${inst.education_level || 'মাধ্যমিক'}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">প্রতিষ্ঠার তারিখ</span>
          <span class="font-semibold text-slate-800">${inst.establishment_date || 'তথ্য নেই'}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">সংসদীয় আসন</span>
          <span class="font-semibold text-slate-800">${inst.constituency || 'তথ্য নেই'}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">এলাকার ধরন</span>
          <span class="font-semibold text-slate-800">${inst.area_status || 'তথ্য নেই'}</span>
        </div>
        ${inst.ssc_code ? `
        <div>
          <span class="text-slate-400 block text-[10px]">এসএসসি বোর্ড কোড</span>
          <span class="font-semibold text-slate-800">${inst.ssc_code}</span>
        </div>` : ''}
        ${inst.hsc_code ? `
        <div>
          <span class="text-slate-400 block text-[10px]">এইচএসসি বোর্ড কোড</span>
          <span class="font-semibold text-slate-800">${inst.hsc_code}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- সেকশন ৪: অবস্থান ও পূর্ণাঙ্গ ঠিকানা -->
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
      <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5 text-slate-400 flex items-center gap-1.5">
        <i class="fa-solid fa-map-location-dot text-emerald-600"></i> অবস্থান ও ঠিকানা
      </h3>
      <p class="text-xs text-slate-700 leading-relaxed">
        <strong>ঠিকানা:</strong> ${inst.address || inst.mouza || ''}<br>
        <strong>উপজেলা/থানা:</strong> ${inst.upazila || inst.thana_banbeis || 'নারায়ণগঞ্জ'}<br>
        <strong>ইউনিয়ন / ওয়ার্ড:</strong> ${inst.union_ward || 'তথ্য নেই'}<br>
        <strong>ডাকঘর:</strong> ${inst.post_office ? `${inst.post_office} (${inst.post_code || ''})` : 'তথ্য নেই'}
      </p>
    </div>

    <!-- সেকশন ৫: বোর্ড পরীক্ষার ফলাফল আর্কাইভ (Results Tab) -->
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
      <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 text-slate-400 flex items-center gap-1.5">
        <i class="fa-solid fa-trophy text-amber-500"></i> পাবলিক পরীক্ষার ফলাফল আর্কাইভ
      </h3>

      ${results.length > 0 ? `
        <div class="space-y-2">
          ${results.map(res => `
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span class="font-bold text-slate-900">${res.exam || 'SSC'} (${res.year || ''})</span>
                <div class="text-[10px] text-slate-500 mt-0.5">পরীক্ষার্থী: ${res.appeared || 0} জন • উত্তীর্ণ: ${res.passed || 0} জন</div>
              </div>
              <div class="text-right">
                <span class="inline-block bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[11px] mb-0.5">
                  ${res.pass_rate || '০%'}
                </span>
                <div class="text-[10px] font-bold text-amber-600">GPA-5: ${res.gpa5 || 0} জন</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="bg-slate-50 p-3.5 rounded-xl text-center text-slate-400 text-xs">
          বিগত বছরের বোর্ড পরীক্ষার ফলাফল এখনো আপডেট করা হয়নি।
        </div>
      `}
    </div>

    <!-- সেকশন ৬: ব্যানবেইস ভেরিফায়েড সোর্স ফুটার -->
    <div class="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center text-xs text-blue-800 mb-6">
      <p class="font-semibold flex items-center justify-center gap-1">
        <i class="fa-solid fa-circle-check text-blue-600"></i> ব্যানবেইস (BANBEIS) কর্তৃক ভেরিফায়েড তথ্য
      </p>
      ${inst.source_url ? `
        <a href="${inst.source_url}" target="_blank" class="text-[11px] text-blue-600 underline mt-1 inline-block">
          ব্যানবেইস অফিশিয়াল পেজ দেখুন
        </a>` : ''}
    </div>
  `;

  container.innerHTML = html;
}

// ৯. ডাক্তার স্ক্রিন ও চেম্বার সেমিকোলন পার্সিং (Doctors Module)

function renderDoctorsScreen() {
  const container = document.getElementById('doctors-content');
  if (!container) return;

  const docs = shuffleWithFeatured(STATE.doctors);

  let html = `
    <div class="space-y-2.5">
      ${docs.map(doc => {
        // পদবি ও প্রতিষ্ঠান কমা দিয়ে আলাদা
        const desigParts = (doc.designation || '').split(',');
        const titlePart = desigParts[0] || '';
        const placePart = desigParts.slice(1).join(',') || '';

        // প্রথম চেম্বার ও ফোন নম্বর সেমিকোলন দিয়ে আলাদা
        const firstChamber = (doc.chamber || '').split(';')[0] || '';
        const firstPhone = cleanPhoneNumber((doc.serial_phone || '').split(';')[0]);

        return `
          <div onclick="navigateTo('doctor-details', 'The Narayanganj', { name: '${doc.name}' })" 
            class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-300 transition cursor-pointer">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-bold text-slate-900 text-xs sm:text-sm">${doc.name}</h4>
                <p class="text-xs text-emerald-700 font-semibold mt-0.5">${doc.specialty || ''}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">${doc.degrees \vert{}\vert{} ''}</p>${titlePart ? `
                  <div class="inline-block bg-slate-50 border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded mt-1.5 font-medium">
                    ${titlePart} ${placePart ? `• ${placePart.trim()}` : ''}
                  </div>` : ''}
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-50">
              <span class="line-clamp-1"><i class="fa-solid fa-hospital text-slate-400 mr-1"></i>${firstChamber}</span>${firstPhone ? `
                <a href="tel:${firstPhone}" onclick="event.stopPropagation()" 
                  class="text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                  <i class="fa-solid fa-phone"></i> সিরিয়াল
                </a>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  container.innerHTML = html;
}

// ১০. ইনিশিয়ালাইজেশন
document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();
  initAppData();

  // ইউআরএল হ্যাশ চেক করে সঠিক পেজে যাওয়া
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    navigateTo(hash);
  }
});