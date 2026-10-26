/* ==========================================================================
   THE NARAYANGANJ - CORE SCRIPT (PART 1)
   --------------------------------------------------------------------------
   ১. কনফিগারেশন ও স্টেট ভ্যারিয়েবল
   ২. ডেটা নরমালাইজেশন ও ফেচিং হেল্পার
   ৩. ক্যাটাগরি পেজ ও সুবিন্যস্ত ফিল্টারিং ইঞ্জিন (হোম স্ক্রিন সিকোয়েন্স)
   ========================================================================== */

// --- ১. কনফিগারেশন ও স্টেট ভ্যারিয়েবল ---
const SHEET_ID = "1ctXswktft11lTCw_TiTbwoF2jgmLsHaf4Zno23QImjQ";
const API_PLACES = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;
const API_DOCTORS = `https://opensheet.elk.sh/${SHEET_ID}/Doctors`;
const API_RESULTS = `https://opensheet.elk.sh/${SHEET_ID}/Results`;
const API_EDUCATION = `https://opensheet.elk.sh/${SHEET_ID}/Education`;
const API_RESTAURANTS = `https://opensheet.elk.sh/${SHEET_ID}/Restaurants`;
const API_ADMIN = `https://opensheet.elk.sh/${SHEET_ID}/Administration`;
const API_PACKAGES = `https://opensheet.elk.sh/${SHEET_ID}/Packages`;
const API_TRANSPORT = `https://opensheet.elk.sh/${SHEET_ID}/Transport`;
const API_HEALTH = `https://opensheet.elk.sh/${SHEET_ID}/Health`;
const API_TELECOM = `https://opensheet.elk.sh/${SHEET_ID}/Telecom`;
const API_OFFERS = `https://opensheet.elk.sh/${SHEET_ID}/RechargeOffers`;
const API_SERVICE_CENTERS = `https://opensheet.elk.sh/${SHEET_ID}/ServiceCenters`


let placesData = [];
let healthData = [];
let doctorsData = [];
let resultsData = [];
let educationData = [];
let restaurantsData = [];
let adminData = [];
let packagesData = [];
let transportData = [];
let telecomData = [];
let rechargeOffersData = [];
let serviceCentersData = [];

let currentCategory = 'সব';
let currentChamberFilter = null;
let selectedCatArea = 'সব এলাকা';
let selectedDocArea = 'সব এলাকা';
let selectedDocDept = 'সব বিভাগ';
let activeItem = null;
let activeDoctor = null;

let currentTriviaIndex = 0;
let totalTriviaSlides = 0;

let bookmarks = { places: [], doctors: [] };
try {
  const saved = localStorage.getItem('narayanganj_bookmarks');
  if (saved) bookmarks = JSON.parse(saved);
} catch (e) {
  bookmarks = { places: [], doctors: [] };
}

// ১. সার্বজনীন বাংলা থেকে ইংরেজি ডিজিট কনভার্টার (EIIN, সাল, ফোন, আইডি সবকিছুর জন্য)
function toEnDigits(val) {
  if (val === null || val === undefined) return '';
  const bnToEn = {'০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9'};
  return val.toString().trim().replace(/[০-৯]/g, d => bnToEn[d]);
}

// ২. সার্বজনীন ফোন নম্বর ক্লিনার (উপরে তৈরি toEnDigits ব্যবহার করে)
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let str = toEnDigits(phone).replace(/[^\d+]/g, '');
  if (str.length === 10 && str.startsWith('1')) {
    str = '0' + str;
  }
  return str;
}

function isOfferExpired(dateStr) {
  if (!dateStr) return false;
  const bnToEn = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
  const cleanStr = dateStr.toString().replace(/[০-৯]/g, d => bnToEn[d]).trim();
  const match = cleanStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return false;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  
  return new Date() > new Date(year, month, day, 23, 59, 59, 999);
}

