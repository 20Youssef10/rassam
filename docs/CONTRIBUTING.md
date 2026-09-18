# Contributing to رسَّام (Rassam)

Thank you for your interest in contributing!

## Ways to Contribute

- Code (editor, collaboration, storage, Arabic/RTL improvements)
- Arabic translations and linguistic review
- Design (icons, empty states, branding assets)
- Documentation
- Bug reports and feature requests
- Testing on different browsers and devices (especially mobile RTL)

## Development Setup

```bash
git clone https://github.com/20Youssef10/rassam.git
cd rassam
yarn
yarn start
```

For the full collaboration stack, also start the room server and storage backend (see Docker Compose or the development scripts).

Requirements:
- Node.js 18+
- Yarn
- Docker (recommended for the full stack)

## Branching & Pull Requests

1. Create a feature branch from `main` (or the current development branch).
2. Use conventional commit messages when possible:
   - `feat: ...`
   - `fix: ...`
   - `docs: ...`
   - `i18n: ...`
   - `rtl: ...`
3. Open a pull request with a clear description of the change and screenshots for UI work.
4. Ensure tests and linting pass.

## Arabic & RTL Contributions

- Prefer clear Modern Standard Arabic.
- Test every UI change in RTL mode.
- When adding new strings, add the Arabic translation in the same PR if possible.
- Font-related PRs should include screenshots of Arabic text rendering.

## Code Style

- Follow the existing TypeScript and React patterns from the upstream codebase.
- Prefer CSS logical properties for any new layout code.
- Keep files focused; large components should be split when they grow too much.

## Testing

```bash
yarn test
yarn test:code          # formatting / lint
```

Add or update tests for new behavior, especially around collaboration, persistence, and RTL text handling.

## License

By contributing you agree that your contributions are licensed under the MIT License (the same license as the project).

## Community

- GitHub Issues & Discussions

We welcome contributors of all experience levels, especially those who care about making great tools for Arabic-speaking users.