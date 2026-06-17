# Security

ShotBank is a local desktop app that captures screenshots and writes files to a user-selected library folder.

Please report security issues privately by opening a GitHub security advisory or contacting the maintainer through the repository owner profile.

## Notes for Contributors

- Do not add secrets to the repository.
- Do not upload screenshots or metadata without explicit user action.
- Keep delete behavior recoverable where possible. The app currently moves movie folders to the Recycle Bin.
- Be careful with file paths. Actions that modify files should stay inside the configured ShotBank library.
