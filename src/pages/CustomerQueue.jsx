import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDoc,
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useParams, Navigate, Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import "./CustomerQueue.css";

// Helper: Deterministic color palette for low-poly 3D characters
function getCharacterPalette(name = "", id = "", memberIndex = 0) {
  const seed = (name + id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + memberIndex * 17;
  
  const hairColors = ["#18181b", "#27272a", "#3f3f46", "#52525b", "#334155", "#475569"];
  const shirtColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#06b6d4"];
  const skinTones = ["#fed7aa", "#fcd34d", "#fde68a", "#ffedd5", "#e2e8f0", "#d4a373"];

  return {
    hairColor: hairColors[seed % hairColors.length],
    shirtColor: shirtColors[(seed * 3) % shirtColors.length],
    skinTone: skinTones[(seed * 7) % skinTones.length],
  };
}

// Calculates [x, y, z] spatial offsets for each party member based on layout mode
function getPartyOffsets(count, layout = "inline") {
  if (count <= 1) return [[0, 0, 0]];

  // Inline layout: all party members line up single-file behind each other along -X runway
  if (layout === "inline") {
    const spacing = 0.75;
    const offsets = [];
    for (let i = 0; i < count; i++) {
      offsets.push([-i * spacing, 0, 0]);
    }
    return offsets;
  }

  // Circled layout: cluster formation
  if (count === 2) return [[0.18, 0, -0.18], [-0.18, 0, 0.18]];
  if (count === 3) return [[0.22, 0, 0], [-0.18, 0, -0.22], [-0.18, 0, 0.22]];
  if (count === 4) return [[0.18, 0, -0.18], [0.18, 0, 0.18], [-0.18, 0, -0.18], [-0.18, 0, 0.18]];

  // For 5+ people: leader in center, companions in a ring around with dynamic radius
  const offsets = [[0, 0, 0]];
  const outerCount = count - 1;
  const radius = outerCount <= 5 ? 0.38 : 0.38 + (outerCount - 5) * 0.055;
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2;
    offsets.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  }
  return offsets;
}

