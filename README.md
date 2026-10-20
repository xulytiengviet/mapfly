# MapFly NeuroGIS — Fruit Fly Driver Simulator 🪰

**Website:** https://xulytiengviet.github.io/mapfly/  
**Mã nguồn:** https://github.com/xulytiengviet/mapfly  
**Phiên bản MapFly bay tự do trước đó:** https://xulytiengviet.github.io/mapfly/legacy.html

Dự án mô phỏng một tác tử ruồi giấm điều khiển phương tiện di chuyển trên bản đồ địa lý, với buồng lái 3D, điều hướng đường, giao diện thần kinh và cơ cấu chân trước tương tác. Thiết kế lấy cảm hứng từ dự án **The Driving Fly / Flyhard** của Mark Unthank: https://thedrivingfly.com/ và https://github.com/MarkUnthank/flyhard. Đây là mã MapFly phát triển độc lập, không bao gồm mô hình huấn luyện, dữ liệu ghi hình hoặc động cơ CARLA của Flyhard.

## Bản mới

- Buồng lái 3D dùng Three.js với ruồi giấm, mắt kép, cánh, sáu chân, vô lăng và khung cảnh đường phố.
- Bản đồ nhỏ Vietflex + OpenStreetMap tại TP.HCM, Hà Nội và Vĩnh Long; nút phóng lớn bản đồ và biểu tượng di chuyển theo tọa độ WGS84.
- Tùy chọn **Tạo tuyến OSM miễn phí** sử dụng endpoint OSRM demo để lấy hình học đường. Nếu yêu cầu thất bại, ứng dụng giữ tuyến định nghĩa sẵn và hiển thị nhãn phân biệt.
- Tác tử có mô hình lái kinematic bicycle giản lược, tự bám điểm đích, đo vận tốc, khoảng cách, góc lái và phương hướng.
- Sơ đồ Neural Activity gồm các nhóm vùng thần kinh và một mạng nút/cạnh trọng số giả lập; hoạt động của mạng **ảnh hưởng trực tiếp đến góc lái**.
- Biểu đồ raster xung giả lập và Foreleg Control với lực, vị trí khớp, góc lái được tính từ mô phỏng.
- Kích thích thay đổi theo mùi, gió, nút rẽ trái/phải và hệ số ảnh hưởng thần kinh; có thể bật/tắt bộ điều khiển để so sánh.
- Xuất quỹ đạo GeoJSON; tùy chọn nạp JSON đồ thị synapse cục bộ.
- Nền tối, việt hóa, đáp ứng màn hình máy tính và điện thoại; không cần Google API key.
- Phiên bản cũ được giữ tại **legacy.html** và **legacy.js**.

## Ranh giới khoa học — bắt buộc phân biệt

| Thành phần | Mức độ thật/giả lập |
| --- | --- |
| Nền bản đồ | OSM thật có ghi nguồn thông qua Vietflex |
| Hình học đường | OSRM thật nếu yêu cầu thành công; nếu không, tuyến giả định |
| Ruồi, ô tô, công trình 3D | Three.js dựng thủ tục; không phải hình học GIS đo đạc hay Google Earth |
| Sơ đồ vùng thần kinh mặc định | Nhóm chức năng sinh học tham khảo, các liên kết/trọng số **giả lập** |
| Xung neuron, lực chân, mã điều khiển | **Hoàn toàn giả lập**, chưa được hiệu chuẩn bằng dữ liệu thực nghiệm |
| Nạp đồ thị MaleCNS | Có thể sử dụng ID/cạnh do người dùng xuất từ dữ liệu thật; hoạt động neuron và giải mã vận động vẫn giả định |
| Thời gian thực | Đồng hồ hoạt cảnh và di chuyển trên trình duyệt, không phải neuron/xe thực |
| Ý thức của ruồi | Không được tái tạo và không được khẳng định |

Mô hình nghiên cứu Flyhard dùng cấu trúc kết nối synapse đo được rồi huấn luyện hệ điều khiển, cơ thể ảo và môi trường CARLA. **MapFly không sở hữu checkpoint hoặc mô hình huấn luyện Flyhard**. Muốn tái lập chuẩn khoa học cần tích hợp từng mô-đun sau khi kiểm tra giấy phép, dữ liệu, tính chính xác và năng lực GPU.

## Luồng điều khiển của MapFly

