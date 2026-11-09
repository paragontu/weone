const cheerio = require('cheerio');
const {
  REGIONS,
  isValidCommitteeNotice,
  classifyOrganization,
  classifyCommittee,
  extractDatesAndMeta
} = require('./classifier');
const { fetchHtmlWithCharset, extractNoticeDetail } = require('./detailExtractor');

/**
 * Generates a stable ID from a notice URL or (orgName + title)
 */
function makeNoticeId(url = '', title = '') {
  const cleanUrl = url
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/&?mId=\d+/i, '')
    .replace(/&?menuNo=\d+/i, '')
    .replace(/&?page=\d+/i, '');
  const base = cleanUrl || title;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return 'nt_' + Math.abs(hash).toString(36) + '_' + Buffer.from(base).toString('base64url').slice(0, 14);
}

/**
 * Direct Scraper for Gwacheon City Saeol Gosi/Gonggo (and standard Saeol list.do portals)
 */
async function scrapeGwacheonSaeol(pages = 3) {
  const results = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch('https://www.gccity.go.kr/portal/saeol/gosi/list.do?mId=0301040000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: `page=${page}&searchType=&searchTxt=`
      });
      const html = await res.text();
      const $ = cheerio.load(html);

      $('table tbody tr').each((_, tr) => {
        const $tr = $(tr);
        const tds = $tr.find('td');
        if (tds.length < 5) return;

        const docNo = $(tds[1]).text().replace(/\s+/g, ' ').trim();
        const $a = $tr.find('td.list_tit a');
        const title = $a.text().replace(/\s+/g, ' ').trim();
        const actionPath = $a.attr('data-action') || $a.attr('href') || '';
        const dept = $(tds[3]).text().replace(/\s+/g, ' ').trim();
        const regDate = $(tds[4]).text().replace(/\s+/g, ' ').trim();

        if (!title || !isValidCommitteeNotice(title, '')) return;

        const fullUrl = actionPath.startsWith('http')
          ? actionPath
          : `https://www.gccity.go.kr${actionPath}`;

        const orgInfo = classifyOrganization(fullUrl, '과천시청', title, '');
        const commInfo = classifyCommittee(title, '', orgInfo.orgType);
        const meta = extractDatesAndMeta(regDate, `${docNo} ${title}`);

        results.push({
          id: makeNoticeId(fullUrl, title),
          url: fullUrl,
          title,
          snippet: `${docNo ? `[${docNo}] ` : ''}담당부서: ${dept} | 과천시 고시/공고 게시 원문`,
          region: orgInfo.region,
          subRegion: orgInfo.subRegion,
          orgName: orgInfo.orgName,
          orgType: orgInfo.orgType,
          category: commInfo.category,
          fields: commInfo.fields,
          publishedDate: meta.publishedDate,
          deadline: meta.deadline,
          periodText: meta.periodText,
          quota: meta.quota,
          applyMethod: meta.applyMethod,
          contact: dept || meta.contact,
          docNo: docNo || meta.docNo,
          sourceType: '지자체 직접수집 (새올 고시/공고)',
          collectedAt: new Date().toISOString()
        });
      });
    } catch (err) {
      // continue next page
    }
  }

  // Enrich Gwacheon notices with their detail page so 모집기간/마감일/모집분야/첨부파일 are immediately populated!
  for (const item of results) {
    try {
      const detail = await extractNoticeDetail(item.url);
      item.detail = detail;
      if (detail.deadline) item.deadline = detail.deadline;
      if (detail.periodText) item.periodText = detail.periodText;
      if (detail.quota) item.quota = detail.quota;
      if (detail.applyMethod) item.applyMethod = detail.applyMethod;
      if (detail.contact) item.contact = detail.contact;
      if (detail.docNo) item.docNo = detail.docNo;
      if (detail.bodyText) {
        item.snippet = detail.bodyText.replace(/\s+/g, ' ').slice(0, 260);
      }
      const commInfo = classifyCommittee(item.title, detail.bodyText || '', item.orgType);
      item.category = commInfo.category;
      item.fields = commInfo.fields;
    } catch {}
  }

  return results;
}

/**
 * Parses Naver Web Search HTML (`where=web`) for `.go.kr` notices
 */
