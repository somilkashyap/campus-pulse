/**
 * Campus Pulse - Student Notice, Deadline & Event Tracker
 * Plain Vanilla JavaScript implementation.
 * Zero external libraries, zero backend, no database/Firebase.
 * All data is stored in browser localStorage.
 * Strict DOM security: ALL text is rendered via textContent, never innerHTML.
 */

// Local Storage Keys
const STORAGE_KEYS = {
  NOTICES: 'campus_pulse_notices_v1',
  THEME: 'campus_pulse_theme_v1',
  SUMMARY_CACHE: 'campus_pulse_summary_cache_v1'
};

// Import pure utility functions from window.CampusUtils (or require in Node)
const {
  getStatus,
  sortByUrgency,
  filterNotices,
  validateNotice,
  parseGeminiJson,
  isThisWeek,
  getTodayISO,
  getOffsetDateISO,
  formatReadableDate,
  cleanAndCapNotices
} = (typeof window !== 'undefined' && window.CampusUtils) 
  ? window.CampusUtils 
  : (typeof require !== 'undefined' ? require('./utils.js') : {});

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
  currentView: 'list', // 'list' or 'calendar'
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(), // 0 - 11
  selectedCalendarDate: null
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
  aiSummaryBtn: document.getElementById('aiSummaryBtn'),
  aiSummaryBtnIcon: document.getElementById('aiSummaryBtnIcon'),
  aiSummaryBtnText: document.getElementById('aiSummaryBtnText'),
  aiSummaryCardContainer: document.getElementById('aiSummaryCardContainer'),
  todayHeading: document.getElementById('today-heading'),
  todayCountBadge: document.getElementById('todayCountBadge'),
  todayAttentionBanner: document.getElementById('todayAttentionBanner'),
  todayContainer: document.getElementById('todayContainer'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  categoryChipsContainer: document.getElementById('categoryChipsContainer'),
  listViewBtn: document.getElementById('listViewBtn'),
  calendarViewBtn: document.getElementById('calendarViewBtn'),
  listViewSection: document.getElementById('listViewSection'),
  calendarViewSection: document.getElementById('calendarViewSection'),
  totalNoticesCount: document.getElementById('totalNoticesCount'),
  activeFilterBadge: document.getElementById('activeFilterBadge'),
  noticeCardsContainer: document.getElementById('noticeCardsContainer'),
  pastNoticesDetails: document.getElementById('pastNoticesDetails'),
  pastNoticesTitle: document.getElementById('pastNoticesTitle'),
  pastNoticesList: document.getElementById('pastNoticesList'),
  calendarPrevMonthBtn: document.getElementById('calendarPrevMonthBtn'),
  calendarNextMonthBtn: document.getElementById('calendarNextMonthBtn'),
  calendarMonthTitle: document.getElementById('calendarMonthTitle'),
  calendarTodayJumpBtn: document.getElementById('calendarTodayJumpBtn'),
  calendarDaysGrid: document.getElementById('calendarDaysGrid'),
  calendarSelectedDateHeading: document.getElementById('calendarSelectedDateHeading'),
  calendarSelectedDateCount: document.getElementById('calendarSelectedDateCount'),
  calendarSelectedDateList: document.getElementById('calendarSelectedDateList'),
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// Date & Priority Calculation Helpers
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
 * Computes priority status from today's date for every notice.
 * Delegates directly to CampusUtils.getStatus.
 */
function computeNoticeStatus(noticeDateISO) {
  return getStatus(noticeDateISO, getTodayISO());
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
      date: getOffsetDateISO(1), // Tomorrow (Urgent within 48h)
      time: '11:00 AM',
      venue: 'Main University Auditorium',
      category: 'Event',
      description: 'Distinguished lecture by Senior Engineering Leaders from Google Cloud. Topics include distributed microservices, reliability, and upcoming internship drives.'
    },
    {
      id: 'sample-notice-4',
      title: 'Pre-Placement Drive: Deloitte Consulting Analyst',
      date: getOffsetDateISO(3), // In 3 days (Upcoming)
      time: '09:30 AM',
      venue: 'Placement Cell Seminar Hall (Block 4)',
      category: 'Placement',
      description: 'Mandatory pre-placement presentation followed by online aptitude and business case evaluation. Formal dress code and university ID card strictly required.'
    },
    {
      id: 'sample-notice-5',
      title: 'Inter-Department Football Tournament Finals',
      date: getOffsetDateISO(5), // In 5 days (Upcoming)
      time: '04:00 PM',
      venue: 'Central Sports Arena (Field A)',
      category: 'Sports',
      description: 'Championship match: Computer Science Engineers vs Mechanical Department. Free student entry; fan cheer zones open 30 minutes before kick-off.'
    },
    {
      id: 'sample-notice-6',
      title: 'Mid-Term Examination Hall Tickets & Schedule',
      date: getOffsetDateISO(-2), // 2 days ago (Expired)
      time: '10:00 AM',
      venue: 'Dean Office Notice Board & Student Portal',
      category: 'Academic',
      description: 'Official schedule published for Autumn Semester Mid-Term examinations. Ensure library clearance is complete to download hall admit cards.'
    }
  ];
}

