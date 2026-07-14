---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Output Requirements

**MANDATORY**: The entry HTML file MUST be named `index.html`. This is a strict requirement for all generated frontend projects to ensure compatibility with standard web hosting and deployment workflows.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.



## Interaction & Rich Media Protocols

- **Interactive Components**: Every hosted page MUST feel alive and interactive. Use Vanilla JS to build tab switchers, search filter inputs, expandable FAQs/accordions, modal details popups, or hover-revealed details cards.
- **Rich Visuals & Real Images**: DO NOT leave image placeholders or use blank spaces. Always embed high-quality, relevant images using Unsplash CDN links (e.g., \`https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=800&q=80\`). Choose appropriate Unsplash photo IDs matching the subject matter (e.g., specific ID for historical buildings, food, maps, etc.) to ensure the interface is visually spectacular.
- **Micro-Animations**: Add entry animations (staggered transitions using \`animation-delay\` or \`@keyframes fade-in-up\`) so the UI loads elegantly. Use smooth scroll behaviors and reactive hover transitions on buttons and interactive elements.

## Premium Design Code Recipes

Use the following modern CSS patterns to make interfaces look premium and custom-coded:

### 1. Frosted Glassmorphism (Dark / Light)
Use nested semi-transparent borders and backdrops for elegant structural depth:
```css
.card-glass {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.25);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
              border-color 0.4s ease, 
              background 0.4s ease;
}
.card-glass:hover {
  transform: translateY(-8px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}
```

### 2. Aura Ambient Backgrounds (Modern Dark Mode)
Never use flat black or white backgrounds. Use subtle, non-distracting gradient meshes:
```css
body {
  background-color: #0b0a0e;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(255, 87, 34, 0.06) 0%, transparent 45%),
    radial-gradient(circle at 90% 80%, rgba(0, 255, 204, 0.05) 0%, transparent 50%);
  color: #e5e3ea;
  min-height: 100vh;
}
```

### 3. Editorial Typography Pairing
Always load matching display and body font pairings.
- **Playfair Display** (Serif Heading) + **Lora** (Serif Body) for editorial print or travel guides.
- **Outfit** (Sans Heading) + **Plus Jakarta Sans** (Sans Body) for tech or product layout grids.
- **Cabinet Grotesk** + **JetBrains Mono** for clean dashboard metrics.
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
```

### 4. Interactive Accordions (CSS & JS)
Make list items expand smoothly using modern grid height tricks:
```html
<div class="accordion">
  <button class="accordion-trigger" onclick="this.nextElementSibling.classList.toggle('open')">Show details</button>
  <div class="accordion-content">
    <div class="content-wrapper">Inner details text here...</div>
  </div>
</div>
<style>
  .accordion-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
    overflow: hidden;
  }
  .accordion-content.open {
    grid-template-rows: 1fr;
  }
  .content-wrapper {
    min-height: 0;
  }
</style>
```

Ensure every design element has smooth transitions, uses custom scrollbars, and includes clean spacing. Do not resort to simple black borders on white containers.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
