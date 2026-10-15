/* ==========================================================================
   FONTE ÚNICA DE DADOS DA TICKETX
   --------------------------------------------------------------------------
   Tudo o que aparece no site (cards, agenda, página de cada evento, prévia
   do WhatsApp, sitemap) sai desta lista. Depois de editar, rode:

       npm run build

   e publique. Passo a passo completo em COMO-ADICIONAR-EVENTO.md.

   CAMPOS DE CADA EVENTO (* = obrigatório)
     slug*        endereço da página: ticketxco.com.br/eventos/<slug>/
                  só letras minúsculas, números e hífen. Não mude o slug de um
                  evento já divulgado: o link antigo deixaria de funcionar.
     nome*        nome do evento como aparece no site.
     datas*       lista de dias no formato 'AAAA-MM-DD'.
                  dias seguidos viram "6 a 9 de fevereiro"; dias soltos viram
                  "24 e 31 de outubro".
     hora         hora de início 'HH:MM', só se confirmada (vai para o Google).
     horario      texto exibido. Ex.: 'A partir das 23h'.
     categorias*  ids da lista CATEGORIAS abaixo (a primeira é a principal).
     local*       nome do espaço.
     endereco     rua/número/bairro, só se confirmado.
     cidade*      cidade (usada no filtro).
     compra       como comprar. Um destes formatos:
                    { tipo:'desconto', url:'https://...', plataforma:'Sympla', desconto:'5% OFF' }
                    { tipo:'whatsapp', url:'https://wa.me/...' }      (vendas sem taxa)
                    { tipo:'link',     url:'https://...', plataforma:'Sympla' }
                  sem "compra" o evento aparece como "Em breve".
                  COPIE O LINK EXATAMENTE como recebeu (códigos ?d= e ?afid=).
     status       só quando CONFIRMADO: 'esgotado' | 'cancelado' | 'adiado'.
                  "Encerrado" é calculado sozinho pela data.
     destaque     true = aparece fixado em Destaques e primeiro nas fileiras.
     lineup       ['Artista 1', 'Artista 2']  ou por dia:
                  { 'Sáb 6/2': ['Artista 1'], 'Dom 7/2': ['Artista 2'] }
     lineupNota   texto curto depois do line-up. Ex.: 'e mais atrações'.
     descricao    um parágrafo sobre o evento.
     classificacao classificação etária, só se confirmada.
     condicoes    lista: open bar, pacotes, o que o ingresso inclui...
     regras       lista: regras de entrada.
     ingressos    lista de setores/lotes/preços, só com valores confirmados:
                    [{ setor:'Pista', lote:'1º lote', preco:120, obs:'meia-entrada' }]
                  preço em reais, número. Sem "ingressos" a página explica
                  onde consultar os valores.
     fonte        anotação interna de onde veio a informação (não aparece).
   Flyer: salve em assets/events/<slug>.jpg (vertical, de preferência 4:5).
   ========================================================================== */

export const CATEGORIAS = [
  { id: 'carvalheira', nome: 'Carvalheira' },
  { id: 'vaquejada',   nome: 'Vaquejada' },
  { id: 'samba',       nome: 'Samba' },
  { id: 'praia',       nome: 'Praia' },
  { id: 'reveillon',   nome: 'Réveillon' },
  { id: 'carnaval',    nome: 'Carnaval' },
];

export const SITE = {
  url: 'https://ticketxco.com.br',
  nome: 'TicketX',
  instagram: 'https://www.instagram.com/ticketx.co/',
  instagramUser: '@ticketx.co',
  grupoVip: 'https://chat.whatsapp.com/EDg7C8wfqli3WE1woYBWOo?mode=gi_t',
  whatsappNumero: '5581991017226',
  ajuda: 'https://api.whatsapp.com/send/?phone=5581991017226&text=Ol%C3%A1%2C+preciso+de+ajuda%21&type=phone_number&app_absent=0',
  fuso: 'America/Recife',
};

