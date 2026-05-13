# Contributing to Pueblo Food Access Map

Thanks for your interest in improving the Pueblo Food Access Map. This is a
community project built for [Pueblo Food Project](https://pueblofoodproject.org)
and used by Pueblo County residents to find food resources.

## How to contribute

### Reporting a problem

Open an issue describing the problem. Include the steps to reproduce, what
you expected to happen, what actually happened, and the browser + device
you were using. (Issue templates are a planned addition; for now, free-form
issues are fine.)

### Suggesting an improvement

Open an issue describing the problem the change would solve, who benefits,
and any constraints we should know about (data licensing, accessibility,
performance).

### Submitting a code change

1. Fork the repository and create a feature branch from `main`.
2. Make your change with focused commits — see [Commit messages](#commit-messages).
3. Run `npm run lint`, `npm run typecheck`, and `npm run build` locally
   before opening a pull request.
4. Open a pull request against `main`. CI runs lint, typecheck, and build
   on every PR and must pass before merge — `main` is a protected branch
   and requires the CI status check.

## Development setup

Requirements: Node.js 20 (LTS) or later and npm.

```bash
git clone https://github.com/kr8vka0z/pueblo-food-map.git
cd pueblo-food-map
npm install
npm run dev
```

The dev server runs at <http://localhost:3000>.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint check on the whole project |
| `npm run typecheck` | TypeScript check with no emit (`tsc --noEmit`) |

Test runner and formatter scripts will be added as the project grows; this
list reflects what's installed today.

## Commit messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
convention. Format:

```
<type>(<scope>): <subject>

<body>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`,
`build`, `ci`, `style`.

Example:

```
feat(map): show user location as a blue dot

Geolocation is requested on mount. When granted, the user's position is
rendered on the map with a permanent "You are here" tooltip and the map
flies to the location the first time it arrives.
```

Conventional Commits is currently a convention, not an enforced check —
please follow it, but the CI won't reject a PR for a non-conforming
commit message yet.

## Adding venue data

The map ships with static venue data in `src/data/venues.ts`. To add or
correct a venue, edit that file directly and submit a PR. Each venue must
include:

- A stable `id`
- `name`, `category`, `address`
- Geocoded `lat` and `lng`
- `source` (where the data came from)
- `last_verified` (ISO date you confirmed the entry is accurate)

See `src/types/venue.ts` for the full schema.

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](LICENSE).
