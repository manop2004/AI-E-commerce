import readXlsxFile from "read-excel-file/browser";

export type ImportedProduct = {
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  low_stock_threshold: number;
  category: string | null;
  status: string;
};

const headerAliases: Record<keyof ImportedProduct, string[]> = {
  name: ["name", "title", "product", "productname", "ชื่อ", "ชื่อสินค้า", "สินค้า", "รายการสินค้า"],
  description: ["description", "detail", "details", "รายละเอียด", "คำอธิบาย"],
  sku: ["sku", "code", "รหัส", "รหัสสินค้า", "บาร์โค้ด", "barcode"],
  price: ["price", "sellprice", "saleprice", "ราคา", "ราคาขาย"],
  compare_at_price: ["compareatprice", "originalprice", "ราคาเต็ม", "ราคาปกติ"],
  stock: ["stock", "inventory", "qty", "quantity", "จำนวน", "สต็อก", "คงเหลือ", "เหลือ"],
  low_stock_threshold: ["lowstockthreshold", "แจ้งเตือนสต็อก", "เตือนเมื่อเหลือ"],
  category: ["category", "type", "หมวดหมู่", "ประเภท"],
  status: ["status", "สถานะ"],
};

const normalizeHeader = (value: unknown) => String(value || "").toLowerCase().replace(/^\uFEFF/, "").replace(/[\s_\-()]/g, "").trim();

const parseNumber = (value: unknown, fallback = 0) => {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (value: unknown) => {
  const raw = normalizeHeader(value);
  if (["draft", "ฉบับร่าง", "ร่าง"].includes(raw)) return "draft";
  if (["archived", "inactive", "เลิกขาย", "ปิดขาย"].includes(raw)) return "archived";
  return "active";
};

const detectDelimiter = (text: string) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const candidates = [",", "\t", ";"];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
};

const csvToRows = (text: string) => {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { current += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === delimiter && !quoted) { row.push(current.trim()); current = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current.trim());
      if (row.some((c) => String(c || "").trim())) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += ch;
  }
  row.push(current.trim());
  if (row.some((c) => String(c || "").trim())) rows.push(row);
  return rows;
};

export const rowsToProducts = (rows: unknown[][]): ImportedProduct[] => {
  const cleanRows = rows
    .map((row) => (Array.isArray(row) ? row : [row]))
    .filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (cleanRows.length === 0) return [];

  const first = cleanRows[0].map(normalizeHeader);
  const hasHeader = Object.values(headerAliases).some((aliases) => aliases.some((alias) => first.includes(normalizeHeader(alias))));
  const headers = hasHeader ? cleanRows[0] : ["name", "price", "stock", "sku", "category", "description"];
  const body = hasHeader ? cleanRows.slice(1) : cleanRows;

  const findIndex = (field: keyof ImportedProduct) => headers.findIndex((h) => {
    const header = normalizeHeader(h);
    return headerAliases[field].some((alias) => header === normalizeHeader(alias) || header.includes(normalizeHeader(alias)));
  });

  const index = {
    name: findIndex("name"),
    description: findIndex("description"),
    sku: findIndex("sku"),
    price: findIndex("price"),
    compare_at_price: findIndex("compare_at_price"),
    stock: findIndex("stock"),
    low_stock_threshold: findIndex("low_stock_threshold"),
    category: findIndex("category"),
    status: findIndex("status"),
  };

  // Fallback: if "name" header not detected, use the first non-empty column as name.
  if (index.name < 0) index.name = 0;

  return body.map((row) => {
    const pick = (i: number) => (i >= 0 ? row[i] : "");
    return {
      name: String(pick(index.name) || "").trim(),
      description: String(pick(index.description) || "").trim() || null,
      sku: String(pick(index.sku) || "").trim() || null,
      price: parseNumber(pick(index.price), 0),
      compare_at_price: index.compare_at_price >= 0 ? parseNumber(pick(index.compare_at_price), 0) || null : null,
      stock: Math.max(0, Math.round(parseNumber(pick(index.stock), 0))),
      low_stock_threshold: Math.max(0, Math.round(parseNumber(pick(index.low_stock_threshold), 5))),
      category: String(pick(index.category) || "").trim() || null,
      status: normalizeStatus(pick(index.status)),
    };
  }).filter((product) => product.name);
};

export const parseStockFile = async (file: File) => {
  const lowerName = file.name.toLowerCase();
  const rows = lowerName.endsWith(".csv") || lowerName.endsWith(".txt")
    ? csvToRows(await file.text())
    : lowerName.endsWith(".xlsx")
      ? ((await readXlsxFile(file)) as unknown as unknown[][])
      : (() => { throw new Error("รองรับเฉพาะไฟล์ .csv และ .xlsx"); })();
  return rowsToProducts(rows);
};

export const buildStockTrainingContent = (products: ImportedProduct[]) =>
  products
    .map((p) => `${p.name} | ${p.category || "ไม่ระบุหมวด"} | ราคา ${p.price} บาท | สต็อก ${p.stock} ชิ้น${p.sku ? ` | SKU ${p.sku}` : ""}${p.description ? ` | ${p.description}` : ""}`)
    .join("\n")
    .slice(0, 20000);

// Sample CSV the user can download to see the expected format.
export const STOCK_TEMPLATE_CSV = `ชื่อสินค้า,รหัสสินค้า,ราคา,ราคาเต็ม,สต็อก,หมวดหมู่,รายละเอียด
เสื้อยืดคอกลมสีขาว,TS-WHT-M,290,390,25,เสื้อผ้า,ผ้าฝ้าย 100% ไซส์ M
กางเกงยีนส์ทรงสลิม,JN-SLM-32,890,1290,12,เสื้อผ้า,ทรงสลิม เอว 32
รองเท้าผ้าใบสีดำ,SK-BLK-42,1290,1590,8,รองเท้า,รุ่นคลาสสิก ไซส์ 42
กระเป๋าสะพายข้าง,BG-BRN-01,690,890,15,กระเป๋า,หนัง PU สีน้ำตาล
หมวกแก๊ปสีกรม,CP-NVY-01,290,,30,เครื่องประดับ,ปรับขนาดได้
`;

export const downloadStockTemplate = () => {
  const blob = new Blob(["\uFEFF" + STOCK_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stock-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};