# Cut Tracker

A personal logbook for a weight cut from 82 kg to 78 kg (3–13 Nov 2026) and the training that follows. It's built to be used on an iPhone from the Home Screen.

**App:** https://llqmnnhkm.github.io/cut-tracker/

## Install on iPhone

1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the Home Screen and log from there. Logs made in Safari don't carry over to the installed app.

## Where the data lives

Logs, walks and runs (including routes) stay in the browser storage on the phone. There is no server, account, or analytics, and nothing is committed to this repo. Use **Settings → Export backup** to keep a copy, because a lost phone means lost logs otherwise.

## What's in it

- **Home:** a feed of the day's session and any walks or runs, this week's activity strip, and the day's stats.
- **Record:** track a walk or run with GPS (time, distance, average and current pace, route), pause and finish, or add one by hand for a treadmill. Keep the app open on screen while recording; iPhone stops GPS for web apps when the screen locks.
- **Log:** morning weight, steps, water, meals (with kcal ranges for estimates), and workout done.
- **Workout:** the day's exercises as a checklist, with a rest timer.
- **Progress:** logged weight and 5-day trend against the checkpoints.
- **Settings** (gear, top right): backup, rest day, and nutrition targets.
- **Check-in:** pain, fatigue, and dizziness rules that adjust the day when ticked.

## Lock screen alerts

The Workout tab's *Every 5 minutes* session can alert you with the phone locked. A web app can't schedule its own alerts on iPhone, so a small Cloudflare Worker in [push-server/](push-server) sends a web push notification at each round. It needs iOS 16.4 or later and the Home Screen app.

To turn it on (free Cloudflare plan):

1. Sign up at dash.cloudflare.com, open **Workers & Pages** once (this creates your workers.dev address), and copy your **Account ID**.
2. Create an API token from the **Edit Cloudflare Workers** template.
3. In this repo, **Settings → Secrets and variables → Actions**, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Push to `main` or rerun the deploy workflow. It deploys the Worker and builds the app pointing at it.

The Worker makes and keeps its own push keys. It stores only each phone's push address and the times still to send, and deletes them when a session ends. Without the secrets the app builds as before and the session just beeps while open.

## Safety rules

The app never suggests water restriction, saunas, sweat suits, laxatives, diuretics, or eating below the day's target. Going over a target doesn't create a deficit to make up, and being above a checkpoint doesn't produce advice to cut harder. This is a personal tool, not medical advice.

## Development

```sh
npm install
npm run dev     # local server
npm test        # plan and safety rules
npm run build   # type-check and build
```

Built with Vite, TypeScript, and Preact. The plan's numbers are in [src/plan.ts](src/plan.ts), and the rules that apply them are in [src/rules.ts](src/rules.ts). Pushing to `main` runs the tests and deploys to GitHub Pages.
