(() => {
 const selection=document.getElementById('book-selection'),sticky=document.querySelector('body > div.fixed');
 const bumps=[...document.querySelectorAll('.book-bump')], covers=[...document.querySelectorAll('#oferta button[aria-pressed]')];
 const chosen=[false,false];
 const money=n=>n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 function update(){
  const total=money(9.99+chosen.filter(Boolean).length*6.97);
  bumps.forEach((label,i)=>{const b=label.querySelector('[role=checkbox]');b.setAttribute('aria-checked',chosen[i]);b.dataset.state=chosen[i]?'checked':'unchecked';b.textContent=chosen[i]?'✓':'';label.querySelector('input').checked=chosen[i];covers[i].setAttribute('aria-pressed',chosen[i]);label.classList.toggle('is-selected',chosen[i]);});
  document.querySelector('.purchase-total').textContent=total;
  document.querySelectorAll('.btn-buy,#acheter > button').forEach(b=>{b.textContent='Voglio il libro · 9,99 €';b.setAttribute('aria-label','Voglio il libro · 9,99 €');});
  const dl=document.querySelector('#book-selection dl');dl.querySelectorAll('[data-extra]').forEach(n=>n.remove());chosen.forEach((v,i)=>{if(v){const row=document.createElement('div');row.dataset.extra='true';row.className='flex items-baseline justify-between gap-4';const dt=document.createElement('dt');dt.textContent=i?'Natale da chef, fatto in casa':'Torte da chef, fatte in casa';const dd=document.createElement('dd');dd.className='shrink-0 font-semibold';dd.textContent='6,97 €';row.append(dt,dd);dl.append(row);}});
 }
 bumps.forEach((l,i)=>l.addEventListener('click',e=>{e.preventDefault();chosen[i]=!chosen[i];update();}));covers.forEach((b,i)=>b.addEventListener('click',()=>{chosen[i]=!chosen[i];update();}));
 const checkoutUrl='https://pay.hotmart.com/R108565132R?bid=1795048962645';
 window.addEventListener('open-book-checkout',()=>window.location.assign(checkoutUrl));
 let visible=false;function syncSticky(){sticky.classList.toggle('translate-y-full',scrollY<=700||visible);sticky.classList.toggle('translate-y-0',scrollY>700&&!visible);}
 new IntersectionObserver(e=>{visible=e.some(v=>v.isIntersecting);syncSticky();},{threshold:.05}).observe(selection);window.addEventListener('scroll',syncSticky,{passive:true});
 document.querySelectorAll('.reviews-viewport').forEach(v=>{v.addEventListener('touchstart',()=>v.classList.add('touch-paused'),{passive:true});v.addEventListener('touchend',()=>setTimeout(()=>v.classList.remove('touch-paused'),2500),{passive:true});});
})();
