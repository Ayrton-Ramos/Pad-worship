'use strict';

// Envolve toda a lógica para garantir que o DOM esteja pronto e para fornecer mensagens
// de erro mais úteis caso algo não exista.
document.addEventListener('DOMContentLoaded', async () => {
  // Pad de 10 tons: gera 10 pads (sem inputs) que tocam a URL padrão ao clicar ou ao pressionar teclas 1..0
  const PAD_COUNT = 10;
  const container = document.getElementById('pad-container');
  const audioMap = new Map(); // index -> HTMLAudioElement
  // índice do pad que está tocando atualmente (null quando nenhum)
  let currentPlayingIndex = null;
  // Fallback local (opcional). NÃO usaremos mais a URL remota por padrão — o áudio virá da pasta pads/.
  const LOCAL_FALLBACK = 'pads/pratos.mp3';
  // Arquivos locais específicos por pad (relativos à pasta do projeto).
  // Coloque seus sons em uma pasta `pads/` e nomeie como abaixo ou modifique conforme desejar.
  // Exemplo: para usar um som customizado no primeiro pad salve o arquivo em `pads/pad1.mp3`.
  const PAD_LOCAL_FILES = Array(PAD_COUNT).fill(null);
  // Arquivos locais específicos por pad (relativos à pasta do projeto). Configure conforme os arquivos em pads/
  PAD_LOCAL_FILES[0] = 'pads/Pad_B-G#m-Abm.mp3';
  PAD_LOCAL_FILES[1] = 'pads/Pad_C-Am.mp3';
  PAD_LOCAL_FILES[2] = 'pads/Pad_D-Bm.mp3';
  PAD_LOCAL_FILES[3] = 'pads/Pad_E-C#m(Dbm).mp3';
  PAD_LOCAL_FILES[4] = 'pads/Pad_F#(Gb)-D#m(Ebm).mp3';
  PAD_LOCAL_FILES[5] = 'pads/Pad_G-Em.mp3';

  // (Removido) UI de listagem de pads — funcionalidade de detecção/verificação removida conforme pedido.
  
  // Verifica se o fallback local existe (apenas quando servido via HTTP)
  let LOCAL_FALLBACK_AVAILABLE = true;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    try {
      // testa com HEAD para evitar download
      const r = await fetch(LOCAL_FALLBACK, { method: 'HEAD' });
      if (!r.ok) {
        console.warn('Fallback local não encontrado:', LOCAL_FALLBACK);
        LOCAL_FALLBACK_AVAILABLE = false;
      }
    } catch (e) {
      console.warn('Erro ao verificar fallback local:', e);
      LOCAL_FALLBACK_AVAILABLE = false;
    }
  } else {
    // se estiver via file://, não fazemos HEAD; assumimos que o arquivo pode existir localmente
    LOCAL_FALLBACK_AVAILABLE = true;
  }

  // Se a página estiver servida por HTTP(S), tentamos listar automaticamente os arquivos dentro de pads/
  // (funciona com servidores simples como `python -m http.server` ou nosso `server.js` que lista diretórios). Se a página estiver aberta via
  // file://, o fetch será bloqueado por CORS; nesse caso usamos a configuração estática acima.
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    try {
      const res = await fetch('pads/');
      if (res.ok) {
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'))
          .map(a => a.getAttribute('href'))
          .filter(h => h && h.toLowerCase().endsWith('.mp3'));

        if (links.length > 0) {
          // Preenche PAD_LOCAL_FILES com os arquivos encontrados (até PAD_COUNT)
          for (let i = 0; i < Math.min(links.length, PAD_COUNT); i++) {
            // Normalize: se o href for somente o nome do arquivo, prefixamos com pads/
            const href = links[i];
            PAD_LOCAL_FILES[i] = href.startsWith('http') || href.startsWith('pads/') ? href : `pads/${href}`;
          }
          const displayLinks = links.map(l => decodeURIComponent(l));
          console.log('Arquivos encontrados em pads/:', displayLinks.filter(Boolean));
        }
      }
    } catch (err) {
      console.warn('Não foi possível listar a pasta pads/ via HTTP. Usando configuração estática.', err);
    }
  } else {
    console.log('Página aberta via file:// — pulando tentativa de listar pads/ via fetch. Usando configuração estática.');
    // Em file://, podemos verificar os arquivos configurados (se existirem) por tentativa de fetch
    const configuredFiles = PAD_LOCAL_FILES.filter(Boolean);
    if (configuredFiles.length) {
      const missing = [];
      await Promise.all(configuredFiles.map(async (u) => {
        try {
          const resp = await fetch(u, { method: 'HEAD' });
          if (!resp.ok) missing.push(u);
        } catch (e) {
          missing.push(u);
        }
      }));
      // verification UI removed — skipping display
    } else {
      // nothing to display
    }
  }
  // Pads 7..10 permanecem nulos por enquanto

  // Atualiza os rótulos dos pads com base em PAD_LOCAL_FILES sem recriar os elementos
  function populatePadsUIFromConfig() {
    for (let i = 1; i <= PAD_COUNT; i++) {
      const btn = document.querySelector(`.pad[data-index="${i}"]`);
      if (!btn) continue;
      const configured = PAD_LOCAL_FILES[i-1];
      let displayName = `Tom ${i}`;
      if (configured) {
        try {
          const parts = configured.split('/');
          const basename = decodeURIComponent(parts[parts.length - 1]);
          const nameNoExt = basename.replace(/\.[^/.]+$/, '');
          displayName = nameNoExt.replace(/^pad[_-]?/i, '').replace(/[_-]/g, ' ').trim() || displayName;
        } catch (e) {}
      }
      let titleSpan = btn.querySelector('.pad-title');
      if (!titleSpan) {
        titleSpan = document.createElement('span');
        titleSpan.className = 'pad-title';
        btn.appendChild(titleSpan);
      }
      titleSpan.textContent = displayName;
      btn.setAttribute('aria-label', displayName);
    }
  }


  if (!container) {
    console.error('Elemento #pad-container não encontrado no DOM. Verifique o `index.html`.');
    return;
  }



  // Cria os pads (sem campos de URL)
  for (let i = 1; i <= PAD_COUNT; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'pad-wrap';

    const btn = document.createElement('button');
    btn.className = 'pad';
    btn.type = 'button';
    btn.dataset.index = i;
    btn.setAttribute('aria-pressed', 'false');

    const hint = document.createElement('div');
    hint.className = 'small';
    // hint.textContent = `Tecla: ${i % 10}`; // 10 -> 0 mudei aqui

    // Extrai o nome amigável a partir do arquivo configurado e usa como rótulo do botão
    const configured = PAD_LOCAL_FILES[i-1];
    let displayName = `Tom ${i}`;
    if (configured) {
      try {
        const parts = configured.split('/');
        const basename = decodeURIComponent(parts[parts.length - 1]);
        const nameNoExt = basename.replace(/\.[^/.]+$/, '');
        displayName = nameNoExt.replace(/^pad[_-]?/i, '').replace(/[_-]/g, ' ').trim() || displayName;
      } catch (e) {
        // se algo der errado, mantemos o padrão
      }
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'pad-title';
    titleSpan.textContent = displayName;
    btn.appendChild(titleSpan);
    btn.setAttribute('aria-label', displayName);

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    container.appendChild(wrap);

    // Click no pad: alterna ligar/desligar (toggle). Se não houver áudio carregado, carrega e toca.
    btn.addEventListener('click', async () => {
      await toggleAudio(i);
    });
  }

  // Carrega áudio e armazena
  function loadAudioForIndex(index, url) {
    return new Promise((resolve, reject) => {
      try {
        // Remove qualquer áudio anterior
        const previous = audioMap.get(index);
        if (previous) {
          previous.pause();
          previous.src = '';
        }

        const audio = new Audio();
        // Normalize local paths properly: decode repeated encodings and then re-encode each path segment
        function _fullyDecode(s) {
          try {
            let prev, cur = s;
            do {
              prev = cur;
              cur = decodeURIComponent(cur);
            } while (cur !== prev);
            return cur;
          } catch (e) {
            return s;
          }
        }
        function _encodePathSegments(u) {
          return u.split('/').map(p => encodeURIComponent(_fullyDecode(p))).join('/');
        }
        // Para URLs remotas (http/https/ //) mantemos o formato original.
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//'))) {
          audio.src = url;
        } else {
          audio.src = _encodePathSegments(url);
        }
  audio.preload = 'auto';
  // Não forçamos crossOrigin por padrão; isso pode causar falhas quando o servidor remoto
  // não envia cabeçalhos CORS apropriados. Se precisar processar o áudio com Web Audio API,
  // então será necessário habilitar CORS no servidor ou definir crossOrigin com cuidado.

        // Eventos para gerenciar erro/ready
        const onCanPlay = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          audioMap.set(index, audio);
          resolve(audio);
        };
        const onError = (e) => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          console.error('Erro ao carregar o áudio:', e);
          reject(e);
        };

        audio.addEventListener('canplaythrough', onCanPlay, {once:true});
        audio.addEventListener('error', onError, {once:true});

        // Opcional: pré-carregar
        audio.load();
      } catch (err) {
        reject(err);
      }
    });
  }

  function playAudio(index) {
    const audio = audioMap.get(index);
    if (!audio) return;

    // Reinicia se estiver tocando
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn('Playback falhou:', err);
      alert('Falha ao iniciar reprodução. Abra o console do navegador para detalhes.');
    });

    setPadActive(index, true);
    audio.addEventListener('ended', () => setPadActive(index, false), {once:true});
    audio.addEventListener('pause', () => setPadActive(index, false), {once:true});
  }

  // Alterna o estado do áudio: se estiver tocando, para e reseta; se estiver parado/carregado, toca desde o início.
  async function toggleAudio(index) {
    const audio = audioMap.get(index);

    // Se o pad estiver tocando, manter comportamento de toggle: parar imediatamente
    if (audio && !audio.paused && !audio.ended) {
      try { audio._fadeCtrl && (audio._fadeCtrl.cancel = true); } catch (e) {}
      try { audio.pause(); } catch (e) {}
      try { audio.currentTime = 0; } catch (e) {}
      try { audio.volume = 1; } catch (e) {}
      setPadActive(index, false);
      if (currentPlayingIndex === index) currentPlayingIndex = null;
      return;
    }

    // Caso contrário, crossfade para o pad solicitado (carrega se necessário)
    await crossfadeTo(index, 1100);
  }

  // --- Helper: fades (canceláveis) usando requestAnimationFrame para suavidade ---
  function _fadeTo(audio, from, to, duration) {
    return new Promise((resolve) => {
      try {
        // Cancela fade anterior
        if (audio._fadeCtrl) audio._fadeCtrl.cancel = true;
        const ctrl = { cancel: false };
        audio._fadeCtrl = ctrl;
        const startTime = performance.now();
        const step = (now) => {
          if (ctrl.cancel) { resolve(); return; }
          const t = Math.min(1, (now - startTime) / duration);
          audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      } catch (err) {
        // Em caso de erro, resolvemos para não travar a lógica
        resolve();
      }
    });
  }
  function fadeOutAudio(audio, duration) { return _fadeTo(audio, audio.volume || 1, 0, duration); }
  function fadeInAudio(audio, duration) { return _fadeTo(audio, audio.volume || 0, 1, duration); }

  // Crossfade: carrega o áudio se necessário, toca o alvo (com fade-in) e faz fade-out dos demais que estejam tocando
  async function crossfadeTo(index, duration = 1100) {
    // Carrega se necessário (segue mesma ordem de tentativa que antes)
    let target = audioMap.get(index);
    if (!target) {
      const padLocal = PAD_LOCAL_FILES[index - 1];
      let loaded = false;
      if (padLocal) {
        try { await loadAudioForIndex(index, padLocal); loaded = true; } catch (e) { console.warn('Falha ao carregar arquivo local do pad:', e); }
      }
      if (!loaded && LOCAL_FALLBACK && LOCAL_FALLBACK_AVAILABLE) {
        try { await loadAudioForIndex(index, LOCAL_FALLBACK); loaded = true; } catch (e) { console.error('Falha ao carregar fallback local:', e); alert('Erro ao carregar o áudio. Veja o console para detalhes.'); return; }
      } else if (!loaded && LOCAL_FALLBACK && !LOCAL_FALLBACK_AVAILABLE) {
        console.warn('Fallback local configurado mas não disponível:', LOCAL_FALLBACK);
      }
      target = audioMap.get(index);
      if (!target) {
        alert('Nenhum som configurado para este pad. Coloque um arquivo .mp3 em pads/ e atualize a configuração.');
        return;
      }
    }

    // Lista de áudios tocando agora (exclui o alvo)
    const playing = Array.from(audioMap.entries())
      .filter(([idx, a]) => idx !== index && !a.paused && !a.ended)
      .map(([idx, a]) => ({ idx, a }));

    // Prepara e inicia o alvo com volume 0 para fazermos fade-in
    try {
      try { target.pause(); } catch (e) {}
      try { target.currentTime = 0; } catch (e) {}
      target.volume = 0;
      await target.play();
      setPadActive(index, true);
      target.addEventListener('ended', () => {
        setPadActive(index, false);
        if (currentPlayingIndex === index) currentPlayingIndex = null;
      }, { once: true });
    } catch (err) {
      console.warn('Falha ao iniciar reprodução do pad alvo:', err);
      alert('Falha ao iniciar reprodução. Veja o console para detalhes.');
      return;
    }

    // Executa fades: alvo fade-in, demais fade-out (parando-os no fim)
    const fades = [];
    fades.push(fadeInAudio(target, duration));
    for (const { idx, a } of playing) {
      fades.push(
        fadeOutAudio(a, duration).then(() => {
          try { a.pause(); a.currentTime = 0; } catch (e) {}
          try { a.volume = 1; } catch (e) {}
          setPadActive(idx, false);
        })
      );
    }

    await Promise.all(fades);
    // Garantir volume final do alvo e marcar como tocando
    try { target.volume = 1; } catch (e) {}
    currentPlayingIndex = index;
  }

  function setPadActive(index, active) {
    const btn = document.querySelector(`.pad[data-index="${index}"]`);
    if (!btn) return;
    if (active) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed','false');
    }
  }

  // Keyboard mapping: teclas 1..9 e 0 para o 10
  window.addEventListener('keydown', (ev) => {
    // Evita ações se usuário estiver digitando em um campo (não há campos agora, mas mantém a proteção)
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    let key = ev.key;
    if (key === '0') key = '10';
    const num = parseInt(key, 10);
    if (!isNaN(num) && num >= 1 && num <= 10) {
      ev.preventDefault();
      const idx = num === 10 ? 10 : num;
      const btn = document.querySelector(`.pad[data-index="${idx}"]`);
      if (btn) btn.click();
    }
  });

  // Footer buttons
  // Botão parar todos: pausa todos os áudios carregados
  const stopBtn = document.getElementById('stop-all-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopAllAndResetVolume();
    });
  }

  function stopAllAndResetVolume() {
    audioMap.forEach(a => {
      try {
        if (a._fadeCtrl) a._fadeCtrl.cancel = true;
        a.pause();
        a.currentTime = 0;
        a.volume = 1;
      } catch (e) {}
    });
    document.querySelectorAll('.pad').forEach(p => p.classList.remove('active'));
    currentPlayingIndex = null;
  }

  // Fim do código dentro do DOMContentLoaded
});
