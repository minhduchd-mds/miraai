import * as THREE from 'three';
import type { Object3D } from 'three';

// Biến VRM thành hologram trong suốt phát sáng theo màu --accent của theme.
// Idempotent: luôn dựng lại từ trạng thái material GỐC đã lưu → đổi theme là nhuộm lại được,
// không cộng dồn. Giữ nguyên MToon (không thay material), chỉ chỉnh thuộc tính.
const FLAG = '__holoOrig';

function eachMat(obj: any, fn: (m: any) => void) {
  const m = obj.material;
  if (!m) return;
  if (Array.isArray(m)) m.forEach((x) => x && fn(x));
  else fn(m);
}

const CLOTH_RE = /Cloth|Tops|Bottoms|Shoes|Skirt|Onepiece|Outfit/i;
// Vẽ lại texture: tô màu sáng, lấy ALPHA của texture gốc làm mặt nạ (giữ hoa văn/cutout).
function tintTexture(tex: any, hex: string): THREE.CanvasTexture | null {
  const img = tex?.image;
  if (!img || !img.width) return null;
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cv.width, cv.height); // 1. texture gốc (giữ chi tiết nếp gấp + alpha)
  ctx.globalCompositeOperation = 'screen'; // 2. screen màu sáng → làm sáng nhưng GIỮ chi tiết
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'destination-in'; // 3. áp lại alpha gốc (screen làm alpha=1)
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const nt = new THREE.CanvasTexture(cv);
  nt.flipY = tex.flipY;
  nt.colorSpace = tex.colorSpace;
  nt.wrapS = tex.wrapS;
  nt.wrapT = tex.wrapT;
  nt.needsUpdate = true;
  return nt;
}

// Nâng "sàn" độ sáng texture: composite 'lighten' = max từng kênh với màu sàn →
// pixel TỐI (tất/găng bake trong texture da) được kéo lên màu sàn (tông da sáng),
// pixel SÁNG (da thật) giữ nguyên. Sau đó áp lại alpha gốc.
function liftTexture(tex: any, floorHex: string): THREE.CanvasTexture | null {
  const img = tex?.image;
  if (!img || !img.width) return null;
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'lighten';
  ctx.fillStyle = floorHex;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const nt = new THREE.CanvasTexture(cv);
  nt.flipY = tex.flipY;
  nt.colorSpace = tex.colorSpace;
  nt.wrapS = tex.wrapS;
  nt.wrapT = tex.wrapT;
  nt.needsUpdate = true;
  return nt;
}

// Body (da) có tất/găng tối bake sẵn trong texture → thay material + nâng sàn sáng
// để chân/tay sáng như da thật (khớp vibe "váy trắng + da sáng" của ảnh tham chiếu).
const BODY_RE = /Body_\d+_SKIN/i;
export function brightenBody(root: Object3D, floorHex = '#D9B9A6') {
  root.traverse((obj: any) => {
    const mat = obj.material;
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    let changed = false;
    const next = list.map((m: any) => {
      const name = m?.name || '';
      if (!BODY_RE.test(name) || /Outline/i.test(name) || /_bright$/.test(name)) return m;
      const tex = m.map || m.uniforms?.map?.value;
      const nt = liftTexture(tex, floorHex);
      if (!nt) return m;
      changed = true;
      return new THREE.MeshStandardMaterial({
        name: name + '_bright',
        map: nt,
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0,
        transparent: true,
        opacity: 0.96,
        depthWrite: false, // thân KHÔNG ghi depth → quần áo luôn vẽ đè lên được
        side: THREE.DoubleSide,
      });
    });
    if (changed) obj.material = Array.isArray(mat) ? next : next[0];
  });
}

// MToon trong three-vrm tự re-sync uniform → không can thiệp được màu nền.
// Cách chắc ăn: THAY HẲN material quần áo bằng MeshStandardMaterial dùng texture đã tô sáng.
export function recolorClothes(root: Object3D, hex: string, emissiveHex = hex) {
  const emissive = new THREE.Color(emissiveHex);
  root.traverse((obj: any) => {
    const mat = obj.material;
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    let changed = false;
    const next = list.map((m: any) => {
      const name = m?.name || '';
      if (!CLOTH_RE.test(name) || /_bright$/.test(name)) return m;
      if (/Outline/i.test(name)) return m; // đã ẩn toàn cục ở applyHologram
      const tex = m.map || m.uniforms?.map?.value;
      const nt = tintTexture(tex, hex);
      changed = true;
      return new THREE.MeshStandardMaterial({
        name: name + '_bright',
        map: nt || null,
        color: nt ? 0xffffff : new THREE.Color(hex),
        emissive,
        emissiveIntensity: 0.5,
        roughness: 0.65,
        metalness: 0,
        transparent: true,
        opacity: 0.96,
        alphaTest: 0.2,
        side: THREE.DoubleSide,
      });
    });
    if (changed) {
      obj.material = Array.isArray(mat) ? next : next[0];
      obj.renderOrder = 3; // quần áo vẽ SAU thân → luôn phủ ngoài, không bị lộ thân
    }
  });
}

// ── Làm đẹp mặt: tô môi hồng + khoang miệng hồng ──
// Toạ độ môi đo trực tiếp từ texture mặt VRoid Sample B (soi pixel có grid):
// tâm vạch môi tại UV (0.482, 0.754). Texture mặt 1024², môi chỉ ~45×20px.
function copyCanvas(img: any): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!img?.width) return null;
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return { cv, ctx };
}

