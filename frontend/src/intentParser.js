const CHINESE_DIGITS = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const STOP_ALIASES = {
  qingyan: ['青岩'],
  huangguoshu: ['黄果树'],
  zhijin: ['织金洞'],
  wanfenglin: ['万峰林'],
  xiaoqikong: ['小七孔', '荔波'],
  xijiang: ['西江', '千户苗寨'],
  fanjingshan: ['梵净山'],
  'chishui-danxia': ['赤水丹霞', '赤水大瀑布'],
  'zunyi-conference': ['遵义会议会址', '遵义会议'],
  zhenyuan: ['镇远'],
  zhaoxing: ['肇兴'],
  'baili-dujuan': ['百里杜鹃'],
  longgong: ['龙宫'],
  malinghe: ['马岭河'],
  wumeng: ['乌蒙大草原', '乌蒙草原'],
  jiabang: ['加榜梯田'],
  'sky-eye': ['中国天眼', '贵州天眼'],
  xiasi: ['下司'],
  yelanggu: ['夜郎谷'],
  jiucaiping: ['韭菜坪', '阿西里西'],
};

const PREFERENCE_RULES = [
  { value: 'safe', pattern: /安全|担心|避开风险|风险低|稳妥|放心/ },
  { value: 'lowload', pattern: /轻松|不累|不太累|不想太累|少走|少爬|慢游|低强度|老人友好|无障碍/ },
  { value: 'nature', pattern: /山地|自然|山水|森林|瀑布|峡谷|草原|梯田|户外|风光|梵净山|黄果树|小七孔|万峰林|韭菜坪|百里杜鹃|马岭河/ },
  { value: 'culture', pattern: /民族|文化|古镇|古城|苗寨|侗寨|人文|红色|研学/ },
];

function parseChineseNumber(raw) {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === '十') return 10;
  if (raw.includes('十')) {
    const [left, right] = raw.split('十');
    return (left ? CHINESE_DIGITS[left] : 1) * 10 + (right ? CHINESE_DIGITS[right] : 0);
  }
  return CHINESE_DIGITS[raw] ?? null;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function parseDate(text, today) {
  const exact = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日|号)?/);
  if (exact) {
    const date = validDate(Number(exact[1]), Number(exact[2]), Number(exact[3]));
    if (date) return toIsoDate(date);
  }

  const monthDay = text.match(/(?:今年|明年)?\s*(\d{1,2})月(\d{1,2})(?:日|号)?/);
  if (monthDay) {
    let year = today.getFullYear() + (text.includes('明年') ? 1 : 0);
    let date = validDate(year, Number(monthDay[1]), Number(monthDay[2]));
    if (date && !text.includes('今年') && !text.includes('明年') && date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      date = validDate(year + 1, Number(monthDay[1]), Number(monthDay[2]));
    }
    if (date) return toIsoDate(date);
  }

  const relativeDays = text.includes('后天') ? 2 : text.includes('明天') ? 1 : text.includes('今天') ? 0 : null;
  if (relativeDays !== null) {
    const date = new Date(today);
    date.setDate(date.getDate() + relativeDays);
    return toIsoDate(date);
  }
  return null;
}

function normalizeStopName(name = '') {
  return name
    .replace(/^中国/, '')
    .replace(/旅游景区|风景名胜区|风景区|湿地公园|纪念馆|景区/g, '')
    .trim();
}

function parseStops(text, stops) {
  return stops.filter(stop => {
    const aliases = new Set([
      stop.name,
      normalizeStopName(stop.name),
      ...(STOP_ALIASES[stop.id] || []),
    ]);
    return [...aliases].some(alias => alias.length >= 2 && text.includes(alias));
  });
}

function pushRecognition(recognized, field, label, value) {
  recognized.push({ field, label, value });
}