function parseSearchCards(html) {
  const parts = html.split('data-sds-comp="Profile"').slice(1);
  const parsed = [];

  for (const p of parts) {
    const anchors = [...p.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({
        url: m[1].replace(/&amp;/g, '&'),
        text: m[2]
          .replace(/<span class="F31e0waVw4P_4ejC">새 창 열림<\/span>/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim()
      }))
      .filter(a => !a.url.includes('naver.com') && a.text && a.text !== '새 창 열림');

    if (anchors.length < 2) continue;

    const brandMatch = p.match(/data-heatmap-target="\.brand"[^>]*>([\s\S]*?)<\/a>/i);
    const brand = brandMatch
      ? brandMatch[1].replace(/<span[^>]*>새 창 열림<\/span>/g, '').replace(/<[^>]+>/g, '').trim()
      : anchors[0].text;

    // Filter out breadcrumb links (containing '›') and brand link
    const contentLinks = anchors.filter(a => !a.text.includes('›') && a.text !== brand);

    let dateRaw = '';
    let title = '';
    let snippet = '';
    let targetUrl = '';

    // Check if contentLinks[0] is a date string like '3주 전', '오늘', '2026. 10. 28.', '1시간 이내'
    const datePattern = /^(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?|\d+\s*(?:시간|분|일|주|개월)\s*(?:전|이내)|오늘|어제)$/;
    if (contentLinks.length >= 2 && datePattern.test(contentLinks[0].text)) {
      dateRaw = contentLinks[0].text;
      title = contentLinks[1].text;
      targetUrl = contentLinks[1].url;
      snippet = contentLinks[2] ? contentLinks[2].text : '';
    } else if (contentLinks.length >= 1) {
      title = contentLinks[0].text;
      targetUrl = contentLinks[0].url;
      snippet = contentLinks[1] ? contentLinks[1].text : '';
      const dm = p.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?|\d+\s*(?:시간|분|일|주)\s*(?:전|이내)|오늘)/);
      if (dm) dateRaw = dm[1];
    }

    if (!title || !targetUrl) continue;

    // Must be a government / council / public institution domain (.go.kr or .seoul.kr or .incheon.kr or .gangwon.kr or .nowon.kr or .or.kr)
    let hostname = '';
    try {
      hostname = new URL(targetUrl).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!/\.(go\.kr|seoul\.kr|incheon\.kr|gangwon\.kr|busan\.kr|daegu\.kr|ulsan\.kr|kr)$/.test(hostname)) {
      continue;
    }
    // Exclude central career/portal sites if not local government/council, unless relevant
    if (hostname.includes('narajangteo') || hostname.includes('work.go.kr')) continue;

    if (!isValidCommitteeNotice(title, snippet)) continue;

    const orgInfo = classifyOrganization(targetUrl, brand, title, snippet);
    const commInfo = classifyCommittee(title, snippet, orgInfo.orgType);
    const meta = extractDatesAndMeta(dateRaw, `${title} ${snippet}`);

    parsed.push({
      id: makeNoticeId(targetUrl, title),
      url: targetUrl,
      title,
      snippet,
      region: orgInfo.region,
      subRegion: orgInfo.subRegion,
      orgName: orgInfo.orgName,
      orgType: orgInfo.orgType,
      category: commInfo.category,
      fields: commInfo.fields,
      publishedDate: meta.publishedDate,
      deadline: meta.deadline,
      periodText: meta.periodText,
      quota: meta.quota,
      applyMethod: meta.applyMethod,
      contact: meta.contact,
      docNo: meta.docNo,
      sourceType: orgInfo.orgType.includes('의회') ? '지방의회 고시/공고' : '지자체 고시/공고',
      collectedAt: new Date().toISOString()
    });
  }

  return parsed;
}

/**
 * Executes a single search query against Naver web search (`where=web`) with recency filter (`p:1m` or `p:3m`)
 */
