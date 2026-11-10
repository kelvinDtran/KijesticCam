What Kelvin taps next: read this draft, pick a price option in Stripe yourself (or skip Stripe and leave the download free), and paste the text below into a new Stripe Product only after the first GitHub Release exists and you have its URL.

Status: DRAFT. Nothing here has been created in Stripe. No price is decided.

## Product

| Field | Value |
|---|---|
| Name | KijesticCam for Windows |
| Description | A local screen recorder for Windows. Record a display, a window or several sources at once with system audio and microphone. Files stay on your computer. Hardware-accelerated H.264, H.265 and AV1. Open source (MIT). |
| Statement descriptor suffix | KIJESTICCAM |
| Metadata | `product_line` = `kijesticcam` |
| Metadata | `project` = `kijesticcam` |

Statement suffix: Stripe suffixes are 5 to 22 characters, so `KIJESTICCAM` (11) fits.

## Price (OPTIONS for the owner, none decided)

| Option | Shape | Note |
|---|---|---|
| A | $0, no Stripe | Link straight to the GitHub Release. No product needed. |
| B | One-time, pay what you want (custom amount) | Supporter payment on a free download. |
| C | One-time, fixed amount chosen by the owner | The amount is the owner's call. No market data for it exists in this repo: NOT MEASURED. |

## Confirmation page text

Thanks for getting KijesticCam.

Download the installer here: {{RELEASE_LINK}}

(Replace `{{RELEASE_LINK}}` with the URL of the published GitHub Release, for example the repo's Releases page. Do not publish this text until that link works.)

Install steps:

1. Run `KijesticCam-Setup-<version>.exe`.
2. Windows SmartScreen may say "Windows protected your PC" because the installer is not code-signed. Click **More info**, then **Run anyway**.
3. Optional: compare the file with `SHA256SUMS.txt` on the same release page.

Windows 10 or 11, 64-bit. Recordings are saved to your Videos\KijesticCam folder and never leave your computer.

Questions: reply to your receipt email. (Owner: confirm the support address before publishing; none is stated in this repo's files.)

## Claims check

Every claim above is from this repo's README and code: local recording, MP4/MKV output, bundled FFmpeg, H.264/H.265/AV1, NVENC/QSV/AMF detection, MIT license, unsigned installer. No customer count, review, testimonial or security claim is made.
