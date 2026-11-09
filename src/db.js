const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const NOTICES_FILE = path.join(DATA_DIR, 'notices.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_DATA_DIR)) {
    fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  }
}

function getTodayKstStr() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function isNoticeNotExpired(notice, todayStr = getTodayKstStr()) {
  if (!notice || !notice.deadline) return false;
  return notice.deadline >= todayStr;
}

function loadNotices() {
  ensureDataDir();
  if (!fs.existsSync(NOTICES_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(NOTICES_FILE, 'utf-8'));
    const todayStr = getTodayKstStr();
    return raw.filter(n => isNoticeNotExpired(n, todayStr));
  } catch {
    return [];
  }
}

function saveNotices(notices) {
  ensureDataDir();
  const json = JSON.stringify(notices, null, 2);
  fs.writeFileSync(NOTICES_FILE, json, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'notices.json'), json, 'utf-8');
}

function loadMeta() {
  ensureDataDir();
  const defaults = {
    lastSyncAt: null,
    totalSyncRuns: 0,
    lastAddedCount: 0,
    autoRefreshMinutes: 30,
    watchKeywords: ['민간위탁', '수탁기관', '제안서 평가위원', '도시계획', '주민참여예산', '공무국외출장']
  };
  if (!fs.existsSync(META_FILE)) return defaults;
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) };
  } catch {
    return defaults;
  }
}

function saveMeta(meta) {
  ensureDataDir();
  const json = JSON.stringify(meta, null, 2);
  fs.writeFileSync(META_FILE, json, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'meta.json'), json, 'utf-8');
}

function normalizeTitleKey(orgName = '', title = '') {
  return `${orgName}__${title.replace(/[\s「」『』[\]()（）·.,-]/g, '').toLowerCase()}`;
}

/**
 * Upserts newly scraped notices into the persistent DB, preserving user bookmarks/status/notes/details
 */
function upsertNotices(newItems = []) {
  const existing = loadNotices();
  const byId = new Map();
  const byTitleKey = new Map();

  for (const item of existing) {
    byId.set(item.id, item);
    byTitleKey.set(normalizeTitleKey(item.orgName, item.title), item);
  }

  const todayStr = getTodayKstStr();
  let addedCount = 0;
  let updatedCount = 0;

  for (const raw of newItems) {
    if (!isNoticeNotExpired(raw, todayStr)) continue;
    const titleKey = normalizeTitleKey(raw.orgName, raw.title);
    const prev = byId.get(raw.id) || byTitleKey.get(titleKey);

    if (prev) {
      // Merge while keeping user state and any richer extracted fields
      prev.title = raw.title || prev.title;
      prev.snippet = (raw.snippet && raw.snippet.length > (prev.snippet || '').length) ? raw.snippet : prev.snippet;
      prev.region = raw.region !== '기타' ? raw.region : prev.region;
      prev.subRegion = raw.subRegion || prev.subRegion;
      prev.orgName = raw.orgName || prev.orgName;
      prev.orgType = raw.orgType || prev.orgType;
      prev.category = raw.category || prev.category;
      prev.fields = raw.fields?.length ? raw.fields : prev.fields;
      prev.deadline = raw.deadline || prev.deadline;
      prev.periodText = raw.periodText || prev.periodText;
      prev.quota = raw.quota || prev.quota;
      prev.applyMethod = raw.applyMethod || prev.applyMethod;
      prev.contact = raw.contact || prev.contact;
      prev.docNo = raw.docNo || prev.docNo;
      if (raw.detail) prev.detail = raw.detail;
      prev.updatedAt = new Date().toISOString();
      updatedCount++;
    } else {
      const created = {
        ...raw,
        bookmarked: false,
        userStatus: 'none', // 'none' | 'interested' | 'preparing' | 'applied' | 'ignored'
        userMemo: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      byId.set(created.id, created);
      byTitleKey.set(titleKey, created);
      addedCount++;
    }
  }

  const merged = Array.from(byId.values())
    .filter(item => isNoticeNotExpired(item, todayStr))
    .sort((a, b) => {
      if (b.publishedDate !== a.publishedDate) {
        return (b.publishedDate || '').localeCompare(a.publishedDate || '');
      }
      return (a.deadline || '').localeCompare(b.deadline || '');
    });

  saveNotices(merged);
  return { total: merged.length, addedCount, updatedCount };
}

module.exports = {
  getTodayKstStr,
  isNoticeNotExpired,
  loadNotices,
  saveNotices,
  loadMeta,
  saveMeta,
  upsertNotices
};
