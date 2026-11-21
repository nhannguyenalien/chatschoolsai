#!/usr/bin/env node
// Generates the AI Social Content landing page in 8 languages (en, vi, id, es, fr, ja, ko, zh).
//   node scripts/build-social-landings.mjs
// Output: dash-tabler/landing-social.html (English) and landing-social-<lang>.html for the others (committed, static).
// Manual-first service: orders land in Whop, the team makes and publishes the posts. Nothing here promises video or
// automatic credit metering (neither exists yet). Prices must match the Whop products (USD, monthly).
// Translations are AI-made: have a native speaker review them before running paid ads in that language.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "dash-tabler");
const SITE = "https://chat.schoolsai.work";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PLANS = [
  { id: "social_4", posts: 4, price: "$3.99", whop: "https://whop.com/schoolsai/schools-ai-social-content-4-posts-per-month/" },
  { id: "social_12", posts: 12, price: "$11.99", whop: "https://whop.com/schoolsai/schools-ai-social-content-12-posts-per-month/" },
  { id: "social_30", posts: 30, price: "$29.99", whop: "https://whop.com/schoolsai/schools-ai-social-content-30-posts-per-month/" },
  { id: "social_90", posts: 90, price: "$89.99", whop: "https://whop.com/schoolsai/schools-ai-social-content-90-posts-per-month/" }
];
const PLAN_PRICES = ["$3.99", "$11.99", "$29.99", "$89.99"];

