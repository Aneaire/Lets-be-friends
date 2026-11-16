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
allowed to open the app's links. It holds two entries: the local debug
certificate used by `pnpm build:apk`, and the EAS upload keystore created for
`@lets-be-friends/lets-be-friends`
(`70:38:A9:0F:05:E3:E8:1B:C7:56:B0:3F:E4:DC:67:57:5A:AD:80:5D:EF:87:6A:2F:BA:D7:26:E4:07:79:41:48`).

Google Play re-signs the app with its own app signing certificate when Play App
Signing is enabled, which is the default for new apps. After the first Play
release, append that certificate's SHA-256 from Play Console (App integrity, App
signing key certificate). Without a matching fingerprint, Android opens the
content links in the browser instead of the app.

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
