const guideNav = document.querySelector('[data-guide-nav]');
const guideContent = document.querySelector('[data-guide-content]');
const templateNav = document.querySelector('[data-template-nav]');
const templateContent = document.querySelector('[data-template-content]');
const searchInput = document.querySelector('[data-search]');
const guideEmpty = document.querySelector('[data-guide-empty]');
const templateEmpty = document.querySelector('[data-template-empty]');
const toast = document.querySelector('[data-toast]');
const copyAllButton = document.querySelector('[data-copy-all]');
const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.site-nav');

let guideSections = [];
let templates = [];
let templateSource = '';
let toastTimer;

// Navigation must work immediately, even while the long guide file is still loading.
// Keeping this outside init() also makes the menu resilient to a content fetch error.
function bindMobileNavigation() {
  if (!menuButton || !mainNav || menuButton.dataset.bound === 'true') return;
  menuButton.dataset.bound = 'true';

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mainNav.classList.toggle('is-open', !open);
  });

  mainNav.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    menuButton.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  });
}

bindMobileNavigation();

const escapeHtml = (value = '') => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const inlineMarkdown = (text) => escapeHtml(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/“([^”]+)”/g, '<q>$1</q>');

function splitByHeading(text, level = 2) {
  const marker = '#'.repeat(level);
  const regex = new RegExp(`^${marker} (.+)$`, 'gm');
  const matches = [...text.matchAll(regex)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return { title: match[1].trim(), body: text.slice(start, end).trim() };
  });
}

