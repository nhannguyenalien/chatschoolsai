#!/usr/bin/env node
// Generates the three done-for-you setup landing pages (VN / ID / PH) from one template so the
// structure, form and payment flow stay identical; only the copy differs per market.
//   node scripts/build-service-landings.mjs
// Output: dash-tabler/landing-vn.html, landing-id.html, landing-ph.html (committed, static).
// The AI Social Content pages (8 languages) are built by scripts/build-social-landings.mjs.
// Prices and promises must match the bot knowledge (docs/service-training/README.md).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "dash-tabler");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SITE = "https://chat.schoolsai.work";

// Online payment: plain Whop product links (created in the Whop dashboard of the SchoolsAI business, USD).
// Orders are matched to the lead by e-mail by hand; nothing in the BGate catalog or Worker secrets is needed.
// The in-form "register and pay" flow (BGate checkout) stays in the code but is off: set PAY_FORM = true and add
// the setup_vn / setup_id / setup_ph plans to BGATE_CATALOG_JSON (docs/SERVICE_LANDING.md) to turn it on.
const PAY_FORM = false;
const WHOP = {
  setup: "https://whop.com/schoolsai/schools-ai-setup-done-for-you-ai-chatbot-setup/",
  managed: "https://whop.com/schoolsai/schools-ai-managed-monthly-chatbot-management/",
  growth: "https://whop.com/schoolsai/schools-ai-growth-monthly-chatbot-loyalty-and-content/"
};
const USD = { setup: "100 USD", managed: "35 USD", growth: "89 USD" };
// Per market: button text ({usd} is replaced), "per month" suffix and the note under the cards.
const PAYCOPY = {
  vn: { btn: "Thanh toán {usd} qua Whop", per: "/tháng", once: "một lần",
    foot: "Thanh toán online qua Whop, tính bằng USD. Hãy dùng cùng email với biểu mẫu bên dưới để chúng tôi đối chiếu đơn. Gói tháng tính phí mỗi tháng.",
    faq: ["Thanh toán như thế nào?", "Bạn có thể thanh toán trực tiếp ở mục Các gói qua Whop (tính bằng USD, số tiền hiển thị trên trang thanh toán), hoặc để lại thông tin để nhân viên tư vấn trước."],
    intro: "Để lại thông tin, nhân viên sẽ liên hệ tư vấn. Muốn bắt đầu ngay? Bạn có thể thanh toán gói Setup ở mục Các gói phía trên." },
  id: { btn: "Bayar {usd} lewat Whop", per: "/bulan", once: "sekali bayar",
    foot: "Pembayaran online lewat Whop, dalam USD. Gunakan email yang sama dengan formulir di bawah agar kami bisa mencocokkan pesanan. Paket bulanan ditagih setiap bulan.",
    faq: ["Bagaimana cara membayar?", "Anda bisa membayar langsung di bagian Paket lewat Whop (dalam USD, jumlahnya tampil di halaman pembayaran), atau tinggalkan data agar staf berkonsultasi dulu."],
    intro: "Tinggalkan data Anda dan staf akan menghubungi. Ingin langsung mulai? Anda bisa membayar paket Setup di bagian Paket di atas." },
  ph: { btn: "Pay {usd} via Whop", per: "/month", once: "one-time",
    foot: "Online payment through Whop, in USD. Please use the same email as the form below so we can match your order. Monthly packages are billed every month.",
    faq: ["How do I pay?", "You can pay directly in the Packages section through Whop (in USD, the amount is shown on the payment page), or leave your details so staff can advise you first."],
    intro: "Leave your details and staff will contact you. Want to start right away? You can pay for the Setup package in the Packages section above." }
};

