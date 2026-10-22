import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import JSZip from "jszip";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Footer,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  TabStopType,
  TableLayoutType,
  VerticalAlign,
  LevelFormat,
  PageNumber,
  CharacterSet,
} from "docx";
import type { Block, ProposalModel, Run } from "@/lib/printProposal";

// Word version of the A4 "investment memo" proposal. Renders the same
// ProposalModel the browser builds for the HTML/PDF export.

const NAVY = "1B2035";
const LIME = "DFF266";
const BLUE = "D1E2F4";
const RULE = "E3E6EE";
const MUTED = "565C72";
const PANEL = "F3F5F9";

const HEAD = "Space Grotesk SemiBold";
const BODY = "Geist";
const BODY_B = "Geist SemiBold";

const mm = (v: number) => Math.round((v / 25.4) * 1440);
const PAGE_W = 11906; // A4
const PAGE_H = 16838;
const MARGIN = { top: mm(16), bottom: mm(20), left: mm(18), right: mm(18) };
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right;
const GUTTER_W = Math.round(CONTENT_W * 0.195);
const COL_W = CONTENT_W - GUTTER_W;

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const tableNoBorders = { ...noBorders, insideHorizontal: NONE, insideVertical: NONE };
const hair = (color = RULE, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const zeroMargins = { top: 0, bottom: 0, left: 0, right: 0 };

function text(t: string, o: { font?: string; size?: number; color?: string; caps?: boolean; spacing?: number; shade?: string } = {}) {
  return new TextRun({
    text: t,
    font: o.font ?? BODY,
    size: o.size ?? 20,
    color: o.color ?? NAVY,
    allCaps: o.caps,
    characterSpacing: o.spacing,
    shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
  });
}

const runs = (rs: Run[], size = 20) => rs.map((r) => text(r.text, { font: r.bold ? BODY_B : BODY, size }));

function blockParagraphs(blocks: Block[]): Paragraph[] {
  return blocks.map((b, i) => {
    const next = blocks[i + 1];
    switch (b.type) {
      case "li":
        return new Paragraph({
          numbering: { reference: "memo-bullet", level: 0 },
          spacing: { before: 0, after: next?.type === "li" ? 50 : 140, line: 288 },
          keepLines: true,
          children: runs(b.runs),
        });
      case "sub":
        return new Paragraph({
          spacing: { before: 200, after: 70 },
          keepNext: true,
          children: [text(b.runs.map((r) => r.text).join(""), { font: HEAD, size: 21 })],
        });
      case "dur":
        return new Paragraph({
          spacing: { before: 60, after: 180 },
          keepLines: true,
          children: [text(` ${b.runs.map((r) => r.text).join("")} `, { size: 17, shade: BLUE })],
        });
      case "price":
        return new Paragraph({
          spacing: { before: 0, after: 90 },
          keepLines: true,
          children: b.runs.map((r) => text(r.text, { font: HEAD, size: 22 })),
        });
      default:
        return new Paragraph({
          spacing: { before: 0, after: 110, line: 288 },
          keepLines: true,
          children: runs(b.runs),
        });
    }
  });
}

function sectionTable(s: ProposalModel["sections"][number]): Table {
  const heading = new Paragraph({
    spacing: { before: 0, after: 150 },
    keepNext: true,
    children: [text(s.title, { font: HEAD, size: 26 })],
  });
  const bodyParas = blockParagraphs(s.blocks);
  const content =
    s.kind === "fee"
      ? [
          heading,
          new Table({
            width: { size: COL_W, type: WidthType.DXA },
            columnWidths: [COL_W],
            layout: TableLayoutType.FIXED,
            borders: tableNoBorders,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: COL_W, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, color: "auto", fill: PANEL },
                    margins: { top: mm(4), bottom: mm(2.5), left: mm(5), right: mm(5) },
                    borders: noBorders,
                    children: bodyParas,
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [] }),
        ]
      : [heading, ...bodyParas];

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [GUTTER_W, COL_W],
    layout: TableLayoutType.FIXED,
    borders: tableNoBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: GUTTER_W, type: WidthType.DXA },
            borders: noBorders,
            margins: zeroMargins,
            children: [
              new Paragraph({ spacing: { after: 60 }, children: [text(s.num, { font: HEAD, size: 56 })] }),
              new Paragraph({ children: [text(s.gutter, { size: 14, color: MUTED, caps: true, spacing: 24 })] }),
            ],
          }),
          new TableCell({ width: { size: COL_W, type: WidthType.DXA }, borders: noBorders, margins: zeroMargins, children: content }),
        ],
      }),
    ],
  });
}

