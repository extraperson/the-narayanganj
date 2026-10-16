const SHEET_ID = "1ctXswktft11lTCw_TiTbwoF2jgmLsHaf4Zno23QImjQ";
const API_PLACES = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;
const API_DOCTORS = `https://opensheet.elk.sh/${SHEET_ID}/Doctors`;
const API_RESULTS = `https://opensheet.elk.sh/${SHEET_ID}/Results`;
const API_EDUCATION = `https://opensheet.elk.sh/${SHEET_ID}/Education`;

let placesData = [];
let doctorsData = [];
let resultsData = [];
let educationData = [];
let currentCategory = 'সব';
let currentChamberFilter = null;
let selectedCatArea = 'সব এলাকা';
let selectedDocArea = 'সব এলাকা';
let selectedDocDept = 'সব বিভাগ';
let activeItem = null;
let activeDoctor = null;

let bookmarks = { places: [], doctors: [] };
try {
  const saved = localStorage.getItem('narayanganj_bookmarks');
  if (saved) bookmarks = JSON.parse(saved);
} catch (e) {
  bookmarks = { places: [], doctors: [] };
}

// ফোন নম্বরের সামনের শূন্য ও ফরম্যাট ঠিক করার হেল্পার
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let str = phone.toString().trim();
  const banglaDigits = {'০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9'};
  str = str.replace(/[০-৯]/g, m => banglaDigits[m]).replace(/[^\d+]/g, '');
  if (str.length === 10 && str.startsWith('1')) {
    str = '0' + str;
  }
  return str;
}

// ব্যানবেইস শিক্ষা প্রতিষ্ঠান ডেটা ম্যাপিং হেল্পার
function normalizeEducationItem(item) {
  const cleanPhone = cleanPhoneNumber(item.mobile || item.phone || item.telephone || '');
  const addr = [item.address, item.mouza, item.post_office ? `${item.post_office} (${item.post_code || ''})` : '']
    .filter(Boolean)
    .join(', ');

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
    departments: item.education_level || item.type_file || '',
    facilities: [
      item.for_whom,
      item.management ? `${item.management} ব্যবস্থাপনা` : '',
      item.english_version === 'হ্যাঁ' ? 'ইংরেজি ভার্সন' : ''
    ].filter(Boolean).join(', '),
    website: item.website || item.source_url || '',
    timing: item.timing || 'খোলা আছে',
    featured: item.featured || ''
  };
}

// র‍্যান্ডমাইজেশন হেল্পার (Fisher-Yates Shuffle Algorithm)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// স্পন্সরড প্রতিষ্ঠানকে উপরে রাখা এবং বাকিদের র‍্যান্ডম করার সাজানো ফাংশন
function organizeListings(dataList) {
  const featured = dataList.filter(item => (item.featured || '').toString().toLowerCase().trim() === 'yes');
  const normal = dataList.filter(item => (item.featured || '').toString().toLowerCase().trim() !== 'yes');
  return [...featured, ...shuffleArray(normal)];
}

function saveBookmarks() {
  try {
    localStorage.setItem('narayanganj_bookmarks', JSON.stringify(bookmarks));
  } catch (e) {}
}

function isItemBookmarked(name) {
  return (bookmarks.places || []).some(p => p.name === name);
}

function isDocBookmarked(name) {
  return (bookmarks.doctors || []).some(d => d.name === name);
}

