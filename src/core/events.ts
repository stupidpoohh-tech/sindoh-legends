/** 게임 엔진(Phaser)과 HTML UI 사이의 단순 이벤트 버스 */
type Handler = (payload?: any) => void;

class EventBus {
  private map = new Map<string, Set<Handler>>();
  on(ev: string, fn: Handler): () => void {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, payload?: any) {
    const set = this.map.get(ev);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (e) {
        console.error('[bus]', ev, e);
      }
    }
  }
}

export const bus = new EventBus();
