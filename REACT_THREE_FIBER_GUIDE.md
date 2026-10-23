# 🚀 React Three Fiber (R3F) Beginner's Guide

A quick, practical guide to help you understand how 3D works in this project and build your foundation in **React Three Fiber** and **Three.js**.

---

## 1. The Core Mental Model

In standard React / Web development:
* You write JSX elements like `<div>`, `<p>`, `<button>`.
* You style them with **CSS**.

In **React Three Fiber (R3F)**:
* You work inside a `<Canvas>` (the WebGL window into the 3D world).
* Instead of `<div>`, you organize objects with `<group>`.
* Instead of styling with CSS, a visual 3D object is a `<mesh>`, which is always made of **two things**:
  1. **Geometry** = The 3D wireframe / shape (sphere, box, cylinder).
  2. **Material** = The skin / paint (color, shininess, roughness, reaction to lights).

```jsx
// A red clay ball in R3F:
<mesh position={[0, 1, 0]}>
  <sphereGeometry args={[0.5, 32, 32]} />            {/* Shape */}
  <meshStandardMaterial color="#ef4444" roughness={0.3} />  {/* Skin */}
</mesh>
```

---

## 2. The 3D Coordinate System (`[X, Y, Z]`)

Every position in 3D uses an array of 3 numbers: `[X, Y, Z]`

| Axis | Direction | Description | Example in this app |
| :--- | :--- | :--- | :--- |
| **X** | Left / Right | Horizontal runway | Queue line extends left along negative X (`-2.3`, `-3.65`...) |
| **Y** | Down / Up | Height above ground | `0` is floor; head is at `Y = 0.95`; character bobs on Y |
| **Z** | In / Out | Depth (near/far from camera) | S-curve runway waves slightly along Z |

---

## 3. Key Building Blocks in This Project

### A. `<group>` (The `<div>` of 3D)
An invisible container. When you move or animate a `<group>`, everything inside moves together.
* **In our project:** We wrap each miniature person in a `<group>`, and multiple persons in a party `<group>`.

### B. Common Geometries (Shapes)
| Geometry | What we built with it |
| :--- | :--- |
| `<sphereGeometry args={[radius, widthSegments, heightSegments]} />` | Character heads and hair caps |
| `<cylinderGeometry args={[radiusTop, radiusBottom, height, segments]} />` | Torsos and legs |
| `<boxGeometry args={[width, height, depth]} />` | Entrance building & roof canopy |
| `<planeGeometry args={[width, height]} />` | Ground floor and runway line |
| `<ringGeometry args={[innerRadius, outerRadius, segments]} />` | Glowing base circle under user |

### C. Materials (Appearance)
* **`<meshStandardMaterial>`** (Realistic): Responds to scene lights and casts shadows.
  * `color`: Hex color (`"#6366f1"`).
  * `roughness`: `0` is like shiny plastic or mirror; `1` is chalky/matte clay.
* **`<meshBasicMaterial>`** (Glow / Unlit): Ignores scene lighting and always shines at full brightness. Perfect for glowing rings and neon UI lines.

---

## 4. Animating in 3D: `useFrame` vs React State

> ⚠️ **Golden Rule:** Never call `useState` setters (`setState`) inside a 60fps loop. It will cause React to re-render 60 times a second and lag your browser.

Instead, use **`useRef`** and the **`useFrame`** hook provided by `@react-three/fiber`:

```jsx
const groupRef = useRef();

// This runs on EVERY frame (~60 times per second) before rendering:
useFrame((state, delta) => {
  // state.clock.elapsedTime = continuous running seconds (1.2, 1.3, 1.4...)
  // Math.sin creates a smooth repeating bounce between -1 and +1
  if (groupRef.current) {
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.05;
  }
});

return <group ref={groupRef}> ... </group>;
```

### What is Phase Shift?
In `SinglePartyMember3D`, we wrote:
```javascript
Math.sin(state.clock.elapsedTime * 2.5 + memberIndex * 0.9)
```
Adding `memberIndex * 0.9` offsets the starting point of the sine wave so each person breathes at a slightly different time instead of bobbing like synchronized robots.

---

## 5. Camera & Orbit Controls

* **Camera Position (`camera={{ position: [1, 4.5, 8.5] }}`)**: Where the spectator's eyes are standing in 3D space.
* **Target (`target={[-1, 0.8, 0]}` on `OrbitControls`)**: The point the camera is looking directly at.
* **Smooth Interpolation (`lerp`)**:
  ```javascript
  // Linearly interpolates position towards target smoothly every frame:
  state.camera.position.lerp(targetPosition, delta * 3);
  ```
* **Fixed vs Free Orbit**:
  * Free 3D: `<OrbitControls enabled={true} />` (drag to rotate, pinch to zoom).
  * Fixed View: `<OrbitControls enabled={false} />` (locks user input while `CameraRig` smoothly slides the camera back to default).

---

## 6. Projecting 2D UI into 3D: `<Html>` from Drei

`@react-three/drei` provides `<Html>`, which lets you render standard HTML, CSS, and React buttons **inside** the 3D scene:

```jsx
<Html position={[0, 1.55, 0]} center distanceFactor={10}>
  <div className="r3f-html-bubble">
    <span>📍 You are here</span>
  </div>
</Html>
```
* **`position={[0, 1.55, 0]}`**: Locks the bubble above the character's head.
* **`center`**: Automatically centers the HTML element over that 3D point.
* **`distanceFactor`**: Shrinks the text as the camera zooms out, preserving 3D perspective.

---

## 7. Common Pitfalls to Avoid

1. **Tag Casing (Capital vs Lowercase):**
   * Lowercase tags (`<mesh>`, `<group>`, `<ambientLight>`) are built-in Three.js objects.
   * Your custom React components **MUST** be PascalCase (`<CameraRig />`, `<MiniaturePerson3D />`), otherwise React treats them as unknown HTML elements and won't run them.
2. **Duplicate Controls:**
   * Never place two `<OrbitControls>` inside the same `<Canvas>`, or they will fight each other for mouse events.
3. **Shadows require both sides:**
   * Ground needs `receiveShadow`.
   * Object needs `castShadow`.
   * Light needs `castShadow`.
   * `<Canvas>` needs the `shadows` prop.

---

## 8. Dynamic Layouts: Circled vs Inline Single-File

When arranging multiple 3D models dynamically:
1. **Circled / Cluster Formation:** Party members are arranged in a ring or polygon around their ticket slot center using polar coordinates (`cos(angle) * r`, `sin(angle) * r`). Keeps the queue compact.
2. **Inline / Single-File Formation:** Party members stand one behind the other along the queue runway (`[-i * spacing, 0, 0]`). Each subsequent party is offset by the cumulative length of all preceding members, visibly stretching the line out longer.
3. **Dynamic Runway Track:** Calculating the cumulative span with `useMemo` allows the illuminated floor runway and ground plane to expand dynamically to fit the line length.

---

## 9. Quick Cheat Sheet

```
Canvas                 -> Root 3D container
├── Lighting           -> <ambientLight />, <directionalLight />
├── Camera Controls    -> <OrbitControls />
├── Meshes             -> <mesh> = <Geometry> + <Material>
├── Animation Loop     -> useFrame((state, delta) => ...)
└── 3D HTML Overlays   -> <Html position={[x, y, z]}>
```
