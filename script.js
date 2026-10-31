/**
 * Campus Pulse - Student Notice, Deadline & Event Tracker
 * Plain Vanilla JavaScript implementation.
 * Zero external libraries, zero backend, no Firebase.
 * Stores notices entirely in browser localStorage.
 * Strict DOM security: ALL text is rendered via textContent, never innerHTML.
 */

// Local Storage Keys
const STORAGE_KEYS = {
  NOTICES: 'campus_pulse_notices_v1',
  THEME: 'campus_pulse_theme_v1'
};

// Available categories with their associated emoji and style classes
const CATEGORIES = [
  { name: 'All', emoji: '🌐' },
  { 
    name: 'Academic', 
    emoji: '📚', 
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  { 
    name: 'Event', 
    emoji: '🎉', 
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
  },
  { 
    name: 'Deadline', 
    emoji: '⏰', 
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800' 
  },
  { 
    name: 'Club', 
    emoji: '🎭', 
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
  },
  { 
    name: 'Placement', 
    emoji: '💼', 
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800' 
  },
  { 
    name: 'Sports', 
    emoji: '⚽', 
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-200 dark:border-teal-800' 
  },
  { 
    name: 'Other', 
    emoji: '📌', 
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' 
  }
];

// App State
let state = {
  notices: [],
  activeCategory: 'All',
  searchQuery: '',
  currentView: 'list' // 'list' or 'calendar'
};

// DOM Elements Cache
const elements = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeToggleIcon: document.getElementById('themeToggleIcon'),
  themeToggleText: document.getElementById('themeToggleText'),
  noticeInputText: document.getElementById('noticeInputText'),
  clearNoticeBtn: document.getElementById('clearNoticeBtn'),
  extractNoticeBtn: document.getElementById('extractNoticeBtn'),
  extractBtnIcon: document.getElementById('extractBtnIcon'),
  extractBtnText: document.getElementById('extractBtnText'),
  extractionFeedbackContainer: document.getElementById('extractionFeedbackContainer'),
  todayHeading: document.getElementById('today-heading'),
  todayCountBadge: document.getElementById('todayCountBadge'),
  todayContainer: document.getElementById('todayContainer'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  categoryChipsContainer: document.getElementById('categoryChipsContainer'),
  listViewBtn: document.getElementById('listViewBtn'),
  calendarViewBtn: document.getElementById('calendarViewBtn'),
  listViewSection: document.getElementById('listViewSection'),
  calendarViewSection: document.getElementById('calendarViewSection'),
  backToListBtn: document.getElementById('backToListBtn'),
  totalNoticesCount: document.getElementById('totalNoticesCount'),
  activeFilterBadge: document.getElementById('activeFilterBadge'),
  noticeCardsContainer: document.getElementById('noticeCardsContainer'),
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// Date Helpers
// ==========================================

/**
 * Returns an ISO date string (YYYY-MM-DD) shifted by a relative number of days.
 */
function getOffsetDateISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) based on local client time.
 */
function getTodayISO() {
  return getOffsetDateISO(0);
}

/**
 * Formats an ISO date into a student-friendly relative or calendar string.
 */
function formatReadableDate(isoDateString) {
  if (!isoDateString) return '';
  const parts = isoDateString.split('-');
  if (parts.length !== 3) return isoDateString;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const targetDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetMidnight = new Date(year, month, day);
  targetMidnight.setHours(0, 0, 0, 0);

  const diffTime = targetMidnight.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = monthNames[month];

  if (diffDays === 0) {
    return `Today (${monthStr} ${day})`;
  } else if (diffDays === 1) {
    return `Tomorrow (${monthStr} ${day})`;
  } else if (diffDays === -1) {
    return `Yesterday (${monthStr} ${day})`;
  } else if (diffDays > 1 && diffDays <= 7) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `In ${diffDays} days (${daysOfWeek[targetDate.getDay()]}, ${monthStr} ${day})`;
  } else if (diffDays < -1) {
    return `${monthStr} ${day}, ${year} (Past)`;
  }
  return `${monthStr} ${day}, ${year}`;
}

/**
 * Blocks duplicates: checks if another notice has the exact same title & date.
 */
function isDuplicateNotice(title, date) {
  const normTitle = (title || '').trim().toLowerCase();
  const normDate = (date || '').trim();
  return state.notices.some(n => 
    (n.title || '').trim().toLowerCase() === normTitle &&
    (n.date || '').trim() === normDate
  );
}

// ==========================================
// Preloaded Initial Samples
// Format: {id, title, date (ISO), time, venue, category, description}
// ==========================================

/**
 * 6 realistic sample notices with relative dates (today, soon, past).
 */
