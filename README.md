# date-wordle

Single-round Wordle where anyone picks the secret word and sends the link. Whoever gets the link has to solve it. A small lock in the corner of the play page lets anyone with a passcode reveal that puzzle's word.

Built by [@chatpataprani](https://github.com/chatpataprani).

## How it works

- `/` — type a word, get a shareable link back
- `/play/:id` — the person you send the link to solves it, Wordle-style (6 tries, on-screen + physical keyboard)
- 🔒 bottom-right corner of the play page — tap it, type a passcode, it reveals that page's word inline. No separate panel, no login page.

Everything lives in one file, `server.js`. No `views/`, no `public/`, no template engine — all HTML/CSS/JS for every page is inline template strings served with `res.send()`. Word storage is a local `games.json` file, created automatically on first run — no database setup.

## Setup

```bash
npm install
npm start
```

Runs on `http://localhost:3000` (or `$PORT`).

## Config — do this before deploying anywhere public

In `server.js`, `ADMIN_KEYS` is the list of valid reveal passcodes (`ADMIN_KEY_1`, `ADMIN_KEY_2` env vars by default — add more entries in the array for more passcodes). **Change the default values before deploying.**

Example (Render/VPS env vars):

```
ADMIN_KEY_1=your-real-passcode
ADMIN_KEY_2=second-passcode
```

## Rules

- Secret word: single word, A-Z only, 3–12 letters, no spaces.
- 6 guess attempts, standard Wordle correct/present/absent logic (duplicate letters handled correctly).
- Word is only revealed to the player on a win or after attempts run out — the server checks guesses, never ships the answer up front.

## Known limitation

This isn't a security-hardened app — it's a fun link to send someone. The word isn't encrypted at rest in `games.json`, and the admin passcode is the only real gate. Don't put anything sensitive in it.

## Deploy

Same as any Node app on Render: connect the repo, no build command needed, start command `npm start`.