function parseOffers(rawOffer) {
  if (!rawOffer || !rawOffer.trim()) return [];
  const lines = rawOffer.trim().split(/[|\n]/).map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let currentBlock = null;

  lines.forEach(line => {
    const isHeader = line.startsWith('##');
    const dateMatch = line.match(/\[(.*?)\]/);
    let cleanLine = line;
    let lineDate = null;

    if (dateMatch) {
      lineDate = dateMatch[1].trim();
      cleanLine = line.replace(/\[.*?\]/, '').trim();
    }

    if (isHeader) {
      currentBlock = { title: cleanLine.replace(/^##\s*/, '').trim(), expDate: lineDate, points: [] };
      blocks.push(currentBlock);
    } else {
      if (!currentBlock) {
        currentBlock = { title: '', expDate: lineDate, points: [] };
        blocks.push(currentBlock);
      } else if (lineDate && !currentBlock.expDate) {
        currentBlock.expDate = lineDate;
      }
      if (cleanLine) currentBlock.points.push(cleanLine);
    }
  });

  return blocks.filter(b => !isOfferExpired(b.expDate) && (b.title || b.points.length > 0));
}

function normalizeEducationItem(item) {
  const cleanPhone = cleanPhoneNumber(item.mobile || item.phone || item.telephone || '');
  const addr = [item.address, item.mouza, item.post_office ? `${item.post_office} (${item.post_code || ''})` : ''].filter(Boolean).join(', ');

  return {
    ...item,
    name: item.name_bn || item.name || 'শিক্ষা প্রতিষ্ঠান',
    name_bn: item.name_bn || item.name || '',
    name_en: item.name_en || '',
    category: 'শিক্ষা প্রতিষ্ঠান',
    area: item.upazila || item.area || 'নারায়ণগঞ্জ',
    address: addr || item.address || item.area || 'নারায়ণগঞ্জ',
    phone: cleanPhone,
    eiin: item.eiin || '',
    principal: item.principal || '',
    rating: item.rating || '৪.৫',
    departments: item.departments || '',
    trivia: item.trivia || '',
    facilities: [
      item.for_whom,
      item.management ? `${item.management} ব্যবস্থাপনা` : '',
      item.english_version === 'হ্যাঁ' ? 'ইংরেজি ভার্সন' : ''
    ].filter(Boolean).join(', '),
    website: item.website || item.source_url || '',
    timing: item.timing || '',
    featured: item.featured || ''
  };
}

function normalizeRestaurantItem(item) {
  const cleanPhone = cleanPhoneNumber(item.phone || item.mobile || item.hotline || '');
  return {
    ...item,
    name: item.name_bn || item.name || 'রেস্টুরেন্ট',
    name_bn: item.name_bn || item.name || '',
    name_en: item.name_en || '',
    category: 'রেস্টুরেন্ট',
    area: item.area || item.upazila || 'নারায়ণগঞ্জ',
    address: item.address || item.area || 'নারায়ণগঞ্জ',
    phone: cleanPhone,
    timing: item.timing || 'সকাল ১০টা - রাত ১১টা',
    rating: item.rating || '৪.২',
    cuisine: item.cuisine || item.type || 'রেস্তোরাঁ ও ক্যাফে',
    menu: item.menu || '',
    offer: item.offer || item.campaign || '',
    landmark: item.landmark || '',
    image_url: item.image_url || '',
    map_url: item.map_url || '',
    facebook: item.facebook || '',
    featured: item.featured || ''
  };
}

function normalizeAdminItem(item) {
  const cleanPhone = cleanPhoneNumber(item.leader_phone || item.phone || item.mobile || '');
  return {
    ...item,
    name: item.title || item.name || 'প্রশাসনিক দপ্তর',
    category: item.type || item.category || 'প্রশাসন',
    code: item.code || '',
    territory: item.territory || item.area || '',
    voters: item.voters || '',
    established: item.established || '',
    history: item.history || '',
    area: item.upazila || item.area || 'নারায়ণগঞ্জ',
    address: item.office_address || item.address || item.area || 'নারায়ণগঞ্জ',
    phone: cleanPhone,
    timing: item.timing || 'রবি-বৃহঃ সকাল ৯টা - বিকাল ৪টা',
    rating: 'সরকারি',
    leader_name: item.leader_name || '',
    leader_title: item.leader_title || 'দায়িত্বপ্রাপ্ত কর্মকর্তা / প্রতিনিধি',
    leader_phone: cleanPhone,
    sub_leader: item.sub_leader || '',
    landmark: item.territory ? `অন্তর্ভুক্ত এলাকা: ${item.territory}` : '',
    email: item.email || '',
    website: item.website || '',
    image_url: item.image_url || 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80',
    featured: item.featured || '',
    admin_units: item.admin_units || item.unions || '',
    attractions: item.attractions || item.spots || '',
    admin_stats: item.admin_stats || item.stats || '',
  };
}

function normalizeTransportItem(item) {
  const cleanPhone = cleanPhoneNumber(item.counter_phone || item.phone || item.mobile || '');
  return {
    ...item,
    name: item.operator || item.name || 'পরিবহন সেবা',
    category: 'পরিবহন',
    destination: item.destination || '',
    route_via: item.route_via || '',
    boarding_point: item.boarding_point || 'নারায়ণগঞ্জ',
    area: item.boarding_point || 'নারায়ণগঞ্জ',
    address: `${item.boarding_point || 'নারায়ণগঞ্জ'} (গন্তব্য: ${item.destination || ''})`,
    phone: cleanPhone,
    timing: item.timing || 'সারাদিন',
    ticket_fare: item.ticket_fare || '',
    service_type: item.type || 'বাস সার্ভিস',
    notes: item.notes || '',
    rating: '৪.২'
  };
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function organizeListings(dataList) {
  const featured = dataList.filter(item => (item.featured || '').toString().toLowerCase().trim() === 'yes');
  const normal = dataList.filter(item => (item.featured || '').toString().toLowerCase().trim() !== 'yes');
  return [...featured, ...shuffleArray(normal)];
}

// --- ৩. ক্যাটাগরি পেজ ও ফিল্টারিং ইঞ্জিন ---

function openCategoryPage(category, subtitle = '') {
  currentCategory = category;
  const tEl = document.getElementById('catPageTitle');
  const sEl = document.getElementById('catPageSub');
  const iEl = document.getElementById('catSearchInput');
  if (tEl) tEl.innerText = category === 'সব' ? 'সকল সেবা ও তথ্য' : category;
  if (sEl) sEl.innerText = subtitle || 'তালিকা থেকে প্রতিষ্ঠান বেছে নিন';
  if (iEl) iEl.value = '';

  selectedCatArea = 'সব এলাকা';
  const catBar = document.getElementById('catAreaFilterBar');
  if (catBar) {
    catBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    const first = catBar.querySelector('.area-chip');
    if (first) first.classList.add('active');
  }

  renderCategoryItems();
  const el = document.getElementById('categoryPage');
  if (el) {
    el.classList.add('open');
    window.history.pushState({ page: 'category' }, '');
  }
}

function closeCategoryPage() {
  const el = document.getElementById('categoryPage');
  if (el) el.classList.remove('open');
}

function setCategoryAreaFilter(areaName, chipElement) {
  selectedCatArea = areaName;
  const bar = document.getElementById('catAreaFilterBar');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    if (chipElement) chipElement.classList.add('active');
  }
  renderCategoryItems();
}

function renderStandardPlaceCard(item, container) {
  const name = item.name || 'তথ্য নেই';
  const area = item.area || 'নারায়ণগঞ্জ';
  const rating = item.rating || '৪.০';
  const phone = item.phone || '';
  const isFeatured = (item.featured || '').toString().toLowerCase().trim() === 'yes';
  const mapUrl = item.map_url || `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + area)}`;

  const validOffers = parseOffers(item.offer || item.campaign || '');
  const hasLiveOffer = validOffers.length > 0;

  const card = document.createElement('div');
  card.className = 'place-card';
  card.onclick = () => openDetails(item);

  if (isFeatured) {
    card.style.borderColor = '#F59E0B';
    card.style.background = '#FFFDF5';
  }

  let subInfoLine = '';
  if (item.leader_name) {
    subInfoLine = `<div style="font-size: 11.5px; color: #0284C7; margin-top: 3px; font-weight: 500;"><i class="fa-solid fa-user-tie"></i> ${item.leader_title ? item.leader_title + ': ' : ''}${item.leader_name}</div>`;
  } else if (item.territory) {
    subInfoLine = `<div style="font-size: 11.5px; color: #475569; margin-top: 3px;"><i class="fa-solid fa-map-pin"></i> ${item.territory}</div>`;
  }

  card.innerHTML = `
    <div class="place-header">
      <div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div class="place-title">${name}</div>
          ${item.code ? `<span style="background: #E0E7FF; color: #3730A3; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">${item.code}</span>` : ''}
          ${hasLiveOffer ? '<span style="background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;"><i class="fa-solid fa-tag"></i> অফার</span>' : ''}
          ${item.leader_title && !item.code ? `<span style="background: #E0E7FF; color: #4338CA; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;">${item.leader_title}</span>` : ''}
          ${item.eiin ? `<span class="eiin-badge" style="font-size: 10px; padding: 1px 6px; border-radius: 4px;">EIIN: ${item.eiin}</span>` : ''}
          ${item.cuisine ? `<span style="background: #F1F5F9; color: #475569; font-size: 10px; padding: 1px 6px; border-radius: 4px;">${item.cuisine}</span>` : ''}
          ${isFeatured ? '<span style="background: #FEF3C7; color: #B45309; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #FDE68A;"><i class="fa-solid fa-bolt"></i> স্পন্সরড</span>' : ''}
        </div>
        ${subInfoLine}
        <div class="place-area"><i class="fa-solid fa-location-dot"></i> ${area}</div>
      </div>
      <div class="rating-badge"><i class="fa-solid fa-star"></i> ${rating}</div>
    </div>
    <div class="action-buttons">
      <a href="${phone ? 'tel:' + phone : '#'}" class="btn-action btn-call" onclick="event.stopPropagation()">
        <i class="fa-solid fa-phone"></i> কল করুন
      </a>
      <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-map" onclick="event.stopPropagation()">
        <i class="fa-solid fa-diamond-turn-right"></i> ম্যাপ
      </a>
    </div>
  `;
  container.appendChild(card);
}

function renderCategoryItems() {
  const container = document.getElementById('categoryListings');
  if (!container) return;
  container.innerHTML = '';

  const input = document.getElementById('catSearchInput');
  const query = input ? input.value.toLowerCase().trim() : '';

  let sourceList = placesData;
  const isAdminCategory = ['জেলা প্রশাসন', 'সংসদীয় আসন', 'সিটি কর্পোরেশন', 'উপজেলা প্রশাসন', 'ইউনিয়ন পরিষদ', 'পৌরসভা'].includes(currentCategory);
  const isHealthCategory = ['সরকারি হাসপাতাল', 'বেসরকারি হাসপাতাল', 'ডায়াগনস্টিক', 'ডায়াগনস্টিক সেন্টার', 'ডেন্টাল', 'ডেন্টাল ক্লিনিক', 'ব্লাড ব্যাংক', 'ব্লাড ব্যাংক ও রক্তদান', 'রক্তদান', '২৪ ঘণ্টা ফার্মেসী', 'ফার্মেসী', 'চক্ষু হাসপাতাল', 'চক্ষু সেবা'].includes(currentCategory);
  const isTelecomCategory = ['টেলিকম', 'মোবাইল ব্যাংকিং', 'মোবাইল সার্ভিসিং'].includes(currentCategory);

  if (isHealthCategory) {
    sourceList = healthData.length > 0 ? healthData : placesData;
  } else if (isTelecomCategory) {
    sourceList = telecomData.length > 0 ? telecomData : placesData;
  } else if (currentCategory === 'শিক্ষা প্রতিষ্ঠান') {
    sourceList = educationData.length > 0 ? educationData : placesData;
  } else if (currentCategory === 'রেস্টুরেন্ট' || currentCategory === 'রেস্টুরেন্ট ও ক্যাফে' || currentCategory === 'মিষ্টি ও খাবার' || currentCategory === 'খাবার') {
    sourceList = restaurantsData.length > 0 ? restaurantsData : placesData;
  } else if (isAdminCategory) {
    sourceList = adminData.length > 0 ? adminData : placesData;
  } else if (currentCategory === 'পরিবহন') {
    sourceList = transportData.length > 0 ? transportData : placesData;
  } else if (currentCategory === 'সব') {
    sourceList = [...placesData, ...healthData, ...educationData, ...restaurantsData, ...adminData, ...transportData];
  }

  const filtered = (sourceList || []).filter(item => {
    if (!item) return false;
    const itemCat = (item.category || '').trim();
    const itemArea = (item.area || '').toLowerCase();
    const itemAddress = (item.address || '').toLowerCase();
    
    let matchCat = false;

    // --- ১. স্বাস্থ্য সেবা ---
    if (currentCategory === 'সব') {
      matchCat = true;
    } else if (currentCategory === 'সরকারি হাসপাতাল') {
      matchCat = (itemCat === 'সরকারি হাসপাতাল');
    } else if (currentCategory === 'বেসরকারি হাসপাতাল') {
      matchCat = (itemCat === 'বেসরকারি হাসপাতাল' || itemCat === 'হাসপাতাল');
    } else if (currentCategory === 'ডায়াগনস্টিক' || currentCategory === 'ডায়াগনস্টিক সেন্টার') {
      matchCat = (itemCat.includes('ডায়াগনস্টিক') || itemCat.includes('ল্যাব') || itemCat.includes('প্যাথলজি'));
    } else if (currentCategory === 'ডেন্টাল' || currentCategory === 'ডেন্টাল ক্লিনিক') {
      matchCat = (itemCat.includes('ডেন্টাল') || itemCat.includes('দাঁত'));
    } else if (currentCategory === 'ব্লাড ব্যাংক' || currentCategory === 'ব্লাড ব্যাংক ও রক্তদান' || currentCategory === 'রক্তদান') {
      matchCat = (itemCat.includes('ব্লাড') || itemCat.includes('রক্ত'));
    } else if (currentCategory === '২৪ ঘণ্টা ফার্মেসী' || currentCategory === 'ফার্মেসী') {
      matchCat = (itemCat.includes('ফার্মেসী') || itemCat.includes('ফার্মেসি') || itemCat.includes('ওষুধ') || itemCat.includes('ঔষধ'));
    } else if (currentCategory === 'চক্ষু হাসপাতাল' || currentCategory === 'চক্ষু সেবা') {
      matchCat = (itemCat.includes('চক্ষু') || itemCat.includes('চোখ') || itemCat.includes('আই'));
    }

    // --- ২. শিক্ষা ও সংবাদ ---
    else if (currentCategory === 'শিক্ষা প্রতিষ্ঠান') {
      matchCat = (itemCat === 'শিক্ষা প্রতিষ্ঠান' || itemCat === 'স্কুল' || itemCat === 'কলেজ' || itemCat === 'মাদরাসা');
    } else if (currentCategory === 'সংবাদপত্র') {
      matchCat = (itemCat.includes('সংবাদ') || itemCat.includes('পত্রিকা') || itemCat.includes('নিউজ'));
    }

    // --- ৩. বিনোদন ও অনুষ্ঠান ---
    else if (currentCategory === 'সিনেমা হল') {
      matchCat = (itemCat.includes('সিনেমা') || itemCat.includes('সিনেপ্লেক্স') || itemCat.includes('থিয়েটার'));
    } else if (currentCategory === 'পর্যটন ও বিনোদন' || currentCategory === 'দর্শনীয় স্থান' || currentCategory === 'বিনোদন') {
      matchCat = (itemCat.includes('দর্শনীয়') || itemCat.includes('পর্যটন') || itemCat.includes('বিনোদন') || itemCat.includes('পার্ক') || itemCat.includes('ঐতিহাসিক'));
    } else if (currentCategory === 'কমিউনিটি সেন্টার') {
      matchCat = (itemCat.includes('কমিউনিটি') || itemCat.includes('কনভেনশন') || itemCat.includes('পার্টি সেন্টার'));
    }
	
	// --- ডিজিটাল ও প্রযুক্তি সেবা ---
	else if (currentCategory === 'টেলিকম') {
    matchCat = (itemCat === 'টেলিকম' || itemCat.includes('টেলিকম') || itemCat.includes('অপারেটর') || itemCat.includes('সিম'));
  } else if (currentCategory === 'মোবাইল ব্যাংকিং') {
    matchCat = (itemCat === 'মোবাইল ব্যাংকিং' || itemCat.includes('ব্যাংকিং') || itemCat.includes('mfs') || itemCat.includes('এমএফএস'));
  } else if (currentCategory === 'মোবাইল সার্ভিসিং') {
    matchCat = (itemCat.includes('সার্ভিসিং') || itemCat.includes('কেয়ার') || itemCat.includes('মেরামত'));
  }

    // --- ৪. প্রশাসন ও জনপ্রতিনিধি ---
    else if (currentCategory === 'জেলা প্রশাসন' || currentCategory === 'জেলা প্রশাসন ও পুলিশ') {
      matchCat = (itemCat === 'জেলা প্রশাসন' || (!itemCat.includes('উপজেলা') && !itemCat.includes('থানা') && (itemCat.includes('জেলা') || itemCat.includes('পুলিশ') || itemCat.includes('ডিসি') || itemCat.includes('এসপি') || itemCat.includes('প্রশাসন'))));
    } else if (currentCategory === 'সংসদীয় আসন') {
      matchCat = (itemCat.includes('সংসদ') || itemCat.includes('আসন') || itemCat.includes('এমপি'));
    } else if (currentCategory === 'সিটি কর্পোরেশন') {
      matchCat = (itemCat.includes('সিটি কর্পোরেশন') || itemCat.includes('নাসিক') || itemCat.includes('কাউন্সিলর') || itemCat.includes('ওয়ার্ড'));
    } else if (currentCategory === 'উপজেলা প্রশাসন') {
      matchCat = (itemCat === 'উপজেলা প্রশাসন' || (itemCat.includes('উপজেলা') && !itemCat.includes('পৌরসভা')));
    } else if (currentCategory === 'পৌরসভা') {
      matchCat = (itemCat === 'পৌরসভা' || itemCat.includes('পৌরসভা'));
    } else if (currentCategory === 'ইউনিয়ন পরিষদ') {
      matchCat = (itemCat.includes('ইউনিয়ন') || itemCat.includes('ইউপি') || itemCat.includes('চেয়ারম্যান'));
    }

    // --- ৫. খাবার ও নাগরিক সেবা ---
    else if (currentCategory === 'রেস্টুরেন্ট' || currentCategory === 'রেস্টুরেন্ট ও ক্যাফে' || currentCategory === 'খাবার') {
      matchCat = (itemCat === 'রেস্টুরেন্ট' || itemCat.includes('রেস্টুরেন্ট') || itemCat.includes('রেস্তোরাঁ') || itemCat.includes('ক্যাফে') || itemCat.includes('খাবার') || itemCat.includes('মিষ্টি'));
    } else if (currentCategory === 'জরুরি সেবা') {
      matchCat = (itemCat.includes('জরুরি') || itemCat.includes('থানা') || itemCat.includes('পুলিশ ফাঁড়ি') || itemCat.includes('ফায়ার') || itemCat.includes('ফায়ার') || itemCat.includes('অ্যাম্বুলেন্স'));
    } else if (currentCategory === 'কুরিয়ার সার্ভিস' || currentCategory === 'কুরিয়ার ও পার্সেল') {
      matchCat = (itemCat.includes('কুরিয়ার') || itemCat.includes('পার্সেল'));
    } else if (currentCategory === 'ইউটিলিটি সেবা' || currentCategory === 'বিদ্যুৎ, গ্যাস ও পানি' || currentCategory === 'বিদ্যুৎ ও গ্যাস') {
      matchCat = (itemCat.includes('বিদ্যুৎ') || itemCat.includes('গ্যাস') || itemCat.includes('পানি') || itemCat.includes('ডিপিডিসি') || itemCat.includes('তিতাস') || itemCat.includes('ইউটিলিটি'));
    } else if (currentCategory === 'রেন্ট-এ-কার' || currentCategory === 'রেন্ট-এ-কার ও গাড়ি') {
      matchCat = (itemCat.includes('রেন্ট') || itemCat.includes('কার') || itemCat.includes('গাড়ি ভাড়া') || itemCat.includes('মাইক্রো'));
    } else if (currentCategory === 'ইন্টারনেট ও আইএসপি' || currentCategory === 'আইএসপি' || currentCategory === 'ব্রডব্যান্ড') {
      matchCat = (itemCat.includes('আইএসপি') || itemCat.includes('ইন্টারনেট') || itemCat.includes('ব্রডব্যান্ড') || itemCat.toLowerCase().includes('isp'));
    } else if (currentCategory === 'আইনজীবী ও আইনি সেবা') {
      matchCat = (itemCat.includes('আইনজীবী') || itemCat.includes('উকিল') || itemCat.includes('কোর্ট') || itemCat.includes('আইন'));
    } else if (currentCategory === 'পার্লার ও সেলুন') {
      matchCat = (itemCat.includes('পার্লার') || itemCat.includes('সেলুন') || itemCat.includes('বিউটি'));
    } else if (currentCategory === 'জেনারেল স্টোর') {
      matchCat = (itemCat.includes('জেনারেল স্টোর') || itemCat.includes('স্টোর') || itemCat.includes('মুদি'));
    } else if (currentCategory === 'পরিবহন') {
      matchCat = (itemCat.includes('পরিবহন') || itemCat.includes('বাস') || itemCat.includes('ট্রেন') || itemCat.includes('রেল') || itemCat.includes('লঞ্চ') || itemCat.includes('ঘাট'));
    } else if (currentCategory === 'শপিং ও ব্যবসা') {
      matchCat = (itemCat.includes('শপিং') || itemCat.includes('মার্কেট') || itemCat.includes('ব্যবসা') || itemCat.includes('আড়ত') || itemCat.includes('দোকান'));
    } else {
      matchCat = itemCat.toLowerCase().includes(currentCategory.toLowerCase());
    }
    
    let matchArea = (selectedCatArea === 'সব এলাকা');
    if (!matchArea) {
      const targetArea = selectedCatArea.toLowerCase();
      matchArea = itemArea.includes(targetArea) || itemAddress.includes(targetArea);
      if (targetArea === 'চাষাড়া' && (itemArea.includes('সদর') || itemAddress.includes('সদর'))) matchArea = true;
    }

    const matchSearch = 
      (item.name || '').toLowerCase().includes(query) ||
      (item.name_en || '').toLowerCase().includes(query) ||
      (item.code || '').toLowerCase().includes(query) ||
      (item.territory || '').toLowerCase().includes(query) ||
      (item.leader_name || '').toLowerCase().includes(query) ||
      (item.leader_title || '').toLowerCase().includes(query) ||
      (item.sub_leader || '').toLowerCase().includes(query) ||
      itemArea.includes(query) ||
      itemAddress.includes(query) ||
      (item.landmark || '').toLowerCase().includes(query);

    return matchCat && matchArea && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">কোনো তথ্য পাওয়া যায়নি।</div>`;
    return;
  }

  // সিটি কর্পোরেশনের মেয়র কার্ড আলাদাভাবে শীর্ষে রাখা
  if (currentCategory === 'সিটি কর্পোরেশন') {
    const mayorItem = filtered.find(it => (it.leader_title || '').includes('মেয়র') || (it.leader_title || '').includes('প্রশাসক') || (it.name || '').includes('মেয়র'));
    const counselors = filtered.filter(it => it !== mayorItem);

    if (mayorItem) {
      const mayorCard = document.createElement('div');
      mayorCard.innerHTML = `
        <div style="font-size: 13.5px; font-weight: 700; color: #0F5132; margin: 4px 0 6px; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-crown" style="color: #D97706;"></i> নগর প্রধান
        </div>
        <div class="place-card" style="border: 2px solid #16A34A; background: #F0FDF4; padding: 14px; border-radius: 12px; margin-bottom: 14px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0F5132;">${mayorItem.leader_name || mayorItem.name}</div>
              <div style="font-size: 12px; color: #166534; font-weight: 600; margin-top: 2px;">${mayorItem.name || 'নারায়ণগঞ্জ সিটি কর্পোরেশন'}</div>
            </div>
            <span style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
              ${mayorItem.leader_title || 'মেয়র / প্রশাসক'}
            </span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 8px;">
            <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${mayorItem.address || mayorItem.area || 'নগর ভবন, নারায়ণগঞ্জ'}
          </div>
          <div class="action-buttons" style="grid-template-columns: 1fr; margin-top: 10px;">
            <a href="${mayorItem.phone ? 'tel:' + mayorItem.phone : '#'}" class="btn-action btn-call" onclick="event.stopPropagation()">
              <i class="fa-solid fa-phone"></i> দপ্তরে যোগাযোগ করুন
            </a>
          </div>
        </div>
      `;
      mayorCard.querySelector('.place-card').onclick = () => openDetails(mayorItem);
      container.appendChild(mayorCard);
    }

    if (counselors.length > 0) {
      const cHeader = document.createElement('div');
      cHeader.style.cssText = "font-size: 13.5px; font-weight: 700; color: #1E293B; margin: 10px 0 8px; display: flex; align-items: center; gap: 6px;";
      cHeader.innerHTML = '<i class="fa-solid fa-users" style="color: #10664F;"></i> ওয়ার্ড কাউন্সিলর ও সংরক্ষিত সদস্যবৃন্দ';
      container.appendChild(cHeader);
    }

    counselors.forEach(item => {
      renderStandardPlaceCard(item, container);
    });
    return;
  }

  filtered.forEach(item => {
    // ১. পরিবহনের বাস/ট্রেন হলে বিশেষ বাস-কার্ড দেখাবে
    if (currentCategory === 'পরিবহন' && item.destination) {
      const card = document.createElement('div');
      card.className = 'place-card';
      card.onclick = () => openDetails(item);
      card.style.cssText = "border-left: 4px solid #0284C7; background: #FFFFFF;";

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #0F172A;">${item.name}</div>
            <div style="font-size: 12px; color: #0284C7; font-weight: 600; margin-top: 2px;">
              <i class="fa-solid fa-arrow-right-long"></i> গন্তব্য: ${item.destination}
            </div>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 3px 8px; border-radius: 6px;">
            ${item.ticket_fare ? '৳ ' + item.ticket_fare : (item.service_type || 'বাস')}
          </span>
        </div>

        <div style="font-size: 11.5px; color: #475569; margin-top: 6px; display: flex; flex-direction: column; gap: 3px;">
          <div><i class="fa-solid fa-location-dot" style="color: #64748B; width: 14px;"></i> কাউন্টার/বোর্ডিং: <strong>${item.boarding_point || item.area || 'নারায়ণগঞ্জ'}</strong></div>
          <div><i class="fa-regular fa-clock" style="color: #64748B; width: 14px;"></i> শিডিউল: <strong>${item.timing || 'সারাদিন'}</strong></div>
        </div>

        <div class="action-buttons" style="margin-top: 8px; grid-template-columns: 1fr;">
          <a href="${item.phone ? 'tel:' + item.phone : '#'}" class="btn-action btn-call" style="padding: 8px 0; font-size: 13px;" onclick="event.stopPropagation()">
            <i class="fa-solid fa-phone"></i> টিকিট কাউন্টারে কল (${item.phone || 'নম্বর নেই'})
          </a>
        </div>
      `;
      container.appendChild(card);
      return;
    }

    // ২. বাকি সকল সাধারণ ক্যাটাগরির জন্য আগের মতোই সাধারণ কার্ড দেখাবে
    renderStandardPlaceCard(item, container);
  });
}

/* ==========================================================================
   THE NARAYANGANJ - CORE SCRIPT (PART 2)
   --------------------------------------------------------------------------
   ৪. একক বিস্তারিত স্ক্রিন ইঞ্জিন (openDetails - প্রশাসন, হাসপাতাল, খাবার ইত্যাদি)
   ৫. বিশেষজ্ঞ ডাক্তার মডিউল
   ৬. বুকমার্ক, সাধারণ হেল্পার ও স্টার্টআপ
   ========================================================================== */

// --- ৪. একক বিস্তারিত স্ক্রিন ইঞ্জিন ---

function openDetails(item) {
  if (!item) return;
  activeItem = item;
  const cat = (item.category || '').trim();
  const isEdu = (cat === 'শিক্ষা প্রতিষ্ঠান' || cat === 'স্কুল' || cat === 'কলেজ' || cat === 'মাদরাসা');
  const isNews = (cat === 'সংবাদপত্র');
  const isCinema = (cat === 'সিনেমা হল' || cat.includes('সিনেমা') || cat.includes('সিনেপ্লেক্স'));
  const isTelecom = (cat === 'টেলিকম' || cat.includes('টেলিকম') || cat.includes('অপারেটর'));
  const telBox = document.getElementById('telecomSectionBox');
  
 const isMFS = (cat === 'এমএফএস' || cat === 'মোবাইল ব্যাংকিং' || cat.includes('ব্যাংকিং') || cat.toLowerCase().includes('mfs'));
 const limitNav = document.getElementById('mfsLimitNavCard');
  if (limitNav) limitNav.style.display = isMFS ? 'flex' : 'none';
  
  // কাস্টমার কেয়ার ও ক্যালকুলেটর বাটন
  const mfsNav = document.getElementById('mfsCalcNavCard');
  const careNav = document.getElementById('mfsCareNavCard');
  if (mfsNav) mfsNav.style.display = isMFS ? 'flex' : 'none';
  if (careNav) careNav.style.display = (isMFS || isTelecom) ? 'flex' : 'none';

  // অ্যাকর্ডিয়ন রেন্ডার
  renderMfsAccordion(item.services);
  

  if (telBox) {
    if (isTelecom) {
      telBox.style.display = 'flex';
      
      const typeEl = document.getElementById('telTypeVal');
      const subsEl = document.getElementById('telSubsVal');
      if (typeEl) typeEl.innerText = item.type || 'মোবাইল নেটওয়ার্ক';
      if (subsEl) subsEl.innerText = item.subscribers || 'সারাদেশে বিস্তৃত';

      // অফার টেবিল রেন্ডার করা
      renderTelecomOffersTable(item.code || item.name);
    } else {
      telBox.style.display = 'none';
    }
  }
  
  // পরিবহন তথ্য ব্লক হ্যান্ডলিং
  const transBox = document.getElementById('transportSectionBox');
  if (transBox) {
    if (cat === 'পরিবহন' && (item.destination || item.boarding_point)) {
      transBox.style.display = 'block';
      const destEl = document.getElementById('transDestinationVal');
      const fareEl = document.getElementById('transFareVal');
      const boardEl = document.getElementById('transBoardingVal');
      const viaEl = document.getElementById('transRouteViaVal');
      const notesBox = document.getElementById('transNotesBox');
      const notesVal = document.getElementById('transNotesVal');

      if (destEl) destEl.innerText = item.destination || 'তথ্য নেই';
      if (fareEl) fareEl.innerText = item.ticket_fare ? `৳ ${item.ticket_fare}` : item.service_type || '-';
      if (boardEl) boardEl.innerText = item.boarding_point || 'চাষাড়া / নারায়ণগঞ্জ';
      if (viaEl) viaEl.innerText = item.route_via || 'সরাসরি মহাসড়ক';

      if (notesBox && notesVal) {
        if (item.notes && item.notes.trim() !== '') {
          notesVal.innerText = item.notes.trim();
          notesBox.style.display = 'block';
        } else {
          notesBox.style.display = 'none';
        }
      }
    } else {
      transBox.style.display = 'none';
    }
  }
  
  
  // শুধুমাত্র নির্দিষ্ট প্রশাসনিক ক্যাটাগরি অথবা জনপ্রতিনিধিদের জন্য সত্য হবে
  const adminCategories = ['জেলা প্রশাসন', 'জেলা প্রশাসন ও পুলিশ', 'সংসদীয় আসন', 'সিটি কর্পোরেশন', 'উপজেলা প্রশাসন', 'ইউনিয়ন পরিষদ', 'পৌরসভা', 'প্রশাসন'];
  const isAdmin = Boolean(adminCategories.includes(cat) || item.voters || item.leader_name || item.territory);

  const imgEl = document.getElementById('detailsImg');
  if (imgEl) {
    imgEl.src = (item.image_url && item.image_url.trim() !== '') ? item.image_url.trim() : 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80';
  }

  const sticky = document.getElementById('detailsStickyTitle');
  if (sticky) sticky.innerText = item.name || 'বিস্তারিত';

  const nameEl = document.getElementById('detailsName');
  if (nameEl) nameEl.innerText = item.name || 'তথ্য নেই';

  const catEl = document.getElementById('detailsCategory');
  if (catEl) catEl.innerText = cat || 'সেবা';

  const addrEl = document.getElementById('detailsAddress');
  if (addrEl) addrEl.innerText = item.address || item.area || 'নারায়ণগঞ্জ';

  const timeEl = document.getElementById('detailsTiming');
  const timingBox = document.getElementById('detailsTimingBox') || timeEl?.closest('.info-item');
  if (timingBox && timeEl) {
    if (item.timing && item.timing.trim() !== '') {
      timeEl.innerText = item.timing.trim();
      timingBox.style.display = 'flex';
    } else {
      timingBox.style.display = 'none';
    }
  }

  const phoneEl = document.getElementById('detailsPhone');
  if (phoneEl) phoneEl.innerText = item.phone || 'নম্বর নেই';

  const eiinEl = document.getElementById('detailsEiin');
  if (eiinEl) {
    if (item.eiin && item.eiin.toString().trim() !== '') {
      eiinEl.innerText = `EIIN: ${item.eiin}`;
      eiinEl.style.display = 'inline-block';
    } else {
      eiinEl.style.display = 'none';
    }
  }

  const bedsEl = document.getElementById('detailsBeds');
  if (bedsEl) {
    if ((cat.includes('হাসপাতাল') || cat.includes('ক্লিনিক')) && item.beds && item.beds.toString().trim() !== '') {
      bedsEl.innerHTML = `<i class="fa-solid fa-bed"></i> ${item.beds}`;
      bedsEl.style.display = 'inline-block';
    } else {
      bedsEl.style.display = 'none';
    }
  }

  updateHeartIcon(document.getElementById('detailsHeartBtn'), isItemBookmarked(item.name));

  const landmarkBox = document.getElementById('detailsLandmarkBox');
  const landmarkText = document.getElementById('detailsLandmark');
  if (landmarkBox && landmarkText) {
    if (item.landmark && item.landmark.trim() !== '') {
      landmarkText.innerText = item.landmark.trim();
      landmarkBox.style.display = 'flex';
    } else {
      landmarkBox.style.display = 'none';
    }
  }

  const chamberBox = document.getElementById('chamberDocsBtnBox');
  if (chamberBox) {
    const isMedical = cat.includes('হাসপাতাল') || cat.includes('ডায়াগনস্টিক') || cat.includes('ডেন্টাল');
    chamberBox.style.display = isMedical ? 'block' : 'none';
  }

  const ambBox = document.getElementById('hospitalAmbulanceBox');
  const ambBtn = document.getElementById('ambulanceCallBtn');
  if (ambBox && ambBtn) {
    if (item.ambulance && item.ambulance.trim() !== '') {
      const ambNumber = item.ambulance.split(',')[0].trim();
      ambBtn.href = `tel:${ambNumber}`;
      ambBox.style.display = 'block';
    } else {
      ambBox.style.display = 'none';
    }
  }

  const careBox = document.getElementById('hospitalCareBox');
  const isHospital = cat === 'সরকারি হাসপাতাল' || cat === 'বেসরকারি হাসপাতাল' || cat === 'হাসপাতাল';
  if (careBox) {
    if (isHospital && (item.beds || item.facilities)) {
      careBox.style.display = 'block';
      const facText = document.getElementById('facilitiesText');
      if (facText) facText.innerText = item.facilities || '২৪ ঘণ্টা ফার্মেসী, ল্যাব ও জরুরি চিকিৎসা সেবা';
    } else {
      careBox.style.display = 'none';
    }
  }

  const deptsBox = document.getElementById('hospitalDeptsBox');
  const deptsList = document.getElementById('hospitalDeptsList');
  const deptsSub = document.getElementById('hospitalDeptsSub');
  if (deptsBox && deptsList) {
    deptsList.innerHTML = '';
    const deptsTitleDiv = deptsBox.querySelector('div');
    if (deptsTitleDiv) {
      deptsTitleDiv.innerHTML = isCinema ? '<i class="fa-solid fa-film" style="color: #E11D48;"></i> বর্তমানে রানিং' : '<i class="fa-solid fa-layer-group" style="color: var(--primary);"></i> বিভাগসমূহ';
    }
    if (deptsSub) {
      deptsSub.innerText = isEdu ? 'অনুমোদিত অনুষদ, স্তর ও বিভাগ' : (isCinema ? 'চলমান সিনেমা ও প্রদর্শনী' : 'চিকিৎসা ও ক্লিনিক্যাল শাখাসমূহ');
    }
    const rawDepts = (item.departments || '').trim();
    if (rawDepts) {
      rawDepts.split(',').forEach(dept => {
        const dName = dept.trim();
        if (dName) {
          const badge = document.createElement('span');
          badge.className = 'dept-badge-item';
          if (isCinema) {
            badge.style.borderColor = '#FECDD3';
            badge.style.color = '#BE123C';
            badge.style.background = '#FFF1F2';
          }
          badge.innerText = dName;
          deptsList.appendChild(badge);
        }
      });
      deptsBox.style.display = 'block';
    } else {
      deptsBox.style.display = 'none';
    }
  }

  const cinemaBox = document.getElementById('cinemaShowtimeBox');
  const cinemaList = document.getElementById('cinemaMovieList');
  if (isCinema && item.showtimes && item.showtimes.trim() !== '') {
    if (cinemaBox && cinemaList) {
      cinemaList.innerHTML = '';
      const movieEntries = item.showtimes.trim().split(/[|\n]/).map(m => m.trim()).filter(Boolean);
      movieEntries.forEach(entry => {
        const parts = entry.split(':');
        const title = parts[0]?.trim() || 'চলচ্চিত্র';
        const timesStr = parts.slice(1).join(':').trim();
        const times = timesStr ? timesStr.split(',').map(t => t.trim()).filter(Boolean) : [];

        const card = document.createElement('div');
        card.style.cssText = "background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px;";
        card.innerHTML = `
          <div style="font-weight: 700; font-size: 14px; color: #0F172A; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-clapperboard" style="color: #E11D48; font-size: 13px;"></i>
            <span>${title}</span>
          </div>
          <div style="height: 1px; background: #E2E8F0; margin: 9px 0;"></div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${times.length > 0 ? times.map(t => `
              <span style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #1E293B; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                <i class="fa-regular fa-clock" style="color: #64748B; font-size: 10px; margin-right: 4px;"></i>${t}
              </span>
            `).join('') : '<span style="font-size: 11px; color: #94A3B8;">সময়সূচি দেওয়া হয়নি</span>'}
          </div>
        `;
        cinemaList.appendChild(card);
      });
      cinemaBox.style.display = 'block';
    }
  } else if (cinemaBox) {
    cinemaBox.style.display = 'none';
  }

  const servicesBox = document.getElementById('hospitalServicesBox');
  const servicesList = document.getElementById('hospitalServicesList');
  if (servicesBox && servicesList) {
    servicesList.innerHTML = '';
    const rawServices = (item.services || item.facilities || '').trim();
    if (rawServices && !isMFS && !isTelecom) {
      rawServices.split(',').forEach(srv => {
        const sName = srv.trim();
        if (sName) {
          const badge = document.createElement('span');
          badge.className = 'dept-badge-item';
          badge.style.borderColor = '#BAE6FD';
          badge.style.color = '#0369A1';
          badge.style.background = '#F0F9FF';
          badge.innerText = sName;
          servicesList.appendChild(badge);
        }
      });
      servicesBox.style.display = 'block';
    } else {
      servicesBox.style.display = 'none';
    }
  }

  const diagBox = document.getElementById('hospitalDiagBox');
  const diagList = document.getElementById('hospitalDiagList');
  if (diagBox && diagList) {
    diagList.innerHTML = '';
    const rawDiag = (item.diagnostics || '').trim();
    if (rawDiag) {
      rawDiag.split(',').forEach(dg => {
        const dName = dg.trim();
        if (dName) {
          const badge = document.createElement('span');
          badge.className = 'dept-badge-item';
          badge.style.borderColor = '#FDE68A';
          badge.style.color = '#B45309';
          badge.style.background = '#FFFBEB';
          badge.innerText = dName;
          diagList.appendChild(badge);
        }
      });
      diagBox.style.display = 'block';
    } else {
      diagBox.style.display = 'none';
    }
  }

  const feedBox = document.getElementById('newspaperFeedBox');
  if (feedBox) {
    if (item.feed_url && item.feed_url.trim() !== '') {
      feedBox.style.display = 'block';
      fetchLiveNews(item.feed_url.trim());
    } else {
      feedBox.style.display = 'none';
    }
  }

  renderTriviaSlider(item.trivia);
  
  const isIsp = (cat === 'আইএসপি' || cat.includes('ইন্টারনেট') || cat.includes('ব্রডব্যান্ড') || cat.toLowerCase().includes('isp'));
  const ispBtnBox = document.getElementById('ispPackagesBtnBox');
  if (ispBtnBox) {
    ispBtnBox.style.display = isIsp ? 'block' : 'none';
  }
  
  // --- আইএসপি সংক্ষিপ্ত তুলনামূলক টেবিল রেন্ডারিং ---
  const compareBox = document.getElementById('ispQuickCompareBox');
  const compareBody = document.getElementById('ispQuickCompareBody');

  if (compareBox && compareBody) {
    if (isIsp) {
      compareBody.innerHTML = '';
      const currentCode = toEnDigits(item.code || item.id || '').toUpperCase().trim();
      const currentName = (item.name || item.name_bn || '').toLowerCase().trim();
      const currentCoreName = currentName.replace(/ইন্টারনেট|ব্রডব্যান্ড|আইএসপি|নেটওয়ার্ক|লিমিটেড|প্রাঃ|isp|net|internet|broadband/gi, '').trim();

      const matchedPkgs = (packagesData || []).filter(pkg => {
        if (!pkg) return false;
        const pCode = toEnDigits(pkg.code || pkg.isp_code || pkg.isp_id || '').toUpperCase().trim();
        if (currentCode && pCode && currentCode === pCode) return true;

        const pProvider = String(pkg.provider || pkg.isp || pkg.institution || pkg.name || '').toLowerCase().trim();
        const pCore = pProvider.replace(/ইন্টারনেট|ব্রডব্যান্ড|আইএসপি|নেটওয়ার্ক|লিমিটেড|প্রাঃ|isp|net|internet|broadband/gi, '').trim();
        
        return (currentCoreName && pCore && (pCore.includes(currentCoreName) || currentCoreName.includes(pCore))) ||
               (currentName && pProvider && (pProvider.includes(currentName) || currentName.includes(pProvider)));
      });

      if (matchedPkgs.length > 0) {
        matchedPkgs.slice(0).forEach((pkg, idx) => {
          const row = document.createElement('tr');
          row.style.cssText = `border-bottom: 1px solid #E2E8F0; background: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};`;
          
          const pkgName = pkg.package_name || pkg.package || pkg.title || '-';
          const speed = pkg.speed || '-';
          const price = pkg.price ? `৳ ${pkg.price}` : '-';

          row.innerHTML = `
            <td style="padding: 9px 10px; font-weight: 600; color: #1E293B;">${pkgName}</td>
            <td style="padding: 9px 10px; color: #0284C7; font-weight: 700;">${speed}</td>
            <td style="padding: 9px 10px; text-align: right; color: #16A34A; font-weight: 700;">${price}</td>
          `;
          compareBody.appendChild(row);
        });
        compareBox.style.display = 'block';
      } else {
        compareBox.style.display = 'none';
      }
    } else {
      compareBox.style.display = 'none';
    }
  }

  // --- শিক্ষা প্রতিষ্ঠান ব্লক ---
  const eduBox = document.getElementById('eduSectionBox');
  if (eduBox) {
    if (isEdu || isNews) {
      eduBox.style.display = 'flex';
      const principalCard = document.getElementById('eduPrincipalCard');
      const principalName = document.getElementById('eduPrincipalName');
      const principalLabel = document.getElementById('eduPrincipalLabel');
      const principalIcon = document.getElementById('eduPrincipalIcon');
      const resultsNavCard = eduBox.querySelector('.doc-nav-card');

      if (principalCard && principalName) {
        if (item.principal && item.principal.trim() !== '') {
          principalName.innerText = item.principal.trim();
          principalCard.style.display = 'flex';
          if (isNews) {
            if (principalLabel) { principalLabel.innerText = 'সম্পাদক ও প্রকাশক'; principalLabel.style.color = '#0284C7'; }
            if (principalIcon) { principalIcon.innerHTML = '<i class="fa-solid fa-pen-nib"></i>'; principalIcon.style.background = '#E0F2FE'; principalIcon.style.color = '#0284C7'; }
          } else {
            if (principalLabel) { principalLabel.innerText = 'বর্তমান অধ্যক্ষ / প্রধান শিক্ষক'; principalLabel.style.color = '#7C3AED'; }
            if (principalIcon) { principalIcon.innerHTML = '<i class="fa-solid fa-user-tie"></i>'; principalIcon.style.background = '#EDE9FE'; principalIcon.style.color = '#7C3AED'; }
          }
        } else {
          principalCard.style.display = 'none';
        }
      }

      if (resultsNavCard) resultsNavCard.style.display = isEdu ? 'flex' : 'none';

      const infoGridBox = document.getElementById('eduInfoGridBox');
      const mgtEl = document.getElementById('eduManagement');
      const whomEl = document.getElementById('eduForWhom');
      const dateEl = document.getElementById('eduEstDate');
      const constEl = document.getElementById('eduConstituency');
      const emailRow = document.getElementById('eduEmailRow');
      const emailLink = document.getElementById('eduEmailLink');

      if (infoGridBox) {
        if (isEdu) {
          infoGridBox.style.display = 'block';
          if (mgtEl) mgtEl.innerText = item.management || 'সাধারণ';
          if (whomEl) whomEl.innerText = item.for_whom || 'সহশিক্ষা';
          if (dateEl) dateEl.innerText = item.establishment_date || item.established_date || 'তথ্য নেই';
          if (constEl) constEl.innerText = item.constituency || 'নারায়ণগঞ্জ';
          if (emailRow && emailLink) {
            if (item.email && item.email.trim() !== '') {
              emailLink.href = `mailto:${item.email.trim()}`;
              emailLink.innerText = item.email.trim();
              emailRow.style.display = 'block';
            } else {
              emailRow.style.display = 'none';
            }
          }
        } else {
          infoGridBox.style.display = 'none';
        }
      }
    } else {
      eduBox.style.display = 'none';
    }
  }

  // --- প্রশাসন ও জনপ্রতিনিধি ব্লক ---
  const adminBox = document.getElementById('adminSectionBox');
  if (adminBox) {
    if (isAdmin) {
      adminBox.style.display = 'flex';
      const leaderTitle = document.getElementById('adminLeaderTitle');
      const leaderName = document.getElementById('adminLeaderName');
      const leaderCallBtn = document.getElementById('adminLeaderCallBtn');
      const leaderCard = document.getElementById('adminLeaderCard');

      if (item.leader_name && item.leader_name.trim() !== '') {
        if (leaderTitle) leaderTitle.innerText = item.leader_title || 'দায়িত্বপ্রাপ্ত প্রতিনিধি';
        if (leaderName) leaderName.innerText = item.leader_name.trim();
        if (leaderCallBtn) {
          if (item.leader_phone) {
            leaderCallBtn.href = `tel:${item.leader_phone}`;
            leaderCallBtn.style.display = 'flex';
          } else {
            leaderCallBtn.style.display = 'none';
          }
        }
        if (leaderCard) leaderCard.style.display = 'flex';
      } else if (leaderCard) {
        leaderCard.style.display = 'none';
      }

      const codeVal = document.getElementById('adminCodeVal');
      const votersVal = document.getElementById('adminVotersVal');
      const terrVal = document.getElementById('adminTerritoryVal');
      const estVal = document.getElementById('adminEstVal');
      const upazilaVal = document.getElementById('adminUpazilaVal');

      const codeCard = document.getElementById('adminCodeCard');
      const votersCard = document.getElementById('adminVotersCard');
      const terrCard = document.getElementById('adminTerritoryCard');
      const estCard = document.getElementById('adminEstCard');

      if (codeVal) codeVal.innerText = item.code || '-';
      if (votersVal) votersVal.innerText = item.voters || '-';
      if (terrVal) terrVal.innerText = item.territory || item.area || 'সমগ্র এলাকা';
      if (estVal) estVal.innerText = item.established || '-';
      if (upazilaVal) upazilaVal.innerText = item.upazila || item.area || 'নারায়ণগঞ্জ';

      if (codeCard) codeCard.style.display = item.code ? 'block' : 'none';
      if (votersCard) votersCard.style.display = item.voters ? 'block' : 'none';
      if (terrCard) terrCard.style.display = (item.territory || item.area) ? 'block' : 'none';
      if (estCard) estCard.style.display = item.established ? 'block' : 'none';

      const subBox = document.getElementById('adminSubLeaderBox');
      const subText = document.getElementById('adminSubLeaderText');
      if (subBox && subText) {
        if (item.sub_leader && item.sub_leader.trim() !== '') {
          if (item.sub_leader.includes('|')) {
            subText.innerHTML = item.sub_leader.split('|').map(s => `<div>• ${s.trim()}</div>`).join('');
          } else {
            subText.innerText = item.sub_leader.trim();
          }
          subBox.style.display = 'block';
        } else {
          subBox.style.display = 'none';
        }
      }
    } else {
      adminBox.style.display = 'none';
    }
  }

  // উপজেলা প্রশাসনিক ইউনিট (স্মার্ট লিংকসহ)
  const unitsBox = document.getElementById('adminUnitsBox');
  const unitsList = document.getElementById('adminUnitsList');
  const unitsStats = document.getElementById('adminUnitsStats');
  if (unitsBox && unitsList) {
    const rawUnits = (item.admin_units || '').trim();
    if (isAdmin && rawUnits) {
      unitsList.innerHTML = '';
      if (unitsStats) {
        if (item.admin_stats && item.admin_stats.trim() !== '') {
          unitsStats.innerText = item.admin_stats.trim();
          unitsStats.style.display = 'block';
        } else {
          unitsStats.style.display = 'none';
        }
      }

      const lines = rawUnits.split(/[|\n]/).map(l => l.trim()).filter(Boolean);
      let currentSection = null;
      let currentBadgeGrid = null;

      lines.forEach(line => {
        if (line.startsWith('##') || line.startsWith('#')) {
          const secTitle = line.replace(/^[#\s]+/, '').trim();
          currentSection = document.createElement('div');
          currentSection.innerHTML = `
            <div style="font-size: 13px; font-weight: 700; color: #0F5132; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-circle-dot" style="font-size: 9px; color: #16A34A;"></i> ${secTitle}
            </div>
          `;
          currentBadgeGrid = document.createElement('div');
          currentBadgeGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";
          currentSection.appendChild(currentBadgeGrid);
          unitsList.appendChild(currentSection);
        } else if (currentBadgeGrid) {
          const badge = document.createElement('span');
          badge.style.cssText = "background: #F8FAFC; border: 1px solid #E2E8F0; color: #1E293B; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 6px; transition: all 0.2s;";
          
          const cleanUnitName = line.replace(/^[•\-\*\d\.]+\s*/, '').trim();
          const matchedUnit = (adminData || []).find(a => {
            const aName = (a.name || '').toLowerCase();
            const target = cleanUnitName.toLowerCase();
            return aName.includes(target) || target.includes(aName);
          });

          if (matchedUnit) {
            badge.style.cursor = 'pointer';
            badge.style.background = '#DCFCE7';
            badge.style.borderColor = '#86EFAC';
            badge.style.color = '#15803D';
            badge.innerHTML = `${cleanUnitName} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; margin-left: 4px;"></i>`;
            badge.onclick = () => {
              const dView = document.getElementById('detailsView');
              if (dView) dView.scrollTop = 0;
              openDetails(matchedUnit);
            };
          } else {
            badge.innerText = cleanUnitName;
          }
          currentBadgeGrid.appendChild(badge);
        }
      });
      unitsBox.style.display = 'block';
    } else {
      unitsBox.style.display = 'none';
    }
  }

  // দর্শনীয় স্থানসমূহ
  const attractionsBox = document.getElementById('adminAttractionsBox');
  const attractionsList = document.getElementById('adminAttractionsList');
  if (attractionsBox && attractionsList) {
    const rawAttractions = (item.attractions || '').trim();
    if (isAdmin && rawAttractions) {
      attractionsList.innerHTML = '';
      const spots = rawAttractions.split(/[|\n]/).map(s => s.trim().replace(/^[•\-\*\d\.]+\s*/, '')).filter(Boolean);
      spots.forEach(spot => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = "display: flex; align-items: flex-start; gap: 8px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; color: #78350F; font-weight: 600;";
        itemEl.innerHTML = `
          <i class="fa-solid fa-location-dot" style="color: #D97706; margin-top: 3px; font-size: 12px; flex-shrink: 0;"></i>
          <span>${spot}</span>
        `;
        attractionsList.appendChild(itemEl);
      });
      attractionsBox.style.display = 'block';
    } else {
      attractionsBox.style.display = 'none';
    }
  }

  // বিগত সংসদ ও প্রতিনিধি ইতিহাস
  const historyBox = document.getElementById('adminHistoryBox');
  const historyList = document.getElementById('adminHistoryList');
  if (historyBox && historyList) {
    const rawHistory = (item.history || '').trim();
    if (isAdmin && rawHistory) {
      historyList.innerHTML = '';
      const entries = rawHistory.split(/[|\n]/).map(e => e.trim()).filter(Boolean);
      let currentCard = null;

      entries.forEach(entry => {
        if (entry.startsWith('##') || entry.startsWith('#')) {
          const sessionTitle = entry.replace(/^[#\s]+/, '').trim();
          currentCard = document.createElement('div');
          currentCard.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 3px solid #16A34A; border-radius: 8px;";
          currentCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: #0F5132;">
              <i class="fa-solid fa-calendar-check" style="color: #16A34A; font-size: 11px;"></i>
              <span>${sessionTitle}</span>
            </div>
            <div class="hist-person" style="font-size: 13px; font-weight: 600; color: #1E293B;">-</div>
          `;
          historyList.appendChild(currentCard);
        } else if (currentCard) {
          const pEl = currentCard.querySelector('.hist-person');
          if (pEl) pEl.innerText = entry;
        }
      });
      historyBox.style.display = 'block';
    } else {
      historyBox.style.display = 'none';
    }
  }

  // রেস্টুরেন্ট অফার ব্যানার
  const offerBox = document.getElementById('restaurantOfferBox');
  const offerContent = document.getElementById('restaurantOfferContent');
  if (offerBox && offerContent) {
    const validOffers = parseOffers(item.offer || item.campaign || '');
    if (validOffers.length > 0) {
      offerContent.innerHTML = '';
      validOffers.forEach((block, idx) => {
        const blockDiv = document.createElement('div');
        blockDiv.style.cssText = `background: rgba(255, 255, 255, 0.7); border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 12px; ${idx > 0 ? 'margin-top: 4px;' : ''}`;
        let headerHtml = '';
        if (block.title) {
          headerHtml = `
            <div style="font-weight: 700; font-size: 13px; color: #92400E; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px dashed #FCD34D; padding-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-store" style="color: #D97706; font-size: 11px;"></i>
                <span>${block.title}</span>
              </div>
              ${block.expDate ? `<span style="font-size: 10px; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; font-weight: 600;">মেয়াদ: ${block.expDate}</span>` : ''}
            </div>
          `;
        }
        const pointsHtml = block.points.map(pt => `
          <div style="display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; font-size: 12.5px; color: #78350F; line-height: 1.5;">
            <i class="fa-solid fa-circle-check" style="color: #D97706; font-size: 11px; margin-top: 3px; flex-shrink: 0;"></i>
            <span>${pt}</span>
          </div>
        `).join('');
        blockDiv.innerHTML = headerHtml + pointsHtml;
        offerContent.appendChild(blockDiv);
      });
      offerBox.style.display = 'block';
    } else {
      offerBox.style.display = 'none';
    }
  }

  // রেস্টুরেন্ট মেনু
  const menuBox = document.getElementById('restaurantMenuBox');
  const menuList = document.getElementById('restaurantMenuList');
  if (menuBox && menuList) {
    const rawMenu = (item.menu || '').trim();
    if (rawMenu) {
      menuList.innerHTML = '';
      const menuEntries = rawMenu.split(/[|\n।;]/).map(m => m.trim()).filter(Boolean);
      menuEntries.forEach((entry, idx) => {
        const isHeader = entry.startsWith('#') || (entry.startsWith('[') && entry.endsWith(']'));
        if (isHeader) {
          const titleText = entry.replace(/^[#\[\]\s]+|[#\[\]\s]+$/g, '').trim();
          const headerEl = document.createElement('div');
          headerEl.style.cssText = `font-size: 14px; font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 8px; margin-top: ${idx === 0 ? '4px' : '14px'}; margin-bottom: 2px; padding-bottom: 4px; border-bottom: 2px solid #F1F5F9;`;
          headerEl.innerHTML = `<i class="fa-solid fa-layer-group" style="font-size: 12px; color: #F59E0B;"></i><span>${titleText}</span>`;
          menuList.appendChild(headerEl);
          return;
        }

        let name = entry;
        let price = '';
        const lastSepIndex = Math.max(entry.lastIndexOf('-'), entry.lastIndexOf('–'), entry.lastIndexOf('—'), entry.lastIndexOf('='));
        if (lastSepIndex !== -1) {
          name = entry.substring(0, lastSepIndex).trim();
          price = entry.substring(lastSepIndex + 1).trim();
        }

        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 3px solid #F59E0B; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); box-sizing: border-box; width: 100%;";
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #1E293B; text-align: left;">
            <i class="fa-solid fa-utensils" style="font-size: 11px; color: #F59E0B; flex-shrink: 0;"></i>
            <span>${name}</span>
          </div>
          ${price ? `<div style="font-size: 13px; font-weight: 700; color: #0F5132; background: #DCFCE7; border: 1px solid #BBF7D0; padding: 4px 12px; border-radius: 20px; white-space: nowrap; margin-left: auto; text-align: right; flex-shrink: 0;">${price}</div>` : ''}
        `;
        menuList.appendChild(row);
      });
      menuBox.style.display = 'block';
    } else {
      menuBox.style.display = 'none';
    }
  }

  // সোশ্যাল মিডিয়া ও ইমেইল
  const socialBox = document.getElementById('socialLinksBox');
  const webBtn = document.getElementById('linkWebsite');
  const fbBtn = document.getElementById('linkFacebook');
  const ytBtn = document.getElementById('linkYoutube');
  const liBtn = document.getElementById('linkLinkedin');
  const igBtn = document.getElementById('linkInstagram');
  const emailBtn = document.getElementById('linkEmail');

  let hasSocial = false;
  if (webBtn) {
    if (item.website && item.website.trim() !== '') {
      webBtn.href = item.website.startsWith('http') ? item.website : `https://${item.website}`;
      webBtn.style.display = 'flex';
      hasSocial = true;
    } else { webBtn.style.display = 'none'; }
  }

  if (fbBtn) {
    if (item.facebook && item.facebook.trim() !== '') {
      fbBtn.href = item.facebook;
      fbBtn.style.display = 'flex';
      hasSocial = true;
    } else { fbBtn.style.display = 'none'; }
  }

  if (ytBtn) {
    if (item.youtube && item.youtube.trim() !== '') {
      ytBtn.href = item.youtube;
      ytBtn.style.display = 'flex';
      hasSocial = true;
    } else { ytBtn.style.display = 'none'; }
  }

  if (liBtn) {
    if (item.linkedin && item.linkedin.trim() !== '') {
      liBtn.href = item.linkedin;
      liBtn.style.display = 'flex';
      hasSocial = true;
    } else { liBtn.style.display = 'none'; }
  }

  if (igBtn) {
    if (item.instagram && item.instagram.trim() !== '') {
      igBtn.href = item.instagram;
      igBtn.style.display = 'flex';
      hasSocial = true;
    } else { igBtn.style.display = 'none'; }
  }
  
  const ttBtn = document.getElementById('linkTiktok');
  if (ttBtn) {
    if (item.tiktok && item.tiktok.trim() !== '') {
      ttBtn.href = item.tiktok.startsWith('http') ? item.tiktok : `https://${item.tiktok}`;
      ttBtn.style.display = 'flex';
      hasSocial = true;
    } else { ttBtn.style.display = 'none'; }
  }



  if (emailBtn) {
    if (item.email && item.email.trim() !== '') {
      emailBtn.href = `mailto:${item.email.trim()}`;
      emailBtn.style.display = 'flex';
      hasSocial = true;
    } else { emailBtn.style.display = 'none'; }
  }

  // টেলিকমের ক্ষেত্রে সোশ্যাল কার্ড স্বয়ংক্রিয়ভাবে প্যাকেজ বক্সের উপরে চলে যাবে
  if (socialBox) {
    socialBox.style.display = hasSocial ? 'block' : 'none';
    const telOffersBox = document.getElementById('telOffersBox');
    if (isTelecom && telOffersBox && telOffersBox.parentNode) {
      telOffersBox.parentNode.insertBefore(socialBox, telOffersBox);
    } else {
      const detailsContent = document.querySelector('.details-content');
      if (detailsContent && socialBox.parentNode !== detailsContent) {
        detailsContent.appendChild(socialBox);
      }
    }
  }
  
  if (socialBox) socialBox.style.display = hasSocial ? 'block' : 'none';

  const callBtn = document.getElementById('detailsCallBtn');
  if (callBtn) {
    if (item.phone) {
      callBtn.href = `tel:${item.phone}`;
      callBtn.style.opacity = '1';
      callBtn.style.pointerEvents = 'auto';
    } else {
      callBtn.removeAttribute('href');
      callBtn.style.opacity = '0.5';
    }
  }

  const mapBtn = document.getElementById('detailsMapBtn');
  if (mapBtn) {
    mapBtn.href = item.map_url || `https://maps.google.com/?q=${encodeURIComponent(item.name + ' ' + (item.area || 'নারায়ণগঞ্জ'))}`;
  }

  const dView = document.getElementById('detailsView');
  if (dView) {
    dView.classList.add('open');
    window.history.pushState({ page: 'details' }, '');
  }
}

function closeDetails() {
  const el = document.getElementById('detailsView');
  if (el) el.classList.remove('open');
}

// --- ৫. বিশেষজ্ঞ ডাক্তার মডিউল ---

function openDoctorList(chamberName = null, title = 'বিশেষজ্ঞ ডাক্তারগণ') {
  currentChamberFilter = chamberName;
  const tEl = document.getElementById('docPageTitle');
  const sEl = document.getElementById('docPageSub');
  const iEl = document.getElementById('docSearchInput');
  if (tEl) tEl.innerText = chamberName ? chamberName : title;
  if (sEl) sEl.innerText = chamberName ? 'এই সেন্টারের বিশেষজ্ঞ চিকিৎসকগণ' : 'চেম্বার, ভিজিটিং সময় ও সিরিয়াল';
  if (iEl) iEl.value = '';

  selectedDocArea = 'সব এলাকা';
  const docBar = document.getElementById('docAreaFilterBar');
  if (docBar) {
    docBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    const f = docBar.querySelector('.area-chip');
    if (f) f.classList.add('active');
    docBar.style.display = chamberName ? 'none' : 'flex';
  }

  selectedDocDept = 'সব বিভাগ';
  const deptBar = document.getElementById('docDeptFilterBar');
  if (deptBar) {
    deptBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    const f = deptBar.querySelector('.area-chip');
    if (f) f.classList.add('active');
    deptBar.style.display = chamberName ? 'none' : 'flex';
  }

  renderDoctorItems();
  
  const docPage = document.getElementById('doctorPage');
  if (docPage) {
    docPage.classList.add('open');
    docPage.scrollTop = 0;
    window.history.pushState({ page: 'doctors' }, '');
  }
}

function closeDoctorPage() {
  const el = document.getElementById('doctorPage');
  if (el) el.classList.remove('open');
}

function setDoctorAreaFilter(areaName, chipElement) {
  selectedDocArea = areaName;
  const bar = document.getElementById('docAreaFilterBar');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    if (chipElement) chipElement.classList.add('active');
  }
  renderDoctorItems();
}

function setDoctorDeptFilter(deptName, chipElement) {
  selectedDocDept = deptName;
  const bar = document.getElementById('docDeptFilterBar');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    if (chipElement) chipElement.classList.add('active');
  }
  renderDoctorItems();
}

function renderDoctorItems() {
  const container = document.getElementById('doctorListings');
  if (!container) return;
  container.innerHTML = '';

  const input = document.getElementById('docSearchInput');
  const query = input ? input.value.toLowerCase().trim() : '';

  const deptKeywords = {
    'মেডিসিন': ['মেডিসিন', 'ইন্টারনাল', 'medicine'],
    'কার্ডিওলজি': ['কার্ডিওলজি', 'কার্ডিওলজিস্ট', 'কার্ডিয়াক', 'হৃদরোগ', 'কার্ডিও', 'হার্ট', 'cardio'],
    'গাইনী': ['গাইনী', 'গাইনি', 'প্রসূতি', 'স্ত্রী রোগ', 'স্ত্রী-রোগ', 'obs', 'gynae', 'মহিলা রোগ'],
    'শিশু': ['শিশু', 'নবজাতক', 'কিশোর রোগ', 'pediatric', 'paediatric', 'শিশু রোগ'],
    'অর্থোপেডিক': ['অর্থোপেডিক', 'অর্থোপেডিক্স', 'হাড়ভাঙ্গা', 'হাড়', 'ট্রমা', 'স্পাইন', 'বাত-ব্যথা', 'জোড়াবাত', 'ortho'],
    'সার্জারি': ['সার্জারি', 'সার্জন', 'অপারেশন', 'surgery', 'surgeon', 'ল্যাপারোস্কোপিক'],
    'ইউরোলজি': ['ইউরোলজি', 'ইউরোলজিস্ট', 'কিডনি', 'মূত্রনালী', 'প্রোস্টেট', 'urology'],
    'নিউরো': ['নিউরো', 'নিউরোসার্জারি', 'নিউরোমেডিসিন', 'মস্তিষ্ক', 'মেরুদণ্ড', 'স্নায়ু', 'neuro'],
    'গ্যাস্ট্রো': ['গ্যাস্ট্রো', 'গ্যাস্ট্রোএন্টারোলজি', 'লিভার', 'পরিপাকতন্ত্র', 'হেপাটোলজি', 'gastro', 'liver'],
    'চর্ম ও যৌন': ['চর্ম', 'যৌন', 'ডার্মাটোলজি', 'ত্বক', 'skin', 'derma'],
    'ইএনটি': ['নাক', 'কান', 'গলা', 'ইএনটি', 'ent'],
    'ডেন্টাল': ['ডেন্টাল', 'দাঁত', 'মুখের রোগ', 'dental', 'দাঁতের'],
	'চক্ষু': ['চক্ষু', 'চোখ', 'eye', 'আই', 'ophthalmology', 'রেটিনা', 'দৃষ্টি', 'phaco', 'ছানি'],
  };

  const filtered = (doctorsData || []).filter(doc => {
    if (!doc) return false;
    let matchChamber = true;
    if (currentChamberFilter) {
      const cleanTarget = currentChamberFilter.toLowerCase()
        .replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|মেডিকেল|সার্ভিসেস|কলেজ|এন্ড|লিঃ|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিমিটেড|-/g, ' ')
        .trim();
      const keywords = cleanTarget.split(/\s+/).filter(w => w.length >= 3);
      const chamberText = (doc.chamber || '').toLowerCase();
      matchChamber = keywords.length > 0 ? keywords.some(kw => chamberText.includes(kw)) : chamberText.includes(currentChamberFilter.toLowerCase());
    }

    let matchArea = (selectedDocArea === 'সব এলাকা');
    if (!matchArea) {
      const targetArea = selectedDocArea.toLowerCase();
      const docArea = (doc.area || '').toLowerCase();
      const docChamber = (doc.chamber || '').toLowerCase();
      matchArea = docArea.includes(targetArea) || docChamber.includes(targetArea);
      if (targetArea === 'চাষাড়া' && (docArea.includes('সদর') || docChamber.includes('সদর'))) matchArea = true;
    }

    let matchDept = (selectedDocDept === 'সব বিভাগ');
    if (!matchDept) {
      const keys = deptKeywords[selectedDocDept] || [selectedDocDept.toLowerCase()];
      const fullDocText = ((doc.specialty || '') + ' ' + (doc.degrees || '') + ' ' + (doc.name || '')).toLowerCase();
      matchDept = keys.some(k => fullDocText.includes(k.toLowerCase()));
    }

    const matchSearch = 
      (doc.name || '').toLowerCase().includes(query) ||
      (doc.specialty || '').toLowerCase().includes(query) ||
      (doc.chamber || '').toLowerCase().includes(query) ||
      (doc.area || '').toLowerCase().includes(query) ||
      (doc.degrees || '').toLowerCase().includes(query);

    return matchChamber && matchArea && matchDept && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">কোনো ডাক্তারের তথ্য পাওয়া যায়নি।</div>`;
    return;
  }

  filtered.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doctor-card';
    card.onclick = () => openDoctorProfile(doc);

    const firstPhone = (doc.serial_phone || '').split(';')[0].split(',')[0].trim();
    const firstChamber = (doc.chamber || '').split(';')[0].trim();
    const firstArea = (doc.area || 'চাষাড়া').split(';')[0].trim();
    const firstTiming = (doc.timing || 'নিয়মিত').split(';')[0].trim();
    const isFeatured = (doc.featured || '').toString().toLowerCase().trim() === 'yes';

    if (isFeatured) {
      card.style.borderColor = '#F59E0B';
      card.style.background = '#FFFDF5';
    }

    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <div class="place-title" style="color: #0F5132;">${doc.name || ''}</div>
              ${isFeatured ? '<span style="background: #FEF3C7; color: #B45309; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #FDE68A;"><i class="fa-solid fa-bolt"></i> স্পন্সরড</span>' : ''}
            </div>
            <div class="doc-specialty">${doc.specialty || 'বিশেষজ্ঞ চিকিৎসক'}</div>
          </div>
          <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 13px; margin-top: 4px;"></i>
        </div>
        <div class="doc-degrees">${doc.degrees || ''}</div>
        <div class="doc-chamber-tag"><i class="fa-solid fa-hospital"></i> ${firstChamber} (${firstArea})</div>
        <div style="font-size: 12px; color: #475569; margin-top: 6px;">
          <i class="fa-solid fa-clock" style="color: #10664F;"></i> <strong>সময়:</strong> ${firstTiming}
        </div>
      </div>
      <div class="action-buttons" style="grid-template-columns: 1fr;">
        <a href="${firstPhone ? 'tel:' + firstPhone : '#'}" class="btn-action btn-call" onclick="event.stopPropagation()">
          <i class="fa-solid fa-phone"></i> সিরিয়াল দিন (${firstPhone || 'হটলাইন'})
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

function openDoctorProfile(doc) {
  if (!doc) return;
  activeDoctor = doc;
  
  const nameEl = document.getElementById('docProfileName');
  if (nameEl) nameEl.innerText = doc.name || 'ডাক্তারের নাম';

  const specEl = document.getElementById('docProfileSpecialty');
  if (specEl) specEl.innerText = doc.specialty || 'বিশেষজ্ঞ চিকিৎসক';

  const degEl = document.getElementById('docProfileDegrees');
  if (degEl) degEl.innerText = doc.degrees || '';

  const feeEl = document.getElementById('docProfileFee');
  if (feeEl) feeEl.innerText = doc.fee ? `ভিজিট ফি: ${doc.fee}` : 'ভিজিট ফি: চেম্বারে যোগাযোগ করুন';

  const desigBox = document.getElementById('docProfileDesignation');
  if (desigBox) {
    const rawDesig = (doc.designation || '').trim();
    if (rawDesig) {
      if (rawDesig.includes(',')) {
        const splitIdx = rawDesig.indexOf(',');
        const title = rawDesig.substring(0, splitIdx).trim();
        const inst = rawDesig.substring(splitIdx + 1).trim();
        desigBox.innerHTML = `
          <div style="font-weight: 700; color: #0C4A6E; font-size: 12px; line-height: 1.35;">${title}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <i class="fa-solid fa-building-user" style="color: #0284C7; font-size: 11px;"></i>
            <span>${inst}</span>
          </div>
        `;
      } else {
        desigBox.innerHTML = `
          <div style="font-weight: 600; color: #0C4A6E; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <i class="fa-solid fa-building-user" style="color: #0284C7; font-size: 11px;"></i>
            <span>${rawDesig}</span>
          </div>
        `;
      }
      desigBox.style.display = 'inline-block';
    } else {
      desigBox.style.display = 'none';
      desigBox.innerHTML = '';
    }
  }

  const chambers = (doc.chamber || '').split(';').map(s => s.trim()).filter(Boolean);
  const areas = (doc.area || '').split(';').map(s => s.trim());
  const timings = (doc.timing || '').split(';').map(s => s.trim());
  const phones = (doc.serial_phone || '').split(';').map(s => s.trim());

  const listContainer = document.getElementById('docProfileChambersList');
  if (listContainer) {
    listContainer.innerHTML = '';
    if (chambers.length === 0) {
      listContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">চেম্বারের তথ্য দেওয়া নেই।</div>';
    } else {
      chambers.forEach((ch, idx) => {
        const area = areas[idx] || areas[0] || 'চাষাড়া, নারায়ণগঞ্জ';
        const time = timings[idx] || timings[0] || 'নিয়মিত সময়সূচি';
        const ph = phones[idx] || phones[0] || '';

        const item = document.createElement('div');
        item.className = 'chamber-card-item';
        const headerRow = document.createElement('div');
        headerRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; cursor: pointer;";
        headerRow.onclick = function() { goToChamberDetails(ch, area); };
        headerRow.innerHTML = `
          <div style="font-weight: 700; font-size: 15px; color: #0F5132;">
            <i class="fa-solid fa-hospital" style="color: #0284C7;"></i> ${ch}
          </div>
          <span style="font-size: 11px; background: #E0F2FE; color: #0284C7; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
            প্রতিষ্ঠান দেখুন <i class="fa-solid fa-arrow-right" style="font-size: 9px;"></i>
          </span>
        `;

        const bodyContent = document.createElement('div');
        bodyContent.innerHTML = `
          <div style="font-size: 13px; color: #475569; margin-top: 4px;"><i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${area}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 2px;"><i class="fa-solid fa-clock" style="color: var(--primary);"></i> ${time}</div>
          <div style="margin-top: 8px;">
            <a href="${ph ? 'tel:' + ph : '#'}" class="btn-action btn-call" style="width: 100%; border-radius: 8px;" onclick="event.stopPropagation()">
              <i class="fa-solid fa-phone"></i> সিরিয়াল কল (${ph || 'নম্বর নেই'})
            </a>
          </div>
        `;
        item.appendChild(headerRow);
        item.appendChild(bodyContent);
        listContainer.appendChild(item);
      });
    }
  }

  const pView = document.getElementById('doctorProfileView');
  if (pView) {
    pView.classList.add('open');
    window.history.pushState({ page: 'docProfile' }, '');
  }
}

function closeDoctorProfile() {
  const el = document.getElementById('doctorProfileView');
  if (el) el.classList.remove('open');
}

function viewChamberDoctors() {
  if (activeItem) openDoctorList(activeItem.name, `${activeItem.name}-এর ডাক্তারগণ`);
}

function goToChamberDetails(chamberName, chamberArea) {
  if (!chamberName) return;
  closeDoctorProfile();
  closeDoctorPage();

  const cleanTarget = chamberName.toLowerCase().replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিঃ|-/g, '').trim();
  let matchedPlace = (placesData || []).find(p => {
    if (!p) return false;
    const pName = (p.name || '').toLowerCase().replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিঃ|-/g, '').trim();
    return pName.includes(cleanTarget) || cleanTarget.includes(pName);
  });

  if (!matchedPlace) {
    matchedPlace = {
      name: chamberName,
      category: 'বেসরকারি হাসপাতাল',
      area: chamberArea || 'নারায়ণগঞ্জ',
      address: `${chamberName}, ${chamberArea || 'নারায়ণগঞ্জ'}`,
      timing: 'খোলা আছে',
      phone: '',
      map_url: `https://maps.google.com/?q=${encodeURIComponent(chamberName + ' ' + (chamberArea || 'নারায়ণগঞ্জ'))}`
    };
  }
  openDetails(matchedPlace);
}

// --- ৬. বুকমার্ক, ইউটিলিটি ও ইনিশিয়ালাইজেশন ---

function saveBookmarks() {
  try { localStorage.setItem('narayanganj_bookmarks', JSON.stringify(bookmarks)); } catch (e) {}
}

function isItemBookmarked(name) {
  return (bookmarks.places || []).some(p => p.name === name);
}

function updateHeartIcon(btnElement, isActive) {
  if (!btnElement) return;
  btnElement.classList.toggle('active-heart', isActive);
  btnElement.innerHTML = isActive ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
}

function toggleBookmarkActiveItem() {
  if (!activeItem) return;
  if (!bookmarks.places) bookmarks.places = [];
  const idx = bookmarks.places.findIndex(p => p.name === activeItem.name);
  if (idx > -1) {
    bookmarks.places.splice(idx, 1);
    updateHeartIcon(document.getElementById('detailsHeartBtn'), false);
  } else {
    bookmarks.places.push(activeItem);
    updateHeartIcon(document.getElementById('detailsHeartBtn'), true);
  }
  saveBookmarks();
}

function toggleBookmarkActiveDoctor() {
  if (!activeDoctor) return;
  if (!bookmarks.doctors) bookmarks.doctors = [];
  const idx = bookmarks.doctors.findIndex(d => d.name === activeDoctor.name);
  if (idx > -1) {
    bookmarks.doctors.splice(idx, 1);
    updateHeartIcon(document.getElementById('docHeartBtn'), false);
  } else {
    bookmarks.doctors.push(activeDoctor);
    updateHeartIcon(document.getElementById('docHeartBtn'), true);
  }
  saveBookmarks();
}

function openBookmarkPage() {
  const container = document.getElementById('bookmarkListings');
  if (!container) return;
  container.innerHTML = '';

  const total = (bookmarks.places?.length || 0) + (bookmarks.doctors?.length || 0);
  if (total === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
        <i class="fa-regular fa-bookmark" style="font-size: 38px; color: #CBD5E1; margin-bottom: 12px;"></i>
        <p>আপনার সংরক্ষিত তালিকায় এখনো কিছু নেই।</p>
      </div>
    `;
  } else {
    if (bookmarks.doctors && bookmarks.doctors.length > 0) {
      const docTitle = document.createElement('h4');
      docTitle.innerText = "সংরক্ষিত ডাক্তারগণ";
      docTitle.style.cssText = "font-size: 15px; color: var(--primary); margin: 6px 0 2px;";
      container.appendChild(docTitle);

      bookmarks.doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doctor-card';
        card.onclick = () => openDoctorProfile(doc);
        const firstPhone = (doc.serial_phone || '').split(';')[0].split(',')[0].trim();
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="place-title" style="color: #0F5132;">${doc.name || ''}</div>
              <div class="doc-specialty">${doc.specialty || ''}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 13px;"></i>
          </div>
          <div class="action-buttons" style="grid-template-columns: 1fr;">
            <a href="${firstPhone ? 'tel:' + firstPhone : '#'}" class="btn-action btn-call" onclick="event.stopPropagation()">
              <i class="fa-solid fa-phone"></i> সিরিয়াল দিন (${firstPhone || 'কল'})
            </a>
          </div>
        `;
        container.appendChild(card);
      });
    }

    if (bookmarks.places && bookmarks.places.length > 0) {
      const placeTitle = document.createElement('h4');
      placeTitle.innerText = "সংরক্ষিত প্রতিষ্ঠান ও সেবা";
      placeTitle.style.cssText = "font-size: 15px; color: var(--primary); margin: 12px 0 2px;";
      container.appendChild(placeTitle);

      bookmarks.places.forEach(item => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.onclick = () => openDetails(item);
        card.innerHTML = `
          <div class="place-header">
            <div>
              <div class="place-title">${item.name || ''}</div>
              <div class="place-area"><i class="fa-solid fa-location-dot"></i> ${item.area || ''}</div>
            </div>
            <div class="rating-badge"><i class="fa-solid fa-star"></i> ${item.rating || '৪.০'}</div>
          </div>
        `;
        container.appendChild(card);
      });
    }
  }

  const el = document.getElementById('bookmarkPage');
  if (el) {
    el.classList.add('open');
    window.history.pushState({ page: 'bookmarks' }, '');
  }
}

