#!/usr/bin/env python3
"""배포 잠금 — 병합·빌드·커밋·푸시를 한 번에 하나만.
   python3 scripts/with_lock.py bash -c '...'   (잠금을 잡은 채 명령 실행)
🔴 2026-09-28: olso_auto 와 수동 배포가 같은 시각 git 을 건드려 역사②-1 커밋이 빠졌다(f8dc51c/23bebe1).
   olso_auto 도 같은 잠금(~/.hakseupji-deploy.lock)을 잡는다."""
import fcntl, os, subprocess, sys, time
LOCK = os.path.expanduser('~/.hakseupji-deploy.lock')


class 잠금:
    def __enter__(self):
        self.f = open(LOCK, 'a+')
        t = time.time()
        while True:
            try:
                fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB); break
            except BlockingIOError:
                if time.time() - t > 1800:
                    raise SystemExit('🔴 배포 잠금 30분 대기 초과')
                time.sleep(3)
        return self

    def __exit__(self, *a):
        fcntl.flock(self.f, fcntl.LOCK_UN); self.f.close()


if __name__ == '__main__':
    with 잠금():
        sys.exit(subprocess.call(sys.argv[1:]))
