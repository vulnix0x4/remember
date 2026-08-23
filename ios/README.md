# Remember for iPhone

Native SwiftUI client and Share Extension for the Remember personal-memory product.

## Requirements

- Xcode 26 or newer
- iOS 26 simulator or device
- XcodeGen (`brew install xcodegen`) when regenerating the project

## Generate and build

```sh
cd ios
xcodegen generate
xcodebuild -project Remember.xcodeproj -scheme Remember -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' build
```

Run tests:

```sh
xcodebuild -project Remember.xcodeproj -scheme Remember -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' test
```

The client looks for `REMEMBER_API_URL` in the scheme environment and otherwise uses the hosted owner deployment. Local requests use the backend's development user header. Remote previews read `REMEMBER_API_TOKEN` or a token stored in the Keychain and send bearer auth; no token is bundled. Set `REMEMBER_MOCK_FALLBACK=1` in a Debug scheme to use deterministic local fixtures when the API is unavailable. Release builds always use strict live behavior.

For a signed device build, copy `Local.xcconfig.example` to `Local.xcconfig`, provide your own bundle ID, App Group, and Apple development team, then build with `-xcconfig Local.xcconfig`. The local configuration is ignored by Git.

## Share Extension

Both targets use the `REMEMBER_APP_GROUP` build setting, which defaults to `group.com.example.remember.shared`. Before a signed device build, create your chosen App Group in the Apple Developer portal for both bundle identifiers. The extension immediately queues an `http` or `https` URL; the app imports queued links whenever it becomes active.

No source audiovisual content is downloaded or stored. Timestamp actions open the original URL.
