import Foundation
// workerD 11/11 — 문항 그림 글자 읽기(macOS Vision, 무료·로컬). 빌드: swiftc -O scripts/gichul_ocr.swift -o /tmp/gichul_ocr
// 쓰임: 글꼴 글자표가 깨져 PDF 글자가 안 나오는 회차 → gichul_autotag.py --ocr
import Vision
import AppKit
// usage: ocr <img>... → JSON lines {"f":path,"t":text}
for p in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: p), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    let t = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    let o = try! JSONSerialization.data(withJSONObject: ["f": p, "t": t])
    print(String(data: o, encoding: .utf8)!)
}
