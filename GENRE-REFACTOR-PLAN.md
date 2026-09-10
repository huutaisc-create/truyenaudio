# KẾ HOẠCH TÁI CẤU TRÚC THỂ LOẠI / TAG — webtruyen

> File tham chiếu để thi công & đối chiếu. Tick `[x]` khi xong. Chưa động vào DB/prod cho tới khi duyệt từng phần.

Cập nhật: 2026-09-10

---

## A. Quyết định đã chốt

- Giữ **5 facet**: `GENRE` (Thể loại) · `BOI_CANH` (Bối cảnh) · `LUU_PHAI` (Lưu phái) · `TINH_CACH` (Tính cách) · `THI_GIAC` (Thị giác).
- **Trope** (Nữ Phụ, Pháo Hôi, Nghịch Tập, HE, BE…) → dồn vào **Thể loại**.
- **Không** auto-set trường "Loại truyện" (Nguyên sang/Convert/Dịch → bỏ qua).
- Token lạ → **hiện danh sách "chưa nhận diện"** cho admin xử lý tay.
- Từ điển alias để **trong code** (Cách 1): `src/lib/taxonomy.ts`.
- **Site không crawl nữa** → tag làm thủ công trong admin, hỗ trợ bởi nút **"Tìm và thêm"**.
- **Nguồn chân lý duy nhất**: `src/lib/taxonomy.ts` (đã có bản nháp).

---

## B. Nguyên nhân gốc (đã xác minh trong code)

1. **Form gộp facet**: trong `EditStoryForm.tsx` (và `create/page.tsx`) mọi checkbox của cả 5 nhóm đều render `name="genres"`.
2. **Server action ép type**: `createStory` và `updateStory` (`src/actions/admin.ts`) chỉ đọc `formData.getAll('genres')` rồi `connectOrCreate` với **`type:'GENRE'` cứng** — không đọc boiCanh/luuPhai/tinhCach/thiGiac.
3. **Mất tag khi lưu**: `updateStory` chạy `genres:{ set: [] }` (gỡ sạch) rồi mới connect lại đúng các checkbox → tag nào không nằm trong form bị xoá.

→ Hậu quả: 100% dữ liệu nằm ở `GENRE`, 4 facet còn lại luôn rỗng; mỗi lần sửa+lưu là dọn sạch tag cũ. (Crawl cũ cũng chỉ gửi `category`→GENRE, nhưng giờ đã bỏ crawl.)

---

## C. `type` có tác dụng ở đâu (để biết sửa gì ảnh hưởng gì)

- **CÓ dùng `type`**: trang lọc `/tim-kiem` (checkbox từng facet lấy từ `/api/genres`) và `/api/search` (lọc `name + type` theo từng facet).
- **BỎ QUA `type`, chỉ dùng `name`**: `/api/stories`, `/api/for-you`, `/api/stories/[slug]`, chip thể loại ở trang chi tiết web.
- **App mobile** (đã xác minh): menu Thể loại/Search dùng `type` — gọi `/api/genres` (gom theo type) dựng checkbox + `/api/search` (params `genres/boiCanh/luuPhai/tinhCach/thiGiac/status`). `Story.fromJson` chỉ đọc `name`. For-you/genre picker theo `name`. ⇒ Sửa dữ liệu đúng type + dọn rác là **menu app tự chạy đúng, không cần đổi server, không cần build lại app** (đọc live). NHƯNG `search_page.dart` có **hardcode `_kQuickGenres` kèm type** phải khớp taxonomy.

⇒ **Đổi `type` của tag an toàn với mọi nơi dùng name** (name giữ nguyên), và **làm đúng bộ lọc**. Chỉ cần chú ý sửa link chip ở trang chi tiết.

---

## D. Taxonomy đích

Xem `src/lib/taxonomy.ts` (bản nháp đã gửi): `TAXONOMY` (tag theo facet), `ALIASES` (biến thể), `DENYLIST` (rác), `normKey()` + `classifyTokens()`.

- [x] Duyệt & chốt nội dung `taxonomy.ts`. ✅ (Xuyên Không/Nhanh/Qua + Trọng Sinh + Niên Đại + Mạt Thế = Thể loại; Cơ Trí = Tính cách; Nam/Nữ Chủ = Thị giác)