// ==========================================
// Local Storage Management with 200 Cap & 30-Day Auto Cleanup
// ==========================================

/**
 * Auto-removes expired notices older than 30 days and caps total items at 200.
 */
function cleanAndCapNotices(noticesArray) {
  if (!Array.isArray(noticesArray)) return [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

  // Discard expired notices older than 30 days
  let cleaned = noticesArray.filter(notice => {
    if (!notice.date || !/^\d{4}-\d{2}-\d{2}$/.test(notice.date)) return true;
    return notice.date >= thirtyDaysAgoISO;
  });

  // Cap at 200 items maximum
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200);
  }

  return cleaned;
}

function loadNoticesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTICES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return cleanAndCapNotices(parsed);
      }
    }
  } catch (err) {
    console.warn('Could not read notices from localStorage:', err);
  }

  // Preload default realistic samples if storage is empty
  const defaults = cleanAndCapNotices(generateSampleNotices());
  saveNoticesToStorage(defaults);
  return defaults;
}

function saveNoticesToStorage(noticesArray) {
  try {
    const processed = cleanAndCapNotices(noticesArray);
    localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify(processed));
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
  state.notices = cleanAndCapNotices(state.notices);
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
 * Creates a priority status badge:
 * - Urgent (within 48h): Red
 * - Today: Orange
 * - Upcoming: Green
 * - Expired: Grey
 */
function createPriorityStatusBadge(status) {
  const badge = document.createElement('span');
  let styleClass = '';
  let emoji = '';
  let label = status;

  if (status === 'Urgent') {
    styleClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    emoji = '🚨';
    label = 'Urgent (48h)';
  } else if (status === 'Today') {
    styleClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    emoji = '⚡';
    label = 'Today';
  } else if (status === 'Upcoming') {
    styleClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    emoji = '🗓️';
    label = 'Upcoming';
  } else {
    // Expired
    styleClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700';
    emoji = '⏳';
    label = 'Expired';
  }

  badge.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${styleClass}`;
  
  const icon = document.createElement('span');
  icon.textContent = emoji;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = label;

  badge.appendChild(icon);
  badge.appendChild(text);
  return badge;
}

/**
 * Creates an individual Notice Card using textContent only.
 */
function createNoticeCardElement(notice, isUrgentToday = false) {
  const status = computeNoticeStatus(notice.date);
  const card = document.createElement('article');
  
  if (status === 'Today' || isUrgentToday) {
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-5 border-2 border-amber-300 dark:border-amber-800 shadow-soft hover:shadow-soft-lg hover:border-amber-400 dark:hover:border-amber-700 transition-all duration-200';
  } else if (status === 'Urgent') {
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-5 border-2 border-rose-300 dark:border-rose-800 shadow-soft hover:shadow-soft-lg hover:border-rose-400 dark:hover:border-rose-700 transition-all duration-200';
  } else if (status === 'Expired') {
    card.className = 'bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-soft opacity-85 hover:opacity-100 transition-all duration-200';
  } else {
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-soft hover:shadow-soft-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200';
  }

  // Top Row: Category Badge & Status Badges
  const topRow = document.createElement('div');
  topRow.className = 'flex flex-wrap items-center justify-between gap-2 mb-2.5';

  const categoryBadge = createCategoryBadge(notice.category);
  topRow.appendChild(categoryBadge);

  const statusGroup = document.createElement('div');
  statusGroup.className = 'flex items-center gap-1.5 flex-wrap';

  // Priority color badge
  const priorityBadge = createPriorityStatusBadge(status);
  statusGroup.appendChild(priorityBadge);

  // Relative Date Tag
  const dateTag = document.createElement('span');
  dateTag.className = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  dateTag.textContent = formatReadableDate(notice.date);
  statusGroup.appendChild(dateTag);

  topRow.appendChild(statusGroup);
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
// Filter Helper (Matches Search & Category)
// ==========================================

function getFilteredNotices() {
  return filterNotices(state.notices, state.searchQuery, state.activeCategory);
}

// ==========================================
// Render Section 3: "Needs attention today" & Attention Banner
// ==========================================

function renderTodaySection() {
  const todayISO = getTodayISO();
  const todayNotices = state.notices.filter(notice => notice.date === todayISO);

  // Update badge count
  const countText = `${todayNotices.length} item${todayNotices.length === 1 ? '' : 's'}`;
  elements.todayCountBadge.textContent = countText;

  // Render Attention Banner (e.g. "3 things need your attention today")
  elements.todayAttentionBanner.textContent = '';
  const bannerIcon = document.createElement('span');
  bannerIcon.className = 'text-lg select-none';
  bannerIcon.setAttribute('aria-hidden', 'true');

  const bannerText = document.createElement('span');
  bannerText.className = 'font-semibold';

  if (todayNotices.length === 0) {
    elements.todayAttentionBanner.className = 'p-3.5 sm:p-4 rounded-xl font-medium text-xs sm:text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2';
    bannerIcon.textContent = '🎉';
    bannerText.textContent = 'All clear! Nothing needs your attention today.';
  } else if (todayNotices.length === 1) {
    elements.todayAttentionBanner.className = 'p-3.5 sm:p-4 rounded-xl font-medium text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2';
    bannerIcon.textContent = '⚡';
    bannerText.textContent = '1 thing needs your attention today.';
  } else {
    elements.todayAttentionBanner.className = 'p-3.5 sm:p-4 rounded-xl font-medium text-xs sm:text-sm bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-center gap-2';
    bannerIcon.textContent = '⚡';
    bannerText.textContent = `${todayNotices.length} things need your attention today.`;
  }

  elements.todayAttentionBanner.appendChild(bannerIcon);
  elements.todayAttentionBanner.appendChild(bannerText);

  // Clear previous content safely
  elements.todayContainer.textContent = '';

  if (todayNotices.length > 0) {
    todayNotices.forEach(notice => {
      const card = createNoticeCardElement(notice, true);
      elements.todayContainer.appendChild(card);
    });
  } else {
    // Friendly empty state
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
// Render Section 5: Notice Cards, Sorting by Urgency, & Collapsed Past
// ==========================================

function renderNoticesList() {
  const filteredNotices = getFilteredNotices();

  // Split into active (Today, Urgent, Upcoming) and expired (Past)
  const activeNotices = [];
  const expiredNotices = [];

  filteredNotices.forEach(notice => {
    const status = computeNoticeStatus(notice.date);
    if (status === 'Expired') {
      expiredNotices.push(notice);
    } else {
      activeNotices.push(notice);
    }
  });

  // Urgency sorting via CampusUtils.sortByUrgency
  const sortedActive = sortByUrgency(activeNotices, todayISO);

  // Sort expired notices reverse-chronologically (most recently expired first)
  expiredNotices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Update total count indicator (active items)
  elements.totalNoticesCount.textContent = sortedActive.length;

  // Filter badge indicator
  const query = state.searchQuery.trim();
  const categoryFilter = state.activeCategory.toLowerCase();
  const isFiltered = query.length > 0 || categoryFilter !== 'all';
  if (isFiltered) {
    elements.activeFilterBadge.classList.remove('hidden');
    elements.activeFilterBadge.textContent = `Filtered (${sortedActive.length + expiredNotices.length})`;
  } else {
    elements.activeFilterBadge.classList.add('hidden');
  }

  // Clear main container safely
  elements.noticeCardsContainer.textContent = '';

  if (sortedActive.length > 0) {
    sortedActive.forEach(notice => {
      const card = createNoticeCardElement(notice, notice.date === getTodayISO());
      elements.noticeCardsContainer.appendChild(card);
    });
  } else {
    // Friendly Empty State when no active notices match
    const emptyState = document.createElement('div');
    emptyState.className = 'bg-white dark:bg-slate-800 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700/80 shadow-soft';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'text-4xl sm:text-5xl mb-3 select-none';
    emptyIcon.textContent = '🔍';
    emptyIcon.setAttribute('aria-hidden', 'true');

    const emptyTitle = document.createElement('h3');
    emptyTitle.className = 'text-lg font-bold text-slate-900 dark:text-white mb-2';
    emptyTitle.textContent = 'No matching active notices found';

    const emptyDesc = document.createElement('p');
    emptyDesc.className = 'text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed';
    emptyDesc.textContent = "We couldn't find any active notices matching your filter. Check the collapsed past section below or reset filters.";

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

  // Populate Collapsed "Past" Section
  elements.pastNoticesList.textContent = '';
  if (expiredNotices.length > 0) {
    elements.pastNoticesDetails.classList.remove('hidden');
    elements.pastNoticesTitle.textContent = `Past & Expired Notices (${expiredNotices.length})`;

    expiredNotices.forEach(notice => {
      const card = createNoticeCardElement(notice, false);
      elements.pastNoticesList.appendChild(card);
    });
  } else {
    elements.pastNoticesDetails.classList.add('hidden');
  }
}

// ==========================================
// Hand-built Month Calendar Grid (Zero Library)
// ==========================================

function renderCalendarView() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const year = state.calendarYear;
  const month = state.calendarMonth;

  // Header Title: e.g. "October 2026"
  elements.calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;

  // Default selected date if null
  if (!state.selectedCalendarDate) {
    state.selectedCalendarDate = getTodayISO();
  }

  // Calculate day cells
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Filter notices for calendar dots (respects active search & category chips!)
  const filteredNotices = getFilteredNotices();
  const noticesByDate = new Map();

  filteredNotices.forEach(notice => {
    if (!notice.date) return;
    if (!noticesByDate.has(notice.date)) {
      noticesByDate.set(notice.date, []);
    }
    noticesByDate.get(notice.date).push(notice);
  });

  const todayISO = getTodayISO();
  elements.calendarDaysGrid.textContent = '';

  // 1. Trailing days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDayNum = prevMonthDays - i;
    const prevMonthDate = new Date(year, month - 1, prevDayNum);
    const prevISO = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevDayNum).padStart(2, '0')}`;

    const cell = createCalendarDayCell(prevDayNum, prevISO, true, noticesByDate.get(prevISO) || [], todayISO);
    elements.calendarDaysGrid.appendChild(cell);
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = createCalendarDayCell(day, dayISO, false, noticesByDate.get(dayISO) || [], todayISO);
    elements.calendarDaysGrid.appendChild(cell);
  }

  // 3. Leading days for next month to complete the grid (up to multiple of 7)
  const totalRendered = firstDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalRendered % 7)) % 7;
  for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
    const nextMonthDate = new Date(year, month + 1, nextDay);
    const nextISO = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;

    const cell = createCalendarDayCell(nextDay, nextISO, true, noticesByDate.get(nextISO) || [], todayISO);
    elements.calendarDaysGrid.appendChild(cell);
  }

  // Render notices for selected date
  renderCalendarSelectedDateNotices(noticesByDate.get(state.selectedCalendarDate) || []);
}