export function parseTravelIntent(input, options = {}) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  const today = options.today ? new Date(options.today) : new Date();
  const stops = options.stops || [];
  const values = {};
  const recognized = [];

  if (!text) return { values, recognized };

  const startDate = parseDate(text, today);
  if (startDate) {
    values.startDate = startDate;
    pushRecognition(recognized, 'startDate', '日期', startDate);
  }

  const knownOrigins = options.originCities || [];
  const originMatch = text.match(/(?:从|由)\s*([\u4e00-\u9fa5A-Za-z0-9·]{2,12}?)(?:市|区|县)?(?:出发|启程|走)/)
    || text.match(/([\u4e00-\u9fa5A-Za-z0-9·]{2,12}?)(?:市|区|县)?出发/);
  let origin = originMatch?.[1]?.replace(/^(?:今天|明天|后天)/, '').trim();
  if (!origin) origin = knownOrigins.find(city => text.includes(`${city}出发`) || text.includes(`从${city}`));
  if (origin) {
    values.origin = origin;
    pushRecognition(recognized, 'origin', '出发地', origin);
  }

  const knownRegions = options.regions || [];
  const destinationRegion = knownRegions.find(region =>
    text.includes(`去${region}`)
    || text.includes(`前往${region}`)
    || text.includes(`到${region}`)
    || text.includes(`游${region}`)
    || (region === '贵州' && text.includes('贵州'))
  );
  if (destinationRegion) {
    values.destinationRegion = destinationRegion;
    pushRecognition(recognized, 'destinationRegion', '旅行区域', destinationRegion);
  }

  const dayMatch = text.match(/([一二两三四五六七八九十\d]+)\s*(?:天(?:游|行程|旅行|时间)?|日(?:游|行程|旅行))/);
  const days = parseChineseNumber(dayMatch?.[1]);
  if (days) {
    values.days = Math.max(1, Math.min(10, days));
    pushRecognition(recognized, 'days', '天数', `${values.days}天`);
  }

  let travelerType = null;
  if (/亲子|家庭|父母.*(?:孩子|儿童|小孩)|(?:孩子|儿童|小孩).*父母/.test(text)) travelerType = 'family';
  else if (/老人|长辈|爸妈|父母/.test(text)) travelerType = 'senior';
  else if (/研学|学生|学校|班级|团队学习/.test(text)) travelerType = 'study';
  else if (/独自|一个人|单人|独行/.test(text)) travelerType = 'solo';
  else if (/朋友|结伴|情侣|夫妻|同事/.test(text)) travelerType = 'wellness';
  if (travelerType) {
    values.travelerType = travelerType;
    const label = {
      family: '亲子家庭',
      senior: '老人同行',
      study: '研学团队',
      wellness: '朋友结伴',
      solo: '独自旅行',
    }[travelerType];
    pushRecognition(recognized, 'travelerType', '同行人', label);
  }

  const travelerNoteMatch = text.match(/((?:\d+|[一二两三四五六七八九十]+)\s*(?:位|名|个)?(?:老人|儿童|孩子|学生|成人|朋友)(?:[、，和及+\s]*(?:\d+|[一二两三四五六七八九十]+)\s*(?:位|名|个)?(?:老人|儿童|孩子|学生|成人|朋友))*)/);
  if (travelerNoteMatch) values.travelerNote = travelerNoteMatch[1].trim();

  const preferences = PREFERENCE_RULES
    .filter(rule => rule.pattern.test(text))
    .map(rule => rule.value);
  if (preferences.length) {
    values.preferences = preferences;
    const labels = {
      safe: '安全优先',
      lowload: '轻松少爬坡',
      nature: '山地自然',
      culture: '民族文化',
    };
    pushRecognition(recognized, 'preferences', '偏好', preferences.map(item => labels[item]).join('、'));
  }

  const numericIntensity = text.match(/(?:路线)?强度\s*(\d{1,2})/);
  if (numericIntensity) values.intensity = Math.max(20, Math.min(90, Number(numericIntensity[1])));
  else if (/轻松|不累|不太累|不想太累|少走|少爬|慢游|低强度|舒缓/.test(text)) values.intensity = 30;
  else if (/高强度|徒步|登山|挑战|探险|探索强度/.test(text)) values.intensity = 75;
  else if (/中等|适中|适度/.test(text)) values.intensity = 55;
  if (values.intensity) {
    const label = values.intensity <= 35 ? '轻松' : values.intensity <= 60 ? '适中' : '探索';
    pushRecognition(recognized, 'intensity', '强度', label);
  }

  if (/下雨|降雨|雨天|湿滑|暴雨|雷雨/.test(text)) values.weather = 'rain';
  else if (/大雾|雾天|低能见度/.test(text)) values.weather = 'fog';
  else if (/高温|暴晒|炎热|防晒/.test(text)) values.weather = 'heat';
  else if (/实时天气|自动读取|动态调整|天气变化/.test(text)) values.weather = 'auto';
  if (values.weather) {
    const label = { rain: '防雨防滑', fog: '规避大雾', heat: '规避高温', auto: '实时天气' }[values.weather];
    pushRecognition(recognized, 'weather', '天气', label);
  }

  const matchedStops = parseStops(text, stops);
  if (matchedStops.length) {
    values.stopIds = matchedStops.map(stop => stop.id);
    pushRecognition(recognized, 'stopIds', '目的地', `${matchedStops.length}个景区`);
  } else if (/AI\s*推荐|智能推荐|自动推荐|不指定|你来推荐|没有指定/.test(text)) {
    values.stopIds = [];
    pushRecognition(recognized, 'stopIds', '目的地', 'AI推荐');
  }

  const explicitNotes = text.match(/(?:其他要求|补充要求|另外要求)[:：]\s*(.+)$/);
  if (explicitNotes?.[1]) {
    values.notes = explicitNotes[1].trim();
  } else {
    const noteClauses = text
      .split(/[，。；;]/)
      .map(item => item.trim())
      .filter(item => /无障碍|预算|酒店|住宿|高铁|自驾|午后|早起|轮椅|宠物|忌口/.test(item));
    if (noteClauses.length) values.notes = noteClauses.join('，');
  }

  return { values, recognized };
}
