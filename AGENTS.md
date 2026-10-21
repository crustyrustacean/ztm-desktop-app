# ZTM Desktop App

# Code Style

- Always use Tailwind for styling

# Testing

- Full test suite: `npm test`
- Browser tests: `npm run test:browser`
- Academy initialization tests only: `node --test tests/academy-init.test.mjs`
- Install dependencies: `npm ci`
- Type-check: `npx tsc --noEmit`
- Rust tests: `cd src-tauri && cargo test`
- Rust formatting: `cd src-tauri && cargo fmt --check`
- Rust linting: `cd src-tauri && cargo clippy`