function metaRow(label: string, value: Paragraph[], invest = false): TableRow {
  const fill = invest ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : undefined;
  const borders = invest
    ? { top: hair(NAVY), bottom: hair(NAVY), left: NONE, right: NONE }
    : { top: hair(), bottom: hair(), left: NONE, right: NONE };
  const pad = invest ? mm(2.6) : mm(1.8);
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: GUTTER_W, type: WidthType.DXA },
        borders,
        shading: fill,
        margins: { top: pad, bottom: pad, left: invest ? mm(3) : 0, right: 0 },
        children: [new Paragraph({ children: [text(label, { size: 19, color: invest ? "B6BCCE" : MUTED })] })],
      }),
      new TableCell({
        width: { size: COL_W, type: WidthType.DXA },
        borders,
        shading: fill,
        margins: { top: pad, bottom: pad, left: 0, right: invest ? mm(3) : 0 },
        verticalAlign: VerticalAlign.TOP,
        children: value,
      }),
    ],
  });
}

function loadFont(file: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "assets", "fonts", file));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { model: m } = (await req.json()) as { model: ProposalModel };
    if (!m?.sections) return NextResponse.json({ error: "Missing proposal model" }, { status: 400 });
    const L = m.labels;

    let logoPng: Buffer | null = null;
    try {
      const svg = fs.readFileSync(path.join(process.cwd(), "public", "logozinnia.svg"));
      logoPng = await sharp(svg, { density: 400 }).resize({ width: 448 }).png().toBuffer();
    } catch {
      // Logo is not critical
    }

    const fonts = [
      { name: HEAD, data: loadFont("SpaceGrotesk-SemiBold.ttf") },
      { name: BODY, data: loadFont("Geist-Regular.ttf") },
      { name: BODY_B, data: loadFont("Geist-SemiBold.ttf") },
    ]
      .filter((f): f is { name: string; data: Buffer } => !!f.data)
      .map((f) => ({ ...f, characterSet: CharacterSet.ANSI }));

    // Header: logo | confidential
    const header = new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W / 2, CONTENT_W / 2],
      layout: TableLayoutType.FIXED,
      borders: tableNoBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              margins: zeroMargins,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: logoPng
                    ? [new ImageRun({ type: "png", data: logoPng, transformation: { width: 112, height: 22 } })]
                    : [text("ZINNIA", { font: HEAD, size: 28 })],
                }),
              ],
            }),
            new TableCell({
              borders: noBorders,
              margins: zeroMargins,
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(L.conf, { size: 14, color: MUTED, caps: true, spacing: 28 })] })],
            }),
          ],
        }),
      ],
    });

    const title = [
      new Paragraph({ spacing: { before: 360, after: 0, line: 270 }, children: [text(L.titleA, { font: HEAD, size: 46 })] }),
      new Paragraph({
        spacing: { before: 0, after: 300, line: 270 },
        children: [text(`${L.titleB} `, { font: HEAD, size: 46 }), text(m.name, { font: HEAD, size: 46, shade: LIME })],
      }),
    ];

    const chips: TextRun[] = [];
    m.services.forEach((s, i) => {
      if (i) chips.push(text("  ", { size: 18 }));
      chips.push(text(` ${s} `, { size: 17, shade: "EDEFF4" }));
    });

    const meta = new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [GUTTER_W, COL_W],
      layout: TableLayoutType.FIXED,
      borders: tableNoBorders,
      rows: [
        metaRow(L.for, [new Paragraph({ children: [text(`${m.name}${m.site ? ` | ${m.site}` : ""}`, { size: 19 })] })]),
        metaRow(L.by, [new Paragraph({ children: [text(m.preparedBy, { size: 19 })] })]),
        metaRow(L.date, [new Paragraph({ children: [text(m.date, { size: 19 })] })]),
        ...(m.services.length ? [metaRow(L.services, [new Paragraph({ spacing: { line: 300 }, children: chips })])] : []),
        ...(m.investment
          ? [
              metaRow(
                L.invest,
                [
                  new Paragraph({ children: [text(m.investment.amount, { font: HEAD, size: 28, color: LIME })] }),
                  ...(m.investment.detail ? [new Paragraph({ children: [text(m.investment.detail, { size: 18, color: "E4E7EF" })] })] : []),
                ],
                true,
              ),
            ]
          : []),
      ],
    });

    const sections = m.sections.flatMap((s) => [sectionTable(s), new Paragraph({ spacing: { after: 260 }, children: [] })]);

    const closing = m.closing.length
      ? [
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            columnWidths: [GUTTER_W, COL_W],
            layout: TableLayoutType.FIXED,
            borders: { ...tableNoBorders, top: hair(NAVY, 6) },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: GUTTER_W, type: WidthType.DXA }, borders: { ...noBorders, top: hair(NAVY, 6) }, children: [new Paragraph({ children: [] })] }),
                  new TableCell({
                    width: { size: COL_W, type: WidthType.DXA },
                    borders: { ...noBorders, top: hair(NAVY, 6) },
                    margins: { top: mm(4.5), bottom: 0, left: 0, right: 0 },
                    children: [
                      ...m.closing.map((r) => new Paragraph({ spacing: { after: 140, line: 300 }, keepLines: true, children: runs(r, 21) })),
                      new Paragraph({ spacing: { before: 120 }, children: [text(m.preparedBy, { font: BODY_B, size: 19 })] }),
                      new Paragraph({ children: [text(m.contact, { size: 19, color: MUTED })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]
      : [];

    const footer = new Footer({
      children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          children: [
            text(`Zinnia Group | ${L.conf}`, { size: 15, color: MUTED, caps: true, spacing: 10 }),
            new TextRun({ text: `\t${m.contact} | `, font: BODY, size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], font: BODY, size: 15, color: MUTED }),
            new TextRun({ text: " / ", font: BODY, size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY, size: 15, color: MUTED }),
          ],
        }),
      ],
    });

    const doc = new Document({
      creator: m.preparedBy,
      title: `Zinnia - ${m.name}`,
      fonts,
      styles: { default: { document: { run: { font: BODY, size: 20, color: NAVY } } } },
      numbering: {
        config: [
          {
            reference: "memo-bullet",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "▪",
                alignment: AlignmentType.LEFT,
                style: {
                  run: { font: BODY, color: NAVY, size: 18 },
                  paragraph: { indent: { left: 300, hanging: 300 } },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: PAGE_W, height: PAGE_H },
              margin: { ...MARGIN, footer: mm(9), header: mm(8) },
            },
          },
          footers: { default: footer },
          children: [header, ...title, meta, new Paragraph({ spacing: { after: 200 }, children: [] }), ...sections, ...closing],
        },
      ],
    });

    // Keep the brand fonts embedded when Leo edits and re-saves in Word
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const settings = await zip.file("word/settings.xml")?.async("string");
    if (settings && !settings.includes("embedTrueTypeFonts")) {
      zip.file("word/settings.xml", settings.replace(/(<w:settings[^>]*>)/, "$1<w:embedTrueTypeFonts/>"));
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const slug = m.name.replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="zinnia-proposal-${slug}.docx"`,
      },
    });
  } catch (err) {
    console.error("export-docx error:", err);
    return NextResponse.json({ error: "Failed to generate Word document" }, { status: 500 });
  }
}