function closeBookmarkPage() {
  const el = document.getElementById('bookmarkPage');
  if (el) el.classList.remove('open');
}

function viewInstitutionResults() {
  if (!activeItem) return;
  const tEl = document.getElementById('eduResultsTitle');
  const sEl = document.getElementById('eduResultsSub');
  if (tEl) tEl.innerText = activeItem.name || activeItem.name_bn || 'ফলাফল';
  if (sEl) sEl.innerText = 'পাবলিক পরীক্ষার বিগত ফলাফল ও সাফল্যের ইতিহাস';

  const container = document.getElementById('eduResultsListings');
  if (!container) return;
  container.innerHTML = '';

  // ১. EIIN সংগ্রহ ও ক্লিন
  const currentEiin = toEnDigits(activeItem.eiin || activeItem.code || '');

  // ২. ইউনিকোড ও অক্ষর জটিলতা দূর করার সুপার-ক্লিনার
  const getCoreTitle = (str) => {
    return (str || '')
      .toString()
      .toLowerCase()
      // বাংলা ও ইংরেজি সাধারণ শব্দ ছাঁটাই
      .replace(/সরকারি|বেসরকারি|কলেজ|স্কুল|মাদরাসা|উচ্চ|বিদ্যালয়|মাধ্যমিক/g, '')
      .replace(/govt|government|college|school|high|madrasah/gi, '')
      .replace(/নারায়নগঞ্জ|নারায়ণগঞ্জ|narayanganj/gi, '')
      // ণ/ন এবং য়/য ইউনিকোড সমতাকরণ
      .replace(/ণ/g, 'ন')
      .replace(/[য়য]/g, 'য')
      .replace(/[\u09BC]/g, '') // নুকতা বাদ দেওয়া
      .replace(/[\s\-_.,()]/g, '')
      .trim();
  };

  const currentCoreName = getCoreTitle(activeItem.name || activeItem.name_bn || '');
  const isCommerceTarget = currentCoreName.includes('কমার্') || (activeItem.name_en || '').toLowerCase().includes('commerce');

  // ৩. ফিল্টারিং ইঞ্জিন
  const matchedResults = (resultsData || []).filter(r => {
    if (!r) return false;

    // ক. EIIN দিয়ে নিখুঁত ম্যাচ (উভয় শিটে থাকলে)
    const rowEiin = toEnDigits(r.eiin || r.code || r.eiin_number || '');
    if (currentEiin && rowEiin && currentEiin === rowEiin) {
      return true;
    }

    // খ. প্রতিষ্ঠান নামের ফিল্ড রিড (institution, name, college, institute ইত্যাদি)
    const rowRawName = r.institution || r.name || r.college || r.institute || r.institution_name || '';
    const rowCoreName = getCoreTitle(rowRawName);
    const rowLower = rowRawName.toLowerCase();

    // গ. কমার্স কলেজের বিশেষ বাংলা-ইংরেজি ক্রস-চেক
    if (isCommerceTarget && (rowLower.includes('commerce') || rowCoreName.includes('কমার্'))) {
      return true;
    }

    // ঘ. সাধারণ নাম ম্যাচিং
    if (currentCoreName && rowCoreName) {
      if (rowCoreName.includes(currentCoreName) || currentCoreName.includes(rowCoreName)) {
        return true;
      }
    }

    return false;
  });

  // ৪. রেন্ডারিং বা লাইভ ডায়াগনস্টিক রিপোর্ট
  if (matchedResults.length === 0) {
    const sampleResults = (resultsData || []).slice(0, 3).map(r => r.institution || r.name || 'নাম নেই').join(', ');
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px 16px;">
        <i class="fa-solid fa-folder-open" style="font-size: 38px; color: #CBD5E1; margin-bottom: 12px;"></i>
        <p style="font-weight: 600; color: #334155;">এই প্রতিষ্ঠানের কোনো ফলাফল এখনো যুক্ত করা হয়নি।</p>
        
        <!-- লাইভ ডায়াগনস্টিক তথ্য (সমস্যা শনাক্ত করার জন্য) -->
        <div style="margin-top: 20px; text-align: left; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 12px; font-size: 11px; color: #64748B; line-height: 1.6;">
          <div style="font-weight: 700; color: #DC2626; margin-bottom: 4px;"><i class="fa-solid fa-bug"></i> ডেটা ট্রেসার:</div>
          <div>• অ্যাপ যা খুঁজছে: <strong>${activeItem.name || activeItem.name_bn || 'নাম নেই'}</strong></div>
          <div>• শিট থেকে পাওয়া EIIN: <strong>${currentEiin || 'খালি (পায়নি)'}</strong></div>
          <div>• Results শিটে মোট রো আছে: <strong>${resultsData.length}টি</strong></div>
          <div>• Results শিটের প্রথম ৩টি নাম: <strong>${sampleResults || 'শিট খালি'}</strong></div>
        </div>
      </div>
    `;
  } else {
    matchedResults.forEach(r => {
      const card = document.createElement('div');
      card.style.cssText = "background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
          <div style="font-weight: 700; font-size: 16px; color: #0F5132;">
            <i class="fa-solid fa-calendar-check" style="color: #16A34A;"></i> ${r.exam || 'HSC'} ${r.year || ''}
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 2px 10px; border-radius: 20px;">
            পাস: ${r.pass_rate || '-'}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-top: 4px;">
          <div style="background: #F8FAFC; padding: 8px 4px; border-radius: 8px; border: 1px solid #E2E8F0;"><div style="font-size: 11px; color: var(--text-muted);">মোট পরীক্ষার্থী</div><div style="font-weight: 700; font-size: 14px;">${r.appeared || '-'}</div></div>
          <div style="background: #F0FDF4; padding: 8px 4px; border-radius: 8px; border: 1px solid #BBF7D0;"><div style="font-size: 11px; color: #166534;">উত্তীর্ণ</div><div style="font-weight: 700; font-size: 14px; color: #166534;">${r.passed || '-'}</div></div>
          <div style="background: #FFFBEB; padding: 8px 4px; border-radius: 8px; border: 1px solid #FDE68A;"><div style="font-size: 11px; color: #B45309;">জিপিএ-৫</div><div style="font-weight: 700; font-size: 14px; color: #B45309;">${r.gpa5 || '-'}</div></div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  const rPage = document.getElementById('eduResultsPage');
  if (rPage) {
    rPage.classList.add('open');
    rPage.scrollTop = 0;
    window.history.pushState({ page: 'eduResults' }, '');
  }
}

function viewIspPackages() {
  if (!activeItem) return;
  const tEl = document.getElementById('ispPackagesTitle');
  const sEl = document.getElementById('ispPackagesSub');
  if (tEl) tEl.innerText = activeItem.name || 'প্যাকেজ তালিকা';
  if (sEl) sEl.innerText = 'গতি, মাসিক চার্জ ও বিশেষ সুবিধাসমূহ';

  const container = document.getElementById('ispPackagesListings');
  if (!container) return;
  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 0;"><i class="fa-solid fa-spinner fa-spin"></i> প্যাকেজ খোঁজা হচ্ছে...</div>';

  const currentCode = toEnDigits(activeItem.code || activeItem.id || '').toUpperCase();
  const currentCoreName = (activeItem.name || activeItem.name_bn || '').toLowerCase().replace(/ইন্টারনেট|ব্রডব্যান্ড|আইএসপি|নেটওয়ার্ক|লিমিটেড|প্রাঃ|isp|net|internet|broadband/gi, '').trim();

  const matchedPackages = (packagesData || []).filter(pkg => {
    if (!pkg) return false;
    const pCode = toEnDigits(pkg.code || pkg.isp_code || pkg.isp_id || '').toUpperCase();
    if (currentCode && pCode && currentCode === pCode) return true;

    const pProvider = (pkg.provider || pkg.isp || pkg.institution || pkg.name || '').toLowerCase().replace(/ইন্টারনেট|ব্রডব্যান্ড|আইএসপি|নেটওয়ার্ক|লিমিটেড|প্রাঃ|isp|net|internet|broadband/gi, '').trim();
    if (currentCoreName && pProvider) {
      return pProvider.includes(currentCoreName) || currentCoreName.includes(pProvider);
    }
    return false;
  });

  if (matchedPackages.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
        <i class="fa-solid fa-wifi" style="font-size: 38px; color: #CBD5E1; margin-bottom: 12px;"></i>
        <p style="font-weight: 600; color: #334155;">এই আইএসপি'র কোনো প্যাকেজ এখনো যুক্ত করা হয়নি।</p>
        <p style="font-size: 11px; color: #94A3B8; margin-top: 4px;">কোড: ${currentCode || 'নেই'} | মোট প্যাকেজ লোড হয়েছে: ${packagesData.length}টি</p>
      </div>
    `;
  } else {
    container.innerHTML = '';
    matchedPackages.forEach(pkg => {
      const pCard = document.createElement('div');
      pCard.style.cssText = "background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 12px;";
      
      const features = (pkg.features || pkg.facilities || '').split(/[|,]/).map(f => f.trim()).filter(Boolean);

      pCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #1E40AF;">${pkg.package_name || pkg.title || 'ইন্টারনেট প্যাকেজ'}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${pkg.type || 'হোম ব্রডব্যান্ড'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 17px; font-weight: 800; color: #16A34A;">৳ ${pkg.price || '-'}</div>
            <div style="font-size: 10px; color: var(--text-muted);">/ প্রতি মাস</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-top: 4px;">
          <div style="background: #EFF6FF; padding: 8px 4px; border-radius: 8px; border: 1px solid #BFDBFE;">
            <div style="font-size: 10px; color: #1E40AF;">মূল গতি (Bandwidth)</div>
            <div style="font-weight: 800; font-size: 15px; color: #1D4ED8; margin-top: 2px;">${pkg.speed || '-'}</div>
          </div>
          <div style="background: #F0FDF4; padding: 8px 4px; border-radius: 8px; border: 1px solid #BBF7D0;">
            <div style="font-size: 10px; color: #166534;">BDIX গতি</div>
            <div style="font-weight: 700; font-size: 14px; color: #166534; margin-top: 2px;">${pkg.bdix || '১০০ Mbps'}</div>
          </div>
          <div style="background: #FFFBEB; padding: 8px 4px; border-radius: 8px; border: 1px solid #FDE68A;">
            <div style="font-size: 10px; color: #B45309;">ইউটিউব/ক্যাশ</div>
            <div style="font-weight: 700; font-size: 14px; color: #B45309; margin-top: 2px;">${pkg.cache || 'আনলিমিটেড'}</div>
          </div>
        </div>

        ${pkg.free_ott && pkg.free_ott.trim() !== '' ? `
          <div style="background: #FDF2F8; border: 1px solid #FBCFE8; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; color: #9D174D; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-tv" style="color: #DB2777;"></i>
            <span><strong>ফ্রি OTT:</strong> ${pkg.free_ott}</span>
          </div>
        ` : ''}

        ${pkg.free_talktime && pkg.free_talktime.trim() !== '' ? `
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; color: #065F46; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-phone-volume" style="color: #059669;"></i>
            <span><strong>ফ্রি টকটাইম:</strong> ${pkg.free_talktime}</span>
          </div>
        ` : ''}

        ${features.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
            ${features.map(f => `<span style="font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; color: #475569; padding: 3px 8px; border-radius: 6px;"><i class="fa-solid fa-check" style="color: #16A34A; font-size: 10px; margin-right: 4px;"></i>${f}</span>`).join('')}
          </div>
        ` : ''}
      `;
      container.appendChild(pCard);
    });
  }

  const pPage = document.getElementById('ispPackagesPage');
  if (pPage) {
    pPage.classList.add('open');
    pPage.scrollTop = 0;
    window.history.pushState({ page: 'ispPackages' }, '');
  }
}

function closeIspPackages() {
  const el = document.getElementById('ispPackagesPage');
  if (el) el.classList.remove('open');
}

function closeInstitutionResults() {
  const el = document.getElementById('eduResultsPage');
  if (el) el.classList.remove('open');
}

function openSubmitForm() {
  window.open("https://forms.gle/sample", '_blank');
}

function goHome() {
  closeMfsLimit();
  closeCareCenters();
  closeMfsCalculator();
  closeInstitutionResults();
  closeDetails();
  closeDoctorProfile();
  closeDoctorPage();
  closeBookmarkPage();
  closeCategoryPage();
  closeIspPackages();
  closeMobileCareHub();
}

if (document.getElementById('ispPackagesPage')?.classList.contains('open')) {
    closeIspPackages();
  }

window.onpopstate = function() {
  if (document.getElementById('mobileCareHubPage')?.classList.contains('open')) closeMobileCareHub();
  else if (document.getElementById('mfsLimitPage')?.classList.contains('open')) closeMfsLimit();
  else if (document.getElementById('careCenterPage')?.classList.contains('open')) closeCareCenters();
  else if (document.getElementById('mfsCalculatorPage')?.classList.contains('open')) closeMfsCalculator();
  else if (document.getElementById('ispPackagesPage')?.classList.contains('open')) closeIspPackages();
  else if (document.getElementById('eduResultsPage')?.classList.contains('open')) closeInstitutionResults();
  else if (document.getElementById('doctorProfileView')?.classList.contains('open')) closeDoctorProfile();
  else if (document.getElementById('doctorPage')?.classList.contains('open')) closeDoctorPage();
  else if (document.getElementById('detailsView')?.classList.contains('open')) closeDetails();
  else if (document.getElementById('bookmarkPage')?.classList.contains('open')) closeBookmarkPage();
  else if (document.getElementById('categoryPage')?.classList.contains('open')) closeCategoryPage();
};

function shareDoctor() {
  if (navigator.share && activeDoctor) {
    navigator.share({
      title: activeDoctor.name,
      text: `${activeDoctor.name} - ${activeDoctor.specialty} (${activeDoctor.chamber}, নারায়ণগঞ্জ)। সিরিয়াল: ${activeDoctor.serial_phone}`,
      url: window.location.href,
    }).catch(() => {});
  } else {
    alert('ডাক্তারের তথ্য কপি করা হয়েছে!');
  }
}

function shareItem() {
  if (navigator.share && activeItem) {
    navigator.share({
      title: activeItem.name,
      text: `${activeItem.name} - ${activeItem.area}, নারায়ণগঞ্জ। ফোন: ${activeItem.phone}`,
      url: window.location.href,
    }).catch(() => {});
  } else {
    alert('লিংক কপি করা হয়েছে!');
  }
}

function toBanglaNumber(num) {
  const bn = {'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'};
  return num.toString().replace(/\d/g, d => bn[d]);
}

function renderTriviaSlider(rawTrivia) {
  const triviaBox = document.getElementById('eduTriviaBox');
  const track = document.getElementById('triviaTrack');
  const dotsContainer = document.getElementById('triviaDots');
  if (!triviaBox || !track || !dotsContainer) return;
  if (!rawTrivia || rawTrivia.trim() === '') {
    triviaBox.style.display = 'none';
    return;
  }

  const facts = rawTrivia.split('|').map(f => f.trim()).filter(Boolean);
  totalTriviaSlides = facts.length;
  currentTriviaIndex = 0;
  track.style.transform = 'translateX(0%)';
  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  if (totalTriviaSlides === 0) {
    triviaBox.style.display = 'none';
    return;
  }

  facts.forEach((fact, idx) => {
    let title = `তথ্য #${toBanglaNumber(idx + 1)}`;
    let desc = fact;
    if (fact.includes(':')) {
      const parts = fact.split(':');
      title = parts[0].replace(/^[•\-\*]\s*/, '').trim();
      desc = parts.slice(1).join(':').trim();
    } else {
      desc = fact.replace(/^[•\-\*]\s*/, '').trim();
    }

    const slide = document.createElement('div');
    slide.style.cssText = "min-width: 100%; box-sizing: border-box; padding: 2px;";
    slide.innerHTML = `
      <div style="background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 8px;">
          <div style="width: 22px; height: 22px; border-radius: 50%; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;"><i class="fa-solid fa-bookmark"></i></div>
          <span style="font-weight: 700; font-size: 13px; color: #92400E;">${title}</span>
        </div>
        <div style="font-size: 12px; color: #451A03; line-height: 1.5;">${desc}</div>
      </div>
    `;
    track.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = 't-dot';
    dot.style.cssText = `height: 6px; width: ${idx === 0 ? '14px' : '6px'}; border-radius: 10px; background: ${idx === 0 ? '#F59E0B' : '#FDE68A'}; transition: all 0.25s ease;`;
    dotsContainer.appendChild(dot);
  });

  let touchStartX = 0;
  track.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
  track.ontouchend = (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) slideTrivia(diff > 0 ? 1 : -1);
  };
  triviaBox.style.display = 'block';
}

