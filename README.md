# MapFly NeuroGIS 🪰🌍

**MapFly NeuroGIS** là phòng thí nghiệm trên trình duyệt để mô phỏng **ruồi giấm 3D** bay qua môi trường đô thị. Mặc định sử dụng **Vietflex Map + OpenStreetMap (OSM)**, không cần API key hoặc thanh toán. Có thể chuyển sang bản đồ vector OSM 3D bằng MapLibre, hoặc xem **cảnh phố 3D tổng hợp** bằng Three.js. Google Street View chỉ là tùy chọn qua liên kết Google Maps, không phải thành phần bắt buộc của mô phỏng.

**Tình trạng: bản nguyên mẫu trực quan**. Đây KHÔNG phải bản mô phỏng hoạt động đầy đủ của mạng thần kinh thật MaleCNS hay FlyWire. Không được suy diễn kết quả minh họa thành thực nghiệm thần kinh học.

## Chức năng

- Giao diện tiếng Việt, tối ưu desktop và điện thoại, mô hình ruồi tạo thủ tục bằng Three.js (không dùng tệp GLB bên ngoài).
- Mặc định: **Vietflex Map** bản nguồn [Vietflexmap/VN](https://github.com/Vietflexmap/VN) (BSD-2-Clause / MIT) + lớp bản đồ OSM raster qua `tile.openstreetmap.org`. Khởi tạo `googleMaps:false` và `useLegacyGoogleTiles:false`; luôn ghi nguồn OSM.
- Chế độ chuyển đổi: bản đồ vector OSM qua OpenFreeMap + MapLibre GL JS, tùy chọn nhà 3D (nơi có chiều cao công trình trong dữ liệu) và góc nhìn nghiêng.
- Ruồi 3D vỗ cánh nằm tại tọa độ địa lý; quay hướng bay theo hệ quy chiếu bản đồ.
- Chạy / tạm dừng / đặt lại; chọn TP.HCM, Hà Nội, Vĩnh Long.
- Geo-ABM đơn giản: điều hướng tới điểm đích, thiên hướng theo nguồn mùi và tránh vùng nguy cơ **giả lập**; có thể nhấn bản đồ để đặt điểm đích.
- Đổi độ cao minh họa, hệ số gia tốc thời gian, độ nhiễu gió, cường độ mùi và nguy cơ.
- Đo thời gian giả lập, quãng đường theo công thức địa lý xấp xỉ trên khu vực nhỏ, vận tốc tức thời và tọa độ WGS84.
- Xuất tệp GeoJSON chứa điểm hiện tại, tuyến mục tiêu, đường đã đi và siêu dữ liệu ghi rõ là **mô phỏng**, không dùng connectome thật.
- Góc nhìn đường phố **3D tổng hợp bằng Three.js, không cần key và không dùng ảnh thật**, được gắn nhãn rõ ràng. Liên kết mở Google Street View trong Google Maps không cần API key; nhúng trực tiếp Street View qua Maps Embed API là tùy chọn riêng.
- Không yêu cầu server, không ghi API key vào localStorage hay repository. Google Maps Embed API không được kích hoạt nếu người dùng không tự nhập key.

## Sử dụng

Mở trang web đã bật GitHub Pages; hoặc chạy một web server tĩnh tại thư mục repository:

    python -m http.server 8000

Sau đó truy cập http://localhost:8000. Hệ thống yêu cầu mạng để tải thư viện và dữ liệu bản đồ. Cần trình duyệt có WebGL.

**Triển khai GitHub Pages**: repository đã có workflow `.github/workflows/pages.yml`. Vào Settings → Pages → Build and deployment → Source chọn **GitHub Actions**. Kiểm tra workflow **Trien khai MapFly NeuroGIS** tại tab Actions. Website dự kiến có URL `https://xulytiengviet.github.io/mapfly/` sau khi Pages triển khai thành công. Không coi Pages đang hoạt động trước khi workflow kết thúc thành công.

## Lựa chọn miễn phí ưu tiên

1. **Mặc định Vietflex 2D:** SDK đã ghim phiên bản `6144d565fcf236727577ab3c4471bbe49f86892f`, lớp bản đồ OSM raster miễn phí cho thử nghiệm tương tác, ruồi 3D nằm ở vị trí tọa độ bản đồ.
2. **OSM 3D:** dùng MapLibre + OpenFreeMap cho lớp tòa nhà 3D (nếu dữ liệu công trình có chiều cao). Chế độ này cũng không yêu cầu API key.
3. **Góc nhìn ruồi 3D:** Three.js dựng một khung cảnh nhà/đường tổng hợp. **Không tái dựng chính xác tuyến phố thực từ dữ liệu GIS, không phải ảnh 360°**. Đây là thành phần trình diễn, không có giá trị đo đạc.
4. **Google Street View thực:** nút liên kết mở Google Maps theo tọa độ không cần key; ảnh có thể không phủ sóng. Nếu muốn nhúng iframe trong dashboard, mở mục nâng cao và nhập key Google Maps Embed API được giới hạn theo tên miền.

> **Vì sao không dùng `useLegacyGoogleTiles:true` trong mẫu?** Vietflex nói rõ `google.com/vt` là endpoint không được Google công bố chính thức cho ứng dụng bên thứ ba; dùng trên website công khai có rủi ro về điều khoản và độ ổn định. MapFly dùng `googleMaps:false` và chỉ sử dụng lớp nền OSM có ghi nguồn.
>
> **Giới hạn tile OSM:** Dữ liệu OpenStreetMap là miễn phí, nhưng máy chủ `tile.openstreetmap.org` do cộng đồng vận hành có giới hạn lưu lượng. Bản mẫu chỉ gọi tile cho khung nhìn đang xem, không tải vùng/tile hàng loạt. Khi triển khai đông người, nên dùng dịch vụ cấp tile được phép/cho phép lượng truy cập tương ứng hoặc tự triển khai dịch vụ riêng. Chính sách: https://operations.osmfoundation.org/policies/tiles/.

## Kết nối Google Street View (tùy chọn)

1. Tạo Google Cloud project, bật **Maps Embed API** và thiết lập billing theo yêu cầu của Google.
2. Cấp API key, **giới hạn HTTP referrers** cho `https://xulytiengviet.github.io/mapfly/*` và `http://localhost:8000/*` (nếu thử tại máy), đồng thời giới hạn key chỉ cho Maps Embed API.
3. Nhập khóa trực tiếp vào giao diện, nhấn **Đồng bộ Street View** để tải ảnh panorama tại vị trí hiện tại. Khóa tồn tại trong ô nhập và URL iframe trong phiên trang, không được ghi vào kho mã nguồn.
4. Không có key vẫn dùng **Mở tại Google Maps** để truy cập Street View nếu khu vực có panorama.

Lưu ý: tọa độ được Google làm tròn/tìm panorama gần nhất, ảnh Street View không tự động theo dõi ruồi theo từng khung hình. Dùng nút đồng bộ khi muốn cập nhật. Không tải hoặc tái dùng tile/hình ảnh Street View trái điều khoản Google.

Tham khảo: https://developers.google.com/maps/documentation/embed/embedding-map

## Kiến trúc

    index.html
       ├─ Vietflex Map (mặc định) ← bản đồ raster OSM
       │    ├─ tuyến / quỹ đạo bay (Polyline)
       │    └─ điểm đích / tín hiệu giả lập (CircleMarker)
       ├─ MapLibre GL JS (chuyển chế độ) ← OpenFreeMap / dữ liệu OSM
       │    ├─ tòa nhà đùn nổi (fill-extrusion)
       │    ├─ tuyến kế hoạch / quỹ đạo bay (GeoJSON)
       │    └─ điểm đích / mùi / nguy cơ (GeoJSON)
       ├─ Three.js
       │    ├─ mẫu ruồi 3D xoay độc lập
       │    ├─ mô hình ruồi 3D đồng bộ tọa độ qua map.project() hoặc latLngToContainerPoint()
       │    └─ cảnh đường phố tổng hợp (không dùng ảnh thật)
       ├─ Geo-ABM (quy tắc cục bộ, chạy client)
       │    ├─ hướng tới mục tiêu
       │    ├─ hướng mùi minh họa
       │    └─ phản xạ tránh vùng nguy cơ minh họa
       └─ Liên kết Google Maps miễn phí hoặc Embed API (iframe tùy chọn)

**Điều chưa có**: mô hình địa hình cao độ vật lý chính xác, va chạm công trình, nhận biết chướng ngại trực tiếp từ ảnh, mô hình khí động lực học thực, đồng bộ thời gian thực camera từ Google, mô phỏng LIF cho toàn bộ CNS và dữ liệu synapse/neuron thật trong ứng dụng. Các giá trị % cảm giác chỉ phục vụ trình diễn.

## Dữ liệu connectome: phân biệt đúng các dự án

- **MaleCNS v1.0 (ruồi đực)**: hệ thần kinh trung ương gồm **166.700 neuron** đã hiệu đính và gán chú giải trong công bố năm 2026, bao gồm não và chuỗi thần kinh bụng. Nguồn chính thức: https://male-cns.janelia.org/ và bài báo https://doi.org/10.1016/j.cell.2026.08.015 ; dữ liệu/mã phân tích: https://github.com/flyconnectome/2025malecns.
- **FlyWire FAFB (ruồi cái)**: bản connectome não trưởng thành **139.255 neuron**, 54,5 triệu synapse theo công bố trên Nature 2024: https://doi.org/10.1038/s41586-024-07558-y. Không gán số liệu này cho MaleCNS.
- **CAVE**: cơ sở hạ tầng phiên bản hóa/chú giải connectome: https://github.com/CAVEconnectome.
- **Neuroglancer**: xem dữ liệu ảnh khối độ phân giải cao: https://github.com/google/neuroglancer.
- **FlyWire Codex**: khám phá connectome, chọn neuron/tuyến thần kinh: https://codex.flywire.ai/ và https://github.com/murthylab/codex.
- **FlyConnectome**: công cụ/hướng dẫn phân tích: https://github.com/seung-lab/FlyConnectome.
- **Tham khảo nghiên cứu mô phỏng**: https://github.com/erojasoficial-byte/fly-brain và https://github.com/onnxaa/fly-brain. Chúng là các dự án **độc lập**; không gộp mã hay dữ liệu của chúng vào MapFly. Đặc biệt repository onnxaa/fly-brain ghi rõ CC BY-NC 4.0 (giới hạn sử dụng thương mại).

### Lộ trình thực sự tích hợp MaleCNS

1. Tải **dữ liệu MaleCNS theo giấy phép và điều kiện áp dụng**, kiểm tra phiên bản, neuron ID, synapse weights và nguồn của annotations.
2. Tạo một dịch vụ tính toán riêng phía server/GPU chạy neural step. Không tải toàn bộ connectome và ảnh EM vào trang GitHub Pages.
3. Chuẩn hóa đầu vào cảm giác sang một hợp đồng JSON rõ ràng (ví dụ `vision.flow`, `olfaction.left/right`, `mechanosensation`), đồng bộ `dt` và hệ đơn vị.
4. Xuất ra dự đoán điều khiển `turn_rate`, `forward_speed`, `flight_state` kèm nguồn mô hình/phiên bản/uncertainty. Ánh xạ hành động về chuyển động trên WebGIS.
5. Kiểm định độ trung thực, độ trễ, mô hình cảm biến và so sánh với hành vi sinh học thực nghiệm trước khi sử dụng tuyên bố khoa học.

Tài liệu cụ thể về giao diện: [docs/NEURAL-BRIDGE.md](docs/NEURAL-BRIDGE.md).

## Hiệu năng / giấy phép / quyền riêng tư

- Mã giao diện: MIT, © 2026 Long Ngo.
- Dữ liệu OSM: © OpenStreetMap contributors; kiểm tra yêu cầu ghi công ODbL và giới hạn sử dụng dịch vụ tile tại https://operations.osmfoundation.org/policies/tiles/. Nền vector dùng https://openfreemap.org/; MapFly mặc định hiển thị OSM raster phục vụ bản demo tương tác thông thường, không tải trước tile.
- Vietflex (Leaflet-derived BSD-2-Clause + bổ sung MIT), MapLibre GL JS, Three.js, phông chữ và các nền tảng tham khảo có giấy phép **riêng**. MIT MapFly không tự động cấp phép lại dữ liệu, dịch vụ của bên thứ ba.
- Khi mở trang, trình duyệt trao đổi request với jsDelivr, Google Fonts, máy chủ tile OSM ở chế độ Vietflex hoặc OpenFreeMap ở chế độ MapLibre, và (nếu kích hoạt) Google Maps; thông báo cho người học trước khi sử dụng. Không tích hợp theo dõi analytics trong mã mẫu.
- Mô hình 3D được phóng đại trên màn hình, còn độ cao là một biến thông số mô phỏng; không thể coi đây là mô hình kích thước vật lý chuẩn.

Đóng góp: tạo issue/PR trong https://github.com/xulytiengviet/mapfly.