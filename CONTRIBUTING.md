# Contributing

Thanks for taking a look at ShotBank.

## Local Setup

```bash
npm install
npm run lint
npm run build
```

For the full desktop workflow:

```bash
npm run electron
```

## Project Direction

ShotBank should stay local-first:

- no required hosted database
- no required account
- no required cloud sync
- no screenshot upload in the core flow

Optional integrations are welcome when they do not make the local workflow worse.

## Pull Requests

Before opening a pull request, please run:

```bash
npm run lint
npm run build
```

Keep changes focused. UI changes should preserve the main capture workflow:

1. start a movie session
2. capture with a shortcut
3. review the screenshot
4. add notes
5. keep normal PNG files in the movie folder