function slideTrivia(direction) {
  const track = document.getElementById('triviaTrack');
  const dotsContainer = document.getElementById('triviaDots');
  if (!track || totalTriviaSlides <= 1) return;
  currentTriviaIndex += direction;
  if (currentTriviaIndex < 0) currentTriviaIndex = totalTriviaSlides - 1;
  if (currentTriviaIndex >= totalTriviaSlides) currentTriviaIndex = 0;
  track.style.transform = `translateX(-${currentTriviaIndex * 100}%)`;

  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.t-dot');
    dots.forEach((dot, idx) => {
      dot.style.background = (idx === currentTriviaIndex) ? '#F59E0B' : '#FDE68A';
      dot.style.width = (idx === currentTriviaIndex) ? '14px' : '6px';
    });
  }
}

async function fetchLiveNews(feedUrl) {
  const container = document.getElementById('newspaperFeedList');
  if (!container) return;
  container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;"><i class="fa-solid fa-spinner fa-spin"></i> সর্বশেষ সংবাদ লোড হচ্ছে...</div>';
  const cleanUrl = feedUrl.trim();
  let newsList = [];

  try {
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`);
    const xmlText = await res.text();
    const xmlDoc = (new DOMParser()).parseFromString(xmlText, "text/xml");
    const items = xmlDoc.querySelectorAll("item");
    if (items && items.length > 0) {
      items.forEach((it, idx) => {
        if (idx < 5) {
          const title = it.querySelector("title")?.textContent?.trim() || '';
          const link = it.querySelector("link")?.textContent?.trim() || cleanUrl;
          if (title) newsList.push({ title, link });
        }
      });
    }
  } catch (e) {}

  if (newsList.length > 0) {
    container.innerHTML = '';
    newsList.forEach(news => {
      const item = document.createElement('a');
      item.className = 'news-feed-item';
      item.href = news.link;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
      item.innerHTML = `<i class="fa-solid fa-circle-dot"></i><div class="news-feed-title">${news.title}</div>`;
      container.appendChild(item);
    });
  } else {
    const mainSiteUrl = cleanUrl.replace(/\/feed\/?$/i, '');
    container.innerHTML = `
      <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">পত্রিকার সার্ভার সুরক্ষার কারণে লাইভ হেডলাইন পেতে সমস্যা হচ্ছে।</div>
        <a href="${mainSiteUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-call" style="font-size: 12px; padding: 7px 14px; width: fit-content; margin: 0 auto; border-radius: 6px;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> সরাসরি ওয়েবসাইটে খবর পড়ুন
        </a>
      </div>
    `;
  }
}

function updateCategoryCounts() {
  const eduCount = educationData.length;
  const eduSub = document.getElementById('countSubEdu');
  if (eduSub && eduCount > 0) eduSub.innerText = `${toBanglaNumber(eduCount)}+ স্কুল ও কলেজ`;

  const docCount = doctorsData.length;
  const docSub = document.getElementById('countSubDoctors');
  if (docSub && docCount > 0) docSub.innerText = `${toBanglaNumber(docCount)}+ বিশেষজ্ঞ চিকিৎসক`;

  const healthSource = healthData.length > 0 ? healthData : placesData;

  const pvtHospCount = healthSource.filter(p => {
    const c = (p.category || '').trim();
    return c === 'বেসরকারি হাসপাতাল' || c === 'হাসপাতাল';
  }).length;
  const pvtSub = document.getElementById('countSubPvtHosp');
  if (pvtSub && pvtHospCount > 0) pvtSub.innerText = `${toBanglaNumber(pvtHospCount)}+ ক্লিনিক ও সেবা`;

  const diagCount = healthSource.filter(p => (p.category || '').includes('ডায়াগনস্টিক')).length;
  const diagSub = document.getElementById('countSubDiag');
  if (diagSub && diagCount > 0) diagSub.innerText = `${toBanglaNumber(diagCount)}+ টেস্ট ল্যাব`;

  const dentalCount = healthSource.filter(p => (p.category || '').includes('ডেন্টাল')).length;
  const dentalSub = document.getElementById('countSubDental');
  if (dentalSub && dentalCount > 0) dentalSub.innerText = `${toBanglaNumber(dentalCount)}+ ডেন্টাল কেয়ার`;

  const restCount = restaurantsData.length;
  const restSub = document.getElementById('countSubFood');
  if (restSub && restCount > 0) restSub.innerText = `${toBanglaNumber(restCount)}+ রেস্তোরাঁ ও ক্যাফে`;
}

let currentOfferTypeFilter = 'সব';
let currentActiveOperatorCode = '';

function renderTelecomOffersTable(opCode) {
  currentActiveOperatorCode = (opCode || '').toString().toUpperCase().trim();
  const tbody = document.getElementById('telOffersTableBody');
  const noOffers = document.getElementById('telNoOffersMsg');
  const countBadge = document.getElementById('telOffersCountBadge');
  if (!tbody) return;
  tbody.innerHTML = '';

  // সংশ্লিষ্ট অপারেটরের অফারগুলো ফিল্টার
  const opOffers = (rechargeOffersData || []).filter(o => {
    if (!o) return false;
    const target = (o.operator_code || o.operator || '').toString().toUpperCase().trim();
    return target.includes(currentActiveOperatorCode) || currentActiveOperatorCode.includes(target);
  });

  const filtered = opOffers.filter(o => {
    if (currentOfferTypeFilter === 'সব') return true;

    // শিট থেকে যেকোনো ফরমেটে মিনিট ও এমবি রিড করা
    const minVal = (o.minute || o.Minute || o.min || '').toString().trim();
    const dataVal = (o.data_mb || o.mb || o.MB || o.data || o.internet || '').toString().trim();
    const explicitType = (o.offer_type || o.type || o.Type || '').toString().trim();

    const hasMin = minVal !== '' && minVal !== '-';
    const hasData = dataVal !== '' && dataVal !== '-';

    if (currentOfferTypeFilter === 'মিনিট') {
      return explicitType === 'মিনিট' || (hasMin && !hasData);
    } else if (currentOfferTypeFilter === 'ইন্টারনেট') {
      return explicitType === 'ইন্টারনেট' || (!hasMin && hasData);
    } else if (currentOfferTypeFilter === 'বান্ডেল') {
      return explicitType === 'বান্ডেল' || (hasMin && hasData);
    }
    return true;
  });

  if (countBadge) countBadge.innerText = `${toBanglaNumber(filtered.length)}টি অফার`;

  if (filtered.length === 0) {
    if (noOffers) noOffers.style.display = 'block';
    return;
  }
  if (noOffers) noOffers.style.display = 'none';

  filtered.forEach((offer, idx) => {
    const row = document.createElement('tr');
    row.style.cssText = `border-bottom: 1px solid #E2E8F0; background: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};`;
    
    // মিনিট (যেকোনো ফরম্যাট সাপোর্ট)
    const rawMin = (offer.minute || offer.Minute || offer.min || '').toString().trim();
    let minText = '-';
    if (rawMin !== '' && rawMin !== '-') {
      minText = `${toBanglaNumber(rawMin)} মি.`;
    }

    // ইন্টারনেট (যেকোনো ফরম্যাট সাপোর্ট)
    const rawData = (offer.data_mb || offer.mb || offer.MB || offer.data || offer.internet || '').toString().trim();
    let dataText = '-';
    if (rawData !== '' && rawData !== '-') {
      dataText = rawData;
    }

    // মেয়াদ
    const daysVal = offer.days || offer.Day || offer.day || offer.validity_day || '১';
    const daysText = `${toBanglaNumber(daysVal)} দিন`;

    const rechargeVal = offer.recharge || offer.amount || offer.price || '0';

    row.innerHTML = `
      <td style="padding: 9px 6px; font-weight: 700; color: #16A34A; font-size: 13px; white-space: nowrap;">৳ ${toBanglaNumber(rechargeVal)}</td>
      <td style="padding: 9px 6px; font-weight: 600; color: #1E293B;">${minText}</td>
      <td style="padding: 9px 6px; font-weight: 600; color: #0284C7;">${dataText}</td>
      <td style="padding: 9px 6px; text-align: right; color: #475569; font-weight: 600; white-space: nowrap;">${daysText}</td>
    `;
    tbody.appendChild(row);
  });
}

