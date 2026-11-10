// 한글(HWPX) 내려받기 — 학습지를 한컴 한글에서 바로 열어 고칠 수 있는 .hwpx 로 만든다 (2026-11-10 workerE)
//
// 매쓰플랫 «한글(HWP) 다운로드»(5/15) 대응. HWP(바이너리) 대신 공개 규격 HWPX(OWPML, zip+XML)로 만든다 — 한글 2014 이상이 연다.
// · 글로만 된 문항(영어·국어·사회 글 문항) → 한글에서 고칠 수 있는 **글**로 넣는다.
// · 그림 문항(매쓰플랫 원본 이미지)·수식($…$)·자료 그림이 있는 문항 → 앱이 쓰는 **문항 그림**(problemShot)으로 넣는다.
//   수식을 한글 수식(hp:equation)으로 바꾸는 건 LaTeX→한글 수식 문법 변환이 따로 필요해 다음 차례로 미룬다.
// 뼈대는 한컴 한글 13(2024)로 저장된 실제 hwpx 의 구조(mimetype·container·content.hpf·header·section0)를 그대로 따랐고,
// header 는 쓰는 것만 남긴 최소판(글꼴 1종·글자 모양 4·문단 모양 2·스타일 1)이다. linesegarray 는 한글이 열 때 다시 계산한다.
// 🔴 zip 은 압축 없이(STORE) 쓴다 — mimetype 이 첫 항목·무압축이어야 한다는 규격을 가장 단순하게 지킨다. 라이브러리 의존 0.

export type HwpxBlock =
  | { kind: 'text'; text: string; style?: 'title' | 'num' | 'body' | 'small'; pageBreak?: boolean }
  | { kind: 'img'; data: Uint8Array; w: number; h: number; widthMm?: number }

const STYLE_CHAR = { body: 0, title: 1, num: 2, small: 3 } as const
const MM = 283.465   // 1mm = 283.465 HWPUNIT (1인치 = 7200)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // XML 1.0 에 못 들어가는 제어 문자 제거(탭·줄바꿈 제외)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

const NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'
const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER']
const L7 = (v: string | number) => `hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"`

function charPr(id: number, height: number, color: string, bold: boolean): string {
  return `<hh:charPr id="${id}" height="${height}" textColor="${color}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">`
    + `<hh:fontRef ${L7(0)}/><hh:ratio ${L7(100)}/><hh:spacing ${L7(0)}/><hh:relSz ${L7(100)}/><hh:offset ${L7(0)}/>`
    + (bold ? '<hh:bold/>' : '')
    + '<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/></hh:charPr>'
}
function paraPr(id: number, align: string, prev: number): string {
  const m = `<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev}" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>`
  return `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="LTR">`
    + `<hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>`
    + '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
    + `<hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">${m}</hp:case><hp:default>${m}</hp:default></hp:switch>`
    + '<hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>'
}

export function headerXml(): string {
  const font = '<hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="0" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>'
  const border = (id: number) => `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>`
  return `${XML}<hh:head ${NS} version="1.5" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>`
    + `<hh:fontfaces itemCnt="7">${LANGS.map(l => `<hh:fontface lang="${l}" fontCnt="1">${font}</hh:fontface>`).join('')}</hh:fontfaces>`
    + `<hh:borderFills itemCnt="2">${border(1)}${border(2)}</hh:borderFills>`
    + `<hh:charProperties itemCnt="4">${charPr(0, 1000, '#000000', false)}${charPr(1, 1600, '#000000', true)}${charPr(2, 1100, '#1F5F4A', true)}${charPr(3, 900, '#666666', false)}</hh:charProperties>`
    + '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'
    + `<hh:paraProperties itemCnt="2">${paraPr(0, 'JUSTIFY', 0)}${paraPr(1, 'LEFT', 1400)}</hh:paraProperties>`
    + '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'
    + '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption></hh:head>'
}

// A4 · 여백 좌우 20mm 위아래 15mm (실측 견본 hwpx 와 같은 값)
const SEC_PR = '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="0" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">'
  + '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
  + '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
  + '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
  + '<hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="2834" footer="2834" gutter="0" left="5669" right="5669" top="4251" bottom="4251"/></hp:pagePr>'
  + '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>'
  + '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>'
  + ['BOTH', 'EVEN', 'ODD'].map(t => `<hp:pageBorderFill type="${t}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>`).join('')
  + '</hp:secPr>'
const BODY_W = 59528 - 5669 * 2   // 본문 폭(HWPUNIT)

