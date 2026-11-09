const cheerio = require('cheerio');
const { extractDatesAndMeta } = require('./classifier');

/**
 * Fetches an HTML page with proper charset decoding (handles UTF-8 and EUC-KR/CP949)
 */
async function fetchHtmlWithCharset(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 9000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    let charset = 'utf-8';
    if (contentType.includes('euc-kr') || contentType.includes('ks_c_5601')) {
      charset = 'euc-kr';
    } else {
      // Peek first 1024 bytes for meta charset
      const headAscii = new TextDecoder('ascii').decode(buf.slice(0, 1024)).toLowerCase();
      if (headAscii.includes('euc-kr') || headAscii.includes('ks_c_5601')) {
        charset = 'euc-kr';
      }
    }
    return new TextDecoder(charset).decode(buf);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extracts rich detail content, structured fields, and attachment files from a government/council notice page
 */
async function extractNoticeDetail(url) {
  const html = await fetchHtmlWithCharset(url);
  const $ = cheerio.load(html);

  // Remove noisy scripts/styles/menus
  $('script, style, noscript, header, footer, nav, .gnb, .lnb, .snb, #header, #footer, .skip_nav').remove();

  // Candidate content selectors used across Korean local governments (Saeol, eGovFrame, Council CMS)
  const contentSelectors = [
    '.bod_view .view_cont',
    '.bod_view',
    '.board_view',
    '.bbs_view',
    '.view_con',
    '.view_content',
    '.bbs_detail',
    '.p-media--body',
    'table.board_view',
    'table.bbs_view',
    '.tbl_view',
    '#contents',
    '.sub_content',
    '.content_body',
    'article',
    'main'
  ];

  let mainEl = null;
  for (const sel of contentSelectors) {
    const found = $(sel).first();
    if (found.length && found.text().trim().length > 60) {
      mainEl = found;
      break;
    }
  }
  if (!mainEl) {
    mainEl = $('body');
  }

  // Convert <br>, <p>, <li>, <tr> to line breaks for clean readable text
  mainEl.find('br').replaceWith('\n');
  mainEl.find('p, div, li, tr, h3, h4, dt, dd').each((_, el) => {
    $(el).append('\n');
  });

  const rawBodyText = mainEl
    .text()
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Extract full-page info box (e.g. .view_info, table headers)
  const fullViewText = ($('.bod_view, .board_view, .bbs_view, #contents').first().text() || rawBodyText)
    .replace(/\s+/g, ' ')
    .trim();

  // Extract attachments (.hwp, .hwpx, .pdf, .doc, .docx, .xls, .xlsx, .zip)
  const attachments = [];
  const seenFiles = new Set();

  $('a').each((_, el) => {
    const a = $(el);
    const text = a.text().replace(/바로\s*보기|미리\s*보기|다운로드|새창으로\s*열림/g, '').replace(/\s+/g, ' ').trim();
    const onclick = a.attr('onclick') || '';
    const href = a.attr('href') || '';

    const fileMatch = text.match(/([^\n/\\]+\.(?:hwpx?|pdf|docx?|xlsx?|zip|jpg|png))/i) ||
                      onclick.match(/['"]([^'"]+\.(?:hwpx?|pdf|docx?|xlsx?|zip))['"]/i);

    if (fileMatch) {
      const fileName = fileMatch[1].trim();
      if (!seenFiles.has(fileName)) {
        seenFiles.add(fileName);
        let downloadUrl = url;
        // Saeol e-minwon direct download pattern (like Gwacheon)
        const goDownMatch = onclick.match(/goDownload\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
        if (goDownMatch) {
          try {
            const u = new URL(url);
            const baseDomain = u.hostname.replace(/^www\./, '');
            downloadUrl = `https://eminwon.${baseDomain}/emwp/jsp/ofr/FileDown.jsp?user_file_nm=${encodeURIComponent(goDownMatch[1])}&sys_file_nm=${encodeURIComponent(goDownMatch[2])}&file_path=${encodeURIComponent(goDownMatch[3])}`;
          } catch {}
        } else if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            downloadUrl = new URL(href, url).href;
          } catch {}
        }
        attachments.push({ fileName, downloadUrl });
      }
    }
  });

  // Extract email addresses in the notice
  const emails = [...new Set((rawBodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))];

  // Extract phone numbers
  const phones = [...new Set(( `${fullViewText} ${rawBodyText}`.match(/0\d{1,2}-\d{3,4}-\d{4}/g) || []))];

  // Parse structured meta
  const parsedMeta = extractDatesAndMeta('', `${fullViewText}\n${rawBodyText}`);

  // Extract recruitment fields (모집분야)
  let recruitFieldText = '';
  const fieldBlockMatch = rawBodyText.match(/(?:모집\s*분야|모집\s*부문|전문\s*분야|위촉\s*분야)[^\n]*\n?([^\n]{5,120})/);
  if (fieldBlockMatch) {
    recruitFieldText = fieldBlockMatch[0].replace(/\s+/g, ' ').trim();
  }

  return {
    bodyText: rawBodyText.slice(0, 6000),
    attachments,
    emails,
    phones,
    recruitFieldText,
    ...parsedMeta
  };
}

module.exports = {
  fetchHtmlWithCharset,
  extractNoticeDetail
};
