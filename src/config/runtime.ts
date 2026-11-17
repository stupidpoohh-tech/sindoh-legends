/** public/config/*.json 을 실행 시점에 읽어오는 설정 로더 (빌드 없이 교체 가능) */
export interface VideoEntry {
  id: string;
  title: string;
  description: string;
  duration?: string;
  src: string;
  poster?: string;
  unlockBy: string;
}
export interface AssetConfig {
  champion: { name: string; affiliation: string; subtitle: string };
  images: Record<string, string>;
  audio: Record<string, string>;
}

export const runtime = {
  videos: [] as VideoEntry[],
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
  const [media, assets] = await Promise.all([getJson('config/media.json'), getJson('config/assets.json')]);
  if (media && Array.isArray(media.videos)) {
    runtime.videos = media.videos.filter((v: any) => v && typeof v.id === 'string');
  }
  if (assets && typeof assets === 'object') {
    if (assets.champion) Object.assign(runtime.assets.champion, assets.champion);
    if (assets.images) runtime.assets.images = assets.images;
    if (assets.audio) runtime.assets.audio = assets.audio;
  }
}
