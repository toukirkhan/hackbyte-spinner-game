# HackByte 4.0 — GitHub Roulette Spinner 🎡

A **GitHub-themed Roulette Spinner Web App** to pick winners for exclusive GitHub Copilot swag at HackByte 4.0.

The host collects GitHub usernames from hackathon participants and spins the wheel to randomly select one winner at a time. Each winner is revealed with a celebration effect, automatically removed from the wheel, and saved to a local file so there are no repeat winners.

---

## 🚀 How to Run

**Prerequisites:** Python 3 (no extra packages required — uses stdlib only)

```bash
python server.py
```

Then open your browser to: **http://localhost:8000**

That's it! No build step, no npm, no dependencies.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Participant Management** | Add GitHub usernames via the input field; each participant is shown with their live GitHub avatar |
| **Remove Participants** | Click the × button to remove a participant before spinning |
| **Spinning Wheel** | Animated HTML5 Canvas roulette wheel with easing (fast start, smooth stop) |
| **Winner Reveal** | Modal with winner's GitHub avatar, username, and a confetti celebration effect |
| **No Repeat Winners** | Winner is automatically removed from the wheel after each spin |
| **Winners List** | Side panel showing all past winners with their avatars |
| **Data Persistence** | Participants and winners are saved to `data/participants.json` and `data/winners.json` via the Python backend |
| **Export Winners** | "Export Winners (JSON)" button downloads the winners list as a JSON file |
| **GitHub Dark Theme** | Polished UI inspired by GitHub's dark mode (`#0d1117` background, green accents) |

---

## 🔁 Spin Flow

1. Enter a GitHub username → click **Add** (or press Enter)
2. The participant appears on the wheel with their GitHub avatar
3. Click **Spin!** → the wheel animates and lands on a random winner
4. The winner is revealed in a modal with confetti 🎉
5. Click **Next Spin →** to dismiss and continue
6. Winner is removed from the wheel and shown in the Winners panel
7. Repeat until all swags are given out!

---

## 📁 Project Structure

```
hackbyte-spinner-game/
├── index.html              ← Single-page app
├── style.css               ← GitHub dark-mode styling
├── app.js                  ← Canvas wheel + game logic
├── server.py               ← Python HTTP server + REST API
├── data/
│   ├── participants.json   ← Auto-created; current participants
│   └── winners.json        ← Auto-created; all-time winners
└── README.md
```

---

## 🛠️ API Endpoints (served by `server.py`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/participants` | List current participants |
| `POST` | `/participants` | Add a participant `{ "username": "..." }` |
| `DELETE` | `/participants/<username>` | Remove a participant |
| `GET` | `/winners` | List all winners |
| `POST` | `/winners` | Record a winner `{ "username": "..." }` |

---

Built with ❤️ for **HackByte 4.0** · Powered by GitHub Copilot 🤖