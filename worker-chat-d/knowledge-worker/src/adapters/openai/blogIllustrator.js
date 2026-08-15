const SYSTEM_PROMPT = `Bạn là graphic designer chuyên thiết kế banner/thumbnail quảng bá khóa học online dạng SVG, phong cách hiện đại, tối giản (giống banner trên Udemy/Coursera).

Yêu cầu bắt buộc cho SVG:
- viewBox="0 0 900 600", width="100%" height="auto", tự chứa hoàn toàn: KHÔNG <script>, KHÔNG <image>/<use xlink:href> trỏ ra ngoài, KHÔNG chữ/text nào cả (trang chi tiết khóa học đã hiển thị tên khóa học riêng bằng HTML thật ngay cạnh ảnh — ảnh chỉ đóng vai trò banner trang trí, KHÔNG lặp lại tên khóa học, không viết bất kỳ chữ gì lên ảnh).
- Nền: gradient (linearGradient hoặc radialGradient) dùng chủ đạo 2 màu thương hiệu #5751E1 (tím/indigo) và #FFC224 (vàng) — có thể pha thêm trắng/tối để tạo chiều sâu, không dùng thêm màu ngoài bảng màu này.
- Trang trí bằng các hình khối trừu tượng ĐƠN GIẢN: circle, ellipse, path bo tròn mềm mại (blob shape), hoặc 1 icon tối giản dạng đường nét (line-art) gợi ý chủ đề khóa học (ví dụ: 2 dấu ngoặc nhọn lồng nhau kiểu code editor cho domain "code", biểu tượng loa phóng thanh hoặc biểu đồ tăng trưởng cho "marketing") — vẽ bằng path/line đơn giản, KHÔNG chi tiết rườm rà, KHÔNG vẽ người/vật thể phức tạp/ảnh chụp thật.
- Bố cục cân đối, nhiều khoảng trắng (âm), không nhồi nhét chi tiết — ưu tiên cảm giác chuyên nghiệp, sang trọng, hiện đại hơn là màu mè. Vì KHÔNG có chữ, hình khối/icon trang trí là điểm nhấn chính — đặt lệch tâm (rule of thirds) cho sinh động, đừng để trống trơn.`;

const EXAMPLE_SVG = '<svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" width="100%" height="auto"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5751E1"/><stop offset="100%" stop-color="#3A35A0"/></linearGradient></defs><rect width="900" height="600" fill="url(#bg)"/><circle cx="120" cy="480" r="180" fill="#FFC224" opacity="0.2"/></svg>';

export function sanitizeBlogSvg(svg) {
  return String(svg || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
}

function extractJson(text) {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Blog illustration AI returned invalid JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

export function createOpenAiBlogIllustrator({ baseUrl, apiKey, model = "gpt-4o-mini", mediaBaseUrl, mediaToken, fetchImpl = fetch }) {
  if (!baseUrl || !apiKey || !mediaBaseUrl || !mediaToken) throw new Error("Blog illustrator configuration is incomplete.");
  const aiRoot = baseUrl.replace(/\/$/, ""); const mediaRoot = mediaBaseUrl.replace(/\/$/, "");

  async function drawSvg(prompt) {
    const response = await fetchImpl(`${aiRoot}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 2200, temperature: 0.6,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Domain của khóa học (gợi ý chọn icon/motif trang trí phù hợp): ${prompt}` }, { role: "assistant", content: JSON.stringify({ svg: EXAMPLE_SVG }) }],
        response_format: { type: "json_schema", json_schema: { name: "course_cover_svg", strict: true, schema: { type: "object", properties: { svg: { type: "string" } }, required: ["svg"], additionalProperties: false } } },
      }),
    });
    if (!response.ok) throw new Error(`Blog illustration AI request failed (${response.status}).`);
    const data = await response.json();
    const parsed = extractJson(data.choices?.[0]?.message?.content || "");
    const svg = sanitizeBlogSvg(parsed.svg).trim();
    if (!svg.startsWith("<svg")) throw new Error("Blog illustration AI returned invalid SVG.");
    return svg;
  }

  async function uploadSvg({ tenant, svg, label, prompt }) {
    const form = new FormData();
    form.append("tenant", tenant); form.append("label", String(label || "AI generated").slice(0, 100));
    form.append("source", "ai_generated"); form.append("type", "image"); form.append("status", "ready");
    form.append("prompt_used", String(prompt || "").slice(0, 500));
    form.append("file", new Blob([svg], { type: "image/svg+xml" }), `blog-${crypto.randomUUID().slice(0, 8)}.svg`);
    const response = await fetchImpl(`${mediaRoot}/api/collections/media_library/records`, { method: "POST", headers: { Authorization: mediaToken }, body: form });
    if (!response.ok) throw new Error(`Blog illustration upload failed (${response.status}).`);
    const record = await response.json();
    if (!record.id || !record.file) throw new Error("Blog illustration upload returned no file.");
    return `${mediaRoot}/api/files/media_library/${record.id}/${encodeURIComponent(record.file)}`;
  }

  async function generate({ tenant, prompt, alt }) {
    const svg = await drawSvg(prompt);
    return uploadSvg({ tenant, svg, label: alt, prompt });
  }
  return { generate, generateCover: ({ tenant, tag, title }) => generate({ tenant, prompt: tag, alt: title }) };
}
