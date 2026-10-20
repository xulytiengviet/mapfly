# Neural Bridge — hợp đồng tích hợp connectome (thiết kế, chưa triển khai)

MapFly bản hiện tại là **Geo-ABM thuần quy tắc**. Tài liệu này mô tả biên giao tiếp để về sau ghép dịch vụ chạy **MaleCNS v1.0**, thay vì giả nhận ứng dụng hiện tại có 166.700 neuron.

## Sơ đồ

WebGIS / GIS vector → trích xuất tín hiệu cảnh quan (giả lập hoặc cảm biến được kiểm định)
→ adapter đầu vào → neural simulator GPU / backend tính toán
→ adapter điều khiển → cập nhật phương tiện bay / GeoJSON.

**Lưu ý**: Google Street View không phải camera thời gian thực và không được tự ý khai thác frame vào mô hình; cần dùng dữ liệu cảm biến hợp lệ, có quyền sử dụng, và phân biệt biến giả lập với dữ liệu đo.

## Gợi ý đầu vào POST /v1/step

    {
      "model": "malecns-v1-0",
      "session_id": "fly-001",
      "sim_time_ms": 1000,
      "dt_ms": 5,
      "environment": {
        "lat": 10.77595,
        "lon": 106.70103,
        "altitude_m": 5.0,
        "heading_deg": 90
      },
      "sensory": {
        "visual_motion_left": 0.12,
        "visual_motion_right": 0.15,
        "olfaction_left": 0.35,
        "olfaction_right": 0.48,
        "wind_east_mps": 0.10,
        "wind_north_mps": 0.00
      }
    }

Tất cả giá trị minh họa; không có bảo đảm ánh xạ trực tiếp đến neuron thật.

## Gợi ý đầu ra

    {
      "model_version": "malecns-v1-0:adapter-a",
      "units": {
        "turn_rate": "rad/s",
        "forward_speed": "m/s"
      },
      "controls": {
        "turn_rate": 0.03,
        "forward_speed": 0.90,
        "flight_state": "cruise"
      },
      "metadata": {
        "connectome_used": true,
        "inference_method": "LIF hypothetical",
        "scientific_validation": "not-validated"
      }
    }

Không thể suy luận rằng các đầu ra này phản ánh ruồi sinh học nếu chưa có mô hình đầu vào cảm giác, neuron, synapse, điều khiển cơ và quy trình kiểm định thống nhất.

## Giao thức và bảo mật

- Backend tùy chọn; GitHub Pages chỉ chứa frontend, không lưu token backend/GPU.
- Giao tiếp HTTPS, CORS giới hạn tên miền, xác thực và chống lạm dụng ở backend.
- Không đặt khóa API bí mật trên GitHub Pages. Keys Google Maps Embed API phải giới hạn HTTP referrers.
- Giới hạn tần suất tối thiểu để không gây quá tải; cho phép chế độ Geo-ABM ngoại tuyến với nguồn dữ liệu cục bộ.
- Ghi log provenance: hash dữ liệu connectome, số phiên bản, tính chất dữ liệu (đo/giả lập), và độ tin cậy.
- Đánh giá hiệu năng, độ ổn định và sai lệch dữ liệu trên các bộ kiểm định đã định nghĩa từ trước.

Nguồn chuẩn MaleCNS: https://male-cns.janelia.org/ ; công bố: https://doi.org/10.1016/j.cell.2026.08.015.