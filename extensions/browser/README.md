# Remember browser extension

Load this directory as an unpacked Chromium extension. The toolbar popup saves the current page; `Command+Shift+S` saves without opening the popup. The context menu also supports links and videos.

The default API is `http://localhost:8787`, where captures use the Worker's isolated development identity. After deploying the Worker, set its HTTPS address and bearer access token in popup settings. The token is kept in `chrome.storage.local`, not synced to another browser. Custom API domains request access only to that origin when the connection is saved; the extension does not receive blanket page access.

Safari can package the same WebExtension source with Xcode's Safari Web Extension converter after the production API origin and Apple signing team are known.
