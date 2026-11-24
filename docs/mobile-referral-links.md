# Mobile referral links

Invitations are web-first. A shared referral link is
`https://www.letsbefriends.space/?ref=CODE`, and it stays in the browser so the
invite page, sign-in, and code claim happen on the website. The mobile app still
offers the optional "Add referral code" card during onboarding and on the
referrals screen, so a member can enter a code manually at any time.

## Android

Android App Links are scoped to content share paths in `app.json`: `/social`,
`/companion-profile`, `/review`, and `/circles`. Invitation paths (`/`,
`/invite`, `/referrals`, `/referral-invite`) are deliberately excluded so
referral links open in the browser.

`apps/web/public/.well-known/assetlinks.json` lists every signing certificate
allowed to open the app's links. It holds five entries:

- Play app signing key, the certificate on every build installed from Play:
  `59:DA:FB:A7:51:83:ED:E4:03:58:32:C1:39:2A:E8:8A:88:D4:2D:4F:2B:D3:A9:D5:2F:26:B0:60:0A:1E:20:AA`
- Play hybrid signing key, classical part:
  `72:34:88:EE:B1:66:8F:F8:C3:ED:20:AE:7D:13:6D:70:C7:01:AB:C5:0D:27:B0:68:27:D1:C6:57:F5:93:53:F1`
- Play hybrid signing key, post-quantum part:
  `48:EF:13:30:FC:E5:22:FF:55:82:B6:D9:E6:7E:90:AB:D3:BF:85:DF:3E:81:FD:5A:A5:8B:9F:71:1D:4E:00:5C`
- EAS upload keystore for `@lets-be-friends/lets-be-friends`:
  `70:38:A9:0F:05:E3:E8:1B:C7:56:B0:3F:E4:DC:67:57:5A:AD:80:5D:EF:87:6A:2F:BA:D7:26:E4:07:79:41:48`
- Local debug certificate used by `pnpm build:apk`:
  `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

Google Play re-signs the app with its own app signing certificate when Play App
Signing is enabled, which is the default for new apps. Without a matching
fingerprint, Android opens the content links in the browser instead of the app.
Get the Play certificates from Play Console (Protected with Play, App signing,
Download certificates), which saves `deployment_cert.der`,
`hybrid_classical_cert.der`, and `hybrid_pqc_cert.der`; read the SHA-256 with:

```bash
openssl x509 -inform DER -in deployment_cert.der -noout -fingerprint -sha256
```

Two rules decide whether a host verifies at all:

- The file must return `200` with `Content-Type: application/json`. Redirects
  fail verification: the Digital Asset Links service refuses to follow them, so
  a `http` to `https` or non-www to www redirect breaks that host permanently.
- Check a host with Google's own service before waiting on Play:
  `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.letsbefriends.space&relation=delegate_permission/common.handle_all_urls`

As of 2026-11-24 `www.letsbefriends.space` verifies and lists all five
certificates. The apex host `letsbefriends.space` is configured in Vercel as a
308 redirect to www, so it cannot verify while that redirect exists. Remove the
apex host from `intentFilters`, or stop redirecting it in Vercel, before
expecting Play to report every declared domain as verified.

Get the fingerprint from a signing keystore:

```bash
keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256
```

## iOS

`app.json` declares `applinks:www.letsbefriends.space` and
`applinks:letsbefriends.space` for content links. Apple also needs an
`apple-app-site-association` file served from the same host with the Apple Team
ID and bundle ID (`TEAMID.com.letsbefriends.mobile`). That value is not stored
in this repository, so add the file when the iOS build credentials exist.

The association file must list the same content paths and leave out the
invitation paths, otherwise tapping a referral link on an iPhone would open the
app instead of the web invite page.

## Custom scheme

`letsbefriends://referral-invite?ref=CODE` still opens the in-app invite handoff
for manual testing. Share sheets generate the HTTPS website link, not the custom
scheme.