// Individual 3D person mesh with idle breathing animation
function SinglePartyMember3D({ name, id, memberIndex, positionIndex, offset }) {
  const memberGroupRef = useRef();
  const { hairColor, shirtColor, skinTone } = getCharacterPalette(name, id, memberIndex);

  // Smooth idle bobbing animation with desynchronized timing for natural lifelike motion
  useFrame((state) => {
    if (memberGroupRef.current) {
      memberGroupRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 2.5 + positionIndex + memberIndex * 0.9) * 0.04;
    }
  });

  return (
    <group position={offset}>
      <group ref={memberGroupRef}>
        {/* Head */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.4} />
        </mesh>

        {/* Minimalist Hair Cap */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <sphereGeometry args={[0.23, 20, 20]} />
          <meshStandardMaterial color={hairColor} roughness={0.6} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 0.48, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.22, 0.52, 20]} />
          <meshStandardMaterial color={shirtColor} roughness={0.3} />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.07, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
          <meshStandardMaterial color="#27272a" roughness={0.5} />
        </mesh>
        <mesh position={[0.07, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
          <meshStandardMaterial color="#27272a" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// 3D Miniature Person Waiting in Queue (accurately displays every person in the party inputted)
function MiniaturePerson3D({ 
  name, 
  id, 
  partySize, 
  positionIndex, 
  isCurrentUser, 
  layout = "inline",
  posX,
  posZ 
}) {
  // Accurate count of miniature persons based on inputted party size (safeguarded up to 50)
  const count = Math.min(Math.max(Number(partySize) || 1, 1), 50);
  const partyOffsets = getPartyOffsets(count, layout);

  // Calculate 3D position along queue runway
  const x = posX !== undefined ? posX : -(positionIndex * 1.35 + 2.3);
  const z = posZ !== undefined ? posZ : Math.sin(positionIndex * 0.5) * 0.35;

  // Center offset of the group along X for placing the nametag & dialogue bubble
  const centerOffsetX = layout === "inline" ? -((count - 1) * 0.75) / 2 : 0;
  const ringRadius = layout === "inline" ? 0.45 : (count > 1 ? 0.6 + (count > 4 ? (count - 4) * 0.05 : 0) : 0.45);

  return (
    <group position={[x, 0, z]}>
      {/* 3D Miniature Avatars for each party member - exact count as inputted */}
      {partyOffsets.map((offset, idx) => (
        <SinglePartyMember3D
          key={`${id}-member-${idx}`}
          name={name}
          id={id}
          memberIndex={idx}
          positionIndex={positionIndex}
          offset={offset}
        />
      ))}

      {/* Glowing Pedestal Rings for Current User's Party Members */}
      {isCurrentUser && (
        layout === "inline" && count > 1 ? (
          partyOffsets.map((offset, idx) => (
            <mesh key={`pedestal-${idx}`} rotation={[-Math.PI / 2, 0, 0]} position={[offset[0], 0.02, offset[2]]}>
              <ringGeometry args={[0.26, 0.38, 24]} />
              <meshBasicMaterial color="#6366f1" side={THREE.DoubleSide} />
            </mesh>
          ))
        ) : (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[ringRadius * 0.75, ringRadius, 32]} />
            <meshBasicMaterial color="#6366f1" side={THREE.DoubleSide} />
          </mesh>
        )
      )}

      {/* 3D HTML Comic Dialogue Bubble (Centered over the party in line) */}
      {isCurrentUser && (
        <Html position={[centerOffsetX, 2.55, 0]} center distanceFactor={10}>
          <div className="r3f-html-bubble">
            <span>📍 You are here</span>
            <span className="r3f-bubble-sub">
              Position #{positionIndex + 1} • Party of {count}
            </span>
          </div>
        </Html>
      )}

      {/* 3D HTML Name Tag (Centered under the party in line) */}
      <Html position={[centerOffsetX, -0.15, 0]} center distanceFactor={11}>
        <div className="r3f-html-nametag">
          {name} {count > 1 && `(Party of ${count})`}
        </div>
      </Html>
    </group>
  );
}

// Single Person Walking Into the Establishment
function EnteringSingleMember3D({
  name,
  id,
  memberIndex,
  startX,
  startZ,
  isLeader,
  tableNumber,
  partySize,
  onMemberEntered
}) {
  const groupRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const [enteredDoor, setEnteredDoor] = useState(false);
  const [fullyEntered, setFullyEntered] = useState(false);

  const pos = useRef(new THREE.Vector3(startX, 0, startZ));
  const doorTarget = new THREE.Vector3(-1.22, 0, 0);

  const { hairColor, shirtColor, skinTone } = getCharacterPalette(name, id, memberIndex);

  useFrame((state, delta) => {
    if (!groupRef.current || fullyEntered) return;

    if (!enteredDoor) {
      // Steady forward walking pace (preserves distance between queue companions)
      const speed = 1.65;
      pos.current.x += speed * delta;
      // Smoothly steer towards the entrance door along Z
      pos.current.z = THREE.MathUtils.damp(pos.current.z, doorTarget.z, 2.8, delta);

      // Walking leg animation cycle
      const walkCycle = Math.sin(state.clock.elapsedTime * 14 + memberIndex * 2.1);
      if (leftLegRef.current) leftLegRef.current.rotation.x = walkCycle * 0.65;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -walkCycle * 0.65;

      // Vertical bounce while walking
      const bounce = Math.abs(walkCycle) * 0.08;
      groupRef.current.position.set(pos.current.x, bounce, pos.current.z);

      // Face towards +X (towards the establishment)
      groupRef.current.rotation.y = Math.PI / 2;

      // When crossing the door threshold
      if (pos.current.x >= doorTarget.x) {
        setEnteredDoor(true);
      }
    } else {
      // Step inside and fade / shrink into the establishment
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, -0.2, 3.2, delta);
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, -0.25, 3.2, delta);
      groupRef.current.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), delta * 5);

      if (groupRef.current.scale.x < 0.05 && !fullyEntered) {
        setFullyEntered(true);
        groupRef.current.visible = false;
        onMemberEntered?.(memberIndex);
      }
    }
  });

  return (
    <group ref={groupRef} position={[startX, 0, startZ]}>
      <group>
        {/* Head */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.4} />
        </mesh>

        {/* Hair */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <sphereGeometry args={[0.23, 20, 20]} />
          <meshStandardMaterial color={hairColor} roughness={0.6} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 0.48, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.22, 0.52, 20]} />
          <meshStandardMaterial color={shirtColor} roughness={0.3} />
        </mesh>

        {/* Animated Walking Legs */}
        <group ref={leftLegRef} position={[-0.07, 0.24, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
            <meshStandardMaterial color="#27272a" roughness={0.5} />
          </mesh>
        </group>

        <group ref={rightLegRef} position={[0.07, 0.24, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
            <meshStandardMaterial color="#27272a" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Celebrating 3D HTML Comic Bubble (anchored above the front leader) */}
      {isLeader && !enteredDoor && (
        <Html position={[0, 1.55, 0]} center distanceFactor={10}>
          <div className="r3f-html-bubble r3f-bubble-entering">
            <span>🎉 Table #{tableNumber || "Ready"}!</span>
            <span className="r3f-bubble-sub" style={{ color: "#059669" }}>
              {partySize > 1 ? `Entering (${partySize} people)...` : "Entering establishment..."}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

// 3D Person/Party Walking Into the Establishment (In inline mode, enters single-file one by one)
function EnteringPerson3D({ name, id, partySize = 1, layout = "inline", tableNumber, onComplete }) {
  const count = Math.min(Math.max(Number(partySize) || 1, 1), 50);
  const enteredMembersRef = useRef(new Set());

  // Calculate starting positions: in inline mode, they start in a line along X so they reach the door one by one
  const members = useMemo(() => {
    const list = [];
    if (layout === "inline") {
      const startBaseX = -2.8;
      const spacing = 0.82;
      for (let i = 0; i < count; i++) {
        list.push({
          index: i,
          startX: startBaseX - (i * spacing),
          startZ: 0
        });
      }
    } else {
      const offsets = getPartyOffsets(count, "circled");
      for (let i = 0; i < count; i++) {
        list.push({
          index: i,
          startX: -3.2 + offsets[i][0],
          startZ: offsets[i][2]
        });
      }
    }
    return list;
  }, [count, layout]);

  const handleMemberEntered = (memberIdx) => {
    enteredMembersRef.current.add(memberIdx);
    if (enteredMembersRef.current.size >= count) {
      onComplete?.();
    }
  };

  return (
    <group>
      {members.map((member) => (
        <EnteringSingleMember3D
          key={`${id}-entering-${member.index}`}
          name={name}
          id={id}
          memberIndex={member.index}
          startX={member.startX}
          startZ={member.startZ}
          isLeader={member.index === 0}
          tableNumber={tableNumber}
          partySize={partySize}
          onMemberEntered={handleMemberEntered}
        />
      ))}
    </group>
  );
}

// 3D Architectural Molded Picture Frame with Custom Logo Texture (Mounted on Walls)
function BuildingLogoSign({ url, side, scale = 1.0 }) {
  const [texture, setTexture] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }
    let isCancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => {
        if (!isCancelled) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.needsUpdate = true;
          if (tex.image && tex.image.width && tex.image.height) {
            setAspectRatio(tex.image.width / tex.image.height);
          }
          setTexture(tex);
        }
      },
      undefined,
      (err) => {
        console.warn("Failed to load building logo texture:", err);
      }
    );
    return () => {
      isCancelled = true;
    };
  }, [url]);

  if (!texture) return null;

  // Determine wall placement: "left" | "right" | "back"
  // House dimensions: width 4.8 (X: -1.2 to 3.6), height 4.4 (Y: 0 to 4.4), depth 4.8 (Z: -2.4 to 2.4)
  let pos = [3.62, 2.4, 0];
  let rot = [0, Math.PI / 2, 0];

  if (side === "left") {
    // Left wall at Z = -2.4 (facing outside towards -Z)
    pos = [1.2, 2.4, -2.42];
    rot = [0, Math.PI, 0];
  } else if (side === "right") {
    // Right wall at Z = +2.4 (facing outside towards +Z)
    pos = [1.2, 2.4, 2.42];
    rot = [0, 0, 0];
  } else {
    // Back wall at X = +3.6 (facing outside towards +X)
    pos = [3.62, 2.4, 0];
    rot = [0, Math.PI / 2, 0];
  }

  // Calculate proportional dimensions based on frame scale
  const s = Math.max(Number(scale) || 1.0, 0.4);
  const maxDim = 1.45 * s;
  const logoWidth = aspectRatio >= 1 ? maxDim : Math.max(maxDim * aspectRatio, 0.35 * s);
  const logoHeight = aspectRatio >= 1 ? Math.max(maxDim / aspectRatio, 0.35 * s) : maxDim;

  // Matting and 3D Frame Molding Rails
  const matMargin = 0.075 * s;
  const innerW = logoWidth + matMargin * 2;
  const innerH = logoHeight + matMargin * 2;

  const frameBorder = 0.1 * s;
  const frameDepth = 0.055 * s;
  const outerW = innerW + frameBorder * 2;
  const outerH = innerH + frameBorder * 2;

  return (
    <group position={pos} rotation={rot}>
      {/* Wooden Frame Backing Board */}
      <mesh position={[0, 0, -0.012 * s]} castShadow>
        <boxGeometry args={[outerW, outerH, 0.024 * s]} />
        <meshStandardMaterial color="#2B1D15" roughness={0.8} />
      </mesh>

      {/* Linen/Parchment Inner Matboard */}
      <mesh position={[0, 0, 0.005 * s]}>
        <boxGeometry args={[innerW, innerH, 0.01 * s]} />
        <meshStandardMaterial color="#FAF9F5" roughness={0.35} />
      </mesh>

      {/* Top Frame Molding Rail */}
      <mesh position={[0, (innerH + frameBorder) / 2, frameDepth / 2]} castShadow>
        <boxGeometry args={[outerW, frameBorder, frameDepth]} />
        <meshStandardMaterial color="#3D271D" roughness={0.65} metalness={0.15} />
      </mesh>
      {/* Bottom Frame Molding Rail */}
      <mesh position={[0, -(innerH + frameBorder) / 2, frameDepth / 2]} castShadow>
        <boxGeometry args={[outerW, frameBorder, frameDepth]} />
        <meshStandardMaterial color="#3D271D" roughness={0.65} metalness={0.15} />
      </mesh>
      {/* Left Frame Molding Rail */}
      <mesh position={[-(innerW + frameBorder) / 2, 0, frameDepth / 2]} castShadow>
        <boxGeometry args={[frameBorder, innerH, frameDepth]} />
        <meshStandardMaterial color="#3D271D" roughness={0.65} metalness={0.15} />
      </mesh>
      {/* Right Frame Molding Rail */}
      <mesh position={[(innerW + frameBorder) / 2, 0, frameDepth / 2]} castShadow>
        <boxGeometry args={[frameBorder, innerH, frameDepth]} />
        <meshStandardMaterial color="#3D271D" roughness={0.65} metalness={0.15} />
      </mesh>

      {/* Brass / Warm Gold Corner Accent Brackets */}
      {[
        [-(outerW - frameBorder) / 2, (outerH - frameBorder) / 2],
        [(outerW - frameBorder) / 2, (outerH - frameBorder) / 2],
        [-(outerW - frameBorder) / 2, -(outerH - frameBorder) / 2],
        [(outerW - frameBorder) / 2, -(outerH - frameBorder) / 2]
      ].map(([cx, cy], i) => (
        <mesh key={`corner-${i}`} position={[cx, cy, frameDepth + 0.002 * s]}>
          <boxGeometry args={[frameBorder * 1.05, frameBorder * 1.05, 0.006 * s]} />
          <meshStandardMaterial color="#C59B4B" metalness={0.65} roughness={0.3} />
        </mesh>
      ))}

      {/* Top Wall Mounting Hardware */}
      <mesh position={[0, outerH / 2 + 0.05 * s, 0.01 * s]} castShadow>
        <boxGeometry args={[0.16 * s, 0.09 * s, 0.03 * s]} />
        <meshStandardMaterial color="#C59B4B" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Logo Texture Display Surface */}
      <mesh position={[0, 0, 0.014 * s]}>
        <planeGeometry args={[logoWidth, logoHeight]} />
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// 3D Architectural Entrance / House (Sunny Day Garden Cafe Theme - Double Size)
function EntranceBuilding3D({ onClick, isQueued, isEntering, buildingLogo }) {
  const [hovered, setHovered] = useState(false);

  // Distinct framed signboards for each wall (Left, Right, and Back can each have different images and sizes)
  const wallSignages = useMemo(() => {
    if (!buildingLogo) return [];
    const list = [];

    // 1. Check for modern per-wall configuration: { walls: { left: { url, scale }, right: {...}, back: {...} } }
    if (buildingLogo.walls && typeof buildingLogo.walls === "object") {
      ["left", "right", "back"].forEach((side) => {
        const wall = buildingLogo.walls[side];
        if (wall?.url && typeof wall.url === "string" && wall.url.trim().length > 0) {
          const s = wall.scale !== undefined && wall.scale !== null ? Number(wall.scale) : 1.0;
          list.push({
            side,
            url: wall.url,
            scale: s || 1.0
          });
        }
      });
    }

    // 2. Fallback to legacy single-image schema if no per-wall configurations exist
    if (list.length === 0 && buildingLogo.logoUrl) {
      const sides = Array.isArray(buildingLogo.logoSides) && buildingLogo.logoSides.length > 0
        ? buildingLogo.logoSides
        : [buildingLogo.logoSide || "back"];
      let s = 1.0;
      if (buildingLogo.frameScale !== undefined && buildingLogo.frameScale !== null) {
        s = Number(buildingLogo.frameScale) || 1.0;
      } else {
        switch (buildingLogo.frameSizePreset) {
          case "small": s = 0.75; break;
          case "large": s = 1.35; break;
          case "xlarge": s = 1.7; break;
          default: s = 1.0; break;
        }
      }
      sides.forEach((side) => {
        list.push({
          side,
          url: buildingLogo.logoUrl,
          scale: s
        });
      });
    }

    return list;
  }, [buildingLogo]);

  return (
    <group position={[0, 0, 0]}>
      {/* Clickable Main Building Structure (Double Size: 4.8m x 4.4m x 4.8m in Warm Sunlit Stucco) */}
      <mesh 
        position={[1.2, 2.2, 0]} 
        castShadow 
        receiveShadow
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        cursor={hovered ? "pointer" : "auto"}
      >
        <boxGeometry args={[4.8, 4.4, 4.8]} />
        <meshStandardMaterial 
          color={hovered ? "#FFF8EE" : "#F4ECE1"} 
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Sunlit Terracotta Canopy Roof Eaves */}
      <mesh position={[1.2, 4.52, 0]} castShadow>
        <boxGeometry args={[5.4, 0.24, 5.4]} />
        <meshStandardMaterial color="#C25738" roughness={0.35} />
      </mesh>

      {/* Grand Terracotta Hipped Tile Roof Peak */}
      <mesh position={[1.2, 5.25, 0]} castShadow>
        <coneGeometry args={[3.8, 1.3, 4]} rotation={[0, Math.PI / 4, 0]} />
        <meshStandardMaterial color="#B04B2E" roughness={0.4} />
      </mesh>

      {/* Front Entrance Awning / Porch Canopy */}
      <mesh position={[-1.5, 2.38, 0]} castShadow>
        <boxGeometry args={[0.65, 0.08, 1.8]} />
        <meshStandardMaterial color="#C25738" roughness={0.35} />
      </mesh>
      {/* Porch Awning Corbels */}
      <mesh position={[-1.35, 2.28, 0.8]} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.06]} />
        <meshStandardMaterial color="#3D3B35" roughness={0.7} />
      </mesh>
      <mesh position={[-1.35, 2.28, -0.8]} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.06]} />
        <meshStandardMaterial color="#3D3B35" roughness={0.7} />
      </mesh>

      {/* Door Frame Lintel & Jambs */}
      <mesh position={[-1.22, 2.24, 0]} castShadow>
        <boxGeometry args={[0.08, 0.12, 1.56]} />
        <meshStandardMaterial color="#3D3B35" roughness={0.7} />
      </mesh>
      <mesh position={[-1.22, 1.1, 0.74]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.1]} />
        <meshStandardMaterial color="#3D3B35" roughness={0.7} />
      </mesh>
      <mesh position={[-1.22, 1.1, -0.74]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.1]} />
        <meshStandardMaterial color="#3D3B35" roughness={0.7} />
      </mesh>

      {/* Doorway Recess Glow */}
      <mesh position={[-1.21, 1.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.4, 2.2]} />
        <meshBasicMaterial color={isEntering ? "#10B981" : "#F59E0B"} />
      </mesh>

      {/* Upper Story Sunlit Windows */}
      <mesh position={[-1.21, 3.2, 1.4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.85, 1.0]} />
        <meshStandardMaterial color="#FFF9E6" roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[-1.22, 2.65, 1.4]} castShadow>
        <boxGeometry args={[0.06, 0.08, 0.95]} />
        <meshStandardMaterial color="#C25738" roughness={0.5} />
      </mesh>

      <mesh position={[-1.21, 3.2, -1.4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.85, 1.0]} />
        <meshStandardMaterial color="#FFF9E6" roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[-1.22, 2.65, -1.4]} castShadow>
        <boxGeometry args={[0.06, 0.08, 0.95]} />
        <meshStandardMaterial color="#C25738" roughness={0.5} />
      </mesh>

      {/* Potted Topiary Bushes Flanking Entrance */}
      <group position={[-1.4, 0, 1.25]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.2, 0.45, 16]} />
          <meshStandardMaterial color="#C25738" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.65, 0]} castShadow>
          <sphereGeometry args={[0.42, 14, 14]} />
          <meshStandardMaterial color="#2E7D32" roughness={0.8} />
        </mesh>
      </group>

      <group position={[-1.4, 0, -1.25]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.2, 0.45, 16]} />
          <meshStandardMaterial color="#C25738" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.65, 0]} castShadow>
          <sphereGeometry args={[0.42, 14, 14]} />
          <meshStandardMaterial color="#2E7D32" roughness={0.8} />
        </mesh>
      </group>

      {/* Outer Corner Garden Bushes */}
      <group position={[-1.25, 0, 2.25]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 12]} />
          <meshStandardMaterial color="#C25738" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.34, 12, 12]} />
          <meshStandardMaterial color="#2E7D32" roughness={0.8} />
        </mesh>
      </group>

      <group position={[-1.25, 0, -2.25]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 12]} />
          <meshStandardMaterial color="#C25738" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.34, 12, 12]} />
          <meshStandardMaterial color="#2E7D32" roughness={0.8} />
        </mesh>
      </group>

      {/* Custom Framed Artwork / Signboards (Each wall can display its own distinct picture and frame size) */}
      {wallSignages.map((sign) => (
        <BuildingLogoSign 
          key={`building-sign-${sign.side}-${sign.url}`}
          url={sign.url} 
          side={sign.side} 
          scale={sign.scale}
        />
      ))}

      {/* Warm Golden Sunlight Entrance Glow */}
      <pointLight 
        position={[-1.4, 1.8, 0]} 
        color={isEntering ? "#10B981" : "#F59E0B"} 
        intensity={isEntering ? 5 : 3.2} 
        distance={8} 
      />

      {/* 3D HTML Entrance Pill */}
      <Html position={[-1.52, 2.76, 0]} center distanceFactor={11}>
        <button 
          className="r3f-html-entrance"
          onClick={onClick}
          style={{ 
            borderColor: isEntering ? "#10B981" : "#CC785C", 
            color: isEntering ? "#059669" : "#CC785C"
          }}
        >
          {isEntering ? "✨ Welcome Inside!" : isQueued ? "🎟️ In Queue" : "🏛️ Main Entrance (Tap)"}
        </button>
      </Html>
    </group>
  );
}