function updateHeartIcon(btnElement, isActive) {
  if (!btnElement) return;
  if (isActive) {
    btnElement.classList.add('active-heart');
    btnElement.innerHTML = '<i class="fa-solid fa-heart"></i>';
  } else {
    btnElement.classList.remove('active-heart');
    btnElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
  }
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
        <p style="font-size: 12px; margin-top: 4px;">যেকোনো ডাক্তার বা প্রতিষ্ঠানের পেজে গিয়ে হার্ট আইকনে চাপ দিলে এখানে সেভ থাকবে।</p>
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

function openSubmitForm() {
  window.open("https://forms.gle/sample", '_blank');
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

function renderCategoryItems() {
  const container = document.getElementById('categoryListings');
  if (!container) return;
  container.innerHTML = '';

  const input = document.getElementById('catSearchInput');
  const query = input ? input.value.toLowerCase().trim() : '';

  // শিক্ষা প্রতিষ্ঠান হলে Education ট্যাব থেকে ডেটা নেওয়া হবে
  let sourceList = placesData;
  if (currentCategory === 'শিক্ষা প্রতিষ্ঠান') {
    sourceList = educationData.length > 0 ? educationData : placesData;
  } else if (currentCategory === 'সব') {
    sourceList = [...placesData, ...educationData];
  }

  const filtered = (sourceList || []).filter(item => {
    if (!item) return false;
    const itemCat = (item.category || '').trim();
    const itemArea = (item.area || '').toLowerCase();
    const itemAddress = (item.address || '').toLowerCase();
    
    let matchCat = false;
    if (currentCategory === 'সব') {
      matchCat = true;
    } else if (currentCategory === 'সরকারি হাসপাতাল') {
      matchCat = (itemCat === 'সরকারি হাসপাতাল');
    } else if (currentCategory === 'বেসরকারি হাসপাতাল') {
      matchCat = (itemCat === 'বেসরকারি হাসপাতাল' || itemCat === 'হাসপাতাল');
    } else if (currentCategory === 'শিক্ষা প্রতিষ্ঠান') {
      matchCat = (itemCat === 'শিক্ষা প্রতিষ্ঠান' || itemCat === 'স্কুল' || itemCat === 'কলেজ' || itemCat === 'মাদরাসা');
    } else if (currentCategory === 'জেনারেল স্টোর') {
      matchCat = (itemCat === 'জেনারেল স্টোর' || itemCat.includes('স্টোর') || itemCat.includes('মুদি'));
    } else {
      matchCat = itemCat.toLowerCase().includes(currentCategory.toLowerCase());
    }

    let matchArea = (selectedCatArea === 'সব এলাকা');
    if (!matchArea) {
      const targetArea = selectedCatArea.toLowerCase();
      matchArea = itemArea.includes(targetArea) || itemAddress.includes(targetArea);
      if (targetArea === 'চাষাড়া' && (itemArea.includes('সদর') || itemAddress.includes('সদর'))) matchArea = true;
    }

    // ব্যাকগ্রাউন্ড অনুবাদ ও EIIN সার্চ (শুধুমাত্র খাঁটি বাংলা নাম ডিসপ্লে হবে)
    const matchSearch = 
      (item.name || '').toLowerCase().includes(query) ||
      (item.name_en || '').toLowerCase().includes(query) ||
      (item.eiin || '').toString().includes(query) ||
      itemArea.includes(query) ||
      itemAddress.includes(query) ||
      (item.landmark || '').toLowerCase().includes(query);

    return matchCat && matchArea && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">কোনো প্রতিষ্ঠান পাওয়া যায়নি।</div>`;
    return;
  }

  filtered.forEach(item => {
    const name = item.name || 'তথ্য নেই';
    const area = item.area || 'নারায়ণগঞ্জ';
    const rating = item.rating || '৪.০';
    const phone = item.phone || '';
    const isFeatured = (item.featured || '').toString().toLowerCase().trim() === 'yes';
    const mapUrl = item.map_url || `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + area)}`;

    const card = document.createElement('div');
    card.className = 'place-card';
    card.onclick = () => openDetails(item);

    // স্পন্সরড হলে হালকা স্পেশাল বর্ডার
    if (isFeatured) {
      card.style.borderColor = '#F59E0B';
      card.style.background = '#FFFDF5';
    }

    card.innerHTML = `
      <div class="place-header">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <div class="place-title">${name}</div>
            ${item.eiin ? `<span class="eiin-badge" style="font-size: 10px; padding: 1px 6px; border-radius: 4px;">EIIN: ${item.eiin}</span>` : ''}
            ${isFeatured ? '<span style="background: #FEF3C7; color: #B45309; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #FDE68A;"><i class="fa-solid fa-bolt"></i> স্পন্সরড</span>' : ''}
          </div>
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
  });
}

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
    'ডেন্টাল': ['ডেন্টাল', 'দাঁত', 'মুখের রোগ', 'dental', 'দাঁতের']
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
      
      if (keywords.length > 0) {
        matchChamber = keywords.some(kw => chamberText.includes(kw));
      } else {
        matchChamber = chamberText.includes(currentChamberFilter.toLowerCase());
      }
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

// পত্রিকার আরএসএস ফিড থেকে লাইভ হেডলাইন
async function fetchLiveNews(feedUrl) {
  const container = document.getElementById('newspaperFeedList');
  if (!container) return;
  container.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;"><i class="fa-solid fa-spinner fa-spin"></i> সর্বশেষ সংবাদ লোড হচ্ছে...</div>';

  const cleanUrl = feedUrl.trim();
  let newsList = [];

  try {
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`);
    const xmlText = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
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

  if (newsList.length === 0) {
    try {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`);
      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
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
  }

  if (newsList.length > 0) {
    renderNewsItems(container, newsList);
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

function renderNewsItems(container, items) {
  container.innerHTML = '';
  items.forEach(news => {
    const item = document.createElement('a');
    item.className = 'news-feed-item';
    item.href = news.link;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.innerHTML = `
      <i class="fa-solid fa-circle-dot"></i>
      <div class="news-feed-title">${news.title}</div>
    `;
    container.appendChild(item);
  });
}

function openDetails(item) {
  if (!item) return;
  activeItem = item;
  const cat = (item.category || '').trim();
  
  const imgEl = document.getElementById('detailsImg');
  if (imgEl) {
    if (item.image_url && item.image_url.trim() !== '') {
      imgEl.src = item.image_url.trim();
    } else {
      imgEl.src = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80';
    }
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
  if (timeEl) timeEl.innerText = item.timing || 'খোলা আছে';

  const phoneEl = document.getElementById('detailsPhone');
  if (phoneEl) phoneEl.innerText = item.phone || 'নম্বর নেই';

  // EIIN ব্যাজ
  const eiinEl = document.getElementById('detailsEiin');
  if (eiinEl) {
    if (item.eiin && item.eiin.toString().trim() !== '') {
      eiinEl.innerText = `EIIN: ${item.eiin}`;
      eiinEl.style.display = 'inline-block';
    } else {
      eiinEl.style.display = 'none';
    }
  }

  // শয্যা ব্যাজ
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
    
    if (deptsSub) {
      deptsSub.innerText = (cat === 'শিক্ষা প্রতিষ্ঠান' || cat === 'স্কুল' || cat === 'কলেজ' || cat === 'মাদরাসা') 
        ? 'অনুমোদিত অনুষদ, স্তর ও বিভাগ' 
        : 'চিকিৎসা ও ক্লিনিক্যাল শাখাসমূহ';
    }

    const rawDepts = (item.departments || '').trim();
    if (rawDepts) {
      rawDepts.split(',').forEach(dept => {
        const dName = dept.trim();
        if (dName) {
          const badge = document.createElement('span');
          badge.className = 'dept-badge-item';
          badge.innerText = dName;
          deptsList.appendChild(badge);
        }
      });
      deptsBox.style.display = 'block';
    } else {
      deptsBox.style.display = 'none';
    }
  }

  const servicesBox = document.getElementById('hospitalServicesBox');
  const servicesList = document.getElementById('hospitalServicesList');
  if (servicesBox && servicesList) {
    servicesList.innerHTML = '';
    const rawServices = (item.services || item.facilities || '').trim();
    if (rawServices) {
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

  const socialBox = document.getElementById('socialLinksBox');
  const webBtn = document.getElementById('linkWebsite');
  const fbBtn = document.getElementById('linkFacebook');
  const ytBtn = document.getElementById('linkYoutube');
  const liBtn = document.getElementById('linkLinkedin');
  const igBtn = document.getElementById('linkInstagram');

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

  if (socialBox) socialBox.style.display = hasSocial ? 'block' : 'none';

  const feedBox = document.getElementById('newspaperFeedBox');
  if (feedBox) {
    if (item.feed_url && item.feed_url.trim() !== '') {
      feedBox.style.display = 'block';
      fetchLiveNews(item.feed_url.trim());
    } else {
      feedBox.style.display = 'none';
    }
  }
  
  const eduBox = document.getElementById('eduSectionBox');
  if (eduBox) {
    const isEdu = (cat === 'শিক্ষা প্রতিষ্ঠান' || cat === 'স্কুল' || cat === 'কলেজ' || cat === 'মাদরাসা');
    const isNews = (cat === 'সংবাদপত্র');

    if (isEdu || isNews) {
      eduBox.style.display = 'flex';

      const principalCard = document.getElementById('eduPrincipalCard');
      const principalName = document.getElementById('eduPrincipalName');
      const principalLabel = document.getElementById('eduPrincipalLabel');
      const principalIcon = document.getElementById('eduPrincipalIcon');
      const resultsNavCard = eduBox.querySelector('.doc-nav-card');

      // ১. প্রধান ব্যক্তি (অধ্যক্ষ / সম্পাদক) হ্যান্ডলিং
      if (principalCard && principalName) {
        if (item.principal && item.principal.trim() !== '') {
          principalName.innerText = item.principal.trim();
          principalCard.style.display = 'flex';

          if (isNews) {
            if (principalLabel) {
              principalLabel.innerText = 'সম্পাদক ও প্রকাশক';
              principalLabel.style.color = '#0284C7';
            }
            if (principalIcon) {
              principalIcon.innerHTML = '<i class="fa-solid fa-pen-nib"></i>';
              principalIcon.style.background = '#E0F2FE';
              principalIcon.style.color = '#0284C7';
            }
          } else {
            if (principalLabel) {
              principalLabel.innerText = 'বর্তমান অধ্যক্ষ / প্রধান শিক্ষক';
              principalLabel.style.color = '#7C3AED';
            }
            if (principalIcon) {
              principalIcon.innerHTML = '<i class="fa-solid fa-user-tie"></i>';
              principalIcon.style.background = '#EDE9FE';
              principalIcon.style.color = '#7C3AED';
            }
          }
        } else {
          principalCard.style.display = 'none';
        }
      }

      // ২. পরীক্ষার ফলাফল বাটন
      if (resultsNavCard) {
        resultsNavCard.style.display = isEdu ? 'flex' : 'none';
      }

      // ৩. নতুন ফিল্ডসমূহ: প্রাতিষ্ঠানিক তথ্য ও ইমেইল
      const infoGridBox = document.getElementById('eduInfoGridBox');
      const mgtEl = document.getElementById('eduManagement');
      const whomEl = document.getElementById('eduForWhom');
      const dateEl = document.getElementById('eduEstDate');
      const constEl = document.getElementById('eduConstituency');
      const emailRow = document.getElementById('eduEmailRow');
      const emailLink = document.getElementById('eduEmailLink');

      if (infoGridBox) {
        // শুধুমাত্র শিক্ষা প্রতিষ্ঠান হলেই এই ইনফো গ্রিডটি দেখাবে
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

function viewChamberDoctors() {
  if (activeItem) {
    openDoctorList(activeItem.name, `${activeItem.name}-এর ডাক্তারগণ`);
  }
}

function closeDetails() {
  const el = document.getElementById('detailsView');
  if (el) el.classList.remove('open');
}

function goToChamberDetails(chamberName, chamberArea) {
  if (!chamberName) return;

  closeDoctorProfile();
  closeDoctorPage();

  const cleanTarget = chamberName.toLowerCase()
    .replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিঃ|-/g, '')
    .trim();

  let matchedPlace = (placesData || []).find(p => {
    if (!p) return false;
    const pName = (p.name || '').toLowerCase()
      .replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিঃ|-/g, '')
      .trim();
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
        headerRow.onclick = function() {
          goToChamberDetails(ch, area);
        };

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
          <div style="font-size: 13px; color: #475569; margin-top: 4px;">
            <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${area}
          </div>
          <div style="font-size: 13px; color: #475569; margin-top: 2px;">
            <i class="fa-solid fa-clock" style="color: var(--primary);"></i> ${time}
          </div>
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

function viewInstitutionResults() {
  if (!activeItem) return;

  const tEl = document.getElementById('eduResultsTitle');
  const sEl = document.getElementById('eduResultsSub');
  if (tEl) tEl.innerText = activeItem.name || 'ফলাফল';
  if (sEl) sEl.innerText = 'পাবলিক পরীক্ষার বিগত ফলাফল ও সাফল্যের ইতিহাস';

  const container = document.getElementById('eduResultsListings');
  if (!container) return;
  container.innerHTML = '';

  const cleanInst = (activeItem.name || '').toLowerCase().replace(/সরকারি|কলেজ|স্কুল|মাদরাসা/g, '').trim();

  // EIIN অথবা নাম দিয়ে নিখুঁত রেজাল্ট ফিল্টার
  const matchedResults = (resultsData || []).filter(r => {
    if (!r) return false;
    if (activeItem.eiin && r.eiin && r.eiin.toString().trim() === activeItem.eiin.toString().trim()) {
      return true;
    }
    const rInst = (r.institution || '').toLowerCase().replace(/সরকারি|কলেজ|স্কুল|মাদরাসা/g, '').trim();
    return rInst.includes(cleanInst) || cleanInst.includes(rInst);
  });

  if (matchedResults.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
        <i class="fa-solid fa-folder-open" style="font-size: 38px; color: #CBD5E1; margin-bottom: 12px;"></i>
        <p>এই প্রতিষ্ঠানের কোনো ফলাফল এখনো যুক্ত করা হয়নি।</p>
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
          <div style="background: #F8FAFC; padding: 10px 4px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <div style="font-size: 11px; color: var(--text-muted);">মোট পরীক্ষার্থী</div>
            <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-top: 2px;">${r.appeared || '-'}</div>
          </div>
          <div style="background: #F0FDF4; padding: 10px 4px; border-radius: 8px; border: 1px solid #BBF7D0;">
            <div style="font-size: 11px; color: #166534;">উত্তীর্ণ শিক্ষার্থী</div>
            <div style="font-weight: 700; font-size: 15px; color: #166534; margin-top: 2px;">${r.passed || '-'}</div>
          </div>
          <div style="background: #FFFBEB; padding: 10px 4px; border-radius: 8px; border: 1px solid #FDE68A;">
            <div style="font-size: 11px; color: #B45309;">জিপিএ-৫ (A+)</div>
            <div style="font-weight: 700; font-size: 15px; color: #B45309; margin-top: 2px;">${r.gpa5 || '-'}</div>
          </div>
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

function closeInstitutionResults() {
  const el = document.getElementById('eduResultsPage');
  if (el) el.classList.remove('open');
}

function goHome() {
  closeInstitutionResults();
  closeDetails();
  closeDoctorProfile();
  closeDoctorPage();
  closeBookmarkPage();
  closeCategoryPage();
}

window.onpopstate = function() {
  if (document.getElementById('eduResultsPage')?.classList.contains('open')) {
    closeInstitutionResults();
  } else if (document.getElementById('doctorProfileView')?.classList.contains('open')) {
    closeDoctorProfile();
  } else if (document.getElementById('doctorPage')?.classList.contains('open')) {
    closeDoctorPage();
  } else if (document.getElementById('detailsView')?.classList.contains('open')) {
    closeDetails();
  } else if (document.getElementById('bookmarkPage')?.classList.contains('open')) {
    closeBookmarkPage();
  } else if (document.getElementById('categoryPage')?.classList.contains('open')) {
    closeCategoryPage();
  }
};

function shareDoctor() {
  if (navigator.share && activeDoctor) {
    navigator.share({
      title: activeDoctor.name,
      text: `${activeDoctor.name} - ${activeDoctor.specialty} (${activeDoctor.chamber}, নারায়ণগঞ্জ)। সিরিয়াল: ${activeDoctor.serial_phone}`,
      url: window.location.href,
    }).catch(() => {});
  } else {
    alert('লিংক কপি করা হয়েছে!');
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

async function loadData() {
  try {
    const fetchPlaces = fetch(API_PLACES).then(r => r.json()).catch(() => []);
    const fetchDocs = fetch(API_DOCTORS).then(r => r.json()).catch(() => []);
    const fetchResults = fetch(API_RESULTS).then(r => r.json()).catch(() => []);
    const fetchEdu = fetch(API_EDUCATION).then(r => r.json()).catch(() => []);

    const [pData, dData, rData, eData] = await Promise.all([fetchPlaces, fetchDocs, fetchResults, fetchEdu]);
    
    // ডাটা লোড হওয়ার সাথে সাথে স্পন্সরড পিন ও সাধারণগুলো র‍্যান্ডমাইজেশন
    placesData = Array.isArray(pData) ? organizeListings(pData) : [];
    doctorsData = Array.isArray(dData) ? organizeListings(dData) : [];
    resultsData = Array.isArray(rData) ? rData : [];
    educationData = Array.isArray(eData) ? eData.map(normalizeEducationItem) : [];
  } catch (err) {
    console.warn("ডাটা লোড হতে সমস্যা হয়েছে:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const catInput = document.getElementById('catSearchInput');
  if (catInput) catInput.addEventListener('input', renderCategoryItems);

  const docInput = document.getElementById('docSearchInput');
  if (docInput) docInput.addEventListener('input', renderDoctorItems);

  // হোম পেজের সার্চ সক্রিয় করা
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