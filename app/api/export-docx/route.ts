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

// Navy header block: title + editable meta rows, one table so it stays together
function heroTable(m: ProposalModel): Table {
  const fill = { type: ShadingType.CLEAR, color: "auto", fill: NAVY };
  const PAD_X = mm(6.5);
  const LABEL_W = GUTTER_W - PAD_X;
  const VALUE_W = CONTENT_W - GUTTER_W - PAD_X;
  const line = { style: BorderStyle.SINGLE, size: 4, color: "3A4160" };
  const titleRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        columnSpan: 2,
        shading: fill,
        borders: noBorders,
        margins: { top: mm(6), bottom: mm(3), left: PAD_X, right: PAD_X },
        children: m.title.map((ln, i) =>
          new Paragraph({
            spacing: { before: 0, after: i === m.title.length - 1 ? 120 : 0, line: 270 },
            children: ln.map((r) => text(r.text, { font: HEAD, size: 46, color: r.mark ? LIME : "FFFFFF" })),
          })),
      }),
    ],
  });
  const rows = m.meta.map((r, i) => {
    const last = i === m.meta.length - 1;
    const valueRuns = r.chips
      ? r.chips.flatMap((c, j) => [...(j ? [text("  ", { size: 18, color: "FFFFFF" })] : []), text(`\u00A0${c}\u00A0`, { size: 17, color: "FFFFFF", shade: "343C5E" })])
      : r.runs.map((x) => text(x.text, { font: x.bold ? BODY_B : BODY, size: 19, color: x.mark ? LIME : "FFFFFF" }));
    const borders = { top: line, bottom: NONE, left: NONE, right: NONE };
    const pad = { top: mm(1.8), bottom: last ? mm(4) : mm(1.8) };
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: LABEL_W + PAD_X, type: WidthType.DXA },
          shading: fill,
          borders,
          margins: { ...pad, left: PAD_X, right: mm(2) },
          children: [new Paragraph({ children: [text(r.label, { size: 19, color: "A9AFC4" })] })],
        }),
        new TableCell({
          width: { size: VALUE_W + PAD_X, type: WidthType.DXA },
          shading: fill,
          borders,
          margins: { ...pad, left: 0, right: PAD_X },
          children: [new Paragraph({ spacing: { line: r.chips ? 300 : 240 }, children: valueRuns })],
        }),
      ],
    });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [GUTTER_W, CONTENT_W - GUTTER_W],
    layout: TableLayoutType.FIXED,
    borders: tableNoBorders,
    rows: [titleRow, ...rows],
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
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(m.conf, { size: 14, color: MUTED, caps: true, spacing: 28 })] })],
            }),
          ],
        }),
      ],
    });

    const sections = m.sections.flatMap((s) => [sectionTable(s), new Paragraph({ spacing: { after: 260 }, children: [] })]);

    const closing = m.closing.length || m.sign.length
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
                      ...m.sign.map((ln, i) => new Paragraph({
                        spacing: { before: i === 0 ? 120 : 0 },
                        children: ln.map((r) => text(r.text, { font: r.bold ? BODY_B : BODY, size: 19, color: r.bold ? NAVY : MUTED })),
                      })),
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
            text(`Zinnia Group | ${m.conf}`, { size: 15, color: MUTED, caps: true, spacing: 10 }),
            new TextRun({ text: `\t${m.contact} | `, font: BODY, size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], font: BODY, size: 15, color: MUTED }),
            new TextRun({ text: " / ", font: BODY, size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY, size: 15, color: MUTED }),
          ],
        }),
      ],
    });

    const doc = new Document({
      creator: "Zinnia Group",
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
          children: [header, new Paragraph({ spacing: { after: 280 }, children: [] }), heroTable(m), new Paragraph({ spacing: { after: 320 }, children: [] }), ...sections, ...closing],
        },
      ],
    });

    // Keep the brand fonts embedded when Leo edits and re-saves in Word.
    // w:settings children have a fixed schema order: embedTrueTypeFonts must
    // follow displayBackgroundShape, or Word reports "unreadable content".
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const settings = await zip.file("word/settings.xml")?.async("string");
    if (settings && !settings.includes("embedTrueTypeFonts")) {
      const patched = settings.includes("<w:displayBackgroundShape/>")
        ? settings.replace("<w:displayBackgroundShape/>", "<w:displayBackgroundShape/><w:embedTrueTypeFonts/>")
        : settings.replace(/(<w:settings[^>]*>)/, "$1<w:embedTrueTypeFonts/>");
      zip.file("word/settings.xml", patched);
    }
    // Font part names with spaces ("fonts/Space Grotesk SemiBold.odttf") are
    // not valid package names; rename them and fix the relationships
    const relsPath = "word/_rels/fontTable.xml.rels";
    let rels = await zip.file(relsPath)?.async("string");
    if (rels) {
      const targets = Array.from(rels.matchAll(/Target="(fonts\/[^"]+)"/g)).map((x) => x[1]);
      for (const [i, target] of targets.entries()) {
        const file = zip.file(`word/${target}`);
        if (!file || !/\s/.test(target)) continue;
        const clean = `fonts/font${i + 1}.odttf`;
        zip.file(`word/${clean}`, await file.async("uint8array"));
        zip.remove(`word/${target}`);
        rels = rels.replace(`Target="${target}"`, `Target="${clean}"`);
      }
      zip.file(relsPath, rels);
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const slug = m.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "proposal";
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
