import { defineTheme } from './factory.js';

export default defineTheme({
  "id": "graphite",
  "label": "Graphite",
  "description": "Neutral, low-glare professional palette.",
  "swatches": {
    "dark": [
      "#111417",
      "#26292d",
      "#49accf",
      "#83c297"
    ],
    "light": [
      "#fbfcfd",
      "#d6d9de",
      "#00678d",
      "#086034"
    ]
  },
  "modes": {
    "dark": {
      "colorScheme": "dark",
      "tokens": {
        "bg": "#090b0e",
        "panel": "#111417",
        "panel-2": "#1a1d21",
        "panel-3": "#26292d",
        "toolbar": "#1d2023",
        "line": "#3f4347",
        "line-soft": "#2d3134",
        "text": "#e5e8ec",
        "muted": "#adb1b6",
        "faint": "#8f9397",
        "accent": "#49accf",
        "accent-soft": "#15323d",
        "success": "#83c297",
        "success-soft": "#1b3122",
        "warning": "#e1b671",
        "warning-soft": "#3e301b",
        "danger": "#e77f78",
        "danger-soft": "#422422",
        "overlay": "#020202a3",
        "overlay-soft": "#0202027a",
        "shadow-strong": "#0000007a",
        "shadow-medium": "#00000057",
        "shadow-soft": "#00000038"
      },
      "branchColors": [
        "#49accf",
        "#83c297",
        "#e1b671",
        "#8b99aa",
        "#59b2bf",
        "#7abea0",
        "#829caf",
        "#e68777",
        "#89b0a8",
        "#87b09f"
      ]
    },
    "light": {
      "colorScheme": "light",
      "tokens": {
        "bg": "#f1f4f6",
        "panel": "#fbfcfd",
        "panel-2": "#e5e8eb",
        "panel-3": "#d6d9de",
        "toolbar": "#e9ebee",
        "line": "#b0b5b9",
        "line-soft": "#cbced2",
        "text": "#1c2023",
        "muted": "#44484c",
        "faint": "#585d63",
        "accent": "#00678d",
        "accent-soft": "#bce2f1",
        "success": "#086034",
        "success-soft": "#cdead5",
        "warning": "#7f5400",
        "warning-soft": "#f6e2c4",
        "danger": "#a83634",
        "danger-soft": "#ffdad7",
        "overlay": "#020202a3",
        "overlay-soft": "#0202027a",
        "shadow-strong": "#0000007a",
        "shadow-medium": "#00000057",
        "shadow-soft": "#00000038"
      },
      "branchColors": [
        "#00678d",
        "#086034",
        "#7f5400",
        "#475268",
        "#026574",
        "#076142",
        "#3d556d",
        "#a23a2d",
        "#355f52",
        "#245a4b"
      ]
    }
  }
});
