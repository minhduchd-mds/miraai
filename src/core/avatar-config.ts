// Lựa chọn nhân vật: bối cảnh → giới tính → trang phục (gợi ý theo bối cảnh).
// Khung chọn + lưu localStorage + suy ra: model 3D (.vrm), ảnh "look" 2D, và ảnh nền cảnh.
// Bộ nào CÓ file .vrm → hiện 3D (xoay đầu/lip-sync); chưa có → hiện ảnh 2D của bộ đó; thiếu cả ảnh
// → ảnh mặc định. Nền cảnh đổi theo bối cảnh nếu có file. Thả đúng tên file vào public/ là chạy.

export type Scene = 'office' | 'home' | 'intimate';
export type Gender = 'female' | 'male';

export interface AvatarSel {
  scene: Scene;
  gender: Gender;
  outfit: string;
}

export const SCENES: { id: Scene; label: string; hint: string }[] = [
  { id: 'office', label: 'Văn phòng', hint: 'Lịch sự, chuyên nghiệp' },
  { id: 'home', label: 'Ở nhà', hint: 'Thoải mái, đời thường' },
  { id: 'intimate', label: 'Thân mật', hint: 'Gần gũi, riêng tư' },
];

export const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: 'Nữ' },
  { id: 'male', label: 'Nam' },
];

// Trang phục gợi ý theo (giới tính, bối cảnh). Nhãn tiếng Việt.
export const OUTFITS: Record<Gender, Record<Scene, { id: string; label: string }[]>> = {
  female: {
    office: [
      { id: 'blazer', label: 'Blazer thanh lịch' },
      { id: 'shirt', label: 'Sơ mi + chân váy' },
      { id: 'suit', label: 'Vest công sở' },
    ],
    home: [
      { id: 'idol', label: 'Idol (mặc định)' },
      { id: 'sweater', label: 'Váy len + tất cao' },
      { id: 'croptop', label: 'Croptop năng động' },
      { id: 'pajama', label: 'Pyjama dễ thương' },
    ],
    intimate: [
      { id: 'nightgown', label: 'Váy ngủ voan' },
      { id: 'maid', label: 'Hầu gái' },
      { id: 'lingerie', label: 'Nội y ren (18+)' },
      { id: 'robe', label: 'Áo choàng mỏng' },
    ],
  },
  male: {
    office: [
      { id: 'shirt', label: 'Sơ mi trắng' },
      { id: 'suit', label: 'Vest' },
    ],
    home: [
      { id: 'casual', label: 'Áo thun + quần' },
      { id: 'hoodie', label: 'Hoodie' },
    ],
    intimate: [
      { id: 'shirtless', label: 'Cởi trần (18+)' },
      { id: 'casual', label: 'Thoải mái' },
    ],
  },
};

export const FALLBACK_AVATAR = '/avatars/mira.vrm';
export const FALLBACK_LOOK = '/avatars/mira.webp';
const LS = 'mira.avatar';
const DEFAULT: AvatarSel = { gender: 'female', scene: 'home', outfit: 'idol' };

// Model 3D (.vrm) đã có, map theo bộ. Tên file của anh khác quy ước nên đăng ký ở đây
// (sai bộ nào chỉ cần sửa đường dẫn 1 dòng). Bộ không có ở đây → tự lùi về idol.
const KNOWN_3D: Record<string, string> = {
  // Nữ (VRM0) — public/avatars/female/
  'female-home-idol': '/avatars/female/mira_female_01_idol_nova.vrm',
  'female-home-sweater': '/avatars/female/mira_female_02_lavender_lounge.vrm',
  'female-intimate-nightgown': '/avatars/female/mira_female_03_aurora_blue.vrm',
  'female-intimate-lingerie': '/avatars/female/mira_female_04_soft_rose.vrm',
  'female-intimate-maid': '/avatars/female/mira_female_05_iris_maid.vrm',
  // Nam (VRM1) — public/avatars/male/
  'male-office-shirt': '/avatars/male/mira_male_02_silver_white.vrm',
  'male-office-suit': '/avatars/male/mira_male_02_silver_white.vrm',
  'male-home-casual': '/avatars/male/mira_male_01_black_casual.vrm',
  'male-home-hoodie': '/avatars/male/mira_male_01_black_casual.vrm',
  'male-intimate-shirtless': '/avatars/male/mira_male_03_body_black_open.vrm',
  'male-intimate-casual': '/avatars/male/mira_male_01_black_casual.vrm',
};