function renderTable(lines, start) {
  const rows = [];
  let index = start;
  while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
    rows.push(lines[index].trim().slice(1, -1).split('|').map((cell) => cell.trim()));
    index += 1;
  }
  if (rows.length < 2 || !rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
  const [head, , ...body] = rows;
  const html = `<div class="table-scroll"><table><thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return { html, next: index };
}

function renderMarkdown(markdown) {
  const lines = markdown.split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType || !listItems.length) return;
    output.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (/^\|.*\|$/.test(line)) {
      const table = renderTable(lines, index);
      if (table) {
        flushParagraph();
        flushList();
        output.push(table.html);
        index = table.next;
        continue;
      }
    }
    if (!line) {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }
    if (line === '---') {
      flushParagraph();
      flushList();
      output.push('<hr />');
      index += 1;
      continue;
    }
    if (line.startsWith('#### ')) {
      flushParagraph();
      flushList();
      output.push(`<h4>${inlineMarkdown(line.slice(5))}</h4>`);
      index += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      index += 1;
      continue;
    }
    const bullet = line.match(/^[-*] (.+)$/);
    const numbered = line.match(/^\d+\. (.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextType = bullet ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((bullet || numbered)[1]);
      index += 1;
      continue;
    }
    if (listType) flushList();
    paragraph.push(line);
    index += 1;
  }
  flushParagraph();
  flushList();
  return output.join('');
}

function parseDocument(raw) {
  const partMarker = '# ภาคที่ 2: แม่แบบสำหรับกรอกข้อมูล';
  const partIndex = raw.indexOf(partMarker);
  const guideSource = partIndex >= 0 ? raw.slice(0, partIndex) : raw;
  templateSource = partIndex >= 0 ? raw.slice(partIndex) : '';
  guideSections = splitByHeading(guideSource).filter(({ title }) => /^\d+\./.test(title));
  templates = splitByHeading(templateSource).filter(({ title }) => /^[A-Q]\./.test(title));

  // The published guide is expected to contain all 19 chapters and templates A–Q.
  // Fail visibly instead of silently publishing an incomplete archive.
  if (guideSections.length !== 19 || templates.length !== 17) {
    throw new Error(`เนื้อหาไม่ครบ: พบคู่มือ ${guideSections.length}/19 บท และแม่แบบ ${templates.length}/17 ชุด`);
  }
}

function renderGuide() {
  const groups = [
    { range: '01—05', title: 'เริ่มต้นและแกนเรื่อง', note: 'วางทิศทางก่อนเขียน', ids: [1, 2, 3, 4, 5] },
    { range: '06—10', title: 'โลกและตัวละคร', note: 'ทำให้แต่ละคนมีชีวิต', ids: [6, 7, 8, 9, 10] },
    { range: '11—15', title: 'ความสัมพันธ์และฉาก', note: 'ให้เรื่องเดินต่อเอง', ids: [11, 12, 13, 14, 15] },
    { range: '16—19', title: 'ความจำและการทดสอบ', note: 'ตรวจให้พร้อมเผยแพร่', ids: [16, 17, 18, 19] }
  ];
  guideNav.innerHTML = groups.map((group, index) => `<button class="guide-group-button${index === 0 ? ' is-active' : ''}" type="button" data-guide-group="${index}" aria-controls="guide-group-${index}" aria-selected="${index === 0}"><span>${group.range}</span><strong>${group.title}</strong><small>${group.note} · ${group.ids.length} บท</small></button>`).join('');
  guideContent.innerHTML = groups.map((group, groupIndex) => `<section class="guide-panel" id="guide-group-${groupIndex}" data-guide-panel="${groupIndex}"${groupIndex === 0 ? '' : ' hidden'}><header class="guide-panel-heading"><div><p>หมวด ${group.range}</p><h3>${group.title}</h3></div><span>${group.note}</span></header><div class="guide-chapters">${group.ids.map((id) => {
    const section = guideSections[id - 1];
    if (!section) return '';
    const number = String(id).padStart(2, '0');
    const label = section.title.replace(/^\d+\.\s*/, '');
    return `<details class="guide-card" id="guide-${id}" data-search-text="${escapeHtml(`${section.title} ${section.body}`.toLowerCase())}"><summary><span class="guide-number">${number}</span><span class="guide-card-heading"><strong>${escapeHtml(label)}</strong><small>บทที่ ${number} · คำอธิบายและวิธีใช้</small></span><span class="guide-open-label">เปิดอ่าน</span></summary><div class="guide-card-body">${renderMarkdown(section.body)}</div></details>`;
  }).join('')}</div></section>`).join('');
}

function renderTemplates() {
  templateNav.innerHTML = templates.map(({ title }) => {
    const letter = title.slice(0, 1);
    return `<a href="#template-${letter}">${escapeHtml(title)}</a>`;
  }).join('');

  templateContent.innerHTML = templates.map(({ title, body }, index) => {
    const letter = title.slice(0, 1);
    const label = title.replace(/^[A-Q]\.\s*/, '');
    const codeMatch = body.match(/```([^\n]*)\n([\s\S]*?)```/);
    const language = codeMatch?.[1]?.trim() || 'text';
    const code = codeMatch?.[2]?.trim() || body;
    const description = body.replace(/```[^\n]*\n[\s\S]*?```/, '').trim();
    return `<details class="template-sheet" id="template-${letter}" ${index === 0 ? 'open' : ''} data-search-text="${escapeHtml(`${title} ${body}`.toLowerCase())}">
      <summary>
        <span class="template-letter">${letter}</span>
        <span><h3>${escapeHtml(label)}</h3><small>${language === 'yaml' ? 'โครงสร้างข้อมูล YAML' : 'คำสั่งพร้อมใช้'}</small></span>
        <span class="summary-arrow" aria-hidden="true">→</span>
      </summary>
      <div class="template-inner">
        ${description ? `<p class="template-description">${inlineMarkdown(description)}</p>` : ''}
        <div class="code-panel">
          <div class="code-toolbar"><span>${escapeHtml(language)}</span><button class="copy-button" type="button" data-copy-template="${letter}"><svg aria-hidden="true"><use href="#icon-copy"></use></svg><span>คัดลอก</span></button></div>
          <pre tabindex="0"><code>${escapeHtml(code)}</code></pre>
        </div>
      </div>
    </details>`;
  }).join('');
}

function showToast(message) {
  toast.querySelector('span').textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

async function copyText(text, message = 'คัดลอกแล้ว') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast(message);
}

function bindInteractions() {
  // Keep the guide reading surface calm: one chapter open at a time.
  // `toggle` is not consistently bubbling across browsers, so listen in capture phase.
  guideContent.addEventListener('toggle', (event) => {
    const current = event.target.closest?.('.guide-card');
    if (!current || !current.open) return;
    guideContent.querySelectorAll('.guide-card[open]').forEach((card) => {
      if (card !== current) card.open = false;
    });
  }, true);

  templateContent.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-template]');
    if (!button) return;
    const sheet = button.closest('.template-sheet');
    const code = sheet.querySelector('code').textContent;
    copyText(code, `คัดลอกแม่แบบ ${button.dataset.copyTemplate} แล้ว`);
  });

  copyAllButton.addEventListener('click', () => copyText(templateSource, 'คัดลอกแม่แบบทั้งหมดแล้ว'));

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleGuide = 0;
    const guideCards = [...document.querySelectorAll('.guide-card')];
    guideCards.forEach((card) => {
      const visible = !query || card.dataset.searchText.includes(query);
      card.hidden = !visible;
      if (visible) visibleGuide += 1;
    });
    document.querySelectorAll('[data-guide-panel]').forEach((panel) => { panel.hidden = Boolean(query) ? false : panel.dataset.guidePanel !== '0'; });
    guideNav.querySelectorAll('[data-guide-group]').forEach((button) => {
      const active = query ? true : button.dataset.guideGroup === '0';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    let visibleTemplates = 0;
    document.querySelectorAll('.template-sheet').forEach((sheet) => {
      const visible = !query || sheet.dataset.searchText.includes(query);
      sheet.hidden = !visible;
      if (visible) {
        visibleTemplates += 1;
        if (query) sheet.open = true;
      }
    });
    guideEmpty.hidden = visibleGuide !== 0;
    templateEmpty.hidden = visibleTemplates !== 0;
  });

  guideNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-guide-group]');
    if (!button) return;
    const selected = button.dataset.guideGroup;
    guideNav.querySelectorAll('[data-guide-group]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    guideContent.querySelectorAll('[data-guide-panel]').forEach((panel) => { panel.hidden = panel.dataset.guidePanel !== selected; });
  });

  document.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('#guide').scrollIntoView({ behavior: 'smooth' });
    searchInput.focus({ preventScroll: true });
  });

}

function bindScrollState() {
  if (document.documentElement.dataset.scrollBound === 'true') return;
  document.documentElement.dataset.scrollBound = 'true';
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const percent = progress * 100;
    document.documentElement.style.setProperty('--read', `${percent}%`);
    document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4));
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
}

const musicPlayerElement = document.querySelector('[data-music-player]');
const musicToggle = document.querySelector('[data-music-toggle]');
const musicStatus = document.querySelector('[data-music-status]');
const musicVideoId = 'zA52GApIK5g';
let youtubeMusicPlayer;
let musicPlayerReady = false;
let musicAutoplayTimer;
let musicGestureArmed = false;
let musicPauseRequested = false;

function disarmMusicGesture() {
  if (!musicGestureArmed) return;
  document.removeEventListener('click', resumeMusicFromGesture, true);
  document.removeEventListener('keydown', resumeMusicFromGesture, true);
  musicGestureArmed = false;
}

function resumeMusicFromGesture() {
  if (!musicPlayerReady || !youtubeMusicPlayer) return;
  disarmMusicGesture();
  youtubeMusicPlayer.playVideo();
}

function armMusicOnFirstInteraction() {
  if (musicGestureArmed) return;
  musicGestureArmed = true;
  document.addEventListener('click', resumeMusicFromGesture, { capture: true });
  document.addEventListener('keydown', resumeMusicFromGesture, { capture: true });
}

function updateMusicPlayerState(state) {
  const playing = state === 'playing';
  const paused = state === 'paused';
  if (playing) {
    clearTimeout(musicAutoplayTimer);
    disarmMusicGesture();
  }
  musicPlayerElement.classList.toggle('is-playing', playing);
  musicPlayerElement.classList.toggle('is-paused', paused);
  musicPlayerElement.classList.toggle('is-bloomed', playing);
  musicPlayerElement.classList.remove('needs-tap');
  musicToggle.setAttribute('aria-pressed', String(playing));
  musicToggle.setAttribute('aria-label', playing ? 'ปิดเพลง' : paused ? 'เปิดเพลง' : 'กำลังเริ่มเพลง');
  musicStatus.textContent = playing ? 'เพลงกำลังเล่น' : paused ? 'หยุดเพลงแล้ว' : 'กำลังเปิดเพลง';
}

function handleMusicAutoplayBlocked() {
  clearTimeout(musicAutoplayTimer);
  musicPlayerElement.classList.remove('is-loading', 'is-playing', 'is-paused', 'is-bloomed');
  musicPlayerElement.classList.add('needs-tap');
  musicToggle.disabled = false;
  musicToggle.setAttribute('aria-pressed', 'false');
  musicToggle.setAttribute('aria-label', 'เริ่มเพลง');
  musicStatus.textContent = 'แตะเพื่อเปิดเพลง';
  armMusicOnFirstInteraction();
}

function handleMusicPlayerError() {
  musicPlayerElement.classList.remove('is-loading', 'is-playing', 'is-bloomed');
  musicPlayerElement.classList.add('has-error');
  musicToggle.disabled = true;
  musicStatus.textContent = 'เปิดเพลงไม่สำเร็จ';
}

window.onYouTubeIframeAPIReady = () => {
  youtubeMusicPlayer = new YT.Player('youtube-music-player', {
    width: '1',
    height: '1',
    videoId: musicVideoId,
    playerVars: { autoplay: 1, mute: 0, controls: 0, disablekb: 1, fs: 0, loop: 1, modestbranding: 1, playlist: musicVideoId, playsinline: 1, rel: 0 },
    events: {
      onReady: () => {
        musicPlayerReady = true;
        musicPlayerElement.classList.remove('is-loading');
        musicToggle.disabled = false;
        updateMusicPlayerState('ready');
        youtubeMusicPlayer.unMute();
        youtubeMusicPlayer.setVolume(48);
        youtubeMusicPlayer.playVideo();
        setTimeout(() => {
          if (youtubeMusicPlayer.getPlayerState() !== YT.PlayerState.PLAYING) youtubeMusicPlayer.playVideo();
        }, 450);
        setTimeout(() => {
          if (youtubeMusicPlayer.getPlayerState() !== YT.PlayerState.PLAYING) youtubeMusicPlayer.playVideo();
        }, 1200);
        musicAutoplayTimer = setTimeout(() => {
          if (youtubeMusicPlayer.getPlayerState() !== YT.PlayerState.PLAYING) handleMusicAutoplayBlocked();
        }, 3200);
      },
      onStateChange: ({ data }) => {
        if (data === YT.PlayerState.PLAYING) {
          musicPauseRequested = false;
          updateMusicPlayerState('playing');
        }
        if (data === YT.PlayerState.PAUSED && musicPauseRequested) {
          musicPauseRequested = false;
          updateMusicPlayerState('paused');
        }
        if (data === YT.PlayerState.ENDED) {
          youtubeMusicPlayer.seekTo(0);
          youtubeMusicPlayer.playVideo();
        }
      },
      onAutoplayBlocked: handleMusicAutoplayBlocked,
      onError: handleMusicPlayerError
    }
  });
};

musicToggle.addEventListener('click', () => {
  if (!musicPlayerReady || !youtubeMusicPlayer) return;
  if (youtubeMusicPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
    musicPauseRequested = true;
    youtubeMusicPlayer.pauseVideo();
  } else {
    musicPauseRequested = false;
    youtubeMusicPlayer.playVideo();
  }
});

const youtubeApiScript = document.createElement('script');
youtubeApiScript.src = 'https://www.youtube.com/iframe_api';
youtubeApiScript.async = true;
youtubeApiScript.addEventListener('error', handleMusicPlayerError);
document.head.append(youtubeApiScript);

async function init() {
  try {
    const response = await fetch('content.md?v=20260731-readable1');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    parseDocument(await response.text());
    renderGuide();
    renderTemplates();
    bindInteractions();
  } catch (error) {
    const serverUrl = `http://127.0.0.1:4173/roleplay-studio/?v=20260729-guide9${location.hash || '#top'}`;
    const openedAsFile = location.protocol === 'file:';
    guideContent.innerHTML = openedAsFile
      ? `<div class="file-open-help"><strong>หน้านี้ต้องเปิดผ่านเว็บเซิร์ฟเวอร์</strong><p>ถ้าเปิดจากไฟล์โดยตรง เบราว์เซอร์จะไม่อนุญาตให้โหลดคู่มือด้านใน</p><a href="${serverUrl}">เปิดเวอร์ชันเว็บภายนอก</a></div>`
      : `<div class="file-open-help"><strong>โหลดคู่มือไม่สำเร็จ</strong><p>${escapeHtml(error.message || 'กรุณาลองรีเฟรชหน้าเว็บอีกครั้ง')}</p></div>`;
    templateContent.innerHTML = '';
    console.error(error);
  }
}

// The header progress line should move from the first scroll frame and must not
// depend on the guide content finishing its network request.
bindScrollState();
init();
