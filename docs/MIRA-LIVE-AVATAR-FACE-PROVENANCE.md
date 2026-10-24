# Mira LiveAvatar — hồ sơ nguồn gốc khuôn mặt (v1)

Tài sản: `public/mira-assets/live/mira-live-face-v1.webp` (896×1200, WebP q90, 119.020 byte,
git blob `3a380f0f1248b59f8bb61c1ba05af446fda51ee4`) và rig `mira-live-face-v1.rig.json`.
Trạng thái quyền: **review_required** (nhóm `live-avatar-generated` trong `MIRA-ASSET-RIGHTS-INVENTORY.json`).

## Cách tạo

| Trường | Giá trị |
| --- | --- |
| Ngày tạo | 2026-10-24 (giờ Việt Nam) |
| Công cụ | Figma AI `generate_image`, model `gemini-3.1-flash-image` |
| Tài khoản / team | dominhduchd10@gmail.com · team Figma "UX application" (`team::1498857107730800785`), AI credits của team |
| File gốc | Figma `4ZUXPxQvSWfWJXsAJwRr8V` (“Mira LiveAvatar — face provenance”), node `1:2` |
| Ảnh đầu vào | Không có. Chỉ dùng prompt văn bản, không ảnh tham chiếu, không ảnh người thật |
| Hậu xử lý | Xuất PNG 896×1200 từ Figma → WebP q90 (Pillow). Không chỉnh sửa nội dung |

### Prompt (nguyên văn)

> Photorealistic head-and-shoulders portrait of an original fictional adult Vietnamese woman, about 25 years old,
> in the style of a friendly livestream host. She faces the camera straight on, head level and centered, eyes open
> looking directly into the lens, mouth gently closed with a soft relaxed smile, lips not parted. Shoulder-length dark
> brown hair tucked behind the ears so the forehead edges, both eyes, nose, mouth and jawline are fully visible and
> unobstructed. Light natural makeup. Wearing a modest cream crew-neck knit sweater. Even, soft frontal key light like
> a ring light, no harsh shadows on the face. Background: a tidy, softly blurred home streaming studio with warm bokeh
> lights and plants, calm neutral colors. Sharp focus on the face, natural skin texture, 50mm lens, eye level. She must
> not resemble any real celebrity or public figure. No text, no logos, no watermark, no hands near the face.

## Rig

`scripts/live-avatar/build-rig.py` (Python 3.11, mediapipe 0.10.14 Face Mesh, scipy Delaunay) — chạy offline, không mạng:
478 landmark (gồm mống mắt) + vòng halo tóc/cổ + viền ảnh cố định = 582 đỉnh; vùng môi dựng topology tường minh
(dải môi trên/dưới + dải khoang miệng). Kiểm tra phủ kín: tổng diện tích tam giác 1,00002 / 1,0.

## Việc còn lại trước khi coi là "verified"

1. Người có thẩm quyền đọc điều khoản đầu ra Figma AI của gói team và xác nhận quyền dùng thương mại.
2. Rà soát tương đồng: so ảnh với nhận diện người nổi tiếng/ảnh công khai để loại trừ trùng gương mặt thật.
3. Ký duyệt và đổi `status` của nhóm `live-avatar-generated` sang `verified` kèm `approvedBy`.

Mira luôn cho người dùng biết đây là nhân vật tổng hợp: dòng "Bạn đồng hành AI" dưới tên Mira ở header và nhãn trợ năng "Mira, nhân vật AI" của khung hình (từ 24/10 không còn huy hiệu chồng lên khuôn mặt, theo yêu cầu chủ dự án).