function asTexture(cv: HTMLCanvasElement, like: any): THREE.CanvasTexture {
  const nt = new THREE.CanvasTexture(cv);
  nt.flipY = like.flipY;
  nt.colorSpace = like.colorSpace;
  nt.wrapS = like.wrapS;
  nt.wrapT = like.wrapT;
  nt.needsUpdate = true;
  return nt;
}

function swapMap(m: any, nt: THREE.CanvasTexture) {
  m.map = nt;
  if (m.uniforms?.map) m.uniforms.map.value = nt;
  m.needsUpdate = true;
}

const LIP = { u: 0.482, v: 0.754, ru: 0.046, rv: 0.024 };

export function beautifyFace(root: Object3D) {
  root.traverse((obj: any) => {
    eachMat(obj, (m) => {
      const name = m.name || '';
      if (/Outline/i.test(name)) return;
      // Môi: vẽ hồng lên bản copy texture mặt rồi swap map
      if (/Face_00_SKIN$/.test(name)) {
        const tex = m.map || m.uniforms?.map?.value;
        const c = copyCanvas(tex?.image);
        if (!c) return;
        const { cv, ctx } = c;
        const cx = LIP.u * cv.width;
        const cy = LIP.v * cv.height;
        const rx = LIP.ru * cv.width;
        const ry = LIP.rv * cv.height;
        // lớp 1: multiply hồng→trắng (nhuộm màu, giữ nét vạch môi)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        const g1 = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
        g1.addColorStop(0, 'rgb(255,128,150)');
        g1.addColorStop(0.7, 'rgb(255,195,202)');
        g1.addColorStop(1, 'rgb(255 255 255 / 0.5)');
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = g1;
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        // lớp 2: phủ hồng tươi nhẹ cho mọng
        const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.85);
        g2.addColorStop(0, 'rgba(255,110,140,0.45)');
        g2.addColorStop(1, 'rgba(255,110,140,0)');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = g2;
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
        swapMap(m, asTexture(cv, tex));
        return;
      }
      // Khoang miệng (lộ ra khi nói): nhuộm hồng ấm toàn texture
      if (/FaceMouth/i.test(name)) {
        const tex = m.map || m.uniforms?.map?.value;
        const c = copyCanvas(tex?.image);
        if (!c) return;
        c.ctx.globalCompositeOperation = 'multiply';
        c.ctx.fillStyle = 'rgb(255,165,175)';
        c.ctx.fillRect(0, 0, c.cv.width, c.cv.height);
        c.ctx.globalCompositeOperation = 'destination-in';
        c.ctx.drawImage(tex.image, 0, 0, c.cv.width, c.cv.height);
        swapMap(m, asTexture(c.cv, tex));
      }
    });
  });
}

// gentle=true (model VRM1, ví dụ nam): GIỮ NGUYÊN BẢN — đặc (không trong suốt → hết "rời đầu"),
// KHÔNG tint màu (hết mặt/da ngả xanh), chỉ thêm glow accent rất nhẹ cho hợp tông hologram.
// gentle=false (VRM0, nữ): hologram đầy đủ như cũ.
export function applyHologram(root: Object3D, accentHex: string, opts?: { gentle?: boolean; opacity?: number }) {
  const gentle = opts?.gentle ?? false;
  const opacity = opts?.opacity ?? 0.9;
  const accent = new THREE.Color(accentHex);
  root.traverse((obj: any) => {
    if (obj.isMesh) obj.renderOrder = 2;
    eachMat(obj, (m) => {
      const name = m.name || '';
      // Viền inverted-hull (MToon Outline): khi các lớp chính depthWrite=false, vỏ viền tối
      // sẽ vẽ đè lên da/áo → tắt hẳn toàn model (style hologram không cần viền anime).
      if (/\(Outline\)/i.test(name)) {
        m.visible = false;
        return;
      }
      // quần áo do recolorClothes lo; material đã thay (_bright) giữ nguyên độ sáng
      if (CLOTH_RE.test(name) || /_bright$/.test(name)) return;
      if (!m[FLAG]) {
        m[FLAG] = {
          opacity: m.opacity,
          transparent: m.transparent,
          depthWrite: m.depthWrite,
          color: m.color ? m.color.clone() : null,
          emissive: m.emissive ? m.emissive.clone() : null,
          emissiveIntensity: 'emissiveIntensity' in m ? m.emissiveIntensity : undefined,
        };
      }
      const o = m[FLAG];

      if (gentle) {
        // Khôi phục độ đặc + màu gốc, chỉ thêm glow nhẹ.
        m.transparent = o.transparent;
        m.opacity = o.opacity;
        m.depthWrite = o.depthWrite;
        if (m.color && o.color) m.color.copy(o.color);
        if (m.emissive) {
          m.emissive.copy(accent).multiplyScalar(0.1);
          if ('emissiveIntensity' in m) m.emissiveIntensity = 0.3;
        }
        m.needsUpdate = true;
        return;
      }

      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
      // Mặt/mắt/miệng: GIỮ MÀU GỐC (không tint) để môi hồng, da ấm, mắt có hồn.
      const isFace = /(_FACE|_EYE|Face_\d+_SKIN|FaceMouth)/i.test(name);
      if (!isFace) {
        if (m.color && o.color) m.color.copy(o.color).lerp(accent, 0.12); // tint rất nhẹ phần còn lại
        if (m.emissive) {
          m.emissive.copy(accent).multiplyScalar(0.25);
          if ('emissiveIntensity' in m) m.emissiveIntensity = 0.6;
        }
      }
      m.needsUpdate = true;
    });
  });
}
