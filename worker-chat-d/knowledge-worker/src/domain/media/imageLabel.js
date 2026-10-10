// Tự đặt nhãn mô tả cho ảnh upload (để việc chọn ảnh theo nội dung bài hoạt động) — logic thuần, không gọi mạng.

const MAX_LABEL_LENGTH = 100;

// Nhãn "vô nghĩa": rỗng, tên file, mã máy ảnh (IMG_2031), UUID/chuỗi hex dài... → nên để AI mô tả thay.
export function isGenericLabel(label) {
  const text = String(label || "").trim();
  if (!text) return true;
  if (/\.(jpe?g|png|webp|gif|heic|avif|bmp)$/i.test(text)) return true;
  if (/^(img|dsc|dscn|pxl|image|photo|picture|screenshot|screen shot|whatsapp image|zalo|download|untitled|ảnh|hình)[\s_.-]*\(?\d/i.test(text)) return true;
  if (!/\s/.test(text) && /^[a-f0-9-]{12,}$/i.test(text)) return true;
  if (/^[\d\s_.-]+$/.test(text)) return true;
  return false;
}

// Chuẩn hoá câu mô tả của AI thành nhãn gọn một dòng.
export function cleanDescription(text) {
  const line = String(text || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  return line.replace(/^(nhãn|label|mô tả|description)\s*[:：-]\s*/i, "").replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.。]+$/, "").trim().slice(0, MAX_LABEL_LENGTH);
}

export function buildDescribeMessages(dataUrl, languageName = "Vietnamese") {
  return [
    { role: "system", content: `You write short labels for photos in a business's media library so the right photo can later be matched to a social media post. Reply with ONE line only: a concrete description of what the photo shows (subject, setting, notable details), 6-14 words, in ${languageName}. No quotes, no trailing period, no preamble.` },
    { role: "user", content: [{ type: "text", text: "Label this photo." }, { type: "image_url", image_url: { url: dataUrl, detail: "low" } }] }
  ];
}
