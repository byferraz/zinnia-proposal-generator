import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";
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
  HeightRule,
  TabStopType,
  TabStopPosition,
  convertInchesToTwip,
} from "docx";

const NAVY = "1B2035";
const GREEN = "DFF266";
const GRAY = "E8EAF0";
const L = convertInchesToTwip;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noBorder() {
  return {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
  };
}

// Strip HTML to plain text, converting list items to bullet lines
function stripHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Parse HTML → Paragraph[] with left/right indent baked in
function parseToParagraphs(
  html: string,
  opts: { leftIn?: number } = {}
): Paragraph[] {
  if (!html) return [];
  const plain = stripHTML(html);
  const lines = plain.split("\n").filter((l) => l.trim());
  const leftTwip = opts.leftIn !== undefined ? opts.leftIn : L(0.6);
  const rightTwip = L(0.6);

  return lines.map((line) => {
    const t = line.trim();
    const isBullet = t.startsWith("• ") || t.startsWith("- ");
    const text = isBullet ? t.replace(/^[•\-]\s+/, "") : t;
    const isBoldLabel =
      !isBullet &&
      /^(PHASE \d|FASE \d|TAILORED|STRATEGIC|FULL STACK|ONE-OFF|ZINNIA MEDIA|EXECUTIVE POSITIONING|ONE PAGER)/i.test(t);

    return new Paragraph({
      children: [
        ...(isBullet
          ? [new TextRun({ text: "•  ", color: "BBBBBB", size: 20, font: "Aptos" })]
          : []),
        new TextRun({
          text,
          bold: isBoldLabel,
          size: 20,
          color: isBoldLabel ? NAVY : "333333",
          font: "Aptos",
        }),
      ],
      indent: {
        left: isBullet ? leftTwip + L(0.15) : leftTwip,
        right: rightTwip,
      },
      spacing: { after: isBoldLabel ? 120 : 90, before: isBoldLabel ? 140 : 0 },
    });
  });
}

// Section label (gray caps + bottom divider)
function sectionHeader(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: 17,
        color: "AAAAAA",
        characterSpacing: 40,
        font: "Aptos",
      }),
    ],
    spacing: { before: 420, after: 160 },
    indent: { left: L(0.6), right: L(0.6) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY, space: 4 } },
  });
}

// Plain body section
function bodySection(label: string, html: string): Paragraph[] {
  const items = parseToParagraphs(html);
  if (!items.length) return [];
  return [sectionHeader(label), ...items];
}

// Fee section — each paragraph carries the green-left border + gray bg directly.
// First paragraph gets spaceBefore, last gets spaceAfter → no empty border-lines.
function feeSection(label: string, html: string): Paragraph[] {
  if (!html) return [];
  const plain = stripHTML(html);
  const lines = plain.split("\n").filter((l) => l.trim());
  if (!lines.length) return [];

  const feeParagraphs = lines.map((line, i) => {
    const t = line.trim();
    const isBullet = t.startsWith("• ") || t.startsWith("- ");
    const text = isBullet ? t.replace(/^[•\-]\s+/, "") : t;
    const isFirst = i === 0;
    const isLast = i === lines.length - 1;
    const isBoldLabel =
      !isBullet &&
      /^(FULL STACK|ONE-OFF|ZINNIA MEDIA|EXECUTIVE|ONE PAGER)/i.test(t);

    return new Paragraph({
      children: [
        ...(isBullet
          ? [new TextRun({ text: "•  ", color: "BBBBBB", size: 20, font: "Aptos" })]
          : []),
        new TextRun({
          text,
          bold: isBoldLabel,
          size: 20,
          color: isBoldLabel ? NAVY : "333333",
          font: "Aptos",
        }),
      ],
      shading: { fill: "F4F5F9", type: ShadingType.CLEAR },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 8 },
      },
      indent: {
        left: isBullet ? L(0.75) : L(0.6),
        right: L(0.6),
      },
      spacing: {
        before: isFirst ? 120 : isBoldLabel ? 100 : 0,
        after: isLast ? 120 : isBoldLabel ? 100 : 80,
      },
    });
  });

  return [sectionHeader(label), ...feeParagraphs];
}

