"""Typeset Italian covers deterministically; keep portrait and typography separate."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist';A=DIST/'it/assets';F=ROOT/'tools/fonts';F.mkdir(exist_ok=True)
for name,source,weight in [('serif','playfair-display-latin-wght-normal-BOwq7MWX.woff2',700),('italic','playfair-display-latin-wght-italic-DmbndNpe.woff2',400),('sans','source-sans-3-latin-wght-normal-Bo_j9asI.woff2',600)]:
 target=F/(name+'.ttf')
 if not target.exists():
  f=TTFont(DIST/'assets'/source);f=instantiateVariableFont(f,{'wght':weight},inplace=True);f.flavor=None;f.save(target)
BG='#211913';SURFACE='#2C221C';IVORY='#F7F0E4';ACCENT='#D98C68';MUTED='#D8C8B8';BADGE='#E3AA88';COLLECTION='#C18E73'
def font(name,size):return ImageFont.truetype(str(F/(name+'.ttf')),round(size))
def center(draw,text,y,size,name='serif',color=IVORY,width=1280,maxwidth=None,spacing=0):
 f=font(name,size)
 while maxwidth and draw.textlength(text,font=f)+max(0,len(text)-1)*spacing>maxwidth:
  size-=1;f=font(name,size)
 if spacing:
  w=sum(draw.textlength(c,font=f) for c in text)+spacing*(len(text)-1);x=(width-w)/2
  for c in text:draw.text((x,y),c,font=f,fill=color,anchor='lt');x+=draw.textlength(c,font=f)+spacing
 else:draw.text((width/2,y),text,font=f,fill=color,anchor='mt')
def save(image,name):
 image.convert('RGB').save(A/(name+'.png'))
 image.convert('RGB').save(A/(name+'.webp'),quality=96,method=6)
def main():
 W,H=1280,1706
 photo=Image.open(A/'matteo-bologna-portrait.png').convert('RGBA').resize((W,H),Image.Resampling.LANCZOS)
 layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
 center(d,'MATTEO BELLINI',65,29,'sans',IVORY,W,spacing=7)
 # Same upper-right seal placement as the French artwork.
 cx,cy,r=1140,175,92
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=BADGE,outline=BG,width=3)
 d.ellipse((cx-r+8,cy-r+8,cx+r-8,cy+r-8),outline=BG,width=2)
 center(d,'100',116,68,'serif',BG,2*cx)
 center(d,'RICETTE',195,18,'sans',BG,2*cx)
 center(d,'CON FOTO',221,17,'sans',BG,2*cx)
 center(d,'Ricette da chef,',1268,107,'serif',IVORY,W,maxwidth=1120)
 center(d,'fatte in casa',1387,107,'serif',ACCENT,W,maxwidth=1120)
 d.line((555,1516,725,1516),fill=ACCENT,width=2)
 center(d,'100 ricette semplici,',1542,35,'italic',IVORY,W)
 center(d,'senza zucchero raffinato né farina bianca',1586,35,'italic',IVORY,W,maxwidth=1120)
 d.rounded_rectangle((257,1640,1023,1688),radius=24,outline=ACCENT,width=2)
 center(d,'MASSIMO 5 INGREDIENTI · PRONTE IN 30 MINUTI',1652,22,'sans',ACCENT,W,spacing=2)
 layer.save(A/'ricette-typography.png');result=Image.alpha_composite(photo,layer).resize((1536,2048),Image.Resampling.LANCZOS)
 save(result,'ricette-matteo-bellini')
 for size in [256,448,640]:result.resize((size,round(size*4/3)),Image.Resampling.LANCZOS).convert('RGB').save(A/f'ricette-{size}.webp',quality=96,method=6)
def cakes():
 W,H=1200,1600
 image=Image.new('RGBA',(W,H),BG);d=ImageDraw.Draw(image)
 d.rectangle((40,40,1160,1560),outline=COLLECTION,width=2);d.rectangle((52,52,1148,1548),outline='#705346',width=1)
 center(d,'MATTEO BELLINI',138,29,'sans',COLLECTION,W,spacing=9)
 d.line((510,200,581,200),fill=COLLECTION,width=2);d.line((620,200,691,200),fill=COLLECTION,width=2);d.ellipse((594,193,607,207),outline=COLLECTION,width=2)
 center(d,'50',322,315,'serif',COLLECTION,W)
 center(d,'RICETTE DI TORTE',659,32,'sans',IVORY,W,spacing=7)
 center(d,'Torte da chef,',824,109,'serif',IVORY,W,maxwidth=1060)
 center(d,'fatte in casa',963,109,'serif',COLLECTION,W,maxwidth=1060)
 d.line((530,1107,671,1107),fill=COLLECTION,width=2)
 center(d,'Torte fatte in casa senza zucchero raffinato',1150,38,'italic',IVORY,W,maxwidth=1000)
 center(d,'né farina bianca',1210,38,'italic',IVORY,W)
 d.rounded_rectangle((140,1310,1060,1375),radius=32,outline=COLLECTION,width=2)
 center(d,'OGNI GIORNO · CIOCCOLATO · CLASSICI · FESTE',1331,26,'sans',COLLECTION,W,spacing=2)
 center(d,'Il libro dei dolci di Ricette da chef, fatte in casa',1468,25,'sans',MUTED,W)
 save(image,'torte-matteo-bellini')
def christmas():
 W,H=1260,1778
 photo=Image.open(A/'natale-terracotta-photo.png').convert('RGBA').resize((W,H),Image.Resampling.LANCZOS)
 layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
 center(d,'MATTEO BELLINI',99,36,'sans',COLLECTION,W)
 center(d,'Natale da chef,',177,98,'serif',IVORY,W,maxwidth=1150)
 center(d,'fatto in casa',297,98,'serif',IVORY,W,maxwidth=1150)
 d.line((541,427,720,427),fill=COLLECTION,width=3)
 center(d,'50 ricette delle feste, dalla Vigilia di Natale',461,35,'italic',IVORY,W,maxwidth=1120)
 center(d,'a Santo Stefano',512,35,'italic',IVORY,W)
 center(d,'SENZA ZUCCHERO RAFFINATO · SENZA FARINA BIANCA',585,23,'sans',COLLECTION,W,maxwidth=1150)
 layer.save(A/'natale-typography.png');save(Image.alpha_composite(photo,layer),'natale-matteo-bellini')
if __name__=='__main__':
 main();cakes()
 if (A/'natale-terracotta-photo.png').exists():christmas()
 print('Covers typeset with the original typefaces.')
