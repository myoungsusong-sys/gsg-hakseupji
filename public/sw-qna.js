/* 📬 질문함 해설 도착 알림 서비스워커 (2026-09-28)
 * 캐시·fetch 는 건드리지 않는다(옛 화면이 남는 사고 방지) — 푸시 표시와 알림 클릭만 담당한다.
 * 푸시를 보내는 쪽: /api/diagnose 의 qna-done (워커가 해설을 올리는 순간). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: '📬 해설이 도착했어요', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || '📬 해설이 도착했어요', {
    body: d.body || '질문함에서 확인하세요',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: d.tag || 'qna',
    renotify: true,
    requireInteraction: true,
    vibrate: [180, 80, 180],
    data: { url: d.url || '/#/student/questions' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/#/student/questions'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const mine = list.find((c) => c.url && c.url.startsWith(self.location.origin)) || list[0]
    if (mine && 'focus' in mine) {
      return mine.focus().then((w) => (w && w.navigate ? w.navigate(url).catch(() => {}) : undefined)).catch(() => {})
    }
    return self.clients.openWindow(url)
  }))
})
