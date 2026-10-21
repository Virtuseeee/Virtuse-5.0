import AVFoundation
for p in CommandLine.arguments.dropFirst() {
  let a = AVURLAsset(url: URL(fileURLWithPath: p)); let g = AVAssetImageGenerator(asset: a); g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
  let img = try! g.copyCGImage(at: CMTime(value: 54, timescale: 30), actualTime: nil)
  let ctx = CGContext(data: nil, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: 1, height: 1)); let px = ctx.data!.assumingMemoryBound(to: UInt8.self)
  print(p.split(separator: "/").last!, "alphaInfo:", img.alphaInfo.rawValue, "corner-ish avg alpha(0..255):", px[3])
}