function generateSampleNotices() {
  return [
    {
      id: 'sample-notice-1',
      title: 'CS302 Algorithm Lab Record Submission',
      date: getOffsetDateISO(0), // Today
      time: '04:30 PM',
      venue: 'Turing Computer Lab (Room 304)',
      category: 'Deadline',
      description: 'Final submission deadline for verified hard-copy lab record books with faculty sign-off. Late submissions will attract a 10% grade penalty.'
    },
    {
      id: 'sample-notice-2',
      title: 'Robotics Club Orientation & Drone Showcase',
      date: getOffsetDateISO(0), // Today
      time: '05:30 PM',
      venue: 'Student Activity Center (SAC) Hall 2',
      category: 'Club',
      description: 'Welcome orientation for freshmen and sophomores. Live drone obstacle race demo, battle bot showcase, and subsystem team recruitment.'
    },
    {
      id: 'sample-notice-3',
      title: 'Google Cloud Tech Talk: Building Scalable Systems',
      date: getOffsetDateISO(1), // Tomorrow
      time: '11:00 AM',
      venue: 'Main University Auditorium',
      category: 'Event',
      description: 'Distinguished lecture by Senior Engineering Leaders from Google Cloud. Topics include distributed microservices, reliability, and upcoming internship drives.'
    },
    {
      id: 'sample-notice-4',
      title: 'Pre-Placement Drive: Deloitte Consulting Analyst',
      date: getOffsetDateISO(3), // In 3 days
      time: '09:30 AM',
      venue: 'Placement Cell Seminar Hall (Block 4)',
      category: 'Placement',
      description: 'Mandatory pre-placement presentation followed by online aptitude and business case evaluation. Formal dress code and university ID card strictly required.'
    },
    {
      id: 'sample-notice-5',
      title: 'Inter-Department Football Tournament Finals',
      date: getOffsetDateISO(5), // In 5 days
      time: '04:00 PM',
      venue: 'Central Sports Arena (Field A)',
      category: 'Sports',
      description: 'Championship match: Computer Science Engineers vs Mechanical Department. Free student entry; fan cheer zones open 30 minutes before kick-off.'
    },
    {
      id: 'sample-notice-6',
      title: 'Mid-Term Examination Hall Tickets & Schedule',
      date: getOffsetDateISO(-2), // 2 days ago (Past)
      time: '10:00 AM',
      venue: 'Dean Office Notice Board & Student Portal',
      category: 'Academic',
      description: 'Official schedule published for Autumn Semester Mid-Term examinations. Ensure library clearance is complete to download hall admit cards.'
    }
  ];
}

// ==========================================
// Local Storage Management
// ==========================================

function loadNoticesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTICES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read notices from localStorage:', err);
  }

  // Preload default realistic samples if storage is empty
  const defaults = generateSampleNotices();
  saveNoticesToStorage(defaults);
  return defaults;
}

function saveNoticesToStorage(noticesArray) {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify(noticesArray));
  } catch (err) {
    console.warn('Could not save notices to localStorage:', err);
  }
}

/**
 * Saves a new notice to localStorage in format:
 * {id, title, date (ISO), time, venue, category, description}
 */
function saveNotice(noticeData) {
  const cleanTitle = (noticeData.title || '').trim();
  const cleanDate = (noticeData.date || '').trim() || getTodayISO();
  const cleanTime = (noticeData.time || '').trim() || 'Not specified';
  const cleanVenue = (noticeData.venue || '').trim() || 'Not specified';
  const cleanCategory = (noticeData.category || '').trim() || 'Other';
  const cleanDescription = (noticeData.description || '').trim() || 'Not specified';

  // Enforce duplicate check (same title and date)
  if (isDuplicateNotice(cleanTitle, cleanDate)) {
    showToast('⚠️ A notice with this title and date already exists!');
    return false;
  }

  const newNotice = {
    id: 'notice-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title: cleanTitle,
    date: cleanDate,
    time: cleanTime,
    venue: cleanVenue,
    category: cleanCategory,
    description: cleanDescription
  };

  state.notices.unshift(newNotice);
  saveNoticesToStorage(state.notices);
  renderAllSections();
  showToast('✅ Notice added to your tracker!');
  return true;
}

/**
 * Deletes a notice by ID from localStorage and re-renders.
 */
function deleteNotice(noticeId) {
  state.notices = state.notices.filter(n => n.id !== noticeId);
  saveNoticesToStorage(state.notices);
  renderAllSections();
  showToast('🗑️ Notice deleted.');
}

// ==========================================
// Theme Management (Light / Dark Mode)
// ==========================================

