const SHEET_ID = "1ctXswktft11lTCw_TiTbwoF2jgmLsHaf4Zno23QImjQ";
const API_PLACES = `https://opensheet.elk.sh/${SHEET_ID}/Sheet1`;
const API_DOCTORS = `https://opensheet.elk.sh/${SHEET_ID}/Doctors`;
const API_RESULTS = `https://opensheet.elk.sh/${SHEET_ID}/Results`;

let placesData = [];
let doctorsData = [];
let resultsData = [];
let currentCategory = 'সব';
let currentChamberFilter = null;
let selectedCatArea = 'সব এলাকা';
let selectedDocArea = 'সব এলাকা';
let selectedDocDept = 'সব বিভাগ';
let activeItem = null;
let activeDoctor = null;

let bookmarks = JSON.parse(localStorage.getItem('narayanganj_bookmarks') || '{"places":[], "doctors":[]}');

function saveBookmarks() {
  localStorage.setItem('narayanganj_bookmarks', JSON.stringify(bookmarks));
}

function isItemBookmarked(name) {
  return bookmarks.places.some(p => p.name === name);
}

function isDocBookmarked(name) {
  return bookmarks.doctors.some(d => d.name === name);
}

function updateHeartIcon(btnElement, isActive) {
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
  container.innerHTML = '';

  const total = bookmarks.places.length + bookmarks.doctors.length;
  if (total === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
        <i class="fa-regular fa-bookmark" style="font-size: 38px; color: #CBD5E1; margin-bottom: 12px;"></i>
        <p>আপনার সংরক্ষিত তালিকায় এখনো কিছু নেই।</p>
        <p style="font-size: 12px; margin-top: 4px;">যেকোনো ডাক্তার বা প্রতিষ্ঠানের পেজে গিয়ে হার্ট আইকনে চাপ দিলে এখানে সেভ থাকবে।</p>
      </div>
    `;
  } else {
    if (bookmarks.doctors.length > 0) {
      const docTitle = document.createElement('h4');
      docTitle.innerText = "সংরক্ষিত ডাক্তারগণ";
      docTitle.style.cssText = "font-size: 15px; color: var(--primary); margin: 6px 0 2px;";
      container.appendChild(docTitle);

      bookmarks.doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doctor-card';
        card.onclick = () => openDoctorProfile(doc);
        const firstPhone = (doc.serial_phone || '').split(',')[0].trim();
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="place-title" style="color: #0F5132;">${doc.name}</div>
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

    if (bookmarks.places.length > 0) {
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
              <div class="place-title">${item.name}</div>
              <div class="place-area"><i class="fa-solid fa-location-dot"></i> ${item.area || ''}</div>
            </div>
            <div class="rating-badge"><i class="fa-solid fa-star"></i> ${item.rating || '৪.০'}</div>
          </div>
        `;
        container.appendChild(card);
      });
    }
  }

  document.getElementById('bookmarkPage').classList.add('open');
  window.history.pushState({ page: 'bookmarks' }, '');
}

function closeBookmarkPage() {
  document.getElementById('bookmarkPage').classList.remove('open');
}

function openSubmitForm() {
  const formUrl = "https://forms.gle/sample"; 
  window.open(formUrl, '_blank');
}

function setCategoryAreaFilter(areaName, chipElement) {
  selectedCatArea = areaName;
  const bar = document.getElementById('catAreaFilterBar');
  bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
  chipElement.classList.add('active');
  renderCategoryItems();
}

function setDoctorAreaFilter(areaName, chipElement) {
  selectedDocArea = areaName;
  const bar = document.getElementById('docAreaFilterBar');
  bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
  chipElement.classList.add('active');
  renderDoctorItems();
}

function setDoctorDeptFilter(deptName, chipElement) {
  selectedDocDept = deptName;
  const bar = document.getElementById('docDeptFilterBar');
  if (bar) {
    bar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    chipElement.classList.add('active');
  }
  renderDoctorItems();
}

function openCategoryPage(category, subtitle = '') {
  currentCategory = category;
  document.getElementById('catPageTitle').innerText = category === 'সব' ? 'সকল সেবা ও তথ্য' : category;
  document.getElementById('catPageSub').innerText = subtitle || 'তালিকা থেকে প্রতিষ্ঠান বেছে নিন';
  document.getElementById('catSearchInput').value = '';

  selectedCatArea = 'সব এলাকা';
  const catBar = document.getElementById('catAreaFilterBar');
  if (catBar) {
    catBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    catBar.querySelector('.area-chip').classList.add('active');
  }

  renderCategoryItems();
  document.getElementById('categoryPage').classList.add('open');
  window.history.pushState({ page: 'category' }, '');
}

function closeCategoryPage() {
  document.getElementById('categoryPage').classList.remove('open');
}

// শিটের category কলামের শতভাগ নির্ভুল ফিল্টারিং
function renderCategoryItems() {
  const container = document.getElementById('categoryListings');
  container.innerHTML = '';

  const query = document.getElementById('catSearchInput').value.toLowerCase().trim();

  const filtered = placesData.filter(item => {
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
    const mapUrl = item.map_url || `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + area)}`;

    const card = document.createElement('div');
    card.className = 'place-card';
    card.onclick = () => openDetails(item);

    card.innerHTML = `
      <div class="place-header">
        <div>
          <div class="place-title">${name}</div>
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

document.getElementById('catSearchInput').addEventListener('input', renderCategoryItems);

function openDoctorList(chamberName = null, title = 'বিশেষজ্ঞ ডাক্তারগণ') {
  currentChamberFilter = chamberName;
  document.getElementById('docPageTitle').innerText = chamberName ? chamberName : title;
  document.getElementById('docPageSub').innerText = chamberName ? 'এই সেন্টারের বিশেষজ্ঞ চিকিৎসকগণ' : 'চেম্বার, ভিজিটিং সময় ও সিরিয়াল';
  document.getElementById('docSearchInput').value = '';

  selectedDocArea = 'সব এলাকা';
  const docBar = document.getElementById('docAreaFilterBar');
  if (docBar) {
    docBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    docBar.querySelector('.area-chip').classList.add('active');
    docBar.style.display = chamberName ? 'none' : 'flex';
  }

  selectedDocDept = 'সব বিভাগ';
  const deptBar = document.getElementById('docDeptFilterBar');
  if (deptBar) {
    deptBar.querySelectorAll('.area-chip').forEach(c => c.classList.remove('active'));
    deptBar.querySelector('.area-chip').classList.add('active');
    deptBar.style.display = chamberName ? 'none' : 'flex';
  }

  renderDoctorItems();
  
  const docPage = document.getElementById('doctorPage');
  docPage.classList.add('open');
  docPage.scrollTop = 0;
  window.history.pushState({ page: 'doctors' }, '');
}

function closeDoctorPage() {
  document.getElementById('doctorPage').classList.remove('open');
}

function renderDoctorItems() {
  const container = document.getElementById('doctorListings');
  container.innerHTML = '';

  const query = document.getElementById('docSearchInput').value.toLowerCase().trim();

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

  const filtered = doctorsData.filter(doc => {
    let matchChamber = true;
    if (currentChamberFilter) {
      const target = currentChamberFilter.toLowerCase().replace(/ডায়াগনস্টিক|সেন্টার|হাসপাতাল|\(প্রাঃ\)|\(pvt\.\)|ltd\.|লিঃ/g, '').trim();
      matchChamber = (doc.chamber || '').toLowerCase().includes(target);
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