const LANGS = {
  en: {
    name: "English", htmlLang: "en", file: "landing-social.html",
    title: "Schools AI Social Content - Facebook posts for your business, from $3.99/month",
    description: "Choose how many Facebook posts you need each month. Our team uses AI to create images and captions and publishes them to your Page. From $3.99 for 4 posts. Cancel anytime.",
    nav: ["Plans", "How it works", "FAQ", "Sign up", "Home"],
    hero: ["AI SOCIAL CONTENT", "Facebook posts for your business.", "Created for you, every month.", "Choose how many posts you need each month. Our team uses AI to create images and captions, then publishes them to your Facebook Page. No design skills needed.", "See plans", "Get a free sample post ↓", "One service, simple monthly pricing. Cancel anytime."],
    trust: [["From $3.99", "per month for 4 posts"], ["1 Facebook Page", "included in every plan"], ["Cancel anytime", "No long-term contract"]],
    plans: ["PLANS", "How many posts do you need each month?", "Same service in every plan: you only choose the number of posts. Prices in US dollars.", "{n} posts", "per month", "Pay {price}/month via Whop"],
    tags: ["Get started", "Popular", "Daily posting", "High volume"],
    pace: ["About 1 post a week", "About 3 posts a week", "About 1 post a day", "About 3 posts a day"],
    items: ["AI-assisted images and captions", "Scheduled and published to one Facebook Page", "Simple caption edits included", "30-day cycle, cancel anytime"],
    foot: ["Videos are not included yet: plans cover image posts with captions. Unused posts do not carry over to the next 30-day cycle. A post that fails on our side is not counted. Custom design work is not included.", "Payment is through Whop, in USD. Please use the same email as the form below so we can match your order."],
    process: ["HOW IT WORKS", "From sign-up to your first posts", [["Choose your plan", "Pick how many posts you need each month and pay securely through Whop (USD)."], ["Tell us about your business", "Share your business, tone and Facebook Page in the form below. We tell you how to give us access to your Page."], ["We create the posts", "Our team uses AI to create images and captions, and checks them before publishing."], ["Posts go live", "Your posts are scheduled and published to your Page. A new 30-day cycle starts each month."]]],
    faq: ["FAQ", "Frequently asked questions", [["What counts as a post?", "One image post with a caption, published to your Facebook Page. If something fails on our side, it is not counted."], ["Are videos included?", "Not yet. Plans cover image posts with captions. We will announce video when it is ready."], ["Can I try before paying?", "Yes. Ask for a free sample post in the form below and we will contact you."], ["What do I need?", "A Facebook Page you manage. We tell you how to give us access after you sign up."], ["Do unused posts carry over?", "No. Posts are renewed every 30 days and do not roll over to the next cycle."], ["Can I cancel?", "Yes, anytime. It takes effect at the end of the billing period."], ["Can I change my plan?", "Yes. Tell us which plan you want and we will switch you."]]],
    form: ["SIGN UP", "Tell us about your business", "Leave your details and we will contact you by email. Not sure yet? Ask for a free sample post first. Ready to start? Pay for your plan in the Plans section above.",
      { name: "Full name", email: "Email", phone: "Phone / WhatsApp (optional)", business: "Business or Page name", type: "Type of business", country: "Country", page: "Facebook Page link (optional)", plan: "Plan you are interested in", notes: "Notes (optional)", choose: "Choose…", consent: "I agree that Schools AI stores these details and contacts me about this. See the", privacy: "Privacy Policy", submit: "Send details" },
      ["Restaurant / cafe", "Beauty / spa / salon", "Retail / online shop", "Health / clinic", "Education / training", "Real estate", "Other"],
      ["{n} posts / month ({p})", "Not sure, I want a free sample first"]],
    msg: { required: "Please fill in all required fields.", invalid_email: "That email does not look right.", sending: "Sending…", lead_failed: "We could not send your details, please try again in a few minutes.", rate_limited: "Too many attempts, please try again later.", network: "Could not reach the server, please try again.", success_title: "Details received", success_body: "Thank you. Our team will contact you by email soon." },
    footer: "© 2026 Schools AI.", skip: "Sign up"
  },
  vi: {
    name: "Tiếng Việt", htmlLang: "vi", file: "landing-social-vi.html",
    title: "Schools AI - Nội dung mạng xã hội AI: bài đăng Facebook cho doanh nghiệp, từ 3,99 USD/tháng",
    description: "Chọn số bài đăng Facebook bạn cần mỗi tháng. Đội ngũ dùng AI tạo ảnh và caption rồi đăng lên Page của bạn. Từ 3,99 USD cho 4 bài. Hủy bất cứ lúc nào.",
    nav: ["Các gói", "Cách hoạt động", "Hỏi đáp", "Đăng ký", "Trang chủ"],
    hero: ["NỘI DUNG MẠNG XÃ HỘI AI", "Bài đăng Facebook cho doanh nghiệp của bạn.", "Làm sẵn cho bạn mỗi tháng.", "Chọn số bài bạn cần mỗi tháng. Đội ngũ của chúng tôi dùng AI tạo ảnh và caption rồi đăng lên Facebook Page của bạn. Không cần biết thiết kế.", "Xem các gói", "Nhận một bài mẫu miễn phí ↓", "Một dịch vụ, giá theo tháng đơn giản. Hủy bất cứ lúc nào."],
    trust: [["Từ $3,99", "mỗi tháng cho 4 bài"], ["1 Facebook Page", "có trong mọi gói"], ["Hủy bất cứ lúc nào", "Không ràng buộc dài hạn"]],
    plans: ["CÁC GÓI", "Mỗi tháng bạn cần bao nhiêu bài?", "Mọi gói đều cùng một dịch vụ: bạn chỉ chọn số bài. Giá tính bằng đô la Mỹ.", "{n} bài", "mỗi tháng", "Thanh toán {price}/tháng qua Whop"],
    tags: ["Bắt đầu", "Phổ biến", "Đăng hằng ngày", "Số lượng lớn"],
    pace: ["Khoảng 1 bài mỗi tuần", "Khoảng 3 bài mỗi tuần", "Khoảng 1 bài mỗi ngày", "Khoảng 3 bài mỗi ngày"],
    items: ["Ảnh và caption có AI hỗ trợ", "Lên lịch và đăng lên một Facebook Page", "Có sửa caption đơn giản", "Chu kỳ 30 ngày, hủy bất cứ lúc nào"],
    foot: ["Chưa gồm video: các gói gồm bài đăng ảnh kèm caption. Bài chưa dùng không cộng dồn sang chu kỳ 30 ngày tiếp theo. Bài lỗi do phía chúng tôi không bị tính. Không gồm thiết kế riêng theo yêu cầu.", "Thanh toán qua Whop, bằng USD. Vui lòng dùng cùng email với biểu mẫu bên dưới để chúng tôi đối chiếu đơn."],
    process: ["CÁCH HOẠT ĐỘNG", "Từ đăng ký đến những bài đầu tiên", [["Chọn gói", "Chọn số bài cần mỗi tháng và thanh toán an toàn qua Whop (USD)."], ["Cho chúng tôi biết về doanh nghiệp", "Điền thông tin doanh nghiệp, giọng văn và Facebook Page ở biểu mẫu bên dưới. Chúng tôi sẽ hướng dẫn cách cấp quyền truy cập Page."], ["Chúng tôi tạo bài", "Đội ngũ dùng AI tạo ảnh và caption, rồi kiểm tra trước khi đăng."], ["Bài lên sóng", "Bài được lên lịch và đăng lên Page của bạn. Mỗi tháng bắt đầu một chu kỳ 30 ngày mới."]]],
    faq: ["HỎI ĐÁP", "Câu hỏi thường gặp", [["Thế nào là một bài?", "Một bài đăng ảnh kèm caption, được đăng lên Facebook Page của bạn. Nếu có lỗi từ phía chúng tôi thì bài đó không bị tính."], ["Có gồm video không?", "Chưa. Các gói gồm bài đăng ảnh kèm caption. Chúng tôi sẽ thông báo khi có video."], ["Tôi có thể thử trước khi trả tiền không?", "Có. Hãy xin một bài mẫu miễn phí trong biểu mẫu bên dưới, chúng tôi sẽ liên hệ."], ["Tôi cần chuẩn bị gì?", "Một Facebook Page do bạn quản lý. Sau khi đăng ký, chúng tôi sẽ hướng dẫn cách cấp quyền truy cập."], ["Bài chưa dùng có cộng dồn không?", "Không. Số bài được làm mới mỗi 30 ngày và không chuyển sang chu kỳ sau."], ["Tôi có thể hủy không?", "Có, bất cứ lúc nào. Hiệu lực vào cuối kỳ thanh toán."], ["Tôi có thể đổi gói không?", "Có. Hãy cho chúng tôi biết gói bạn muốn, chúng tôi sẽ chuyển giúp."]]],
    form: ["ĐĂNG KÝ", "Cho chúng tôi biết về doanh nghiệp của bạn", "Để lại thông tin, chúng tôi sẽ liên hệ qua email. Chưa chắc chắn? Hãy xin một bài mẫu miễn phí trước. Sẵn sàng bắt đầu? Thanh toán gói ở mục Các gói phía trên.",
      { name: "Họ và tên", email: "Email", phone: "Số điện thoại / Zalo (không bắt buộc)", business: "Tên doanh nghiệp hoặc Page", type: "Loại hình kinh doanh", country: "Quốc gia", page: "Link Facebook Page (không bắt buộc)", plan: "Gói bạn quan tâm", notes: "Ghi chú (không bắt buộc)", choose: "Chọn…", consent: "Tôi đồng ý để Schools AI lưu thông tin này và liên hệ với tôi. Xem", privacy: "Chính sách quyền riêng tư", submit: "Gửi thông tin" },
      ["Nhà hàng / quán cà phê", "Làm đẹp / spa / salon", "Bán lẻ / cửa hàng online", "Sức khỏe / phòng khám", "Giáo dục / đào tạo", "Bất động sản", "Khác"],
      ["{n} bài / tháng ({p})", "Chưa chắc, tôi muốn nhận bài mẫu trước"]],
    msg: { required: "Vui lòng điền đủ các mục bắt buộc.", invalid_email: "Email chưa đúng định dạng.", sending: "Đang gửi…", lead_failed: "Chưa gửi được thông tin, vui lòng thử lại sau ít phút.", rate_limited: "Bạn thao tác quá nhanh, vui lòng thử lại sau.", network: "Không kết nối được máy chủ, vui lòng thử lại.", success_title: "Đã nhận thông tin", success_body: "Cảm ơn bạn. Đội ngũ Schools AI sẽ liên hệ qua email sớm." },
    footer: "© 2026 Schools AI.", skip: "Đăng ký"
  },
  id: {
    name: "Bahasa Indonesia", htmlLang: "id", file: "landing-social-id.html",
    title: "Schools AI - Konten Sosial AI: posting Facebook untuk bisnis Anda, mulai $3,99/bulan",
    description: "Pilih jumlah posting Facebook yang Anda butuhkan setiap bulan. Tim kami memakai AI untuk membuat gambar dan caption lalu memublikasikannya ke Halaman Anda. Mulai $3,99 untuk 4 posting. Berhenti kapan saja.",
    nav: ["Paket", "Cara kerja", "Tanya jawab", "Daftar", "Beranda"],
    hero: ["KONTEN SOSIAL AI", "Posting Facebook untuk bisnis Anda.", "Dibuatkan untuk Anda, setiap bulan.", "Pilih berapa posting yang Anda butuhkan setiap bulan. Tim kami memakai AI untuk membuat gambar dan caption, lalu memublikasikannya ke Halaman Facebook Anda. Tanpa perlu keahlian desain.", "Lihat paket", "Minta contoh posting gratis ↓", "Satu layanan, harga bulanan sederhana. Berhenti kapan saja."],
    trust: [["Mulai $3,99", "per bulan untuk 4 posting"], ["1 Halaman Facebook", "termasuk di semua paket"], ["Berhenti kapan saja", "Tanpa kontrak jangka panjang"]],
    plans: ["PAKET", "Berapa posting yang Anda butuhkan setiap bulan?", "Layanan yang sama di semua paket: Anda hanya memilih jumlah posting. Harga dalam dolar AS.", "{n} posting", "per bulan", "Bayar {price}/bulan lewat Whop"],
    tags: ["Mulai", "Populer", "Posting harian", "Volume besar"],
    pace: ["Sekitar 1 posting per minggu", "Sekitar 3 posting per minggu", "Sekitar 1 posting per hari", "Sekitar 3 posting per hari"],
    items: ["Gambar dan caption dibantu AI", "Dijadwalkan dan dipublikasikan ke satu Halaman Facebook", "Termasuk edit caption sederhana", "Siklus 30 hari, berhenti kapan saja"],
    foot: ["Video belum termasuk: paket mencakup posting gambar dengan caption. Posting yang tidak terpakai tidak berpindah ke siklus 30 hari berikutnya. Posting yang gagal karena kesalahan kami tidak dihitung. Pekerjaan desain khusus tidak termasuk.", "Pembayaran lewat Whop, dalam USD. Gunakan email yang sama dengan formulir di bawah agar kami bisa mencocokkan pesanan."],
    process: ["CARA KERJA", "Dari pendaftaran sampai posting pertama", [["Pilih paket", "Pilih jumlah posting per bulan dan bayar dengan aman lewat Whop (USD)."], ["Ceritakan bisnis Anda", "Isi bisnis, gaya bahasa, dan Halaman Facebook Anda di formulir di bawah. Kami akan memberi tahu cara memberi kami akses ke Halaman Anda."], ["Kami membuat posting", "Tim kami memakai AI untuk membuat gambar dan caption, lalu memeriksanya sebelum diterbitkan."], ["Posting tayang", "Posting dijadwalkan dan dipublikasikan ke Halaman Anda. Siklus 30 hari baru dimulai setiap bulan."]]],
    faq: ["TANYA JAWAB", "Pertanyaan yang sering diajukan", [["Apa yang dihitung sebagai satu posting?", "Satu posting gambar dengan caption yang dipublikasikan ke Halaman Facebook Anda. Jika ada kegagalan dari pihak kami, posting itu tidak dihitung."], ["Apakah video termasuk?", "Belum. Paket mencakup posting gambar dengan caption. Kami akan mengumumkan video saat sudah siap."], ["Bisakah saya mencoba sebelum membayar?", "Bisa. Minta contoh posting gratis lewat formulir di bawah dan kami akan menghubungi Anda."], ["Apa yang saya perlukan?", "Sebuah Halaman Facebook yang Anda kelola. Kami akan memberi tahu cara memberi kami akses setelah Anda mendaftar."], ["Apakah posting yang tidak terpakai berpindah ke bulan berikutnya?", "Tidak. Posting diperbarui setiap 30 hari dan tidak berpindah ke siklus berikutnya."], ["Bisakah saya berhenti?", "Bisa, kapan saja. Berlaku di akhir periode tagihan."], ["Bisakah saya mengganti paket?", "Bisa. Beri tahu kami paket yang Anda inginkan dan kami akan menggantinya."]]],
    form: ["DAFTAR", "Ceritakan tentang bisnis Anda", "Tinggalkan data Anda dan kami akan menghubungi lewat email. Belum yakin? Minta contoh posting gratis dulu. Siap mulai? Bayar paket Anda di bagian Paket di atas.",
      { name: "Nama lengkap", email: "Email", phone: "Telepon / WhatsApp (opsional)", business: "Nama bisnis atau Halaman", type: "Jenis bisnis", country: "Negara", page: "Link Halaman Facebook (opsional)", plan: "Paket yang diminati", notes: "Catatan (opsional)", choose: "Pilih…", consent: "Saya setuju Schools AI menyimpan data ini dan menghubungi saya. Lihat", privacy: "Kebijakan Privasi", submit: "Kirim data" },
      ["Restoran / kafe", "Kecantikan / spa / salon", "Ritel / toko online", "Kesehatan / klinik", "Pendidikan / kursus", "Properti", "Lainnya"],
      ["{n} posting / bulan ({p})", "Belum yakin, saya ingin contoh gratis dulu"]],
    msg: { required: "Mohon isi semua kolom wajib.", invalid_email: "Format email belum benar.", sending: "Mengirim…", lead_failed: "Data belum terkirim, silakan coba lagi beberapa menit lagi.", rate_limited: "Terlalu cepat, silakan coba lagi nanti.", network: "Tidak dapat terhubung ke server, silakan coba lagi.", success_title: "Data diterima", success_body: "Terima kasih. Tim Schools AI akan segera menghubungi Anda lewat email." },
    footer: "© 2026 Schools AI.", skip: "Daftar"
  },
  es: {
    name: "Español", htmlLang: "es", file: "landing-social-es.html",
    title: "Schools AI - Contenido social con IA: publicaciones de Facebook para tu negocio, desde $3,99/mes",
    description: "Elige cuántas publicaciones de Facebook necesitas cada mes. Nuestro equipo usa IA para crear imágenes y textos y los publica en tu página. Desde $3,99 por 4 publicaciones. Cancela cuando quieras.",
    nav: ["Planes", "Cómo funciona", "Preguntas", "Registrarse", "Inicio"],
    hero: ["CONTENIDO SOCIAL CON IA", "Publicaciones de Facebook para tu negocio.", "Creadas para ti, cada mes.", "Elige cuántas publicaciones necesitas cada mes. Nuestro equipo usa IA para crear imágenes y textos y los publica en tu página de Facebook. No necesitas saber diseño.", "Ver planes", "Pide una publicación de muestra gratis ↓", "Un solo servicio, precio mensual simple. Cancela cuando quieras."],
    trust: [["Desde $3,99", "al mes por 4 publicaciones"], ["1 página de Facebook", "incluida en todos los planes"], ["Cancela cuando quieras", "Sin contrato a largo plazo"]],
    plans: ["PLANES", "¿Cuántas publicaciones necesitas cada mes?", "El mismo servicio en todos los planes: solo eliges el número de publicaciones. Precios en dólares estadounidenses.", "{n} publicaciones", "al mes", "Pagar {price}/mes con Whop"],
    tags: ["Para empezar", "Popular", "Publicación diaria", "Alto volumen"],
    pace: ["Aprox. 1 publicación por semana", "Aprox. 3 publicaciones por semana", "Aprox. 1 publicación al día", "Aprox. 3 publicaciones al día"],
    items: ["Imágenes y textos con ayuda de IA", "Programadas y publicadas en una página de Facebook", "Incluye ediciones sencillas del texto", "Ciclo de 30 días, cancela cuando quieras"],
    foot: ["Los vídeos aún no están incluidos: los planes cubren publicaciones de imagen con texto. Las publicaciones sin usar no se acumulan para el siguiente ciclo de 30 días. Una publicación que falle por nuestra parte no se cuenta. El diseño personalizado no está incluido.", "El pago se realiza con Whop, en USD. Usa el mismo correo que en el formulario de abajo para poder identificar tu pedido."],
    process: ["CÓMO FUNCIONA", "Del registro a tus primeras publicaciones", [["Elige tu plan", "Elige cuántas publicaciones necesitas al mes y paga de forma segura con Whop (USD)."], ["Cuéntanos sobre tu negocio", "Comparte tu negocio, tono y página de Facebook en el formulario de abajo. Te indicaremos cómo darnos acceso a tu página."], ["Creamos las publicaciones", "Nuestro equipo usa IA para crear imágenes y textos y los revisa antes de publicar."], ["Se publican", "Tus publicaciones se programan y se publican en tu página. Cada mes empieza un nuevo ciclo de 30 días."]]],
    faq: ["PREGUNTAS", "Preguntas frecuentes", [["¿Qué cuenta como una publicación?", "Una publicación de imagen con texto, publicada en tu página de Facebook. Si algo falla por nuestra parte, no se cuenta."], ["¿Se incluyen vídeos?", "Todavía no. Los planes cubren publicaciones de imagen con texto. Anunciaremos el vídeo cuando esté listo."], ["¿Puedo probar antes de pagar?", "Sí. Pide una publicación de muestra gratis en el formulario de abajo y te contactaremos."], ["¿Qué necesito?", "Una página de Facebook que administres. Te explicamos cómo darnos acceso después de registrarte."], ["¿Se acumulan las publicaciones no usadas?", "No. Las publicaciones se renuevan cada 30 días y no pasan al siguiente ciclo."], ["¿Puedo cancelar?", "Sí, en cualquier momento. Surte efecto al final del periodo de facturación."], ["¿Puedo cambiar de plan?", "Sí. Dinos qué plan quieres y te cambiamos."]]],
    form: ["REGISTRO", "Cuéntanos sobre tu negocio", "Deja tus datos y te contactaremos por correo. ¿No estás seguro? Pide primero una publicación de muestra gratis. ¿Listo para empezar? Paga tu plan en la sección Planes de arriba.",
      { name: "Nombre completo", email: "Correo electrónico", phone: "Teléfono / WhatsApp (opcional)", business: "Nombre del negocio o de la página", type: "Tipo de negocio", country: "País", page: "Enlace de la página de Facebook (opcional)", plan: "Plan que te interesa", notes: "Notas (opcional)", choose: "Elegir…", consent: "Acepto que Schools AI guarde estos datos y me contacte. Consulta la", privacy: "Política de privacidad", submit: "Enviar datos" },
      ["Restaurante / cafetería", "Belleza / spa / salón", "Tienda física / online", "Salud / clínica", "Educación / formación", "Inmobiliaria", "Otro"],
      ["{n} publicaciones / mes ({p})", "No estoy seguro, quiero primero una muestra gratis"]],
    msg: { required: "Rellena todos los campos obligatorios.", invalid_email: "El correo no parece correcto.", sending: "Enviando…", lead_failed: "No pudimos enviar tus datos, inténtalo de nuevo en unos minutos.", rate_limited: "Demasiados intentos, inténtalo más tarde.", network: "No se pudo conectar con el servidor, inténtalo de nuevo.", success_title: "Datos recibidos", success_body: "Gracias. Nuestro equipo te contactará pronto por correo." },
    footer: "© 2026 Schools AI.", skip: "Registrarse"
  },
  fr: {
    name: "Français", htmlLang: "fr", file: "landing-social-fr.html",
    title: "Schools AI - Contenu social par IA : publications Facebook pour votre entreprise, dès 3,99 $/mois",
    description: "Choisissez le nombre de publications Facebook par mois. Notre équipe crée images et légendes avec l'IA et les publie sur votre Page. Dès 3,99 $ pour 4 publications. Résiliable à tout moment.",
    nav: ["Offres", "Comment ça marche", "FAQ", "S'inscrire", "Accueil"],
    hero: ["CONTENU SOCIAL PAR IA", "Des publications Facebook pour votre entreprise.", "Créées pour vous, chaque mois.", "Choisissez le nombre de publications par mois. Notre équipe utilise l'IA pour créer images et légendes, puis les publie sur votre Page Facebook. Aucune compétence en design requise.", "Voir les offres", "Demander une publication d'essai gratuite ↓", "Un seul service, un tarif mensuel simple. Résiliable à tout moment."],
    trust: [["Dès 3,99 $", "par mois pour 4 publications"], ["1 Page Facebook", "incluse dans chaque offre"], ["Résiliable à tout moment", "Sans engagement"]],
    plans: ["OFFRES", "Combien de publications par mois ?", "Le même service dans chaque offre : vous choisissez seulement le nombre de publications. Prix en dollars américains.", "{n} publications", "par mois", "Payer {price}/mois via Whop"],
    tags: ["Pour démarrer", "Populaire", "Publication quotidienne", "Gros volume"],
    pace: ["Environ 1 publication par semaine", "Environ 3 publications par semaine", "Environ 1 publication par jour", "Environ 3 publications par jour"],
    items: ["Images et légendes assistées par IA", "Programmées et publiées sur une Page Facebook", "Retouches simples des légendes incluses", "Cycle de 30 jours, résiliable à tout moment"],
    foot: ["Les vidéos ne sont pas encore incluses : les offres couvrent des publications image avec légende. Les publications non utilisées ne sont pas reportées au cycle de 30 jours suivant. Une publication qui échoue de notre fait n'est pas comptée. Le design sur mesure n'est pas inclus.", "Paiement via Whop, en USD. Utilisez la même adresse e-mail que dans le formulaire ci-dessous afin que nous puissions retrouver votre commande."],
    process: ["COMMENT ÇA MARCHE", "De l'inscription à vos premières publications", [["Choisissez votre offre", "Choisissez le nombre de publications par mois et payez en toute sécurité via Whop (USD)."], ["Parlez-nous de votre entreprise", "Indiquez votre activité, votre ton et votre Page Facebook dans le formulaire ci-dessous. Nous vous expliquerons comment nous donner accès à votre Page."], ["Nous créons les publications", "Notre équipe utilise l'IA pour créer images et légendes, et les vérifie avant publication."], ["Elles sont en ligne", "Vos publications sont programmées et publiées sur votre Page. Un nouveau cycle de 30 jours commence chaque mois."]]],
    faq: ["FAQ", "Questions fréquentes", [["Qu'est-ce qui compte comme une publication ?", "Une publication image avec légende, publiée sur votre Page Facebook. Si quelque chose échoue de notre côté, elle n'est pas comptée."], ["Les vidéos sont-elles incluses ?", "Pas encore. Les offres couvrent des publications image avec légende. Nous annoncerons la vidéo quand elle sera prête."], ["Puis-je essayer avant de payer ?", "Oui. Demandez une publication d'essai gratuite dans le formulaire ci-dessous et nous vous contacterons."], ["De quoi ai-je besoin ?", "D'une Page Facebook que vous administrez. Nous vous expliquons comment nous donner accès après votre inscription."], ["Les publications non utilisées sont-elles reportées ?", "Non. Les publications sont renouvelées tous les 30 jours et ne sont pas reportées au cycle suivant."], ["Puis-je résilier ?", "Oui, à tout moment. La résiliation prend effet à la fin de la période de facturation."], ["Puis-je changer d'offre ?", "Oui. Dites-nous l'offre souhaitée et nous ferons le changement."]]],
    form: ["INSCRIPTION", "Parlez-nous de votre entreprise", "Laissez vos coordonnées et nous vous contacterons par e-mail. Pas encore sûr ? Demandez d'abord une publication d'essai gratuite. Prêt à commencer ? Payez votre offre dans la section Offres ci-dessus.",
      { name: "Nom complet", email: "E-mail", phone: "Téléphone / WhatsApp (facultatif)", business: "Nom de l'entreprise ou de la Page", type: "Type d'activité", country: "Pays", page: "Lien de la Page Facebook (facultatif)", plan: "Offre qui vous intéresse", notes: "Remarques (facultatif)", choose: "Choisir…", consent: "J'accepte que Schools AI conserve ces informations et me contacte. Voir la", privacy: "Politique de confidentialité", submit: "Envoyer" },
      ["Restaurant / café", "Beauté / spa / salon", "Commerce / boutique en ligne", "Santé / clinique", "Éducation / formation", "Immobilier", "Autre"],
      ["{n} publications / mois ({p})", "Pas sûr, je veux d'abord un essai gratuit"]],
    msg: { required: "Veuillez remplir tous les champs obligatoires.", invalid_email: "Cette adresse e-mail semble incorrecte.", sending: "Envoi…", lead_failed: "Nous n'avons pas pu envoyer vos informations, réessayez dans quelques minutes.", rate_limited: "Trop de tentatives, réessayez plus tard.", network: "Impossible de joindre le serveur, réessayez.", success_title: "Informations reçues", success_body: "Merci. Notre équipe vous contactera bientôt par e-mail." },
    footer: "© 2026 Schools AI.", skip: "S'inscrire"
  },
  ja: {
    name: "日本語", htmlLang: "ja", file: "landing-social-ja.html",
    title: "Schools AI AIソーシャル投稿 - ビジネス向けFacebook投稿、月額$3.99から",
    description: "毎月必要なFacebook投稿数を選ぶだけ。チームがAIで画像とキャプションを作成し、あなたのページに投稿します。4投稿で$3.99から。いつでも解約できます。",
    nav: ["プラン", "ご利用の流れ", "よくある質問", "お申し込み", "ホーム"],
    hero: ["AIソーシャル投稿", "あなたのビジネスのためのFacebook投稿を、", "毎月お届けします。", "毎月必要な投稿数を選ぶだけ。チームがAIで画像とキャプションを作成し、あなたのFacebookページに投稿します。デザインの知識は不要です。", "プランを見る", "無料のサンプル投稿を依頼する ↓", "サービスは1つ、月額料金はシンプル。いつでも解約できます。"],
    trust: [["$3.99から", "4投稿で月額"], ["Facebookページ1つ", "全プランに含まれます"], ["いつでも解約可能", "長期契約なし"]],
    plans: ["プラン", "毎月いくつ投稿が必要ですか？", "どのプランも同じサービスです。選ぶのは投稿数だけ。料金は米ドルです。", "{n}投稿", "月額", "Whopで月額{price}を支払う"],
    tags: ["はじめに", "人気", "毎日投稿", "大量投稿"],
    pace: ["週に約1投稿", "週に約3投稿", "1日に約1投稿", "1日に約3投稿"],
    items: ["AI支援の画像とキャプション", "Facebookページ1つにスケジュール投稿", "簡単なキャプション修正を含む", "30日サイクル、いつでも解約可能"],
    foot: ["動画はまだ含まれていません。プランは画像とキャプションの投稿が対象です。未使用の投稿は次の30日サイクルに繰り越されません。当社側の原因で失敗した投稿はカウントされません。オーダーメイドのデザイン制作は含まれません。", "お支払いはWhopを通じて米ドルで行います。注文を確認できるよう、下のフォームと同じメールアドレスをご利用ください。"],
    process: ["ご利用の流れ", "お申し込みから最初の投稿まで", [["プランを選ぶ", "毎月の投稿数を選び、Whopで安全にお支払い（米ドル）。"], ["ビジネスについて教えてください", "下のフォームに事業内容、トーン、Facebookページを入力してください。ページへのアクセス権の付与方法をご案内します。"], ["投稿を作成します", "チームがAIで画像とキャプションを作成し、公開前に確認します。"], ["投稿が公開されます", "投稿はスケジュールされ、あなたのページに公開されます。毎月、新しい30日サイクルが始まります。"]]],
    faq: ["よくある質問", "よくある質問", [["何が1投稿としてカウントされますか？", "キャプション付きの画像投稿1件が、あなたのFacebookページに公開された場合です。当社側の原因で失敗した場合はカウントされません。"], ["動画は含まれますか？", "まだ含まれていません。プランは画像とキャプションの投稿が対象です。動画は準備ができ次第お知らせします。"], ["支払い前に試せますか？", "はい。下のフォームから無料のサンプル投稿を依頼してください。こちらからご連絡します。"], ["何が必要ですか？", "ご自身が管理するFacebookページです。お申し込み後、アクセス権の付与方法をご案内します。"], ["未使用の投稿は繰り越せますか？", "いいえ。投稿数は30日ごとに更新され、次のサイクルには繰り越されません。"], ["解約できますか？", "はい、いつでも可能です。請求期間の終了時に有効になります。"], ["プランを変更できますか？", "はい。ご希望のプランをお知らせいただければ切り替えます。"]]],
    form: ["お申し込み", "ビジネスについて教えてください", "ご連絡先をお送りください。メールでご連絡します。迷っていますか？まず無料のサンプル投稿をご依頼ください。始める準備はできましたか？上のプランの項目からお支払いください。",
      { name: "お名前", email: "メールアドレス", phone: "電話 / WhatsApp（任意）", business: "事業名またはページ名", type: "業種", country: "国", page: "FacebookページのURL（任意）", plan: "ご希望のプラン", notes: "備考（任意）", choose: "選択…", consent: "Schools AIがこれらの情報を保存し、ご連絡することに同意します。参照：", privacy: "プライバシーポリシー", submit: "送信" },
      ["飲食店 / カフェ", "美容 / スパ / サロン", "小売 / オンラインショップ", "医療 / クリニック", "教育 / スクール", "不動産", "その他"],
      ["月{n}投稿（{p}）", "まだ決めていない。まず無料サンプルが欲しい"]],
    msg: { required: "必須項目をすべて入力してください。", invalid_email: "メールアドレスの形式が正しくありません。", sending: "送信中…", lead_failed: "送信できませんでした。数分後にもう一度お試しください。", rate_limited: "試行回数が多すぎます。後でもう一度お試しください。", network: "サーバーに接続できませんでした。もう一度お試しください。", success_title: "受け付けました", success_body: "ありがとうございます。担当者から近日中にメールでご連絡します。" },
    footer: "© 2026 Schools AI.", skip: "お申し込み"
  },
  ko: {
    name: "한국어", htmlLang: "ko", file: "landing-social-ko.html",
    title: "Schools AI AI 소셜 콘텐츠 - 비즈니스를 위한 Facebook 게시물, 월 $3.99부터",
    description: "매달 필요한 Facebook 게시물 수를 선택하세요. 팀이 AI로 이미지와 캡션을 만들어 페이지에 게시합니다. 게시물 4개 $3.99부터. 언제든 해지 가능.",
    nav: ["요금제", "이용 방법", "자주 묻는 질문", "가입", "홈"],
    hero: ["AI 소셜 콘텐츠", "비즈니스를 위한 Facebook 게시물,", "매달 만들어 드립니다.", "매달 필요한 게시물 수를 선택하세요. 팀이 AI로 이미지와 캡션을 만들어 Facebook 페이지에 게시합니다. 디자인 지식이 필요 없습니다.", "요금제 보기", "무료 샘플 게시물 받기 ↓", "하나의 서비스, 간단한 월 요금. 언제든 해지할 수 있습니다."],
    trust: [["$3.99부터", "월 4개 게시물 기준"], ["Facebook 페이지 1개", "모든 요금제에 포함"], ["언제든 해지 가능", "장기 계약 없음"]],
    plans: ["요금제", "매달 몇 개의 게시물이 필요하세요?", "모든 요금제가 같은 서비스입니다. 게시물 수만 선택하세요. 가격은 미국 달러입니다.", "게시물 {n}개", "월", "Whop으로 월 {price} 결제"],
    tags: ["시작하기", "인기", "매일 게시", "대용량"],
    pace: ["주 약 1개", "주 약 3개", "하루 약 1개", "하루 약 3개"],
    items: ["AI가 도와주는 이미지와 캡션", "Facebook 페이지 1개에 예약 및 게시", "간단한 캡션 수정 포함", "30일 주기, 언제든 해지 가능"],
    foot: ["동영상은 아직 포함되지 않습니다. 요금제는 캡션이 있는 이미지 게시물을 제공합니다. 사용하지 않은 게시물은 다음 30일 주기로 이월되지 않습니다. 당사 측 오류로 실패한 게시물은 차감되지 않습니다. 맞춤 디자인 작업은 포함되지 않습니다.", "결제는 Whop을 통해 USD로 진행됩니다. 주문을 확인할 수 있도록 아래 양식과 같은 이메일을 사용해 주세요."],
    process: ["이용 방법", "가입부터 첫 게시물까지", [["요금제 선택", "매달 필요한 게시물 수를 선택하고 Whop으로 안전하게 결제하세요 (USD)."], ["비즈니스를 알려주세요", "아래 양식에 비즈니스, 말투, Facebook 페이지를 입력하세요. 페이지 접근 권한을 주는 방법을 안내해 드립니다."], ["게시물을 만듭니다", "팀이 AI로 이미지와 캡션을 만들고 게시 전에 확인합니다."], ["게시물이 올라갑니다", "게시물이 예약되어 페이지에 게시됩니다. 매달 새로운 30일 주기가 시작됩니다."]]],
    faq: ["자주 묻는 질문", "자주 묻는 질문", [["무엇이 게시물 1개로 계산되나요?", "캡션이 있는 이미지 게시물 1개가 Facebook 페이지에 게시된 경우입니다. 당사 측 오류로 실패한 경우에는 차감되지 않습니다."], ["동영상이 포함되나요?", "아직 포함되지 않습니다. 요금제는 캡션이 있는 이미지 게시물을 제공합니다. 동영상은 준비되면 안내해 드리겠습니다."], ["결제 전에 체험해 볼 수 있나요?", "네. 아래 양식에서 무료 샘플 게시물을 요청해 주시면 연락드리겠습니다."], ["무엇이 필요한가요?", "직접 관리하는 Facebook 페이지가 필요합니다. 가입 후 접근 권한을 주는 방법을 안내해 드립니다."], ["사용하지 않은 게시물은 이월되나요?", "아니요. 게시물 수는 30일마다 갱신되며 다음 주기로 이월되지 않습니다."], ["해지할 수 있나요?", "네, 언제든 가능합니다. 결제 기간이 끝날 때 적용됩니다."], ["요금제를 변경할 수 있나요?", "네. 원하는 요금제를 알려주시면 변경해 드립니다."]]],
    form: ["가입", "비즈니스를 알려주세요", "연락처를 남겨 주시면 이메일로 연락드립니다. 아직 확신이 없으신가요? 먼저 무료 샘플 게시물을 요청하세요. 시작할 준비가 되셨나요? 위 요금제 섹션에서 결제하세요.",
      { name: "이름", email: "이메일", phone: "전화 / WhatsApp (선택)", business: "비즈니스 또는 페이지 이름", type: "업종", country: "국가", page: "Facebook 페이지 링크 (선택)", plan: "관심 있는 요금제", notes: "메모 (선택)", choose: "선택…", consent: "Schools AI가 이 정보를 저장하고 연락하는 데 동의합니다. 참조:", privacy: "개인정보 처리방침", submit: "보내기" },
      ["음식점 / 카페", "뷰티 / 스파 / 살롱", "소매 / 온라인 쇼핑몰", "의료 / 클리닉", "교육 / 학원", "부동산", "기타"],
      ["월 {n}개 ({p})", "아직 모르겠어요, 먼저 무료 샘플을 받고 싶어요"]],
    msg: { required: "필수 항목을 모두 입력해 주세요.", invalid_email: "이메일 형식이 올바르지 않습니다.", sending: "보내는 중…", lead_failed: "정보를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", rate_limited: "시도 횟수가 너무 많습니다. 나중에 다시 시도해 주세요.", network: "서버에 연결할 수 없습니다. 다시 시도해 주세요.", success_title: "접수되었습니다", success_body: "감사합니다. 저희 팀이 곧 이메일로 연락드리겠습니다." },
    footer: "© 2026 Schools AI.", skip: "가입"
  },
  zh: {
    name: "中文", htmlLang: "zh", file: "landing-social-zh.html",
    title: "Schools AI AI 社交内容 - 为您的业务制作 Facebook 帖子，每月 $3.99 起",
    description: "选择每月所需的 Facebook 帖子数量。我们的团队借助 AI 制作图片和文案，并发布到您的主页。4 条帖子 $3.99 起，随时取消。",
    nav: ["套餐", "使用流程", "常见问题", "注册", "首页"],
    hero: ["AI 社交内容", "为您的业务制作 Facebook 帖子，", "每月为您准备好。", "选择每月所需的帖子数量。我们的团队借助 AI 制作图片和文案，并发布到您的 Facebook 主页。无需设计技能。", "查看套餐", "免费获取一条示例帖子 ↓", "一项服务，简单的月费。随时取消。"],
    trust: [["$3.99 起", "每月 4 条帖子"], ["1 个 Facebook 主页", "所有套餐均包含"], ["随时取消", "无长期合约"]],
    plans: ["套餐", "您每月需要多少条帖子？", "所有套餐服务相同：您只需选择帖子数量。价格以美元计。", "{n} 条帖子", "每月", "通过 Whop 支付每月 {price}"],
    tags: ["入门", "热门", "每日发布", "大批量"],
    pace: ["每周约 1 条", "每周约 3 条", "每天约 1 条", "每天约 3 条"],
    items: ["AI 辅助的图片和文案", "定时发布到一个 Facebook 主页", "包含简单的文案修改", "30 天周期，随时取消"],
    foot: ["暂不包含视频：套餐提供带文案的图片帖子。未使用的帖子不会结转到下一个 30 天周期。因我方原因失败的帖子不计入数量。不包含定制设计工作。", "通过 Whop 以美元支付。请使用与下方表单相同的邮箱，以便我们核对订单。"],
    process: ["使用流程", "从注册到第一批帖子", [["选择套餐", "选择每月所需的帖子数量，并通过 Whop 安全支付（美元）。"], ["介绍您的业务", "在下方表单中填写业务、语气和 Facebook 主页。我们会告诉您如何授权我们访问主页。"], ["我们制作帖子", "团队借助 AI 制作图片和文案，并在发布前检查。"], ["帖子上线", "帖子会被安排并发布到您的主页。每月开始新的 30 天周期。"]]],
    faq: ["常见问题", "常见问题", [["什么算一条帖子？", "一条带文案的图片帖子，发布到您的 Facebook 主页。如果因我方原因失败，则不计入。"], ["包含视频吗？", "暂不包含。套餐提供带文案的图片帖子。视频准备好后我们会通知您。"], ["付款前可以试用吗？", "可以。请在下方表单中申请一条免费示例帖子，我们会联系您。"], ["我需要准备什么？", "一个由您管理的 Facebook 主页。注册后我们会告诉您如何授权访问。"], ["未使用的帖子会结转吗？", "不会。帖子数量每 30 天刷新，不会结转到下一个周期。"], ["可以取消吗？", "可以，随时取消。在当前计费周期结束时生效。"], ["可以更换套餐吗？", "可以。告诉我们您想要的套餐，我们会为您切换。"]]],
    form: ["注册", "介绍一下您的业务", "留下您的信息，我们会通过邮件联系您。还不确定？先申请一条免费示例帖子。准备开始？请在上方“套餐”部分付款。",
      { name: "姓名", email: "邮箱", phone: "电话 / WhatsApp（选填）", business: "业务或主页名称", type: "业务类型", country: "国家", page: "Facebook 主页链接（选填）", plan: "您感兴趣的套餐", notes: "备注（选填）", choose: "请选择…", consent: "我同意 Schools AI 保存这些信息并与我联系。参见", privacy: "隐私政策", submit: "提交" },
      ["餐厅 / 咖啡馆", "美容 / 水疗 / 沙龙", "零售 / 网店", "健康 / 诊所", "教育 / 培训", "房地产", "其他"],
      ["每月 {n} 条（{p}）", "还不确定，我想先要免费示例"]],
    msg: { required: "请填写所有必填项。", invalid_email: "邮箱格式不正确。", sending: "发送中…", lead_failed: "未能发送您的信息，请几分钟后重试。", rate_limited: "尝试次数过多，请稍后再试。", network: "无法连接服务器，请重试。", success_title: "已收到", success_body: "谢谢。我们的团队会尽快通过邮件联系您。" },
    footer: "© 2026 Schools AI.", skip: "注册"
  }
};

