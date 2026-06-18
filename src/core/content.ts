// Nội dung trực quan hiện cạnh avatar: THỜI TIẾT (Open-Meteo) + ẢNH (Pollinations). Đều FREE, KHÔNG cần key.

export interface WeatherData {
  city: string;
  temp: number;
  desc: string;
  emoji: string;
  wind: number;
  humidity: number;
}

export type Content =
  | { kind: 'weather'; data: WeatherData }
  | { kind: 'image'; data: { prompt: string; url: string } };

// Mã thời tiết WMO (Open-Meteo) → mô tả tiếng Việt + emoji.
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
    const g = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=vi`,
    ).then((r) => r.json());
    const loc = g?.results?.[0];
    if (!loc) return null;
    const f = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`,
    ).then((r) => r.json());
    const c = f?.current;
    if (!c) return null;
    const [desc, emoji] = WMO[c.weather_code as number] || ['—', '🌡️'];
    return {
      city: loc.name,
      temp: Math.round(c.temperature_2m),
      desc,
      emoji,
      wind: Math.round(c.wind_speed_10m),
      humidity: Math.round(c.relative_humidity_2m),
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
    const blob = await fetch(url).then((r) => r.blob());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch {
    window.open(url, '_blank'); // CORS chặn tải → mở tab cho người dùng tự lưu
  }
}

// Nhận diện ý định từ câu người dùng (phía app, v1). Không khớp → null (chỉ trả lời bằng giọng).
export function detectContent(
  text: string,
): { kind: 'weather'; city: string } | { kind: 'image'; prompt: string } | null {
  const t = text.toLowerCase();
  if (/thời tiết|thoi tiet|weather|nhiệt độ|trời (mưa|nắng|nóng|lạnh)/.test(t)) {
    const found = VN_CITIES.find((c) => t.includes(c.toLowerCase()));
    let city = found || '';
    if (!city) {
      const m = text.match(/(?:ở|tại|in|at)\s+([\p{Lu}][\p{L}\s]{1,24})/u);
      city = (m?.[1] || '').trim();
    }
    return { kind: 'weather', city: city || 'Hà Nội' };
  }
  if (/(vẽ|tạo|tìm|cho.*(xem|coi)|hiện|show).*(ảnh|hình|tranh|image|picture)|(bức ảnh|tấm hình|tấm ảnh)/.test(t)) {
    const m = text.match(/(?:bức ảnh|tấm hình|tấm ảnh|ảnh|hình|tranh|về|của|vẽ)\s+(.{2,60})/iu);
    let prompt = (m?.[1] || text).trim();
    prompt = prompt.replace(/\b(giúp|cho|em|anh|với|nhé|đi|ạ|nha)\b/giu, ' ').replace(/\s+/g, ' ').trim();
    return { kind: 'image', prompt: prompt || text };
  }
  return null;
}
