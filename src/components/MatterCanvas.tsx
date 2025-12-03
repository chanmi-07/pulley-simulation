import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import WeightSlider from "@/components/WeightSlider";

const PulleySimulation: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(Matter.Engine.create());
  const [mass1, setMass1] = useState(10);
  const [mass2, setMass2] = useState(10);
  const mass1Ref = useRef(mass1);
  const mass2Ref = useRef(mass2);
  const prevVelARef = useRef({ x: 0, y: 0 });
  const prevVelBRef = useRef({ x: 0, y: 0 });
  const tensionARef = useRef(0);
  const tensionBRef = useRef(0);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    mass1Ref.current = mass1;
  }, [mass1]);

  useEffect(() => {
    mass2Ref.current = mass2;
  }, [mass2]);

  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;
    world.gravity.y = 1;

    const width = 800;
    const height = 600;

    // Render setup
    const render = Matter.Render.create({
      element: sceneRef.current!,
      engine,
      options: {
        width,
        height,
        background: "#1e1e1e",
        wireframes: false,
      },
    }) as Matter.Render;

    // Pulley parameters
    const pulleyX = width / 2;
    const pulleyY = 150;
    const ropeBaseLength = 600;
    const offsetX = 200;

    // Pulley body (static, visual only)
    const pulley = Matter.Bodies.circle(pulleyX, pulleyY, 25, {
      isStatic: true,
      render: {
        fillStyle: "#888",
        strokeStyle: "#bbb",
        lineWidth: 3,
      },
    });

    // Two hanging masses
    const ballA = Matter.Bodies.circle(pulleyX - offsetX, pulleyY + 250, 25, {
      density: mass1 / 1000,
      restitution: 0,
      frictionAir: 0.01,
      friction: 0.2,
      inertia: Infinity,
      render: { fillStyle: "#03DAC5" },
    });

    const ballB = Matter.Bodies.circle(pulleyX + offsetX, pulleyY + 250, 25, {
      density: mass2 / 1000,
      restitution: 0,
      frictionAir: 0.01,
      friction: 0.2,
      inertia: Infinity,
      render: { fillStyle: "#BB86FC" },
    });

    const ground = Matter.Bodies.rectangle(width / 2, height + 40, width, 80, {
      isStatic: true,
      render: { visible: false },
    });

    const separator = Matter.Bodies.rectangle(pulleyX, pulleyY + 300, 15, 400, {
      isStatic: true,
      render: { visible: false },
    });

    Matter.World.add(world, [pulley, ballA, ballB, ground, separator]);

    // -----------------------------
    // Rope + Pulley wear system
    // -----------------------------
    let ropeWear = 0; // 0–1
    let ropeBroken = false;

    let pulleyWear = 0; // 0–1
    let pulleySeized = false;

    const MAX_WEAR = 1.0; // rope breaks at 1.0 wear
    const BASELINE_WEAR = 0.001; // slow natural degradation for rope
    const LOAD_FACTOR = 0.000003; // mass effect on rope wear
    const TENSION_FACTOR = 0.0005; // velocity difference effect on rope wear

    const PULLEY_MAX_WEAR = 1.0;
    const PULLEY_BASELINE_WEAR = 0.0002;
    const PULLEY_LOAD_FACTOR = 0.000001;
    const PULLEY_TENSION_FACTOR = 0.000002;
    const PULLEY_FRICTION_FACTOR = 0.0008; // how much tangential friction increases with wear

    Matter.Events.on(engine, "beforeUpdate", () => {
      // Tension proxy (difference in vertical velocities)
      const velocityTension = Math.abs(ballA.velocity.y - ballB.velocity.y);

      // --- Rope wear accumulation
      if (!ropeBroken) {
        ropeWear += velocityTension * TENSION_FACTOR;
        ropeWear += (mass1Ref.current + mass2Ref.current) * LOAD_FACTOR;
        ropeWear += BASELINE_WEAR;
        ropeWear = Math.min(ropeWear, 1);
        if (ropeWear >= MAX_WEAR) {
          ropeBroken = true;
          return;
        }
      }

      if (ropeBroken) return;

      // --- Pulley wear accumulation
      if (!pulleySeized) {
        pulleyWear += velocityTension * PULLEY_TENSION_FACTOR;
        pulleyWear += ((mass1Ref.current + mass2Ref.current) / 2) * PULLEY_LOAD_FACTOR;
        pulleyWear += PULLEY_BASELINE_WEAR;
        pulleyWear = Math.min(pulleyWear, 1);
        if (pulleyWear >= PULLEY_MAX_WEAR) {
          pulleySeized = true;
        }
      }

      // -----------------------------
      // Estimate tensions for each mass (approx.)
      // -----------------------------
      try {
        // engine.timing.delta may be missing in defs; read defensively
        const timing = engine.timing as unknown as { delta?: number };
        const dt = timing && timing.delta ? timing.delta / 1000 : 1 / 60;

        // mass A
        const accelA = {
          x: (ballA.velocity.x - prevVelARef.current.x) / dt,
          y: (ballA.velocity.y - prevVelARef.current.y) / dt,
        };
        const dirA = Matter.Vector.normalise(Matter.Vector.sub({ x: pulleyX, y: pulleyY }, ballA.position));
        const aParallelA = accelA.x * dirA.x + accelA.y * dirA.y;
        const massA = ballA.mass || 1;
        const tensionA = Math.max(massA * (world.gravity.y - aParallelA), 0);
        tensionARef.current = tensionA;

        // mass B
        const accelB = {
          x: (ballB.velocity.x - prevVelBRef.current.x) / dt,
          y: (ballB.velocity.y - prevVelBRef.current.y) / dt,
        };
        const dirB = Matter.Vector.normalise(Matter.Vector.sub({ x: pulleyX, y: pulleyY }, ballB.position));
        const aParallelB = accelB.x * dirB.x + accelB.y * dirB.y;
        const massB = ballB.mass || 1;
        const tensionB = Math.max(massB * (world.gravity.y - aParallelB), 0);
        tensionBRef.current = tensionB;
      } catch (e) {
        console.error("Error calculating tensions:", e);
      }

      // -----------------------------
      // Rope length / constraint simulation
      // -----------------------------
      const stretchedLength = ropeBaseLength * (1 + ropeWear * 0.5); // rope gets longer as it wears

      // Distance from masses to pulley
      const distA = Matter.Vector.magnitude(
        Matter.Vector.sub(ballA.position, { x: pulleyX, y: pulleyY })
      );

      const distB = Matter.Vector.magnitude(
        Matter.Vector.sub(ballB.position, { x: pulleyX, y: pulleyY })
      );

      const total = distA + distB;
      const diff = total - stretchedLength;

      // If rope is too long/short, adjust masses
      if (Math.abs(diff) > 0.5) {
        const dirA = Matter.Vector.normalise(
          Matter.Vector.sub(ballA.position, { x: pulleyX, y: pulleyY })
        );

        const dirB = Matter.Vector.normalise(
          Matter.Vector.sub(ballB.position, { x: pulleyX, y: pulleyY })
        );

        // Pull masses inward/outward equally
        Matter.Body.translate(ballA, Matter.Vector.mult(dirA, -diff * 0.5));
        Matter.Body.translate(ballB, Matter.Vector.mult(dirB, -diff * 0.5));

        // Slight damping for stability
        Matter.Body.setVelocity(ballA, {
          x: ballA.velocity.x * 0.98,
          y: ballA.velocity.y * 0.98,
        });

        Matter.Body.setVelocity(ballB, {
          x: ballB.velocity.x * 0.98,
          y: ballB.velocity.y * 0.98,
        });
      }

      // -----------------------------
      // Pulley friction effect (tangential damping)
      // -----------------------------
      const applyPulleyFriction = (body: Matter.Body) => {
        const rel = Matter.Vector.sub(body.position, { x: pulleyX, y: pulleyY });
        const tangent = Matter.Vector.normalise({ x: -rel.y, y: rel.x });
        const tangentialVel = body.velocity.x * tangent.x + body.velocity.y * tangent.y;

        if (!pulleySeized) {
          // friction proportional to wear and tangential speed
          const frictionMag = -Math.sign(tangentialVel) * Math.abs(tangentialVel) * pulleyWear * PULLEY_FRICTION_FACTOR;
          Matter.Body.applyForce(body, body.position, { x: tangent.x * frictionMag, y: tangent.y * frictionMag });
        } else {
          // pulley seized — kill tangential motion aggressively
          Matter.Body.setVelocity(body, {
            x: body.velocity.x - tangent.x * tangentialVel * 0.95,
            y: body.velocity.y - tangent.y * tangentialVel * 0.95,
          });
        }
      };

      applyPulleyFriction(ballA);
      applyPulleyFriction(ballB);

      // Auto-expand canvas if masses near bottom
      if (render && render.canvas) {
        try {
          const margin = 120;
          const opts = render.options as unknown as { height?: number };
          const canvasHeight = (render.options && opts.height) ? opts.height : render.canvas.height;
          const maxY = Math.max(ballA.position.y, ballB.position.y);
          const threshold = canvasHeight - margin;
          if (maxY + 25 > threshold) {
            const newHeight = Math.max(canvasHeight * 1.2, maxY + 25 + margin);
            if (render.options) render.options.height = newHeight;
            render.canvas.height = Math.floor(newHeight);
            if (render.canvas.style) render.canvas.style.height = `${newHeight}px`;

            // Move ground down to stay at bottom
            try {
              Matter.Body.setPosition(ground, { x: ground.position.x, y: newHeight + 40 });
            } catch (e) {
              console.error("Error repositioning ground:", e);
            }

            // Update render bounds if present
            if (render.bounds) {
              render.bounds.max.y = newHeight;
            }
          }
        } catch (e) {
          console.error("Error auto-expanding canvas:", e);
        }
      }

      // store previous velocities for next step
      prevVelARef.current = { x: ballA.velocity.x, y: ballA.velocity.y };
      prevVelBRef.current = { x: ballB.velocity.x, y: ballB.velocity.y };
    });

    // -----------------------------
    // Rope drawing (fixed)
    // -----------------------------
    Matter.Events.on(render, "afterRender", () => {
      const ctx = render.context;

      ctx.strokeStyle = ropeBroken ? "#ff3333" : "white";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(ballA.position.x, ballA.position.y);
      ctx.lineTo(pulleyX - 20, pulleyY);

      // Arc over pulley
      ctx.arc(pulleyX, pulleyY, 20, Math.PI, 0, false);

      ctx.lineTo(ballB.position.x, ballB.position.y);
      ctx.stroke();

      // Pulley visual — show wear by tinting and slightly changing groove radius
      const worn = typeof pulleyWear !== 'undefined' ? pulleyWear : 0;
      const baseR = 20;
      const grooveShrink = Math.min(worn * 10, 6); // groove gets shallower as it wears
      const pulleyColor = pulleySeized ? '#6b2b2b' : `rgb(${150 - worn * 60}, ${150 - worn * 40}, ${150 - worn * 40})`;

      ctx.beginPath();
      ctx.fillStyle = pulleyColor;
      ctx.arc(pulleyX, pulleyY, baseR, 0, Math.PI * 2);
      ctx.fill();

      // inner groove (visual depth = baseR - grooveShrink)
      ctx.beginPath();
      ctx.fillStyle = '#ccc';
      ctx.arc(pulleyX, pulleyY, Math.max(6, baseR - grooveShrink), 0, Math.PI * 2);
      ctx.fill();

      // -----------------------------
      // Info overlay (draw textual debug data)
      // -----------------------------
      try {
        ctx.save();
        ctx.font = '14px monospace';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'top';
        const infoX = 10;
        let infoY = 10;
        ctx.fillText(`Masa 1: ${Number(mass1Ref.current).toFixed(1)} kg`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Masa 2: ${Number(mass2Ref.current).toFixed(1)} kg`, infoX, infoY);
        infoY += 18;
        // tensions (N)
        ctx.fillText(`Tensión M1: ${Number(tensionARef.current).toFixed(2)} N`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Tensión M2: ${Number(tensionBRef.current).toFixed(2)} N`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Desgaste cuerda: ${(ropeWear * 100).toFixed(1)}%`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Desgaste polea: ${(pulleyWear * 100).toFixed(1)}%`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Cuerda: ${ropeBroken ? 'ROTA' : 'OK'}`, infoX, infoY);
        infoY += 18;
        ctx.fillText(`Polea: ${pulleySeized ? 'BLOQUEADA' : 'OK'}`, infoX, infoY);
        ctx.restore();
      } catch (e) {
        console.error("Error drawing info overlay:", e);
        // In test env the mocked context may ignore text methods — swallow errors
      }
    });

    // Keep refs so we can start/stop from the UI
    renderRef.current = render;

    // Note: do NOT run the runner/render immediately — wait for user to press Play


    // Cleanup
    return () => {
      // stop if running
      try {
        if (renderRef.current) Matter.Render.stop(renderRef.current);
        if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      } catch (e) {
        console.error("Error during cleanup stop:", e);
      }
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      if (render && render.canvas && render.canvas.remove) render.canvas.remove();
      render.textures = {};
    };
  }, []);

  const startSimulation = () => {
    if (running) return;
    const engine = engineRef.current;
    if (!runnerRef.current) runnerRef.current = Matter.Runner.create();
    Matter.Runner.run(runnerRef.current, engine);
    if (renderRef.current) Matter.Render.run(renderRef.current);
    setRunning(true);
  };

  const stopSimulation = () => {
    if (!running) return;
    try {
      if (renderRef.current) Matter.Render.stop(renderRef.current);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
    } catch (e) {
      console.error("Error stopping simulation:", e);
    }
    setRunning(false);
  };

  // Update densities when sliders change
  useEffect(() => {
    const world = engineRef.current.world;
    const bodies = Matter.Composite.allBodies(world);
    const ballA = bodies.find((b) => b.render.fillStyle === "#03DAC5");
    const ballB = bodies.find((b) => b.render.fillStyle === "#BB86FC");

    if (ballA && ballB) {
      Matter.Body.setDensity(ballA, mass1 / 1000);
      Matter.Body.setDensity(ballB, mass2 / 1000);

      // small balancing force
      const diff = (mass1 - mass2) * 0.0002;
      Matter.Body.applyForce(ballA, ballA.position, { x: 0, y: diff });
      Matter.Body.applyForce(ballB, ballB.position, { x: 0, y: -diff });
    }
  }, [mass1, mass2]);

  return (
    <div className="bg-[#111] flex flex-col items-center text-white">
      <div ref={sceneRef} />
      <div style={{ width: "800px", padding: "10px" }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={() => (running ? stopSimulation() : startSimulation())}
            style={{ padding: '6px 12px', borderRadius: 6, background: running ? '#ff5252' : '#4caf50', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {running ? 'Pausa' : 'Play'}
          </button>
          <div style={{ color: '#ddd', fontSize: 14 }}>{running ? 'Simulación en marcha' : 'Simulación en pausa'}</div>
        </div>
        <WeightSlider label="Masa 1 (Cian)" value={mass1} onChange={setMass1} />
        <div style={{ height: 8 }} />
        <WeightSlider label="Masa 2 (Magenta)" value={mass2} onChange={setMass2} />
      </div>
    </div>
  );
};

export default PulleySimulation;
