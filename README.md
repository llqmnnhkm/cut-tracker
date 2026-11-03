# Cut Tracker

A personal logbook for a weight cut from 82 kg to 78 kg (3–13 Nov 2026) and the training that follows. It's built to be used on an iPhone from the Home Screen.

**App:** https://llqmnnhkm.github.io/cut-tracker/

## Install on iPhone

1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the Home Screen and log from there. Logs made in Safari don't carry over to the installed app.

## Where the data lives

Logs stay in the browser storage on the phone. There is no server, account, or analytics, and nothing is committed to this repo. Use **Settings → Export backup** to keep a copy, because a lost phone means lost logs otherwise.

## What's in it

- **Today:** the day's session, step goal, nutrition targets, and progress.
- **Log:** morning weight, steps, water, meals (with kcal ranges for estimates), and workout done.
- **Workout:** the day's exercises as a checklist, with a rest timer.
- **Weight:** logged weight and 5-day trend against the checkpoints.
- **Check-in:** pain, fatigue, and dizziness rules that adjust the day when ticked.

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
