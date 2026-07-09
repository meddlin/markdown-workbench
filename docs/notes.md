# Dev Notes

### Failing CI builds, package-lock.json out of sync

1. Use the same major Node version as CI: this repo uses Node 24.
2. Run npm update --package-lock-only
--ignore-scripts.
3. Validate with npm ci. 
4. For these recurring optional native package failures, also run:

```bash
npm ci --dry-run --os=linux --cpu=wasm32
```

That reproduced this exact Missing: `@emnapi/...` from lock file error locally. The root cause is
that npm ci is stricter than npm install: it refuses to install when package-lock.json references a
dependency edge but lacks the package record. macOS can miss this with platform-specific optional
packages, while GitHub Actions on Linux catches it.