async function harvestByQuery(queryStr, period = '1m', sort = 'r') {
  const q = encodeURIComponent(queryStr);
  const url = `https://search.naver.com/search.naver?where=web&query=${q}&sm=tab_opt&nso=so%3A${sort}%2Cp%3A${period}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseSearchCards(html);
  } catch (err) {
    return [];
  }
}

/**
 * Runs a batch of queries with concurrency control and progress callback
 */
async function runQueryBatch(queries, { concurrency = 3, delayMs = 220, period = '1m', onProgress } = {}) {
  const allItems = [];
  let completed = 0;

  for (let i = 0; i < queries.length; i += concurrency) {
    const slice = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      slice.map(q => harvestByQuery(q.query, q.period || period, q.sort || 'r'))
    );
    for (const items of batchResults) {
      allItems.push(...items);
    }
    completed += slice.length;
    if (onProgress) {
      onProgress({
        completed,
        total: queries.length,
        currentLabel: slice[slice.length - 1].label,
        foundCount: allItems.length
      });
    }
    if (i + concurrency < queries.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Enrich items that don't have a deadline yet by fetching their detail page
  const needDetail = allItems.filter(it => !it.deadline);
  const detConcurrency = 8;
  for (let i = 0; i < needDetail.length; i += detConcurrency) {
    const batch = needDetail.slice(i, i + detConcurrency);
    await Promise.all(batch.map(async (item) => {
      try {
        const detail = await extractNoticeDetail(item.url);
        item.detail = detail;
        if (detail.deadline) item.deadline = detail.deadline;
        if (detail.periodText) item.periodText = detail.periodText;
        if (detail.quota && !item.quota) item.quota = detail.quota;
        if (detail.applyMethod && !item.applyMethod) item.applyMethod = detail.applyMethod;
        if (detail.contact && !item.contact) item.contact = detail.contact;
        if (detail.docNo && !item.docNo) item.docNo = detail.docNo;
      } catch {}
    }));
  }

  return allItems;
}

function getCurrentYearMonthTokens() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return {
    ymDot: `${y}. ${m}.`,
    mKor: `${m}월`,
    todayStr: `${y}-${String(m).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  };
}

/**
 * Built-in Query Presets covering Nationwide 17 Regions, Basic/Metro Governments, and Local Councils
 * Specifically targets active notices containing current recruitment period dates
 */
