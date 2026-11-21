'use strict';

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer;
  let cursorFrame = 0;
  let activeVisual = null;
  let desired = {x:0,y:0};
  let position = {x:0,y:0};
  let transition;
  const swaps = new WeakMap();

  function stopCursor() {
    if (activeVisual) activeVisual.classList.remove('cursor-active');
    activeVisual = null;
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
  }

  function followCursor() {
    if (!activeVisual?.isConnected) {
      stopCursor();
      return;
    }
    position.x += (desired.x - position.x) * .18;
    position.y += (desired.y - position.y) * .18;
    activeVisual.style.setProperty('--cursor-x', position.x + 'px');
    activeVisual.style.setProperty('--cursor-y', position.y + 'px');
    if (Math.abs(desired.x - position.x) + Math.abs(desired.y - position.y) > .2) {
      cursorFrame = requestAnimationFrame(followCursor);
    } else {
      cursorFrame = 0;
    }
  }

  window.mountMotion = () => {
    observer?.disconnect();
    stopCursor();
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {threshold:.035, rootMargin:'0px 0px 35px 0px'});
    const items = document.querySelectorAll('.project-card,.project-index-row,.work-section-title,.service-group,.roster-panel,.tier-reference,.story-body,.service-highlights');
    items.forEach(element => {
      const bounds = element.getBoundingClientRect();
      // Content already on screen is shown immediately. Scroll reveals only affect content below it.
      if (bounds.top < window.innerHeight) {
        element.classList.add('is-visible');
        return;
      }
      element.classList.add('reveal');
      const siblings = Array.from(element.parentElement.children);
      const columnDelay = Math.max(0,siblings.indexOf(element)) % 3 * 55;
      element.style.setProperty('--reveal-delay', columnDelay + 'ms');
      observer.observe(element);
    });
  };

  window.animateSwap = async (element, update) => {
    const previous = swaps.get(element);
    previous?.animation?.cancel();
    const ticket = {animation:null};
    swaps.set(element,ticket);
    if (reduced.matches || !element.animate) {
      update();
      return;
    }
    ticket.animation = element.animate([
      {opacity:1,transform:'translateY(0)'},
      {opacity:.25,transform:'translateY(5px)'}
    ],{duration:130,easing:'cubic-bezier(.4,0,.7,1)'});
    await ticket.animation.finished.catch(() => {});
    if (swaps.get(element) !== ticket) return;
    update();
    ticket.animation = element.animate([
      {opacity:.35,transform:'translateY(9px)'},
      {opacity:1,transform:'translateY(0)'}
    ],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    ticket.animation.finished.catch(() => {});
  };

  window.transitionPage = update => {
    transition?.skipTransition?.();
    if (document.startViewTransition && !reduced.matches) {
      transition = document.startViewTransition(update);
      transition.finished.finally(() => {transition = null;});
    } else {
      update();
    }
  };

  document.addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType !== 'mouse') return;
    const visual = event.target.closest('.case-visual');
    if (!visual) {
      stopCursor();
      return;
    }
    const bounds = visual.getBoundingClientRect();
    desired = {x:event.clientX - bounds.left,y:event.clientY - bounds.top};
    if (visual !== activeVisual) {
      stopCursor();
      activeVisual = visual;
      position = {...desired};
      activeVisual.classList.add('cursor-active');
    }
    if (!cursorFrame) cursorFrame = requestAnimationFrame(followCursor);
  },{passive:true});
  document.addEventListener('pointerleave',stopCursor);
  window.addEventListener('blur',stopCursor);
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      observer?.disconnect();
      transition?.skipTransition?.();
      stopCursor();
      document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible'));
    } else {
      window.mountMotion();
    }
  });
  window.mountMotion();
})();
