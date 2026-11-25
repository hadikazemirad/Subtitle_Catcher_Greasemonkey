# Subtitle Catcher — Greasemonkey 2.1.17

This userscript detects direct media resources, subtitles, fonts, audio, and posters on web pages. HLS/M3U8 is intentionally excluded.

## New in 2.1.17
- Real WebVTT (`.vtt`) to SRT conversion, including cue numbering and timestamp conversion.
- WebVTT to ASS export to preserve basic styling: global cue color/background, font family/size, bold/italic, alignment, and common line/position percentages.
- A style-inspection action showing color, background, font, size, and cue position settings found in a VTT file.
- WOFF 1.0 to TTF/OTF conversion by rebuilding the SFNT font tables.

## Limitations
- SRT has no standard support for text color or screen position. Use ASS when styling matters.
- Only WOFF1 is converted. WOFF2 is not decoded in this build.
- Complex CSS selectors, per-class styling, and site-specific rendering behavior may not be fully represented in ASS.
- Subtitle conversion buttons are shown for URLs ending in `.vtt`.
- Resources must be accessible to the browser session; DRM, protected resources, inaccessible frames, and expired URLs may not work.

## Update
Disable/remove the previous Subtitle Catcher userscript, install `Subtitle_Catcher_Greasemonkey.user.js`, reload the video page, and use the new conversion buttons in the panel.
