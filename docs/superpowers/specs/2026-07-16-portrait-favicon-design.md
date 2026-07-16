# Portrait favicon design

## Goal

Turn the supplied pencil portrait into a distinctive favicon for zhuzhenfang.com that remains readable at browser-tab sizes.

## Approved direction

- Use a circular, dark background with a simplified light portrait mark.
- Preserve the source portrait's tilted head, hair shape, face contour, and eye emphasis.
- Remove paper, clothing, photographic texture, and other details that become noise at 16–32 px.
- Use no text or initials inside the mark.
- Favor strong contrast, clean edges, and a restrained academic/personal-brand character.

## Deliverables

- A large square PNG master for review.
- A multi-size favicon containing 16, 32, 48, and 64 px variants after approval.
- Optional 180 px Apple touch icon so bookmarks and mobile shortcuts remain sharp.

## Integration and verification

- Keep the current website unchanged until the user approves the generated preview.
- After approval, replace `static/assets/favicon.ico`, add the touch icon, and update `index.html` only if needed.
- Verify the icon locally at both 16 px and 32 px, then confirm the deployed HTTPS site serves the new asset.
