/** 정적 파일 주소에 배포 버전을 붙임: 배포가 바뀌면 주소가 바뀌어 브라우저 캐시의 예전 그림·소리를 쓰지 않음 */
export function ver(url: string): string {
  if (!url || /^(data|blob):/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'v=' + __BUILD_ID__;
}
