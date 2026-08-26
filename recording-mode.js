/* ═══════════════════════════════════════════════════════════════════
   RECORDING MODE — automation hooks.

   Only meaningful when <html> has class "recording-mode" (added by the
   inline snippet at the top of <head>, see index.html). Safe to delete
   this file + its <script> tag + recording-mode.css + the inline
   activation snippet to fully remove recording mode.

   Exposes:
     window.__heroReady               Promise, resolves when the hero
                                       letter intro + hero-actions have
                                       finished animating.
     window.__revealSection(id)       Promise, resolves when every
                                       .reveal element inside #id has
                                       become .visible and finished its
                                       transition/animation. Also fires
                                       a 'section-settled' CustomEvent
                                       on document ({detail:{id}}).
     window.__forceRevealAll()        Instantly (no animation) marks
                                       every .reveal element .visible.
                                       Recording-mode only.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const recording = document.documentElement.classList.contains('recording-mode');

  // Scale down the JS-assigned stagger (gallery grids + paired elements)
  // so recording mode settles fast even though it uses the same code
  // path as normal browsing. No-op when recording mode is off.
  const STAGGER_SCALE = recording ? (1/6) : 1;
  window.__RECORDING_STAGGER_SCALE__ = STAGGER_SCALE;

  // ── window.__heroReady ────────────────────────────────────────────
  function whenAnimDone(el){
    return new Promise(resolve=>{
      if (typeof el.getAnimations === 'function') {
        const anims = el.getAnimations();
        if (anims.length === 0) { resolve(); return; }
        Promise.all(anims.map(a => a.finished ? a.finished.catch(()=>{}) : Promise.resolve()))
          .then(resolve);
        return;
      }
      el.addEventListener('animationend', () => resolve(), { once: true });
      setTimeout(resolve, 4000); // safety net
    });
  }

  (function initHeroReady(){
    const letters = Array.from(document.querySelectorAll('.hero-letter'));
    const actions = document.querySelector('.hero-actions');
    const targets = actions ? letters.concat([actions]) : letters;
    window.__heroReady = targets.length
      ? Promise.all(targets.map(whenAnimDone))
      : Promise.resolve();
  })();

  // ── window.__revealSection(sectionId) ───────────────────────────────
  function waitForVisible(el){
    return new Promise(resolve=>{
      if (el.classList.contains('visible')) { resolve(); return; }
      const mo = new MutationObserver(()=>{
        if (el.classList.contains('visible')) { mo.disconnect(); resolve(); }
      });
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
  function whenSettleDone(el){
    return new Promise(resolve=>{
      let settled = false;
      const finish = () => { if (settled) return; settled = true; resolve(); };
      el.addEventListener('transitionend', finish, { once: true });
      el.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 1000); // safety net for elements with no active transition
    });
  }

  window.__revealSection = function(sectionId){
    const section = document.getElementById(sectionId);
    if (!section) return Promise.resolve();
    const els = Array.from(section.querySelectorAll('.reveal'));
    const finish = () => {
      document.dispatchEvent(new CustomEvent('section-settled', { detail: { id: sectionId } }));
    };
    if (!els.length) { finish(); return Promise.resolve(); }
    return Promise.all(els.map(el => waitForVisible(el).then(() => whenSettleDone(el))))
      .then(finish);
  };

  // ── window.__forceRevealAll() ───────────────────────────────────────
  window.__forceRevealAll = function(){
    if (!recording) {
      console.warn('__forceRevealAll() is only available in recording-mode (?record=1).');
      return;
    }
    const els = document.querySelectorAll('.reveal');
    els.forEach(el=>{
      el.style.setProperty('transition', 'none', 'important');
      el.style.setProperty('animation', 'none', 'important');
      el.classList.add('visible');
    });
    void document.body.offsetHeight; // force reflow so it applies instantly
    requestAnimationFrame(()=>{
      els.forEach(el=>{
        el.style.removeProperty('transition');
        el.style.removeProperty('animation');
      });
    });
  };
})();
