# Name Digital Signature Generator

> 🔗 **Live Site**: https://yashpatil06.github.io/NAME-DIGITAL-SIGNATURE/

A deterministic system that converts typed text into a unique 2D signature by tracing the **physical positions of keyboard keys** and rendering them as a continuous geometric path.

## How it works

- Treat the QWERTY keyboard as a coordinate grid
- Map each letter (A–Z) to a fixed \((x,y)\) position
- Convert typed text into a sequence of points
- Draw one continuous connected **polyline** (straight segments) through those points
- Animate the drawing so the signature “traces itself” as you type
- Export the canvas as a PNG (transparent or solid background)

## Run

- Open `index.html` in any browser (double click it).

## Features

- Live + animated drawing as you type (line draws progressively)
- Straight-line signature (no smoothing/curves)
- Adjustable line color and thickness
- Optional point markers + letter labels
- Background selection: **Transparent (PNG)** / Black / White
- Keyboard overlay while typing (auto-hides after ~1 second)
- Download exports **signature only** (no keyboard/points/labels) via `canvas.toDataURL("image/png")`

<img width="1100" height="420" alt="keyboard-signature-yashpatil" src="https://github.com/user-attachments/assets/9a4edf9a-6ddf-404e-afad-2c9881f77243" />