/**
 * Creates an individual calendar day cell button.
 */
function createCalendarDayCell(dayNumber, dateISO, isOtherMonth, dayNotices, todayISO) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', `Date ${dateISO}, ${dayNotices.length} notices`);

  const isSelected = dateISO === state.selectedCalendarDate;
  const isToday = dateISO === todayISO;

  let baseClass = 'calendar-day-btn flex flex-col items-center justify-start p-1 sm:p-1.5 rounded-xl border text-xs sm:text-sm font-medium cursor-pointer ';

  if (isSelected) {
    baseClass += 'ring-2 ring-google-blue bg-blue-50/80 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 ';
  } else if (isOtherMonth) {
    baseClass += 'text-slate-300 dark:text-slate-600 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 ';
  } else {
    baseClass += 'text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700/60 bg-white dark:bg-slate-800 ';
  }

  btn.className = baseClass;

  // Day number indicator
  const numSpan = document.createElement('span');
  if (isToday) {
    numSpan.className = 'w-6 h-6 rounded-full bg-google-blue text-white font-bold flex items-center justify-center text-xs shadow-sm';
  } else {
    numSpan.className = 'leading-none py-1';
  }
  numSpan.textContent = dayNumber;
  btn.appendChild(numSpan);

  // Colored dots for notices
  if (dayNotices.length > 0) {
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'flex items-center gap-1 mt-1 flex-wrap justify-center';

    // Show up to 3 colored dots based on status
    const dotsToShow = dayNotices.slice(0, 3);
    dotsToShow.forEach(n => {
      const dot = document.createElement('span');
      const st = computeNoticeStatus(n.date);
      let dotColor = 'bg-slate-400';
      if (st === 'Urgent') dotColor = 'bg-rose-500';
      else if (st === 'Today') dotColor = 'bg-amber-500';
      else if (st === 'Upcoming') dotColor = 'bg-emerald-500';

      dot.className = `w-1.5 h-1.5 rounded-full ${dotColor}`;
      dot.setAttribute('aria-hidden', 'true');
      dotsDiv.appendChild(dot);
    });

    if (dayNotices.length > 3) {
      const moreText = document.createElement('span');
      moreText.className = 'text-[9px] font-bold text-slate-400 leading-none';
      moreText.textContent = '+';
      dotsDiv.appendChild(moreText);
    }

    btn.appendChild(dotsDiv);
  }

  // Click handler
  btn.addEventListener('click', () => {
    state.selectedCalendarDate = dateISO;
    renderCalendarView();
  });

  return btn;
}

