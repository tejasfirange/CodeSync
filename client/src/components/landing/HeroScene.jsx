import { useEffect, useRef } from 'react';

const codeLines = [
  'socket.join(roomId)',
  'await saveFile(file)',
  'cursor:move',
  'code:sync',
  'jwt.verify(token)',
  'db.projects.find',
  'emit("chat:new")',
  'version++',
  'monaco.editor',
  'room:users'
];

const HeroScene = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let frameId;
    let width = 0;
    let height = 0;
    let nodes = [];
    let streams = [];

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      nodes = Array.from({ length: Math.max(28, Math.floor(width / 42)) }, (_, index) => ({
        x: (index * 137) % width,
        y: (index * 89) % height,
        vx: (index % 2 ? 0.18 : -0.14) * (1 + (index % 4) / 5),
        vy: (index % 3 ? 0.12 : -0.16) * (1 + (index % 5) / 7),
        color: index % 5 === 0 ? '#f59e0b' : index % 4 === 0 ? '#38bdf8' : '#2dd4bf'
      }));

      streams = Array.from({ length: Math.max(16, Math.floor(width / 70)) }, (_, index) => ({
        x: (index * 71) % width,
        y: -((index * 97) % height),
        speed: 0.7 + (index % 5) * 0.22,
        text: codeLines[index % codeLines.length],
        color: index % 3 === 0 ? '#f59e0b' : '#5eead4'
      }));
    };

    const drawGrid = () => {
      context.strokeStyle = 'rgba(45, 212, 191, 0.11)';
      context.lineWidth = 1;

      for (let x = 0; x < width; x += 48) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      for (let y = 0; y < height; y += 48) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
    };

    const draw = () => {
      context.fillStyle = '#060807';
      context.fillRect(0, 0, width, height);
      drawGrid();

      context.font = '12px Consolas, monospace';
      streams.forEach((stream) => {
        stream.y += stream.speed;
        if (stream.y > height + 30) {
          stream.y = -40;
        }

        context.fillStyle = stream.color;
        context.globalAlpha = 0.36;
        context.fillText(stream.text, stream.x, stream.y);
        context.globalAlpha = 1;
      });

      nodes.forEach((node, index) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
          const next = nodes[nextIndex];
          const distance = Math.hypot(node.x - next.x, node.y - next.y);

          if (distance < 145) {
            context.strokeStyle = `rgba(94, 234, 212, ${0.17 - distance / 1000})`;
            context.beginPath();
            context.moveTo(node.x, node.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }

        context.fillStyle = node.color;
        context.beginPath();
        context.arc(node.x, node.y, 2.3, 0, Math.PI * 2);
        context.fill();
      });

      context.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      context.strokeRect(width * 0.68, height * 0.18, Math.min(300, width * 0.22), 140);
      context.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      context.strokeRect(width * 0.58, height * 0.55, Math.min(360, width * 0.28), 120);

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
};

export default HeroScene;
