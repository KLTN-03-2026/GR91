import { normalizeText } from "./nlu.js";

const BUSINESS_QA = [
  {
    patterns: [/^xin chào$/, /^hello$/, /^hi$/, /xin chào/, /\bhello\b/, /\bhi\b/],
    answer:
      "Em chào anh/chị. Em có thể hỗ trợ tìm phòng, báo giá, tư vấn loại phòng phù hợp, giải thích chính sách và hỗ trợ đặt phòng nhanh ạ.",
  },
  {
    patterns: [/khách sạn này có gì/, /bạn có thể giúp gì/, /giúp gì cho tôi/, /hướng dẫn tôi cách đặt phòng/],
    answer:
      "Em có thể hỗ trợ anh/chị theo nhiều nhu cầu: tìm phòng theo ngày ở, số người và ngân sách; giải thích giá, chính sách, tiện ích; kiểm tra đơn đặt phòng; và hỗ trợ chốt booking từng bước.",
  },
  {
    patterns: [/khuyến mãi/, /khuyến mại/, /voucher/, /giảm giá/, /ưu đãi/],
    answer:
      "Các ưu đãi hoặc voucher thường thay đổi theo thời điểm. Nếu anh/chị cho em ngày ở và loại phòng quan tâm, em sẽ ưu tiên kiểm tra mức giá phù hợp nhất và báo ngay cho mình ạ.",
  },
  {
    patterns: [/giờ.*check[\s-]?in/, /check[\s-]?in.*mấy giờ/, /nhận phòng.*mấy giờ/],
    answer:
      "Giờ nhận phòng tiêu chuẩn là 14:00. Nếu anh/chị cần nhận sớm, em sẽ kiểm tra theo tình trạng phòng thực tế và báo lại giúp mình ạ.",
  },
  {
    patterns: [/giờ.*check[\s-]?out/, /check[\s-]?out.*mấy giờ/, /trả phòng.*mấy giờ/],
    answer:
      "Giờ trả phòng tiêu chuẩn là 12:00. Nếu cần trả muộn, bên em có thể hỗ trợ theo tình trạng phòng trong ngày ạ.",
  },
  {
    patterns: [/hủy phòng/, /huỷ phòng/, /hoàn tiền/, /chính sách hủy/, /cancel/],
    answer:
      "Chính sách hiện tại là hủy trước 48 giờ sẽ được miễn phí. Nếu hủy sát ngày hơn, khách sạn sẽ áp dụng phí theo điều kiện đặt phòng thực tế.",
  },
  {
    patterns: [/trẻ em/, /phụ thu bé/, /bé .* tuổi/, /em bé/],
    answer:
      "Bên em miễn phí cho trẻ dưới 6 tuổi. Trẻ từ 6 đến 11 tuổi phụ thu 50% theo chính sách hiện tại của khách sạn ạ.",
  },
  {
    patterns: [/thú cưng/, /mang chó/, /mang mèo/, /pet/],
    answer:
      "Khách sạn hỗ trợ thú cưng nhỏ dưới 5kg và có thể phát sinh phụ thu theo đêm. Nếu anh/chị mang theo thú cưng, em sẽ ghi chú để lễ tân xác nhận lại giúp mình.",
  },
  {
    patterns: [/thanh toán/, /trả tiền/, /momo/, /zalopay/, /chuyển khoản/, /thẻ/, /tiền mặt/],
    answer:
      "Bên em hỗ trợ các hình thức thanh toán phổ biến như tiền mặt, thẻ và chuyển khoản. Nếu anh/chị cần chốt nhanh, em có thể ghi chú phương thức thanh toán mong muốn trong đơn đặt phòng.",
  },
  {
    patterns: [/giá phòng/, /báo giá/, /giá hôm nay/, /phụ thu/],
    answer:
      "Giá phòng phụ thuộc ngày ở, số khách và loại phòng. Nếu anh/chị cho em ngày nhận phòng, ngày trả phòng và số người, em sẽ kiểm tra mức giá phù hợp nhất từ hệ thống.",
  },
  {
    patterns: [/ăn sáng/, /buffet/, /phục vụ phòng/, /room service/],
    answer:
      "Một số hạng phòng hoặc gói đặt sẽ bao gồm ăn sáng. Giờ buffet và dịch vụ phục vụ phòng có thể khác theo ngày vận hành, nên khi anh/chị chốt ngày ở em sẽ kiểm tra và báo chính xác hơn.",
  },
  {
    patterns: [/xuất hóa đơn/, /xuất hoá đơn/, /vat/, /hóa đơn đỏ/, /hoá đơn đỏ/],
    answer:
      "Khách sạn có thể hỗ trợ xuất hóa đơn. Khi đặt phòng, anh/chị chỉ cần gửi thông tin công ty hoặc mã số thuế để lễ tân xác nhận lại phần nghiệp vụ này ạ.",
  },
  {
    patterns: [/đậu xe/, /đỗ xe/, /giữ xe/, /parking/],
    answer:
      "Bên em có hỗ trợ khu vực đậu xe cho khách lưu trú. Nếu anh/chị đi ô tô hoặc xe đoàn, em khuyên nên báo trước để khách sạn sắp xếp thuận tiện hơn.",
  },
  {
    patterns: [/hồ bơi/, /gym/, /spa/, /tiện ích chung/, /tiện nghi khách sạn/],
    answer:
      "Ngoài phòng nghỉ, khách sạn có các tiện ích chung tùy hạng phòng và thời điểm vận hành. Nếu anh/chị muốn, em có thể tư vấn luôn loại phòng phù hợp có tiện nghi nổi bật hơn.",
  },
  {
    patterns: [/có wifi không/, /máy lạnh/, /bồn tắm/, /ban công/, /giường đôi/, /giường đơn/, /diện tích phòng/, /hình ảnh phòng/],
    answer:
      "Em có thể kiểm tra chi tiết từng phòng như wifi, máy lạnh, bồn tắm, ban công, loại giường, diện tích và hình ảnh. Anh/chị chỉ cần chọn phòng hoặc cho em biết loại phòng muốn xem là em tư vấn ngay.",
  },
  {
    patterns: [/đổi ngày/, /chỉnh sửa booking/, /sửa đặt phòng/, /thay đổi đặt phòng/],
    answer:
      "Bên em có thể hỗ trợ đổi ngày hoặc cập nhật đơn đặt phòng, nhưng sẽ cần kiểm tra tình trạng phòng ở thời điểm mới. Anh/chị gửi giúp em mã đặt phòng và ngày muốn đổi là em hướng dẫn tiếp ngay.",
  },
  {
    patterns: [/booking của tôi là gì/, /kiểm tra đặt phòng/, /tôi đã đặt phòng chưa/, /phòng của tôi là gì/],
    answer:
      "Để kiểm tra thông tin booking cá nhân, anh/chị gửi giúp em mã đặt phòng hoặc số điện thoại đã dùng khi đặt. Em sẽ hướng dẫn bước kiểm tra tiếp theo cho mình ạ.",
  },
  {
    patterns: [/ở đâu/, /địa chỉ/, /vị trí/, /gần biển/, /gần trung tâm/],
    answer:
      "Nếu anh/chị cần thông tin vị trí hoặc điểm tham quan xung quanh, em có thể hỗ trợ giải đáp ở mức nghiệp vụ chung. Riêng khoảng cách chính xác hoặc chỉ đường, bên em nên xác nhận lại theo địa chỉ vận hành thực tế.",
  },
  {
    patterns: [/quy trình đặt/, /đặt như thế nào/, /book như thế nào/],
    answer:
      "Quy trình đặt phòng khá nhanh: anh/chị cho em ngày ở, số người, ngân sách hoặc loại phòng mong muốn. Em sẽ kiểm tra phòng phù hợp, sau đó hỗ trợ chốt đơn và ghi nhận thông tin liên hệ.",
  },
  {
    patterns: [/không đặt được phòng/, /lỗi thanh toán/, /không nhận được email/, /hỗ trợ gấp/, /gọi lễ tân/],
    answer:
      "Nếu anh/chị đang gặp sự cố đặt phòng hoặc thanh toán, em sẽ ưu tiên hỗ trợ theo từng bước. Anh/chị mô tả giúp em lỗi đang gặp hoặc gửi mã đặt phòng/số điện thoại để em hướng dẫn xử lý nhanh hơn.",
  },
  {
    patterns: [/khách sạn có tốt không/, /đánh giá phòng này/, /tôi muốn review/, /xem đánh giá/],
    answer:
      "Em có thể giúp anh/chị đánh giá theo nhu cầu sử dụng như đi công tác, du lịch gia đình, nghỉ ngắn ngày hoặc tối ưu ngân sách. Nếu anh/chị muốn, em sẽ so sánh các lựa chọn đáng tiền nhất cho mình.",
  },
  {
    patterns: [/gợi ý phòng cho tôi/, /phòng nào phù hợp với tôi/, /chọn phòng nào/, /đáng tiền nhất/],
    answer:
      "Em có thể gợi ý phòng phù hợp theo số người, ngân sách, mục đích đi ở và sở thích như yên tĩnh, tầng cao hay view đẹp. Anh/chị chỉ cần cho em vài tiêu chí chính là em đề xuất ngay.",
  },
];

export function retrieveContext(query) {
  const normalized = normalizeText(query);
  for (const item of BUSINESS_QA) {
    if (item.patterns.some((pattern) => pattern.test(normalized))) {
      return item.answer;
    }
  }
  return null;
}