function picXml(idx: number, b: Extract<HwpxBlock, { kind: 'img' }>): string {
  const w = Math.min(BODY_W, Math.round((b.widthMm ?? 120) * MM))
  const h = Math.max(1, Math.round(w * b.h / Math.max(1, b.w)))
  const dw = b.w * 75, dh = b.h * 75   // 원본 픽셀 → HWPUNIT(96dpi 기준)
  const id = 1000 + idx
  return `<hp:pic id="${id}" zOrder="${idx}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id}" reverse="0">`
    + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:flip horizontal="0" vertical="0"/>`
    + `<hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(h / 2)}" rotateimage="1"/>`
    + '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
    + `<hc:img binaryItemIDRef="image${idx}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>`
    + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect>`
    + `<hp:imgClip left="0" right="${dw}" top="0" bottom="${dh}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${dw}" dimheight="${dh}"/><hp:effects/>`
    + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>`
    + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    + '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment>문항 그림</hp:shapeComment></hp:pic>'
}

export function sectionXml(blocks: HwpxBlock[]): { xml: string; images: Uint8Array[] } {
  const images: Uint8Array[] = []
  const paras: string[] = []
  let first = true, pid = 0
  const para = (inner: string, opts: { paraPr?: number; pageBreak?: boolean } = {}) => {
    const head = first ? `<hp:run charPrIDRef="0">${SEC_PR}<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run>` : ''
    first = false
    paras.push(`<hp:p id="${pid++}" paraPrIDRef="${opts.paraPr ?? 0}" styleIDRef="0" pageBreak="${opts.pageBreak ? 1 : 0}" columnBreak="0" merged="0">${head}${inner}</hp:p>`)
  }
  for (const b of blocks) {
    if (b.kind === 'img') {
      images.push(b.data)
      para(`<hp:run charPrIDRef="0">${picXml(images.length, b)}<hp:t/></hp:run>`)
      continue
    }
    const cp = STYLE_CHAR[b.style ?? 'body']
    const lines = b.text.split('\n')
    lines.forEach((ln, i) => para(`<hp:run charPrIDRef="${cp}"><hp:t>${esc(ln)}</hp:t></hp:run>`,
      { paraPr: b.style === 'num' && i === 0 ? 1 : 0, pageBreak: !!b.pageBreak && i === 0 }))
  }
  if (first) para('<hp:run charPrIDRef="0"><hp:t/></hp:run>')
  return { xml: `${XML}<hs:sec ${NS}>${paras.join('')}</hs:sec>`, images }
}

function contentHpf(title: string, nImg: number): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const imgs = Array.from({ length: nImg }, (_, i) => `<opf:item id="image${i + 1}" href="BinData/image${i + 1}.jpg" media-type="image/jpg" isEmbeded="1"/>`).join('')
  return `${XML}<opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${esc(title)}</opf:title><opf:language>ko</opf:language>`
    + `<opf:meta name="creator" content="text">Summit On</opf:meta><opf:meta name="CreatedDate" content="text">${now}</opf:meta><opf:meta name="ModifiedDate" content="text">${now}</opf:meta></opf:metadata>`
    + `<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>${imgs}<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>`
    + '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>'
}

// ── 무압축 zip ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(d: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true)
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true)
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true)
    parts.push(new Uint8Array(h.buffer), name, f.data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true)
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true)
    c.setUint16(28, name.length, true); c.setUint32(42, off, true)
    central.push(new Uint8Array(c.buffer), name)
    off += 30 + name.length + n
  }
  const cSize = central.reduce((a, b) => a + b.length, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, off, true)
  const all = [...parts, ...central, new Uint8Array(e.buffer)]
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0
  for (const a of all) { out.set(a, p); p += a.length }
  return out
}

/** 블록들 → .hwpx 파일 바이트 */
export function buildHwpx(title: string, blocks: HwpxBlock[]): Uint8Array {
  const enc = new TextEncoder()
  const { xml, images } = sectionXml(blocks)
  const preview = blocks.filter(b => b.kind === 'text').map(b => (b as { text: string }).text).join('\n').slice(0, 1000)
  return zipStore([
    { name: 'mimetype', data: enc.encode('application/hwp+zip') },
    { name: 'version.xml', data: enc.encode(`${XML}<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="1" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="13, 0, 0, 564 WIN32LEWindows_10"/>`) },
    { name: 'Contents/header.xml', data: enc.encode(headerXml()) },
    { name: 'Contents/section0.xml', data: enc.encode(xml) },
    ...images.map((d, i) => ({ name: `BinData/image${i + 1}.jpg`, data: d })),
    { name: 'Preview/PrvText.txt', data: enc.encode(preview) },
    { name: 'settings.xml', data: enc.encode(`${XML}<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`) },
    { name: 'META-INF/container.xml', data: enc.encode(`${XML}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/></ocf:rootfiles></ocf:container>`) },
    { name: 'META-INF/manifest.xml', data: enc.encode(`${XML}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`) },
    { name: 'Contents/content.hpf', data: enc.encode(contentHpf(title, images.length)) },
  ])
}
