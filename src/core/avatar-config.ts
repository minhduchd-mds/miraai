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

// Model 3D (.vrm) đã có. Mặc định: idol = model hiện tại. Thêm dòng khi thả thêm .vrm.
const KNOWN_3D: Record<string, string> = {
  'female-home-idol': FALLBACK_AVATAR,
};

// Ảnh "look" 2D cho từng bộ (đặt trong public/looks/). Bộ chưa có ảnh → dùng ảnh mặc định.
const LOOKS: Record<string, string> = {
  'female-home-idol': '/looks/female-idol.png',
  'female-home-sweater': '/looks/female-sweater.png',
  'female-home-croptop': '/looks/female-idol.png',
  'female-intimate-nightgown': '/looks/female-nightgown.png',
  'female-intimate-maid': '/looks/female-maid.png',
  'female-intimate-lingerie': '/looks/female-lingerie.png',
  'male-office-shirt': '/looks/male-shirt.png',
  'male-office-suit': '/looks/male-shirt.png',
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

// Mỗi bộ một model 3D: public/avatars/<gender>-<scene>-<outfit>.vrm.
// Chưa có file → VRMAvatar tự lùi về model idol mặc định (sân khấu luôn là 3D).
export function resolveAvatarUrl(s: AvatarSel): string {
  return KNOWN_3D[key(s)] || `/avatars/${key(s)}.vrm`;
}
// Ảnh "look" 2D của bộ — CHỈ dùng để xem trước trong Cài đặt (sân khấu ngoài luôn 3D).
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