1. Chọn tuyến WGS84 trong sim-core.mjs (định sẵn hoặc lấy từ OSRM).
2. Tính sai lệch góc đến điểm nhìn trước của tuyến.
3. Mã hóa sai lệch góc, mùi và gió vào mạng giả lập phân nhóm thị giác, khứu giác, central complex và đầu ra vận động.
4. Tính hoạt tính neuron và chênh lệch đầu ra motor trái/phải của đồ thị mẫu.
5. Kết hợp **tín hiệu điều hướng + đầu ra thần kinh giả lập + kích thích nút điều khiển** thành góc vô lăng.
6. Cập nhật tọa độ và phương hướng bằng mô hình bicycle; phản hồi trở lại vòng tiếp theo.
7. Vẽ lại ruồi 3D, sơ đồ neuron, quỹ đạo GIS và các đồ thị cảm biến.

Góc nhìn buồng lái sử dụng đường phố 3D tổng hợp và không phản ánh đúng công trình tại vị trí GPS; chỉ **inset bản đồ** hiển thị dữ liệu OSM. Điều này được ghi trực tiếp trên giao diện.

## Tích hợp connectome thật dạng tập con

Nguồn dữ liệu được đề xuất: https://male-cns.janelia.org/download/  
neuPrint dataset: **male-cns:v1.0**.

Trong GitHub Pages, tối đa **240 nút và 1.600 cạnh** cho một lần nhập để tránh quá tải UI. Bạn có thể tự xuất dữ liệu neuron và synapse từ neuPrint, chọn một mạch thần kinh thích hợp và lập bảng ánh xạ chức năng đã được đối chiếu.

Tệp node_map.csv cần các cột:

- bodyId, region, side
- region = visual, olfactory, central hoặc motor
- side = L, R, -1 hoặc 1

Tệp edges.csv cần các cột:

- bodyId_pre, bodyId_post, weight (hoặc bodyId1, bodyId2, weight).

Chuyển đổi:

    python tools/convert_neuprint_subset.py --nodes node_map.csv --edges edges.csv --out male-cns-subset.json

Nạp tệp kết quả qua **Nạp đồ thị JSON**. Bạn phải tự xác thực nguồn dữ liệu và ánh xạ vùng. Bộ tính toán neural của MapFly **không tự động biến kết nối thật thành hoạt động thần kinh thật**.

Tệp **examples/connectome-subset.example.json** chỉ là ví dụ cấu trúc JSON nhân tạo; không phải kết nối MaleCNS.

## Cài đặt và triển khai

Chạy cục bộ:

    python -m http.server 8000

Sau đó mở http://localhost:8000/ với trình duyệt bật WebGL.

Đã cấu hình GitHub Actions trong .github/workflows/pages.yml và bài kiểm tra tests/smoke.mjs. Kiểm tra **Settings → Pages → Source: GitHub Actions** nếu Pages chưa triển khai.

## Chi phí, hiệu năng và điều khoản

- Không dùng Google Earth, Google Maps API hay legacy Google Tiles. Nền Vietflex/OSM không yêu cầu khóa nhưng vẫn phải tuân thủ điều khoản của nhà cấp tile: https://operations.osmfoundation.org/policies/tiles/.
- Bộ định tuyến công cộng **router.project-osrm.org** là demo, không có SLA và không được xem là hạ tầng triển khai thương mại; nên tự host OSRM/Valhalla khi lượng truy cập cao.
- Client không tải hàng loạt tile. Không lưu dữ liệu nhạy cảm; JSON tải lên chỉ được đọc tại browser. Yêu cầu OSRM sẽ gửi tọa độ tuyến cho máy chủ cung cấp dịch vụ.
- Khi chạy WebGL trên thiết bị yếu, cân nhắc giảm độ phân giải hoặc trở về **legacy.html**.
- Mã MapFly giấy phép MIT (© 2026 Long Ngo). Các thư viện Three.js, Vietflex, bản đồ OSM và nội dung của dự án thứ ba giữ giấy phép riêng. Dự án Flyhard do Mark Unthank công bố mã gốc theo MIT nhưng mã phụ thuộc, dataset, mô hình và media cần kiểm tra riêng trước khi sử dụng lại.

**Tài liệu kiến trúc neural bridge:** docs/NEURAL-BRIDGE.md.