function filterTelecomOffers(filterType, chipEl) {
  currentOfferTypeFilter = filterType;
  const bar = document.getElementById('telOfferTypeFilters');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');
  }
  renderTelecomOffersTable(currentActiveOperatorCode);
}

function viewTelecomCare() {
  if (!activeItem) return;
  // ক্যাটাগরি পেজে নিয়ে গিয়ে সরাসরি চাষাড়ার কাস্টমার সেন্টারের তালিকা ফিল্টার করবে
  openCategoryPage('টেলিকম', `${activeItem.name}-এর কেয়ার সেন্টার`);
}

function openMfsCalculatorFromProfile() {
  if (!activeItem) {
    if (typeof openMfsCalculator === 'function') openMfsCalculator();
    return;
  }
  const name = (activeItem.name || '').toLowerCase();
  let brand = 'সব';
  if (name.includes('বিকাশ') || name.includes('bkash')) brand = 'bkash';
  else if (name.includes('নগদ') || name.includes('nagad')) brand = 'nagad';
  else if (name.includes('রকেট') || name.includes('rocket')) brand = 'rocket';
  else if (name.includes('উপায়') || name.includes('upay')) brand = 'upay';

  if (typeof openMfsCalculator === 'function') {
    openMfsCalculator(brand);
  }
}