---

## E. BẢN ĐỒ NƠI ẢNH HƯỞNG + VIỆC CẦN LÀM + CÁCH KIỂM TRA

| # | Nơi | File | Đang làm gì với genre | Cần sửa | Kiểm tra không lỗi |
|---|-----|------|------------------------|---------|--------------------|
| 1 | Admin – form sửa | `src/app/admin/stories/[id]/EditStoryForm.tsx` | Checkbox 5 nhóm đều `name="genres"`; hardcode `STORY_TAGS` | Import `taxonomy.ts`; mỗi nhóm submit đúng field (genres/boiCanh/luuPhai/tinhCach/thiGiac); load tick sẵn theo `type`; gắn nút "Tìm và thêm" | Mở 1 truyện có tag đủ 5 facet → checkbox tick đúng nhóm |
| 2 | Admin – form tạo | `src/app/admin/stories/create/page.tsx` | Như trên (cần xác nhận) | Như #1 | Tạo truyện chọn đủ 5 facet → lưu ra đúng type |
| 3 | Server action | `src/actions/admin.ts` → `createStory`, `updateStory` | Đọc mỗi `genres`, ép `type:'GENRE'`; `updateStory` `set:[]` rồi connect | Đọc cả 5 field, `connectOrCreate` đúng `type` cho từng facet; giữ/không-xoá tag ngoài taxonomy (không mất dữ liệu) | Sửa 1 truyện, thêm 1 tag Bối cảnh + 1 Lưu phái → DB có đúng type; các tag cũ không mất |
| 4 | Crawl upload (còn dùng?) | `src/app/api/admin/stories/route.ts` → `buildTags` | Nhận genres/boiCanh/… nhưng nguồn chỉ gửi category | Vì bỏ crawl: để nguyên hoặc chỉnh cho khớp taxonomy nếu còn xài import hàng loạt | Nếu còn dùng: POST thử payload đủ facet → lưu đúng type |
| 5 | API lọc | `src/app/api/search/route.ts` | Lọc `name contains + type` theo từng facet; card `categories`=GENRE | Không đổi logic; chỉ hưởng lợi sau khi dữ liệu đúng type | Lọc Bối cảnh="Cổ Đại" → ra truyện; Thể loại không còn "Cổ Đại" |
| 6 | API facet list | `src/app/api/genres/route.ts` | Group theo type, dedup ci | Không đổi; tự phản ánh dữ liệu đã dọn | `/api/genres` không còn tên rác/mồ côi |
| 7 | API list (web+app) | `src/app/api/stories/route.ts` | Lọc theo `name`; `categories`=tất cả tag | Cân nhắc: `categories` nên chỉ lấy `type:'GENRE'` để thẻ card gọn | App/web: card chỉ hiện thể loại thật, không lẫn bối cảnh/thị giác |
| 8 | API gợi ý | `src/app/api/for-you/route.ts` | Lọc theo `name` | Không bắt buộc | Gợi ý vẫn chạy |
| 9 | API chi tiết (app) | `src/app/api/stories/[slug]/route.ts` | Trả `genres {id,name}` (mọi type) | Cân nhắc trả kèm `type` để app nhóm được | App detail hiện tag đúng nhóm (nếu app muốn) |
| 10 | Web – trang chi tiết | `src/app/truyen/[slug]/page.tsx` | Chip = mọi tag (name), link luôn `?the-loai=` | Link chip theo **đúng facet** (`the-loai`/`boi-canh`/`luu-phai`/`tinh-cach`/`thi-giac`); cần trả kèm `type` từ query | Bấm chip "Cổ Đại" → ra /tim-kiem lọc Bối cảnh, có kết quả |
| 11 | Web – trang lọc | `src/app/tim-kiem/page.tsx` | Facet list từ `/api/genres`; chỉ đọc param `the-loai` | Đọc thêm param `boi-canh/luu-phai/tinh-cach/thi-giac`; đồng bộ với link chip #10 | Vào URL có param từng facet → tick đúng, lọc đúng |
| 12 | App – model | `webtruyen_mobile/lib/core/models/story.dart` | `Story.fromJson` đọc `categories ?? genres`, chỉ lấy `name` (nhận string hoặc `{name}`) | Không cần sửa; đổi type/thêm field type là an toàn | Danh sách + chi tiết hiện tag đúng, không crash |
| 12b | App – search menu | `webtruyen_mobile/lib/features/search/...` (`search_repository.dart`, `search_provider.dart`, `search_page.dart`) | Gọi `/api/genres` (gom type) + `/api/search` (genres/boiCanh/luuPhai/tinhCach/thiGiac/status) | **Không cần đổi server**; menu tự chạy đúng sau khi dọn dữ liệu | Mở menu Thể loại app: mỗi nhóm hiện tag thật; lọc từng facet ra kết quả |
| 12c | App – quick chips | `search_page.dart` → `_kQuickGenres` (label, **type** hardcode) | Chip nhanh gán sẵn type: Cổ Đại/Hiện Đại=BOI_CANH, Xuyên Nhanh/Mạt Thế/Niên Đại=GENRE | **Phải khớp taxonomy**: hoặc để Xuyên Nhanh ở GENRE (khớp luôn), hoặc sửa chip + build lại app; "Niên Đại" không có trong taxonomy → sửa/bỏ | Bấm từng quick chip → ra đúng kết quả |
| 12d | App – for-you/picker | `constants/genres.dart` (`kGenres`), `genre_picker_sheet.dart`, `for_you_repository.dart` | Danh sách name phẳng; `/for-you` + `/auth/preferences` theo name | Bỏ qua type → an toàn; (tuỳ chọn) đồng bộ `kGenres` cho gọn | Chọn genre ở home → gợi ý ra truyện |
| 13 | DB | Neon `"Story"`, `"Genre"`, `"_GenreToStory"` | 84 tag, chỉ GENRE có data, nhiều mồ côi/rác | Migration: đổi type + xoá mồ côi + gộp trùng (Phase 2) | Chạy count trước/sau; đối chiếu số truyện mỗi tag không giảm sai |
| 14 | Nút "Tìm và thêm" | (mới) trong form admin | — | Ô dán chuỗi → `classifyTokens()` → preview (matched theo facet / ignored / unmatched) → áp tick | Dán chuỗi test → tick đúng, unrecognized hiện đúng |

