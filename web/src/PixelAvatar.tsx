import {useEffect, useRef} from 'react';
import {sprite, type Look} from './sprites';

// 얼굴이 잘 보이도록 머리와 어깨만 잘라 내는 영역 (열, 행, 폭, 높이)
const BUST = [2, 1, 12, 11] as const;

export function PixelAvatar({look, size, bust = false}: {look: Look; size: number; bust?: boolean}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const art = sprite(undefined, '', 'right', look);
  const [sx, sy, w, h] = bust ? BUST : [0, 0, art.w, art.h];
  // 선명하게 보이도록 도트 한 칸이 정수 픽셀이 되는 크기로 맞춘다
  const width = Math.max(1, Math.round(size / w)) * w;
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(art.img, sx, sy, w, h, 0, 0, w, h);
  }, [art, sx, sy, w, h]);
  return (
    <canvas
      ref={ref}
      className={`rp-pixel${size < 64 ? ' sm' : ''}`}
      width={w}
      height={h}
      style={{width, height: (width * h) / w}}
      role="img"
      aria-label="캐릭터 모습"
    />
  );
}
