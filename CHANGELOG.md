# Changelog

## 2.1.17-gm4
- Fixed subtitle/font fetch on Greasemonkey 4+: use the documented `GM.xmlHttpRequest` API.
- Kept compatibility with legacy `GM_xmlhttpRequest` implementations.
- Added the required `@grant GM.xmlHttpRequest` metadata permission.

# Changelog

## 2.1.15-gm2
- Added reliable initialization retries and SPA DOM observation.
- Added Greasemonkey menu command as a fallback to the floating button.
- Removed the top-frame-only guard so eligible iframe documents can run their own panel.
- Improved font discovery from CSS `@font-face`, CSSOM, `FontFaceSet`, and performance resources.
- Explicitly excludes HLS/M3U8 from detected downloadable videos.
- Includes common direct video, subtitle, audio, font, and poster resource detection.

## 2.1.17-gm3
- Added WebVTT-to-SRT conversion with normalized timestamps and cue numbering.
- Added WebVTT-to-ASS export to retain common color, font, alignment, and cue-position styling.
- Added a subtitle style inspector for color, background, font, size, and cue position metadata.
- Added WOFF1-to-TTF/OTF conversion by rebuilding SFNT tables.
- WOFF2 conversion remains unsupported.