async function loadData() {
  try {
    const [pData, hData, dData, rData, eData, restData, aData, pkgData, tData, telData, offData, scData] = await Promise.all([
      fetch(API_PLACES).then(r => r.json()).catch(() => []),
      fetch(API_HEALTH).then(r => r.json()).catch(() => []),
      fetch(API_DOCTORS).then(r => r.json()).catch(() => []),
      fetch(API_RESULTS).then(r => r.json()).catch(() => []),
      fetch(API_EDUCATION).then(r => r.json()).catch(() => []),
      fetch(API_RESTAURANTS).then(r => r.json()).catch(() => []),
      fetch(API_ADMIN).then(r => r.json()).catch(() => []),
      fetch(API_PACKAGES).then(r => r.json()).catch(() => []),
      fetch(API_TRANSPORT).then(r => r.json()).catch(() => []),
      fetch(API_TELECOM).then(r => r.json()).catch(() => []),
      fetch(API_OFFERS).then(r => r.json()).catch(() => []),
	  fetch(API_SERVICE_CENTERS).then(r => r.json()).catch(() => [])
    ]);

    placesData = Array.isArray(pData) ? organizeListings(pData) : [];
    healthData = Array.isArray(hData) ? organizeListings(hData) : [];
    doctorsData = Array.isArray(dData) ? organizeListings(dData) : [];
    resultsData = Array.isArray(rData) ? rData : [];
    educationData = Array.isArray(eData) ? organizeListings(eData.map(normalizeEducationItem)) : [];
    restaurantsData = Array.isArray(restData) ? organizeListings(restData.map(normalizeRestaurantItem)) : [];
    adminData = Array.isArray(aData) ? organizeListings(aData.map(normalizeAdminItem)) : [];
    packagesData = Array.isArray(pkgData) ? pkgData : [];
    transportData = Array.isArray(tData) ? organizeListings(tData.map(normalizeTransportItem)) : [];
    telecomData = Array.isArray(telData) ? organizeListings(telData) : [];
    rechargeOffersData = Array.isArray(offData) ? offData : [];
	serviceCentersData = Array.isArray(scData) ? scData : [];

    updateCategoryCounts();
  } catch (err) {
    console.warn("ডাটা লোড হতে সমস্যা হয়েছে:", err);
  }
}

