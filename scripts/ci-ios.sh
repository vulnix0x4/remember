#!/bin/zsh
set -euo pipefail

remember_root="${0:A:h:h}"
remember_destination="${REMEMBER_IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro,OS=latest}"

cd "$remember_root"
(cd ios && xcodegen generate --spec project.yml)
xcodebuild \
  -project ios/Remember.xcodeproj \
  -scheme Remember \
  -destination "$remember_destination" \
  -derivedDataPath ios/DerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build test