> ⚠️ **Cần kiểm tra thêm (chưa đọc kỹ trong session này):** checkbox của `create/page.tsx` (#2) có đúng đang `name="genres"` như edit không. (App đã xác minh xong — xem #12*.)
>
> ✅ **App base URL**: `http://46.250.229.240/api` (IP VPS) — cùng backend, nên mọi thay đổi API áp cho cả web lẫn app.

---

## F. Thứ tự thực hiện

- [x] **Phase 0 — Chốt taxonomy** (`src/lib/taxonomy.ts` đã tạo & commit). ✅ 2026-09-10
- [x] **Phase 1 — Sửa form + server action** (#1 #2 #3): tạo `StoryGenrePicker.tsx` dùng chung; `createStory`/`updateStory` đọc 5 facet, connectOrCreate đúng type; giữ tag cũ ngoài taxonomy. ✅ 2026-09-10 *(chưa deploy)*
- [x] **Phase 2 — Migration dọn DB** (#13): đã chạy trên prod ✅ 2026-09-10. Kết quả 5 facet: Bối cảnh 11 · Thể loại 31 · Lưu phái 15 · Thị giác 2 · Tính cách 1 (60 tag, bỏ 24). Backup: `Genre_bak`, `_GenreToStory_bak` (xoá khi yên tâm). *(Còn sót 2 dòng 0-truyện lệch hoa/thường "Hiện đại"/"Tương lai" — dọn ở Phase 4)*
- [x] **Phase 3 — Nút "Tìm và thêm"** (#14): tích hợp trong `StoryGenrePicker`. ✅ 2026-09-10 *(chưa deploy)*
- [x] **Phase 4 — Số đếm + ẩn 0 + chip link đúng facet + categories sạch** ✅ 2026-09-10:
  - Số đếm + ẩn tag 0 truyện: `/api/genres` (thêm `?withCount=1`, tương thích app cũ), `getGenres()` action `{name,count}`, web `tim-kiem` hiện "Tên (số)", app `search_repository`+`search_page` (cần build lại app).
  - #10 chip link theo facet: `truyen/[slug]/page.tsx` giữ `type`, chip nhóm theo facet + link `?the-loai/boi-canh/luu-phai/tinh-cach/thi-giac`; `tim-kiem` đọc đủ 5 param.
  - #7/#9 categories sạch: `/api/stories` `categories` chỉ GENRE; `/api/stories/[slug]` thêm `type`; card web `tim-kiem` chỉ hiện chip GENRE.
- [ ] **Phase 5 — Kiểm thử toàn bộ web + app** (mục H).

> Gợi ý: Phase 1 phải xong & deploy trước Phase 2, kẻo dọn xong lại bị lưu-ghi-đè làm hỏng.

---

## G. Migration dọn DB (đề cương — chốt số liệu sau khi taxonomy OK)

Cách làm an toàn:

1. **Backup** bảng Genre + join: `pg_dump` hoặc `CREATE TABLE ..._bak AS SELECT ...`.
2. **Đổi type** theo taxonomy (giữ nguyên liên kết truyện). Ví dụ dự kiến (số truyện hiện tại):
   - → BOI_CANH: Cổ Đại(29), Hiện Đại(5), Tương Lai(3), Dị Giới(2), Tây Phương(2), Huyền Ảo(1).
   - → LUU_PHAI: Xuyên Không(23), Xuyên Nhanh(13), Hệ Thống(12), Xuyên Qua(10), Tùy Thân(6), Trọng Sinh(2).
   - → THI_GIAC: Nữ Chủ(29)→"Thị giác nữ chủ", Nam Chủ(2)→"Thị giác nam chủ".
   - → TINH_CACH: Cơ Trí(2).
   - Giữ GENRE: Cung Đấu, Sủng, Ngôn Tình, Nữ Cường, Tiên Hiệp, Đô Thị, Đồng Nhân, Kiếm Hiệp, Quan Trường, Huyền Huyễn, Huyền Nghi, Võ Hiệp, Võng Du…
   - *(Trọng Sinh, Mạt Thế: xác nhận GENRE hay chuyển — xem taxonomy)*
3. **Xử lý va chạm** unique `(name,type)`: xoá bản mồ côi trùng đích trước khi đổi type.
4. **Xoá mồ côi/rác**: `DELETE FROM "Genre" g WHERE NOT EXISTS (SELECT 1 FROM "_GenreToStory" s WHERE s."A"=g.id);` (sau khi đã đổi type xong).
5. **Đối chiếu**: chạy lại query count trước/sau, số truyện mỗi tag phải khớp (chỉ đổi type, không rớt liên kết).

- [ ] Chốt danh sách đổi/xoá chính xác (tôi phát từ taxonomy đã duyệt).
- [ ] Backup.
- [ ] Chạy trong transaction, kiểm tra count, rồi commit.

---

## H. Checklist kiểm thử "không lỗi"

**Admin**
- [ ] Sửa truyện: tick tag ở cả 5 nhóm → Lưu → mở lại thấy đúng, không mất tag.
- [ ] Nút "Tìm và thêm": dán chuỗi thật → tick đúng facet; unrecognized hiện đúng; ignored bị bỏ.
- [ ] Tạo truyện mới với đủ facet → DB đúng type.

**Web**
- [ ] Trang chi tiết: chip mỗi tag link đúng facet, bấm ra kết quả.
- [ ] `/tim-kiem`: mỗi nhóm checkbox chỉ còn tag thật; lọc từng facet ra đúng truyện; lọc kết hợp (AND) đúng.
- [ ] Homepage/listing: card hiện thể loại gọn (không lẫn bối cảnh/thị giác nếu đã chỉnh #7).
- [ ] `/api/genres` không còn tên rác.

**App mobile** (phần lớn chạy đúng sau khi dọn dữ liệu, KHÔNG cần build lại — trừ quick-chip)
- [ ] Menu Thể loại: mỗi nhóm (Thể loại/Bối cảnh/Lưu phái/Tính cách/Thị giác) hiện tag thật, lọc ra kết quả đúng.
- [ ] Lọc kết hợp nhiều facet + trạng thái + số chương → đúng.
- [ ] Quick chips (`_kQuickGenres`): mỗi chip ra đúng kết quả (kiểm sau khi chốt Xuyên Nhanh/Niên Đại).
- [ ] Danh sách + chi tiết truyện: categories/tag hiển thị đúng, không crash với field `type` mới.
- [ ] For-you / chọn genre ở home → gợi ý ra truyện.

---

## I. Rollback

- Form/action/nút: revert commit.
- Migration: khôi phục từ bảng `_bak` hoặc bản `pg_dump` (đổi type & xoá là có thể phục hồi nếu có backup).

---

## J. Cần xác nhận / còn mở

- [ ] `categories` ở `/api/stories` và `/api/stories/[slug]`: chỉ lấy GENRE, hay giữ tất cả? (ảnh hưởng app)
- [ ] Trang chi tiết: có muốn hiện tag **nhóm theo facet** hay để chung một hàng chip?
- [ ] Alias: khởi tạo từ điển từ bao nhiêu chuỗi mẫu? (càng nhiều mẫu thật càng ít "chưa nhận diện")
- [ ] Trọng Sinh / Mạt Thế thuộc facet nào (đang để GENRE).
- [ ] **Xuyên Không / Xuyên Nhanh**: giữ ở GENRE (khớp `_kQuickGenres` app, khỏi build app) hay chuyển LUU_PHAI (phải sửa app quick-chip + build lại)? → ảnh hưởng cả taxonomy lẫn app.
- [ ] "Niên Đại" trong quick-chip app không có trong taxonomy → thêm vào GENRE hay bỏ chip đó.

---

## K. Nhật ký thi công

- 2026-09-10: Lập plan, xác minh nguyên nhân gốc (form + action ép GENRE), gửi nháp `taxonomy.ts`.
- 2026-09-10: Soi app mobile — app đã dùng `/api/genres`+`/api/search` theo type; sửa backend là menu app tự chạy đúng, không cần build lại (trừ `_kQuickGenres` hardcode). Điểm lệch: Xuyên Nhanh (app=GENRE vs taxonomy=LUU_PHAI), "Niên Đại" không có trong taxonomy.
- 2026-09-10: Chốt quyết định (giữ Xuyên*/Trọng Sinh/Mạt Thế ở Thể loại, thêm Niên Đại, categories=GENRE+type, chi tiết nhóm theo facet). Hoàn tất Phase 0/1/3: `src/lib/taxonomy.ts`, `StoryGenrePicker.tsx` (5 facet + nút Tìm và thêm), sửa `createStory`/`updateStory` đọc đúng type + giữ tag cũ. Đã commit vào repo, CHƯA deploy. Soạn `genre-migration.sql` cho Phase 2.
- CÒN LẠI: deploy Phase 1 → chạy migration Phase 2 → Phase 4 (chi tiết web link theo facet + categories API chỉ GENRE + thêm type ở API chi tiết) → Phase 5 test.
- 2026-09-10: Chạy migration Phase 2 trên prod OK (COMMIT). 5 facet đã có dữ liệu. Lưu ý sự cố: lần đầu bấm Ctrl+Z làm treo transaction → đã kill job + terminate idle-in-transaction + rollback (count về 84) rồi chạy lại sạch. Còn phải deploy Phase 1 (push schema.prisma fix build affiliate) nếu chưa xong, và làm Phase 4.
- 2026-09-10: Phase 4 (một phần) — số đếm + ẩn tag 0 truyện. Sửa: src/app/api/genres/route.ts (thêm ?withCount=1, ẩn 0, tương thích app cũ), src/actions/stories.ts getGenres ({name,count}), src/app/tim-kiem/page.tsx (FilterSection/SidebarFilterSection nhận string|{name,count}, chip hiện "(số)"). App: webtruyen_mobile search_repository.dart (GenreItem + withCount) + search_page.dart (_GenreSection hiện count) — CẦN BUILD LẠI APP. App cũ vẫn chạy (endpoint mặc định giờ trả names đã ẩn 0). Lưu ý: quick-chip "Niên Đại" (GENRE, 0 truyện) trong search_page bấm sẽ ra rỗng — cân nhắc bỏ sau.

---

## PHASE 5 — BẢNG CHUẨN MỚI 7 NHÓM (boss yêu cầu làm lại)

**Bảng chuẩn mới** (thứ tự ưu tiên): Thế Giới → Loại Hình → Giới Tính → Thị Giác Tác Phẩm → Bàn Tay Vàng → Nhân Thiết Main → Kết Thúc.
Type DB: THE_GIOI, LOAI_HINH, GIOI_TINH, THI_GIAC, BAN_TAY_VANG, NHAN_THIET, KET_THUC.

**Quyết định của boss:**
1. Thứ tự ưu tiên như trên (dùng cho FACET_ORDER + sắp tag trên thẻ truyện + link chip).
2. Tag NGOÀI chuẩn → BỎ (xoá khi migrate). Admin có ô "+ Thêm tag" ở mỗi nhóm để chủ động thêm khi cần.
3. Triển khai TOÀN BỘ: web + app + migration.

**Đã sửa (data-driven qua `taxonomy.ts` / `taxonomy.dart` — thêm/bớt nhóm sau này chỉ sửa 1 chỗ):**

*Web (`webtruyen-app`)*
- `src/lib/taxonomy.ts` — 7 nhóm, FACET_ORDER ưu tiên, FACET_LABEL/PARAM, TAXONOMY (Title Case), ALIASES, DENYLIST, classifyTokens, + `orderGenreNames()` (sắp tag theo ưu tiên).
- `src/actions/admin.ts` — createStory/updateStory build genreConnect data-driven qua FACET_ORDER/FACET_PARAM.
- `src/app/admin/stories/StoryGenrePicker.tsx` — 7 nhóm data-driven + nút "Tìm và thêm" + ô "+ Thêm tag" mỗi nhóm.
- `src/app/api/search/route.ts` — đọc 7 param FACET_PARAM (AND), + param `genres` khớp tên mọi nhóm; categories = orderGenreNames.
- `src/actions/stories.ts` — searchStories nhận `facets: Record<FacetType,string[]>` + `genres`; where data-driven; bỏ take:3 để sắp ưu tiên.
- `src/app/api/stories/route.ts` — categories = orderGenreNames (ưu tiên nhóm, lấy 3).
- `src/app/truyen/[slug]/page.tsx` — chip nhóm lặp FACET_ORDER/LABEL/PARAM.
- `src/app/tim-kiem/page.tsx` — viết lại: filter state theo 7 facet, mobile drawer + desktop + sidebar đều lặp FACET_ORDER; card sắp tag theo ưu tiên.

*App (`webtruyen_mobile`) — CẦN BUILD LẠI*
- `lib/core/constants/taxonomy.dart` (MỚI) — `kFacets` (type,label,param) đúng thứ tự ưu tiên.
- `search_repository.dart` — searchStoriesAdvanced nhận `facets` map + `genres`.
- `search_provider.dart` — SearchFilters dùng `facets` map + helper `withFacet`/`facetTotal`.
- `search_page.dart` — sheet Thể loại lặp kFacets; quick-chip đổi sang tag THE_GIOI (Cổ Đại/Hiện Đại/Xuyên Nhanh/Mạt Thế/Tu Tiên).

**Migration:** `genre-migration-v7.sql` — có backup `*_bak_v7`; remap tên/type theo taxonomy (khớp không dấu + alias); tag ngoài chuẩn bị xoá; canonical-hoá + gộp trùng. Chạy: `psql "$DATABASE_URL" -f genre-migration-v7.sql`.

**Thứ tự deploy:**
1. Copy toàn bộ file web + app vào repo (đã làm).
2. Web: `git add -A && git commit && git push`; trên VPS `git pull && npm run build && pm2 restart truyenaudio`.
3. Chạy `genre-migration-v7.sql` trên VPS.
4. Build lại app Flutter.

**Kiểm thử:** như mục H nhưng 7 nhóm; kiểm nút "+ Thêm tag" lưu được tag mới; kiểm quick-chip app ra kết quả.