// Pay-first flow (2026-11-21): the buyer pays on Whop and answers the questions (business/Page name, Page link,
// country and language) in the Whop checkout. The form on the page is only an optional "ask us a question" form.
// Per language: [secondary CTA, foot note, process step 2, FAQ "try before paying" (q, a), form intro, last plan option].
const PAYFIRST = {
  en: ["Have a question first? ↓", "Payment is through Whop, in USD. The payment page asks a few questions about your business.",
    ["Answer a few questions", "On the payment page, tell us your business or Page name, your Facebook Page link, and your country and language. We then tell you how to give us access to your Page."],
    ["Can I try before paying?", "We do not offer free samples at the moment. You can send us a question in the form below before you pay."],
    "Have a question before you pay? Send it and we will reply by email. Optional: you can pay right away in the Plans section above.", "Not sure, I have a question"],
  vi: ["Có câu hỏi trước? ↓", "Thanh toán qua Whop, bằng USD. Trang thanh toán có vài câu hỏi về doanh nghiệp của bạn.",
    ["Trả lời vài câu hỏi", "Ngay trên trang thanh toán, cho chúng tôi biết tên doanh nghiệp hoặc Page, link Facebook Page, quốc gia và ngôn ngữ. Sau đó chúng tôi hướng dẫn cách cấp quyền truy cập Page."],
    ["Tôi có thể thử trước khi trả tiền không?", "Hiện chúng tôi chưa có bài mẫu miễn phí. Bạn có thể gửi câu hỏi qua biểu mẫu bên dưới trước khi thanh toán."],
    "Có câu hỏi trước khi thanh toán? Hãy gửi, chúng tôi sẽ trả lời qua email. Không bắt buộc: bạn có thể thanh toán ngay ở mục Các gói phía trên.", "Chưa chắc, tôi có câu hỏi"],
  id: ["Ada pertanyaan dulu? ↓", "Pembayaran lewat Whop, dalam USD. Halaman pembayaran menanyakan beberapa hal tentang bisnis Anda.",
    ["Jawab beberapa pertanyaan", "Di halaman pembayaran, beri tahu nama bisnis atau Halaman, link Halaman Facebook, serta negara dan bahasa Anda. Setelah itu kami memberi tahu cara memberi akses ke Halaman Anda."],
    ["Bisakah saya mencoba sebelum membayar?", "Saat ini kami tidak menyediakan contoh gratis. Anda bisa mengirim pertanyaan lewat formulir di bawah sebelum membayar."],
    "Ada pertanyaan sebelum membayar? Kirim saja, kami akan membalas lewat email. Tidak wajib: Anda bisa langsung membayar di bagian Paket di atas.", "Belum yakin, saya punya pertanyaan"],
  es: ["¿Tienes una pregunta antes? ↓", "El pago se realiza con Whop, en USD. La página de pago hace algunas preguntas sobre tu negocio.",
    ["Responde unas preguntas", "En la página de pago, indícanos el nombre de tu negocio o página, el enlace de tu página de Facebook, y tu país e idioma. Después te explicamos cómo darnos acceso a tu página."],
    ["¿Puedo probar antes de pagar?", "Por ahora no ofrecemos muestras gratis. Puedes enviarnos una pregunta en el formulario de abajo antes de pagar."],
    "¿Tienes una pregunta antes de pagar? Envíala y te responderemos por correo. Opcional: puedes pagar ya mismo en la sección Planes de arriba.", "No estoy seguro, tengo una pregunta"],
  fr: ["Une question avant ? ↓", "Paiement via Whop, en USD. La page de paiement pose quelques questions sur votre entreprise.",
    ["Répondez à quelques questions", "Sur la page de paiement, indiquez le nom de votre entreprise ou Page, le lien de votre Page Facebook, ainsi que votre pays et votre langue. Nous vous expliquons ensuite comment nous donner accès à votre Page."],
    ["Puis-je essayer avant de payer ?", "Nous ne proposons pas d'essai gratuit pour le moment. Vous pouvez nous poser une question dans le formulaire ci-dessous avant de payer."],
    "Une question avant de payer ? Envoyez-la et nous répondrons par e-mail. Facultatif : vous pouvez payer tout de suite dans la section Offres ci-dessus.", "Pas sûr, j'ai une question"],
  ja: ["先に質問がありますか？ ↓", "お支払いはWhopを通じて米ドルで行います。お支払いページでビジネスについていくつか質問があります。",
    ["いくつかの質問に回答", "お支払いページで、事業名またはページ名、FacebookページのURL、国と言語を入力してください。その後、ページへのアクセス権の付与方法をご案内します。"],
    ["支払い前に試せますか？", "現在、無料サンプルは提供しておりません。お支払い前に、下のフォームからご質問いただけます。"],
    "お支払い前にご質問はありますか？ご送信いただければメールでご返信します。任意です。上のプランからすぐにお支払いいただくこともできます。", "未定、質問があります"],
  ko: ["먼저 질문이 있나요? ↓", "결제는 Whop을 통해 USD로 진행됩니다. 결제 페이지에서 비즈니스에 대한 몇 가지 질문이 있습니다.",
    ["몇 가지 질문에 답하기", "결제 페이지에서 비즈니스 또는 페이지 이름, Facebook 페이지 링크, 국가와 언어를 알려주세요. 이후 페이지 접근 권한을 주는 방법을 안내해 드립니다."],
    ["결제 전에 체험해 볼 수 있나요?", "현재는 무료 샘플을 제공하지 않습니다. 결제 전에 아래 양식으로 질문을 보내실 수 있습니다."],
    "결제 전에 질문이 있나요? 보내주시면 이메일로 답변드립니다. 선택 사항입니다. 위의 요금제에서 바로 결제하셔도 됩니다.", "아직 모르겠어요, 질문이 있어요"],
  zh: ["先有问题？ ↓", "通过 Whop 以美元支付。付款页面会询问几个关于您业务的问题。",
    ["回答几个问题", "在付款页面，告诉我们您的业务或主页名称、Facebook 主页链接，以及您的国家和语言。之后我们会告诉您如何授权访问主页。"],
    ["付款前可以试用吗？", "目前我们不提供免费示例。付款前，您可以通过下方表单向我们提问。"],
    "付款前有问题？发送给我们，我们会通过邮件回复。可选：您也可以直接在上方“套餐”部分付款。", "不确定，我有问题"]
};
for (const [code, p] of Object.entries(PAYFIRST)) {
  const t = LANGS[code];
  t.hero[5] = p[0];
  t.foot[1] = p[1];
  t.process[2][1] = p[2];
  t.faq[2][2] = p[3];
  t.form[2] = p[4];
  t.form[5][1] = p[5];
}