/**
 * Renders the notice cards for the date clicked on the calendar.
 */
function renderCalendarSelectedDateNotices(dateNotices) {
  const readable = formatReadableDate(state.selectedCalendarDate);
  elements.calendarSelectedDateHeading.textContent = `Notices for ${readable}`;
  elements.calendarSelectedDateCount.textContent = `${dateNotices.length} notice${dateNotices.length === 1 ? '' : 's'}`;

  elements.calendarSelectedDateList.textContent = '';

  if (dateNotices.length > 0) {
    dateNotices.forEach(notice => {
      const card = createNoticeCardElement(notice, notice.date === getTodayISO());
      elements.calendarSelectedDateList.appendChild(card);
    });
  } else {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 text-center border border-dashed border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-500 dark:text-slate-400';
    emptyCard.textContent = `No notices scheduled for ${readable} matching your search or category filters.`;
    elements.calendarSelectedDateList.appendChild(emptyCard);
  }
}

// ==========================================
// Render All Sections
// ==========================================

function renderAllSections() {
  renderTodaySection();
  if (state.currentView === 'list') {
    renderNoticesList();
  } else {
    renderCalendarView();
  }
}

// ==========================================
// View Switcher (List vs Calendar)
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

    renderNoticesList();
  } else {
    elements.listViewSection.classList.add('hidden');
    elements.calendarViewSection.classList.remove('hidden');

    elements.calendarViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm cursor-pointer';
    elements.calendarViewBtn.setAttribute('aria-pressed', 'true');

    elements.listViewBtn.className = 'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer';
    elements.listViewBtn.setAttribute('aria-pressed', 'false');

    renderCalendarView();
  }
}

