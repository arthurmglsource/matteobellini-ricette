from pathlib import Path
from bs4 import BeautifulSoup
import subprocess,re,json
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'dist';s=BeautifulSoup((D/'it/index.html').read_text(),'html.parser')
for name in ['dist/index.html','dist/replica.js','dist/assets/styles-C0ke8buv.css']:
 original=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT)
 assert original==(ROOT/name).read_bytes(),f'French file changed: {name}'
assert s.html['lang']=='it'
assert len(s.select('main > section'))==3
assert not s.select('.book-bump, #oferta button[aria-pressed]')
assert len(s.select('#oferta h2 + ul > li'))==8
assert s.select_one('.black-friday a')['href']=='#oferta'
assert s.select_one('.purchase-total').get_text(strip=True)=='9,99 €'
assert len(s.select('#avis'))==1
assert len(s.select('.reviews-group:first-child figure'))==6
assert all('Edizione francese' in f.get_text() for f in s.select('.reviews-group:first-child figure'))
for image in s.find_all('img'):
 assert image['src'].startswith('/it/assets/')
 assert (D/image['src'].split('?')[0].lstrip('/')).is_file(),image['src']
for value in s.stripped_strings:
 assert not re.search(r'\b(Recettes|Gâteaux|Noël|Paiement|Acheter|aujourd|française|ingrédients|étoiles|livre|reç[uue])\b',value),value
for t in s.find_all():
 for attr in ['alt','aria-label','title','content']:
  v=t.get(attr,'')
  assert not re.search(r'(Antoine Mercier|Recettes de Chef|Acheter|Moyens de paiement|étoiles|Gâteaux|Noël)',v),v
assert s.select_one('meta[property="og:locale"]')['content']=='it_IT'
js=(D/'it/replica.js').read_text()
offer=json.loads((ROOT/'tools/offer_it.json').read_text())
assert all(a.get('href')==offer['checkout_url'] and a.get_text(strip=True)=='VOGLIO LE MIE 100 RICETTE — 9,99 €' for a in s.select('a.btn-buy'))
assert len(s.select('a.btn-buy'))==3
assert '18,97' not in str(s) and 'Stripe' not in str(s)
assert 'Garanzia di 15 giorni' in s.get_text()
assert 'Garanzia di 7 giorni' not in str(s)
assert '6,97' not in str(s) and '6.97' not in js
assert [li.get_text() for li in s.select('ul[aria-label="Metodi di pagamento"] li')]==[li.get_text() for li in s.select('ul[aria-label="Metodi di pagamento accettati"] li')]
assert 'open-book-checkout' in js

print('PASS: French files unchanged, complete Italian copy and metadata, 3 sections, 6 original reviewers, single ebook offer, localized assets, all 3 Hotmart links, €9.99 base price, matching verified payment badges and 15-day guarantee checked.')
