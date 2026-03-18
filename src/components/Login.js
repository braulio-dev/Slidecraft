import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const PARTICLE_COUNT = 18;
const COLORS = ['rgba(59,130,246,', 'rgba(37,99,235,', 'rgba(96,165,250,', 'rgba(29,78,216,'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function createParticle(W, H) {
  const type = Math.random() < 0.6 ? 'slide' : 'line';
  return {
    type,
    x: randomBetween(0, W),
    y: randomBetween(0, H),
    w: type === 'slide' ? randomBetween(48, 100) : randomBetween(40, 120),
    h: type === 'slide' ? 0 : 0,
    vx: randomBetween(-0.25, 0.25),
    vy: randomBetween(-0.18, 0.18),
    angle: randomBetween(0, Math.PI * 2),
    vAngle: randomBetween(-0.003, 0.003),
    alpha: randomBetween(0.06, 0.22),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    // for 'line' type: second endpoint offset
    dx: randomBetween(-80, 80),
    dy: randomBetween(-60, 60),
  };
}

function drawSlide(ctx, p) {
  const w = p.w;
  const h = w * 0.5625; // 16:9
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalAlpha = p.alpha;
  ctx.strokeStyle = p.color + '1)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // slide lines (mock content)
  ctx.globalAlpha = p.alpha * 0.6;
  ctx.beginPath();
  ctx.moveTo(-w * 0.35, -h * 0.15);
  ctx.lineTo(w * 0.35, -h * 0.15);
  ctx.moveTo(-w * 0.35, h * 0.05);
  ctx.lineTo(w * 0.2, h * 0.05);
  ctx.moveTo(-w * 0.35, h * 0.22);
  ctx.lineTo(w * 0.28, h * 0.22);
  ctx.stroke();
  ctx.restore();
}

function drawLine(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalAlpha = p.alpha * 0.7;
  ctx.strokeStyle = p.color + '1)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(p.dx, p.dy);
  // small node at each end
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fillStyle = p.color + '1)';
  ctx.globalAlpha = p.alpha;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.dx, p.dy, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(canvas.width, canvas.height)
      );
    }

    function tick() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.vAngle;
        if (p.x < -120) p.x = W + 60;
        if (p.x > W + 120) p.x = -60;
        if (p.y < -120) p.y = H + 60;
        if (p.y > H + 120) p.y = -60;
        if (p.type === 'slide') drawSlide(ctx, p);
        else drawLine(ctx, p);
      }

      animId = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ background: '#000' }}
    />
  );
}

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.');
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <AnimatedBackground />
        <div className="relative z-10 h-10 w-10 rounded-full border-4 border-blue-500/40 border-t-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#000' }}>
      <AnimatedBackground />
      <Card className="relative z-10 w-full max-w-sm border-blue-500/20 shadow-2xl shadow-blue-950/60" style={{ background: 'rgba(5,8,18,0.85)', backdropFilter: 'blur(12px)' }}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold text-foreground">Slidecraft</CardTitle>
          <CardDescription className="text-muted-foreground">
            AI-Powered Presentation Generator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Contact your administrator for account access
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
