from pathlib import Path
from bs4 import BeautifulSoup, Comment
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/'dist'; IT=DIST/'it'
soup=BeautifulSoup((DIST/'index.html').read_text(),'html.parser')
# Resolve the streamed review section at build time; no French React runtime is loaded.
stream=soup.find(id='S:0')
if stream:
 soup.select_one('main #avis').replace_with(stream.find('section').extract());stream.decompose()
for x in soup.find_all(['script','template']):x.decompose()
for c in soup.find_all(string=lambda t:isinstance(t,Comment)):c.extract()
T={
'Recettes de Chef, Faites Maison — Antoine Mercier':'Ricette da chef, fatte in casa — Matteo Bellini',
'Je veux le livre':'Voglio il libro',
'Je veux le livre ·':'Voglio il libro ·',
'100 recettes en photos':'100 ricette con foto',
'Des plats de chef, faits maison en 30 minutes.':'Piatti da chef, fatti in casa in 30 minuti.',
'100 recettes avec 5 ingrédients maximum, sans sucre raffiné ni farine blanche. Pour bien manger le soir sans y passer ta soirée.':'100 ricette con al massimo 5 ingredienti, senza zucchero raffinato né farina bianca. Per mangiare bene a cena senza passare tutta la serata ai fornelli.',
'5.0':'5,0',
'· 3 374 avis vérifiés · Garantie 7 jours · Reçois le livre par e-mail juste après le paiement':'· 3.374 recensioni verificate · Garanzia di 7 giorni · Ricevi il libro via email subito dopo il pagamento',
'Prends les livres aujourd\'hui':'Prendi i libri oggi',
'Menu de 7 jours':'Menù di 7 giorni',
'Liste de courses':'Lista della spesa',
'Tableau des substitutions':'Tabella delle sostituzioni',
'Les bases de la semaine (à préparer le dimanche)':'Preparazioni di base per la settimana (da fare la domenica)',
'Accès immédiat et à vie':'Accesso immediato e a vita',
'En option : 50 gâteaux sans sucre raffiné (+':'Facoltativo: 50 torte senza zucchero raffinato (+',
'💰 Récapitulatif de la commande':'💰 Riepilogo dell’ordine',
'Recettes de Chef, Faites Maison + 4 bonus':'Ricette da chef, fatte in casa + 4 bonus',
'Oui, j\'ajoute le livre de gâteaux pour +':'Sì, aggiungo il libro di torte per +',
'50 gâteaux sans sucre raffiné ni farine blanche. Tu reçois les deux livres dans le même email.':'50 torte senza zucchero raffinato né farina bianca. Ricevi entrambi i libri nella stessa email.',
'UNIQUEMENT AVEC CETTE COMMANDE':'SOLO CON QUESTO ORDINE',
'Noël de Chef, Fait Maison':'Natale da chef, fatto in casa',
'Ajoute le livre de Noël : 50 recettes du Réveillon au 26, avec le saumon gravlax, les Saint-Jacques, la dinde aux marrons et la bûche. Plan du Réveillon et listes de courses inclus.':'Aggiungi il libro di Natale: 50 ricette dalla Vigilia di Natale a Santo Stefano, con salmone gravlax, capesante, tacchino alle castagne e tronchetto di Natale. Programma della Vigilia di Natale e liste della spesa inclusi.',
'Total à payer aujourd\'hui':'Totale da pagare oggi',
'Paiement unique · Sans abonnement':'Pagamento una tantum · Nessun abbonamento',
'🔒 Paiement sécurisé · Protégé par Stripe':'🔒 Pagamento sicuro · Protetto da Stripe',
'Ils ont testé le livre':'Hanno provato il libro',
'Avis de lecteurs qui ont reçu le livre avant sa sortie.':'Recensioni di lettori che hanno ricevuto il libro prima dell’uscita.',
'Un livre magnifique ! Les recettes sont simples, délicieuses et faciles à suivre. J\'adore pouvoir préparer de bons petits plats sans passer des heures en cuisine.':'Un libro magnifico! Le ricette sono semplici, deliziose e facili da seguire. Adoro poter preparare dei buoni piatti senza passare ore in cucina.',
'Très belle découverte ! Les recettes sont variées, les photos donnent vraiment envie et les ingrédients sont faciles à trouver. Je recommande vivement !':'Una bellissima scoperta! Le ricette sono varie, le foto fanno davvero venire l’acquolina in bocca e gli ingredienti sono facili da trovare. Lo consiglio vivamente!',
'Exactement ce que je recherchais ! Des recettes gourmandes, faciles à préparer et avec des ingrédients simples. Un vrai plaisir au quotidien.':'Proprio quello che cercavo! Ricette gustose, facili da preparare e con ingredienti semplici. Un vero piacere ogni giorno.',
'Je suis conquise ! Le livre est très bien présenté et les recettes sont délicieuses. J\'ai déjà testé plusieurs plats et toute la famille adore.':'Mi ha conquistata! Il libro è presentato benissimo e le ricette sono deliziose. Ho già provato diversi piatti e tutta la famiglia li adora.',
'Un excellent livre de cuisine. Les explications sont claires, les recettes rapides et le résultat est toujours appétissant. Très bon achat !':'Un ottimo libro di cucina. Le spiegazioni sono chiare, le ricette veloci e il risultato è sempre appetitoso. Un ottimo acquisto!',
'Un vrai coup de cœur ! J\'aime particulièrement les recettes simples et équilibrées. Idéal pour manger mieux tout en continuant à se faire plaisir.':'Un vero colpo di fulmine! Mi piacciono soprattutto le ricette semplici ed equilibrate. Ideale per mangiare meglio senza rinunciare al piacere della buona tavola.',
'Lecteur test':'Lettore di prova · Edizione francese',
'Paiement sécurisé':'Pagamento sicuro',
'Accès immédiat':'Accesso immediato',
'À vie':'A vita',
'Garantie 7 jours':'Garanzia di 7 giorni',
'Support par email':'Assistenza via email',
'Ce livre contient des recettes de cuisine et ne remplace pas un avis médical ou nutritionnel.':'Questo libro contiene ricette di cucina e non sostituisce un parere medico o nutrizionale.',
'Produit 100 % numérique · Paiement traité par Stripe':'Prodotto 100% digitale · Pagamento elaborato da Stripe',
'CB':'Carte',
'Le livre numérique du chef Antoine Mercier : 100 recettes simples, 5 ingrédients maximum, sans sucre raffiné ni farine blanche. Accès immédiat.':'Il libro digitale dello chef Matteo Bellini: 100 ricette semplici, al massimo 5 ingredienti, senza zucchero raffinato né farina bianca. Accesso immediato.',
'Acheter le livre pour 18,97 €':'Acquista il libro a 18,97 €',
'Note 4,9 sur 5 étoiles · 3 374 avis vérifiés · Garantie 7 jours · Reçois le livre par e-mail juste après le paiement':'Valutazione 5,0 su 5 stelle · 3.374 recensioni verificate · Garanzia di 7 giorni · Ricevi il libro via email subito dopo il pagamento',
'Moyens de paiement':'Metodi di pagamento',
'Moyens de paiement acceptés':'Metodi di pagamento accettati',
'Couverture du livre Recettes de Chef, Faites Maison, d\'Antoine Mercier':'Copertina del libro Ricette da chef, fatte in casa, di Matteo Bellini',
'Recettes de Chef, Faites Maison':'Ricette da chef, fatte in casa',
'Gâteaux de Chef, Faits Maison':'Torte da chef, fatte in casa',
'Récapitulatif de la commande':'Riepilogo dell’ordine',
'Ajouter Gâteaux de Chef':'Aggiungi Torte da chef',
'Ajouter Noël de Chef':'Aggiungi Natale da chef',
'5,0 sur 5 étoiles · 6 avis':'5,0 su 5 stelle · 6 recensioni',
'Avis des lecteurs':'Recensioni dei lettori',
'5 étoiles':'5 stelle',
'Garanties':'Garanzie',
}
unchanged={'html','Sophie Martin','Julien Moreau','Camille Laurent','Élodie Bernard','Thomas Petit','Manon Dubois','SM','JM','CL','ÉB','TP','MD','Apple Pay','Google Pay','PayPal','Visa','Mastercard'}
missing=set()
for node in list(soup.find_all(string=True)):
 raw=str(node);key=raw.strip()
 if key in T:node.replace_with(raw.replace(key,T[key]))
 elif re.search(r'[A-Za-zÀ-ÿ]',key) and key not in unchanged:missing.add(key)
