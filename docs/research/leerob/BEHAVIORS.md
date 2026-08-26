# Homepage Behaviors

- Interaction model: mostly static editorial content.
- Navigation: compact in-page text links use native anchor scrolling.
- Language: the existing English/Chinese switch remains a plain text control and stores the preference locally.
- Rows: links fade surrounding sibling rows on precise pointer devices, while the hovered row stays fully opaque.
- Visual: the portrait is sticky on desktop and absent below 1100px.
- Motion: color and opacity transitions use 240-300ms easing. Reduced-motion preferences collapse transitions to nearly zero.
- Responsive rules:
  - 1100px and above: reading column plus sticky visual column.
  - Below 1100px: single reading column.
  - 639px and below: 20px horizontal page padding, one-column lists, stacked row metadata.
