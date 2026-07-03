/* ============================================================================
   MOMUTO — Custom product-page shared content.
   ONE file = every custom product page (models added via manage.momuto.com).
   Injects the RTP-aesthetic dark theme + Highlights -> Trust -> How it works ->
   FAQ, plus FAQPage JSON-LD. Same look as the Ready-to-Play product pages.

   Paste ONCE per store, in the product-detail theme block (applies to all products):
     <div id="momuto-custom" data-lang="fr"></div>
     <script src="https://www.momuto.com/custom-content.js?v=1" defer></script>

   Edit content HERE, redeploy via Deploy Static Files, and it propagates to
   every product — no per-product work. data-lang picks the locale; missing
   locales fall back to en.
   ============================================================================ */
(function(){
"use strict";

/* ---- club logos (shared across all locales) ---- */
var LOGOS=[
 ["Nottingham Prisas","https://cdn.staticsoe.com/pics/431ef8bf79e7e510718cee987cdd8a2538fcdddab1de91fcd7f115cb3bb95fa1.png"],
 ["Deportivo JCPE","https://cdn.staticsoe.com/pics/456424f740bef93d3a16ed3e9e4690a66d6f656ccf2acdc59f007c9371d92a10.png"],
 ["Peaule Fest","https://cdn.staticsoe.com/pics/8a887cbd7caaf5ec6b16516ed14a34fa00eb9ac5b57681ad3479fc1bbf9f5dd8.png"],
 ["Dreamteam","https://cdn.staticsoe.com/pics/e1e1549cd706338477e78d4f34d23d44b45430d0b5ee12087083969583536de6.png"],
 ["AEK","https://cdn.staticsoe.com/pics/6f7d20be5d2add7d3fd0973e818e207001b24749156f7024e5c6f8efc3de3ec4.png"],
 ["L'Impasse","https://cdn.staticsoe.com/pics/e5c3a4c131b9694dbb73c1ffbd5b67b38476702e9a8b0a50bb0ae5a506eecadb.png"],
 ["Soviet Rockets","https://cdn.staticsoe.com/pics/96ab5d6c74ce29ff1bf7d872cfccd762347646df5ff630f2248a8fcb6d45562b.png"],
 ["All Stars FC Girls","https://cdn.staticsoe.com/pics/845d6990df27779910a9f21a03e7b283a82ec95015f2e2ea6f7faf540261de39.png"],
 ["Gobinet","https://cdn.staticsoe.com/pics/84cd7d8e3574013e977e66fde4b0bed12a0f6c5db67ea4572cfce23f16ebf4f8.png"],
 ["Free FC","https://cdn.staticsoe.com/pics/65af24adc790f322babfb0b10061e5edb360654b7829c379153f4cd80c4aa723.png"],
 ["Los Bloques","https://cdn.staticsoe.com/pics/6f32f9df3660fc4175d6ce0e6825473be37beb8f6b9b106c61a3e83ef3d8ee47.png"],
 ["Inter Egara","https://cdn.staticsoe.com/pics/c9a0a9bd7ee7b5524005891c3c2cbdcff99239d36601be037b4db49e415d9ed9.png"],
 ["Lario FC","https://cdn.staticsoe.com/pics/a28c2f6f8f427f9c57ae99535b01619aa27802ea9fa7f95e5fc43a80c2eb52aa.png"]
];

/* ---- content per locale (es/fr/it fall back to en) ----
   FR/ES review originals (for those domains):
     Ivan (ES): "10/10 camisetas exactamente como las queríamos y entrega en el plazo que nos dijeron, todo perfecto!"
     Nohan (FR): "Très satisfait de nos maillots personnalisés, super qualité et livraison rapide. Le service client et le contact avec les créateurs est fluide et particulièrement agréable. Merci Momuto je recommande."
*/
/* ---- inline "ask us" WhatsApp CTA (end of FAQ). Shared number; per-locale text. ---- */
var WA_NUMBER="34614625408";
var WA_SVG=`<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" style="vertical-align:-3px;margin-right:8px"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.736-.612.001.001zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;
var CHAT={
 en:["Still have a question?","Message us on WhatsApp","I have a question about this custom kit!"],
 es:["¿Te queda alguna duda?","Escríbenos por WhatsApp","¡Tengo una pregunta sobre esta equipación personalizada!"],
 fr:["Une dernière question ?","Écrivez-nous sur WhatsApp","J'ai une question sur ce maillot personnalisé !"],
 it:["Hai ancora una domanda?","Scrivici su WhatsApp","Ho una domanda su questa maglia personalizzata!"]
};
var I18N={
 en:{
  highlights:[
   ["Fabric","<b>Polyester-elastane</b> with stretch. Sublimation-printed — colours dyed in, so they never crack or peel.",false],
   ["What you get","<b>Jersey</b>, or <b>full kit</b> (jersey + shorts). Names &amp; numbers per player.",false],
   ["Made &amp; shipped","<b>~25–30 days</b> after your order. Free shipping over €49.",false],
   ["You're protected","Pay today, but we <b>don't print</b> until you approve a final mockup — sent <b>within 24h</b>. Change anything, free.",true]
  ],
  trust:{
   lab:"Worn on real pitches", h2:"Trusted by 150+ teams", sub:"Across Europe and North America.",
   reviews:[
    ["Great experience for our team's custom jerseys. The design was exactly as we requested and the whole process was smooth — their team was super responsive and always happy to help. Very happy with the result, highly recommend!","Karim","France"],
    ["10/10 — fast, cheap and good quality!","Olaya","Spain"],
    ["10/10 — the shirts came out exactly as we wanted, delivered right on the date they promised. All perfect!","Ivan Fedi","Spain"],
    ["Really happy with our custom jerseys — great quality and fast delivery. Customer service and the contact with the designers is smooth and genuinely pleasant. Thanks Momuto, highly recommend.","Nohan Dessaint","France"]
   ]
  },
  how:{
   lab:"Simple process", h2:"How it works",
   promise:["Buy now, we perfect it before we print.","You pay today — then we send a final mockup within 24h. We don't make a single kit until you greenlight it."],
   steps:[
    ["Design it","Tap Customise your design above — colours, crest, sponsor, names and numbers."],
    ["Order your squad","Add to cart, enter each player's size, name and number, and check out. One kit or the whole team."],
    ["Greenlight your mockup","Within 24h we send a final mockup of your exact kit. Tweak anything, free. Nothing prints until you approve."],
    ["We make &amp; ship","Once you greenlight, we produce and deliver in ~25–30 days. Free shipping over €49."]
   ]
  },
  faq:{
   lab:"Good to know", h2:"Frequently asked questions", sub:"Everything you need before you order.",
   items:[
    ["Do I pay now, or after I see a mockup?","You pay when you order. Within <b>24 hours</b> we send a final mockup of your exact kit — and we <b>don't print a single piece until you greenlight it</b>. Want a change? Free. Your purchase is protected: you never get a kit you didn't approve."],
    ["What fabric are the kits made from?","A lightweight, breathable <b>polyester-elastane blend</b> with stretch for full freedom of movement. Every design is <b>sublimation-printed</b> — the colours and logos are dyed into the fabric, so they won't crack, peel or fade like a printed transfer."],
    ["How do I choose the right size?","We carry a <b>full youth-to-adult size range</b>. Use the <b>size guide</b> (the \"Find your size\" link when you add your team) to match each player by chest and height. Between sizes, or mixing kids and adults? Just ask before you order."],
    ["Jersey only or full kit — what's included?","Your choice. <b>Jersey only</b> is the shirt. <b>Full kit</b> adds matching <b>shorts</b>. It depends on the product — check the option above."],
    ["Is there a minimum order? How does pricing work?","<b>No minimum</b> — order a single kit or hundreds. The price per unit drops as your order grows, with no hidden fees."],
    ["How long until it arrives?","Production and delivery take roughly <b>25–30 days</b> after your order. Need it for a specific date? Tell us before you order and we'll confirm."],
    ["Will it come out exactly like the preview?","Yes — and you'll see it first. After you order, our team <b>vectorises and cleans your crest &amp; sponsor</b>, refines placement, and sends a <b>final mockup within 24h</b>. Nothing goes to print until you greenlight it."],
    ["Can I add player names and numbers?","Absolutely. Add a name and number per player in your team list at checkout, in your choice of font and colour — mix and match across the whole squad."],
    ["What if something isn't right on the mockup?","Change it — free. You can tweak anything right up until you greenlight your mockup, and we only start production once you've approved. No wrong prints, ever."]
   ]
  }
 },
 es:{
  highlights:[
   ["Tejido","<b>Poliéster-elastano</b> con elasticidad. Estampado por sublimación: los colores se tiñen en la tela, así que nunca se agrietan ni se despegan.",false],
   ["Qué incluye","<b>Camiseta</b>, o <b>kit completo</b> (camiseta + pantalón). Nombres y dorsales por jugador.",false],
   ["Producción y envío","<b>~25–30 días</b> tras tu pedido. Envío gratis a partir de 49 €.",false],
   ["Compra protegida","Pagas hoy, pero <b>no imprimimos</b> hasta que apruebes una maqueta final, enviada <b>en 24 h</b>. Cambia lo que quieras, gratis.",true]
  ],
  trust:{
   lab:"Vistas en el campo", h2:"Más de 150 equipos confían en nosotros", sub:"En toda Europa y Norteamérica.",
   reviews:[
    ["Gran experiencia con las camisetas personalizadas de nuestro equipo. El diseño era exactamente lo que pedimos y todo el proceso fue muy fluido: su equipo respondía rapidísimo y siempre dispuesto a ayudar. ¡Muy contentos con el resultado, totalmente recomendable!","Karim","Francia"],
    ["10/10: ¡rápido, barato y de buena calidad!","Olaya","España"],
    ["10/10 camisetas exactamente como las queríamos y entrega en el plazo que nos dijeron, ¡todo perfecto!","Ivan Fedi","España"],
    ["Muy contentos con nuestras camisetas personalizadas: gran calidad y entrega rápida. La atención al cliente y el contacto con los diseñadores es fluido y muy agradable. ¡Gracias Momuto, lo recomiendo!","Nohan Dessaint","Francia"]
   ]
  },
  how:{
   lab:"Proceso sencillo", h2:"Cómo funciona",
   promise:["Compra ahora; lo perfeccionamos antes de imprimir.","Pagas hoy y luego te enviamos una maqueta final en 24 h. No fabricamos ni una camiseta hasta que le das el visto bueno."],
   steps:[
    ["Diséñalo","Pulsa «Personaliza tu diseño» arriba: colores, escudo, patrocinador, nombres y dorsales."],
    ["Pide para tu equipo","Añade al carrito, indica la talla, el nombre y el dorsal de cada jugador y finaliza la compra. Una camiseta o todo el equipo."],
    ["Aprueba tu maqueta","En 24 h te enviamos una maqueta final de tu equipación exacta. Cambia lo que quieras, gratis. No se imprime nada hasta que la apruebes."],
    ["Fabricamos y enviamos","Una vez aprobada, producimos y entregamos en ~25–30 días. Envío gratis a partir de 49 €."]
   ]
  },
  faq:{
   lab:"Buena información", h2:"Preguntas frecuentes", sub:"Todo lo que necesitas saber antes de comprar.",
   items:[
    ["¿Pago ahora o después de ver una maqueta?","Pagas al hacer el pedido. En <b>24 horas</b> te enviamos una maqueta final de tu equipación exacta, y <b>no imprimimos nada hasta que le das el visto bueno</b>. ¿Quieres un cambio? Gratis. Tu compra está protegida: nunca recibes una equipación que no hayas aprobado."],
    ["¿De qué material son las equipaciones?","Una mezcla ligera y transpirable de <b>poliéster-elastano</b> con elasticidad para total libertad de movimiento. Cada diseño se <b>estampa por sublimación</b>: los colores y logos se tiñen en la tela, así que no se agrietan, despegan ni destiñen como una estampación normal."],
    ["¿Cómo elijo la talla correcta?","Tenemos una <b>gama completa de tallas, de infantil a adulto</b>. Usa la <b>guía de tallas</b> (el enlace «Encuentra tu talla» al añadir tu equipo) para acertar por pecho y altura. ¿Entre tallas o mezclando niños y adultos? Pregúntanos antes de comprar."],
    ["¿Solo camiseta o kit completo? ¿Qué incluye?","Tú eliges. <b>Solo camiseta</b> es la camiseta. <b>Kit completo</b> añade el <b>pantalón</b>. Depende del producto: revisa la opción de arriba."],
    ["¿Hay pedido mínimo? ¿Cómo funcionan los precios?","<b>Sin mínimo</b>: pide una sola equipación o cientos. El precio por unidad baja cuanto mayor es el pedido, sin costes ocultos."],
    ["¿Cuánto tarda en llegar?","La producción y la entrega tardan unos <b>25–30 días</b> tras tu pedido. ¿La necesitas para una fecha concreta? Dínoslo antes de comprar y te lo confirmamos."],
    ["¿Quedará exactamente como la vista previa?","Sí, y la verás primero. Tras tu pedido, nuestro equipo <b>vectoriza y limpia tu escudo y patrocinador</b>, ajusta la colocación y te envía una <b>maqueta final en 24 h</b>. No se imprime nada hasta que le das el visto bueno."],
    ["¿Puedo añadir nombres y dorsales?","Por supuesto. Añade un nombre y un dorsal por jugador en la lista de tu equipo al finalizar la compra, con la tipografía y el color que elijas. Combina como quieras en toda la plantilla."],
    ["¿Y si algo no está bien en la maqueta?","Lo cambiamos, gratis. Puedes ajustar lo que sea hasta que apruebes tu maqueta, y solo empezamos a producir cuando la has aprobado. Sin impresiones erróneas, nunca."]
   ]
  }
 },
 fr:{
  highlights:[
   ["Tissu","<b>Polyester-élasthanne</b> extensible. Imprimé par sublimation : les couleurs sont teintes dans le tissu, elles ne craquent ni ne se décollent jamais.",false],
   ["Ce que vous recevez","<b>Maillot</b>, ou <b>kit complet</b> (maillot + short). Noms et numéros par joueur.",false],
   ["Fabrication et envoi","<b>~25–30 jours</b> après votre commande. Livraison offerte dès 49 €.",false],
   ["Achat protégé","Vous payez aujourd'hui, mais nous <b>n'imprimons rien</b> avant que vous validiez une maquette finale, envoyée <b>sous 24h</b>. Modifiez ce que vous voulez, gratuitement.",true]
  ],
  trust:{
   lab:"Portés sur le terrain", h2:"Plus de 150 équipes nous font confiance", sub:"Partout en Europe et en Amérique du Nord.",
   reviews:[
    ["Très bonne expérience pour les maillots personnalisés de notre équipe. Le design était exactement comme demandé et tout le processus a été fluide : leur équipe répondait très vite et toujours prête à aider. Très contents du résultat, je recommande vivement !","Karim","France"],
    ["10/10 — rapide, pas cher et de bonne qualité !","Olaya","Espagne"],
    ["10/10, les maillots exactement comme nous les voulions et livrés dans les délais annoncés, tout parfait !","Ivan Fedi","Espagne"],
    ["Très satisfait de nos maillots personnalisés, super qualité et livraison rapide. Le service client et le contact avec les créateurs est fluide et particulièrement agréable. Merci Momuto, je recommande.","Nohan Dessaint","France"]
   ]
  },
  how:{
   lab:"Un processus simple", h2:"Comment ça marche",
   promise:["Achetez maintenant, on perfectionne avant d'imprimer.","Vous payez aujourd'hui, puis on vous envoie une maquette finale sous 24h. On ne fabrique pas un seul maillot avant votre validation."],
   steps:[
    ["Personnalisez","Cliquez sur « Personnalisez votre design » ci-dessus — couleurs, écusson, sponsor, noms et numéros."],
    ["Commandez pour votre équipe","Ajoutez au panier, saisissez la taille, le nom et le numéro de chaque joueur, puis payez. Un maillot ou toute l'équipe."],
    ["Validez votre maquette","Sous 24h, on vous envoie une maquette finale de votre tenue exacte. Modifiez ce que vous voulez, gratuitement. Rien n'est imprimé avant votre validation."],
    ["On fabrique et on expédie","Une fois validée, on produit et on livre en ~25–30 jours. Livraison offerte dès 49 €."]
   ]
  },
  faq:{
   lab:"Bon à savoir", h2:"Questions fréquentes", sub:"Tout ce qu'il faut savoir avant de commander.",
   items:[
    ["Je paie maintenant ou après avoir vu une maquette ?","Vous payez à la commande. Sous <b>24 heures</b>, on vous envoie une maquette finale de votre tenue exacte, et <b>on n'imprime rien avant votre validation</b>. Une modification ? Gratuite. Votre achat est protégé : vous ne recevez jamais une tenue que vous n'avez pas approuvée."],
    ["Quelle est la matière des tenues ?","Un mélange léger et respirant de <b>polyester-élasthanne</b> extensible pour une liberté de mouvement totale. Chaque design est <b>imprimé par sublimation</b> : les couleurs et les logos sont teints dans le tissu, ils ne craquent, ne se décollent ni ne se décolorent comme un flocage classique."],
    ["Comment choisir la bonne taille ?","Nous proposons une <b>gamme complète, de l'enfant à l'adulte</b>. Utilisez le <b>guide des tailles</b> (le lien « Trouvez votre taille » au moment d'ajouter votre équipe) pour ajuster selon le tour de poitrine et la taille. Entre deux tailles, ou en mélangeant enfants et adultes ? Demandez-nous avant de commander."],
    ["Maillot seul ou kit complet — qu'est-ce qui est inclus ?","À vous de choisir. <b>Maillot seul</b>, c'est le maillot. <b>Kit complet</b> ajoute le <b>short</b>. Cela dépend du produit — vérifiez l'option ci-dessus."],
    ["Y a-t-il un minimum de commande ? Comment fonctionnent les prix ?","<b>Aucun minimum</b> — commandez une seule tenue ou des centaines. Le prix unitaire baisse à mesure que la commande grandit, sans frais cachés."],
    ["Combien de temps avant la livraison ?","La production et la livraison prennent environ <b>25–30 jours</b> après votre commande. Besoin pour une date précise ? Dites-le-nous avant de commander et on vous confirme."],
    ["Le rendu sera-t-il exactement comme l'aperçu ?","Oui, et vous le verrez d'abord. Après votre commande, notre équipe <b>vectorise et nettoie votre écusson et sponsor</b>, affine le placement et vous envoie une <b>maquette finale sous 24h</b>. Rien n'est imprimé avant votre validation."],
    ["Puis-je ajouter les noms et numéros des joueurs ?","Bien sûr. Ajoutez un nom et un numéro par joueur dans la liste de votre équipe au paiement, dans la police et la couleur de votre choix — variez à volonté sur tout l'effectif."],
    ["Et si quelque chose ne va pas sur la maquette ?","On le modifie — gratuitement. Vous pouvez tout ajuster jusqu'à la validation de votre maquette, et on ne lance la production qu'une fois votre accord donné. Aucune impression ratée, jamais."]
   ]
  }
 },
 it:{
  highlights:[
   ["Tessuto","<b>Poliestere-elastan</b> elasticizzato. Stampa a sublimazione: i colori sono tinti nel tessuto, non si crepano né si staccano mai.",false],
   ["Cosa ricevi","<b>Maglia</b>, o <b>kit completo</b> (maglia + pantaloncini). Nomi e numeri per ogni giocatore.",false],
   ["Produzione e spedizione","<b>~25–30 giorni</b> dopo il tuo ordine. Spedizione gratuita sopra i 49 €.",false],
   ["Acquisto protetto","Paghi oggi, ma <b>non stampiamo</b> finché non approvi un mockup finale, inviato <b>entro 24h</b>. Cambia ciò che vuoi, gratis.",true]
  ],
  trust:{
   lab:"Indossate in campo", h2:"Più di 150 squadre si fidano di noi", sub:"In tutta Europa e Nord America.",
   reviews:[
    ["Ottima esperienza per le maglie personalizzate della nostra squadra. Il design era esattamente come richiesto e tutto il processo è stato fluido: il loro team rispondeva velocissimo e sempre disponibile. Molto soddisfatti del risultato, super consigliato!","Karim","Francia"],
    ["10/10 — veloce, economico e di buona qualità!","Olaya","Spagna"],
    ["10/10, le maglie esattamente come le volevamo e consegna nei tempi promessi, tutto perfetto!","Ivan Fedi","Spagna"],
    ["Molto contenti delle nostre maglie personalizzate: ottima qualità e consegna rapida. L'assistenza clienti e il contatto con i designer è fluido e davvero piacevole. Grazie Momuto, lo consiglio.","Nohan Dessaint","Francia"]
   ]
  },
  how:{
   lab:"Processo semplice", h2:"Come funziona",
   promise:["Compra ora, lo perfezioniamo prima di stampare.","Paghi oggi, poi ti inviamo un mockup finale entro 24h. Non produciamo nemmeno una maglia finché non dai l'ok."],
   steps:[
    ["Personalizzala","Clicca «Personalizza il tuo design» qui sopra — colori, stemma, sponsor, nomi e numeri."],
    ["Ordina per la squadra","Aggiungi al carrello, inserisci taglia, nome e numero di ogni giocatore e completa l'ordine. Una maglia o tutta la squadra."],
    ["Approva il mockup","Entro 24h ti inviamo un mockup finale del tuo kit esatto. Cambia ciò che vuoi, gratis. Nulla va in stampa finché non approvi."],
    ["Produciamo e spediamo","Dopo la tua approvazione, produciamo e consegniamo in ~25–30 giorni. Spedizione gratuita sopra i 49 €."]
   ]
  },
  faq:{
   lab:"Buono a sapersi", h2:"Domande frequenti", sub:"Tutto ciò che ti serve prima di ordinare.",
   items:[
    ["Pago adesso o dopo aver visto un mockup?","Paghi al momento dell'ordine. Entro <b>24 ore</b> ti inviamo un mockup finale del tuo kit esatto, e <b>non stampiamo nulla finché non dai l'ok</b>. Vuoi una modifica? Gratis. Il tuo acquisto è protetto: non ricevi mai un kit che non hai approvato."],
    ["Di che materiale sono i kit?","Un tessuto leggero e traspirante in <b>poliestere-elastan</b> elasticizzato per la massima libertà di movimento. Ogni design è <b>stampato a sublimazione</b>: i colori e i loghi sono tinti nel tessuto, quindi non si crepano, staccano o sbiadiscono come una stampa a trasferimento."],
    ["Come scelgo la taglia giusta?","Abbiamo una <b>gamma completa, dal bambino all'adulto</b>. Usa la <b>guida alle taglie</b> (il link «Trova la tua taglia» quando aggiungi la squadra) per scegliere in base a torace e altezza. Sei tra due taglie, o mischi bambini e adulti? Chiedici prima di ordinare."],
    ["Solo maglia o kit completo — cosa include?","Scegli tu. <b>Solo maglia</b> è la maglia. <b>Kit completo</b> aggiunge i <b>pantaloncini</b>. Dipende dal prodotto — controlla l'opzione qui sopra."],
    ["C'è un ordine minimo? Come funzionano i prezzi?","<b>Nessun minimo</b> — ordina un solo kit o centinaia. Il prezzo unitario scende man mano che l'ordine cresce, senza costi nascosti."],
    ["Quanto tempo ci vuole per la consegna?","Produzione e consegna richiedono circa <b>25–30 giorni</b> dopo il tuo ordine. Ti serve per una data precisa? Dillo prima di ordinare e te lo confermiamo."],
    ["Verrà esattamente come l'anteprima?","Sì, e lo vedrai prima tu. Dopo l'ordine, il nostro team <b>vettorializza e pulisce stemma e sponsor</b>, perfeziona il posizionamento e ti invia un <b>mockup finale entro 24h</b>. Nulla va in stampa finché non dai l'ok."],
    ["Posso aggiungere nomi e numeri dei giocatori?","Assolutamente. Aggiungi nome e numero per ogni giocatore nella lista squadra al checkout, con il font e il colore che preferisci — combina come vuoi su tutta la rosa."],
    ["E se qualcosa non va nel mockup?","Lo cambiamo — gratis. Puoi modificare qualsiasi cosa fino all'approvazione del mockup, e iniziamo a produrre solo dopo il tuo ok. Nessuna stampa sbagliata, mai."]
   ]
  }
 }
};

var CSS=`
body.momuto-custom-page{background:#0a0a0a!important;color:#f5f5f5;}
.rtpc{}
.mkh{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:28px auto 0;padding:0 16px;}
.mkh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.mkh-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;}
.mkh-card.hl{border-color:rgba(226,33,75,.45);background:rgba(226,33,75,.06);}
.mkh-card .t{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E2214B;margin-bottom:6px;}
.mkh-card .d{font-size:13px;color:#cfcfd4;line-height:1.5;}
.mkh-card .d b{color:#fff;font-weight:600;}
.mtr{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:48px auto 0;padding:0 16px;color:#f5f5f5;text-align:center;}
.mtr .lab{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#E2214B;}
.mtr h2{font-family:'Bebas Neue',Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.02em;text-transform:uppercase;color:#fff;margin:6px 0 4px;}
.mtr .sub{font-size:15px;color:#a1a1aa;line-height:1.6;margin:0 0 26px;}
.mtr-strip{position:relative;overflow:hidden;margin:0 0 44px;padding:6px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);}
.mtr-track{display:flex;width:max-content;align-items:center;animation:mtr-scroll 46s linear infinite;}
.mtr-strip:hover .mtr-track{animation-play-state:paused;}
.mtr-logo{flex:0 0 auto;width:120px;display:flex;align-items:center;justify-content:center;padding:0 24px;}
.mtr-logo img{width:auto;height:auto;max-width:104px;max-height:84px;object-fit:contain;opacity:.72;transition:opacity .2s;}
.mtr-logo img:hover{opacity:1;}
@keyframes mtr-scroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@media(prefers-reduced-motion:reduce){.mtr-track{animation:none;flex-wrap:wrap;justify-content:center;width:auto;}}
.mtr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;text-align:left;}
.mtr-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;display:flex;flex-direction:column;}
.mtr-stars{color:#E2214B;font-size:13px;letter-spacing:3px;margin-bottom:10px;}
.mtr-card .q{font-size:13.5px;color:#e5e5e5;line-height:1.65;flex:1;}
.mtr-card .by{margin-top:16px;font-size:12.5px;color:#a1a1aa;}
.mtr-card .by b{color:#fff;font-weight:600;}
.mkt{font-family:'Outfit',-apple-system,sans-serif;max-width:1100px;margin:48px auto 0;padding:0 16px;color:#f5f5f5;}
.mkt h2{font-family:'Bebas Neue',Oswald,sans-serif;font-weight:600;font-size:34px;letter-spacing:.02em;text-transform:uppercase;color:#fff;margin:0 0 6px;}
.mkt .lab{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#E2214B;}
.mkt .sub{font-size:15px;color:#a1a1aa;line-height:1.6;margin:0 0 26px;}
.mkt-promise{display:flex;align-items:center;gap:14px;border-left:3px solid #E2214B;background:linear-gradient(90deg,rgba(226,33,75,.08),rgba(226,33,75,0));padding:16px 20px;margin:0 0 34px;border-radius:4px;}
.mkt-promise b{color:#fff;font-size:16px;}
.mkt-promise span{color:#cfcfd4;font-size:14px;line-height:1.55;}
.mkt-steps{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 56px;}
.mkt-step{flex:1 1 220px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px;}
.mkt-step .n{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#E2214B;color:#fff;font-weight:800;font-size:15px;margin-bottom:12px;}
.mkt-step b{display:block;color:#fff;font-size:15px;margin-bottom:5px;}
.mkt-step span{font-size:13px;color:#a1a1aa;line-height:1.55;}
.mkt-faq details{border-top:1px solid rgba(255,255,255,.1);}
.mkt-faq details:last-child{border-bottom:1px solid rgba(255,255,255,.1);}
.mkt-faq summary{list-style:none;cursor:pointer;padding:18px 4px;font-size:16px;font-weight:600;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;}
.mkt-faq summary::-webkit-details-marker{display:none;}
.mkt-faq summary::after{content:'+';font-size:24px;color:#E2214B;font-weight:300;line-height:1;flex-shrink:0;}
.mkt-faq details[open] summary::after{content:'\\2013';}
.mkt-faq p{margin:0 4px 18px;font-size:14px;color:#a1a1aa;line-height:1.7;}
.mkt-faq p b{color:#e5e5e5;font-weight:600;}
.mkt-chat{display:flex;align-items:center;justify-content:center;gap:8px 14px;flex-wrap:wrap;margin:26px 0 4px;}
.mkt-chat span{font-size:14px;color:#a1a1aa;}
.mkt-wa{display:inline-flex;align-items:center;background:#25D366;color:#06311a;font-weight:600;font-size:14px;text-decoration:none;padding:10px 18px;border-radius:999px;transition:transform .1s ease,filter .15s ease;}
.mkt-wa:hover{filter:brightness(1.07);transform:translateY(-1px);}
@media(max-width:860px){.mtr-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.mkt h2{font-size:28px;}.mkt-step{flex:1 1 100%;}.mkt-promise{flex-direction:column;align-items:flex-start;gap:6px;}}
@media(max-width:480px){.mtr-grid{grid-template-columns:1fr;}}
@media(max-width:760px){.mkh-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:420px){.mkh-grid{grid-template-columns:1fr;}}
/* theme overrides (only where the custom block renders) */
body.momuto-custom-page .control-product_detail-title{color:#fff!important;}
body.momuto-custom-page .product-router-nav{background:transparent!important;}
body.momuto-custom-page .control-product_detail-price_box,
body.momuto-custom-page #plugin-product-price,
body.momuto-custom-page .price_append2{display:none!important;}
/* hide the empty native Détail + Témoignages tabs (we supply this content) */
body.momuto-custom-page #product-tabs{display:none!important;}
body.momuto-custom-page .product-preview .bigtiledown-pagination{display:none!important;}
/* preview images: side-by-side, horizontal scroll (desktop), contained + sharp */
@media(min-width:767px){
body.momuto-custom-page .product-preview .preview_bigtiledown_wrapper{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;gap:16px;width:100%!important;scroll-snap-type:x mandatory;padding-bottom:10px;}
body.momuto-custom-page .product-preview .swiper-slide{flex:0 0 auto!important;width:auto!important;float:none!important;margin:0!important;scroll-snap-align:center;}
body.momuto-custom-page .product-preview img{width:auto!important;height:auto!important;max-height:560px!important;max-width:none!important;object-fit:contain;}
}
`;

function stripTags(s){return String(s).replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&mdash;/g,"—");}

function highlights(c){
  var cards=c.highlights.slice(0,3).map(function(x){
    return '<div class="mkh-card'+(x[2]?" hl":"")+'"><div class="t">'+x[0]+'</div><div class="d">'+x[1]+'</div></div>';
  }).join("");
  return '<div class="mkh"><div class="mkh-grid">'+cards+'</div></div>';
}
function trust(c){
  var t=c.trust;
  var a=LOGOS.map(function(l){return '<div class="mtr-logo"><img loading="lazy" alt="'+l[0]+'" src="'+l[1]+'"></div>';}).join("");
  var b=LOGOS.map(function(l){return '<div class="mtr-logo" aria-hidden="true"><img loading="lazy" alt="" src="'+l[1]+'"></div>';}).join("");
  var rev=t.reviews.map(function(r){
    return '<div class="mtr-card"><div class="mtr-stars">★★★★★</div><div class="q">“'+r[0]+'”</div><div class="by"><b>'+r[1]+'</b> — '+r[2]+'</div></div>';
  }).join("");
  return '<div class="mtr"><div class="lab">'+t.lab+'</div><h2>'+t.h2+'</h2><p class="sub">'+t.sub+'</p>'
    +'<div class="mtr-strip"><div class="mtr-track">'+a+b+'</div></div>'
    +'<div class="mtr-grid">'+rev+'</div></div>';
}
function howfaq(c, chat){
  var h=c.how,f=c.faq;
  var steps=h.steps.map(function(s,i){
    return '<div class="mkt-step"><span class="n">'+(i+1)+'</span><b>'+s[0]+'</b><span>'+s[1]+'</span></div>';
  }).join("");
  var qs=f.items.map(function(q){
    return '<details><summary>'+q[0]+'</summary><p>'+q[1]+'</p></details>';
  }).join("");
  var wa='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(chat[2]);
  var cta='<div class="mkt-chat"><span>'+chat[0]+'</span>'
    +'<a class="mkt-wa" href="'+wa+'" target="_blank" rel="noopener noreferrer">'+WA_SVG+chat[1]+'</a></div>';
  return '<div class="mkt"><div class="lab">'+h.lab+'</div><h2>'+h.h2+'</h2>'
    +'<div class="mkt-promise"><b>'+h.promise[0]+'</b><span>'+h.promise[1]+'</span></div>'
    +'<div class="mkt-steps">'+steps+'</div>'
    +'<div class="lab">'+f.lab+'</div><h2>'+f.h2+'</h2><p class="sub">'+f.sub+'</p>'
    +'<div class="mkt-faq">'+qs+'</div>'+cta+'</div>';
}
function faqKeep(items){return items.filter(function(_,i){return [1,2,3,4,5,7].indexOf(i)>-1;});}
function faqSection(c){
  var f=c.faq;
  var qs=faqKeep(f.items).map(function(q){
    return '<details><summary>'+q[0]+'</summary><p>'+q[1]+'</p></details>';
  }).join("");
  return '<div class="mkt"><div class="lab">'+f.lab+'</div><h2>'+f.h2+'</h2><p class="sub">'+f.sub+'</p><div class="mkt-faq">'+qs+'</div></div>';
}
function faqLd(items){
  return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":items.map(function(q){
    return {"@type":"Question","name":stripTags(q[0]),"acceptedAnswer":{"@type":"Answer","text":stripTags(q[1])}};
  })};
}

function render(mount){
  var lang=(mount.getAttribute("data-lang")||"en").toLowerCase();
  var c=I18N[lang]||I18N.en;
  document.body.classList.add("momuto-custom-page");
  mount.innerHTML="<style>"+CSS+"</style>"+highlights(c)+trust(c)+faqSection(c);
  // theme serves preview images as a 416px thumbnail -> upsize to a sharp source (originals are 1500px)
  try{ document.querySelectorAll(".product-preview img").forEach(function(img){
    if(/x-oss-process=image\/resize/.test(img.src)) img.src=img.src.replace(/,w_\d+/, ",w_1200");
  }); }catch(e){}
  try{
    var ld=document.createElement("script");
    ld.type="application/ld+json";
    ld.textContent=JSON.stringify(faqLd(faqKeep(c.faq.items)));
    document.head.appendChild(ld);
  }catch(e){}
}

function boot(){
  var m=document.getElementById("momuto-custom")||document.querySelector("[data-momuto-custom]");
  if(m && !m.__rtpc){ m.__rtpc=1; render(m); }
}
if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded",boot);
})();