// Ảnh "look" 2D cho từng bộ (đặt trong public/looks/). Bộ chưa có ảnh → dùng ảnh mặc định.
const LOOKS: Record<string, string> = {
  // Nữ: ảnh NỀN TRONG SUỐT (cutout) khớp từng model, đã nén WebP ~0.1MB — public/avatars/female/.
  'female-home-idol': '/avatars/female/mira_female_01_idol_nova.webp',
  'female-home-sweater': '/avatars/female/mira_female_02_lavender_lounge.webp',
  'female-home-croptop': '/avatars/female/mira_female_01_idol_nova.webp',
  'female-intimate-nightgown': '/avatars/female/mira_female_03_aurora_blue.webp',
  'female-intimate-maid': '/avatars/female/mira_female_05_iris_maid.webp',
  'female-intimate-lingerie': '/avatars/female/mira_female_04_soft_rose.webp',
  'male-office-shirt': '/looks/male-shirt.png',
  'male-office-suit': '/looks/male-shirt.png',
  'male-home-casual': '/looks/male-shirt.png',
  'male-home-hoodie': '/looks/male-shirt.png',
  'male-intimate-casual': '/looks/male-shirt.png',
  'male-intimate-shirtless': '/looks/male-shirtless.png',
};

function key(s: AvatarSel): string {
  return `${s.gender}-${s.scene}-${s.outfit}`;
}

function valid(s: any): AvatarSel {
  const gender: Gender = s?.gender === 'male' ? 'male' : 'female';
  const scene: Scene = s?.scene === 'office' || s?.scene === 'intimate' ? s.scene : 'home';
  const list = OUTFITS[gender][scene];
  const outfit = list.some((o) => o.id === s?.outfit) ? s.outfit : list[0].id;
  return { gender, scene, outfit };
}

export function loadAvatarSel(): AvatarSel {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return valid(JSON.parse(raw));
  } catch {
    /* noop */
  }
  return { ...DEFAULT };
}

export function saveAvatarSel(s: AvatarSel): void {
  try {
    localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

// Bộ này đã có model 3D riêng (đăng ký trong KNOWN_3D) chưa?
// Có → sân khấu hiện VRM (xoay đầu/lip-sync). Chưa → hiện thẳng ảnh PNG "look" của bộ.
export function has3D(s: AvatarSel): boolean {
  return key(s) in KNOWN_3D;
}
// Đường dẫn model 3D của bộ (chỉ nên gọi khi has3D = true).
export function resolveAvatarUrl(s: AvatarSel): string {
  return KNOWN_3D[key(s)] || `/avatars/${key(s)}.vrm`;
}
// Ảnh "look" 2D của bộ: vừa để xem trước trong Cài đặt, vừa là HÌNH HIỂN THỊ ngoài sân khấu
// khi bộ chưa có model 3D. Thiếu ảnh riêng → ảnh mặc định.
export function lookImage(s: AvatarSel): string {
  return LOOKS[key(s)] || FALLBACK_LOOK;
}
// Ảnh nền theo bối cảnh (public/scenes/). Thân mật mượn nền phòng ngủ. Thiếu file → giữ gradient.
const SCENE_BG: Record<Scene, string> = {
  office: '/scenes/office.png',
  home: '/scenes/home.png',
  intimate: '/scenes/home.png',
};
export function sceneBg(scene: Scene): string {
  return SCENE_BG[scene];
}
