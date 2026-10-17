# ZTM Desktop App

# Code Style

- Always use Tailwind for styling

# Testing

- Install dependencies: `npm ci`
- Type-check: `npx tsc --noEmit`
- Browser tests: `npm run test:browser`
- Academy initialization tests: `node tests/academy-init.test.mjs`
- Rust tests: `cd src-tauri && cargo test`
- Rust formatting: `cd src-tauri && cargo fmt --check`
- Rust linting: `cd src-tauri && cargo clippy`

