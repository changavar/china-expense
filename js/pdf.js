import { formatCents, formatDisplayDate, formatRate } from "./money.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = 802;
const BOTTOM_LIMIT = 782;
const ROW_HEIGHT = 21;

const COLOR = {
  navy: [0.025, 0.062, 0.12],
  ink: [0.055, 0.105, 0.18],
  text: [0.11, 0.16, 0.23],
  muted: [0.38, 0.44, 0.52],
  faint: [0.58, 0.63, 0.69],
  line: [0.86, 0.89, 0.92],
  soft: [0.955, 0.965, 0.977],
  gold: [0.78, 0.55, 0.2],
  goldSoft: [0.985, 0.955, 0.89],
  teal: [0.13, 0.55, 0.48],
  tealSoft: [0.92, 0.975, 0.965],
  white: [1, 1, 1],
};

const COLUMNS = {
  date: { x: MARGIN, width: 56, align: "left" },
  category: { x: MARGIN + 56, width: 76, align: "left" },
  description: { x: MARGIN + 132, width: 168, align: "left" },
  cny: { x: MARGIN + 300, width: 66, align: "right" },
  aed: { x: MARGIN + 366, width: 72, align: "right" },
  rate: { x: MARGIN + 438, width: 61, align: "right" },
};

function asciiText(value) {
  return String(value ?? "")
    .replace(/¥/g, "CNY ")
    .replace(/[–—]/g, "-")
    .replace(/·/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdfString(value) {
  return asciiText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function number(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function textCommand(x, top, text, size, font = "F1", color = COLOR.text) {
  const baseline = PAGE_HEIGHT - top;
  return `BT /${font} ${size} Tf ${color.map(number).join(" ")} rg 1 0 0 1 ${number(x)} ${number(baseline)} Tm (${escapePdfString(text)}) Tj ET`;
}

const HELVETICA_WIDTHS = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667,
  "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
  ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
  "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 278, ";": 278,
  "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, A: 667, B: 667,
  C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, a: 556,
  b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556,
  r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500,
  z: 500, "{": 334, "|": 260, "}": 334, "~": 584,
};

const HELVETICA_BOLD_WIDTHS = {
  " ": 278, "!": 333, '"': 474, "#": 556, $: 556, "%": 889, "&": 722,
  "'": 238, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
  ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
  "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 333, ";": 333,
  "<": 584, "=": 584, ">": 584, "?": 611, "@": 975, A: 722, B: 722,
  C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556,
  K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 333, "\\": 278, "]": 333, "^": 584, _: 556, "`": 333, a: 556,
  b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278,
  j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611,
  r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556,
  z: 500, "{": 389, "|": 280, "}": 389, "~": 584,
};

function measureText(text, size, bold = false) {
  const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let total = 0;
  for (const character of asciiText(text)) {
    total += widths[character] ?? 556;
  }
  return (total * size) / 1000;
}

function estimateTextWidth(text, size, bold = false) {
  return measureText(text, size, bold);
}

function rightTextCommand(right, top, text, size, font = "F1", color = COLOR.text) {
  const left = right - estimateTextWidth(text, size, font === "F2");
  return textCommand(left, top, text, size, font, color);
}

function rectCommand(x, top, width, height, color, radius = 0) {
  const y = PAGE_HEIGHT - top - height;
  if (radius > 0) {
    const r = Math.min(radius, width / 2, height / 2);
    const k = 0.5522847498 * r;
    const x2 = x + width;
    const y2 = y + height;
    return [
      `${color.map(number).join(" ")} rg`,
      `${number(x + r)} ${number(y)} m`,
      `${number(x2 - r)} ${number(y)} l`,
      `${number(x2 - r + k)} ${number(y)} ${number(x2)} ${number(y + r - k)} ${number(x2)} ${number(y + r)} c`,
      `${number(x2)} ${number(y2 - r)} l`,
      `${number(x2)} ${number(y2 - r + k)} ${number(x2 - r + k)} ${number(y2)} ${number(x2 - r)} ${number(y2)} c`,
      `${number(x + r)} ${number(y2)} l`,
      `${number(x + r - k)} ${number(y2)} ${number(x)} ${number(y2 - r + k)} ${number(x)} ${number(y2 - r)} c`,
      `${number(x)} ${number(y + r)} l`,
      `${number(x)} ${number(y + r - k)} ${number(x + r - k)} ${number(y)} ${number(x + r)} ${number(y)} c`,
      "f",
    ].join("\n");
  }
  return `${color.map(number).join(" ")} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f`;
}

function lineCommand(x1, top1, x2, top2, color = COLOR.line, width = 0.6) {
  return `q ${color.map(number).join(" ")} RG ${number(width)} w ${number(x1)} ${number(PAGE_HEIGHT - top1)} m ${number(x2)} ${number(PAGE_HEIGHT - top2)} l S Q`;
}

function truncateToWidth(text, maxWidth, size, bold = false) {
  const clean = asciiText(text);
  if (measureText(clean, size, bold) <= maxWidth) return clean;

  let truncated = clean;
  while (
    truncated.length > 0 &&
    measureText(`${truncated.trimEnd()}...`, size, bold) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated.trimEnd()}...`;
}

function formatShortDate(dateString) {
  if (!dateString) return "";
  return formatDisplayDate(dateString)
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(cents) {
  return formatCents(cents);
}

function buildPdfDocument(pageContents, metadata) {
  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  objects.set(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );
  objects.set(
    5,
    `<< /Title (${escapePdfString(metadata.title)}) /Author (China Trip Expenses) /Creator (China Trip Expenses) /CreationDate (${metadata.creationDate}) >>`
  );

  let nextId = 6;
  const pageIds = [];

  for (const page of pageContents) {
    const contentId = nextId++;
    const pageId = nextId++;
    const stream = page.join("\n");
    objects.set(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );

  const maxId = nextId - 1;
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = new Array(maxId + 1).fill(0);
  let byteOffset = 0;

  const header = "%PDF-1.4\n%ChinaTripExpenses\n";
  chunks.push(encoder.encode(header));
  byteOffset += encoder.encode(header).length;

  for (let id = 1; id <= maxId; id += 1) {
    if (!objects.has(id)) {
      objects.set(id, "<< >>");
    }
    const objectString = `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
    const bytes = encoder.encode(objectString);
    offsets[id] = byteOffset;
    chunks.push(bytes);
    byteOffset += bytes.length;
  }

  const xrefOffset = byteOffset;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(encoder.encode(xref));

  return new Blob(chunks, { type: "application/pdf" });
}

function creationDateString(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

/**
 * Build a professional, paginated PDF report entirely on the device.
 */
export function createReportPdf(report) {
  const pages = [];
  let page = [];
  let cursorY = 0;
  let isFirstPage = false;

  const periodLabel = report.periodLabel || "All recorded expenses";
  const generatedLabel = report.generatedLabel || "";
  const rates = Array.isArray(report.rates) && report.rates.length
    ? report.rates
    : ["1.55"];
  const ratesLine = rates
    .map((rate) => `1 AED = ${formatRate(rate)} CNY`)
    .join("   ·   ");

  const add = (command) => {
    if (command) page.push(command);
  };

  const startPage = () => {
    page = [];
    pages.push(page);
    isFirstPage = pages.length === 1;

    if (isFirstPage) {
      add(rectCommand(0, 0, PAGE_WIDTH, 7, COLOR.navy));
      add(textCommand(MARGIN, 41, "CHINA TRIP EXPENSES", 8, "F2", COLOR.gold));
      add(textCommand(MARGIN, 69, "Expense Report", 25, "F2", COLOR.text));
      add(textCommand(MARGIN, 96, periodLabel, 10, "F1", COLOR.muted));
      if (generatedLabel) {
        add(textCommand(MARGIN, 111, generatedLabel, 8.5, "F1", COLOR.faint));
      }
      add(lineCommand(MARGIN, 126, PAGE_WIDTH - MARGIN, 126));

      const boxTop = 141;
      const boxWidth = (CONTENT_WIDTH - 12) / 2;
      const boxHeight = 64;

      add(rectCommand(MARGIN, boxTop, boxWidth, boxHeight, COLOR.goldSoft, 7));
      add(textCommand(MARGIN + 13, boxTop + 16, "TOTAL EXPENSES  /  CNY", 7, "F2", COLOR.gold));
      add(textCommand(MARGIN + 13, boxTop + 39, `CNY ${formatMoney(report.totals.cnyCents)}`, 17, "F2", COLOR.text));
      add(
        textCommand(
          MARGIN + 13,
          boxTop + 53,
          `${report.expenses.length} item${report.expenses.length === 1 ? "" : "s"}`,
          7.5,
          "F1",
          COLOR.muted
        )
      );

      const secondX = MARGIN + boxWidth + 12;
      add(rectCommand(secondX, boxTop, boxWidth, boxHeight, COLOR.tealSoft, 7));
      add(textCommand(secondX + 13, boxTop + 16, "TOTAL EXPENSES  /  AED", 7, "F2", COLOR.teal));
      add(textCommand(secondX + 13, boxTop + 39, `AED ${formatMoney(report.totals.aedCents)}`, 17, "F2", COLOR.text));
      add(
        textCommand(
          secondX + 13,
          boxTop + 53,
          "Converted using each saved rate",
          7.5,
          "F1",
          COLOR.muted
        )
      );

      add(textCommand(MARGIN, 232, "EXCHANGE RATES USED", 7, "F2", COLOR.gold));
      add(
        textCommand(
          MARGIN,
          246,
          truncateToWidth(ratesLine, CONTENT_WIDTH, 8.5),
          8.5,
          "F1",
          COLOR.muted
        )
      );
      cursorY = 268;
    } else {
      add(textCommand(MARGIN, 34, "CHINA TRIP EXPENSES", 7, "F2", COLOR.gold));
      add(textCommand(MARGIN, 47, "Expense Report", 14, "F2", COLOR.text));
      add(
        textCommand(
          PAGE_WIDTH - MARGIN - 220,
          47,
          truncateToWidth(periodLabel, 220, 8.5),
          8.5,
          "F1",
          COLOR.muted
        )
      );
      add(lineCommand(MARGIN, 60, PAGE_WIDTH - MARGIN, 60));
      cursorY = 78;
    }
  };

  const ensureSpace = (height, redrawTableHeader = false) => {
    if (cursorY + height <= BOTTOM_LIMIT) return;
    startPage();
    if (redrawTableHeader) {
      cursorY = drawTableHeader(cursorY);
    }
  };

  const drawTableHeader = (top) => {
    add(rectCommand(MARGIN, top, CONTENT_WIDTH, 22, COLOR.navy, 4));
    const baseline = top + 14.5;
    add(textCommand(COLUMNS.date.x + 9, baseline, "DATE", 7, "F2", COLOR.white));
    add(textCommand(COLUMNS.category.x + 2, baseline, "CATEGORY", 7, "F2", COLOR.white));
    add(textCommand(COLUMNS.description.x + 2, baseline, "DESCRIPTION", 7, "F2", COLOR.white));
    add(rightTextCommand(COLUMNS.cny.x + COLUMNS.cny.width, baseline, "CNY", 7, "F2", COLOR.white));
    add(rightTextCommand(COLUMNS.aed.x + COLUMNS.aed.width, baseline, "AED", 7, "F2", COLOR.white));
    add(rightTextCommand(COLUMNS.rate.x + COLUMNS.rate.width, baseline, "RATE", 7, "F2", COLOR.white));
    return top + 28;
  };

  const sortedExpenses = [...(report.expenses || [])].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });

  startPage();
  cursorY = drawTableHeader(cursorY);

  if (!sortedExpenses.length) {
    add(rectCommand(MARGIN, cursorY + 4, CONTENT_WIDTH, 54, COLOR.soft, 6));
    add(textCommand(MARGIN + 16, cursorY + 25, "No expenses in the selected date range.", 11, "F2", COLOR.ink));
    add(textCommand(MARGIN + 16, cursorY + 41, "Choose a wider range or add an expense first.", 8.5, "F1", COLOR.muted));
    cursorY += 70;
  }

  sortedExpenses.forEach((expense, index) => {
    if (cursorY + ROW_HEIGHT > BOTTOM_LIMIT) {
      startPage();
      cursorY = drawTableHeader(cursorY);
    }

    if (index % 2 === 1) {
      add(rectCommand(MARGIN, cursorY - 5, CONTENT_WIDTH, ROW_HEIGHT, COLOR.soft));
    }

    add(textCommand(COLUMNS.date.x + 9, cursorY + 8, formatShortDate(expense.date), 8.2, "F1", COLOR.muted));
    add(
      textCommand(
        COLUMNS.category.x + 2,
        cursorY + 8,
        truncateToWidth(expense.category, COLUMNS.category.width - 4, 8.2),
        8.2,
        "F1",
        COLOR.text
      )
    );
    add(
      textCommand(
        COLUMNS.description.x + 2,
        cursorY + 8,
        truncateToWidth(expense.description || "—", COLUMNS.description.width - 8, 8.2),
        8.2,
        "F1",
        COLOR.text
      )
    );
    add(
      rightTextCommand(
        COLUMNS.cny.x + COLUMNS.cny.width,
        cursorY + 8,
        formatMoney(expense.cnyCents),
        8.2,
        "F1",
        COLOR.muted
      )
    );
    add(
      rightTextCommand(
        COLUMNS.aed.x + COLUMNS.aed.width,
        cursorY + 8,
        formatMoney(expense.aedCents),
        8.4,
        "F2",
        COLOR.text
      )
    );
    add(
      rightTextCommand(
        COLUMNS.rate.x + COLUMNS.rate.width,
        cursorY + 8,
        formatRate(expense.exchangeRate),
        8.2,
        "F1",
        COLOR.muted
      )
    );

    add(lineCommand(MARGIN, cursorY + 15, PAGE_WIDTH - MARGIN, cursorY + 15, COLOR.line, 0.4));
    cursorY += ROW_HEIGHT;
  });

  cursorY += 18;

  // Category subtotals
  ensureSpace(46);
  add(textCommand(MARGIN, cursorY, "CATEGORY SUBTOTALS", 7, "F2", COLOR.gold));
  cursorY += 13;
  add(lineCommand(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY));
  cursorY += 16;

  add(textCommand(MARGIN, cursorY + 2, "Category", 7, "F2", COLOR.faint));
  add(rightTextCommand(MARGIN + 430, cursorY + 2, "CNY", 7, "F2", COLOR.faint));
  add(rightTextCommand(PAGE_WIDTH - MARGIN, cursorY + 2, "AED", 7, "F2", COLOR.faint));
  cursorY += 12;

  const categories = report.categoryTotals || [];
  if (!categories.length) {
    add(textCommand(MARGIN, cursorY + 6, "No category totals available.", 8.5, "F1", COLOR.muted));
    cursorY += 22;
  }
  categories.forEach((category) => {
    ensureSpace(22);
    add(
      textCommand(
        MARGIN,
        cursorY + 7,
        truncateToWidth(category.category, 90, 9.2, true),
        9.2,
        "F2",
        COLOR.text
      )
    );
    add(
      textCommand(
        MARGIN + 100,
        cursorY + 7,
        `${category.count} item${category.count === 1 ? "" : "s"}`,
        7.5,
        "F1",
        COLOR.faint
      )
    );
    add(
      rightTextCommand(
        MARGIN + 430,
        cursorY + 7,
        formatMoney(category.cnyCents),
        9.2,
        "F1",
        COLOR.muted
      )
    );
    add(
      rightTextCommand(
        PAGE_WIDTH - MARGIN,
        cursorY + 7,
        formatMoney(category.aedCents),
        9.4,
        "F2",
        COLOR.text
      )
    );
    cursorY += 21;
    add(lineCommand(MARGIN, cursorY - 3, PAGE_WIDTH - MARGIN, cursorY - 3, COLOR.line, 0.4));
  });

  cursorY += 10;
  ensureSpace(79);

  // Grand total block
  const boxTop = cursorY;
  add(rectCommand(MARGIN, boxTop, CONTENT_WIDTH, 68, COLOR.goldSoft, 7));
  add(textCommand(MARGIN + 15, boxTop + 17, "GRAND TOTAL", 7, "F2", COLOR.gold));
  add(
    textCommand(
      MARGIN + 15,
      boxTop + 43,
      `CNY ${formatMoney(report.totals.cnyCents)}`,
      12,
      "F1",
      COLOR.muted
    )
  );
  add(
    rightTextCommand(
      PAGE_WIDTH - MARGIN - 15,
      boxTop + 43,
      `AED ${formatMoney(report.totals.aedCents)}`,
      20,
      "F2",
      COLOR.text
    )
  );
  add(
    textCommand(
      MARGIN + 15,
      boxTop + 57,
      "Generated locally on this device. Totals use each expense's saved exchange rate.",
      7,
      "F1",
      COLOR.muted
    )
  );

  pages.forEach((content, index) => {
    content.push(lineCommand(MARGIN, FOOTER_TOP - 12, PAGE_WIDTH - MARGIN, FOOTER_TOP - 12, COLOR.line, 0.4));
    content.push(textCommand(MARGIN, FOOTER_TOP, "China Trip Expenses  ·  Private & offline", 7, "F1", COLOR.faint));
    content.push(
      rightTextCommand(
        PAGE_WIDTH - MARGIN,
        FOOTER_TOP,
        `Page ${index + 1} of ${pages.length}`,
        7,
        "F1",
        COLOR.faint
      )
    );
  });

  const now = new Date();
  return buildPdfDocument(pages, {
    title: "China Trip Expenses - Expense Report",
    creationDate: creationDateString(now),
  });
}
