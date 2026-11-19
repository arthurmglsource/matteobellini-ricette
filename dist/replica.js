(() => {
 const selection=document.getElementById('book-selection'),sticky=document.querySelector('body > div.fixed');
 const bumps=[...document.querySelectorAll('.book-bump')], covers=[...document.querySelectorAll('#oferta button[aria-pressed]')];
 const chosen=[false,false];
 const money=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 function update(){
  const total=money(18.97+chosen.filter(Boolean).length*6.97);
  bumps.forEach((label,i)=>{const b=label.querySelector('[role=checkbox]');b.setAttribute('aria-checked',chosen[i]);b.dataset.state=chosen[i]?'checked':'unchecked';b.textContent=chosen[i]?'✓':'';label.querySelector('input').checked=chosen[i];covers[i].setAttribute('aria-pressed',chosen[i]);});
  document.querySelector('.purchase-total').textContent=total;
  document.querySelectorAll('.btn-buy,#acheter > button').forEach(b=>{b.textContent=(chosen.some(Boolean)?'Je veux les livres':'Je veux le livre')+' · '+total;b.setAttribute('aria-label','Acheter le livre pour '+total);});
  const dl=document.querySelector('#book-selection dl');dl.querySelectorAll('[data-extra]').forEach(n=>n.remove());chosen.forEach((v,i)=>{if(v){const row=document.createElement('div');row.dataset.extra='true';row.className='flex items-baseline justify-between gap-4';const dt=document.createElement('dt');dt.textContent=i?'Noël de Chef, Fait Maison':'Gâteaux de Chef, Faits Maison';const dd=document.createElement('dd');dd.className='shrink-0 font-semibold';dd.textContent='6,97 €';row.append(dt,dd);dl.append(row);}});
 }
 bumps.forEach((l,i)=>l.addEventListener('click',e=>{e.preventDefault();chosen[i]=!chosen[i];update();}));covers.forEach((b,i)=>b.addEventListener('click',()=>{chosen[i]=!chosen[i];update();}));
 function openSelection(){selection.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});selection.classList.remove('selection-glow');requestAnimationFrame(()=>selection.classList.add('selection-glow'));setTimeout(()=>selection.classList.remove('selection-glow'),1600);}
 document.querySelectorAll('.btn-buy').forEach(b=>b.addEventListener('click',openSelection));
 document.querySelector('#acheter > button').addEventListener('click',()=>{window.location.href='https://cuisine-antoine.shop/?acheter=1#acheter';});
 let visible=false;function syncSticky(){sticky.classList.toggle('translate-y-full',scrollY<=700||visible);sticky.classList.toggle('translate-y-0',scrollY>700&&!visible);}
 new IntersectionObserver(e=>{visible=e.some(v=>v.isIntersecting);syncSticky();},{threshold:.05}).observe(selection);window.addEventListener('scroll',syncSticky,{passive:true});
 document.querySelectorAll('.reviews-viewport').forEach(v=>{v.addEventListener('touchstart',()=>v.classList.add('touch-paused'),{passive:true});v.addEventListener('touchend',()=>setTimeout(()=>v.classList.remove('touch-paused'),2500),{passive:true});});
})();
