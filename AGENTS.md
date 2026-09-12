# Website work

## Project context

- This is the static website at https://zhuzhenfang.com, published from `main` through GitHub Pages. Keep the existing stack and visual language for ordinary changes.
- The homepages are `index.html`, `zh/index.html`, and `en/index.html`; update the applicable language variants together.
- Echoes content lives in `echoes/content/*.json`. Edit its generator or template when changing generated structure, then run `scripts/build_echoes.py` with a Python runtime that has Pillow. See `echoes/README.md` for the content format.
- For Echoes behavior or generated-page changes, relevant checks are the generator’s `--check`, `python3 -B -m unittest discover -s tests -p test_echoes.py`, and browser verification of the changed interaction. Use checks appropriate to the scope for other work.

## Completion and publishing

- Complete the requested change and validate its actual effect. Fix failures caused by that change without stopping for repeated approval of ordinary local work.
- An audit or options request ends with findings; it does not authorize implementing the recommendations. Honor instructions to collect changes before publishing.
- When publishing is authorized for the current scope, continue through commit, push, and verification that the intended result is live. A local edit or successful push alone is not proof of deployment.
- Check for existing uncommitted work before staging. Include only the authorized changes; preserve unrelated work and report it as still local.
- When retiring a page, check homepage variants, other internal links, and the sitemap. After an authorized deployment, verify both the old entry points and the old URL.
- End with a concise, accurate status: what is live, what remains local, and anything unfinished. State when nothing remains in one of those categories; do not equate a pushed HEAD with a clean working tree.

Global recoverable-deletion rules continue to apply. Skills support the task and do not expand its scope or permission to publish.