// ==========================================
// AI Weekly Summary Engine (Gemini 2.5 Flash via /api/gemini)
// Cached until notices change
// ==========================================

/**
 * Computes a fingerprint hash of all current notices to validate summary cache.
 */
function computeNoticesHash() {
  return state.notices.map(n => `${n.id}:${n.date}:${n.title}`).sort().join('|');
}

/**
 * Handles the "What do I need to know this week?" action.
 */
async function handleGenerateWeeklySummary() {
  const currentHash = computeNoticesHash();

  // Check cache first
  try {
    const rawCache = localStorage.getItem(STORAGE_KEYS.SUMMARY_CACHE);
    if (rawCache) {
      const cached = JSON.parse(rawCache);
      if (cached && cached.hash === currentHash && cached.summary) {
        renderSummaryCard(cached.summary, true);
        showToast('⚡ Loaded cached weekly digest.');
        return;
      }
    }
  } catch (e) {
    console.warn('Error reading summary cache:', e);
  }

  // Get active upcoming notices for this week using isThisWeek
  const todayISO = getTodayISO();
  const weekNotices = state.notices.filter(n => isThisWeek(n.date, todayISO));

  if (weekNotices.length === 0) {
    showToast('ℹ️ No notices found for this week to summarize.');
    return;
  }

  // Loading UI state
  elements.aiSummaryBtn.disabled = true;
  elements.aiSummaryBtn.classList.add('opacity-60', 'cursor-not-allowed');
  elements.aiSummaryBtnIcon.className = 'spinner-icon';
  elements.aiSummaryBtnIcon.textContent = '⏳';
  elements.aiSummaryBtnText.textContent = 'Generating digest...';
  elements.aiSummaryCardContainer.textContent = '';

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'summary',
        items: weekNotices,
        today: todayISO
      })
    });

    if (!response.ok) {
      let errMessage = 'Failed to generate weekly summary.';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) errMessage = errorData.error;
      } catch (_) {}
      renderSummaryErrorCard(errMessage);
      return;
    }

    const payload = await response.json();
    const summaryText = payload.summary;

    if (!summaryText) {
      renderSummaryErrorCard('Received an empty summary from AI.');
      return;
    }

    // Cache result with current hash
    try {
      localStorage.setItem(STORAGE_KEYS.SUMMARY_CACHE, JSON.stringify({
        hash: currentHash,
        summary: summaryText,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not save summary to cache:', e);
    }

    renderSummaryCard(summaryText, false);
    showToast('✨ AI Weekly Digest generated!');
  } catch (err) {
    console.error('Error generating summary:', err);
    renderSummaryErrorCard('Network or server connection failed. Please check your connection and retry.');
  } finally {
    // Restore button state
    elements.aiSummaryBtn.disabled = false;
    elements.aiSummaryBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    elements.aiSummaryBtnIcon.className = '';
    elements.aiSummaryBtnIcon.textContent = '✨';
    elements.aiSummaryBtnText.textContent = 'What do I need to know this week?';
  }
}

/**
 * Renders the AI summary digest card safely using textContent.
 */
function renderSummaryCard(summaryText, isCached = false) {
  elements.aiSummaryCardContainer.textContent = '';

  const card = document.createElement('div');
  card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-indigo-200 dark:border-indigo-800 shadow-soft space-y-3';

  // Header row
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/80';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'flex items-center gap-2';

  const icon = document.createElement('span');
  icon.textContent = '📋';
  icon.className = 'text-lg';
  icon.setAttribute('aria-hidden', 'true');

  const titleH3 = document.createElement('h3');
  titleH3.className = 'text-sm sm:text-base font-bold text-slate-900 dark:text-white';
  titleH3.textContent = "This Week's Campus Digest";

  titleGroup.appendChild(icon);
  titleGroup.appendChild(titleH3);

  if (isCached) {
    const cachedBadge = document.createElement('span');
    cachedBadge.className = 'text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    cachedBadge.textContent = '⚡ Cached';
    titleGroup.appendChild(cachedBadge);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-base px-1 leading-none cursor-pointer';
  dismissBtn.setAttribute('aria-label', 'Close weekly summary');
  dismissBtn.textContent = '✕';
  dismissBtn.addEventListener('click', () => {
    elements.aiSummaryCardContainer.textContent = '';
  });

  header.appendChild(titleGroup);
  header.appendChild(dismissBtn);
  card.appendChild(header);

  // Body content: parse line by line safely using textContent
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'space-y-1.5';

  const lines = summaryText.split('\n');
  let activeList = null;

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      activeList = null;
      return;
    }

    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
      if (!activeList) {
        activeList = document.createElement('ul');
        activeList.className = 'list-disc pl-5 space-y-1 my-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300';
        bodyDiv.appendChild(activeList);
      }
      const li = document.createElement('li');
      li.textContent = line.replace(/^[\*\-•]\s*/, '');
      activeList.appendChild(li);
    } else if (line.startsWith('#')) {
      activeList = null;
      const h = document.createElement('h4');
      h.className = 'font-bold text-xs sm:text-sm text-slate-900 dark:text-white pt-1.5';
      h.textContent = line.replace(/^#+\s*/, '');
      bodyDiv.appendChild(h);
    } else {
      activeList = null;
      const p = document.createElement('p');
      p.className = 'text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed';
      p.textContent = line;
      bodyDiv.appendChild(p);
    }
  });

  card.appendChild(bodyDiv);
  elements.aiSummaryCardContainer.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Renders a friendly error card for AI summary failure with a Retry button.
 */
