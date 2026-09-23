# Plan: Add Animations to Landing Page

## Reference Analysis
- Coinpay uses: text scramble/reveal, floating particles, scroll-triggered fades, staggered entrances, hover effects
- Anime.js v4 provides: splitText, scrambleText, animate(), stagger(), onScroll events

## Animations to Add

### 1. Hero Text Scramble Effect
- Headline characters scramble (random chars) then reveal the actual text
- Uses custom JS scramble + anime.js for timing

### 2. Floating Particles Background
- Small orange/white dots floating upward in the hero section
- Pure CSS animation for performance

### 3. Scroll-Triggered Section Reveals
- Each section fades in and slides up when scrolled into view
- Uses anime.js with scroll triggers

### 4. Staggered Service Card Entrance
- Cards appear one by one with a staggered delay
- Scale from 0.9 to 1.0 + fade in

### 5. Card Hover Effects
- Lift up (translateY -8px) + border glow on hover
- Smooth transition

### 6. "As Seen In" Logo Shimmer
- Logos pulse opacity in a wave pattern

### 7. Newsletter Entrance
- Slide up + fade in on scroll

### 8. Nav Link Hover
- Underline animation on hover

## Implementation
- Use anime.js v4 UMD via CDN
- Add animation.js script at bottom of page
- Keep all animations lightweight and performant