function initTheme() {
  let theme = localStorage.getItem(STORAGE_KEYS.THEME);
  
  if (!theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }

  applyTheme(theme);

  // Listen to system changes if user hasn't explicitly set a preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);

  elements.themeToggleIcon.textContent = isDark ? '☀️' : '🌙';
  elements.themeToggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  elements.themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function toggleTheme() {
  const isCurrentlyDark = document.documentElement.classList.contains('dark');
  const newTheme = isCurrentlyDark ? 'light' : 'dark';
  
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  applyTheme(newTheme);
  
  showToast(newTheme === 'dark' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
}

// ==========================================
// Toast Notification System
// Strict textContent for safety
// ==========================================

function showToast(message) {
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast-enter pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-soft-lg text-sm font-medium border border-slate-700/50 dark:border-slate-300';
  toast.setAttribute('role', 'alert');

  const textSpan = document.createElement('span');
  textSpan.className = 'leading-snug';
  textSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'text-slate-400 hover:text-white dark:hover:text-slate-900 font-bold text-base px-1 leading-none cursor-pointer';
  closeBtn.setAttribute('aria-label', 'Dismiss toast notification');
  closeBtn.textContent = '✕';

  const removeToast = () => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode === elements.toastContainer) {
        elements.toastContainer.removeChild(toast);
      }
    }, 220);
  };

  closeBtn.addEventListener('click', removeToast);
  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);

  elements.toastContainer.appendChild(toast);

  // Auto remove after 3.2 seconds
  setTimeout(removeToast, 3200);
}

// ==========================================
// DOM Creation Helpers (Pure textContent)
// ==========================================

/**
 * Creates a category badge element.
 */
