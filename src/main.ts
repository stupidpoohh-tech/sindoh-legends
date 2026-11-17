import Phaser from 'phaser';
import './ui/styles.css';
import { loadRuntimeConfig } from './config/runtime';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { initUi, removeVictory } from './ui/ui';
import { bus } from './core/events';
import { fsm, GameState } from './core/state';
import { save } from './core/save';
import { audio } from './audio/audio';

async function main() {
  await loadRuntimeConfig();
  try {
    await Promise.race([document.fonts?.load('700 16px Freesentation'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* 서체 없으면 시스템 서체 */
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({ w: window.innerWidth, h: window.innerHeight });
  const { w, h } = size();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0a1410',
    scale: { mode: Phaser.Scale.NONE, width: Math.round(w * dpr), height: Math.round(h * dpr), zoom: 1 / dpr },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 2 },
    fps: { target: 60 },
    scene: [BootScene, GameScene],
    banner: false,
  });
  game.registry.set('dpr', dpr);
  (window as any).__game = game;

  let rt = 0;
  const onResize = () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const s = size();
      game.scale.resize(Math.round(s.w * dpr), Math.round(s.h * dpr));
      bus.emit('resize');
    }, 80);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  const startScene = (resume: boolean) => {
    game.scene.start('Game', { resume });
  };

  initUi({
    startGame: (resume) => {
      if (!resume) save.resetProgress();
      startScene(resume);
    },
    restartGame: () => {
      save.resetProgress();
      startScene(false);
      fsm.set(GameState.PLAYING);
      bus.emit('toast', 'GAME MASTER 소환 완료! 처음부터 다시 시작합니다.');
      audio.music('field');
    },
    quitToTitle: () => {
      if (game.scene.isActive('Game') || game.scene.isPaused('Game')) game.scene.stop('Game');
      removeVictory();
      audio.music('none');
      fsm.set(GameState.TITLE);
      bus.emit('boot:ready');
    },
  });
  fsm.set(GameState.TITLE);
}

main();
