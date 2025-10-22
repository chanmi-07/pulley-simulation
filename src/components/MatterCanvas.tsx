import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import WeightSlider from "./WeightSlider";

const PulleySimulation: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(Matter.Engine.create());
  const [mass1, setMass1] = useState(10);
  const [mass2, setMass2] = useState(10);

  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;
    world.gravity.y = 1;

    const width = 800;
    const height = 600;

    // 🔧 Render setup
    const render = Matter.Render.create({
      element: sceneRef.current!,
      engine,
      options: {
        width,
        height,
        background: "#1e1e1e",
        wireframes: false,
      },
    });

    // 📍 Parámetros del sistema
    const pulleyX = width / 2;
    const pulleyY = 150;
    const ropeLength = 600;
    const offsetX = 200;

    // 🟡 Polea fija (solo visual)
    const pulley = Matter.Bodies.circle(pulleyX, pulleyY, 25, {
      isStatic: true,
      render: {
        fillStyle: "#888",
        strokeStyle: "#bbb",
        lineWidth: 3,
      },
    });

    // Hanging masses
    const ballA = Matter.Bodies.circle(pulleyX - offsetX, pulleyY + 250, 25, {
      density: mass1 / 1000,
      restitution: 0, // sin rebote
      frictionAir: 0.01, // leve amortiguación
      friction: 0.2,
      inertia: Infinity, // evita rotación
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

    // 🧱 Piso invisible
    const ground = Matter.Bodies.rectangle(width / 2, height + 40, width, 80, {
      isStatic: true,
      render: { visible: false },
    });

    // 🚫 Barrera invisible entre las masas
    const separator = Matter.Bodies.rectangle(pulleyX, pulleyY + 300, 15, 400, {
      isStatic: true,
      render: { visible: false },
    });

    Matter.World.add(world, [pulley, ballA, ballB, ground, separator]);

    // 🪢 Cuerda rígida (ajuste manual)
    Matter.Events.on(engine, "beforeUpdate", () => {
      const distA = Matter.Vector.magnitude(
        Matter.Vector.sub(ballA.position, { x: pulleyX, y: pulleyY })
      );
      const distB = Matter.Vector.magnitude(
        Matter.Vector.sub(ballB.position, { x: pulleyX, y: pulleyY })
      );
      const total = distA + distB;
      const diff = total - ropeLength;

      if (Math.abs(diff) > 0.001) {
        const dirA = Matter.Vector.normalise(
          Matter.Vector.sub(ballA.position, { x: pulleyX, y: pulleyY })
        );
        const dirB = Matter.Vector.normalise(
          Matter.Vector.sub(ballB.position, { x: pulleyX, y: pulleyY })
        );

        // 🔩 Ajuste instantáneo (sin elasticidad)
        Matter.Body.translate(ballA, Matter.Vector.mult(dirA, -diff * 0.5));
        Matter.Body.translate(ballB, Matter.Vector.mult(dirB, -diff * 0.5));

        // Cancelar pequeñas velocidades que causan oscilación
        Matter.Body.setVelocity(ballA, {
          x: ballA.velocity.x * 0.98,
          y: ballA.velocity.y * 0.98,
        });
        Matter.Body.setVelocity(ballB, {
          x: ballB.velocity.x * 0.98,
          y: ballB.velocity.y * 0.98,
        });
      }
    });

    Matter.Events.on(render, "afterRender", () => {
      const ctx = render.context;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;

      // --- Coordenadas básicas
      const r = 20; // radio de la polea
      const angleA = Math.atan2(pulleyY - ballA.position.y, pulleyX - ballA.position.x);
      const angleB = Math.atan2(pulleyY - ballB.position.y, ballB.position.x - pulleyX);

      // Puntos de tangencia
      const pointA = {
        x: pulleyX - r * Math.cos(angleA),
        y: pulleyY - r * Math.sin(angleA),
      };
      const pointB = {
        x: pulleyX + r * Math.cos(angleB),
        y: pulleyY - r * Math.sin(angleB),
      };

      ctx.beginPath();
      ctx.moveTo(ballA.position.x, ballA.position.y);
      ctx.lineTo(pulleyX - 20, pulleyY);

      // Arco sobre la polea
      // const startAngle = Math.PI + angleA;
      // const endAngle = -angleB;
      ctx.arc(pulleyX, pulleyY, 20, Math.PI, 0, false);

      ctx.lineTo(ballB.position.x, ballB.position.y);
      ctx.stroke();

      // Dibuja el círculo de la polea
      ctx.beginPath();
      ctx.fillStyle = "#999";
      ctx.arc(pulleyX, pulleyY, r, 0, Math.PI * 2);
      ctx.fill();

      // Eje central
      ctx.beginPath();
      ctx.fillStyle = "#ccc";
      ctx.arc(pulleyX, pulleyY, 6, 0, Math.PI * 2);
      ctx.fill();
    });


    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    // 🧹 Limpieza
    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  // ⚖️ Actualizar masas dinámicamente
  useEffect(() => {
    const world = engineRef.current.world;
    const bodies = Matter.Composite.allBodies(world);
    const ballA = bodies.find((b) => b.render.fillStyle === "#03DAC5");
    const ballB = bodies.find((b) => b.render.fillStyle === "#BB86FC");

    if (ballA && ballB) {
      Matter.Body.setDensity(ballA, mass1 / 1000);
      Matter.Body.setDensity(ballB, mass2 / 1000);

      // Pequeño impulso para reajustar tensión sin vibrar
      const diff = (mass1 - mass2) * 0.0003;
      Matter.Body.applyForce(ballA, ballA.position, { x: 0, y: diff });
      Matter.Body.applyForce(ballB, ballB.position, { x: 0, y: -diff });
    }
  }, [mass1, mass2]);

  return (
    <div className="bg-[#111] flex flex-col items-center text-white">
      <div ref={sceneRef} />
      <div style={{ width: "800px", padding: "10px" }}>
        <WeightSlider
          label="Mass 1 (Cyan)"
          value={mass1}
          onChange={setMass1}
        />
        {/* <WeightSlider
          label="Mass 2 (Magenta)"
          value={mass2}
          onChange={setMass2}
        /> */}
      </div>
    </div>
  );
};

export default PulleySimulation;
