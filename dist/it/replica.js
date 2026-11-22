(() => {
 const selection=document.getElementById('book-selection'),sticky=document.querySelector('body > div.fixed');
 const checkoutUrl='https://pay.hotmart.com/R108565132R?checkoutMode=10';
 window.addEventListener('open-book-checkout',()=>window.location.assign(checkoutUrl));
 let visible=false;function syncSticky(){sticky.classList.toggle('translate-y-full',scrollY<=700||visible);sticky.classList.toggle('translate-y-0',scrollY>700&&!visible);}
 new IntersectionObserver(e=>{visible=e.some(v=>v.isIntersecting);syncSticky();},{threshold:.05}).observe(selection);window.addEventListener('scroll',syncSticky,{passive:true});
 document.querySelectorAll('.reviews-viewport').forEach(v=>{v.addEventListener('touchstart',()=>v.classList.add('touch-paused'),{passive:true});v.addEventListener('touchend',()=>setTimeout(()=>v.classList.remove('touch-paused'),2500),{passive:true});});
})();