function buildHarvestQueries(mode = 'standard', options = {}) {
  const { ymDot, mKor } = getCurrentYearMonthTokens();

  if (mode === 'custom' && options.keyword) {
    const kw = options.keyword.trim();
    return [
      { label: `'${kw}' 지자체 위원 모집 (${mKor})`, query: `site:go.kr "${kw}" "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `'${kw}' 공개모집 공고`, query: `site:go.kr "${kw}" "위원" "모집기간"`, period: '1m' },
      { label: `'${kw}' 지방의회 위원 모집`, query: `site:go.kr "의회" "${kw}" "위원" "모집"`, period: '1m' }
    ];
  }

  if (mode === 'council') {
    // Deep sweep for Provincial, City, District, and County Councils (도의회, 시의회, 구의회, 군의회)
    return [
      { label: '전국 지방의회 위원 공개모집 (최신)', query: `site:go.kr "의회" "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: '전국 지방의회 민간위원 모집기간 공고', query: 'site:go.kr "의회" "민간위원" "모집기간"', period: '3m' },
      { label: '지방의회 공무국외출장 심사위원 모집', query: 'site:go.kr "의회" "공무국외출장" "위원" "모집기간"', period: '3m' },
      { label: '지방의회 의원연구단체 심의위원 모집', query: 'site:go.kr "의회" "의원연구단체" "위원" "모집"', period: '3m' },
      { label: '지방의회 윤리심사자문위원 모집', query: 'site:go.kr "의회" "윤리심사" "위원" "모집"', period: '3m' },
      { label: '지방의회 결산검사위원 모집', query: 'site:go.kr "의회" "결산검사위원" "모집"', period: '3m' },
      { label: '시의회 위원 모집 공고', query: `site:go.kr "시의회" "위원" "모집" "${ymDot}"`, period: '3m' },
      { label: '구의회 위원 모집 공고', query: `site:go.kr "구의회" "위원" "모집" "${ymDot}"`, period: '3m' },
      { label: '군의회 위원 모집 공고', query: `site:go.kr "군의회" "위원" "모집" "${ymDot}"`, period: '3m' },
      { label: '도의회·광역의회 위원 모집 공고', query: `site:go.kr "도의회" "위원" "모집" "${ymDot}"`, period: '3m' }
    ];
  }

  if (mode === 'region' && options.region && options.region !== '전체') {
    const regObj = REGIONS.find(r => r.code === options.region);
    const regName = regObj ? regObj.code : options.region;
    return [
      { label: `${regName} 위원 모집 (${mKor})`, query: `site:go.kr "${regName}" "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `${regName} 민간위원·심의위원 모집기간`, query: `site:go.kr "${regName}" "위원" "모집기간" "공고"`, period: '1m' },
      { label: `${regName} 제안서 평가위원 접수기간`, query: `site:go.kr "${regName}" "평가위원" "접수기간"`, period: '1m' },
      { label: `${regName} 자문위원·협의체 위원 모집`, query: `site:go.kr "${regName}" "자문위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `${regName} 지방의회 위원 모집`, query: `site:go.kr "${regName}" "의회" "위원" "모집"`, period: '3m' }
    ];
  }

  if (mode === 'nationwide_full') {
    const list = [
      { label: `전국 위원 모집 공고 (${mKor} 마감/진행)`, query: `site:go.kr "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `전국 위원 공개모집 접수기간 (${mKor})`, query: `site:go.kr "위원" "접수기간" "${ymDot}"`, period: '1m' },
      { label: `전국 심의위원회 위원 모집기간 (${mKor})`, query: `site:go.kr "심의위원회" "위원" "모집기간" "${ymDot}"`, period: '1m' },
      { label: `전국 제안서 평가위원 모집 (${mKor})`, query: `site:go.kr "평가위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `전국 수탁기관 선정심의위원 모집 (${mKor})`, query: `site:go.kr "선정심의" "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `전국 자문위원·협의체 위원 모집 (${mKor})`, query: `site:go.kr "자문위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `전국 주민참여예산위원 모집 (${mKor})`, query: `site:go.kr "주민참여" "위원" "모집" "${ymDot}"`, period: '1m' },
      { label: `전국 지방의회 위원 공개모집 (${mKor})`, query: `site:go.kr "의회" "위원" "모집" "${ymDot}"`, period: '3m' }
    ];
    for (const r of REGIONS) {
      list.push({
        label: `[${r.code}] 지역 지자체·의회 위원 모집 (${mKor})`,
        query: `site:go.kr "${r.code}" "위원" "모집" "${ymDot}"`,
        period: '1m'
      });
    }
    return list;
  }

  // Default 'standard' fast sweep
  return [
    { label: `전국 지자체 위원 공개모집 (${mKor})`, query: `site:go.kr "위원 공개모집" "${ymDot}"`, period: '1m' },
    { label: `전국 민간위원 모집 공고 (${mKor})`, query: `site:go.kr "민간위원" "모집" "${ymDot}"`, period: '1m' },
    { label: `전국 수탁기관 선정심의위원 모집 (${mKor})`, query: `site:go.kr "선정심의위원회" "위원" "${ymDot}"`, period: '1m' },
    { label: `전국 심의위원회 위원 모집기간 (${mKor})`, query: `site:go.kr "심의위원회" "모집기간" "${ymDot}"`, period: '1m' },
    { label: `전국 제안서 평가위원 접수기간 (${mKor})`, query: `site:go.kr "평가위원" "접수기간" "${ymDot}"`, period: '1m' },
    { label: `전국 자문위원회 위원 모집 (${mKor})`, query: `site:go.kr "자문위원" "모집" "${ymDot}"`, period: '1m' },
    { label: `전국 주민참여·협의체 위원 모집 (${mKor})`, query: `site:go.kr "협의체" "위원" "모집" "${ymDot}"`, period: '1m' },
    { label: `전국 도의회·시의회·구의회 위원 모집 (${mKor})`, query: `site:go.kr "의회" "위원" "모집" "${ymDot}"`, period: '3m' },
    { label: '지방의회 공무국외출장·연구단체 위원 모집', query: 'site:go.kr "의회" "심사위원회" "위원" "모집기간"', period: '3m' },
    { label: '서울·경기·인천 위원 모집기간 공고', query: `site:go.kr "경기도" OR "서울" OR "인천" "위원" "모집기간" "${ymDot}"`, period: '1m' },
    { label: '부산·대구·경남·경북 위원 모집기간 공고', query: `site:go.kr "부산" OR "대구" OR "경남" OR "경북" "위원" "${ymDot}"`, period: '1m' },
    { label: '광주·대전·울산·세종·강원 위원 모집기간 공고', query: `site:go.kr "광주" OR "대전" OR "강원" OR "세종" "위원" "${ymDot}"`, period: '1m' },
    { label: '충북·충남·전북·전남·제주 위원 모집기간 공고', query: `site:go.kr "충남" OR "충북" OR "전남" OR "전북" OR "제주" "위원" "${ymDot}"`, period: '1m' }
  ];
}

module.exports = {
  makeNoticeId,
  scrapeGwacheonSaeol,
  harvestByQuery,
  runQueryBatch,
  buildHarvestQueries
};
