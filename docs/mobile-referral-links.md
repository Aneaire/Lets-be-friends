# Mobile referral links

The mobile app opens referral links in two ways:

1. Custom scheme: `letsbefriends://referral-invite?ref=CODE`
2. HTTPS app links on `https://www.letsbefriends.space/?ref=CODE` (and the
   `/referrals` route). The app redirects the link to `/referral-invite`, saves
   the code, and still requires the member to tap "Add referral code".

## Android

`apps/web/public/.well-known/assetlinks.json` currently lists the local debug
certificate fingerprint, which is the signing key used by `pnpm build:apk`.
When a store or EAS build signs with a different key, replace the fingerprint
with that key's SHA-256. Without the matching fingerprint, Android opens the
link in the browser instead of the app.

Get the fingerprint from the signing keystore:

```bash
keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256
```

## iOS

`app.json` declares `applinks:www.letsbefriends.space` and
`applinks:letsbefriends.space`. Apple also needs an
`apple-app-site-association` file served from the same host with the Apple Team
ID and bundle ID (`TEAMID.com.letsbefriends.mobile`). That value is not stored
in this repository, so add the file when the iOS build credentials exist.
