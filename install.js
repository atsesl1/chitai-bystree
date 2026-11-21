const status = document.getElementById('offline-status');

function showFailure() {
  status.textContent = status.dataset.failure ?? 'Офлайн-режим не готов. Оставьте установщик на Mac открытым и обновите страницу.';
}

async function prepareOffline() {
  if (!navigator.serviceWorker) {
    showFailure();
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const worker = registration.installing ?? registration.waiting;
    if (worker) {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && !navigator.serviceWorker.controller) showFailure();
      });
    }
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
    status.textContent = 'Можно читать офлайн';
  } catch {
    showFailure();
  }
}

void prepareOffline();
