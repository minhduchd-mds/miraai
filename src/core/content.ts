import type { ResultView, WeatherData } from '../intelligence/skills/result-view';

// Compatibility exports: old UI/runtime callers can keep using Content/WeatherData while
// new skills depend on intelligence/skills/result-view.ts as the canonical view contract.
export type { ResultView as Content, WeatherData } from '../intelligence/skills/result-view';

const WMO: Record<number, [string, string]> = {
  0: ['Trời quang', '☀️'], 1: ['Ít mây', '🌤️'], 2: ['Có mây', '⛅'], 3: ['Nhiều mây', '☁️'],
  45: ['Sương mù', '🌫️'], 48: ['Sương mù', '🌫️'],
  51: ['Mưa phùn nhẹ', '🌦️'], 53: ['Mưa phùn', '🌦️'], 55: ['Mưa phùn nặng', '🌧️'],
  61: ['Mưa nhẹ', '🌦️'], 63: ['Mưa', '🌧️'], 65: ['Mưa to', '🌧️'],
  66: ['Mưa lạnh', '🌧️'], 67: ['Mưa lạnh', '🌧️'],
  71: ['Tuyết nhẹ', '🌨️'], 73: ['Tuyết', '🌨️'], 75: ['Tuyết dày', '❄️'],
  80: ['Mưa rào', '🌦️'], 81: ['Mưa rào', '🌧️'], 82: ['Mưa rào to', '⛈️'],
  95: ['Dông', '⛈️'], 96: ['Dông kèm mưa đá', '⛈️'], 99: ['Dông mạnh', '⛈️'],
};

const VN_CITIES = [
  'Hà Nội', 'Hồ Chí Minh', 'Sài Gòn', 'Đà Nẵng', 'Huế', 'Hải Phòng', 'Cần Thơ', 'Nha Trang',
  'Đà Lạt', 'Vũng Tàu', 'Quy Nhơn', 'Buôn Ma Thuột', 'Vinh', 'Hạ Long', 'Phú Quốc', 'Biên Hòa',
];

export async function fetchWeather(city: string): Promise<WeatherData | null> {
  try {
    const q = city === 'Sài Gòn' ? 'Ho Chi Minh' : city;
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=vi`,
    ).then((response) => response.json());
    const location = geo?.results?.[0];
    if (!location) return null;
    const forecast = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`,
    ).then((response) => response.json());
    const current = forecast?.current;
    if (!current) return null;
    const [desc, emoji] = WMO[current.weather_code as number] || ['—', '🌡️'];
    return {
      city: location.name,
      temp: Math.round(current.temperature_2m),
      desc,
      emoji,
      wind: Math.round(current.wind_speed_10m),
      humidity: Math.round(current.relative_humidity_2m),
    };
  } catch {
    return null;
  }
}

export function pollinationsImage(prompt: string): string {
  const seed = Math.floor(Math.random() * 1e6);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&seed=${seed}`;
}

export async function downloadImage(url: string, name = 'mira-image.jpg'): Promise<void> {
  try {
    const blob = await fetch(url).then((response) => response.blob());
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 4000);
  } catch {
    window.open(url, '_blank');
  }
}

// Lightweight deterministic matcher for built-in visual skills. Future host/tools may also be invoked
// through BrainReply.toolCalls without adding more logic to useMira.
export function detectContent(
  text: string,
): { kind: 'weather'; city: string } | { kind: 'image'; prompt: string } | null {
  const normalized = text.toLowerCase();
  if (/thời tiết|thoi tiet|weather|nhiệt độ|trời (mưa|nắng|nóng|lạnh)/.test(normalized)) {
    const found = VN_CITIES.find((city) => normalized.includes(city.toLowerCase()));
    let city = found || '';
    if (!city) {
      const match = text.match(/(?:ở|tại|in|at)\s+([\p{Lu}][\p{L}\s]{1,24})/u);
      city = (match?.[1] || '').trim();
    }
    return { kind: 'weather', city: city || 'Hà Nội' };
  }
  if (/(vẽ|tạo|tìm|cho.*(xem|coi)|hiện|show).*(ảnh|hình|tranh|image|picture)|(bức ảnh|tấm hình|tấm ảnh)/.test(normalized)) {
    const match = text.match(/(?:bức ảnh|tấm hình|tấm ảnh|ảnh|hình|tranh|về|của|vẽ)\s+(.{2,60})/iu);
    let prompt = (match?.[1] || text).trim();
    prompt = prompt.replace(/\b(giúp|cho|em|anh|với|nhé|đi|ạ|nha)\b/giu, ' ').replace(/\s+/g, ' ').trim();
    return { kind: 'image', prompt: prompt || text };
  }
  return null;
}

// Keep the type referenced in this compatibility module so TS verifies the canonical contract.
export type VisualResult = ResultView;