const page = (code) => {
  const t = LANGS[code];
  const [kPlans, hPlans, leadPlans, postsFmt, perMonth, payFmt] = t.plans;
  const [kProc, hProc, steps] = t.process;
  const [kFaq, hFaq, faqItems] = t.faq;
  const [kForm, hForm, leadForm, L, types, planTail] = t.form;
  const cfg = { market: "gl", lang: code, msg: { ...t.msg, creating: "", logging: "", checking: "", email_exists: "", tenant_taken: "", short_password: "", pay_not_ready: "", pay_title: "", pay_text: "", pay_button: "", redirecting: "", pay_error: "", account_done: "", go_dashboard: "", go_billing: "" } };
  const card = (p, i) => `
        <article class="svc-card${p.id === "social_12" ? " featured" : ""}">
          <p class="svc-note">${esc(t.tags[i])}</p>
          <h3>${esc(postsFmt.replace("{n}", p.posts))}</h3>
          <p class="svc-price"><strong>${esc(p.price)}</strong> <span>${esc(perMonth)}</span></p>
          <p class="svc-pace">${esc(t.pace[i])}</p>
          <ul>${t.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <a class="button ${p.id === "social_12" ? "primary" : ""} svc-pay" href="${p.whop}" target="_blank" rel="noopener noreferrer" data-plan="${p.id}">${esc(payFmt.replace("{price}", p.price))}</a>
        </article>`;
  const planOptions = [["social_4", 4], ["social_12", 12], ["social_30", 30], ["social_90", 90]].map(([v, n], i) => `<option value="${v}">${esc(planTail[0].replace("{n}", n).replace("{p}", PLAN_PRICES[i]))}</option>`).join("") + `<option value="unsure" selected>${esc(planTail[1])}</option>`;
  const langLinks = Object.entries(LANGS).map(([c, l]) => c === code ? `<strong aria-current="page">${esc(l.name)}</strong>` : `<a href="${l.file}" hreflang="${l.htmlLang}" lang="${l.htmlLang}">${esc(l.name)}</a>`).join("\n        ");
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${SITE}/${t.file}">
${Object.values(LANGS).map((l) => `<link rel="alternate" hreflang="${l.htmlLang}" href="${SITE}/${l.file}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${SITE}/landing-social.html">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/${t.file}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_shared/landing.css?v=20260925-6lang">
<link rel="stylesheet" href="_shared/service-landing.css?v=20261120-4">
<script src="/_shared/consent.js"></script>
</head>
<body class="svc">
<a class="skip" href="#register">${esc(t.skip)}</a>
<header>
  <div class="container nav">
    <a class="brand" href="landing.html"><span class="brand-mark" aria-hidden="true">✳</span>schools<span class="brand-ai">ai</span><span class="brand-dot">.</span></a>
    <nav aria-label="Main">
      <a href="#plans">${esc(t.nav[0])}</a>
      <a href="#process">${esc(t.nav[1])}</a>
      <a href="#faq">${esc(t.nav[2])}</a>
      <a href="#register">${esc(t.nav[3])}</a>
    </nav>
    <div class="nav-actions">
      <a class="button small" href="landing.html">${esc(t.nav[4])}</a>
    </div>
  </div>
  <div class="container svc-langbar"><span class="svc-switch" aria-label="Language">
        ${langLinks}
  </span></div>
</header>
<main id="main">
  <section class="container svc-hero">
    <p class="eyebrow">${esc(t.hero[0])}</p>
    <h1><span>${esc(t.hero[1])}</span> <span class="highlight">${esc(t.hero[2])}</span></h1>
    <p class="intro">${esc(t.hero[3])}</p>
    <div class="hero-actions">
      <a class="button primary" href="#plans">${esc(t.hero[4])}</a>
      <a class="text-link" href="#register">${esc(t.hero[5])}</a>
    </div>
    <p class="fine">${esc(t.hero[6])}</p>
    <ul class="svc-trust">${t.trust.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join("")}</ul>
  </section>

  <section class="container svc-section" id="plans">
    <p class="eyebrow">${esc(kPlans)}</p>
    <h2>${esc(hPlans)}</h2>
    <p class="svc-lead">${esc(leadPlans)}</p>
    <div class="svc-cards svc-cards-4">${PLANS.map(card).join("")}
    </div>
    <p class="svc-foot">${esc(t.foot[0])}</p>
    <p class="svc-foot">${esc(t.foot[1])}</p>
  </section>

  <section class="container svc-section" id="process">
    <p class="eyebrow">${esc(kProc)}</p>
    <h2>${esc(hProc)}</h2>
    <ol class="svc-steps svc-steps-4">${steps.map(([a, b]) => `<li><strong>${esc(a)}</strong><span>${esc(b)}</span></li>`).join("")}</ol>
  </section>

  <section class="container svc-section" id="faq">
    <p class="eyebrow">${esc(kFaq)}</p>
    <h2>${esc(hFaq)}</h2>
    <div class="svc-faq">${faqItems.map(([q, a]) => `
      <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
    </div>
  </section>

  <section class="container svc-section svc-register" id="register">
    <div>
      <p class="eyebrow">${esc(kForm)}</p>
      <h2>${esc(hForm)}</h2>
      <p class="svc-lead">${esc(leadForm)}</p>
    </div>
    <form id="lead-form" class="svc-form" novalidate>
      <input type="hidden" name="mode" value="consult">
      <div class="svc-grid">
        <label>${esc(L.name)} *<input name="name" autocomplete="name" required maxlength="80"></label>
        <label>${esc(L.email)} *<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label>${esc(L.phone)}<input name="phone" type="tel" autocomplete="tel" maxlength="20"></label>
        <label>${esc(L.business)} *<input name="business_name" autocomplete="organization" required maxlength="80"></label>
        <label>${esc(L.type)} *<select name="business_type" required><option value="">${esc(L.choose)}</option>${types.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select></label>
        <label>${esc(L.country)} *<input name="city" autocomplete="country-name" required maxlength="80"></label>
        <label class="wide">${esc(L.page)}<input name="page_url" type="url" maxlength="200" placeholder="https://facebook.com/yourpage"></label>
        <label class="wide">${esc(L.plan)}<select name="plan_interest">${planOptions}</select></label>
        <label class="wide">${esc(L.notes)}<textarea name="message" rows="3" maxlength="800"></textarea></label>
      </div>
      <input class="svc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="svc-consent"><input type="checkbox" name="consent" required> <span>${esc(L.consent)} <a href="privacy" target="_blank" rel="noopener">${esc(L.privacy)}</a>. *</span></label>
      <button class="button primary" type="submit" id="lead-submit" data-consult="${esc(L.submit)}" data-pay="${esc(L.submit)}">${esc(L.submit)}</button>
      <p id="lead-status" class="svc-status" role="status" aria-live="polite" tabindex="-1"></p>
      <div id="pay-confirm" class="svc-confirm" hidden></div>
    </form>
  </section>
</main>
<footer class="container">
  <a class="brand" href="landing.html">schools<span class="brand-ai">ai</span>.</a>
  <p>${esc(t.footer)}</p>
  <a href="privacy">Privacy Policy</a>
  <a href="terms">Terms of Service</a>
</footer>
<script>window.SERVICE_PAGE = ${JSON.stringify(cfg).replace(/</g, "\\u003c")};</script>
<script src="https://unpkg.com/pocketbase@0.21.3/dist/pocketbase.umd.js"></script>
<script src="_shared/config.js"></script>
<script src="_shared/service-landing.js?v=20261120-3"></script>
<script src="chat-widget.js?v=20261013-v5" data-tenant="schoolsai-social" data-botname="Schools AI" data-color="#245b42" data-position="right" data-style="bubble" data-lang="${code}" data-hello="auto"></script>
</body>
</html>
`;
};

for (const code of Object.keys(LANGS)) {
  writeFileSync(join(OUT, LANGS[code].file), page(code));
  console.log("wrote", LANGS[code].file);
}
