# <img width="67" height="62" alt="tumbleweed" src="https://github.com/user-attachments/assets/4e220a8a-a6b5-4b98-8296-3924089a7130" />  Tumbleweed


A free, open-source shift scheduling tool that uses linear programming to generate optimal assignments — entirely in your browser. Try it at [gor84.com/tumbleweed](https://gor84.com/tumbleweed).

## Why This Exists

Small restaurant and hospitality teams deal with shift scheduling every week. It's tedious, error-prone, and most tools that solve it are either expensive or overkill. Tumbleweed takes a different approach: it runs a real LP (linear programming) optimizer directly in the browser using WebAssembly, so there's no server, no signup, and no cost.

This repo is the free, open-source core of a larger private platform (Tumbleweed Platform - a private repo) that adds collaboration, staff self-service, and team management on top. The core is kept open because the scheduling engine and manager UI should be accessible to anyone — especially small teams that just need the problem solved.

## How It Works

The optimizer is powered by [HiGHS](https://highs.dev/) compiled to WebAssembly via `highs.js`. You define your staff, posts (stations), and shift hours — the solver finds an optimal assignment in milliseconds. No backend round-trips, no waiting. Linear programming turns out to be remarkably effective for this class of problem, and fast enough to run client-side even on modest hardware.

## Tech Stack

| Layer | Stack |
|-------|-------|
| UI | React 18, TypeScript, Vite |
| State | Recoil |
| Styling | Tailwind CSS, shadcn/ui |
| Optimizer | HiGHS.js (WebAssembly) |
| Testing | Playwright, Jest |

## Getting Started

```bash
npm install
npm run dev       # localhost:5273
npm test          # Jest unit tests
npm run test:e2e  # Playwright E2E (headless)
```

## License

Open source. See [LICENSE](LICENSE) for details.
