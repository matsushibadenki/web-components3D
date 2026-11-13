import './controls.js';

const tauri = window.__TAURI__;
const panelIds = ['drive', 'adv', 'eq'];
const params = new URLSearchParams(location.search);
const panel = params.get('panel');
const floating = panelIds.includes(panel);
const bands = ['low', 'mid', 'high', 'air', 'cut'];
const initialControls = { drive: 36, adv: true, eq: [43, 65, 43, 29, 50] };
const defaults = { ...initialControls, simple: structuredClone(initialControls), synth: structuredClone(initialControls), theme: 'black', language: 'en', revision: 0 };
const messages = {
  en: { push: 'Push', roundPush: 'Round push button', simple: 'Simple', theme: 'Switch finish', language: 'Language', drive: 'Drive', adv: 'Advanced', eq: 'Equalizer', low: 'Low', mid: 'Mid', high: 'High', air: 'Air', cut: 'Low cut', drag: 'Drag up or down. Hold Shift for fine adjustment.', error: 'Could not update the rack.' },
  ja: { push: '押す', roundPush: '丸型プッシュボタン', simple: 'シンプル', theme: '仕上げを切り替え', language: '言語', drive: 'ドライブ', adv: '詳細モード', eq: 'イコライザー', low: '低域', mid: '中域', high: '高域', air: '超高域', cut: 'ローカット', drag: '上下にドラッグ。Shiftキーを押すと微調整できます。', error: 'ラックを更新できませんでした。' },
  'zh-CN': { push: '按下', roundPush: '圆形按钮', simple: '简约', theme: '切换表面风格', language: '语言', drive: '驱动', adv: '高级模式', eq: '均衡器', low: '低频', mid: '中频', high: '高频', air: '超高频', cut: '低切', drag: '上下拖动。按住 Shift 可微调。', error: '无法更新机架。' },
};

const rack = document.querySelector('#rack');
const simpleRack = document.querySelector('#simple-rack');
const theme = document.querySelector('#theme');
const language = document.querySelector('#language');
const error = document.querySelector('#error');
const controls = new Map();
const panelTitles = [];
const pushButtons = [];
const pending = new Map();
let current = structuredClone(defaults);

function makeControl(tag, key, axis, variant) {
  const control = document.createElement(tag);
  if (axis) control.dataset.axis = axis;
  const stateKey = variant ? `${variant}.${key}` : key;
  controls.set(stateKey, { control, key, variant });
  control.addEventListener('input', () => update(stateKey, control.value));
  return control;
}

function populateRack(target, ids) {
  const variant = target.dataset.variant;
  for (const id of ids) {
    const section = document.createElement('section');
    section.className = 'module';
    section.dataset.panel = id;
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = id.toUpperCase();
    title.id = `${target.id}-${id}`;
    section.setAttribute('aria-labelledby', title.id);
    header.append(title);
    section.append(header);
    target.append(section);
    panelTitles.push([id, title]);

    if (id === 'eq') {
      const bank = document.createElement('div');
      bank.className = 'bank';
      for (const key of bands.slice(0, 4)) bank.append(makeControl('alloy-fader', key, 'vertical', variant));
      section.append(bank, makeControl('alloy-fader', 'cut', 'horizontal', variant));
    } else if (id === 'adv') {
      const pushButton = document.createElement('alloy-push-button');
      const roundButton = document.createElement('alloy-push-button');
      roundButton.dataset.shape = 'round';
      pushButtons.push(pushButton, roundButton);
      const buttons = document.createElement('div');
      buttons.className = 'push-buttons';
      buttons.append(pushButton, roundButton);
      section.append(makeControl('alloy-switch', id, undefined, variant), buttons);
    } else {
      section.append(makeControl('alloy-knob', id, undefined, variant));
    }
  }
}

populateRack(rack, floating ? [panel] : panelIds);
if (!floating) populateRack(simpleRack, panelIds);
document.querySelector('#simple').hidden = floating;
document.querySelector('#synth').hidden = floating;
if (!floating) populateRack(document.querySelector('#synth-rack'), panelIds);

