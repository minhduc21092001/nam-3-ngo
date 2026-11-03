/*
 * Kho dữ liệu trên Cloudflare KV (link ngắn + xác nhận tham dự), binding LIEN_KET khai báo trong wrangler.jsonc.
 */
export function layKho(env) {
  const kv = env.LIEN_KET;
  if (!kv) return null;
  return {
    get: (khoa) => kv.get(khoa, { type: 'json' }),
    // Chép luôn vào metadata (nếu đủ nhỏ) để list() đọc được cả danh sách trong một lần, không phải get từng mục
    set: (khoa, giaTri) => {
      const json = JSON.stringify(giaTri);
      return kv.put(khoa, json, new TextEncoder().encode(json).length <= 1000 ? { metadata: giaTri } : {});
    },
    xoa: (khoa) => kv.delete(khoa),
    list: async (tienTo) => {
      const kq = [];
      let cursor;
      do {
        const trang = await kv.list({ prefix: tienTo, cursor });
        for (const k of trang.keys) kq.push({ khoa: k.name, ...(k.metadata || (await kv.get(k.name, { type: 'json' })) || {}) });
        cursor = trang.list_complete ? null : trang.cursor;
      } while (cursor);
      return kq;
    },
  };
}