// 3D Stone Paver Walkway through the Lawn
function RunwayTrack3D({ queueLength, isSpan = false }) {
  const lineLength = isSpan ? queueLength : Math.max(queueLength * 1.4 + 4, 8);
  return (
    <group position={[-(lineLength / 2) + 0.5, 0.005, 0]}>
      {/* Stone Paver Path cutting through the grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[lineLength, 1.3]} />
        <meshStandardMaterial color="#E2D9CC" roughness={0.85} />
      </mesh>
      {/* Center Pathway Accent Guideline */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lineLength, 0.08]} />
        <meshBasicMaterial color="#CC785C" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// Default camera coordinates & focal target
const DEFAULT_CAM_POS = [-10, 5.2, 9.5];
const DEFAULT_CAM_TARGET = [-0.8, 1.2, 0];

// Entrance camera focus (centered directly on the entrance door so mobile & desktop see the parade)
const ENTRANCE_CAM_POS = [-1.6, 3.4, 6.2];
const ENTRANCE_CAM_TARGET = [-1.22, 1.1, 0];

// Smooth Camera Controller: glides to entrance when entering, or snaps/lerps to default angle when Fixed
function CameraRig({ isFixed, isEntering, controlsRef }) {
  useFrame((state, delta) => {
    if (isEntering) {
      // Automatically center camera on the entrance door so mobile & desktop see the animation clearly
      state.camera.position.lerp(
        new THREE.Vector3(...ENTRANCE_CAM_POS),
        delta * 3.5
      );
      if (controlsRef?.current) {
        controlsRef.current.target.lerp(
          new THREE.Vector3(...ENTRANCE_CAM_TARGET),
          delta * 3.5
        );
        controlsRef.current.update();
      } else {
        state.camera.lookAt(...ENTRANCE_CAM_TARGET);
      }
    } else if (isFixed) {
      // Smoothly animate camera position back to default queue view
      state.camera.position.lerp(
        new THREE.Vector3(...DEFAULT_CAM_POS),
        delta * 3
      );
      if (controlsRef?.current) {
        controlsRef.current.target.lerp(
          new THREE.Vector3(...DEFAULT_CAM_TARGET),
          delta * 3
        );
        controlsRef.current.update();
      } else {
        state.camera.lookAt(...DEFAULT_CAM_TARGET);
      }
    }
  });
  return null;
}

export default function CustomerQueue() {
  const { currentUser } = useAuth();
  const { slug: routeSlug } = useParams();
  const activeSlug = routeSlug ? routeSlug.trim().toLowerCase() : null;

  // Establishment state
  const [establishment, setEstablishment] = useState(null);
  const [loadingEst, setLoadingEst] = useState(Boolean(activeSlug));
  const [estNotFound, setEstNotFound] = useState(false);

  // Firestore Subcollection Reference Helpers
  const estColl = (name) => collection(db, "establishments", activeSlug || "_", name);
  const estDoc = (name, id) => doc(db, "establishments", activeSlug || "_", name, id);
  const estSetting = (name) => doc(db, "establishments", activeSlug || "_", "settings", name);

  const [queue, setQueue] = useState([]);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTablesModalOpen, setIsTablesModalOpen] = useState(false);
  const [tables, setTables] = useState([]);

  // Subscribe to establishment metadata
  useEffect(() => {
    if (!activeSlug) {
      setLoadingEst(false);
      setEstNotFound(true);
      return;
    }

    setLoadingEst(true);
    setEstNotFound(false);

    const unsub = onSnapshot(
      doc(db, "establishments", activeSlug),
      (docSnap) => {
        setLoadingEst(false);
        if (docSnap.exists()) {
          setEstablishment({ id: docSnap.id, ...docSnap.data() });
          setEstNotFound(false);
          localStorage.setItem("active_establishment_slug", activeSlug);
        } else {
          setEstablishment(null);
          setEstNotFound(true);
        }
      },
      (err) => {
        console.warn("Unable to fetch establishment info:", err.message);
        setLoadingEst(false);
        setEstNotFound(true);
      }
    );
    return () => unsub();
  }, [activeSlug]);

  // Subscribe to dining tables in real time
  useEffect(() => {
    if (!activeSlug || estNotFound) return;
    const tablesQuery = query(estColl("tables"), orderBy("tableNumber", "asc"));
    const unsubscribeTables = onSnapshot(
      tablesQuery,
      (snapshot) => {
        setTables(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn("Unable to track tables status:", err.message);
      }
    );
    return () => unsubscribeTables();
  }, [activeSlug, estNotFound]);

  // Building logo & custom signage configuration from Firestore
  const [buildingConfig, setBuildingConfig] = useState(null);
  useEffect(() => {
    if (!activeSlug || estNotFound) return;
    const unsub = onSnapshot(
      estSetting("building"),
      (docSnap) => {
        if (docSnap.exists()) {
          setBuildingConfig(docSnap.data());
        } else {
          setBuildingConfig(null);
        }
      },
      (err) => {
        console.warn("Unable to fetch building signage config:", err.message);
      }
    );
    return () => unsub();
  }, [activeSlug, estNotFound]);

  // Queue configuration from Firestore: dynamic max party size limit set by admin
  const [maxPartySize, setMaxPartySize] = useState(10);
  useEffect(() => {
    if (!activeSlug || estNotFound) return;
    const unsub = onSnapshot(
      estSetting("queueConfig"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const limitVal = Number(data.maxPartySize);
          if (limitVal && limitVal > 0) {
            setMaxPartySize(limitVal);
          }
        } else if (establishment?.maxCustomerCapacity) {
          setMaxPartySize(establishment.maxCustomerCapacity);
        }
      },
      (err) => {
        console.warn("Unable to fetch queue configuration:", err.message);
      }
    );
    return () => unsub();
  }, [activeSlug, establishment?.maxCustomerCapacity, estNotFound]);

  // Ensure current party size does not exceed the allowed max party size
  useEffect(() => {
    setPartySize((p) => Math.min(p, maxPartySize));
  }, [maxPartySize]);

  const availableTables = useMemo(() => {
    return tables.filter((t) => t.status === "available");
  }, [tables]);

  const [myReservationId, setMyReservationId] = useState(() => {
    if (!activeSlug) return null;
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get("ticket") || urlParams.get("id");
    if (paramId) {
      localStorage.setItem(`my_queue_id_${activeSlug}`, paramId);
      return paramId;
    }
    return localStorage.getItem(`my_queue_id_${activeSlug}`) || null;
  });

  // Re-sync myReservationId whenever activeSlug changes
  useEffect(() => {
    if (!activeSlug) {
      setMyReservationId(null);
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get("ticket") || urlParams.get("id");
    if (paramId) {
      localStorage.setItem(`my_queue_id_${activeSlug}`, paramId);
      setMyReservationId(paramId);
    } else {
      const stored = localStorage.getItem(`my_queue_id_${activeSlug}`) || null;
      setMyReservationId(stored);
    }
  }, [activeSlug]);

  const [myReservationData, setMyReservationData] = useState(null);

  // Orbitable & Layout state (defaults to inline single-file view with preference persistence)
  const [isCameraFixed, setIsCameraFixed] = useState(false);
  const [queueLayout, setQueueLayout] = useState(() => {
    return localStorage.getItem("queue_layout_pref") || "inline";
  });

  // Entrance walk-in animation state (tracks all seated customers walking in)
  const [enteringList, setEnteringList] = useState([]);
  const [hasEntered, setHasEntered] = useState(false);

  const controlsRef = useRef();

  // Subscribe to active queue (waiting), capped at 20 docs for Spark free tier optimization
  useEffect(() => {
    const q = query(
      estColl("reservations"),
      where("status", "==", "waiting"),
      orderBy("createdAt", "asc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Check doc changes to catch ANY customer who just got seated
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") {
          // When a document leaves the 'waiting' query, change.doc.data() reflects its old state.
          // Fetch the document directly to check if its status changed to 'eating'.
          getDoc(estDoc("reservations", change.doc.id))
            .then((docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.status === "eating") {
                  const isCurrentUser = change.doc.id === myReservationId;
                  setEnteringList((prev) => {
                    if (prev.some((p) => p.id === change.doc.id)) return prev;
                    return [
                      ...prev,
                      {
                        id: change.doc.id,
                        name: data.customerName || "Customer",
                        partySize: data.partySize || 1,
                        tableNumber: data.tableNumber,
                        isCurrentUser,
                      }
                    ];
                  });
                }
              }
            })
            .catch((err) => {
              console.warn("Could not check status of removed customer:", err);
            });
        }
      });

      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setQueue(items);
    });

    return () => unsubscribe();
  }, [activeSlug, myReservationId]);

  // Real-time listener for the user's personal ticket
  useEffect(() => {
    if (!myReservationId) {
      setMyReservationData(null);
      return;
    }

    const unsubscribeMyTicket = onSnapshot(
      estDoc("reservations", myReservationId),
      (docSnap) => {
        if (!docSnap.exists() || docSnap.data()?.status === "completed") {
          localStorage.removeItem(`my_queue_id_${activeSlug}`);
          localStorage.removeItem("my_queue_id");
          setMyReservationId(null);
          setMyReservationData(null);
          setHasEntered(false);
        } else {
          const data = docSnap.data();
          setMyReservationData(data);
          // If user status is eating, ensure user is in enteringList
          if (data.status === "eating" && !hasEntered) {
            setEnteringList((prev) => {
              if (prev.some((p) => p.id === myReservationId)) return prev;
              return [
                ...prev,
                {
                  id: myReservationId,
                  name: data.customerName || "You",
                  partySize: data.partySize || 1,
                  tableNumber: data.tableNumber,
                  isCurrentUser: true,
                }
              ];
            });
          }
        }
      },
      (err) => {
        console.warn("Unable to track ticket status:", err.message);
        localStorage.removeItem(`my_queue_id_${activeSlug}`);
        localStorage.removeItem("my_queue_id");
        setMyReservationId(null);
        setMyReservationData(null);
        setHasEntered(false);
      }
    );

    return () => unsubscribeMyTicket();
  }, [activeSlug, myReservationId, hasEntered]);

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const safePartySize = Math.min(Math.max(Number(partySize) || 1, 1), maxPartySize);

    try {
      const docRef = await addDoc(estColl("reservations"), {
        customerName: name.trim(),
        partySize: safePartySize,
        status: "waiting",
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || "anon"
      });

      setMyReservationId(docRef.id);
      localStorage.setItem(`my_queue_id_${activeSlug}`, docRef.id);
      setName("");
      setPartySize(1);
      setIsModalOpen(false);
      setHasEntered(false);
    } catch (err) {
      alert("Error adding reservation: " + err.message);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!confirm("Are you sure you want to leave the queue?")) return;
    try {
      await deleteDoc(estDoc("reservations", reservationId));
    } catch (err) {
      console.warn("Could not delete from Firestore:", err.message);
    } finally {
      if (reservationId === myReservationId) {
        localStorage.removeItem(`my_queue_id_${activeSlug}`);
        localStorage.removeItem("my_queue_id");
        setMyReservationId(null);
        setMyReservationData(null);
        setHasEntered(false);
      }
    }
  };

  // Find user's index in line
  const myQueueIndex = queue.findIndex(
    (item) => item.id === myReservationId || (currentUser?.uid && item.createdBy === currentUser.uid)
  );

  const isEating = myReservationData?.status === "eating";

  // Calculate 3D positions for each party depending on layout
  const { partyPositions, totalRunwaySpan } = useMemo(() => {
    let currentX = -2.3;
    const positions = queue.map((item, index) => {
      // Accurate count of miniature persons based on inputted party size
      const count = Math.min(Math.max(Number(item.partySize) || 1, 1), 50);
      if (queueLayout === "inline") {
        const x = currentX;
        // In inline view, party members take (count - 1) * 0.75 space, plus a 1.1m gap to next party
        currentX -= (count - 1) * 0.75 + 1.1;
        const z = Math.sin(index * 0.3) * 0.15; // gentle, subtle wave
        return { x, z, count };
      } else {
        // Circled / clustered view: spacing dynamically scales with cluster radius
        const clusterRadius = count <= 4 ? 0.45 : 0.45 + (count - 4) * 0.055;
        const x = currentX;
        currentX -= Math.max(clusterRadius * 2 + 0.6, 1.4);
        const z = Math.sin(index * 0.5) * 0.35;
        return { x, z, count };
      }
    });

    // Compute total runway span needed
    let span = 8;
    if (positions.length > 0) {
      const lastPos = positions[positions.length - 1];
      const extraMemberSpan = queueLayout === "inline" ? (lastPos.count - 1) * 0.75 : 0;
      span = Math.max(Math.abs(lastPos.x - extraMemberSpan) + 6, 8);
    }

    return { partyPositions: positions, totalRunwaySpan: span };
  }, [queue, queueLayout]);

  // Camera reset/focus helper
  const handleResetCamera = () => {
    setIsCameraFixed(false);
    if (controlsRef.current) {
      if (isEating) {
        controlsRef.current.target.set(-1.22, 1.1, 0);
      } else if (myQueueIndex >= 0 && partyPositions[myQueueIndex]) {
        const targetX = partyPositions[myQueueIndex].x;
        controlsRef.current.target.set(targetX, 0.8, 0);
      } else {
        controlsRef.current.target.set(...DEFAULT_CAM_TARGET);
      }
      controlsRef.current.update();
    }
  };

  // If no slug is specified in the URL, redirect directly to the Home store finder
  if (!activeSlug) {
    return <Navigate to="/" replace />;
  }

  // Loading state while connecting to the establishment
  if (loadingEst) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF9F5",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#73716B",
        gap: 14
      }}>
        <div style={{
          width: 34,
          height: 34,
          border: "3px solid #E5E3DC",
          borderTopColor: "#CC785C",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          Connecting to /q/{activeSlug} live queue...
        </span>
      </div>
    );
  }

  // Establishment not found state
  if (estNotFound || !establishment) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF9F5",
        padding: "24px 16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1F1E1D",
        boxSizing: "border-box"
      }}>
        <div style={{
          width: "100%",
          maxWidth: 440,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(31, 30, 29, 0.04)"
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#F8EFEA",
            border: "1px solid rgba(204, 120, 92, 0.25)",
            color: "#CC785C",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 16
          }}>
            🔍
          </div>
          <h2 style={{
            fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
            fontSize: 22,
            fontWeight: 600,
            margin: "0 0 8px 0"
          }}>
            Establishment Not Found
          </h2>
          <p style={{ fontSize: 14, color: "#73716B", lineHeight: 1.5, margin: "0 0 24px 0" }}>
            We couldn't locate an active queue for <code style={{ backgroundColor: "#F4F2EC", padding: "2px 6px", borderRadius: 4, color: "#CC785C", fontWeight: 600 }}>/q/{activeSlug}</code>. Please double-check your link or scan the restaurant's in-store QR code.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              to="/"
              style={{
                display: "block",
                padding: "11px 16px",
                backgroundColor: "#CC785C",
                color: "#FFFFFF",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none"
              }}
            >
              Enter Another Business Link
            </Link>
            <Link
              to="/register"
              style={{
                display: "block",
                padding: "10px 16px",
                backgroundColor: "transparent",
                color: "#57534E",
                border: "1px solid #E5E3DC",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: "none"
              }}
            >
              Register This Store Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="minimal-viewport">
      {/* Ambient Mesh Glow */}
      <div className="minimal-bg-ambient"></div>

      {/* Minimal Floating HUD */}
      <header className="minimal-hud">
        <div className="hud-left">
          <div className="hud-live-indicator"></div>
          <div className="hud-brand-title">
            <span>{establishment?.name || "3D Live Queue"}</span>
            <span className="hud-queue-count">• {queue.length} in line</span>
          </div>
          <button 
            type="button"
            className="hud-tables-badge-btn"
            onClick={() => setIsTablesModalOpen(true)}
            title="View Available Dining Tables"
          >
            🪑 {availableTables.length} Open
          </button>
        </div>

        {myReservationId && myReservationData ? (
          <div className="hud-ticket-chip">
            <span>Your Spot:</span>
            <span className="hud-ticket-pos">
              {isEating 
                ? `Table #${myReservationData.tableNumber || "Ready"}` 
                : myQueueIndex >= 0 
                  ? `#${myQueueIndex + 1}` 
                  : "Confirmed"}
            </span>
            <button 
              className="hud-leave-btn"
              onClick={() => handleCancelReservation(myReservationId)}
              title="Leave Queue"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button 
            className="hud-join-btn"
            onClick={() => setIsModalOpen(true)}
          >
            Join Line
          </button>
        )}
      </header>

      {/* Table Ready State Banner (When Admin Assigns Table) */}
      {isEating && (
        <div className="minimal-ready-card">
          <div className="ready-pill">
            <span>● Table Ready • Seated</span>
          </div>
          <h2 className="ready-table-title">
            Table #{myReservationData.tableNumber || "Ready"}
          </h2>
          <p className="ready-desc">
            Your table has been assigned! Step right inside the establishment.
          </p>
          <button 
            className="replay-walk-btn"
            onClick={() => {
              setHasEntered(false);
              setEnteringList((prev) => [
                ...prev.filter((p) => p.id !== myReservationId),
                {
                  id: myReservationId,
                  name: myReservationData?.customerName || "You",
                  partySize: myReservationData?.partySize || 1,
                  tableNumber: myReservationData?.tableNumber,
                  isCurrentUser: true,
                  replayKey: Date.now()
                }
              ]);
            }}
          >
            🔁 Replay Entrance Animation
          </button>
        </div>
      )}

      {/* React Three Fiber 3D Stage */}
      <main className="minimal-world">
        <div className="stage-wrapper">
          <section className="r3f-3d-stage">
            {/* Viewport Hint Badge */}
            <div className="stage-hint-badge">
              <span style={{ color: "#10b981" }}>●</span>
              <span>
                {isEating 
                  ? "🎉 Entering establishment!" 
                  : `${queueLayout === "inline" ? "📏 Inline Line" : "⭕ Circled Groups"} • ${isCameraFixed ? "Fixed" : "3D Free"}`}
              </span>
            </div>

            {/* Stage Quick Controls */}
            <div className="stage-control-bar">
              <button
                type="button"
                className="stage-btn-pill tables-trigger-btn"
                onClick={() => setIsTablesModalOpen(true)}
                title="View Available Dining Tables"
              >
                🪑 Tables ({availableTables.length} open)
              </button>
              <button
                className="stage-btn-pill"
                onClick={() => {
                  setQueueLayout((prev) => {
                    const next = prev === "inline" ? "circled" : "inline";
                    localStorage.setItem("queue_layout_pref", next);
                    return next;
                  });
                }}
                title="Toggle queue layout between inline single file and circled groups"
              >
                {queueLayout === "inline" ? "📏 Inline Line" : "⭕ Circled Groups"}
              </button>
              <button
                className="stage-btn-pill"
                onClick={() => {
                  setIsCameraFixed((prev) => {
                    const next = !prev;
                    if (next && controlsRef.current) {
                      // Reset controls target back to default immediately
                      controlsRef.current.target.set(...DEFAULT_CAM_TARGET);
                      controlsRef.current.update();
                    }
                    return next;
                  });
                }}
              >
                {isCameraFixed ? "🔒 Fixed View" : "✨ 3D Hover"}
              </button>
              {myReservationId && (
                <button className="stage-btn-pill" onClick={handleResetCamera}>
                  🎯 {isEating ? "Focus Entrance" : "Find My Spot"}
                </button>
              )}
              {!myReservationId && (
                <button className="stage-btn-pill" onClick={() => setIsModalOpen(true)}>
                  🎟️ Join Queue
                </button>
              )}
            </div>

            {/* Three.js Canvas */}
            <Canvas
              shadows
              camera={{ position: DEFAULT_CAM_POS, fov: 42 }}
              className="r3f-canvas"
            >
              {/* Smooth transition helper */}
              <CameraRig 
                isFixed={isCameraFixed} 
                isEntering={enteringList.some((p) => p.isCurrentUser)} 
                controlsRef={controlsRef} 
              />
              {/* Orbit Controls */}
              <OrbitControls
                ref={controlsRef}
                makeDefault
                target={DEFAULT_CAM_TARGET}
                enabled={!isCameraFixed}
                enableRotate={!isCameraFixed}
                enableZoom={!isCameraFixed}
                enablePan={!isCameraFixed}
                enableDamping
                dampingFactor={0.06}
                maxPolarAngle={Math.PI / 2.05}
                minDistance={3.5}
                maxDistance={28}
              />
              {/* Sunny Day Outdoor Lighting */}
              <ambientLight intensity={0.65} color="#FFFFFF" />
              <directionalLight 
                position={[14, 22, 10]} 
                intensity={2.2} 
                color="#FFFDF0"
                castShadow 
                shadow-mapSize={2048} 
                shadow-bias={-0.0004}
              />
              {/* Natural Hemisphere Light: Sunny Blue Sky above, Green Grass below */}
              <hemisphereLight skyColor="#7EC4F8" groundColor="#3EA860" intensity={1.15} />

              {/* Clear Sunny Blue Sky */}
              <color attach="background" args={["#7EC4F8"]} />
              {/* Soft Horizon Atmosphere */}
              <fog attach="fog" args={["#AEE0FD", 25, 60]} />

              {/* Glowing Sunny Day Sun */}
              <mesh position={[20, 24, -18]}>
                <sphereGeometry args={[3.2, 20, 20]} />
                <meshBasicMaterial color="#FFF9DB" />
              </mesh>

              {/* Fluffy Sunny Clouds in the Sky */}
              <group position={[-16, 16, -22]}>
                <mesh position={[0, 0, 0]}><sphereGeometry args={[2.8, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
                <mesh position={[2.4, -0.4, 0]}><sphereGeometry args={[2.1, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
                <mesh position={[-2.2, -0.5, 0]}><sphereGeometry args={[1.9, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
              </group>
              <group position={[14, 18, -26]}>
                <mesh position={[0, 0, 0]}><sphereGeometry args={[3.2, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
                <mesh position={[2.8, -0.5, 0]}><sphereGeometry args={[2.4, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
                <mesh position={[-2.6, -0.6, 0]}><sphereGeometry args={[2.1, 12, 12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.95} /></mesh>
              </group>

              {/* 3D Architecture Pavilion */}
              <EntranceBuilding3D 
                onClick={() => {
                  if (!myReservationId) setIsModalOpen(true);
                }} 
                isQueued={Boolean(myReservationId)} 
                isEntering={enteringList.length > 0}
                buildingLogo={buildingConfig}
              />

              {/* 3D Stone Walkway Path */}
              <RunwayTrack3D queueLength={totalRunwaySpan} isSpan={true} />

              {/* Lush Natural Grass Ground Plane */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
                <planeGeometry args={[Math.max(totalRunwaySpan + 30, 80), 60]} />
                <meshStandardMaterial color="#3EA860" roughness={0.88} />
              </mesh>

              {/* Decorative Grass Flower Tufts */}
              {[-3, -6, -9, -12, -15, -18].map((fx, i) => (
                <group key={`flower-${i}`} position={[fx, 0.03, (i % 2 === 0 ? 1.1 : -1.1)]}>
                  <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.06, 8]} />
                    <meshBasicMaterial color={i % 3 === 0 ? "#FDE047" : "#FFFFFF"} />
                  </mesh>
                </group>
              ))}

              {/* Dynamic 3D Queue Avatars from Firestore */}
              {queue.map((item, index) => {
                const isCurrentUser =
                  item.id === myReservationId ||
                  (currentUser?.uid && item.createdBy === currentUser.uid);
                const pos = partyPositions[index] || {
                  x: -(index * 1.35 + 2.3),
                  z: 0
                };

                return (
                  <MiniaturePerson3D
                    key={item.id}
                    id={item.id}
                    name={item.customerName}
                    partySize={item.partySize || 1}
                    positionIndex={index}
                    isCurrentUser={isCurrentUser}
                    layout={queueLayout}
                    posX={pos.x}
                    posZ={pos.z}
                  />
                );
              })}

              {/* Animated Walk-in Persons for Any Customer Called to Table */}
              {enteringList.map((person) => (
                <EnteringPerson3D
                  key={person.replayKey ? `${person.id}-${person.replayKey}` : person.id}
                  id={person.id}
                  name={person.name}
                  partySize={person.partySize}
                  layout={queueLayout}
                  tableNumber={person.tableNumber}
                  onComplete={() => {
                    setEnteringList((prev) => prev.filter((p) => p.id !== person.id));
                    if (person.isCurrentUser) {
                      setHasEntered(true);
                    }
                  }}
                />
              ))}

              {/* Natural Outdoor Ground Shadows on Grass */}
              <ContactShadows 
                position={[0, 0, 0]} 
                opacity={0.42} 
                scale={26} 
                blur={2.2} 
                far={5} 
                color="#14532D"
              />
            </Canvas>
          </section>
        </div>
      </main>

      {/* Modern Minimal Form Modal */}
      {isModalOpen && (
        <div className="minimal-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="minimal-modal-card" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-x-btn" 
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="modal-title-wrap">
              <h3>{establishment?.name ? `Join ${establishment.name}` : "Join Queue"}</h3>
              <p>Enter your details to take your spot in line.</p>
            </div>

            <form onSubmit={handleJoinQueue}>
              {/* Name Field */}
              <div className="form-field-block">
                <label className="field-label" htmlFor="user-name">Your Name</label>
                <input
                  id="user-name"
                  type="text"
                  className="minimal-text-input"
                  placeholder="e.g. Alex M."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={25}
                  required
                  autoFocus
                />
              </div>

              {/* Party Stepper */}
              <div className="form-field-block">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>Party Size</label>
                  <span style={{ fontSize: 11.5, color: "#8C8980", fontWeight: 500 }}>
                    Max: {maxPartySize} {maxPartySize === 1 ? "guest" : "guests"}
                  </span>
                </div>
                <div className="minimal-stepper-wrap">
                  <button
                    type="button"
                    className="step-circle-btn"
                    onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                    disabled={partySize <= 1}
                  >
                    −
                  </button>
                  <div className="step-value-box">
                    {partySize} {partySize === 1 ? "Person" : "People"}
                  </div>
                  <button
                    type="button"
                    className="step-circle-btn"
                    onClick={() => setPartySize((p) => Math.min(maxPartySize, p + 1))}
                    disabled={partySize >= maxPartySize}
                    title={partySize >= maxPartySize ? `Maximum capacity set to ${maxPartySize} guests` : ""}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" className="minimal-confirm-btn">
                Confirm & Join
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Available Dining Tables Popup Modal */}
      {isTablesModalOpen && (
        <div className="minimal-modal-backdrop" onClick={() => setIsTablesModalOpen(false)}>
          <div className="minimal-modal-card tables-modal-card" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-x-btn" 
              onClick={() => setIsTablesModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="modal-title-wrap">
              <div className="tables-modal-badge">
                <span>🪑 Restaurant Seating</span>
                <span className="tables-count-pill">{availableTables.length} Available</span>
              </div>
              <h3>Available Dining Tables</h3>
              <p>Live seating availability and table capacities</p>
            </div>

            {/* Quick Stats Bar */}
            <div className="tables-stats-row">
              <div className="table-stat-item">
                <span className="stat-num stat-available">{availableTables.length}</span>
                <span className="stat-label">Available</span>
              </div>
              <div className="table-stat-item">
                <span className="stat-num stat-occupied">{tables.length - availableTables.length}</span>
                <span className="stat-label">Occupied</span>
              </div>
              <div className="table-stat-item">
                <span className="stat-num">{tables.length}</span>
                <span className="stat-label">Total Tables</span>
              </div>
            </div>

            {/* Grid of Tables */}
            <div className="tables-grid-list">
              {tables.length === 0 ? (
                <div className="empty-tables-note">No dining tables added yet.</div>
              ) : (
                tables.map((tb) => {
                  const isAvail = tb.status === "available";
                  return (
                    <div 
                      key={tb.id} 
                      className={`table-status-card ${isAvail ? "is-available" : "is-occupied"}`}
                    >
                      <div className="table-card-top">
                        <span className="table-card-num">Table #{tb.tableNumber}</span>
                        <span className={`table-badge-indicator ${isAvail ? "badge-open" : "badge-busy"}`}>
                          {isAvail ? "● Open" : "● Busy"}
                        </span>
                      </div>
                      <div className="table-card-bottom">
                        <span className="table-capacity-text">👥 {tb.capacity} {tb.capacity === 1 ? "seat" : "seats"}</span>
                        <span className="table-state-sub">
                          {isAvail ? "Ready to seat" : "Currently dining"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              type="button"
              className="minimal-confirm-btn"
              onClick={() => setIsTablesModalOpen(false)}
              style={{ marginTop: 20 }}
            >
              Close Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