const MARKETS = {
  vn: {
    htmlLang: "vi", lang: "vi", tenant: "schoolsai-vn", setupPlan: "setup_vn", file: "landing-vn.html", label: "Việt Nam",
    title: "Schools AI — Cài đặt và quản lý chatbot AI cho doanh nghiệp nhỏ tại Việt Nam",
    description: "Đội ngũ Schools AI cài đặt và vận hành hộ trợ lý AI trả lời khách 24/7 trên website và fanpage, nhận đặt lịch. Gói Setup từ 2.500.000đ, không cần biết kỹ thuật.",
    nav: { packages: "Các gói", process: "Quy trình", faq: "Hỏi đáp", register: "Đăng ký", home: "Trang chủ" },
    hero: {
      eyebrow: "DỊCH VỤ CÀI ĐẶT HỘ · VIỆT NAM", h1a: "Có trợ lý AI trả lời khách.", h1b: "Bạn không phải cài gì.",
      intro: "Spa, clinic, salon, cửa hàng, quán ăn, trung tâm đào tạo: đội ngũ Schools AI cài đặt và vận hành hộ chatbot AI trả lời khách 24/7 trên website và fanpage, tư vấn dịch vụ, nhận đặt lịch và chuyển ca khó cho người thật.",
      cta: "Đăng ký tư vấn", cta2: "Xem các gói", note: "Chủ doanh nghiệp không cần biết kỹ thuật."
    },
    trust: [["24/7", "Trả lời khách trên website và fanpage Facebook"], ["3 đến 5 ngày", "Thời gian cài đặt kể từ khi đủ tài liệu"], ["Hủy bất cứ lúc nào", "Không bắt buộc hợp đồng dài hạn"]],
    packages: {
      kicker: "CÁC GÓI", heading: "Chọn gói phù hợp với doanh nghiệp của bạn", intro: "Giá niêm yết cho Việt Nam, tính bằng VND.",
      cards: [
        { id: "setup", name: "Setup", price: "2.500.000đ", period: "trả một lần", note: "Bắt đầu từ đây", items: [
          "Tạo workspace riêng, đặt tên, màu sắc, lời chào cho bot", "Nạp kiến thức: bảng giá, dịch vụ, FAQ, chính sách (tối đa khoảng 30 trang hoặc mục)",
          "Cấu hình đặt lịch: dịch vụ, thời lượng, giờ làm việc, nhân viên", "Gắn widget lên website và kết nối đúng 1 kênh chat",
          "Kiểm thử với khoảng 20 câu hỏi thật trước khi bàn giao"] },
        { id: "managed", name: "Managed", price: "890.000đ", period: "mỗi tháng", note: "Dành cho khách đã Setup", items: [
          "Cập nhật kiến thức khi bảng giá hoặc chính sách đổi (tối đa 10 mục mỗi tháng)", "Mỗi tháng rà soát hội thoại bot trả lời sai và sửa lại",
          "Báo cáo hàng tháng: số hội thoại, số lịch đặt, câu hỏi hay gặp, câu bot chưa trả lời được", "Hỗ trợ qua email, phản hồi trong 2 ngày làm việc"] },
        { id: "growth", name: "Growth", price: "2.290.000đ", period: "mỗi tháng", note: "Cho doanh nghiệp muốn tăng trưởng", items: [
          "Gồm toàn bộ gói Managed", "Chương trình tích điểm thưởng cho khách", "Hỗ trợ blog và nội dung mạng xã hội: 4 bài mỗi tháng",
          "Tối đa 3 kênh chat, rà soát hội thoại 2 lần mỗi tháng, phản hồi trong 1 ngày làm việc"] }
      ],
      foot: "Trả trước theo năm: trả 10 tháng, dùng 12 tháng. Ngoài phạm vi các gói: tích hợp phần mềm riêng, lập trình tùy biến, chạy quảng cáo, thiết kế lại website (nhân viên sẽ báo giá riêng)."
    },
    process: { kicker: "QUY TRÌNH", heading: "Từ đăng ký đến bot chạy thật", steps: [
      ["Gửi thông tin", "Bạn điền thông tin cơ bản, gửi bảng giá và các câu hỏi khách hay hỏi."],
      ["Cấu hình", "Đội ngũ cấu hình bot theo mẫu của ngành và nạp kiến thức."],
      ["Kiểm thử cùng bạn", "Hỏi thử khoảng 20 câu thật, sửa những câu trả lời chưa đạt."],
      ["Bàn giao", "Bạn nhận link dashboard và hướng dẫn ngắn để xem hội thoại, lịch đặt."],
      ["Theo dõi", "Sau 7 ngày xem lại hội thoại thật, sau 30 ngày gửi báo cáo đầu tiên."]] },
    faq: { kicker: "HỎI ĐÁP", heading: "Câu hỏi thường gặp", items: [
      ["Bot trả lời sai thì sao?", "Bot chỉ trả lời dựa trên thông tin doanh nghiệp cung cấp. Câu không chắc thì chuyển cho người thật. Mỗi tháng đội ngũ rà soát và sửa lại."],
      ["Tôi không rành công nghệ có dùng được không?", "Được. Đội ngũ cài đặt toàn bộ. Bạn chỉ cần gửi bảng giá và câu hỏi khách hay hỏi, rồi xem hội thoại và lịch đặt trên dashboard."],
      ["Dữ liệu của tôi có lẫn với doanh nghiệp khác không?", "Không. Mỗi doanh nghiệp có workspace riêng, tách biệt cấu hình, kênh chat, khách hàng và điểm thưởng."],
      ["Bot nói được những ngôn ngữ nào?", "Bot tự nhận biết ngôn ngữ của khách và trả lời cùng ngôn ngữ đó; nhiều ngôn ngữ được hỗ trợ."],
      ["Kết nối được những kênh nào?", "Website và fanpage Facebook. Với kênh khác như Zalo hoặc WhatsApp, nhân viên sẽ kiểm tra khả năng hỗ trợ rồi báo lại."],
      ["Thanh toán gói Setup như thế nào?", "Bạn có thể chọn nhận tư vấn trước, hoặc đăng ký và thanh toán Setup ngay trên trang này qua Whop. Thanh toán online tính bằng USD, số tiền cụ thể hiển thị trước khi bạn xác nhận."],
      ["Tôi có thể hủy không?", "Có, hủy bất cứ lúc nào, hiệu lực cuối kỳ thanh toán. Không bắt buộc hợp đồng dài hạn."]] },
    form: {
      kicker: "ĐĂNG KÝ", heading: "Để lại thông tin, chúng tôi liên hệ bạn", intro: "Chọn nhận tư vấn miễn phí, hoặc đăng ký tài khoản và thanh toán gói Setup ngay.",
      labels: { name: "Họ và tên", email: "Email", phone: "Số điện thoại / Zalo (không bắt buộc)", business_name: "Tên doanh nghiệp", business_type: "Ngành nghề", city: "Thành phố", plan: "Gói bạn quan tâm", message: "Ghi chú (không bắt buộc)", password: "Mật khẩu tài khoản", password_hint: "Từ 8 ký tự. Dùng để đăng nhập dashboard.", mode: "Bạn muốn", consult: "Nhận tư vấn miễn phí", pay: "Đăng ký và thanh toán gói Setup ngay", select: "Chọn…" },
      types: ["Spa / thẩm mỹ", "Clinic / phòng khám", "Salon / nail / tóc", "Cửa hàng bán lẻ", "Quán ăn / cà phê", "Giáo dục / đào tạo", "Khác"],
      plans: [["setup", "Chỉ Setup"], ["setup_managed", "Setup + Managed"], ["setup_growth", "Setup + Growth"], ["unsure", "Chưa chắc, cần tư vấn"]],
      consent: "Tôi đồng ý để Schools AI lưu thông tin này và liên hệ tư vấn. Xem", privacy: "Chính sách quyền riêng tư",
      submitConsult: "Gửi thông tin", submitPay: "Tạo tài khoản và tiếp tục", payNote: "Bạn sẽ tạo tài khoản Schools AI (workspace riêng) và xem số tiền trước khi sang trang thanh toán Whop."
    },
    msg: {
      required: "Vui lòng điền đủ các mục bắt buộc.", invalid_email: "Email chưa đúng định dạng.", short_password: "Mật khẩu cần từ 8 ký tự.",
      sending: "Đang gửi…", creating: "Đang tạo tài khoản…", logging: "Đang đăng nhập…", checking: "Đang kiểm tra thanh toán…",
      email_exists: "Email này đã có tài khoản. Thông tin của bạn đã được gửi cho đội ngũ; bạn cũng có thể đăng nhập và thanh toán trong mục Thanh toán.",
      tenant_taken: "Không tạo được workspace, vui lòng thử lại.", lead_failed: "Chưa gửi được thông tin, vui lòng thử lại sau ít phút.",
      rate_limited: "Bạn thao tác quá nhanh, vui lòng thử lại sau.", network: "Không kết nối được máy chủ, vui lòng thử lại.",
      pay_not_ready: "Tài khoản đã tạo và thông tin đã gửi. Thanh toán online chưa sẵn sàng, nhân viên sẽ liên hệ gửi link thanh toán.",
      pay_title: "Xác nhận thanh toán", pay_text: "Gói {label}: {amount} {currency}, trả một lần, qua Whop.", pay_button: "Tiếp tục sang trang thanh toán", redirecting: "Đang chuyển sang trang thanh toán…",
      pay_error: "Chưa tạo được trang thanh toán. Bạn có thể thử lại hoặc vào Thanh toán trong dashboard.",
      success_title: "Đã nhận thông tin", success_body: "Cảm ơn bạn. Nhân viên Schools AI sẽ liên hệ sớm. Bạn cũng có thể hỏi trợ lý ở góc màn hình.",
      account_done: "Đã tạo tài khoản và gửi thông tin.", go_dashboard: "Vào dashboard", go_billing: "Mở trang Thanh toán"
    },
    footer: "© 2026 Schools AI. Cùng bạn làm điều hay."
  },
  id: {
    htmlLang: "id", lang: "id", tenant: "schoolsai-id", setupPlan: "setup_id", file: "landing-id.html", label: "Indonesia",
    title: "Schools AI — Pemasangan dan pengelolaan chatbot AI untuk bisnis kecil di Indonesia",
    description: "Tim Schools AI memasang dan mengelola asisten AI yang menjawab pelanggan 24 jam di website dan fanpage, serta menerima booking. Paket Setup mulai Rp1.650.000, tanpa perlu paham teknis.",
    nav: { packages: "Paket", process: "Alur kerja", faq: "Tanya jawab", register: "Daftar", home: "Beranda" },
    hero: {
      eyebrow: "LAYANAN DIPASANGKAN · INDONESIA", h1a: "Asisten AI yang menjawab pelanggan.", h1b: "Anda tidak perlu memasang apa pun.",
      intro: "Spa, klinik, salon, toko, restoran, lembaga kursus: tim Schools AI memasang dan mengelola chatbot AI yang menjawab pelanggan 24 jam di website dan fanpage, memberi saran layanan, menerima booking, dan meneruskan kasus sulit ke staf.",
      cta: "Daftar konsultasi", cta2: "Lihat paket", note: "Pemilik bisnis tidak perlu paham teknis."
    },
    trust: [["24 jam", "Menjawab pelanggan di website dan fanpage Facebook"], ["3 sampai 5 hari kerja", "Waktu pemasangan setelah dokumen lengkap"], ["Berhenti kapan saja", "Tidak ada kontrak jangka panjang"]],
    packages: {
      kicker: "PAKET", heading: "Pilih paket yang cocok untuk bisnis Anda", intro: "Harga resmi untuk Indonesia, dalam Rupiah.",
      cards: [
        { id: "setup", name: "Setup", price: "Rp1.650.000", period: "sekali bayar", note: "Mulai dari sini", items: [
          "Membuat workspace khusus, nama bot, warna, dan sapaan", "Memasukkan pengetahuan: daftar harga, layanan, FAQ, kebijakan (maksimal sekitar 30 halaman atau item)",
          "Konfigurasi booking: layanan, durasi, jam kerja, staf", "Memasang widget chat di website dan menghubungkan tepat 1 kanal chat",
          "Pengujian dengan sekitar 20 pertanyaan nyata sebelum serah terima"] },
        { id: "managed", name: "Managed", price: "Rp550.000", period: "per bulan", note: "Untuk pelanggan yang sudah Setup", items: [
          "Memperbarui pengetahuan saat harga atau kebijakan berubah (maksimal 10 item per bulan)", "Setiap bulan memeriksa percakapan yang dijawab keliru dan memperbaikinya",
          "Laporan bulanan: jumlah percakapan, jumlah booking, pertanyaan yang sering muncul, pertanyaan yang belum terjawab", "Dukungan lewat email, balasan dalam 2 hari kerja"] },
        { id: "growth", name: "Growth", price: "Rp1.450.000", period: "per bulan", note: "Untuk bisnis yang ingin berkembang", items: [
          "Mencakup semua isi Managed", "Program poin loyalitas untuk pelanggan", "Bantuan artikel blog dan konten media sosial: 4 konten per bulan",
          "Maksimal 3 kanal chat, pemeriksaan percakapan 2 kali per bulan, balasan dalam 1 hari kerja"] }
      ],
      foot: "Bayar tahunan lebih hemat: bayar 10 bulan, pakai 12 bulan. Di luar cakupan paket: integrasi software khusus, pemrograman khusus, iklan berbayar, desain ulang website (staf akan memberi penawaran terpisah)."
    },
    process: { kicker: "ALUR KERJA", heading: "Dari pendaftaran sampai bot berjalan", steps: [
      ["Kirim informasi", "Anda mengisi informasi dasar, mengirim daftar harga dan pertanyaan yang sering diajukan pelanggan."],
      ["Konfigurasi", "Tim mengatur bot dengan template sesuai industri dan memasukkan pengetahuan."],
      ["Uji bersama Anda", "Coba sekitar 20 pertanyaan nyata, perbaiki jawaban yang kurang tepat."],
      ["Serah terima", "Anda menerima link dashboard dan panduan singkat untuk melihat percakapan dan booking."],
      ["Pemantauan", "Setelah 7 hari tinjau percakapan nyata, setelah 30 hari kirim laporan pertama."]] },
    faq: { kicker: "TANYA JAWAB", heading: "Pertanyaan yang sering diajukan", items: [
      ["Bagaimana jika bot menjawab salah?", "Bot hanya menjawab berdasarkan informasi yang diberikan bisnis. Jika tidak yakin, bot meneruskan ke staf. Setiap bulan tim memeriksa dan memperbaiki."],
      ["Saya tidak paham teknologi, apakah bisa?", "Bisa. Tim memasang semuanya. Anda cukup mengirim daftar harga dan pertanyaan pelanggan, lalu melihat percakapan dan booking di dashboard."],
      ["Apakah data saya tercampur dengan bisnis lain?", "Tidak. Setiap bisnis punya workspace sendiri, terpisah untuk konfigurasi, kanal chat, pelanggan, dan poin."],
      ["Bahasa apa yang didukung bot?", "Bot mengenali bahasa pelanggan dan menjawab dalam bahasa yang sama; banyak bahasa didukung."],
      ["Kanal apa saja yang bisa dihubungkan?", "Website dan fanpage Facebook. Untuk kanal lain seperti WhatsApp, staf akan memeriksa dukungannya lalu mengabari Anda."],
      ["Bagaimana cara membayar paket Setup?", "Anda bisa memilih konsultasi dulu, atau mendaftar dan membayar Setup langsung di halaman ini lewat Whop. Pembayaran online dalam USD, jumlah pastinya ditampilkan sebelum Anda mengonfirmasi."],
      ["Apakah saya bisa berhenti?", "Bisa, kapan saja, berlaku di akhir periode tagihan. Tidak ada kontrak jangka panjang."]] },
    form: {
      kicker: "DAFTAR", heading: "Tinggalkan data Anda, kami akan menghubungi", intro: "Pilih konsultasi gratis, atau buat akun dan bayar paket Setup sekarang.",
      labels: { name: "Nama lengkap", email: "Email", phone: "Nomor telepon / WhatsApp (opsional)", business_name: "Nama bisnis", business_type: "Jenis bisnis", city: "Kota", plan: "Paket yang diminati", message: "Catatan (opsional)", password: "Kata sandi akun", password_hint: "Minimal 8 karakter. Untuk masuk ke dashboard.", mode: "Saya ingin", consult: "Konsultasi gratis", pay: "Daftar dan bayar paket Setup sekarang", select: "Pilih…" },
      types: ["Spa / kecantikan", "Klinik", "Salon / nail / rambut", "Toko ritel", "Restoran / kafe", "Pendidikan / kursus", "Lainnya"],
      plans: [["setup", "Setup saja"], ["setup_managed", "Setup + Managed"], ["setup_growth", "Setup + Growth"], ["unsure", "Belum yakin, perlu saran"]],
      consent: "Saya setuju Schools AI menyimpan data ini dan menghubungi saya untuk konsultasi. Lihat", privacy: "Kebijakan privasi",
      submitConsult: "Kirim data", submitPay: "Buat akun dan lanjutkan", payNote: "Anda akan membuat akun Schools AI (workspace khusus) dan melihat jumlah pembayaran sebelum pindah ke halaman pembayaran Whop."
    },
    msg: {
      required: "Mohon isi semua kolom wajib.", invalid_email: "Format email belum benar.", short_password: "Kata sandi minimal 8 karakter.",
      sending: "Mengirim…", creating: "Membuat akun…", logging: "Masuk…", checking: "Memeriksa pembayaran…",
      email_exists: "Email ini sudah punya akun. Data Anda sudah dikirim ke tim; Anda juga bisa masuk dan membayar di menu Pembayaran.",
      tenant_taken: "Workspace belum bisa dibuat, silakan coba lagi.", lead_failed: "Data belum terkirim, silakan coba lagi beberapa menit lagi.",
      rate_limited: "Terlalu cepat, silakan coba lagi nanti.", network: "Tidak dapat terhubung ke server, silakan coba lagi.",
      pay_not_ready: "Akun sudah dibuat dan data sudah terkirim. Pembayaran online belum siap, staf akan menghubungi dengan link pembayaran.",
      pay_title: "Konfirmasi pembayaran", pay_text: "Paket {label}: {amount} {currency}, sekali bayar, lewat Whop.", pay_button: "Lanjut ke halaman pembayaran", redirecting: "Mengalihkan ke halaman pembayaran…",
      pay_error: "Halaman pembayaran belum bisa dibuat. Coba lagi atau buka menu Pembayaran di dashboard.",
      success_title: "Data diterima", success_body: "Terima kasih. Staf Schools AI akan segera menghubungi Anda. Anda juga bisa bertanya kepada asisten di sudut layar.",
      account_done: "Akun dibuat dan data terkirim.", go_dashboard: "Buka dashboard", go_billing: "Buka halaman Pembayaran"
    },
    footer: "© 2026 Schools AI."
  },
  ph: {
    htmlLang: "en-PH", lang: "en", tenant: "schoolsai-ph", setupPlan: "setup_ph", file: "landing-ph.html", label: "Philippines",
    title: "Schools AI — Done-for-you AI chatbot setup and management for small businesses in the Philippines",
    description: "The Schools AI team sets up and runs an AI assistant that answers customers 24/7 on your website and Facebook page and takes bookings. Setup from 5,800 pesos, no technical skills needed.",
    nav: { packages: "Packages", process: "How it works", faq: "FAQ", register: "Sign up", home: "Home" },
    hero: {
      eyebrow: "DONE-FOR-YOU SETUP · PHILIPPINES", h1a: "An AI assistant answering your customers.", h1b: "Nothing for you to install.",
      intro: "Spas, clinics, salons, shops, restaurants, training centers: the Schools AI team sets up and runs an AI chatbot that answers customers 24/7 on your website and Facebook page, advises on services, takes bookings, and hands difficult cases to a real person.",
      cta: "Book a consultation", cta2: "See packages", note: "No technical skill needed from the owner."
    },
    trust: [["24/7", "Answers customers on your website and Facebook page"], ["3 to 5 working days", "Setup time once we have your documents"], ["Cancel anytime", "No long-term contract"]],
    packages: {
      kicker: "PACKAGES", heading: "Choose the package that fits your business", intro: "List prices for the Philippines, in Philippine pesos.",
      cards: [
        { id: "setup", name: "Setup", price: "₱5,800", period: "one-time", note: "Start here", items: [
          "A dedicated workspace with your bot name, colors, and greeting", "Knowledge loaded: price list, services, FAQ, policies (up to about 30 pages or items)",
          "Booking setup: services, durations, working hours, staff", "Chat widget on your website and exactly 1 connected chat channel",
          "Tested with about 20 real questions before handover"] },
        { id: "managed", name: "Managed", price: "₱1,950", period: "per month", note: "For customers who have done Setup", items: [
          "Knowledge updates when prices or policies change (up to 10 items per month)", "Monthly review of conversations the bot got wrong, and fixes",
          "Monthly report: conversations, bookings, frequent questions, questions the bot could not answer", "Email support, reply within 2 working days"] },
        { id: "growth", name: "Growth", price: "₱4,900", period: "per month", note: "For businesses that want to grow", items: [
          "Everything in Managed", "A loyalty points program for your customers", "Blog and social media content help: 4 pieces per month",
          "Up to 3 chat channels, conversation review twice a month, reply within 1 working day"] }
      ],
      foot: "Annual prepayment: pay 10 months, use 12. Out of scope: integration with your own software, custom programming, paid ads, website redesign (staff will quote separately)."
    },
    process: { kicker: "HOW IT WORKS", heading: "From sign-up to a live bot", steps: [
      ["Send your details", "Fill in the basics and send your price list and the questions customers ask most."],
      ["We configure", "The team sets up the bot with an industry template and loads your knowledge."],
      ["Test together", "Try about 20 real questions and fix the answers that are not good enough."],
      ["Handover", "You get the dashboard link and a short guide to view conversations and bookings."],
      ["Follow-up", "After 7 days we review real conversations; after 30 days you get the first report."]] },
    faq: { kicker: "FAQ", heading: "Frequently asked questions", items: [
      ["What if the bot answers wrongly?", "The bot answers only from information your business provided. When unsure it hands over to a real person. Every month the team reviews and fixes."],
      ["I am not good with technology. Can I still use it?", "Yes. The team sets up everything. You send your price list and common customer questions, then watch conversations and bookings on the dashboard."],
      ["Will my data be mixed with other businesses?", "No. Each business has its own workspace, separating configuration, chat channels, customers, and reward points."],
      ["Which languages does the bot speak?", "The bot detects the customer's language and replies in the same language; many languages are supported."],
      ["Which channels can it connect to?", "Your website and Facebook page. For other channels such as Viber or WhatsApp, staff will check support and get back to you."],
      ["How do I pay for the Setup package?", "You can choose a consultation first, or sign up and pay for Setup right on this page through Whop. Online payment is in USD, and the exact amount is shown before you confirm."],
      ["Can I cancel?", "Yes, anytime, effective at the end of the billing period. There is no long-term contract."]] },
    form: {
      kicker: "SIGN UP", heading: "Leave your details and we will contact you", intro: "Choose a free consultation, or create an account and pay for the Setup package now.",
      labels: { name: "Full name", email: "Email", phone: "Phone / Viber (optional)", business_name: "Business name", business_type: "Type of business", city: "City", plan: "Package you are interested in", message: "Notes (optional)", password: "Account password", password_hint: "At least 8 characters. Used to sign in to the dashboard.", mode: "I want to", consult: "Get a free consultation", pay: "Sign up and pay for the Setup package now", select: "Choose…" },
      types: ["Spa / beauty", "Clinic", "Salon / nails / hair", "Retail shop", "Restaurant / cafe", "Education / training", "Other"],
      plans: [["setup", "Setup only"], ["setup_managed", "Setup + Managed"], ["setup_growth", "Setup + Growth"], ["unsure", "Not sure, need advice"]],
      consent: "I agree that Schools AI stores these details and contacts me about this. See the", privacy: "Privacy Policy",
      submitConsult: "Send details", submitPay: "Create account and continue", payNote: "You will create a Schools AI account (your own workspace) and see the amount before going to the Whop payment page."
    },
    msg: {
      required: "Please fill in all required fields.", invalid_email: "That email does not look right.", short_password: "Password must be at least 8 characters.",
      sending: "Sending…", creating: "Creating your account…", logging: "Signing in…", checking: "Checking payment…",
      email_exists: "This email already has an account. Your details were sent to the team; you can also sign in and pay under Billing.",
      tenant_taken: "We could not create the workspace, please try again.", lead_failed: "We could not send your details, please try again in a few minutes.",
      rate_limited: "Too many attempts, please try again later.", network: "Could not reach the server, please try again.",
      pay_not_ready: "Your account is created and your details were sent. Online payment is not ready yet, staff will contact you with a payment link.",
      pay_title: "Confirm payment", pay_text: "{label} package: {amount} {currency}, one-time, via Whop.", pay_button: "Continue to the payment page", redirecting: "Taking you to the payment page…",
      pay_error: "We could not create the payment page. Try again or open Billing in the dashboard.",
      success_title: "Details received", success_body: "Thank you. The Schools AI team will contact you soon. You can also ask the assistant in the corner of the screen.",
      account_done: "Account created and details sent.", go_dashboard: "Open dashboard", go_billing: "Open Billing"
    },
    footer: "© 2026 Schools AI."
  }
};