function createCategoryBadge(categoryName) {
  const catObj = CATEGORIES.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase()) || {
    name: categoryName || 'Other',
    emoji: '📌',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  };

  const badge = document.createElement('span');
  badge.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catObj.badgeClass}`;

  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = catObj.emoji;
  emojiSpan.setAttribute('aria-hidden', 'true');

  const textSpan = document.createElement('span');
  textSpan.textContent = catObj.name;

  badge.appendChild(emojiSpan);
  badge.appendChild(textSpan);
  return badge;
}

/**
 * Creates an individual Notice Card using textContent only.
 */
function createNoticeCardElement(notice, isUrgentToday = false) {
  const card = document.createElement('article');
  
  if (isUrgentToday) {
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-5 border-2 border-rose-300 dark:border-rose-800 shadow-soft hover:shadow-soft-lg transition-all duration-200';
  } else {
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-soft hover:shadow-soft-lg transition-all duration-200';
  }

  // Top Row: Category Badge & Date Status
  const topRow = document.createElement('div');
  topRow.className = 'flex flex-wrap items-center justify-between gap-2 mb-2.5';

  const badge = createCategoryBadge(notice.category);
  topRow.appendChild(badge);

  // Relative Date Tag
  const dateTag = document.createElement('span');
  const isToday = notice.date === getTodayISO();

  if (isToday) {
    dateTag.className = 'inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900';
    const dot = document.createElement('span');
    dot.className = 'h-2 w-2 rounded-full bg-rose-500';
    dateTag.appendChild(dot);
    const label = document.createElement('span');
    label.textContent = 'Due Today';
    dateTag.appendChild(label);
  } else {
    dateTag.className = 'text-xs font-medium text-slate-500 dark:text-slate-400';
    dateTag.textContent = formatReadableDate(notice.date);
  }
  topRow.appendChild(dateTag);
  card.appendChild(topRow);

  // Notice Title
  const title = document.createElement('h3');
  title.className = 'text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2';
  title.textContent = notice.title;
  card.appendChild(title);

  // Meta Information Row: Time & Venue
  const metaRow = document.createElement('div');
  metaRow.className = 'flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mb-3';

  // Time Pill
  const timeSpan = document.createElement('div');
  timeSpan.className = 'flex items-center gap-1.5';
  const timeIcon = document.createElement('span');
  timeIcon.textContent = '⏰';
  timeIcon.setAttribute('aria-hidden', 'true');
  const timeText = document.createElement('span');
  timeText.textContent = notice.time || 'All Day';
  timeSpan.appendChild(timeIcon);
  timeSpan.appendChild(timeText);
  metaRow.appendChild(timeSpan);

  // Venue Pill
  const venueSpan = document.createElement('div');
  venueSpan.className = 'flex items-center gap-1.5';
  const venueIcon = document.createElement('span');
  venueIcon.textContent = '📍';
  venueIcon.setAttribute('aria-hidden', 'true');
  const venueText = document.createElement('span');
  venueText.textContent = notice.venue || 'Campus';
  venueSpan.appendChild(venueIcon);
  venueSpan.appendChild(venueText);
  metaRow.appendChild(venueSpan);

  card.appendChild(metaRow);

  // Description
  const desc = document.createElement('p');
  desc.className = 'text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed';
  desc.textContent = notice.description;
  card.appendChild(desc);

  // Card Action Footer
  const footerRow = document.createElement('div');
  footerRow.className = 'mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2';

  const dateSubtext = document.createElement('span');
  dateSubtext.className = 'text-xs text-slate-400 dark:text-slate-500';
  dateSubtext.textContent = `Date: ${notice.date}`;
  footerRow.appendChild(dateSubtext);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex items-center gap-1.5';

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer';
  deleteBtn.setAttribute('aria-label', `Delete notice: ${notice.title}`);

  const delIcon = document.createElement('span');
  delIcon.textContent = '🗑️';
  delIcon.setAttribute('aria-hidden', 'true');

  const delText = document.createElement('span');
  delText.textContent = 'Delete';

  deleteBtn.appendChild(delIcon);
  deleteBtn.appendChild(delText);

  deleteBtn.addEventListener('click', () => {
    const confirmed = window.confirm(`Delete notice "${notice.title}"?`);
    if (confirmed) {
      deleteNotice(notice.id);
    }
  });

  actionsDiv.appendChild(deleteBtn);

  // Copy Notice button
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-google-blue dark:text-slate-300 dark:hover:text-google-blue hover:bg-blue-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer';
  copyBtn.setAttribute('aria-label', `Copy details for ${notice.title}`);
  
  const copyIcon = document.createElement('span');
  copyIcon.textContent = '📋';
  copyIcon.setAttribute('aria-hidden', 'true');
  const copyText = document.createElement('span');
  copyText.textContent = 'Copy';
  
  copyBtn.appendChild(copyIcon);
  copyBtn.appendChild(copyText);

  copyBtn.addEventListener('click', () => {
    const noticeDetails = `📢 ${notice.title}\n📅 Date: ${notice.date} (${notice.time})\n📍 Venue: ${notice.venue}\n🏷️ Category: ${notice.category}\n\n${notice.description}`;
    navigator.clipboard.writeText(noticeDetails).then(() => {
      showToast('📋 Notice details copied to clipboard!');
    }).catch(() => {
      showToast('Notice details ready!');
    });
  });

  actionsDiv.appendChild(copyBtn);
  footerRow.appendChild(actionsDiv);
  card.appendChild(footerRow);

  return card;
}

// ==========================================
// Category Chips Setup
// ==========================================

function renderCategoryChips() {
  elements.categoryChipsContainer.textContent = '';

  CATEGORIES.forEach(cat => {
    const chipBtn = document.createElement('button');
    chipBtn.type = 'button';
    const isActive = state.activeCategory.toLowerCase() === cat.name.toLowerCase();

    chipBtn.className = isActive
      ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap bg-google-blue text-white shadow-sm ring-2 ring-blue-300 dark:ring-blue-800 transition-all cursor-pointer'
      : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer';

    chipBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    chipBtn.setAttribute('aria-label', `Filter by ${cat.name}`);

    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = cat.emoji;
    emojiSpan.setAttribute('aria-hidden', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = cat.name;

    chipBtn.appendChild(emojiSpan);
    chipBtn.appendChild(labelSpan);

    chipBtn.addEventListener('click', () => {
      state.activeCategory = cat.name;
      renderCategoryChips();
      renderAllSections();
    });

    elements.categoryChipsContainer.appendChild(chipBtn);
  });
}

// ==========================================
// Render Section 3: "Needs attention today"
// Safe when empty!
// ==========================================

function renderTodaySection() {
  const todayISO = getTodayISO();
  const todayNotices = state.notices.filter(notice => notice.date === todayISO);

  // Update badge count
  const countText = `${todayNotices.length} item${todayNotices.length === 1 ? '' : 's'}`;
  elements.todayCountBadge.textContent = countText;

  // Clear previous content safely
  elements.todayContainer.textContent = '';

  if (todayNotices.length > 0) {
    todayNotices.forEach(notice => {
      const card = createNoticeCardElement(notice, true);
      elements.todayContainer.appendChild(card);
    });
  } else {
    // Safe friendly empty state when no notices are due today
    const emptyCard = document.createElement('div');
    emptyCard.className = 'bg-white dark:bg-slate-800 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-700/80 shadow-soft';

    const iconSpan = document.createElement('div');
    iconSpan.className = 'text-3xl mb-2 select-none';
    iconSpan.textContent = '🎉';
    iconSpan.setAttribute('aria-hidden', 'true');

    const titleH3 = document.createElement('h3');
    titleH3.className = 'text-base font-bold text-slate-900 dark:text-white mb-1';
    titleH3.textContent = "You're all caught up for today!";

    const subP = document.createElement('p');
    subP.className = 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto';
    subP.textContent = 'No pending deadlines or notices scheduled for today. Check upcoming notices below.';

    emptyCard.appendChild(iconSpan);
    emptyCard.appendChild(titleH3);
    emptyCard.appendChild(subP);

    elements.todayContainer.appendChild(emptyCard);
  }
}

// ==========================================
// Render Section 5: Notice Cards & Search/Filter
// Friendly empty state included
// ==========================================

function renderNoticesList() {
  const query = state.searchQuery.trim().toLowerCase();
  const categoryFilter = state.activeCategory.toLowerCase();

  // Filter notices by category and search query
  const filteredNotices = state.notices.filter(notice => {
    const matchesCategory = categoryFilter === 'all' || (notice.category || '').toLowerCase() === categoryFilter;

    if (!matchesCategory) return false;

    if (!query) return true;

    const titleMatch = (notice.title || '').toLowerCase().includes(query);
    const venueMatch = (notice.venue || '').toLowerCase().includes(query);
    const descMatch = (notice.description || '').toLowerCase().includes(query);

    return titleMatch || venueMatch || descMatch;
  });

  // Sort: Today first, then future chronological, then past
  const todayISO = getTodayISO();
  filteredNotices.sort((a, b) => {
    if (a.date === todayISO && b.date !== todayISO) return -1;
    if (b.date === todayISO && a.date !== todayISO) return 1;
    return (a.date || '').localeCompare(b.date || '');
  });

  // Update total count indicator
  elements.totalNoticesCount.textContent = filteredNotices.length;

  // Show or hide filtered badge
  const isFiltered = query.length > 0 || categoryFilter !== 'all';
  if (isFiltered) {
    elements.activeFilterBadge.classList.remove('hidden');
    elements.activeFilterBadge.textContent = `Filtered (${filteredNotices.length})`;
  } else {
    elements.activeFilterBadge.classList.add('hidden');
  }

  // Clear container safely
  elements.noticeCardsContainer.textContent = '';

  if (filteredNotices.length > 0) {
    filteredNotices.forEach(notice => {
      const card = createNoticeCardElement(notice, notice.date === todayISO);
      elements.noticeCardsContainer.appendChild(card);
    });
  } else {
    // Friendly Empty State
    const emptyState = document.createElement('div');
    emptyState.className = 'bg-white dark:bg-slate-800 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700/80 shadow-soft';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'text-4xl sm:text-5xl mb-3 select-none';
    emptyIcon.textContent = '🔍';
    emptyIcon.setAttribute('aria-hidden', 'true');

    const emptyTitle = document.createElement('h3');
    emptyTitle.className = 'text-lg font-bold text-slate-900 dark:text-white mb-2';
    emptyTitle.textContent = 'No matching notices found';

    const emptyDesc = document.createElement('p');
    emptyDesc.className = 'text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed';
    emptyDesc.textContent = "We couldn't find any notices matching your query. Try different keywords or reset your filters.";

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-google-blue hover:bg-google-blueHover text-white shadow-sm transition-all cursor-pointer';
    resetBtn.setAttribute('aria-label', 'Reset all search and category filters');

    const resetIcon = document.createElement('span');
    resetIcon.textContent = '🔄';
    resetIcon.setAttribute('aria-hidden', 'true');

    const resetText = document.createElement('span');
    resetText.textContent = 'Reset Filters';

    resetBtn.appendChild(resetIcon);
    resetBtn.appendChild(resetText);

    resetBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.activeCategory = 'All';
      elements.searchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      renderCategoryChips();
      renderAllSections();
    });

    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyDesc);
    emptyState.appendChild(resetBtn);

    elements.noticeCardsContainer.appendChild(emptyState);
  }
}

// ==========================================
// Render All Sections
// ==========================================

function renderAllSections() {
  renderTodaySection();
  renderNoticesList();
}

// ==========================================
// View Switcher (List vs Calendar Placeholder)
// ==========================================

function setView(viewName) {
  state.currentView = viewName;
  const isList = viewName === 'list';

  if (isList) {
    elements.listViewSection.classList.remove('hidden');
    elements.calendarViewSection.classList.add('hidden');

    elements.listViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm cursor-pointer';
    elements.listViewBtn.setAttribute('aria-pressed', 'true');

    elements.calendarViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer';
    elements.calendarViewBtn.setAttribute('aria-pressed', 'false');
  } else {
    elements.listViewSection.classList.add('hidden');
    elements.calendarViewSection.classList.remove('hidden');

    elements.calendarViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm cursor-pointer';
    elements.calendarViewBtn.setAttribute('aria-pressed', 'true');

    elements.listViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer';
    elements.listViewBtn.setAttribute('aria-pressed', 'false');
  }
}

// ==========================================
// AI Extraction Engine (Gemini 2.5 Flash via /api/gemini)
// ==========================================

/**
 * Calls /api/gemini serverless endpoint to extract notice details from pasted message.
 */
async function handleExtractNotice(textOverride = null) {
  const rawText = textOverride !== null ? textOverride : elements.noticeInputText.value;
  const noticeText = (rawText || '').trim();

  if (!noticeText) {
    showToast('ℹ️ Please paste a notice in the box first!');
    elements.noticeInputText.focus();
    return;
  }

  if (noticeText.length > 3000) {
    showToast('⚠️ Notice text exceeds the 3000-character limit.');
    return;
  }

  // Clear previous feedback and display loading spinner
  elements.extractionFeedbackContainer.textContent = '';
  elements.extractNoticeBtn.disabled = true;
  elements.extractNoticeBtn.classList.add('opacity-60', 'cursor-not-allowed');
  elements.extractBtnIcon.className = 'spinner-icon';
  elements.extractBtnIcon.textContent = '⏳';
  elements.extractBtnText.textContent = 'Extracting...';

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: noticeText,
        today: getTodayISO()
      })
    });

    if (!response.ok) {
      let errorMsg = 'Failed to extract notice details.';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMsg = errorData.error;
        }
      } catch (_) {}
      renderExtractionErrorCard(errorMsg, noticeText);
      return;
    }

    const payload = await response.json();
    const noticesList = payload.notices;

    if (!Array.isArray(noticesList) || noticesList.length === 0) {
      renderExtractionErrorCard('No distinct campus notices or deadlines could be recognized in this message.', noticeText);
      return;
    }

    // Render editable preview card with Confirm/Cancel
    renderEditablePreviewCard(noticesList[0], noticeText);
    showToast('✨ Notice extracted! Review details below before saving.');
  } catch (err) {
    console.error('Error during AI notice extraction:', err);
    renderExtractionErrorCard('Network or server connection failed. Please check your connection and try again.', noticeText);
  } finally {
    // Restore Extract Button State
    elements.extractNoticeBtn.disabled = false;
    elements.extractNoticeBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    elements.extractBtnIcon.className = '';
    elements.extractBtnIcon.textContent = '✨';
    elements.extractBtnText.textContent = 'Extract';
  }
}

/**
 * Renders an editable preview card for the extracted notice.
 * Strictly uses textContent and document.createElement (zero innerHTML).
 */
function renderEditablePreviewCard(extracted, originalText) {
  elements.extractionFeedbackContainer.textContent = '';

  // Validate fields and map missing to "Not specified"
  const initialTitle = extracted.title && extracted.title !== 'Not specified' ? extracted.title : 'Notice Update';
  const initialDate = extracted.date && extracted.date !== 'Not specified' ? extracted.date : getTodayISO();
  const initialTime = extracted.time ? extracted.time : 'Not specified';
  const initialVenue = extracted.venue ? extracted.venue : 'Not specified';
  const initialCategory = CATEGORIES.some(c => c.name.toLowerCase() === (extracted.category || '').toLowerCase() && c.name !== 'All')
    ? extracted.category
    : 'Other';
  const initialDesc = extracted.description ? extracted.description : 'Not specified';

  // Container Card
  const previewCard = document.createElement('div');
  previewCard.className = 'border-2 border-google-blue/30 dark:border-blue-700/60 bg-blue-50/20 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-6 shadow-soft space-y-4';

  // Preview Header
  const headerDiv = document.createElement('div');
  headerDiv.className = 'flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-700/70';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'flex items-center gap-2';

  const iconSpan = document.createElement('span');
  iconSpan.textContent = '✨';
  iconSpan.className = 'text-xl';
  iconSpan.setAttribute('aria-hidden', 'true');

  const titleH3 = document.createElement('h3');
  titleH3.className = 'text-base font-bold text-slate-900 dark:text-white';
  titleH3.textContent = 'Editable Preview (AI Extracted)';

  titleGroup.appendChild(iconSpan);
  titleGroup.appendChild(titleH3);

  const subBadge = document.createElement('span');
  subBadge.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-google-blue dark:text-blue-300 border border-blue-200 dark:border-blue-800';
  subBadge.textContent = 'Review & Edit';

  headerDiv.appendChild(titleGroup);
  headerDiv.appendChild(subBadge);
  previewCard.appendChild(headerDiv);

  // Form Fields Grid
  const formGrid = document.createElement('div');
  formGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3.5';

  // Field: Title
  const titleField = document.createElement('div');
  titleField.className = 'sm:col-span-2';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  titleLabel.textContent = 'Notice Title *';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.maxLength = 150;
  titleInput.value = initialTitle;
  titleInput.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue';
  titleInput.setAttribute('aria-label', 'Edit notice title');
  titleField.appendChild(titleLabel);
  titleField.appendChild(titleInput);
  formGrid.appendChild(titleField);

  // Field: Category
  const catField = document.createElement('div');
  const catLabel = document.createElement('label');
  catLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  catLabel.textContent = 'Category *';
  const catSelect = document.createElement('select');
  catSelect.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue';
  catSelect.setAttribute('aria-label', 'Select category');
  CATEGORIES.filter(c => c.name !== 'All').forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    if (cat.name.toLowerCase() === initialCategory.toLowerCase()) {
      opt.selected = true;
    }
    catSelect.appendChild(opt);
  });
  catField.appendChild(catLabel);
  catField.appendChild(catSelect);
  formGrid.appendChild(catField);

  // Field: Date
  const dateField = document.createElement('div');
  const dateLabel = document.createElement('label');
  dateLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  dateLabel.textContent = 'Date (ISO YYYY-MM-DD) *';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : getTodayISO();
  dateInput.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue';
  dateInput.setAttribute('aria-label', 'Edit notice date');
  dateField.appendChild(dateLabel);
  dateField.appendChild(dateInput);
  formGrid.appendChild(dateField);

  // Field: Time
  const timeField = document.createElement('div');
  const timeLabel = document.createElement('label');
  timeLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  timeLabel.textContent = 'Time';
  const timeInput = document.createElement('input');
  timeInput.type = 'text';
  timeInput.value = initialTime;
  timeInput.placeholder = 'e.g. 10:30 AM or Not specified';
  timeInput.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue';
  timeInput.setAttribute('aria-label', 'Edit notice time');
  timeField.appendChild(timeLabel);
  timeField.appendChild(timeInput);
  formGrid.appendChild(timeField);

  // Field: Venue
  const venueField = document.createElement('div');
  const venueLabel = document.createElement('label');
  venueLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  venueLabel.textContent = 'Venue';
  const venueInput = document.createElement('input');
  venueInput.type = 'text';
  venueInput.value = initialVenue;
  venueInput.placeholder = 'e.g. Auditorium Hall B or Not specified';
  venueInput.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue';
  venueInput.setAttribute('aria-label', 'Edit notice venue');
  venueField.appendChild(venueLabel);
  venueField.appendChild(venueInput);
  formGrid.appendChild(venueField);

  // Field: Description
  const descField = document.createElement('div');
  descField.className = 'sm:col-span-2';
  const descLabel = document.createElement('label');
  descLabel.className = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
  descLabel.textContent = 'Description';
  const descTextarea = document.createElement('textarea');
  descTextarea.rows = 3;
  descTextarea.value = initialDesc;
  descTextarea.className = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-google-blue resize-y';
  descTextarea.setAttribute('aria-label', 'Edit notice description');
  descField.appendChild(descLabel);
  descField.appendChild(descTextarea);
  formGrid.appendChild(descField);

  previewCard.appendChild(formGrid);

  // Preview Action Buttons (Confirm / Cancel)
  const actionsBar = document.createElement('div');
  actionsBar.className = 'pt-2 flex flex-wrap items-center justify-end gap-2.5';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.setAttribute('aria-label', 'Cancel notice preview');
  cancelBtn.addEventListener('click', () => {
    elements.extractionFeedbackContainer.textContent = '';
    showToast('Notice extraction discarded.');
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-google-blue hover:bg-google-blueHover shadow-sm active:scale-95 transition-all cursor-pointer';
  confirmBtn.setAttribute('aria-label', 'Confirm and save notice');

  const checkSpan = document.createElement('span');
  checkSpan.textContent = '✅';
  checkSpan.setAttribute('aria-hidden', 'true');
  const btnTextSpan = document.createElement('span');
  btnTextSpan.textContent = 'Confirm & Save';

  confirmBtn.appendChild(checkSpan);
  confirmBtn.appendChild(btnTextSpan);

  confirmBtn.addEventListener('click', () => {
    const finalTitle = titleInput.value.trim();
    const finalDate = dateInput.value.trim() || getTodayISO();
    const finalTime = timeInput.value.trim() || 'Not specified';
    const finalVenue = venueInput.value.trim() || 'Not specified';
    const finalCategory = catSelect.value || 'Other';
    const finalDesc = descTextarea.value.trim() || 'Not specified';

    if (!finalTitle || finalTitle.toLowerCase() === 'not specified') {
      showToast('⚠️ Please enter a title for the notice.');
      titleInput.focus();
      return;
    }

    // Check duplicate notice
    if (isDuplicateNotice(finalTitle, finalDate)) {
      showToast('⚠️ A notice with this title and date already exists!');
      return;
    }

    const saved = saveNotice({
      title: finalTitle,
      date: finalDate,
      time: finalTime,
      venue: finalVenue,
      category: finalCategory,
      description: finalDesc
    });

    if (saved) {
      elements.noticeInputText.value = '';
      elements.extractionFeedbackContainer.textContent = '';
    }
  });

  actionsBar.appendChild(cancelBtn);
  actionsBar.appendChild(confirmBtn);
  previewCard.appendChild(actionsBar);

  elements.extractionFeedbackContainer.appendChild(previewCard);
  previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Renders a friendly error card with a Retry button.
 * Uses textContent and document.createElement (never innerHTML).
 */
function renderExtractionErrorCard(errorMessage, textToRetry) {
  elements.extractionFeedbackContainer.textContent = '';

  const errorCard = document.createElement('div');
  errorCard.className = 'border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 rounded-2xl p-4 sm:p-5 shadow-soft space-y-3';

  const headerDiv = document.createElement('div');
  headerDiv.className = 'flex items-center gap-2';

  const iconSpan = document.createElement('span');
  iconSpan.textContent = '⚠️';
  iconSpan.className = 'text-xl';
  iconSpan.setAttribute('aria-hidden', 'true');

  const errorTitle = document.createElement('h3');
  errorTitle.className = 'text-sm sm:text-base font-bold text-rose-800 dark:text-rose-200';
  errorTitle.textContent = 'Extraction Notice';

  headerDiv.appendChild(iconSpan);
  headerDiv.appendChild(errorTitle);
  errorCard.appendChild(headerDiv);

  const errorP = document.createElement('p');
  errorP.className = 'text-xs sm:text-sm text-rose-700 dark:text-rose-300 leading-relaxed';
  errorP.textContent = errorMessage;
  errorCard.appendChild(errorP);

  const btnRow = document.createElement('div');
  btnRow.className = 'flex items-center gap-2 pt-1';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-google-blue hover:bg-google-blueHover shadow-sm active:scale-95 transition-all cursor-pointer';
  retryBtn.setAttribute('aria-label', 'Retry extracting notice text');

  const retryIcon = document.createElement('span');
  retryIcon.textContent = '🔄';
  retryIcon.setAttribute('aria-hidden', 'true');
  const retryText = document.createElement('span');
  retryText.textContent = 'Retry Extraction';

  retryBtn.appendChild(retryIcon);
  retryBtn.appendChild(retryText);

  retryBtn.addEventListener('click', () => {
    handleExtractNotice(textToRetry);
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss error message');
  dismissBtn.addEventListener('click', () => {
    elements.extractionFeedbackContainer.textContent = '';
  });

  btnRow.appendChild(retryBtn);
  btnRow.appendChild(dismissBtn);
  errorCard.appendChild(btnRow);

  elements.extractionFeedbackContainer.appendChild(errorCard);
}

// ==========================================
// Event Listeners & Initialization
// ==========================================

function setupEventListeners() {
  // Theme Toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Search input with instant filtering
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    if (state.searchQuery.length > 0) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
    }
    renderNoticesList();
  });

  // Clear search input button
  elements.clearSearchBtn.addEventListener('click', () => {
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hidden');
    elements.searchInput.focus();
    renderNoticesList();
  });

  // View Switchers
  elements.listViewBtn.addEventListener('click', () => setView('list'));
  elements.calendarViewBtn.addEventListener('click', () => setView('calendar'));
  elements.backToListBtn.addEventListener('click', () => setView('list'));

  // Paste Card: Extract Button wired to AI extraction engine
  elements.extractNoticeBtn.addEventListener('click', () => {
    handleExtractNotice();
  });

  // Paste Card: Clear Button
  elements.clearNoticeBtn.addEventListener('click', () => {
    elements.noticeInputText.value = '';
    elements.extractionFeedbackContainer.textContent = '';
    elements.noticeInputText.focus();
  });
}

// Initialize Application
function initApp() {
  initTheme();
  state.notices = loadNoticesFromStorage();
  renderCategoryChips();
  renderAllSections();
  setupEventListeners();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
