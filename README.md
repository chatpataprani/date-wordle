# DATE WORDLE 🎯

A shareable Wordle-style game where you create a puzzle with your own secret word, send the link, and let someone else try to solve it.

Built by **@chatpataprani**.

📸 Instagram: [@chatpataprani](https://www.instagram.com/chatpataprani/)

## ✨ Features

- 🔗 Create a custom puzzle and share it with a unique link
- 🧩 Wordle-style gameplay with visual feedback
- 🎮 Solo mode
- ⚡ Multiple difficulty modes: Normal, Hard, and Chill
- 💡 Optional hints
- ⏱ Optional speed timer
- 😂 Optional reactions
- 📊 Result history with guesses and letters used
- 📤 Share results with a generated result card
- 🇺🇸 **US, RANKED** — a separate multiplayer-style game available at `/ranked`
- 🔐 Private creator/admin controls for managing a puzzle

## 🎮 Games

### DATE WORDLE

Create a puzzle, choose your settings, and send the generated link to someone. They try to discover the secret word within the available attempts.

### US, RANKED

A separate game mode available at:

`/ranked`

It does not replace or modify the main DATE WORDLE experience.

## 🛠️ Tech Stack

- **Node.js**
- **Express**
- **HTML / CSS / JavaScript**
- **Sharp** for generated result-card PNGs
- **JSON file storage** for game data

The project is intentionally lightweight. The main application logic lives in `server.js`, with no template engine or separate frontend framework.

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/chatpataprani/date-wordle.git
cd date-wordle
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

The app runs on:

`http://localhost:3000`

or the port provided through the `PORT` environment variable.

## ⚙️ Environment Variables

For a public deployment, configure the required admin password through an environment variable:

```env
ADMIN_PASSWORD=your-secure-password
```

**Do not hard-code your real password in the source code or commit it to GitHub.**

## 📋 Word Rules

- Secret words use A–Z characters.
- Words must be between 3 and 12 letters.
- Guess feedback follows standard Wordle-style correct/present/absent logic.
- Duplicate letters are handled by the game logic.
- The secret word is not sent to normal players before they finish the puzzle.

## 📤 Result Sharing

After completing a game, players can share their result. The app generates a PNG result card containing the relevant result information without exposing the secret word.

The result includes information such as:

- Win/loss status
- Number of attempts
- Hint usage
- Guessed words
- Letters used
- Wordle-style result grid
- Game link

## ☁️ Deployment

The project can be deployed as a Node.js web service on platforms such as Render.

Typical settings:

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`

Set your environment variables in the hosting platform before deploying.

## ⚠️ Storage Note

Game data is stored in `games.json`. This keeps the project simple and easy to run, but it is not a replacement for a persistent production database. Hosting environments with ephemeral filesystems may lose locally stored game data after certain restarts or redeployments.

## 🔒 Security Note

This is designed as a fun sharing game rather than a security-hardened production system. Do not use it to store sensitive information or confidential data.

## 📱 Creator

Made by **@chatpataprani**

- Instagram: [@chatpataprani](https://www.instagram.com/chatpataprani/)
- GitHub: [@chatpataprani](https://github.com/chatpataprani)

---

⭐ If you like the project, consider starring the repository on GitHub.
