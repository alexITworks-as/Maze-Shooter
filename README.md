# ⚔ Maze Shooter 3D

A browser-based 3D first-person shooter where you navigate through a procedurally generated maze, eliminate enemies, and complete level objectives.

## Preview

[Maze Shooter 3D](http://github.com/alexITworks-as/Maze-Shooter/blob/main/a.png)

> Open `index.html` in your browser — no build step or server required.

---

## Features

- 3D rendering powered by **Three.js** (r128)
- Procedural maze generation (recursive backtracker algorithm)
- 3 difficulty levels with varying fog settings, maze size, and enemy count
- Quest system — each level has its own set of objectives
- Bosses: Lieutenant (level 2) and Boss (level 3)
- Real-time minimap
- HP pickups
- Procedural wall and floor textures
- Sound effects via Web Audio API (no external audio files)
- Responsive window resizing

---

## Levels

| Level | Difficulty | Maze | Enemies | Player HP | Visibility |
|-------|------------|------|---------|-----------|------------|
| 1 | Easy | 15×15 | 6 | 150 | Bright |
| 2 | Medium | 19×19 | 11 + Lieutenant | 100 | Fog |
| 3 | Hard | 23×23 | 17 + Boss | 75 | Darkness |

---

## Controls

| Key / Action | Function |
|--------------|----------|
| `W A S D` or Arrow keys | Move |
| Mouse | Look around |
| `LMB` or `Space` / `F` | Shoot |
| `R` | Reload |
| `Shift` | Sprint |

---

## Getting Started

1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-username/maze-shooter.git
   cd maze-shooter
   ```
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge).
3. Select a level and click to capture the mouse pointer.

> An internet connection is only needed once — to load Three.js from CDN. After that the game runs fully offline.

---

## Project Structure

```
maze-shooter/
├── index.html   — markup, HUD, level overlays
├── style.css    — UI styles
├── game.js      — all game logic (Three.js, AI, physics, audio)
└── README.md    — this file
```

---

## Tech Stack

- **Three.js r128** — 3D rendering (loaded via CDN)
- **Web Audio API** — procedural sound effects
- **Canvas API** — texture generation and minimap
- Plain HTML / CSS / JavaScript — no frameworks or bundlers

---

## License & Terms of Use

**License: MIT**

You are free to:
- Use this project for any purpose (personal, educational, or commercial)
- Copy, distribute, and modify the code
- Include the project (or parts of it) in your own work

Under the following conditions:
- Preserve attribution (link to the original repository or credit the author)
- Include the license text when redistributing

You may **not**:
- Remove license headers or copyright notices
- Claim authorship of the original, unmodified project

> This project is provided "AS IS", without warranty of any kind. The author is not liable for any consequences arising from its use.

---

## Contributing

Pull requests are welcome! If you'd like to propose an improvement:

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please open an Issue to discuss significant changes before submitting a PR.

---

## Author

Made with love for browser games. If you enjoyed it — leave a ⭐ on GitHub!