for tag in soup.find_all():
 for attr in ['alt','aria-label','title','content']:
  value=tag.get(attr)
  if value in T:tag[attr]=T[value]
soup.html['lang']='it'
for meta in soup.select('meta[property="og:locale"]'):meta['content']='it_IT'
for meta in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):meta['content']='/it/assets/ricette-matteo-bellini.png'
for link in soup.select('link[rel="stylesheet"]'):link['href']='/it/assets/styles.css'
# All original responsive cover slots receive localized artwork.
images={'/capa-256.webp':'/it/assets/ricette-256.webp','/capa-448.webp':'/it/assets/ricette-448.webp','/capa-640.webp':'/it/assets/ricette-640.webp','/capa-bolos.webp':'/it/assets/torte-matteo-bellini.webp','/__l5e/assets-v1/7af78572-82fa-4dba-b99e-a450733cead5/capa-noel.webp':'/it/assets/natale-matteo-bellini.webp'}
for tag in soup.find_all():
 for attr in ['src','srcset','href','imagesrcset']:
  if isinstance(tag.get(attr),str):
   value=tag[attr]
   for old,new in images.items():value=value.replace(old,new)
   tag[attr]=value
for tag in soup.find_all():
 for attr in ['src','srcset','href','imagesrcset']:
  if isinstance(tag.get(attr),str):
   tag[attr]=re.sub(r'(/it/assets/[^,\s]+\.(?:webp|png|css))',r'\1?v=terracotta',tag[attr])
