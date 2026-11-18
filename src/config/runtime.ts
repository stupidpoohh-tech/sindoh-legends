/**
 * 설정 로더.
 * - 판별 콘텐츠(content/<EDITION>/content.json): 빌드 시 포함 — PUBLIC 빌드에는 PRIVATE 콘텐츠가 들어가지 않음
 * - public/config/assets.json: 실행 시점에 읽음 (빌드 없이 이미지·사운드 교체 가능)
 */
import content from '@content/content.json';
export interface VideoEntry {
  id: string;
  title: string;
  description: string;
  duration?: string;
  src?: string;
  poster?: string;
  unlockBy: string;
}
export interface AssetConfig {
  champion: { name: string; affiliation: string; subtitle: string };
  images: Record<string, string>;
  audio: Record<string, string>;
}

export interface EndingText {
  title: string;
  line1: string;
  line2: string;
}

export const runtime = {
  videos: (content.videos || []) as VideoEntry[],
  ending: content.ending as EndingText,
  titleTag: content.titleTag as string,
  credit: content.credit as string,
  assets: {
    champion: { name: 'GAME MASTER', affiliation: 'SINDOH', subtitle: 'THE LAST SUMMONER' },
    images: {},
    audio: {},
  } as AssetConfig,
};

async function getJson(path: string) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadRuntimeConfig() {
  const assets = await getJson('config/assets.json');
  if (assets && typeof assets === 'object') {
    if (assets.champion) Object.assign(runtime.assets.champion, assets.champion);
    if (assets.images) runtime.assets.images = assets.images;
    if (assets.audio) runtime.assets.audio = assets.audio;
  }
}
