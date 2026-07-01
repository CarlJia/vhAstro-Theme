type PaoPaoOptions = {
  radius?: number;
  density?: number;
  clearOffset?: number;
  color?: string;
};

export default (element: Element, options: PaoPaoOptions = {}) => {
  document.querySelectorAll('.vh-paopao').forEach(item => setTimeout(() => item.remove()));
  const config = Object.assign({ radius: 10, density: 0.3, clearOffset: 0.2, color: 'random' }, options);
  let width = 0;
  let height = 0;
  let active = true;
  const canvas = document.createElement('canvas');
  const particles: Particle[] = [];

  const initCanvas = () => {
    width = (element as HTMLElement).offsetWidth;
    height = (element as HTMLElement).offsetHeight;
    Object.assign(canvas.style, { top: '0', zIndex: '0', position: 'absolute', pointerEvents: 'none' });
    element.append(canvas);
    if (element.parentElement) element.parentElement.style.overflow = 'hidden';
    canvas.width = width;
    canvas.height = height;
    canvas.classList.add('vh-paopao');
  };

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  class Particle {
    x = 0;
    y = 0;
    alpha = 0;
    scale = 0;
    speed = 0;
    color = '';

    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = height + 100 * Math.random();
      this.alpha = 0.1 + Math.random() * config.clearOffset;
      this.scale = 0.1 + 0.3 * Math.random();
      this.speed = Math.random();
      this.color = config.color === 'random' ? `rgba(${Math.random() * 255 | 0},0,0,${Math.random().toFixed(2)})` : config.color;
    }

    draw() {
      if (this.alpha <= 0) this.reset();
      this.y -= this.speed;
      this.alpha -= 0.0005;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.scale * config.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  initCanvas();
  const animate = () => {
    if (active) ctx.clearRect(0, 0, width, height);
    particles.forEach(p => p.draw());
    requestAnimationFrame(animate);
  };
  Array.from({ length: width * config.density | 0 }, () => particles.push(new Particle()));
  animate();
  window.addEventListener('scroll', () => active = document.documentElement.scrollTop <= height);
  window.addEventListener('resize', () => {
    width = (element as HTMLElement).clientWidth;
    height = (element as HTMLElement).clientHeight;
    canvas.width = width;
    canvas.height = height;
  });
};