function renderSummaryErrorCard(errorMessage) {
  elements.aiSummaryCardContainer.textContent = '';

  const errCard = document.createElement('div');
  errCard.className = 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 shadow-soft space-y-2';

  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-200';
  const icon = document.createElement('span');
  icon.textContent = '⚠️';
  const title = document.createElement('span');
  title.textContent = 'Weekly Summary Failed';
  titleRow.appendChild(icon);
  titleRow.appendChild(title);
  errCard.appendChild(titleRow);

  const desc = document.createElement('p');
  desc.className = 'text-xs sm:text-sm text-rose-700 dark:text-rose-300 leading-relaxed';
  desc.textContent = errorMessage;
  errCard.appendChild(desc);

  const actionRow = document.createElement('div');
  actionRow.className = 'flex items-center gap-2 pt-1';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-google-blue hover:bg-google-blueHover cursor-pointer shadow-sm active:scale-95 transition-all';
  retryBtn.textContent = '🔄 Retry';
  retryBtn.addEventListener('click', handleGenerateWeeklySummary);

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', () => {
    elements.aiSummaryCardContainer.textContent = '';
  });

  actionRow.appendChild(retryBtn);
  actionRow.appendChild(dismissBtn);
  errCard.appendChild(actionRow);

  elements.aiSummaryCardContainer.appendChild(errCard);
}