export const EVENTOS = [
  {
    slug: 'bololo',
    nome: 'Bololô',
    datas: ['2026-10-16'],
    hora: '23:00',
    horario: 'Das 23h às 5h10',
    categorias: ['carvalheira'],
    local: 'Cachaçaria Carvalheira',
    endereco: 'Av. Sul Governador Cid Sampaio, 4921, Imbiribeira',
    cidade: 'Recife',
    compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/evento/bololo-v32026/3606265?d=TICKETX', plataforma: 'Sympla', desconto: '5% OFF' },
    lineup: ['Syon Trio', 'Vilx', 'Gordinho Bolado', 'Mau Lopes'],
    condicoes: ['Open bar'],
    classificacao: '18 anos. Proibida a entrada de menores, mesmo com autorização.',
    fonte: 'site anterior + página da Sympla (endereço, horário e classificação) em 14/10/2026',
  },
  {
    slug: 'vaquejada-vitoria',
    nome: 'Vaquejada Vitória',
    datas: ['2026-10-10'],
    categorias: ['vaquejada'],
    local: 'Parque Roberta Urquiza',
    cidade: 'Vitória de Santo Antão',
    compra: { tipo: 'whatsapp', url: 'https://wa.me/5581991017226?text=Ol%C3%A1,%20gostaria%20de%20comprar%20o%20ingresso%20da%20Vaquejada%20de%20Vitoria!%20' },
    lineup: ['Lipe Lucena', 'Raí Saia Rodada', 'Tarcísio do Acordeon', 'Noara Marques'],
  },
  {
    slug: 'barchef',
    nome: 'Barchef Recife',
    datas: ['2026-10-24', '2026-10-31'],
    hora: '17:00',
    horario: 'A partir das 17h',
    categorias: ['samba'],
    local: 'Mirante do Paço',
    endereco: 'Travessa do Amorim, 75, Recife Antigo',
    cidade: 'Recife',
    compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/evento/sambinha-do-barcha-2-anos/3583709?d=TicketX', plataforma: 'Sympla', desconto: '5% OFF' },
    descricao: 'Samba do Barcha, edição especial de 2 anos, em duas datas com line-ups diferentes.',
    condicoes: ['Tem ingresso para os dois dias juntos (casadinha).'],
    lineup: {
      'Sáb 24/10': ['Lipe Lucena', 'Felipe Farra', 'Vilx', 'De Cara com o Samba', 'Soundsbymaul', 'Mau Lopes'],
      'Sáb 31/10': ['Nuzio Medeiros', 'Math Gomes', 'Roginho', 'Sambarrasta', 'Soundsbymaul', 'Mau Lopes'],
    },
  },
  {
    slug: 'vaquejada-caruaru',
    nome: 'Vaquejada Caruaru',
    datas: ['2026-10-31'],
    categorias: ['vaquejada'],
    local: 'Parque Fernando Lucena',
    cidade: 'Caruaru',
    compra: { tipo: 'whatsapp', url: 'https://wa.me/5581991017226?text=Ol%C3%A1,%20gostaria%20de%20comprar%20o%20ingresso%20da%20Vaquejada%20de%20Caruaru!%20' },
    lineup: ['Rey Vaqueiro', 'Wesley Safadão', 'Natanzinho Lima'],
  },
  {
    slug: 'vaquejada-garanhuns',
    nome: 'Vaquejada Garanhuns',
    datas: ['2026-10-31'],
    categorias: ['vaquejada'],
    local: 'Parque Acauã',
    cidade: 'Garanhuns',
    compra: { tipo: 'whatsapp', url: 'https://wa.me/5581991017226?text=Ol%C3%A1,%20gostaria%20de%20comprar%20o%20ingresso%20da%20Vaquejada%20de%20Garanhuns!%20' },
    lineup: ['Henrique & Juliano', 'Grelo', 'Mano Walter', 'Patrick Costa'],
  },
  {
    slug: 'bikini-memories',
    nome: 'Bikini Memories',
    datas: ['2026-11-20', '2026-11-21'],
    hora: '16:00',
    horario: 'A partir das 16h',
    categorias: ['carvalheira', 'praia'],
    local: 'Praia de Maracaípe',
    cidade: 'Ipojuca',
    compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/evento/bikini-memories-2026/3578485?d=TICKETX', plataforma: 'Sympla', desconto: '5% OFF' },
    lineup: {
      'Sex 20/11 · Bololô': ['Felipe Amorim', 'Math Gomes', 'Lipe Napoli', 'Vilx'],
      'Sáb 21/11 · Borogodó': ['Nattan', 'Zé Vaqueiro', 'Sambarrasta', 'Mau Lopes'],
    },
    condicoes: ['Full open bar nos dias 20 e 21/11. Comidas e bebidas são para consumo no local.'],
    classificacao: 'Proibida a entrada de menores de 18 anos.',
    regras: [
      'Proibida a entrada com alimentos e bebidas de qualquer natureza.',
      'Revista na entrada.',
      'Proibido entrar com armas, coolers, fogos de artifício e objetos cortantes ou contundentes.',
      'Quem sair do evento não pode voltar, mesmo com pulseira ou camisa.',
    ],
    fonte: 'site anterior + página da Sympla (open bar e regras) em 14/10/2026',
  },
  {
    slug: 'reveillon-amore',
    nome: 'Réveillon Amoré',
    datas: ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31'],
    categorias: ['reveillon', 'carvalheira', 'praia'],
    local: 'Arena Amoré',
    endereco: 'Praia de Maracaípe (ao lado da pousada Xalés de Maracaípe)',
    cidade: 'Ipojuca',
    compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/evento/reveillon-amore-2027/3390641?d=MILTONV', plataforma: 'Sympla', desconto: '5% OFF' },
    lineup: ['Ivete Sangalo', 'Nattan', 'Luan Santana', 'Pedro Sampaio', 'João Gomes', 'Menos É Mais', 'Léo Santana', 'Xand Avião', 'Matheus & Kauan', 'Belo', 'Dennis', 'Henry Freitas', 'Léo Foguete', 'Felipe Amorim', 'Timbalada', 'Matheus Fernandes', 'Tília', 'Math Gomes'],
    lineupNota: 'e mais atrações',
    condicoes: [
      'Pacotes: 5 Festas Amoré, ou Festas + Moréa Beach Club.',
      'As festas noturnas de 27 a 31/12 são open bar.',
      'O Moréa Beach Club não é open bar.',
      'Os ingressos não incluem hospedagem nem transfer.',
    ],
    fonte: 'site anterior + página da Sympla (condições) em 14/10/2026',
  },
  {
    slug: 'wedo-na-praia',
    nome: 'Wedo na Praia',
    datas: ['2027-01-16'],
    categorias: ['praia'],
    local: 'Maracaípe',
    cidade: 'Ipojuca',
    compra: { tipo: 'whatsapp', url: 'https://wa.me/5581991017226?text=Ol%C3%A1,%20gostaria%20de%20comprar%20o%20ingresso%20do%20Wedo%20Na%20Praia%202k27!%20' },
    descricao: 'Edição de 10 anos do Wedo na Praia.',
    lineup: ['Henrique e Juliano', 'Rey Vaqueiro', 'Henry Freitas', 'Léo Foguete', 'Patrick Costa'],
  },
  {
    slug: 'carvalheira-na-ladeira',
    nome: 'Carvalheira na Ladeira',
    datas: ['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'],
    hora: '13:00',
    horario: 'A partir das 13h',
    categorias: ['carvalheira', 'carnaval'],
    local: 'Memorial Arcoverde',
    endereco: 'Av. Dom Hélder Câmara',
    cidade: 'Olinda',
    destaque: true,
    compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/carvalheira-na-ladeira-2027__3314458?afid=109062', plataforma: 'Sympla', desconto: '5% OFF' },
    lineup: {
      'Sáb 6/2': ['Sean Paul', 'Armin Van Buuren', 'Jorge e Mateus', 'Menos É Mais', 'Henry Freitas', 'Natanzinho Lima', 'Dubdogz', 'Felipe Amorim', 'MC Cabelinho', 'Syon Trio', 'Eric Land', 'Jammil', 'Raí Saia Rodada'],
      'Dom 7/2': ['Anitta', 'Fisher', 'Xand Avião', 'Matheus e Kauan', 'Belo', 'Léo Foguete', 'Dilsinho', 'Timbalada', 'Wiu', 'Kadu Martins', 'Locos', 'Lipe Lucena'],
      'Seg 8/2': ['Pedro Sampaio', 'Wesley Safadão', 'Thiaguinho', 'Léo Santana', 'Panda', 'Matheus Fernandes', 'Cat Dealers', 'Priscila Senna convida Joyce Alane', 'Teto', 'Nuzio Medeiros', 'Math Gomes', 'Matheus Alves'],
      'Ter 9/2': ['Vintage Culture', 'Nattan', 'Alceu Valença', 'Simone Mendes', 'Dennis', 'Zé Vaqueiro', 'Péricles', 'Mari Fernandez', 'Banda Eva', 'Kevin O Chris', 'Rogerinho', 'Doozie', 'Ariel B'],
    },
    lineupNota: 'Residentes: Korossy, DaMata e Botelho.',
    condicoes: [
      'Open bar.',
      'Compra limitada a 2 ingressos por CPF (2 pacotes ou 2 ingressos).',
    ],
    regras: [
      'Acesso por reconhecimento facial (cadastro obrigatório).',
      'Menores de 18 anos só com termo assinado e acompanhados do responsável.',
    ],
    fonte: 'site anterior + página da Sympla (line-up e limite por CPF) em 14/10/2026',
  },
  {
    slug: 'carnaval-boa-viagem',
    nome: 'Carnaval Boa Viagem',
    datas: ['2027-02-07', '2027-02-08', '2027-02-09'],
    categorias: ['carnaval'],
    local: 'Arena Boa Viagem',
    cidade: 'Recife',
    compra: { tipo: 'whatsapp', url: 'https://wa.me/5581991017226?text=Ol%C3%A1,%20gostaria%20de%20comprar%20o%20ingresso%20do%20CBV%202k27!' },
    lineup: {
      'Dom 7/2': ['Jorge & Mateus', 'Matheus & Kauan', 'João Gomes', 'Henry Freitas', 'Léo Foguete', 'Timbalada'],
      'Seg 8/2': ['Wesley Safadão', 'Natanzinho Lima', 'Zé Neto & Cristiano', 'Rey Vaqueiro', 'Thiaguinho'],
      'Ter 9/2': ['Xand Avião', 'Nattan', 'Zé Vaqueiro', 'Dennis', 'Panda', 'Eva'],
    },
  },
];