const showGallery = params.get('view') === 'samples';
const gallery = document.querySelector('#sample-gallery');
const sampleDesign = document.querySelector('#sample-design');
const preview = document.querySelector('#sample-preview');
const sampleVariants = [
  ['drive-knob', ['standard', 'small', 'nano']],
  ['adv-switch', ['standard', 'compact']],
  ['eq-sliders', ['standard']],
];
const sampleStrings = {
  en: ['Sample designs', 'Black', 'White', 'Standard', 'Small', 'Nano', 'Compact'],
  ja: ['サンプルデザイン', '黒', '白', '標準', '小', 'ナノ', 'コンパクト'],
  'zh-CN': ['示例设计', '黑色', '白色', '标准', '小号', '微型', '紧凑'],
};
const sizeKeys = ['standard', 'small', 'nano', 'compact'];

function renderSamples(strings) {
  const [label, ...variants] = sampleStrings[current.language];
  sampleDesign.setAttribute('aria-label', label);
  preview.title = label;
  if (sampleDesign.dataset.language === current.language) return;
  const selected = sampleDesign.value;
  sampleDesign.replaceChildren();
  sampleVariants.forEach(([component, sizes], index) => {
    const group = document.createElement('optgroup');
    group.label = strings[panelIds[index]];
    for (const [colorIndex, color] of ['black', 'white'].entries()) {
      for (const size of sizes) {
        const suffix = size === 'standard' ? '' : `-${size}`;
        const name = `${component}-${color}${suffix}`;
        group.append(new Option(`${variants[colorIndex]} · ${variants[2 + sizeKeys.indexOf(size)]}`, name));
      }
    }
    sampleDesign.append(group);
  });
  if (selected) sampleDesign.value = selected;
  sampleDesign.dataset.language = current.language;
}

function showSample() {
  preview.src = `sample/${sampleDesign.value}.html`;
}

gallery.hidden = !showGallery;
document.querySelector('#racks').hidden = showGallery;
sampleDesign.addEventListener('change', showSample);

function showError() {
  error.textContent = messages[current.language].error;
  error.hidden = false;
}

function render(documentState) {
  if (documentState.revision < current.revision) return;
  current = documentState;
  const strings = messages[current.language];
  document.documentElement.lang = current.language;
  document.documentElement.dataset.theme = current.theme;
  language.value = current.language;
  if (showGallery) {
    renderSamples(strings);
    if (!preview.hasAttribute('src')) showSample();
  }
  for (const [element, key] of [[theme, 'theme'], [language, 'language']]) {
    element.title = strings[key];
    element.setAttribute('aria-label', strings[key]);
  }
  theme.setAttribute('aria-pressed', String(current.theme === 'white'));
  document.querySelector('#alloy-title').textContent = 'Alloy';
  document.querySelector('#simple-title').textContent = strings.simple;
  for (const button of pushButtons) button.label = button.dataset.shape === 'round' ? strings.roundPush : strings.push;
  for (const [id, title] of panelTitles) title.title = strings[id];
  for (const [stateKey, { control, key, variant }] of controls) {
    const values = variant ? current[variant] : current;
    const saved = key in values ? values[key] : values.eq[bands.indexOf(key)];
    const value = pending.get(stateKey)?.value ?? saved;
    control.label = strings[key];
    if (key === 'drive') control.title = strings.drag;
    if (control.value !== value) control.value = value;
  }
}

let queue = Promise.resolve();

function update(key, value) {
  error.hidden = true;
  if (!tauri) {
    const next = structuredClone(current);
    next.revision++;
    const entry = controls.get(key);
    const values = entry?.variant ? next[entry.variant] : next;
    const field = entry?.key ?? key;
    if (field in values) values[field] = value;
    else values.eq[bands.indexOf(field)] = value;
    render(next);
    return;
  }
  const existing = pending.get(key);
  if (existing) {
    existing.value = value;
    render(current);
    return;
  }
  const change = { value };
  pending.set(key, change);
  render(current);
  queue = queue.then(async () => {
    try {
      let sent;
      do {
        sent = change.value;
        render(await tauri.core.invoke('update', { key, value: String(sent) }));
      } while (sent !== change.value);
    } catch {
      showError();
    } finally {
      pending.delete(key);
      render(current);
    }
  });
}

theme.addEventListener('click', () => update('theme', current.theme === 'black' ? 'white' : 'black'));
language.addEventListener('change', () => update('language', language.value));
render(current);

if (tauri) {
  try {
    await tauri.event.listen('rack-change', event => render(event.payload));
    render(await tauri.core.invoke('snapshot'));
  } catch {
    showError();
  }
}
