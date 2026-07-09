import { defineTheme } from './factory.js';

export default defineTheme({
  "id": "papertrail",
  "label": "Papertrail",
  "description": "Warmer editorial palette for long reviews.",
  "swatches": {
    "dark": [
      "#1a1510",
      "#302a23",
      "#f1b464",
      "#5ca2db"
    ],
    "light": [
      "#fefcf7",
      "#e0dace",
      "#845000",
      "#065da0"
    ]
  },
  "modes": {
    "dark": {
      "colorScheme": "dark",
      "tokens": {
        "bg": "#110c08",
        "panel": "#1a1510",
        "panel-2": "#241e18",
        "panel-3": "#302a23",
        "toolbar": "#26211a",
        "line": "#4b443c",
        "line-soft": "#38322b",
        "text": "#efeae2",
        "muted": "#b9b3aa",
        "faint": "#9a948c",
        "accent": "#5ca2db",
        "accent-soft": "#1c3346",
        "success": "#7fc48e",
        "success-soft": "#1c3422",
        "warning": "#f1b464",
        "warning-soft": "#453116",
        "danger": "#f07f77",
        "danger-soft": "#482522",
        "overlay": "#020202a3",
        "overlay-soft": "#0202027a",
        "shadow-strong": "#0000007a",
        "shadow-medium": "#00000057",
        "shadow-soft": "#00000038"
      },
      "branchColors": [
        "#5ca2db",
        "#7fc48e",
        "#f1b464",
        "#9a93b1",
        "#66acc5",
        "#79bf9a",
        "#9195b7",
        "#f08674",
        "#9baaa9",
        "#8bae9d"
      ]
    },
    "light": {
      "colorScheme": "light",
      "tokens": {
        "bg": "#f7f3eb",
        "panel": "#fefcf7",
        "panel-2": "#eee9df",
        "panel-3": "#e0dace",
        "toolbar": "#f0ece4",
        "line": "#b9b4a8",
        "line-soft": "#d2cdc3",
        "text": "#1a2028",
        "muted": "#424851",
        "faint": "#59616a",
        "accent": "#065da0",
        "accent-soft": "#c6e1ff",
        "success": "#07602b",
        "success-soft": "#ccebd1",
        "warning": "#845000",
        "warning-soft": "#fbe0bf",
        "danger": "#a83634",
        "danger-soft": "#ffdad6",
        "overlay": "#020202a3",
        "overlay-soft": "#0202027a",
        "shadow-strong": "#0000007a",
        "shadow-medium": "#00000057",
        "shadow-soft": "#00000038"
      },
      "branchColors": [
        "#065da0",
        "#07602b",
        "#845000",
        "#4a4d73",
        "#065e7f",
        "#07603e",
        "#404f79",
        "#a33a2d",
        "#3b585d",
        "#24584b"
      ]
    }
  }
});
