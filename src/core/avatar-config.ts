// Lựa chọn nhân vật: bối cảnh → giới tính → trang phục (gợi ý theo bối cảnh).
// Khung chọn + lưu localStorage + suy ra URL .vrm. Trang phục chỉ đổi HÌNH khi có file tương ứng
// trong public/avatars/ theo tên "<gender>-<scene>-<outfit>.vrm"; chưa có → dùng model mặc định.

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

// Gợi ý trang phục theo (giới tính, bối cảnh). Nhãn tiếng Việt, lịch sự.
export const OUTFITS: Record<Gender, Record<Scene, { id: string; label: string }[]>> = {
  female: {
    office: [
      { id: 'blazer', label: 'Blazer thanh lịch' },
      { id: 'shirt', label: 'Sơ mi + chân váy' },
      { id: 'suit', label: 'Vest công sở' },
      { id: 'dress', label: 'Váy liền công sở' },
    ],
    home: [
      { id: 'idol', label: 'Idol (mặc định)' },
      { id: 'casual', label: 'Áo thun + quần đùi' },
      { id: 'hoodie', label: 'Hoodie rộng' },
      { id: 'pajama', label: 'Pyjama dễ thương' },
      { id: 'croptop', label: 'Croptop gợi cảm' },
    ],
    intimate: [
      { id: 'slipdress', label: 'Váy ngủ lụa' },
      { id: 'robe', label: 'Áo choàng mỏng' },
      { id: 'sporty', label: 'Đồ tập gợi cảm' },
      { id: 'lingerie', label: 'Nội y (18+)' },
    ],
  },
  male: {
    office: [
      { id: 'suit', label: 'Vest công sở' },
      { id: 'shirt', label: 'Sơ mi' },
      { id: 'smart', label: 'Smart casual' },
    ],
    home: [
      { id: 'casual', label: 'Áo thun + quần đùi' },
      { id: 'hoodie', label: 'Hoodie' },
      { id: 'tank', label: 'Áo ba lỗ' },
    ],
    intimate: [
      { id: 'casual', label: 'Thoải mái' },
      { id: 'shirtless', label: 'Cởi trần (18+)' },
    ],
  },
};

export const FALLBACK_AVATAR = '/avatars/mira.vrm';
const LS = 'mira.avatar';
const DEFAULT: AvatarSel = { gender: 'female', scene: 'home', outfit: 'idol' };

// File model hiện có (đăng ký khi đã thả .vrm vào public/avatars/). Mặc định: idol = model hiện tại.
const KNOWN: Record<string, string> = {
  'female-home-idol': FALLBACK_AVATAR,
};

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

// Suy ra URL model. Có file đăng ký → dùng; chưa có → model mặc định (idol hiện tại).
export function resolveAvatarUrl(s: AvatarSel): string {
  const key = `${s.gender}-${s.scene}-${s.outfit}`;
  return KNOWN[key] || FALLBACK_AVATAR;
}