// ১. স্মার্ট অ্যাকর্ডিয়ন রেন্ডারার
function renderMfsAccordion(rawServices) {
  const box = document.getElementById('mfsServicesBox');
  const container = document.getElementById('mfsAccordionList');
  if (!box || !container) return;

  if (!rawServices || rawServices.trim() === '') {
    box.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  const entries = rawServices.split(/[|\n]/).map(l => l.trim()).filter(Boolean);
  let currentItem = null;
  let currentContent = [];

  function flushCurrent() {
    if (currentItem) {
      currentItem.querySelector('.accordion-content').innerHTML = currentContent.map(c => `
        <div class="accordion-point-card">
          <i class="fa-solid fa-circle-check" style="color: #0284C7; font-size: 12px; margin-top: 3px; flex-shrink: 0;"></i>
          <span>${c}</span>
        </div>
      `).join('');
      container.appendChild(currentItem);
    }
  }

  entries.forEach(line => {
    if (line.startsWith('##') || line.startsWith('#')) {
      flushCurrent();
      currentContent = [];

      let title = line.replace(/^[#\s]+/, '').trim();
      let badgeText = '';
      const match = title.match(/\[(.*?)\]/);
      if (match) {
        badgeText = match[1].trim();
        title = title.replace(/\[.*?\]/, '').trim();
      }

      currentItem = document.createElement('div');
      currentItem.className = 'accordion-item';
      currentItem.innerHTML = `
        <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
          <div class="accordion-title-box">
            <span>${title}</span>
            ${badgeText ? `<span class="accordion-badge">${badgeText}</span>` : ''}
          </div>
          <i class="fa-solid fa-chevron-down accordion-arrow"></i>
        </div>
        <div class="accordion-content"></div>
      `;
    } else if (currentItem) {
      const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
      if (cleanLine) currentContent.push(cleanLine);
    }
  });
  flushCurrent();

  box.style.display = container.children.length > 0 ? 'block' : 'none';
}

// ২. কাস্টমার কেয়ার পেজ খোলা (শিট থেকে অটো ফিল্টার)
function viewCareCenters() {
  if (!activeItem) return;
  const code = (activeItem.code || activeItem.name || '').toUpperCase();
  let brand = 'BKASH';
  if (code.includes('NAGAD') || activeItem.name.includes('নগদ')) brand = 'NAGAD';
  else if (code.includes('ROCKET') || activeItem.name.includes('রকেট')) brand = 'ROCKET';
  else if (code.includes('UPAY') || activeItem.name.includes('উপায়')) brand = 'UPAY';
  else if (code.includes('GP') || activeItem.name.includes('গ্রামীণফোন')) brand = 'GP';
  else if (code.includes('BANGLALINK') || activeItem.name.includes('বাংলালিংক')) brand = 'BANGLALINK';
  else if (code.includes('ROBI') || activeItem.name.includes('রবি')) brand = 'ROBI';
  else if (code.includes('AIRTEL') || activeItem.name.includes('এয়ারটেল')) brand = 'AIRTEL';
  else if (code.includes('TELETALK') || activeItem.name.includes('টেলিটক')) brand = 'TELETALK';

  openServiceCenterFiltered(null, null, brand, `${activeItem.name}-এর কেয়ার পয়েন্ট`);
}

function closeCareCenters() {
  const p = document.getElementById('careCenterPage');
  if (p) p.classList.remove('open');
}

// ১. হাব পেজ খোলা ও বন্ধ
function openMobileCareHub() {
  const p = document.getElementById('mobileCareHubPage');
  if (p) {
    p.classList.add('open');
    p.scrollTop = 0;
    window.history.pushState({ page: 'mobileHub' }, '');
  }
}

function closeMobileCareHub() {
  const p = document.getElementById('mobileCareHubPage');
  if (p) p.classList.remove('open');
}

// ২. ফিল্টার অনুযায়ী সার্ভিস সেন্টার রেজাল্ট প্রদর্শন
function openServiceCenterFiltered(targetCat = null, targetType = null, targetBrand = null, pageTitle = 'সার্ভিস সেন্টার') {
  const tEl = document.getElementById('carePageTitle');
  const sEl = document.getElementById('carePageSub');
  const container = document.getElementById('careCenterListings');
  if (!container) return;

  if (tEl) tEl.innerText = pageTitle;
  if (sEl) sEl.innerText = 'নারায়ণগঞ্জ ও চাষাড়ার অনুমোদিত শাখা';
  container.innerHTML = '';

  // ServiceCenters শিট থেকে ফিল্টার করা
  const matched = (serviceCentersData || []).filter(item => {
    if (!item) return false;
    const cat = (item.category || '').trim();
    const type = (item.type || '').trim();
    const brand = (item.brand_code || '').toUpperCase().trim();

    let matchC = targetCat ? cat.includes(targetCat) : true;
    let matchT = targetType ? type.includes(targetType) : true;
    let matchB = targetBrand ? brand.includes(targetBrand.toUpperCase()) : true;

    return matchC && matchT && matchB;
  });

  if (matched.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">কোনো সার্ভিস সেন্টারের তথ্য পাওয়া যায়নি।</div>`;
  } else {
    matched.forEach(sc => {
      const card = document.createElement('div');
      card.style.cssText = "background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 12px;";
      
      const isOfficial = (sc.type || '').includes('অফিসিয়াল');
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
          <div>
            <div style="font-weight: 700; font-size: 15px; color: #0F172A;">${sc.name}</div>
            <span style="font-size: 10.5px; background: ${isOfficial ? '#DCFCE7' : '#EFF6FF'}; color: ${isOfficial ? '#166534' : '#1D4ED8'}; padding: 2px 8px; border-radius: 6px; font-weight: 700; display: inline-block; margin-top: 4px;">
              ${sc.type || 'সার্ভিস সেন্টার'}
            </span>
          </div>
        </div>

        <div style="font-size: 12.5px; color: #475569; margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          <div><i class="fa-solid fa-location-dot" style="color: var(--primary); width: 14px;"></i> <strong>ঠিকানা:</strong> ${sc.address || sc.area || 'নারায়ণগঞ্জ'}</div>
          <div><i class="fa-solid fa-clock" style="color: var(--primary); width: 14px;"></i> <strong>সময়:</strong> ${sc.timing || 'সকাল ১০টা - রাত ৮টা'}</div>
          ${sc.services ? `<div><i class="fa-solid fa-wrench" style="color: #D97706; width: 14px;"></i> <strong>সেবা:</strong> ${sc.services}</div>` : ''}
        </div>

        <div class="action-buttons" style="margin-top: 10px;">
          <a href="${sc.phone ? 'tel:' + sc.phone : '#'}" class="btn-action btn-call" style="padding: 8px 0; font-size: 13px;">
            <i class="fa-solid fa-phone"></i> কল করুন
          </a>
          <a href="${sc.map_url || `https://maps.google.com/?q=${encodeURIComponent(sc.name + ' ' + (sc.area || 'নারায়ণগঞ্জ'))}`}" target="_blank" rel="noopener noreferrer" class="btn-action btn-map" style="padding: 8px 0; font-size: 13px;">
            <i class="fa-solid fa-diamond-turn-right"></i> গুগল ম্যাপ
          </a>
        </div>
      `;
      container.appendChild(card);
    });
  }

  const p = document.getElementById('careCenterPage');
  if (p) {
    p.classList.add('open');
    p.scrollTop = 0;
    window.history.pushState({ page: 'careCenters' }, '');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const catInput = document.getElementById('catSearchInput');
  if (catInput) catInput.addEventListener('input', renderCategoryItems);

  const docInput = document.getElementById('docSearchInput');
  if (docInput) docInput.addEventListener('input', renderDoctorItems);

  const homeInput = document.getElementById('homeSearchInput');
  if (homeInput) {
    homeInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val !== '') {
        openCategoryPage('সব', `"${val}" এর অনুসন্ধানের ফলাফল`);
        const catSearch = document.getElementById('catSearchInput');
        if (catSearch) {
          catSearch.value = val;
          renderCategoryItems();
        }
      }
    });
  }

  loadData();
});