# Offer configuration is shared with the Hotmart purchase links; original French files stay intact.
offer=json.loads((ROOT/'tools/offer_it.json').read_text())
checkout_url=offer['checkout_url']
for node in list(soup.find_all(string=True)):
 value=str(node).replace('18,97 €','9,99 €').replace('Garanzia di 7 giorni','Garanzia di 15 giorni')
 value=value.replace('Pagamento sicuro · Protetto da Stripe','Pagamento sicuro tramite Hotmart').replace('Pagamento elaborato da Stripe','Pagamento sicuro tramite Hotmart')
 if value!=str(node):node.replace_with(value)
for tag in soup.find_all():
 for attr in ['aria-label','content','title','alt']:
  value=tag.get(attr)
  if isinstance(value,str):tag[attr]=value.replace('18,97 €','9,99 €').replace('Garanzia di 7 giorni','Garanzia di 15 giorni')
for button in soup.select('.btn-buy'):
 button.name='a'
 button['href']=checkout_url
 button['aria-label']='Voglio il libro · 9,99 €'
 button['data-checkout']='hotmart'
 button.attrs.pop('type',None)
 button.clear();button.string='Voglio il libro · 9,99 €'
payment_blocks=soup.select('ul[aria-label="Metodi di pagamento"],ul[aria-label="Metodi di pagamento accettati"]')
badge_classes=payment_blocks[0].find('li').get('class',[])
for badges in payment_blocks:
 badges.clear()
 badges['class']=list(dict.fromkeys(badges.get('class',[])+['font-semibold']))
 for method in offer['payment_methods']:
  badge=soup.new_tag('li');badge['class']=badge_classes;badge.string=method;badges.append(badge)
 # A shared assurance group keeps both purchase blocks consistent without enlarging the fixed CTA.
 old_note=badges.find_next_sibling('p')
 if old_note and 'Pagamento sicuro tramite Hotmart' in old_note.get_text():old_note.decompose()
 group=soup.new_tag('div');group['class']=['payment-assurance','mt-4','text-sm','text-muted-on-dark']
 if badges.get('aria-label')=='Metodi di pagamento accettati':group['class'].append('text-center')
 secure=soup.new_tag('p');secure.string='Pagamento sicuro tramite Hotmart';group.append(secure)
 support=soup.new_tag('p');support['class']=['mt-1','text-xs'];support.string=offer['payment_support'];group.append(support)
 badges.insert_after(group)
# Update existing structured offer data, when present; do not invent a new schema.
def update_structured(value):
 if isinstance(value,dict):
  for key,child in list(value.items()):
   if key in ('price','lowPrice','highPrice') and str(child) in ('18.97','18,97'):value[key]='9.99'
   else:update_structured(child)
 elif isinstance(value,list):
  for child in value:update_structured(child)
for script in soup.select('script[type="application/ld+json"]'):
 data=json.loads(script.string or '{}');update_structured(data);script.string=json.dumps(data,ensure_ascii=False)
script=soup.new_tag('script',src='/it/replica.js?v=hotmart-999',defer=True);soup.body.append(script)
(IT/'index.html').write_text(str(soup))
css=(DIST/'assets/styles-C0ke8buv.css').read_text()
colors={'#211e1b':'#211913','#3a3733':'#2c221c','#f7f2ea':'#f7f0e4','#d9a35b':'#be8d73','#c98f45':'#e7a483','#8e5b2e':'#875139','#cfc8be':'#d8c8b8','#fbf5ea':'#f7f0e4','#2a2622':'#2c221c','#a9a59e':'#d8c8b8','#1f2a24':'#211913','#6b6f64':'#6e594b'}
for old,new in colors.items():css=re.sub(re.escape(old),new,css,flags=re.I)
css=css.replace('--checkout-paper:#fff','--checkout-paper:#f7f0e4').replace('--walnut:#875139','--walnut:#be8d73')
css=css.replace('--primary:#be8d73','--primary:#d98c68')
css+='''\n/* Bologna terracotta editorial palette: scoped stylesheet; original French files stay untouched. */
.book-bump{border-color:var(--checkout-change)}
.book-bump [role="checkbox"][data-state="checked"]{background:var(--checkout-change);color:var(--checkout-paper)}
.book-bump.is-selected{box-shadow:0 0 0 1px var(--checkout-change)}
#oferta button[aria-pressed="true"] img{outline:2px solid var(--gold);outline-offset:3px}
footer svg{color:var(--gold)}
.btn-buy{background-color:#d98c68;color:#211913}
.btn-buy:hover{background-color:#e7a483}
.btn-buy:active{background-color:#cf7e59}
'''
(IT/'assets/styles.css').write_text(css)
if missing:raise SystemExit('Untranslated strings: '+repr(missing))
(ROOT/'tools/it-translations.json').write_text(json.dumps(T,ensure_ascii=False,indent=2))
print('Italian HTML and scoped CSS generated; all source copy accounted for.')