const page = (key) => {
  const m = MARKETS[key];
  const others = Object.entries(MARKETS).filter(([k]) => k !== key);
  const cfg = { market: key, setupPlan: m.setupPlan, tenant: m.tenant, lang: m.lang, msg: m.msg };
  const pay = PAYCOPY[key];
  const card = (c) => `
        <article class="svc-card${c.id === "setup" ? " featured" : ""}">
          <p class="svc-note">${esc(c.note)}</p>
          <h3>${esc(c.name)}</h3>
          <p class="svc-price"><strong>${esc(c.price)}</strong> <span>${esc(c.period)}</span></p>
          <ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
          <a class="button ${c.id === "setup" ? "primary" : ""} svc-pay" href="${WHOP[c.id]}" target="_blank" rel="noopener noreferrer" data-plan="${c.id}">${esc(pay.btn.replace("{usd}", USD[c.id] + (c.id === "setup" ? "" : pay.per)))}</a>
        </article>`;
  const faqItems = m.faq.items.map((item, index) => (!PAY_FORM && index === 5 ? pay.faq : item));
  const formIntro = PAY_FORM ? m.form.intro : pay.intro;
  const opts = (list) => list.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  const L = m.form.labels;
  return `<!doctype html>
<html lang="${m.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}">
<link rel="canonical" href="${SITE}/${m.file}">
${Object.entries(MARKETS).map(([k, v]) => `<link rel="alternate" hreflang="${v.htmlLang}" href="${SITE}/${v.file}">`).join("\n")}
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/${m.file}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_shared/landing.css?v=20260925-6lang">
<link rel="stylesheet" href="_shared/service-landing.css?v=20261120-4">
<script src="/_shared/consent.js"></script>
</head>
<body class="svc">
<a class="skip" href="#register">${esc(m.nav.register)}</a>
<header>
  <div class="container nav">
    <a class="brand" href="landing.html"><span class="brand-mark" aria-hidden="true">✳</span>schools<span class="brand-ai">ai</span><span class="brand-dot">.</span></a>
    <nav aria-label="Main">
      <a href="#packages">${esc(m.nav.packages)}</a>
      <a href="#process">${esc(m.nav.process)}</a>
      <a href="#faq">${esc(m.nav.faq)}</a>
      <a href="#register">${esc(m.nav.register)}</a>
    </nav>
    <div class="nav-actions">
      <span class="svc-switch" aria-label="Country">
        <strong aria-current="page">${esc(m.label)}</strong>
        ${others.map(([, v]) => `<a href="${v.file}" hreflang="${v.htmlLang}" lang="${v.htmlLang}">${esc(v.label)}</a>`).join("\n        ")}
      </span>
      <a class="button small" href="landing.html">${esc(m.nav.home)}</a>
    </div>
  </div>
</header>
<main id="main">
  <section class="container svc-hero">
    <p class="eyebrow">${esc(m.hero.eyebrow)}</p>
    <h1><span>${esc(m.hero.h1a)}</span> <span class="highlight">${esc(m.hero.h1b)}</span></h1>
    <p class="intro">${esc(m.hero.intro)}</p>
    <div class="hero-actions">
      <a class="button primary" href="#register">${esc(m.hero.cta)}</a>
      <a class="text-link" href="#packages">${esc(m.hero.cta2)} ↓</a>
    </div>
    <p class="fine">${esc(m.hero.note)}</p>
    <ul class="svc-trust">${m.trust.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join("")}</ul>
  </section>

  <section class="container svc-section" id="packages">
    <p class="eyebrow">${esc(m.packages.kicker)}</p>
    <h2>${esc(m.packages.heading)}</h2>
    <p class="svc-lead">${esc(m.packages.intro)}</p>
    <div class="svc-cards">${m.packages.cards.map(card).join("")}
    </div>
    <p class="svc-foot">${esc(m.packages.foot)}</p>
    <p class="svc-foot">${esc(pay.foot)}</p>
  </section>

  <section class="container svc-section" id="process">
    <p class="eyebrow">${esc(m.process.kicker)}</p>
    <h2>${esc(m.process.heading)}</h2>
    <ol class="svc-steps">${m.process.steps.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join("")}</ol>
  </section>

  <section class="container svc-section" id="faq">
    <p class="eyebrow">${esc(m.faq.kicker)}</p>
    <h2>${esc(m.faq.heading)}</h2>
    <div class="svc-faq">${faqItems.map(([q, a]) => `
      <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
    </div>
  </section>

  <section class="container svc-section svc-register" id="register">
    <div>
      <p class="eyebrow">${esc(m.form.kicker)}</p>
      <h2>${esc(m.form.heading)}</h2>
      <p class="svc-lead">${esc(formIntro)}</p>
    </div>
    <form id="lead-form" class="svc-form" novalidate>
      ${PAY_FORM ? `<div class="svc-mode" role="radiogroup" aria-label="${esc(L.mode)}">
        <label><input type="radio" name="mode" value="consult" checked> <span>${esc(L.consult)}</span></label>
        <label><input type="radio" name="mode" value="pay"> <span>${esc(L.pay)}</span></label>
      </div>` : `<input type="hidden" name="mode" value="consult">`}
      <div class="svc-grid">
        <label>${esc(L.name)} *<input name="name" autocomplete="name" required maxlength="80"></label>
        <label>${esc(L.email)} *<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label>${esc(L.phone)}<input name="phone" type="tel" autocomplete="tel" maxlength="20"></label>
        <label>${esc(L.business_name)} *<input name="business_name" autocomplete="organization" required maxlength="80"></label>
        <label>${esc(L.business_type)} *<select name="business_type" required><option value="">${esc(L.select)}</option>${opts(m.form.types)}</select></label>
        <label>${esc(L.city)} *<input name="city" autocomplete="address-level2" required maxlength="80"></label>
        <label class="wide">${esc(L.plan)}<select name="plan_interest">${m.form.plans.map(([v, t]) => `<option value="${v}"${v === "unsure" ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        ${PAY_FORM ? `<label class="wide pay-only" hidden>${esc(L.password)} *<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128"><small>${esc(L.password_hint)}</small></label>` : ""}
        <label class="wide">${esc(L.message)}<textarea name="message" rows="3" maxlength="1000"></textarea></label>
      </div>
      <input class="svc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="svc-consent"><input type="checkbox" name="consent" required> <span>${esc(m.form.consent)} <a href="privacy" target="_blank" rel="noopener">${esc(m.form.privacy)}</a>. *</span></label>
      ${PAY_FORM ? `<p class="svc-paynote pay-only" hidden>${esc(m.form.payNote)}</p>` : ""}
      <button class="button primary" type="submit" id="lead-submit" data-consult="${esc(m.form.submitConsult)}" data-pay="${esc(m.form.submitPay)}">${esc(m.form.submitConsult)}</button>
      <p id="lead-status" class="svc-status" role="status" aria-live="polite" tabindex="-1"></p>
      <div id="pay-confirm" class="svc-confirm" hidden></div>
    </form>
  </section>
</main>
<footer class="container">
  <a class="brand" href="landing.html">schools<span class="brand-ai">ai</span>.</a>
  <p>${esc(m.footer)}</p>
  <a href="privacy">Privacy Policy</a>
  <a href="terms">Terms of Service</a>
</footer>
<script>window.SERVICE_PAGE = ${JSON.stringify(cfg).replace(/</g, "\\u003c")};</script>
<script src="https://unpkg.com/pocketbase@0.21.3/dist/pocketbase.umd.js"></script>
<script src="_shared/config.js"></script>
<script src="_shared/service-landing.js?v=20261120-2"></script>
<script src="chat-widget.js?v=20261013-v5" data-tenant="${m.tenant}" data-botname="Schools AI" data-color="#245b42" data-position="right" data-style="bubble" data-lang="auto" data-hello="auto"></script>
</body>
</html>
`;
};

for (const key of Object.keys(MARKETS)) {
  writeFileSync(join(OUT, MARKETS[key].file), page(key));
  console.log("wrote", MARKETS[key].file);
}