// ==========================================
// AI Notice Extraction Engine (Gemini 2.5 Flash via /api/gemini)
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

    // Validate using pure helper validateNotice
    const validation = validateNotice({
      title: finalTitle,
      date: finalDate,
      time: finalTime,
      venue: finalVenue,
      category: finalCategory,
      description: finalDesc
    });

    if (!validation.valid) {
      showToast('⚠️ ' + validation.errors[0]);
      if (validation.errors[0].toLowerCase().includes('title')) {
        titleInput.focus();
      }
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
    renderAllSections();
  });

  // Clear search input button
  elements.clearSearchBtn.addEventListener('click', () => {
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hidden');
    elements.searchInput.focus();
    renderAllSections();
  });

  // View Switchers
  elements.listViewBtn.addEventListener('click', () => setView('list'));
  elements.calendarViewBtn.addEventListener('click', () => setView('calendar'));

  // Calendar Controls
  elements.calendarPrevMonthBtn.addEventListener('click', () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
    renderCalendarView();
  });

  elements.calendarNextMonthBtn.addEventListener('click', () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    }
    renderCalendarView();
  });

  elements.calendarTodayJumpBtn.addEventListener('click', () => {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth();
    state.selectedCalendarDate = getTodayISO();
    renderCalendarView();
  });

  // AI Weekly Summary Button
  elements.aiSummaryBtn.addEventListener('click', handleGenerateWeeklySummary);

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
  state.selectedCalendarDate = getTodayISO();
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
