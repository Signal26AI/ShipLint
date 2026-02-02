// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "ios-preflight",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "PreflightCore",
            targets: ["PreflightCore"]
        ),
        .executable(
            name: "preflight",
            targets: ["PreflightCLI"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0"),
    ],
    targets: [
        .target(
            name: "PreflightCore",
            dependencies: [],
            path: "Sources/PreflightCore"
        ),
        .executableTarget(
            name: "PreflightCLI",
            dependencies: [
                "PreflightCore",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            path: "Sources/PreflightCLI"
        ),
        .testTarget(
            name: "PreflightCoreTests",
            dependencies: ["PreflightCore"],
            path: "Tests/PreflightCoreTests",
            resources: [
                .copy("Fixtures")
            ]
        ),
    ]
)
