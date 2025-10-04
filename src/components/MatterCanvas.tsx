
import React, { useEffect, useRef } from 'react';
import Matter, { Body } from 'matter-js';

const MatterCanvas: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(Matter.Engine.create());

  useEffect(() => {
    const engine = engineRef.current;
    const render = Matter.Render.create({
      element: sceneRef.current!,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false,
        background: '#f0f0f0',
      },
    });

    // Create pulley system
    const pulley = Matter.Constraint.create({
        pointA: { x: 400, y: 100 },
        bodyB: Matter.Bodies.rectangle(300, 300, 50, 50),
        pointB: { x: 0, y: 0 },
        length: 200,
        stiffness: 1,
    });

    const boxB = Matter.Bodies.rectangle(500, 300, 50, 50);
    const constraintB = Matter.Constraint.create({
        pointA: { x: 400, y: 100 },
        bodyB: boxB,
        pointB: { x: 0, y: 0 },
        length: 200,
        stiffness: 1,
    });

    const ground = Matter.Bodies.rectangle(400, 610, 810, 60, { isStatic: true });
    const mouse = Matter.Mouse.create(render.canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false,
        },
      },
    });

    Matter.Composite.add(engine.world, [pulley, pulley.bodyB as Body, boxB, constraintB, ground, mouseConstraint]);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  return <div ref={sceneRef} />;
};

export default MatterCanvas;
