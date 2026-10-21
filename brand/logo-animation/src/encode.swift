// Encode a numbered PNG frame sequence into a video with AVAssetWriter.
// usage: encode <framesDir> <fps> <output> <codec: h264|hevc|hevcAlpha|prores4444> [bitrateMbps]
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import VideoToolbox

let args = CommandLine.arguments
guard args.count >= 5 else { fputs("usage: encode <framesDir> <fps> <output> <codec> [mbps]\n", stderr); exit(2) }
let dir = args[1], fps = Int32(args[2])!, outPath = args[3], codec = args[4]
let mbps = args.count > 5 ? Double(args[5])! : 12.0

let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".png") }.sorted()
guard let first = files.first else { fputs("no frames\n", stderr); exit(1) }
func loadImage(_ name: String) -> CGImage {
    let url = URL(fileURLWithPath: dir).appendingPathComponent(name)
    let src = CGImageSourceCreateWithURL(url as CFURL, nil)!
    return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}
let img0 = loadImage(first)
let w = img0.width, h = img0.height
let alpha = (codec == "hevcAlpha" || codec == "prores4444")

let outURL = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: outURL)
let fileType: AVFileType = outPath.hasSuffix(".mp4") ? .mp4 : .mov
let writer = try! AVAssetWriter(outputURL: outURL, fileType: fileType)

var settings: [String: Any] = [AVVideoWidthKey: w, AVVideoHeightKey: h]
switch codec {
case "h264":
    settings[AVVideoCodecKey] = AVVideoCodecType.h264
    settings[AVVideoCompressionPropertiesKey] = [AVVideoAverageBitRateKey: Int(mbps * 1_000_000),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: fps,
        AVVideoAllowFrameReorderingKey: true, AVVideoExpectedSourceFrameRateKey: fps]
case "hevc":
    settings[AVVideoCodecKey] = AVVideoCodecType.hevc
    settings[AVVideoCompressionPropertiesKey] = [AVVideoAverageBitRateKey: Int(mbps * 1_000_000), AVVideoMaxKeyFrameIntervalKey: fps]
case "hevcAlpha":
    settings[AVVideoCodecKey] = AVVideoCodecType.hevcWithAlpha
    settings[AVVideoCompressionPropertiesKey] = [AVVideoAverageBitRateKey: Int(mbps * 1_000_000), AVVideoMaxKeyFrameIntervalKey: fps, kVTCompressionPropertyKey_TargetQualityForAlpha as String: 1.0]
case "prores4444":
    settings[AVVideoCodecKey] = AVVideoCodecType.proRes4444
default: fputs("unknown codec\n", stderr); exit(2)
}
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let pixFmt = kCVPixelFormatType_32BGRA
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: pixFmt, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h])
writer.add(input)
guard writer.startWriting() else { fputs("startWriting failed: \(String(describing: writer.error))\n", stderr); exit(1) }
writer.startSession(atSourceTime: .zero)

let cs = CGColorSpaceCreateDeviceRGB()
func pixelBuffer(_ img: CGImage) -> CVPixelBuffer {
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    let buf = pb!
    CVPixelBufferLockBaseAddress(buf, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: w, height: h, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: cs,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.clear(CGRect(x: 0, y: 0, width: w, height: h))
    if !alpha { ctx.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h)) }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    CVPixelBufferUnlockBaseAddress(buf, [])
    return buf
}
var i: Int64 = 0
for name in files {
    while !input.isReadyForMoreMediaData { usleep(2000) }
    let t = CMTime(value: i, timescale: fps)
    if !adaptor.append(pixelBuffer(loadImage(name)), withPresentationTime: t) { fputs("append failed at \(i): \(String(describing: writer.error))\n", stderr); exit(1) }
    i += 1
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status != .completed { fputs("finish failed: \(String(describing: writer.error))\n", stderr); exit(1) }
print("wrote \(outPath) \(w)x\(h) \(files.count) frames @\(fps)fps")