// Gradient rows for header (near-white → navy), so the top page margin blends in
function gradientRows(): TableRow[] {
  const steps = [
    { fill: "ECEDF1", height: L(0.07) }, // near-white → almost invisible against white margin
    { fill: "ABAFCA", height: L(0.05) },
    { fill: "5B638A", height: L(0.05) },
    { fill: "323B60", height: L(0.04) },
  ];
  return steps.map(
    ({ fill, height }) =>
      new TableRow({
        height: { value: height, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [
          new TableCell({
            shading: { fill, type: ShadingType.CLEAR },
            borders: noBorder(),
            children: [new Paragraph({ children: [] })],
          }),
        ],
      })
  );
}

// ─── API route ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formData, editedHTML, content, generatedAt } = body;

    const isSpanish = formData.language === "spanish";
    const date = new Date(generatedAt).toLocaleDateString(
      isSpanish ? "es-ES" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );

    const SERVICE_LABELS: Record<string, string> = {
      linkedin_management: "LinkedIn Management (Essential)",
      full_stack: "Full Stack (Brand + LinkedIn)",
      marketing_strategy: "Tailored Marketing Strategy & Plan",
      website_development: "Website Development",
      executive_positioning: "Executive Positioning (individual)",
      one_pager: "One Pager / Teaser",
      brand_manual: "Brand Manual",
      media_amplification: "Zinnia Media Amplification",
    };

    const allServices = [
      ...formData.services.map((s: string) => SERVICE_LABELS[s] || s),
      ...(formData.customService?.trim() ? [formData.customService.trim()] : []),
    ].join("  |  ");

    const src = editedHTML || {};
    const phase1HTML = src.phase1 || content?.phase1 || "";
    const phase2HTML = src.phase2 || content?.phase2 || "";
    const additionalHTML = src.additional || content?.additional || "";
    const feeHTML = src.feeStructure || content?.feeStructure || "";
    const closingHTML = src.closingNote || content?.closingNote || "";

    const phase1Label = isSpanish
      ? "Fase 1: Alineación Estratégica de Marca"
      : "Phase 1: Essential Brand Strategy Alignment";
    const phase2Label = isSpanish
      ? "Fase 2: Posicionamiento en LinkedIn"
      : "Phase 2: Positioning – LinkedIn Essentials";
    const addLabel = isSpanish ? "Servicios Adicionales" : "Additional Essentials";
    const feeLabel = isSpanish ? "Estructura de Honorarios" : "Fee Structure & Breakdown";

    // ── Logo: read SVG, recolor to white, convert to PNG ──────────────────────
    let logoPng: Buffer | null = null;
    try {
      const svgPath = path.join(process.cwd(), "public", "logozinnia.svg");
      const svgRaw = fs.readFileSync(svgPath, "utf-8");
      // Recolor navy paths to white for use on dark background
      const svgWhite = svgRaw.replace(/fill="#1B2035"/g, 'fill="#FFFFFF"');
      logoPng = await sharp(Buffer.from(svgWhite))
        .resize({ width: 320, height: 64, fit: "contain", background: { r: 27, g: 32, b: 53, alpha: 0 } })
        .png()
        .toBuffer();
    } catch {
      // Logo not critical — proceed without it
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Aptos", size: 20, color: NAVY },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [
        {
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "FINANCIAL EXPERTISE  •  DIGITAL EXCELLENCE  •  STRATEGIC IMPACT",
                      size: 14,
                      color: "999999",
                      characterSpacing: 10,
                      font: "Aptos",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80 },
                }),
              ],
            }),
          },
          properties: {
            page: {
              margin: {
                top: L(0.55),
                bottom: L(0.65),
                left: L(0),
                right: L(0),
                footer: L(0.25),
              },
            },
          },
          children: [
            // ── HEADER TABLE ────────────────────────────────────────────────
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top:              { style: BorderStyle.NONE },
                bottom:           { style: BorderStyle.NONE },
                left:             { style: BorderStyle.NONE },
                right:            { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical:   { style: BorderStyle.NONE },
              },
              rows: [
                // Gradient rows: near-white → navy (masks the white top margin)
                ...gradientRows(),

                // Main navy content row
                new TableRow({
                  children: [
                    new TableCell({
                      shading: { fill: NAVY, type: ShadingType.CLEAR },
                      margins: {
                        top: L(0.35),
                        bottom: L(0.12),
                        left: L(0.6),
                        right: L(0.6),
                      },
                      borders: noBorder(),
                      children: [
                        // Logo left — "Strictly Confidential" right-aligned via tab stop
                        new Paragraph({
                          children: logoPng
                            ? [
                                new ImageRun({
                                  data: logoPng,
                                  transformation: { width: 110, height: 22 },
                                  type: "png",
                                }),
                                new TextRun({ text: "\t" }),
                                new TextRun({
                                  text: isSpanish ? "Estrictamente Confidencial" : "Strictly Confidential",
                                  size: 15,
                                  color: "777777",
                                  characterSpacing: 20,
                                  font: "Aptos",
                                }),
                              ]
                            : [
                                new TextRun({ text: "ZINNIA GROUP", bold: true, size: 30, color: "FFFFFF", characterSpacing: 60, font: "Aptos" }),
                                new TextRun({ text: "\t" }),
                                new TextRun({ text: isSpanish ? "Estrictamente Confidencial" : "Strictly Confidential", size: 15, color: "777777", characterSpacing: 20, font: "Aptos" }),
                              ],
                          // Right tab at 7.3" = page 8.5" minus 0.6" left + 0.6" right cell padding
                          tabStops: [{ type: TabStopType.RIGHT, position: L(7.3) }],
                          spacing: { after: 240 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: isSpanish ? "PREPARADO PARA:" : "PREPARED FOR:", size: 14, color: "888888", characterSpacing: 30, font: "Aptos" }),
                          ],
                          spacing: { after: 60 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: formData.prospectName, bold: true, size: 52, color: GREEN, font: "Aptos" }),
                          ],
                          spacing: { after: 100 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${isSpanish ? "Fecha" : "Date"}: ${date}`, size: 17, color: "999999", font: "Aptos" }),
                            ...(formData.websiteUrl
                              ? [new TextRun({ text: `  |  ${formData.websiteUrl}`, size: 17, color: "999999", font: "Aptos" })]
                              : []),
                          ],
                          spacing: { after: 280 },
                        }),
                      ],
                    }),
                  ],
                }),

                // Services strip (darker navy)
                new TableRow({
                  children: [
                    new TableCell({
                      shading: { fill: "2A3150", type: ShadingType.CLEAR },
                      margins: { top: L(0.11), bottom: L(0.11), left: L(0.6), right: L(0.6) },
                      borders: noBorder(),
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: isSpanish ? "SERVICIOS:  " : "SERVICES:  ", size: 14, color: "888888", bold: true, characterSpacing: 20, font: "Aptos" }),
                            new TextRun({ text: allServices, size: 16, color: GREEN, font: "Aptos" }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            // ── SPACER ──────────────────────────────────────────────────────
            new Paragraph({ children: [], spacing: { after: 100 } }),

            // ── BODY ────────────────────────────────────────────────────────
            ...bodySection(phase1Label, phase1HTML),
            ...bodySection(phase2Label, phase2HTML),
            ...(stripHTML(additionalHTML).trim() ? bodySection(addLabel, additionalHTML) : []),
            ...feeSection(feeLabel, feeHTML),

            // ── CLOSING NOTE (dark navy strip) ───────────────────────────
            ...(stripHTML(closingHTML).trim()
              ? [
                  new Paragraph({ children: [], spacing: { before: 360, after: 0 } }),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      new TableRow({
                        children: [
                          new TableCell({
                            shading: { fill: "2A3150", type: ShadingType.CLEAR },
                            margins: { top: L(0.2), bottom: L(0.2), left: L(0.6), right: L(0.6) },
                            borders: noBorder(),
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({ text: stripHTML(closingHTML), italics: true, size: 19, color: "CCCCCC", font: "Aptos" }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ]
              : []),

            // ── FOOTER ──────────────────────────────────────────────────────
            new Paragraph({
              children: [
                new TextRun({ text: `ZINNIA Group © ${new Date().getFullYear()}   |   leonardo@zinniagroup.io`, size: 16, color: "AAAAAA", font: "Aptos" }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 200 },
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRAY, space: 4 } },
              indent: { left: L(0.6), right: L(0.6) },
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="zinnia-proposal-${formData.prospectName.replace(/\s+/g, "-").toLowerCase()}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX export error:", error);
    return NextResponse.json({ error: "Failed to generate Word document" }, { status: 500 });
  }
}
