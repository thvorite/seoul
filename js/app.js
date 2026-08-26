(function () {
  'use strict';

  var DATA = window.VENUE_DATA || { busan: [], jeju: [] };

  var state = {
    region: 'jeju',
    from: null, // {event, place, address, lat, lon}
    to: null,
  };

  var els = {
    fromInput: document.getElementById('fromInput'),
    toInput: document.getElementById('toInput'),
    fromCombo: document.getElementById('fromCombo'),
    toCombo: document.getElementById('toCombo'),
    fromDropdown: document.getElementById('fromDropdown'),
    toDropdown: document.getElementById('toDropdown'),
    swapBtn: document.getElementById('swapBtn'),
    resultArea: document.getElementById('resultArea'),
  };

  function venuesForRegion() {
    return DATA[state.region] || [];
  }

  function labelOf(v) {
    return v.event + (v.place ? ' · ' + v.place : '');
  }

  // ---------- searchable combobox ----------
  function buildCombo(kind) {
    var input = kind === 'from' ? els.fromInput : els.toInput;
    var dropdown = kind === 'from' ? els.fromDropdown : els.toDropdown;
    var comboEl = kind === 'from' ? els.fromCombo : els.toCombo;

    function renderOptions(query) {
      var list = venuesForRegion();
      var q = (query || '').trim().toLowerCase();
      var filtered = list.filter(function (v) {
        if (!q) return true;
        var hay = (v.event + ' ' + (v.place || '') + ' ' + (v.address || '')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });

      dropdown.innerHTML = '';
      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '일치하는 종목이 없습니다.';
        dropdown.appendChild(empty);
      } else {
        filtered.slice(0, 200).forEach(function (v) {
          var opt = document.createElement('div');
          opt.className = 'opt';
          var main = document.createElement('div');
          main.textContent = v.event;
          opt.appendChild(main);
          if (v.place) {
            var sub = document.createElement('div');
            sub.className = 'place-name';
            sub.textContent = v.place + (v.address ? ' · ' + v.address : '');
            opt.appendChild(sub);
          }
          opt.addEventListener('click', function () {
            selectVenue(kind, v);
          });
          dropdown.appendChild(opt);
        });
      }
      dropdown.classList.add('open');
    }

    input.addEventListener('focus', function () {
      renderOptions(input.value);
    });
    input.addEventListener('input', function () {
      if (state[kind] && input.value !== labelOf(state[kind])) {
        state[kind] = null;
        comboEl.classList.remove('has-value');
        renderResult();
      }
      renderOptions(input.value);
    });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        dropdown.classList.remove('open');
      }, 150);
    });

    comboEl.querySelector('.clear-btn').addEventListener('click', function () {
      state[kind] = null;
      input.value = '';
      comboEl.classList.remove('has-value');
      input.focus();
      renderOptions('');
      renderResult();
    });
  }

  function selectVenue(kind, venue) {
    state[kind] = venue;
    var input = kind === 'from' ? els.fromInput : els.toInput;
    var dropdown = kind === 'from' ? els.fromDropdown : els.toDropdown;
    var comboEl = kind === 'from' ? els.fromCombo : els.toCombo;
    input.value = labelOf(venue);
    comboEl.classList.add('has-value');
    dropdown.classList.remove('open');
    renderResult();
  }

  // ---------- swap ----------
  els.swapBtn.addEventListener('click', function () {
    var tmp = state.from;
    state.from = state.to;
    state.to = tmp;
    els.fromInput.value = state.from ? labelOf(state.from) : '';
    els.toInput.value = state.to ? labelOf(state.to) : '';
    els.fromCombo.classList.toggle('has-value', !!state.from);
    els.toCombo.classList.toggle('has-value', !!state.to);
    renderResult();
  });

  // ---------- distance ----------
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ---------- deep links ----------
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  function openWithFallback(scheme, storeUrlIOS, storeUrlAndroid, androidIntentUrl) {
    if (isAndroid() && androidIntentUrl) {
      window.location.href = androidIntentUrl;
      return;
    }
    if (isIOS()) {
      var fellBack = false;
      var timer = setTimeout(function () {
        if (!fellBack) {
          fellBack = true;
          window.location.href = storeUrlIOS;
        }
      }, 1300);
      var onVis = function () {
        if (document.hidden) {
          fellBack = true;
          clearTimeout(timer);
        }
      };
      document.addEventListener('visibilitychange', onVis, { once: true });
      window.location.href = scheme;
      return;
    }
    // desktop / unknown: just try the scheme, browser will ignore if unsupported
    window.location.href = scheme;
  }

  function kakaoWebRouteUrl(from, to) {
    var f = encodeURIComponent(from.place || from.event) + ',' + from.lat + ',' + from.lon;
    var t = encodeURIComponent(to.place || to.event) + ',' + to.lat + ',' + to.lon;
    return 'https://map.kakao.com/link/from/' + f + '/to/' + t;
  }

  function openKakaoApp(from, to) {
    var scheme = 'kakaomap://route?sp=' + from.lat + ',' + from.lon +
      '&ep=' + to.lat + ',' + to.lon + '&by=CAR';
    var storeIOS = 'https://apps.apple.com/app/id304608425';
    var androidIntent = 'intent://route?sp=' + from.lat + ',' + from.lon +
      '&ep=' + to.lat + ',' + to.lon + '&by=CAR#Intent;scheme=kakaomap;' +
      'package=net.daum.android.map;' +
      'S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=net.daum.android.map') +
      ';end';
    openWithFallback(scheme, storeIOS, null, androidIntent);
  }

  function openTmapApp(from, to) {
    var coordParams = '&reqCoordType=WGS84&resCoordType=WGS84';
    var scheme = 'tmap://route?startx=' + from.lon + '&starty=' + from.lat +
      '&goalx=' + to.lon + '&goaly=' + to.lat + coordParams;
    // Plain scheme navigation on every platform — matches the previous
    // (106th) version, which just used <a href="tmap://...">. An Android
    // intent:// wrapper was tried here but its package name didn't reliably
    // match the installed app, so it bounced to the Play Store instead of
    // opening Tmap.
    window.location.href = scheme;
  }

  // ---------- render result ----------
  function renderResult() {
    var area = els.resultArea;
    area.innerHTML = '';

    if (!state.from || !state.to) {
      var ph = document.createElement('div');
      ph.className = 'card placeholder';
      ph.textContent = '출발 종목과 도착 종목을 선택하면 경로 안내가 표시됩니다.';
      area.appendChild(ph);
      return;
    }

    if (state.from.event === state.to.event && state.from.place === state.to.place) {
      var notice = document.createElement('div');
      notice.className = 'notice';
      notice.textContent = '출발지와 도착지가 동일합니다. 다른 종목을 선택해주세요.';
      area.appendChild(notice);
    }

    var card = document.createElement('div');
    card.className = 'card';

    var title = document.createElement('div');
    title.className = 'section-title';
    title.innerHTML = '📋 경로 정보';
    card.appendChild(title);

    var table = document.createElement('table');
    table.className = 'route-table';
    table.innerHTML =
      '<thead><tr><th>출발 장소</th><th>도착 장소</th></tr></thead>' +
      '<tbody><tr>' +
      '<td><div class="place">' + escapeHtml(state.from.place || state.from.event) + '</div>' +
      '<div class="addr">' + escapeHtml(state.from.address || '') + '</div></td>' +
      '<td><div class="place">' + escapeHtml(state.to.place || state.to.event) + '</div>' +
      '<div class="addr">' + escapeHtml(state.to.address || '') + '</div></td>' +
      '</tr></tbody>';
    card.appendChild(table);

    var distRow = document.createElement('div');
    distRow.className = 'distance-row';
    if (state.from.lat != null && state.to.lat != null) {
      var km = haversineKm(state.from.lat, state.from.lon, state.to.lat, state.to.lon);
      distRow.innerHTML = '직선거리 <strong>' + km.toFixed(1) + ' km</strong>';
    } else {
      distRow.textContent = '좌표 정보가 없어 거리를 계산할 수 없습니다.';
    }
    card.appendChild(distRow);

    var btnStack = document.createElement('div');
    btnStack.className = 'btn-stack';

    var webBtn = document.createElement('a');
    webBtn.className = 'btn btn-kakao-web';
    webBtn.target = '_blank';
    webBtn.rel = 'noopener';
    webBtn.href = kakaoWebRouteUrl(state.from, state.to);
    webBtn.innerHTML = '<span class="ico">🌐</span> 카카오맵 웹에서 보기';
    btnStack.appendChild(webBtn);

    var kakaoBtn = document.createElement('button');
    kakaoBtn.type = 'button';
    kakaoBtn.className = 'btn btn-kakao-app';
    kakaoBtn.innerHTML = '<span class="ico">🗺️</span> 카카오맵 앱으로 열기';
    kakaoBtn.addEventListener('click', function () {
      openKakaoApp(state.from, state.to);
    });
    btnStack.appendChild(kakaoBtn);

    var tmapBtn = document.createElement('button');
    tmapBtn.type = 'button';
    tmapBtn.className = 'btn btn-tmap';
    tmapBtn.innerHTML = '<span class="ico">🚗</span> Tmap 앱으로 열기';
    tmapBtn.addEventListener('click', function () {
      openTmapApp(state.from, state.to);
    });
    btnStack.appendChild(tmapBtn);

    card.appendChild(btnStack);
    area.appendChild(card);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- install banner ----------
  function setupInstallBanner() {
    var banner = document.getElementById('installBanner');
    var msg = document.getElementById('installMsg');
    var btn = document.getElementById('installBtn');
    var dismiss = document.getElementById('installDismiss');
    var deferredPrompt = null;

    var standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) return;

    if (sessionStorage.getItem('installBannerDismissed') === '1') return;

    dismiss.addEventListener('click', function () {
      banner.classList.remove('show');
      sessionStorage.setItem('installBannerDismissed', '1');
    });

    if (isIOS()) {
      msg.textContent = 'Safari 하단 공유 버튼(⬆️)을 누른 뒤 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있어요.';
      banner.classList.add('show');
      return;
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.style.display = 'inline-block';
      msg.textContent = '앱처럼 설치해서 바로 실행할 수 있어요.';
      banner.classList.add('show');
    });

    btn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        banner.classList.remove('show');
      });
    });
  }

  buildCombo('from');
  buildCombo('to');
  renderResult();
  setupInstallBanner();
})();
