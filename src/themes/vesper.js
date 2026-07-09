import { defineTheme } from './factory.js';

export default defineTheme({
  "id": "vesper",
  "label": "Vesper",
  "description": "Peppermint and orange editor palette adapted from Vesper.",
  "swatches": {
    "dark": [
      "#161616",
      "#282828",
      "#FFC799",
      "#99FFE4"
    ],
    "light": [
      "#fbfbfa",
      "#dedbd6",
      "#8f4f00",
      "#00705d"
    ]
  },
  "modes": {
    "dark": {
      "colorScheme": "dark",
      "tokens": {
        "bg": "#101010",
        "panel": "#161616",
        "panel-2": "#1C1C1C",
        "panel-3": "#232323",
        "toolbar": "#181818",
        "line": "#3a3a3a",
        "line-soft": "#2a2a2a",
        "text": "#FFFFFF",
        "muted": "#B8B8B8",
        "faint": "#909090",
        "accent": "#FFC799",
        "accent-soft": "#3f2c1d",
        "success": "#99FFE4",
        "success-soft": "#183a34",
        "warning": "#FFC799",
        "warning-soft": "#3f2c1d",
        "danger": "#FF8080",
        "danger-soft": "#472323",
        "overlay": "#000000b8",
        "overlay-soft": "#0000008f",
        "shadow-strong": "#00000094",
        "shadow-medium": "#00000073",
        "shadow-soft": "#00000052"
      },
      "branchColors": [
        "#FFC799",
        "#99FFE4",
        "#FF8080",
        "#FF7300",
        "#A0A0A0",
        "#FFCFA8",
        "#7ee8d2",
        "#ff9a9a",
        "#d6b090",
        "#cfcfcf"
      ]
    },
    "light": {
      "colorScheme": "light",
      "tokens": {
        "bg": "#f1efec",
        "panel": "#fbfbfa",
        "panel-2": "#ebe8e3",
        "panel-3": "#dedbd6",
        "toolbar": "#e8e5df",
        "line": "#bcb6ad",
        "line-soft": "#d4cec6",
        "text": "#191817",
        "muted": "#46413b",
        "faint": "#5f574f",
        "accent": "#8f4f00",
        "accent-soft": "#ffe0c3",
        "success": "#00705d",
        "success-soft": "#c6efe5",
        "warning": "#8f4f00",
        "warning-soft": "#ffe0c3",
        "danger": "#b43a3a",
        "danger-soft": "#ffddda",
        "overlay": "#17131061",
        "overlay-soft": "#17131047",
        "shadow-strong": "#1713103d",
        "shadow-medium": "#1713102e",
        "shadow-soft": "#1713101f"
      },
      "branchColors": [
        "#8f4f00",
        "#00705d",
        "#b43a3a",
        "#a84200",
        "#55504a",
        "#9b5a12",
        "#006d64",
        "#a94848",
        "#72523a",
        "#4d5d58"
      ]
    }
  }
});
